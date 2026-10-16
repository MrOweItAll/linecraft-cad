import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditor,UNIT_PRESETS,validateMesh} from '../core.mjs';
import {normalizeArchitecture} from '../architecture/model.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';
const boundary=[{x:0,y:0},{x:240,y:0},{x:240,y:144},{x:0,y:144}];
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const apply=(editor,operation)=>{const result=editor.applyArchitecture(operation);assert.equal(result.ok,true,result.message);return result;};
const roof=editor=>editor.state.architectureDerived.roofs[0];
const meshes=editor=>editor.state.entities.filter(entity=>editor.getArchitectureOwner(entity.id)?.kind==='roofGroup');
const assignments=points=>inferGableCandidates(points,{tolerance:1e-6}).edges.filter(edge=>edge.a.x===edge.b.x).map(edge=>edge.key);
function profile(gable=true){const editor=createEditor({settings:UNIT_PRESETS.architectural});apply(editor,{type:'addWalls',points:boundary,closed:true,referenceFace:'left',thickness:6,baseElevation:0,bearingElevation:120,role:'exterior'});apply(editor,{type:'recognizeRooms'});apply(editor,{type:'setRoom',roomId:'room-1',values:{ceilingElevation:96,targetCeilingElevation:108,minimumClearHeight:84,headroomThreshold:108,allowCeilingChange:true}});apply(editor,{type:'addRoof',riseTwice:8,overhang:0,bearingElevation:120,supportWallIds:editor.state.architecture.walls.map(wall=>wall.id)});if(gable)apply(editor,{type:'setRoof',roofGroupId:'roof-1',values:{roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:assignments(boundary)}});return editor;}

test('R4 explicit schema-1/2/3 migrations preserve all historical source fields and released bytes',()=>{
 for(const filename of ['roof-space-H-v19.linecraft','ceiling-space-v110.linecraft','tray-ceiling-v111.linecraft']){const url=new URL(`../samples/${filename}`,import.meta.url),bytes=readFileSync(url,'utf8'),raw=JSON.parse(bytes),editor=createEditor(raw);assert.equal(editor.state.architecture.schemaVersion,5);for(const group of editor.state.architecture.roofGroups){const old=raw.architecture.roofGroups.find(g=>g.id===group.id);for(const [key,value]of Object.entries(old))assert.deepEqual(group[key],value,key);assert.deepEqual(group.gableAssignments,[]);assert.equal(group.gablePolicy,'EXPLICIT');assert.equal(group.rakeOverhang,0);}assert.equal(readFileSync(url,'utf8'),bytes);const saved=editor.serialize();assert.equal(createEditor(JSON.parse(saved)).serialize(),saved);}
});

test('R4 strict gable source rejects unsupported policy, duplicates, invalid extents and pre-schema-4 fields',()=>{
 const editor=profile(),source=editor.serialize();for(const values of [{gablePolicy:'AUTO'},{gableAssignments:['a','a']},{gableAssignments:[1]},{rakeOverhang:-1},{rakeOverhang:Infinity},{gableAssignments:[...(Array(201).keys())].map(String)}]){assert.equal(editor.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values}).ok,false);assert.equal(editor.serialize(),source);}const raw=JSON.parse(source).architecture;raw.schemaVersion=3;assert.throws(()=>normalizeArchitecture(raw,editor.state.settings),/schema 4/);
});

test('R4 confirmed gable conversion is one grouped Undo/Redo and preserves bearings, rooms, units and camera',()=>{
 const editor=profile(false),before=editor.serialize(),fixed=structuredClone({walls:editor.state.architecture.walls,rooms:editor.state.architecture.rooms,camera:editor.state.camera3d,settings:editor.state.settings});apply(editor,{type:'setRoof',roofGroupId:'roof-1',values:{roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:assignments(boundary)}});const after=editor.serialize();assert.equal(roof(editor).status,'ok');assert.deepEqual({walls:editor.state.architecture.walls,rooms:editor.state.architecture.rooms,camera:editor.state.camera3d,settings:editor.state.settings},fixed);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),after);
});

test('R4 exact rectangular gable skin and separate closure surfaces keep clearance and quantities independent',()=>{
 const editor=profile(),report=roof(editor),quantity=editor.state.architectureDerived.quantities;assert.equal(report.status,'ok');near(report.quantities.projectedArea,240*144);near(quantity.roofSurfaceArea,240*144*Math.sqrt(10/9));near(quantity.gableClosureArea,2*144*24/2);assert.ok(quantity.roofRakeLength>0);assert.ok(quantity.roofEaveLength>0);const all=meshes(editor),closures=all.filter(entity=>editor.getArchitectureOwner(entity.id).part==='gable');assert.ok(closures.length>=2);assert.equal(all.filter(entity=>entity.id.endsWith('/surface')).length,1);for(const entity of all)validateMesh(entity);assert.ok(report.faces.every(face=>face.vertices.length>=3));const space=editor.state.architectureDerived.spaces[0];assert.equal(space.status,'ok');near(space.maxFlatCeilingElevation,120);near(space.current.usableVolume,240*144*96);near(space.roofPotential.volumeAboveFloor,240*(144*120+144*24/2));assert.equal(space.assumptions.analysisMode,'mathematical-zero-thickness');assert.equal(quantity.framingLumber,null);assert.equal(quantity.trussDesignSurcharge,0);assert.equal(quantity.manufacturingComplexitySurcharge,0);
});

test('R4 ceiling and tray edits leave accepted gable roof skin and closure bytes unchanged',()=>{
 const editor=profile(),before=JSON.stringify(meshes(editor)),parameters=structuredClone(editor.state.architecture.roofGroups),walls=structuredClone(editor.state.architecture.walls);apply(editor,{type:'applyFlatCeiling',roomId:'room-1',elevation:'target'});apply(editor,{type:'setTrayCandidate',roomId:'room-1',candidate:{min:{x:48,y:36},max:{x:192,y:108},baseElevation:96,raisedElevation:132}});apply(editor,{type:'applyTrayCandidate',roomId:'room-1'});assert.equal(JSON.stringify(meshes(editor)),before);assert.deepEqual(editor.state.architecture.roofGroups,parameters);assert.deepEqual(editor.state.architecture.walls,walls);assert.equal(editor.state.architectureDerived.spaces[0].current.profileType,'tray');assert.equal(editor.state.architectureDerived.spaces[0].current.feasible,true);
});

test('R4 geometric gable keys survive reversed and cyclic source boundary ordering',()=>{
 const editor=profile(),keys=structuredClone(editor.state.architecture.roofGroups[0].gableAssignments),expectedArea=roof(editor).quantities.roofSurfaceArea;for(const points of [[...boundary].reverse(),[...boundary.slice(2),...boundary.slice(0,2)]]){apply(editor,{type:'setRoof',roofGroupId:'roof-1',values:{boundarySource:'explicit',boundaryWallIds:[],boundary:points}});assert.deepEqual(editor.state.architecture.roofGroups[0].gableAssignments,keys);assert.equal(roof(editor).status,'ok');near(roof(editor).quantities.roofSurfaceArea,expectedArea);}
});

test('R4 manual stale or incomplete assignments reject atomically without false current geometry',()=>{
 const editor=profile(),before=editor.serialize(),geometry=JSON.stringify(meshes(editor)),keys=assignments(boundary);for(const values of [{gableAssignments:[]},{gableAssignments:[keys[0]]},{gableAssignments:['stale-edge']},{gableAssignments:inferGableCandidates(boundary).edges.map(edge=>edge.key)}]){const result=editor.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values});assert.equal(result.ok,false);assert.equal(editor.serialize(),before);assert.equal(JSON.stringify(meshes(editor)),geometry);}
});

test('R4 wall span edits retain semantic assignments but stale footprint requires decision and contributes no mesh',()=>{
 const editor=profile(),before=editor.serialize(),keys=structuredClone(editor.state.architecture.roofGroups[0].gableAssignments);apply(editor,{type:'driveSpan',startNodeId:'node-1',endNodeId:'node-2',axis:'x',value:264});assert.deepEqual(editor.state.architecture.roofGroups[0].gableAssignments,keys);assert.notEqual(roof(editor).status,'ok');assert.equal(meshes(editor).length,0);assert.equal(editor.state.architectureDerived.quantities.roofSurfaceArea,0);assert.ok(editor.state.architectureDerived.diagnostics.some(d=>/stale|assignment|decision|edge/i.test(d.message)));assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
});

test('R4 rake overhang is independent from eave drop and HIP ignores its stored value',()=>{
 const editor=profile(),old=roof(editor),oldMinimum=Math.min(...old.faces.flatMap(face=>face.vertices.map(p=>p.z)));apply(editor,{type:'setRoof',roofGroupId:'roof-1',values:{rakeOverhang:12}});const current=roof(editor);near(Math.min(...current.faces.flatMap(face=>face.vertices.map(p=>p.z))),oldMinimum);near(current.quantities.projectedArea,(240+24)*144);assert.equal(editor.state.architecture.roofGroups[0].overhang,0);const hip=profile(false),before=JSON.stringify(meshes(hip));apply(hip,{type:'setRoof',roofGroupId:'roof-1',values:{rakeOverhang:999}});assert.equal(JSON.stringify(meshes(hip)),before);
});

test('R4 gable closures select their roof owner and remain guarded from ordinary geometry edits',()=>{
 const editor=profile(),closure=meshes(editor).find(entity=>editor.getArchitectureOwner(entity.id).part==='gable'),before=editor.serialize();assert.ok(closure);editor.select([closure.id]);assert.deepEqual(editor.getArchitectureOwner(closure.id),{kind:'roofGroup',id:'roof-1',part:'gable'});assert.equal(editor.deleteSelected().ok,false);assert.equal(editor.moveMeshVertices(closure.id,[0],{x:1,y:0,z:0}).ok,false);assert.equal(editor.moveGrip(closure.id,0,{x:1,y:1,z:1}).ok,false);assert.equal(editor.serialize(),before);
});

test('R4 frame transformations move skin and closures together with accurate local clearance',()=>{
 const editor=profile(),before=structuredClone(meshes(editor)),volume=editor.state.architectureDerived.spaces[0].current.usableVolume;apply(editor,{type:'setFrame',values:{origin:{x:1000,y:-2000,z:36},rotationDegrees:90}});const after=meshes(editor);assert.equal(after.length,before.length);for(let n=0;n<before.length;n++)for(let i=0;i<before[n].vertices.length;i++){const p=before[n].vertices[i],q=after[n].vertices[i];near(q.x,1000-p.y);near(q.y,-2000+p.x);near(q.z,36+p.z);}near(editor.state.architectureDerived.spaces[0].current.usableVolume,volume);
});

test('R4 source-only native roundtrip retains gable decisions, tray, camera and scaled paper layouts',()=>{
 const editor=profile();apply(editor,{type:'setRoof',roofGroupId:'roof-1',values:{rakeOverhang:12}});const layout=editor.addLayout('R4 Gable study',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true);assert.equal(editor.addViewport(layout.layoutId,{x:10,y:10,width:180,height:120},{scaleDenominator:96,locked:true}).ok,true);assert.equal(editor.setWorkspace('3d').ok,true);assert.equal(editor.set3DView({target:{x:120,y:72,z:120},yaw:37,pitch:26,scale:1.2,autoTarget:false}).ok,true);const source=editor.serialize(),raw=JSON.parse(source),geometry=meshes(editor);assert.equal(raw.architecture.schemaVersion,5);assert.ok(raw.entities.every(entity=>!entity.id.startsWith('@architecture/')));for(const group of raw.architecture.roofGroups)for(const field of ['faces','gableClosures','gableCandidates','quantities','validation'])assert.ok(!(field in group));const restored=createEditor(raw);assert.equal(restored.serialize(),source);assert.deepEqual(meshes(restored),geometry);assert.deepEqual(restored.state.architectureDerived.spaces,editor.state.architectureDerived.spaces);assert.deepEqual(restored.state.camera3d,editor.state.camera3d);assert.deepEqual(restored.state.layouts,editor.state.layouts);
});

test('R4 maximum-ridge exclusion remains; R5 regenerates a feasible source-wall bearing change',()=>{
 const editor=profile();apply(editor,{type:'setRoof',roofGroupId:'roof-1',values:{maxRidgeElevation:130}});assert.equal(roof(editor).status,'infeasible');assert.equal(meshes(editor).length,0);assert.equal(editor.state.architectureDerived.quantities.gableClosureArea,0);assert.equal(editor.undo().ok,true);apply(editor,{type:'setWall',wallId:'wall-1',values:{bearingElevation:132}});assert.equal(roof(editor).status,'ok');assert.ok(meshes(editor).length>0);assert.ok(editor.state.architectureDerived.quantities.roofSurfaceArea>0);near(roof(editor).quantities.maxRoofElevation,150);assert.equal(editor.state.architecture.rooms[0].ceilingElevation,96);
});

test('R4 sections use only sloping clearance skin and export ordinary geometry as one action',()=>{
 const editor=profile(),before=editor.serialize(),skin=JSON.stringify(meshes(editor)),result=editor.addRoomSection({roomId:'room-1',axis:'y',coordinate:120,origin:{x:400,y:0}});assert.equal(result.ok,true,result.message);assert.ok(result.entityIds.length>0);assert.ok(result.entityIds.every(id=>!id.startsWith('@architecture/')));assert.equal(JSON.stringify(meshes(editor)),skin);const after=editor.serialize();assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),after);
});
