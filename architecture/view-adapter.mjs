/* Original display-only roof edges. Source polygons and generated mesh triangles
 * remain authoritative geometry; this module never changes a drawing or approval. */
import {toWorld,geometryTolerance} from './units-adapter.mjs';

const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const shownRoof=roof=>roof&&['ok','needs-review'].includes(roof.status);
const frameFor=architecture=>architecture?.buildingFrame;
const validFrame=architecture=>{const frame=frameFor(architecture);return Boolean(frame&&finitePoint(frame.origin)&&Number.isFinite(frame.rotationDegrees));};
function world(point,architecture){
  const frame=frameFor(architecture);
  if(!frame||!frame.origin||!Number.isFinite(frame.rotationDegrees)||!finitePoint(frame.origin)||!finitePoint(point))throw Error('Roof display requires finite source points and a horizontal building frame.');
  return toWorld(point,frame);
}
function componentIds(roof,faceIds=[]){
  return [...new Set(faceIds.map(id=>roof.faces?.find(face=>face.id===id)?.componentId).filter(Boolean))];
}

/** null means use the ordinary entity renderer. An array is the complete line
 * display for this source-owned roof part. Coplanar subdivisions and tessellation
 * diagonals are deliberately absent; ordinary editable meshes remain unchanged. */
export function roofDisplayEdges(entity,architecture,derived){
  if(entity?.type!=='MESH')return null;
  const owner=derived?.owners?.[entity.id];
  if(owner?.kind!=='roofGroup')return null;
  const roof=derived.roofs?.find(item=>item.id===owner.id);
  if(!shownRoof(roof)||!validFrame(architecture))return null;
  const prefix=`@architecture/roofGroup/${owner.id}/`;
  if(typeof entity.id!=='string'||!entity.id.startsWith(prefix))return null;
  const part=entity.id.slice(prefix.length),edges=[];
  const add=(a,b,kind,id,components=[])=>{
    const p=world(a,architecture),q=world(b,architecture);
    if(Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)<=1e-12)return;
    edges.push({a:p,b:q,kind,id,roofId:roof.id,componentIds:[...components]});
  };
  if(part==='surface'){
    for(const edge of roof.edges??[]){
      if(edge.kind==='coplanar')continue;
      const ids=componentIds(roof,edge.faceIds);
      add(edge.a,edge.b,edge.kind,edge.id,ids);
      if(edge.kind==='step'&&edge.lowerA&&edge.lowerB)add(edge.lowerA,edge.lowerB,'step-lower',`${edge.id}:lower`,ids);
    }
    return edges;
  }
  const match=/^(gable|step)-closure-(\d+)$/.exec(part);
  if(!match)return null;
  const closure=(match[1]==='gable'?roof.gableClosures:roof.stepClosures)?.[Number(match[2])];
  if(!closure)return null;
  const points=closure.vertices??[],ids=closure.componentId?[closure.componentId]:componentIds(roof,[closure.upperFaceId,closure.lowerFaceId]);
  for(let i=0;i<points.length;i++)add(points[i],points[(i+1)%points.length],closure.kind,`${closure.id}:boundary-${i+1}`,ids);
  return edges;
}

/** Solver witness points are building-local even though the kernel describes its
 * translated coordinates as world. Transform once for the actual drawing view. */
export function roofDrainageWitnesses(architecture,roof){
  if(!shownRoof(roof)||!validFrame(architecture))return [];
  const tolerance=geometryTolerance(architecture.modelUnits);
  return (roof.validation?.drainageFailures??[]).map(edge=>{
    const a=world(edge.a,architecture),b=world(edge.b,architecture),drop=Math.abs(a.z-b.z),flat=drop<=tolerance;
    return {id:edge.id,kind:edge.kind,roofId:roof.id,a,b,faceIds:[...(edge.faceIds??[])],componentIds:componentIds(roof,edge.faceIds),drop,flat,direction:flat?null:(a.z>b.z?{from:{...a},to:{...b}}:{from:{...b},to:{...a}})};
  });
}
