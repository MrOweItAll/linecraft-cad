/* Original analytic trim/extend geometry. Display sampling is never edit geometry. */
const EPS=1e-10,TAU=Math.PI*2;
const finite=n=>typeof n==='number'&&Number.isFinite(n),clone=v=>JSON.parse(JSON.stringify(v));
const p3=p=>{if(!p||!finite(p.x)||!finite(p.y)||p.z!==undefined&&!finite(p.z))throw Error('TRIM requires finite coordinates.');return{x:p.x,y:p.y,z:p.z??0};};
const add=(a,b,t=1)=>({x:a.x+b.x*t,y:a.y+b.y*t,z:(a.z??0)+(b.z??0)*t}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:(a.z??0)-(b.z??0)}),dot=(a,b)=>a.x*b.x+a.y*b.y+(a.z??0)*(b.z??0),cross2=(a,b)=>a.x*b.y-a.y*b.x;
const cross3=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const length=a=>Math.hypot(a.x,a.y,a.z??0),distance=(a,b)=>length(sub(a,b));
const unit=a=>{const n=length(a);if(!finite(n)||n===0)throw Error('TRIM projection axes must be nonzero.');return{x:a.x/n,y:a.y/n,z:(a.z??0)/n};};
const mod=(x,n)=>{const value=x%n;return value<0?value+n:value;},close=(a,b)=>Math.abs(a-b)<=EPS*Math.max(1,Math.abs(a),Math.abs(b));
const parameterClose=(a,b)=>a===b||Math.abs(a-b)<=Number.EPSILON*32*Math.max(Number.MIN_VALUE,Math.abs(a),Math.abs(b));
const checked=values=>{if(values.some(value=>!finite(value)))throw Error('TRIM intersection exceeds the supported numeric range.');return values;};
// An unrelated long X span must not turn a real Z gap into an intersection.
// Constant coordinates are copied exactly. Only coordinates actually computed
// by interpolation receive a small component-wise roundoff allowance.
const interpolationError=(part,t,axis)=>part.a[axis]===part.b[axis]?0:Number.EPSILON*32*(Math.abs(part.a[axis])+Math.abs((part.b[axis]-part.a[axis])*t));
const sameInterpolatedPoint=(first,t,second,s)=>{const a=rawAt(first,t),b=rawAt(second,s);return['x','y','z'].every(axis=>Math.abs(a[axis]-b[axis])<=interpolationError(first,t,axis)+interpolationError(second,s,axis));};
const clean=p=>p.z===0?{x:p.x,y:p.y}:p3(p);
export const TRIM_TARGET_TYPES=Object.freeze(['LINE','ARC','CIRCLE','PLINE','RECTANG','POLY3D']);
export function trimProjection({project='ucs',plane,view}={}){
  if(!['none','ucs','view'].includes(project))throw Error('TRIM Project must be None, UCS or View.');
  // None tests actual WCS geometry. Its native planar curve parameterization
  // must never inherit a rotated UCS or a camera projection.
  const basis=project==='none'?null:project==='view'?view:plane;
  if(project==='view'&&!basis)throw Error('TRIM Project View needs the current view projection.');
  const right=unit(p3(basis?.right??basis?.xAxis??{x:1,y:0,z:0})),up=unit(p3(basis?.up??basis?.yAxis??{x:0,y:1,z:0}));
  if(Math.abs(dot(right,up))>1e-8)throw Error('TRIM projection axes must be perpendicular.');
  return{project,right,up,point:p=>({x:dot(p3(p),right),y:dot(p3(p),up)})};
}
function parts(entity){
  if(entity.type==='LINE')return[{kind:'line',a:p3(entity.start),b:p3(entity.end),index:0}];
  if(['PLINE','RECTANG','POLY3D'].includes(entity.type)){const vertices=entity.points.map(p3),closed=entity.type==='RECTANG'||entity.closed;return vertices.slice(0,closed?vertices.length:vertices.length-1).map((a,index)=>({kind:'line',a,b:vertices[(index+1)%vertices.length],index}));}
  if(['CIRCLE','ARC'].includes(entity.type))return[{kind:'circle',center:p3(entity.center),radius:entity.radius,start:entity.type==='CIRCLE'?0:entity.startAngle*Math.PI/180,sweep:entity.type==='CIRCLE'?TAU:entity.sweepAngle*Math.PI/180,index:0,closed:entity.type==='CIRCLE'}];
  throw Error(`TRIM/EXTEND targets support LINE, ARC, CIRCLE and straight PLINE/RECTANG/POLY3D; ${entity.type} is not supported.`);
}
function boundariesOf(entities){const result=[];for(const entity of entities){if(['LINE','PLINE','RECTANG','POLY3D','ARC','CIRCLE'].includes(entity.type))result.push(...parts(entity));else if(entity.type==='HATCH')result.push(...boundariesOf([entity.boundary]));}return result;}
const rawAt=(part,t)=>part.kind==='line'?add(part.a,sub(part.b,part.a),t):{x:part.center.x+part.radius*Math.cos(part.start+part.sweep*t),y:part.center.y+part.radius*Math.sin(part.start+part.sweep*t),z:part.center.z};
const at=(part,t)=>part.cutPoints?.get(t)??rawAt(part,t);
function circleParameter(part,angle,{natural=false}={}){
  const delta=part.sweep>=0?mod(angle-part.start,TAU):mod(part.start-angle,TAU),span=Math.abs(part.sweep);
  if(part.closed)return delta/TAU;
  if(natural)return delta/span;
  if(delta<=span+EPS)return Math.min(1,delta/span);
  return null;
}
function pointParameter(part,point,projection){
  if(part.kind==='line'){const a=projection.point(part.a),b=projection.point(part.b),p=projection.point(point),d=sub(b,a),den=dot(d,d);if(den<=Number.MIN_VALUE)throw Error('The current projection collapses this target; choose Project None or another view.');return dot(sub(p,a),d)/den;}
  // Invert the analytic projected circle (an ellipse) to recover its parameter.
  const c=projection.point(part.center),u={x:part.radius*projection.right.x,y:part.radius*projection.up.x},v={x:part.radius*projection.right.y,y:part.radius*projection.up.y},d=sub(projection.point(point),c),det=cross2(u,v);
  if(Math.abs(det)<=Number.EPSILON*32*part.radius*part.radius)throw Error('The current projection collapses this circular target; choose a different projection.');
  const angle=Math.atan2(cross2(u,d)/det,cross2(d,v)/det),value=circleParameter(part,angle,{natural:true});
  if(part.closed)return value;
  const period=TAU/Math.abs(part.sweep);return value>1&&Math.abs(value-period)<Math.abs(value-1)?value-period:value;
}
function straightIntersections(first,second,projection,edgeExtend){
  if(projection.project==='none'){
    const u=sub(first.b,first.a),v=sub(second.b,second.a),delta=sub(second.a,first.a),a=length(u),b=length(v);checked([a,b,delta.x,delta.y,delta.z]);if(a===0||b===0)return[];
    const uu=unit(u),vv=unit(v),normal=cross3(uu,vv),den=length(normal);if(den===0)return[];const n=unit(normal),t=dot(cross3(delta,vv),n)/den/a,s=dot(cross3(delta,uu),n)/den/b;checked([t,s]);
    return(edgeExtend||s>=-EPS&&s<=1+EPS)&&sameInterpolatedPoint(first,t,second,s)?[t]:[];
  }
  const a=projection.point(first.a),b=projection.point(first.b),c=projection.point(second.a),d=projection.point(second.b),u=sub(b,a),v=sub(d,c),ul=length(u),vl=length(v);checked([ul,vl]);if(ul===0||vl===0)return[];
  const uu=unit(u),vv=unit(v),den=cross2(uu,vv);if(den===0)return[];
  const delta=sub(c,a),t=cross2(delta,vv)/den/ul,s=cross2(delta,uu)/den/vl;checked([t,s]);return edgeExtend||s>=-EPS&&s<=1+EPS?[t]:[];
}
function lineCircleIntersections(line,circle,projection,edgeExtend){
  // None uses the circle plane and verifies the true XYZ intersection afterwards.
  const proj=projection.project==='none'?trimProjection():projection,c=proj.point(circle.center),a=sub(proj.point(line.a),c),d=sub(proj.point(line.b),proj.point(line.a)),u={x:circle.radius*proj.right.x,y:circle.radius*proj.up.x},v={x:circle.radius*proj.right.y,y:circle.radius*proj.up.y},det=cross2(u,v);
  if(Math.abs(det)<=Number.EPSILON*32*circle.radius*circle.radius)throw Error('TRIM cannot resolve an edge-on circular boundary in this projection.');
  const x=cross2(a,v)/det,y=cross2(u,a)/det,dx=cross2(d,v)/det,dy=cross2(u,d)/det,speed=Math.hypot(dx,dy);checked([x,y,dx,dy,speed]);
  if(speed===0){if(projection.project==='none'&&line.a.z!==line.b.z){const t=(circle.center.z-line.a.z)/(line.b.z-line.a.z),hit=rawAt(line,t);if(Math.abs(Math.hypot(hit.x-circle.center.x,hit.y-circle.center.y)-circle.radius)<=Number.EPSILON*32*circle.radius&&circleParameter(circle,Math.atan2(hit.y-circle.center.y,hit.x-circle.center.x),{natural:edgeExtend})!==null)return[t];}return[];}
  const ux=dx/speed,uy=dy/speed,along=-(x*ux+y*uy),perpendicular=x*uy-y*ux,tolerance=Number.EPSILON*32*Math.max(1,Math.abs(perpendicular));checked([along,perpendicular]);if(Math.abs(perpendicular)>1+tolerance)return[];
  const perpendicularClamped=Math.max(-1,Math.min(1,perpendicular)),halfChord=Math.sqrt(Math.max(0,(1-Math.abs(perpendicularClamped))*(1+Math.abs(perpendicularClamped)))),normal=cross3(proj.right,proj.up),values=[];
  for(const sign of[-1,1]){const t=(along+sign*halfChord)/speed,nx=uy*perpendicularClamped+sign*ux*halfChord,ny=-ux*perpendicularClamped+sign*uy*halfChord,angle=Math.atan2(ny,nx),q=circleParameter(circle,angle,{natural:edgeExtend}),hit=rawAt(line,t);checked([t,nx,ny]);if(q===null||projection.project==='none'&&Math.abs(hit.z-circle.center.z)>interpolationError(line,t,'z'))continue;
    const onCircle={x:circle.center.x+circle.radius*nx,y:circle.center.y+circle.radius*ny,z:circle.center.z},depth=dot(line.a,normal)+dot(sub(line.b,line.a),normal)*t-dot(onCircle,normal),point=projection.project==='none'?onCircle:add(onCircle,normal,depth);p3(point);if(!line.cutPoints)line.cutPoints=new Map();line.cutPoints.set(t,point);values.push(t);
  }return values;
}
function circleIntersections(first,second,projection,edgeExtend){
  // Both native planar curves have the same World XY plane. A nonsingular
  // orthographic projection preserves their intersection parameters exactly.
  if(projection.project==='none'&&first.center.z!==second.center.z)return[];
  const x=second.center.x-first.center.x,y=second.center.y-first.center.y,d=Math.hypot(x,y),r=first.radius,s=second.radius;if(d===0||d>r+s+EPS||d<Math.abs(r-s)-EPS)return[];
  const along=(d+(r-s)*(r+s)/d)/2,difference=Math.abs(r-d),sum=r+d,factors=[s-difference,s+difference,sum-s,sum+s];checked([along,...factors]);if(factors.some(value=>value<0))return[];
  const h=(Math.sqrt(factors[0])*Math.sqrt(factors[1]))*(Math.sqrt(factors[2])*Math.sqrt(factors[3])/d)/2;checked([h]);const base={x:first.center.x+x*along/d,y:first.center.y+y*along/d,z:first.center.z};
  return[-1,1].map(sign=>({x:base.x-sign*y*h/d,y:base.y+sign*x*h/d,z:base.z})).flatMap(hit=>{const b=circleParameter(second,Math.atan2(hit.y-second.center.y,hit.x-second.center.x),{natural:edgeExtend});if(b===null)return[];const q=circleParameter(first,Math.atan2(hit.y-first.center.y,hit.x-first.center.x),{natural:true});return[q];});
}
function cutParameters(part,boundary,projection,edgeExtend){
  let values;if(part.kind==='line'&&boundary.kind==='line')values=straightIntersections(part,boundary,projection,edgeExtend);
  else if(part.kind==='line')values=lineCircleIntersections(part,boundary,projection,edgeExtend);
  else if(boundary.kind==='line')values=lineCircleIntersections(boundary,part,projection,true).flatMap(t=>{if(!edgeExtend&&(t< -EPS||t>1+EPS))return[];return[pointParameter(part,at(boundary,t),projection)];});
  else values=circleIntersections(part,boundary,projection,edgeExtend);return checked(values);
}
const unique=values=>checked(values).sort((a,b)=>a-b).filter((value,index,all)=>!index||!parameterClose(value,all[index-1]));
function pathFragment(source,path,start,end){
  const span=path.length,part0=path[0];
  if(part0.kind==='circle'){
    const result={...clone(source),type:'ARC',startAngle:mod((part0.start+part0.sweep*start)*180/Math.PI,360),sweepAngle:part0.sweep*(end-start)*180/Math.PI};return result;
  }
  const pointAt=q=>{const index=Math.min(span-1,Math.max(0,Math.floor(q))),fraction=q-index;return clean(at(path[index],fraction));};
  const points=[pointAt(start)];for(let i=Math.floor(start)+1;i<end;i++)points.push(pointAt(i));points.push(pointAt(end));
  if(source.type==='LINE')return{...clone(source),start:points[0],end:points.at(-1)};
  return{...clone(source),type:source.type==='POLY3D'?'POLY3D':'PLINE',points:source.type==='POLY3D'?points.map(p3):points,closed:false};
}
function closestPathParameter(path,pick,projection,details=false){
  let best=null;for(const part of path){const t=projection.project==='none'&&part.kind==='line'?dot(sub(pick,part.a),sub(part.b,part.a))/dot(sub(part.b,part.a),sub(part.b,part.a)):pointParameter(part,pick,projection);checked([t]);const bounded=part.kind==='circle'&&part.closed?mod(t,1):Math.max(0,Math.min(1,t)),point=at(part,bounded),a=projection.point(point),b=projection.point(pick),error=projection.project==='none'?distance(point,pick):Math.hypot(a.x-b.x,a.y-b.y);checked([error]);if(!best||error<best.error)best={q:part.index+bounded,error};}return details?best:best.q;
}
export function trimTargetDistance(source,pick,options={}){return closestPathParameter(parts(source),p3(pick),trimProjection(options),true).error;}
export function trimEntityGeometry(source,boundaries,rawPick,options={}){
  if(!TRIM_TARGET_TYPES.includes(source.type))throw Error(`TRIM/EXTEND does not support ${source.type} targets. Use an ordinary straight or circular path; no approximation was applied.`);
  const path=parts(source),projection=trimProjection(options),pick=p3(rawPick),span=path.length,closed=source.type==='CIRCLE'||source.type==='RECTANG'||source.closed===true,boundaryParts=boundariesOf(boundaries.filter(boundary=>boundary.id!==source.id)),q=closestPathParameter(path,pick,projection),edgeExtend=options.edgeExtend===true;
  if(!path.length)throw Error('Target path has no editable segments.');
  const cuts=unique(path.flatMap(part=>boundaryParts.flatMap(boundary=>cutParameters(part,boundary,projection,edgeExtend).flatMap(t=>part.kind==='circle'&&part.closed?[mod(t,1)]:t>=-EPS&&t<=1+EPS?[part.index+Math.max(0,Math.min(1,t))]:[])))).map(t=>closed?mod(t,span):t).sort((a,b)=>a-b).filter((t,i,a)=>!i||!parameterClose(t,a[i-1]));
  if(options.extend){
    if(closed)throw Error('A closed target cannot be extended.');
    const start=q<=span/2,part=start?path[0]:path.at(-1),natural=unique(boundaryParts.flatMap(boundary=>cutParameters(part,boundary,projection,edgeExtend))),period=part.kind==='circle'?TAU/Math.abs(part.sweep):null;
    const values=part.kind==='circle'?unique(natural.flatMap(t=>[t,t-period,t+period])):natural;
    const candidates=values.filter(t=>start?t<0:t>1).filter(t=>part.kind!=='circle'||Math.abs(part.sweep*(start?1-t:t))<TAU-EPS);
    if(!candidates.length)throw Error('No boundary intersects beyond the selected path end.');const t=start?Math.max(...candidates):Math.min(...candidates);
    if(part.kind==='circle')return[pathFragment(source,path,start?t:0,start?1:t)];
    if(source.type==='LINE')return[{...clone(source),[start?'start':'end']:clean(at(part,t))}];
    const result=clone(source);result.points[start?0:result.points.length-1]=source.type==='POLY3D'?p3(at(part,t)):clean(at(part,t));return[result];
  }
  if(closed){
    if(cuts.length<2)throw Error('No distinct cutting interval intersects this closed target.');
    if(cuts.some(cut=>parameterClose(q,cut)))throw Error('Pick the portion to remove away from the cutting edge.');
    const low=[...cuts].reverse().find(cut=>cut<q)??cuts.at(-1)-span,high=cuts.find(cut=>cut>q)??cuts[0]+span;
    if(path[0].kind==='circle')return[pathFragment(source,path,high,low+span)];
    const doubled=[...path,...path.map(part=>({...part,index:part.index+span}))];return[pathFragment(source,doubled,mod(high,span),mod(low,span)+(mod(low,span)<=mod(high,span)?span:0))];
  }
  const interior=cuts.filter(cut=>cut>0&&cut<span);if(!interior.length)throw Error('No cutting edge intersects the interior of this target.');if(interior.some(cut=>parameterClose(q,cut)))throw Error('Pick the portion to remove away from the cutting edge.');
  const partition=[0,...interior,span],i=partition.findIndex((value,index)=>index<partition.length-1&&q>=value&&q<=partition[index+1]),low=partition[Math.max(0,i)],high=partition[Math.max(0,i)+1],result=[];
  if(low>0)result.push(pathFragment(source,path,0,low));if(high<span)result.push(pathFragment(source,path,high,span));return result;
}
/** Analytic fence intersections ordered from the first fence point. */
export function trimFenceHits(entities,points,options={}){
  if(!Array.isArray(points)||points.length<2||points.length>4096)throw Error('Fence requires 2..4096 finite points.');
  const projection=trimProjection(options),fence=points.map(p3),hits=[];
  for(let i=0;i<fence.length-1;i++){
    const line={kind:'line',a:fence[i],b:fence[i+1]};if(distance(line.a,line.b)<=Number.MIN_VALUE)continue;
    for(const source of entities){let path;try{path=parts(source);}catch{continue;}for(const part of path)for(const t of cutParameters(line,part,projection,false))if(t>=-EPS&&t<=1+EPS){const picked=at(line,Math.max(0,Math.min(1,t))),q=pointParameter(part,picked,projection),onTarget=at(part,part.kind==='circle'&&part.closed?mod(q,1):Math.max(0,Math.min(1,q)));hits.push({id:source.id,point:clean(onTarget),order:i+t});}}
  }
  hits.sort((a,b)=>a.order-b.order);return hits.filter((hit,index)=>!hits.slice(0,index).some(prior=>prior.id===hit.id&&distance(prior.point,hit.point)<=EPS));
}
