import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {generateArchitecture} from '../architecture/editor-adapter.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';
import {roofBoundaryEdgeKey} from '../architecture/roof-boundary.mjs';
import {createAlternativeSearch,evaluateAlternative,normalizeAlternativeOptions,alternativeConfigurationId,paretoAlternatives,ALTERNATIVE_OBJECTIVES} from '../architecture/alternatives.mjs';
import {quantifyAlternative,measureTargetBenefit} from '../architecture/quantities.mjs';

const clone=structuredClone,near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`),derive=generateArchitecture;
const rectangle=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}];
function setup({roofType='HIP',wallSource=false,target=132,allowed=true,bearing=120,ceiling=96}={}){
 const e=createEditor({settings:UNIT_PRESETS.architectural}),apply=operation=>{const r=e.applyArchitecture(operation);assert.equal(r.ok,true,r.message);};
 apply({type:'addWalls',points:rectangle,closed:true,thickness:6,referenceFace:'left',bearingElevation:bearing,baseElevation:0,role:'exterior'});apply({type:'recognizeRooms'});
 const roomId=e.state.architecture.rooms[0].id;apply({type:'setRoom',roomId,values:{ceilingElevation:ceiling,targetCeilingElevation:target,allowCeilingChange:allowed,ceilingFinishThickness:0,headroomThreshold:108}});
 const gableAssignments=roofType==='GABLE'?inferGableCandidates(rectangle).alternatives.find(a=>a.ridgeDirection==='X').edgeKeys:[];
 apply({type:'addRoof',id:'roof-1',name:'R6 analytical rectangle',...(wallSource?{wallIds:e.state.architecture.walls.map(w=>w.id)}:{boundary:rectangle}),riseTwice:8,bearingElevation:bearing,overhang:0,rakeOverhang:0,roofType,gableAssignments,gablePolicy:'ALL_GABLE'});
 return{e,source:clone(e.state.architecture),settings:clone(e.state.settings),roomId,roofGroupId:'roof-1'};
}
function config(s,{type='flat',elevation=108,riseTwice=8,bearingOffset=0,...tray}={}){return{version:1,roomId:s.roomId,roofGroupId:s.roofGroupId,ceiling:type==='flat'?{type,elevation}:{type,...tray},roof:{riseTwice,bearingOffset}};}
const evaluate=(s,c)=>evaluateAlternative(s.source,s.settings,c,{derive});
const search=(s,options={},hooks={})=>createAlternativeSearch(s.source,s.settings,options,{derive}).run({yieldControl:async()=>{},...hooks});

test('R6 fixed-roof current and 9ft flat ceiling integrate the independently known clear rectangle, without source/history changes',async()=>{
 const s=setup({target:108}),before=s.e.serialize(),r=await search(s,{flatElevations:[96,108],trayInsets:[24],trayRaisedElevations:[108]});assert.equal(r.status,'complete',JSON.stringify(r.diagnostics));
 const current=r.rows.find(row=>row.id===r.baselineId),flat=r.rows.find(row=>row.configuration.ceiling.type==='flat'&&row.configuration.ceiling.elevation===108);assert.equal(flat.status,'ok');
 const area=480*240;assert.deepEqual(derive(s.source,s.settings).rooms[0].boundary,rectangle);near(current.metrics.usableVolume,area*96);near(flat.metrics.usableVolume,area*108);near(flat.metrics.targetBenefitVolume,area*108);near(flat.metrics.headroomArea,area);
 assert.equal(s.e.serialize(),before);assert.equal(flat.roofGeometryFingerprint,current.roofGeometryFingerprint);assert.deepEqual(s.e.state.architecture,s.source);
});

test('R6 actual tray profile integrates capped benefit by cell instead of capping an average height',()=>{
 const s=setup({target:108}),c=config(s,{type:'tray',min:{x:60,y:60},max:{x:420,y:180},baseElevation:96,raisedElevation:132}),r=evaluate(s,c);assert.equal(r.status,'ok',JSON.stringify(r.report.diagnostics));
 const area=480*240,plateau=360*120;near(r.report.metrics.usableVolume,area*96+plateau*36);near(r.report.metrics.targetBenefitVolume,area*96+plateau*12);near(r.report.metrics.headroomArea,plateau);
 assert.notEqual(r.report.metrics.targetBenefitVolume,Math.min(area*108,r.report.metrics.usableVolume));near(r.report.quantities.totals.ceilingVerticalReturnArea,2*(360+120)*36);
 assert.equal(r.report.quantities.ceilingFinishes[0].verticalReturnMaterialVolume,0);assert.equal(r.source.rooms[0].ceilingElevation,96);assert.equal(r.source.roofGroups[0].bearingElevation,120);
});

test('R6 excess flat height adds zero target benefit and does not force an ever-taller building',()=>{
 const s=setup({target:108}),a=evaluate(s,config(s,{elevation:108})),b=evaluate(s,config(s,{elevation:120}));assert.equal(a.status,'ok');assert.equal(b.status,'ok');near(a.report.metrics.targetBenefitVolume,b.report.metrics.targetBenefitVolume);assert.ok(b.report.metrics.usableVolume>a.report.metrics.usableVolume);assert.equal(b.source.roofGroups[0].bearingElevation,120);
});

test('R6 roof area is actual accepted skin, with the analytical 4:12 multiplier and unchanged equal-pitch bearing area',()=>{
 const s=setup(),a=evaluate(s,config(s)),b=evaluate(s,config(s,{bearingOffset:24}));assert.equal(a.status,'ok');assert.equal(b.status,'ok');const expected=480*240*Math.sqrt(10/9);near(a.report.quantities.totals.roofSurfaceArea,expected);near(b.report.quantities.totals.roofSurfaceArea,expected);near(a.report.quantities.totals.roofProjectedArea,115200);assert.equal(a.report.quantities.roofGroups[0].areaInvariant.status,'verified');
});

test('R6 gable closures are measured separately and never added to sloped roof area',()=>{
 const s=setup({roofType:'GABLE'}),r=evaluate(s,config(s));assert.equal(r.status,'ok',JSON.stringify(r.report.diagnostics));near(r.report.quantities.totals.roofSurfaceArea,480*240*Math.sqrt(10/9));near(r.report.quantities.totals.gableClosureArea,2*(240*40/2));near(r.report.quantities.totals.roofEdgeLengths.ridge,480);assert.ok(r.report.quantities.totals.roofEdgeLengths.rake>0);
});

test('R6 variable-bearing HIP step surfaces have separate exact triangle area',()=>{
 const s=setup(),north=roofBoundaryEdgeKey(rectangle[2],rectangle[3]);s.source.roofGroups[0].bearingAssignments=[{edgeKey:north,elevation:144}];const r=evaluate(s,config(s));assert.equal(r.status,'ok',JSON.stringify(r.report.diagnostics));near(r.report.quantities.totals.stepClosureArea,1728);near(r.report.quantities.totals.roofSurfaceArea,480*240*Math.sqrt(10/9));assert.equal(r.report.quantities.totals.roofEdgeLengths.step,null);assert.equal(r.report.quantities.roofGroups[0].edgeLengths.step,null);assert.ok(r.report.quantities.limitations.some(line=>/Step flashing.*unquantified/.test(line)));
});

test('R6 pitched co-design changes true surface area; uniform support offset changes wall volume without moving ceiling',()=>{
 const s=setup({wallSource:true}),a=evaluate(s,config(s)),b=evaluate(s,config(s,{riseTwice:12,bearingOffset:24}));assert.equal(b.status,'ok',JSON.stringify(b.report.diagnostics));near(b.report.quantities.totals.roofSurfaceArea,115200*Math.sqrt(1.25));assert.ok(b.report.quantities.totals.wallMaterialVolumeNominal>a.report.quantities.totals.wallMaterialVolumeNominal);assert.ok(b.source.walls.every(w=>w.bearingElevation===144));assert.equal(b.source.rooms[0].ceilingElevation,108);assert.equal(s.source.rooms[0].ceilingElevation,96);
});

test('R6 declared material rows retain individual materials, actual surface and optional nominal thickness',()=>{
 const s=setup();s.source.assemblies.push({id:'assembly-1',name:'Declared math offsets',layers:[{name:'A',material:'plywood',normalThickness:.25},{name:'B',material:'insulation',normalThickness:.5}],reservations:[],framingVerification:'unverified'});s.source.roofGroups[0].assemblyId='assembly-1';const r=evaluate(s,config(s));assert.equal(r.status,'ok');const q=r.report.quantities;assert.equal(q.roofLayerMaterials.length,2);near(q.roofLayerMaterials[0].nominalVolume,q.totals.roofSurfaceArea*.25);assert.equal(q.roofLayerMaterials[1].material,'insulation');for(const k of ['framingLumber','connectors','sheetPurchaseQuantity','cuttingWaste','prices','totalCost'])assert.equal(q[k],null);assert.equal(q.prefabricatedTrussDesignSurcharge,0);assert.equal(q.manufacturingComplexitySurcharge,0);assert.equal(q.framingVerification,'unverified');
});

test('R6 locks preserve the qualified baseline row and reject each non-current ceiling proposal',async()=>{
 const s=setup({allowed:false}),r=await search(s,{flatElevations:[96,108],trayInsets:[24],trayRaisedElevations:[120]});assert.equal(r.status,'complete');assert.equal(r.validCount,1);assert.equal(r.rows[0].status,'ok');assert.ok(r.rows.slice(1).every(row=>row.status==='infeasible'&&/does not permit/.test(row.diagnostics[0].message)));assert.equal(r.paretoIds[0],r.baselineId);
});

test('R6 locked source wall rejects a uniform bearing offset atomically',()=>{
 const s=setup({wallSource:true});s.source.walls[2].heightLocked=true;const before=clone(s.source),r=evaluate(s,config(s,{bearingOffset:12}));assert.equal(r.status,'infeasible');assert.match(r.report.diagnostics[0].message,/locked/);assert.equal(r.source,null);assert.deepEqual(s.source,before);
});

test('R6 physical clearance and maximum ridge reject infeasible configurations before ranking',async()=>{
 const s=setup();s.source.roofGroups[0].maxRidgeElevation=165;const r=await search(s,{mode:'co-design',flatElevations:[96,200],trayInsets:[24],trayRaisedElevations:[132],pitchChoices:[8,12],bearingOffsets:[0,24],maxCandidates:32});assert.equal(r.status,'complete');assert.ok(r.rejectedCount>0);assert.ok(r.ranked.every(row=>row.status==='ok'&&row.configuration.roof.riseTwice===8&&row.configuration.roof.bearingOffset===0&&row.configuration.ceiling.elevation!==200));assert.ok(r.rows.filter(row=>row.status!=='ok').every(row=>row.metrics===null&&row.quantities===null));
});

test('R6 an unqualified current ceiling prevents all rankings instead of pretending its usable volume is zero',async()=>{
 const s=setup();s.source.rooms[0].ceilingElevation=200;const r=await search(s,{flatElevations:[96],trayInsets:[24],trayRaisedElevations:[120]});assert.equal(r.status,'unsupported');assert.equal(r.complete,false);assert.equal(r.ranked.length,0);assert.equal(r.rows.length,0);assert.match(r.diagnostics[0].message,/infeasible/);const applied=evaluate(s,config(s));assert.equal(applied.status,'unsupported');assert.equal(applied.source,null);assert.equal(applied.report.metrics,null);
});

test('R6 an immutable unrelated room becoming infeasible invalidates a co-design alternative',()=>{
 const s=setup(),real=derive(s.source,s.settings);const extra={...clone(s.source.rooms[0]),id:'other-room',allowCeilingChange:false};s.source.rooms.push(extra);const fake=(source,settings)=>{const d=derive({...source,rooms:source.rooms.filter(r=>r.id!==extra.id)},settings);d.rooms.push({...clone(real.rooms[0]),id:extra.id});d.spaces.push({...clone(real.spaces[0]),roomId:extra.id,current:{...real.spaces[0].current,feasible:source.roofGroups[0].bearingElevation>=120}});return d;};
 const r=evaluateAlternative(s.source,s.settings,config(s,{bearingOffset:-12}),{derive:fake});assert.equal(r.status,'infeasible');assert.match(r.report.diagnostics[0].message,/other-room/);assert.equal(r.source,null);
});

test('R6 fixed-roof mode rejects pitch and support changes in requested options',()=>{
 const s=setup();assert.throws(()=>normalizeAlternativeOptions(s.source,s.settings,{pitchChoices:[8,12]}),/Fixed-roof/);assert.throws(()=>normalizeAlternativeOptions(s.source,s.settings,{bearingOffsets:[0,12]}),/Fixed-roof/);assert.equal(normalizeAlternativeOptions(s.source,s.settings,{mode:'co-design',pitchChoices:[6,8],bearingOffsets:[-12,0,12]}).mode,'co-design');
});

test('R6 explicit common eave override requires a separate source decision before co-design',()=>{
 const s=setup();s.source.roofGroups[0].eaveElevation=120;const current=evaluate(s,config(s));assert.equal(current.status,'ok');for(const c of [config(s,{riseTwice:12}),config(s,{bearingOffset:12})]){const r=evaluate(s,c);assert.equal(r.status,'infeasible');assert.match(r.report.diagnostics[0].message,/explicit common eave/);}
});

test('R6 nonzero-floor target benefit uses elevations relative to each floor',()=>{
 const s=setup();s.source.levels[0].floorElevation=100;s.source.rooms[0].floorElevation=100;s.source.rooms[0].ceilingElevation=196;s.source.rooms[0].targetCeilingElevation=208;for(const w of s.source.walls){w.baseElevation=100;w.bearingElevation=220;}s.source.roofGroups[0].bearingElevation=220;const r=evaluate(s,config(s,{elevation:220}));assert.equal(r.status,'ok',JSON.stringify(r.report.diagnostics));near(r.report.metrics.targetBenefitVolume,480*240*108);near(r.report.metrics.usableVolume,480*240*120);
});

test('R6 declared priorities scale capped benefit without mixing it with material quantities',()=>{
 const s=setup({target:108});s.source.rooms[0].priority=3;const r=evaluate(s,config(s));near(r.report.metrics.weightedTargetBenefitVolume,r.report.metrics.targetBenefitVolume*3);assert.equal(ALTERNATIVE_OBJECTIVES[0].direction,'max');assert.ok(ALTERNATIVE_OBJECTIVES.some(o=>o.key==='roofSurfaceArea'&&o.direction==='min'));assert.equal(r.report.metrics.score,undefined);
});

test('R6 Pareto dominance keeps material/space tradeoffs and removes an inferior bounded row',()=>{
 const s=setup({target:108}),a=evaluate(s,config(s,{elevation:96})).report,b=evaluate(s,config(s,{elevation:108})).report,c=evaluate(s,config(s,{elevation:120})).report;assert.equal(a.status,'ok');const rows=paretoAlternatives([a,b,c]);assert.equal(rows.find(r=>r.id===a.id).pareto,true);assert.equal(rows.find(r=>r.id===c.id).pareto,false);assert.ok(rows.find(r=>r.id===c.id).dominatedBy.includes(b.id));assert.equal(rows.find(r=>r.id===b.id).pareto,true);
});

test('R6 triangulation changes do not change any reported material area or create a complexity surcharge',()=>{
 const s=setup(),d=derive(s.source,s.settings),before=quantifyAlternative(s.source,d),split=clone(d);split.roofs[0].faces=split.roofs[0].faces.flatMap(f=>f.vertices.length===4?[{...f,vertices:[f.vertices[0],f.vertices[1],f.vertices[2]]},{...f,vertices:[f.vertices[0],f.vertices[2],f.vertices[3]]}]:[f]);const after=quantifyAlternative(s.source,split);near(before.totals.roofSurfaceArea,after.totals.roofSurfaceArea);assert.deepEqual(before.totals.roofEdgeLengths,after.totals.roofEdgeLengths);assert.equal(after.manufacturingComplexitySurcharge,0);
});

test('R6 actual facade/skin role error and forged incomplete projection fail the roof-area anti-bug check',()=>{
 const s=setup(),d=derive(s.source,s.settings),vertical=clone(d);vertical.roofs[0].faces.push({vertices:[{x:0,y:0,z:0},{x:480,y:0,z:0},{x:480,y:0,z:120},{x:0,y:0,z:120}]});assert.throws(()=>quantifyAlternative(s.source,vertical),/vertical/);const missing=clone(d);missing.roofs[0].faces.pop();assert.throws(()=>quantifyAlternative(s.source,missing),/projection/);
});

test('R6 accepted tray profile area conservation rejects incomplete cells before benefit calculation',()=>{
 const s=setup(),r=evaluate(s,config(s,{type:'tray',min:{x:60,y:60},max:{x:420,y:180},baseElevation:96,raisedElevation:132}));assert.equal(r.status,'ok');const d=derive(r.source,s.settings);d.spaces[0].acceptedTray.cells.pop();assert.throws(()=>measureTargetBenefit(r.source,d),/area conservation/);
});

test('R6 cancellation is cooperative, leaves live source unchanged and exposes no partial ranking',async()=>{
 const s=setup(),before=clone(s.source),controller=createAlternativeSearch(s.source,s.settings,{}, {derive});const r=await controller.run({yieldControl:async()=>{},onProgress:p=>{if(p.evaluatedCount===1)controller.cancel();}});assert.equal(r.status,'cancelled');assert.equal(r.complete,false);assert.ok(r.evaluatedCount<r.candidateCount);assert.equal(r.ranked.length,0);assert.equal(r.paretoIds.length,0);assert.deepEqual(s.source,before);
});

test('R6 cancellation before the first yield avoids all engine derivation work',async()=>{
 const s=setup();let calls=0;const c=createAlternativeSearch(s.source,s.settings,{}, {derive(){calls++;return derive(...arguments);}});c.cancel();const r=await c.run({yieldControl:async()=>{}});assert.equal(r.status,'cancelled');assert.equal(calls,0);assert.equal(r.budget.work,0);
});

test('R6 AbortSignal cancellation behaves like the visible cancel control',async()=>{
 const s=setup(),abort=new AbortController();abort.abort();const r=await search(s,{}, {signal:abort.signal});assert.equal(r.status,'cancelled');assert.equal(r.rows.length,0);
});

test('R6 an exceeded work budget cannot promote partial valid rows to a result',async()=>{
 const s=setup(),r=await search(s,{maxWork:1});assert.equal(r.status,'budget-exceeded');assert.equal(r.stoppingReason,'work-budget');assert.equal(r.ranked.length,0);assert.equal(r.complete,false);
});

test('R6 elapsed-time budget is checked after asynchronous yielding and before a geometry call',async()=>{
 const s=setup();let calls=0;const r=await createAlternativeSearch(s.source,s.settings,{maxElapsedMs:1},{derive(){calls++;return derive(...arguments);}}).run({yieldControl:()=>new Promise(resolve=>setTimeout(resolve,10))});assert.equal(r.status,'budget-exceeded');assert.equal(r.stoppingReason,'elapsed-time-budget');assert.equal(calls,0);assert.equal(r.ranked.length,0);
});

test('R6 progress hooks receive detached copies and a controller only runs one study',async()=>{
 const s=setup(),controller=createAlternativeSearch(s.source,s.settings,{}, {derive}),seen=[];const a=controller.run({yieldControl:async()=>{},onProgress:p=>{seen.push(clone(p));p.status='forged';p.evaluatedCount=-1;}}),b=controller.run();assert.equal(a,b);const r=await a;assert.equal(r.status,'complete');assert.ok(seen.length>=r.evaluatedCount+1);assert.equal(seen.at(-1).status,'complete');assert.equal(r.evaluatedCount,r.candidateCount);
});

test('R6 immutable input snapshots reject caller changes while a search yields',async()=>{
 const s=setup(),original=s.source.rooms[0].ceilingElevation;let once=false;const r=await search(s,{}, {yieldControl:async()=>{if(!once){once=true;s.source.rooms[0].ceilingElevation=200;s.settings.units='m';}}});assert.equal(r.status,'complete');assert.equal(r.rows[0].configuration.ceiling.elevation,original);assert.equal(r.rows[0].quantities.modelUnits,'in');
});

test('R6 fixed roof fingerprint regression is an unsupported study and not ranked',async()=>{
 const s=setup({target:108}),faulty=(source,settings)=>{const d=derive(source,settings);if(source.rooms[0].ceilingElevation!==96)d.roofGeometryFingerprint='wrong-roof';return d;};const r=await createAlternativeSearch(s.source,s.settings,{flatElevations:[96,108]},{derive:faulty}).run({yieldControl:async()=>{}});assert.equal(r.status,'unsupported');assert.equal(r.ranked.length,0);assert.match(r.diagnostics[0].message,/changed accepted roof/);const a=evaluateAlternative(s.source,s.settings,config(s),{derive:faulty});assert.equal(a.status,'unsupported');assert.equal(a.source,null);
});

test('R6 source IDs, configuration IDs and search order are deterministic and no cached source is trusted',async()=>{
 const s=setup({target:108}),a=await search(s),b=await search(s);assert.deepEqual(a.rows.map(r=>r.id),b.rows.map(r=>r.id));assert.equal(a.inputHash,b.inputHash);for(const r of a.rows)assert.match(r.id,/^r6-[a-f0-9]{16}$/);assert.equal(alternativeConfigurationId(config(s)),alternativeConfigurationId(clone(config(s))));
});

test('R6 oversized requested grids are explicit unsupported studies, never silently truncated',async()=>{
 const s=setup(),r=await search(s,{mode:'co-design',flatElevations:[96,100,104,108],trayInsets:[12,24],trayRaisedElevations:[120,124,128],pitchChoices:[4,6,8,10],bearingOffsets:[0,12,24],maxCandidates:128});assert.equal(r.status,'unsupported');assert.equal(r.ranked.length,0);assert.equal(r.rows.length,0);assert.match(r.diagnostics[0].message,/128|exceed/);
});

test('R6 requested per-study grid limit is enforced before candidate solving',async()=>{
 const s=setup(),r=await search(s,{maxCandidates:1});assert.equal(r.status,'unsupported');assert.match(r.diagnostics[0].message,/maxCandidates/);assert.equal(r.evaluatedCount,0);
});

test('R6 strict options reject unknown fields, nonplain objects and unbounded numeric choices',()=>{
 const s=setup();for(const raw of [{price:100},{code:'return 1'},{flatElevations:[Infinity]},{trayInsets:[-1]},{pitchChoices:[1]},{pitchChoices:[8.5]},{bearingOffsets:[NaN]},{maxCandidates:129},{maxWork:8000001},{maxElapsedMs:30001},{flatElevations:[96,96]},{trayInsets:Array(17).fill(12)},new Date(),[]])assert.throws(()=>normalizeAlternativeOptions(s.source,s.settings,raw));assert.throws(()=>normalizeAlternativeOptions(s.source,s.settings,Object.assign(Object.create({}),{mode:'fixed-roof'})),/plain/);
});

test('R6 strict configuration rejects supplied ID, metrics, source, code and unknown nested fields',()=>{
 const s=setup(),base=config(s);for(const bad of [{...base,id:'r6-0000000000000000'},{...base,metrics:{}},{...base,source:s.source},{...base,version:2},{...base,roof:{...base.roof,execute:'x'}},{...base,ceiling:{...base.ceiling,expression:'108'}},{...base,ceiling:{type:'vault',elevation:108}},{...base,roof:{riseTwice:8,bearingOffset:Infinity}},{...base,roomId:'bad/ID'}])assert.throws(()=>evaluate(s,bad));
});

test('R6 search needs a trusted derive function and uses no executable client expression',()=>{
 const s=setup();assert.throws(()=>createAlternativeSearch(s.source,s.settings,{}),/derive/);assert.throws(()=>evaluateAlternative(s.source,s.settings,config(s)),/derive/);assert.throws(()=>createAlternativeSearch(s.source,s.settings,{}, {derive:'generateArchitecture'}),/derive/);assert.throws(()=>createAlternativeSearch(s.source,s.settings,{}, {derive}).run({yieldControl:'function(){}'}),/hooks/);
});

test('R6 incomplete or nonfinite Pareto objectives are rejected and infeasible rows remain unranked',()=>{
 const s=setup(),r=evaluate(s,config(s)).report,bad=clone(r);bad.metrics.weightedTargetBenefitVolume=NaN;assert.throws(()=>paretoAlternatives([bad]),/nonfinite/);assert.equal(paretoAlternatives([{status:'infeasible',id:'not-ranked'}]).length,0);assert.throws(()=>paretoAlternatives(Array(129).fill(r)),/budget/);
});

test('R6 default analytic fit adds a target-capped flat and trays based at both current and maximum-fit flat levels',async()=>{
 const s=setup({roofType:'GABLE',target:144}),north=roofBoundaryEdgeKey(rectangle[2],rectangle[3]);s.source.roofGroups[0].bearingAssignments=[{edgeKey:north,elevation:144}];const r=await search(s);assert.equal(r.status,'complete',JSON.stringify(r.diagnostics));assert.ok(r.budget.probeCount>0);assert.ok(r.budget.work>r.budget.probeCount);const flat=r.rows.find(row=>row.status==='ok'&&row.configuration.ceiling.type==='flat'&&Math.abs(row.configuration.ceiling.elevation-120)<1e-6),tray=r.rows.find(row=>row.status==='ok'&&row.configuration.ceiling.type==='tray'&&Math.abs(row.configuration.ceiling.baseElevation-120)<1e-6&&row.configuration.ceiling.raisedElevation>120);assert.ok(flat);assert.ok(tray);assert.ok(tray.metrics.usableVolume>flat.metrics.usableVolume);assert.equal(tray.roofGeometryFingerprint,flat.roofGeometryFingerprint);assert.equal(r.inputHash,derive(s.source,s.settings).inputHash);near(flat.quantities.totals.grossRoomBoundaryFinishArea,2*(480+240)*120);
});

test('R6 default analytic tray fit is exact at its low side and not a sampled maximum',async()=>{
 const s=setup({roofType:'GABLE',target:144}),r=await search(s,{trayInsets:[24],flatElevations:[96],trayRaisedElevations:[144]});assert.equal(r.status,'complete');const fitted=r.rows.find(row=>row.status==='ok'&&row.configuration.ceiling.type==='tray'&&row.configuration.ceiling.baseElevation===120);assert.ok(fitted);near(fitted.configuration.ceiling.raisedElevation,128);const raised=clone(fitted.configuration);raised.ceiling.raisedElevation+=.01;assert.equal(evaluate(s,raised).status,'infeasible');
});

test('R6 turning maximum-fit generation off preserves the exact requested grid',async()=>{
 const s=setup({target:144}),r=await search(s,{includeMaximumFit:false,flatElevations:[96,108],trayInsets:[24],trayBaseElevations:[96],trayRaisedElevations:[120]});assert.equal(r.status,'complete');assert.equal(r.candidateCount,3);assert.equal(r.budget.probeCount,0);assert.deepEqual(r.rows.filter(row=>row.configuration.ceiling.type==='flat').map(row=>row.configuration.ceiling.elevation),[96,108]);assert.throws(()=>normalizeAlternativeOptions(s.source,s.settings,{includeMaximumFit:'true'}),/boolean/);
});

test('R6 cancellation during maximum-fit probes yields before further probes and has no ranked candidates',async()=>{
 const s=setup(),controller=createAlternativeSearch(s.source,s.settings,{}, {derive});let yields=0;const r=await controller.run({yieldControl:async()=>{if(++yields===4)controller.cancel();}});assert.equal(r.status,'cancelled');assert.equal(r.evaluatedCount,0);assert.equal(r.ranked.length,0);assert.ok(r.budget.probeCount<=1);
});

test('R6 roof support wall sharing is rejected without changing either accepted roof',()=>{
 const s=setup({wallSource:true});s.source.roofGroups.push({...clone(s.source.roofGroups[0]),id:'roof-2',name:'Separate shared-support qualification',boundarySource:'explicit',boundary:rectangle.map(p=>({x:p.x,y:p.y+300})),boundaryWallIds:[],supportWallIds:[s.source.walls[2].id]});const before=clone(s.source),r=evaluate(s,config(s,{bearingOffset:24}));assert.equal(r.status,'infeasible',JSON.stringify(r.report.diagnostics));assert.match(r.report.diagnostics[0].message,/shared roof support/);assert.deepEqual(s.source,before);
});

test('R6 fixed-footprint roof coverage drift invalidates an otherwise qualified study',async()=>{
 const s=setup(),fault=(source,settings)=>{const d=derive(source,settings);if(source.roofGroups[0].bearingElevation!==120)d.roofs[0].eaveBoundary=d.roofs[0].eaveBoundary.map(p=>({x:p.x+1,y:p.y}));return d;};const r=await createAlternativeSearch(s.source,s.settings,{mode:'co-design',pitchChoices:[8],bearingOffsets:[0,12]},{derive:fault}).run({yieldControl:async()=>{}});assert.equal(r.status,'unsupported');assert.equal(r.ranked.length,0);assert.match(r.diagnostics[0].message,/projected roof coverage/);
});

test('R6 mathematical quantities convert consistently between inch and meter source units',()=>{
 const inches=setup({target:108}),a=evaluate(inches,config(inches)),s=clone(inches.source),factor=.0254;s.modelUnits='m';for(const level of s.levels)for(const k of ['floorElevation','defaultBearingElevation','defaultCeilingElevation'])level[k]*=factor;for(const n of s.wallNodes){n.x*=factor;n.y*=factor;}for(const w of s.walls)for(const k of ['thickness','baseElevation','bearingElevation'])w[k]*=factor;for(const r of s.rooms){r.anchor.x*=factor;r.anchor.y*=factor;for(const k of ['floorElevation','ceilingElevation','targetCeilingElevation','minimumClearHeight','headroomThreshold','ceilingFinishThickness'])r[k]*=factor;}for(const g of s.roofGroups){for(const p of g.boundary){p.x*=factor;p.y*=factor;}for(const k of ['overhang','rakeOverhang','bearingElevation','heelOffset'])g[k]*=factor;}const b=evaluateAlternative(s,{...inches.settings,units:'m'},config(inches,{elevation:108*factor}),{derive});assert.equal(b.status,'ok',JSON.stringify(b.report.diagnostics));near(b.report.metrics.usableVolume,a.report.metrics.usableVolume*factor**3);near(b.report.quantities.totals.roofSurfaceArea,a.report.quantities.totals.roofSurfaceArea*factor**2);near(b.report.quantities.totals.grossRoomBoundaryFinishArea,a.report.quantities.totals.grossRoomBoundaryFinishArea*factor**2);
});

test('R6 every real source room remains feasible during a selected-room co-design evaluation',()=>{
 const e=createEditor({settings:UNIT_PRESETS.architectural}),apply=operation=>{const r=e.applyArchitecture(operation);assert.equal(r.ok,true,r.message);};apply({type:'addWalls',points:rectangle,closed:true,thickness:6,referenceFace:'left',bearingElevation:120,baseElevation:0,role:'exterior'});apply({type:'addWalls',points:[{x:240,y:0},{x:240,y:240}],thickness:6,referenceFace:'center',bearingElevation:120,baseElevation:0,role:'partition'});apply({type:'recognizeRooms'});assert.equal(e.state.architecture.rooms.length,2);const [selectedRoom,otherRoom]=e.state.architecture.rooms;for(const room of [selectedRoom,otherRoom])apply({type:'setRoom',roomId:room.id,values:{ceilingElevation:room.id===selectedRoom.id?96:120,targetCeilingElevation:132,allowCeilingChange:room.id===selectedRoom.id}});apply({type:'addRoof',id:'roof-1',boundary:rectangle,riseTwice:8,bearingElevation:120,overhang:0,roofType:'HIP'});const s={source:clone(e.state.architecture),settings:e.state.settings,roomId:selectedRoom.id,roofGroupId:'roof-1'},r=evaluate(s,config(s,{elevation:96,bearingOffset:-12}));assert.equal(r.status,'infeasible');assert.match(r.report.diagnostics[0].message,new RegExp(otherRoom.id));assert.equal(s.source.rooms[1].ceilingElevation,120);
});

test('R6 an enclosed region lacking source room intent cannot silently disappear from all-room comparison',async()=>{
 const e=createEditor({settings:UNIT_PRESETS.architectural}),apply=operation=>{const r=e.applyArchitecture(operation);assert.equal(r.ok,true,r.message);};apply({type:'addWalls',points:rectangle,closed:true,thickness:6,referenceFace:'left',bearingElevation:120,baseElevation:0,role:'exterior'});apply({type:'addWalls',points:[{x:240,y:0},{x:240,y:240}],thickness:6,referenceFace:'center',bearingElevation:120,baseElevation:0,role:'partition'});apply({type:'recognizeRooms'});apply({type:'addRoof',id:'roof-1',boundary:rectangle,riseTwice:8,bearingElevation:120,overhang:0,roofType:'HIP'});const source=clone(e.state.architecture);assert.equal(source.rooms.length,2);source.rooms=source.rooms.slice(0,1);source.rooms[0].ceilingElevation=96;source.rooms[0].targetCeilingElevation=108;source.rooms[0].allowCeilingChange=true;const s={source,settings:e.state.settings,roomId:source.rooms[0].id,roofGroupId:'roof-1'},d=derive(source,s.settings);assert.equal(d.rooms.length,2);assert.ok(d.spaces.some(space=>space.status==='unsupported'));const report=await search(s,{includeMaximumFit:false,flatElevations:[96,108],trayInsets:[24],trayRaisedElevations:[120]});assert.equal(report.status,'unsupported');assert.equal(report.ranked.length,0);assert.equal(report.rows.length,0);assert.match(report.diagnostics[0].message,/Every enclosed room/);const applied=evaluate(s,config(s));assert.equal(applied.status,'unsupported');assert.equal(applied.source,null);
});

test('R6 an unaccepted saved tray outside the stated choices is excluded while an accepted current tray remains the baseline',async()=>{
 const s=setup(),saved={min:{x:60,y:60},max:{x:420,y:180},baseElevation:96,raisedElevation:132};s.source.rooms[0].trayCandidate=clone(saved);const options={includeMaximumFit:false,flatElevations:[96,108],trayInsets:[24],trayBaseElevations:[96],trayRaisedElevations:[120]},r=await search(s,options);assert.equal(r.status,'complete');assert.equal(r.candidateCount,3);assert.ok(!r.rows.some(row=>row.configuration.ceiling.type==='tray'&&row.configuration.ceiling.min.x===60));s.source.rooms[0].ceilingType='tray';s.source.rooms[0].trayCeiling=clone(saved);const accepted=await search(s,options);assert.equal(accepted.status,'complete');const baseline=accepted.rows.find(row=>row.id===accepted.baselineId);assert.equal(baseline.configuration.ceiling.type,'tray');assert.deepEqual(baseline.configuration.ceiling,{type:'tray',...saved});assert.equal(baseline.status,'ok');
});
