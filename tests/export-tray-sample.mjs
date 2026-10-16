import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';

// A finite declared envelope, not a manufactured or structurally verified truss.
const editor=createEditor({settings:UNIT_PRESETS.architectural});
const accept=result=>assert.equal(result.ok,true,result.message);
accept(editor.applyArchitecture({type:'addWalls',points:[{x:0,y:0},{x:240,y:0},{x:240,y:144},{x:0,y:144}],closed:true,referenceFace:'left',thickness:6,baseElevation:0,bearingElevation:120,role:'exterior'}));
accept(editor.applyArchitecture({type:'recognizeRooms'}));
const roomId=editor.state.architecture.rooms[0].id;
accept(editor.applyArchitecture({type:'setRoom',roomId,values:{label:'Fixed-roof rectangular tray study',ceilingElevation:96,targetCeilingElevation:108,minimumClearHeight:84,headroomThreshold:108,ceilingFinishThickness:.5,allowCeilingChange:true}}));
accept(editor.applyArchitecture({type:'addRoof',name:'Fixed 4:12 HIP · 20 × 12 ft room',riseTwice:8,overhang:24,bearingElevation:120,heelOffset:0,wallIds:editor.state.architecture.walls.map(wall=>wall.id),supportWallIds:editor.state.architecture.walls.map(wall=>wall.id)}));
const roofId=editor.state.architecture.roofGroups[0].id;
accept(editor.applyArchitecture({type:'declareRoofAssembly',roofGroupId:roofId,assembly:{name:'Declared 6-inch normal envelope and service box',layers:[{name:'Combined normal clearance layer',material:'user-declared; framing unverified',normalThickness:6}],reservations:[{id:'reservation-1',kind:'service',description:'Declared service zone · lower face 9 ft 2 in',min:{x:96,y:48,z:110},max:{x:144,y:96,z:120}}],framingVerification:'unverified'}}));
const roofBefore=structuredClone(editor.state.architectureDerived.roofs),parametersBefore=structuredClone(editor.state.architecture.roofGroups);
accept(editor.applyArchitecture({type:'setTrayCandidate',roomId,candidate:{min:{x:48,y:36},max:{x:192,y:108},baseElevation:96,raisedElevation:108}}));
assert.deepEqual(editor.state.architectureDerived.roofs,roofBefore);assert.deepEqual(editor.state.architecture.roofGroups,parametersBefore);
const study=editor.getArchitectureReport().spaces[0];
assert.equal(study.status,'ok');assert.equal(study.tray.feasible,true);assert.equal(study.area,34560);assert.equal(study.tray.plateauArea,10368);assert.equal(study.tray.candidate.usableVolume,3442176);assert.equal(study.tray.recoveryVolume,124416);assert.equal(study.current.usableVolume,3317760);assert.equal(editor.state.architecture.rooms[0].ceilingType,'flat');
const layout=editor.addLayout('Fixed-roof tray study — A3',{size:'A3',orientation:'landscape'});accept(layout);
accept(editor.addViewport(layout.layoutId,{x:15,y:25,width:210,height:245},{workspace:'2d',modelCenter:{x:120,y:72,z:0},scaleDenominator:48,locked:true}));
accept(editor.addViewport(layout.layoutId,{x:240,y:65,width:160,height:160},{workspace:'3d',modelCenter:{x:120,y:72,z:65},scaleDenominator:96,locked:true,camera3d:{yaw:45,pitch:35.264389682754654,target:{x:120,y:72,z:65},projection:'orthographic'}}));
accept(editor.setWorkspace('3d'));accept(editor.set3DView({target:{x:120,y:72,z:65},scale:1.5,yaw:45,pitch:35.264389682754654,autoTarget:false}));
const file=new URL('../samples/tray-ceiling-v111.linecraft',import.meta.url);writeFileSync(file,editor.serialize(),'utf8');
const raw=JSON.parse(readFileSync(file,'utf8')),restored=createEditor(raw);assert.equal(raw.format,'Linecraft/2');assert.equal(raw.architecture.schemaVersion,3);assert.ok(!raw.entities.some(entity=>entity.id.startsWith('@architecture/')));assert.deepEqual(restored.state.architecture,editor.state.architecture);assert.deepEqual(restored.state.entities,editor.state.entities);
console.log('Created source-only tray proposal: 240 ft² room, accepted flat 8 ft / 1920 ft³, 72 ft² plateau at 9 ft, feasible tray 1992 ft³ / +72 ft³. Roof and 10 ft bearings fixed; framing remains unverified.');
