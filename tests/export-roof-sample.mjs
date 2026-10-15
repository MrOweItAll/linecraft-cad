import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
const fixture=JSON.parse(readFileSync(new URL('../docs/roof-space/H_HIP_4_12_ANALYTICAL_FIXTURE.json',import.meta.url)));
const e=createEditor({settings:UNIT_PRESETS.architectural});
const accept=r=>assert.equal(r.ok,true,r.message);
accept(e.applyArchitecture({type:'addWalls',points:fixture.input.wallReferenceBoundaryXY.map(([x,y])=>({x,y})),closed:true,thickness:6,referenceFace:'right',baseElevation:0,bearingElevation:120,role:'exterior'}));
accept(e.applyArchitecture({type:'recognizeRooms'}));
accept(e.applyArchitecture({type:'setRoom',roomId:e.state.architecture.rooms[0].id,values:{label:'H footprint — ceiling intent only',ceilingElevation:108,targetCeilingElevation:120}}));
accept(e.applyArchitecture({type:'addOpening',wallId:'wall-1',station:48,width:36,sillElevation:0,headElevation:84,openingType:'door'}));
accept(e.applyArchitecture({type:'addRoof',name:'Analytical H · equal-eave HIP',riseTwice:8,overhang:24,bearingElevation:120,heelOffset:0,supportWallIds:e.state.architecture.walls.map(w=>w.id)}));
assert.equal(e.state.architectureDerived.roofs[0].status,'ok');
const layout=e.addLayout('H roof review — A3',{size:'A3',orientation:'landscape'});accept(layout);
accept(e.addViewport(layout.layoutId,{x:15,y:20,width:215,height:250},{workspace:'2d',modelCenter:{x:384,y:360,z:0},scaleDenominator:96,locked:true}));
accept(e.addViewport(layout.layoutId,{x:245,y:70,width:160,height:160},{workspace:'3d',modelCenter:{x:384,y:360,z:80},scaleDenominator:192,locked:true,camera3d:{yaw:45,pitch:35.264389682754654,target:{x:384,y:360,z:80},projection:'orthographic'}}));
accept(e.setWorkspace('3d'));accept(e.set3DView({target:{x:384,y:360,z:80},scale:.7,yaw:45,pitch:35.264389682754654,autoTarget:false}));
// This file is an immutable 1.9/schema-1 migration fixture. R3 writes a separate
// clearance sample and must never upgrade the historical fixture in place.
const file=new URL('../samples/roof-space-H-v19.linecraft',import.meta.url),canonical=readFileSync(file,'utf8'),legacy=JSON.parse(e.serialize());legacy.architecture.schemaVersion=1;for(const room of legacy.architecture.rooms)for(const key of ['minimumClearHeight','headroomThreshold','ceilingFinishThickness'])delete room[key];
assert.equal(canonical,JSON.stringify(legacy,null,2),'The historical schema-1 H sample changed; do not overwrite this migration fixture.');
const restored=createEditor(JSON.parse(canonical));assert.deepEqual(restored.state.architecture,e.state.architecture);assert.deepEqual(restored.state.entities,e.state.entities);
console.log(`Validated unchanged legacy source-only H sample and schema-1 migration: ${file.pathname}`);
