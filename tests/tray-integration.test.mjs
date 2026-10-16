import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditor,UNIT_PRESETS,formatDimension} from '../core.mjs';
import {normalizeArchitecture} from '../architecture/model.mjs';
import {architectureInputHash} from '../architecture/editor-adapter.mjs';
const apply=(e,operation)=>{const r=e.applyArchitecture(operation);assert.equal(r.ok,true,r.message);return r;};
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const candidate={min:{x:48,y:36},max:{x:192,y:108},baseElevation:96,raisedElevation:120};
const mesh=e=>JSON.stringify(e.state.entities.filter(v=>e.getArchitectureOwner(v.id)?.kind==='roofGroup').map(v=>({id:v.id,vertices:v.vertices,faces:v.faces})));
const space=e=>e.state.architectureDerived.spaces.find(r=>r.roomId==='room-1');
const room=e=>e.state.architecture.rooms.find(r=>r.id==='room-1');
const proposal=(e,value=candidate)=>apply(e,{type:'setTrayCandidate',roomId:'room-1',candidate:value});
function profile(){const e=createEditor({settings:UNIT_PRESETS.architectural});apply(e,{type:'addWalls',points:[{x:0,y:0},{x:240,y:0},{x:240,y:144},{x:0,y:144}],closed:true,referenceFace:'left',thickness:6,baseElevation:0,bearingElevation:120,role:'exterior'});apply(e,{type:'recognizeRooms'});apply(e,{type:'setRoom',roomId:'room-1',values:{ceilingElevation:96,targetCeilingElevation:108,minimumClearHeight:84,headroomThreshold:108,ceilingFinishThickness:.5,allowCeilingChange:true}});apply(e,{type:'addRoof',riseTwice:8,overhang:24,bearingElevation:120,supportWallIds:e.state.architecture.walls.map(w=>w.id)});apply(e,{type:'declareRoofAssembly',roofGroupId:'roof-1',assembly:{name:'Declared envelope only',layers:[{name:'Unverified roof envelope',material:'declared',normalThickness:3}],reservations:[]}});return e;}
const acceptTray=e=>{proposal(e);return apply(e,{type:'applyTrayCandidate',roomId:'room-1',sourceRevision:e.state.architecture.revision,sourceHash:architectureInputHash(e.state.architecture)});};

test('R3 tray schema 1/2 migrate with null proposal and actual while historical samples stay byte identical',()=>{
 for(const filename of ['roof-space-H-v19.linecraft','ceiling-space-v110.linecraft']){const path=new URL(`../samples/${filename}`,import.meta.url),bytes=readFileSync(path,'utf8'),raw=JSON.parse(bytes),e=createEditor(raw);assert.equal(e.state.architecture.schemaVersion,3);for(const r of e.state.architecture.rooms){assert.equal(r.trayCandidate,null);assert.equal(r.trayCeiling,null);assert.equal(r.ceilingType,'flat');for(const [key,value]of Object.entries(raw.architecture.rooms.find(q=>q.id===r.id)))assert.deepEqual(r[key],value,key);}assert.equal(readFileSync(path,'utf8'),bytes);const before=mesh(e),loaded=createEditor(JSON.parse(e.serialize()));assert.equal(mesh(loaded),before);}
});

test('R3 tray source strictly rejects malformed profiles and mismatched actual ceiling bases',()=>{
 const e=profile(),source=e.state.architecture,before=e.serialize();for(const value of [{...candidate,max:{x:48,y:108}},{...candidate,raisedElevation:96},{...candidate,baseElevation:0},{...candidate,computedVolume:12},{...candidate,min:{x:NaN,y:36}}]){assert.equal(e.applyArchitecture({type:'setTrayCandidate',roomId:'room-1',candidate:value}).ok,false);assert.equal(e.serialize(),before);}const bad=structuredClone(source);bad.rooms[0].trayCeiling=candidate;assert.throws(()=>normalizeArchitecture(bad,e.state.settings),/flat ceiling/);bad.rooms[0].ceilingType='tray';bad.rooms[0].ceilingElevation=100;assert.throws(()=>normalizeArchitecture(bad,e.state.settings),/same base/);bad.schemaVersion=2;assert.throws(()=>normalizeArchitecture(bad,e.state.settings),/schema 3/);
});

test('R3 tray proposal changes no actual profile, roof, bearings, mesh or current volume',()=>{
 const e=profile(),roof=mesh(e),walls=structuredClone(e.state.architecture.walls),current=space(e).current;proposal(e);assert.equal(room(e).ceilingType,'flat');assert.equal(room(e).trayCeiling,null);assert.deepEqual(room(e).trayCandidate,candidate);assert.equal(space(e).tray.status,'ok');assert.deepEqual(space(e).current,current);assert.equal(mesh(e),roof);assert.deepEqual(e.state.architecture.walls,walls);assert.ok(!e.state.entities.some(v=>v.id.endsWith('/ceiling')));near(space(e).tray.candidate.usableVolume,34560*96+10368*24);near(space(e).tray.recoveryVolume,10368*24);
});

test('R3 accepted tray volume and headroom match actual stepped profile and preserve roof/bearings',()=>{
 const e=profile(),roof=mesh(e),walls=structuredClone(e.state.architecture.walls),fingerprint=space(e).roofGeometryFingerprint;acceptTray(e);assert.equal(room(e).ceilingType,'tray');assert.deepEqual(room(e).trayCeiling,candidate);assert.equal(room(e).ceilingElevation,96);assert.equal(room(e).targetCeilingElevation,108);assert.equal(space(e).current.profileType,'tray');near(space(e).current.usableVolume,34560*96+10368*24);near(space(e).current.headroomArea,10368);near(space(e).acceptedTray.recoveryVolume,0);assert.equal(mesh(e),roof);assert.deepEqual(e.state.architecture.walls,walls);assert.equal(space(e).roofGeometryFingerprint,fingerprint);
});

test('R3 applying a tray is one grouped Undo/Redo including source and derived actual ceiling',()=>{
 const e=profile();proposal(e);const before=e.serialize(),roof=mesh(e);apply(e,{type:'applyTrayCandidate',roomId:'room-1'});const after=e.serialize();assert.ok(e.state.entities.some(v=>v.id==='@architecture/room/room-1/ceiling'));assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);assert.ok(!e.state.entities.some(v=>v.id.endsWith('/ceiling')));assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);assert.equal(mesh(e),roof);
});

test('R3 proposal edits and removal do not destroy accepted tray or misreport its actual volume',()=>{
 const e=profile();acceptTray(e);const actual=structuredClone(room(e).trayCeiling),volume=space(e).current.usableVolume;proposal(e,{...candidate,raisedElevation:108});assert.deepEqual(room(e).trayCeiling,actual);near(space(e).current.usableVolume,volume);near(space(e).tray.volumeDifference,-10368*12);assert.equal(space(e).tray.recoveryVolume,0);proposal(e,null);assert.equal(space(e).tray,null);assert.deepEqual(room(e).trayCeiling,actual);near(space(e).current.usableVolume,volume);
});

test('R3 ordinary room label and target edits retain accepted tray; scalar replacement rejects atomically',()=>{
 const e=profile();acceptTray(e);const actual=structuredClone(room(e).trayCeiling);apply(e,{type:'setRoom',roomId:'room-1',values:{label:'Actual tray',targetCeilingElevation:110}});assert.deepEqual(room(e).trayCeiling,actual);for(const values of [{ceilingElevation:100},{ceilingType:'flat'}]){const before=e.serialize(),r=e.applyArchitecture({type:'setRoom',roomId:'room-1',values});assert.equal(r.ok,false);assert.match(r.message,/Apply flat ceiling/);assert.equal(e.serialize(),before);}apply(e,{type:'setRoom',roomId:'room-1',values:{ceilingElevation:96}});assert.deepEqual(room(e).trayCeiling,actual);
});

test('R3 explicit flat application replaces actual tray in one Undo and preserves proposal intent',()=>{
 const e=profile();acceptTray(e);const before=e.serialize(),roof=mesh(e);apply(e,{type:'applyFlatCeiling',roomId:'room-1',elevation:'target'});assert.equal(room(e).ceilingType,'flat');assert.equal(room(e).trayCeiling,null);assert.deepEqual(room(e).trayCandidate,candidate);assert.equal(room(e).ceilingElevation,108);assert.equal(space(e).current.profileType,'flat');assert.ok(!e.state.entities.some(v=>v.id.endsWith('/ceiling')));assert.equal(mesh(e),roof);const after=e.serialize();assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);
});

test('R3 locked, stale source revision/hash and missing proposal applies reject whole transaction',()=>{
 const e=profile();const initial=e.serialize();assert.equal(e.applyArchitecture({type:'applyTrayCandidate',roomId:'room-1'}).ok,false);assert.equal(e.serialize(),initial);proposal(e);for(const opts of [{sourceRevision:e.state.architecture.revision-1},{sourceHash:'obsolete'}]){const before=e.serialize(),r=e.applyArchitecture({type:'applyTrayCandidate',roomId:'room-1',...opts});assert.equal(r.ok,false);assert.match(r.message,/stale/);assert.equal(e.serialize(),before);}apply(e,{type:'setRoom',roomId:'room-1',values:{allowCeilingChange:false}});const before=e.serialize(),r=e.applyArchitecture({type:'applyTrayCandidate',roomId:'room-1'});assert.equal(r.ok,false);assert.match(r.message,/locked/);assert.equal(e.serialize(),before);
});

test('R3 an infeasible proposal remains a proposal and leaves accepted geometry unchanged on apply failure',()=>{
 const e=profile();acceptTray(e);proposal(e,{...candidate,raisedElevation:1000});assert.equal(space(e).tray.status,'infeasible');const before=e.serialize(),roof=mesh(e),actual=structuredClone(room(e).trayCeiling);assert.equal(e.applyArchitecture({type:'applyTrayCandidate',roomId:'room-1'}).ok,false);assert.equal(e.serialize(),before);assert.deepEqual(room(e).trayCeiling,actual);assert.equal(mesh(e),roof);
});

test('R3 reservations constrain candidate/actual profiles with no guessed structure or roof edit',()=>{
 const e=profile();acceptTray(e);const roof=mesh(e);apply(e,{type:'setAssembly',assemblyId:e.state.architecture.roofGroups[0].assemblyId,values:{reservations:[{id:'service',kind:'service',description:'Declared box',min:{x:80,y:48,z:110},max:{x:140,y:96,z:120}}]}});near(space(e).tray.maximumRaisedElevation,109.5);assert.equal(space(e).tray.feasible,false);assert.equal(space(e).current.feasible,false);assert.equal(space(e).current.usableVolume,null);assert.equal(space(e).tray.recoveryVolume,null);assert.equal(mesh(e),roof);proposal(e,{...candidate,raisedElevation:108});assert.equal(space(e).tray.feasible,true);assert.equal(space(e).tray.recoveryVolume,null);apply(e,{type:'applyTrayCandidate',roomId:'room-1'});assert.equal(space(e).current.feasible,true);near(space(e).current.usableVolume,34560*96+10368*12);
});

test('R3 adjacent opening heads constrain the lower outer-band ceiling independently from bearing',()=>{
 const e=profile();apply(e,{type:'addOpening',wallId:'wall-1',station:24,width:36,sillElevation:100,headElevation:114,openingType:'window'});proposal(e);assert.equal(space(e).requiredMinimumCeilingElevation,114);assert.equal(space(e).tray.feasible,false);proposal(e,{...candidate,baseElevation:115,raisedElevation:120});assert.equal(space(e).tray.feasible,true);const roof=mesh(e);apply(e,{type:'applyTrayCandidate',roomId:'room-1'});assert.equal(room(e).ceilingElevation,115);assert.equal(e.state.architecture.walls[0].bearingElevation,120);assert.equal(e.state.architecture.openings[0].headElevation,114);assert.equal(mesh(e),roof);
});

test('R3 actual tray finish quantities separate horizontal nominal volume from zero-thickness vertical return area',()=>{
 const e=profile();acceptTray(e);const q=e.getArchitectureReport().derived.quantities,finish=q.ceilingFinishVolumesNominal[0];near(finish.horizontalFinishArea,34560);near(finish.nominalVolume,34560*.5);near(finish.verticalReturnArea,2*(144+72)*24);assert.equal(finish.verticalReturnMaterialVolume,null);assert.equal(finish.verticalReturnThickness,null);assert.equal(q.trussDesignSurcharge,0);assert.equal(q.manufacturingComplexitySurcharge,0);assert.equal(q.framingLumber,null);assert.equal(q.connectors,null);assert.match(q.declaredMaterialQuantityAssumptions,/zero-thickness/);assert.equal(space(e).acceptedTray.assumptions.verticalReturnMaterialVolume,null);
});

test('R3 section through accepted tray measures lower/raised current ceilings and excludes later proposal',()=>{
 const e=profile();acceptTray(e);proposal(e,{...candidate,raisedElevation:108});const source=structuredClone(e.state.architecture),roof=mesh(e),before=e.serialize(),r=e.addRoomSection({roomId:'room-1',axis:'x',coordinate:72,origin:{x:500,y:0}});assert.equal(r.ok,true,r.message);assert.equal(r.section.currentProfileType,'tray');assert.equal(r.section.dimensions.currentBaseCeilingElevation,96);assert.equal(r.section.dimensions.currentRaisedCeilingElevation,120);const current=r.section.profileSegments.current;assert.ok(current.some(([a,b])=>a.z===120&&b.z===120));assert.ok(current.some(([a,b])=>a.z!==b.z));assert.ok(current.every(([a,b])=>a.z!==108&&b.z!==108));const dims=e.state.entities.filter(d=>r.entityIds.includes(d.id)&&d.type==='DIMENSION');assert.equal(dims.length,5);near(formatDimension(dims.find(d=>d.textOverride?.startsWith('Tray base')),e.state).measurement,96);near(formatDimension(dims.find(d=>d.textOverride?.startsWith('Tray raised')),e.state).measurement,120);assert.deepEqual(e.state.architecture,source);assert.equal(mesh(e),roof);assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);
});

test('R3 off-plateau section represents the accepted lower band without a false raised dimension',()=>{
 const e=profile();acceptTray(e);const r=e.addRoomSection({roomId:'room-1',axis:'x',coordinate:12,origin:{x:500,y:0}});assert.equal(r.ok,true,r.message);assert.equal(r.section.dimensions.currentRaisedCeilingElevation,null);assert.ok(r.section.profileSegments.current.every(([a,b])=>a.z===96&&b.z===96));const dims=e.state.entities.filter(d=>r.entityIds.includes(d.id)&&d.type==='DIMENSION');assert.equal(dims.length,4);
});

test('R3 accepted ceiling mesh has semantic room owner and raw edit protection',()=>{
 const e=profile();acceptTray(e);const ceiling=e.state.entities.find(v=>v.id==='@architecture/room/room-1/ceiling');assert.ok(ceiling);assert.equal(ceiling.type,'MESH');assert.deepEqual(e.getArchitectureOwner(ceiling.id),{kind:'room',id:'room-1'});assert.ok(ceiling.vertices.some(v=>v.z===120));assert.ok(ceiling.vertices.some(v=>v.z===96));const before=e.serialize();e.select([ceiling.id]);const erase=e.execute('ERASE');assert.equal(erase.ok,false);assert.equal(e.serialize(),before);
});

test('R3 native schema3 source-only Save/Open regenerates tray while retaining camera/layouts and unit display',()=>{
 const e=profile();acceptTray(e);const layout=e.addLayout('Tray paper',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true,layout.message);assert.equal(e.addViewport(layout.layoutId,{x:10,y:10,width:180,height:120},{scaleDenominator:96,locked:true}).ok,true);assert.equal(e.setWorkspace('3d').ok,true);assert.equal(e.set3DView({target:{x:120,y:72,z:60},yaw:37,pitch:26,scale:1.2,autoTarget:false}).ok,true);const source=e.serialize(),raw=JSON.parse(source),roof=mesh(e);assert.equal(raw.format,'Linecraft/2');assert.equal(raw.architecture.schemaVersion,3);assert.ok(!raw.entities.some(v=>v.id.startsWith('@architecture/')));assert.ok(!('derived'in raw.architecture));const restored=createEditor(raw);assert.equal(restored.serialize(),source);assert.equal(mesh(restored),roof);assert.deepEqual(space(restored),space(e));assert.deepEqual(restored.state.camera3d,e.state.camera3d);assert.deepEqual(restored.state.layouts,e.state.layouts);assert.equal(restored.state.settings.linearFormat,'architectural');
});

test('R3 proposal/apply/undo in a rotated elevated frame preserve exact local ceiling volumes',()=>{
 const e=profile();apply(e,{type:'setFrame',values:{origin:{x:1000,y:2000,z:48},rotationDegrees:37}});const roof=mesh(e);proposal(e);const before=e.serialize();apply(e,{type:'applyTrayCandidate',roomId:'room-1'});near(space(e).current.usableVolume,34560*96+10368*24);const ceiling=e.state.entities.find(v=>v.id.endsWith('/ceiling'));near(Math.min(...ceiling.vertices.map(p=>p.z)),144);near(Math.max(...ceiling.vertices.map(p=>p.z)),168);assert.equal(mesh(e),roof);assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);
});


test('R3 source footprint edits preserve actual tray but unsupported containment cannot export a false section',()=>{
 const e=profile();acceptTray(e);const actual=structuredClone(room(e).trayCeiling);apply(e,{type:'driveSpan',startNodeId:e.state.architecture.wallNodes[0].id,endNodeId:e.state.architecture.wallNodes[1].id,axis:'x',value:150});assert.deepEqual(room(e).trayCeiling,actual);assert.equal(room(e).ceilingType,'tray');assert.equal(space(e).acceptedTray.status,'unsupported');assert.equal(space(e).current,null);assert.ok(!e.state.entities.some(v=>v.id.endsWith('/ceiling')));const before=e.serialize(),r=e.addRoomSection({roomId:'room-1',axis:'x',coordinate:72,origin:{x:500,y:0}});assert.equal(r.ok,false);assert.match(r.message,/actual accepted tray profile is unsupported/);assert.equal(e.serialize(),before);
});

test('R3 physically infeasible actual tray exports only an explicitly labeled diagnostic section',()=>{
 const e=profile();acceptTray(e);apply(e,{type:'setAssembly',assemblyId:e.state.architecture.roofGroups[0].assemblyId,values:{reservations:[{id:'service',kind:'service',description:'Declared obstruction',min:{x:80,y:48,z:110},max:{x:140,y:96,z:120}}]}});assert.equal(space(e).status,'ok');assert.equal(space(e).acceptedTray.status,'infeasible');assert.equal(space(e).current.feasible,false);const source=structuredClone(e.state.architecture),roof=mesh(e),before=e.serialize(),r=e.addRoomSection({roomId:'room-1',axis:'x',coordinate:72,origin:{x:500,y:0}});assert.equal(r.ok,true,r.message);assert.equal(r.section.acceptedCeilingFeasible,false);assert.ok(e.state.entities.some(entity=>r.entityIds.includes(entity.id)&&entity.type==='TEXT'&&entity.text.includes('INFEASIBLE accepted tray')));assert.deepEqual(e.state.architecture,source);assert.equal(mesh(e),roof);assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);
});
