import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,annotationPrimitives} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {qualityFixture} from './quality-fixtures.mjs';
import {syntheticRotatedAnnotationDrawing} from './rotated-annotation-fixture.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function points(actual,literal){assert.equal(actual.length,literal.length);actual.forEach((p,i)=>{near(p.x,literal[i][0]);near(p.y,literal[i][1]);});}
test('rotation calibration preserves default settings/styles and leaves the original reference unchanged',()=>{
 const original=qualityFixture('detail'),doc=syntheticRotatedAnnotationDrawing();
 for(const key of ['settings','layers','textStyles','dimStyles'])assert.deepEqual(doc[key],original[key]);
 assert.equal(doc.entities.length,3);assert.deepEqual(doc.entities.map(e=>e.id),['rotation-ruler','aligned-calibration','leader-calibration']);assert.deepEqual(doc.blocks,[]);assert.deepEqual(qualityFixture('detail'),original);
});
test('aligned dimension resolves independent 60 80 100 arithmetic rotated geometry and feet/inch label',()=>{
 const doc=JSON.parse(createEditor(syntheticRotatedAnnotationDrawing()).serialize()),g=annotationPrimitives(doc.entities.find(e=>e.id==='aligned-calibration'),doc);
 near(g.measurement,100);assert.equal(g.label,`ALIGNED 8'-4"`);assert.equal(g.segments.length,3);
 const expected=[[[39.2,120.6],[7,144.75]],[[99.2,200.6],[67,224.75]],[[8,144],[68,224]]];g.segments.forEach((s,i)=>points(s,expected[i]));
 assert.equal(g.arrows.length,2);points(g.arrows[0],[[8,144],[8.8,146.525],[10.2,145.475]]);points(g.arrows[1],[[68,224],[65.8,222.525],[67.2,221.475]]);
 points([g.texts[0].position],[[36,185.5]]);near(g.texts[0].rotation,53.13010235415598);near(g.texts[0].height,2.5);
});
test('45 degree leader retains two legs a filled arrow and the explicit note landing',()=>{
 const doc=JSON.parse(createEditor(syntheticRotatedAnnotationDrawing()).serialize()),g=annotationPrimitives(doc.entities.find(e=>e.id==='leader-calibration'),doc);
 assert.equal(g.segments.length,2);points(g.segments[0],[[160,130],[180,150]]);points(g.segments[1],[[180,150],[215,150]]);
 assert.equal(g.arrows.length,1);points(g.arrows[0],[[160,130],[161.14904851942814,132.3864853865046],[162.3864853865046,131.14904851942814]]);
 assert.equal(g.texts[0].text,'SYNTHETIC LEADER');points([g.texts[0].position],[[215,150]]);assert.equal(g.texts[0].rotation,0);assert.equal(g.texts[0].height,6);
});
test('complete calibration state and requested order preserve original tabs with two independent locked scales',()=>{
 const editor=createEditor(syntheticRotatedAnnotationDrawing()),text=editor.serialize(),doc=JSON.parse(text);assert.deepEqual(JSON.parse(createEditor(doc).serialize()),doc);assert.deepEqual(doc.layouts.map(s=>s.id),['sheet-b','sheet-a']);
 for(const sheet of doc.layouts){const v=sheet.viewports[0];assert.deepEqual(v.frame,{x:40,y:60,width:340,height:200});assert.deepEqual(v.modelCenter,{x:120,y:150,z:0});assert.equal(v.scaleDenominator,sheet.id==='sheet-a'?48:96);assert.equal(v.locked,true);assert.equal(v.plotBorder,false);}
 const plot=buildPlotHTML([{title:'Synthetic rotation',text}],{options:{space:'layouts',layoutIds:['sheet-a','sheet-b'],colorMode:'monochrome',lineweights:true}});assert.equal(plot.report.pages,2);assert.deepEqual(plot.report.sheets.map(s=>s.layoutId),['sheet-a','sheet-b']);assert.ok(plot.html.indexOf('ROTATED-48-FIRST')<plot.html.indexOf('ROTATED-96-SECOND'));assert.equal(editor.serialize(),text);near(100*25.4/48,52.916666666666664);near(100*25.4/96,26.458333333333332);
});
