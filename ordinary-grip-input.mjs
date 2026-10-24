// Original, pure coordinate and acquisition-plane policy for ordinary handles.
import {parseCoordinate,parseCoordinate3D,worldToPlane,planeToWorld} from './core.mjs';
const spatial=new Set(['POLY3D','MESH','CIRCLE3D','ARC3D']);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z??0);
const xyz=p=>({x:p.x,y:p.y,z:p.z??0});
export function ordinaryGripPlane(entity,source,construction,space='model'){
  if(!entity||!finite(source))throw Error('The source handle is unavailable.');
  if(!spatial.has(entity.type)){
    const points=entity.type==='LINE'?[entity.start,entity.end]:entity.points||[entity.position||entity.center||source];
    if((source.z??0)!==0||points.some(p=>p?.z!==undefined&&p.z!==0))throw Error('This legacy XYZ object cannot be edited without losing elevation. Use a supported spatial path; the object is unchanged.');
    return{origin:xyz(source),xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:1,z:0},normal:{x:0,y:0,z:1}};
  }
  if(space==='paper')throw Error('Spatial handle editing requires model space.');
  if(['CIRCLE3D','ARC3D'].includes(entity.type)){
    const x=entity.xAxis,y=entity.yAxis;
    return{origin:xyz(source),xAxis:{...x},yAxis:{...y},normal:{x:x.y*y.z-x.z*y.y,y:x.z*y.x-x.x*y.z,z:x.x*y.y-x.y*y.x}};
  }
  if(!construction?.normal)throw Error('Choose a valid construction plane first.');
  return structuredClone({...construction,origin:xyz(source)});
}
export function ordinaryGripPointOnPlane(point,plane){
  if(!finite(point)||!plane)return false;
  const p=worldToPlane(xyz(point),plane),n=plane.normal,o=plane.origin,scale=Math.max(1,Math.abs((point.x-o.x)*n.x),Math.abs((point.y-o.y)*n.y),Math.abs(((point.z??0)-(o.z??0))*n.z));
  return Math.abs(p.z)<=1e-9+Number.EPSILON*64*scale;
}
export function parseOrdinaryGripPoint(raw,{entity,sourcePoint,inputPlane,settings={},space='model'}={}){
  if(typeof raw!=='string'||raw.length>1024||!raw.trim())throw Error('Specify a destination point, or press Escape to cancel. Grip mode cycling is not available.');
  const prefs=space==='paper'?{...settings,units:'mm',linearFormat:'decimal'}:settings;
  if(space==='paper')return parseCoordinate(raw,sourcePoint,prefs);
  const base=worldToPlane(xyz(sourcePoint),inputPlane),relative=raw.trim().startsWith('@');
  const local=raw.includes('<')?{...parseCoordinate(raw,{x:base.x,y:base.y},prefs),z:relative?base.z:0}:parseCoordinate3D(raw,base,prefs);
  const point=planeToWorld(local,inputPlane);
  if(!spatial.has(entity?.type)){
    if(!ordinaryGripPointOnPlane(point,ordinaryGripPlane(entity,sourcePoint,inputPlane,space)))throw Error('The typed UCS destination is outside this object\'s creation plane. Use a point on that plane.');
    return{x:point.x,y:point.y};
  }
  return point;
}
