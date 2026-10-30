'use strict';
// Explicit pre-implementation contract; excluded from the passing profile.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {host,A,B,C,hash}=require('./development-state-host.cjs');
const cases=[],records=[],oldBinding='11111111-1111-4111-8111-111111111111';
const isBinding=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function ref(name,run){cases.push(name);test(name,{timeout:10000},async()=>{const record={name};records.push(record);await run(record);});}
async function nativeBytes(h){return {A:await fs.readFile(h.a,'utf8'),B:await fs.readFile(h.b,'utf8'),checkpoint:await fs.readFile(h.checkpoint,'utf8')};}
async function safeFallback(record,h,description){
  const before=await nativeBytes(h),state=h.snapshot(),dialogs=h.dialogCalls.save;
  h.protectOriginalA();h.protectOriginalB();const response=await h.invoke('linecraft:save',C,false),after=await nativeBytes(h);
  assert.deepEqual(after,before);assert.deepEqual(h.snapshot(),state);
  record.directory=h.directory;record.before={state,files:before};record.after={state:h.snapshot(),files:after,response,chooserCalls:h.dialogCalls.save-dialogs,blockedCount:h.blockedNativeWrites.length};record.executed=true;
  assert.equal(record.after.blockedCount,0,description+' must not attempt an unverified native target.');
  assert.deepEqual(response,{ok:false,canceled:true});assert.equal(record.after.chooserCalls,1);
}
ref('PENDING cold legacy association cannot be used before any renderer reconciliation',async record=>{const h=await host();await safeFallback(record,h,'Save before synchronization');});
const announcements=[['missing',undefined],['null',null],['malformed token',{version:1,binding:'not-a-uuid'}],['wrong version',{version:2,binding:oldBinding}],['unknown binding',{version:1,binding:oldBinding}],['path-shaped token',{version:1,binding:'SYNTHETIC_NOT_A_PATH_AUTHORITY'}]];
for(const [kind,announcement]of announcements)ref('PENDING legacy recovery '+kind+' cannot authorize native target reuse',async record=>{
  const h=await host();const state={dirty:true,name:'Synthetic recovered B',text:C};if(announcement!==undefined)state.developmentRecovery=announcement;
  h.update(state);assert.equal(h.snapshot().text,C);assert.equal(h.snapshot().name,'Synthetic recovered B');assert.equal(h.snapshot().dirty,true);await safeFallback(record,h,kind+' recovery announcement');
});
ref('PENDING first notification in a new renderer frame cannot inherit a live native target',async record=>{
  const h=await host();h.choices.save.push({canceled:false,filePath:h.b});assert.equal((await h.invoke('linecraft:save',C,true)).ok,true);
  h.rendererReload();await safeFallback(record,h,'New frame before reconciliation');
});
ref('PENDING accepted Save As returns an opaque development binding even if auxiliary persistence fails',async record=>{
  const h=await host();h.setPhase('write');h.choices.save.push({canceled:false,filePath:h.b});const response=await h.invoke('linecraft:save',C,true);
  assert.equal(response.ok,true);assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),C);assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association());
  record.directory=h.directory;record.response=response;record.after=await nativeBytes(h);record.executed=true;
  assert.equal(isBinding(response.developmentBinding),true,'Accepted target requires a new opaque generation even when its auxiliary checkpoint fails.');
});
ref('PENDING accepted native Open returns a development binding before renderer adoption',async record=>{
  const h=await host();h.choices.open.push({canceled:false,filePaths:[h.b]});const response=await h.invoke('linecraft:open');
  assert.equal(response.ok,true);assert.equal(response.text,B);assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),B);
  record.directory=h.directory;record.response=response;record.executed=true;assert.equal(isBinding(response.developmentBinding),true);
});
ref('Routine old-generation notification during awaited Save As preserves the accepted live target',async record=>{
  const h=await host();const held=h.holdCheckpoint();h.choices.save.push({canceled:false,filePath:h.b});const pending=h.invoke('linecraft:save',C,true);await held.entered.promise;
  h.update({dirty:true,name:'Older notification',text:A,developmentBinding:oldBinding});held.release.resolve();const response=await pending;
  assert.equal(response.ok,true);assert.equal(h.snapshot().drawingPath,h.b);assert.equal(h.snapshot().text,C);assert.equal(h.snapshot().dirty,false);
  assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),C);record.directory=h.directory;record.response=response;record.after=h.snapshot();record.executed=true;
});
ref('Packaged Save reply and native bytes retain the established exact contract',async record=>{
  const h=await host({packaged:true});h.choices.save.push({canceled:false,filePath:h.b});const response=await h.invoke('linecraft:save',C,true);
  assert.deepEqual(response,{ok:true,name:'B.linecraft'});assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),C);
  record.directory=h.directory;record.response=response;record.executed=true;
});
ref('PENDING reset followed by failed persistence cannot restore native routing to new work',async record=>{
  const h=await host();h.setPhase('write');const reset=await h.invoke('linecraft:reset-path');assert.equal(reset.ok,true);if(Object.hasOwn(reset,'developmentBinding'))assert.equal(reset.developmentBinding,null);record.resetReply=reset;assert.equal(h.snapshot().drawingPath,null);
  assert.equal(await fs.readFile(h.checkpoint,'utf8'),h.association());const fresh=await host({restartOf:h});await safeFallback(record,fresh,'Reset recovery before synchronization');
});
test('identity boundary inventory executes all thirteen cases',()=>{assert.equal(cases.length,13);assert.equal(records.length,13);assert.ok(records.every(row=>row.executed));});
test.after(async()=>{const filename=process.env.LINECRAFT_IDENTITY_CONTRACT_REPORT;if(filename){assert.ok(path.isAbsolute(filename));await fs.writeFile(filename,JSON.stringify({format:'LinecraftDevelopmentIdentityContract/1',cases,records,mainSHA256:hash(await fs.readFile(path.join(__dirname,'../desktop/main.cjs'))),limits:'Actual main/queue/core under fake Electron and owned files. New recovery field/generation contract is not implemented. Negative legacy/frame/reset routing probes stop before native temporary creation. Binding allocation assertions are metadata prerequisites; downstream positive-generation lifecycle branches are not yet exercised. No product fix, real transport, renderer startup or native restart.'},null,2)+'\n',{flag:'wx'});}});
