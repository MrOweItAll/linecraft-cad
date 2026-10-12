import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEWPORT_SCALE_GROUPS,VIEWPORT_SCALES,getViewportScale,parseViewportScale,matchViewportScale,formatViewportScale,parseViewportZoomFactor} from '../viewport-scales.mjs';
import {createEditor,viewportModelToPaper} from '../core.mjs';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),`${actual} differs from ${expected}`);
const examples=[['1/8',96,76.2],['1/4',48,152.4],['1/16',192,38.1],['3/32',128,57.15]];

test('required architectural presets have exact canonical physical denominators',()=>{
  for(const [fraction,expected] of examples){const scale=VIEWPORT_SCALES.find(scale=>scale.label===`${fraction}" = 1'-0"`);assert.ok(scale);assert.equal(scale.scaleDenominator,expected);close(scale.modelLengthMm/scale.paperLengthMm,expected);assert.equal(parseViewportScale(scale.label),expected);}
});
test('catalog resources are immutable with unique stable IDs and complete group membership',()=>{
  assert.ok(Object.isFrozen(VIEWPORT_SCALE_GROUPS));assert.ok(Object.isFrozen(VIEWPORT_SCALES));assert.equal(new Set(VIEWPORT_SCALES.map(scale=>scale.id)).size,VIEWPORT_SCALES.length);
  for(const group of VIEWPORT_SCALE_GROUPS){assert.ok(Object.isFrozen(group));assert.ok(Object.isFrozen(group.scales));for(const item of group.scales){assert.ok(Object.isFrozen(item));assert.equal(item.groupId,group.id);assert.equal(getViewportScale(item.id),item);assert.equal(VIEWPORT_SCALES.includes(item),true);close(parseViewportScale(item.label),item.scaleDenominator);}}
  assert.equal(getViewportScale('constructor'),null);assert.equal(getViewportScale('__proto__'),null);assert.equal(getViewportScale(null),null);
});
test('ratio input consistently means paper:model and supports reduction/enlargement',()=>{
  for(const [text,expected] of [['96',96],['1:96',96],['2:192',96],['2:1',.5],['1000:1',.001],['1e2:4e2',4],[' 1 : 50 ',50]])assert.equal(parseViewportScale(text),expected);
  assert.equal(parseViewportScale(96),96);assert.equal(parseViewportScale('0.000001'),1e-6);assert.equal(parseViewportScale('1000000000'),1e9);
});
test('explicit scale lengths accept straight, curly and prime quotes plus physical suffixes',()=>{
  for(const text of ['1/8" = 1\'-0"','1/8” = 1’-0”','1/8″ = 1′-0″','1/8in = 1ft','1/8 inches = 1 foot','1/8" = 12"','1/8"=0.3048m','3.175mm = 304.8mm'])close(parseViewportScale(text),96);
  assert.equal(parseViewportScale('1-1/2" = 1\'-0"'),8);assert.equal(parseViewportScale('1"=20ft'),240);close(parseViewportScale('1cm=1m'),100);assert.equal(parseViewportScale('1\'=1\''),1);
});
test('malformed or unsafe notation rejects rather than changing viewport scale',()=>{
  for(const raw of ['',null,{},[],NaN,Infinity,0,-1,'-96','0:1','1:0','1:-96','1:2:3','1e309','1e-7','1e10','1/8','1/8=1\'','1"=12','1/0"=1\'','-1"=1\'','1"=0\'','1"=1\'=2\'','1"=1\'junk','1/8"=1\'\n','1'+('0'.repeat(256))])assert.throws(()=>parseViewportScale(raw),String(raw));
});
test('label matching accepts floating round-off and retains genuinely custom denominators',()=>{
  assert.equal(matchViewportScale(96)?.label,'1/8" = 1\'-0"');assert.equal(matchViewportScale(96+Number.EPSILON*96*4)?.scaleDenominator,96);
  assert.equal(matchViewportScale(96.0000001),null);assert.equal(formatViewportScale(96.0000001),'1:96.0000001');assert.equal(formatViewportScale(97.12345678901234),'1:97.12345678901234');
  assert.equal(formatViewportScale(50),'1:50');assert.equal(formatViewportScale(1),'1:1');assert.equal(formatViewportScale(1,{preferredGroup:'architectural'}),'1\'-0" = 1\'-0"');assert.equal(formatViewportScale(120,{preferredGroup:'engineering'}),'1" = 10\'-0"');
  assert.throws(()=>matchViewportScale(96,{preferredGroup:'constructor'}));assert.throws(()=>formatViewportScale(NaN));
});
test('a physical 24-foot model length produces the expected millimeters on paper in each model unit',()=>{
  for(const [fraction,denominator,paperMm] of examples)for(const [unit,length] of [['in',288],['ft',24],['mm',7315.2],['m',7.3152]]){
    const viewport={frame:{x:20,y:20,width:200,height:100},modelCenter:{x:0,y:0,z:0},scaleDenominator:parseViewportScale(`${fraction}"=1\'`),workspace:'2d'};
    assert.equal(viewport.scaleDenominator,denominator);const a=viewportModelToPaper({x:0,y:0},viewport,{units:unit}),b=viewportModelToPaper({x:length,y:0},viewport,{units:unit});close(b.x-a.x,paperMm);close(b.y-a.y,0);
  }
});
test('standard scale editing preserves model, viewport frame, center and annotation settings with one Undo',()=>{
  const editor=createEditor({settings:{units:'in',linearFormat:'architectural'},entities:[{id:'physical-24ft',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:288,y:0}}]}),layout=editor.addLayout('Scale catalog test',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true);
  const made=editor.addViewport(layout.layoutId,{x:20,y:30,width:200,height:100},{modelCenter:{x:144,y:0,z:0},scaleDenominator:100,locked:true});assert.equal(made.ok,true);const before=editor.serialize(),document=JSON.parse(before),view=document.layouts[0].viewports[0];
  assert.equal(editor.updateViewport(layout.layoutId,made.viewportId,{scaleDenominator:parseViewportScale('1/8"=1\'')}).ok,true);const changed=JSON.parse(editor.serialize()),next=changed.layouts[0].viewports[0];assert.equal(next.scaleDenominator,96);for(const key of ['frame','modelCenter','camera3d','locked'])assert.deepEqual(next[key],view[key]);assert.deepEqual(changed.entities,document.entities);assert.deepEqual(changed.settings,document.settings);assert.deepEqual(changed.dimStyles,document.dimStyles);
  const restored=createEditor(changed);assert.equal(restored.state.layouts[0].viewports[0].scaleDenominator,96);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);assert.equal(editor.state.layouts[0].viewports[0].scaleDenominator,96);
});
test('invalid scale input and locked navigation leave document/history atomic',()=>{
  const editor=createEditor(),layout=editor.addLayout('Atomic scale test'),made=editor.addViewport(layout.layoutId,{x:10,y:10,width:100,height:50},{locked:true});const before=editor.serialize(),revision=editor.state.revision;
  for(const value of [0,NaN,Infinity,1e10])assert.equal(editor.updateViewport(layout.layoutId,made.viewportId,{scaleDenominator:value}).ok,false);
  assert.equal(editor.updateViewport(layout.layoutId,made.viewportId,{scaleDenominator:96},{navigation:true}).ok,false);assert.equal(editor.serialize(),before);assert.equal(editor.state.revision,revision);
});
test('XP factor grammar accepts bounded original fractions and rejects nonfinite or compound expressions',()=>{
  for(const [input,expected] of [['25.4/96XP',25.4/96],['304.8 / 96 xp',304.8/96],['1/96XP',1/96],['1000/96XP',1000/96],['0.01XP',.01],['1e-2XP',.01],['+1.0XP',1]])assert.equal(parseViewportZoomFactor(input),expected);
  for(const input of ['0XP','-1XP','1/0XP','0/1XP','1/-1XP','NaNXP','InfinityXP','1e309XP','1/1e309XP','1e-324XP','1/2/3XP','1:96XP','1X','1','1"XP','1XP\n',null,{},96])assert.throws(()=>parseViewportZoomFactor(input),String(input));
});
function activeViewport(unit='in',locked=false){const editor=createEditor({settings:{units:unit},entities:[{id:'owned-line',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:288,y:0}}]}),layout=editor.addLayout('XP test'),made=editor.addViewport(layout.layoutId,{x:10,y:20,width:200,height:100},{modelCenter:{x:144,y:24,z:0},scaleDenominator:100,locked});assert.equal(made.ok,true);assert.equal(editor.setSpace('model',layout.layoutId,made.viewportId).ok,true);return editor;}
test('ZOOM fractionXP applies exact physical denominator 96 across inch/foot/mm/m and one Undo/Redo',()=>{
  for(const [unit,numerator] of [['in',25.4],['ft',304.8],['mm',1],['m',1000]]){
    const editor=activeViewport(unit),before=editor.serialize(),old=JSON.parse(before),previous=old.layouts[0].viewports[0],revision=editor.state.revision;assert.equal(editor.execute('Z').ok,true);assert.equal(editor.state.commandPhase,'zoom-option');assert.equal(editor.state.commandData.targetKind,'none');assert.equal(editor.execute(`${numerator}/96XP`).ok,true);assert.equal(editor.state.command,null);assert.equal(editor.state.revision,revision+1);
    const raw=JSON.parse(editor.serialize()),view=raw.layouts[0].viewports[0];assert.equal(view.scaleDenominator,96);for(const key of ['id','frame','modelCenter','camera3d','locked','frozenLayers'])assert.deepEqual(view[key],previous[key]);assert.deepEqual(raw.entities,old.entities);assert.deepEqual(raw.settings,old.settings);assert.deepEqual(raw.dimStyles,old.dimStyles);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);assert.equal(editor.state.layouts[0].viewports[0].scaleDenominator,96);
  }
});
test('ZOOM numericXP matches fractionXP and keeps native-adapted paper positions unchanged except scale',()=>{
  const editor=activeViewport('in'),before=editor.serialize();assert.equal(editor.execute('ZOOM').ok,true);assert.equal(editor.execute(`${25.4/96}XP`).ok,true);assert.equal(editor.state.layouts[0].viewports[0].scaleDenominator,96);const view=editor.state.layouts[0].viewports[0],a=viewportModelToPaper({x:0,y:0},view,editor.state.settings),b=viewportModelToPaper({x:288,y:0},view,editor.state.settings);close(b.x-a.x,76.2);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
});
test('ZOOM XP rejects locked/paper/model-tab contexts without changing a view or history',()=>{
  const model=createEditor(),paper=activeViewport('in'),locked=activeViewport('in',true);assert.equal(paper.setSpace('paper',paper.state.activeLayoutId).ok,true);
  for(const editor of [model,paper,locked]){const before=editor.serialize(),revision=editor.state.revision;assert.equal(editor.execute('ZOOM').ok,true);const response=editor.execute('25.4/96XP');assert.equal(response.ok,false);assert.match(response.message,/viewport|locked/i);assert.equal(editor.serialize(),before);assert.equal(editor.state.revision,revision);assert.equal(editor.state.command,'ZOOM');assert.equal(editor.execute('').ok,true);assert.equal(editor.serialize(),before);}
});
test('ZOOM XP malformed/out-of-range values recover at the same prompt with no intermediate mutation',()=>{
  const editor=activeViewport(),before=editor.serialize(),revision=editor.state.revision;assert.equal(editor.execute('ZOOM').ok,true);
  for(const input of ['0XP','-1XP','NaNXP','1/0XP','1e300XP','1e-300XP','1:96XP','25.4/96/2XP']){assert.equal(editor.execute(input).ok,false,input);assert.equal(editor.serialize(),before);assert.equal(editor.state.revision,revision);assert.equal(editor.state.command,'ZOOM');assert.equal(editor.state.commandPhase,'zoom-option');}
  assert.equal(editor.execute('25.4/96XP').ok,true);assert.equal(editor.state.layouts[0].viewports[0].scaleDenominator,96);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
});
