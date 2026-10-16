import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';

// Original analytical source. Heights and dimensions, not manually placed roof
// vertices, establish the expected two-plane intersection independently.
const args=process.argv.slice(2),outputIndex=args.indexOf('--output'),equal=args.includes('--equal'),hip=args.includes('--hip');
if(args.some((a,i)=>!['--equal','--hip','--output'].includes(a)&&i!==outputIndex+1))throw Error('Usage: export-bearing-sample.mjs [--equal] [--hip --output owned-file]');
if(hip&&outputIndex<0)throw Error('HIP supplementary fixture requires an explicit owned output path.');
const file=outputIndex>=0?resolve(args[outputIndex+1]):new URL('../samples/bearing-v113.linecraft',import.meta.url);
const editor=createEditor({settings:UNIT_PRESETS.architectural}),accept=r=>assert.equal(r.ok,true,r.message);
const boundary=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}];
accept(editor.applyArchitecture({type:'addRoof',name:'R5 analytical gable - independent eave bearings',boundary,riseTwice:8,overhang:0,bearingElevation:120,heelOffset:0}));
const candidate=inferGableCandidates(boundary).alternatives.find(a=>a.ridgeDirection==='X');assert.ok(candidate);
accept(editor.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{roofType:hip?'HIP':'GABLE',gablePolicy:hip?'EXPLICIT':'ALL_GABLE',gableAssignments:hip?[]:candidate.edgeKeys,rakeOverhang:0,bearingAssignments:equal?[]:[{edgeKey:'edge:0,240|480,240',elevation:144}]}}));
const plan=editor.addLayout('R5 roof plan - common scales',{size:'A3',orientation:'landscape'});accept(plan);
accept(editor.addViewport(plan.layoutId,{x:7,y:55,width:138,height:220},{workspace:'2d',modelCenter:{x:240,y:120,z:0},scaleDenominator:96,locked:true,plotBorder:true}));
accept(editor.addViewport(plan.layoutId,{x:151,y:55,width:262,height:220},{workspace:'2d',modelCenter:{x:240,y:120,z:0},scaleDenominator:48,locked:true,plotBorder:true}));
const elevation=editor.addLayout(hip?'R5 HIP north step elevation':'R5 asymmetric gable elevation',{size:'A3',orientation:'landscape'});accept(elevation);
const elevationFrames=hip?[[{x:7,y:55,width:138,height:220},96],[{x:151,y:55,width:262,height:220},48]]:[[{x:15,y:55,width:185,height:220},48],[{x:220,y:55,width:185,height:220},96]];
for(const [frame,scaleDenominator]of elevationFrames)accept(editor.addViewport(elevation.layoutId,frame,{workspace:'3d',modelCenter:{x:240,y:120,z:146},scaleDenominator,locked:true,plotBorder:true,camera3d:{yaw:hip?-90:0,pitch:0,roll:0,mode:hip?'front':'right',projection:'orthographic'}}));
const frozen=editor.addLayout('R5 frozen roof - negative visibility',{size:'A3',orientation:'landscape'});accept(frozen);
accept(editor.addViewport(frozen.layoutId,{x:20,y:55,width:380,height:220},{workspace:'3d',modelCenter:{x:240,y:120,z:146},scaleDenominator:48,locked:true,plotBorder:true,frozenLayers:['0'],camera3d:{yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic'}}));
accept(editor.setWorkspace('3d'));accept(editor.set3DView({target:{x:240,y:120,z:146},yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic',scale:2,autoTarget:false}));
const raw=JSON.parse(editor.serialize());raw.architecture.levels[0].defaultBearingElevation=120;raw.architecture.levels[0].defaultCeilingElevation=96;
for(const layout of raw.layouts){
 const titles=layout.id===plan.layoutId?['1/8 IN = 1 FT | 1:96','1/4 IN = 1 FT | 1:48']:layout.id===elevation.layoutId?(hip?['NORTH STEP | 1:96','NORTH STEP | 1:48']:['RIGHT GABLE | 1:48','RIGHT GABLE | 1:96']):['LAYER 0 FROZEN - NO ROOF OR CLOSURES'];
 layout.entities.push({id:`bearing-title-${layout.id}`,type:'TEXT',layer:'0',position:{x:10,y:20},text:layout.name.toUpperCase()+' | A3 | ZERO THICKNESS',height:3.5,rotation:0,style:'Standard'});
 for(let i=0;i<titles.length;i++)layout.entities.push({id:`bearing-label-${layout.id}-${i}`,type:'TEXT',layer:'0',position:{x:layout.viewports[i]?.frame.x??20,y:40},text:titles[i],height:3.5,rotation:0,style:'Standard'});
}
const final=createEditor(raw),saved=final.serialize(),roof=final.state.architectureDerived.roofs[0];
assert.equal(roof.status,'ok',JSON.stringify(roof.diagnostics));assert.equal(JSON.parse(saved).entities.length,0);assert.equal(final.state.architecture.schemaVersion,6);
assert.equal(Math.max(...roof.faces.flatMap(f=>f.vertices.map(p=>p.z))),equal?160:172);
const top=roof.faces.flatMap(f=>f.vertices).filter(p=>Math.abs(p.z-(equal?160:172))<1e-7);assert.ok(top.length);assert.ok(top.every(p=>Math.abs(p.y-(equal?120:156))<1e-7));
if(hip&&!equal){assert.equal(roof.stepClosures.length,2);assert.ok(roof.stepClosures.every(c=>c.thickness===0));assert.ok(Math.abs(roof.stepClosures.reduce((s,c)=>s+c.area,0)-1728)<1e-7);}else if(!hip){assert.ok(roof.gableClosures.length>=2);assert.ok(roof.gableClosures.every(c=>c.thickness===0));}assert.equal(final.state.architecture.levels[0].defaultCeilingElevation,96);
assert.equal(createEditor(JSON.parse(saved)).serialize(),saved);assert.ok(final.state.layouts.every(l=>l.viewports.every(v=>v.locked)));
const historical=JSON.parse(saved);historical.architecture.schemaVersion=5;const fixtureText=outputIndex<0?JSON.stringify(historical,null,2):saved;
if(!existsSync(file))writeFileSync(file,fixtureText,'utf8');else assert.equal(readFileSync(file,'utf8'),fixtureText,'Established R5 source fixture must not be silently overwritten.');
console.log(`Validated schema5 source-only 40x20ft 4:12 ${hip?'HIP':'GABLE'}: bearing120/${equal?120:144}in, independent ceiling96in, ridge y${equal?120:156}/z${equal?160:172}in; locked A3 1:96 and 1:48 plus frozen negative sheet.`);
