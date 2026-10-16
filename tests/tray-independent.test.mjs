// Independent analytical fixtures: no roof solver, model adapter, or production
// clearance generation is used to construct these exact affine envelopes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTrayCandidate,buildTrayProfileSection} from '../architecture/ceiling-candidates.mjs';
const rect=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const cell=(polygon,z,x=0,y=0,id='skin')=>({polygon,ceilingPlane:{origin:{x:0,y:0},x,y,z},roofPlane:{origin:{x:0,y:0},x,y,z},faceId:id,obstacle:{kind:'roof',id}});
function fixture(cells=[cell(rect(0,0,20,10),13)]){
 const room={id:'analytical-room',boundary:rect(0,0,20,10),anchor:{x:10,y:5},floorElevation:2,ceilingElevation:10,targetCeilingElevation:12,ceilingType:'flat'};
 const analysis={status:'ok',roomId:room.id,roofId:'fixed',modelUnits:'ft',area:200,coverage:{uncoveredArea:0,overlapArea:0},declared:{},cells,assumptions:{minimumClearHeight:7,headroomThreshold:9,roofNormalThickness:0,ceilingFinishThickness:0}};
 return{room,analysis,candidate:{min:{x:4,y:3},max:{x:16,y:7},baseElevation:10,raisedElevation:12}};
}
test('independent box arithmetic includes floor offset, both bands, threshold and ideal return finish area',()=>{
 const r=analyzeTrayCandidate(fixture());assert.equal(r.status,'ok');close(r.plateauArea,48);close(r.outerBandArea,152);close(r.candidate.usableVolume,1696);close(r.current.usableVolume,1600);close(r.recoveryVolume,96);close(r.candidate.headroomArea,48);close(r.candidate.verticalReturnArea,64);close(r.maximumRaisedElevation,13);close(r.maximumRecoverableVolume,144);
});
test('retessellating the same plane into four triangles preserves every physical total',()=>{
 const p={x:10,y:5},b=rect(0,0,20,10),whole=analyzeTrayCandidate(fixture()),split=analyzeTrayCandidate(fixture(b.map((q,i)=>cell([q,b[(i+1)%4],p],13,0,0,`tri-${i}`))));assert.equal(split.status,'ok');for(const key of['area','plateauArea','outerBandArea','maximumRaisedElevation','recoveryVolume'])close(split[key],whole[key]);for(const key of['usableVolume','headroomArea','verticalReturnArea'])close(split.candidate[key],whole.candidate[key]);
});
test('sloped envelope limit occurs at clipped raised corner, while outer band uses a separate cap',()=>{
 const f=fixture([cell(rect(0,0,20,10),10,.25)]);f.candidate.raisedElevation=11;const r=analyzeTrayCandidate(f);assert.equal(r.status,'ok');close(r.maximumRaisedElevation,11);close(r.baseLimiting.elevation,10);close(r.raisedLimiting.point.x,4);close(r.candidate.usableVolume,1648);f.candidate.raisedElevation=11.02;const bad=analyzeTrayCandidate(f);assert.equal(bad.status,'infeasible');assert.equal(bad.candidate.usableVolume,null);
});
test('a thin declared obstruction outside the plateau constrains the closed return',()=>{
 const cells=[cell(rect(0,0,3.99,10),13),cell(rect(3.99,0,4,10),11),cell(rect(4,0,20,10),13)],r=analyzeTrayCandidate(fixture(cells));assert.equal(r.status,'infeasible');close(r.maximumRaisedElevation,11);assert.equal(r.raisedLimiting.region,'vertical-return');assert.equal(r.recoveryVolume,null);
});
test('accepted stepped baseline is compared with the proposal instead of the flat scalar',()=>{
 const f=fixture();f.room.ceilingType='tray';f.room.trayCeiling={...f.candidate,raisedElevation:11};const r=analyzeTrayCandidate(f);assert.equal(r.current.profileType,'tray');close(r.current.usableVolume,1648);close(r.volumeDifference,48);close(r.recoveryVolume,48);close(r.maximumRecoverableVolume,96);
});
test('independent flat target changes do not change actual or proposed profile calculations',()=>{
 const f=fixture(),a=analyzeTrayCandidate(f);f.room.targetCeilingElevation=500;const b=analyzeTrayCandidate(f);assert.deepEqual(b,a);
});
test('center section integrates to the same stepped volume and contains both vertical returns',()=>{
 const f=fixture(),s=buildTrayProfileSection({room:f.room,candidate:f.candidate,axis:'x',coordinate:5});assert.equal(s.status,'ok');assert.equal(s.segments.filter(x=>x.kind==='vertical-return').length,2);const strip=s.segments.reduce((v,x)=>v+(x.to-x.from)*(x.start.z-f.room.floorElevation),0);close(strip,184);close(strip*4+20*8*6,analyzeTrayCandidate(f).candidate.usableVolume);const outside=buildTrayProfileSection({room:f.room,candidate:f.candidate,axis:'x',coordinate:1});close(outside.segments.reduce((v,x)=>v+(x.to-x.from)*(x.start.z-2),0),160);
});
test('source and envelope are read-only even through nested frozen objects',()=>{
 const f=fixture(),raw=JSON.stringify(f),freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};freeze(f);assert.equal(analyzeTrayCandidate(f).status,'ok');assert.equal(JSON.stringify(f),raw);
});
test('mathematical return quantities are zero while geometric area and surcharges stay explicit',()=>{
 const r=analyzeTrayCandidate(fixture());close(r.candidate.horizontalFinishArea,200);close(r.candidate.verticalReturnArea,64);assert.equal(r.assumptions.verticalReturnMaterialVolume,0);assert.equal(r.framingVerification,'unverified');assert.equal(r.verified,null);assert.equal(r.assumptions.prefabricatedTrussDesignSurcharge,0);assert.equal(r.assumptions.manufacturingComplexitySurcharge,0);
});
test('a finite work limit stops the exact calculation with no partial usable result',()=>{
 const r=analyzeTrayCandidate({...fixture(),workLimit:1});assert.equal(r.status,'unsupported');assert.equal(r.candidate,null);assert.equal(r.recoveryVolume,null);assert.deepEqual(r.cells,[]);assert.ok(r.budget.work<=1);
});
