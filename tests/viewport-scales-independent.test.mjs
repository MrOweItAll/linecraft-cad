import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEWPORT_SCALE_GROUPS,VIEWPORT_SCALES,getViewportScale,parseViewportScale,parseViewportZoomFactor,matchViewportScale,formatViewportScale} from '../viewport-scales.mjs';
import {createEditor,viewportModelToPaper} from '../core.mjs';
import {ARCHITECTURAL_CASES,PHYSICAL_UNIT_CASES,rawArchitecturalScaleDrawing} from './viewport-scales-fixtures-v18.mjs';
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
test('the original catalog has unique frozen entries and safe ID lookup',()=>{
 assert.deepEqual(VIEWPORT_SCALE_GROUPS.map(group=>group.id),['architectural','ratios','engineering']);assert.equal(VIEWPORT_SCALES.length,new Set(VIEWPORT_SCALES.map(scale=>scale.id)).size);assert.ok(Object.isFrozen(VIEWPORT_SCALE_GROUPS)&&Object.isFrozen(VIEWPORT_SCALES));
 for(const group of VIEWPORT_SCALE_GROUPS){assert.ok(Object.isFrozen(group)&&Object.isFrozen(group.scales));for(const scale of group.scales){assert.ok(Object.isFrozen(scale));assert.equal(scale.groupId,group.id);assert.equal(getViewportScale(scale.id),scale);near(scale.modelLengthMm/scale.paperLengthMm,scale.scaleDenominator);}}
 for(const id of ['constructor','__proto__','missing',null,{},42])assert.equal(getViewportScale(id),null);assert.throws(()=>VIEWPORT_SCALES[0].scaleDenominator=10);
});
test('required architectural fractions encode exact physical denominators and descriptive labels',()=>{
 for(const expected of ARCHITECTURAL_CASES){const actual=getViewportScale(expected.id);assert.ok(actual,'Required common architectural scale is missing.');assert.equal(actual.label,expected.label);assert.equal(actual.scaleDenominator,expected.denominator);assert.equal(actual.modelLengthMm,304.8);near(actual.paperLengthMm,304.8/expected.denominator);}
});
test('numeric and paper:model ratios preserve their actual denominator without changing model units',()=>{
 for(const[input,expected]of [[96,96],['96',96],['+96',96],['9.6e1',96],['1:96',96],['2:192',96],['2:1',.5],['1000:1',.001],['1e-6',1e-6],['1e9',1e9]])assert.equal(parseViewportScale(input),expected);
});
test('explicit architectural quotes, primes and suffix lengths resolve the same physical fraction',()=>{
 for(const input of ['1/8" = 1\'-0"','1/8″ = 1′-0″','1/8” = 1’-0”','0.125 in = 1 ft','3.175 mm = 304.8 mm','0.3175 cm = 0.3048 m'])near(parseViewportScale(input),96);
 for(const[input,expected]of [['1/4"=1\'-0"',48],['1/16 inch=1 foot',192],['3/32 inches=1 feet',128],['1"=20\'-0"',240]])near(parseViewportScale(input),expected);
});
test('ambiguous, malformed, nonpositive and oversized scale text rejects rather than guessing a drawing unit',()=>{
 for(const input of ['',null,{},[],true,NaN,Infinity,0,-1,'1/8','1/8=1','1=96','1"=1','1:0','0:1','-1:96','1:1e309','0"=1 ft','1"=-1 ft','1:96 garbage','1:96\n','x'.repeat(257),'1e-7','1e10'])assert.throws(()=>parseViewportScale(input),`${JSON.stringify(input)} should reject.`);
});
test('matched preset labels tolerate only floating point roundoff and retain meaningful custom digits',()=>{
 assert.equal(matchViewportScale(96,{preferredGroup:'architectural'}).id,ARCHITECTURAL_CASES[0].id);assert.equal(matchViewportScale(96+Number.EPSILON*96*2,{preferredGroup:'architectural'}).id,ARCHITECTURAL_CASES[0].id);
 for(const value of [96.0000001,95.9999999,123.456789012345]){assert.equal(matchViewportScale(value),null);assert.equal(formatViewportScale(value),`1:${String(value)}`);}
 assert.equal(formatViewportScale(1), '1:1');assert.equal(formatViewportScale(1,{preferredGroup:'architectural'}),'1\'-0" = 1\'-0"');assert.equal(formatViewportScale(.5),'2:1');assert.throws(()=>matchViewportScale(96,{preferredGroup:'constructor'}));
});
for(const unitCase of PHYSICAL_UNIT_CASES){
 test(`${unitCase.unit} model: a 24-foot line projects to independently specified paper coordinates at all four architectural scales`,()=>{
  const editor=createEditor(rawArchitecturalScaleDrawing(unitCase)),before=editor.serialize();for(const[scale,view]of ARCHITECTURAL_CASES.map((scale,index)=>[scale,editor.state.layouts[0].viewports[index]])){const a=viewportModelToPaper({x:0,y:0},view,editor.state.settings),b=viewportModelToPaper({x:unitCase.length24ft,y:0},view,editor.state.settings);near(a.x,scale.expectedPaperX[0]);near(b.x,scale.expectedPaperX[1]);near(a.y,scale.expectedPaperY);near(b.y,scale.expectedPaperY);near(b.x-a.x,scale.printed24ftMm);}assert.equal(editor.serialize(),before);
 });
 test(`${unitCase.unit} model: a 100-foot line prints 12.5/25/6.25/9.375 inches without fitting to a page`,()=>{
  const editor=createEditor(rawArchitecturalScaleDrawing(unitCase));for(const[scale,view]of ARCHITECTURAL_CASES.map((scale,index)=>[scale,editor.state.layouts[0].viewports[index]])){const a=viewportModelToPaper({x:0,y:0},view,editor.state.settings),b=viewportModelToPaper({x:unitCase.length100ft,y:0},view,editor.state.settings);near(b.x-a.x,scale.printed100ftMm);}
 });
}
test('scale edits are one undoable viewport change and never alter model geometry, unit preferences or annotation styles',()=>{
 const editor=createEditor(rawArchitecturalScaleDrawing(PHYSICAL_UNIT_CASES[0])),before=JSON.parse(editor.serialize()),view=editor.state.layouts[0].viewports[0];assert.equal(editor.updateViewport('architectural-scale-sheet',view.id,{scaleDenominator:48}).ok,true);const after=JSON.parse(editor.serialize());assert.deepEqual(after.entities,before.entities);assert.deepEqual(after.settings,before.settings);assert.deepEqual(after.dimStyles,before.dimStyles);assert.deepEqual(after.textStyles,before.textStyles);assert.equal(after.layouts[0].viewports[0].scaleDenominator,48);assert.equal(editor.undo().ok,true);assert.deepEqual(JSON.parse(editor.serialize()),before);assert.equal(editor.redo().ok,true);assert.deepEqual(JSON.parse(editor.serialize()),after);
});

test('ZOOM XP parses a raw paper-millimeter factor and rejects malformed fractions without guessing physical ratios',()=>{
 for(const [input,expected] of [['25.4/96XP',25.4/96],['304.8/96xp',304.8/96],['1 / 96 XP',1/96],['1000/96XP',1000/96],['2.5e-3 XP',.0025]])assert.equal(parseViewportZoomFactor(input),expected);
 for(const input of [null,96,'96','1:96XP','1/2/3XP','1/0XP','0XP','-1XP','InfinityXP','1e309XP','1XP\n','x'.repeat(257)])assert.throws(()=>parseViewportZoomFactor(input));
});

for(const [unitCase,unitMm] of PHYSICAL_UNIT_CASES.map((unit,index)=>[unit,[25.4,304.8,1,1000][index]]))test(`${unitCase.unit} ZOOM XP changes only one viewport ratio and one Undo restores its exact projection`,()=>{
 const editor=createEditor(rawArchitecturalScaleDrawing(unitCase)),layout=editor.state.layouts[0],viewport=layout.viewports[0];editor.setSpace('model',layout.id,viewport.id);const before=JSON.parse(editor.serialize());assert.equal(editor.execute('ZOOM').ok,true);assert.equal(editor.execute(`${unitMm}/48XP`).ok,true);assert.equal(editor.state.command,null);const after=JSON.parse(editor.serialize());assert.equal(after.layouts[0].viewports[0].scaleDenominator,48);assert.deepEqual(after.entities,before.entities);assert.deepEqual(after.layouts[0].viewports[0].frame,before.layouts[0].viewports[0].frame);assert.deepEqual(after.layouts[0].viewports[0].modelCenter,before.layouts[0].viewports[0].modelCenter);assert.deepEqual(after.dimStyles,before.dimStyles);assert.equal(editor.undo().ok,true);assert.equal(editor.state.layouts[0].viewports[0].scaleDenominator,96);assert.equal(editor.canUndo,false);
});
test('a saved custom ratio remains numeric and exact across Open, with no preset ID and no scale coupling to locks',()=>{
 const editor=createEditor(rawArchitecturalScaleDrawing(PHYSICAL_UNIT_CASES[1])),view=editor.state.layouts[0].viewports[0];assert.equal(editor.updateViewport('architectural-scale-sheet',view.id,{locked:true,scaleDenominator:96.0000001}).ok,true);const before=editor.serialize(),raw=JSON.parse(before),restored=createEditor(raw);assert.equal(restored.state.layouts[0].viewports[0].scaleDenominator,96.0000001);assert.equal(restored.state.layouts[0].viewports[0].locked,true);assert.equal(restored.serialize(),before);assert.equal(formatViewportScale(restored.state.layouts[0].viewports[0].scaleDenominator,{preferredGroup:'architectural'}),'1:96.0000001');assert.ok(raw.layouts[0].viewports.every(view=>!Object.keys(view).some(key=>/preset|annotationScale/i.test(key))));
});
