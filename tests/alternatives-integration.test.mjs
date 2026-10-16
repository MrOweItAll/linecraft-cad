import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {normalizeArchitecture} from '../architecture/model.mjs';
import {createArchitectureAlternativeSearch,evaluateArchitectureAlternative,architectureInputHash,buildArchitectureAlternativeReport} from '../architecture/editor-adapter.mjs';
import {alternativeConfigurationId} from '../architecture/alternatives.mjs';
const boundary=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}];
const apply=(e,op)=>{const r=e.applyArchitecture(op);assert.equal(r.ok,true,r.message);return r;};
function fixture(){
 const e=createEditor({settings:UNIT_PRESETS.architectural});
 apply(e,{type:'addWalls',points:boundary,closed:true,thickness:6,referenceFace:'left',bearingElevation:120,baseElevation:0,role:'exterior'});apply(e,{type:'recognizeRooms'});
 const roomId=e.state.architecture.rooms[0].id;apply(e,{type:'setRoom',roomId,values:{ceilingElevation:96,targetCeilingElevation:108,allowCeilingChange:true,ceilingFinishThickness:0}});
 apply(e,{type:'addRoof',id:'roof-1',name:'Independent R6 integration',boundary,riseTwice:8,bearingElevation:120,overhang:0,roofType:'HIP'});
 const layout=e.addLayout('R6 report',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true);assert.equal(e.addViewport(layout.layoutId,{x:220,y:12,width:180,height:250},{scaleDenominator:96,locked:true}).ok,true);
 for(const token of ['LINE','600,0','650,0',''])assert.equal(e.execute(token).ok,true);
 const configuration={version:1,roomId,roofGroupId:'roof-1',ceiling:{type:'flat',elevation:108},roof:{riseTwice:8,bearingOffset:0}};
 return{e,roomId,configuration,layoutId:layout.layoutId};
}
const operation=(e,configuration)=>({type:'applyAlternative',configuration,candidateId:alternativeConfigurationId(configuration),sourceRevision:e.state.architecture.revision,sourceHash:architectureInputHash(e.state.architecture)});

test('R6 search and printable proposal are read-only and use the existing exact generator',async()=>{
 const {e,configuration}=fixture(),before=e.serialize(),undo=e.canUndo;
 const report=await createArchitectureAlternativeSearch(e.state.architecture,e.state.settings,{flatElevations:[96,108],trayInsets:[24],trayRaisedElevations:[120]}).run({yieldControl:async()=>{}});
 assert.equal(report.complete,true);assert.ok(report.ranked.length);assert.ok(report.rows.find(r=>r.id===report.baselineId));
 const print=buildArchitectureAlternativeReport(e.state.architecture,e.state.settings,configuration);
 assert.equal(print.status,'ok');assert.ok(print.lines.length>20&&print.lines.length<60);assert.ok(print.lines.every(l=>typeof l==='string'&&l.length<=105&&!/[\r\n]/.test(l)));
 assert.match(print.lines.join(' '),/framing UNVERIFIED/);assert.match(print.lines.join(' '),/surcharge = 0/);assert.match(print.lines.join(' '),/prices and total cost/);
 assert.equal(print.report.metrics.targetBenefitVolume,480*240*108);assert.equal(e.serialize(),before);assert.equal(e.canUndo,undo);
});

test('R6 Apply is one existing Undo record; preserves drafting, layout scale, camera, units and prior history',()=>{
 const {e,configuration}=fixture();assert.equal(e.setWorkspace('3d').ok,true);assert.equal(e.set3DView({target:{x:240,y:120,z:140},yaw:35,pitch:25,scale:1,autoTarget:false}).ok,true);
 const before=e.serialize(),fixed=structuredClone({entities:e.state.entities.filter(x=>!x.id.startsWith('@architecture/')),layouts:e.state.layouts,settings:e.state.settings,camera:e.state.camera3d,layers:e.state.layers}),fingerprint=e.getArchitectureReport().roofGeometryFingerprint;
 apply(e,operation(e,configuration));const after=e.serialize();assert.equal(e.state.architecture.rooms[0].ceilingElevation,108);assert.equal(e.state.architecture.roofGroups[0].bearingElevation,120);assert.equal(e.state.architecture.acceptedAlternativeId,alternativeConfigurationId(configuration));assert.equal(e.getArchitectureReport().roofGeometryFingerprint,fingerprint);
 assert.deepEqual({entities:e.state.entities.filter(x=>!x.id.startsWith('@architecture/')),layouts:e.state.layouts,settings:e.state.settings,camera:e.state.camera3d,layers:e.state.layers},fixed);
 assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);assert.equal(e.undo().ok,true);assert.equal(e.undo().ok,true);assert.equal(e.state.entities.some(x=>x.type==='LINE'&&!x.id.startsWith('@architecture/')),false);
});

test('R6 stale revision/hash and mismatched identities reject without a content or history change',()=>{
 const {e,configuration}=fixture(),before=e.serialize(),valid=operation(e,configuration);
 for(const patch of [{sourceRevision:valid.sourceRevision-1},{sourceHash:'0000000000000000'},{candidateId:'r6-0000000000000000'},{sourceHash:null},{candidateId:undefined}]){const r=e.applyArchitecture({...valid,...patch});assert.equal(r.ok,false);assert.equal(e.serialize(),before);}
 assert.equal(e.undo().ok,true);assert.equal(e.state.entities.some(x=>x.type==='LINE'&&!x.id.startsWith('@architecture/')),false);
});

test('R6 forged metrics, source and derived meshes are not accepted as Apply fields',()=>{
 const {e,configuration}=fixture(),before=e.serialize();
 for(const field of ['metrics','source','derived','roofGeometryFingerprint','acceptedAlternativeId','price']){const r=e.applyArchitecture({...operation(e,configuration),[field]:{fake:true}});assert.equal(r.ok,false,field);assert.equal(e.serialize(),before);}
 for(const field of ['expression','metrics','bearingElevation']){const bad={...configuration,[field]:'1+1'};assert.equal(e.applyArchitecture(operation(e,bad)).ok,false);assert.equal(e.serialize(),before);}
});

test('R6 Apply recomputes infeasible proposals and cannot bypass ceiling locks',()=>{
 const {e,configuration,roomId}=fixture(),before=e.serialize();const bad={...configuration,ceiling:{type:'flat',elevation:200}};assert.equal(e.applyArchitecture(operation(e,bad)).ok,false);assert.equal(e.serialize(),before);
 apply(e,{type:'setRoom',roomId,values:{allowCeilingChange:false}});const locked=e.serialize();assert.equal(e.applyArchitecture(operation(e,configuration)).ok,false);assert.equal(e.serialize(),locked);
});

test('R6 accepted receipt round-trips source-only native data and clears on a later semantic edit',()=>{
 const {e,configuration,roomId}=fixture();apply(e,operation(e,configuration));const saved=e.serialize(),reopened=createEditor(JSON.parse(saved));assert.equal(reopened.serialize(),saved);assert.equal(reopened.state.architecture.acceptedAlternativeId,alternativeConfigurationId(configuration));
 const architecture=JSON.parse(saved).architecture;for(const field of ['derived','metrics','alternatives','faces','report'])assert.equal(Object.hasOwn(architecture,field),false);
 apply(e,{type:'setRoom',roomId,values:{label:'Changed room'}});assert.equal(e.state.architecture.acceptedAlternativeId,null);assert.equal(e.undo().ok,true);assert.equal(e.state.architecture.acceptedAlternativeId,alternativeConfigurationId(configuration));
});

test('R6 historical sources migrate without fabricated receipts; future schemas and malformed receipts reject',()=>{
 for(const name of ['roof-space-H-v19','ceiling-space-v110','tray-ceiling-v111','gable-v112','scripting-v1121','roof-plot-v1122','bearing-v113']){const path=new URL(`../samples/${name}.linecraft`,import.meta.url),bytes=readFileSync(path,'utf8'),e=createEditor(JSON.parse(bytes));assert.equal(e.state.architecture.schemaVersion,6);assert.equal(e.state.architecture.acceptedAlternativeId,null);assert.equal(readFileSync(path,'utf8'),bytes);}
 const {e,configuration}=fixture(),raw=structuredClone(e.state.architecture);for(const value of ['r6-abc',12,{},'javascript:alert(1)'])assert.throws(()=>normalizeArchitecture({...raw,acceptedAlternativeId:value},e.state.settings));assert.throws(()=>normalizeArchitecture({...raw,schemaVersion:7},e.state.settings));assert.throws(()=>normalizeArchitecture({...raw,schemaVersion:5,acceptedAlternativeId:alternativeConfigurationId(configuration)},e.state.settings));
});

test('R6 printable report inserts as ordinary paper text in one revision without navigating or altering model',()=>{
 const {e,configuration,layoutId}=fixture(),print=buildArchitectureAlternativeReport(e.state.architecture,e.state.settings,configuration),before=e.serialize(),context=structuredClone(e.state.activeSpace),arch=structuredClone(e.state.architecture);
 const steps=[{op:'space',space:'paper',layoutId},...print.lines.map((line,i)=>({op:'commands',tokens:['TEXT',`12,${275-i*4.5}`,'3','0',line]}))];
 const r=e.applyRevision({label:'R6 static mathematical report',steps});assert.equal(r.ok,true,r.message);assert.deepEqual(e.state.architecture,arch);assert.deepEqual(e.state.activeSpace,context);
 const reportEntities=e.state.entities.filter(x=>x.type==='TEXT'&&x.layoutId===layoutId);assert.equal(reportEntities.length,print.lines.length);assert.ok(reportEntities.every(x=>x.position.x===12&&x.height===3));assert.match(reportEntities.map(x=>x.text).join(' '),/prices and total cost/);
 const after=e.serialize();assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);assert.equal(e.redo().ok,true);assert.equal(e.serialize(),after);
});

test('R6 rejected multi-step report revision discards all preceding text atomically',()=>{
 const {e,layoutId}=fixture(),before=e.serialize();const r=e.applyRevision({label:'Invalid report',steps:[{op:'space',space:'paper',layoutId},{op:'commands',tokens:['TEXT','12,270','3','0','valid literal']},{op:'commands',tokens:['LINE','0,0']}]});assert.equal(r.ok,false);assert.equal(e.serialize(),before);
});

test('R6 explicit evaluated profile and applied native model agree on target-capped benefit and independent bearing',()=>{
 const {e,configuration}=fixture(),proposal=evaluateArchitectureAlternative(e.state.architecture,e.state.settings,configuration);assert.equal(proposal.status,'ok');apply(e,operation(e,configuration));const actual=e.getArchitectureReport();assert.equal(actual.spaces[0].current.feasible,true);assert.equal(actual.source.rooms[0].ceilingElevation,108);assert.equal(actual.source.roofGroups[0].bearingElevation,120);assert.equal(actual.spaces[0].current.usableVolume,proposal.report.metrics.usableVolume);
});

test('R6 acceptance receipt does not invalidate a later existing zero-thickness operation source token',()=>{
 const {e,configuration,roomId}=fixture();apply(e,operation(e,configuration));assert.ok(e.state.architecture.acceptedAlternativeId);
 const before=e.serialize();apply(e,{type:'useZeroThickness',roomId,roofGroupId:'roof-1',sourceRevision:e.state.architecture.revision,sourceHash:architectureInputHash(e.state.architecture)});assert.equal(e.state.architecture.acceptedAlternativeId,null);assert.equal(e.state.architecture.rooms[0].ceilingElevation,108);assert.equal(e.state.architecture.roofGroups[0].bearingElevation,120);assert.equal(e.undo().ok,true);assert.equal(e.serialize(),before);
});
