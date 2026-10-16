import test from 'node:test';
import assert from 'node:assert/strict';
import {solveHipRoof} from '../architecture/roof-hip.mjs';
import {analyzeRoomSpace} from '../architecture/clearance.mjs';
import {analyzeTrayCandidate,buildTrayProfileSection,TRAY_LIMITS} from '../architecture/ceiling-candidates.mjs';
const xy=points=>points.map(([x,y])=>({x,y}));
const rectangle=xy([[0,0],[40,0],[40,20],[0,20]]);
const sourceRoom=(extra={})=>({id:'room-1',boundary:rectangle,anchor:{x:20,y:10},floorElevation:0,ceilingElevation:9,targetCeilingElevation:10,ceilingType:'flat',ceilingFinishThickness:0,minClearHeight:8,headroomThreshold:10.5,...extra});
const candidate=(extra={})=>({min:{x:5,y:5},max:{x:35,y:15},baseElevation:10,raisedElevation:11,...extra});
const assembly=(extra={})=>({id:'assembly-1',layers:[],reservations:[],...extra});
const roof=()=>({id:'roof-1',...solveHipRoof({boundary:rectangle,riseTwice:8,eaveOverhang:0,eaveSurfaceElevation:10})});
const box=(id,min,max)=>({id,kind:'service',min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]}});
const input=(extra={})=>{const room=extra.room??sourceRoom(),analysis=analyzeRoomSpace({room:{...room,ceilingType:'flat'},roof:extra.roof??roof(),assembly:extra.assembly??assembly(),modelUnits:extra.modelUnits??'ft'});return{analysis,room,candidate:candidate(),...extra};};
const analyze=extra=>analyzeTrayCandidate(input(extra));
const close=(actual,expected,tol=1e-7)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected}`);
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};
const polygonArea=poly=>{const a=poly[0];let n=0;for(let i=1;i<poly.length-1;i++){const b=poly[i],c=poly[i+1];n+=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}return Math.abs(n)/2;};

test('rectangular tray has analytical finished volume, areas, headroom and maximum plateau elevation',()=>{
 const r=analyze();assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));assert.equal(r.feasible,true);close(r.area,800);close(r.plateauArea,300);close(r.outerBandArea,500);close(r.candidate.requestedVolume,8300);close(r.candidate.usableVolume,8300);close(r.candidate.horizontalFinishArea,800);close(r.candidate.verticalReturnArea,80);close(r.candidate.headroomArea,300);close(r.maximumRaisedElevation,35/3);close(r.recoveryVolume,1100);close(r.volumeDifference,1100);close(r.maximumRecoverableVolume,1300);assert.equal(r.current.profileType,'flat');close(r.current.usableVolume,7200);
});
test('exact profile cells conserve whole room and requested volume rather than only plateau area',()=>{
 const r=analyze();close(r.cells.reduce((sum,c)=>sum+polygonArea(c.polygon),0),800);close(r.cells.reduce((sum,c)=>sum+polygonArea(c.polygon)*c.ceilingElevation,0),8300);close(r.cells.filter(c=>c.region==='plateau').reduce((sum,c)=>sum+polygonArea(c.polygon),0),300);assert.equal(r.returnEdges.length,4);assert.ok(r.interfaceSegments.length>=4);for(const e of r.returnEdges){close(e.start.z,10);close(e.topStart.z,11);}
});
test('a reservation within plateau is an exact limiting obstacle',()=>{
 const r=analyze({assembly:assembly({reservations:[box('duct',[8,7,10.75],[12,13,11.25])]})});assert.equal(r.status,'infeasible');assert.equal(r.feasible,false);close(r.maximumRaisedElevation,10.75);assert.equal(r.raisedLimiting.obstacle.id,'duct');assert.equal(r.candidate.usableVolume,null);assert.equal(r.recoveryVolume,null);assert.ok(r.maximumRecoverableVolume>0);
});
test('an outer-band reservation may limit flat ceiling without invalidating a lower base and higher inner plateau',()=>{
 const r=analyze({candidate:candidate({baseElevation:9,raisedElevation:11}),assembly:assembly({reservations:[box('outer-service',[1,4,9.5],[3,16,10])]})});assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));close(r.candidate.usableVolume,7800);close(r.maximumRaisedElevation,35/3);close(r.baseLimiting.elevation,9.5);assert.equal(r.baseLimiting.obstacle.id,'outer-service');
});
test('an outer-band obstruction above base but below the closed vertical return invalidates the return',()=>{
 const r=analyze({candidate:candidate({baseElevation:9,raisedElevation:11}),assembly:assembly({reservations:[box('touch-return',[4,7,10.5],[5,13,11.5])]})});assert.equal(r.status,'infeasible');close(r.maximumRaisedElevation,10.5);assert.equal(r.raisedLimiting.obstacle.id,'touch-return');assert.equal(r.raisedLimiting.region,'vertical-return');assert.ok(r.interfaceSegments.some(s=>s.obstacle.id==='touch-return'));
});
test('point contact at a plateau corner is also a closed interface constraint',()=>{
 const r=analyze({candidate:candidate({baseElevation:9,raisedElevation:11}),assembly:assembly({reservations:[box('corner-touch',[4,4,10.25],[5,5,11])]})});assert.equal(r.status,'infeasible');close(r.maximumRaisedElevation,10.25);assert.equal(r.raisedLimiting.obstacle.id,'corner-touch');
});
test('infeasible base cannot be repaired by raising only the center',()=>{
 const r=analyze({assembly:assembly({reservations:[box('low-outer',[1,4,9.5],[3,16,10])]})});assert.equal(r.status,'infeasible');assert.equal(r.candidate.usableVolume,null);assert.equal(r.maximumRecoverableVolume,null);assert.equal(r.baseLimiting.obstacle.id,'low-outer');
});
test('whole rectangle coverage rejects bridging a concave recess even with four inside corners',()=>{
 const boundary=xy([[0,0],[40,0],[40,20],[25,20],[25,8],[15,8],[15,20],[0,20]]),room=sourceRoom({boundary}),r=analyze({room,candidate:candidate({min:{x:5,y:5},max:{x:35,y:15},raisedElevation:10.5})});assert.equal(r.status,'unsupported');assert.match(r.diagnostics.at(-1).message,/whole raised rectangle/i);assert.equal(r.candidate,null);
});
test('all four boundaries require a positive wall band, and exact boundary contact is refused',()=>{
 for(const bounds of[{min:{x:0,y:5}},{max:{x:40,y:15}},{min:{x:5,y:0}},{max:{x:35,y:20}}]){const r=analyze({candidate:candidate(bounds)});assert.equal(r.status,'unsupported');assert.match(r.diagnostics.at(-1).message,/strictly inside/);}
});
test('a fully interior rectangle in a concave arm succeeds without bridging the empty notch',()=>{
 const boundary=xy([[0,0],[40,0],[40,20],[25,20],[25,8],[15,8],[15,20],[0,20]]),room=sourceRoom({boundary}),r=analyze({room,candidate:candidate({min:{x:3,y:3},max:{x:12,y:15},raisedElevation:10.5})});assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));close(r.area,680);close(r.plateauArea,108);close(r.candidate.requestedVolume,6854);
});
test('declared ceiling finish stays a vertical deduction and roof layers remain normal deductions',()=>{
 const r=analyze({room:sourceRoom({ceilingFinishThickness:.25}),candidate:candidate({baseElevation:9,raisedElevation:11}),assembly:assembly({layers:[{normalThickness:.5}]})});assert.equal(r.status,'infeasible');close(r.maximumRaisedElevation,35/3-.25-.5*Math.sqrt(10/9));close(r.assumptions.ceilingFinishThickness,.25);assert.equal(r.assumptions.verticalReturnMaterialVolume,null);assert.match(r.assumptions.verticalReturnGeometry,/zero-thickness/);
});
test('finished equality with the cap is allowed within physical tolerance',()=>{
 const r=analyze({candidate:candidate({raisedElevation:35/3})});assert.equal(r.status,'ok');close(r.candidate.usableVolume,8500);const tooHigh=analyze({candidate:candidate({raisedElevation:35/3+.01})});assert.equal(tooHigh.status,'infeasible');
});
test('base and raised finished elevations must meet the effective minimum independent of target',()=>{
 const r=analyze({room:sourceRoom({minClearHeight:9.5}),candidate:candidate({baseElevation:9,raisedElevation:11})});assert.equal(r.status,'infeasible');assert.equal(r.candidate.usableVolume,null);close(r.assumptions.minimumClearHeight,9.5);assert.equal(r.current.feasible,false);assert.equal(r.recoveryVolume,null);
});
test('floor crossing and nonpositive rises never produce a usable volume',()=>{
 assert.equal(analyze({candidate:candidate({baseElevation:-1,raisedElevation:1})}).status,'infeasible');for(const raisedElevation of[10,9]){const r=analyze({candidate:candidate({raisedElevation})});assert.equal(r.status,'unsupported');assert.equal(r.candidate,null);}
});
test('headroom is measured on actual stepped horizontal areas at each requested threshold',()=>{
 for(const [threshold,expected]of[[9,800],[10,800],[10.5,300],[11,300],[11.01,0]]){const r=analyze({room:sourceRoom({headroomThreshold:threshold})});assert.equal(r.status,'ok');close(r.candidate.headroomArea,expected);}const r=analyze({room:sourceRoom({headroomThreshold:9})});close(r.current.headroomArea,800);
});
test('recovery uses actual accepted tray rather than the stale flat base elevation',()=>{
 const room=sourceRoom({ceilingElevation:10,trayCeiling:candidate({min:{x:10,y:5},max:{x:30,y:15},raisedElevation:11})}),r=analyze({room});assert.equal(r.status,'ok');assert.equal(r.current.profileType,'tray');close(r.current.usableVolume,8200);close(r.recoveryVolume,100);close(r.maximumRecoverableVolume,300);close(r.volumeDifference,100);
});
test('a lower-volume proposal reports the signed difference and zero recovered volume',()=>{
 const room=sourceRoom({ceilingElevation:10,trayCeiling:candidate({raisedElevation:11.5})}),r=analyze({room});assert.equal(r.status,'ok');close(r.current.usableVolume,8450);close(r.volumeDifference,-150);close(r.recoveryVolume,0);
});
test('an infeasible actual ceiling does not turn geometric difference into recovered usable space',()=>{
 const r=analyze({room:sourceRoom({ceilingElevation:12})});assert.equal(r.status,'ok');assert.equal(r.current.feasible,false);assert.equal(r.current.usableVolume,null);assert.equal(r.volumeDifference,null);assert.equal(r.recoveryVolume,null);assert.equal(r.maximumRecoverableVolume,null);
});
test('missing assembly, incomplete coverage or foreign room identity refuse a usable declaration',()=>{
 const i=input();for(const analysis of[{...i.analysis,status:'unsupported'},{...i.analysis,declared:null},{...i.analysis,cells:[]},{...i.analysis,roomId:'other'},{...i.analysis,coverage:{...i.analysis.coverage,uncoveredArea:10}}]){const r=analyzeTrayCandidate({...i,analysis});assert.equal(r.status,'unsupported');assert.equal(r.candidate,null);assert.equal(r.recoveryVolume,null);}
});
test('invalid bounds, nonfinite elevations and malformed cap planes fail explicitly',()=>{
 for(const bad of[{min:{x:6,y:5},max:{x:5,y:15}}, {min:{x:NaN,y:5}}, {raisedElevation:Infinity},{baseElevation:'10'}])assert.equal(analyze({candidate:candidate(bad)}).status,'unsupported');const i=input();i.analysis.cells[0].ceilingPlane.z=NaN;assert.equal(analyzeTrayCandidate(i).status,'unsupported');
});
test('smaller work allowances and cell limits are enforced without sampled fallback',()=>{
 const i=input(),r=analyzeTrayCandidate({...i,workLimit:4});assert.equal(r.status,'unsupported');assert.match(r.diagnostics.at(-1).message,/budget/);assert.ok(r.budget.work<=4);assert.equal(analyzeTrayCandidate({...i,workLimit:0}).status,'unsupported');const tooMany={...i.analysis,cells:Array(TRAY_LIMITS.sourceCells+1).fill(i.analysis.cells[0])};assert.equal(analyzeTrayCandidate({...i,analysis:tooMany}).status,'unsupported');
});
test('inch, meter and millimeter assignments preserve physical tray areas and volumes',()=>{
 const base=analyze();for(const [modelUnits,k]of[['in',12],['m',.3048],['mm',304.8]]){const r=sourceRoom({boundary:rectangle.map(p=>({x:p.x*k,y:p.y*k})),anchor:{x:20*k,y:10*k},ceilingElevation:9*k,targetCeilingElevation:10*k,minClearHeight:8*k,headroomThreshold:10.5*k}),f=roof();for(const face of f.faces)for(const p of face.vertices){p.x*=k;p.y*=k;p.z*=k;}const result=analyze({room:r,roof:f,modelUnits,candidate:candidate({min:{x:5*k,y:5*k},max:{x:35*k,y:15*k},baseElevation:10*k,raisedElevation:11*k})});assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));close(result.area/k**2,base.area);close(result.candidate.usableVolume/k**3,base.candidate.usableVolume,1e-6);close(result.candidate.verticalReturnArea/k**2,base.candidate.verticalReturnArea);close(result.maximumRaisedElevation/k,base.maximumRaisedElevation);}
});
test('large XY and elevation translations retain analytical volume near a local origin',()=>{
 const shift=9e8,r=sourceRoom({boundary:rectangle.map(p=>({x:p.x+shift,y:p.y-shift})),floorElevation:shift,ceilingElevation:shift+9,targetCeilingElevation:shift+10}),f=roof();for(const face of f.faces)for(const p of face.vertices){p.x+=shift;p.y-=shift;p.z+=shift;}const result=analyze({room:r,roof:f,candidate:candidate({min:{x:shift+5,y:-shift+5},max:{x:shift+35,y:-shift+15},baseElevation:shift+10,raisedElevation:shift+11})});assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));close(result.area,800);close(result.candidate.usableVolume,8300);close(result.recoveryVolume,1100);close(result.maximumRaisedElevation-shift,35/3,1e-6);
});
test('deep-frozen source roof, room, analysis and candidate remain byte-identical with zero surcharges',()=>{
 const i=freeze(input()),before=JSON.stringify(i),r=analyzeTrayCandidate(i);assert.equal(r.status,'ok');assert.equal(JSON.stringify(i),before);assert.equal(r.assumptions.prefabricatedTrussDesignSurcharge,0);assert.equal(r.assumptions.manufacturingComplexitySurcharge,0);assert.equal(r.verified,null);assert.equal(r.framingVerification,'unverified');assert.equal(r.assumptions.roofUnchanged,true);assert.equal(r.assumptions.bearingUnchanged,true);
});
test('exact section produces outer bands, plateau and two vertical finished returns',()=>{
 const s=buildTrayProfileSection({room:sourceRoom(),candidate:candidate(),axis:'x',coordinate:10});assert.equal(s.status,'ok');assert.deepEqual(s.occupiedIntervals,[[0,40]]);assert.deepEqual(s.segments.map(x=>x.kind),['outer-band','vertical-return','plateau','vertical-return','outer-band']);assert.deepEqual(s.segments[2].start,{x:5,y:10,z:11});assert.deepEqual(s.segments[2].end,{x:35,y:10,z:11});close(s.segments[1].start.z,10);close(s.segments[1].end.z,11);
});
test('orthogonal or outside-plateau sections retain actual base height',()=>{
 const y=buildTrayProfileSection({room:sourceRoom(),candidate:candidate(),axis:'y',coordinate:20});assert.equal(y.status,'ok');assert.equal(y.segments.filter(x=>x.kind==='plateau').length,1);assert.deepEqual(y.segments[2].start,{x:20,y:5,z:11});const base=buildTrayProfileSection({room:sourceRoom(),candidate:candidate(),axis:'x',coordinate:2});assert.equal(base.status,'ok');assert.equal(base.segments.length,1);close(base.segments[0].start.z,10);
});
test('concave section preserves distinct room intervals and never bridges a notch',()=>{
 const boundary=xy([[0,0],[40,0],[40,20],[25,20],[25,8],[15,8],[15,20],[0,20]]),s=buildTrayProfileSection({room:sourceRoom({boundary}),candidate:candidate({min:{x:3,y:3},max:{x:12,y:15},raisedElevation:10.5}),axis:'x',coordinate:10});assert.equal(s.status,'ok');assert.deepEqual(s.occupiedIntervals,[[0,15],[25,40]]);assert.ok(s.segments.every(x=>x.to<=15||x.from>=25));assert.equal(buildTrayProfileSection({room:sourceRoom(),candidate:candidate(),coordinate:100}).status,'unsupported');
});
