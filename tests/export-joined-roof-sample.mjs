import {preserveHistoricalNativeFixture} from './historical-native-fixture.mjs';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';
import {deriveJoinedRoofBoundary} from '../architecture/roof-joined.mjs';

// Original generic T-shaped analytical study. No client plan is used here.
// Every roof vertex is generated from the two rectangular source components.
export function createJoinedRoofSample({equal=false}={}){
  const editor=createEditor({settings:UNIT_PRESETS.architectural}),accept=result=>assert.equal(result.ok,true,result.message),rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],main=rect(0,0,480,240),wing=rect(120,0,240,480),gable=inferGableCandidates(main).alternatives.find(item=>item.ridgeDirection==='X'),wingGable=inferGableCandidates(wing).alternatives.find(item=>item.ridgeDirection==='Y');assert.ok(gable);assert.ok(wingGable);
  const components=[{id:'main',name:'Main gable · front lower Y',boundary:main,roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:gable.edgeKeys,riseTwice:16,pitchAssignments:equal?[]:[{edgeKey:'edge:0,240|480,240',riseTwice:12}],bearingElevation:120,bearingAssignments:[],heelOffset:0,overhang:0,rakeOverhang:0},{id:'wing',name:'Intersecting gable wing',boundary:wing,roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:wingGable.edgeKeys,riseTwice:16,pitchAssignments:[],bearingElevation:120,bearingAssignments:[],heelOffset:0,overhang:0,rakeOverhang:0}],coverage=deriveJoinedRoofBoundary(components);assert.equal(coverage.status,'ok',coverage.diagnostics.join(' '));
  accept(editor.applyArchitecture({type:'addRoof',name:'Generic joined main and wing',boundary:coverage.boundary,components,riseTwice:16,overhang:0,bearingElevation:120,heelOffset:0}));
  for(const [name,workspace,camera3d,center]of [['Joined roof plan common scales','2d',undefined,{x:240,y:240,z:0}],['Joined roof elevation common scales','3d',{yaw:0,pitch:0,roll:0,mode:'right',projection:'orthographic'},{x:240,y:240,z:160}]]){
    const layout=editor.addLayout(name,{size:'A2',orientation:'landscape'});accept(layout);
    for(const [frame,scaleDenominator]of [[{x:12,y:60,width:185,height:340},96],[{x:213,y:60,width:365,height:340},48]])accept(editor.addViewport(layout.layoutId,frame,{workspace,modelCenter:center,scaleDenominator,locked:true,plotBorder:true,...(camera3d?{camera3d}:{})}));
  }
  accept(editor.setWorkspace('3d'));accept(editor.set3DView({target:{x:240,y:240,z:160},yaw:45,pitch:35.264389682754654,roll:0,mode:'iso',projection:'orthographic',renderMode:'shaded',scale:1,autoTarget:true}));
  const raw=JSON.parse(editor.serialize());raw.architecture.levels[0].defaultBearingElevation=120;raw.architecture.levels[0].defaultCeilingElevation=96;
  for(const layout of raw.layouts){layout.entities.push({id:`joined-title-${layout.id}`,type:'TEXT',layer:'0',position:{x:12,y:20},text:layout.name.toUpperCase()+' | GENERIC T STUDY | ZERO THICKNESS',height:3.3,rotation:0,style:'Standard'});for(const viewport of layout.viewports)layout.entities.push({id:`joined-scale-${viewport.id}`,type:'TEXT',layer:'0',position:{x:viewport.frame.x,y:42},text:`${layout.name.includes('plan')?'PLAN':'ELEVATION'} | 1:${viewport.scaleDenominator}`,height:3.3,rotation:0,style:'Standard'});}
  const final=createEditor(raw),saved=JSON.parse(final.serialize()),roof=final.state.architectureDerived.roofs[0];assert.equal(saved.architecture.schemaVersion,8);assert.equal(saved.entities.length,0);assert.equal(roof.status,'ok',JSON.stringify(roof.diagnostics));assert.equal(roof.validation.geometry,'valid');assert.equal(roof.validation.drainage,'valid');assert.ok(roof.faces.some(face=>face.componentId==='main'));assert.ok(roof.faces.some(face=>face.componentId==='wing'));assert.ok(Math.abs(roof.quantities.projectedArea-172800)<1e-6);if(equal)assert.ok(Math.abs(roof.quantities.roofSurfaceArea-172800*Math.sqrt(13)/3)<1e-6);assert.equal(saved.architecture.roofGroups.length,1);assert.equal(saved.architecture.roofGroups[0].components.length,2);assert.equal(saved.architecture.levels[0].defaultCeilingElevation,96);assert.ok(saved.layouts.every(layout=>layout.viewports.every(viewport=>viewport.locked)));assert.equal(createEditor(saved).serialize(),final.serialize());return saved;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),outputIndex=args.indexOf('--output');for(let index=0;index<args.length;index++){if(args[index]==='--equal')continue;if(args[index]==='--output'&&index+1<args.length&&!args[index+1].startsWith('--')){index++;continue;}throw Error('Usage: export-joined-roof-sample.mjs [--equal] [--output owned-file]');}
  const file=outputIndex>=0?resolve(args[outputIndex+1]):new URL('../samples/joined-roof-v116.linecraft',import.meta.url),text=JSON.stringify(createJoinedRoofSample({equal:args.includes('--equal')}),null,2);preserveHistoricalNativeFixture(file,text,'Established joined-roof fixture differs outside declared missing trim defaults.');console.log('Validated original T study: two joined source rectangles, generated upper exterior skin, schema8; independent96in ceiling/120in bearing; A2 plan/elevation locked1:96 and1:48.');
}
