'use strict';
// Explicit pending reference, outside the selected passing profile. No browser.
// Exact production drawModel trace + independent convex-polygon area coverage.
// The coverage assumption diagnoses a mechanism; it is not a Canvas AA emulator.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.mjs'), 'utf8');
function section(start, end) {
  assert.equal(source.split(start).length, 2, 'Unique production start marker');
  assert.equal(source.split(end).length, 2, 'Unique production end marker');
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}
const drawModel = section('function drawModel(){', '\nconst finiteScreenPoint=');
const shadeInk = section('function shadeInk(', '\nfunction commandPreviewEntities()');
const BACKGROUND = [13, 23, 30], FLAT = [121, 121, 121], RGB_TOLERANCE = 8;
const PIXEL = {x: 240, y: 319}; // Unit pixel crossed through its center by x+y=560.
const SQUARE = [{x:220,y:140},{x:420,y:140},{x:420,y:340},{x:220,y:340}];
const TRIANGLES = [
  [{x:220,y:340},{x:420,y:340},{x:420,y:140}],
  [{x:220,y:340},{x:420,y:140},{x:220,y:140}],
];

// Sutherland-Hodgman clipping to a literal unit pixel; no production geometry.
function pixelCoverage(points, pixel) {
  assert.ok(points.length >= 3 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,points.length,'Unique polygon vertices');
  assert.ok(Number.isInteger(pixel.x) && Number.isInteger(pixel.y), 'Literal unit-pixel coordinates');
  let orientation=0;
  for (let i=0; i<points.length; i++) {
    const a=points[i], b=points[(i+1)%points.length];
    assert.ok(a.x!==b.x || a.y!==b.y, 'Nonzero polygon edges');
    for (const c of points) {
      const cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if (cross) {
        if (!orientation) orientation=Math.sign(cross);
        assert.equal(Math.sign(cross),orientation,'Only convex simple polygons modeled');
      }
    }
  }
  assert.notEqual(orientation,0,'Nondegenerate polygon');
  let polygon = points.map(p => ({x:p.x, y:p.y}));
  for (const [axis, bound, greater] of [
    ['x', pixel.x, true], ['x', pixel.x+1, false],
    ['y', pixel.y, true], ['y', pixel.y+1, false],
  ]) {
    const result = [], inside = p => greater ? p[axis] >= bound : p[axis] <= bound;
    for (let i=0; i<polygon.length; i++) {
      const a=polygon[i], b=polygon[(i+1)%polygon.length], ai=inside(a), bi=inside(b);
      if (ai) result.push(a);
      if (ai !== bi) {
        const t=(bound-a[axis])/(b[axis]-a[axis]);
        result.push({x:a.x+t*(b.x-a.x), y:a.y+t*(b.y-a.y)});
      }
    }
    polygon = result;
  }
  const twice = polygon.reduce((sum,a,i) => {
    const b=polygon[(i+1)%polygon.length]; return sum+a.x*b.y-b.x*a.y;
  }, 0);
  const area=Math.abs(twice)/2;
  assert.ok(area >= 0 && area <= 1+1e-9, 'Unit-pixel intersection area');
  return Math.min(1, area);
}
function overOpaque(background, color, alpha) {
  assert.ok(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1);
  return color.map((channel,i) => channel*alpha+background[i]*(1-alpha));
}
function composite(fills, pixel=PIXEL) {
  return fills.reduce((background, fill) => {
    assert.equal(fill.composite, 'source-over', 'Unsupported compositing requires a reviewed oracle extension');
    return overOpaque(background, fill.color, pixelCoverage(fill.points,pixel)*fill.alpha);
  }, BACKGROUND);
}
const fill = (points, alpha=1, color=FLAT) => ({points,alpha,color,composite:'source-over'});
function uniform(color) {
  assert.ok(color.every((v,i)=>Math.abs(v-FLAT[i])<=RGB_TOLERANCE),
    `Uniform opaque flat surface expected ${JSON.stringify(FLAT)} +/- ${RGB_TOLERANCE}; coverage model observed ${JSON.stringify(color)}`);
}
function mesh(triangles) {
  return {id:'surface',type:'MESH',color:'#ffffff',vertices:[
    {x:-10,y:-10,z:0},{x:10,y:-10,z:0},{x:10,y:10,z:0},{x:-10,y:10,z:0},
  ],faces:triangles ? [[0,1,2],[0,2,3]] : [[0,1,2,3]]};
}
async function recorded(entity) {
  const view3d=await import(pathToFileURL(path.join(root,'3d-view.mjs')));
  const fills=[], strokes=[], stack=[];
  let points=[], closed=false, style={globalAlpha:1,globalCompositeOperation:'source-over'};
  const ctx={
    save(){stack.push({...style});}, restore(){assert.ok(stack.length);style=stack.pop();},
    beginPath(){points=[];closed=false;},
    moveTo(x,y){points.push({x,y,move:true});}, lineTo(x,y){points.push({x,y});},
    closePath(){closed=true;}, setLineDash(){}, fillText(){},
    fill(rule){
      assert.ok(rule===undefined || rule==='nonzero');
      assert.ok(closed && points.filter(p=>p.move).length===1, 'Only single closed convex paths modeled');
      const match=/^rgb\((\d+),(\d+),(\d+)\)$/.exec(style.fillStyle);
      assert.ok(match, 'Production solid RGB fill');
      fills.push({points:points.map(p=>({x:p.x,y:p.y})),color:match.slice(1).map(Number),
        alpha:style.globalAlpha,composite:style.globalCompositeOperation});
    },
    stroke(){
      const copy=structuredClone(points);
      if(closed)assert.equal(copy.filter(p=>p.move).length,1,'Closed multi-subpath strokes are unsupported');
      if(closed && copy.length)copy.push({...copy[0],move:false});
      strokes.push({points:copy,...style});
    },
  };
  for (const name of ['fillStyle','strokeStyle','lineWidth','globalAlpha','globalCompositeOperation','font'])
    Object.defineProperty(ctx,name,{get:()=>style[name],set:value=>{style[name]=value;}});
  const before=structuredClone(entity);
  const host={ctx,view3d,sceneForOrbit:()=>[entity],renderContext:{includeEdits:false},
    gripPreview:()=>null,currentRoofDragPreview:()=>null,
    camera3D:()=>({...view3d.defaultCamera(),renderMode:'shaded',mode:'top',yaw:-90,pitch:90}),
    state:()=>({selectionIds:[],architecture:null,architectureDerived:null}),inkFor:e=>e.color,
    architectureOwner:()=>null,roofDisplayEdges:()=>null,
    toScreen:p=>({x:320+10*p.x,y:240-10*p.y,depth:p.z,clipped:false}),
    finiteScreenPoint:p=>Number.isFinite(p.x)&&Number.isFinite(p.y),
    commandPreviewEntities:()=>[],orbitMode:null,drag:null,pointer:null,
    width:640,height:480,selectedSubobject:null,gripPropertyIndices:new Map(),
  };
  vm.runInNewContext(`${shadeInk}\n(${drawModel})()`,host,{timeout:1000});
  assert.equal(stack.length,0); assert.deepEqual(entity,before);
  // Any stroke whose conservative bounding box reaches the probe is unsupported.
  // This refuses an edge-paint workaround instead of silently ignoring its ink.
  for (const stroke of strokes) for(let i=1;i<stroke.points.length;i++) {
    const a=stroke.points[i-1], b=stroke.points[i]; if(b.move) continue;
    const pad=(stroke.lineWidth??1)/2+1;
    assert.ok(Math.max(a.x,b.x)+pad<PIXEL.x || Math.min(a.x,b.x)-pad>PIXEL.x+1 ||
      Math.max(a.y,b.y)+pad<PIXEL.y || Math.min(a.y,b.y)-pad>PIXEL.y+1,
      'Stroke overlaps diagnostic pixel; coverage-only model cannot judge it');
  }
  return {fills,strokes};
}

test('independent literal pixel areas: full square, two halves, outside',()=>{
  assert.equal(pixelCoverage(SQUARE,PIXEL),1);
  assert.deepEqual(TRIANGLES.map(p=>pixelCoverage(p,PIXEL)),[.5,.5]);
  assert.equal(pixelCoverage(SQUARE,{x:200,y:200}),0);
});
test('independent clipping controls preserve winding and off-diagonal full coverage',()=>{
  assert.deepEqual(TRIANGLES.map(p=>pixelCoverage([...p].reverse(),PIXEL)),[.5,.5]);
  assert.deepEqual(TRIANGLES.map(p=>pixelCoverage(p,{x:300,y:300})),[1,0]);
  assert.deepEqual(TRIANGLES.map(p=>pixelCoverage(p,{x:300,y:200})),[0,1]);
});
test('coverage model rejects unsupported concave, crossing, star, duplicate and degenerate paths',()=>{
  for(const points of [
    [{x:0,y:0},{x:2,y:0},{x:.5,y:.5},{x:0,y:2}],
    [{x:0,y:0},{x:2,y:2},{x:0,y:2},{x:2,y:0}],
    [{x:0,y:-3},{x:2,y:3},{x:-3,y:-1},{x:3,y:-1},{x:-2,y:3}],
    [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:0},{x:0,y:2}],
    [...TRIANGLES[0],...TRIANGLES[0]],
    [{x:0,y:0},{x:1,y:0},{x:2,y:0}],
  ]) assert.throws(()=>pixelCoverage(points,{x:0,y:0}),assert.AssertionError);
});
test('literal source-over controls: opaque, transparent, and half-opacity fills',()=>{
  assert.deepEqual(overOpaque(BACKGROUND,FLAT,1),FLAT);
  assert.deepEqual(overOpaque(BACKGROUND,FLAT,0),BACKGROUND);
  assert.deepEqual(overOpaque(BACKGROUND,FLAT,.5),[67,72,75.5]);
});
test('two complementary half coverages leave one quarter background under source-over',()=>{
  const color=composite(TRIANGLES.map(p=>fill(p)));
  assert.deepEqual(color,[94,96.5,98.25]);
  assert.throws(()=>uniform(color),assert.AssertionError);
});
test('one complete opaque surface passes the same uniform-color reference',()=>{
  assert.deepEqual(composite([fill(SQUARE)]),FLAT); uniform(composite([fill(SQUARE)]));
});
test('coverage model refuses a changed compositing mode instead of claiming acceptance',()=>{
  assert.throws(()=>composite([{...fill(SQUARE),composite:'copy'}]),assert.AssertionError);
});
for(const triangles of [false,true]) {
  const name=triangles?'stored triangles':'quad';
  test(`${name}: actual source trace retains geometry and full off-diagonal color`,async()=>{
    const r=await recorded(mesh(triangles));
    assert.ok(r.fills.every(f=>f.alpha===1 && f.color.every((c,i)=>c===FLAT[i])));
    assert.deepEqual(composite(r.fills,{x:300,y:300}),FLAT);
    assert.deepEqual(composite(r.fills,{x:300,y:200}),FLAT);
  });
  test(`${name}: pending seam-free opaque flat-surface coverage`,async t=>{
    const r=await recorded(mesh(triangles)),color=composite(r.fills);
    t.diagnostic(JSON.stringify({kind:'analytic-coverage-model-not-browser',pixel:PIXEL,
      coverage:r.fills.map(f=>pixelCoverage(f.points,PIXEL)),color,expected:FLAT,tolerance:RGB_TOLERANCE}));
    uniform(color);
  });
}
