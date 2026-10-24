import test from 'node:test';
import assert from 'node:assert/strict';
import {ordinaryGripPlane,ordinaryGripPointOnPlane,parseOrdinaryGripPoint} from '../ordinary-grip-input.mjs';
import {createEditor,previewGrip,planeToWorld} from '../core.mjs';
import {buildCanvasContextMenu} from '../context-menu-policy.mjs';
const xy={origin:{x:0,y:0,z:0},xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:1,z:0},normal:{x:0,y:0,z:1}};
const xz={origin:{x:0,y:0,z:0},xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:0,z:1},normal:{x:0,y:-1,z:0}};
const line={id:'line',type:'LINE',start:{x:0,y:0},end:{x:100,y:0},layer:'0'};
test('ordinary planar handles retain their creation XY plane independently of current UCS',()=>{
  const original=structuredClone(line),plane=ordinaryGripPlane(line,line.end,xz);
  assert.deepEqual(plane,{...xy,origin:{x:100,y:0,z:0}});assert.deepEqual(line,original);
  plane.xAxis.x=4;assert.equal(xy.xAxis.x,1);assert.equal(xz.xAxis.x,1);
});
test('spatial curves use their own creation basis and preserve source elevation',()=>{
  const circle={type:'CIRCLE3D',center:{x:3,y:8,z:5},xAxis:xz.xAxis,yAxis:xz.yAxis},plane=ordinaryGripPlane(circle,circle.center,xy);
  assert.deepEqual(plane,{...xz,origin:circle.center});assert.notEqual(plane.origin,circle.center);
});
test('spatial paths use an independent construction-parallel plane through the exact handle',()=>{
  const source={x:10,y:7,z:20},plane=ordinaryGripPlane({type:'POLY3D'},source,xz);
  assert.deepEqual(plane,{...xz,origin:source});plane.origin.y=9;assert.equal(source.y,7);assert.equal(xz.origin.y,0);
});
test('paper frames use sheet XY and legacy nonzero Z objects reject without flattening',()=>{
  assert.deepEqual(ordinaryGripPlane({type:'VIEWPORT'},{x:20,y:30},xz,'paper'),{...xy,origin:{x:20,y:30,z:0}});
  for(const source of[{...line,start:{x:0,y:0,z:4},end:{x:100,y:0,z:4}},{...line,end:{x:100,y:0,z:10}}]){
    const original=structuredClone(source);assert.throws(()=>ordinaryGripPlane(source,source.end,xy),/losing elevation|unchanged/i);assert.deepEqual(source,original);
  }
});
test('large unrelated world coordinates cannot forgive an off-plane snap',()=>{
  const plane={...xy,origin:{x:1e12,y:-1e12,z:7}};
  assert.equal(ordinaryGripPointOnPlane({x:1e12,y:-1e12,z:7},plane),true);
  assert.equal(ordinaryGripPointOnPlane({x:1e12,y:-1e12,z:107},plane),false);
  assert.equal(ordinaryGripPointOnPlane({x:1e12,y:-1e12,z:7.01},plane),false);
  assert.equal(ordinaryGripPointOnPlane({x:NaN,y:0,z:7},plane),false);
});
test('oblique creation planes accept their own points and reject normal displacement',()=>{
  const r=Math.sqrt(.5),plane={origin:{x:20,y:30,z:40},xAxis:{x:r,y:r,z:0},yAxis:{x:0,y:0,z:1},normal:{x:r,y:-r,z:0}},p=planeToWorld({x:10,y:15,z:0},plane);
  assert.equal(ordinaryGripPointOnPlane(p,plane),true);assert.equal(ordinaryGripPointOnPlane({...p,x:p.x+r,y:p.y-r},plane),false);
});
test('typed model lengths retain the existing architectural parser and exact source-relative base',()=>{
  const options={entity:line,sourcePoint:{x:100,y:20},inputPlane:xy,settings:{units:'in',angularInputUnit:'degrees'}};
  assert.deepEqual(parseOrdinaryGripPoint('1\'6",2\'',options),{x:18,y:24});
  assert.deepEqual(parseOrdinaryGripPoint('@1\',-6"',options),{x:112,y:14});
  assert.deepEqual(parseOrdinaryGripPoint('@5<90',options),{x:100,y:25});
});
test('model input uses its frozen UCS while off-creation-plane 2D targets reject',()=>{
  const moved={origin:{x:20,y:30,z:0},xAxis:{x:0,y:1,z:0},yAxis:{x:-1,y:0,z:0},normal:{x:0,y:0,z:1}},options={entity:line,sourcePoint:{x:100,y:20},inputPlane:moved};
  assert.deepEqual(parseOrdinaryGripPoint('0,0',options),{x:20,y:30});assert.deepEqual(parseOrdinaryGripPoint('2,3',options),{x:17,y:32});
  assert.deepEqual(parseOrdinaryGripPoint('@2,3',options),{x:97,y:22});
  assert.throws(()=>parseOrdinaryGripPoint('2,3',{...options,inputPlane:xz}),/outside.*creation plane/i);
});
test('paper coordinates remain millimeters even in an architectural-inch drawing',()=>{
  const options={entity:{type:'VIEWPORT'},sourcePoint:{x:20,y:30},inputPlane:xy,space:'paper',settings:{units:'in',linearFormat:'architectural'}};
  assert.deepEqual(parseOrdinaryGripPoint('12,6',options),{x:12,y:6});assert.deepEqual(parseOrdinaryGripPoint('@2,3',options),{x:22,y:33});
});
test('spatial relative inputs preserve source XYZ through the frozen input UCS',()=>{
  const options={entity:{type:'POLY3D'},sourcePoint:{x:10,y:7,z:20},inputPlane:xz};
  assert.deepEqual(parseOrdinaryGripPoint('@2,3,4',options),{x:12,y:3,z:23});
  assert.deepEqual(parseOrdinaryGripPoint('@5<90',options),{x:10,y:7,z:25});
  assert.deepEqual(parseOrdinaryGripPoint('2,3',options),{x:2,y:0,z:3});
});
test('typed spatial XYZ may leave the pointer acquisition plane without losing elevation',()=>{
  const source={id:'path',type:'POLY3D',points:[{x:0,y:0,z:10},{x:100,y:0,z:10}],closed:false,layer:'0'},point=parseOrdinaryGripPoint('10,20,30',{entity:source,sourcePoint:source.points[0],inputPlane:xy});
  assert.deepEqual(point,{x:10,y:20,z:30});assert.equal(ordinaryGripPointOnPlane(point,{...xy,origin:source.points[0]}),false);
  const preview=previewGrip(source,0,point);assert.deepEqual(preview.points[0],point);assert.deepEqual(source.points[0],{x:0,y:0,z:10});
});
test('spatial circular center grips may translate the plane while radius grips retain its constraint',()=>{
  for(const type of['CIRCLE3D','ARC3D']){
    const source={id:type,type,center:{x:0,y:0,z:0},radius:5,xAxis:xz.xAxis,yAxis:xz.yAxis,layer:'0',...(type==='ARC3D'?{startAngle:0,sweepAngle:90}:{})},target={x:0,y:10,z:20};
    const moved=previewGrip(source,type==='ARC3D'?3:0,target);assert.deepEqual(moved.center,target);assert.deepEqual(moved.xAxis,source.xAxis);assert.deepEqual(source.center,{x:0,y:0,z:0});
    assert.throws(()=>previewGrip(source,1,{x:10,y:10,z:0}),/plane/i);
  }
});
test('blank scalar malformed and off-plane 2D typed points reject explicitly',()=>{
  const options={entity:line,sourcePoint:line.end,inputPlane:xy};
  for(const raw of['','  ','5','bad','10,20,3'])assert.throws(()=>parseOrdinaryGripPoint(raw,options));
});
test('shared preview is nonmutating and the one commit retains previous Undo history',()=>{
  const editor=createEditor();for(const token of['LINE','0,0','100,0',''])assert.equal(editor.execute(token).ok,true);
  const source=structuredClone(editor.state.entities[0]),before=editor.serialize(),preview=previewGrip(source,1,{x:80,y:40},editor.state);
  assert.deepEqual(preview.end,{x:80,y:40});assert.equal(editor.serialize(),before);assert.deepEqual(source.end,{x:100,y:0});
  assert.equal(editor.moveGrip(source.id,1,{x:0,y:0}).ok,false);assert.equal(editor.serialize(),before);
  assert.equal(editor.moveGrip(source.id,1,{x:80,y:40}).ok,true);const after=editor.serialize();
  assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,true);
  assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),after);
});
test('ordinary grip menus expose only the real confirmation snap and cancellation providers',()=>{
  const model=buildCanvasContextMenu({operation:{kind:'ordinary-grip',canFinish:true},pointPrompt:true,perpendicularAvailable:true});
  assert.equal(model.context,'ordinary-grip');assert.deepEqual(model.items.map(item=>item.id),['grip:accept','snaps','cancel']);assert.equal(model.items[0].enabled,true);
  const invalid=buildCanvasContextMenu({operation:{kind:'ordinary-grip',canFinish:false,reason:'Invalid destination'},pointPrompt:true});
  assert.equal(invalid.items[0].enabled,false);assert.equal(invalid.items[0].reason,'Invalid destination');
});
