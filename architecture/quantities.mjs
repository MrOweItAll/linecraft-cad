/* Original R6 quantity ledger. Quantities keep their physical units and confidence;
   no price, triangulation penalty, structural member or purchase count is invented. */
import {geometryTolerance,physicalScale} from './units-adapter.mjs';
import {normalizeRoofBoundary,roofBoundaryEdgeKey} from './roof-boundary.mjs';

export const ALTERNATIVE_QUANTITY_VERSION='quantities-r6-1';
const bounded=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e18;
const area2=points=>{const o=points[0];let a=0;for(let i=1;i<points.length-1;i++)a+=(points[i].x-o.x)*(points[i+1].y-o.y)-(points[i+1].x-o.x)*(points[i].y-o.y);return Math.abs(a)/2;};
function faceMeasure(vertices,tolerance=1e-7){
 if(!Array.isArray(vertices)||vertices.length<3||vertices.length>512||vertices.some(p=>!p||!['x','y','z'].every(k=>bounded(p[k]))))throw Error('Quantity face has invalid bounded vertices.');
 const o=vertices[0],normal={x:0,y:0,z:0};for(let i=1;i<vertices.length-1;i++){const a=vertices[i],b=vertices[i+1],u={x:a.x-o.x,y:a.y-o.y,z:a.z-o.z},v={x:b.x-o.x,y:b.y-o.y,z:b.z-o.z};normal.x+=u.y*v.z-u.z*v.y;normal.y+=u.z*v.x-u.x*v.z;normal.z+=u.x*v.y-u.y*v.x;}
 const magnitude=Math.hypot(normal.x,normal.y,normal.z);if(magnitude<=0)throw Error('Quantity face is degenerate.');for(const p of vertices)if(Math.abs(normal.x*(p.x-o.x)+normal.y*(p.y-o.y)+normal.z*(p.z-o.z))/magnitude>tolerance)throw Error('Quantity face is not planar within the physical tolerance.');
 return{surfaceArea:magnitude/2,projectedArea:Math.abs(normal.z)/2,slope:Math.abs(normal.z)>1e-15?Math.hypot(normal.x,normal.y)/Math.abs(normal.z):Infinity};
}
const length=edge=>Math.hypot(edge.a.x-edge.b.x,edge.a.y-edge.b.y,edge.a.z-edge.b.z);
const nonnegative=(value,label)=>{if(!bounded(value)||value<0)throw Error(`${label} is not a finite nonnegative quantity.`);return value;};

/** Validate a complete derived model and measure only its accepted roof skin.
    Vertical gable/step closures and ceiling returns remain separate ledger rows. */
export function quantifyAlternative(source,derived){
 physicalScale(source?.modelUnits);const tolerance=geometryTolerance({units:source.modelUnits});
 if(!derived||derived.validation?.geometry!=='ok'||!Array.isArray(derived.roofs)||derived.roofs.length!==source.roofGroups.length||derived.roofs.some(r=>r.status!=='ok'))throw Error('Only complete valid current geometry has material quantities.');
 const roofGroups=derived.roofs.map(roof=>{
  const group=source.roofGroups.find(g=>g.id===roof.id);if(!group||!Array.isArray(roof.faces)||!roof.faces.length||roof.faces.length>4096)throw Error('Roof quantity identity or face budget is invalid.');
  const pitchOverrides=new Map((group.pitchAssignments??[]).map(a=>[a.edgeKey,a.riseTwice/24])),pitches=roof.faces.map(f=>{
   if(!group.components?.length)return pitchOverrides.get(roof.sourceEdgeKeys?.[f.sourceEdge]??f.sourceEdgeKey)??group.riseTwice/24;
   const component=group.components.find(c=>c.id===f.componentId);if(!component)throw Error('Joined quantity facet has no current source component.');const boundary=normalizeRoofBoundary(component.boundary,{tolerance}),i=f.sourceEdge;if(!Number.isInteger(i)||i<0||i>=4)throw Error('Joined quantity facet has an invalid source edge.');const key=roofBoundaryEdgeKey(boundary[i],boundary[(i+1)%4]);if(key!==f.sourceEdgeKey||component.gableAssignments.includes(key))throw Error('Joined quantity facet source key is stale or stationary.');return(component.pitchAssignments.find(a=>a.edgeKey===key)?.riseTwice??component.riseTwice)/24;
  }),mixed=pitches.some(p=>p!==pitches[0]),pitch=pitches[0],measurements=roof.faces.map(f=>faceMeasure(f.vertices,tolerance));
  if(measurements.some((m,i)=>m.projectedArea<=0||Math.abs(m.slope-pitches[i])>Math.max(1e-7,pitches[i]*1e-7)))throw Error('Roof skin contains a vertical, degenerate or source-pitch-mismatched surface.');
  const projectedArea=measurements.reduce((s,m)=>s+m.projectedArea,0),roofSurfaceArea=measurements.reduce((s,m)=>s+m.surfaceArea,0),expectedSurfaceArea=mixed?measurements.reduce((s,m,i)=>s+m.projectedArea*Math.hypot(1,pitches[i]),0):projectedArea*Math.sqrt(1+pitch*pitch),checkTolerance=Math.max(tolerance*tolerance*8,expectedSurfaceArea*1e-8);
  if(Math.abs(roofSurfaceArea-expectedSurfaceArea)>checkTolerance)throw Error(mixed?'Per-face pitch area invariant failed.':'Same-pitch roof area invariant failed.');
  if(!Array.isArray(roof.eaveBoundary)||Math.abs(area2(roof.eaveBoundary)-projectedArea)>Math.max(checkTolerance,projectedArea*1e-8))throw Error('Roof skin projection does not conserve its single coverage domain.');
  const edgeLengths={ridge:0,hip:0,valley:0,eave:0,rake:0};
  if(!Array.isArray(roof.edges)||roof.edges.length>16384)throw Error('Roof edge quantity budget is invalid.');
  for(const e of roof.edges){if(!e?.a||!e?.b||!['x','y','z'].every(k=>bounded(e.a[k])&&bounded(e.b[k])))throw Error('Roof edge has invalid quantity coordinates.');if(Object.hasOwn(edgeLengths,e.kind))edgeLengths[e.kind]+=length(e);}
  const closureArea=items=>{if(!Array.isArray(items)||items.length>4096)throw Error('Closure quantity budget is invalid.');return items.reduce((s,c)=>s+faceMeasure(c.vertices,tolerance).surfaceArea,0);};
  const assembly=source.assemblies.find(a=>a.id===group.assemblyId);
  return{roofGroupId:roof.id,pitch:mixed?null:pitch,...(mixed?{pitchMode:'per-edge',facePitches:roof.faces.map((f,i)=>({faceId:f.id,sourceEdge:f.sourceEdge,pitch:pitches[i],projectedArea:measurements[i].projectedArea,surfaceArea:measurements[i].surfaceArea}))}:{}),projectedArea,roofSurfaceArea,gableClosureArea:closureArea(roof.gableClosures??[]),stepClosureArea:closureArea(roof.stepClosures??[]),edgeLengths:{...edgeLengths,step:null},areaInvariant:{status:'verified',...(mixed?{basis:'sum of each projected facet area times sqrt(1 + its declared source pitch squared)'}:{}),expectedSurfaceArea,actualSurfaceArea:roofSurfaceArea,tolerance:checkTolerance,verticalClosuresExcluded:true},layers:(assembly?.layers??[]).map(l=>({assemblyId:assembly.id,layerName:l.name,material:l.material,normalThickness:l.normalThickness,netSurfaceArea:roofSurfaceArea,nominalVolume:roofSurfaceArea*l.normalThickness,confidence:'declared nominal; joints and waste excluded'}))};
 });
 const ceilingFinishes=source.rooms.map(room=>{
  const resolved=derived.rooms.find(r=>r.id===room.id),space=derived.spaces.find(s=>s.roomId===room.id);if(!resolved||!space?.current?.feasible)throw Error(`Room ${room.id} has no complete feasible accepted ceiling.`);
  const horizontalFinishArea=nonnegative(resolved.area,'Room ceiling area'),tray=room.trayCeiling,verticalReturnArea=tray?2*(tray.max.x-tray.min.x+tray.max.y-tray.min.y)*(tray.raisedElevation-tray.baseElevation):0;
  const perimeter=resolved.boundary.reduce((s,p,i)=>s+Math.hypot(p.x-resolved.boundary[(i+1)%resolved.boundary.length].x,p.y-resolved.boundary[(i+1)%resolved.boundary.length].y),0),grossRoomBoundaryFinishArea=perimeter*(room.ceilingElevation-room.floorElevation);
  return{roomId:room.id,horizontalFinishArea,verticalReturnArea,roomBoundaryPerimeter:perimeter,grossRoomBoundaryFinishArea,roomBoundaryFinishBasis:'Gross vertical room boundary from floor to flat/base ceiling; openings, intersections, backing and waste not deducted. Zero modeled thickness.',declaredVerticalFinishThickness:room.ceilingFinishThickness,horizontalFinishVolumeNominal:horizontalFinishArea*room.ceilingFinishThickness,verticalReturnThickness:0,verticalReturnMaterialVolume:0,confidence:'mathematical surfaces; optional horizontal finish volume nominal'};
 });
 const sum=key=>roofGroups.reduce((s,r)=>s+r[key],0),edgeTotals={...Object.fromEntries(['ridge','hip','valley','eave','rake'].map(k=>[k,roofGroups.reduce((s,r)=>s+r.edgeLengths[k],0)])),step:null};
 return{version:ALTERNATIVE_QUANTITY_VERSION,status:'partial-quantified',modelUnits:source.modelUnits,areaUnits:'square model units',lengthUnits:'model units',volumeUnits:'cubic model units',roofGroups,ceilingFinishes,totals:{roofSurfaceArea:sum('roofSurfaceArea'),roofProjectedArea:sum('projectedArea'),gableClosureArea:sum('gableClosureArea'),stepClosureArea:sum('stepClosureArea'),roofEdgeLengths:edgeTotals,wallReferenceLength:nonnegative(derived.quantities?.wallReferenceLength??0,'Wall reference length'),wallMaterialVolumeNominal:nonnegative(derived.quantities?.wallMaterialVolumeNominal??0,'Wall volume'),ceilingHorizontalFinishArea:ceilingFinishes.reduce((s,c)=>s+c.horizontalFinishArea,0),ceilingVerticalReturnArea:ceilingFinishes.reduce((s,c)=>s+c.verticalReturnArea,0),grossRoomBoundaryFinishArea:ceilingFinishes.reduce((s,c)=>s+c.grossRoomBoundaryFinishArea,0)},roofLayerMaterials:roofGroups.flatMap(r=>r.layers),framingLumber:null,connectors:null,sheetPurchaseQuantity:null,cuttingWaste:null,prices:null,totalCost:null,prefabricatedTrussDesignSurcharge:0,manufacturingComplexitySurcharge:0,framingVerification:'unverified',limitations:['Roof layers use actual sloped area times declared normal thickness; joins, intersections and waste are excluded.','Wall nominal volume retains existing junction overlap limitations.','Step flashing and roof-to-wall interface length are unquantified; step closure area is reported separately.','Room boundary finish is gross vertical geometric area to the flat/base ceiling; openings, junctions, backing and waste are not deducted.','Gable and step closures and tray returns are separate zero-thickness surfaces. Their material volume is zero unless a future explicit assembly is provided.','No structural member, fastener, supplier quotation, sheet layout, purchase quantity or total cost is inferred.']};
}

/** Integrate the actual accepted profile, capped at each room target before sum.
    Tray cells carry constant profile elevations, not an average height surrogate. */
export function measureTargetBenefit(source,derived){
 const tolerance=geometryTolerance({units:source.modelUnits}),rooms=[];
 for(const room of source.rooms){
  const resolved=derived.rooms.find(r=>r.id===room.id),space=derived.spaces.find(s=>s.roomId===room.id);if(!resolved||!space?.current?.feasible)throw Error(`Room ${room.id} is not currently feasible.`);
  const cells=room.trayCeiling?space.acceptedTray?.cells:[{polygon:resolved.boundary,ceilingElevation:room.ceilingElevation}];
  if(!Array.isArray(cells)||!cells.length||cells.length>20480)throw Error('Complete bounded accepted ceiling profile cells are required.');
  let targetBenefitVolume=0,usableVolume=0,headroomArea=0,coveredArea=0,minElevation=Infinity,maxElevation=-Infinity;
  for(const cell of cells){if(!Array.isArray(cell.polygon)||cell.polygon.length<3||cell.polygon.length>512||cell.polygon.some(p=>!p||!bounded(p.x)||!bounded(p.y))||!bounded(cell.ceilingElevation))throw Error('Accepted ceiling profile cell is invalid.');const area=area2(cell.polygon),height=cell.ceilingElevation-room.floorElevation;if(height<=0)throw Error('A ceiling cell is below its room floor.');coveredArea+=area;usableVolume+=area*height;targetBenefitVolume+=area*Math.min(height,room.targetCeilingElevation-room.floorElevation);if(height>=room.headroomThreshold-tolerance)headroomArea+=area;minElevation=Math.min(minElevation,cell.ceilingElevation);maxElevation=Math.max(maxElevation,cell.ceilingElevation);}
  if(Math.abs(coveredArea-resolved.area)>Math.max(tolerance*tolerance*8,resolved.area*1e-8))throw Error('Accepted ceiling profile cells fail area conservation.');
  rooms.push({roomId:room.id,profileType:room.ceilingType,area:coveredArea,floorElevation:room.floorElevation,targetCeilingElevation:room.targetCeilingElevation,minimumCeilingElevation:minElevation,maximumCeilingElevation:maxElevation,targetBenefitVolume,weightedTargetBenefitVolume:targetBenefitVolume*room.priority,usableVolume,headroomArea,targetVolume:coveredArea*(room.targetCeilingElevation-room.floorElevation),framingVerification:'unverified'});
 }
 const sum=k=>rooms.reduce((s,r)=>s+r[k],0);return{rooms,targetBenefitVolume:sum('targetBenefitVolume'),weightedTargetBenefitVolume:sum('weightedTargetBenefitVolume'),usableVolume:sum('usableVolume'),headroomArea:sum('headroomArea'),targetVolume:sum('targetVolume'),capRule:'Integrate min(actual accepted ceiling height, requested target height) above each room floor for every accepted profile cell.',framingVerification:'unverified'};
}
