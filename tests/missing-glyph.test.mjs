import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,clearFontMetrics,registerFontMetrics,measureFontText,textLayout,annotationPrimitives} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {syntheticMissingGlyphDrawing,MISSING_GLYPH_TEXT} from './missing-glyph-fixture.mjs';
const profile={version:1,unitsPerEm:1000,capHeight:700,mtextCapHeight:700,ascent:800,descent:-200,lineGap:0,cmap:[[72,1]],advances:[500,600],kerning:[],symbol:false};
const token='missing-glyph:Technic';
beforeEach(()=>{clearFontMetrics();registerFontMetrics('Technic',profile,{sha256:'1'.repeat(64)});});
afterEach(()=>clearFontMetrics());
const document=()=>JSON.parse(createEditor(syntheticMissingGlyphDrawing()).serialize());
const entity=(d,id)=>d.layouts[0].entities.find(e=>e.id===id);

test('a deliberately absent codepoint reports one missing glyph in the synthetic measured profile',()=>{
  assert.deepEqual(Array.from(MISSING_GLYPH_TEXT).map(c=>c.codePointAt(0)),[72,8709,72]);
  const measured=measureFontText(MISSING_GLYPH_TEXT,5,'Technic');
  assert.equal(measured.missingGlyphs,1);assert.equal(measured.renderText,MISSING_GLYPH_TEXT);
});
test('plain TEXT exposes one missing-family diagnostic while preserving its text',()=>{
  const d=document(),e=entity(d,'glyph-text'),before=structuredClone(e),layout=textLayout(e,d);
  assert.deepEqual(layout.warnings,[token]);assert.equal(layout.lines[0].text,MISSING_GLYPH_TEXT);assert.deepEqual(e,before);
});
test('plain multiline MTEXT deduplicates a missing-family diagnostic across lines',()=>{
  const d=document(),e={...entity(d,'glyph-mtext'),text:MISSING_GLYPH_TEXT+'\n'+MISSING_GLYPH_TEXT};
  const layout=textLayout(e,d);assert.equal(layout.lines.length,2);assert.deepEqual(layout.warnings,[token]);
});
test('LEADER forwards the measured text warning without changing its definition points',()=>{
  const d=document(),e=entity(d,'glyph-leader'),g=annotationPrimitives(e,d);
  assert.deepEqual(g.warnings,[token]);assert.deepEqual(g.definitionPoints,[{x:150,y:150},{x:170,y:155},{x:190,y:155}]);assert.equal(g.texts[0].text,MISSING_GLYPH_TEXT);
});
test('DIMENSION forwards its label warning while retaining literal measurement and label',()=>{
  const d=document(),g=annotationPrimitives(entity(d,'glyph-dimension'),d);
  assert.deepEqual(g.warnings,[token]);assert.equal(g.measurement,100);assert.equal(g.label,MISSING_GLYPH_TEXT);assert.equal(g.texts[0].text,MISSING_GLYPH_TEXT);
});
test('existing rich MTEXT reports exactly one matching diagnostic',()=>{
  const d=document(),g=annotationPrimitives(entity(d,'glyph-rich'),d);assert.deepEqual(g.warnings,[token]);
});
test('plot reports every affected annotation once and preserves complete drawing state',()=>{
  const editor=createEditor(syntheticMissingGlyphDrawing()),before=editor.serialize();
  const plotted=buildPlotHTML([{title:'Synthetic missing glyph',text:before}],{options:{space:'layout',layoutId:'font-sheet'}});
  const warnings=plotted.report.warnings.filter(w=>w.includes(token));assert.equal(warnings.length,5);
  for(const id of ['glyph-text','glyph-mtext','glyph-rich','glyph-leader','glyph-dimension'])assert.equal(warnings.filter(w=>w.startsWith('Annotation '+id+':')).length,1,id);
  assert.equal(editor.serialize(),before);assert.match(plotted.previewSVG,/H∅H/);
});
test('supported text does not acquire a new warning field',()=>{
  const d=document(),e={...entity(d,'glyph-text'),text:'HHH'},layout=textLayout(e,d),g=annotationPrimitives(e,d);
  assert.equal(Object.hasOwn(layout,'warnings'),false);assert.equal(Object.hasOwn(g,'warnings'),false);assert.equal(g.texts[0].text,'HHH');
});
test('missing profile keeps its approximate-metric warning separate from absent glyph warnings',()=>{
  clearFontMetrics();const editor=createEditor(syntheticMissingGlyphDrawing());
  const result=buildPlotHTML([{title:'Synthetic missing profile',text:editor.serialize()}],{options:{space:'layout',layoutId:'font-sheet'}});
  assert.ok(result.report.warnings.some(w=>w.includes('approximate text metrics')));assert.ok(!result.report.warnings.some(w=>w.includes(token)));
});
