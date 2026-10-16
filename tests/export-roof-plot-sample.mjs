import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';

// Original source-only analytical fixture. No ordinary model line can stand in
// for the generated roof or gable closures in the actual PDF acceptance.
const editor=createEditor({settings:UNIT_PRESETS.architectural}),accept=r=>assert.equal(r.ok,true,r.message);
const boundary=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}];
accept(editor.applyArchitecture({type:'addRoof',name:'PDF analytical gable - 40 by 20 ft',boundary,riseTwice:8,overhang:0,bearingElevation:120,heelOffset:0}));
const candidate=inferGableCandidates(boundary).alternatives.find(a=>a.ridgeDirection==='X');assert.ok(candidate);
accept(editor.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:candidate.edgeKeys,rakeOverhang:0}}));
const plan=editor.addLayout('Roof plan - common scales',{size:'A3',orientation:'landscape'});accept(plan);
accept(editor.addViewport(plan.layoutId,{x:7,y:55,width:138,height:220},{workspace:'2d',modelCenter:{x:240,y:120,z:0},scaleDenominator:96,locked:true,plotBorder:true}));
accept(editor.addViewport(plan.layoutId,{x:151,y:55,width:262,height:220},{workspace:'2d',modelCenter:{x:240,y:120,z:0},scaleDenominator:48,locked:true,plotBorder:true}));
const elevation=editor.addLayout('Gable elevation - common scales',{size:'A3',orientation:'landscape'});accept(elevation);
for(const [frame,scaleDenominator]of [[{x:15,y:55,width:185,height:220},48],[{x:220,y:55,width:185,height:220},96]])accept(editor.addViewport(elevation.layoutId,frame,{workspace:'3d',modelCenter:{x:240,y:120,z:140},scaleDenominator,locked:true,plotBorder:true,camera3d:{yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic'}}));
const frozen=editor.addLayout('Frozen roof - negative visibility',{size:'A3',orientation:'landscape'});accept(frozen);
accept(editor.addViewport(frozen.layoutId,{x:20,y:55,width:380,height:220},{workspace:'3d',modelCenter:{x:240,y:120,z:140},scaleDenominator:48,locked:true,plotBorder:true,frozenLayers:['0'],camera3d:{yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic'}}));
accept(editor.setWorkspace('3d'));accept(editor.set3DView({target:{x:240,y:120,z:140},yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic',scale:2,autoTarget:false}));
const raw=JSON.parse(editor.serialize());raw.architecture.levels[0].defaultBearingElevation=120;raw.architecture.levels[0].defaultCeilingElevation=96;
for(const layout of raw.layouts){
 const titles=layout.id===plan.layoutId?['1/8 IN = 1 FT | 1:96','1/4 IN = 1 FT | 1:48']:layout.id===elevation.layoutId?['RIGHT GABLE | 1:48','RIGHT GABLE | 1:96']:['LAYER 0 FROZEN IN VIEWPORT - NO ROOF OR CLOSURE'];
 layout.entities.push({id:`roof-plot-title-${layout.id}`,type:'TEXT',layer:'0',position:{x:10,y:20},text:layout.name.toUpperCase()+' | A3 | ZERO THICKNESS',height:3.5,rotation:0,style:'Standard'});
 for(let i=0;i<titles.length;i++)layout.entities.push({id:`roof-plot-label-${layout.id}-${i}`,type:'TEXT',layer:'0',position:{x:layout.viewports[i]?.frame.x??20,y:40},text:titles[i],height:3.5,rotation:0,style:'Standard'});
}
const final=createEditor(raw),saved=final.serialize(),legacy=JSON.parse(saved);legacy.architecture.schemaVersion=4;for(const group of legacy.architecture.roofGroups)delete group.bearingAssignments;const historicalText=JSON.stringify(legacy,null,2),file=new URL('../samples/roof-plot-v1122.linecraft',import.meta.url);
if(!existsSync(file))writeFileSync(file,historicalText,'utf8');else assert.equal(readFileSync(file,'utf8'),historicalText,'Established analytical fixture must not be silently overwritten.');
assert.equal(JSON.parse(saved).entities.length,0);assert.equal(final.state.architecture.schemaVersion,5);assert.equal(final.state.architectureDerived.roofs[0].status,'ok');
assert.equal(Math.max(...final.state.architectureDerived.roofs[0].faces.flatMap(f=>f.vertices.map(p=>p.z))),160);
assert.ok(final.state.entities.some(e=>final.getArchitectureOwner(e.id)?.part==='gable'));
assert.ok(final.state.layouts.every(l=>l.viewports.every(v=>v.locked)));
assert.equal(createEditor(JSON.parse(saved)).serialize(),saved);
console.log('Validated source-only analytical GABLE: 480x240in, bearing120in, ceiling96in, ridge160in, no overhang, no ordinary model objects; A3 plan/elevation 1:96 and1:48 plus frozen negative sheet.');
