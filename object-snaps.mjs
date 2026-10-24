/* Original anchored perpendicular construction. No editor state or drawing mutation. */
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const xyz=value=>value&&finite(value.x)&&finite(value.y)&&(value.z===undefined||finite(value.z))?{x:value.x,y:value.y,z:value.z??0}:null;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>Math.hypot(a.x,a.y,a.z);
const wrap=angle=>((angle%360)+360)%360;
const arcContains=(entity,angle)=>{
  if(!['ARC','ARC3D'].includes(entity.type))return true;
  if(!finite(entity.startAngle)||!finite(entity.sweepAngle)||entity.sweepAngle===0||Math.abs(entity.sweepAngle)>360)return false;
  return wrap(entity.sweepAngle>0?angle-entity.startAngle:entity.startAngle-angle)<=Math.abs(entity.sweepAngle)+1e-10;
};
function resultPoint(point,spatial){return spatial?point:{x:point.x,y:point.y};}
function addCandidate(result,point,anchor,spatial){
  if(!xyz(point)||point.x===anchor.x&&point.y===anchor.y&&point.z===anchor.z)return;
  if(result.some(candidate=>candidate.point.x===point.x&&candidate.point.y===point.y&&(candidate.point.z??0)===point.z))return;
  result.push({point:resultPoint(point,spatial),type:'perpendicular'});
}
function lineFoot(start,end,anchor){
  const a=xyz(start),b=xyz(end);if(!a||!b)return null;
  const d=sub(b,a),length=norm(d);if(!finite(length)||length===0)return null;
  const u={x:d.x/length,y:d.y/length,z:d.z/length},along=dot(sub(anchor,a),u),parameter=along/length;
  if(!finite(parameter)||parameter < -Number.EPSILON*64||parameter > 1+Number.EPSILON*64)return null;
  const t=Math.max(0,Math.min(1,parameter));
  return{x:a.x+d.x*t,y:a.y+d.y*t,z:a.z+d.z*t};
}
function circularFeet(entity,anchor,result){
  const center=xyz(entity.center),spatial=['CIRCLE3D','ARC3D'].includes(entity.type);
  if(!center||!finite(entity.radius)||entity.radius<=0)return;
  const xAxis=spatial?xyz(entity.xAxis):{x:1,y:0,z:0},yAxis=spatial?xyz(entity.yAxis):{x:0,y:1,z:0};
  if(!xAxis||!yAxis||Math.abs(norm(xAxis)-1)>1e-9||Math.abs(norm(yAxis)-1)>1e-9||Math.abs(dot(xAxis,yAxis))>1e-9)return;
  const relative=sub(anchor,center),x=dot(relative,xAxis),y=dot(relative,yAxis),radial=Math.hypot(x,y);
  // At the axis/center every circle point is stationary; no unique foot exists.
  if(!finite(radial)||radial===0)return;
  const angle=Math.atan2(y,x)*180/Math.PI;
  for(const sign of[1,-1]){
    const at=angle+(sign<0?180:0);if(!arcContains(entity,at))continue;
    const dx=entity.radius*(x/radial)*sign,dy=entity.radius*(y/radial)*sign;
    addCandidate(result,{x:center.x+xAxis.x*dx+yAxis.x*dy,y:center.y+xAxis.y*dx+yAxis.y*dy,z:center.z+xAxis.z*dx+yAxis.z*dy},anchor,spatial);
  }
}
/**
 * Exact analytic normal feet from an accepted world-space base point.
 * Finite LINE/path/mesh edges and circular arcs are respected. The caller owns
 * visibility, layer/resource filtering, projected aperture and occlusion rules.
 * INSERT children must be expanded through the existing engine resource path.
 * No first-point deferred constraint or imaginary edge extension is invented.
 */
export function perpendicularSnapCandidates(entity,rawAnchor){
  const anchor=xyz(rawAnchor);if(!anchor||!entity||typeof entity!=='object')return[];
  const result=[],spatial=['POLY3D','MESH','CIRCLE3D','ARC3D'].includes(entity.type);
  if(['CIRCLE','ARC','CIRCLE3D','ARC3D'].includes(entity.type)){circularFeet(entity,anchor,result);return result;}
  const append=(a,b)=>{const foot=lineFoot(a,b,anchor);if(foot)addCandidate(result,foot,anchor,spatial);};
  if(entity.type==='LINE')append(entity.start,entity.end);
  else if(['RECTANG','PLINE','POLY3D'].includes(entity.type)&&Array.isArray(entity.points)){
    for(let index=1;index<entity.points.length;index++)append(entity.points[index-1],entity.points[index]);
    if((entity.type==='RECTANG'||entity.closed===true)&&entity.points.length>2)append(entity.points.at(-1),entity.points[0]);
  }else if(entity.type==='MESH'&&Array.isArray(entity.vertices)&&Array.isArray(entity.faces)){
    const seen=new Set();for(const face of entity.faces){if(!Array.isArray(face)||face.length<2)continue;
      for(let index=0;index<face.length;index++){const a=face[index],b=face[(index+1)%face.length];if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=entity.vertices.length||b>=entity.vertices.length||a===b)continue;
        const key=a<b?`${a}:${b}`:`${b}:${a}`;if(seen.has(key))continue;seen.add(key);append(entity.vertices[a],entity.vertices[b]);
      }
    }
  }else if(entity.type==='HATCH'&&entity.boundary)return perpendicularSnapCandidates(entity.boundary,rawAnchor);
  return result;
}
