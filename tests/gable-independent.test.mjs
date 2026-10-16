// Analytical checks written independently of the roof-front construction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {solveGableRoof,inferGableCandidates,validateGableRoof} from '../architecture/roof-gable.mjs';
import {analyzeRoomSpace} from '../architecture/clearance.mjs';
const rect=[{x:0,y:0},{x:40,y:0},{x:40,y:20},{x:0,y:20}];
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const infer=(boundary=rect)=>inferGableCandidates(boundary);
function input(direction='X',extra={}){const boundary=extra.boundary??rect,option=infer(boundary).alternatives.find(x=>x.ridgeDirection===direction);assert.ok(option,'independent fixture needs confirmed direction');return{boundary,riseTwice:8,eaveOverhang:0,rakeOverhang:0,eaveSurfaceElevation:10,bearingElevation:10,gablePolicy:'ALL_GABLE',gableAssignments:option.edgeKeys,...extra};}
const solve=(direction,extra)=>{const r=solveGableRoof(input(direction,extra));assert.equal(r.status,'ok',JSON.stringify(r.diagnostics));return r;};
const zAt=(r,p)=>{const cell=r.faces.find(f=>{const q=f.vertices;let inside=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[i],b=q[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;});assert.ok(cell,'probe inside roof');return-(cell.plane.a*p.x+cell.plane.b*p.y+cell.plane.d)/cell.plane.c;};
test('both rectangle directions match the independent two-plane height formula throughout the room',()=>{
 for(const direction of['X','Y']){const r=solve(direction);assert.equal(r.faces.length,2);assert.equal(r.edges.filter(e=>e.kind==='ridge').length,1);assert.ok(!r.edges.some(e=>e.kind==='hip'));for(const x of[1,7,13,27,39])for(const y of[1,3,8,12,19])close(zAt(r,{x,y}),10+Math.min(...(direction==='X'?[y,20-y]:[x,40-x]))/3);close(r.quantities.maxRoofElevation,10+(direction==='X'?10:20)/3);}
});
test('rectangle quantities separate sloping roof area, source closure area, eaves and rakes',()=>{
 for(const direction of['X','Y']){const r=solve(direction),span=direction==='X'?20:40,length=direction==='X'?40:20;close(r.quantities.projectedArea,800);close(r.quantities.roofSurfaceArea,800*Math.sqrt(10/9));close(r.quantities.gableClosureArea,span*span/6);close(r.quantities.eaveLength,2*length);close(r.quantities.rakeLength,2*span*Math.sqrt(10/9));assert.ok(r.gableClosures.every(c=>c.thickness===0));close(r.gableClosures.reduce((s,c)=>s+c.area,0),span*span/6);}
});
test('rake extension changes roof coverage but does not lower the source gable or move its closure',()=>{
 const r=solve('X',{eaveOverhang:2,rakeOverhang:3,eaveSurfaceElevation:10-2/3}),xs=r.eaveBoundary.map(p=>p.x),ys=r.eaveBoundary.map(p=>p.y);close(Math.min(...xs),-3);close(Math.max(...xs),43);close(Math.min(...ys),-2);close(Math.max(...ys),22);close(r.quantities.projectedArea,46*24);close(r.quantities.maxRoofElevation,40/3);close(r.quantities.gableClosureArea,200/3);close(r.quantities.eaveLength,92);close(r.quantities.rakeLength,48*Math.sqrt(10/9));for(const c of r.gableClosures)assert.ok(c.vertices.every(p=>p.x===0||p.x===40));for(const p of[{x:1,y:1},{x:20,y:7},{x:39,y:19}])close(zAt(r,p),10+Math.min(p.y,20-p.y)/3);
});
test('roof-only room volume uses sloping facets and excludes vertical gable closures',()=>{
 for(const direction of['X','Y']){const roof=solve(direction),room={id:'room',boundary:rect,floorElevation:0,ceilingElevation:8,targetCeilingElevation:9,ceilingType:'flat'},a=analyzeRoomSpace({room,roof:{id:'roof',...roof},modelUnits:'ft'}),span=direction==='X'?20:40,length=direction==='X'?40:20;assert.equal(a.status,'ok');close(a.current.usableVolume,6400);close(a.maxFlatCeilingElevation,10);close(a.declared.volumeAboveFloor,8000+length*span*span/12);assert.equal(a.assumptions.roofNormalThickness,0);}
});
test('eave and rake overhang leave the roof plane and mathematical interior volume unchanged',()=>{
 const room={id:'room',boundary:rect,floorElevation:0,ceilingElevation:8,targetCeilingElevation:9,ceilingType:'flat'};for(const overhang of[0,1,3]){const roof=solve('X',{eaveOverhang:overhang,rakeOverhang:5,eaveSurfaceElevation:10-overhang/3}),a=analyzeRoomSpace({room,roof:{id:'r',...roof},modelUnits:'ft'});assert.equal(a.status,'ok');close(a.declared.volumeAboveFloor,28000/3);close(a.maxFlatCeilingElevation,10);}
});
test('candidate geometric identities survive cyclic starts and reversed winding',()=>{
 const expected=infer().alternatives.map(x=>[...x.edgeKeys].sort().join(';')).sort();for(let offset=0;offset<4;offset++)for(const reverse of[false,true]){let boundary=[...rect.slice(offset),...rect.slice(0,offset)];if(reverse)boundary.reverse();assert.deepEqual(infer(boundary).alternatives.map(x=>[...x.edgeKeys].sort().join(';')).sort(),expected);const r=solve('X',{boundary});close(r.quantities.projectedArea,800);close(r.quantities.maxRoofElevation,40/3);}
});
test('old assignment keys never silently attach to an edited footprint',()=>{
 const i=input(),changed=rect.map(p=>({x:p.x*2,y:p.y})),r=solveGableRoof({...i,boundary:changed});assert.equal(r.status,'needs-decision');assert.deepEqual(r.faces,[]);assert.deepEqual(r.gableClosures,[]);assert.equal(r.quantities,null);
});
test('ALL_GABLE cannot return a partial hip fallback for one selected end',()=>{
 const i=input(),r=solveGableRoof({...i,gableAssignments:[i.gableAssignments[0]]});assert.notEqual(r.status,'ok');assert.deepEqual(r.faces,[]);assert.equal(r.quantities,null);assert.match(r.diagnostics.join(' '),/ALL_GABLE|candidate|hip/i);
});
test('independent supplied-skin validation refuses a displaced roof facet',()=>{
 const r=solve('X'),faces=structuredClone(r.faces);faces[0].vertices[0].z+=.1;const v=validateGableRoof({faces,eaveBoundary:r.eaveBoundary,pitch:1/3,eaveSurfaceElevation:10,gableBoundary:r.gableBoundary});assert.notEqual(v.geometry,'valid');
});
test('closed and immutable mathematical inputs keep zero surcharge and their exact source',()=>{
 const i=input(),before=JSON.stringify(i),freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};freeze(i);const r=solveGableRoof(i);assert.equal(r.status,'ok');assert.equal(JSON.stringify(i),before);assert.equal(r.quantities.trussDesignManufacturingComplexitySurcharge,0);assert.equal(r.validation.structural,'unverified');
});
