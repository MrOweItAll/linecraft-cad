/* Original camera, projection and picking mathematics. No external rendering engine. */
const radians=Math.PI/180,MIN_SCALE=1e-6,MAX_SCALE=1e6;
const xyz=p=>({x:p.x,y:p.y,z:p.z??0});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const multiply=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
export const dot3=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross3=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export function triangleNormal(a,b,c){
  const coordinateScale=Math.max(...[a,b,c].flatMap(point=>[Math.abs(point.x),Math.abs(point.y),Math.abs(point.z??0)]));
  if(!Number.isFinite(coordinateScale)||coordinateScale===0)return null;
  const edge=(from,to)=>({x:to.x/coordinateScale-from.x/coordinateScale,y:to.y/coordinateScale-from.y/coordinateScale,z:(to.z??0)/coordinateScale-(from.z??0)/coordinateScale});
  const u=edge(a,b),v=edge(a,c),edgeScale=Math.max(...Object.values(u).map(Math.abs),...Object.values(v).map(Math.abs));
  if(!edgeScale)return null;
  const normal=cross3({x:u.x/edgeScale,y:u.y/edgeScale,z:u.z/edgeScale},{x:v.x/edgeScale,y:v.y/edgeScale,z:v.z/edgeScale}),size=Math.hypot(normal.x,normal.y,normal.z);
  return size&&Number.isFinite(size)?{x:normal.x/size,y:normal.y/size,z:normal.z/size}:null;
}
const length=a=>Math.hypot(a.x,a.y,a.z);
const normalize=a=>{const n=length(a);return n&&Number.isFinite(n)?multiply(a,1/n):null;};
const finite=p=>p&&[p.x,p.y,p.z??0].every(Number.isFinite);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const trig=angle=>{const value=((angle%360)+360)%360;if(value===0)return[1,0];if(value===90)return[0,1];if(value===180)return[-1,0];if(value===270)return[0,-1];return[Math.cos(value*radians),Math.sin(value*radians)];};
export const defaultCamera=()=>({target:{x:0,y:0,z:0},scale:10,yaw:45,pitch:35.264389682754654,roll:0,mode:'iso',renderMode:'shaded',projection:'orthographic',distance:200,fov:45,autoTarget:true,orbitCenter:null});
export function cameraBasis(raw){
  const camera={...defaultCamera(),...raw},[cy,sy]=trig(camera.yaw),[cp,sp]=trig(camera.pitch),[cr,sr]=trig(camera.roll??0);
  const normal={x:cy*cp,y:sy*cp,z:sp},right0={x:-sy,y:cy,z:0},up0={x:-cy*sp,y:-sy*sp,z:cp};
  return{normal,right:add(multiply(right0,cr),multiply(up0,sr)),up:add(multiply(up0,cr),multiply(right0,-sr))};
}
export function cameraPreset(raw,preset){
  const angles={iso:[45,35.264389682754654],neiso:[45,35.264389682754654],seiso:[-45,35.264389682754654],swiso:[-135,35.264389682754654],nwiso:[135,35.264389682754654],top:[-90,90],front:[-90,0],right:[0,0],back:[90,0],left:[180,0],bottom:[-90,-90]};
  const pair=angles[preset];if(!pair)throw Error('Unknown camera preset.');return{...raw,yaw:pair[0],pitch:pair[1],roll:0,mode:preset};
}
/** Exact support points of an XY ellipse along the two orthographic camera axes. */
export function planarCurveExtrema(center,major,ratio,camera){
  const minor={x:-major.y*ratio,y:major.x*ratio,z:0},basis=cameraBasis(camera),points=[];
  for(const axis of [basis.right,basis.up]){const a=major.x*axis.x+major.y*axis.y,b=minor.x*axis.x+minor.y*axis.y,angle=Math.atan2(b,a);for(const t of [angle,angle+Math.PI])points.push({x:center.x+major.x*Math.cos(t)+minor.x*Math.sin(t),y:center.y+major.y*Math.cos(t)+minor.y*Math.sin(t),z:center.z??0});}return points.filter(finite);
}
export function focalPixels(camera,height){return height/(2*Math.tan((camera.fov??45)*radians/2));}
export function pixelScale(camera,height){return camera.projection==='perspective'?focalPixels(camera,height)/(camera.distance??200):camera.scale;}
export function projectPoint(rawPoint,camera,width,height){
  const point=xyz(rawPoint),basis=cameraBasis(camera),relative=subtract(point,xyz(camera.target)),depth=dot3(relative,basis.normal),viewDistance=(camera.distance??200)-depth;
  const perspective=camera.projection==='perspective',near=Math.max(1e-9,(camera.distance??200)*1e-7);
  if(!finite(point)||!finite(relative)||perspective&&viewDistance<=near)return{x:NaN,y:NaN,depth,viewDistance,clipped:true};
  const scale=perspective?focalPixels(camera,height)/viewDistance:camera.scale;
  const x=width/2+dot3(relative,basis.right)*scale,y=height/2-dot3(relative,basis.up)*scale;return{x,y,depth,viewDistance,clipped:![x,y,depth].every(Number.isFinite)};
}
/** Orthographic rays start at the target plane; signed intersections represent the unbounded view. */
export function screenRay(screen,camera,width,height){
  const basis=cameraBasis(camera),target=xyz(camera.target);
  if(camera.projection==='perspective'){
    const focal=focalPixels(camera,height),origin=add(target,multiply(basis.normal,camera.distance??200));
    const direction=normalize(add(multiply(basis.normal,-1),add(multiply(basis.right,(screen.x-width/2)/focal),multiply(basis.up,(height/2-screen.y)/focal))));
    return{origin,direction,perspective:true};
  }
  return{origin:add(target,add(multiply(basis.right,(screen.x-width/2)/camera.scale),multiply(basis.up,(height/2-screen.y)/camera.scale))),direction:multiply(basis.normal,-1),perspective:false};
}
export function intersectConstructionPlane(ray,elevation=0){
  if(!ray.direction||Math.abs(ray.direction.z)<1e-12)return null;
  const t=(elevation-ray.origin.z)/ray.direction.z;
  if(!Number.isFinite(t)||ray.perspective&&t<0)return null;
  const point=add(ray.origin,multiply(ray.direction,t));point.z=elevation;return finite(point)?point:null;
}
export function pointOnTargetPlane(screen,camera,width,height){
  const scale=pixelScale(camera,height),basis=cameraBasis(camera);
  return add(xyz(camera.target),add(multiply(basis.right,(screen.x-width/2)/scale),multiply(basis.up,(height/2-screen.y)/scale)));
}
export function panCamera(camera,dx,dy,height){
  const basis=cameraBasis(camera),scale=pixelScale(camera,height);
  return{...camera,target:add(xyz(camera.target),add(multiply(basis.right,-dx/scale),multiply(basis.up,dy/scale)))};
}
export function zoomCameraAt(camera,factor,screen,width,height,anchor=pointOnTargetPlane(screen,camera,width,height)){
  if(!Number.isFinite(factor)||factor<=0)throw Error('Zoom factor must be positive and finite.');
  const basis=cameraBasis(camera),depth=dot3(subtract(xyz(anchor),xyz(camera.target)),basis.normal),dx=screen.x-width/2,dy=height/2-screen.y;
  let result;
  if(camera.projection==='perspective'){
    if(depth>=1e12)return camera;
    const distance=clamp((camera.distance??200)/factor,Math.max(1e-6,depth+Math.max(1e-6,Math.abs(depth)*1e-7)),1e12),scale=focalPixels(camera,height)/(distance-depth);
    result={...camera,distance,target:subtract(xyz(anchor),add(multiply(basis.normal,depth),add(multiply(basis.right,dx/scale),multiply(basis.up,dy/scale))))};
  }else{
    const scale=clamp(camera.scale*factor,MIN_SCALE,MAX_SCALE);
    result={...camera,scale,target:subtract(xyz(anchor),add(multiply(basis.normal,depth),add(multiply(basis.right,dx/scale),multiply(basis.up,dy/scale))))};
  }
  return finite(result.target)?result:camera;
}
export function orbitConstrained(camera,dx,dy){return{...camera,yaw:(camera.yaw-dx*.35)%360,pitch:clamp(camera.pitch+dy*.35,-89.5,89.5),roll:0,mode:'custom'};}
export function orbitAroundPivot(before,after,pivot){
  const old=cameraBasis(before),next=cameraBasis(after),relative=subtract(xyz(before.target),xyz(pivot));
  return{...after,target:add(xyz(pivot),add(add(multiply(next.right,dot3(relative,old.right)),multiply(next.up,dot3(relative,old.up))),multiply(next.normal,dot3(relative,old.normal))))};
}
export function heightAlongZ(screen,base,camera,width,height){
  return heightAlongAxis(screen,base,{x:0,y:0,z:1},camera,width,height);
}
export function heightAlongAxis(screen,base,direction,camera,width,height){
  const length=Math.hypot(direction.x,direction.y,direction.z);if(!Number.isFinite(length)||length===0)return null;const axis=multiply(direction,1/length),ray=screenRay(screen,camera,width,height);if(!ray.direction)return null;const relative=subtract(ray.origin,xyz(base)),alignment=dot3(ray.direction,axis),denominator=1-alignment*alignment;if(denominator<1e-10)return null;const value=(dot3(relative,axis)-dot3(relative,ray.direction)*alignment)/denominator;return Number.isFinite(value)?value:null;
}
function rotateVector(value,axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return add(add(multiply(value,c),multiply(cross3(axis,value),s)),multiply(axis,dot3(axis,value)*(1-c)));}
function cameraFromBasis(camera,basis){
  const pitch=Math.asin(clamp(basis.normal.z,-1,1))/radians,yaw=Math.hypot(basis.normal.x,basis.normal.y)>1e-12?Math.atan2(basis.normal.y,basis.normal.x)/radians:camera.yaw;
  const base=cameraBasis({...camera,yaw,pitch,roll:0}),roll=Math.atan2(dot3(basis.right,base.up),dot3(basis.right,base.right))/radians;
  return{...camera,yaw,pitch,roll,mode:'custom'};
}
export function arcballVector(screen,width,height){
  const radius=Math.max(1,Math.min(width,height)*.35),x=(screen.x-width/2)/radius,y=(height/2-screen.y)/radius,size=Math.hypot(x,y);
  return size>1?{x:x/size,y:y/size,z:0,outside:true}:{x,y,z:Math.sqrt(Math.max(0,1-size*size)),outside:false};
}
export function orbitFree(camera,start,end,width,height){
  const a=arcballVector(start,width,height),b=arcballVector(end,width,height);
  if(a.outside&&b.outside)return{...camera,roll:(camera.roll??0)+(Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x))/radians,mode:'custom'};
  const axisLocal=cross3(a,b),s=length(axisLocal);if(s<1e-12)return camera;
  const basis=cameraBasis(camera),axis=normalize(add(add(multiply(basis.right,axisLocal.x),multiply(basis.up,axisLocal.y)),multiply(basis.normal,axisLocal.z))),angle=-Math.atan2(s,clamp(dot3(a,b),-1,1));
  return cameraFromBasis(camera,{right:rotateVector(basis.right,axis,angle),up:rotateVector(basis.up,axis,angle),normal:rotateVector(basis.normal,axis,angle)});
}
const midpoint=(a,b)=>Math.sign(a)===Math.sign(b)?a+(b-a)/2:a/2+b/2;
export function bounds3D(points){
  const valid=points.map(xyz).filter(finite);if(!valid.length)return null;
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};for(const p of valid)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],p[axis]);max[axis]=Math.max(max[axis],p[axis]);}
  return{min,max,center:{x:midpoint(min.x,max.x),y:midpoint(min.y,max.y),z:midpoint(min.z,max.z)}};
}
export function fitCamera(points,camera,width,height,padding=55){
  const box=bounds3D(points);if(!box)return camera;
  const target=box.center,basis=cameraBasis(camera),usableX=Math.max(1,width/2-padding),usableY=Math.max(1,height/2-padding);let maxX=0,maxY=0,distance=1e-6;
  for(const raw of points){const p=subtract(xyz(raw),target);if(!finite(p))continue;const x=Math.abs(dot3(p,basis.right)),y=Math.abs(dot3(p,basis.up)),depth=dot3(p,basis.normal);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);distance=Math.max(distance,depth+x*focalPixels(camera,height)/usableX,depth+y*focalPixels(camera,height)/usableY,depth+length(p)*.05);}
  const scale=clamp(Math.min(maxX?usableX/maxX:Infinity,maxY?usableY/maxY:Infinity),MIN_SCALE,MAX_SCALE);
  return{...camera,target,scale:Number.isFinite(scale)?scale:camera.scale,distance:Number.isFinite(distance)?clamp(distance*1.05,1e-6,1e12):(camera.distance??200)};
}
export function projectedSegmentDistance(screen,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,denominator=dx*dx+dy*dy,t=denominator?clamp(((screen.x-a.x)*dx+(screen.y-a.y)*dy)/denominator,0,1):0;
  return{distance:Math.hypot(screen.x-a.x-t*dx,screen.y-a.y-t*dy),t};
}
/** Original scaled barycentric ray/triangle intersection, accepting signed orthographic parameters. */
export function intersectTriangle(ray,rawA,rawB,rawC){
  if(!ray.direction)return null;const a=xyz(rawA),edge1=subtract(xyz(rawB),a),edge2=subtract(xyz(rawC),a),size=Math.max(length(edge1),length(edge2));
  if(!size||!Number.isFinite(size))return null;const e1=multiply(edge1,1/size),e2=multiply(edge2,1/size),h=cross3(ray.direction,e2),determinant=dot3(e1,h);
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)return null;const s=multiply(subtract(ray.origin,a),1/size),u=dot3(s,h)/determinant;if(u< -1e-10||u>1+1e-10)return null;
  const q=cross3(s,e1),v=dot3(ray.direction,q)/determinant;if(v< -1e-10||u+v>1+1e-10)return null;
  const t=dot3(e2,q)/determinant*size;if(!Number.isFinite(t)||ray.perspective&&t<0)return null;const point=add(ray.origin,multiply(ray.direction,t));return finite(point)?{point,t,u,v}:null;
}
export function meshTriangles(entity){
  const triangles=[];for(let faceIndex=0;faceIndex<(entity.faces?.length??0);faceIndex++){const face=entity.faces[faceIndex];for(let i=1;i<face.length-1;i++)triangles.push({points:[entity.vertices[face[0]],entity.vertices[face[i]],entity.vertices[face[i+1]]],faceIndex});}return triangles;
}
/** Shaded outlines follow indexed surface boundaries, not coplanar triangulation seams.
 * Preserve uncertain/nonmanifold/overlapping edges and never weld vertices or entities.
 * Normals are reused by the renderer; adjacency is bounded to three entries per triangle.
 */
export function meshShadedTriangles(entity){
  const triangles=[],edges=new Map();
  for(let faceIndex=0;faceIndex<(entity.faces?.length??0);faceIndex++){
    const face=entity.faces[faceIndex];
    for(let i=1;i<face.length-1;i++){
      const indices=[face[0],face[i],face[i+1]],points=indices.map(index=>entity.vertices[index]),triangle={points,faceIndex,normal:triangleNormal(...points),outlineEdges:[true,true,true]};
      triangles.push(triangle);
      for(let edge=0;edge<3;edge++){
        const a=indices[edge],b=indices[(edge+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;
        if(!edges.has(key))edges.set(key,[]);
        edges.get(key).push({triangle,edge,a,b,third:indices[(edge+2)%3]});
      }
    }
  }
  for(const adjacent of edges.values()){
    if(adjacent.length!==2)continue;
    const [first,second]=adjacent,n=first.triangle.normal,m=second.triangle.normal;
    if(!n||!m)continue;
    const cross=cross3(n,m);if(Math.hypot(cross.x,cross.y,cross.z)>1e-12)continue;
    const raw=[entity.vertices[first.a],entity.vertices[first.b],entity.vertices[first.third],entity.vertices[second.third]],scale=Math.max(...raw.flatMap(point=>[Math.abs(point.x),Math.abs(point.y),Math.abs(point.z??0)]));
    if(!scale||!Number.isFinite(scale))continue;
    const [a,b,c,d]=raw.map(point=>({x:point.x/scale,y:point.y/scale,z:(point.z??0)/scale})),edge=subtract(b,a);
    const side=point=>dot3(cross3(edge,subtract(point,a)),n);
    // Opposite sides establish adjacency rather than coincident/overlapping faces.
    if(side(c)*side(d)<0){first.triangle.outlineEdges[first.edge]=false;second.triangle.outlineEdges[second.edge]=false;}
  }
  return triangles;
}
export function meshEdges(entity){
  const unique=new Map();for(const face of entity.faces||[])for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=a<b?`${a}:${b}`:`${b}:${a}`;if(!unique.has(key))unique.set(key,[entity.vertices[a],entity.vertices[b]]);}return [...unique.values()];
}
export function pickMesh(entity,screen,camera,width,height){
  const ray=screenRay(screen,camera,width,height);let winner=null;
  for(const triangle of meshTriangles(entity)){const hit=intersectTriangle(ray,...triangle.points);if(!hit)continue;const projected=projectPoint(hit.point,camera,width,height);if(projected.clipped)continue;if(!winner||projected.depth>winner.depth)winner={...hit,depth:projected.depth,faceIndex:triangle.faceIndex,entityId:entity.id};}
  return winner;
}
export function pointInPlanarPolygon(point,polygon){
  let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y,scale=Math.max(Math.abs(dx),Math.abs(dy)),cross=scale?(point.x-a.x)/scale*(dy/scale)-(point.y-a.y)/scale*(dx/scale):Infinity;
    if(Math.abs(cross)<=1e-12&&point.x>=Math.min(a.x,b.x)&&point.x<=Math.max(a.x,b.x)&&point.y>=Math.min(a.y,b.y)&&point.y<=Math.max(a.y,b.y))return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<a.x+(point.y-a.y)/(b.y-a.y)*(b.x-a.x))inside=!inside;
  }return inside;
}
export function pickPlanarFill(polygons,screen,camera,width,height){
  const ray=screenRay(screen,camera,width,height);let winner=null;for(const polygon of polygons){if(polygon.length<3)continue;const point=intersectConstructionPlane(ray,polygon[0].z??0);if(!point||!pointInPlanarPolygon(point,polygon))continue;const p=projectPoint(point,camera,width,height);if(!p.clipped&&(!winner||p.depth>winner.depth))winner={point,depth:p.depth,distance:0,kind:'fill'};}return winner;
}
export function pickProjected(entities,screen,camera,width,height,tolerance=8,edgeReader=meshEdges,fillReader=()=>[]){
  let winner=null;const accept=candidate=>{if(!winner||candidate.depth>winner.depth+1e-8||Math.abs(candidate.depth-winner.depth)<=1e-8&&candidate.distance<winner.distance)winner=candidate;};
  for(const entity of entities){
    if(entity.type==='MESH'){const hit=pickMesh(entity,screen,camera,width,height);if(hit)accept({...hit,distance:0,kind:'face'});}
    const fill=pickPlanarFill(fillReader(entity),screen,camera,width,height);if(fill)accept({...fill,entityId:entity.id});
    for(const [rawA,rawB]of edgeReader(entity)){const a=projectPoint(rawA,camera,width,height),b=projectPoint(rawB,camera,width,height);if(a.clipped||b.clipped||![a.x,a.y,b.x,b.y].every(Number.isFinite))continue;const candidate=projectedSegmentDistance(screen,a,b);if(candidate.distance<=tolerance){const t=camera.projection==='perspective'?candidate.t*a.viewDistance/((1-candidate.t)*b.viewDistance+candidate.t*a.viewDistance):candidate.t,point=add(xyz(rawA),multiply(subtract(xyz(rawB),xyz(rawA)),t));accept({point,depth:dot3(subtract(point,xyz(camera.target)),cameraBasis(camera).normal),distance:candidate.distance,entityId:entity.id,kind:'edge'});}}
  }return winner;
}
export function pointOccluded(point,meshes,camera,width,height,tolerancePixels=1){
  const screen=projectPoint(point,camera,width,height);if(screen.clipped)return true;
  const margin=tolerancePixels/Math.max(1e-12,pixelScale(camera,height));return meshes.some(mesh=>{const hit=pickMesh(mesh,screen,camera,width,height);return hit&&hit.depth>screen.depth+margin;});
}
function segmentIntersectsBox(a,b,box){let low=0,high=1;for(const axis of ['x','y']){const delta=b[axis]-a[axis],min=box[`min${axis.toUpperCase()}`],max=box[`max${axis.toUpperCase()}`];if(!delta){if(a[axis]<min||a[axis]>max)return false;continue;}const p=(min-a[axis])/delta,q=(max-a[axis])/delta;low=Math.max(low,Math.min(p,q));high=Math.min(high,Math.max(p,q));if(low>high)return false;}return true;}
export function entitiesInProjectedBox(entities,start,end,crossing,camera,width,height,pointReader,edgeReader,fillReader=()=>[]){
  const box={minX:Math.min(start.x,end.x),maxX:Math.max(start.x,end.x),minY:Math.min(start.y,end.y),maxY:Math.max(start.y,end.y)},inside=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=box.minX&&p.x<=box.maxX&&p.y>=box.minY&&p.y<=box.maxY;
  const corners=[{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.maxX,y:box.maxY},{x:box.minX,y:box.maxY}];
  return entities.filter(entity=>{const points=pointReader(entity).map(p=>projectPoint(p,camera,width,height));if(!crossing)return points.length&&points.every(inside);return points.some(inside)||edgeReader(entity).some(([a,b])=>{const first=projectPoint(a,camera,width,height),last=projectPoint(b,camera,width,height);return !first.clipped&&!last.clipped&&[first.x,first.y,last.x,last.y].every(Number.isFinite)&&segmentIntersectsBox(first,last,box);})||entity.type==='MESH'&&corners.some(p=>pickMesh(entity,p,camera,width,height))||corners.some(p=>pickPlanarFill(fillReader(entity),p,camera,width,height));}).map(entity=>entity.id);
}
