/* R3: exact polygon/affine clipping beneath an immutable, already generated roof.
   All predicates operate near a room-local origin. No point-grid or sampled maximum
   is used. Results describe declared geometry; they never verify truss framing. */
import {geometryTolerance,physicalScale} from './units-adapter.mjs';

export const CLEARANCE_VERSION='clearance-r3-zero-2';
export const CLEARANCE_LIMITS=Object.freeze({roomVertices:256,roofTriangles:1024,cells:4096,work:2000000,reservations:128});
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e9;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2;
const area=p=>Math.abs(signedArea(p));
const planeAt=(f,p)=>f.x*p.x+f.y*p.y+f.z;
function tidy(poly,eps){
 const out=[];for(const p of poly)if(!out.length||Math.hypot(p.x-out.at(-1).x,p.y-out.at(-1).y)>eps)out.push({x:p.x,y:p.y});
 if(out.length>1&&Math.hypot(out[0].x-out.at(-1).x,out[0].y-out.at(-1).y)<=eps)out.pop();
 let changed=true;while(changed&&out.length>3){changed=false;for(let i=0;i<out.length;i++){const a=out[(i+out.length-1)%out.length],b=out[i],c=out[(i+1)%out.length];if(Math.abs(cross(a,b,c))<=eps*Math.max(1,Math.hypot(c.x-a.x,c.y-a.y))){out.splice(i,1);changed=true;break;}}}
 return out;
}
function clip(poly,f,eps){
 if(poly.length<3)return[];const out=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=planeAt(f,p),dq=planeAt(f,q),ip=dp>=-eps,iq=dq>=-eps;if(ip)out.push(p);if(ip!==iq){const t=dp/(dp-dq);out.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)});}}
 return tidy(out,eps);
}
function intersection(a,b,eps){let out=a;for(let i=0;i<b.length&&out.length>=3;i++){const p=b[i],q=b[(i+1)%b.length];out=clip(out,{x:-(q.y-p.y),y:q.x-p.x,z:(q.y-p.y)*p.x-(q.x-p.x)*p.y},eps);}return out.length>=3?out:[];}
function segmentsMeet(a,b,c,d,eps){
 const abp=cross(a,b,c),abq=cross(a,b,d),cdp=cross(c,d,a),cdq=cross(c,d,b);
 if(Math.max(a.x,b.x)+eps<Math.min(c.x,d.x)||Math.max(c.x,d.x)+eps<Math.min(a.x,b.x)||Math.max(a.y,b.y)+eps<Math.min(c.y,d.y)||Math.max(c.y,d.y)+eps<Math.min(a.y,b.y))return false;
 return abp*abq<=eps*eps&&cdp*cdq<=eps*eps;
}
function triangulate(raw,eps,areaTol,label){
 let poly=tidy(raw,eps);if(poly.length<3||area(poly)<=areaTol)throw Error(`${label} has no positive projected area.`);
 for(let i=0;i<poly.length;i++)for(let j=i+1;j<poly.length;j++){if(j===i+1||i===0&&j===poly.length-1)continue;if(segmentsMeet(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length],eps))throw Error(`${label} is not a simple polygon.`);}
 if(signedArea(poly)<0)poly.reverse();const ids=poly.map((_,i)=>i),out=[];
 const inside=(p,a,b,c)=>cross(a,b,p)>=-eps&&cross(b,c,p)>=-eps&&cross(c,a,p)>=-eps;
 while(ids.length>3){let found=false;for(let i=0;i<ids.length;i++){const ia=ids[(i+ids.length-1)%ids.length],ib=ids[i],ic=ids[(i+1)%ids.length],a=poly[ia],b=poly[ib],c=poly[ic];if(cross(a,b,c)<=eps)continue;if(ids.some(k=>![ia,ib,ic].includes(k)&&inside(poly[k],a,b,c)))continue;out.push([a,b,c]);ids.splice(i,1);found=true;break;}if(!found)throw Error(`${label} cannot be triangulated without degeneracy.`);}
 out.push(ids.map(i=>poly[i]));return out;
}
function integral(poly,f){let volume=0;const a=poly[0];for(let i=1;i<poly.length-1;i++){const b=poly[i],c=poly[i+1],v=Math.abs(cross(a,b,c))/2;volume+=v*(planeAt(f,a)+planeAt(f,b)+planeAt(f,c))/3;}return volume;}
function aboveVolume(poly,f,eps){const positive=clip(poly,f,eps);return positive.length<3?0:Math.max(0,integral(positive,f));}
function cappedVolume(poly,f,height,eps){
 const values=poly.map(p=>planeAt(f,p));if(Math.max(...values)<=height+eps)return aboveVolume(poly,f,eps);if(Math.min(...values)>=height-eps)return area(poly)*Math.max(0,height);
 const low=clip(poly,{x:-f.x,y:-f.y,z:height-f.z},eps),high=clip(poly,{...f,z:f.z-height},eps);
 return (low.length>=3?aboveVolume(low,f,eps):0)+(high.length>=3?area(high)*Math.max(0,height):0);
}
function minVertex(cells,key,origin,floor){let best=null;for(const c of cells)for(const p of c.polygon){const z=planeAt(c[key],p);if(!best||z<best.z-1e-12||Math.abs(z-best.z)<=1e-12&&(p.x<best.p.x||p.x===best.p.x&&p.y<best.p.y))best={z,p,obstacle:c.obstacle,faceId:c.faceId};}return best?{elevation:best.z+floor,point:{x:best.p.x+origin.x,y:best.p.y+origin.y,z:best.z+floor},obstacle:best.obstacle,faceId:best.faceId}:null;}
const worldPlane=(f,origin,floor)=>({origin:{x:origin.x,y:origin.y},x:f.x,y:f.y,z:f.z+floor});
export function evaluateClearanceCell(cell,point,kind='ceilingPlane'){const p=cell[kind];return p.z+p.x*(point.x-p.origin.x)+p.y*(point.y-p.origin.y);}
function wrapPlane(points,origin,floor,eps,tolerance){
 const p=points[0];let q,r,den;for(let i=1;i<points.length-1;i++){q=points[i];r=points[i+1];den=cross(p,q,r);if(Math.abs(den)>eps)break;}if(!den||Math.abs(den)<=eps)throw Error('Roof face has no nonvertical projected plane.');
 const x=((q.z-p.z)*(r.y-p.y)-(r.z-p.z)*(q.y-p.y))/den,y=((q.x-p.x)*(r.z-p.z)-(r.x-p.x)*(q.z-p.z))/den,z=p.z-floor-x*p.x-y*p.y;
 if(![x,y,z].every(Number.isFinite))throw Error('Roof face has an invalid height plane.');for(const v of points)if(Math.abs(planeAt({x,y,z},v)-(v.z-floor))>tolerance)throw Error('Roof face is not planar within the physical tolerance.');return{x,y,z};
}
function validateInputs(room,roof,assembly,modelUnits){
 physicalScale(modelUnits);if(!room||!Array.isArray(room.boundary)||room.boundary.length<3||room.boundary.length>CLEARANCE_LIMITS.roomVertices)throw Error(`Room requires 3..${CLEARANCE_LIMITS.roomVertices} boundary vertices.`);
 for(const p of room.boundary)if(!p||!finite(p.x)||!finite(p.y))throw Error('Room boundary coordinate is invalid.');
 for(const k of['floorElevation','ceilingElevation','targetCeilingElevation'])if(!finite(room[k]))throw Error(`Room ${k} must be finite.`);
 if(room.ceilingType&&room.ceilingType!=='flat')throw Error('R3 supports flat finished ceilings only.');
 for(const k of['ceilingFinishThickness','minClearHeight','minimumClearHeight','headroomThreshold'])if(room[k]!==undefined&&(!finite(room[k])||room[k]<0))throw Error(`Room ${k} must be finite and nonnegative.`);
 if(!roof||roof.status!=='ok'||!Array.isArray(roof.faces)||!roof.faces.length)throw Error('A current valid fixed roof is required.');
 if(assembly){if(!Array.isArray(assembly.layers)||!Array.isArray(assembly.reservations)||assembly.layers.length>32||assembly.reservations.length>CLEARANCE_LIMITS.reservations)throw Error('Assembly layers/reservations exceed supported bounds.');for(const l of assembly.layers)if(!finite(l.normalThickness)||l.normalThickness<0)throw Error('Assembly normal layer thickness must be finite and nonnegative.');for(const r of assembly.reservations){if(!r.min||!r.max||['x','y','z'].some(k=>!finite(r.min[k])||!finite(r.max[k])||r.max[k]<=r.min[k]))throw Error('Reservation must be a finite, positive, local-axis box.');}}
}
/** Analyze one room against one explicitly selected fixed roof in building-local XYZ.
    All lengths/areas/volumes are in assigned model units and their powers. */
export function analyzeRoomSpace({room,roof,assembly=null,modelUnits,tolerance,workLimit=CLEARANCE_LIMITS.work}={}){
 const out={version:CLEARANCE_VERSION,status:'unsupported',roomId:room?.id??null,roofId:roof?.id??null,modelUnits:modelUnits??null,framingVerification:'unverified',verified:null,diagnostics:[],area:null,coverage:null,roofPotential:null,declared:null,maxFlatCeilingElevation:null,maximumFlat:null,current:null,target:null,recoverableFlatVolume:null,recoveryVolume:null,headroom:null,limiting:null,cells:[],assumptions:null,budget:{work:0}};
 try{
  if(!Number.isSafeInteger(workLimit)||workLimit<=0)throw Error('Clearance intersection work budget exhausted.');const allowedWork=Math.min(workLimit,CLEARANCE_LIMITS.work);validateInputs(room,roof,assembly,modelUnits);const tol=tolerance??geometryTolerance({units:modelUnits});if(!Number.isFinite(tol)||tol<=0)throw Error('Clearance tolerance must be positive.');
  const origin={x:room.boundary[0].x,y:room.boundary[0].y},floor=room.floorElevation,poly=room.boundary.map(p=>({x:p.x-origin.x,y:p.y-origin.y})),extent=Math.max(1,...poly.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)])),eps=Math.max(Number.EPSILON*extent*64,tol*1e-6),areaTol=Math.max(tol*tol,eps*extent*64),roomTriangles=triangulate(poly,eps,areaTol,'Room boundary'),roomArea=area(poly);
  let work=0;const charge=(n=1)=>{if(work+n>allowedWork)throw Error('Clearance intersection work budget exceeded. Simplify the room, roof, or reservations.');work+=n;out.budget.work=work;};
  const roofTriangles=[];for(const face of roof.faces){if(!Array.isArray(face.vertices)||face.vertices.length<3||face.vertices.length>256)throw Error('Roof face has unsupported vertex count.');const vertices=face.vertices.map(p=>{if(!p||!['x','y','z'].every(k=>finite(p[k])))throw Error('Roof vertex is invalid.');return{x:p.x-origin.x,y:p.y-origin.y,z:p.z};}),f=wrapPlane(vertices,origin,floor,eps,tol);for(const t of triangulate(vertices,eps,areaTol,`Roof face ${face.id??''}`)){roofTriangles.push({polygon:t,f,faceId:face.id??null});if(roofTriangles.length>CLEARANCE_LIMITS.roofTriangles)throw Error('Clearance roof triangle budget exceeded.');}}
  let cells=[];for(const a of roomTriangles)for(const b of roofTriangles){charge();const polygon=intersection(a,b.polygon,eps);if(polygon.length<3||area(polygon)<=areaTol)continue;cells.push({polygon,roof:b.f,cap:{...b.f},faceId:b.faceId,obstacle:{kind:'roof-surface',roofId:roof.id??null,faceId:b.faceId}});if(cells.length>CLEARANCE_LIMITS.cells)throw Error('Clearance cell budget exceeded.');}
  const coveredArea=cells.reduce((s,c)=>s+area(c.polygon),0);let overlapArea=0;for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++){charge();const p=intersection(cells[i].polygon,cells[j].polygon,eps);if(p.length>=3)overlapArea+=area(p);}
  const uncoveredArea=Math.max(0,roomArea-coveredArea),coverageTolerance=Math.max(areaTol*8,roomArea*1e-9);out.area=roomArea;out.coverage={roomArea,coveredArea,overlapArea,uncoveredArea,tolerance:coverageTolerance};
  if(overlapArea>coverageTolerance)throw Error('Roof coverage overlaps inside the room; an authoritative single skin is required.');if(uncoveredArea>coverageTolerance||Math.abs(coveredArea-roomArea)>coverageTolerance)throw Error('Fixed roof does not completely cover the room.');
  const potential=minVertex(cells,'roof',origin,floor),potentialVolume=cells.reduce((s,c)=>s+aboveVolume(c.polygon,c.roof,eps),0);out.roofPotential={maxFlatCeilingElevation:potential.elevation,clearHeight:potential.elevation-floor,volumeAboveFloor:potentialVolume,limitingPoint:potential.point,geometryOnly:true};
  // An undeclared assembly is the zero-thickness mathematical surface. Optional
  // explicit offsets and reservation boxes remain effective when supplied.
  const roofAssemblyDeclared=assembly!==null;assembly??={id:null,layers:[],reservations:[]};
  const finish=room.ceilingFinishThickness??0,normalThickness=assembly.layers.reduce((s,l)=>s+l.normalThickness,0),analysisMode=normalThickness===0&&finish===0?'mathematical-zero-thickness':'declared-thickness';for(const c of cells){c.cap={...c.roof,z:c.roof.z-normalThickness*Math.sqrt(1+c.roof.x*c.roof.x+c.roof.y*c.roof.y)-finish};c.obstacle={kind:normalThickness===0&&finish===0?'roof-surface':'roof-assembly',assemblyId:assembly.id??null,roofId:roof.id??null,faceId:c.faceId};}
  let ignoredBelowFloor=0,constrainingReservations=0;for(const reservation of assembly.reservations){if(reservation.max.z<=floor+eps){ignoredBelowFloor++;continue;}const box={min:{x:reservation.min.x-origin.x,y:reservation.min.y-origin.y},max:{x:reservation.max.x-origin.x,y:reservation.max.y-origin.y}},cap=reservation.min.z-floor-finish,next=[];let constrains=false;
   for(const cell of cells){charge();let inside=cell.polygon;for(const f of[{x:1,y:0,z:-box.min.x},{x:-1,y:0,z:box.max.x},{x:0,y:1,z:-box.min.y},{x:0,y:-1,z:box.max.y}]){if(inside.length<3)break;const outside=clip(inside,{x:-f.x,y:-f.y,z:-f.z},eps);if(outside.length>=3&&area(outside)>areaTol)next.push({...cell,polygon:outside});inside=clip(inside,f,eps);}
    if(inside.length>=3&&area(inside)>areaTol){const values=inside.map(p=>planeAt(cell.cap,p)),allUnblocked=Math.max(...values)<=cap+eps,unblocked=allUnblocked?inside:clip(inside,{x:-cell.cap.x,y:-cell.cap.y,z:cap-cell.cap.z},eps),blocked=allUnblocked?[]:Math.min(...values)>=cap-eps?inside:clip(inside,{...cell.cap,z:cell.cap.z-cap},eps);if(unblocked.length>=3&&area(unblocked)>areaTol)next.push({...cell,polygon:unblocked});if(blocked.length>=3&&area(blocked)>areaTol){constrains=true;next.push({...cell,polygon:blocked,cap:{x:0,y:0,z:cap},obstacle:{kind:'reservation',id:reservation.id??null,reservationKind:reservation.kind??'clearance',description:reservation.description??''}});}}
   }cells=next;if(constrains)constrainingReservations++;if(cells.length>CLEARANCE_LIMITS.cells)throw Error('Clearance reservation partition budget exceeded.');
  }
  const minimum=minVertex(cells,'cap',origin,floor),volume=cells.reduce((s,c)=>s+aboveVolume(c.polygon,c.cap,eps),0),threshold=room.headroomThreshold??0,minClearHeight=room.minClearHeight??room.minimumClearHeight??0;
  const thresholdArea=cells.reduce((s,c)=>{const p=clip(c.polygon,{...c.cap,z:c.cap.z-threshold},eps);return s+(p.length>=3?area(p):0);},0);
  const flat=elevation=>{const height=elevation-floor,feasible=height>tol&&height>=minClearHeight-tol&&elevation<=minimum.elevation+tol;return{elevation,ceilingElevation:elevation,clearHeight:height,requestedVolume:roomArea*Math.max(0,height),usableVolume:feasible?roomArea*Math.max(0,height):null,clippedEnvelopeVolume:cells.reduce((s,c)=>s+cappedVolume(c.polygon,c.cap,height,eps),0),feasible,headroomArea:feasible?(height>=threshold-tol?thresholdArea:0):null,clippedEnvelopeHeadroomArea:height>=threshold-tol?thresholdArea:0};};
  out.status=minimum.elevation<=floor+tol||minimum.elevation-floor<minClearHeight-tol?'infeasible':'ok';out.declared={maxFlatCeilingElevation:minimum.elevation,clearHeight:minimum.elevation-floor,volumeAboveFloor:volume,limitingPoint:minimum.point,limitingObstacle:minimum.obstacle,framingVerification:'unverified'};out.maxFlatCeilingElevation=minimum.elevation;out.maximumFlat={elevation:minimum.elevation,clearHeight:minimum.elevation-floor,volume:out.status==='ok'?roomArea*Math.max(0,minimum.elevation-floor):null,geometricVolume:roomArea*Math.max(0,minimum.elevation-floor),feasible:out.status==='ok'};out.current=flat(room.ceilingElevation);out.target=flat(room.targetCeilingElevation);out.geometricFlatDifference=roomArea*Math.max(0,minimum.elevation-room.ceilingElevation);out.recoverableFlatVolume=out.recoveryVolume=out.status==='ok'&&out.current.feasible?out.geometricFlatDifference:null;out.headroom={threshold,area:Math.min(roomArea,thresholdArea),areaAtOrAboveThreshold:Math.min(roomArea,thresholdArea)};out.limiting={point:minimum.point,obstacle:minimum.obstacle};out.assumptions={assemblyId:assembly.id??null,roofNormalThickness:normalThickness,ceilingFinishThickness:finish,normalThicknessRule:'vertical deduction = normal thickness * sqrt(1 + slopeX^2 + slopeY^2)',reservationRule:'Local-axis reservation lower faces cap a ceiling connected vertically to the room floor; boxes wholly below the floor or above the roof do not constrain it.',minimumClearHeight:minClearHeight,headroomThreshold:threshold,declaredReservationCount:assembly.reservations.length,constrainingReservations,ignoredBelowFloor,framingVerification:'unverified',prefabricatedTrussDesignSurcharge:0,manufacturingComplexitySurcharge:0};
  out.cells=cells.map(c=>({polygon:c.polygon.map(p=>({x:p.x+origin.x,y:p.y+origin.y})),roofPlane:worldPlane(c.roof,origin,floor),ceilingPlane:worldPlane(c.cap,origin,floor),faceId:c.faceId,obstacle:c.obstacle}));out.budget={roomTriangles:roomTriangles.length,roofTriangles:roofTriangles.length,cells:cells.length,work};
  Object.assign(out.assumptions,{analysisMode,roofAssemblyDeclared,roofSurfaceThickness:0,ceilingSurfaceThickness:0});
  out.diagnostics.push({code:'MATHEMATICAL_SPACE',message:analysisMode==='mathematical-zero-thickness'?'Roof and ceiling surfaces have zero thickness. Only explicit reservation boxes constrain the mathematical space.':'Zero-thickness roof and ceiling surfaces use the optional declared thickness offsets and reservation boxes.'});if(out.status==='infeasible')out.diagnostics.push({code:'CLEARANCE_INFEASIBLE',message:'The modeled envelope is below the room floor or required minimum clear height.'});return out;
 }catch(error){out.status='unsupported';out.diagnostics.push({code:'CLEARANCE_UNSUPPORTED',message:error.message});out.declared=null;out.maxFlatCeilingElevation=null;out.maximumFlat=null;out.current=null;out.target=null;out.recoverableFlatVolume=null;out.recoveryVolume=null;out.headroom=null;out.limiting=null;out.cells=[];return out;}
}
