import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createEditor} from '../core.mjs';
import {PERFORMANCE_WORKLOAD_IDS,performanceWorkload} from './performance-workload-fixtures.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/performance-workload-contract.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),hash=b=>createHash('sha256').update(b).digest('hex');
const names=[],records=[],artifacts=new Map(PERFORMANCE_WORKLOAD_IDS.map(id=>[id,{raw:performanceWorkload(id)}]));
const xy=(x,y)=>({x,y}),rect=(x,y,w,h)=>[xy(x,y),xy(x+w,y),xy(x+w,y+h),xy(x,y+h)];
const points=e=>e.type==='LINE'?[e.start,e.end]:e.type==='PLINE'?e.points:e.type==='HATCH'?e.boundary.points:[];
const sum=ps=>ps.reduce((a,p)=>[a[0]+p.x,a[1]+p.y],[0,0]);
const bounds=ps=>[Math.min(...ps.map(p=>p.x)),Math.min(...ps.map(p=>p.y)),Math.max(...ps.map(p=>p.x)),Math.max(...ps.map(p=>p.y))];
const perimeter=ps=>ps.reduce((n,p,i)=>n+Math.hypot(p.x-ps[(i+1)%ps.length].x,p.y-ps[(i+1)%ps.length].y),0);
const area=ps=>Math.abs(ps.reduce((n,p,i)=>n+p.x*ps[(i+1)%ps.length].y-ps[(i+1)%ps.length].x*p.y,0))/2;
const owned=d=>[...d.entities,...(d.layouts??[]).flatMap(l=>l.entities)];
function validate(d,id){
  const w=contract.workloads[id],all=owned(d),byType={};assert.equal(d.settings.units,w.units);
  assert.ok(d.entities.every(e=>!e.layoutId));assert.equal(new Set(all.map(e=>e.id)).size,all.length);
  for(const e of all)byType[e.type]=(byType[e.type]??0)+1;
  const expected={survey:{PLINE:100,TEXT:100},residential:{PLINE:40,ARC:8,HATCH:8,TEXT:8},multiViewport:{LINE:403,PLINE:3,TEXT:3},heavy:{LINE:10000}}[id];assert.deepEqual(byType,expected);
  assert.equal(all.length,w.entities??w.totalEntities);assert.ok(all.filter(e=>e.type==='PLINE').every(e=>e.closed===true));
  if(id!=='multiViewport')assert.equal((d.layouts??[]).length,0);
  if(id==='survey')for(let i=0;i<100;i++){
    const [r,c]=[Math.floor(i/10),i%10],n=String(i+1).padStart(3,'0'),a=d.entities[2*i],b=d.entities[2*i+1];
    assert.equal(a.id,'survey-parcel-'+n);assert.equal(a.closed,true);assert.deepEqual(a.points,rect(100*c,60*r,80,50));
    assert.equal(b.id,'survey-label-'+n);assert.equal(b.text,'SYNTHETIC LOT '+n);assert.deepEqual(b.position,xy(100*c+10,60*r+20));
  }
  if(id==='residential')for(let i=0;i<8;i++){
    const n=i+1,x=18*(i%4),y=14*Math.floor(i/4),a=d.entities.slice(8*i,8*i+8);
    assert.equal(a[0].id,'room-'+n);assert.deepEqual(a[0].points,rect(x,y,16,12));
    for(let j=0;j<4;j++){assert.equal(a[j+1].id,'furniture-'+n+'-'+j);assert.deepEqual(a[j+1].points,rect(x+2+5*(j%2),y+2+5*Math.floor(j/2),2,3));}
    assert.equal(a[5].id,'door-'+n);assert.deepEqual(a[5].center,xy(x+16,y+3));assert.equal(a[5].radius,3);assert.equal(a[5].startAngle,90);assert.equal(a[5].sweepAngle,90);
    assert.equal(a[6].id,'fill-'+n);assert.equal(a[6].pattern,'solid');assert.deepEqual(a[6].boundary.points,rect(x+10,y+7,2,2));assert.equal(a[6].boundary.closed,true);
    assert.equal(a[7].id,'room-label-'+n);assert.deepEqual(a[7].position,xy(x+2,y+8));assert.equal(a[7].text,'SYNTHETIC ROOM '+n);
  }
  if(id==='heavy'||id==='multiViewport'){
    const size=id==='heavy'?100:20,step=id==='heavy'?8:20,length=id==='heavy'?6:16,prefix=id==='heavy'?'heavy-':'model-',padding=id==='heavy'?5:3;
    for(let i=0;i<size*size;i++){const e=d.entities[i],x=(i%size)*step,y=Math.floor(i/size)*step;assert.equal(e.id,prefix+String(i).padStart(padding,'0'));assert.deepEqual(e.start,xy(x,y));assert.deepEqual(e.end,xy(x+length,y));}
    assert.equal(d.entities.length,size*size);assert.deepEqual(sum(d.entities.map(e=>e.start)),w.startCoordinateSums??w.modelStartSums);assert.deepEqual(sum(d.entities.map(e=>e.end)),w.endCoordinateSums??w.modelEndSums);
    assert.equal(d.entities.reduce((n,e)=>n+Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y),0),w.lineLength??w.modelLength);
  }
  if(id==='multiViewport'){
    assert.equal(d.activeSpace,'paper');assert.equal(d.activeLayoutId,'sheet-a');assert.equal(d.activeViewportId,null);
    const layer=d.layers.find(l=>l.name==='Viewports');assert.equal(layer.visible,true);assert.equal(layer.locked,true);
    assert.deepEqual(d.layouts.map(l=>l.id),['sheet-a','sheet-b','sheet-c']);
    for(let k=0;k<3;k++){
      const l=d.layouts[k],letter='abc'[k];assert.equal(l.entities.length,3);assert.equal(l.paper.widthMm,420);assert.equal(l.paper.heightMm,297);assert.equal(l.viewports.length,6);
      assert.equal(l.entities[0].id,'paper-ruler-'+letter);assert.deepEqual([l.entities[0].start,l.entities[0].end],[xy(10,40),xy(110,40)]);
      assert.equal(l.entities[1].id,'paper-border-'+letter);assert.deepEqual(l.entities[1].points,rect(10,10,400,277));assert.equal(l.entities[1].closed,true);
      assert.equal(l.entities[2].id,'paper-label-'+letter);assert.deepEqual(l.entities[2].position,xy(20,20));
      for(let i=0;i<6;i++){const v=l.viewports[i],c=i%3,r=Math.floor(i/3);assert.equal(v.id,'view-'+letter+'-'+i);assert.deepEqual(v.frame,{x:20+130*c,y:60+90*r,width:110,height:70});assert.deepEqual(v.modelCenter,{x:80+80*c,y:100+120*r,z:0});assert.equal(v.scaleDenominator,[24,48,96][k]);assert.equal(v.layer,'Viewports');assert.equal(v.locked,true);assert.equal(v.plotBorder,false);}
    }
    const paper=d.layouts.flatMap(l=>l.entities),ps=paper.flatMap(points);assert.equal(ps.length,18);assert.deepEqual(sum(ps),w.paperExplicitCoordinateSums);
    assert.equal(paper.filter(e=>e.type==='LINE').reduce((n,e)=>n+Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y),0),300);
    assert.equal(paper.filter(e=>e.type==='PLINE').reduce((n,e)=>n+perimeter(e.points),0),4062);assert.equal(paper.filter(e=>e.type==='PLINE').reduce((n,e)=>n+area(e.points),0),332400);
    assert.deepEqual(bounds(d.entities.flatMap(points)),w.modelBounds);assert.equal(d.layouts.flatMap(l=>l.viewports).length,18);
  }else{
    const ps=all.flatMap(points);assert.equal(ps.length,w.explicitVertices);assert.deepEqual(bounds(ps),w.geometryBounds);
    const polys=all.filter(e=>e.type==='PLINE');if(polys.length){assert.equal(polys.reduce((n,e)=>n+perimeter(e.points),0),w.polylinePerimeter);assert.equal(polys.reduce((n,e)=>n+area(e.points),0),w.polylineArea);assert.deepEqual(sum(polys.flatMap(e=>e.points)),w.polylineCoordinateSums);}
    const texts=all.filter(e=>e.type==='TEXT');if(texts.length)assert.deepEqual(sum(texts.map(e=>e.position)),w.labelAnchorSums);
    if(id==='residential'){const hatch=all.filter(e=>e.type==='HATCH');assert.deepEqual(sum(ps),w.explicitCoordinateSums);assert.equal(hatch.reduce((n,e)=>n+area(e.boundary.points),0),32);assert.equal(hatch.reduce((n,e)=>n+perimeter(e.boundary.points),0),64);assert.deepEqual(sum(all.filter(e=>e.type==='ARC').map(e=>e.center)),[344,80]);}
  }
  return {nativeEntities:all.length,modelEntities:d.entities.length,paperEntities:all.length-d.entities.length,explicitVertices:all.flatMap(points).length,storedViewports:(d.layouts??[]).flatMap(l=>l.viewports).length};
}
function plannedRows(){
  const rows=[],p=contract.protocol;
  for(const id of PERFORMANCE_WORKLOAD_IDS)for(let process=0;process<3;process++){
    rows.push({workload:id,process,phase:'startup',round:-1,operation:'readiness'},{workload:id,process,phase:'cold-first-open',round:-1,operation:'open'});
    for(let round=0;round<6;round++)for(const operation of id==='multiViewport'?p.layoutOperations:p.ordinaryOperations)rows.push({workload:id,process,phase:round===0?'warmup':'measured-warm',round,operation});
  }
  return rows;
}
function validatePlan(rows){
  const ordinary=['open','selectAll','clearSelection','pan','zoom','saveAs','reopen'],layout=['open','selectAll','clearSelection','switchLayoutB','switchLayoutC','returnLayoutA','pan','zoom','saveAs','reopen'],expected=new Set();
  for(const id of ['survey','residential','multiViewport','heavy'])for(let process=0;process<3;process++){
    expected.add([id,process,'startup',-1,'readiness'].join(':'));expected.add([id,process,'cold-first-open',-1,'open'].join(':'));
    for(let round=0;round<6;round++)for(const operation of id==='multiViewport'?layout:ordinary)expected.add([id,process,round===0?'warmup':'measured-warm',round,operation].join(':'));
  }
  assert.equal(rows.length,582);assert.ok(rows.every(r=>Object.keys(r).sort().join(',')==='operation,phase,process,round,workload'));
  const keys=rows.map(r=>[r.workload,r.process,r.phase,r.round,r.operation].join(':'));assert.equal(new Set(keys).size,582);assert.deepEqual(new Set(keys),expected);
  for(const [phase,n] of [['startup',12],['cold-first-open',12],['warmup',93],['measured-warm',465]])assert.equal(rows.filter(r=>r.phase===phase).length,n);
}
function validateDefinition(p){assert.equal(p.observedRows,0);assert.equal(p.approvedTimingThreshold,null);assert.equal(p.processReplicates,3);assert.equal(p.warmupRounds,1);assert.equal(p.measuredWarmRounds,5);assert.deepEqual(p.ordinaryOperations,['open','selectAll','clearSelection','pan','zoom','saveAs','reopen']);assert.deepEqual(p.layoutOperations,['open','selectAll','clearSelection','switchLayoutB','switchLayoutC','returnLayoutA','pan','zoom','saveAs','reopen']);assert.equal(p.plannedActionRowsPerVariant,570);assert.equal(p.plannedTotalRowsPerVariant,582);assert.ok(p.operationTimeoutMs>0&&p.frameDrainTimeoutMs>0&&p.processWatchdogMs>0);}
const selectionExpected=id=>id==='multiViewport'?['paper-ruler-a','paper-border-a','paper-label-a']:artifacts.get(id).raw.entities.map(e=>e.id);
function validateSelection(actual,id){assert.equal(new Set(actual).size,actual.length);assert.deepEqual(actual,selectionExpected(id));}
function ref(name,fn){names.push(name);test(name,{timeout:20000},async()=>{const r={name};records.push(r);try{await fn(r);r.outcome='pass';}catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,code:error.code??null};throw error;}finally{r.completed=true;}});}
for(const id of PERFORMANCE_WORKLOAD_IDS){
  ref(id+' literal geometry and independently frozen aggregates',r=>{r.summary=validate(artifacts.get(id).raw,id);});
  ref(id+' actual core import and persisted roundtrip',r=>{const editor=createEditor(),a=artifacts.get(id);const accepted=editor.importJSON(JSON.stringify(a.raw));assert.equal(accepted.ok,true,accepted.message);a.canonical=JSON.parse(editor.serialize());r.summary=validate(a.canonical,id);const next=createEditor();assert.equal(next.importJSON(JSON.stringify(a.canonical)).ok,true);assert.equal(next.serialize(),editor.serialize());});
  ref(id+' factory returns independent fresh objects',()=>{const a=performanceWorkload(id),b=performanceWorkload(id),original=JSON.stringify(b);(a.entities[0].start??a.entities[0].points[0]).x=-999;assert.equal(JSON.stringify(b),original);assert.equal(JSON.stringify(b),JSON.stringify(artifacts.get(id).raw));});
  ref(id+' actual core selection scope and ESC preserve serialization',r=>{const editor=createEditor();assert.equal(editor.importJSON(JSON.stringify(artifacts.get(id).raw)).ok,true);const before=editor.serialize();assert.equal(editor.execute('SELECT ALL').ok,true);r.selectionIds=[...editor.state.selectionIds];validateSelection(r.selectionIds,id);assert.equal(editor.serialize(),before);assert.equal(editor.execute('ESC').ok,true);assert.deepEqual(editor.state.selectionIds,[]);assert.equal(editor.serialize(),before);});
}
ref('Planned cold, warmup and measured row counts and keys are exact',()=>validatePlan(plannedRows()));
ref('Definition-only schema has zero observed rows and no threshold',()=>validateDefinition(contract.protocol));
ref('Finite future operation and process budgets remain explicit',()=>{assert.equal(contract.protocol.processWatchdogMs,180000);assert.equal(contract.protocol.operationTimeoutMs,15000);assert.equal(contract.protocol.frameDrainTimeoutMs,5000);assert.equal(contract.protocol.maximumWorkloadVariantProcessesPerWake,3);});
ref('Unsupported workload names reject',()=>{for(const id of ['unknown','__proto__','constructor'])assert.throws(()=>performanceWorkload(id),/Unknown synthetic/);});
const corruptions=[
 ['survey vertex with unchanged inventory','survey',d=>{d.entities[22].points[1].x++;}],
 ['survey duplicate id','survey',d=>{d.entities[2].id=d.entities[0].id;}],
 ['residential analytic radius','residential',d=>{d.entities[5].radius=4;}],
 ['residential fill vertex','residential',d=>{d.entities[6].boundary.points[2].y++;}],
 ['inactive sheet viewport deletion','multiViewport',d=>{d.layouts[2].viewports.pop();}],
 ['paper entity moved to another owner','multiViewport',d=>{d.layouts[1].entities.push(d.layouts[0].entities.pop());}],
 ['viewport layer unlocked changes selection scope','multiViewport',d=>{d.layers[1].locked=false;}],
 ['heavy units','heavy',d=>{d.settings.units='ft';}],
 ['heavy final line length','heavy',d=>{d.entities.at(-1).end.x++;}]
];
for(const [name,id,change] of corruptions)ref('Corrupt copy rejected: '+name,()=>{const d=clone(artifacts.get(id).raw);change(d);assert.throws(()=>validate(d,id));if(name==='residential fill vertex')for(const index of [0,1]){const open=clone(artifacts.get(id).raw);open.entities[index].closed=false;assert.throws(()=>validate(open,id));}});
ref('Corrupt plan duplicate/drop, operation or owner keeps count but fails keys',()=>{for(const mutate of [rows=>{rows[1]=clone(rows[0]);},rows=>{rows[2].operation='inventedOperation';},rows=>{rows[2].process=99;}]){const rows=plannedRows();mutate(rows);assert.equal(rows.length,582);assert.throws(()=>validatePlan(rows));}});
ref('Observed timing or threshold is rejected in a definitions-only copy',()=>{for(const patch of [{observedRows:1},{approvedTimingThreshold:10}])assert.throws(()=>validateDefinition({...contract.protocol,...patch}));});
ref('Model or viewport proxy cannot replace an expected paper selection',()=>{for(const wrong of ['model-000','viewport:view-a-0'])assert.throws(()=>validateSelection(['paper-ruler-a','paper-border-a',wrong],'multiViewport'));});
test('Performance workload inventory accounts for thirty-two named checks',()=>{assert.equal(names.length,32);assert.equal(records.length,32);assert.ok(records.every(r=>r.completed));assert.equal(records.filter(r=>r.outcome==='unexpected-error').length,0);});
after(async()=>{
  const output=process.env.LINECRAFT_PERFORMANCE_WORKLOAD_OUTPUT;if(!output)return;assert.ok(path.isAbsolute(output));await fs.mkdir(output,{recursive:true});
  const files={};for(const [id,a] of artifacts)for(const kind of ['raw','canonical'])if(a[kind]){const name=id+'-'+kind+'.linecraft',bytes=JSON.stringify(a[kind],null,2)+'\n';await fs.writeFile(path.join(output,name),bytes,{flag:'wx'});files[name]={sha256:hash(bytes),bytes:Buffer.byteLength(bytes),workload:id,kind};}
  const rows=JSON.stringify(plannedRows(),null,2)+'\n';await fs.writeFile(path.join(output,'planned-rows.json'),rows,{flag:'wx'});files['planned-rows.json']={sha256:hash(rows),bytes:Buffer.byteLength(rows)};
  const sourceSHA256={};for(const f of ['core.mjs','tests/performance-workload-fixtures.mjs','tests/performance-workloads-reference.test.mjs','tests/fixtures/performance-workload-contract.json'])sourceSHA256[f]=hash(await fs.readFile(path.join(root,f)));
  await fs.writeFile(path.join(output,'workload-artifacts.json'),JSON.stringify({format:'LinecraftPerformanceWorkloadReference/1',names,records,files,sourceSHA256,definitionOnly:true,applicationExecuted:false,observedTimings:[],limits:'Headless actual core validation/selection and persisted ownership only. Independent literal contract; no rendering/PDF/font/native/IPC/timing/memory/threshold/optimization qualification.'},null,2)+'\n',{flag:'wx'});
});
