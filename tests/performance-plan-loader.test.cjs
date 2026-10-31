'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto'),{pathToFileURL}=require('node:url');
const {loadPerformanceWorkloadPlan,LIMITS}=require('../tools/performance-workload-plan.cjs');
const root=path.resolve(__dirname,'..'),hash=b=>createHash('sha256').update(b).digest('hex'),clone=x=>JSON.parse(JSON.stringify(x));
const IDS=['survey','residential','multiViewport','heavy'],SOURCES=['core.mjs','tests/performance-workload-fixtures.mjs','tests/performance-workloads-reference.test.mjs','tests/fixtures/performance-workload-contract.json'];
const NAMES=[...IDS.flatMap(id=>['raw','canonical'].map(kind=>id+'-'+kind+'.linecraft')),'planned-rows.json'];
const ordinary=['open','selectAll','clearSelection','pan','zoom','saveAs','reopen'],layout=['open','selectAll','clearSelection','switchLayoutB','switchLayoutC','returnLayoutA','pan','zoom','saveAs','reopen'];
const output=process.env.LINECRAFT_PERFORMANCE_PLAN_REPORT_DIRECTORY,names=[],records=[];let base;
function plan(){const rows=[];for(const workload of IDS)for(let process=0;process<3;process++){rows.push({workload,process,phase:'startup',round:-1,operation:'readiness'},{workload,process,phase:'cold-first-open',round:-1,operation:'open'});for(let round=0;round<6;round++)for(const operation of workload==='multiViewport'?layout:ordinary)rows.push({workload,process,phase:round?'measured-warm':'warmup',round,operation});}return rows;}
test.before(async()=>{
  const directory=path.join(root,'work','performance-plan-loader-reference',randomUUID()),artifactDirectory=path.join(directory,'artifacts'),sourceDirectory=path.join(directory,'source');await fs.mkdir(artifactDirectory,{recursive:true});await fs.mkdir(sourceDirectory);
  const {performanceWorkload}=await import(pathToFileURL(path.join(root,'tests/performance-workload-fixtures.mjs')).href),{createEditor}=await import(pathToFileURL(path.join(root,'core.mjs')).href);
  const files={},payloads=new Map(),sourceSHA256={};
  for(const name of SOURCES){const bytes=await fs.readFile(path.join(root,name)),target=path.join(sourceDirectory,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});sourceSHA256[name]=hash(bytes);payloads.set(target,bytes);}
  for(const id of IDS){const raw=performanceWorkload(id),editor=createEditor();assert.equal(editor.importJSON(JSON.stringify(raw)).ok,true);for(const kind of ['raw','canonical']){const name=id+'-'+kind+'.linecraft',bytes=Buffer.from(JSON.stringify(kind==='raw'?raw:JSON.parse(editor.serialize()),null,2)+'\n');files[name]={sha256:hash(bytes),bytes:bytes.length,workload:id,kind};await fs.writeFile(path.join(artifactDirectory,name),bytes,{flag:'wx'});payloads.set(path.join(artifactDirectory,name),bytes);}}
  const bytes=Buffer.from(JSON.stringify(plan(),null,2)+'\n');files['planned-rows.json']={sha256:hash(bytes),bytes:bytes.length};await fs.writeFile(path.join(artifactDirectory,'planned-rows.json'),bytes,{flag:'wx'});payloads.set(path.join(artifactDirectory,'planned-rows.json'),bytes);
  const producer={format:'LinecraftPerformanceWorkloadReference/1',names:[],records:[],files,sourceSHA256,definitionOnly:true,applicationExecuted:false,observedTimings:[],limits:'Independent fixture preparation, not a benchmark or launch receipt.'};await fs.writeFile(path.join(artifactDirectory,'workload-artifacts.json'),JSON.stringify(producer)+'\n',{flag:'wx'});
  base={directory,artifactDirectory,sourceDirectory,payloads,producer,expected:{format:'LinecraftPerformancePlanExpectations/1',sourceSHA256:clone(sourceSHA256),files:clone(files)}};
});
function harness(){
  const h={expected:clone(base.expected),producer:clone(base.producer),overlays:new Map(),options:{},counts:{open:0,closeAttempts:0,closed:0,readBytes:0,lstat:0,realpath:0},opened:[],handles:[]};
  h.producerBytes=()=>Buffer.from(JSON.stringify(h.producer)+'\n');
  const fault=()=>Error('C:\\SYNTHETIC_PRIVATE\\secret /SYNTHETIC_PRIVATE/secret');
  const nameOf=filename=>filename===path.join(base.artifactDirectory,'workload-artifacts.json')?'workload-artifacts.json':path.relative(base.artifactDirectory,filename);
  const data=filename=>h.overlays.get(filename)??(filename===path.join(base.artifactDirectory,'workload-artifacts.json')?h.producerBytes():null);
  h.setBytes=(name,bytes,mode='both')=>{const filename=path.join(base.artifactDirectory,name);h.overlays.set(filename,Buffer.from(bytes));if(mode!=='neither'){h.producer.files[name].sha256=hash(bytes);h.producer.files[name].bytes=bytes.length;}if(mode==='both'){h.expected.files[name].sha256=hash(bytes);h.expected.files[name].bytes=bytes.length;}};
  h.change=(name,fn,mode='both')=>{const value=JSON.parse(base.payloads.get(path.join(base.artifactDirectory,name)));fn(value);h.setBytes(name,Buffer.from(JSON.stringify(value)),mode);};
  h.source=(name,bytes,repin=false)=>{h.overlays.set(path.join(base.sourceDirectory,name),bytes);if(repin){h.expected.sourceSHA256[name]=hash(bytes);h.producer.sourceSHA256[name]=hash(bytes);}};
  h.fs={...fs,lstat:async filename=>{h.counts.lstat++;const name=nameOf(filename);if(h.options.missing===name||h.options.sourceMissing===path.relative(base.sourceDirectory,filename))throw fault();const stat=await fs.lstat(filename);if(h.options.symlink===name)return {isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>true};if(h.options.nonregular===name)return {isFile:()=>false,isDirectory:()=>false,isSymbolicLink:()=>false};return stat;},realpath:async filename=>{h.counts.realpath++;return h.options.escape===nameOf(filename)?path.join(base.directory,'outside.json'):fs.realpath(filename);},open:async filename=>{
    const name=nameOf(filename);if(h.options.openThrow===name)throw fault();const actual=await fs.open(filename,'r');h.counts.open++;h.opened.push(name);const ledger={id:h.handles.length,closeAttempts:0,closed:0};h.handles.push(ledger);const overlay=data(filename);
    return {stat:async()=>{if(h.options.statThrow===name)throw fault();const stat=await actual.stat();return {isFile:()=>h.options.openedNonregular!==name,size:h.options.understate===name?0:(overlay?.length??stat.size)};},read:async(buffer,offset,length,position)=>{if(h.options.readThrow===name)throw fault();const n=overlay?Math.min(length,Math.max(0,overlay.length-position)):(await actual.read(buffer,offset,length,position)).bytesRead;if(overlay&&n)overlay.copy(buffer,offset,position,position+n);h.counts.readBytes+=n;return {bytesRead:n};},close:async()=>{h.counts.closeAttempts++;ledger.closeAttempts++;await actual.close();h.counts.closed++;ledger.closed++;if(h.options.closeThrow===name)throw fault();}};
  }};
  h.run=()=>loadPerformanceWorkloadPlan({artifactDirectory:base.artifactDirectory,sourceDirectory:base.sourceDirectory,expected:h.expected,fs:h.fs,...h.options.arguments});return h;
}
function noLeak(value){const text=JSON.stringify(value instanceof Error?Object.fromEntries(Object.getOwnPropertyNames(value).map(k=>[k,value[k]])):value);for(const marker of ['SYNTHETIC_PRIVATE',base.directory,base.sourceDirectory,base.artifactDirectory])assert.equal(text.includes(marker),false);}
function ref(name,fn){names.push(name);test(name,{timeout:20000},async()=>{const h=harness(),r={name};records.push(r);try{await fn(h,r);r.outcome='pass';}catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,code:error.code??null};if(output){const destination=path.join(output,'failed-'+String(records.length));await fs.mkdir(destination,{recursive:true});await fs.writeFile(path.join(destination,'expected.json'),JSON.stringify(h.expected),{flag:'wx'});await fs.writeFile(path.join(destination,'producer.json'),h.producerBytes(),{flag:'wx'});for(const [name,bytes] of h.overlays)await fs.writeFile(path.join(destination,path.basename(name)),bytes,{flag:'wx'});}throw error;}finally{r.counts={...h.counts};r.handleLedger=clone(h.handles);assert.ok(h.handles.every(row=>row.closeAttempts===1&&row.closed===1),'Each acquired actual handle closes exactly once');r.overlaySHA256=Object.fromEntries([...h.overlays].map(([name,bytes])=>[path.basename(name),hash(bytes)]));assert.equal(h.counts.closeAttempts,h.counts.open,'Every acquired handle has one close attempt');assert.equal(h.counts.closed,h.counts.open,'These adapters delegate actual close before any injected close error');r.completed=true;}});}
async function rejects(h,code,r){let error;try{r.unexpectedResult=await h.run();}catch(value){error=value;}assert.ok(error,'Corrupt input must reject');r.code=error.code;noLeak(error);assert.equal(error.name,'PerformancePlanError');assert.equal(error.code,'PERF_PLAN_'+code);}
ref('Actual owned files and independent pins produce a non-launching summary',async(h,r)=>{const value=await h.run();r.summary=value;assert.equal(value.status,'definition-plan-valid');assert.equal(value.applicationLaunchAuthorized,false);assert.equal(value.observedPerformanceRows,0);assert.equal(value.geometryValidatedByLoader,false);assert.equal(value.environmentQualified,false);assert.deepEqual([value.workloads,value.documents,value.plannedRows,value.plannedActionRows,value.plannedStartupRows],[4,8,582,570,12]);assert.equal(h.counts.open,14);assert.equal(value.inputBytesRead,h.counts.readBytes);assert.equal(Object.keys(value.sourceSHA256).length,4);assert.equal(Object.keys(value.files).length,9);noLeak(value);});
ref('Refreshed trusted coordinate bytes remain outside metadata geometry qualification',async(h,r)=>{h.change('heavy-raw.linecraft',d=>{d.entities[0].end.x=7;});const value=await h.run();r.summary=value;assert.equal(value.status,'definition-plan-valid');assert.equal(value.geometryValidatedByLoader,false);assert.equal(value.applicationLaunchAuthorized,false);});
ref('Producer pass tallies cannot grant application authority',async(h,r)=>{h.producer.records=[{status:'passed',claimedLaunchAuthorized:true}];const value=await h.run();r.summary=value;assert.equal(value.applicationLaunchAuthorized,false);assert.equal(value.environmentQualified,false);assert.equal(value.observedPerformanceRows,0);assert.equal('records' in value,false);});
const cases=[
 ['missing independent expectations','EXPECTATIONS',h=>{h.expected=undefined;}],
 ['missing source pin','EXPECTATIONS',h=>{delete h.expected.sourceSHA256['core.mjs'];}],
 ['extra source pin','EXPECTATIONS',h=>{h.expected.sourceSHA256.extra='a'.repeat(64);}],
 ['non-string expected hash before filesystem access','EXPECTATIONS',h=>{h.expected.files['survey-raw.linecraft'].sha256=[h.expected.files['survey-raw.linecraft'].sha256];}],
 ['missing artifact expectation','EXPECTATIONS',h=>{delete h.expected.files['planned-rows.json'];}],
 ['unsafe extra artifact expectation','EXPECTATIONS',h=>{h.expected.files['../private.json']=h.expected.files['planned-rows.json'];}],
 ['wrong trusted role','EXPECTATIONS',h=>{h.expected.files['survey-raw.linecraft'].workload='heavy';}],
 ['relative artifact directory','INPUT',h=>{h.options.arguments={artifactDirectory:'relative'};}],
 ['actual source file missing','FILE',h=>{h.options.sourceMissing='core.mjs';}],
 ['actual source bytes changed','SOURCE',h=>{h.source('core.mjs',Buffer.from('SYNTHETIC SOURCE CHANGE'));}],
 ['producer source claim changed','SOURCE',h=>{h.producer.sourceSHA256['core.mjs']='a'.repeat(64);}],
 ['producer adds an unknown source claim','SOURCE',h=>{h.producer.sourceSHA256.extra='a'.repeat(64);}],
 ['producer file hash claim changed','HASH',h=>{h.producer.files['survey-raw.linecraft'].sha256='a'.repeat(64);}],
 ['producer format changed','METADATA',h=>{h.producer.format='invented';}],
 ['producer JSON invalid','METADATA',h=>{h.overlays.set(path.join(base.artifactDirectory,'workload-artifacts.json'),Buffer.from('{invalid'));}],
 ['unexpected producer metric field','METADATA',h=>{h.producer.durationMs=1;}],
 ['definition flag false','OBSERVATIONS',h=>{h.producer.definitionOnly=false;}],
 ['application execution claim true','OBSERVATIONS',h=>{h.producer.applicationExecuted=true;}],
 ['observed timings are nonempty','OBSERVATIONS',h=>{h.producer.observedTimings=[1];}],
 ['producer file role changed','OWNERSHIP',h=>{h.producer.files['survey-raw.linecraft'].kind='canonical';}],
 ['producer path-like artifact key','METADATA',h=>{h.producer.files['C:\\SYNTHETIC_PRIVATE\\secret']=h.producer.files['planned-rows.json'];}],
 ['payload bytes changed without reseal','HASH',h=>{h.setBytes('survey-raw.linecraft',Buffer.from('{}'),'neither');}],
 ['producer reseal cannot replace independent pin','HASH',h=>{h.change('survey-raw.linecraft',d=>{d.settings.units='in';},'producer');}],
 ['resealed invalid payload JSON','METADATA',h=>{h.setBytes('survey-raw.linecraft',Buffer.from('{invalid'));}],
 ['resealed unsupported native format','METADATA',h=>{h.change('survey-raw.linecraft',d=>{d.format='Linecraft/2';});}],
 ['resealed wrong unit metadata','OWNERSHIP',h=>{h.change('survey-raw.linecraft',d=>{d.settings.units='in';});}],
 ['resealed unknown prototype-named entity inventory','OWNERSHIP',h=>{h.change('survey-raw.linecraft',d=>{d.entities.push({id:'extra',type:'__proto__'});});}],
 ['resealed entity type must be a string','OWNERSHIP',h=>{h.change('heavy-raw.linecraft',d=>{d.entities[0].type=['LINE'];});}],
 ['resealed entity type inventory','OWNERSHIP',h=>{h.change('residential-canonical.linecraft',d=>{d.entities[5].type='LINE';});}],
 ['resealed paper owner changed','OWNERSHIP',h=>{h.change('multiViewport-canonical.linecraft',d=>{d.layouts[1].entities.push(d.layouts[0].entities.pop());});}],
 ['resealed inactive viewport removed','OWNERSHIP',h=>{h.change('multiViewport-canonical.linecraft',d=>{d.layouts[2].viewports.pop();});}],
 ['resealed viewport ID duplicated','OWNERSHIP',h=>{h.change('multiViewport-canonical.linecraft',d=>{d.layouts[2].viewports[0].id=d.layouts[0].viewports[0].id;});}],
 ['resealed viewport layer unlocked','OWNERSHIP',h=>{h.change('multiViewport-raw.linecraft',d=>{d.layers[1].locked=false;});}],
 ['resealed active sheet changed','OWNERSHIP',h=>{h.change('multiViewport-raw.linecraft',d=>{d.activeLayoutId='sheet-b';});}],
 ['resealed model entity claims paper owner','OWNERSHIP',h=>{h.change('multiViewport-raw.linecraft',d=>{d.entities[0].layoutId='sheet-a';});}],
 ['resealed duplicate/drop planned key','MATRIX',h=>{h.change('planned-rows.json',d=>{d[1]=clone(d[0]);});}],
 ['resealed planned operation renamed','MATRIX',h=>{h.change('planned-rows.json',d=>{d[2].operation='invented';});}],
 ['resealed planned process wrong','MATRIX',h=>{h.change('planned-rows.json',d=>{d[2].process=99;});}],
 ['resealed planned phase wrong','MATRIX',h=>{h.change('planned-rows.json',d=>{d[2].phase='measured-warm';});}],
 ['resealed planned round wrong','MATRIX',h=>{h.change('planned-rows.json',d=>{d[2].round=5;});}],
 ['resealed planned workload wrong','MATRIX',h=>{h.change('planned-rows.json',d=>{d[2].workload='invented';});}],
 ['resealed planned process has wrong type','MATRIX',h=>{h.change('planned-rows.json',d=>{d[0].process='0';});}],
 ['resealed extra timing field in planned row','MATRIX',h=>{h.change('planned-rows.json',d=>{d[2].durationMs=1;});}],
 ['resealed missing startup row','MATRIX',h=>{h.change('planned-rows.json',d=>{d.shift();});}],
 ['producer exceeds fixed byte cap','LIMIT',h=>{h.overlays.set(path.join(base.artifactDirectory,'workload-artifacts.json'),Buffer.alloc(1048577,32));}],
 ['payload grows past understated stat','LIMIT',h=>{h.options.understate='survey-raw.linecraft';h.overlays.set(path.join(base.artifactDirectory,'survey-raw.linecraft'),Buffer.alloc(4194305,32));}],
 ['aggregate budget counts actual source and payload bytes','LIMIT',h=>{for(const name of SOURCES)h.source(name,Buffer.alloc(3145728,32),true);}],
 ['missing payload','FILE',h=>{h.options.missing='survey-raw.linecraft';}],
 ['lstat symlink is rejected before open','FILE',h=>{h.options.symlink='survey-raw.linecraft';}],
 ['lstat nonregular file rejected before open','FILE',h=>{h.options.nonregular='survey-raw.linecraft';}],
 ['realpath escape is rejected before open','FILE',h=>{h.options.escape='survey-raw.linecraft';}],
 ['open failure has no acquired handle','FILE',h=>{h.options.openThrow='survey-raw.linecraft';}],
 ['opened handle is nonregular','FILE',h=>{h.options.openedNonregular='survey-raw.linecraft';}],
 ['opened handle stat throws','FILE',h=>{h.options.statThrow='survey-raw.linecraft';}],
 ['opened handle read throws','FILE',h=>{h.options.readThrow='survey-raw.linecraft';}],
 ['delegated actual close then throws','FILE',h=>{h.options.closeThrow='survey-raw.linecraft';}]
];
for(const [name,code,change] of cases)ref(name,async(h,r)=>{change(h);await rejects(h,code,r);if(['EXPECTATIONS','INPUT'].includes(code)){assert.equal(h.counts.open,0);assert.equal(h.counts.lstat,0);assert.equal(h.counts.realpath,0);}if(name==='aggregate budget counts actual source and payload bytes')assert.ok(h.counts.readBytes<=16777217,'Actual aggregate reads may exceed the cap by only one detection byte');if(h.options.symlink||h.options.nonregular||h.options.escape||h.options.openThrow)assert.equal(h.opened.includes('survey-raw.linecraft'),false);});
test('Loader reference inventory completes with no unexpected harness errors',()=>{assert.equal(names.length,cases.length+3);assert.equal(records.length,names.length);assert.equal(new Set(names).size,names.length);assert.ok(records.every(r=>r.completed));assert.equal(records.filter(r=>r.outcome==='unexpected-error').length,0);assert.deepEqual(LIMITS,{producerBytes:1048576,fileBytes:4194304,totalReadBytes:16777216});});
test.after(async()=>{if(!output)return;assert.ok(path.isAbsolute(output));await fs.mkdir(output,{recursive:true});const sourceSHA256={};for(const name of ['tools/performance-workload-plan.cjs','tests/performance-plan-loader.test.cjs'])sourceSHA256[name]=hash(await fs.readFile(path.join(root,name)));await fs.writeFile(path.join(output,'loader-results.json'),JSON.stringify({format:'LinecraftPerformancePlanLoaderReference/1',names,records,sourceSHA256,fixtureDirectory:base.directory,definitionOnly:true,applicationExecuted:false,observedPerformanceRows:0,limits:'Real owned positive files/handles; explicit read/stat/path/close fault adapters and in-memory corrupt copies. No hostile concurrent FS race, stall, complete geometry/native schema, environment, launch, app or timing qualification. Delegated-close-then-throw proves actual close only in that adapter.'},null,2)+'\n',{flag:'wx'});});
