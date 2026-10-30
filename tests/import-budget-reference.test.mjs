import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {importDXF} from '../dwg-import.mjs';
import {createEditor} from '../core.mjs';

// Bounded trusted source contract. No converter, Electron or native CAD runs.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=[],records=[],pairResults=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const fixtureDirectory=process.env.LINECRAFT_IMPORT_BUDGET_FIXTURES;
if(fixtureDirectory){assert.ok(path.isAbsolute(fixtureDirectory));await fs.mkdir(fixtureDirectory,{recursive:true});}
const source=await fs.readFile(path.join(root,'dwg-import.mjs'),'utf8');
const entry='const record=list[i];',cell='for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){';
assert.equal(source.split(entry).length,2);assert.equal(source.split(cell).length,2);
const prefix="let __recordVisits=0,__cellVisits=0;export function __resetWork(){__recordVisits=0;__cellVisits=0;}export function __work(){return {records:__recordVisits,cells:__cellVisits,units:__recordVisits+__cellVisits};}\n";
let observedSource=source.replace(entry,'__recordVisits++;'+entry).replace(cell,cell+'__cellVisits++;');
for(const relative of ['./core.mjs','./advanced-geometry.mjs']){
  assert.equal(observedSource.split("from '"+relative+"'").length,2);
  observedSource=observedSource.replace("from '"+relative+"'","from '"+pathToFileURL(path.join(root,relative)).href+"'");
}
observedSource=prefix+observedSource;
const observed=await import('data:text/javascript;base64,'+Buffer.from(observedSource).toString('base64'));
const record=(type,...groups)=>[0,type,...groups.flat()];
const line=(x1=0,y1=0,x2=10,y2=0)=>record('LINE',[10,x1],[20,y1],[11,x2],[21,y2]);
const block=(name,contents=[],flags=0)=>[...record('BLOCK',[2,name],[70,flags],[10,0],[20,0],[30,0]),...contents,...record('ENDBLK')];
const insert=(name,columns=1,rows=1,x=0,y=0,dx=0,dy=0)=>record('INSERT',[2,name],[10,x],[20,y],[70,columns],[71,rows],[44,dx],[45,dy]);
const file=(entities,blocks=[])=>[0,'SECTION',2,'BLOCKS',...blocks,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...entities,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
const anchor=[{type:'LINE',start:{x:0,y:0},end:{x:10,y:0}}];
const geometry=result=>JSON.parse(result.text).entities.map(e=>({type:e.type,start:e.start,end:e.end}));
const point=record('POINT',[10,1],[20,2]);
const nested=leaf=>file([...line(),...insert('B1',3)],[...block('B0',leaf),...block('B1',insert('B0',2))]);
const nestedPoints=nested(point),nestedEmpty=nested([]);
const siblings=file([...line(),...insert('B0',3),...insert('B0',3)],[...block('B0',point)]);
async function fixture(name,input,r){
  r.inputSHA256=sha(input);r.inputBytes=Buffer.byteLength(input);
  if(fixtureDirectory){const target=path.join(fixtureDirectory,name+'.dxf');await fs.writeFile(target,input,{flag:'wx'});r.fixture=path.basename(target);}
}
function run(input,options={}){return importDXF(input,{sourceName:'Synthetic import budget reference',...options});}
function instrument(input,r){
  observed.__resetWork();const actual=run(input),projected=observed.importDXF(input,{sourceName:'Synthetic import budget reference'});
  assert.deepEqual(projected,actual,'Observation-only source must preserve complete executed output');r.work=observed.__work();r.imported=actual.report.importedEntities;r.unsupported=actual.report.unsupportedByType;return actual;
}
function ref(name,fn,timeout=5000){names.push(name);test(name,{timeout},async()=>{
  const r={name,stage:'source-execution'};records.push(r);
  try{await fn(r);r.outcome='pass';}catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,code:error.code??null};throw error;}finally{r.completed=true;}
});}
ref('Ordinary LINE preserves literal endpoints and no unsupported objects',async r=>{const input=file(line());await fixture('ordinary',input,r);const result=instrument(input,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,{});assert.deepEqual(r.work,{records:1,cells:0,units:1});});
ref('Ordinary 3 by 2 array has six independently calculated LINEs',async r=>{const input=file(insert('B0',3,2,10,20,4,5),block('B0',line(1,2,3,2)));await fixture('ordinary-array',input,r);const result=instrument(input,r);assert.deepEqual(geometry(result),[
  {type:'LINE',start:{x:11,y:22},end:{x:13,y:22}},{type:'LINE',start:{x:15,y:22},end:{x:17,y:22}},{type:'LINE',start:{x:19,y:22},end:{x:21,y:22}},
  {type:'LINE',start:{x:11,y:27},end:{x:13,y:27}},{type:'LINE',start:{x:15,y:27},end:{x:17,y:27}},{type:'LINE',start:{x:19,y:27},end:{x:21,y:27}}
]);assert.deepEqual(r.work,{records:7,cells:6,units:13});});
ref('Nested 3 by 2 POINT expansion costs twenty units but publishes one LINE',async r=>{await fixture('nested-points',nestedPoints,r);const result=instrument(nestedPoints,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,{POINT:6});assert.deepEqual(r.work,{records:11,cells:9,units:20});assert.equal(result.report.warnings.find(w=>w.message.startsWith('Ordinary blocks')).count,4);});
ref('Empty leaf still costs fourteen units without publishing extra geometry',async r=>{await fixture('nested-empty',nestedEmpty,r);const result=instrument(nestedEmpty,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,{});assert.deepEqual(r.work,{records:5,cells:9,units:14});});
ref('Sibling expansions share fifteen observed units and six skipped POINTs',async r=>{await fixture('siblings',siblings,r);const result=instrument(siblings,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,{POINT:6});assert.deepEqual(r.work,{records:9,cells:6,units:15});});
ref('Early-skipped ATTRIB records are still observed as work',async r=>{const input=nested(record('ATTRIB'));await fixture('attributes',input,r);const result=instrument(input,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,{ATTRIB:6});assert.deepEqual(r.work,{records:11,cells:9,units:20});});
ref('External-reference flag skips before cell dispatch',async r=>{const input=file([...line(),...insert('XREF')],block('XREF',point,4));await fixture('xref',input,r);const result=instrument(input,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,{'INSERT-xref':1});assert.deepEqual(r.work,{records:2,cells:0,units:2});});
ref('Cyclic references reject rather than returning partial anchor geometry',async r=>{const input=file([...line(),...insert('CYCLE')],block('CYCLE',insert('CYCLE')));await fixture('cycle',input,r);assert.throws(()=>run(input),/Cyclic block references/);});
for(const depth of [16,17])ref('Existing depth boundary '+depth,async r=>{let blocks=[];for(let i=0;i<depth;i++)blocks.push(...block('D'+i,i?insert('D'+(i-1)):line(1,2,3,2)));const input=file(insert('D'+(depth-1)),blocks);await fixture('depth-'+depth,input,r);if(depth===17)assert.throws(()=>run(input),/Block nesting exceeds 16 levels/);else assert.deepEqual(geometry(run(input)),[{type:'LINE',start:{x:1,y:2},end:{x:3,y:2}}]);});
for(const count of [10000,10001])ref('Existing per-INSERT empty array boundary '+count,async r=>{const input=file([...line(),...insert('EMPTY',count)],block('EMPTY'));await fixture('array-'+count,input,r);const result=instrument(input,r);assert.deepEqual(geometry(result),anchor);assert.deepEqual(result.report.unsupportedByType,count===10000?{}:{INSERT:1});assert.deepEqual(r.work,{records:2,cells:count===10000?10000:0,units:count===10000?10002:2});});
// Trusted parser work options; historical case titles retain prerequisite lineage.
for(const [label,input,limit,within] of [['nested-inclusive',nestedPoints,20,true],['nested-over',nestedPoints,19,false],['empty-inclusive',nestedEmpty,14,true],['empty-over',nestedEmpty,13,false],['siblings-inclusive',siblings,15,true],['siblings-over',siblings,14,false]])ref('Prospective cumulative work budget '+label,async r=>{
  r.proposedLimit=limit;r.stage='prospective-work-budget';let error,result;try{result=run(input,{workBudget:{maxUnits:limit}});}catch(value){error=value;}
  r.returnedDocument=Boolean(result);r.thrownCode=error?.code??null;
  if(within){assert.equal(error,undefined);assert.deepEqual(geometry(result),anchor);r.note='Positive control alone cannot establish an enforced option';}
  else{assert.ok(error,'Whole import must reject rather than return even the valid anchor');assert.equal(error.code,'IMPORT_WORK_LIMIT');assert.equal(String(error.message).includes('Synthetic import budget reference'),false);}
});
for(const malformed of [false,true])ref('Prospective already-aborted signal precedes '+(malformed?'malformed parsing':'editor construction'),async r=>{
  const controller=new AbortController();controller.abort(Error('SYNTHETIC_PRIVATE_ABORT_REASON'));const calls={create:0,import:0};let error,result;
  const factory=()=>{calls.create++;const editor=createEditor();return {importJSON:(...args)=>{calls.import++;return editor.importJSON(...args);},serialize:()=>editor.serialize(),get state(){return editor.state;}};};
  try{result=run(malformed?'not a DXF':file(line()),{signal:controller.signal,createEditor:factory});}catch(value){error=value;}
  r.stage='prospective-abort-prerequisite';r.calls=calls;r.returnedDocument=Boolean(result);r.thrownName=error?.name??null;
  assert.ok(error,'An already-aborted request must reject');assert.equal(error.name,'AbortError');assert.equal(String(error.message).includes('SYNTHETIC_PRIVATE'),false);assert.deepEqual(calls,{create:0,import:0});
});
const workerCode=`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {readDXF}=await import(workerData.module);const input='999\\nx\\n'.repeat(workerData.pairs-1)+'0\\nEOF'+(workerData.newline?'\\n':'');const result={pairs:workerData.pairs,newline:workerData.newline,bytes:Buffer.byteLength(input),sha256:require('node:crypto').createHash('sha256').update(input).digest('hex')};if(workerData.output)await require('node:fs/promises').writeFile(workerData.output,input,{flag:'wx'});try{result.records=readDXF(input).records.length;result.rejected=false;}catch(error){result.rejected=true;result.message=error.message;}parentPort.postMessage(result);})().catch(error=>parentPort.postMessage({harnessError:error.name}));`;
async function pairs(pairs,newline){
  const output=fixtureDirectory?path.join(fixtureDirectory,'pairs-'+pairs+'-'+Number(newline)+'.dxf'):null;
  const worker=new Worker(workerCode,{eval:true,resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4},workerData:{module:pathToFileURL(path.join(root,'dwg-import.mjs')).href,pairs,newline,output}});
  let timer;try{return await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Owned group-pair worker watchdog expired; not product cancellation')),15000);worker.once('message',value=>value.harnessError?reject(Error('Owned worker harness: '+value.harnessError)):resolve(value));worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('Owned worker exited '+code));});});}finally{clearTimeout(timer);await worker.terminate();}
}
for(const count of [1000000,1000001])for(const newline of [false,true])ref('Complete group-pair budget '+count+' finalNewline='+newline,async r=>{const value=await pairs(count,newline);pairResults.set(count+':'+newline,value);r.stage='actual-group-pair-boundary';r.observed=value;assert.equal(value.rejected,count>1000000,'One million complete pairs is inclusive, independent of final transport newline');if(!value.rejected)assert.equal(value.records,0);else assert.equal(value.message,'DXF exceeds one million group pairs.');},20000);
ref('Final transport newline cannot change group-budget admission',async r=>{const a=pairResults.get('1000001:false'),b=pairResults.get('1000001:true');assert.ok(a&&b);r.observed={unterminatedRejected:a.rejected,terminatedRejected:b.rejected};assert.equal(a.rejected,b.rejected,'Identical complete group pairs must have the same decision');});
const defaultWorkerCode=String.raw`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {importDXF}=await import(workerData.module);const point='0\nPOINT\n10\n1\n20\n2\n';const input='0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nWORK\n10\n0\n20\n0\n30\n0\n'+'0\nLINE\n10\n1\n20\n2\n11\n3\n21\n2\n'+point.repeat(999)+'0\nENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n2\nWORK\n10\n0\n20\n0\n70\n999\n71\n1\n'+(workerData.over?point:'')+'0\nENDSEC\n0\nEOF\n';if(workerData.output)await require('node:fs/promises').writeFile(workerData.output,input,{flag:'wx'});const reply={bytes:Buffer.byteLength(input),sha256:require('node:crypto').createHash('sha256').update(input).digest('hex')};try{const result=importDXF(input,{sourceName:'Synthetic default work reference'}),entities=JSON.parse(result.text).entities;reply.rejected=false;reply.entities=entities.length;reply.skippedPoints=result.report.unsupportedByType.POINT;reply.literalLines=entities.every(e=>e.type==='LINE'&&e.start.x===1&&e.start.y===2&&e.end.x===3&&e.end.y===2);}catch(error){reply.rejected=true;reply.code=error.code??null;reply.message=error.message;}parentPort.postMessage(reply);})().catch(error=>parentPort.postMessage({harnessError:error.name}));`;
async function defaultWork(over){const worker=new Worker(defaultWorkerCode,{eval:true,resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4},workerData:{module:pathToFileURL(path.join(root,'dwg-import.mjs')).href,over,output:fixtureDirectory?path.join(fixtureDirectory,'default-work-'+Number(over)+'.dxf'):null}});let timer;try{return await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Owned default-work watchdog; not product cancellation')),15000);worker.once('message',value=>value.harnessError?reject(Error(value.harnessError)):resolve(value));worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('Owned worker exited '+code));});});}finally{clearTimeout(timer);await worker.terminate();}}
for(const over of [false,true])ref('Proposed default work boundary '+(over?'1000001':'1000000'),async r=>{const value=await defaultWork(over);r.observed=value;r.proposedUnits=over?1000001:1000000;assert.equal(value.rejected,over);if(over)assert.equal(value.code,'IMPORT_WORK_LIMIT');else{assert.equal(value.entities,999);assert.equal(value.skippedPoints,998001);assert.equal(value.literalLines,true);}},20000);
for(const limit of [0,-1,.5,1000001,'20',null,NaN])ref('Proposed work override validation '+String(limit)+' type='+typeof limit,async r=>{let error;try{run(file(line()),{workBudget:{maxUnits:limit}});}catch(value){error=value;}r.thrownCode=error?.code??null;assert.ok(error,'Invalid or loosening overrides must reject before work');assert.equal(error.code,'IMPORT_BUDGET_INVALID');});
ref('Invalid work override precedes malformed input parsing',async r=>{let error;try{run('not a DXF',{workBudget:{maxUnits:0}});}catch(value){error=value;}r.thrownCode=error?.code??null;assert.ok(error);assert.equal(error.code,'IMPORT_BUDGET_INVALID');});
test('Import budget reference inventory accounts for all thirty-five named cases',()=>{assert.equal(names.length,35);assert.equal(records.length,35);assert.ok(records.every(r=>r.completed));assert.equal(records.filter(r=>r.outcome==='unexpected-error').length,0);});
after(async()=>{if(process.env.LINECRAFT_IMPORT_BUDGET_REPORT){const target=process.env.LINECRAFT_IMPORT_BUDGET_REPORT;assert.ok(path.isAbsolute(target));await fs.writeFile(target,JSON.stringify({format:'LinecraftImportBudgetReference/1',names,records,sourceSHA256:sha(source),instrumentedSHA256:sha(observedSource),instrumentation:'Original module with absolute helper URLs, local counter/reset exports and nonthrowing increments at decoded-record/INSERT-cell entry. No resource guard, exception or returned output is injected; direct complete output is compared on observed controls.',workContract:{workBudget:{maxUnits:'one unit per decoded record entry plus each INSERT cell, inclusive across siblings; inclusive default 1000000, override positive safe integer at most default'},signal:'Already-aborted actual AbortSignal before parsing/editor creation; AbortError without opaque reason echo'},workerContainment:{maxOldGenerationSizeMb:256,stackSizeMb:4,watchdogMs:15000},limits:'Trusted workBudget/signal source interfaces; no renderer cancellation channel or event-loop responsiveness is established. Counters cover tested decode/cell entries, not all preprocessing, vertex/group traversal, CPU time or memory. Worker limits/watchdog are test containment, not product cancellation. No mid-parse UI/event-loop cancellation, importer cleanup/real converter/renderer adoption, native or installed acceptance. Existing aggregate geometry and output budgets remain separate.'},null,2)+'\n',{flag:'wx'});}});
