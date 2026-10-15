import test from 'node:test';
import assert from 'node:assert/strict';
import {solveHipRoof} from '../architecture/roof-hip.mjs';
import {analyzeRoomSpace,evaluateClearanceCell,CLEARANCE_LIMITS} from '../architecture/clearance.mjs';
import {buildRoomSection} from '../architecture/sections.mjs';
const xy=a=>a.map(([x,y])=>({x,y}));
const rectangle=xy([[0,0],[40,0],[40,20],[0,20]]);
const H=xy([[0,0],[20,0],[20,16],[44,16],[44,0],[64,0],[64,60],[44,60],[44,44],[20,44],[20,60],[0,60]]);
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const room=(boundary=rectangle,extra={})=>({id:'room-1',label:'Study',anchor:{x:20,y:10},boundary,floorElevation:0,ceilingElevation:9,targetCeilingElevation:10,ceilingType:'flat',ceilingFinishThickness:0,minClearHeight:8,headroomThreshold:9,...extra});
const roof=(boundary=rectangle,extra={})=>({id:'roof-1',...solveHipRoof({boundary,riseTwice:8,eaveOverhang:0,eaveSurfaceElevation:10,...extra})});
const assembly=(extra={})=>({id:'assembly-1',name:'Declared geometry',layers:[],reservations:[],framingVerification:'unverified',...extra});
const analyze=(extra={})=>analyzeRoomSpace({room:room(),roof:roof(),assembly:assembly(),modelUnits:'ft',...extra});
const box=(id,min,max)=>({id,kind:'service',min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]},description:'Declared service box'});
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};

test('R3 rectangle: analytical skin volume, current/target and max flat heights',()=>{
 const r=analyze();assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));close(r.area,800);close(r.coverage.coveredArea,800);close(r.coverage.uncoveredArea,0);close(r.maximumFlat.elevation,10);close(r.roofPotential.volumeAboveFloor,8000+10000/9);close(r.declared.volumeAboveFloor,8000+10000/9);close(r.current.requestedVolume,7200);close(r.current.usableVolume,7200);close(r.target.usableVolume,8000);assert.equal(r.current.feasible,true);assert.equal(r.target.feasible,true);close(r.recoveryVolume,800);assert.equal(r.verified,null);assert.equal(r.framingVerification,'unverified');
});
test('normal roof thickness and vertical ceiling finish are separate deductions',()=>{
 const r=analyze({room:room(rectangle,{ceilingFinishThickness:.25}),assembly:assembly({layers:[{name:'Deck',normalThickness:.2},{name:'Structure reservation',normalThickness:.3}]})}),drop=.5*Math.sqrt(10/9)+.25;assert.equal(r.status,'ok');close(r.maximumFlat.elevation,10-drop);close(r.declared.volumeAboveFloor,8000+10000/9-800*drop);close(r.roofPotential.maxFlatCeilingElevation,10);close(r.roofPotential.volumeAboveFloor,8000+10000/9);assert.equal(r.target.feasible,false);assert.equal(r.current.feasible,true);close(r.assumptions.roofNormalThickness,.5);close(r.assumptions.ceilingFinishThickness,.25);
});
test('room/roof intersection creates the true limiting points, not original roof vertices',()=>{
 const boundary=xy([[5,3],[35,3],[35,17],[5,17]]),r=analyze({room:room(boundary,{targetCeilingElevation:12,headroomThreshold:12})});assert.equal(r.status,'ok');close(r.area,420);close(r.maximumFlat.elevation,11);close(r.declared.volumeAboveFloor,5082.222222222223);assert.equal(r.target.feasible,false);close(r.headroom.area,224);assert.ok(r.limiting.point.x>=5&&r.limiting.point.x<=35);close(r.limiting.point.z,11);assert.ok(!roof().faces.flatMap(f=>f.vertices).some(p=>Math.hypot(p.x-r.limiting.point.x,p.y-r.limiting.point.y)<1e-7));
});
test('H concavity: analytical eroded-area volume and threshold area',()=>{
 const r=analyze({room:room(H,{headroomThreshold:12}),roof:roof(H)});assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));close(r.area,3072);close(r.maximumFlat.elevation,10);close(r.declared.volumeAboveFloor,36424.88888888889);close(r.headroom.area,1344);close(r.current.usableVolume,27648);assert.ok(r.cells.length>12);
});
test('partial reservation clips exactly and caps the whole-room flat ceiling',()=>{
 const r=analyze({room:room(rectangle,{targetCeilingElevation:8}),assembly:assembly({reservations:[box('duct',[8,5,8],[12,15,9])]})});assert.equal(r.status,'ok');close(r.maximumFlat.elevation,8);assert.equal(r.current.feasible,false);assert.equal(r.target.feasible,true);assert.equal(r.current.usableVolume,null);close(r.current.clippedEnvelopeVolume,7160);close(r.target.usableVolume,6400);close(r.headroom.area,760);assert.equal(r.limiting.obstacle.kind,'reservation');assert.equal(r.limiting.obstacle.id,'duct');close(r.coverage.coveredArea,800);
});
test('overlapping equal-bottom reservation boxes do not double count cells or volumes',()=>{
 const r=analyze({assembly:assembly({reservations:[box('a',[8,5,8],[12,15,9]),box('b',[10,5,8],[14,15,9])]})});assert.equal(r.status,'ok');assert.equal(r.current.usableVolume,null);close(r.current.clippedEnvelopeVolume,7140);close(r.headroom.area,740);close(r.maximumFlat.elevation,8);close(r.cells.reduce((sum,c)=>sum+Math.abs(c.polygon.reduce((s,p,i)=>{const q=c.polygon[(i+1)%c.polygon.length];return s+p.x*q.y-q.x*p.y;},0))/2,0),800);
});
test('reservations wholly below floor, above roof, or outside the room do not constrain',()=>{
 const r=analyze({assembly:assembly({reservations:[box('below',[8,5,-2],[12,15,-1]),box('above',[8,5,30],[12,15,31]),box('outside',[50,50,1],[60,60,2])]})});assert.equal(r.status,'ok');close(r.maximumFlat.elevation,10);close(r.declared.volumeAboveFloor,8000+10000/9);assert.equal(r.assumptions.ignoredBelowFloor,1);assert.equal(r.assumptions.constrainingReservations,0);
});
test('reservation crossing the floor is conservatively infeasible and never negative volume',()=>{
 const r=analyze({assembly:assembly({reservations:[box('floor-conflict',[8,5,-1],[12,15,2])]})});assert.equal(r.status,'infeasible');close(r.maximumFlat.elevation,-1);assert.equal(r.maximumFlat.feasible,false);assert.equal(r.current.feasible,false);assert.equal(r.current.usableVolume,null);close(r.current.clippedEnvelopeVolume,6840);assert.ok(r.declared.volumeAboveFloor>0);assert.equal(r.maximumFlat.volume,null);close(r.maximumFlat.geometricVolume,0);assert.ok(r.diagnostics.some(d=>d.code==='CLEARANCE_INFEASIBLE'));
});
test('reservation floor cap also allows for vertical ceiling finish',()=>{
 const r=analyze({room:room(rectangle,{minClearHeight:7,ceilingFinishThickness:.5}),assembly:assembly({reservations:[box('chord',[8,5,8],[12,15,9])]})});assert.equal(r.status,'ok');close(r.maximumFlat.elevation,7.5);assert.equal(r.current.usableVolume,null);close(r.current.clippedEnvelopeVolume,7140);close(r.assumptions.ceilingFinishThickness,.5);
});
test('missing assembly returns roof potential but no declaration of usable space',()=>{
 const r=analyze({assembly:null});assert.equal(r.status,'unsupported');close(r.roofPotential.volumeAboveFloor,8000+10000/9);assert.equal(r.declared,null);assert.equal(r.maximumFlat,null);assert.equal(r.current,null);assert.equal(r.recoveryVolume,null);assert.deepEqual(r.cells,[]);assert.ok(r.diagnostics.some(d=>d.code==='ASSEMBLY_REQUIRED'));
});
test('incomplete or overlapping coverage refuses usable metrics',()=>{
 const incomplete=analyze({room:room(xy([[-1,0],[40,0],[40,20],[-1,20]]))});assert.equal(incomplete.status,'unsupported');assert.ok(incomplete.coverage.uncoveredArea>0);assert.equal(incomplete.declared,null);const duplicate=roof();duplicate.faces.push(structuredClone(duplicate.faces[0]));const overlapping=analyze({roof:duplicate});assert.equal(overlapping.status,'unsupported');assert.ok(overlapping.coverage.overlapArea>0);assert.equal(overlapping.maximumFlat,null);
});
test('invalid roof and room polygons fail explicitly without partial declarations',()=>{
 const invalid=roof();invalid.faces[0].vertices[0].z+=1;assert.equal(analyze({roof:invalid}).status,'unsupported');const crossing=room(xy([[0,0],[40,20],[0,20],[40,0]]));assert.equal(analyze({room:crossing}).status,'unsupported');assert.equal(analyze({modelUnits:'unitless'}).status,'unsupported');assert.equal(analyze({room:room(rectangle,{ceilingType:'vaulted'})}).status,'unsupported');
});
test('minimum clear height is independent from target and existing ceiling feasibility',()=>{
 const r=analyze({room:room(rectangle,{minClearHeight:10.25})});assert.equal(r.status,'infeasible');assert.equal(r.current.feasible,false);assert.equal(r.target.feasible,false);close(r.maximumFlat.clearHeight,10);close(r.current.clearHeight,9);assert.equal(r.recoveryVolume,null);close(r.geometricFlatDifference,800);
});
test('inch, mm, cm and meter unit assignments preserve physical analysis',()=>{
 const base=analyze();for(const [modelUnits,k]of[['in',12],['mm',304.8],['cm',30.48],['m',.3048]]){const boundary=rectangle.map(p=>({x:p.x*k,y:p.y*k})),r=analyze({modelUnits,room:room(boundary,{anchor:{x:20*k,y:10*k},ceilingElevation:9*k,targetCeilingElevation:10*k,minClearHeight:8*k,headroomThreshold:9*k}),roof:roof(boundary,{eaveSurfaceElevation:10*k})});assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));close(r.area/(k*k),base.area);close(r.maximumFlat.elevation/k,base.maximumFlat.elevation);close(r.declared.volumeAboveFloor/(k*k*k),base.declared.volumeAboveFloor,1e-6);close(r.recoveryVolume/(k*k*k),base.recoveryVolume,1e-6);}
});
test('large XY/elevation translations are evaluated near a local origin',()=>{
 const shift=9e8,boundary=rectangle.map(p=>({x:p.x+shift,y:p.y-shift})),fixedRoof=roof();for(const f of fixedRoof.faces)for(const p of f.vertices){p.x+=shift;p.y-=shift;p.z+=shift;}const r=analyze({room:room(boundary,{anchor:{x:20+shift,y:10-shift},floorElevation:shift,ceilingElevation:shift+9,targetCeilingElevation:shift+10}),roof:fixedRoof});assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));close(r.area,800);close(r.maximumFlat.elevation-shift,10);close(r.declared.volumeAboveFloor,8000+10000/9,1e-4);close(r.current.usableVolume,7200,1e-4);
});
test('deep-frozen source roof, room, assembly and zero-surcharge assumptions remain unchanged',()=>{
 const input=freeze({room:room(),roof:roof(),assembly:assembly({layers:[{name:'Deck',normalThickness:.1}],reservations:[box('a',[8,5,8],[12,15,9])]}),modelUnits:'ft'}),before=JSON.stringify(input),r=analyzeRoomSpace(input);assert.equal(r.status,'ok');assert.equal(JSON.stringify(input),before);assert.equal(r.assumptions.prefabricatedTrussDesignSurcharge,0);assert.equal(r.assumptions.manufacturingComplexitySurcharge,0);assert.equal(r.verified,null);
});
test('section follows exact roof/facet events and reservation steps with dimensions',()=>{
 const sourceRoom=room(),r=analyze({room:sourceRoom,assembly:assembly({reservations:[box('duct',[8,5,8],[12,15,9])]})}),s=buildRoomSection({analysis:r,room:sourceRoom,axis:'x',coordinate:10});assert.equal(s.status,'ok');close(s.length,40);assert.ok(s.segments.some(x=>x.obstacle.id==='duct'&&Math.abs(x.start.z-8)<1e-7));assert.ok(s.roofSegments.some(x=>Math.abs(x.start.z-40/3)<1e-7||Math.abs(x.end.z-40/3)<1e-7));close(s.dimensions.maximumFlatCeilingElevation,8);close(s.dimensions.currentCeilingElevation,9);assert.equal(s.labels.length,5);assert.equal(s.framingVerification,'unverified');for(const c of r.cells)for(const p of c.polygon)assert.ok(Number.isFinite(evaluateClearanceCell(c,p)));
});
test('concave section preserves disjoint room intervals rather than bridging a notch',()=>{
 const sourceRoom=room(H,{anchor:{x:10,y:10}}),r=analyze({room:sourceRoom,roof:roof(H)}),s=buildRoomSection({analysis:r,room:sourceRoom,axis:'x',coordinate:10});assert.equal(s.status,'ok');assert.deepEqual(s.occupiedIntervals,[[0,20],[44,64]]);assert.equal(s.profileSegments.floor.length,2);assert.ok(s.segments.every(x=>x.to<=20+1e-8||x.from>=44-1e-8));assert.equal(buildRoomSection({analysis:r,room:sourceRoom,axis:'x',coordinate:100}).status,'unsupported');
});
test('unsupported complexity is bounded rather than silently sampled',()=>{
 const r=analyze({assembly:assembly({reservations:Array.from({length:CLEARANCE_LIMITS.reservations+1},(_,i)=>box(`box-${i}`,[1,1,8],[2,2,9]))})});assert.equal(r.status,'unsupported');assert.equal(r.declared,null);assert.ok(r.diagnostics.some(d=>d.message.includes('bounds')));
});
test('a document can impose a smaller exact per-room work allowance',()=>{
 const r=analyze({workLimit:5});assert.equal(r.status,'unsupported');assert.equal(r.declared,null);assert.equal(r.budget.work,5);assert.match(r.diagnostics[0].message,/work budget/);const none=analyze({workLimit:0});assert.equal(none.status,'unsupported');assert.equal(none.budget.work,0);
});
