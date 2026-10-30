'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {host,A,B,C,marker,hash,directories,hosts,deferred}=require('./development-state-host.cjs');
const records=[],expected=[],boundaries=[];
const seed=h=>h.update({dirty:true,name:'Synthetic A',text:C});
function ref(name,run){expected.push(name);test(name,{timeout:10000},async()=>{await run();records.push(name);});}
async function capture(name,h){boundaries.push({name,directory:h.directory,association:h.snapshot(),checkpoint:await fs.readFile(h.checkpoint,'utf8'),trace:structuredClone(h.trace)});}
async function unchangedFiles(h){assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),B);assert.equal(await fs.readFile(h.sentinel,'utf8'),marker);}
async function authorize(h){h.choices.confirm.push({response:1});assert.equal(await h.invoke('linecraft:confirm-discard','Synthetic A'),'discard');assert.equal(h.snapshot().authorized,true);}
const faults=['mkdir','open','write','sync','close','rename','cleanup'];
for(const phase of faults)ref('Ordinary Save As accepts native write despite best-effort checkpoint '+phase,async()=>{
  const h=await host();seed(h);const prior=await fs.readFile(h.checkpoint,'utf8');h.setPhase(phase);
  h.choices.save.push({canceled:false,filePath:h.b});const response=await h.invoke('linecraft:save',C,true);
  assert.deepEqual(response,{ok:true,name:'B.linecraft'});
  assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),C);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),prior);assert.equal(await fs.readFile(h.sentinel,'utf8'),marker);
  assert.deepEqual(h.snapshot(),{drawingPath:h.b,importSaveName:null,dirty:false,name:'B.linecraft',text:C,authorization:null,authorized:false,busy:false});
  assert.ok(h.warnings.some(args=>String(args[0]).includes('Could not checkpoint')));
  if(phase==='cleanup')assert.ok((await fs.readdir(h.profile)).some(name=>name.endsWith('.tmp')));
});
for(const phase of ['mkdir','write','rename'])ref('Ordinary Open adopts validated native drawing despite checkpoint '+phase,async()=>{
  const h=await host();seed(h);h.setPhase(phase);h.choices.open.push({canceled:false,filePaths:[h.b]});
  assert.deepEqual(await h.invoke('linecraft:open'),{ok:true,text:B,name:'B.linecraft'});
  assert.equal(h.snapshot().drawingPath,h.b);assert.equal(h.snapshot().dirty,false);assert.equal(h.snapshot().text,B);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association());await unchangedFiles(h);
});
for(const phase of faults)ref('Strict queued adoption preserves current state on first checkpoint '+phase,async()=>{
  const h=await host();seed(h);await authorize(h);const id=await h.queue(),before=h.snapshot(),title=h.title;
  h.setPhase(phase);const response=await h.invoke('linecraft:open-request',{action:'commit',id});
  assert.equal(response.ok,false);assert.match(response.error,/association could not be saved.*unchanged/i);
  assert.deepEqual(h.snapshot(),before);assert.equal(h.title,title);await unchangedFiles(h);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association());
  assert.equal((await h.invoke('linecraft:open-request',{action:'peek'})).request.id,id);
  h.setPhase(null);assert.deepEqual(await h.invoke('linecraft:open-request',{action:'commit',id}),{ok:true,id,name:'B.linecraft'});
  assert.equal(h.snapshot().drawingPath,h.b);assert.equal(h.snapshot().text,B);assert.equal(h.snapshot().authorized,false);
  assert.equal((await h.invoke('linecraft:open-request',{action:'peek'})).request,null);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association(h.b));await unchangedFiles(h);
});
ref('Dirty queued adoption without authorization is rejected before persistence',async()=>{
  const h=await host();seed(h);const id=await h.queue(),before=h.snapshot();
  const response=await h.invoke('linecraft:open-request',{action:'commit',id});assert.equal(response.ok,false);
  assert.match(response.error,/Save or explicitly discard/);assert.deepEqual(h.snapshot(),before);assert.equal(h.trace.length,0);await unchangedFiles(h);
});
ref('Clean queued adoption does not require discard authorization',async()=>{
  const h=await host();h.update({dirty:false,name:'Synthetic A',text:A});const id=await h.queue();assert.equal(h.snapshot().authorized,false);
  assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id})).ok,true);assert.equal(h.snapshot().drawingPath,h.b);
  assert.equal(h.snapshot().dirty,false);assert.equal(h.snapshot().text,B);await unchangedFiles(h);
});
ref('Identical trusted state retains exact authorization; successful queued adoption consumes it',async()=>{
  const h=await host();seed(h);await authorize(h);const before=h.snapshot();seed(h);assert.deepEqual(h.snapshot(),before);
  h.invalidUpdate({dirty:true,name:'Untrusted',text:B});assert.deepEqual(h.snapshot(),before);
  h.update({dirty:'invalid',name:'Invalid',text:B});assert.deepEqual(h.snapshot(),before);
  assert.equal(await h.untrustedConfirm(),'cancel');assert.deepEqual(h.snapshot(),before);
  const id=await h.queue();assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id})).ok,true);
  assert.equal(h.snapshot().authorization,null);assert.equal(h.snapshot().drawingPath,h.b);await unchangedFiles(h);
});
for(const field of ['text','name','dirty'])ref('Changed '+field+' invalidates authorization permanently until another confirmation',async()=>{
  const h=await host();seed(h);await authorize(h);const changed={dirty:true,name:'Synthetic A',text:C};
  changed[field]=field==='text'?B:field==='name'?'Changed synthetic name':false;h.update(changed);assert.equal(h.snapshot().authorization,null);
  seed(h);assert.equal(h.snapshot().authorization,null);const id=await h.queue();
  assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id})).ok,false);await unchangedFiles(h);
});
for(const [kind,choice,decision] of [['save',{response:0},'save'],['cancel',{response:2},'cancel'],['unknown',{response:99},'cancel'],['reject',Error('Synthetic chooser rejection'),'cancel']])ref('Confirmation '+kind+' clears old authorization and grants none',async()=>{
  const h=await host();seed(h);await authorize(h);h.choices.confirm.push(choice);
  assert.equal(await h.invoke('linecraft:confirm-discard','Synthetic A'),decision);assert.equal(h.snapshot().authorization,null);
  assert.equal(await h.untrustedConfirm(),'cancel');assert.equal(h.snapshot().authorization,null);await unchangedFiles(h);
});
ref('Late edit during confirmation returns Discard but cannot authorize dirty queued adoption',async()=>{
  const h=await host();seed(h);const held=deferred();h.choices.confirm.push(()=>held.promise);
  const pending=h.invoke('linecraft:confirm-discard','Synthetic A');h.update({dirty:true,name:'Later edit',text:B});held.resolve({response:1});
  assert.equal(await pending,'discard');assert.equal(h.snapshot().authorized,false);const before=h.snapshot(),id=await h.queue();
  assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id})).ok,false);assert.deepEqual(h.snapshot(),before);await unchangedFiles(h);
});
ref('Queue cancellation clears authorization and removes only the pending request',async()=>{
  const h=await host();seed(h);await authorize(h);const id=await h.queue();h.enqueue(h.a);
  assert.deepEqual(await h.invoke('linecraft:open-request',{action:'cancel',id}),{ok:true});assert.equal(h.snapshot().authorization,null);
  const next=(await h.invoke('linecraft:open-request',{action:'peek'})).request;assert.equal(next.name,'A.linecraft');assert.notEqual(next.id,id);assert.equal(h.snapshot().dirty,true);await unchangedFiles(h);
});
ref('Late state during strict checkpoint persistence is preserved and checkpoint compensation restores A',async()=>{
  const h=await host();seed(h);await authorize(h);const id=await h.queue(),held=h.holdCheckpoint();
  const pending=h.invoke('linecraft:open-request',{action:'commit',id});await held.entered.promise;
  h.update({dirty:true,name:'Later accepted notification',text:B});const newer=h.snapshot();held.release.resolve();
  const response=await pending;assert.equal(response.ok,false);assert.match(response.error,/current drawing changed/i);
  assert.deepEqual(h.snapshot(),{...newer,busy:false});assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association());
  assert.equal(h.trace.filter(row=>row.operation==='rename'&&row.scoped).length,2);await unchangedFiles(h);
  assert.equal((await h.invoke('linecraft:open-request',{action:'peek'})).request.id,id);await capture('successful compensation immediate state',h);
  h.setPhase(null);await authorize(h);assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id})).ok,true);
  assert.equal((await h.invoke('linecraft:open-request',{action:'peek'})).request,null);
});
ref('A second checkpoint failure is characterized independently from live association preservation',async()=>{
  const h=await host();seed(h);await authorize(h);const id=await h.queue();h.setPhase('compensation');const held=h.holdCheckpoint();
  const pending=h.invoke('linecraft:open-request',{action:'commit',id});await held.entered.promise;
  h.update({dirty:true,name:'Later accepted notification',text:B});const newer=h.snapshot();held.release.resolve();
  const response=await pending;assert.equal(response.ok,false);assert.deepEqual(h.snapshot(),{...newer,busy:false});
  // Observation/control, not an assertion that two independent writes are atomic together.
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association(h.b));
  assert.equal((await h.invoke('linecraft:open-request',{action:'peek'})).request.id,id);await unchangedFiles(h);
  await capture('failed compensation immediate state',h);h.setPhase(null);await authorize(h);
  assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id})).ok,true);
  assert.equal((await h.invoke('linecraft:open-request',{action:'peek'})).request,null);
});
ref('Accepted Save before a canceled Open preserves its new native and checkpoint baselines',async()=>{
  const h=await host();seed(h);await authorize(h);h.choices.save.push({canceled:false,filePath:h.b});
  assert.equal((await h.invoke('linecraft:save',C,true)).ok,true);const before=h.snapshot();assert.equal(before.authorization,null);
  h.choices.open.push({canceled:true,filePaths:[]});assert.deepEqual(await h.invoke('linecraft:open'),{ok:false,canceled:true});
  assert.deepEqual(h.snapshot(),before);assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),C);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association(h.b));
});
for(const record of ['valid','absent','malformed','wrong-format','relative','missing-target','directory','invalid-target','import-name'])ref('Development restore is read-only and association-only: '+record,async()=>{
  const h=await host({record});const state=h.snapshot();assert.equal(state.drawingPath,record==='valid'?h.a:null);
  assert.equal(state.importSaveName,record==='import-name'?'Imported.linecraft':null);
  assert.equal(state.text,'');assert.equal(state.name,'Untitled drawing');assert.equal(state.dirty,false);assert.equal(state.authorization,null);
  assert.equal(h.trace.length,0);assert.equal(await fs.readFile(h.sentinel,'utf8'),marker);
  assert.equal(await fs.readFile(h.a,'utf8'),h.beforeStartup.nativeA);assert.equal(await fs.readFile(h.b,'utf8'),h.beforeStartup.nativeB);
  if(h.beforeStartup.checkpoint===null)await assert.rejects(fs.readFile(h.checkpoint),error=>error.code==='ENOENT');
  else assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.beforeStartup.checkpoint);
});
ref('Packaged control skips development association restore and persistence',async()=>{
  const h=await host({packaged:true});assert.equal(h.snapshot().drawingPath,null);h.choices.save.push({canceled:false,filePath:h.b});
  assert.equal((await h.invoke('linecraft:save',C,true)).ok,true);assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association());
  assert.equal(h.trace.some(row=>row.scoped||row.operation==='mkdir'),false);
});
test('development reference case inventory is complete',()=>{assert.equal(expected.length,42);assert.equal(records.length,42);assert.deepEqual(records.sort(),[...expected].sort());});
test.after(async()=>{const filename=process.env.LINECRAFT_DEVELOPMENT_STATE_REPORT;if(filename){assert.ok(path.isAbsolute(filename));const observations=await Promise.all(hosts.map(async(h,index)=>({name:expected[index],directory:h.directory,association:h.snapshot(),trace:h.trace,warnings:h.warnings,checkpoint:await fs.readFile(h.checkpoint,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;}),nativeA_SHA256:hash(await fs.readFile(h.a)),nativeB_SHA256:hash(await fs.readFile(h.b))})));await fs.writeFile(filename,JSON.stringify({format:'LinecraftDevelopmentStateReference/1',expected,records,directories,observations,boundaries,mainSHA256:hash(await fs.readFile(path.join(__dirname,'../desktop/main.cjs'))),limits:'Actual main+queue+core validation under fake Electron, owned profile/files; watcher disabled, no application/native/converter. Restore is association-only. Injected late notifications are artificial source boundaries; renderer history/input gating/recovery storage not qualified. Compensating failure leaves independently recorded stale checkpoint; no two-session or drawing-loss claim.'},null,2)+'\n',{flag:'wx'});}});
