/* Original orthonormal construction-plane math. Coordinates are WCS unless
 * explicitly converted with these helpers. No external matrix library. */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>{if(!p||![p.x,p.y,p.z===undefined?0:p.z].every(finite))throw Error('Plane coordinates must be finite XYZ.');return{x:p.x,y:p.y,z:p.z===undefined?0:p.z};};
const add=(a,b)=>point({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const subtract=(a,b)=>point({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const multiply=(a,n)=>point({x:a.x*n,y:a.y*n,z:a.z*n});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>point({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const normalized=a=>{const length=Math.hypot(a.x,a.y,a.z);if(!finite(length)||!length)throw Error('UCS axis must be nonzero and finite.');return multiply(a,1/length);};
export function presetUCS(name='XY',origin={x:0,y:0,z:0}){
  const axes={XY:[{x:1,y:0,z:0},{x:0,y:1,z:0}],XZ:[{x:1,y:0,z:0},{x:0,y:0,z:1}],YZ:[{x:0,y:1,z:0},{x:0,y:0,z:1}]}[name];if(!axes)throw Error('UCS plane must be XY, XZ or YZ.');return{origin:point(origin),xAxis:{...axes[0]},yAxis:{...axes[1]},zAxis:cross(...axes)};
}
export function normalizeUCS(raw=presetUCS()){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('UCS must be an orthonormal coordinate system.');
  const origin=point(raw.origin),xAxis=point(raw.xAxis),yAxis=point(raw.yAxis),zAxis=raw.zAxis===undefined?cross(xAxis,yAxis):point(raw.zAxis),expected=cross(xAxis,yAxis);
  if([xAxis,yAxis,zAxis].some(axis=>Math.abs(Math.hypot(axis.x,axis.y,axis.z)-1)>1e-10)||Math.abs(dot(xAxis,yAxis))>1e-10||Math.hypot(zAxis.x-expected.x,zAxis.y-expected.y,zAxis.z-expected.z)>1e-10)throw Error('UCS axes must be unit, perpendicular and right-handed.');
  return{origin,xAxis,yAxis,zAxis};
}
export function ucsFromThreePoints(origin,first,second){
  origin=point(origin);const xAxis=normalized(subtract(point(first),origin)),toward=subtract(point(second),origin),orthogonal=subtract(toward,multiply(xAxis,dot(toward,xAxis)));
  const length=Math.hypot(orthogonal.x,orthogonal.y,orthogonal.z);if(length<=Number.EPSILON*32*Math.hypot(toward.x,toward.y,toward.z))throw Error('Three UCS points must be distinct and noncollinear.');
  const yAxis=normalized(orthogonal);return normalizeUCS({origin,xAxis,yAxis,zAxis:cross(xAxis,yAxis)});
}
export function constructionPlane(ucs=presetUCS(),elevation=0){ucs=normalizeUCS(ucs);if(!finite(elevation))throw Error('Plane elevation must be finite.');return{origin:add(ucs.origin,multiply(ucs.zAxis,elevation)),xAxis:ucs.xAxis,yAxis:ucs.yAxis,normal:ucs.zAxis};}
export function planeToWorld(raw,plane){const p=point(raw),normal=plane.normal??plane.zAxis;return add(add(add(point(plane.origin),multiply(point(plane.xAxis),p.x)),multiply(point(plane.yAxis),p.y)),multiply(point(normal),p.z));}
export function worldToPlane(raw,plane){const p=subtract(point(raw),point(plane.origin)),normal=plane.normal??plane.zAxis;return point({x:dot(p,plane.xAxis),y:dot(p,plane.yAxis),z:dot(p,normal)});}
export function intersectPlaneRay(ray,plane){const origin=point(ray.origin),direction=point(ray.direction),normal=point(plane.normal??plane.zAxis),denominator=dot(direction,normal);if(Math.abs(denominator)<=1e-12*Math.hypot(direction.x,direction.y,direction.z))return null;const t=dot(subtract(point(plane.origin),origin),normal)/denominator;if(!finite(t)||ray.perspective&&t<0)return null;try{return add(origin,multiply(direction,t));}catch{return null;}}
export function planeCamera(plane){const normal=point(plane.normal??plane.zAxis),yaw=Math.abs(normal.x)+Math.abs(normal.y)<1e-12?-90:Math.atan2(normal.y,normal.x)*180/Math.PI,pitch=Math.atan2(normal.z,Math.hypot(normal.x,normal.y))*180/Math.PI,r=yaw*Math.PI/180,p=pitch*Math.PI/180,right={x:-Math.sin(r),y:Math.cos(r),z:0},up={x:-Math.cos(r)*Math.sin(p),y:-Math.sin(r)*Math.sin(p),z:Math.cos(p)},roll=Math.atan2(dot(plane.xAxis,up),dot(plane.xAxis,right))*180/Math.PI;return{target:point(plane.origin),yaw,pitch,roll,mode:'custom',projection:'orthographic'};}
const wrap=value=>((value%360)+360)%360;
const trig=angle=>{const a=wrap(angle);return a===0?[1,0]:a===90?[0,1]:a===180?[-1,0]:a===270?[0,-1]:[Math.cos(a*Math.PI/180),Math.sin(a*Math.PI/180)];};
export function spatialCurvePoint(entity,fraction){if(!finite(fraction))throw Error('Curve parameter must be finite.');const[c,s]=trig((entity.startAngle??0)+fraction*(entity.type==='ARC3D'?entity.sweepAngle:360));return add(point(entity.center),add(multiply(point(entity.xAxis),entity.radius*c),multiply(point(entity.yAxis),entity.radius*s)));}
export function spatialAngleOnArc(entity,angle){if(entity.type!=='ARC3D')return true;const distance=entity.sweepAngle>0?wrap(angle-entity.startAngle):wrap(entity.startAngle-angle);return distance<=Math.abs(entity.sweepAngle)+1e-10;}
export function spatialCurveBounds(entity){
  const points=entity.type==='ARC3D'?[spatialCurvePoint(entity,0),spatialCurvePoint(entity,1)]:[];
  for(const axis of ['x','y','z']){const angle=Math.atan2(entity.yAxis[axis],entity.xAxis[axis])*180/Math.PI;for(const a of [angle,angle+180])if(spatialAngleOnArc(entity,a)){const[c,s]=trig(a);points.push(add(point(entity.center),add(multiply(entity.xAxis,entity.radius*c),multiply(entity.yAxis,entity.radius*s))));}}return points;
}
export function validateSpatialCurve(entity){
  if(!entity||!['CIRCLE3D','ARC3D'].includes(entity.type)||!finite(entity.radius)||entity.radius<=0)throw Error('Spatial circle/arc needs a positive finite radius.');
  normalizeUCS({origin:entity.center,xAxis:entity.xAxis,yAxis:entity.yAxis});
  if(entity.type==='ARC3D'&&(!finite(entity.startAngle)||!finite(entity.sweepAngle)||Math.abs(entity.sweepAngle)<=1e-10||Math.abs(entity.sweepAngle)>=360))throw Error('Spatial ARC needs finite start and nonzero sweep below 360 degrees.');
  spatialCurveBounds(entity).forEach(point);
  for(const axis of [entity.xAxis,entity.yAxis]){const a=add(entity.center,multiply(axis,entity.radius)),b=add(entity.center,multiply(axis,-entity.radius));if(a.x===b.x&&a.y===b.y&&a.z===b.z)throw Error('Spatial radius is smaller than its world-coordinate resolution.');}
  return entity;
}
export function sampleSpatialCurve(entity,segments=64){validateSpatialCurve(entity);if(!Number.isInteger(segments)||segments<4||segments>4096)throw Error('Curve display subdivisions must be 4..4096.');return Array.from({length:segments+1},(_,i)=>spatialCurvePoint(entity,i/segments));}
/** Published arbitrary-axis OCS convention, independently implemented. */
export function spatialCurveOCS(entity){const normal=cross(entity.xAxis,entity.yAxis),xAxis=normalized(cross(Math.abs(normal.x)<1/64&&Math.abs(normal.y)<1/64?{x:0,y:1,z:0}:{x:0,y:0,z:1},normal)),yAxis=cross(normal,xAxis),c=entity.center;return{normal,center:point({x:dot(c,xAxis),y:dot(c,yAxis),z:dot(c,normal)}),angleOffset:Math.atan2(dot(entity.xAxis,yAxis),dot(entity.xAxis,xAxis))*180/Math.PI};}
