/* Static, independently formatted mathematical quantity report. No editor or filesystem access. */
import {formatLength,formatArea,modelToInches} from '../units.mjs';

export function formatAlternativeReport(source,settings,row){
 if(row?.status!=='ok'||!row.metrics||!row.quantities)throw Error('A complete feasible alternative is required for a printed report.');
 const s={...settings,units:source.modelUnits},imperial=['architectural','engineering'].includes(s.linearFormat),p=2;
 const length=n=>`${formatLength(n,s,{precision:p})}${imperial?'':` ${source.modelUnits}`}`;
 const area=n=>formatArea(n,s,{precision:p});
 const volume=n=>`${(n*(imperial?(modelToInches(source.modelUnits)/12)**3:1)).toFixed(p)} ${imperial?'ft':source.modelUnits}^3`;
 const q=row.quantities.totals,c=row.configuration,room=source.rooms.find(r=>r.id===c.roomId),roof=source.roofGroups.find(g=>g.id===c.roofGroupId),m=row.metrics.rooms.find(r=>r.roomId===c.roomId);
 const title=x=>String(x).replace(/[\x00-\x1f]/g,' ').slice(0,120);
 const raw=[
  'LINECRAFT ROOF + SPACE | R6 MATHEMATICAL ALTERNATIVE',
  `Configuration: ${row.id} | source revision ${source.revision}`,
  `Proposal only. Current acceptance receipt: ${source.acceptedAlternativeId??'none'}.`,
  `Room: ${title(room.label)} (${room.id}) | roof: ${title(roof.name)} (${roof.id})`,
  `Floor ${length(room.floorElevation)} | target ceiling ${length(room.targetCeilingElevation)}`,
  c.ceiling.type==='flat'?`Proposed flat ceiling: ${length(c.ceiling.elevation)}`:`Proposed tray base ${length(c.ceiling.baseElevation)} | raised ${length(c.ceiling.raisedElevation)}`,
  ...(c.ceiling.type==='tray'?[`Tray rectangle: (${length(c.ceiling.min.x)}, ${length(c.ceiling.min.y)}) to (${length(c.ceiling.max.x)}, ${length(c.ceiling.max.y)})`]:[]),
  `Pitch ${c.roof.riseTwice/2}:12 | uniform bearing offset ${length(c.roof.bearingOffset)}`,
  'Ceiling and bearing elevations are independent. Roof and closures have zero thickness.',
  `Selected room capped benefit ${volume(m.targetBenefitVolume)} | usable volume ${volume(m.usableVolume)}`,
  `Selected room headroom area ${area(m.headroomArea)} | ceiling range ${length(m.minimumCeilingElevation)} to ${length(m.maximumCeilingElevation)}`,
  `All ${row.metrics.rooms.length} rooms: capped benefit ${volume(row.metrics.targetBenefitVolume)} / target ${volume(row.metrics.targetVolume)}`,
  `All rooms usable volume ${volume(row.metrics.usableVolume)} | headroom area ${area(row.metrics.headroomArea)}`,
  `Priority-weighted capped benefit ${volume(row.metrics.weightedTargetBenefitVolume)} (dimensionless priority factors)`,
  'PARTIAL QUANTITY LEDGER | all values describe this re-evaluated configuration',
  `Roof skin ${area(q.roofSurfaceArea)} | horizontal projection ${area(q.roofProjectedArea)}`,
  `Vertical gable closures ${area(q.gableClosureArea)} | step closures ${area(q.stepClosureArea)}`,
  `Roof ridge ${length(q.roofEdgeLengths.ridge)} | hip ${length(q.roofEdgeLengths.hip)} | valley ${length(q.roofEdgeLengths.valley)}`,
  `Eave ${length(q.roofEdgeLengths.eave)} | rake ${length(q.roofEdgeLengths.rake)} | step interface length not quantified`,
  `Wall reference length ${length(q.wallReferenceLength)} | nominal wall volume ${volume(q.wallMaterialVolumeNominal)}`,
  `Ceiling horizontal finish ${area(q.ceilingHorizontalFinishArea)} | vertical tray returns ${area(q.ceilingVerticalReturnArea)}`,
  `Gross room boundary finish ${area(q.grossRoomBoundaryFinishArea)}; openings, junctions and waste not deducted.`,
  `Declared roof layers: ${row.quantities.roofLayerMaterials.length}; nominal total volume ${volume(row.quantities.roofLayerMaterials.reduce((sum,l)=>sum+l.nominalVolume,0))}.`,
  'Same-pitch area invariant verified on actual sloped faces; vertical closures excluded.',
  'CONFIDENCE: partial mathematical quantities; physical clearances checked; framing UNVERIFIED.',
  'Unknown: framing lumber, connectors, sheet purchases, cutting waste, prices and total cost.',
  'Wall nominal volumes retain junction overlap. Optional declared layer thickness is retained.',
  'Roof, closure and tray-return surfaces imply no structural assembly or structural approval.',
  'Prefabricated-truss design surcharge = 0; manufacturing-complexity surcharge = 0.',
  'Static configuration report; no global optimum, cost estimate or supplier feasibility claimed.',
  'Full finite-search bounds, stopping status and Pareto data remain in the comparison JSON.'
 ];
 const lines=[];for(const line of raw){let remaining=String(line).replace(/[\x00-\x1f]/g,' ');while(remaining.length>105){let at=remaining.lastIndexOf(' ',105);if(at<20)at=105;lines.push(remaining.slice(0,at));remaining=remaining.slice(at).trimStart();}lines.push(remaining);}
 return{status:'ok',candidateId:row.id,sourceRevision:source.revision,lines,report:structuredClone(row),confidence:'partial-quantified; framing unverified'};
}
