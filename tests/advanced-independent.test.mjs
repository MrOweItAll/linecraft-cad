/* Independent geometric invariants, separate from the command implementation's tests. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filletLines,chamferLines,splinePoint,splineBezierSegments,hatchGeometry,ellipsePoint} from '../advanced-geometry.mjs';
import {arcPoint,createEditor,rotateEntity,scaleEntity,mirrorEntity,entityPoints,expandedEntities} from '../core.mjs';
const near=(a,b,relative=1e-10)=>assert.ok(Math.abs(a-b)<=relative*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const pNear=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
const vector=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const unit=p=>{const n=Math.hypot(p.x,p.y);return{x:p.x/n,y:p.y/n};};
const ray=(angle)=>({x:Math.cos(angle)*100,y:Math.sin(angle)*100});
const line=(end,id)=>({id,type:'LINE',layer:'0',start:{x:0,y:0},end});

test('fillet arc is tangent to both retained lines over acute, right and obtuse corners',()=>{
 for(const theta of [.2,.4,.8,Math.PI/2,2,2.7])for(const rotation of [0,.3,1.8])for(const radius of [.01,1,5]){
  const a=ray(rotation),b=ray(rotation+theta),r=filletLines(line(a,'a'),line(b,'b'),a,b,radius),t1=arcPoint(r.arc,0),t2=arcPoint(r.arc,1);
  pNear(t1,r.first.start);pNear(t2,r.second.start);near(Math.hypot(t1.x-r.arc.center.x,t1.y-r.arc.center.y),radius);near(Math.hypot(t2.x-r.arc.center.x,t2.y-r.arc.center.y),radius);
  near(dot(vector(r.arc.center,t1),unit(a)),0);near(dot(vector(r.arc.center,t2),unit(b)),0);pNear(r.first.end,a);pNear(r.second.end,b);
 }
});
test('fillet retained side follows picks when source lines straddle the intersection',()=>{
 const a={...line({x:100,y:0},'a'),start:{x:-100,y:0}},b={...line({x:0,y:100},'b'),start:{x:0,y:-100}},r=filletLines(a,b,{x:-50,y:0},{x:0,y:50},10);
 pNear(r.arc.center,{x:-10,y:10});assert.ok(r.first.start.x===-100||r.first.end.x===-100);assert.ok(r.second.start.y===100||r.second.end.y===100);
});
test('zero-radius corner trims or extends to the intersection without creating a zero arc',()=>{
 const a={...line({x:100,y:0},'a'),start:{x:20,y:0}},b={...line({x:0,y:100},'b'),start:{x:0,y:20}},r=filletLines(a,b,a.end,b.end,0);assert.equal(r.arc,null);pNear(r.first.start,{x:0,y:0});pNear(r.second.start,{x:0,y:0});
});
test('chamfer endpoints lie at independently specified ray distances',()=>{
 for(const angle of [.2,.7,Math.PI/2,2.6]){const a=ray(.4),b=ray(.4+angle),r=chamferLines(line(a,'a'),line(b,'b'),a,b,7,13);near(Math.hypot(r.connector.start.x,r.connector.start.y),7);near(Math.hypot(r.connector.end.x,r.connector.end.y),13);near(dot(unit(r.connector.start),unit(a)),1);near(dot(unit(r.connector.end),unit(b)),1);}
});
test('invalid and consuming corner treatments reject without mutating either source',()=>{
 const a=line({x:20,y:0},'a'),b=line({x:0,y:20},'b'),before=JSON.stringify([a,b]);assert.throws(()=>filletLines(a,b,a.end,b.end,100),/consume/);assert.throws(()=>chamferLines(a,b,a.end,b.end,100,3),/consume/);assert.throws(()=>filletLines(a,a,a.end,a.end,2),/different/);assert.equal(JSON.stringify([a,b]),before);
});
test('a clamped cubic spline agrees with independent de Casteljau evaluation',()=>{
 const controlPoints=[{x:1,y:2},{x:5,y:30},{x:11,y:-20},{x:22,y:8}],curve={type:'SPLINE',degree:3,controlPoints,knots:[0,0,0,0,1,1,1,1],closed:false};
 for(let step=0;step<=40;step++){const t=step/40;let row=controlPoints.map(p=>({...p}));while(row.length>1)row=row.slice(1).map((p,i)=>({x:(1-t)*row[i].x+t*p.x,y:(1-t)*row[i].y+t*p.y}));pNear(splinePoint(curve,t),row[0]);}
});
test('exact cubic Bezier span conversion agrees with independent polynomial evaluation',()=>{
 const curve={type:'SPLINE',degree:3,controlPoints:[{x:0,y:0},{x:5,y:30},{x:10,y:-10},{x:20,y:40},{x:30,y:10},{x:40,y:0}],knots:[0,0,0,0,1/3,2/3,1,1,1,1],closed:false},segments=splineBezierSegments(curve);assert.equal(segments.length,3);
 for(let span=0;span<3;span++)for(let step=0;step<=20;step++){const t=step/20,s=1-t,p=segments[span],q={x:s**3*p[0].x+3*s*s*t*p[1].x+3*s*t*t*p[2].x+t**3*p[3].x,y:s**3*p[0].y+3*s*s*t*p[1].y+3*s*t*t*p[2].y+t**3*p[3].y};pNear(q,splinePoint(curve,(span+t)/3));}
});
test('ellipse evaluator lies on the stored conic after rotations, scale and reflection',()=>{
 const original={type:'ELLIPSE',layer:'0',center:{x:20,y:-10},major:{x:12,y:5},ratio:.3};const shapes=[original,rotateEntity(original,{x:10,y:20},31),scaleEntity(original,{x:5,y:2},4),mirrorEntity(original,{x:0,y:0},{x:10,y:10})];
 for(const e of shapes){const length=Math.hypot(e.major.x,e.major.y),u=unit(e.major);for(let i=0;i<80;i++){const d=vector(e.center,ellipsePoint(e,i/80)),x=dot(d,u)/length,y=(-u.y*d.x+u.x*d.y)/(length*e.ratio);near(x*x+y*y,1);}}
});
test('parallel hatch clipping obeys a concave boundary and does not bridge its notch',()=>{
 const boundary={type:'PLINE',points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:15,y:20},{x:15,y:5},{x:5,y:5},{x:5,y:20},{x:0,y:20}],closed:true},g=hatchGeometry({type:'HATCH',boundary,pattern:'parallel',angle:0,spacing:2,origin:{x:0,y:0}});
 const atTen=g.segments.filter(([a,b])=>a.y===10&&b.y===10);assert.equal(atTen.length,2);assert.deepEqual(atTen.map(([a,b])=>[Math.min(a.x,b.x),Math.max(a.x,b.x)]),[[0,5],[15,20]]);
});
test('block references expand without mutating the definition and inherit layer zero properties',()=>{
 const e=createEditor({layers:[{name:'0'},{name:'Blue',color:'#0000ff'}],blocks:[{name:'Tick',base:{x:99,y:99},entities:[{type:'LINE',layer:'0',start:{x:0,y:0},end:{x:10,y:0}}]}],entities:[{id:'instance',type:'INSERT',layer:'Blue',color:'#123456',blockName:'Tick',position:{x:100,y:50},scale:2,rotation:90}]});const before=e.serialize(),children=expandedEntities(e.state.entities,e.state);assert.equal(children.length,1);pNear(children[0].start,{x:100,y:50});pNear(children[0].end,{x:100,y:70});assert.equal(children[0].layer,'Blue');assert.equal(children[0].color,'#123456');assert.equal(e.serialize(),before);assert.equal(entityPoints(e.state.entities[0],e.state).length,2);
});
test('sampled hatch geometry respects the finite pattern resource limit',()=>{
 const boundary={type:'CIRCLE',center:{x:0,y:0},radius:10};assert.throws(()=>hatchGeometry({type:'HATCH',boundary,pattern:'parallel',angle:0,spacing:.0001,origin:{x:0,y:0}}),/5000/);const g=hatchGeometry({type:'HATCH',boundary,pattern:'parallel',angle:30,spacing:1,origin:{x:0,y:0}});for(const[a,b]of g.segments){near(Math.hypot(a.x,a.y),10);near(Math.hypot(b.x,b.y),10);}
});
