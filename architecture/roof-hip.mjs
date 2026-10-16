/* Original orthogonal unit-speed wavefront solver, no geometry dependency.
 *
 * A rectilinear mitered inward wavefront is erosion by an axis-aligned square.
 * Finite segments (including their endpoint squares) define the forbidden band.
 * Coordinate order can change only when c+v*t lines meet, v in {-1,0,1}.
 * We batch all such contact times, reconstruct each open-interval wavefront,
 * and integrate its finite fronts exactly between consecutive events. Thus
 * collapse, split, and simultaneous parallel contacts require no guessed rays
 * or sequential perturbation of symmetric events. Extra coordinate contacts
 * can subdivide the sweep but are removed when swept patches are merged.
 * This bounded event-arrangement implementation trades speed for auditability;
 * its budget is explicit and unsupported jobs never return partial geometry.
 */
import {deriveEaveBoundary,signedArea,pointInLoop} from './roof-boundary.mjs';
import {validateRoofSkin} from './roof-validate.mjs';
export const HIP_KERNEL_VERSION='linecraft-orthogonal-wavefront/1';
const MAX_INTERVALS=512,MAX_GRID_WORK=12000000,MAX_PATCHES=12000;
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,(b.z??0)-(a.z??0));
const at=(p,t)=>({x:p.x.c+p.x.v*t,y:p.y.c+p.y.v*t});
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const clean=(v,tol)=>Math.abs(v)<tol*.001?0:v;
function simplify(loop,tolerance){
  const out=[];for(const p of loop)if(!out.length||distance(p,out.at(-1))>tolerance)out.push(p);
  if(out.length>1&&distance(out[0],out.at(-1))<=tolerance)out.pop();
  let changed=true;while(changed&&out.length>3){changed=false;for(let i=0;i<out.length;i++){const a=out[(i+out.length-1)%out.length],b=out[i],c=out[(i+1)%out.length];if(Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<=tolerance*Math.max(distance(a,b),distance(b,c))&&(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>=0){out.splice(i,1);changed=true;break;}}}return out;
}
function unique(values,tolerance){const sorted=values.sort((a,b)=>a-b),out=[];for(const v of sorted)if(!out.length||v-out.at(-1)>tolerance)out.push(v);return out;}
function affineLines(values){return[...new Set(values)].flatMap(c=>[-1,0,1].map(v=>({c,v})));}
function eventTimes(xLines,yLines,maxTime,tolerance){
  const events=[0,maxTime];for(const lines of [xLines,yLines])for(let i=0;i<lines.length;i++)for(let j=0;j<i;j++)if(lines[i].v!==lines[j].v){const t=(lines[j].c-lines[i].c)/(lines[i].v-lines[j].v);if(t>tolerance&&t<maxTime-tolerance)events.push(t);}return unique(events,tolerance);
}
function ordered(lines,t,tolerance){const out=[];for(const line of [...lines].sort((a,b)=>a.c+a.v*t-b.c-b.v*t||a.v-b.v))if(!out.length||line.c+line.v*t-(out.at(-1).c+out.at(-1).v*t)>tolerance)out.push(line);return out;}
function segmentDistance(p,a,b){return Math.max(Math.abs(a.x===b.x?p.x-a.x:p.y-a.y),a.x===b.x?Math.max(Math.min(a.y,b.y)-p.y,0,p.y-Math.max(a.y,b.y)):Math.max(Math.min(a.x,b.x)-p.x,0,p.x-Math.max(a.x,b.x)));}
function wavefront(loop,xLines,yLines,t,tolerance,activeEdges=null){
  const xs=ordered(xLines,t,tolerance),ys=ordered(yLines,t,tolerance),nx=xs.length-1,ny=ys.length-1,grid=new Uint8Array(nx*ny);
  const coords=(ix,iy)=>({x:xs[ix].c+xs[ix].v*t,y:ys[iy].c+ys[iy].v*t});
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const p=midpoint(coords(x,y),coords(x+1,y+1));if(!pointInLoop(p,loop))continue;
    let blocked=false;for(let i=0;i<loop.length;i++)if((!activeEdges||activeEdges.has(i))&&segmentDistance(p,loop[i],loop[(i+1)%loop.length])<t){blocked=true;break;}if(!blocked)grid[y*nx+x]=1;
  }
  const has=(x,y)=>x>=0&&y>=0&&x<nx&&y<ny&&grid[y*nx+x];
  const fronts=[];
  function add(x0,y0,x1,y1,n){
    const a={x:xs[x0],y:ys[y0]},b={x:xs[x1],y:ys[y1]},aa=at(a,t),bb=at(b,t),p=midpoint(aa,bb);
    let best=-1,bestDistance=Infinity;
    for(let i=0;i<loop.length;i++){
      if(activeEdges&&!activeEdges.has(i))continue;
      const q=loop[i],r=loop[(i+1)%loop.length],len=Math.hypot(r.x-q.x,r.y-q.y),inward={x:-(r.y-q.y)/len,y:(r.x-q.x)/len};
      if(inward.x!==n.x||inward.y!==n.y)continue;
      const d=n.x*(p.x-q.x)+n.y*(p.y-q.y);if(Math.abs(d-t)>tolerance*8)continue;
      const tangent=n.x?Math.max(Math.min(q.y,r.y)-p.y,0,p.y-Math.max(q.y,r.y)):Math.max(Math.min(q.x,r.x)-p.x,0,p.x-Math.max(q.x,r.x));
      if(tangent<bestDistance){best=i;bestDistance=tangent;}
    }
    // A confirmed gable clips the occupied domain but never advances and
    // never sweeps a sloping face. Preserve it only as a stationary boundary.
    if(best<0&&activeEdges&&loop.some((q,i)=>{if(activeEdges.has(i))return false;const r=loop[(i+1)%loop.length],len=Math.hypot(r.x-q.x,r.y-q.y),inward={x:-(r.y-q.y)/len,y:(r.x-q.x)/len};return inward.x===n.x&&inward.y===n.y&&Math.abs(n.x*(p.x-q.x)+n.y*(p.y-q.y))<=tolerance*8;}))return;
    if(best<0)throw new Error('Wavefront provenance could not be resolved.');
    fronts.push({a,b,sourceEdge:best,n});
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(has(x,y)){
    if(!has(x,y-1))add(x,y,x+1,y,{x:0,y:1});
    if(!has(x+1,y))add(x+1,y,x+1,y+1,{x:-1,y:0});
    if(!has(x,y+1))add(x+1,y+1,x,y+1,{x:0,y:-1});
    if(!has(x-1,y))add(x,y+1,x,y,{x:1,y:0});
  }
  // Remove artificial grid subdivisions before sweeping the finite fronts.
  const starts=new Map();const key=p=>`${p.x.c},${p.x.v},${p.y.c},${p.y.v}`;
  fronts.forEach((f,i)=>starts.set(`${f.sourceEdge}/${f.n.x}/${f.n.y}/${key(f.a)}`,i));
  const consumed=new Set(),merged=[];
  for(let i=0;i<fronts.length;i++)if(!consumed.has(i)){
    const f={...fronts[i]};consumed.add(i);let next;
    while((next=starts.get(`${f.sourceEdge}/${f.n.x}/${f.n.y}/${key(f.b)}`))!==undefined&&!consumed.has(next)){consumed.add(next);f.b=fronts[next].b;}merged.push(f);
  }
  return merged;
}

// Shared finite-front primitives. The public HIP path retains its defaults.
export {simplify,affineLines,eventTimes,wavefront,pointKey,mergePatches,makeEdges,geometricEvents};
function pointKey(p,tolerance){return`${Math.round(p.x/tolerance)},${Math.round(p.y/tolerance)}`;}
function segmentPieces(segments,tolerance){
  const directions=new Map(),groups=[];
  for(const segment of segments){
    const {a,b}=segment,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<=tolerance)continue;
    let ux=dx/len,uy=dy/len;if(ux<-tolerance||Math.abs(ux)<=tolerance&&uy<0){ux=-ux;uy=-uy;}
    const h=-uy*a.x+ux*a.y,key=`${Math.round(ux/1e-8)},${Math.round(uy/1e-8)}`;
    if(!directions.has(key))directions.set(key,[]);directions.get(key).push({...segment,ux,uy,h,ta:ux*a.x+uy*a.y,tb:ux*b.x+uy*b.y});
  }
  // A rounded line-constant key separated identical lines straddling a bin
  // boundary. Cluster by actual residual instead; no source point is moved.
  for(const entries of directions.values()){
    entries.sort((a,b)=>a.h-b.h);let group=[];for(const entry of entries){if(group.length&&entry.h-group[0].h>tolerance){groups.push(group);group=[];}group.push(entry);}if(group.length)groups.push(group);
  }
  const result=[];for(const entries of groups){
    const breaks=unique(entries.flatMap(s=>[s.ta,s.tb]),tolerance);
    for(const s of entries){const lo=Math.min(s.ta,s.tb),hi=Math.max(s.ta,s.tb),cuts=breaks.filter(t=>t>=lo-tolerance&&t<=hi+tolerance);if(s.tb<s.ta)cuts.reverse();
      for(let i=0;i<cuts.length-1;i++){const point=t=>{const f=(t-s.ta)/(s.tb-s.ta);return{x:s.a.x+f*(s.b.x-s.a.x),y:s.a.y+f*(s.b.y-s.a.y)};};if(Math.abs(cuts[i+1]-cuts[i])>tolerance)result.push({...s,a:point(cuts[i]),b:point(cuts[i+1])});}
    }
  }return result;
}
function mergePatches(patches,tolerance){
  const pieces=segmentPieces(patches.flatMap(loop=>loop.map((a,i)=>({a,b:loop[(i+1)%loop.length]}))),tolerance),map=new Map();
  for(const s of pieces){const a=pointKey(s.a,tolerance),b=pointKey(s.b,tolerance),reverse=`${b}/${a}`,forward=`${a}/${b}`;if(map.has(reverse))map.delete(reverse);else map.set(forward,s);}
  const starts=new Map();for(const [k,s]of map){const pk=pointKey(s.a,tolerance);if(!starts.has(pk))starts.set(pk,[]);starts.get(pk).push(k);}
  const loops=[];while(map.size){const first=map.keys().next().value;let current=first;const loop=[];let count=0;while(map.has(current)){const s=map.get(current);loop.push(s.a);map.delete(current);const candidates=(starts.get(pointKey(s.b,tolerance))??[]).filter(k=>map.has(k));if(!candidates.length){if(pointKey(s.b,tolerance)!==pointKey(loop[0],tolerance))throw new Error('Swept face boundary has an open seam.');break;}if(candidates.length>1){
      // Several swept components can touch at an event without sharing area.
      // Follow the boundary with occupied area on its left, rather than
      // joining two loops into a self-touching polygon at that event point.
      const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
      candidates.sort((ka,kb)=>{const turn=k=>{const q=map.get(k),ux=q.b.x-q.a.x,uy=q.b.y-q.a.y;return Math.atan2(dx*uy-dy*ux,dx*ux+dy*uy);};return turn(kb)-turn(ka)||ka.localeCompare(kb);});
    }current=candidates[0];if(++count>pieces.length)throw new Error('Swept face loop budget exceeded.');}const simplified=simplify(loop,tolerance);if(simplified.length>=3&&Math.abs(signedArea(simplified))>tolerance*tolerance)loops.push(simplified);}
  return loops;
}
function makeEdges(faces,tolerance){
  const origin=faces[0]?.vertices[0]??{x:0,y:0},local=p=>({x:p.x-origin.x,y:p.y-origin.y});
  const pieces=segmentPieces(faces.flatMap(f=>f.vertices.map((a,i)=>({a:local(a),b:local(f.vertices[(i+1)%f.vertices.length]),face:f}))),tolerance),map=new Map();
  for(const s of pieces){const ka=pointKey(s.a,tolerance),kb=pointKey(s.b,tolerance),key=ka<kb?`${ka}/${kb}`:`${kb}/${ka}`;if(!map.has(key))map.set(key,[]);map.get(key).push(s);}
  const edges=[];for(const incidents of map.values()){
    if(incidents.length>2)throw new Error('Generated roof has a nonmanifold edge.');const s=incidents[0],face=s.face;
    const lift=(p,f)=>{const x=p.x+origin.x,y=p.y+origin.y;return{x:clean(x,tolerance),y:clean(y,tolerance),z:-(f.plane.a*x+f.plane.b*y+f.plane.d)/f.plane.c};};const a=lift(s.a,face),b=lift(s.b,face);let kind='eave',subtype=null;
    if(incidents.length===2){const other=incidents[1].face,len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len,gx=-face.plane.a/face.plane.c,gy=-face.plane.b/face.plane.c,ox=-other.plane.a/other.plane.c,oy=-other.plane.b/other.plane.c;
      if(distance(a,lift(s.a,other))>tolerance*16||distance(b,lift(s.b,other))>tolerance*16)throw new Error('Adjacent roof faces disagree in XYZ.');
      const d0=gx*nx+gy*ny,d1=-(ox*nx+oy*ny);
      if(Math.abs(gx-ox)+Math.abs(gy-oy)<=1e-10)kind='coplanar';else if(d0>1e-10&&d1>1e-10)kind='valley';else if(d0<-1e-10&&d1<-1e-10)kind=Math.abs(a.z-b.z)<=tolerance?'ridge':'hip';else throw new Error('Roof seam has inconsistent slope classification.');
    }
    edges.push({id:`roof-edge-${edges.length+1}`,a,b,kind,subtype,faceIds:incidents.map(s=>s.face.id)});
  }return edges;
}
function geometricEvents(edges,eave,pitch,tolerance,sweepContacts){
  const origin=edges[0]?.a??{x:0,y:0},nodes=new Map();for(const e of edges)if(e.kind!=='eave'&&e.kind!=='coplanar')for(const p of [e.a,e.b]){const key=pointKey({x:p.x-origin.x,y:p.y-origin.y},tolerance);if(!nodes.has(key))nodes.set(key,{point:p,incidents:[]});nodes.get(key).incidents.push(e);}
  const batches=[];
  for(const {point,incidents}of nodes.values())if(point.z>eave+tolerance){
    const distance=(point.z-eave)/pitch;let batch=batches.find(b=>Math.abs(b.distance-distance)<=tolerance*8);if(!batch){batch={distance,elevation:point.z,batched:true,contacts:[],types:[]};batches.push(batch);}
    const types=[];if(incidents.some(e=>e.kind==='valley'))types.push('split');if(incidents.some(e=>e.kind==='hip'))types.push('edge-collapse');if(incidents.some(e=>e.kind==='ridge'))types.push('parallel-front-collapse');
    batch.contacts.push({point,types,edgeIds:incidents.map(e=>e.id)});batch.types.push(...types);
  }
  batches.sort((a,b)=>a.distance-b.distance);for(const b of batches){b.types=[...new Set(b.types)].sort();b.simultaneousContactCount=b.contacts.length;b.frontCountBefore=sweepContacts.find(e=>Math.abs(e.distance-b.distance)<=tolerance*8)?.frontCountBefore??null;}
  return batches;
}
/** Revalidates an independently supplied roof skin; no generated validation is trusted. */
export function validateHipRoof({faces,eaveBoundary,pitch,eaveSurfaceElevation,tolerance=1e-8}){
  try{return validateRoofSkin({faces,edges:makeEdges(faces,tolerance),eaveBoundary,pitch,eaveSurfaceElevation,tolerance});}
  catch(error){return{geometry:'failed',drainage:'not-run',clearance:'not-analyzed',structural:'unverified',supplier:'unverified',diagnostics:[error.message]};}
}
/** Synchronous pure R2 contract; source input is never mutated. */
export function solveHipRoof(input={}){
  const result={status:'failed',kernelVersion:HIP_KERNEL_VERSION,faces:[],edges:[],events:[],validation:{geometry:'not-run',drainage:'not-run',clearance:'not-analyzed',structural:'unverified',supplier:'unverified'},quantities:null,diagnostics:[]};
  try{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Roof input must be an object.');
    if(!Number.isInteger(input.riseTwice)||input.riseTwice<2||input.riseTwice>24)throw new Error('Hip pitch riseTwice must be an integer from 2 through 24.');
    if(!Number.isFinite(input.eaveSurfaceElevation)||Math.abs(input.eaveSurfaceElevation)>1e9)throw new Error('Eave surface elevation must be finite and bounded.');
    if(input.holes?.length||input.components?.length) return{...result,status:'unsupported',diagnostics:['R2 supports one simple orthogonal boundary without enclosed holes.']};
    const raw=input.boundary??[],xs=raw.map(p=>p?.x),ys=raw.map(p=>p?.y),extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),1),tolerance=input.tolerance??Math.max(1e-8,extent*1e-10);
    const eave=deriveEaveBoundary(raw,input.eaveOverhang??0,{tolerance});if(eave.status!=='ok')return{...result,...eave};
    const world=eave.boundary,origin={x:world[0].x,y:world[0].y},loop=world.map(p=>({x:p.x-origin.x,y:p.y-origin.y})),xLines=affineLines(loop.map(p=>p.x)),yLines=affineLines(loop.map(p=>p.y)),maxTime=Math.min(Math.max(...loop.map(p=>p.x))-Math.min(...loop.map(p=>p.x)),Math.max(...loop.map(p=>p.y))-Math.min(...loop.map(p=>p.y)))/2;
    const times=eventTimes(xLines,yLines,maxTime,tolerance);if(times.length>MAX_INTERVALS||times.length*xLines.length*yLines.length*loop.length>MAX_GRID_WORK)return{...result,status:'unsupported',diagnostics:['Roof event-arrangement work budget exceeded. Simplify or split the explicitly declared roof group.']};
    const patches=loop.map(()=>[]),events=[];let totalPatches=0;
    for(let i=0;i<times.length-1;i++){
      const t0=times[i],t1=times[i+1];if(t1-t0<=tolerance)continue;const fronts=wavefront(loop,xLines,yLines,(t0+t1)/2,tolerance);
      if(!fronts.length)break;
      const nodes=[];for(const f of fronts){const poly=simplify([at(f.a,t0),at(f.b,t0),at(f.b,t1),at(f.a,t1)],tolerance);if(poly.length>=3&&Math.abs(signedArea(poly))>tolerance*tolerance){if(signedArea(poly)<0)poly.reverse();patches[f.sourceEdge].push(poly);if(++totalPatches>MAX_PATCHES)throw new Error('Roof patch budget exceeded.');}nodes.push(at(f.a,t1),at(f.b,t1));}
      events.push({distance:t1,elevation:input.eaveSurfaceElevation+input.riseTwice/24*t1,batched:true,frontCountBefore:fronts.length,contactPoints:[...new Map(nodes.map(p=>[pointKey(p,tolerance),{x:p.x+origin.x,y:p.y+origin.y}])).values()]});
    }
    const pitch=input.riseTwice/24,faces=[];
    patches.forEach((sourcePatches,sourceEdge)=>{const a=loop[sourceEdge],b=loop[(sourceEdge+1)%loop.length],len=Math.hypot(b.x-a.x,b.y-a.y),n={x:-(b.y-a.y)/len,y:(b.x-a.x)/len};for(const [j,poly]of mergePatches(sourcePatches,tolerance).entries()){const plane={a:-pitch*n.x,b:-pitch*n.y,c:1,d:-input.eaveSurfaceElevation+pitch*(n.x*(a.x+origin.x)+n.y*(a.y+origin.y))},vertices=poly.map(p=>({x:clean(p.x+origin.x,tolerance),y:clean(p.y+origin.y,tolerance),z:input.eaveSurfaceElevation+pitch*(n.x*(p.x-a.x)+n.y*(p.y-a.y))}));faces.push({id:`roof-face-${sourceEdge+1}-${j+1}`,sourceEdge,vertices,plane});}});
    const edges=makeEdges(faces,tolerance);for(const e of edges)if(e.kind==='hip')e.subtype=Math.min(e.a.z,e.b.z)<=input.eaveSurfaceElevation+tolerance?'outer_hip':'rising_hip';
    const validation=validateRoofSkin({faces,edges,eaveBoundary:world,pitch,eaveSurfaceElevation:input.eaveSurfaceElevation,tolerance}),lengthByKind={};for(const e of edges)lengthByKind[e.kind]=(lengthByKind[e.kind]??0)+distance(e.a,e.b);
    const quantities={projectedArea:validation.projectedArea,roofSurfaceArea:validation.projectedArea*Math.sqrt(1+pitch*pitch),lengthByKind,maxRoofElevation:Math.max(...faces.flatMap(f=>f.vertices.map(p=>p.z))),trussDesignManufacturingComplexitySurcharge:0,framingLumber:null,connectors:null,framingAssumptions:'Unverified conceptual roof skin. No framing design or structural/clearance approval.'};
    return{...result,status:validation.geometry==='valid'&&validation.drainage==='valid'?'ok':'failed',faces,edges,events:geometricEvents(edges,input.eaveSurfaceElevation,pitch,tolerance,events),validation,quantities,diagnostics:validation.geometry==='valid'&&validation.drainage==='valid'?[]:['Generated roof failed geometry or runoff validation.'],eaveBoundary:world,tolerance,budget:{intervals:times.length-1,patches:totalPatches,coordinateContactBatches:events.length}};
  }catch(error){return{...result,diagnostics:[error.message]};}
}
