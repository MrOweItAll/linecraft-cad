/* Original R14 read-only, source-bound independent member/face checks.
 * Explicit areas and material loads are declarations, never inferred framing. */
import {createStructuralRoofExport,structuralBridgeHash} from './structural-bridge.mjs';

export const STRUCTURAL_ASSIGNMENTS_VERSION=2;
export const STRUCTURAL_ASSIGNMENTS_LIMITS=Object.freeze({assignments:128,deadLoadItems:32,exchangeBytes:2*1024*1024,tributaryAreaSF:1e9,deadItemPSF:1e6,projectedDeadPSF:1e9,forcePounds:1e12});
const KIND='linecraft-structural-roof-assignments';
const RESULT_KIND='linecraft-structural-roof-assignment-result';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function plain(x,label){if(!x||typeof x!=='object'||Array.isArray(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw Error(`${label} must be a plain object.`);return x;}
function keys(x,allowed,label){plain(x,label);for(const k of Object.keys(x))if(!allowed.includes(k))throw Error(`${label}: unsupported field ${k}.`);}
function text(x,label,max=160){if(typeof x!=='string'||!x.trim()||x.length>max||/[\x00-\x1f]/.test(x))throw Error(`${label} must be nonempty bounded text.`);return x;}
function numeric(x,label,{positive=false,max=1e12}={}){if(!finite(x)||x<0||x>max||positive&&x===0)throw Error(`${label} must be a finite ${positive?'positive':'nonnegative'} bounded number.`);return x;}
function copy(value){structuralBridgeHash(value);const encoded=JSON.stringify(value);if(new TextEncoder().encode(encoded).length>STRUCTURAL_ASSIGNMENTS_LIMITS.exchangeBytes)throw Error('Structural assignment JSON exceeds its byte budget.');return JSON.parse(encoded);}
function equal(a,b){return structuralBridgeHash(a)===structuralBridgeHash(b);}
function array(value,label,min,max){if(!Array.isArray(value)||value.length<min||value.length>max||Object.keys(value).length!==value.length)throw Error(`${label} requires ${min}..${max} dense data rows.`);return value;}
function assignmentId(value){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value))throw Error('Assignment ID requires 1..80 identifier characters.');return value;}
function engineIdentity(raw){keys(raw,['id','version','sourceCommit','roofLiveSHA256'],'External engine identity');text(raw.id,'Engine ID');text(raw.version,'Engine version');if(typeof raw.sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(raw.sourceCommit)||typeof raw.roofLiveSHA256!=='string'||!/^[a-f0-9]{64}$/.test(raw.roofLiveSHA256))throw Error('External engine requires immutable lowercase commit and roof-live SHA-256 identities.');return copy(raw);}
function warnings(review){return[
 'Each assignment is a separate explicit member-to-face check. Repeated member labels do not combine assignments, change the declared tributary area or establish a member design.',
 'Assignment areas are user declarations bounded by the selected face area. Their locations, overlap, exclusivity, coverage and structural load paths are not inferred or verified; no summed face, member or building load is supplied.',
 'Dead-load items are user-supplied PSF declarations. Sloping-surface PSF is converted to horizontal-projected PSF using the exact current source-face pitch; material quantities, densities and installed weights are not verified.',
 'Projected face area, sloping surface area and explicit projected member tributary area remain separate quantities. Source pitches are never averaged across faces.',
 'Source geometry, declared assembly offsets and reservations do not verify member capacity, framing, supports, connections, drainage, supplier fit, load combinations or professional/code approval.',
 'Ceiling and bearing elevations remain separate source fields. No ceiling-to-bearing equality, automatic member grouping or framing association is inferred.',
 ...(review?['This roof is review-only: drainage failed. These calculation-only checks do not approve its geometry for a material/space alternative.']:[])
];}
function normalizeAssignment(raw,faces,ids){
 keys(raw,['id','memberLabel','faceId','projectedTributaryAreaSF','deadLoadItems'],'Assignment');
 const id=assignmentId(raw.id);if(ids.has(id))throw Error(`Duplicate assignment ID ${id}.`);ids.add(id);
 const memberLabel=text(raw.memberLabel,'Member label'),faceId=text(raw.faceId,'Current face ID'),face=faces.find(f=>f.id===faceId);if(!face)throw Error(`Assignment ${id} requires a current face owned by its selected roof region.`);
 const projectedTributaryAreaSF=numeric(raw.projectedTributaryAreaSF,'Explicit projected member tributary area SF',{positive:true,max:STRUCTURAL_ASSIGNMENTS_LIMITS.tributaryAreaSF}),epsilon=Math.max(1e-8,face.projectedAreaSF*1e-10);if(projectedTributaryAreaSF>face.projectedAreaSF+epsilon)throw Error(`Assignment ${id} tributary area exceeds the selected face projected area.`);
 const surfaceToProjectedFactor=Math.sqrt(1+(face.risePer12/12)**2);
 const deadLoadItems=array(raw.deadLoadItems,'Explicit dead-load items',1,STRUCTURAL_ASSIGNMENTS_LIMITS.deadLoadItems).map(item=>{keys(item,['label','psf','basis'],'Dead-load item');const label=text(item.label,'Dead-load label'),psf=numeric(item.psf,'Declared dead-load PSF',{max:STRUCTURAL_ASSIGNMENTS_LIMITS.deadItemPSF});if(!['projected-horizontal','sloping-surface'].includes(item.basis))throw Error('Dead-load basis must be projected-horizontal or sloping-surface.');return{label,psf,basis:item.basis};});
 const items=deadLoadItems.map(item=>{const projectionFactor=item.basis==='sloping-surface'?surfaceToProjectedFactor:1;return{...item,projectionFactor,projectedPSF:item.psf*projectionFactor};}),projectedPSF=numeric(items.reduce((sum,item)=>sum+item.projectedPSF,0),'Summed projected dead-load PSF',{max:STRUCTURAL_ASSIGNMENTS_LIMITS.projectedDeadPSF}),pounds=numeric(projectedPSF*projectedTributaryAreaSF,'Declared assignment dead-load pounds',{max:STRUCTURAL_ASSIGNMENTS_LIMITS.forcePounds});
 return{id,memberLabel,faceId,projectedTributaryAreaSF,deadLoadItems,deadLoad:{surfaceToProjectedFactor,projectedPSF,pounds,items}};
}

/** Does not mutate the document, its architectural source, native files or Undo.
 * Every assignment is independent even when face IDs or member labels repeat. */
export function createStructuralRoofAssignmentExport(document,options){
 const data=copy(options);keys(data,['roofGroupId','componentId','assignments'],'Structural assignment options');array(data.assignments,'Assignments',1,STRUCTURAL_ASSIGNMENTS_LIMITS.assignments);
 const faceIds=[...new Set(data.assignments.map(a=>{plain(a,'Assignment');return text(a.faceId,'Current face ID');}))];
 /* V1 remains the source-generated geometry authority. Its neutral area is not
    exported, reused as assignment intent, or supplied to the load calculator. */
 const geometry=createStructuralRoofExport(document,{roofGroupId:data.roofGroupId,componentId:data.componentId??null,faceIds,memberTributaryAreaSF:1,memberLabel:'R14 source geometry authority only'});
 const ids=new Set(),assignments=data.assignments.map(a=>normalizeAssignment(a,geometry.region.faces,ids));
 const record={version:2,kind:KIND,status:'calculation-only',source:geometry.source,selection:geometry.selection,regionId:geometry.regionId,region:geometry.region,assignments,assumptions:geometry.assumptions,warnings:warnings(geometry.region.reviewRequired)};
 return copy({...record,exportHash:structuralBridgeHash(record)});
}

/** Rebuilds every source face, explicit area, dead-load conversion and warning.
 * A freshly recomputed attacker hash never authorizes changed geometry/data. */
export function validateStructuralRoofAssignmentExport(document,record){
 const data=copy(record);keys(data,['version','kind','status','source','selection','regionId','region','assignments','assumptions','warnings','exportHash'],'Structural assignment request');if(data.version!==2||data.kind!==KIND||data.status!=='calculation-only')throw Error('Unsupported structural assignment request protocol.');
 keys(data.selection,['roofGroupId','componentId','faceIds'],'Assignment selection');array(data.assignments,'Assignments',1,STRUCTURAL_ASSIGNMENTS_LIMITS.assignments);
 const assignments=data.assignments.map(a=>{keys(a,['id','memberLabel','faceId','projectedTributaryAreaSF','deadLoadItems','deadLoad'],'Persisted assignment');return{id:a.id,memberLabel:a.memberLabel,faceId:a.faceId,projectedTributaryAreaSF:a.projectedTributaryAreaSF,deadLoadItems:a.deadLoadItems};});
 const expected=createStructuralRoofAssignmentExport(document,{roofGroupId:data.selection.roofGroupId,componentId:data.selection.componentId,assignments});if(!equal(expected,data))throw Error('Structural assignment request is stale, altered or belongs to another source document.');return expected;
}

/** Arithmetic consistency with an external declaration only. This is not a
 * structural standard, load combination, capacity check or execution receipt. */
export function validateStructuralRoofAssignmentResult(document,requestRecord,resultRecord,options={}){
 keys(options,['expectedEngine'],'Assignment result options');const input=validateStructuralRoofAssignmentExport(document,requestRecord),result=copy(resultRecord);
 keys(result,['version','kind','status','exportHash','source','regionId','engine','calculationBoundsPSF','calculationPrecision','calculations','warnings'],'Structural assignment result');if(result.version!==2||result.kind!==RESULT_KIND||result.status!=='calculation-only')throw Error('Unsupported structural assignment result protocol; calculation-only status is required.');
 keys(result.source,['documentHash','architectureHash'],'Result source');if(result.exportHash!==input.exportHash||result.regionId!==input.regionId||result.source.documentHash!==input.source.documentHash||result.source.architectureHash!==input.source.architectureHash)throw Error('Assignment result does not echo the current source request and region.');
 const engine=engineIdentity(result.engine);if(options.expectedEngine!==undefined&&!equal(engine,engineIdentity(options.expectedEngine)))throw Error('Assignment result engine identity differs from the expected external engine.');
 keys(result.calculationBoundsPSF,['min','max'],'Declared calculation bounds');const min=numeric(result.calculationBoundsPSF.min,'Declared minimum PSF',{max:1e6}),max=numeric(result.calculationBoundsPSF.max,'Declared maximum PSF',{max:1e6});if(max<min)throw Error('Declared calculation bounds are invalid.');
 keys(result.calculationPrecision,['factorDecimals','loadDecimals','forceDecimals'],'Declared calculation precision');for(const key of ['factorDecimals','loadDecimals','forceDecimals'])if(!Number.isInteger(result.calculationPrecision[key])||result.calculationPrecision[key]<0||result.calculationPrecision[key]>12)throw Error('Declared calculation precision requires integer decimal places 0 through 12.');
 const{factorDecimals,loadDecimals,forceDecimals}=result.calculationPrecision,halfFactor=.5*10**-factorDecimals,halfLoad=.5*10**-loadDecimals,clamp=n=>Math.max(min,Math.min(max,n)),rounded=(n,d)=>Math.abs(n-Number(n.toFixed(d)))<=Number.EPSILON*8*Math.max(1,Math.abs(n)),sameRounded=(actual,exact,d)=>Math.abs(actual-exact)<=.5*10**-d+Number.EPSILON*8*Math.max(1,Math.abs(actual),Math.abs(exact));
 array(result.calculations,'Assignment calculations',input.assignments.length,input.assignments.length);const seen=new Set();
 for(const row of result.calculations){
  keys(row,['assignmentId','memberLabel','faceId','pitchRisePer12','projectedTributaryAreaSF','F','R1','R2','L0PSF','LrPSF','deadLoadProjectedPSF','deadLoadPounds','roofLivePounds'],'Assignment calculation');const assignment=input.assignments.find(a=>a.id===row.assignmentId);if(!assignment||seen.has(row.assignmentId))throw Error('Assignment result has a foreign, duplicate or missing assignment ID.');seen.add(row.assignmentId);const face=input.region.faces.find(f=>f.id===assignment.faceId);
  if(row.memberLabel!==assignment.memberLabel||row.faceId!==assignment.faceId||row.projectedTributaryAreaSF!==assignment.projectedTributaryAreaSF||row.pitchRisePer12!==face.risePer12||row.F!==face.risePer12)throw Error('Assignment result substituted a member label, face, pitch or explicit tributary area.');
  for(const key of ['R1','R2','L0PSF','LrPSF'])numeric(row[key],key,{max:1e6});numeric(row.deadLoadProjectedPSF,'Projected dead-load PSF',{max:STRUCTURAL_ASSIGNMENTS_LIMITS.projectedDeadPSF});for(const key of ['deadLoadPounds','roofLivePounds'])numeric(row[key],key,{max:STRUCTURAL_ASSIGNMENTS_LIMITS.forcePounds});
  if(!rounded(row.R1,factorDecimals)||!rounded(row.R2,factorDecimals)||!rounded(row.LrPSF,loadDecimals)||!rounded(row.deadLoadProjectedPSF,loadDecimals)||!rounded(row.deadLoadPounds,forceDecimals)||!rounded(row.roofLivePounds,forceDecimals))throw Error('Assignment result values disagree with their declared output precision.');
  const low=clamp(Math.max(0,row.R1-halfFactor)*Math.max(0,row.R2-halfFactor)*row.L0PSF),high=clamp((row.R1+halfFactor)*(row.R2+halfFactor)*row.L0PSF),epsilon=1e-10*Math.max(1,Math.abs(low),Math.abs(high));if(row.LrPSF+halfLoad<low-epsilon||row.LrPSF-halfLoad>high+epsilon)throw Error('Assignment roof live load is inconsistent with its declared factor rounding intervals and bounds.');
  if(!sameRounded(row.deadLoadProjectedPSF,assignment.deadLoad.projectedPSF,loadDecimals)||!sameRounded(row.deadLoadPounds,assignment.deadLoad.pounds,forceDecimals)||!sameRounded(row.roofLivePounds,row.LrPSF*assignment.projectedTributaryAreaSF,forceDecimals))throw Error('Assignment result dead-load basis or force arithmetic disagrees with the explicit current assignment.');
 }
 array(result.warnings,'External assignment warnings',0,64).forEach(w=>text(w,'External result warning',500));
 return copy({...result,verification:{sourceCurrent:true,exportIntegrity:true,engineIdentity:options.expectedEngine===undefined?'external-declared':'matches-expected-declaration',engineExecutionAuthenticity:'unverified',arithmeticConsistency:'declared-rounding-interval-and-explicit-dead-load-only',structuralApproval:'not-provided',memberCapacity:'not-provided',loadPath:'not-provided',assignmentAggregation:'none',comparisonOnly:true}});
}

export const createStructuralAssignmentRequest=createStructuralRoofAssignmentExport;
export const validateStructuralAssignmentRequest=validateStructuralRoofAssignmentExport;
export const validateStructuralAssignmentResult=validateStructuralRoofAssignmentResult;
