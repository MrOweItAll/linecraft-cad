import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {qualityFixture} from './quality-fixtures.mjs';
import {syntheticPlanDetailDrawing} from './plan-detail-fixture.mjs';

test('detail child preserves complete original model definitions settings and styles',()=>{
 const original=qualityFixture('detail'),child=syntheticPlanDetailDrawing();
 for(const key of Object.keys(original).filter(k=>!['layouts','activeSpace','activeLayoutId','activeViewportId'].includes(k)))assert.deepEqual(child[key],original[key],key);
 assert.equal(child.entities.length,10);assert.deepEqual(child.entities.map(e=>e.id),['wall-south','wall-east','wall-north','wall-west-1','wall-west-2','qa-note','qa-dim','qa-fill','qa-block','detail-weight']);
 assert.equal(child.entities.find(e=>e.id==='detail-weight').lineweight,.7);assert.equal(child.entities.find(e=>e.id==='detail-weight').linetype,'dashed');
 assert.deepEqual(qualityFixture('detail'),original);
});
test('detail child has reversed stored order independent scales and literal page frames',()=>{
 const child=syntheticPlanDetailDrawing();assert.deepEqual(child.layouts.map(s=>s.id),['sheet-b','sheet-a']);
 for(const sheet of child.layouts){assert.deepEqual([sheet.paper.widthMm,sheet.paper.heightMm,sheet.paper.orientation],[420,297,'landscape']);const v=sheet.viewports[0];assert.deepEqual(v.frame,{x:40,y:60,width:340,height:200});assert.deepEqual(v.modelCenter,{x:120,y:150,z:0});assert.equal(v.scaleDenominator,sheet.id==='sheet-a'?48:24);assert.equal(v.locked,true);assert.equal(v.plotBorder,false);}
});
test('complete detail native state survives normalization and explicit plot order without mutations',()=>{
 const e=createEditor(syntheticPlanDetailDrawing()),text=e.serialize();assert.deepEqual(JSON.parse(createEditor(JSON.parse(text)).serialize()),JSON.parse(text));
 const out=buildPlotHTML([{title:'Synthetic detail',text}],{options:{space:'layouts',layoutIds:['sheet-a','sheet-b'],colorMode:'monochrome',lineweights:true}});
 assert.deepEqual(out.report.sheets.map(s=>s.layoutId),['sheet-a','sheet-b']);assert.equal(out.report.pages,2);assert.ok(out.html.indexOf('DETAIL-48-FIRST')<out.html.indexOf('DETAIL-24-SECOND'));assert.equal(e.serialize(),text);
});
test('independent physical reference arithmetic scales geometry while paper dash pattern stays fixed',()=>{
 assert.equal(240*25.4/48,127);assert.equal(240*25.4/24,254);assert.equal(120*25.4/48,63.5);assert.equal(120*25.4/24,127);
 for(const[d,expected]of[[48,14.000868055555555],[24,56.00347222222222]])assert.ok(Math.abs(50*(25.4/d)**2-expected)<1e-12);
 const text=createEditor(syntheticPlanDetailDrawing()).serialize();
 const out=buildPlotHTML([{title:'Synthetic detail',text}],{options:{space:'layouts',layoutIds:['sheet-a','sheet-b'],colorMode:'monochrome',lineweights:true}});
 assert.equal((out.html.match(/stroke-dasharray="4 2"/g)||[]).length,2);
 assert.equal(Math.ceil(63.5/6),11);assert.equal(Math.ceil(127/6),22);
});
