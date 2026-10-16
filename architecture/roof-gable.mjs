/* Original R4 stationary-terminal extension of the bounded finite-front solver. */
import {normalizeRoofBoundary,deriveGableBoundary,roofBoundaryEdgeKey,signedArea,pointInLoop} from './roof-boundary.mjs';
import {simplify,affineLines,eventTimes,wavefront,pointKey,mergePatches,makeEdges,geometricEvents} from './roof-hip.mjs';
import {validateRoofSkin} from './roof-validate.mjs';
export const GABLE_KERNEL_VERSION='linecraft-orthogonal-gable-wavefront/1';
const MAX_INTERVALS=512,MAX_GRID_WORK=12000000,MAX_PATCHES=12000,MAX_ALTERNATIVES=8;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,(b.z??0)-(a.z??0));
const at=(p,t)=>({x:p.x.c+p.x.v*t,y:p.y.c+p.y.v*t});
const clean=(v,tol)=>Math.abs(v)<tol*.001?0:v;
const setId=keys=>[...keys].sort().join(';');
/** Bounded alternatives cover each convex terminal corner once. A rectangle
 * has two opposite-end choices; a cross or H has its short wing-end choice.
 * Geometric identities survive winding/index changes, never a source edit. */
export function inferGableCandidates(raw,{tolerance=1e-8}={}){
  try{
    const boundary=normalizeRoofBoundary(raw,{tolerance}),n=boundary.length,convex=boundary.map((p,i)=>cross(boundary[(i+n-1)%n],p,boundary[(i+1)%n])>0);
    const edges=boundary.map((a,i)=>{const b=boundary[(i+1)%n];return{index:i,key:roofBoundaryEdgeKey(a,b),a:{...a},b:{...b},terminal:convex[i]&&convex[(i+1)%n],length:dist(a,b),direction:a.x===b.x?'Y':'X'};});
    const alternatives=[],seen=new Set();let work=0,truncated=false;
    function visit(selected,covered){
      if(++work>4096||alternatives.length>=MAX_ALTERNATIVES){truncated=true;return;}
      const vertex=convex.findIndex((yes,i)=>yes&&!covered.has(i));
      if(vertex<0){const edgeKeys=selected.map(i=>edges[i].key).sort(),id=setId(edgeKeys);if(seen.has(id))return;seen.add(id);const dirs=new Set(selected.map(i=>edges[i].direction)),ridgeDirection=dirs.size===1?(dirs.has('Y')?'X':'Y'):'CROSS';alternatives.push({id:`gable-option-${alternatives.length+1}`,label:ridgeDirection==='CROSS'?`Cross-gable: ${edgeKeys.length} terminal ends`:`Ridge along ${ridgeDirection}: ${edgeKeys.length} terminal ends`,edgeKeys,ridgeDirection});return;}
      for(const i of[(vertex+n-1)%n,vertex]){const j=(i+1)%n;if(!edges[i].terminal||covered.has(i)||covered.has(j))continue;visit([...selected,i],new Set([...covered,i,j]));}
    }
    visit([],new Set());
    alternatives.sort((a,b)=>a.ridgeDirection.localeCompare(b.ridgeDirection)||setId(a.edgeKeys).localeCompare(setId(b.edgeKeys)));alternatives.forEach((a,i)=>a.id=`gable-option-${i+1}`);
    return{status:'ok',boundary,edges,alternatives,truncated,diagnostics:alternatives.length?[]:['No complete all-gable terminal assignment is supported for this footprint. Change coverage or choose a supported candidate.']};
  }catch(error){return{status:error.status??'unsupported',boundary:[],edges:[],alternatives:[],diagnostics:[error.message]};}
}
function onSegment(p,a,b,tol){return Math.abs(cross(a,b,p))<=tol*Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))&&p.x>=Math.min(a.x,b.x)-tol&&p.x<=Math.max(a.x,b.x)+tol&&p.y>=Math.min(a.y,b.y)-tol&&p.y<=Math.max(a.y,b.y)+tol;}
function closuresForSource(faces,source,selected,base,tolerance){
  const closures=[];
  source.forEach((a,i)=>{const b=source[(i+1)%source.length],key=roofBoundaryEdgeKey(a,b);if(!selected.has(key))return;const len=dist(a,b),dx=b.x-a.x,dy=b.y-a.y,point=t=>({x:a.x+dx*t,y:a.y+dy*t});
    for(const face of faces){const cuts=[0,1];for(let j=0;j<face.vertices.length;j++){const p=face.vertices[j],q=face.vertices[(j+1)%face.vertices.length],ux=q.x-p.x,uy=q.y-p.y,den=dx*uy-dy*ux;if(Math.abs(den)>tolerance*tolerance){const t=((p.x-a.x)*uy-(p.y-a.y)*ux)/den,u=((p.x-a.x)*dy-(p.y-a.y)*dx)/den;if(t>=-tolerance/len&&t<=1+tolerance/len&&u>=-tolerance&&u<=1+tolerance)cuts.push(Math.max(0,Math.min(1,t)));}else for(const r of[p,q])if(onSegment(r,a,b,tolerance))cuts.push(Math.max(0,Math.min(1,((r.x-a.x)*dx+(r.y-a.y)*dy)/(len*len))));}
      cuts.sort((x,y)=>x-y);const ts=cuts.filter((t,j)=>j===0||t-cuts[j-1]>tolerance/len);
      for(let j=0;j<ts.length-1;j++){const p=point(ts[j]),q=point(ts[j+1]),m=point((ts[j]+ts[j+1])/2);if(!pointInLoop(m,face.vertices,tolerance))continue;const z=r=>-(face.plane.a*r.x+face.plane.b*r.y+face.plane.d)/face.plane.c,zp=z(p),zq=z(q);if(Math.min(zp,zq)<base-tolerance*16)throw new Error('Gable closure roof lies below its declared bearing elevation.');const area=(Math.max(0,zp-base)+Math.max(0,zq-base))/2*dist(p,q);if(area<=tolerance*tolerance)continue;const raw=[{...p,z:base},{...q,z:base},{...q,z:zq},{...p,z:zp}],vertices=raw.filter((v,k)=>dist(v,raw[(k+raw.length-1)%raw.length])>tolerance);closures.push({id:`gable-closure-${i+1}-${closures.length+1}`,sourceEdge:i,sourceEdgeKey:key,vertices,area,thickness:0,kind:'gable-closure',framingVerification:'unverified'});}
    }
  });return closures;
}
function blank(){return{status:'failed',kernelVersion:GABLE_KERNEL_VERSION,faces:[],edges:[],gableClosures:[],events:[],validation:{geometry:'not-run',drainage:'not-run',clearance:'not-analyzed',structural:'unverified',supplier:'unverified',gablePolicy:'not-run'},quantities:null,diagnostics:[]};}
export function validateGableRoof({faces,eaveBoundary,pitch,eaveSurfaceElevation,gableBoundary=[],tolerance=1e-8}){
  try{const edges=makeEdges(faces,tolerance);for(const e of edges)if(e.kind==='eave'&&gableBoundary.some(s=>onSegment(e.a,s.a,s.b,tolerance)&&onSegment(e.b,s.a,s.b,tolerance)))e.kind='rake';return validateRoofSkin({faces,edges,eaveBoundary,pitch,eaveSurfaceElevation,rakeBoundary:gableBoundary,tolerance});}
  catch(error){return{geometry:'failed',drainage:'not-run',clearance:'not-analyzed',structural:'unverified',supplier:'unverified',diagnostics:[error.message]};}
}
/** One equal-bearing, equal-pitch, simple orthogonal domain. No partial skin
 * is returned when an assignment, front, coverage or runoff check fails. */
export function solveGableRoof(input={}){
  const result=blank();
  try{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Roof input must be an object.');
    if(!Number.isInteger(input.riseTwice)||input.riseTwice<2||input.riseTwice>24)throw new Error('Gable pitch riseTwice must be an integer from 2 through 24.');
    if(!Number.isFinite(input.eaveSurfaceElevation)||Math.abs(input.eaveSurfaceElevation)>1e9)throw new Error('Eave surface elevation must be finite and bounded.');
    if(input.holes?.length||input.components?.length)return{...result,status:'unsupported',diagnostics:['R4 supports one simple orthogonal boundary without enclosed holes.']};
    const raw=input.boundary??[],xs=raw.map(p=>p?.x),ys=raw.map(p=>p?.y),extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),1),tolerance=input.tolerance??Math.max(1e-8,extent*1e-10),inference=inferGableCandidates(raw,{tolerance});
    if(inference.status!=='ok')return{...result,status:inference.status,diagnostics:inference.diagnostics};
    const assignments=input.gableAssignments??[],policy=input.gablePolicy??'ALL_GABLE';
    if(!['ALL_GABLE','EXPLICIT'].includes(policy))throw new Error('Gable policy must be ALL_GABLE or EXPLICIT.');
    if(!Array.isArray(assignments)||!assignments.length||new Set(assignments).size!==assignments.length)return{...result,status:'needs-decision',diagnostics:['Confirm a terminal-end candidate before generating the gable roof.'],candidates:inference.alternatives};
    if(assignments.some(k=>!inference.edges.some(e=>e.key===k)))return{...result,status:'needs-decision',diagnostics:['A confirmed gable edge no longer matches the boundary; review the assignment.'],candidates:inference.alternatives};
    if(assignments.some(k=>!inference.edges.some(e=>e.key===k&&e.terminal)))return{...result,status:'unsupported',diagnostics:['Only terminal edges with two convex end corners are supported as gables in R4.']};
    const selected=new Set(assignments),hasAdjacent=inference.edges.some((e,i)=>selected.has(e.key)&&selected.has(inference.edges[(i+1)%inference.edges.length].key));
    if(hasAdjacent)return{...result,status:'unsupported',diagnostics:['Adjacent stationary gable ends leave an unsupported unbounded roof corner. Choose another terminal-end candidate.']};
    if(policy==='ALL_GABLE'&&!inference.alternatives.some(a=>setId(a.edgeKeys)===setId(assignments)))return{...result,status:'unsupported',diagnostics:['ALL_GABLE requires a complete terminal-end candidate; remaining hip caps are not substituted.'],candidates:inference.alternatives};
    const eave=deriveGableBoundary(raw,{eaveOverhang:input.eaveOverhang??0,rakeOverhang:input.rakeOverhang??0,gableAssignments:assignments},{tolerance});if(eave.status!=='ok')return{...result,status:eave.status,diagnostics:eave.diagnostics};
    const world=eave.boundary,origin={x:world[0].x,y:world[0].y},loop=world.map(p=>({x:p.x-origin.x,y:p.y-origin.y})),active=new Set(loop.map((_,i)=>i).filter(i=>!eave.gableEdgeIndices.includes(i))),xLines=affineLines(loop.map(p=>p.x)),yLines=affineLines(loop.map(p=>p.y)),maxTime=extent+2*Math.max(input.eaveOverhang??0,input.rakeOverhang??0),times=eventTimes(xLines,yLines,maxTime,tolerance);
    if(active.size<2)return{...result,status:'unsupported',diagnostics:['A gable roof requires opposed advancing eave fronts.']};
    if(times.length>MAX_INTERVALS||times.length*xLines.length*yLines.length*loop.length>MAX_GRID_WORK)return{...result,status:'unsupported',diagnostics:['Roof event-arrangement work budget exceeded. Simplify or split the explicitly declared roof group.']};
    const patches=loop.map(()=>[]),contacts=[];let totalPatches=0,complete=false;
    for(let i=0;i<times.length-1;i++){const t0=times[i],t1=times[i+1];if(t1-t0<=tolerance)continue;const fronts=wavefront(loop,xLines,yLines,(t0+t1)/2,tolerance,active);if(!fronts.length){complete=true;break;}const nodes=[];for(const f of fronts){const poly=simplify([at(f.a,t0),at(f.b,t0),at(f.b,t1),at(f.a,t1)],tolerance);if(poly.length>=3&&Math.abs(signedArea(poly))>tolerance*tolerance){if(signedArea(poly)<0)poly.reverse();patches[f.sourceEdge].push(poly);if(++totalPatches>MAX_PATCHES)throw new Error('Roof patch budget exceeded.');}nodes.push(at(f.a,t1),at(f.b,t1));}contacts.push({distance:t1,frontCountBefore:fronts.length,contactPoints:[...new Map(nodes.map(p=>[pointKey(p,tolerance),{x:p.x+origin.x,y:p.y+origin.y}])).values()]});}
    if(!complete&&wavefront(loop,xLines,yLines,maxTime+tolerance*16,tolerance,active).length)return{...result,status:'unsupported',diagnostics:['Stationary ends do not produce a completely collapsed bounded roof.']};
    const pitch=input.riseTwice/24,faces=[];
    patches.forEach((sourcePatches,sourceEdge)=>{const a=loop[sourceEdge],b=loop[(sourceEdge+1)%loop.length],len=dist(a,b),n={x:-(b.y-a.y)/len,y:(b.x-a.x)/len};for(const[j,poly]of mergePatches(sourcePatches,tolerance).entries()){const plane={a:-pitch*n.x,b:-pitch*n.y,c:1,d:-input.eaveSurfaceElevation+pitch*(n.x*(a.x+origin.x)+n.y*(a.y+origin.y))},vertices=poly.map(p=>({x:clean(p.x+origin.x,tolerance),y:clean(p.y+origin.y,tolerance),z:input.eaveSurfaceElevation+pitch*(n.x*(p.x-a.x)+n.y*(p.y-a.y))}));faces.push({id:`roof-face-${sourceEdge+1}-${j+1}`,sourceEdge,sourceEdgeKey:eave.edgeKeys[sourceEdge],vertices,plane});}});
    const rakeBoundary=eave.gableEdgeIndices.map(i=>({a:world[i],b:world[(i+1)%world.length],sourceEdge:i,sourceEdgeKey:eave.edgeKeys[i]})),edges=makeEdges(faces,tolerance);
    for(const e of edges){if(e.kind==='eave'&&rakeBoundary.some(s=>onSegment(e.a,s.a,s.b,tolerance)&&onSegment(e.b,s.a,s.b,tolerance)))e.kind='rake';if(e.kind==='hip')e.subtype=Math.min(e.a.z,e.b.z)<=input.eaveSurfaceElevation+tolerance?'outer_hip':'rising_hip';}
    if(edges.some(e=>e.subtype==='outer_hip'))return{...result,status:'unsupported',diagnostics:[`${policy} has unmet terminal gable ends. R4 does not silently create mixed gable/hip caps.`],candidates:inference.alternatives};
    const validation=validateRoofSkin({faces,edges,eaveBoundary:world,pitch,eaveSurfaceElevation:input.eaveSurfaceElevation,tolerance,rakeBoundary});validation.gablePolicy=validation.geometry==='valid'?'satisfied':'failed';
    if(validation.geometry!=='valid'||validation.drainage!=='valid')return{...result,status:'unsupported',validation,diagnostics:['Selected terminal topology failed full roof coverage, pitch, adjacency or approved-eave runoff validation.',...validation.diagnostics]};
    const bearing=input.bearingElevation??input.eaveSurfaceElevation+pitch*(input.eaveOverhang??0);if(!Number.isFinite(bearing)||Math.abs(bearing)>1e9)throw new Error('Gable bearing elevation must be finite and bounded.');
    const gableClosures=closuresForSource(faces,eave.sourceBoundary,selected,bearing,tolerance),lengthByKind={};for(const e of edges)lengthByKind[e.kind]=(lengthByKind[e.kind]??0)+dist(e.a,e.b);
    const quantities={projectedArea:validation.projectedArea,roofSurfaceArea:validation.projectedArea*Math.sqrt(1+pitch*pitch),gableClosureArea:gableClosures.reduce((s,c)=>s+c.area,0),eaveLength:lengthByKind.eave??0,rakeLength:lengthByKind.rake??0,lengthByKind,maxRoofElevation:Math.max(...faces.flatMap(f=>f.vertices.map(p=>p.z))),trussDesignManufacturingComplexitySurcharge:0,framingLumber:null,connectors:null,framingAssumptions:'Zero-thickness conceptual surfaces. No framing design or structural/clearance approval.'};
    return{...result,status:'ok',faces,edges,gableClosures,events:geometricEvents(edges,input.eaveSurfaceElevation,pitch,tolerance,contacts),validation,quantities,diagnostics:[],eaveBoundary:world,sourceBoundary:eave.sourceBoundary,gableBoundary:rakeBoundary,gableAssignments:[...assignments],gablePolicy:policy,tolerance,budget:{intervals:times.length-1,patches:totalPatches,coordinateContactBatches:contacts.length}};
  }catch(error){return{...result,status:'unsupported',diagnostics:[error.message]};}
}
