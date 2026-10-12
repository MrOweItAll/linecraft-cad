/* Original planar curves, clipping and corner construction. No dependencies. */
const TAU=Math.PI*2,finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>{if(!p||!finite(p.x)||!finite(p.y)||p.z!==undefined&&p.z!==0)throw Error('Planar geometry requires finite XY coordinates.');return{x:p.x,y:p.y};};
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
const plus=(a,b,k=1)=>point({x:a.x+k*b.x,y:a.y+k*b.y});
const delta=(a,b)=>point({x:a.x-b.x,y:a.y-b.y});
const normalize=v=>{const length=Math.hypot(v.x,v.y);if(!finite(length)||!length)throw Error('A finite nonzero direction is required.');return{x:v.x/length,y:v.y/length};};
export function validateEllipse(entity){
  point(entity.center);point(entity.major);const length=Math.hypot(entity.major.x,entity.major.y);
  if(!finite(length)||length<=0||!finite(entity.ratio)||entity.ratio<=0||entity.ratio>1||!finite(length*entity.ratio)||length*entity.ratio===0)throw Error('ELLIPSE requires finite nonzero axes and ratio greater than zero through one.');
  ellipseBoundsPoints(entity).forEach(point);return entity;
}
export function ellipsePoint(entity,fraction){
  if(!finite(fraction))throw Error('Ellipse parameter must be finite.');const angle=TAU*fraction,c=Math.cos(angle),s=Math.sin(angle),a=entity.major;
  return point({x:entity.center.x+a.x*c-a.y*entity.ratio*s,y:entity.center.y+a.y*c+a.x*entity.ratio*s});
}
export function ellipseBoundsPoints(entity){
  const a=entity.major,b={x:-a.y*entity.ratio,y:a.x*entity.ratio},tx=Math.atan2(b.x,a.x)/TAU,ty=Math.atan2(b.y,a.y)/TAU;
  return[tx,tx+.5,ty,ty+.5].map(t=>ellipsePoint(entity,t));
}
export function makeClampedKnots(count){
  if(!Number.isInteger(count)||count<4||count>1024)throw Error('SPLINE requires 4..1024 control vertices.');const spans=count-3;return[0,0,0,0,...Array.from({length:count-4},(_,i)=>(i+1)/spans),1,1,1,1];
}
export function validateSpline(entity){
  if(entity.degree!==3||entity.closed!==false||!Array.isArray(entity.controlPoints)||entity.controlPoints.length<4||entity.controlPoints.length>1024)throw Error('SPLINE supports an open cubic curve with 4..1024 control vertices.');
  entity.controlPoints.forEach(point);if(entity.controlPoints.every(p=>p.x===entity.controlPoints[0].x&&p.y===entity.controlPoints[0].y))throw Error('SPLINE control vertices cannot all coincide.');
  const k=entity.knots;if(!Array.isArray(k)||k.length!==entity.controlPoints.length+4||k.some((v,i)=>!finite(v)||v<0||v>1||i&&v<k[i-1])||k.slice(0,4).some(v=>v!==0)||k.slice(-4).some(v=>v!==1))throw Error('SPLINE needs a nondecreasing clamped knot vector over 0..1.');
  const internal=k.slice(4,-4);if(internal.some(v=>v<=0||v>=1)||internal.some((v,i)=>i>=3&&v===internal[i-3]))throw Error('Internal cubic knot multiplicity cannot exceed three.');return entity;
}
/** de Boor evaluates the stored cubic B-spline; display sampling is separate. */
export function splinePoint(entity,t){
  if(!finite(t)||t<0||t>1)throw Error('Spline parameter must be between zero and one.');const p=3,controls=entity.controlPoints,k=entity.knots,n=controls.length-1;if(t===1)return point(controls[n]);
  let span=p;while(span<n&&t>=k[span+1])span++;const d=Array.from({length:4},(_,j)=>point(controls[span-p+j]));
  for(let r=1;r<=p;r++)for(let j=p;j>=r;j--){const i=span-p+j,den=k[i+p-r+1]-k[i],a=den===0?0:(t-k[i])/den;d[j]=point({x:(1-a)*d[j-1].x+a*d[j].x,y:(1-a)*d[j-1].y+a*d[j].y});}return d[p];
}
/** Every nonzero knot span is an exact cubic polynomial/Bézier segment. */
export function splineBezierSegments(entity){
  const k=[...new Set(entity.knots)],segments=[];
  for(let i=0;i<k.length-1;i++){const a=k[i],b=k[i+1];if(a===b)continue;const p0=splinePoint(entity,a),p3=splinePoint(entity,b),q1=delta(splinePoint(entity,a+(b-a)/3),p0),q2=delta(splinePoint(entity,a+2*(b-a)/3),p0),end=delta(p3,p0);
    segments.push([p0,point({x:p0.x+3*q1.x-1.5*q2.x+end.x/3,y:p0.y+3*q1.y-1.5*q2.y+end.y/3}),point({x:p0.x-1.5*q1.x+3*q2.x-5*end.x/6,y:p0.y-1.5*q1.y+3*q2.y-5*end.y/6}),p3]);
  }return segments;
}
function bezierPoint(points,t){const s=1-t;return point({x:s*s*s*points[0].x+3*s*s*t*points[1].x+3*s*t*t*points[2].x+t*t*t*points[3].x,y:s*s*s*points[0].y+3*s*s*t*points[1].y+3*s*t*t*points[2].y+t*t*t*points[3].y});}
export function splineBoundsPoints(entity){
  const result=[];for(const p of splineBezierSegments(entity)){result.push(p[0],p[3]);for(const axis of ['x','y']){const values=p.map(v=>v[axis]-p[0][axis]),scale=Math.max(...values.map(Math.abs));if(!finite(scale))throw Error('Spline bounds exceed the supported numeric range.');if(scale===0)continue;const q=values.map(v=>v/scale),a=3*(-q[0]+3*q[1]-3*q[2]+q[3]),b=6*(q[0]-2*q[1]+q[2]),c=3*(q[1]-q[0]);let roots=[];
    if(Math.abs(a)<=Number.EPSILON*Math.max(Math.abs(b),Math.abs(c)))roots=b===0?[]:[-c/b];else{const disc=b*b-4*a*c;if(disc>=0&&finite(disc)){const root=Math.sqrt(disc),v=-.5*(b+Math.sign(b||1)*root);roots=v===0?[-b/(2*a)]:[v/a,c/v];}}
    for(const t of roots)if(t>0&&t<1)result.push(bezierPoint(p,t));
  }}return result;
}
export function sampleCurve(entity,count=128){
  if(!Number.isInteger(count)||count<8||count>4096)throw Error('Curve sampling count must be 8..4096.');const evaluate=entity.type==='ELLIPSE'?ellipsePoint:entity.type==='SPLINE'?splinePoint:null;if(!evaluate)throw Error('Unsupported curve type.');return Array.from({length:count+1},(_,i)=>evaluate(entity,i/count));
}
export function boundaryPolygon(boundary,count=128){
  if(['RECTANG','PLINE'].includes(boundary.type)){if(!Array.isArray(boundary.points)||boundary.points.length>4096)throw Error('HATCH boundary exceeds the 4096-vertex limit.');return boundary.points.map(point);}
  if(boundary.type==='ELLIPSE')return sampleCurve(boundary,count).slice(0,-1);
  if(boundary.type==='CIRCLE')return Array.from({length:count},(_,i)=>point({x:boundary.center.x+boundary.radius*Math.cos(TAU*i/count),y:boundary.center.y+boundary.radius*Math.sin(TAU*i/count)}));
  throw Error('HATCH supports a closed RECTANG/PLINE, CIRCLE or ELLIPSE boundary.');
}
export function boundaryContains(boundary,p){
  point(p);if(boundary.type==='CIRCLE')return Math.hypot(p.x-boundary.center.x,p.y-boundary.center.y)<=boundary.radius;
  if(boundary.type==='ELLIPSE'){const a=Math.hypot(boundary.major.x,boundary.major.y),u={x:boundary.major.x/a,y:boundary.major.y/a},d=delta(p,boundary.center),x=dot(d,u)/a,y=cross(u,d)/(a*boundary.ratio);return x*x+y*y<=1;}
  const polygon=boundaryPolygon(boundary);let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],v=delta(b,a),d=delta(p,a);if(cross(v,d)===0&&dot(d,v)>=0&&dot(d,v)<=dot(v,v))return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;
}
export function hatchGeometry(entity){
  const boundary=entity.boundary,polygon=boundaryPolygon(boundary),origin=point(entity.origin),angle=entity.angle*Math.PI/180,u={x:Math.cos(angle),y:Math.sin(angle)},v={x:-u.y,y:u.x};
  if(entity.pattern==='solid')return{segments:[],fills:[{points:polygon,closed:true}],paths:[],texts:[]};
  if(entity.pattern!=='parallel'||!finite(entity.spacing)||entity.spacing<=0||!finite(entity.angle))throw Error('HATCH requires solid or parallel pattern, finite angle and positive spacing.');
  let min,max;if(['CIRCLE','ELLIPSE'].includes(boundary.type)){const c=dot(delta(boundary.center,origin),v),radius=boundary.type==='CIRCLE'?boundary.radius:Math.hypot(dot(boundary.major,v),dot({x:-boundary.major.y*boundary.ratio,y:boundary.major.x*boundary.ratio},v));min=c-radius;max=c+radius;}else{const values=polygon.map(p=>dot(delta(p,origin),v));min=Math.min(...values);max=Math.max(...values);}
  const first=Math.ceil(min/entity.spacing),last=Math.floor(max/entity.spacing);if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||last-first>5000)throw Error('HATCH pattern exceeds the 5000-line or safe-index limit; increase spacing or move its origin.');const segments=[],append=segment=>{if(segments.length>=5000)throw Error('HATCH pattern exceeds the 5000-segment limit; increase spacing.');segments.push(segment);};
  for(let index=first;index<=last;index++){const offset=index*entity.spacing;if(!finite(offset))throw Error('HATCH pattern coordinates exceed the numeric range.');let intersections=[];
    if(['CIRCLE','ELLIPSE'].includes(boundary.type)){const c=boundary.center,d=offset-dot(delta(c,origin),v),q=plus(c,v,d),a=boundary.type==='CIRCLE'?{x:boundary.radius,y:0}:boundary.major,r=boundary.type==='CIRCLE'?1:boundary.ratio,length=Math.hypot(a.x,a.y),axis={x:a.x/length,y:a.y/length},qd=delta(q,c),vx=dot(u,axis)/length,vy=cross(axis,u)/(length*r),norm=Math.hypot(vx,vy),dx=vx/norm,dy=vy/norm,x=dot(qd,axis)/length,y=cross(axis,qd)/(length*r),B=x*dx+y*dy,C=x*x+y*y-1,disc=B*B-C;
      if(!finite(norm)||norm===0||!finite(B)||!finite(C)||!finite(disc))throw Error('HATCH ellipse clipping exceeds the supported numeric range.');
      if(disc>0){const root=Math.sqrt(disc);intersections=[(-B-root)/norm,(-B+root)/norm];append(intersections.map(t=>plus(q,u,t)));}continue;
    }
    for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],pa=dot(delta(a,origin),v),pb=dot(delta(b,origin),v);if((pa<=offset&&pb>offset)||(pb<=offset&&pa>offset)){const t=(offset-pa)/(pb-pa),hit=point({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});intersections.push(dot(delta(hit,origin),u));}}
    intersections.sort((a,b)=>a-b);for(let i=0;i+1<intersections.length;i+=2){const base=plus(origin,v,offset);append([plus(base,u,intersections[i]),plus(base,u,intersections[i+1])]);}
  }return{segments,fills:[],paths:[],texts:[]};
}
function corner(line1,line2,pick1,pick2){
  if(line1.type!=='LINE'||line2.type!=='LINE'||line1.id&&line1.id===line2.id)throw Error('Choose two different LINEs.');const u=normalize(delta(line1.end,line1.start)),v=normalize(delta(line2.end,line2.start)),det=cross(u,v);if(Math.abs(det)<=Number.EPSILON*64)throw Error('Parallel/collinear LINEs have no unique corner.');
  const hit=plus(line1.start,u,cross(delta(line2.start,line1.start),v)/det);const ray=(line,pick,axis)=>{const sign=Math.sign(dot(delta(point(pick),hit),axis));if(sign===0)throw Error('Pick away from the exact intersection to identify the retained side.');return{x:axis.x*sign,y:axis.y*sign};};return{hit,r1:ray(line1,pick1,u),r2:ray(line2,pick2,v)};
}
function retainedLine(line,hit,ray,tangent){
  const ds=dot(delta(line.start,hit),ray),de=dot(delta(line.end,hit),ray),distance=dot(delta(tangent,hit),ray),far=Math.max(ds,de);if(distance>=far)throw Error('Corner treatment would consume the retained LINE.');
  return{...line,start:ds>de?point(line.start):point(tangent),end:de>=ds?point(line.end):point(tangent)};
}
export function filletLines(line1,line2,pick1,pick2,radius){
  if(!finite(radius)||radius<0)throw Error('FILLET radius must be finite and nonnegative.');const{hit,r1,r2}=corner(line1,line2,pick1,pick2),cos=Math.max(-1,Math.min(1,dot(r1,r2))),theta=Math.acos(cos);if(theta<=Number.EPSILON*64||Math.PI-theta<=Number.EPSILON*64)throw Error('The selected corner is degenerate.');
  const d=radius/Math.tan(theta/2),t1=plus(hit,r1,d),t2=plus(hit,r2,d),first=retainedLine(line1,hit,r1,t1),second=retainedLine(line2,hit,r2,t2);if(radius===0)return{first,second,arc:null};
  const center=plus(hit,normalize(plus(r1,r2)),radius/Math.sin(theta/2)),startAngle=Math.atan2(t1.y-center.y,t1.x-center.x)*180/Math.PI,sweepAngle=-Math.sign(cross(r1,r2))*(180-theta*180/Math.PI);
  return{first,second,arc:{type:'ARC',center,radius,startAngle,sweepAngle,layer:line1.layer,...(line1.color?{color:line1.color}:{}),...(line1.lineweight!==undefined?{lineweight:line1.lineweight}:{})}};
}
export function chamferLines(line1,line2,pick1,pick2,distance1,distance2){
  if(!finite(distance1)||!finite(distance2)||distance1<0||distance2<0)throw Error('CHAMFER distances must be finite and nonnegative.');const{hit,r1,r2}=corner(line1,line2,pick1,pick2),t1=plus(hit,r1,distance1),t2=plus(hit,r2,distance2),first=retainedLine(line1,hit,r1,t1),second=retainedLine(line2,hit,r2,t2);
  return{first,second,connector:t1.x===t2.x&&t1.y===t2.y?null:{type:'LINE',start:t1,end:t2,layer:line1.layer,...(line1.color?{color:line1.color}:{}),...(line1.lineweight!==undefined?{lineweight:line1.lineweight}:{})}};
}
