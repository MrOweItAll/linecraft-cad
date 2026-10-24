import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {solveHipRoof,validateHipRoof,HIP_KERNEL_VERSION} from '../architecture/roof-hip.mjs';
import {deriveEaveBoundary} from '../architecture/roof-boundary.mjs';
const xy=points=>points.map(([x,y])=>({x,y}));
const rectangle=xy([[0,0],[40,0],[40,20],[0,20]]);
const L=xy([[0,0],[40,0],[40,16],[16,16],[16,40],[0,40]]);
const T=xy([[0,0],[60,0],[60,20],[40,20],[40,60],[20,60],[20,20],[0,20]]);
const H=depth=>xy([[0,0],[20,0],[20,30-depth/2],[44,30-depth/2],[44,0],[64,0],[64,60],[44,60],[44,30+depth/2],[20,30+depth/2],[20,60],[0,60]]);
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const area=loop=>{if(!loop.length)return 0;const o=loop[0];return Math.abs(loop.reduce((s,a,i)=>{const b=loop[(i+1)%loop.length];return s+(a.x-o.x)*(b.y-o.y)-(b.x-o.x)*(a.y-o.y);},0)/2);};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const same=(a,b,tol=1e-7)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0))<=tol;
const solve=(boundary,extra={})=>solveHipRoof({boundary,riseTwice:8,eaveOverhang:0,eaveSurfaceElevation:9,...extra});
// Independent ear clipping and triangle intersections certify complete, disjoint
// coverage, rather than accepting the solver's own area/validation assertions.
function triangulate(poly){
  const remaining=poly.map((_,i)=>i),out=[];
  const inside=(p,a,b,c)=>cross(a,b,p)>=-1e-9&&cross(b,c,p)>=-1e-9&&cross(c,a,p)>=-1e-9;
  while(remaining.length>3){let removed=false;for(let i=0;i<remaining.length;i++){
    const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];if(cross(poly[a],poly[b],poly[c])<=1e-9)continue;
    if(remaining.some(k=>![a,b,c].includes(k)&&inside(poly[k],poly[a],poly[b],poly[c])))continue;
    out.push([poly[a],poly[b],poly[c]]);remaining.splice(i,1);removed=true;break;
  }assert.ok(removed,'independent triangulation found a malformed polygon');}out.push(remaining.map(i=>poly[i]));return out;
}
function intersection(subject,clip){let out=subject;for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q);if(dp>=-1e-9)out.push(p);if((dp>1e-9&&dq<-1e-9)||(dp<-1e-9&&dq>1e-9)){const t=dp/(dp-dq);out.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)});}}}return out;}
function certify(result){
  assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));assert.equal(result.validation.geometry,'valid');assert.equal(result.validation.drainage,'valid');
  const domain=triangulate(result.eaveBoundary),triangles=result.faces.flatMap(f=>triangulate(f.vertices));let sum=0;
  for(const triangle of triangles){const a=area(triangle);assert.ok(a>1e-9);sum+=a;close(domain.reduce((s,t)=>s+area(intersection(triangle,t)),0),a,1e-6);}
  close(sum,area(result.eaveBoundary),1e-6);
  for(let i=0;i<triangles.length;i++)for(let j=0;j<i;j++)assert.ok(area(intersection(triangles[i],triangles[j]))<1e-6,'positive-area roof overlap');
  for(const face of result.faces){let nx=0,ny=0,nz=0;for(let i=0;i<face.vertices.length;i++){const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length];nx+=(a.y-b.y)*(a.z+b.z);ny+=(a.z-b.z)*(a.x+b.x);nz+=(a.x-b.x)*(a.y+b.y);}const sloped=Math.hypot(nx,ny,nz)/2;close(sloped,area(face.vertices)*Math.sqrt(1+face.plane.a**2+face.plane.b**2),1e-6);for(const p of face.vertices)close(face.plane.a*p.x+face.plane.b*p.y+face.plane.c*p.z+face.plane.d,0);}
  for(const edge of result.edges){assert.equal(edge.faceIds.length,edge.kind==='eave'?1:2);if(edge.kind==='valley')assert.ok(Math.abs(edge.a.z-edge.b.z)>1e-8,'collecting valley has no fall');if(edge.kind==='hip'||edge.kind==='valley'){close(Math.abs(edge.b.x-edge.a.x),Math.abs(edge.b.y-edge.a.y));}}
  assert.equal(result.quantities.trussDesignManufacturingComplexitySurcharge,0);assert.equal(result.quantities.framingLumber,null);assert.equal(result.validation.structural,'unverified');assert.equal(result.validation.clearance,'not-analyzed');
}
test('rectangle: exact ridge, four faces and independent coverage',()=>{const r=solve(rectangle);certify(r);assert.equal(r.faces.length,4);const ridge=r.edges.filter(e=>e.kind==='ridge');assert.equal(ridge.length,1);assert.ok([ridge[0].a,ridge[0].b].some(p=>same(p,{x:10,y:10,z:9+10/3})));assert.ok([ridge[0].a,ridge[0].b].some(p=>same(p,{x:30,y:10,z:9+10/3})));close(r.quantities.projectedArea,800);});
test('concave L and T: independent exact coverage, adjacency, pitch and runoff',()=>{for(const boundary of[L,T])certify(solve(boundary));});
test('analytic H packet: all 22 nodes, 21 feature segments, 12 facets and quantities',()=>{
  const r=solve(H(28),{eaveOverhang:2,eaveSurfaceElevation:28/3});certify(r);
  const eave=xy([[-2,-2],[22,-2],[22,14],[42,14],[42,-2],[66,-2],[66,62],[42,62],[42,46],[22,46],[22,62],[-2,62]]);assert.deepEqual(r.eaveBoundary,eave);
  const expected={};eave.forEach((p,i)=>expected[`E${i}`]={...p,z:28/3});
  for(const [key,x,y,z]of[['A1',10,10,40/3],['A2',10,50,40/3],['A3',54,10,40/3],['A4',54,50,40/3],['B1',10,26,40/3],['B2',10,34,40/3],['B3',54,26,40/3],['B4',54,34,40/3],['C1',14,30,44/3],['C2',50,30,44/3]])expected[key]={x,y,z};
  const features=[['E0','A1','hip'],['E1','A1','hip'],['E11','A2','hip'],['E10','A2','hip'],['E4','A3','hip'],['E5','A3','hip'],['E7','A4','hip'],['E6','A4','hip'],['E2','B1','valley'],['E9','B2','valley'],['E3','B3','valley'],['E8','B4','valley'],['B1','C1','hip'],['B2','C1','hip'],['B3','C2','hip'],['B4','C2','hip'],['A1','B1','ridge'],['B2','A2','ridge'],['A3','B3','ridge'],['B4','A4','ridge'],['C1','C2','ridge']];
  const actual=r.edges.filter(e=>!['eave','coplanar'].includes(e.kind));assert.equal(actual.length,features.length);for(const [a,b,kind]of features)assert.ok(actual.some(e=>e.kind===kind&&(same(e.a,expected[a])&&same(e.b,expected[b])||same(e.b,expected[a])&&same(e.a,expected[b]))),`${a}-${b} ${kind}`);
  const vertices=r.faces.flatMap(f=>f.vertices);for(const [id,p]of Object.entries(expected))assert.ok(vertices.some(v=>same(v,p)),id);
  close(area(H(28)),3072);close(r.quantities.projectedArea,3712);close(r.quantities.roofSurfaceArea,3912.7915581816774);close(r.quantities.maxRoofElevation,44/3);assert.equal(r.faces.length,12);
  assert.equal(r.edges.filter(e=>e.subtype==='outer_hip').length,8);assert.equal(r.edges.filter(e=>e.subtype==='rising_hip').length,4);assert.equal(r.edges.filter(e=>e.kind==='valley').length,4);
  const ridgeLengths=r.edges.filter(e=>e.kind==='ridge').map(e=>Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)).sort((a,b)=>a-b);assert.deepEqual(ridgeLengths,[16,16,16,16,36]);
  assert.ok(r.events.some(e=>e.types.includes('split')&&e.simultaneousContactCount>=4));assert.ok(r.events.every(e=>e.batched));
});
test('H connector shallower, equal and deeper than wings changes topology naturally',()=>{
  const counts=[],events=[];for(const depth of[12,20,28]){const r=solve(H(depth),{eaveSurfaceElevation:0});certify(r);close(r.quantities.maxRoofElevation,Math.max(10,depth/2)/3);counts.push(r.edges.filter(e=>e.subtype==='rising_hip').length);events.push(r.events.length);}
  assert.equal(counts[1],0);assert.ok(counts[2]>0);assert.deepEqual(events,[2,1,2]);
});
test('all 23 allowed half-rise settings satisfy exact plane slopes and roof area invariant',()=>{for(let riseTwice=2;riseTwice<=24;riseTwice++){const r=solve(L,{riseTwice});certify(r);for(const f of r.faces)close(Math.hypot(f.plane.a,f.plane.b),riseTwice/24);close(r.quantities.roofSurfaceArea,area(L)*Math.sqrt(1+(riseTwice/24)**2));}});
test('inch, foot, mm, m scale transforms preserve all physical generated vertices',()=>{const base=solve(H(28),{eaveOverhang:2,eaveSurfaceElevation:28/3});for(const k of[12,304.8,.3048]){const r=solve(H(28).map(p=>({x:p.x*k,y:p.y*k})),{eaveOverhang:2*k,eaveSurfaceElevation:28/3*k});certify(r);close(r.quantities.roofSurfaceArea/(k*k),base.quantities.roofSurfaceArea);for(const face of base.faces){const other=r.faces.find(f=>f.id===face.id);for(const p of face.vertices)assert.ok(other.vertices.some(q=>same(p,{x:q.x/k,y:q.y/k,z:q.z/k})));}}});
test('translation, clockwise input and 90-degree local rotation preserve roof shape',()=>{
  const base=solve(L);for(const transform of[p=>({x:p.x+12345,y:p.y-5678}),p=>({x:-p.y,y:p.x})]){const r=solve(L.map(transform));certify(r);close(r.quantities.projectedArea,base.quantities.projectedArea);for(const p of base.faces.flatMap(f=>f.vertices))assert.ok(r.faces.flatMap(f=>f.vertices).some(q=>same(q,{...transform(p),z:p.z})));}certify(solve([...L].reverse()));
});
test('small roofs retain physical area at large supported survey coordinates',()=>{
  for(const shift of[1e7,1e8,9e8]){const boundary=xy([[0,0],[1,0],[1,1],[0,1]]).map(p=>({x:p.x+shift,y:p.y+shift})),r=solve(boundary);certify(r);close(r.quantities.projectedArea,1);close(r.quantities.maxRoofElevation,9+1/6);assert.deepEqual(r.eaveBoundary,boundary);}
});
test('split swept faces touching at event points remain valid across cyclic provenance order',()=>{
  const loops=[[[0,-9.3],[-13.7,-9.3],[-13.7,-18.6],[13.7,-18.6],[13.7,-9.3],[27.4,-9.3],[27.4,0],[41.099999999999994,0],[41.099999999999994,9.3],[27.4,9.3],[27.4,18.6],[0,18.6]],[[13.7,-9.3],[13.7,0],[27.4,0],[27.4,9.3],[13.7,9.3],[13.7,18.6],[0,18.6],[0,27.900000000000002],[-13.7,27.900000000000002],[-13.7,9.3],[-27.4,9.3],[-27.4,0],[-13.7,0],[-13.7,-9.3]]].map(xy);
  for(const loop of loops)for(let i=0;i<loop.length;i++){const boundary=[...loop.slice(i),...loop.slice(0,i)],before=JSON.stringify(boundary),r=solve(boundary);certify(r);close(r.quantities.projectedArea,area(loop));assert.equal(JSON.stringify(boundary),before);}
});
test('symmetric simultaneous events are deterministic with no zero-area facets',()=>{const a=solve(H(20));for(let i=0;i<3;i++)assert.deepEqual(solve(H(20)),a);assert.ok(a.events.some(e=>e.simultaneousContactCount>=4));certify(solve(xy([[0,0],[20,0],[20,20],[0,20]])));assert.equal(HIP_KERNEL_VERSION,a.kernelVersion);});
test('overhang never silently closes an open recess',()=>{const n=xy([[0,0],[10,0],[10,8],[14,8],[14,0],[24,0],[24,20],[0,20]]);assert.equal(deriveEaveBoundary(n,1).status,'ok');assert.equal(deriveEaveBoundary(n,2).status,'needs-decision');assert.equal(solve(n,{eaveOverhang:3}).status,'needs-decision');});
test('invalid, nonorthogonal, holes and overbudget input return explicit diagnostics',()=>{
  for(const input of[{riseTwice:1},{riseTwice:8.5},{riseTwice:25},{eaveSurfaceElevation:NaN},{boundary:xy([[0,0],[10,1],[10,10],[0,10]])},{boundary:xy([[0,0],[10,0],[10,0],[0,10]])},{holes:[rectangle]},{boundary:xy([[0,0],[10,0],[10,10],[5,10],[5,-5],[0,-5]])},{eaveOverhang:-1}]){const r=solve(rectangle,input);assert.notEqual(r.status,'ok');assert.ok(r.diagnostics.length);assert.equal(r.faces.length,0);}
});
test('runtime validator proves every positive-area flow band, including coplanar transitions',()=>{
  for(const boundary of[rectangle,L,T,H(12),H(20),H(28)]){const r=solve(boundary),v=validateHipRoof({faces:r.faces,eaveBoundary:r.eaveBoundary,pitch:1/3,eaveSurfaceElevation:9});assert.equal(v.geometry,'valid',v.diagnostics.join('; '));assert.equal(v.drainage,'valid',v.diagnostics.join('; '));assert.ok(v.catchmentCells>=r.faces.length);assert.ok(v.outsideArea<1e-7);assert.ok(v.overlapArea<1e-7);}
});
test('runtime drainage rejects a true interior basin and a zero-fall collecting gutter',()=>{
  for(const boundary of[xy([[0,0],[20,0],[20,20],[0,20]]),rectangle]){
    const r=solve(boundary),faces=r.faces.map(f=>({...f,vertices:f.vertices.map(p=>({...p,z:18-p.z})),plane:{a:-f.plane.a,b:-f.plane.b,c:1,d:-f.plane.d-18}}));
    const v=validateHipRoof({faces,eaveBoundary:r.eaveBoundary,pitch:1/3,eaveSurfaceElevation:9});assert.equal(v.geometry,'valid');assert.equal(v.drainage,'failed');assert.ok(v.unresolvedDrainage.length);
  }
});
test('runtime coverage/manifold/plane validation rejects missing, overlapping and reversed-valley geometry',()=>{
  const r=solve(H(28)),check=faces=>validateHipRoof({faces,eaveBoundary:r.eaveBoundary,pitch:1/3,eaveSurfaceElevation:9});
  assert.notEqual(check(r.faces.slice(1)).geometry,'valid');assert.notEqual(check([...r.faces,{...r.faces[0],id:'duplicate-skin'}]).geometry,'valid');
  const broken=structuredClone(r.faces),valley=r.edges.find(e=>e.kind==='valley');for(const f of broken)for(const p of f.vertices)if(same(p,valley.a))p.z=valley.b.z+1;const invalid=check(broken);assert.notEqual(invalid.geometry,'valid');assert.ok(invalid.diagnostics.length);
});
test('solver never mutates accepted source input and reports bounded timing',()=>{const input={boundary:H(28),riseTwice:8,eaveOverhang:2,eaveSurfaceElevation:28/3},before=JSON.stringify(input),start=performance.now(),r=solveHipRoof(input),elapsedMs=performance.now()-start;assert.equal(JSON.stringify(input),before);assert.equal(r.status,'ok');assert.ok(r.budget.patches<12000);console.log(JSON.stringify({fixture:'analytic-H-feet',elapsedMs,faces:r.faces.length,edges:r.edges.length,budget:r.budget}));});
