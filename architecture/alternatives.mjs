/* Original R6 bounded proposal search. Every row is independently regenerated from
   source-only data. No result metrics, proposed source, executable expression or
   cached derived mesh can be submitted as an edit. */
import {normalizeArchitecture} from './model.mjs';
import {geometryTolerance,physicalScale} from './units-adapter.mjs';
import {quantifyAlternative,measureTargetBenefit} from './quantities.mjs';
import {analyzeTrayCandidate} from './ceiling-candidates.mjs';

export const ALTERNATIVES_VERSION='alternatives-r6-1';
export const ALTERNATIVE_LIMITS=Object.freeze({candidates:128,probes:128,arrayChoices:16,work:8000000,elapsedMs:30000});
const clone=x=>JSON.parse(JSON.stringify(x));
const plain=(o,label)=>{if(!o||typeof o!=='object'||Array.isArray(o)||![Object.prototype,null].includes(Object.getPrototypeOf(o)))throw Error(`${label} must be a plain object.`);return o;};
const keys=(o,allowed,label)=>{plain(o,label);for(const k of Object.keys(o))if(!allowed.includes(k))throw Error(`${label}: unsupported field ${k}.`);};
const finite=(n,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e9)throw Error(`${label} must be a finite bounded number.`);return n;};
const identifier=(s,label)=>{if(typeof s!=='string'||!s||s.length>80||!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(s))throw Error(`${label} must be a bounded source ID.`);return s;};
const integer=(n,max,def,label)=>{n??=def;if(!Number.isSafeInteger(n)||n<1||n>max)throw Error(`${label} must be an integer 1..${max}.`);return n;};
const list=(raw,def,label,{pitch=false,nonnegative=false}={})=>{const a=raw??def;if(!Array.isArray(a)||!a.length||a.length>ALTERNATIVE_LIMITS.arrayChoices)throw Error(`${label} needs 1..${ALTERNATIVE_LIMITS.arrayChoices} choices.`);for(const n of a){finite(n,label);if(pitch&&(!Number.isInteger(n)||n<2||n>24))throw Error('Pitch choices must be integer riseTwice values 2..24.');if(nonnegative&&n<0)throw Error(`${label} cannot be negative.`);}if(new Set(a).size!==a.length)throw Error(`${label} choices must be unique.`);return [...a].sort((a,b)=>a-b);};
function hash(value){const s=JSON.stringify(value);let a=2166136261,b=0x9e3779b9;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b+s.charCodeAt(i),2246822519);}return`${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;}
export function alternativeConfigurationId(configuration){return`r6-${hash(configuration)}`;}
function point(p,label){keys(p,['x','y'],label);return{x:finite(p.x,`${label}.x`),y:finite(p.y,`${label}.y`)};}
function normalizedConfiguration(raw){
 keys(raw,['version','roomId','roofGroupId','ceiling','roof'],'alternative configuration');if(raw.version!==1)throw Error('Alternative configuration version must be 1.');
 const roomId=identifier(raw.roomId,'roomId'),roofGroupId=identifier(raw.roofGroupId,'roofGroupId');plain(raw.ceiling,'ceiling');let ceiling;
 if(raw.ceiling.type==='flat'){keys(raw.ceiling,['type','elevation'],'flat ceiling');ceiling={type:'flat',elevation:finite(raw.ceiling.elevation,'ceiling.elevation')};}
 else if(raw.ceiling.type==='tray'){keys(raw.ceiling,['type','min','max','baseElevation','raisedElevation'],'tray ceiling');ceiling={type:'tray',min:point(raw.ceiling.min,'ceiling.min'),max:point(raw.ceiling.max,'ceiling.max'),baseElevation:finite(raw.ceiling.baseElevation,'ceiling.baseElevation'),raisedElevation:finite(raw.ceiling.raisedElevation,'ceiling.raisedElevation')};if(ceiling.max.x<=ceiling.min.x||ceiling.max.y<=ceiling.min.y||ceiling.raisedElevation<=ceiling.baseElevation)throw Error('Tray bounds and rise must be positive.');}
 else throw Error('Alternative ceiling type must be flat or tray.');
 keys(raw.roof,['riseTwice','bearingOffset'],'alternative roof');const riseTwice=finite(raw.roof.riseTwice,'roof.riseTwice'),bearingOffset=finite(raw.roof.bearingOffset,'roof.bearingOffset');if(!Number.isInteger(riseTwice)||riseTwice<2||riseTwice>24)throw Error('Alternative pitch must be an integer riseTwice 2..24.');
 return{version:1,roomId,roofGroupId,ceiling,roof:{riseTwice,bearingOffset}};
}
function currentConfiguration(source,room,group){return{version:1,roomId:room.id,roofGroupId:group.id,ceiling:room.trayCeiling?{type:'tray',...clone(room.trayCeiling)}:{type:'flat',elevation:room.ceilingElevation},roof:{riseTwice:group.riseTwice,bearingOffset:0}};}
function selected(source,roomId,roofGroupId){const room=source.rooms.find(r=>r.id===roomId),group=source.roofGroups.find(g=>g.id===roofGroupId);if(!room||!group)throw Error('The selected room and roof group must exist.');return{room,group};}

export function normalizeAlternativeOptions(rawSource,settings={},raw={}){
 const source=normalizeArchitecture(rawSource,settings);if(!source)throw Error('Architectural source is required.');physicalScale(source.modelUnits);
 keys(raw,['roomId','roofGroupId','mode','flatElevations','trayInsets','trayBaseElevations','trayRaisedElevations','includeMaximumFit','pitchChoices','bearingOffsets','maxCandidates','maxWork','maxElapsedMs'],'alternative options');
 const roomId=identifier(raw.roomId??source.rooms[0]?.id,'roomId'),roofGroupId=identifier(raw.roofGroupId??source.roofGroups[0]?.id,'roofGroupId'),{room,group}=selected(source,roomId,roofGroupId),mode=raw.mode??'fixed-roof';if(!['fixed-roof','co-design'].includes(mode))throw Error('Alternative mode must be fixed-roof or co-design.');
 const scale=physicalScale(source.modelUnits),flatElevations=list(raw.flatElevations,[...new Set([room.ceilingElevation,room.targetCeilingElevation])],'flatElevations'),trayInsets=list(raw.trayInsets,[304.8/scale,609.6/scale],'trayInsets',{nonnegative:true}),trayBaseElevations=list(raw.trayBaseElevations,[room.ceilingElevation],'trayBaseElevations'),trayRaisedElevations=list(raw.trayRaisedElevations,[room.targetCeilingElevation],'trayRaisedElevations'),pitchChoices=list(raw.pitchChoices,[group.riseTwice],'pitchChoices',{pitch:true}),bearingOffsets=list(raw.bearingOffsets,[0],'bearingOffsets'),includeMaximumFit=raw.includeMaximumFit??true;
 if(typeof includeMaximumFit!=='boolean')throw Error('includeMaximumFit must be boolean.');
 if(mode==='fixed-roof'&&(pitchChoices.some(p=>p!==group.riseTwice)||bearingOffsets.some(o=>o!==0)))throw Error('Fixed-roof search cannot change pitch or bearing heights.');
 for(const elevation of [...flatElevations,...trayBaseElevations,...trayRaisedElevations])if(elevation<=room.floorElevation)throw Error('Proposed ceiling elevations must exceed the room floor.');
 return{roomId,roofGroupId,mode,flatElevations,trayInsets,trayBaseElevations,trayRaisedElevations,includeMaximumFit,pitchChoices,bearingOffsets,maxCandidates:integer(raw.maxCandidates,ALTERNATIVE_LIMITS.candidates,64,'maxCandidates'),maxWork:integer(raw.maxWork,ALTERNATIVE_LIMITS.work,4000000,'maxWork'),maxElapsedMs:integer(raw.maxElapsedMs,ALTERNATIVE_LIMITS.elapsedMs,10000,'maxElapsedMs')};
}
function applyConfiguration(source,configuration){
 const proposed=clone(source),{room,group}=selected(proposed,configuration.roomId,configuration.roofGroupId),before=currentConfiguration(source,source.rooms.find(r=>r.id===room.id),source.roofGroups.find(g=>g.id===group.id));
 const ceilingChanged=JSON.stringify(before.ceiling)!==JSON.stringify(configuration.ceiling);if(ceilingChanged&&!room.allowCeilingChange)throw Error(`Room ${room.id} does not permit ceiling changes.`);
 const c=configuration.ceiling;room.ceilingType=c.type;room.ceilingElevation=c.type==='flat'?c.elevation:c.baseElevation;room.trayCeiling=c.type==='tray'?{min:clone(c.min),max:clone(c.max),baseElevation:c.baseElevation,raisedElevation:c.raisedElevation}:null;
 const offset=configuration.roof.bearingOffset,pitchChanged=configuration.roof.riseTwice!==group.riseTwice;
 if(group.components?.length&&(offset!==0||pitchChanged))throw Error('Joined roof pitch and bearing edits require explicit component revisions. R6 parent-default co-design cannot change a composed roof.');
 if(group.pitchAssignments?.length&&pitchChanged)throw Error('Changing the default pitch of a per-edge roof through R6 co-design is unsupported. Review its explicit edge pitches in the Roof pane.');
 if(offset!==0||pitchChanged){
  if(group.eaveElevation!==null)throw Error('Co-design with an explicit common eave elevation is unsupported. Review and clear that source override first.');
  const supportIds=new Set([...(group.boundarySource==='walls'?group.boundaryWallIds:[]),...group.supportWallIds,...proposed.walls.filter(w=>w.roofGroupId===group.id).map(w=>w.id)]);
  for(const other of proposed.roofGroups.filter(g=>g.id!==group.id)){const otherIds=[...(other.boundarySource==='walls'?other.boundaryWallIds:[]),...other.supportWallIds,...proposed.walls.filter(w=>w.roofGroupId===other.id).map(w=>w.id)];if(otherIds.some(id=>supportIds.has(id)))throw Error('Co-design of shared roof support walls requires a separate support-group decision.');}
  if(offset!==0){for(const wall of proposed.walls.filter(w=>supportIds.has(w.id))){if(wall.heightLocked)throw Error(`Wall ${wall.id} height is locked.`);wall.bearingElevation+=offset;}group.bearingElevation+=offset;for(const a of group.bearingAssignments)a.elevation+=offset;}
  group.riseTwice=configuration.roof.riseTwice;
 }
 return normalizeArchitecture(proposed,{units:source.modelUnits});
}
const messages=derived=>(derived?.diagnostics??[]).map(d=>typeof d==='string'?d:d.message).filter(Boolean);
function qualify(source,derived){
 if(!derived||derived.validation?.geometry!=='ok')throw Error(messages(derived).join(' ')||'Architectural geometry is incomplete.');
 if(!Array.isArray(derived.roofs)||derived.roofs.length!==source.roofGroups.length||derived.roofs.some(r=>r.status!=='ok'))throw Error('Every source roof must have current valid geometry.');
 if(!Array.isArray(derived.rooms)||derived.rooms.length!==source.rooms.length||new Set(derived.rooms.map(r=>r.id)).size!==source.rooms.length||derived.rooms.some(r=>r.identityStatus!=='assigned'||!source.rooms.some(intent=>intent.id===r.id)))throw Error('Every enclosed room needs one uniquely assigned source room before alternatives can be compared; unresolved or unrecognized regions have unknown ceiling feasibility.');
 if(!Array.isArray(derived.spaces)||derived.spaces.length!==source.rooms.length||new Set(derived.spaces.map(s=>s.roomId)).size!==source.rooms.length||derived.spaces.some(s=>!source.rooms.some(r=>r.id===s.roomId)))throw Error('Every enclosed room must have one complete current ceiling analysis before alternatives can be compared.');
 for(const room of source.rooms){const space=derived.spaces?.find(s=>s.roomId===room.id);if(!space||space.status!=='ok'||space.current?.feasible!==true)throw Error(`Room ${room.id} has an infeasible or incomplete accepted ceiling; no alternative is ranked.`);}
 if(!source.rooms.length)throw Error('At least one recognized source room is required.');
}
function workOf(source,derived){return Math.max(1,(derived.clearanceBudget?.work??0)+source.wallNodes.length+source.walls.length+source.rooms.length+derived.roofs.reduce((s,r)=>s+(r.faces??[]).reduce((n,f)=>n+(f.vertices?.length??0),0)+(r.budget?.patches??0),0));}
function evaluatePrepared(source,settings,configuration,derive){
 const id=alternativeConfigurationId(configuration);let usedWork=1;try{
  const proposed=applyConfiguration(source,configuration),derived=derive(clone(proposed),clone(settings));usedWork=workOf(proposed,derived);qualify(proposed,derived);
  const space=derived.spaces.find(s=>s.roomId===configuration.roomId);if(space.roofId!==configuration.roofGroupId)throw Error('The selected roof is not the sole accepted covering roof for this room.');
  const quantities=quantifyAlternative(proposed,derived),metrics=measureTargetBenefit(proposed,derived),work=workOf(proposed,derived);
  return{status:'ok',source:proposed,configuration:clone(configuration),report:{id,status:'ok',configuration:clone(configuration),metrics,quantities,validation:{geometry:'valid',declaredClearance:'valid',framing:'unverified',supplier:'unverified'},roofGeometryFingerprint:derived.roofGeometryFingerprint,roofCoverage:derived.roofs.map(r=>({roofGroupId:r.id,eaveBoundary:clone(r.eaveBoundary)})),budget:{work},diagnostics:[]}};
 }catch(error){return{status:'infeasible',source:null,configuration:clone(configuration),report:{id,status:'infeasible',configuration:clone(configuration),metrics:null,quantities:null,validation:{geometry:'not-qualified',declaredClearance:'not-qualified',framing:'unverified',supplier:'unverified'},budget:{work:usedWork},diagnostics:[{code:'ALTERNATIVE_REJECTED',message:error.message}]}};}
}

/** Apply uses this exact re-evaluation; supplied IDs/metrics/source are not fields. */
export function evaluateAlternative(rawSource,settings={},rawConfiguration,{derive}={}){
 if(typeof derive!=='function')throw Error('The existing architectural derive callback is required.');const source=normalizeArchitecture(rawSource,settings);if(!source)throw Error('Architectural source is required.');physicalScale(source.modelUnits);const configuration=normalizedConfiguration(rawConfiguration);
 const baseline=derive(clone(source),clone(settings));try{qualify(source,baseline);}catch(error){return{status:'unsupported',source:null,configuration,report:{id:alternativeConfigurationId(configuration),status:'unsupported',configuration,metrics:null,quantities:null,diagnostics:[{code:'BASELINE_UNQUALIFIED',message:error.message}],budget:{work:workOf(source,baseline)}}};}
 const evaluated=evaluatePrepared(source,settings,configuration,derive);
 if(evaluated.status==='ok'){
  const unchangedRoof=configuration.roof.riseTwice===source.roofGroups.find(g=>g.id===configuration.roofGroupId).riseTwice&&configuration.roof.bearingOffset===0;
  if(unchangedRoof&&evaluated.report.roofGeometryFingerprint!==baseline.roofGeometryFingerprint)return{status:'unsupported',source:null,configuration,report:{id:alternativeConfigurationId(configuration),status:'unsupported',configuration,metrics:null,quantities:null,budget:evaluated.report.budget,diagnostics:[{code:'FIXED_ROOF_CHANGED',message:'A ceiling-only alternative changed the accepted roof geometry.'}]}};
  for(const coverage of evaluated.report.roofCoverage)if(JSON.stringify(baseline.roofs.find(r=>r.id===coverage.roofGroupId)?.eaveBoundary)!==JSON.stringify(coverage.eaveBoundary))return{status:'unsupported',source:null,configuration,report:{id:alternativeConfigurationId(configuration),status:'unsupported',configuration,metrics:null,quantities:null,budget:evaluated.report.budget,diagnostics:[{code:'ROOF_COVERAGE_CHANGED',message:'A bounded alternative changed fixed projected roof coverage.'}]}};
 }
 return evaluated;
}

export const ALTERNATIVE_OBJECTIVES=Object.freeze([{key:'weightedTargetBenefitVolume',direction:'max',units:'cubic model units weighted by declared room priority'},{key:'roofSurfaceArea',direction:'min',units:'square model units'},{key:'wallMaterialVolumeNominal',direction:'min',units:'cubic model units; nominal'},{key:'grossRoomBoundaryFinishArea',direction:'min',units:'square model units; gross boundary surface'},{key:'ceilingVerticalReturnArea',direction:'min',units:'square model units'},{key:'gableClosureArea',direction:'min',units:'square model units'},{key:'stepClosureArea',direction:'min',units:'square model units'},{key:'ridge',direction:'min',units:'model units'},{key:'hip',direction:'min',units:'model units'},{key:'valley',direction:'min',units:'model units'},{key:'eave',direction:'min',units:'model units'},{key:'rake',direction:'min',units:'model units'}]);
function objectiveValue(row,key){return key==='weightedTargetBenefitVolume'?row.metrics.weightedTargetBenefitVolume:row.quantities.totals[key]??row.quantities.totals.roofEdgeLengths[key];}
export function paretoAlternatives(rows){
 if(!Array.isArray(rows)||rows.length>ALTERNATIVE_LIMITS.candidates)throw Error('Pareto input exceeds the candidate budget.');const valid=rows.filter(r=>r.status==='ok');
 for(const r of valid)for(const o of ALTERNATIVE_OBJECTIVES){const v=objectiveValue(r,o.key);if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('An objective is missing or nonfinite.');}
 const dominates=(a,b)=>{let strict=false;for(const o of ALTERNATIVE_OBJECTIVES){const av=objectiveValue(a,o.key),bv=objectiveValue(b,o.key),eps=Math.max(1,Math.abs(av),Math.abs(bv))*1e-9;if(o.direction==='max'){if(av<bv-eps)return false;if(av>bv+eps)strict=true;}else{if(av>bv+eps)return false;if(av<bv-eps)strict=true;}}return strict;};
 return valid.map(row=>({...clone(row),dominatedBy:valid.filter(other=>other!==row&&dominates(other,row)).map(r=>r.id),pareto:!valid.some(other=>other!==row&&dominates(other,row))}));
}
async function candidates(source,settings,baseline,options,derive,{checkpoint,charge,probe}){
 const {room,group}=selected(source,options.roomId,options.roofGroupId),current=currentConfiguration(source,room,group),resolved=baseline.rooms.find(r=>r.id===room.id);if(!resolved?.boundary?.length)throw Error('Selected room has no resolved interior polygon.');
 const xs=resolved.boundary.map(p=>p.x),ys=resolved.boundary.map(p=>p.y),lo={x:Math.min(...xs),y:Math.min(...ys)},hi={x:Math.max(...xs),y:Math.max(...ys)},rows=[current],seen=new Set([JSON.stringify(current)]),tolerance=geometryTolerance({units:source.modelUnits});
 const add=c=>{const key=JSON.stringify(c);if(seen.has(key))return;seen.add(key);rows.push(c);if(rows.length>ALTERNATIVE_LIMITS.candidates)throw Error('Requested grid exceeds the hard 128-configuration limit. Narrow the stated ranges.');if(rows.length>options.maxCandidates)throw Error(`Requested grid needs more than maxCandidates ${options.maxCandidates} configurations. Narrow the ranges.`);};
 if(options.pitchChoices.length*options.bearingOffsets.length>ALTERNATIVE_LIMITS.candidates)throw Error('Requested roof grid exceeds the 128-configuration limit.');
 for(const riseTwice of options.pitchChoices)for(const bearingOffset of options.bearingOffsets){
  if(!await checkpoint())return null;
  const roof={riseTwice,bearingOffset},profiles=[clone(current.ceiling),...options.flatElevations.map(elevation=>({type:'flat',elevation}))],baseElevations=[...options.trayBaseElevations];let analysis=null;
  if(options.includeMaximumFit){
   if(riseTwice===group.riseTwice&&bearingOffset===0)analysis=baseline.spaces.find(s=>s.roomId===room.id);
   else{try{const proposed=applyConfiguration(source,{...current,roof}),geometry=derive(clone(proposed),clone(settings));charge(workOf(proposed,geometry));analysis=geometry.spaces?.find(s=>s.roomId===room.id);}catch{analysis=null;}}
   const fit=analysis?.declared?.maxFlatCeilingElevation;if(Number.isFinite(fit)){const elevation=Math.min(room.targetCeilingElevation,fit);if(elevation>room.floorElevation+tolerance){profiles.push({type:'flat',elevation});if(!baseElevations.includes(elevation))baseElevations.push(elevation);}}
  }
  for(const inset of options.trayInsets)for(const baseElevation of baseElevations){
   if(!await checkpoint())return null;const min={x:lo.x+inset,y:lo.y+inset},max={x:hi.x-inset,y:hi.y-inset};if(min.x>=max.x||min.y>=max.y)continue;
   for(const raisedElevation of options.trayRaisedElevations)if(raisedElevation>baseElevation+tolerance)profiles.push({type:'tray',min:clone(min),max:clone(max),baseElevation,raisedElevation});
   if(options.includeMaximumFit&&analysis?.declared&&analysis.cells?.length){
    probe();const requested=Math.max(baseElevation+tolerance*2,room.targetCeilingElevation),study=analyzeTrayCandidate({analysis,room:{...resolved,...room,boundary:resolved.boundary},candidate:{min,max,baseElevation,raisedElevation:requested},tolerance});charge(study.budget?.work??1);
    const raisedElevation=Math.min(room.targetCeilingElevation,study.maximumRaisedElevation??-Infinity);if(study.status!=='unsupported'&&Number.isFinite(raisedElevation)&&raisedElevation>baseElevation+tolerance)profiles.push({type:'tray',min:clone(min),max:clone(max),baseElevation,raisedElevation});
   }
  }
  for(const ceiling of profiles)add({version:1,roomId:room.id,roofGroupId:group.id,ceiling,roof:clone(roof)});
 }
 return rows;
}

/** One bounded synchronous existing-engine solve per asynchronous yield. A cancelled,
    timed-out or work-limited study retains evidence rows but has no Pareto ranking. */
export function createAlternativeSearch(rawSource,settings={},rawOptions={}, {derive}={}){
 if(typeof derive!=='function')throw Error('The existing architectural derive callback is required.');const source=normalizeArchitecture(rawSource,settings),options=normalizeAlternativeOptions(source,settings,rawOptions),inputHash=hash(source),settingsSnapshot=clone(settings);let cancelled=false,promise=null;
 const controller={cancel(){cancelled=true;},run({onProgress,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),signal}={}){
  if(promise)return promise;if(typeof yieldControl!=='function'||onProgress!==undefined&&typeof onProgress!=='function')throw Error('Progress and cooperative yield hooks must be functions.');
  promise=(async()=>{
   const started=Date.now(),report={version:ALTERNATIVES_VERSION,inputHash,inputRevision:source.revision,options:clone(options),status:'running',complete:false,stoppingReason:null,candidateCount:0,evaluatedCount:0,validCount:0,rejectedCount:0,elapsedMs:0,budget:{work:0,probeCount:0,maxProbes:ALTERNATIVE_LIMITS.probes,maxWork:options.maxWork,maxElapsedMs:options.maxElapsedMs,maxCandidates:options.maxCandidates},baselineId:null,rows:[],ranked:[],paretoIds:[],objectives:clone(ALTERNATIVE_OBJECTIVES),framingVerification:'unverified',materialModel:'partial-quantified',prefabricatedTrussDesignSurcharge:0,manufacturingComplexitySurcharge:0,diagnostics:[],claim:'Best found within the explicitly stated bounded configuration grid; no global optimum or complete material/cost optimum is claimed.'};
   const notify=()=>{report.elapsedMs=Date.now()-started;if(onProgress)onProgress(clone({status:report.status,evaluatedCount:report.evaluatedCount,candidateCount:report.candidateCount,validCount:report.validCount,rejectedCount:report.rejectedCount,elapsedMs:report.elapsedMs,work:report.budget.work}));};
   const interrupted=()=>{if(cancelled||signal?.aborted){report.status='cancelled';report.stoppingReason='cancelled';return true;}if(Date.now()-started>options.maxElapsedMs){report.status='budget-exceeded';report.stoppingReason='elapsed-time-budget';return true;}if(report.budget.work>options.maxWork){report.status='budget-exceeded';report.stoppingReason='work-budget';return true;}return false;};
   try{
    await yieldControl();if(interrupted())return report;
    const baseline=derive(clone(source),clone(settingsSnapshot));report.budget.work+=workOf(source,baseline);qualify(source,baseline);
    const configurations=await candidates(source,settingsSnapshot,baseline,options,derive,{checkpoint:async()=>{await yieldControl();return!interrupted();},charge:n=>{report.budget.work+=n;},probe:()=>{report.budget.probeCount++;if(report.budget.probeCount>ALTERNATIVE_LIMITS.probes)throw Error('Maximum-fit analytical probe budget exceeded. Narrow the grid.');}});if(!configurations)return report;report.candidateCount=configurations.length;report.baselineId=alternativeConfigurationId(configurations[0]);notify();
    for(const configuration of configurations){
     await yieldControl();if(interrupted())break;
     const evaluated=evaluatePrepared(source,settingsSnapshot,configuration,derive),row=evaluated.report;report.budget.work+=row.budget.work;
     if(evaluated.status==='ok'){
      const fixed=configuration.roof.riseTwice===source.roofGroups.find(g=>g.id===configuration.roofGroupId).riseTwice&&configuration.roof.bearingOffset===0;
      if(fixed&&row.roofGeometryFingerprint!==baseline.roofGeometryFingerprint)throw Error('Fixed-roof ceiling proposal changed accepted roof geometry.');
      for(const coverage of row.roofCoverage){const prior=baseline.roofs.find(r=>r.id===coverage.roofGroupId);if(JSON.stringify(prior?.eaveBoundary)!==JSON.stringify(coverage.eaveBoundary))throw Error('A bounded alternative changed fixed projected roof coverage.');}
      report.validCount++;
     }else report.rejectedCount++;
     report.rows.push(row);report.evaluatedCount++;notify();if(interrupted())break;
    }
    if(report.status==='running'){report.status='complete';report.complete=true;report.stoppingReason='configuration-grid-exhausted';report.ranked=paretoAlternatives(report.rows);report.paretoIds=report.ranked.filter(r=>r.pareto).map(r=>r.id);}
   }catch(error){report.status='unsupported';report.complete=false;report.stoppingReason='validation-or-configuration';report.diagnostics.push({code:'ALTERNATIVE_STUDY_UNSUPPORTED',message:error.message});report.ranked=[];report.paretoIds=[];}
   finally{report.elapsedMs=Date.now()-started;notify();}
   return report;
  })();return promise;
 }};return controller;
}
