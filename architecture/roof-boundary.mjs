/* Original bounded rectilinear roof-boundary operations. Coordinates stay in model units. */
export const MAX_ROOF_BOUNDARY_EDGES=48;
// Translate before multiplying: a one-unit model at survey coordinates must
// retain its area rather than subtracting nearly equal 1e18 products.
export const signedArea=loop=>{if(!loop.length)return 0;const o=loop[0];return loop.reduce((s,a,i)=>{const b=loop[(i+1)%loop.length];return s+(a.x-o.x)*(b.y-o.y)-(b.x-o.x)*(a.y-o.y);},0)/2;};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function pointInLoop(p,loop,tolerance=0){
  let inside=false;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[j],b=loop[i];
    if(Math.abs(cross(a,b,p))<=tolerance*Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))&&p.x>=Math.min(a.x,b.x)-tolerance&&p.x<=Math.max(a.x,b.x)+tolerance&&p.y>=Math.min(a.y,b.y)-tolerance&&p.y<=Math.max(a.y,b.y)+tolerance)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
function fail(message,status='unsupported'){const error=new Error(message);error.status=status;throw error;}
export function normalizeRoofBoundary(raw,{tolerance=1e-8,maxEdges=MAX_ROOF_BOUNDARY_EDGES}={}){
  if(!Number.isFinite(tolerance)||tolerance<=0)fail('Roof tolerance must be positive and finite.','infeasible');
  if(!Array.isArray(raw)||raw.length<4||raw.length>maxEdges)fail(`Roof boundary requires 4 through ${maxEdges} orthogonal vertices.`);
  let loop=raw.map(p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e9||Math.abs(p.y)>1e9)fail('Roof coordinates must be finite and bounded.','infeasible');return{x:p.x,y:p.y};});
  for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length],dx=b.x-a.x,dy=b.y-a.y;
    if(Math.hypot(dx,dy)<=tolerance)fail('Roof boundary contains a duplicate or zero-length edge.','infeasible');
    // Deliberately do not round/snap oblique source geometry to an axis.
    if(dx!==0&&dy!==0)fail('R2 roof boundary must be exactly orthogonal in its declared building frame.');
    const c=loop[(i+2)%loop.length];if(cross(a,b,c)===0)fail('Roof boundary contains redundant or reversed collinear edges.','infeasible');
  }
  for(let i=0;i<loop.length;i++)for(let j=i+1;j<loop.length;j++){
    if(j===i+1||i===0&&j===loop.length-1)continue;
    const a=loop[i],b=loop[(i+1)%loop.length],c=loop[j],d=loop[(j+1)%loop.length];
    const overlap=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+tolerance&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+tolerance;
    if(overlap&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)fail('Roof boundary self-intersects or touches itself.','infeasible');
  }
  if(Math.abs(signedArea(loop))<=tolerance*tolerance)fail('Roof boundary has zero area.','infeasible');
  if(signedArea(loop)<0)loop.reverse();
  return loop;
}
/** Mitered offset. A notch closure is a coverage decision, never an automatic bridge. */
export function deriveEaveBoundary(boundary,eaveOverhang=0,options={}){
  try{
    const tolerance=options.tolerance??1e-8,source=normalizeRoofBoundary(boundary,options);
    if(!Number.isFinite(eaveOverhang)||eaveOverhang<0||eaveOverhang>1e8)fail('Eave overhang must be finite and nonnegative.','infeasible');
    const edges=source.map((a,i)=>{const b=source[(i+1)%source.length],len=Math.hypot(b.x-a.x,b.y-a.y);return{a,b,n:{x:-(b.y-a.y)/len,y:(b.x-a.x)/len}};});
    const loop=source.map((a,i)=>{const previous=edges[(i+edges.length-1)%edges.length],next=edges[i];return{x:a.x-eaveOverhang*(previous.n.x+next.n.x),y:a.y-eaveOverhang*(previous.n.y+next.n.y)};});
    try{normalizeRoofBoundary(loop,options);}catch(error){if(eaveOverhang>0)fail('Eave overhang closes a recess or changes coverage topology; choose coverage explicitly.','needs-decision');throw error;}
    for(let i=0;i<loop.length;i++){
      const a=loop[i],b=loop[(i+1)%loop.length],old=edges[i];
      if((b.x-a.x)*(old.b.x-old.a.x)+(b.y-a.y)*(old.b.y-old.a.y)<=tolerance*tolerance)fail('Eave overhang consumes a boundary edge or closes a recess; choose coverage explicitly.','needs-decision');
    }
    return{status:'ok',boundary:loop,sourceBoundary:source,sourceEdgeMap:edges.map((_,i)=>i),diagnostics:[]};
  }catch(error){return{status:error.status??'failed',boundary:[],diagnostics:[error.message]};}
}
/** Geometry identity survives winding and cyclic index changes, not edits. */
export function roofBoundaryEdgeKey(a,b){
  const key=p=>`${Object.is(p.x,-0)?0:p.x},${Object.is(p.y,-0)?0:p.y}`,ka=key(a),kb=key(b);
  return ka<kb?`edge:${ka}|${kb}`:`edge:${kb}|${ka}`;
}
/** Separate eave and rake offsets, with an unchanged source-edge identity. */
export function deriveGableBoundary(boundary,{eaveOverhang=0,rakeOverhang=0,gableAssignments=[]}={},options={}){
  try{
    const tolerance=options.tolerance??1e-8,source=normalizeRoofBoundary(boundary,options);
    if(![eaveOverhang,rakeOverhang].every(v=>Number.isFinite(v)&&v>=0&&v<=1e8))fail('Eave and rake overhangs must be finite and nonnegative.','infeasible');
    if(!Array.isArray(gableAssignments)||new Set(gableAssignments).size!==gableAssignments.length)fail('Confirmed gable edge keys must be a unique array.','infeasible');
    const keys=source.map((a,i)=>roofBoundaryEdgeKey(a,source[(i+1)%source.length])),selected=new Set(gableAssignments);
    if(gableAssignments.some(k=>!keys.includes(k)))fail('A confirmed gable edge no longer matches the boundary; review the assignment.','needs-decision');
    const edges=source.map((a,i)=>{const b=source[(i+1)%source.length],len=Math.hypot(b.x-a.x,b.y-a.y);return{a,b,key:keys[i],gable:selected.has(keys[i]),offset:selected.has(keys[i])?rakeOverhang:eaveOverhang,n:{x:-(b.y-a.y)/len,y:(b.x-a.x)/len}};});
    const loop=source.map((a,i)=>{const p=edges[(i+edges.length-1)%edges.length],n=edges[i];return{x:a.x-p.offset*p.n.x-n.offset*n.n.x,y:a.y-p.offset*p.n.y-n.offset*n.n.y};});
    try{normalizeRoofBoundary(loop,options);}catch(error){if(eaveOverhang||rakeOverhang)fail('Overhang closes a recess or changes coverage topology; choose coverage explicitly.','needs-decision');throw error;}
    for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],old=edges[i];if((b.x-a.x)*(old.b.x-old.a.x)+(b.y-a.y)*(old.b.y-old.a.y)<=tolerance*tolerance)fail('Overhang consumes a boundary edge; choose coverage explicitly.','needs-decision');}
    return{status:'ok',boundary:loop,sourceBoundary:source,sourceEdgeMap:edges.map((_,i)=>i),edgeKeys:keys,gableEdgeIndices:edges.flatMap((e,i)=>e.gable?[i]:[]),diagnostics:[]};
  }catch(error){return{status:error.status??'failed',boundary:[],diagnostics:[error.message]};}
}
