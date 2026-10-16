/* Original bounded validation for orthogonal equal-pitch roof skins. */
import {signedArea,pointInLoop,normalizeRoofBoundary} from './roof-boundary.mjs';
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const area=p=>Math.abs(signedArea(p));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function onSegment(p,a,b,tol){return Math.abs(cross(a,b,p))<=tol*Math.max(distance(a,b),1)&&p.x>=Math.min(a.x,b.x)-tol&&p.x<=Math.max(a.x,b.x)+tol&&p.y>=Math.min(a.y,b.y)-tol&&p.y<=Math.max(a.y,b.y)+tol;}
function triangles(poly,tol){
  const ids=poly.map((_,i)=>i),out=[];
  while(ids.length>3){let found=false;for(let i=0;i<ids.length;i++){
    const ai=ids[(i+ids.length-1)%ids.length],bi=ids[i],ci=ids[(i+1)%ids.length],a=poly[ai],b=poly[bi],c=poly[ci];if(cross(a,b,c)<=tol*tol)continue;
    if(ids.some(k=>![ai,bi,ci].includes(k)&&cross(a,b,poly[k])>=-tol*tol&&cross(b,c,poly[k])>=-tol*tol&&cross(c,a,poly[k])>=-tol*tol))continue;
    out.push([a,b,c]);ids.splice(i,1);found=true;break;
  }if(!found)throw new Error('Roof face is non-simple, degenerate, or has unresolved collinear vertices.');}out.push(ids.map(i=>poly[i]));return out;
}
function clipTriangle(subject,clip,tol){let points=subject;for(let i=0;i<3&&points.length;i++){const a=clip[i],b=clip[(i+1)%3],out=[];for(let j=0;j<points.length;j++){const p=points[j],q=points[(j+1)%points.length],u=cross(a,b,p),v=cross(a,b,q);if(u>=-tol*tol)out.push(p);if(u>tol*tol&&v<-tol*tol||u<-tol*tol&&v>tol*tol){const t=u/(u-v);out.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)});}}points=out;}return points;}
function uniq(values,tol){const out=[];for(const x of values.sort((a,b)=>a-b))if(!out.length||x-out.at(-1)>tol)out.push(x);return out;}
function topologyCoverage(faces,edges,boundary,tolerance,rakeBoundary=[]){
  const origin=boundary[0],local=p=>({...p,x:p.x-origin.x,y:p.y-origin.y}),loop=boundary.map(local),domain=triangles(loop,tolerance),skin=faces.flatMap(f=>triangles(f.vertices.map(local),tolerance));
  if(skin.length>1024)throw new Error('Runtime roof-validation triangle budget exceeded.');
  const extent=Math.max(...loop.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))),1),areaTolerance=tolerance*extent*16;
  let covered=0,outside=0,overlap=0;for(const t of skin){const a=area(t);covered+=a;const clipped=domain.reduce((s,d)=>s+area(clipTriangle(t,d,tolerance)),0);outside+=Math.max(0,a-clipped);}
  for(let i=0;i<skin.length;i++)for(let j=0;j<i;j++)overlap+=area(clipTriangle(skin[i],skin[j],tolerance));
  let eaveLength=0;for(const e of edges){const open=e.kind==='eave'||e.kind==='rake';if(e.faceIds.length!==(open?1:2))throw new Error('Roof edge adjacency is nonmanifold.');if(open){if(!boundary.some((a,i)=>onSegment(e.a,a,boundary[(i+1)%boundary.length],tolerance)&&onSegment(e.b,a,boundary[(i+1)%boundary.length],tolerance)))throw new Error('Open roof edge is not on the declared boundary.');const isRake=rakeBoundary.some(s=>onSegment(e.a,s.a,s.b,tolerance)&&onSegment(e.b,s.a,s.b,tolerance));if(isRake!==(e.kind==='rake'))throw new Error('Open roof edge disagrees with its confirmed eave/rake assignment.');eaveLength+=distance(e.a,e.b);}}
  const perimeter=boundary.reduce((s,a,i)=>s+distance(a,boundary[(i+1)%boundary.length]),0),perimeterResidual=Math.abs(eaveLength-perimeter),areaResidual=Math.abs(covered-area(loop));
  return{valid:areaResidual<=areaTolerance&&outside<=areaTolerance&&overlap<=areaTolerance&&perimeterResidual<=tolerance*boundary.length*8,projectedArea:covered,expectedProjectedArea:area(loop),areaResidual,outsideArea:outside,overlapArea:overlap,perimeterResidual,triangleCount:skin.length};
}
/** Every positive-area constant-gradient flow band has a checked outlet.
 * Strips are split at every vertex ordinate, where the first-exit identity can
 * change. Mid-strip intersection identifies that exact affine interval; it is
 * not a sampling approximation of the terrain. Coplanar transitions retain
 * the strip; valleys use strictly descending 1D flow to their lower endpoint.
 */
function runoff(faces,edges,boundary,tolerance){
  const byFace=new Map(faces.map(f=>[f.id,f])),faceEdges=new Map(faces.map(f=>[f.id,edges.filter(e=>e.faceIds.includes(f.id))]));
  const origin=boundary[0],pointKey=p=>`${Math.round((p.x-origin.x)/tolerance)},${Math.round((p.y-origin.y)/tolerance)}`;
  // Stationary gable/rake boundaries are never accepted as drainage outlets.
  const boundaryPoint=p=>edges.some(e=>e.kind==='eave'&&onSegment(p,e.a,e.b,tolerance));
  const edgeAt=(face,p)=>faceEdges.get(face.id).filter(e=>onSegment(p,e.a,e.b,tolerance));
  const flow=f=>{const x=f.plane.a/f.plane.c,y=f.plane.b/f.plane.c;if(Math.min(Math.abs(x),Math.abs(y))>1e-10)throw new Error('R2 drainage validator requires orthogonal facet gradients.');return Math.abs(x)>Math.abs(y)?{axis:'x',perp:'y',sign:Math.sign(x)}:{axis:'y',perp:'x',sign:Math.sign(y)};};
  const faceFlow=new Map(faces.map(f=>[f.id,flow(f)])),ordinates={x:uniq(faces.flatMap(f=>f.vertices.map(p=>p.y)),tolerance),y:uniq(faces.flatMap(f=>f.vertices.map(p=>p.x)),tolerance)},cells=[],cellsByFace=new Map(faces.map(f=>[f.id,[]]));
  for(const face of faces){const d=faceFlow.get(face.id),cuts=ordinates[d.axis];for(let band=0;band<cuts.length-1;band++){
    const ordinate=(cuts[band]+cuts[band+1])/2,hits=[];
    for(let i=0;i<face.vertices.length;i++){const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length];if(ordinate<=Math.min(a[d.perp],b[d.perp])||ordinate>=Math.max(a[d.perp],b[d.perp]))continue;const t=(ordinate-a[d.perp])/(b[d.perp]-a[d.perp]);hits.push({coordinate:a[d.axis]+t*(b[d.axis]-a[d.axis]),point:{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}});}
    hits.sort((a,b)=>a.coordinate-b.coordinate);if(hits.length%2)throw new Error('Roof runoff band has odd boundary intersections.');
    for(let k=0;k<hits.length;k+=2){const lo=hits[k],hi=hits[k+1];if(hi.coordinate-lo.coordinate<=tolerance)continue;const target=d.sign>0?hi:lo,exits=edgeAt(face,target.point);if(exits.length!==1)throw new Error('Roof runoff outlet has ambiguous adjacency.');const cell={id:`flow-cell-${cells.length+1}`,faceId:face.id,band,axis:d.axis,sign:d.sign,lo:lo.coordinate,hi:hi.coordinate,exit:exits[0],point:target.point};cells.push(cell);cellsByFace.get(face.id).push(cell);}
  }}
  const memo=new Map(),active=new Set(),diagnostics=[];
  const record=(key,compute)=>{if(memo.has(key))return memo.get(key);if(active.has(key))return false;active.add(key);const valid=compute();active.delete(key);memo.set(key,valid);return valid;};
  const elevation=(f,p)=>-(f.plane.a*p.x+f.plane.b*p.y+f.plane.d)/f.plane.c;
  function routeValley(edge){return record(`valley/${edge.id}`,()=>{if(Math.abs(edge.a.z-edge.b.z)<=tolerance)return false;return routeNode(edge.a.z<edge.b.z?edge.a:edge.b);});}
  function routeEdge(edge,face,p){
    if(edge.kind==='eave')return boundaryPoint(p);
    if(edge.kind==='valley')return routeValley(edge);
    if(edge.kind==='coplanar'){const id=edge.faceIds.find(id=>id!==face.id);return id?routeRay(byFace.get(id),p):false;}
    return false;
  }
  function rayTarget(face,p){
    const d=faceFlow.get(face.id),hits=[];for(let i=0;i<face.vertices.length;i++){const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length];if(a[d.perp]===b[d.perp])continue;const t=(p[d.perp]-a[d.perp])/(b[d.perp]-a[d.perp]);if(t<-tolerance||t>1+tolerance)continue;const q={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)},travel=(q[d.axis]-p[d.axis])*d.sign;if(travel>tolerance)hits.push({q,travel});}hits.sort((a,b)=>a.travel-b.travel);if(!hits.length)return null;
    const target=hits[0].q,m={x:(p.x+target.x)/2,y:(p.y+target.y)/2};if(!pointInLoop(m,face.vertices)||face.vertices.some((a,i)=>onSegment(m,a,face.vertices[(i+1)%face.vertices.length],tolerance)))return null;return target;
  }
  function routeRay(face,p){return record(`ray/${face.id}/${pointKey(p)}`,()=>{const q=rayTarget(face,p);if(!q)return false;if(elevation(face,q)>=elevation(face,p)-tolerance)return false;const exits=edgeAt(face,q);if(exits.some(e=>distance(q,e.a)<=tolerance||distance(q,e.b)<=tolerance))return routeNode({...q,z:elevation(face,q)});return exits.length===1&&routeEdge(exits[0],face,q);});}
  function routeNode(p){return record(`node/${pointKey(p)}`,()=>{
    if(boundaryPoint(p))return true;const choices=[];
    for(const edge of edges)if(edge.kind==='valley'){const high=edge.a.z>edge.b.z?edge.a:edge.b,low=edge.a.z<edge.b.z?edge.a:edge.b;if(distance(p,high)<=tolerance&&high.z>low.z+tolerance)choices.push(()=>routeValley(edge));}
    for(const face of faces)if(face.vertices.some((a,i)=>onSegment(p,a,face.vertices[(i+1)%face.vertices.length],tolerance))&&rayTarget(face,p))choices.push(()=>routeRay(face,p));
    return choices.length>0&&choices.every(f=>f());
  });}
  function routeCell(cell){return record(`cell/${cell.id}`,()=>{
    const edge=cell.exit;if(edge.kind==='coplanar'){const other=edge.faceIds.find(id=>id!==cell.faceId),next=(cellsByFace.get(other)??[]).filter(c=>c.axis===cell.axis&&c.band===cell.band&&(cell.sign>0?Math.abs(c.lo-cell.point[cell.axis])<=tolerance:Math.abs(c.hi-cell.point[cell.axis])<=tolerance));return next.length===1&&routeCell(next[0]);}
    return routeEdge(edge,byFace.get(cell.faceId),cell.point);
  });}
  for(const edge of edges)if(edge.kind==='valley'&&!routeValley(edge))diagnostics.push(edge.id);
  for(const cell of cells)if(!routeCell(cell))diagnostics.push(cell.id);
  // Every positive-flux boundary interval must be a known receiving interface.
  for(const face of faces)for(const edge of faceEdges.get(face.id)){
    const a=edge.a,b=edge.b,m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},d=faceFlow.get(face.id),own=face.vertices.findIndex((p,i)=>onSegment(m,p,face.vertices[(i+1)%face.vertices.length],tolerance));if(own<0)throw new Error('Roof edge has no matching incident face boundary.');const p=face.vertices[own],q=face.vertices[(own+1)%face.vertices.length],outward=d.axis==='x'?(q.y-p.y)*d.sign:-(q.x-p.x)*d.sign;if(outward>tolerance&&!['eave','valley','coplanar'].includes(edge.kind))diagnostics.push(`${face.id}/${edge.id}/invalid-outflow`);
  }
  return{valid:diagnostics.length===0,unresolved:diagnostics,catchmentCells:cells.length,method:'exact constant-gradient characteristic bands; every positive-area band reaches an approved eave via validated interfaces'};
}
export function validateRoofSkin({faces,edges,eaveBoundary,pitch,eaveSurfaceElevation,tolerance=1e-8,rakeBoundary=[]}){
  const validation={geometry:'failed',drainage:'not-run',clearance:'not-analyzed',structural:'unverified',supplier:'unverified',diagnostics:[]};
  try{
    if(!Number.isFinite(pitch)||pitch<=0||pitch>1||!Number.isFinite(eaveSurfaceElevation)||!Number.isFinite(tolerance)||tolerance<=0)throw new Error('Roof validation requires finite positive pitch/tolerance and a finite eave datum.');
    const boundary=normalizeRoofBoundary(eaveBoundary,{tolerance});if(!Array.isArray(faces)||!faces.length||faces.length>256||!Array.isArray(edges)||edges.length>4096)throw new Error('Roof validation input exceeds bounded skin limits.');
    if(new Set(faces.map(f=>f.id)).size!==faces.length||new Set(edges.map(e=>e.id)).size!==edges.length)throw new Error('Roof face/edge IDs must be unique.');
    let maxPlaneResidual=0,maxPitchResidual=0;const ids=new Set(faces.map(f=>f.id));
    for(const face of faces){if(!face.plane||!['a','b','c','d'].every(k=>Number.isFinite(face.plane[k]))||face.plane.c===0||!Array.isArray(face.vertices)||face.vertices.length<3||face.vertices.length>1024)throw new Error('Roof face plane or loop is invalid.');if(signedArea(face.vertices)<=tolerance*tolerance)throw new Error('Roof face must have positive plan area and consistent winding.');for(const p of face.vertices){if(!['x','y','z'].every(k=>Number.isFinite(p[k])))throw new Error('Roof vertex must be finite.');maxPlaneResidual=Math.max(maxPlaneResidual,Math.abs(face.plane.a*p.x+face.plane.b*p.y+face.plane.c*p.z+face.plane.d)/Math.abs(face.plane.c));}maxPitchResidual=Math.max(maxPitchResidual,Math.abs(Math.hypot(face.plane.a,face.plane.b)/Math.abs(face.plane.c)-pitch));}
    for(const e of edges){if(![e.a,e.b].every(p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])))||!['eave','rake','hip','ridge','valley','coplanar'].includes(e.kind)||!Array.isArray(e.faceIds)||!e.faceIds.every(id=>ids.has(id))||new Set(e.faceIds).size!==e.faceIds.length||distance(e.a,e.b)<=tolerance)throw new Error('Roof edge has invalid coordinates, classification, owner, incidence or length.');for(const id of e.faceIds){const f=faces.find(f=>f.id===id);for(const p of[e.a,e.b])if(Math.abs(f.plane.a*p.x+f.plane.b*p.y+f.plane.c*p.z+f.plane.d)/Math.abs(f.plane.c)>tolerance*16)throw new Error('Shared roof edge has an XYZ gap.');}if(e.kind==='eave'&&(Math.abs(e.a.z-eaveSurfaceElevation)>tolerance*16||Math.abs(e.b.z-eaveSurfaceElevation)>tolerance*16))throw new Error('Eave edge elevation disagrees with eave datum.');}
    const coverage=topologyCoverage(faces,edges,boundary,tolerance,rakeBoundary);Object.assign(validation,coverage,{maxPlaneResidual,maxPitchResidual});delete validation.valid;
    if(!coverage.valid||maxPlaneResidual>tolerance*16||maxPitchResidual>1e-10)throw new Error('Roof coverage, topology, pitch or plane residual exceeds tolerance.');validation.geometry='valid';
    const drainage=runoff(faces,edges,boundary,tolerance);validation.drainage=drainage.valid?'valid':'failed';validation.unresolvedDrainage=drainage.unresolved;validation.catchmentCells=drainage.catchmentCells;validation.method=drainage.method;if(!drainage.valid)validation.diagnostics.push('A collecting seam, outlet or positive-area runoff catchment fails drainage validation.');
  }catch(error){validation.diagnostics.push(error.message);}return validation;
}

// Pure validation disciplines reused by the R5 additive-height kernel.
export {topologyCoverage,runoff};
