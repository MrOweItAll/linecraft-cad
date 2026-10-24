/* Original pure edits of confirmed rectangular roof source. Bounds are model
   units in the building frame; no wall, ceiling or roof vertex is moved here. */
import {normalizeRoofComponents,deriveJoinedRoofBoundary} from './roof-joined.mjs';
import {roofBoundaryEdgeKey} from './roof-boundary.mjs';
import {geometryTolerance} from './units-adapter.mjs';

const clone=structuredClone;
const plain=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(`${label} must be a plain object.`);};
const exactKeys=(value,allowed,label)=>{plain(value,label);if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error(`${label} contains an unsupported field.`);};
const valueFields=['name','roofType','riseTwice','pitchAssignments','bearingElevation','bearingAssignments','heelOffset','overhang','rakeOverhang','gableAssignments','gablePolicy'];
const boundsFor=points=>({minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))});

/** Draft-only proposal. Optional value assignment keys refer to the CURRENT
 * component edges, before resizing; edge roles are mapped by physical side.
 * The normal editor transaction still validates the resulting roof/drainage. */
export function reviseRoofComponentBounds(architecture,roofGroupId,componentId,bounds,options={}){
  plain(architecture,'Architectural source');exactKeys(options,['values'],'Component edit options');
  exactKeys(bounds,['minX','minY','maxX','maxY'],'Component bounds');
  if(!['minX','minY','maxX','maxY'].every(key=>typeof bounds[key]==='number'&&Number.isFinite(bounds[key])&&Math.abs(bounds[key])<=1e9)||bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)throw Error('Component bounds require finite ordered minimum/maximum coordinates within the model range.');
  const group=architecture.roofGroups?.find(item=>item.id===roofGroupId);
  if(!group)throw Error(`Roof group ${roofGroupId} does not exist.`);
  if(!Array.isArray(group.components)||!group.components.length)throw Error('Footprint editing requires an explicit joined roof component.');
  if((group.boundarySource??'explicit')!=='explicit'||group.boundaryWallIds?.length||group.supportWallIds?.length||architecture.walls?.some(wall=>wall.roofGroupId===group.id))throw Error('Wall-linked roof coverage requires an explicit component/support mapping; walls cannot move with this footprint edit.');
  if(group.bearingAssignments?.length||group.pitchAssignments?.length||group.gableAssignments?.length||group.eaveElevation!=null)throw Error('Joined footprint editing requires component-owned edge constraints.');
  const index=group.components.findIndex(item=>item.id===componentId);
  if(index<0)throw Error(`Roof component ${componentId} does not exist.`);
  const original=normalizeRoofComponents([group.components[index]])[0],old=boundsFor(original.boundary),values=options.values===undefined?{}:options.values;
  exactKeys(values,valueFields,'Component draft values');
  const boundary=original.boundary.map(point=>({x:point.x===old.minX?bounds.minX:bounds.maxX,y:point.y===old.minY?bounds.minY:bounds.maxY}));
  const mapping=original.boundary.map((point,i)=>{const next=original.boundary[(i+1)%4],side=point.y===next.y?(point.y===old.minY?'south':'north'):(point.x===old.minX?'west':'east');return{side,oldEdgeKey:roofBoundaryEdgeKey(point,next),newEdgeKey:roofBoundaryEdgeKey(boundary[i],boundary[(i+1)%4])};});
  const keys=new Map(mapping.map(item=>[item.oldEdgeKey,item.newEdgeKey]));
  const remap=key=>{if(!keys.has(key))throw Error('A component draft edge assignment is stale; review the current source sides before resizing.');return keys.get(key);};
  const draft={...original,...clone(values),boundary};
  for(const field of ['pitchAssignments','bearingAssignments']){
    if(!Array.isArray(draft[field]))throw Error(`${field} must be an array of current edge assignments.`);
    draft[field]=draft[field].map(assignment=>{plain(assignment,'Component edge assignment');return{...assignment,edgeKey:remap(assignment.edgeKey)};});
  }
  if(!Array.isArray(draft.gableAssignments))throw Error('gableAssignments must be an array of current edge keys.');
  draft.gableAssignments=draft.gableAssignments.map(remap);
  const component=normalizeRoofComponents([draft])[0],updated=clone(group);updated.components[index]=component;
  const coverage=deriveJoinedRoofBoundary(updated.components,{tolerance:geometryTolerance({units:architecture.modelUnits})});
  if(coverage.status!=='ok')throw Error(coverage.diagnostics.join(' '));
  if(['minX','minY','maxX','maxY'].some(key=>bounds[key]!==old[key]))updated.boundary=coverage.boundary;
  return{group:updated,mapping,changed:JSON.stringify(updated)!==JSON.stringify(group)};
}
