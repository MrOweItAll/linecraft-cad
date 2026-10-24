import test from 'node:test';
import assert from 'node:assert/strict';
import {perpendicularSnapCandidates as candidates} from '../object-snaps.mjs';
const close=(actual,expected,tolerance=1e-11)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const point=(actual,expected)=>{for(const axis of['x','y','z'])close(actual[axis]??0,expected[axis]??0);};
const normal=(anchor,foot,tangent)=>{const delta={x:anchor.x-foot.x,y:anchor.y-foot.y,z:(anchor.z??0)-(foot.z??0)};close(delta.x*tangent.x+delta.y*tangent.y+delta.z*(tangent.z??0),0);};
const line=(start,end)=>({type:'LINE',start,end});

test('Horizontal finite line projects the base to its exact interior',()=>{
  const anchor={x:3,y:8},hits=candidates(line({x:0,y:0},{x:10,y:0}),anchor);assert.equal(hits.length,1);assert.equal(hits[0].type,'perpendicular');point(hits[0].point,{x:3,y:0});normal(anchor,hits[0].point,{x:10,y:0});
});
test('Oblique line solves a vector normal rather than an axis constraint',()=>{
  const anchor={x:8,y:2},hits=candidates(line({x:0,y:0},{x:10,y:10}),anchor);assert.equal(hits.length,1);point(hits[0].point,{x:5,y:5});normal(anchor,hits[0].point,{x:10,y:10});
});
test('Finite endpoints qualify only when the normal foot lies there',()=>{
  point(candidates(line({x:0,y:0},{x:10,y:0}),{x:0,y:5})[0].point,{x:0,y:0});assert.deepEqual(candidates(line({x:0,y:0},{x:10,y:0}),{x:-2,y:5}),[]);assert.deepEqual(candidates(line({x:0,y:0},{x:10,y:0}),{x:12,y:5}),[]);
});
test('Zero-length and already-coincident feet do not fabricate a line direction',()=>{
  assert.deepEqual(candidates(line({x:1,y:1},{x:1,y:1}),{x:2,y:3}),[]);assert.deepEqual(candidates(line({x:0,y:0},{x:10,y:0}),{x:5,y:0}),[]);
});
test('Spatial polyline normal retains exact elevated XYZ',()=>{
  const anchor={x:6,y:9,z:8},hits=candidates({type:'POLY3D',points:[{x:0,y:0,z:0},{x:10,y:0,z:10}],closed:false},anchor);assert.equal(hits.length,1);point(hits[0].point,{x:7,y:0,z:7});normal(anchor,hits[0].point,{x:10,y:0,z:10});
});
test('Closed rectangle and path include their closing edge',()=>{
  const points=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],anchor={x:-4,y:5};
  for(const type of['RECTANG','PLINE'])assert.ok(candidates({type,points,closed:true},anchor).some(hit=>hit.point.x===0&&hit.point.y===5));
  assert.ok(!candidates({type:'PLINE',points,closed:false},anchor).some(hit=>hit.point.x===0&&hit.point.y===5));
});
test('Circular normal feet include both valid radial branches',()=>{
  const anchor={x:9,y:12},hits=candidates({type:'CIRCLE',center:{x:0,y:0},radius:5},anchor);assert.equal(hits.length,2);point(hits[0].point,{x:3,y:4});point(hits[1].point,{x:-3,y:-4});
  for(const hit of hits){close(Math.hypot(hit.point.x,hit.point.y),5);normal(anchor,hit.point,{x:-hit.point.y,y:hit.point.x});}
});
test('Positive arc retains the valid branch and rejects the missing half',()=>{
  const hits=candidates({type:'ARC',center:{x:0,y:0},radius:5,startAngle:0,sweepAngle:90},{x:9,y:12});assert.equal(hits.length,1);point(hits[0].point,{x:3,y:4});
});
test('Negative and wrapped arcs respect signed stored sweep',()=>{
  const arc={type:'ARC',center:{x:0,y:0},radius:5,startAngle:360,sweepAngle:-90},hits=candidates(arc,{x:9,y:-12});assert.equal(hits.length,1);point(hits[0].point,{x:3,y:-4});
  assert.equal(candidates({...arc,startAngle:350,sweepAngle:20},{x:10,y:0}).length,1);
});
test('Circle center and a spatial normal axis have no unique radial foot',()=>{
  assert.deepEqual(candidates({type:'CIRCLE',center:{x:0,y:0},radius:5},{x:0,y:0}),[]);assert.deepEqual(candidates({type:'CIRCLE3D',center:{x:0,y:0,z:0},radius:5,xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:1,z:0}},{x:0,y:0,z:9}),[]);
});
test('Vertical spatial circle projects through its own axes, preserving off-plane base',()=>{
  const circle={type:'CIRCLE3D',center:{x:2,y:3,z:4},radius:5,xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:0,z:1}},anchor={x:11,y:20,z:16},hits=candidates(circle,anchor);assert.equal(hits.length,2);point(hits[0].point,{x:5,y:3,z:8});normal(anchor,hits[0].point,{x:-4,y:0,z:3});
});
test('Spatial arc clips the same analytic circle feet to its finite sweep',()=>{
  const arc={type:'ARC3D',center:{x:2,y:3,z:4},radius:5,xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:0,z:1},startAngle:0,sweepAngle:90},hits=candidates(arc,{x:11,y:20,z:16});assert.equal(hits.length,1);point(hits[0].point,{x:5,y:3,z:8});
});
test('Mesh face edges deduplicate shared edge references',()=>{
  const mesh={type:'MESH',vertices:[{x:0,y:0,z:0},{x:10,y:0,z:0},{x:0,y:10,z:0}],faces:[[0,1,2],[2,1,0]]},hits=candidates(mesh,{x:5,y:-4,z:3});assert.equal(hits.filter(hit=>hit.point.x===5&&hit.point.y===0).length,1);
});
test('Solid hatch delegates only to its finite stored boundary',()=>{
  const boundary={type:'RECTANG',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]};assert.deepEqual(candidates({type:'HATCH',boundary},{x:5,y:-4}),candidates(boundary,{x:5,y:-4}));
});
test('Invalid anchor and unsupported/malformed geometry yield no candidates',()=>{
  for(const anchor of[null,undefined,{}, {x:NaN,y:2},{x:1,y:Infinity},{x:1,y:2,z:NaN}])assert.deepEqual(candidates(line({x:0,y:0},{x:10,y:0}),anchor),[]);
  for(const entity of[null,{}, {type:'INSERT'},{type:'SPLINE'},{type:'CIRCLE',center:{x:0,y:0},radius:-5},{type:'LINE',start:{x:0,y:0},end:{x:Infinity,y:0}},{type:'CIRCLE3D',center:{x:0,y:0,z:0},radius:5,xAxis:{x:2,y:0,z:0},yAxis:{x:0,y:1,z:0}}])assert.deepEqual(candidates(entity,{x:3,y:8}),[]);
});
test('Small and large finite line coordinates retain dimensional accuracy',()=>{
  for(const scale of[1e-12,1,1e100]){const hits=candidates(line({x:0,y:0},{x:10*scale,y:0}),{x:3*scale,y:8*scale});assert.equal(hits.length,1);close(hits[0].point.x/scale,3);assert.equal(hits[0].point.y,0);}
});
test('Candidate calculation neither mutates source nor invents editor state',()=>{
  const entity={type:'ARC',id:'retained-id',center:{x:0,y:0},radius:5,startAngle:0,sweepAngle:180,layer:'unchanged'},anchor={x:9,y:12};const before=JSON.stringify({entity,anchor});Object.freeze(entity.center);Object.freeze(entity);Object.freeze(anchor);const hits=candidates(entity,anchor);assert.equal(JSON.stringify({entity,anchor}),before);assert.equal(hits.length,1);assert.notEqual(hits[0].point,entity.center);
});
