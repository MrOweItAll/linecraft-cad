// Original source-only R6 rectangle. Dimensions/supports, not roof vertices,
// establish the fixed unequal-bearing roof and independent ceiling intent.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';

const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--output'&&args[1]))throw Error('Usage: export-alternatives-sample.mjs [--output owned-file]');
const file=args.length?resolve(args[1]):new URL('../samples/alternatives-v114.linecraft',import.meta.url);
const e=createEditor({settings:UNIT_PRESETS.architectural}),accept=result=>assert.equal(result.ok,true,result.message);
const boundary=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}];
accept(e.applyArchitecture({type:'addWalls',points:boundary,closed:true,referenceFace:'left',thickness:6,baseElevation:0,bearingElevation:120,role:'exterior'}));
accept(e.applyArchitecture({type:'recognizeRooms'}));
const roomId=e.state.architecture.rooms[0].id;
accept(e.applyArchitecture({type:'setRoom',roomId,values:{label:'R6 original rectangle | current 8 ft | target 12 ft',floorElevation:0,ceilingElevation:96,targetCeilingElevation:144,minimumClearHeight:84,headroomThreshold:108,ceilingFinishThickness:0,allowCeilingChange:true,priority:1}}));
accept(e.applyArchitecture({type:'setWall',wallId:'wall-3',values:{bearingElevation:144}}));
const candidate=inferGableCandidates(boundary).alternatives.find(item=>item.ridgeDirection==='X');assert.ok(candidate);
const wallIds=e.state.architecture.walls.map(w=>w.id);
accept(e.applyArchitecture({type:'addRoof',name:'R6 fixed 4:12 GABLE | linked 10 ft and 12 ft bearings',wallIds,supportWallIds:wallIds,roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:candidate.edgeKeys,riseTwice:8,overhang:0,rakeOverhang:0,bearingElevation:120,heelOffset:0}));
const roofId=e.state.architecture.roofGroups[0].id;
accept(e.applyArchitecture({type:'declareRoofAssembly',roofGroupId:roofId,assembly:{name:'Zero-thickness mathematical envelope with retained reservation',layers:[],reservations:[{id:'reservation-1',kind:'service',description:'Declared central clearance reservation; no framing assumption',min:{x:24,y:24,z:126},max:{x:36,y:36,z:132}}],framingVerification:'unverified'}}));
const plan=e.addLayout('R6 fixed roof plan - common scales',{size:'A3',orientation:'landscape'});accept(plan);
for(const[frame,scaleDenominator]of [[{x:7,y:55,width:138,height:220},96],[{x:151,y:55,width:262,height:220},48]])accept(e.addViewport(plan.layoutId,frame,{workspace:'2d',modelCenter:{x:240,y:120,z:0},scaleDenominator,locked:true,plotBorder:true}));
const elevation=e.addLayout('R6 fixed asymmetric gable elevation',{size:'A3',orientation:'landscape'});accept(elevation);
for(const[frame,scaleDenominator]of [[{x:15,y:55,width:185,height:220},48],[{x:220,y:55,width:185,height:220},96]])accept(e.addViewport(elevation.layoutId,frame,{workspace:'3d',modelCenter:{x:240,y:120,z:146},scaleDenominator,locked:true,plotBorder:true,camera3d:{yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic'}}));
const report=e.addLayout('R6 comparison report - A3',{size:'A3',orientation:'landscape'});accept(report);
accept(e.setWorkspace('3d'));accept(e.set3DView({target:{x:240,y:120,z:146},yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic',scale:2,autoTarget:false}));
const raw=JSON.parse(e.serialize());raw.architecture.levels[0].defaultBearingElevation=120;raw.architecture.levels[0].defaultCeilingElevation=96;
for(const layout of raw.layouts){
 layout.entities.push({id:`alternatives-title-${layout.id}`,type:'TEXT',layer:'0',position:{x:10,y:15},text:layout.name.toUpperCase()+' | A3 | ZERO THICKNESS',height:3.5,rotation:0,style:'Standard'});
 const labels=layout.id===plan.layoutId?['1/8 IN = 1 FT | 1:96','1/4 IN = 1 FT | 1:48']:layout.id===elevation.layoutId?['RIGHT GABLE | 1:48','RIGHT GABLE | 1:96']:[];
 for(const[i,text]of labels.entries())layout.entities.push({id:`alternatives-label-${layout.id}-${i}`,type:'TEXT',layer:'0',position:{x:layout.viewports[i].frame.x,y:40},text,height:3.5,rotation:0,style:'Standard'});
}
const final=createEditor(raw),saved=final.serialize(),source=JSON.parse(saved),roof=final.state.architectureDerived.roofs[0],room=source.architecture.rooms[0],roomGeometry=final.state.architectureDerived.rooms[0];
assert.equal(source.architecture.schemaVersion,6);assert.equal(source.architecture.acceptedAlternativeId,null);assert.deepEqual(source.entities,[]);
assert.equal(roomGeometry.area,480*240);assert.equal(room.ceilingElevation,96);assert.equal(room.targetCeilingElevation,144);assert.equal(room.ceilingFinishThickness,0);
assert.equal(roof.status,'ok',JSON.stringify(roof.diagnostics));assert.equal(Math.max(...roof.faces.flatMap(f=>f.vertices.map(p=>p.z))),172);assert.ok(roof.faces.flatMap(f=>f.vertices).filter(p=>p.z===172).every(p=>p.y===156));
assert.deepEqual(source.architecture.walls.map(w=>w.bearingElevation),[120,120,144,120]);assert.equal(source.architecture.roofGroups[0].boundarySource,'walls');
assert.deepEqual(source.architecture.assemblies[0].layers,[]);assert.equal(source.architecture.assemblies[0].reservations.length,1);assert.ok(roof.gableClosures.every(c=>c.thickness===0));
assert.deepEqual(source.architecture.costAssumptions,{prefabricatedTrussDesignSurcharge:0,manufacturingComplexitySurcharge:0});
assert.deepEqual(source.layouts.map(l=>l.viewports.map(v=>v.scaleDenominator)),[[96,48],[48,96],[]]);assert.ok(source.layouts.every(l=>l.viewports.every(v=>v.locked)));
assert.equal(source.layouts[2].entities.length,1,'Report sheet starts empty except its original title; actual report content must come from a completed reviewed search.');
assert.equal(createEditor(JSON.parse(saved)).serialize(),saved);
if(!existsSync(file))writeFileSync(file,saved,'utf8');else assert.equal(readFileSync(file,'utf8'),saved,'Established R6 source fixture must not be overwritten.');
console.log('Validated original schema6 R6 source: actual 40x20ft room, current8ft/target12ft, fixed4:12 GABLE linked10/12ft bearings, zero thickness, retained reservation, locked A3 1:96/1:48 and empty report sheet.');
