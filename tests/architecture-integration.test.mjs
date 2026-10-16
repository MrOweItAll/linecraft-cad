import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditor,UNIT_PRESETS,validateMesh} from '../core.mjs';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const square=[{x:0,y:0},{x:240,y:0},{x:240,y:144},{x:0,y:144}];
const wallOp={type:'addWalls',points:square,closed:true,referenceFace:'right',thickness:6,baseElevation:0,bearingElevation:108,role:'exterior'};
const editor=()=>createEditor({settings:UNIT_PRESETS.architectural});
const apply=(e,op)=>{const r=e.applyArchitecture(op);assert.equal(r.ok,true,r.message);return r;};
const roofMesh=e=>e.state.entities.find(v=>e.getArchitectureOwner(v.id)?.kind==='roofGroup');
test('R0 legacy drawing load, source-only native round trip, one grouped source Undo and Redo',()=>{
 const e=editor();for(const c of ['LINE','0,0',"100',0",''])assert.equal(e.execute(c).ok,true);
 const legacy=JSON.parse(e.serialize());delete legacy.architecture;const old=createEditor(legacy);assert.equal(old.state.architecture,null);assert.deepEqual(old.state.entities,e.state.entities);
 const prior=e.serialize();apply(e,wallOp);const after=e.serialize();assert.equal(JSON.parse(after).entities.length,1);assert.equal(JSON.parse(after).architecture.walls.length,4);assert.equal(JSON.parse(after).format,'Linecraft/2');assert.equal(JSON.parse(prior).format,'Linecraft/1');assert.equal(e.state.entities.filter(v=>v.type==='MESH').length,4);
 const loaded=createEditor(JSON.parse(after));assert.deepEqual(loaded.state.architecture,e.state.architecture);assert.deepEqual(loaded.state.entities,e.state.entities);
 assert.equal(e.undo().ok,true);assert.equal(e.serialize(),prior);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);
});
test('R1 dimensioned exterior faces and partition produce two precise interior rooms at correct XYZ',()=>{
 const e=editor();apply(e,wallOp);apply(e,{...wallOp,points:[{x:120,y:0},{x:120,y:144}],closed:false,referenceFace:'center',role:'partition'});apply(e,{type:'recognizeRooms'});
 assert.equal(e.state.architecture.rooms.length,2);assert.deepEqual(e.state.architectureDerived.rooms.map(r=>r.area),[111*132,111*132]);
 for(const entity of e.state.entities.filter(v=>v.type==='MESH')){validateMesh(entity);assert.equal(Math.min(...entity.vertices.map(p=>p.z)),0);assert.equal(Math.max(...entity.vertices.map(p=>p.z)),108);}
 const room=e.state.architecture.rooms[0];apply(e,{type:'setRoom',roomId:room.id,values:{ceilingElevation:102}});assert.equal(e.state.architecture.walls[0].bearingElevation,108);
});
test('R1 openings are hosted real voids and do not break enclosure or room area',()=>{
 const e=editor();apply(e,wallOp);apply(e,{type:'recognizeRooms'});const before=e.state.architectureDerived.rooms.map(r=>r.area),volume=e.state.architectureDerived.quantities.wallMaterialVolumeNominal;
 apply(e,{type:'addOpening',wallId:'wall-1',station:36,width:36,sillElevation:0,headElevation:84,openingType:'door'});
 near(volume-e.state.architectureDerived.quantities.wallMaterialVolumeNominal,36*84*6);assert.deepEqual(e.state.architectureDerived.rooms.map(r=>r.area),before);
 const mesh=e.state.entities.find(v=>e.getArchitectureOwner(v.id)?.id==='wall-1');assert.ok(!mesh.vertices.some(p=>p.x>36&&p.x<72&&p.z>0&&p.z<84));
});
test('R1 driving span updates shared junctions and wall-linked roof footprint in one transaction',()=>{
 const e=editor();apply(e,wallOp);apply(e,{type:'addRoof',overhang:12,riseTwice:8});const before=e.serialize(),roofBefore=structuredClone(roofMesh(e));
 apply(e,{type:'driveSpan',startNodeId:'node-1',endNodeId:'node-2',axis:'x',value:264});assert.equal(e.state.architecture.wallNodes.find(n=>n.id==='node-3').x,264);assert.notDeepEqual(roofMesh(e),roofBefore);
 const after=e.serialize();assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);
});
test('R2 analytical H is generated from boundary only, valid source survives native roundtrip',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../docs/roof-space/H_HIP_4_12_ANALYTICAL_FIXTURE.json',import.meta.url)));
 const e=editor();apply(e,{type:'addRoof',boundary:fixture.input.wallReferenceBoundaryXY.map(([x,y])=>({x,y})),overhang:24,eaveElevation:112,riseTwice:8});
 const r=e.state.architectureDerived.roofs[0];assert.equal(r.status,'ok');assert.equal(r.faces.length,12);near(r.quantities.projectedArea/144,3712);near(r.quantities.roofSurfaceArea/144,3912.7915581816774);near(Math.max(...roofMesh(e).vertices.map(p=>p.z)),176);
 const loaded=createEditor(JSON.parse(e.serialize()));assert.deepEqual(roofMesh(loaded),roofMesh(e));assert.equal(JSON.parse(e.serialize()).entities.length,0);assert.ok(e.getExportWarnings().some(w=>/flattens/.test(w)));assert.match(e.exportDXF(),/3DFACE/);
});
test('R2 ceiling-only change leaves fixed exterior mesh byte identical; physical costs remain explicit',()=>{
 const e=editor();apply(e,wallOp);apply(e,{type:'recognizeRooms'});apply(e,{type:'addRoof',overhang:12,riseTwice:8});const mesh=JSON.stringify(roofMesh(e));
 apply(e,{type:'setRoom',roomId:e.state.architecture.rooms[0].id,values:{ceilingElevation:120}});assert.equal(JSON.stringify(roofMesh(e)),mesh);
 const report=e.getArchitectureReport();assert.equal(report.trussDesignManufacturingComplexitySurcharge,0);assert.equal(report.derived.quantities.framingLumber,null);assert.equal(report.framingStatus,'unverified');assert.equal(report.derived.validation.clearance,'analyzed');
});
test('owner picking is selectable while ordinary grips, erase, transforms and mesh edits cannot break links',()=>{
 const e=editor();apply(e,wallOp);const mesh=e.state.entities[0],source=e.serialize();e.select([mesh.id]);assert.equal(e.getSelectionObjects().length,1);assert.deepEqual(e.getArchitectureOwner(mesh.id),{kind:'wall',id:'wall-1'});
 assert.equal(e.moveGrip(mesh.id,0,{x:2,y:2,z:2}).ok,false);assert.equal(e.moveMeshVertices(mesh.id,[0],{x:1,y:0,z:0}).ok,false);assert.equal(e.deleteSelected().ok,false);assert.equal(e.setSelectionProperties({color:'#ff0000'}).ok,false);e.execute('MOVE');assert.equal(e.execute('').ok,false);e.cancel();assert.equal(e.serialize(),source);
 e.select([mesh.id]);assert.equal(e.detachArchitectureSelection().ok,true);const copy=e.getSelectionObjects()[0];assert.equal(e.getArchitectureOwner(copy.id),null);assert.equal(e.moveMeshVertices(copy.id,[0],{x:1,y:0,z:0}).ok,true);
});
test('future schema, forged derived data, conflicting constraints and unit reassignment reject atomically',()=>{
 const e=editor();apply(e,wallOp);const source=e.serialize(),doc=JSON.parse(source);
 for(const mutate of [d=>d.architecture.schemaVersion=99,d=>d.architecture.malicious='eval',d=>d.entities.push({id:'@architecture/forged',type:'LINE',start:{x:0,y:0},end:{x:1,y:1}}),d=>d.architecture.costAssumptions.trussDesignSurcharge=5]){const bad=structuredClone(doc);mutate(bad);assert.equal(e.importJSON(bad).ok,false);assert.equal(e.serialize(),source);}
 assert.equal(e.updateDrawingSettings({units:'ft'}).ok,false);assert.equal(e.serialize(),source);assert.equal(e.updateDrawingSettings({linearFormat:'decimal',precision:8}).ok,true);assert.deepEqual(e.state.architecture,doc.architecture);
});
test('infeasible roof edit retains new source, excludes invalid mesh and quantities, Undo restores valid roof',()=>{
 const e=editor();apply(e,wallOp);apply(e,{type:'addRoof',overhang:12});const old=structuredClone(roofMesh(e));const id=e.state.architecture.roofGroups[0].id;
 apply(e,{type:'setRoof',roofGroupId:id,values:{maxRidgeElevation:1}});assert.equal(e.state.architecture.roofGroups[0].maxRidgeElevation,1);assert.equal(roofMesh(e),undefined);assert.equal(e.state.architectureDerived.quantities.roofSurfaceArea,0);assert.equal(e.state.architectureDerived.validation.geometry,'infeasible');assert.equal(e.undo().ok,true);assert.deepEqual(roofMesh(e),old);
});
test('R0 wall command reuses exact architectural coordinate parsing and completes as one Undo action',()=>{
 const e=editor();const before=e.serialize();for(const cmd of ['WALL','0,0',"20',0","@0,12'","@-20',0",'C'])assert.equal(e.execute(cmd).ok,true,cmd);assert.equal(e.state.architecture.walls.length,4);assert.equal(e.state.architecture.wallNodes[1].x,240);assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);
});
test('existing layouts, physical viewport scale and 3D camera survive architectural transactions and native load',()=>{
 const e=createEditor(JSON.parse(readFileSync(new URL('../samples/viewport-scales-v18.linecraft',import.meta.url))));
 const untouched=e.serialize();assert.equal(e.applyArchitecture(wallOp).ok,false);assert.equal(e.serialize(),untouched);assert.equal(e.setSpace('model',null).ok,true);const before=JSON.parse(e.serialize());apply(e,wallOp);const after=JSON.parse(e.serialize());for(const key of ['layouts','camera3d','ucs','settings','activeSpace','activeLayoutId','activeViewportId','paperViewport'])assert.deepEqual(after[key],before[key],key);
 assert.deepEqual(createEditor(after).state.layouts,e.state.layouts);assert.equal(e.undo().ok,true);assert.deepEqual(JSON.parse(e.serialize()),before);
});

test('room area and identity anchor remain accurate at large declared local coordinates',()=>{
 const e=editor(),offset=1e8;apply(e,{...wallOp,points:square.map(p=>({x:p.x+offset,y:p.y+offset}))});apply(e,{type:'recognizeRooms'});assert.equal(e.state.architecture.rooms.length,1);near(e.state.architectureDerived.rooms[0].area,228*132);const anchor=e.state.architecture.rooms[0].anchor;near(anchor.x-offset,120);near(anchor.y-offset,72);
});
