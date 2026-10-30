'use strict';
// Explicit pending source contract. No executable converter or native app is run.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createHash,randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),names=[],records=[];
const TIMEOUT=100,GRACE=1000,OUTPUT=64,TEXT='SYNTHETIC NORMALIZED DRAWING';
const ORIGINAL='AC1032 SYNTHETIC ORIGINAL',SENTINEL='UNRELATED SYNTHETIC SENTINEL';
const hash=b=>createHash('sha256').update(b).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
async function until(predicate,label){
  const start=performance.now();
  while(!predicate()){assert.ok(performance.now()-start<4000,'Fixture barrier timed out: '+label);await new Promise(resolve=>setImmediate(resolve));}
}
function clock(){
  let now=0,next=0;const timers=new Map();
  return {now:()=>now,set:(fn,ms)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;},clear:id=>timers.delete(id),
    advance(ms){const end=now+ms;let iterations=0;while(true){const row=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!row)break;assert.ok(++iterations<100,'Virtual timer loop');now=row[1].at;timers.delete(row[0]);row[1].fn();}now=end;},get pending(){return timers.size;}};
}
async function fixture(options={}){
  const directory=path.join(root,'work','converter-lifecycle-reference',randomUUID());await fs.mkdir(directory,{recursive:true});
  const input=path.join(directory,'source.dwg'),dxf=path.join(directory,'source.dxf'),binary=path.join(directory,'owned-nonexecutable.exe'),sentinel=path.join(directory,'unrelated.dwg'),temporary=path.join(directory,'temporary');
  await Promise.all([fs.writeFile(input,ORIGINAL),fs.writeFile(dxf,'SYNTHETIC DXF'),fs.writeFile(sentinel,SENTINEL),fs.writeFile(binary,'NONEXECUTABLE SYNTHETIC FIXTURE')]);
  if(options.missingBinary)await fs.unlink(binary);
  const time=clock(),children=[],calls=[],removals=[],pendingRemovals=[],auxiliaryPromises=[],warnings=[],state={parse:0,validate:0,settlements:0,status:'pending',value:null,error:null};let owned=null;
  const guardedFS={...fs,mkdtemp:async prefix=>{owned=await fs.mkdtemp(prefix);return owned;},rm:async(target,flags)=>{
    assert.equal(path.dirname(path.resolve(target)),path.resolve(temporary));assert.ok(path.basename(target).startsWith('linecraft-import-'));
    const row={at:time.now(),allChildrenClosed:children.every(c=>c.closed),owned:true,completed:false};removals.push(row);
    if(options.cleanupFails){row.failed=true;throw Object.assign(Error('SYNTHETIC_PRIVATE cleanup'),{code:'EACCES'});}
    const pending=fs.rm(target,flags);pendingRemovals.push(pending);await pending;row.completed=true;
  },lstat:async target=>options.cleanupRefuses&&target===owned?{isSymbolicLink:()=>true,isDirectory:()=>true}:fs.lstat(target),...(options.fsOverrides??{})};
  const spawn=(executable,args,flags)=>{
    assert.equal(executable,binary);assert.equal(flags.shell,false);assert.equal(flags.windowsHide,true);assert.deepEqual(plain(flags.stdio),['ignore','pipe','pipe']);
    assert.equal(args[4],path.join(owned,'input.dwg'));assert.equal(args.includes(input),false);assert.equal(flags.cwd,owned);
    if(options.spawnThrows)throw Object.assign(Error('SYNTHETIC_PRIVATE spawn path '+directory),{code:'ENOENT'});
    const child=new EventEmitter();Object.assign(child,{stdout:new EventEmitter(),stderr:new EventEmitter(),closed:false,kills:0,args});
    child.close=(code=0,signal=null)=>{child.closed=true;child.emit('close',code,signal);};
    child.kill=signal=>{assert.equal(signal,'SIGKILL');child.kills++;if(options.kill==='throw')throw Error('SYNTHETIC_PRIVATE kill error');if(options.kill==='sync-close'){child.close(null,'SIGKILL');return true;}if(options.kill==='false')return false;if(options.kill!=='no-close')queueMicrotask(()=>child.close(null,'SIGKILL'));return true;};
    children.push(child);calls.push({format:args[1],shell:flags.shell,windowsHide:flags.windowsHide});return child;
  };
  const source=await fs.readFile(path.join(root,'desktop/import-files.cjs'),'utf8'),module={exports:{}};
  const requireOnly=name=>{if(name==='node:child_process')return {spawn:()=>{throw Error('Fixture forbids real process execution');}};assert.ok(['node:fs/promises','node:path','node:os'].includes(name));return require(name);};
  vm.runInNewContext(source,{module,exports:module.exports,require:requireOnly,Buffer,Date:{now:time.now},setTimeout:time.set,clearTimeout:time.clear,console:{warn:message=>warnings.push(message)}},{filename:'actual-import-adapter.vm.cjs',timeout:1000});
  const importer=module.exports.createDrawingImporter({converterPath:binary,converterArguments:(a,b,format)=>['-O',format,'-o',b,a],
    parseDXF:async()=>{state.parse++;return options.malformed?null:{text:TEXT,report:{importedEntities:1,warnings:[]}};},
    validateDrawing:async value=>{state.validate++;assert.equal(value,TEXT);},
    ...(options.metadata?{parseDWGMetadata:async()=>({layers:[]})}:{}),fs:guardedFS,spawn,tempRoot:temporary,
    limits:{drawing:1024,dwg:1024,dxfInput:1024,dxf:1024,processOutput:options.outputLimit??OUTPUT,timeoutMs:TIMEOUT}});
  const promise=importer.importDrawing(options.dxf?dxf:input);
  // Attach both outcomes immediately; the watchdog never settles the product promise.
  const observed=promise.then(value=>{state.settlements++;state.status='resolved';state.value=value;},error=>{state.settlements++;state.status='rejected';state.error=error;});
  await until(()=>children.length||state.status!=='pending','spawn or early result');
  const snapshot=async()=>{const scratchExists=owned?await fs.stat(owned).then(()=>true,()=>false):false;return {at:time.now(),status:state.status,settlements:state.settlements,parse:state.parse,validate:state.validate,kills:children.reduce((n,c)=>n+c.kills,0),closed:children.map(c=>c.closed),scratchExists,removals:plain(removals),internalPrivateMarker:Boolean(state.error?.message?.includes('SYNTHETIC_PRIVATE')),internalOwnedPath:Boolean(state.error?.message?.includes(directory))};};
  const close=async(index=0,code=0,signal=null)=>{children[index].close(code,signal);await until(()=>state.status!=='pending','settlement after close');await observed;};
  const output=async(index=0,value='SYNTHETIC DXF')=>fs.writeFile(children[index].args[3],value);
  const preserve=async()=>{assert.equal(await fs.readFile(input,'utf8'),ORIGINAL);assert.equal(await fs.readFile(sentinel,'utf8'),SENTINEL);};
  const finish=async()=>{for(const child of children)if(!child.closed)child.close(null,'SIGKILL');await until(()=>state.status!=='pending','teardown release');await observed;await Promise.all(auxiliaryPromises);await Promise.all(pendingRemovals);await preserve();};
  return {directory,time,children,calls,removals,warnings,state,importer,input,dxf,track:p=>{auxiliaryPromises.push(p);return p;},owned:()=>owned,snapshot,close,output,preserve,finish,async settled(){await until(()=>state.status!=='pending','observed product result');await observed;},hashes:{original:hash(ORIGINAL),sentinel:hash(SENTINEL)}};
}
function ref(name,options,run){names.push(name);test(name,{timeout:10000},async()=>{
  const r={name,stage:'fixture-start'};records.push(r);let h;
  try{h=await fixture(options);r.fixture=path.relative(root,h.directory).split(path.sep).join('/');r.initial=await h.snapshot();await run(h,r);r.outcome='pass';}
  catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,code:error.code??null};throw error;}
  finally{if(h){r.beforeTeardown=await h.snapshot();await h.finish();r.teardownRelease=await h.snapshot();r.originalAndSentinelPreserved=true;}r.completed=true;}
});}
function rejected(h,message){assert.equal(h.state.status,'rejected');if(message)assert.equal(h.state.error.message,message);assert.equal(h.state.parse,0);assert.equal(h.state.validate,0);assert.equal(h.state.settlements,1);}
function cleanupAfterClose(h){assert.equal(h.removals.length,1);assert.ok(h.removals.every(x=>x.allChildrenClosed&&x.completed));}
ref('Successful fixed hidden shell-free conversion preserves originals and cleans its private copy',{},async h=>{await h.output();await h.close();assert.equal(h.state.status,'resolved');assert.equal(h.state.value.text,TEXT);assert.equal(h.state.value.importInfo.sourceFormat,'DWG');assert.equal(h.state.parse,1);assert.equal(h.state.validate,1);assert.equal(h.calls.length,1);cleanupAfterClose(h);});
ref('Direct DXF succeeds without a child or private converter directory',{dxf:true},async h=>{await h.settled();assert.equal(h.state.status,'resolved');assert.equal(h.children.length,0);assert.equal(h.owned(),null);assert.equal(h.state.value.importInfo.converted,false);});
ref('Nonzero converter exit rejects before parsing and cleans after close',{},async h=>{await h.close(0,7);rejected(h,'DWG conversion failed (7). The original drawing is unchanged.');cleanupAfterClose(h);});
ref('Signal converter exit rejects before parsing and cleans after close',{},async h=>{await h.close(0,null,'SIGTERM');rejected(h,'DWG conversion failed (SIGTERM). The original drawing is unchanged.');cleanupAfterClose(h);});
for(const diagnostic of ['ERROR: Synthetic partial output.','FATAL: unsupported version SYNTHETIC_VERSION'])ref('Exit-zero diagnostic rejects: '+diagnostic.split(':')[0]+(diagnostic.includes('version')?' unsupported-version fixture':''),{},async h=>{h.children[0].stderr.emit('data',Buffer.from(diagnostic));await h.output();await h.close();rejected(h,'DWG converter reported an error despite its exit status. The original drawing is unchanged.');cleanupAfterClose(h);});
ref('Malformed normalized parser response rejects after confirmed conversion close',{malformed:true},async h=>{await h.output();await h.close();assert.equal(h.state.status,'rejected');assert.equal(h.state.error.message,'Drawing import did not produce a valid document.');assert.equal(h.state.validate,0);cleanupAfterClose(h);});
ref('Missing generated output rejects without parsing after confirmed close',{},async h=>{await h.close();rejected(h);assert.equal(h.state.error.code,'ENOENT');cleanupAfterClose(h);});
ref('Directory output is rejected as nonregular before parsing',{},async h=>{await fs.mkdir(h.children[0].args[3]);await h.close();rejected(h,'DWG converter did not produce a private regular DXF file.');cleanupAfterClose(h);});
ref('Missing binary fails before spawn and private scratch; internal path is not a renderer-leak claim',{missingBinary:true},async h=>{await h.settled();rejected(h);assert.equal(h.state.error.code,'ENOENT');assert.equal(h.calls.length,0);assert.equal(h.owned(),null);assert.equal(h.removals.length,0);await assert.rejects(()=>h.importer.importDrawing(h.input),error=>error.code==='ENOENT');});
ref('Synchronous spawn throw has no child and permits owned cleanup',{spawnThrows:true},async h=>{await h.settled();rejected(h);assert.equal(h.children.length,0);assert.match(h.state.error.message,/could not start/);cleanupAfterClose(h);});
ref('Child startup error followed by close in the same dispatch is safely rejected',{},async h=>{h.children[0].emit('error',Error('SYNTHETIC_PRIVATE child startup'));h.children[0].close(null,null);await h.settled();rejected(h);cleanupAfterClose(h);});
ref('Deadline requests termination once and confirmed close permits cleanup',{},async h=>{h.time.advance(TIMEOUT);await h.settled();rejected(h,'DWG conversion exceeded its time limit. The original drawing is unchanged.');assert.equal(h.children[0].kills,1);cleanupAfterClose(h);});
ref('Combined stdout stderr overflow requests termination once without parsing',{},async h=>{h.children[0].stdout.emit('data',Buffer.alloc(32,65));h.children[0].stderr.emit('data',Buffer.alloc(33,66));await h.settled();rejected(h,'DWG converter exceeded its output limit.');assert.equal(h.children[0].kills,1);cleanupAfterClose(h);});
ref('Late close within the explicit grace preserves scratch until observed exit',{kill:'false'},async(h,r)=>{h.time.advance(TIMEOUT);r.afterAbort=await h.snapshot();assert.equal(h.state.status,'pending');assert.equal(h.removals.length,0);h.time.advance(250);assert.equal((await h.snapshot()).scratchExists,true);await h.close(0,0);rejected(h,'DWG conversion exceeded its time limit. The original drawing is unchanged.');cleanupAfterClose(h);});
ref('DXF and metadata children share one output budget',{metadata:true},async h=>{h.children[0].stdout.emit('data',Buffer.alloc(40));await h.output();h.children[0].close(0);await until(()=>h.children.length===2,'metadata child');h.children[1].stdout.emit('data',Buffer.alloc(25));await h.settled();rejected(h,'DWG converter exceeded its output limit.');assert.equal(h.children[1].kills,1);cleanupAfterClose(h);});
ref('Metadata child uses the remaining original deadline',{metadata:true},async h=>{h.time.advance(60);await h.output();h.children[0].close(0);await until(()=>h.children.length===2,'metadata child');h.time.advance(40);await h.settled();rejected(h,'DWG conversion exceeded its time limit. The original drawing is unchanged.');assert.equal(h.children[1].kills,1);cleanupAfterClose(h);});
ref('Benign authored warning stays useful and counted exactly',{},async h=>{h.children[0].stderr.emit('data',Buffer.from('WARNING: Unsupported object ACDBFOO.\n'));await h.output();await h.close();assert.equal(h.state.status,'resolved');assert.deepEqual(plain(h.state.value.importInfo.warnings),['WARNING: Unsupported object ACDBFOO.']);assert.equal(h.state.value.importInfo.converterWarningCount,1);});
ref('Warning list retains the documented cap and total count',{outputLimit:4096},async h=>{h.children[0].stderr.emit('data',Buffer.from(Array.from({length:21},(_,i)=>'WARNING: Unsupported object '+i).join('\n')));await h.output();await h.close();assert.equal(h.state.value.importInfo.warnings.length,20);assert.equal(h.state.value.importInfo.converterWarningCount,21);});
async function outstanding(h,r,{overflow=false,error=false}={}){
  if(error)h.children[0].emit('error',Error('SYNTHETIC_PRIVATE started-child error'));
  else if(overflow)h.children[0].stdout.emit('data',Buffer.alloc(OUTPUT+1));
  else h.time.advance(TIMEOUT);
  // A real event-loop barrier observes any immediate finally cleanup without
  // advancing the virtual watchdog or pretending it is a product settlement.
  for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
  r.afterFailureRequest=await h.snapshot();r.failureRequestedAt=h.time.now();h.time.advance(GRACE-1);
  r.beforeGraceBoundary=await h.snapshot();h.time.advance(1);
  for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
  r.afterGrace=await h.snapshot();r.stage='unconfirmed-exit-cleanup-custody';
  assert.equal(h.removals.length,0,'An unconfirmed child exit must retain its private files');
  assert.equal(r.afterGrace.scratchExists,true,'Pending owned scratch must remain available to the unconfirmed child');
  r.stage='finite-failure-settlement';assert.equal(h.state.status,'rejected','The product must reject within the explicit source grace; fixture teardown is not settlement');
  assert.equal(h.state.settlements,1);assert.equal(h.state.parse,0);assert.equal(h.state.validate,0);
  r.stage='late-close-owned-cleanup';h.children[0].close(0);await until(()=>h.removals.length===1&&h.removals[0].completed,'deferred cleanup after late close');
  assert.equal((await h.snapshot()).scratchExists,false,'Confirmed late close must complete owned cleanup');
  assert.equal(h.state.settlements,1);assert.equal(h.state.parse,0);cleanupAfterClose(h);
}
ref('Timeout kill false with no close has bounded failure and pending cleanup custody',{kill:'false'},(h,r)=>outstanding(h,r));
ref('Timeout kill true with no close has bounded failure and pending cleanup custody',{kill:'no-close'},(h,r)=>outstanding(h,r));
ref('Overflow kill false with no close has bounded failure and pending cleanup custody',{kill:'false'},(h,r)=>outstanding(h,r,{overflow:true}));
ref('Throwing kill cannot delete scratch before child close',{kill:'throw'},(h,r)=>outstanding(h,r));
ref('Started-child error without close cannot delete scratch before exit confirmation',{kill:'no-close'},(h,r)=>outstanding(h,r,{error:true}));
for(const location of ['Q:\\SYNTHETIC_PRIVATE_WINDOWS\\client.dwg','/SYNTHETIC_PRIVATE_POSIX/client.dwg'])ref('Successful warning excludes private path marker '+(location.startsWith('/')?'POSIX':'Windows'),{outputLimit:4096},async(h,r)=>{
  h.children[0].stderr.emit('data',Buffer.from('WARNING: Unsupported object ACDBFOO at '+location+'\n'));await h.output();await h.close();assert.equal(h.state.status,'resolved');
  const serialized=JSON.stringify(h.state.value.importInfo);r.warningHasPrivateMarker=serialized.includes('SYNTHETIC_PRIVATE');r.warningRetainsObject=serialized.includes('ACDBFOO');r.stage='successful-warning-privacy';
  assert.equal(r.warningHasPrivateMarker,false,'Returned import warnings must exclude the private synthetic path');assert.equal(r.warningRetainsObject,true);assert.equal(h.state.value.importInfo.converterWarningCount,1);
});
ref('Synchronous close during timeout kill cannot rearm a grace timer',{kill:'sync-close'},async h=>{h.time.advance(TIMEOUT);await h.settled();rejected(h,'DWG conversion exceeded its time limit. The original drawing is unchanged.');assert.equal(h.children[0].kills,1);assert.equal(h.time.pending,0);cleanupAfterClose(h);});
ref('Started-child error requests termination and honors synchronous close',{kill:'sync-close'},async h=>{h.children[0].emit('error',Error('SYNTHETIC_PRIVATE startup'));await h.settled();rejected(h);assert.equal(h.children[0].kills,1);assert.equal(h.children[0].closed,true);assert.equal(h.time.pending,0);cleanupAfterClose(h);});
ref('Repeated error close and data after successful close cannot resettle or parse again',{},async h=>{await h.output();await h.close();assert.doesNotThrow(()=>{h.children[0].emit('error',Error('SYNTHETIC_PRIVATE late1'));h.children[0].emit('error',Error('SYNTHETIC_PRIVATE late2'));h.children[0].close(7);h.children[0].stdout.emit('data',Buffer.alloc(OUTPUT+1));});assert.equal(h.state.status,'resolved');assert.equal(h.state.settlements,1);assert.equal(h.state.parse,1);assert.equal(h.removals.length,1);assert.equal(h.children[0].kills,0);});
ref('Closed DXF child output cannot poison the metadata budget',{metadata:true},async h=>{await h.output();h.children[0].close(0);await until(()=>h.children.length===2,'metadata child');h.children[0].stdout.emit('data',Buffer.alloc(OUTPUT+1));h.children[1].stdout.emit('data',Buffer.alloc(32));await h.output(1,'SYNTHETIC METADATA');await h.close(1);assert.equal(h.state.status,'resolved');assert.equal(h.state.parse,1);assert.equal(h.children[1].kills,0);cleanupAfterClose(h);});
ref('Metadata timeout retains shared scratch until confirmed late close',{metadata:true,kill:'no-close'},async(h,r)=>{await h.output();h.children[0].close(0);await until(()=>h.children.length===2,'metadata child');assert.equal((await h.snapshot()).scratchExists,true);h.time.advance(TIMEOUT+GRACE);r.afterGrace=await h.snapshot();assert.equal(h.state.status,'rejected');assert.equal(h.removals.length,0);assert.equal(h.children[1].kills,1);h.children[1].close(0);await until(()=>h.removals[0]?.completed,'late metadata cleanup');cleanupAfterClose(h);assert.equal((await h.snapshot()).scratchExists,false);assert.equal(h.state.parse,0);});
ref('Pending termination bounds DWG admission while direct DXF remains available',{kill:'no-close'},async(h,r)=>{h.time.advance(TIMEOUT+GRACE);r.afterGrace=await h.snapshot();assert.equal(h.state.status,'rejected');let secondary='pending';const later=h.track(h.importer.importDrawing(h.input).then(()=>secondary='resolved',()=>secondary='rejected'));await until(()=>secondary!=='pending'||h.children.length>1,'DWG admission result');assert.equal(secondary,'rejected');assert.equal(h.children.length,1);const direct=await h.importer.importDrawing(h.dxf);assert.equal(direct.importInfo.sourceFormat,'DXF');h.children[0].close(0);await until(()=>h.removals[0]?.completed,'release pending custody');await later;let result;const next=h.track(h.importer.importDrawing(h.input).then(value=>result=value));await until(()=>h.children.length===2,'new DWG admitted after late cleanup');await h.output(1);h.children[1].close(0);await next;assert.equal(result.text,TEXT);assert.equal(h.removals.length,2);assert.ok(h.removals.every(row=>row.completed));});
ref('Failed private cleanup is caught once and bounds subsequent DWG admission',{cleanupFails:true},async h=>{await h.output();await h.close();assert.equal(h.state.status,'resolved');assert.equal(h.removals.length,1);assert.equal(h.removals[0].failed,true);assert.deepEqual(h.warnings,['Private import cleanup was skipped.']);let secondary='pending';const later=h.track(h.importer.importDrawing(h.input).then(()=>secondary='resolved',()=>secondary='rejected'));await until(()=>secondary!=='pending'||h.children.length>1,'failed cleanup admission result');assert.equal(secondary,'rejected');assert.equal(h.children.length,1);assert.equal(h.removals.length,1);await later;});
ref('Cleanup directory reparse guard refusal retains bounded admission without deleting scratch',{cleanupRefuses:true},async h=>{await h.output();await h.close();assert.equal(h.state.status,'resolved');assert.equal(h.removals.length,0);assert.equal((await h.snapshot()).scratchExists,true);let secondary='pending';const next=h.track(h.importer.importDrawing(h.input).then(()=>secondary='resolved',()=>secondary='rejected'));await until(()=>secondary!=='pending'||h.children.length>1,'guard refusal admission');assert.equal(secondary,'rejected');assert.equal(h.children.length,1);h.children[0].close(0);assert.equal(h.removals.length,0);await next;});
ref('Repeated failures cannot rearm grace kill or deferred cleanup',{kill:'no-close'},async h=>{h.time.advance(TIMEOUT);assert.doesNotThrow(()=>{h.children[0].emit('error',Error('late1'));h.children[0].emit('error',Error('late2'));h.children[0].stdout.emit('data',Buffer.alloc(OUTPUT+1));});h.time.advance(GRACE);await h.settled();assert.equal(h.state.status,'rejected');assert.equal(h.children[0].kills,1);assert.equal(h.removals.length,0);h.children[0].close(0);h.children[0].close(7);assert.doesNotThrow(()=>h.children[0].emit('error',Error('late3')));await until(()=>h.removals[0]?.completed,'single deferred cleanup');assert.equal(h.removals.length,1);assert.equal(h.state.settlements,1);assert.equal(h.state.parse,0);});
for(const row of [
 ['drive spaces','WARNING: Unsupported object ACDBFOO at Q:\\SYNTHETIC_PRIVATE Client\\drawing name.dwg'],
 ['drive slash','WARNING: Unsupported object ACDBFOO at Q:/SYNTHETIC_PRIVATE Client/drawing name.dwg'],
 ['UNC','WARNING: Unsupported object ACDBFOO at \\\\SYNTHETIC_PRIVATE\\share\\drawing name.dwg'],
 ['extended Windows drive','WARNING: Unsupported object ACDBFOO at \\\\?\\Q:\\SYNTHETIC_PRIVATE\\drawing.dwg'],
 ['quoted POSIX before object','WARNING: file "/SYNTHETIC_PRIVATE Client/drawing name.dwg" Unsupported object ACDBFOO'],
 ['multiple paths','WARNING: Unsupported object ACDBFOO from Q:\\SYNTHETIC_PRIVATE\\one.dwg to /SYNTHETIC_PRIVATE/two.dwg'],
 ['drive relative','WARNING: Unsupported object ACDBFOO at Q:SYNTHETIC_PRIVATE.dwg'],
 ['unmatched quote','WARNING: Unsupported object ACDBFOO at "Q:\\SYNTHETIC_PRIVATE\\drawing name.dwg'],
 ['escaped quotes in path','WARNING: file "/SYNTHETIC_PRIVATE/\\" Unsupported object ACDBSYNTHETIC_PRIVATE \\".dwg"'],
 ['truncation edge','WARNING: Unsupported object ACDBFOO '+ 'X'.repeat(1990)+' at Q:\\SYNTHETIC_PRIVATE\\drawing.dwg']
])ref('Warning path projection: '+row[0],{outputLimit:8192},async(h,r)=>{h.children[0].stderr.emit('data',Buffer.from(row[1]));await h.output();await h.close();assert.equal(h.state.status,'resolved');const warning=h.state.value.importInfo.warnings.join(' ');r.returnedWarning=warning;assert.equal(/[A-Za-z]:[\\/]|[\\/]/.test(warning),false,'No raw path syntax may survive');assert.equal(warning.includes('SYNTHETIC'),false,'No partial private marker may survive');assert.equal(warning.includes('SYNTHETIC_PRIVATE'),false);assert.equal(warning.includes('.dwg'),false);assert.ok(warning.includes('ACDBFOO')||warning==='DWG converter reported a warning. Path details omitted.');assert.ok(warning.length<=2048);assert.equal(h.state.value.importInfo.converterWarningCount,1);});
ref('Benign numeric warning text remains exact',{outputLimit:4096},async h=>{const warning='WARNING: Unsupported object ACDBFOO at ratio 1/2 and time 1:48.';h.children[0].stderr.emit('data',Buffer.from(warning));await h.output();await h.close();assert.deepEqual(plain(h.state.value.importInfo.warnings),[warning]);assert.equal(h.state.value.importInfo.converterWarningCount,1);});
test('Existing main import error boundary is structured and sanitizes internal converter details',async()=>{
  names.push('Existing main import error boundary is structured and sanitizes internal converter details');
  const r={name:names.at(-1),stage:'actual-main-diagnostic-function'};records.push(r);
  try{
  const source=await fs.readFile(path.join(root,'desktop/main.cjs'),'utf8'),start=source.indexOf('const FILE_FAILURES ='),end=source.indexOf('\nasync function fileOperation(',start);assert.ok(start>=0&&end>start);
  const fileFailure=vm.runInNewContext(source.slice(start,end)+'\nfileFailure',{Object,Set},{timeout:1000});
  for(const code of [undefined,'ENOENT','SYNTHETIC_PRIVATE_CODE']){
    const error=Object.assign(Error('SYNTHETIC_PRIVATE path drawing-payload stack'),code?{code}:{}),reply=plain(fileFailure(error,'import','import'));
    assert.deepEqual(reply,{ok:false,error:'Could not import the drawing. Review the source drawing or choose another supported file.',code:'FILE_IMPORT_FAILED',operation:'import',nextStep:'Review the source drawing or choose another supported file.',diagnostic:code==='ENOENT'?{stage:'import',systemCode:'ENOENT'}:{stage:'import'}});
  }
  r.outcome='pass';
  }catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,code:error.code??null};throw error;}finally{r.completed=true;}
});
test('Converter lifecycle reference inventory accounts for all named cases',()=>{assert.equal(names.length,47);assert.equal(records.length,47);assert.ok(records.every(r=>r.completed));assert.equal(records.filter(r=>r.outcome==='unexpected-error').length,0);});
test.after(async()=>{if(process.env.LINECRAFT_CONVERTER_REFERENCE_REPORT){
  const target=process.env.LINECRAFT_CONVERTER_REFERENCE_REPORT;assert.ok(path.isAbsolute(target));
  await fs.writeFile(target,JSON.stringify({format:'LinecraftConverterLifecycleReference/1',names,records,sourceSHA256:{importer:hash(await fs.readFile(path.join(root,'desktop/import-files.cjs'))),main:hash(await fs.readFile(path.join(root,'desktop/main.cjs')))},contract:{timeoutVirtualMs:TIMEOUT,terminationGraceVirtualMs:GRACE,combinedOutputBytes:OUTPUT},limits:'Exact importer module source under VM Date/timers, injected fake children and real owned synthetic filesystem. Parser/validator are canned; main error function is verbatim source extraction, not IPC. Grace is an explicit prospective source contract, not current behavior or measured wall time. Fixture teardown closes are separately recorded and cannot qualify product settlement. No real converter/process-tree/orphan, native app, renderer adoption, OS restart/storage durability or binary-version recognition claim.'},null,2)+'\n',{flag:'wx'});
}});
