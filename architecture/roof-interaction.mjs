/* Original display/picking adapters for rectangular source components. These
 * functions return copies and never modify accepted source or generated meshes. */
import {triangulateFace} from './editor-adapter.mjs';
import {toWorld} from './units-adapter.mjs';
import {reviseRoofComponentBounds} from './roof-component-edit.mjs';

const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const frameValid=source=>source?.buildingFrame&&finitePoint(source.buildingFrame.origin)&&Number.isFinite(source.buildingFrame.rotationDegrees);
const shown=roof=>roof&&['ok','needs-review'].includes(roof.status);
const gripSides={'south-west':['minX','minY'],south:['minY'],'south-east':['maxX','minY'],east:['maxX'],'north-east':['maxX','maxY'],north:['maxY'],'north-west':['minX','maxY'],west:['minX']};

/** Actual solved face provenance, not a nearest-footprint guess. Vertical step
 * closures select their upper component; gable closures retain their source. */
export function roofComponentTriangles(entity,architecture,derived){
  if(entity?.type!=='MESH'||!frameValid(architecture))return[];
  const owner=derived?.owners?.[entity.id],roof=derived?.roofs?.find(item=>item.id===owner?.id),group=architecture.roofGroups?.find(item=>item.id===owner?.id);
  if(owner?.kind!=='roofGroup'||!shown(roof)||!group?.components?.length)return[];
  const prefix=`@architecture/roofGroup/${owner.id}/`;if(!entity.id.startsWith(prefix))return[];
  const part=entity.id.slice(prefix.length),records=[];
  const add=(face,componentId,indices)=>{if(!group.components.some(item=>item.id===componentId)||!face.vertices?.every(finitePoint))return;for(const triangle of indices)records.push({roofGroupId:group.id,componentId,faceId:face.id,points:triangle.map(index=>toWorld(face.vertices[index],architecture.buildingFrame))});};
  if(part==='surface')for(const face of roof.faces??[])add(face,face.componentId,triangulateFace(face.vertices));
  else{const match=/^(gable|step)-closure-(\d+)$/.exec(part);if(!match)return[];const closure=(match[1]==='gable'?roof.gableClosures:roof.stepClosures)?.[Number(match[2])];if(!closure?.vertices?.length)return[];const componentId=closure.componentId??roof.faces?.find(face=>face.id===closure.upperFaceId)?.componentId;add(closure,componentId,Array.from({length:closure.vertices.length-2},(_,i)=>[0,i+1,i+2]));}
  return records;
}

/** The editable cage is the source rectangle at its bearing elevation, independent
 * of overhang, ceiling intent, active construction plane, or generated vertices. */
export function roofComponentFootprint(architecture,roofGroupId,componentId){
  if(!frameValid(architecture))return null;
  const group=architecture.roofGroups?.find(item=>item.id===roofGroupId),component=group?.components?.find(item=>item.id===componentId),points=component?.boundary;
  if(!points||points.length!==4||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||!Number.isFinite(component.bearingElevation))return null;
  const bounds={minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))};
  if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY||new Set(points.map(p=>`${p.x},${p.y}`)).size!==4||!points.every(p=>[bounds.minX,bounds.maxX].includes(p.x)&&[bounds.minY,bounds.maxY].includes(p.y)))return null;
  const elevation=component.bearingElevation,frame=architecture.buildingFrame,angle=frame.rotationDegrees*Math.PI/180,plane={origin:toWorld({x:0,y:0,z:elevation},frame),xAxis:{x:Math.cos(angle),y:Math.sin(angle),z:0},yAxis:{x:-Math.sin(angle),y:Math.cos(angle),z:0},normal:{x:0,y:0,z:1}},world=(x,y)=>toWorld({x,y,z:elevation},frame);
  const corners=[world(bounds.minX,bounds.minY),world(bounds.maxX,bounds.minY),world(bounds.maxX,bounds.maxY),world(bounds.minX,bounds.maxY)],grips=Object.entries(gripSides).map(([id,sides])=>({id,kind:sides.length===2?'corner':'edge',sides:[...sides],point:world(sides.includes('minX')?bounds.minX:sides.includes('maxX')?bounds.maxX:(bounds.minX+bounds.maxX)/2,sides.includes('minY')?bounds.minY:sides.includes('maxY')?bounds.maxY:(bounds.minY+bounds.maxY)/2)}));
  let editable=true,reason='';try{reviseRoofComponentBounds(architecture,roofGroupId,componentId,bounds);}catch(error){editable=false;reason=error.message;}
  return{bounds,elevation,plane,corners,grips,editable,reason};
}

/** Bounds may be reversed while dragging; the engine rejects those drafts. */
export function boundsFromRoofComponentGrip(bounds,gripId,localPoint){
  if(!gripSides[gripId]||!localPoint||!Number.isFinite(localPoint.x)||!Number.isFinite(localPoint.y)||!bounds||!['minX','minY','maxX','maxY'].every(key=>Number.isFinite(bounds[key])))throw Error('A footprint grip requires finite source bounds and a building-local point.');
  const result={...bounds};for(const side of gripSides[gripId])result[side]=localPoint[side.endsWith('X')?'x':'y'];return result;
}
