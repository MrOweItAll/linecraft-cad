/* Original point acquisition for architectural source footprint grips.
 * Typed XY is building-local; snap XY is projected onto the bearing plane.
 * These functions return copies and never edit an editor or source model. */
import {parseLength} from '../units.mjs';
import {fromWorld} from './units-adapter.mjs';

const finiteXY=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const finiteXYZ=p=>finiteXY(p)&&Number.isFinite(p.z);

export function parseRoofGripCoordinate(raw,baseLocal,settings={}){
  if(typeof raw!=='string'||raw.length>1024||!finiteXY(baseLocal))throw Error('Enter building-local X,Y or @dX,dY.');
  let text=raw.trim(),mode=text.startsWith('@')?'relative':'absolute';
  if(text.startsWith('@')||text.startsWith('#'))text=text.slice(1).trim();
  const parts=text.split(',');
  if(parts.length!==2||text.includes('<'))throw Error('Footprint grips use building-local X,Y or @dX,dY; bearing Z stays fixed.');
  const x=parseLength(parts[0],settings),y=parseLength(parts[1],settings),point={x:x+(mode==='relative'?baseLocal.x:0),y:y+(mode==='relative'?baseLocal.y:0)};
  if(!finiteXY(point))throw Error('Footprint coordinates must remain finite.');
  return{mode,point};
}

export function projectRoofGripSnap(sourcePoint,frame,bearingElevation){
  const original=sourcePoint&&{x:sourcePoint.x,y:sourcePoint.y,z:sourcePoint.z??0};
  if(!finiteXYZ(original)||!finiteXYZ(frame?.origin)||!Number.isFinite(frame?.rotationDegrees)||!Number.isFinite(bearingElevation))throw Error('A snap requires a finite world point and component bearing plane.');
  const point={x:original.x,y:original.y,z:frame.origin.z+bearingElevation},local=fromWorld(point,frame),localPoint={x:local.x,y:local.y,z:bearingElevation};
  if(!finiteXYZ(point)||!finiteXYZ(localPoint))throw Error('The projected footprint snap exceeds the finite coordinate range.');
  return{sourcePoint:{...original},point,localPoint,projected:Math.abs(point.z-original.z)>1e-9};
}
