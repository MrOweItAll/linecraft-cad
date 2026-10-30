'use strict';
// Explicit pending renderer contract. Canned bridge replies do not qualify main/IPC.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const key = 'linecraft-development-reload';
const bindingA = '11111111-1111-4111-8111-111111111111';
const bindingB = '22222222-2222-4222-8222-222222222222';
const challenge = '33333333-3333-4333-8333-333333333333';
const nativeEntities = [{id:'incoming',type:'CIRCLE',layer:'0',center:{x:20,y:40},radius:8}];
const draftEntities = radius => [
  {id:'sentinel',type:'LINE',layer:'0',start:{x:1,y:2},end:{x:11,y:2}},
  {id:'marker',type:'CIRCLE',layer:'0',center:{x:100,y:100},radius},
];
const plain = value => JSON.parse(JSON.stringify(value));
const sha = value => createHash('sha256').update(value).digest('hex');
const records = [], names = [];
let source, core, geometry, chunks;

function manualClock() {
  let now = 1000, sequence = 0;
  const tasks = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay) {
      assert.equal(typeof callback, 'function');
      assert.ok(Number.isFinite(delay) && delay >= 0, 'Finite explicit timer delay');
      const id = ++sequence;
      tasks.set(id, {id, at:now + delay, delay, callback});
      return id;
    },
    clearTimeout(id) { tasks.delete(id); },
    pending() { return [...tasks.values()].map(({id,at,delay}) => ({id,at,delay})); },
    advance(amount) {
      const until = now + amount;
      assert.ok(Number.isFinite(amount) && amount >= 0);
      let count = 0;
      while (true) {
        const next = [...tasks.values()].filter(row => row.at <= until)
          .sort((a,b) => a.at-b.at || a.id-b.id)[0];
        if (!next) break;
        assert.ok(++count < 100, 'No unbounded timer loop in the fixture');
        now = next.at;
        tasks.delete(next.id);
        next.callback();
      }
      now = until;
    },
  };
}
async function flush() { for (let i=0;i<12;i++) await Promise.resolve(); }
function deferred() { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])]));
  return value;
}
// Independent checkpoint fixture writer: the baseline is a normalized literal drawing.
function fingerprint(document) {
  return JSON.stringify(canonical(Object.fromEntries([
    'entities','layers','currentLayer','settings','textStyles','dimStyles',
    'currentTextStyle','currentDimStyle','blocks','layouts','sheetSets',
    'imageResources','rasterSettings','ucs','architecture',
  ].map(k => [k,document[k] ?? (k === 'architecture' ? null :
    ['blocks','layouts','sheetSets','imageResources'].includes(k) ? [] : undefined)]))));
}
async function load() {
  if (chunks) return;
  source = await fs.readFile(path.join(root,'app.mjs'),'utf8');
  core = await import(pathToFileURL(path.join(root,'core.mjs')).href);
  geometry = core;
  const slice = (start,end) => {
    const a=source.indexOf(start), b=source.indexOf(end,a);
    assert.ok(a>=0 && b>a, 'Verbatim source slice boundaries remain available');
    return source.slice(a,b);
  };
  chunks = {
    fingerprint:slice('function canonicalContent(value) {','\nsavedFingerprint=documentFingerprint();'),
    recovery:slice('const developmentState={restored:false','function reloadDevelopmentDrawing() {'),
    lifecycle:slice('function safeName() {','function fileOpenDeferralReason(){'),
    queued:slice('async function openRequestedDrawing(request){','async function pumpFileOpen(){'),
  };
}
async function fixture(options={}) {
  await load();
  const clock=manualClock(), initial=core.createEditor({entities:draftEntities(4)});
  const baseline=JSON.parse(initial.serialize());
  assert.equal(initial.setCircleRadius('marker',5).ok,true);
  assert.equal(initial.setCircleRadius('marker',6).ok,true);
  assert.equal(initial.undo().ok,true);
  initial.select(['sentinel']);
  const normalizedDraft=JSON.parse(initial.serialize());
  const expectedSaved=fingerprint(options.clean ? normalizedDraft : baseline);
  let checkpoint;
  if (options.version) checkpoint={
    version:options.version,text:JSON.stringify(normalizedDraft),name:'Recovered.linecraft',
    savedFingerprint:expectedSaved,importedAwaitingSave:options.imported===true,
    gridEnabled:true,snapEnabled:true,orthoEnabled:false,time:17,activeCommandCanceled:false,
    ...(options.version===2 ? {developmentBinding:options.binding ?? null} : {}),
  };
  const local=new Map(checkpoint ? [[key,JSON.stringify(checkpoint)]] : []), session=new Map();
  const events=[], updates=[], warnings=[];
  let api, saveIndex=0, hostBinding=options.binding??null;
  const accept = reply => {
    if (reply?.ok && Object.hasOwn(reply,'developmentBinding')) hostBinding=reply.developmentBinding;
    return plain(reply);
  };
  const storage=map => ({
    getItem:k => map.get(k) ?? null,
    setItem:(k,v) => { map.set(k,String(v)); events.push({kind:'checkpoint',value:JSON.parse(v)}); },
    removeItem:k => map.delete(k),
  });
  const saveReplies=options.saveReplies ?? [{ok:false,canceled:true}];
  const desktop={
    setDocumentState:value => events.push({kind:'sync',value:plain(value)}),
    saveDrawing:async(text,saveAs) => {
      events.push({kind:'save',text,saveAs});
      return accept(saveReplies[Math.min(saveIndex++,saveReplies.length-1)]);
    },
    openDrawing:async() => {
      events.push({kind:'open'});
      return accept(options.openReply ?? {ok:false,canceled:true});
    },
    resetDocumentPath:async() => {
      events.push({kind:'reset'});
      return accept(options.resetReply ?? {ok:true,developmentBinding:null});
    },
    confirmDiscard:async() => options.discard ?? 'discard',
    openRequest:async request => {
      events.push({kind:'queue',request:plain(request)});
      if (request.action==='prepare') return {ok:true,id:request.id,name:'Queued.linecraft',text:JSON.stringify({format:'Linecraft/1',entities:nativeEntities})};
      if (request.action==='commit') return accept({ok:true,developmentBinding:bindingB});
      return {ok:true};
    },
  };
  if (options.protocol !== 'missing') desktop.developmentRecovery=async request => {
    events.push({kind:'protocol',request:plain(request)});
    if (typeof options.protocol==='function') return options.protocol(plain(request));
    if (options.protocol==='rejected') throw Error('SYNTHETIC_NEGOTIATION_REJECTION');
    if (request.action==='challenge') return options.protocol==='malformed' ? {ok:true,challenge:'invalid'} : {ok:true,challenge};
    return {ok:true,matched:typeof request.binding==='string' && request.binding===hostBinding && options.matched!==false};
  };
  const no3D = () => { throw Error('Paper/3D behavior is outside this fixture'); };
  const ui = {value:'',focus:()=>{},open:false,close:()=>{},replaceChildren:()=>{},classList:{toggle:()=>{}}};
  const setup = `
    let editor=initialEditor,documentName='Working.linecraft',savedFingerprint=initialSaved,
      importedAwaitingSave=initialImported,gridEnabled=true,snapEnabled=true,orthoEnabled=false;
    const developmentMode=true,closingApplication=false,state=()=>editor.state;
    let ordinaryGripConsumedUp=null,plotLayoutDraft=null,plotPreviewSheets=[],plotPreviewIndex=0,
      lastPlotOptions=null,localGeometryClipboard=null,panTool=false,orbitMode=null,orbitPivot=null,
      drag=null,pointer=null,rawPointer=null,snap=null,pointerUnavailable=null,pointerScalar=null,
      selectedViewportId=null,selectedSubobject=null,subobjectMode='whole',overlapCycle=null,
      viewportNavigationDraft=null,annotationEditor=null,settingsDraft=null,annotationFontRefresh=null,
      documentActionBusy=false;
  `;
  const finish = `({save,openDrawing,newDrawing,openRequestedDrawing,syncDesktop,persistDevelopmentCheckpoint,
    editor:()=>editor,snapshot:()=>({text:serializedDrawing(),name:documentName,
      fingerprint:documentFingerprint(),savedFingerprint,imported:importedAwaitingSave,dirty:isDirty(),
      canUndo:editor.canUndo,canRedo:editor.canRedo,selection:[...state().selectionIds],
      development:{...developmentState}})})`;
  class FixtureDate extends Date { static now() { return clock.now(); } }
  const context={JSON,Date:FixtureDate,initialEditor:initial,initialSaved:expectedSaved,
    initialImported:options.imported===true,createEditor:core.createEditor,desktop,
    localStorage:storage(local),sessionStorage:storage(session),console:{warn:(...args)=>warnings.push(args)},
    setTimeout:(...args)=>clock.setTimeout(...args),clearTimeout:id=>clock.clearTimeout(id),
    update:()=>{
      events.push({kind:'update'});
      api.syncDesktop();
      const value=api.persistDevelopmentCheckpoint(false);
      updates.push({snapshot:plain(api.snapshot()),checkpoint:typeof value==='string' ? JSON.parse(value) : value});
    },
    toast:(...args)=>events.push({kind:'ui',args:plain(args)}),addLog:(...args)=>events.push({kind:'ui',args:plain(args)}),download:()=>{throw Error('No browser download');},
    discardOrdinaryGripStage:()=>{},clearRoofDragPreview:()=>{},hideCompletion:()=>{},closePalettes:()=>{},
    $:()=>ui,input:ui,width:1000,height:700,currentLayout:()=>null,modelWorkspace:()=>false,
    visibleEntities:()=>api.editor().state.entities,
    zoomExtents:geometry.zoomExtents,fitPaper:no3D,setCamera:no3D,view3d:new Proxy({}, {get:()=>no3D}),
  };
  api=vm.runInNewContext(`'use strict';\n`+setup+Object.values(chunks).join('\n')+'\n'+finish,context,
    {timeout:1000,filename:'renderer-negotiation-source.vm.js'});
  // Startup synchronization projection only; no DOM app startup or preload transport.
  api.syncDesktop();
  await flush();
  return {api,initial,checkpoint,expectedSaved,clock,events,updates,local,warnings,
    snapshot:()=>plain(api.snapshot()),protocol:()=>events.filter(e=>e.kind==='protocol').map(e=>e.request),
    saves:()=>events.filter(e=>e.kind==='save')};
}
function capture(r,h) {
  r.observation={state:h.snapshot(),events:plain(h.events),updates:plain(h.updates),timers:h.clock.pending()};
}
function exactNegotiation(h,binding) {
  assert.deepEqual(h.protocol(),[
    {version:1,action:'challenge'},
    {version:1,action:'confirm',challenge,binding},
  ],'Dedicated exact challenge/confirmation requests must actually execute');
}
function recovered(h,{dirty,imported}) {
  const state=h.snapshot();
  assert.equal(state.development.restored,true);
  assert.deepEqual(JSON.parse(state.text).entities,draftEntities(5));
  assert.equal(state.savedFingerprint,h.expectedSaved);
  assert.equal(state.dirty,dirty);assert.equal(state.imported,imported);
  assert.equal(state.canUndo,false);assert.equal(state.canRedo,false);
  assert.deepEqual(state.selection,[]);
}
function firstCheckpoint(h,binding) {
  assert.ok(h.updates.length>0,'Actual source update boundary must execute');
  const checkpoint=h.updates[0].checkpoint;
  assert.equal(checkpoint && checkpoint.version,2,'Checkpoint must use explicitly frozen v2');
  assert.ok(Object.hasOwn(checkpoint,'developmentBinding'),'Binding omission is never explicit null');
  assert.equal(checkpoint.developmentBinding,binding,'Reply binding must exist at first update/checkpoint');
  metadataOutsideDrawing(h);
  for (const event of h.events.filter(e=>e.kind==='sync')) {
    assert.deepEqual(Object.keys(event.value).sort(),['dirty','name','text']);
  }
}
function metadataOutsideDrawing(h) {
  const state=h.snapshot(),values=[state.text,state.fingerprint,state.savedFingerprint,JSON.stringify(h.api.editor().state),
    JSON.stringify(h.events.filter(e=>e.kind==='ui')),
    ...h.events.filter(e=>e.kind==='sync').map(e=>e.value.text),...h.saves().map(e=>e.text),
    ...h.updates.filter(e=>e.checkpoint).map(e=>e.checkpoint.savedFingerprint)];
  for (const value of values) for (const token of [bindingA,bindingB,challenge]) assert.equal(value.includes(token),false,'Opaque metadata stays outside drawing/editor/fingerprints');
}
async function priorAccepted(h) {
  assert.equal(await h.api.save(true),true);
  assert.equal(h.local.size,1,'Accepted prior drawing must have actual recovery bytes');
  const checkpoint=JSON.parse(h.local.get(key));
  h.events.length=0;h.updates.length=0;
  return checkpoint;
}
function ref(name,run) {
  names.push(name);
  test(name,{timeout:5000},async()=>{
    const record={name,stage:'source-execution'};records.push(record);
    try { await run(record);record.outcome='pass'; }
    catch(error) { record.outcome=error.name==='AssertionError'?'fail':'harness-error';record.error={name:error.name,message:error.message};throw error; }
    finally { record.completed=true; }
  });
}

ref('Manual clock control fires only due callbacks and honors cancellation',async r=>{
  const clock=manualClock(),events=[];
  clock.setTimeout(()=>events.push('deadline'),25);
  const canceled=clock.setTimeout(()=>events.push('canceled'),10);clock.clearTimeout(canceled);
  clock.advance(24);assert.deepEqual(events,[]);clock.advance(1);assert.deepEqual(events,['deadline']);
  r.stage='control';
});
ref('Legacy v1 content baseline and fresh recovery history remain usable',async r=>{
  const h=await fixture({version:1,protocol:'missing'});capture(r,h);
  recovered(h,{dirty:true,imported:false});r.stage='control';
});
ref('Accepted Save As retains literal content and prior history without serializing UUIDs',async r=>{
  const h=await fixture({saveReplies:[{ok:true,name:'Accepted.linecraft',developmentBinding:bindingB}]});
  assert.equal(await h.api.save(true),true);capture(r,h);
  assert.equal(h.api.editor(),h.initial);assert.deepEqual(JSON.parse(h.snapshot().text).entities,draftEntities(5));
  assert.equal(h.snapshot().dirty,false);assert.equal(h.snapshot().canUndo,true);assert.equal(h.snapshot().canRedo,true);
  metadataOutsideDrawing(h);r.stage='control';
});
for (const state of ['clean','dirty','imported']) ref('Healthy v2 negotiation preserves '+state+' recovered state',async r=>{
  const imported=state==='imported',clean=state!=='dirty',binding=imported ? null : bindingA;
  const h=await fixture({version:2,binding,clean,imported});capture(r,h);r.stage='healthy-negotiation';
  exactNegotiation(h,binding);
  recovered(h,{dirty:!clean||imported,imported});
});
ref('Matched recovery completes confirmation before ordinary Save and preserves its baseline on cancel',async r=>{
  const h=await fixture({version:2,binding:bindingA});const before=h.snapshot();
  assert.equal(await h.api.save(),false);capture(r,h);r.stage='healthy-routing';
  exactNegotiation(h,bindingA);assert.equal(h.saves().length,1);assert.equal(h.saves()[0].saveAs,false);
  assert.ok(h.events.findIndex(e=>e.kind==='protocol'&&e.request.action==='confirm')<h.events.findIndex(e=>e.kind==='save'));
  assert.equal(h.snapshot().savedFingerprint,before.savedFingerprint);assert.equal(h.snapshot().text,before.text);
});
for (const kind of ['legacy','mismatch','imported','missing','rejected','malformed']) ref('Unverified '+kind+' recovery explicitly requests chooser Save',async r=>{
  const version=['legacy','missing','rejected','malformed'].includes(kind) ? 1 : 2;
  const h=await fixture({version,binding:kind==='imported'?null:bindingA,
    imported:kind==='imported',clean:kind==='imported',matched:kind!=='mismatch',
    protocol:['missing','rejected','malformed'].includes(kind)?kind:undefined});
  const before=h.snapshot();assert.equal(await h.api.save(),false);capture(r,h);r.stage='chooser-routing';
  assert.equal(h.saves().length,1);assert.equal(h.saves()[0].saveAs,true);
  assert.equal(h.snapshot().text,before.text);assert.equal(h.snapshot().savedFingerprint,before.savedFingerprint);
  assert.equal(h.snapshot().dirty,before.dirty);assert.equal(h.snapshot().imported,before.imported);
});
for (const phase of ['challenge','confirm']) ref('Hung '+phase+' has a finite manual-clock fallback and no duplicate late Save',async r=>{
  const held=deferred();
    const h=await fixture({version:2,binding:bindingA,protocol:request => request.action===phase ? held.promise : request.action==='challenge' ? {ok:true,challenge} : {ok:true,matched:true}});
  const before=h.snapshot(),localBefore=[...h.local];let settled=false;
  const pending=h.api.save().then(value=>{settled=true;return value;});await flush();capture(r,h);r.stage='deadline-ordering';
  assert.equal(h.saves().length,0,'No native Save while negotiation is unresolved');
  assert.equal(settled,false);
  assert.equal(h.protocol().at(-1)?.action,phase,'The held protocol stage must actually be requested');
  const deadlines=[];
  for (let steps=0;!settled && steps<32;steps++) {
    const timers=h.clock.pending().sort((a,b)=>a.at-b.at);
    assert.ok(timers.length>0,'Finite source negotiation timer must be armed');
    const delay=timers[0].at-h.clock.now();assert.ok(delay>=0&&Number.isFinite(delay));deadlines.push(timers[0]);
    if (delay>0) { h.clock.advance(delay-1);await flush();assert.equal(h.saves().length,0);h.clock.advance(1); }
    else h.clock.advance(0);
    await flush();
  }
  assert.equal(settled,true,'Negotiation must finish within its finite scheduled callbacks');assert.equal(await pending,false);
  assert.equal(h.saves().length,1);assert.equal(h.saves()[0].saveAs,true);
  const protocolAtExpiry=plain(h.protocol()),checkpointWrites=h.events.filter(e=>e.kind==='checkpoint').length;
  held.resolve(phase==='challenge'?{ok:true,challenge}:{ok:true,matched:true});await flush();
  assert.equal(h.saves().length,1);assert.equal(h.snapshot().text,before.text);
  assert.equal(h.snapshot().savedFingerprint,before.savedFingerprint);assert.deepEqual([...h.local],localBefore);
  assert.deepEqual(h.protocol(),protocolAtExpiry);assert.equal(h.events.filter(e=>e.kind==='checkpoint').length,checkpointWrites);
  r.virtualDeadlines=deadlines;
  capture(r,h);r.stage='deadline-and-late-reply-observed';
});
ref('Save As reply binding is installed at the first actual update/checkpoint boundary',async r=>{
  const h=await fixture({saveReplies:[{ok:true,name:'Accepted.linecraft',developmentBinding:bindingB}]});
  assert.equal(await h.api.save(true),true);capture(r,h);r.stage='reply-before-update';firstCheckpoint(h,bindingB);
});
ref('Verified ordinary Save keeps the reply binding in each disk-checkpoint projection',async r=>{
  const h=await fixture({saveReplies:[{ok:true,name:'Accepted.linecraft',developmentBinding:bindingB}]});
  await h.api.save(true);assert.equal(h.api.editor().setCircleRadius('marker',7).ok,true);await h.api.save();
  capture(r,h);r.stage='ordinary-binding-stability';
  assert.deepEqual(h.saves().map(e=>e.saveAs),[true,false]);firstCheckpoint(h,bindingB);
  assert.equal(h.updates[1].checkpoint.developmentBinding,bindingB);
  assert.deepEqual(JSON.parse(h.saves()[1].text).entities,draftEntities(7));
});
for (const imported of [false,true]) ref((imported?'Imported':'Native')+' Open consumes reply binding before actual replacement update',async r=>{
  const binding=imported?null:bindingB;
  const h=await fixture({saveReplies:[{ok:true,name:'Prior.linecraft',developmentBinding:bindingA}],openReply:{ok:true,name:'Incoming.linecraft',text:JSON.stringify({format:'Linecraft/1',entities:nativeEntities}),imported,developmentBinding:binding}});
  await priorAccepted(h);
  assert.equal(await h.api.openDrawing(),true);capture(r,h);r.stage='open-binding-before-update';
  assert.notEqual(h.api.editor(),h.initial);assert.deepEqual(JSON.parse(h.snapshot().text).entities,nativeEntities);
  assert.equal(h.snapshot().canUndo,false);assert.equal(h.snapshot().canRedo,false);
  assert.equal(h.snapshot().dirty,imported);firstCheckpoint(h,binding);
});
ref('Queued commit binding is consumed before actual replacement update',async r=>{
  const h=await fixture();const result=await h.api.openRequestedDrawing({id:'synthetic-request',name:'Queued.linecraft'});
  capture(r,h);r.stage='queued-binding-before-update';assert.equal(result.status,'opened');
  assert.deepEqual(h.events.filter(e=>e.kind==='queue').map(e=>e.request.action),['prepare','commit']);
  assert.deepEqual(JSON.parse(h.snapshot().text).entities,nativeEntities);firstCheckpoint(h,bindingB);
});
ref('Successful reset installs explicit null before the actual fresh-editor update',async r=>{
  const h=await fixture({saveReplies:[{ok:true,name:'Prior.linecraft',developmentBinding:bindingA}]});await priorAccepted(h);
  assert.equal(await h.api.newDrawing(),true);capture(r,h);r.stage='reset-null-before-update';
  assert.deepEqual(JSON.parse(h.snapshot().text).entities,[]);assert.equal(h.snapshot().canUndo,false);
  firstCheckpoint(h,null);
});
ref('Returned reset failure preserves editor content baseline history and recovery bytes',async r=>{
  const h=await fixture({saveReplies:[{ok:true,name:'Prior.linecraft',developmentBinding:bindingA}],resetReply:{ok:false,error:'SYNTHETIC_RESET_DENIED'}});
  const priorCheckpoint=await priorAccepted(h);
  const before=h.snapshot(),localBefore=[...h.local],original=h.api.editor();
  const result=await h.api.newDrawing();capture(r,h);r.stage='returned-reset-failure';
  assert.equal(result,false);assert.equal(h.api.editor(),original);assert.deepEqual(h.snapshot(),before);
  assert.deepEqual([...h.local],localBefore);assert.equal(h.updates.length,0);
  assert.equal(priorCheckpoint.version,2);assert.equal(priorCheckpoint.developmentBinding,bindingA);
});
test('Renderer negotiation inventory accounts for twenty-two named cases',()=>{
  assert.equal(names.length,22);assert.equal(records.length,22);assert.ok(records.every(r=>r.completed));
  assert.equal(records.filter(r=>r.outcome==='harness-error').length,0,'Harness errors are never pending product expectations');
});
test.after(async()=>{
  const filename=process.env.LINECRAFT_RECOVERY_NEGOTIATION_REPORT;
  if (filename) {
    assert.ok(path.isAbsolute(filename));
    await fs.writeFile(filename,JSON.stringify({format:'LinecraftRendererNegotiationReference/1',names,records,
      appSHA256:sha(source??''),slices:Object.fromEntries(Object.entries(chunks??{}).map(([name,text])=>[name,{sha256:sha(text),bytes:Buffer.byteLength(text)}])),
      runtime:{node:process.version,platform:process.platform},
      limits:'Pending renderer source contract with canned bridge replies and fixed opaque UUIDs; actual main/preload/IPC are not executed. Verbatim recovery/fingerprint/Save/Open/New/queued-open/replaceDrawing with real core and 2D zoomExtents. The update adapter calls actual syncDesktop and checkpoint persistence immediately; this is an ordering projection, not full DOM/debounce integration. Manual clock never auto-fires timers and can test finite source negotiation ordering, not real latency. CPv2 developmentBinding key is an explicit frozen prerequisite choice. Main live-generation after queued rejection/compensation/replay, integrated runAction busy recheck, real storage/crash/frame/transport/native/installed behavior remain unqualified.'},null,2)+'\n',{flag:'wx'});
  }
});
