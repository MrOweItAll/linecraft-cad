import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {importDXF} from '../dwg-import.mjs';
import {createEditor} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {viewportDXF,viewportControls} from './viewport-import-fixtures.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const load=options=>{const result=importDXF(viewportDXF(options));return{...result,document:JSON.parse(result.text)};};
const view=result=>result.document.layouts[0].viewports[0];
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-10,`${actual} != ${expected}`);
const controls=JSON.parse(fs.readFileSync(new URL('./fixtures/viewport-nontop-beta1-reference.json',import.meta.url)));

test('untwisted World Top raw center remains World XY instead of rotating',()=>{
 const result=load();assert.deepEqual(view(result).modelCenter,{x:23,y:-41,z:0});assert.equal(result.document.settings.units,'mm');
 assert.deepEqual(result.document.entities[0].start,{x:3,y:-41});assert.deepEqual(result.document.entities[0].end,{x:43,y:-41});
 const viewport=view(result);assert.deepEqual(viewport.frame,{x:50,y:50,width:200,height:100});assert.equal(viewport.scaleDenominator,1);assert.equal(viewport.locked,true);assert.equal(viewport.workspace,'2d');
 assert.deepEqual(viewport.camera3d.target,{x:23,y:-41,z:0});assert.equal(viewport.camera3d.yaw,-90);assert.equal(viewport.camera3d.pitch,90);assert.equal(viewport.camera3d.roll,0);
});
for(const item of [
 {name:'zero',center:[0,0],expected:{x:0,y:0,z:0}},
 {name:'opposite signs',center:[-17,29],expected:{x:-17,y:29,z:0}},
 {name:'fractional',center:[.125,-.375],expected:{x:.125,y:-.375,z:0}},
 {name:'large',center:[1000000.125,-2000000.25],expected:{x:1000000.125,y:-2000000.25,z:0}},
 {name:'nonzero XYZ target',target:[100,200,30],expected:{x:123,y:159,z:30}},
 {name:'omitted direction defaults Top',normal:null,expected:{x:23,y:-41,z:0}},
 {name:'positive scaled normal',normal:[0,0,7],expected:{x:23,y:-41,z:0}},
 {name:'normalized near-pole within existing tolerance',normal:[1e-12,0,7],expected:{x:23,y:-41,z:0}}
])test(`Top center literal arithmetic: ${item.name}`,()=>{const result=load(item);assert.deepEqual(view(result).modelCenter,item.expected);assert.deepEqual(view(result).camera3d.target,item.expected);assert.equal(view(result).workspace,'2d');});

test('paper inches retain the same millimeter frame, paper sentinel and ratio',()=>{
 const result=load({paperInches:true}),viewport=view(result);assert.deepEqual(viewport.modelCenter,{x:23,y:-41,z:0});
 for(const key of ['x','y','width','height'])near(viewport.frame[key],{x:50,y:50,width:200,height:100}[key]);near(viewport.scaleDenominator,1);
 const paper=result.document.layouts[0].entities[0];near(paper.start.x,10);near(paper.start.y,10);near(paper.end.x,20);near(paper.end.y,10);
});
test('inch model imports physical ratio1:48 without changing raw coordinates',()=>{
 const result=load({modelUnits:1,viewHeight:100*48/25.4});assert.equal(result.document.settings.units,'in');near(view(result).scaleDenominator,48);assert.deepEqual(view(result).modelCenter,{x:23,y:-41,z:0});
});
for(const item of viewportControls)test(`preserve beta1 bytes only, general transform unqualified: ${item.name}`,()=>{
 const source=viewportDXF(item),actual=importDXF(source),before=controls.cases.find(row=>row.name===item.name);assert.ok(before);assert.equal(sha(source),before.inputSHA256);assert.equal(sha(actual.text),before.nativeSHA256);assert.equal(sha(JSON.stringify(actual.report)),before.reportSHA256);
});
test('native persistence is exact; import Undo/Redo preserves content and existing navigation reconciliation',()=>{
 const result=load(),editor=createEditor(),before=editor.serialize();assert.equal(editor.importJSON(result.text).ok,true);const imported=editor.serialize();assert.deepEqual(JSON.parse(imported),result.document);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);
 // Independently confirmed on preserved beta1: history excludes navigation;
 // Undo removes the active layout and reconciles to Model, which Redo retains.
 const expectedRedo={...JSON.parse(imported),activeSpace:'model',activeLayoutId:null};assert.equal(expectedRedo.activeViewportId,null);assert.deepEqual(JSON.parse(editor.serialize()),expectedRedo);
 assert.deepEqual(JSON.parse(createEditor(JSON.parse(imported)).serialize()),result.document);
});
test('actual layout SVG places the literal40mm ruler at paper center; PDF is separate',()=>{
 const result=load(),layout=result.document.layouts[0],output=buildPlotHTML([{title:'Synthetic imported viewport',text:result.text}],{options:{space:'layout',layoutId:layout.id,colorMode:'color'}});
 const body=output.html.match(/<g data-viewport="[^"]+"[^>]*>([\s\S]*?)<\/g>/)?.[1];assert.ok(body);const line=body.match(/d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/);assert.ok(line);[130,197,170,197].forEach((value,index)=>near(Number(line[index+1]),value));assert.equal(output.report.sheets[0].viewports[0].scaleDenominator,1);
});
test('checked-in synthetic DXF is the exact independently declared fixture',()=>assert.equal(fs.readFileSync(new URL('./fixtures/top-viewport-center.dxf',import.meta.url),'utf8'),viewportDXF()));
