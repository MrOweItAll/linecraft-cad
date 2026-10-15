import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRoomSpace} from '../architecture/clearance.mjs';
import {buildRoomSection} from '../architecture/sections.mjs';
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const rectangle=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
const planeRoof=(boundary,base=120,sx=0,sy=0,origin={x:0,y:0})=>({id:'fixed-roof',status:'ok',faces:[{id:'independent-plane',vertices:boundary.map(p=>({...p,z:base+sx*(p.x-origin.x)+sy*(p.y-origin.y)}))}]});
const assembly=(reservations=[],normalThickness=0)=>({id:'declared',name:'Explicit geometric assumptions',layers:[{name:'Declared combined layer',normalThickness,material:'specified by test'}],reservations,framingVerification:'unverified'});
const room=boundary=>({id:'independent-room',boundary,anchor:{x:1,y:1},floorElevation:0,ceilingElevation:90,targetCeilingElevation:94,ceilingType:'flat',minClearHeight:72,headroomThreshold:84,ceilingFinishThickness:0});

test('independent affine-plane integral and normal-thickness conversion use exact room intersections',()=>{
 const boundary=rectangle(0,0,120,96),r={...room(boundary),floorElevation:12,ceilingElevation:108,targetCeilingElevation:110},roof=planeRoof(rectangle(-24,-24,144,120),120,.5,.25),before=JSON.stringify(roof),a=assembly([],6);r.ceilingFinishThickness=.5;
 const s=analyzeRoomSpace({room:r,roof,assembly:a,modelUnits:'in'}),deduction=6*Math.sqrt(1+.5**2+.25**2)+.5;
 assert.equal(s.status,'ok');close(s.area,11520);close(s.roofPotential.volumeAboveFloor,11520*150);close(s.maxFlatCeilingElevation,120-deduction);close(s.declared.volumeAboveFloor,11520*(150-deduction));close(s.maximumFlat.volume,11520*(108-deduction));assert.equal(s.target.feasible,true);assert.equal(s.verified,null);assert.equal(JSON.stringify(roof),before);
});

test('a partly clipped reservation on a concave room has analytical area and volume, no point sampling',()=>{
 const boundary=[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:5,y:5},{x:5,y:10},{x:0,y:10}],r=room(boundary),roof=planeRoof(rectangle(-5,-5,15,15),100,1),a=assembly([{id:'duct',kind:'service',description:'Declared box',min:{x:4,y:2,z:95},max:{x:6,y:8,z:99}}]);
 const s=analyzeRoomSpace({room:r,roof,assembly:a,modelUnits:'in'});assert.equal(s.status,'ok');close(s.area,75);close(s.roofPotential.volumeAboveFloor,7812.5);close(s.declared.volumeAboveFloor,7724);close(s.maxFlatCeilingElevation,95);close(s.recoverableFlatVolume,375);assert.equal(s.limiting.obstacle.id,'duct');close(s.limiting.point.x,4);close(s.limiting.point.y,2);assert.equal(s.target.feasible,true);
});

test('headroom area clips a height contour that passes through no original room or roof vertex',()=>{
 const r={...room(rectangle(0,0,10,10)),ceilingElevation:90,targetCeilingElevation:99,headroomThreshold:105},s=analyzeRoomSpace({room:r,roof:planeRoof(rectangle(-10,-10,20,20),100,1),assembly:assembly(),modelUnits:'in'});
 assert.equal(s.status,'ok');close(s.headroom.areaAtOrAboveThreshold,50);close(s.current.headroomArea,0);close(s.target.headroomArea,0);close(s.maxFlatCeilingElevation,100);
});

test('rejected flat candidate reports no usable flat volume even when a clipped envelope has volume',()=>{
 const r={...room(rectangle(0,0,10,10)),targetCeilingElevation:110},s=analyzeRoomSpace({room:r,roof:planeRoof(rectangle(-5,-5,15,15),100,1),assembly:assembly(),modelUnits:'in'});
 assert.equal(s.target.feasible,false);assert.equal(s.target.usableVolume,null);close(s.target.requestedVolume,11000);
});

test('no declared assembly returns roof potential without invented usable space',()=>{
 const s=analyzeRoomSpace({room:room(rectangle(0,0,10,10)),roof:planeRoof(rectangle(-5,-5,15,15)),modelUnits:'in'});
 assert.equal(s.status,'unsupported');assert.ok(s.roofPotential);assert.equal(s.declared,null);assert.equal(s.maximumFlat,null);assert.equal(s.verified,null);
});

test('reservations wholly below the floor or above the roof leave the envelope unchanged',()=>{
 const r=room(rectangle(0,0,10,10)),roof=planeRoof(rectangle(-5,-5,15,15)),a=assembly([{id:'below',min:{x:1,y:1,z:-5},max:{x:9,y:9,z:-1}},{id:'above',min:{x:1,y:1,z:121},max:{x:9,y:9,z:130}}]);
 const s=analyzeRoomSpace({room:r,roof,assembly:a,modelUnits:'in'});assert.equal(s.status,'ok');close(s.maxFlatCeilingElevation,120);close(s.declared.volumeAboveFloor,12000);close(s.assumptions.constrainingReservations,0);
});

test('physical inch/foot/millimeter/meter transformations preserve the declared space and volume',()=>{
 for(const [units,k]of [['in',1],['ft',1/12],['mm',25.4],['m',.0254]]){
  const r={...room(rectangle(0,0,120*k,96*k)),floorElevation:12*k,ceilingElevation:90*k,targetCeilingElevation:94*k,minClearHeight:72*k,headroomThreshold:84*k,ceilingFinishThickness:.5*k},roof=planeRoof(rectangle(-24*k,-24*k,144*k,120*k),120*k,.5,.25),s=analyzeRoomSpace({room:r,roof,assembly:assembly([],6*k),modelUnits:units});
  assert.equal(s.status,'ok');const d=6*Math.sqrt(1.3125)+.5;close(s.maxFlatCeilingElevation/k,120-d,1e-6);close(s.declared.volumeAboveFloor/k**3,11520*(150-d),1e-5);
 }
});

test('large survey translations do not change small-room volume or section heights',()=>{
 const x=8e8,y=-7e8,floor=1e6,boundary=rectangle(x,y,x+10,y+10),r={...room(boundary),anchor:{x:x+5,y:y+5},floorElevation:floor,ceilingElevation:floor+90,targetCeilingElevation:floor+94},roof=planeRoof(rectangle(x-5,y-5,x+15,y+15),floor+120,.5,.25,{x,y}),s=analyzeRoomSpace({room:r,roof,assembly:assembly(),modelUnits:'in'});
 assert.equal(s.status,'ok');close(s.declared.volumeAboveFloor,12375,1e-4);close(s.maximumFlat.clearHeight,120);const section=buildRoomSection({analysis:s,room:r,axis:'x',coordinate:y+5});assert.equal(section.status,'ok');close(section.length,10);close(section.dimensions.maximumFlatClearHeight,120);
});

test('missing or overlapping roof coverage cannot produce an accepted clearance result',()=>{
 const r=room(rectangle(0,0,10,10)),half=planeRoof(rectangle(0,0,5,10)),overlap=planeRoof(rectangle(0,0,10,10));overlap.faces.push(structuredClone(overlap.faces[0]));
 for(const roof of[half,overlap]){const s=analyzeRoomSpace({room:r,roof,assembly:assembly(),modelUnits:'in'});assert.equal(s.status,'unsupported');assert.equal(s.declared,null);assert.equal(s.maximumFlat,null);}
});

test('a section through a U-room never joins floor or ceiling across its open recess',()=>{
 const boundary=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:7,y:10},{x:7,y:3},{x:3,y:3},{x:3,y:10},{x:0,y:10}],r=room(boundary),s=analyzeRoomSpace({room:r,roof:planeRoof(rectangle(-1,-1,11,11)),assembly:assembly(),modelUnits:'in'}),section=buildRoomSection({analysis:s,room:r,axis:'x',coordinate:8});
 assert.equal(s.status,'ok');assert.equal(section.status,'ok');assert.equal(section.profileSegments.floor.length,2);
 for(const kind of['floor','current','target','maximumFlat'])for(const [a,b]of section.profileSegments[kind])assert.ok(b.x<=3+1e-8||a.x>=7-1e-8,`${kind} crosses the open recess`);
 for(const seg of section.segments)assert.ok(seg.to<=3+1e-8||seg.from>=7-1e-8);
});
