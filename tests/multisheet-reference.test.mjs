import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {syntheticMultisheetDrawing} from './multisheet-fixture.mjs';

test('literal two-sheet fixture retains ownership, inch ruler, title blocks and independent locked scales',()=>{
  const editor=createEditor(syntheticMultisheetDrawing()),doc=JSON.parse(editor.serialize());
  assert.equal(doc.settings.units,'in');assert.deepEqual(doc.entities[0].start,{x:0,y:0});assert.deepEqual(doc.entities[0].end,{x:240,y:0});
  assert.deepEqual(doc.layouts.map(s=>s.id),['sheet-b','sheet-a']);assert.deepEqual(doc.layouts.map(s=>s.viewports[0].scaleDenominator),[96,48]);
  for(const sheet of doc.layouts){assert.equal(sheet.paper.widthMm,420);assert.equal(sheet.paper.heightMm,297);assert.equal(sheet.viewports[0].locked,true);assert.deepEqual(sheet.viewports[0].frame,{x:100,y:100,width:220,height:100});assert.deepEqual(sheet.viewports[0].modelCenter,{x:120,y:0,z:0});assert.equal(sheet.entities.length,5);assert.equal(editor.state.entities.filter(e=>e.layoutId===sheet.id).length,5);assert.equal(sheet.entities.find(e=>e.type==='TEXT').height,4);}
  assert.deepEqual(JSON.parse(createEditor(JSON.parse(editor.serialize())).serialize()),doc);
});
test('ordered multi-sheet vector output follows explicit PDF order without reordering stored tabs or changing state',()=>{
  const editor=createEditor(syntheticMultisheetDrawing()),text=editor.serialize();
  const result=buildPlotHTML([{title:'Public synthetic sheet set',text}],{options:{space:'layouts',layoutIds:['sheet-a','sheet-b'],colorMode:'monochrome',lineweights:true}});
  assert.equal(result.report.pages,2);assert.deepEqual(result.report.sheets.map(s=>s.layoutId),['sheet-a','sheet-b']);assert.deepEqual(result.report.sheets.map(s=>s.sourceIndex),[0,0]);assert.ok(result.html.indexOf('QA-A01-FIRST')<result.html.indexOf('QA-A02-SECOND'));assert.equal(editor.serialize(),text);
  assert.equal(240*25.4/48,127);assert.equal(240*25.4/96,63.5);
});
test('missing, duplicate or unknown sheet selection cannot be a valid ordered set',()=>{
  const text=createEditor(syntheticMultisheetDrawing()).serialize();
  for(const layoutIds of [[],['sheet-a','sheet-a'],['sheet-a','missing']])assert.throws(()=>buildPlotHTML([{title:'Synthetic',text}],{options:{space:'layouts',layoutIds}}));
});
