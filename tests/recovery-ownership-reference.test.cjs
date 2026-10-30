'use strict';
// Explicit pending contract: actual main with owned files, plus renderer source VM.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const {host,A,B,C}=require('./development-state-host.cjs');
const root=path.resolve(__dirname,'..'),channel='linecraft:development-recovery';
const names=[],records=[],plain=x=>JSON.parse(JSON.stringify(x));
const sha=x=>createHash('sha256').update(x).digest('hex');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function flush(){for(let i=0;i<20;i++)await Promise.resolve();}
function ref(name,run){names.push(name);test(name,{timeout:10000},async()=>{
  const r={name,stage:'source-execution'};records.push(r);
  try{await run(r);r.outcome='pass';}catch(error){r.outcome=error.name==='AssertionError'?'fail':'unexpected-error';r.error={name:error.name,message:error.message};throw error;}
  finally{r.completed=true;}
});}
async function bytes(h){return{A:await fs.readFile(h.a,'utf8'),B:await fs.readFile(h.b,'utf8'),checkpoint:await fs.readFile(h.checkpoint,'utf8')};}
async function allocate(h,r,text=A,target=h.a){
  h.choices.save.push({canceled:false,filePath:target});const reply=await h.invoke('linecraft:save',text,true);
  assert.equal(reply.ok,true);r.directory=h.directory;r.stage='main-binding-prerequisite';r.allocationReply=plain(reply);
  assert.equal(uuid(reply.developmentBinding),true,'Consume only a UUID from the actual successful native reply');
  return reply.developmentBinding;
}
async function offer(h,r){
  r.stage='main-protocol-prerequisite';assert.equal(h.hasHandler(channel),true,'Actual main recovery channel must exist');
  const reply=await h.invoke(channel,{version:1,action:'challenge'});
  assert.deepEqual(Object.keys(reply).sort(),['challenge','ok']);assert.equal(reply.ok,true);assert.equal(uuid(reply.challenge),true);
  return reply.challenge;
}
function confirm(h,nonce,binding){
  const reply=h.invoke(channel,{version:1,action:'confirm',challenge:nonce,binding});
  assert.equal(typeof reply?.then,'undefined','Main confirmation must execute synchronously at its guarded boundary');
  return reply;
}
async function disk(h,binding,target=h.a){
  const cp=JSON.parse(await fs.readFile(h.checkpoint,'utf8'));
  assert.equal(cp.format,'LinecraftDevelopmentPath/2');assert.equal(cp.drawingPath,target);
  assert.equal(cp.importSaveName,null);assert.equal(cp.binding,binding);return cp;
}
async function liveProbe(h,r,binding,{text=C,target=h.a,protectedTarget=h.b}={}){
  const nonce=await offer(h,r);assert.deepEqual(confirm(h,nonce,binding),{ok:true,matched:true});
  const protectedBytes=await fs.readFile(protectedTarget,'utf8');
  if(protectedTarget===h.b)h.protectOriginalB();else h.protectOriginalA();
  let reply;
  try{reply=await h.invoke('linecraft:save',text,false);}finally{h.clearWriteProtection();}
  assert.equal(reply.ok,true);assert.equal(reply.developmentBinding,binding);
  assert.equal(h.blockedNativeWrites.length,0);assert.equal(await fs.readFile(target,'utf8'),text);
  assert.equal(await fs.readFile(protectedTarget,'utf8'),protectedBytes);await disk(h,binding,target);
  r.probes??=[];r.probes.push({binding,target,reply:plain(reply),files:await bytes(h)});
}

ref('Wrong queued prepare ID preserves legacy association files and queue head',async r=>{
  const h=await host();h.enqueue(h.b);const peek=await h.invoke('linecraft:open-request',{action:'peek'});
  const before=await bytes(h),association=h.snapshot();
  const reply=await h.invoke('linecraft:open-request',{action:'prepare',id:'not-the-pending-id'});
  assert.equal(reply.ok,false);assert.deepEqual(h.snapshot(),association);assert.deepEqual(await bytes(h),before);
  assert.deepEqual(await h.invoke('linecraft:open-request',{action:'peek'}),peek);
  r.stage='legacy-control';r.directory=h.directory;
});
ref('Fixture-changed prepared candidate rejects without adopting or checkpointing it',async r=>{
  const h=await host(),id=await h.queue();await fs.writeFile(h.b,C);const before=await bytes(h),association=h.snapshot();
  const reply=await h.invoke('linecraft:open-request',{action:'commit',id});
  assert.equal(reply.ok,false);assert.match(reply.error,/changed after validation/);
  assert.deepEqual(h.snapshot(),association);assert.deepEqual(await bytes(h),before);
  r.stage='legacy-control';r.fixtureMutation='Owned B intentionally changed to literal C after prepare';r.directory=h.directory;
});
ref('Packaged queue peek prepare and commit retain exact path-free wire shapes',async r=>{
  const h=await host({packaged:true});h.enqueue(h.b);
  const peek=await h.invoke('linecraft:open-request',{action:'peek'});assert.deepEqual(Object.keys(peek.request).sort(),['id','name']);assert.equal(peek.request.name,'B.linecraft');
  assert.deepEqual(peek,{ok:true,request:{id:peek.request.id,name:'B.linecraft'}});
  const id=peek.request.id,prepared=await h.invoke('linecraft:open-request',{action:'prepare',id});
  assert.deepEqual(prepared,{ok:true,id,name:'B.linecraft',text:B});
  assert.deepEqual(await h.invoke('linecraft:open-request',{action:'commit',id}),{ok:true,id,name:'B.linecraft'});
  assert.deepEqual(await h.invoke('linecraft:open-request',{action:'peek'}),{ok:true,request:null});
  assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),B);
  r.stage='packaged-wire-control';r.directory=h.directory;
});
ref('Ordinary Save preserves its actual reply and checkpoint generation across edits',async r=>{
  const h=await host(),id=await allocate(h,r);r.checkpointBefore=await disk(h,id);
  await liveProbe(h,r,id);r.checkpointAfter=await disk(h,id);r.stage='main-live-generation-observed';
});
ref('Rejected ordinary validation preserves live generation before a later Save',async r=>{
  const h=await host(),id=await allocate(h,r),before=await bytes(h);
  const reply=await h.invoke('linecraft:save','{invalid',false);assert.equal(reply.ok,false);assert.equal(Object.hasOwn(reply,'developmentBinding'),false);
  assert.deepEqual(await bytes(h),before);await liveProbe(h,r,id);r.stage='main-live-generation-observed';
});
ref('Rejected prepare leaves the actual old live generation eligible for Save',async r=>{
  const h=await host(),id=await allocate(h,r);h.enqueue(h.b);const peek=await h.invoke('linecraft:open-request',{action:'peek'});
  await fs.writeFile(h.b,'{invalid');const before=await bytes(h);
  assert.equal((await h.invoke('linecraft:open-request',{action:'prepare',id:peek.request.id})).ok,false);
  assert.deepEqual(await bytes(h),before);await liveProbe(h,r,id);r.stage='main-live-generation-observed';
});
ref('Changed candidate commit rejection preserves live generation as well as disk bytes',async r=>{
  const h=await host(),id=await allocate(h,r),request=await h.queue();await fs.writeFile(h.b,C);const before=await bytes(h);
  assert.equal((await h.invoke('linecraft:open-request',{action:'commit',id:request})).ok,false);
  assert.deepEqual(await bytes(h),before);await liveProbe(h,r,id);r.stage='main-live-generation-observed';
});
ref('Failed first queue persistence retains live generation and retry alone publishes a new one',async r=>{
  const h=await host(),old=await allocate(h,r),request=await h.queue(),before=await bytes(h);
  h.setPhase('write');const rejected=await h.invoke('linecraft:open-request',{action:'commit',id:request});h.setPhase(null);
  assert.equal(rejected.ok,false);assert.equal(Object.hasOwn(rejected,'developmentBinding'),false);assert.deepEqual(await bytes(h),before);
  await liveProbe(h,r,old);
  const accepted=await h.invoke('linecraft:open-request',{action:'commit',id:request});assert.equal(accepted.ok,true);
  const next=accepted.developmentBinding;assert.equal(uuid(next),true);assert.notEqual(next,old);await disk(h,next,h.b);
  await liveProbe(h,r,next,{text:B,target:h.b,protectedTarget:h.a});r.stage='main-live-generation-observed';
});
for(const failCompensation of [false,true])ref((failCompensation?'Failed':'Successful')+' compensation preserves old LIVE generation despite disk transaction outcome',async r=>{
  const h=await host(),old=await allocate(h,r),before=await bytes(h),request=await h.queue();
  if(failCompensation)h.setPhase('compensation');
  const held=h.holdCheckpoint(),pending=h.invoke('linecraft:open-request',{action:'commit',id:request});
  await held.entered.promise;let reply;
  try{h.update({dirty:true,name:'Later synthetic work',text:C});}
  finally{held.release.resolve();reply=await pending;h.setPhase(null);}
  assert.equal(reply.ok,false);assert.equal(Object.hasOwn(reply,'developmentBinding'),false);
  assert.equal(h.snapshot().drawingPath,h.a);assert.equal(h.snapshot().text,C);
  assert.equal(await fs.readFile(h.a,'utf8'),A);assert.equal(await fs.readFile(h.b,'utf8'),B);
  if(failCompensation){
    const candidate=JSON.parse(await fs.readFile(h.checkpoint,'utf8'));
    assert.equal(candidate.format,'LinecraftDevelopmentPath/2');assert.equal(candidate.drawingPath,h.b);
    assert.equal(uuid(candidate.binding),true);assert.notEqual(candidate.binding,old);r.diskCandidate=plain(candidate);
  }else assert.equal(await fs.readFile(h.checkpoint,'utf8'),before.checkpoint);
  await liveProbe(h,r,old);r.stage='main-live-generation-observed';
});
ref('Duplicate and conflicting historical UUID confirmations preserve current live generation',async r=>{
  const h=await host();await offer(h,r);const historical=await allocate(h,r,B,h.b),current=await allocate(h,r,A,h.a);
  assert.notEqual(historical,current);h.newRendererFrame();const nonce=await offer(h,r);
  assert.deepEqual(confirm(h,nonce,current),{ok:true,matched:true});h.update({dirty:true,name:'Later synthetic work',text:C});
  const before=h.snapshot(),cp=await fs.readFile(h.checkpoint,'utf8');
  assert.deepEqual(confirm(h,nonce,current),{ok:true,matched:true});assert.equal(confirm(h,nonce,historical).ok,false);
  assert.deepEqual(h.snapshot(),before);assert.equal(await fs.readFile(h.checkpoint,'utf8'),cp);
  assert.deepEqual(confirm(h,nonce,current),{ok:true,matched:true});await liveProbe(h,r,current);r.stage='main-live-generation-observed';
});

// The renderer half executes production ownership logic, never a copied busy proxy.
const rendererBinding='11111111-1111-4111-8111-111111111111',rendererChallenge='22222222-2222-4222-8222-222222222222';
let appSource,chunks,core;
function clock(){let now=0,id=0;const tasks=new Map();return{
  set:(fn,delay)=>{assert.ok(Number.isFinite(delay)&&delay>=0);const key=++id;tasks.set(key,{key,at:now+delay,fn,delay});return key;},
  clear:key=>tasks.delete(key),pending:()=>[...tasks.values()].map(({key,at,delay})=>({key,at,delay})),
  advance:amount=>{const end=now+amount;let count=0;while(true){const next=[...tasks.values()].filter(x=>x.at<=end).sort((a,b)=>a.at-b.at||a.key-b.key)[0];if(!next)break;assert.ok(++count<100);now=next.at;tasks.delete(next.key);next.fn();}now=end;},
};}
async function renderer({phase=null,holdPeek=false,saveOutcome='cancel'}={}){
  if(!chunks){appSource=await fs.readFile(path.join(root,'app.mjs'),'utf8');core=await import(pathToFileURL(path.join(root,'core.mjs')).href);
    const slice=(start,end)=>{const a=appSource.indexOf(start),b=appSource.indexOf(end,a);assert.ok(a>=0&&b>a);return appSource.slice(a,b);};
    chunks={helpers:slice('function canonicalContent(value) {','\nsavedFingerprint=documentFingerprint();'),recovery:slice('const developmentState={restored:false','function reloadDevelopmentDrawing() {'),
      lifecycle:slice('function safeName() {','function fileOpenDeferralReason(){'),queue:slice('function fileOpenDeferralReason(){','async function exportDrawing() {'),action:slice('async function runAction(action) {','function resized() {')};
  }
  const initial=core.createEditor(JSON.parse(A)),events=[],timers=clock(),saveHeld=deferred(),protocolHeld=deferred(),peekHeld=deferred();
  let api,queuePending=true,firstPeek=true;
  const nodes=new Map(),panels=Array.from({length:5},()=>({inert:false}));
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',open:false,disabled:false,focus:()=>{},close:()=>{},replaceChildren:()=>{},classList:{toggle:(name,value)=>{assert.equal(name,'application-busy');events.push({kind:'busy-ui',value});}}});return nodes.get(id);};
  const input=node('command-input'),document={activeElement:input,querySelector:()=>null,querySelectorAll:()=>panels};
  const local=new Map(phase ? [['linecraft-development-reload',JSON.stringify({version:2,text:initial.serialize(),savedFingerprint:A,name:'Recovered.linecraft',importedAwaitingSave:false,developmentBinding:rendererBinding,time:1})]]:[]);
  const storage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};
  const desktop={
    setDocumentState:value=>events.push({kind:'sync',value:plain(value)}),
    saveDrawing:async(text,saveAs)=>{events.push({kind:'save',text,saveAs});await saveHeld.promise;if(saveOutcome==='reject')throw Error('SYNTHETIC_NATIVE_REJECTION');return{ok:false,canceled:true};},
    openDrawing:async()=>{events.push({kind:'open'});return{ok:false,canceled:true};},confirmDiscard:async()=> 'discard',
    onOpenRequest:()=>{},openRequest:async request=>{
      events.push({kind:'queue',request:plain(request)});
      if(request.action==='peek'){if(holdPeek&&firstPeek){firstPeek=false;await peekHeld.promise;}return{ok:true,request:queuePending?{id:'synthetic-queued',name:'Queued.linecraft'}:null};}
      if(request.action==='prepare')return{ok:true,id:request.id,name:'Queued.linecraft',text:B};
      if(request.action==='commit'){queuePending=false;return{ok:true,id:request.id,name:'Queued.linecraft',developmentBinding:rendererBinding};}
      return{ok:true};
    },
    developmentRecovery:async request=>{events.push({kind:'protocol',request:plain(request)});if(request.action===phase)return protocolHeld.promise;return request.action==='challenge'?{ok:true,challenge:rendererChallenge}:{ok:true,matched:true};},
  };
  const setup=`let editor=initialEditor,documentName='A.linecraft',savedFingerprint='',importedAwaitingSave=false,
    gridEnabled=true,snapEnabled=true,orthoEnabled=false,closingApplication=false,documentActionBusy=false,
    ordinaryGripStage=null,ordinaryGripConsumedUp=null,pendingDevelopmentReload=false,
    fileOpenChecking=false,fileOpenNotified=false,fileOpenTimer=null,fileOpenDeferredId=null,
    fileOpenState={ready:false,pending:null,status:'idle',deferredReason:null,lastResult:null},
    structuralBridge={busy:false},plotSubmitting=false,clipboardWritePromise=null,cubeDrag=null,canvasMenu=null,
    plotLayoutDraft=null,plotPreviewSheets=[],plotPreviewIndex=0,lastPlotOptions=null,localGeometryClipboard=null,
    panTool=false,orbitMode=null,orbitPivot=null,drag=null,pointer=null,rawPointer=null,snap=null,pointerUnavailable=null,pointerScalar=null,
    selectedViewportId=null,selectedSubobject=null,subobjectMode='whole',overlapCycle=null,viewportNavigationDraft=null,
    annotationEditor=null,settingsDraft=null,annotationFontRefresh=null;
    const state=()=>editor.state,developmentMode=enableRecovery;`;
  const unexpected=()=>{throw Error('Unexercised UI/plot/clipboard/3D route');};
  const context={JSON,structuredClone,initialEditor:initial,createEditor:core.createEditor,enableRecovery:Boolean(phase),desktop,document,input,$:node,width:1000,height:700,
    localStorage:storage,sessionStorage:{getItem:()=>null,removeItem:()=>{}},console:{warn:()=>{}},
    setTimeout:(fn,delay)=>timers.set(fn,delay),clearTimeout:id=>timers.clear(id),
    update:()=>{api.syncDesktop();api.persistDevelopmentCheckpoint(false);},toast:()=>{},addLog:()=>{},
    closeCanvasMenu:()=>{},hideToolHelp:()=>{},flushViewportNavigation:()=>{},discardRoofGripDraft:()=>false,
    editorDialogOpen:()=>false,textEditing:()=>false,discardOrdinaryGripStage:()=>{},clearRoofDragPreview:()=>{},hideCompletion:()=>{},closePalettes:()=>{},
    currentLayout:()=>null,modelWorkspace:()=>false,visibleEntities:()=>api.editor().state.entities,zoomExtents:core.zoomExtents,
    showPlot:unexpected,runCommand:unexpected,exportDrawing:unexpected,fit:unexpected,reloadDevelopmentDrawing:unexpected,download:unexpected,
  };
  api=vm.runInNewContext(`'use strict';\n`+setup+chunks.helpers+'\nsavedFingerprint=documentFingerprint();\n'+chunks.recovery+chunks.lifecycle+chunks.queue+chunks.action+
    '\n({runAction,pumpFileOpen,getFileOpenState,syncDesktop,persistDevelopmentCheckpoint,editor:()=>editor})',context,{timeout:1000,filename:'recovery-ownership-source.vm.js'});
  await flush();
  const busy=()=>({application:events.filter(e=>e.kind==='busy-ui').at(-1)?.value??false,panels:panels.map(x=>x.inert),settingsDisabled:node('settings-button').disabled});
  return{api,events,timers,saveHeld,protocolHeld,peekHeld,busy,initial,
    capture:()=>({events:plain(events),busy:busy(),queue:plain(api.getFileOpenState()),timers:timers.pending(),text:api.editor().serialize(),canUndo:api.editor().canUndo,canRedo:api.editor().canRedo})};
}
function assertBusy(h,expected){assert.deepEqual(h.busy(),{application:expected,panels:Array(5).fill(expected),settingsDisabled:expected});}
function nativeEvents(h){return h.events.filter(e=>e.kind==='save'||e.kind==='open'||e.kind==='queue'&&['prepare','commit'].includes(e.request.action));}
async function finishQueue(h){h.timers.advance(250);await flush();assert.equal(h.api.getFileOpenState().lastResult.status,'opened');assert.deepEqual(JSON.parse(h.api.editor().serialize()).entities,JSON.parse(B).entities);assert.equal(h.api.editor().canUndo,false);assert.equal(h.api.editor().canRedo,false);assertBusy(h,false);}

ref('Actual runAction busy ownership blocks Open and queued adoption during a held native Save',async r=>{
  const h=await renderer(),first=h.api.runAction('save');await flush();
  try{assertBusy(h,true);assert.equal(await h.api.runAction('open'),false);await h.api.pumpFileOpen();assert.equal(h.api.getFileOpenState().deferredReason,'document-operation');assert.equal(nativeEvents(h).length,1);}
  finally{h.saveHeld.resolve();await first;}
  assertBusy(h,false);await finishQueue(h);r.observation=h.capture();r.stage='renderer-existing-ownership-control';
});
ref('Actual queue pump rechecks ownership after its held peek returns',async r=>{
  const h=await renderer({holdPeek:true}),pump=h.api.pumpFileOpen();await flush();const first=h.api.runAction('save');await flush();
  try{assertBusy(h,true);h.peekHeld.resolve();await pump;assert.equal(h.api.getFileOpenState().deferredReason,'document-operation');assert.equal(nativeEvents(h).length,1);}
  finally{h.peekHeld.resolve();h.saveHeld.resolve();await Promise.allSettled([first,pump]);}
  assertBusy(h,false);await finishQueue(h);r.observation=h.capture();r.stage='renderer-post-peek-control';
});
for(const outcome of ['cancel','reject'])ref('Actual runAction '+outcome+' cleanup clears owned busy UI and permits a later Open',async r=>{
  const h=await renderer({saveOutcome:outcome}),pending=h.api.runAction('save');await flush();
  try{
    assertBusy(h,true);h.saveHeld.resolve();assert.equal(await pending,false);assertBusy(h,false);
    assert.equal(await h.api.runAction('open'),false);assert.equal(h.events.filter(e=>e.kind==='open').length,1);assertBusy(h,false);
    assert.equal(h.api.editor(),h.initial);r.observation=h.capture();r.stage='renderer-existing-ownership-control';
  }finally{h.saveHeld.resolve();await pending;}
});
for(const phase of ['challenge','confirm'])ref('File-action ownership is retained or rechecked across awaited recovery '+phase,async r=>{
  const h=await renderer({phase,holdPeek:true});let secondResult;
  const first=h.api.runAction('save'),second=h.api.runAction('open').then(value=>{secondResult=value;return value;}),pump=h.api.pumpFileOpen();await flush();
  try{
    r.observation=h.capture();r.stage='renderer-negotiation-prerequisite';
    assert.equal(h.events.some(e=>e.kind==='protocol'&&e.request.action===phase),true,'Actual recovery request must execute before this race is qualified');
    assert.equal(nativeEvents(h).length,0,'No native action may dispatch before held recovery negotiation resolves');
    h.protocolHeld.resolve(phase==='challenge'?{ok:true,challenge:rendererChallenge}:{ok:true,matched:true});await flush();
    assert.equal(h.events.filter(e=>e.kind==='save').length,1);assert.equal(secondResult,false);assert.equal(h.events.filter(e=>e.kind==='open').length,0);assertBusy(h,true);
    h.peekHeld.resolve();await pump;assert.equal(h.api.getFileOpenState().deferredReason,'document-operation');assert.equal(nativeEvents(h).length,1);
    h.saveHeld.resolve();assert.equal(await first,false);assertBusy(h,false);await finishQueue(h);
    r.observation=h.capture();r.stage='renderer-recovery-ownership-observed';
  }finally{
    h.protocolHeld.resolve(phase==='challenge'?{ok:true,challenge:rendererChallenge}:{ok:true,matched:true});h.peekHeld.resolve();h.saveHeld.resolve();await Promise.allSettled([first,second,pump]);
  }
});

test('Recovery ownership inventory accounts for seventeen named cases',()=>{assert.equal(names.length,17);assert.equal(records.length,17);assert.ok(records.every(r=>r.completed));assert.equal(records.filter(r=>r.outcome==='unexpected-error').length,0);});
test.after(async()=>{const output=process.env.LINECRAFT_RECOVERY_OWNERSHIP_REPORT;if(output){assert.ok(path.isAbsolute(output));await fs.writeFile(output,JSON.stringify({format:'LinecraftRecoveryOwnershipReference/1',names,records,
  mainSHA256:sha(await fs.readFile(path.join(root,'desktop/main.cjs'))),appSHA256:sha(appSource??''),slices:Object.fromEntries(Object.entries(chunks??{}).map(([key,text])=>[key,{sha256:sha(text),bytes:Buffer.byteLength(text)}])),
  limits:'Actual main/queue/core under shared fake-Electron owned-file fixture. Live UUID is observed only via actual successful reply, on-disk CPv2 and trusted synchronous confirmation; no guessed internal binding observer. Renderer uses verbatim runAction/setDocumentBusy/queue-pump/deferral/lifecycle functions, real core, owned DOM/bridge/storage/manual-timer adapters. Existing post-peek/native-await controls are distinct from pending awaited-recovery controls. Missing interface/binding prerequisites block new positive generation/race branches. Queue peek shape is observed, not delivery of an OS/preload notification. No real Electron/IPC/OS/native input/converter/storage-crash/installed acceptance.'},null,2)+'\n',{flag:'wx'});}});
