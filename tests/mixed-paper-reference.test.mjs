import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {syntheticMixedPaperDrawing} from './mixed-paper-fixture.mjs';
import {syntheticMultisheetDrawing} from './multisheet-fixture.mjs';

test('child fixture retains reversed stored sheets with literal A4/A3 paper and independent viewports',()=>{
  const original=syntheticMultisheetDrawing(),before=structuredClone(original),editor=createEditor(syntheticMixedPaperDrawing()),doc=JSON.parse(editor.serialize());
  assert.deepEqual(syntheticMultisheetDrawing(),before);assert.deepEqual(original,before);
  assert.equal(doc.settings.units,'in');assert.deepEqual(doc.entities[0].start,{x:0,y:0});assert.deepEqual(doc.entities[0].end,{x:240,y:0});assert.deepEqual(doc.layouts.map(s=>s.id),['sheet-b','sheet-a']);
  const[a,b]=['sheet-a','sheet-b'].map(id=>doc.layouts.find(s=>s.id===id));
  assert.deepEqual([a.paper.widthMm,a.paper.heightMm,a.paper.orientation],[210,297,'portrait']);assert.deepEqual([b.paper.widthMm,b.paper.heightMm,b.paper.orientation],[420,297,'landscape']);
  assert.deepEqual(a.viewports[0].frame,{x:25,y:100,width:160,height:100});assert.deepEqual(b.viewports[0].frame,{x:100,y:100,width:220,height:100});assert.deepEqual([a.viewports[0].scaleDenominator,b.viewports[0].scaleDenominator],[48,96]);
  for(const s of[a,b]){assert.equal(s.viewports[0].locked,true);assert.equal(s.viewports[0].plotBorder,false);assert.deepEqual(s.viewports[0].modelCenter,{x:120,y:0,z:0});assert.equal(s.entities.length,5);}
  assert.deepEqual(a.entities.find(e=>e.type==='PLINE').points,[{x:10,y:10},{x:200,y:10},{x:200,y:40},{x:10,y:40}]);assert.equal(a.entities.find(e=>e.type==='TEXT').text,'A4-FIRST');assert.deepEqual(a.entities.find(e=>e.type==='TEXT').position,{x:145,y:15});assert.equal(b.entities.find(e=>e.type==='TEXT').text,'A3-SECOND');
});
test('complete mixed-paper native state survives constructor/save normalization',()=>{const text=createEditor(syntheticMixedPaperDrawing()).serialize(),roundtrip=createEditor(JSON.parse(text)).serialize();assert.deepEqual(JSON.parse(roundtrip),JSON.parse(text));});
test('explicit A4/A3 plot order preserves stored tabs and exact input while retaining paper sizes',()=>{const e=createEditor(syntheticMixedPaperDrawing()),text=e.serialize(),result=buildPlotHTML([{title:'Synthetic mixed paper',text}],{options:{space:'layouts',layoutIds:['sheet-a','sheet-b'],colorMode:'monochrome',lineweights:true}});assert.equal(result.report.pages,2);assert.deepEqual(result.report.sheets.map(s=>s.layoutId),['sheet-a','sheet-b']);assert.deepEqual(result.report.sheets.map(s=>[s.widthMm,s.heightMm,s.orientation]),[[210,297,'portrait'],[420,297,'landscape']]);assert.ok(result.html.indexOf('A4-FIRST')<result.html.indexOf('A3-SECOND'));assert.equal(e.serialize(),text);assert.equal(240*25.4/48,127);assert.equal(240*25.4/96,63.5);});
test('mixed-paper selection rejects empty, duplicate and unknown sheet IDs',()=>{const text=createEditor(syntheticMixedPaperDrawing()).serialize();for(const layoutIds of[[],['sheet-a','sheet-a'],['sheet-a','missing']])assert.throws(()=>buildPlotHTML([{title:'Synthetic',text}],{options:{space:'layouts',layoutIds}}));});
