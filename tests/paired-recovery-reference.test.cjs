'use strict';
// Explicit pending safety reference. Not selected by the passing fast profile.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {host,A,B,hash}=require('./development-state-host.cjs');
const root=path.resolve(__dirname,'..'),records=[],names=[];let source,chunks,core;
const plain=value=>JSON.parse(JSON.stringify(value));
function extract(start,end){assert.equal(source.split(start).length-1,1);assert.equal(source.split(end).length-1,1);const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
async function renderer(h,{retainedStorage=null,kind='draft'}={}){
  source??=await fs.readFile(path.join(root,'app.mjs'),'utf8');core??=await import(pathToFileURL(path.join(root,'core.mjs')).href);
  chunks??={helpers:extract('function canonicalContent(value) {','\nsavedFingerprint=documentFingerprint();'),recovery:extract('const developmentState={restored:false','function scheduleDevelopmentCheckpoint() {'),save:extract('function safeName() {','async function canDiscard() {')};
  const initial=core.createEditor(kind==='A'?JSON.parse(A):{entities:[{id:'old',type:'LINE',layer:'0',start:{x:1,y:2},end:{x:11,y:2}},{id:'marker',type:'CIRCLE',layer:'0',center:{x:100,y:100},radius:4}]});
  const baseline=initial.serialize();
  if(kind!=='A'){assert.equal(initial.setCircleRadius('marker',5).ok,true);assert.equal(initial.setCircleRadius('marker',6).ok,true);assert.equal(initial.undo().ok,true);assert.equal(initial.select(['old']).ok,true);}
  const local=new Map(retainedStorage??[]),session=new Map(),logs=[];let api;
  const storage=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)});
  const desktop={saveDrawing:(text,saveAs)=>h.invoke('linecraft:save',text,saveAs),setDocumentState:value=>h.update(plain(value))};
  const setup=`let editor=initialEditor,documentName='A.linecraft',savedFingerprint='',importedAwaitingSave=false;
    let gridEnabled=true,snapEnabled=true,orthoEnabled=false;
    const developmentMode=true,closingApplication=false,state=()=>editor.state;`;
  const finish=`({save,persistDevelopmentCheckpoint,syncDesktop,editor:()=>editor,
    snapshot:()=>({text:serializedDrawing(),name:documentName,fingerprint:documentFingerprint(),savedFingerprint,imported:importedAwaitingSave,dirty:isDirty(),selection:[...state().selectionIds],canUndo:editor.canUndo,canRedo:editor.canRedo,development:{...developmentState}})})`;
  const sandbox={JSON,structuredClone,initialEditor:initial,desktop,createEditor:core.createEditor,localStorage:storage(local),sessionStorage:storage(session),console:{warn:(...args)=>logs.push(args)},update:()=>api.syncDesktop(),toast:()=>{},addLog:(...args)=>logs.push(args),download:()=>{throw Error('No browser download.');}};
  api=vm.runInNewContext(setup+chunks.helpers+'\nsavedFingerprint=contentFingerprint(JSON.parse(initialBaseline));\n'+chunks.recovery+chunks.save+finish,{...sandbox,initialBaseline:baseline},{filename:'paired-recovery-source.vm.js',timeout:1000});
  // Actual startup's synchronization projection; no DOM painting or preload transport.
  api.syncDesktop();return {api,initial,local,logs,snapshot:()=>plain(api.snapshot())};
}
function ref(name,run){names.push(name);test(name,{timeout:10000},async()=>{const record={name};records.push(record);await run(record);});}
async function bytes(h,target){return {A:await fs.readFile(h.a,'utf8'),accepted:await fs.readFile(target,'utf8'),B:await fs.readFile(h.b,'utf8'),checkpoint:await fs.readFile(h.checkpoint,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;})};}
function literalDraft(text){const d=JSON.parse(text);assert.deepEqual(d.entities,[{id:'old',type:'LINE',layer:'0',start:{x:1,y:2},end:{x:11,y:2}},{id:'marker',type:'CIRCLE',layer:'0',center:{x:100,y:100},radius:5}]);}
async function accepted({fault=null,sameBasename=false,kind='draft'}={}){
  const h=await host(),r=await renderer(h,{kind});let target=h.b;
  if(sameBasename){await fs.mkdir(path.join(h.directory,'accepted'));target=path.join(h.directory,'accepted','A.linecraft');}
  const before=r.snapshot();assert.equal(before.canUndo,kind!=='A');assert.equal(before.canRedo,kind!=='A');assert.deepEqual(before.selection,kind==='A'?[]:['old']);
  if(fault)h.setPhase(fault);h.choices.save.push({canceled:false,filePath:target});
  assert.equal(await r.api.save(true),true);const saved=r.snapshot();
  if(kind==='A')assert.deepEqual(JSON.parse(saved.text).entities,JSON.parse(A).entities);else literalDraft(saved.text);
  assert.equal(r.api.editor(),r.initial);assert.equal(saved.text,before.text);assert.deepEqual(saved.selection,before.selection);
  assert.equal(saved.canUndo,kind!=='A');assert.equal(saved.canRedo,kind!=='A');assert.equal(saved.dirty,false);assert.equal(saved.imported,false);assert.equal(saved.savedFingerprint,before.fingerprint);
  assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(target,'utf8'),saved.text);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association(fault?h.a:target));
  if(kind!=='A'){
    const radius=()=>JSON.parse(r.initial.serialize()).entities.find(entity=>entity.id==='marker').radius;
    assert.equal(r.initial.redo().ok,true);assert.equal(radius(),6);
    assert.equal(r.initial.undo().ok,true);assert.equal(radius(),5);
    assert.equal(r.initial.undo().ok,true);assert.equal(radius(),4);
    assert.equal(r.initial.redo().ok,true);assert.equal(radius(),5);assert.equal(r.initial.select(['old']).ok,true);
  }
  assert.equal(r.initial.serialize(),saved.text);assert.equal(r.snapshot().dirty,false);
  const checkpoint=r.api.persistDevelopmentCheckpoint(false);assert.equal(typeof checkpoint,'string');assert.equal(JSON.parse(checkpoint).savedFingerprint,saved.savedFingerprint);
  assert.equal(h.snapshot().busy,false);return {h,r,target,saved,checkpoint,kind};
}
async function recovered(first,{reloadOnly=false}={}){
  const before=await bytes(first.h,first.target),h=reloadOnly?first.h:await host({restartOf:first.h});
  h.setPhase(null);const r=await renderer(h,{retainedStorage:[...first.r.local]});const state=r.snapshot();
  assert.equal(state.development.restored,true);assert.equal(state.development.historyReset,true);assert.equal(state.dirty,false);
  assert.equal(state.savedFingerprint,first.saved.savedFingerprint);assert.equal(state.name,first.saved.name);assert.equal(state.imported,false);
  if(first.kind==='A')assert.deepEqual(JSON.parse(state.text).entities,JSON.parse(A).entities);else literalDraft(state.text);
  assert.deepEqual(state.selection,[]);assert.equal(state.canUndo,false);assert.equal(state.canRedo,false);
  assert.deepEqual(await bytes(h,first.target),before);return {h,r,before,state};
}
function freshHistory(r){assert.equal(r.api.editor().setCircleRadius('marker',7).ok,true);assert.equal(r.api.editor().undo().ok,true);literalDraft(r.snapshot().text);assert.equal(r.snapshot().dirty,false);}
function safeOutcome(record,target){
  const outcome=record.afterSave;
  assert.equal(outcome.blockedWrites.length,0,'Recovered content must not attempt a write to unrelated A.');
  if(outcome.saved){assert.ok(outcome.host.drawingPath===target,'A successful Save must use the independently intended target.');}
  else{assert.equal(outcome.chooserCalls,1,'A refused Save requires the explicit safe chooser fallback.');assert.equal(outcome.renderer.text,record.beforeSave.renderer.text);assert.equal(outcome.renderer.savedFingerprint,record.beforeSave.renderer.savedFingerprint);}
}
async function probe(record,first,options={}){
  const second=await recovered(first,options),{h,r}=second;
  record.directory=h.directory;record.firstSaved=first.saved;record.beforeSave={host:h.snapshot(),renderer:second.state,files:second.before};
  h.protectOriginalA();const dialogs=h.dialogCalls.save;const saved=await r.api.save();
  const after=await bytes(h,first.target);assert.equal(after.A,A);assert.equal(after.accepted,second.before.accepted);
  assert.equal(r.snapshot().savedFingerprint,first.saved.savedFingerprint);freshHistory(r);
  record.afterSave={host:h.snapshot(),renderer:r.snapshot(),files:after,saved,chooserCalls:h.dialogCalls.save-dialogs,blockedWrites:plain(h.blockedNativeWrites),trace:plain(h.trace)};record.executed=true;
  return second;
}
ref('Healthy accepted Save As and full source reconstruction route normal Save to B',async record=>{
  const first=await accepted();const {h}=await probe(record,first);assert.equal(h.snapshot().drawingPath,first.target);assert.equal(record.afterSave.saved,true);assert.equal(record.afterSave.chooserCalls,0);assert.equal(record.afterSave.blockedWrites.length,0);
});
ref('Legacy matching A instrumentation permits its baseline barrier or a safe chooser fallback',async record=>{
  const h1=await host(),r1=await renderer(h1,{kind:'A'});assert.equal(typeof r1.api.persistDevelopmentCheckpoint(false),'string');
  const h2=await host({restartOf:h1}),r2=await renderer(h2,{retainedStorage:[...r1.local],kind:'A'});assert.equal(r2.snapshot().development.restored,true);assert.equal(r2.snapshot().dirty,false);
  h2.protectOriginalA();assert.equal(await r2.api.save(),false);
  if(h2.blockedNativeWrites.length){assert.equal(h2.blockedNativeWrites.length,1);assert.ok(h2.blockedNativeWrites[0].target===h2.a);assert.equal(h2.dialogCalls.save,0);}
  else assert.equal(h2.dialogCalls.save,1);
  assert.equal(await fs.readFile(h2.a,'utf8'),A);assert.equal(await fs.readFile(h2.b,'utf8'),B);record.directory=h2.directory;record.afterSave={host:h2.snapshot(),renderer:r2.snapshot(),blockedWrites:plain(h2.blockedNativeWrites)};record.executed=true;
});
ref('Renderer-only reload retains the live B association after a checkpoint failure',async record=>{
  const first=await accepted({fault:'write'});const {h}=await probe(record,first,{reloadOnly:true});assert.equal(h.snapshot().drawingPath,first.target);assert.equal(record.afterSave.saved,true);assert.equal(record.afterSave.blockedWrites.length,0);
});
for(const kind of ['missing','invalid'])ref('Recovered content with '+kind+' host checkpoint uses canceled Save As safely',async record=>{
  const first=await accepted();await fs.rename(first.h.checkpoint,path.join(first.h.profile,'preserved-checkpoint-before-'+kind+'.json'));
  if(kind==='invalid')await fs.writeFile(first.h.checkpoint,'{invalid synthetic checkpoint');
  const {h}=await probe(record,first);assert.equal(h.snapshot().drawingPath,null);assert.equal(record.afterSave.saved,false);assert.equal(record.afterSave.chooserCalls,1);assert.equal(record.afterSave.blockedWrites.length,0);
});
for(const fault of ['write','rename'])ref('PENDING no unrelated A write after accepted Save As with checkpoint '+fault+' failure',async record=>{
  const first=await accepted({fault});await probe(record,first);
  safeOutcome(record,first.target);
});
ref('PENDING same basename in different directories cannot justify the stale A target',async record=>{
  const first=await accepted({fault:'write',sameBasename:true});await probe(record,first);
  assert.equal(path.basename(first.h.a),path.basename(first.target));assert.notEqual(path.dirname(first.h.a),path.dirname(first.target));
  safeOutcome(record,first.target);
});
ref('PENDING identical basename and baseline cannot authorize A after recovery and a new edit',async record=>{
  const first=await accepted({fault:'write',sameBasename:true,kind:'A'}),second=await recovered(first),{h,r}=second;
  assert.equal(path.basename(first.target),path.basename(h.a));assert.deepEqual(JSON.parse(first.saved.text).entities,JSON.parse(A).entities);
  assert.equal(r.api.editor().importJSON(JSON.parse(B)).ok,true);r.api.syncDesktop();assert.equal(r.snapshot().dirty,true);const submitted=r.snapshot();
  const hostBefore=h.snapshot();h.protectOriginalA();const dialogs=h.dialogCalls.save;const saved=await r.api.save();const after=await bytes(h,first.target);
  assert.equal(after.A,A);assert.equal(after.accepted,saved?submitted.text:second.before.accepted);
  assert.equal(r.snapshot().savedFingerprint,saved?submitted.fingerprint:first.saved.savedFingerprint);
  assert.equal(r.api.editor().undo().ok,true);assert.deepEqual(JSON.parse(r.snapshot().text).entities,JSON.parse(A).entities);
  assert.equal(r.api.editor().redo().ok,true);assert.deepEqual(JSON.parse(r.snapshot().text).entities,JSON.parse(B).entities);
  record.directory=h.directory;record.firstSaved=first.saved;record.beforeSave={host:hostBefore,renderer:submitted,files:second.before};
  record.afterSave={host:h.snapshot(),renderer:r.snapshot(),files:after,saved,chooserCalls:h.dialogCalls.save-dialogs,blockedWrites:plain(h.blockedNativeWrites),trace:plain(h.trace)};record.executed=true;
  safeOutcome(record,first.target);
});
test('paired recovery inventory executed all nine scenarios',()=>{assert.equal(names.length,9);assert.equal(records.length,9);assert.ok(records.every(row=>row.executed));});
test.after(async()=>{const filename=process.env.LINECRAFT_PAIRED_RECOVERY_REPORT;if(filename){assert.ok(path.isAbsolute(filename));await fs.writeFile(filename,JSON.stringify({format:'LinecraftPairedRecoveryReference/1',mainSHA256:hash(await fs.readFile(path.join(root,'desktop/main.cjs'))),appSHA256:hash(source),slices:Object.fromEntries(Object.entries(chunks).map(([key,value])=>[key,{sha256:hash(value),bytes:Buffer.byteLength(value)}])),names,records,limits:'Fresh actual-main modules over same owned fixture token; verbatim renderer recovery/persist/fingerprint/Save/sync functions with real core. localStorage carryover is modeled in Maps, sessionStorage starts empty; startup UI update is a synchronization projection. Source A protected before temporary file creation; no wrong-target overwrite is executed. No real Electron/storage/OS restart/transport/native/client claim.'},null,2)+'\n',{flag:'wx'});}});
