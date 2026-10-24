import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditor,UNIT_PRESETS,validateMesh} from '../core.mjs';
import {normalizeArchitecture,ARCHITECTURE_SCHEMA_VERSION} from '../architecture/model.mjs';
import {previewRoofGroup} from '../architecture/editor-adapter.mjs';
import {roofBoundaryEdgeKey} from '../architecture/roof-boundary.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';
const boundary=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}],north=roofBoundaryEdgeKey(boundary[2],boundary[3]);
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const apply=(e,op)=>{const r=e.applyArchitecture(op);assert.equal(r.ok,true,r.message);return r;};
const roof=e=>e.state.architectureDerived.roofs[0];
const mesh=e=>e.state.entities.filter(x=>e.getArchitectureOwner(x.id)?.kind==='roofGroup');
function setup({wallSource=false,type='GABLE',rooms=false}={}){
 const e=createEditor({settings:UNIT_PRESETS.architectural});
 if(wallSource||rooms){apply(e,{type:'addWalls',points:boundary,closed:true,thickness:6,referenceFace:'left',bearingElevation:120,baseElevation:0,role:'exterior'});if(rooms){apply(e,{type:'recognizeRooms'});apply(e,{type:'setRoom',roomId:e.state.architecture.rooms[0].id,values:{ceilingElevation:96,targetCeilingElevation:108,allowCeilingChange:true,ceilingFinishThickness:0}});}}
 const gableAssignments=inferGableCandidates(boundary).alternatives.find(x=>x.ridgeDirection==='X').edgeKeys;
 apply(e,{type:'addRoof',id:'roof-1',name:'Independent R5 rectangle',...(wallSource?{wallIds:e.state.architecture.walls.map(w=>w.id)}:{boundary}),riseTwice:8,bearingElevation:120,overhang:0,rakeOverhang:0,roofType:type,gableAssignments:type==='GABLE'?gableAssignments:[],gablePolicy:'ALL_GABLE'});
 return e;
}
const change=(e,elevation=144)=>apply(e,{type:'setRoof',roofGroupId:'roof-1',values:{bearingAssignments:[{edgeKey:north,elevation}]}});

test('R5 historical schemas migrate only in memory; all original source values and file bytes remain',()=>{
 for(const filename of ['roof-space-H-v19.linecraft','ceiling-space-v110.linecraft','tray-ceiling-v111.linecraft','gable-v112.linecraft','scripting-v1121.linecraft','roof-plot-v1122.linecraft']){
  const path=new URL(`../samples/${filename}`,import.meta.url),bytes=readFileSync(path,'utf8'),raw=JSON.parse(bytes),e=createEditor(raw);
  assert.equal(e.state.architecture.schemaVersion,ARCHITECTURE_SCHEMA_VERSION);
  for(const group of e.state.architecture.roofGroups){assert.deepEqual(group.bearingAssignments,[]);const old=raw.architecture.roofGroups.find(g=>g.id===group.id);for(const [key,value]of Object.entries(old))assert.deepEqual(group[key],value,key);}
  assert.equal(readFileSync(path,'utf8'),bytes);const saved=e.serialize();assert.equal(createEditor(JSON.parse(saved)).serialize(),saved);
 }
});

test('R5 strict assignments reject duplicate, stale, nonfinite, code-like fields and old schema declarations atomically',()=>{
 const e=setup(),before=e.serialize();
 for(const bearingAssignments of [[{edgeKey:north,elevation:144},{edgeKey:north,elevation:132}],[{edgeKey:'missing',elevation:144}],[{edgeKey:north,elevation:Infinity}],[{edgeKey:north,elevation:144,expression:'1+1'}],Array(201).fill({edgeKey:north,elevation:144})]){
  assert.equal(e.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{bearingAssignments}}).ok,false);assert.equal(e.serialize(),before);
 }
 const raw=JSON.parse(before).architecture;raw.schemaVersion=4;raw.roofGroups[0].bearingAssignments=[{edgeKey:north,elevation:144}];assert.throws(()=>normalizeArchitecture(raw,e.state.settings),/schema 5/);
});

test('R5 pure preview predicts the independently calculated ridge with no source, view or history mutation',()=>{
 const e=setup(),before=e.serialize(),history=e.canUndo,group={...e.state.architecture.roofGroups[0],bearingAssignments:[{edgeKey:north,elevation:144}]};
 const r=previewRoofGroup(e.state.architecture,group,e.state.settings);assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));
 const ridge=r.faces.flatMap(f=>f.vertices).filter(p=>Math.abs(p.z-172)<1e-6);assert.ok(ridge.length);for(const p of ridge)near(p.y,156);
 assert.equal(e.serialize(),before);assert.equal(e.canUndo,history);assert.deepEqual(e.state.architecture.roofGroups[0].bearingAssignments,[]);
});

test('R5 bearing revision is one existing Undo/Redo group, preserves prior drafting history, ceilings, camera and locked scales',()=>{
 const e=setup({rooms:true});
 const layout=e.addLayout('R5 analytical sheet',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true);
 assert.equal(e.addViewport(layout.layoutId,{x:10,y:10,width:180,height:240},{scaleDenominator:96,locked:true}).ok,true);
 assert.equal(e.setWorkspace('3d').ok,true);assert.equal(e.set3DView({target:{x:240,y:120,z:140},yaw:35,pitch:25,scale:1,autoTarget:false}).ok,true);
 for(const token of ['LINE','600,0','650,0',''])assert.equal(e.execute(token).ok,true);
 const line=e.state.entities.find(x=>x.type==='LINE');assert.ok(line);
 const before=e.serialize(),fixed=structuredClone({rooms:e.state.architecture.rooms,settings:e.state.settings,layers:e.state.layers,layouts:e.state.layouts,camera:e.state.camera3d});change(e);const after=e.serialize();
 assert.equal(roof(e).status,'ok');assert.equal(roof(e).variableBearings,true);near(roof(e).quantities.maxRoofElevation,172);
 assert.deepEqual({rooms:e.state.architecture.rooms,settings:e.state.settings,layers:e.state.layers,layouts:e.state.layouts,camera:e.state.camera3d},fixed);
 assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);assert.equal(e.undo().ok,true);assert.equal(e.undo().ok,true);assert.equal(e.state.entities.some(x=>x.id===line.id),false);
});

test('R5 impossible ridge/support consumption rejects the proposal and keeps the accepted roof and Undo history',()=>{
 const e=setup();change(e);const before=e.serialize(),geometry=JSON.stringify(mesh(e));
 const result=e.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{bearingAssignments:[{edgeKey:north,elevation:240}]}});assert.equal(result.ok,false);assert.match(result.message,/support|consum|activat|topology/i);
 assert.equal(e.serialize(),before);assert.equal(JSON.stringify(mesh(e)),geometry);assert.equal(e.undo().ok,true);assert.deepEqual(e.state.architecture.roofGroups[0].bearingAssignments,[]);
});

test('R5 actual source-wall bearing edit shifts the roof and returning to baseline restores exact prior meshes',()=>{
 const e=setup({wallSource:true,rooms:true}),before=JSON.stringify(mesh(e)),rooms=structuredClone(e.state.architecture.rooms),wall=e.state.architecture.walls.find(w=>{const ns=e.state.architecture.wallNodes;return ns.find(n=>n.id===w.startNodeId).y===240&&ns.find(n=>n.id===w.endNodeId).y===240;});
 apply(e,{type:'setWall',wallId:wall.id,values:{bearingElevation:144}});assert.equal(roof(e).status,'ok');near(roof(e).quantities.maxRoofElevation,172);assert.deepEqual(e.state.architecture.rooms,rooms);assert.ok(roof(e).sourceSupportChecks.some(c=>c.wallId===wall.id&&c.bearingElevation===144));
 apply(e,{type:'setWall',wallId:wall.id,values:{bearingElevation:120}});assert.equal(JSON.stringify(mesh(e)),before);
 apply(e,{type:'setWall',wallId:wall.id,values:{heightLocked:true}});const locked=e.serialize();assert.equal(e.applyArchitecture({type:'setWall',wallId:wall.id,values:{bearingElevation:144}}).ok,false);assert.equal(e.serialize(),locked);
});

test('R5 conflicting declared edge and actual supporting wall elevations are rejected without changing either',()=>{
 const e=setup({wallSource:true}),before=e.serialize();const result=e.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{bearingAssignments:[{edgeKey:north,elevation:144}]}});
 assert.equal(result.ok,false);assert.match(result.message,/conflicts.*source support wall/);assert.equal(e.serialize(),before);
});

test('R5 HIP generates separate selectable guarded step interfaces with independent physical areas',()=>{
 const e=setup({type:'HIP'});change(e);const r=roof(e);assert.equal(r.status,'ok');assert.equal(r.stepClosures.length,2);near(r.stepClosures.reduce((s,c)=>s+c.area,0),1728);near(e.state.architectureDerived.quantities.stepClosureArea,1728);
 const steps=mesh(e).filter(x=>x.id.includes('/step-closure-'));assert.equal(steps.length,2);for(const entity of mesh(e))validateMesh(entity);
 const before=e.serialize();e.select([steps[0].id]);assert.equal(e.getArchitectureOwner(steps[0].id).id,'roof-1');assert.equal(e.deleteSelected().ok,false);assert.equal(e.moveMeshVertices(steps[0].id,[0],{x:1,y:0,z:0}).ok,false);assert.equal(e.serialize(),before);
 assert.equal(r.quantities.trussDesignManufacturingComplexitySurcharge,0);assert.equal(e.state.architectureDerived.quantities.trussDesignSurcharge,0);assert.equal(e.state.architectureDerived.quantities.manufacturingComplexitySurcharge,0);assert.equal(r.validation.structural,'unverified');
});

test('R5 native persistence stores source overrides only and regenerates all roof/closure/step geometry',()=>{
 for(const type of ['HIP','GABLE']){const e=setup({type});change(e);const text=e.serialize(),raw=JSON.parse(text);assert.equal(raw.architecture.schemaVersion,6);assert.deepEqual(raw.entities,[]);assert.deepEqual(raw.architecture.roofGroups[0].bearingAssignments,[{edgeKey:north,elevation:144}]);for(const key of ['faces','stepClosures','supportChecks','events'])assert.ok(!(key in raw.architecture.roofGroups[0]));const restored=createEditor(raw);assert.equal(restored.serialize(),text);assert.deepEqual(mesh(restored),mesh(e));assert.deepEqual(roof(restored),roof(e));}
});

test('R5 geometric edge assignment survives winding/cyclic order, while source changes require renewed decisions',()=>{
 const e=setup();change(e);for(const points of [[...boundary].reverse(),[...boundary.slice(2),...boundary.slice(0,2)]]){apply(e,{type:'setRoof',roofGroupId:'roof-1',values:{boundary:points}});assert.equal(roof(e).status,'ok');near(roof(e).quantities.maxRoofElevation,172);}
 const before=e.serialize();assert.equal(e.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{boundary:boundary.map(p=>({x:p.x+12,y:p.y}))}}).ok,false);assert.equal(e.serialize(),before);
});

test('R5 a single eave override cannot silently erase different bearing constraints',()=>{
 const e=setup();change(e);const before=e.serialize(),group={...e.state.architecture.roofGroups[0],eaveElevation:120};const result=previewRoofGroup(e.state.architecture,group,e.state.settings);assert.equal(result.status,'infeasible');assert.match(result.diagnostics.join(' '),/single explicit eave/);assert.equal(e.serialize(),before);
});

test('R5 semantic API cannot bypass atomic bearing checks through pitch, default datum or maximum ridge edits',()=>{
 const e=setup({type:'HIP'});change(e);const before=e.serialize(),geometry=JSON.stringify(mesh(e));
 for(const values of [{riseTwice:2},{bearingElevation:0},{maxRidgeElevation:160},{eaveElevation:120}]){const result=e.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values});assert.equal(result.ok,false,JSON.stringify(values));assert.equal(e.serialize(),before);assert.equal(JSON.stringify(mesh(e)),geometry);}
 assert.equal(e.undo().ok,true);assert.deepEqual(e.state.architecture.roofGroups[0].bearingAssignments,[]);
});

test('R5 model-unit assignments preserve physical ridge, ceiling datum and native coordinates in inches/feet/mm/meters',()=>{
 for(const [units,mmPerUnit]of Object.entries({in:25.4,ft:304.8,mm:1,m:1000})){
  const factor=25.4/mmPerUnit,points=boundary.map(p=>({x:p.x*factor,y:p.y*factor})),e=createEditor({settings:{units,linearFormat:'decimal'}}),gableAssignments=inferGableCandidates(points).alternatives.find(x=>x.ridgeDirection==='X').edgeKeys;
  apply(e,{type:'addRoof',id:'roof-1',boundary:points,riseTwice:8,bearingElevation:120*factor,roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments,bearingAssignments:[{edgeKey:roofBoundaryEdgeKey(points[2],points[3]),elevation:144*factor}]});
  const r=roof(e);assert.equal(r.status,'ok');near(r.quantities.maxRoofElevation*mmPerUnit,172*25.4,1e-5);for(const p of r.faces.flatMap(f=>f.vertices).filter(p=>Math.abs(p.z-172*factor)<1e-6))near(p.y*mmPerUnit,156*25.4,1e-5);
  near(e.state.architecture.levels[0].defaultCeilingElevation*mmPerUnit,96*25.4,1e-5);assert.equal(e.state.settings.units,units);assert.deepEqual(e.state.architecture.roofGroups[0].boundary,points);assert.equal(createEditor(JSON.parse(e.serialize())).serialize(),e.serialize());
 }
});

test('R5 fixed-roof clearance integrates the changed cap and retains independent ceiling and source quantities',()=>{
 const e=setup({rooms:true});change(e);const space=e.state.architectureDerived.spaces[0],room=e.state.architectureDerived.rooms[0];assert.equal(space.status,'ok');
 const minY=Math.min(...room.boundary.map(p=>p.y)),maxY=Math.max(...room.boundary.map(p=>p.y)),width=Math.max(...room.boundary.map(p=>p.x))-Math.min(...room.boundary.map(p=>p.x));
 const lowCap=120+minY/3,highCap=144+(240-maxY)/3,sectionArea=(lowCap+172)/2*(156-minY)+(172+highCap)/2*(maxY-156);
 near(space.roofPotential.volumeAboveFloor,sectionArea*width,.01);near(space.current.usableVolume,room.area*96,.01);near(space.maxFlatCeilingElevation,lowCap);assert.equal(e.state.architecture.rooms[0].ceilingElevation,96);assert.equal(e.state.architecture.rooms[0].ceilingFinishThickness,0);
 const fixed=JSON.stringify(mesh(e));apply(e,{type:'applyFlatCeiling',roomId:e.state.architecture.rooms[0].id,elevation:'target'});assert.equal(JSON.stringify(mesh(e)),fixed);assert.equal(e.state.architecture.rooms[0].ceilingElevation,108);near(roof(e).quantities.maxRoofElevation,172);
});

test('R5 linked unequal-bearing source cannot commit a driving span that consumes its support',()=>{
 const e=setup({wallSource:true,type:'HIP'}),wall=e.state.architecture.walls.find(w=>{const ns=e.state.architecture.wallNodes;return ns.find(n=>n.id===w.startNodeId).y===240&&ns.find(n=>n.id===w.endNodeId).y===240;});apply(e,{type:'setWall',wallId:wall.id,values:{bearingElevation:144}});
 const source=e.state.architecture,start=source.wallNodes.find(n=>n.x===0&&n.y===0),end=source.wallNodes.find(n=>n.x===0&&n.y===240),before=e.serialize(),geometry=JSON.stringify(mesh(e));
 const result=e.applyArchitecture({type:'driveSpan',startNodeId:start.id,endNodeId:end.id,axis:'y',value:60});assert.equal(result.ok,false);assert.match(result.message,/support|consum|activat|topology/i);assert.equal(e.serialize(),before);assert.equal(JSON.stringify(mesh(e)),geometry);assert.equal(e.undo().ok,true);assert.equal(roof(e).variableBearings,false);
});

test('R5 new roofs preflight existing unequal walls and partial explicit support/default conflicts',()=>{
 for(const partial of [false,true]){
  const e=createEditor({settings:UNIT_PRESETS.architectural});apply(e,{type:'addWalls',points:boundary,closed:true,thickness:6,referenceFace:'left',bearingElevation:120,baseElevation:0,role:'exterior'});
  const wall=e.state.architecture.walls.find(w=>{const ns=e.state.architecture.wallNodes;return ns.find(n=>n.id===w.startNodeId).y===240&&ns.find(n=>n.id===w.endNodeId).y===240;});apply(e,{type:'setWall',wallId:wall.id,values:{bearingElevation:240}});const before=e.serialize();
  const result=e.applyArchitecture({type:'addRoof',id:'roof-1',riseTwice:8,bearingElevation:120,roofType:'HIP',...(partial?{boundary,supportWallIds:[wall.id]}:{wallIds:e.state.architecture.walls.map(w=>w.id)})});
  assert.equal(result.ok,false);assert.match(result.message,/support|consum|activat|topology/i);assert.equal(e.serialize(),before);assert.equal(e.state.architecture.roofGroups.length,0);
 }
});
