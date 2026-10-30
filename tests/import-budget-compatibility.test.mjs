import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceFile=process.env.LINECRAFT_IMPORT_COMPAT_SOURCE??path.join(root,'dwg-import.mjs');
assert.ok(path.isAbsolute(sourceFile));
const source=await fs.readFile(sourceFile,'utf8'),hash=b=>createHash('sha256').update(b).digest('hex');
function moduleURL(body){
  for(const name of ['./core.mjs','./advanced-geometry.mjs'])body=body.replace("from '"+name+"'","from '"+pathToFileURL(path.join(root,name)).href+"'");
  return 'data:text/javascript;base64,'+Buffer.from(body).toString('base64');
}
const url=moduleURL(source),{importDXF}=await import(url),names=[],records=[];
const record=(type,...groups)=>[0,type,...groups.flat()];
const line=(x1=1,y1=2,x2=11,y2=2)=>record('LINE',[10,x1],[20,y1],[11,x2],[21,y2]);
const file=entities=>[0,'SECTION',2,'ENTITIES',...entities,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
const geometry=result=>JSON.parse(result.text).entities.map(e=>({type:e.type,start:e.start,end:e.end,...(e.layoutId?{layoutId:e.layoutId}:{})}));
const expectedLine={type:'LINE',start:{x:1,y:2},end:{x:11,y:2}};
function ref(name,fn){names.push(name);test(name,{timeout:20000},async()=>{const r={name};records.push(r);try{await fn(r);r.outcome='pass';}catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,code:error.code??null};throw error;}finally{r.completed=true;}});}

ref('Ordinary BOM and accepted line transports preserve literal geometry',async r=>{
  const ordinary=file(line());r.transports=[];
  for(const ending of ['\n','\r','\r\n','\r\r\n'])for(const bom of ['', '\uFEFF']){
    const input=bom+ordinary.replaceAll('\n',ending),result=importDXF(input);
    assert.deepEqual(geometry(result),[expectedLine]);assert.deepEqual(result.report.unsupportedByType,{});
    r.transports.push({ending,bom:Boolean(bom),sha256:hash(input)});
  }
});
ref('Malformed and truncated input remain rejected',async()=>{
  for(const input of ['not a DXF','0\nSECTION\n2\nENTITIES\n','0\nSECTION\n9\nENTITIES\n0\nEOF\n'])assert.throws(()=>importDXF(input));
});
ref('Foreign helper error with a public work code remains an ordinary skip',async r=>{
  const actual=pathToFileURL(path.join(root,'advanced-geometry.mjs')).href;
  const helper='data:text/javascript;base64,'+Buffer.from("export let calls=0;export function validateEllipse(){calls++;const error=new Error('Synthetic foreign helper fault.');error.code='IMPORT_WORK_LIMIT';throw error;}export {validateSpline} from '"+actual+"';").toString('base64');
  const needle="from './advanced-geometry.mjs'";assert.equal(source.split(needle).length,2);
  const body=source.replace(needle,"from '"+helper+"'"),projected=await import(moduleURL(body));
  const ellipse=record('ELLIPSE',[10,0],[20,0],[11,4],[21,0],[40,.5],[41,0],[42,Math.PI*2]);
  const result=projected.importDXF(file([...line(),...ellipse]));
  assert.equal((await import(helper)).calls,1);assert.deepEqual(geometry(result),[expectedLine]);assert.deepEqual(result.report.unsupportedByType,{ELLIPSE:1});
  r.projection='Exact importer body; only advanced-geometry helper binding replaced with an intentional foreign error adapter. Not observation-only instrumentation.';
});
const sheet='Work sheet',paper=[0,'SECTION',2,'ENTITIES',...line(),...record('LINE',[67,1],[330,'90'],[410,sheet],[10,20],[20,30],[11,40],[21,30]),0,'ENDSEC',0,'SECTION',2,'OBJECTS',...record('LAYOUT',[100,'AcDbPlotSettings'],[72,1],[44,420],[45,297],[100,'AcDbLayout'],[1,sheet],[71,1],[330,'90']),0,'ENDSEC',0,'EOF'].join('\n')+'\n';
for(const limit of [2,1])ref('Model and paper share exactly two work units at limit '+limit,async r=>{
  r.inputSHA256=hash(paper);r.expected={records:2,cells:0,units:2};let result,error;
  try{result=importDXF(paper,{workBudget:{maxUnits:limit}});}catch(value){error=value;}
  if(limit===1){assert.ok(error,'No partial model candidate may be returned');assert.equal(error.code,'IMPORT_WORK_LIMIT');assert.equal(result,undefined);}
  else{assert.equal(error,undefined);assert.deepEqual(geometry(result),[expectedLine]);const layout=JSON.parse(result.text).layouts[0];assert.deepEqual(layout.entities.map(e=>({type:e.type,start:e.start,end:e.end})),[{type:'LINE',start:{x:20,y:30},end:{x:40,y:30}}]);assert.equal(layout.name,sheet);assert.equal(layout.paper.widthMm,420);assert.equal(layout.paper.heightMm,297);}
});
const workerCode=String.raw`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {readDXF}=await import(workerData.module);const input='999\r\nx\r\n'.repeat(workerData.count-1)+'0\r\nEOF\r\n';const result={pairs:workerData.count,bytes:Buffer.byteLength(input),sha256:require('node:crypto').createHash('sha256').update(input).digest('hex')};try{result.records=readDXF(input).records.length;result.rejected=false;}catch(error){result.rejected=true;result.message=error.message;}parentPort.postMessage(result);})().catch(error=>parentPort.postMessage({harnessError:error.name}));`;
for(const count of [1000000,1000001])ref('Complete CRLF group pairs enforce inclusive boundary '+count,async r=>{
  const worker=new Worker(workerCode,{eval:true,resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4},workerData:{module:url,count}});let timer;
  try{r.observed=await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Owned compatibility worker watchdog; not product cancellation')),15000);worker.once('message',value=>value.harnessError?reject(Error(value.harnessError)):resolve(value));worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('Owned compatibility worker exit '+code));});});}
  finally{clearTimeout(timer);await worker.terminate();}
  assert.equal(r.observed.rejected,count>1000000);if(r.observed.rejected)assert.equal(r.observed.message,'DXF exceeds one million group pairs.');else assert.equal(r.observed.records,0);
});
ref('Report-time trusted callback abort prevents candidate return',async r=>{const controller=new AbortController();let calls=0,result,error;const sourceName={toString(){calls++;controller.abort(Error('SYNTHETIC_PRIVATE_REASON'));return 'Synthetic source';}};try{result=importDXF(file(line()),{signal:controller.signal,sourceName});}catch(value){error=value;}r.callbackCalls=calls;r.returnedDocument=Boolean(result);assert.equal(calls,1);assert.ok(error,'Cancellation in report construction must suppress the candidate');assert.equal(error.name,'AbortError');assert.equal(String(error.message).includes('SYNTHETIC_PRIVATE'),false);});
test('Import compatibility inventory accounts for eight cases',()=>{assert.equal(names.length,8);assert.equal(records.length,8);assert.ok(records.every(r=>r.completed));assert.equal(records.filter(r=>r.outcome==='unexpected-error').length,0);});
after(async()=>{const target=process.env.LINECRAFT_IMPORT_COMPAT_REPORT;if(target){assert.ok(path.isAbsolute(target));await fs.writeFile(target,JSON.stringify({format:'LinecraftImportCompatibilityReference/1',names,records,sourceSHA256:hash(source),scope:'Actual importer source with absolute helper bindings; optional baseline source copy. Foreign helper case replaces one dependency deliberately. CRLF workers have256MiB old-generation/4MiB stack and15s watchdog; no converter, app, native, whole-process memory or UI responsiveness claim.'},null,2)+'\n',{flag:'wx'});}});
