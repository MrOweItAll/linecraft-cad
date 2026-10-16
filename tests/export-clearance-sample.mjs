import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';

// A declared geometric envelope, intentionally not a manufactured truss model.
const editor=createEditor({settings:UNIT_PRESETS.architectural});
const accept=result=>assert.equal(result.ok,true,result.message);
accept(editor.applyArchitecture({type:'addWalls',points:[{x:0,y:0},{x:240,y:0},{x:240,y:144},{x:0,y:144}],closed:true,referenceFace:'left',thickness:6,baseElevation:0,bearingElevation:120,role:'exterior'}));
accept(editor.applyArchitecture({type:'recognizeRooms'}));
const roomId=editor.state.architecture.rooms[0].id;
accept(editor.applyArchitecture({type:'setRoom',roomId,values:{label:'Fixed roof · declared clearance study',ceilingElevation:96,targetCeilingElevation:108,minimumClearHeight:84,headroomThreshold:108,ceilingFinishThickness:.5,allowCeilingChange:true}}));
accept(editor.applyArchitecture({type:'addRoof',name:'Fixed 4:12 HIP · 20 × 12 ft room',riseTwice:8,overhang:24,bearingElevation:120,heelOffset:0,wallIds:editor.state.architecture.walls.map(wall=>wall.id),supportWallIds:editor.state.architecture.walls.map(wall=>wall.id)}));
const roofId=editor.state.architecture.roofGroups[0].id;
accept(editor.applyArchitecture({type:'declareRoofAssembly',roofGroupId:roofId,assembly:{name:'Declared 6-inch normal envelope and service box',layers:[{name:'User-declared combined layer',material:'declared envelope; framing unverified',normalThickness:6}],reservations:[{id:'reservation-1',kind:'service',description:'Declared service zone · lower face 9 ft 2 in',min:{x:96,y:48,z:110},max:{x:144,y:96,z:120}}],framingVerification:'unverified'}}));
const study=editor.getArchitectureReport().spaces[0];
assert.equal(study.status,'ok');assert.equal(study.current.feasible,true);assert.equal(study.target.feasible,true);assert.equal(study.maxFlatCeilingElevation,109.5);assert.equal(study.area,34560);
assert.equal(study.recoverableFlatVolume,466560);
assert.equal(study.framingVerification,'unverified');
const layout=editor.addLayout('Fixed-roof clearance — A3',{size:'A3',orientation:'landscape'});accept(layout);
accept(editor.addViewport(layout.layoutId,{x:15,y:25,width:210,height:245},{workspace:'2d',modelCenter:{x:120,y:72,z:0},scaleDenominator:48,locked:true}));
accept(editor.addViewport(layout.layoutId,{x:240,y:65,width:160,height:160},{workspace:'3d',modelCenter:{x:120,y:72,z:65},scaleDenominator:96,locked:true,camera3d:{yaw:45,pitch:35.264389682754654,target:{x:120,y:72,z:65},projection:'orthographic'}}));
accept(editor.setWorkspace('3d'));accept(editor.set3DView({target:{x:120,y:72,z:65},scale:1.5,yaw:45,pitch:35.264389682754654,autoTarget:false}));
// The 1.10/schema-2 sample is immutable migration evidence, not a generated output.
const file=new URL('../samples/ceiling-space-v110.linecraft',import.meta.url),canonical=readFileSync(file,'utf8'),legacy=JSON.parse(editor.serialize());legacy.architecture.schemaVersion=2;for(const room of legacy.architecture.rooms)for(const key of ['trayCandidate','trayCeiling'])delete room[key];
assert.equal(canonical,JSON.stringify(legacy,null,2),'Historical schema-2 clearance sample changed; do not overwrite it.');
const raw=JSON.parse(canonical),restored=createEditor(raw);assert.equal(raw.format,'Linecraft/2');assert.equal(raw.architecture.schemaVersion,2);assert.ok(!raw.entities.some(entity=>entity.id.startsWith('@architecture/')));assert.deepEqual(restored.state.architecture,editor.state.architecture);assert.deepEqual(restored.state.entities,editor.state.entities);
console.log('Validated unchanged schema-2 fixed-roof clearance sample and migration: 240 square feet, current 8 feet, maximum 9 feet 1.5 inches. Framing remains unverified.');
