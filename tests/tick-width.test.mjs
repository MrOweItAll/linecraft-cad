import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, annotationPrimitives, entityDisplayPrimitives, hitTest } from '../core.mjs';
import { syntheticTickDrawing, LITERAL_TICK_SEGMENTS, LITERAL_DIMENSION_SEGMENTS } from './tick-width-fixture.mjs';

const raw = width => { const document=syntheticTickDrawing(); if(width!==undefined)document.dimStyles[0].tickWidth=width; return document; };
const documentOf = editor => JSON.parse(editor.serialize());
const tickStyle = document => document.dimStyles.find(style=>style.name==='Synthetic tick');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);

test('explicit model width persists and adds two literal filled triangles per unchanged tick centerline',()=>{
  const document=documentOf(createEditor(raw(12))),geometry=annotationPrimitives(document.entities[0],document);
  assert.equal(tickStyle(document).tickWidth,12);
  assert.deepEqual(geometry.segments,[...LITERAL_DIMENSION_SEGMENTS,...LITERAL_TICK_SEGMENTS]);
  assert.deepEqual(geometry.tickSegmentIndices,[3,4]);assert.equal(geometry.arrows.length,4);
  const d=3*Math.SQRT2,expected=[[-25-d,175+d],[25-d,225+d],[25+d,225-d],[-25+d,175-d]];
  for(const [actual,index]of geometry.arrows.slice(0,2).flatMap((triangle,i)=>triangle.map((point,j)=>[point,[[0,1,2],[0,2,3]][i][j]]))){near(actual.x,expected[index][0]);near(actual.y,expected[index][1]);}
  assert.equal(entityDisplayPrimitives(document.entities[0],document).fills.length,4);
  for(const point of geometry.arrows.flat())assert.ok(geometry.boundsPoints.some(p=>p.x===point.x&&p.y===point.y));
  assert.deepEqual(documentOf(createEditor(document)),document);
});

test('model width follows style/entity scale while body lineweight and tick centerlines remain independent',()=>{
  const source=raw(.5);source.dimStyles[0].scale=2;source.entities[0].scale=3;
  const document=documentOf(createEditor(source)),g=annotationPrimitives(document.entities[0],document),triangle=g.arrows[0];
  near(Math.hypot(triangle[1].x-triangle[2].x,triangle[1].y-triangle[2].y),3);
  assert.equal(3/2,1.5);assert.equal(3/4,.75);assert.equal(document.entities[0].lineweight,.1);
});

test('unset width preserves complete legacy native data and geometry without a new default',()=>{
  const editor=createEditor(raw()),before=editor.serialize(),document=documentOf(editor),g=annotationPrimitives(document.entities[0],document);
  assert.equal(Object.hasOwn(tickStyle(document),'tickWidth'),false);assert.equal(Object.hasOwn(g,'tickSegmentIndices'),false);assert.deepEqual(g.arrows,[]);
  assert.deepEqual(g.segments,[...LITERAL_DIMENSION_SEGMENTS,...LITERAL_TICK_SEGMENTS]);assert.equal(createEditor(document).serialize(),before);
});

test('explicit tick ink is selectable away from its centerline, with all fill vertices in bounds',()=>{
  const wide=documentOf(createEditor(raw(12))),legacy=documentOf(createEditor(raw()));
  assert.equal(hitTest(wide.entities,{x:-26,y:179},.01,wide),'tick-dimension');
  assert.equal(hitTest(legacy.entities,{x:-26,y:179},.01,legacy),null);
  const g=annotationPrimitives(wide.entities[0],wide);assert.ok(Math.min(...g.boundsPoints.map(p=>p.x))<-25);
});

test('closed arrows and angular dimensions retain their existing geometry when a tick width is stored',()=>{
  for(const kind of ['closed-filled','angular']){
    const source=raw(12);
    if(kind==='closed-filled')source.dimStyles[0].arrowType=kind;
    else source.entities[0]={id:'angular-control',type:'DIMENSION',kind:'angular',layer:'0',vertex:{x:0,y:0},p1:{x:1000,y:0},p2:{x:0,y:1000},placement:{x:500,y:500},style:'Synthetic tick',scale:1};
    const legacy=structuredClone(source);delete legacy.dimStyles[0].tickWidth;
    const a=documentOf(createEditor(source)),b=documentOf(createEditor(legacy));assert.deepEqual(annotationPrimitives(a.entities[0],a),annotationPrimitives(b.entities[0],b));
  }
});

test('style update, Undo/Redo and explicit null removal preserve complete expected states',()=>{
  const editor=createEditor(raw()),before=editor.serialize();assert.equal(editor.updateDimensionStyle('Synthetic tick',{tickWidth:12}).ok,true);
  const accepted=editor.serialize(),expected=JSON.parse(before);tickStyle(expected).tickWidth=12;assert.deepEqual(JSON.parse(accepted),expected);
  assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),accepted);
  assert.equal(editor.updateDimensionStyle('Synthetic tick',{tickWidth:null}).ok,true);assert.equal(editor.serialize(),before);
});

test('invalid widths and computed overflow fail atomically without content or history edits',()=>{
  const editor=createEditor(raw()),before=editor.serialize();
  for(const width of [0,-1,'12',false,NaN,Infinity,Number.MIN_VALUE]){const result=editor.updateDimensionStyle('Synthetic tick',{tickWidth:width});assert.equal(result.ok,false,String(width));assert.equal(editor.serialize(),before);}
  const source=raw(Number.MAX_VALUE);source.dimStyles[0].scale=2;assert.throws(()=>createEditor(source),/width|finite/i);
});

test('structured style revision advertises width and validates every step before changing content',()=>{
  const editor=createEditor(raw()),before=editor.serialize();
  const result=editor.applyRevision({label:'Independent tick width',steps:[{op:'dimStyle',action:'update',name:'Synthetic tick',patch:{tickWidth:12}}]});assert.equal(result.ok,true,result.message);
  assert.equal(tickStyle(documentOf(editor)).tickWidth,12);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
  const history=[editor.canUndo,editor.canRedo];
  const rejected=editor.applyRevision({label:'Reject invalid second width',steps:[{op:'dimStyle',action:'update',name:'Synthetic tick',patch:{tickWidth:12}},{op:'dimStyle',action:'update',name:'Synthetic tick',patch:{tickWidth:-1}}]});
  assert.equal(rejected.ok,false);assert.match(rejected.message,/Step 2: Tick width/);assert.equal(editor.serialize(),before);assert.deepEqual([editor.canUndo,editor.canRedo],history);
});

test('explicit width warns on DXF export while retaining legacy exchange geometry',()=>{
  const legacy=createEditor(raw()),wide=createEditor(raw(12));
  assert.equal(wide.getExportWarnings().some(message=>/independent.*tick width/i.test(message)),true);
  assert.equal(legacy.getExportWarnings().some(message=>/independent.*tick width/i.test(message)),false);
  assert.equal(wide.exportDXF(),legacy.exportDXF());
});
