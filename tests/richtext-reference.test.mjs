import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,textLayout} from '../core.mjs';
import {parseRichText} from '../rich-text.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {syntheticFontLayoutDrawing} from './font-layout-fixture.mjs';
import {syntheticRichtextDrawing,RICHTEXT_SOURCE,RICHTEXT_PLAIN} from './richtext-fixture.mjs';
test('rich child retains original paper/style reference while adding a literal scoped three-paragraph entity',()=>{
 const original=syntheticFontLayoutDrawing(),before=structuredClone(original),child=syntheticRichtextDrawing();
 assert.deepEqual(syntheticFontLayoutDrawing(),before);assert.deepEqual(child.textStyles,original.textStyles);assert.deepEqual(child.layouts[0].entities.slice(0,3),original.layouts[0].entities.slice(0,3));
 const e=child.layouts[0].entities[3];assert.equal(e.text,'HHHH\nBBBB\nIIII');assert.equal(e.richText.source,RICHTEXT_SOURCE);assert.deepEqual(e.position,{x:20,y:170});assert.equal(e.height,5);assert.equal(e.width,150);
});
test('scoped family and weight/style flags produce exact independent paragraph runs',()=>{
 const p=parseRichText(RICHTEXT_SOURCE,{fontFamily:'Times New Roman',height:5,widthFactor:1});assert.equal(p.text,RICHTEXT_PLAIN);assert.deepEqual(p.warnings,[]);assert.equal(p.paragraphs.length,3);
 assert.deepEqual(p.paragraphs.map(p=>p.runs.map(r=>[r.text,r.fontFamily,r.bold,r.italic,r.height])),[[['HHHH','Times New Roman',false,false,5]],[['BBBB','Times New Roman',true,false,5]],[['IIII','Times New Roman',false,true,5]]]);
});
test('rich layout preserves exact nominal paragraph baselines without assuming unavailable pure-test font advances',()=>{
 const doc=JSON.parse(createEditor(syntheticRichtextDrawing()).serialize()),e=doc.layouts[0].entities[3],layout=textLayout(e,doc);assert.equal(layout.lines.length,3);
 for(const[line,i]of layout.lines.map((line,i)=>[line,i])){assert.equal(line.text,['HHHH','BBBB','IIII'][i]);assert.ok(Math.abs(line.position.x-20)<1e-12);assert.ok(Math.abs(line.position.y-[165,470/3,445/3][i])<1e-12);assert.equal(line.height,5);assert.equal(line.fontWeight,i===1?'bold':'normal');assert.equal(line.fontStyle,i===2?'italic':'normal');}
});
test('complete rich source/settings roundtrip and plot are nonmutating and reject conflicting plain text',()=>{
 const e=createEditor(syntheticRichtextDrawing()),text=e.serialize(),doc=JSON.parse(text);assert.deepEqual(JSON.parse(createEditor(doc).serialize()),doc);
 const plot=buildPlotHTML([{title:'Synthetic rich text',text}],{options:{space:'layout',layoutId:'font-sheet',colorMode:'monochrome',lineweights:true}});assert.equal(plot.report.pages,1);assert.equal(e.serialize(),text);assert.ok(plot.html.includes('BBBB'));assert.ok(plot.html.includes('IIII'));
 const bad=syntheticRichtextDrawing();bad.layouts[0].entities[3].text='CONFLICT';assert.throws(()=>createEditor(bad));
});
