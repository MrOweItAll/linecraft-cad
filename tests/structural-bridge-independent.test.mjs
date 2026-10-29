import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {createJoinedRoofSample} from './export-joined-roof-sample.mjs';
import {deriveJoinedRoofBoundary} from '../architecture/roof-joined.mjs';
import {roofBoundaryEdgeKey} from '../architecture/roof-boundary.mjs';
import {buildCanvasContextMenu} from '../context-menu-policy.mjs';
import {listStructuralRoofRegions,createStructuralRoofExport,validateStructuralRoofExport,validateStructuralRoofResult,structuralBridgeHash} from '../architecture/structural-bridge.mjs';

// Original generic geometry, independently checked against analytic planes and
// cross-product areas. No external structural standard or client plan is copied.
const seed=createJoinedRoofSample(),clone=x=>structuredClone(x),near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`),engine={id:'synthetic-test-engine',version:'0.0.1',sourceCommit:'a'.repeat(40),roofLiveSHA256:'b'.repeat(64)},options={roofGroupId:'roof-1',memberTributaryAreaSF:345.6789,memberLabel:'Independent member comparison'};
function rectangle(units='in'){
 const perFoot={in:12,ft:1,mm:304.8,cm:30.48,m:.3048}[units],s=perFoot,p=[{x:0,y:0},{x:40*s,y:0},{x:40*s,y:20*s},{x:0,y:20*s}],e=createEditor({settings:{...UNIT_PRESETS.architectural,units}});
 const r=e.applyArchitecture({type:'addRoof',name:'Analytic opposing6:12/8:12',boundary:p,roofType:'GABLE',gableAssignments:[1,3].map(i=>roofBoundaryEdgeKey(p[i],p[(i+1)%4])),riseTwice:16,pitchAssignments:[{edgeKey:roofBoundaryEdgeKey(p[0],p[1]),riseTwice:12}],bearingElevation:10*s,overhang:0,heelOffset:0});assert.equal(r.ok,true,r.message);
 const doc=JSON.parse(e.serialize());doc.architecture.levels[0].defaultCeilingElevation=8*s;doc.architecture.levels[0].defaultBearingElevation=10*s;return doc;
}
function resultFor(e,{precision={factorDecimals:4,loadDecimals:3},bounds={min:12,max:20}}={}){return{version:1,kind:'linecraft-structural-roof-result',status:'calculation-only',exportHash:e.exportHash,source:{documentHash:e.source.documentHash,architectureHash:e.source.architectureHash},regionId:e.regionId,engine:clone(engine),calculationBoundsPSF:bounds,calculationPrecision:precision,calculations:e.region.faces.map(f=>({faceId:f.id,pitchRisePer12:f.risePer12,memberTributaryAreaSF:e.member.tributaryAreaSF,F:f.risePer12,R1:1,R2:1,L0PSF:20,LrPSF:20})),warnings:['Synthetic declarations only; no capacity or code qualification.']};}
const exported=(doc=seed,extra={})=>createStructuralRoofExport(doc,{...options,...extra});
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const rehash=x=>{delete x.exportHash;x.exportHash=structuralBridgeHash(x);return x;};

test('Browser-safe canonical SHA256 matches independent Node crypto with Unicode and number boundaries',()=>{
 for(const value of [null,'',{}, {z:'é𐐀',a:[-0,1e-8,1e-6,1e20,1e21,12.5]}, {second:2,first:1},seed])assert.equal(structuralBridgeHash(value),createHash('sha256').update(canonical(value)).digest('hex'));
 assert.equal(structuralBridgeHash({a:1,z:2}),structuralBridgeHash({z:2,a:1}));
});

test('Catalog derives group component and face identities while preserving exact6:12/8:12 pitches',()=>{
 const catalog=listStructuralRoofRegions(seed),g=catalog.regions.find(r=>r.scope==='group');assert.deepEqual(catalog.diagnostics,[]);assert.deepEqual(g.pitches.map(p=>p.risePer12),[6,8]);assert.equal(g.faces.length,6);assert.equal(new Set(catalog.regions.map(r=>r.id)).size,catalog.regions.length);
 for(const f of g.faces){assert.equal(f.roofGroupId,'roof-1');assert.ok(['main','wing'].includes(f.componentId));assert.match(f.sourceEdgeKey,/^edge:/);assert.ok([6,8].includes(f.risePer12));assert.equal(f.riseTwice,f.risePer12*2);}
 near(g.projectedAreaSF,1200);assert.ok(g.surfaceAreaSF>g.projectedAreaSF);
});

test('Analytic asymmetric ridge splits projected area4/7 and3/7 without averaging slopes',()=>{
 const d=rectangle(),e=exported(d),six=e.region.faces.find(f=>f.risePer12===6),eight=e.region.faces.find(f=>f.risePer12===8);assert.equal(e.region.faces.length,2);near(six.projectedAreaSF,800*4/7);near(eight.projectedAreaSF,800*3/7);near(six.surfaceAreaSF,800*4/7*Math.sqrt(1.25));near(eight.surfaceAreaSF,800*3/7*Math.sqrt(13)/3);near(e.region.projectedAreaSF,800);near(e.region.maxElevationFt,10+40/7);
 for(const f of [six,eight]){near(f.bearingElevationFt,10);near(f.eaveElevationFt,10);near(f.heelOffsetFt,0);}near(e.region.elevations.levels[0].defaultCeilingElevationFt,8);near(e.region.elevations.levels[0].defaultBearingElevationFt,10);assert.equal(e.region.elevations.datum,'building-local');
});

test('All five physical drawing units export identical feet SF and per-face pitch',()=>{
 let reference;for(const units of ['in','ft','mm','cm','m']){const e=exported(rectangle(units));assert.equal(e.source.modelUnits,units);near(e.region.projectedAreaSF,800,1e-6);near(e.region.maxElevationFt,10+40/7);for(const f of e.region.faces){const values={pitch:f.risePer12,projected:f.projectedAreaSF,surface:f.surfaceAreaSF,bearing:f.bearingElevationFt};if(reference){const r=reference.find(x=>x.pitch===values.pitch);for(const k of ['projected','surface','bearing'])near(values[k],r[k],1e-6);} }reference??=e.region.faces.map(f=>({pitch:f.risePer12,projected:f.projectedAreaSF,surface:f.surfaceAreaSF,bearing:f.bearingElevationFt}));}
});

test('Translated rotated building frame transforms world feet exactly once and leaves local elevations intact',()=>{
 const d=rectangle();d.architecture.buildingFrame={origin:{x:1200,y:-600,z:24},rotationDegrees:37};const e=exported(d),a=37*Math.PI/180;for(const f of e.region.faces)for(const[p,i]of f.verticesBuildingLocalFt.map((p,i)=>[p,i])){const w=f.verticesWorldFt[i];near(w.x,100+Math.cos(a)*p.x-Math.sin(a)*p.y);near(w.y,-50+Math.sin(a)*p.x+Math.cos(a)*p.y);near(w.z,2+p.z);}near(e.region.faces[0].bearingElevationFt,10);near(e.region.minElevationFt,10);
});

test('Member tributary SF is mandatory positive explicit intent separate from roof areas',()=>{
 for(const value of [undefined,null,0,-1,Infinity,NaN,'300',true,1e13])assert.throws(()=>exported(seed,{memberTributaryAreaSF:value}),/tributary|finite/i);const e=exported(seed,{memberTributaryAreaSF:1.25});assert.equal(e.member.tributaryAreaSF,1.25);assert.equal(e.member.application,'same-member-per-face-comparison');assert.notEqual(e.member.tributaryAreaSF,e.region.projectedAreaSF);assert.match(e.warnings[0],/SAME.*not an area allocation/);
});

test('Selection accepts only exact current group component and owned face IDs',()=>{
 const catalog=listStructuralRoofRegions(seed),main=catalog.regions.find(r=>r.componentId==='main'&&r.faceIds.length>1),f=main.faces[0],single=exported(seed,{componentId:'main',faceIds:[f.id]});assert.equal(single.region.faces.length,1);assert.equal(single.region.faces[0].id,f.id);assert.equal(single.selection.componentId,'main');for(const extra of [{roofGroupId:'missing'},{componentId:'missing'},{componentId:'wing',faceIds:[f.id]},{faceIds:['foreign']},{faceIds:[]},{faceIds:[f.id,f.id]},{faceIds:'all'}])assert.throws(()=>exported(seed,extra));
});

test('All read-only export and result operations preserve drawing source grouped UndoRedo and unrelated native data',()=>{
 const e=createEditor(seed);for(const token of ['LINE','1000,1000','1100,1000',''])assert.equal(e.execute(token).ok,true);const before=e.serialize(),undo=e.canUndo,redo=e.canRedo,ex=exported(before),r=resultFor(ex);listStructuralRoofRegions(before);validateStructuralRoofExport(before,ex);validateStructuralRoofResult(before,ex,r);assert.equal(e.serialize(),before);assert.equal(e.canUndo,undo);assert.equal(e.canRedo,redo);assert.equal(e.undo().ok,true);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),before);
});

test('Catalog exports and returned results are detached copies rather than editor references',()=>{
 const d=clone(seed),before=JSON.stringify(d),a=exported(d),saved=clone(a),r=validateStructuralRoofResult(d,a,resultFor(a));a.region.faces[0].verticesBuildingLocalFt[0].x=1e8;a.region.elevations.levels[0].defaultCeilingElevationFt=1e8;r.calculations[0].F=100;assert.equal(JSON.stringify(d),before);assert.deepEqual(exported(d),saved);
});

test('Zero surface thickness and both zero surcharges remain unchanged while explicit reservations survive',()=>{
 const d=rectangle(),zero=exported(d);assert.equal(zero.assumptions.assemblyNormalThicknessFt,0);assert.equal(zero.assumptions.prefabricatedTrussDesignSurcharge,0);assert.equal(zero.assumptions.manufacturingComplexitySurcharge,0);d.architecture.assemblies=[{id:'assembly-test',name:'Declared offset',layers:[{name:'declared',material:'unverified',normalThickness:4}],reservations:[{id:'keep',kind:'clearance',min:{x:0,y:0,z:90},max:{x:12,y:24,z:96},description:'Declared reserved volume'}],framingVerification:'unverified'}];d.architecture.roofGroups[0].assemblyId='assembly-test';const before=JSON.stringify(d),e=exported(d);near(e.assumptions.assemblyNormalThicknessFt,1/3);assert.equal(e.assumptions.declaredReservations[0].maxBuildingLocalFt.z,8);assert.equal(e.assumptions.structuralVerification,'unverified');assert.equal(JSON.stringify(d),before);assert.deepEqual(e.region.faces,zero.region.faces);
});

test('Review-only drainage source exports visible warnings and cannot become an approved roof',()=>{
 const d=createJoinedRoofSample({equal:true}),g=d.architecture.roofGroups[0],template=clone(g.components[0]),rect=(a,b)=>[{x:a,y:0},{x:b,y:0},{x:b,y:240},{x:a,y:240}];g.components=[['left',0,320],['right',160,480]].map(([id,a,b])=>{const boundary=rect(a,b);return{...clone(template),id,name:id,boundary,pitchAssignments:[],bearingAssignments:[],gableAssignments:[0,2].map(i=>roofBoundaryEdgeKey(boundary[i],boundary[(i+1)%4]))};});g.boundary=deriveJoinedRoofBoundary(g.components).boundary;g.reviewDrainage=true;const e=exported(d);assert.equal(e.region.status,'needs-review');assert.equal(e.region.reviewRequired,true);assert(e.warnings.some(w=>/drainage failed/.test(w)));assert.equal(e.status,'calculation-only');assert.equal(e.assumptions.structuralVerification,'unverified');
});

test('Invalid geometry is diagnostic only and has no exportable partial faces',()=>{
 const d=rectangle(),g=d.architecture.roofGroups[0];g.boundary[1].y=100;g.pitchAssignments=[];g.gableAssignments=[];g.roofType='HIP';const c=listStructuralRoofRegions(d);assert.equal(c.regions.length,0);assert.equal(c.diagnostics.length,1);assert.throws(()=>exported(d));
});

test('Unitless or mismatched source drawing units fail before physical export',()=>{
 const d=rectangle();d.settings.units='unitless';d.architecture.modelUnits='unitless';assert.throws(()=>listStructuralRoofRegions(d),/physical|Assign/i);assert.throws(()=>exported(d),/Assign/i);d.settings.units='ft';d.architecture.modelUnits='in';assert.throws(()=>exported(d),/units differ/i);const none=clone(seed);none.architecture=null;assert.throws(()=>exported(none),/source-owned/);
});

test('Document and architecture identities reject stale unrelated edits as well as roof source changes',()=>{
 const d=rectangle(),e=exported(d);assert.equal(e.source.documentHash,structuralBridgeHash(d));const unrelated=clone(d);unrelated.entities.push({id:'note',type:'TEXT',text:'New unrelated note'});assert.throws(()=>validateStructuralRoofExport(unrelated,e),/stale/);const changed=clone(d);changed.architecture.levels[0].defaultCeilingElevation=108;assert.throws(()=>validateStructuralRoofExport(changed,e),/stale/);assert.equal(exported(changed).source.architectureHash===e.source.architectureHash,false);assert.deepEqual(validateStructuralRoofExport(JSON.stringify(d),e),e);
});

test('Recomputed attacker hashes do not authorize forged geometry pitch totals ownership or warning fields',()=>{
 const d=rectangle(),e=exported(d);for(const mutate of [x=>x.region.faces[0].risePer12=7,x=>x.region.faces[0].verticesWorldFt[0].z++,x=>x.region.surfaceAreaSF++,x=>x.region.faces[0].id='foreign',x=>x.warnings=[],x=>x.source.architectureHash='f'.repeat(64),x=>x.selection.componentId='foreign']){const bad=clone(e);mutate(bad);rehash(bad);assert.throws(()=>validateStructuralRoofExport(d,bad));}assert.throws(()=>createStructuralRoofExport(d,{...options,code:'execute'}),/unsupported/);
});

test('Result validation retains declared engine provenance without claiming execution authenticity or capacity',()=>{
 const d=rectangle(),e=exported(d),r=resultFor(e),v=validateStructuralRoofResult(d,e,r);assert.equal(v.status,'calculation-only');assert.equal(v.verification.engineIdentity,'external-declared');assert.equal(v.verification.engineExecutionAuthenticity,'unverified');assert.equal(v.verification.memberCapacity,'not-provided');assert.equal(v.verification.structuralApproval,'not-provided');assert.equal(validateStructuralRoofResult(d,e,r,{expectedEngine:engine}).verification.engineIdentity,'matches-expected-declaration');assert.throws(()=>validateStructuralRoofResult(d,e,r,{expectedEngine:{...engine,roofLiveSHA256:'c'.repeat(64)}}),/identity/);
});

test('Actual external rounded345.6789SF6:12 factors and15.378PSF are interval-consistent; material errors reject',()=>{
 const d=rectangle(),whole=exported(d),face=whole.region.faces.find(f=>f.risePer12===6),e=exported(d,{faceIds:[face.id]}),r=resultFor(e);Object.assign(r.calculations[0],{R1:.8543,R2:.9,L0PSF:20,LrPSF:15.378});assert.equal(validateStructuralRoofResult(d,e,r).verification.arithmeticConsistency,'declared-rounding-interval-only');const wrong=clone(r);wrong.calculations[0].LrPSF=15.4;assert.throws(()=>validateStructuralRoofResult(d,e,wrong),/inconsistent/);wrong.calculations[0].LrPSF=15.3781;assert.throws(()=>validateStructuralRoofResult(d,e,wrong),/precision/);
});

test('Result cannot substitute an averaged slope, roof area, duplicate row or foreign source face',()=>{
 const d=rectangle(),e=exported(d),r=resultFor(e);for(const mutate of [x=>x.calculations[0].F=7,x=>x.calculations[0].pitchRisePer12=7,x=>x.calculations[0].memberTributaryAreaSF=e.region.projectedAreaSF,x=>x.calculations[1]=clone(x.calculations[0]),x=>x.calculations[0].faceId='foreign',x=>x.calculations.pop()]){const bad=clone(r);mutate(bad);assert.throws(()=>validateStructuralRoofResult(d,e,bad));}
});

test('Results bind full export document architecture and region and reject old source',()=>{
 const d=rectangle(),e=exported(d),r=resultFor(e);for(const mutate of [x=>x.exportHash='0'.repeat(64),x=>x.source.documentHash='0'.repeat(64),x=>x.source.architectureHash='0'.repeat(64),x=>x.regionId='foreign']){const bad=clone(r);mutate(bad);assert.throws(()=>validateStructuralRoofResult(d,e,bad),/echo/);}const changed=clone(d);changed.settings.precision++;assert.throws(()=>validateStructuralRoofResult(changed,e,r),/stale/);
});

test('Unknown approval/executable fields, malformed engine identities and nonfinite result values reject',()=>{
 const d=rectangle(),e=exported(d),r=resultFor(e);for(const mutate of [x=>x.approved=true,x=>x.engine.command='run',x=>x.engine.sourceCommit='latest',x=>x.engine.roofLiveSHA256='missing',x=>x.calculations[0].R1=Infinity,x=>x.calculations[0].R2=-1,x=>x.calculations[0].LrPSF=NaN,x=>x.calculationPrecision.factorDecimals=13,x=>x.calculationPrecision.loadDecimals=.5,x=>x.warnings=['a'.repeat(501)],x=>x.status='approved']){const bad=clone(r);mutate(bad);assert.throws(()=>validateStructuralRoofResult(d,e,bad));}
});

test('Arithmetic validation uses only declared bounds and precision without embedding a code rule',()=>{
 const d=rectangle(),e=exported(d),r=resultFor(e,{bounds:{min:3,max:100},precision:{factorDecimals:12,loadDecimals:12}});for(const row of r.calculations)Object.assign(row,{R1:.5,R2:.5,L0PSF:20,LrPSF:5});assert.equal(validateStructuralRoofResult(d,e,r).calculations[0].LrPSF,5);r.calculations[0].LrPSF=6;assert.throws(()=>validateStructuralRoofResult(d,e,r),/inconsistent/);
});

test('Resolved source-wall bearing and per-edge variable bearings remain distinct from level ceiling',()=>{
 const d=rectangle(),g=d.architecture.roofGroups[0],p=g.boundary;d.architecture.wallNodes=p.map((p,i)=>({id:'n'+i,...p}));d.architecture.walls=p.map((_,i)=>({id:'w'+i,startNodeId:'n'+i,endNodeId:'n'+((i+1)%4),referenceFace:'center',thickness:4,baseElevation:0,bearingElevation:144,role:'bearing',levelId:'level-1',roofGroupId:g.id,heightLocked:false}));g.supportWallIds=d.architecture.walls.map(w=>w.id);const linked=exported(d);assert(linked.region.faces.every(f=>Math.abs(f.bearingElevationFt-12)<1e-8));assert.equal(linked.region.elevations.levels[0].defaultCeilingElevationFt,8);const varied=rectangle(),v=varied.architecture.roofGroups[0];v.bearingAssignments=[{edgeKey:roofBoundaryEdgeKey(v.boundary[2],v.boundary[3]),elevation:144}];const e=exported(varied);assert.deepEqual(e.region.faces.map(f=>f.bearingElevationFt).sort((a,b)=>a-b),[10,12]);assert.equal(e.region.elevations.levels[0].defaultCeilingElevationFt,8);
});

test('Document snapshots reject non-JSON data, nonfinite numbers, deep trees and oversize inputs',()=>{
 assert.throws(()=>structuralBridgeHash({x:undefined}));assert.throws(()=>structuralBridgeHash({x:()=>0}));assert.throws(()=>structuralBridgeHash({x:NaN}));assert.throws(()=>structuralBridgeHash(new Date()));let nested={};for(let i=0;i<70;i++)nested={x:nested};assert.throws(()=>structuralBridgeHash(nested),/budget/);assert.throws(()=>listStructuralRoofRegions(' '.repeat(8*1024*1024+1)),/budget/);assert.throws(()=>validateStructuralRoofResult(seed,exported(),{padding:'x'.repeat(2*1024*1024+1)}),/budget/);
});

test('Structural comparison menu is source-component-only and suppressed by commands and grip operations',()=>{
 const context={command:null,prompt:'Command:',operation:null,selection:{count:1,component:true,generated:true},space:{paper:false}};const ids=c=>buildCanvasContextMenu(c).items.map(x=>x.id);assert(ids(context).includes('structural-bridge'));assert(!ids({...context,selection:{count:1,generated:true,singleOwner:true}}).includes('structural-bridge'));assert(!ids({...context,selection:{count:1,canCopy:true}}).includes('structural-bridge'));assert(!ids({...context,selection:{count:0}}).includes('structural-bridge'));assert(!ids({...context,command:'LINE'}).includes('structural-bridge'));assert(!ids({...context,operation:{kind:'roof-grip',canFinish:true}}).includes('structural-bridge'));
});
