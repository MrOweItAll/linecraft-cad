import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createEditor} from '../core.mjs';
import {createScriptingAPI} from '../linecraft-scripting.mjs';

const fixture=()=>createEditor({entities:[
  {id:'boundary',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:100,y:0}},
  {id:'note',type:'TEXT',layer:'0',position:{x:10,y:5},text:'Original note',height:2,rotation:0,style:'Standard'},
  {id:'other',type:'CIRCLE',layer:'0',center:{x:50,y:50},radius:4}
]});
const revision={label:'Revise note only',steps:[{op:'text',id:'note',patch:{text:'Revised note',position:{x:12,y:6}}}]};
test('preview is nonmutating; Apply retains other objects and is one Undo/Redo',()=>{
  const editor=fixture(),before=JSON.parse(editor.serialize());
  const preview=editor.applyRevision({...revision,dryRun:true});assert.equal(preview.ok,true);assert.equal(editor.canUndo,false);assert.deepEqual(JSON.parse(editor.serialize()),before);assert.deepEqual(preview.changes.entities.map(e=>e.id),['note']);assert.deepEqual(preview.changes.documentFields,[]);
  const applied=editor.applyRevision(revision);assert.equal(applied.ok,true);const after=JSON.parse(editor.serialize());assert.deepEqual(after.entities.filter(e=>e.id!=='note'),before.entities.filter(e=>e.id!=='note'));assert.equal(after.entities.find(e=>e.id==='note').text,'Revised note');
  assert.equal(editor.undo().ok,true);assert.deepEqual(JSON.parse(editor.serialize()),before);assert.equal(editor.canUndo,false);assert.equal(editor.redo().ok,true);assert.deepEqual(JSON.parse(editor.serialize()),after);
});
test('a later invalid step or unfinished command rolls back the whole revision',()=>{
  const editor=fixture(),before=editor.serialize();
  for(const last of [{op:'text',id:'missing',patch:{text:'Bad'}},{op:'commands',tokens:['LINE','0,0']},{op:'select',ids:['note','missing']},{op:'execute',code:'throw Error()'}]){
    const result=editor.applyRevision({...revision,steps:[...revision.steps,last]});assert.equal(result.ok,false);assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,false);
  }
});
test('scripts respect locked layers and a live active command',()=>{
  const editor=fixture();editor.updateLayer('0',{locked:true});const before=editor.serialize();assert.equal(editor.applyRevision(revision).ok,false);assert.equal(editor.serialize(),before);
  editor.updateLayer('0',{locked:false});editor.execute('LINE');assert.equal(editor.applyRevision(revision).ok,false);assert.equal(editor.state.command,'LINE');
});
test('two commands share one Undo without consuming preexisting history',()=>{
  const editor=fixture();editor.setCircleRadius('other',5);const before=editor.serialize();
  const result=editor.applyRevision({label:'Two new lines',steps:[{op:'commands',tokens:['LINE','0,0','5,5','','LINE','10,10','15,15','']}]});assert.equal(result.ok,true);assert.equal(result.changes.entities.filter(e=>e.kind==='added').length,2);
  editor.undo();assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,true);editor.undo();assert.equal(editor.state.entities.find(e=>e.id==='other').radius,4);
});
test('paper-space annotation revision leaves model, frame, scale and active view intact',()=>{
  const editor=fixture(),added=editor.addLayout('Sheet'),layoutId=added.layoutId;
  editor.addViewport(layoutId,{x:10,y:10,width:200,height:100},{scaleDenominator:100});editor.setSpace('paper',layoutId);
  for(const token of ['TEXT','10,20','2','0','Sheet note'])assert.equal(editor.execute(token).ok,true);
  const note=editor.getPaperEntities(layoutId)[0],before=JSON.parse(editor.serialize());editor.setSpace('model',null);
  const result=editor.applyRevision({label:'Paper note',steps:[{op:'space',space:'paper',layoutId},{op:'text',id:note.id,patch:{text:'Updated sheet note'}}]});assert.equal(result.ok,true);
  const after=JSON.parse(editor.serialize());assert.deepEqual(after.entities,before.entities);assert.deepEqual(after.layouts[0].viewports,before.layouts[0].viewports);assert.equal(editor.state.activeLayoutId,null);assert.equal(editor.getPaperEntities(layoutId)[0].text,'Updated sheet note');
});
test('API rejects stale drawings, updates live view, deduplicates Apply and returns isolated reads',async()=>{
  const editor=fixture();let notifications=0;
  const api=createScriptingAPI({getEditor:()=>editor,crypto:webcrypto,onChange:()=>notifications++});
  const snap=await api.request({version:1,method:'snapshot',params:{ids:['note']}});assert.equal(snap.entities.length,1);snap.entities[0].text='External mutation';assert.equal(editor.state.entities.find(e=>e.id==='note').text,'Original note');
  editor.setCircleRadius('other',5);
  assert.equal((await api.request({version:1,method:'apply',requestId:'stale',params:{...revision,baseToken:snap.baseToken}})).ok,false);
  const fresh=await api.request({version:1,method:'describe'}),request={version:1,method:'apply',requestId:'edit-1',params:{...revision,baseToken:fresh.baseToken}};
  const applied=await api.request(request);assert.equal(applied.ok,true);assert.equal(notifications,1);assert.deepEqual(await api.request(request),applied);assert.equal(notifications,1);
  assert.equal((await api.request({...request,params:{...request.params,label:'Different'}})).ok,false);
  assert.equal((await api.request({version:1,method:'undo',requestId:'undo-1',params:{baseToken:applied.baseToken}})).ok,true);assert.equal(notifications,2);assert.equal(editor.state.entities.find(e=>e.id==='note').text,'Original note');assert.equal(editor.state.entities.find(e=>e.id==='other').radius,5);
});
test('new drawings, busy UI and concurrent scripts cannot overwrite a newer drawing',async()=>{
  let editor=fixture(),busy=false;
  const api=createScriptingAPI({getEditor:()=>editor,crypto:webcrypto,canEdit:()=>!busy});
  const initial=await api.request({version:1,method:'describe'});editor=fixture();
  assert.equal((await api.request({version:1,method:'apply',requestId:'old-file',params:{...revision,baseToken:initial.baseToken}})).ok,false);
  const current=await api.request({version:1,method:'describe'});busy=true;
  assert.equal((await api.request({version:1,method:'preview',params:{...revision,baseToken:current.baseToken}})).ok,false);busy=false;
  const results=await Promise.all(['first','second'].map(requestId=>api.request({version:1,method:'apply',requestId,params:{...revision,baseToken:current.baseToken}})));
  assert.deepEqual(results.map(r=>r.ok),[true,false]);
});
test('existing architectural source, accepted tray and derived roof survive a note revision',async()=>{
  const document=JSON.parse(await readFile(new URL('../samples/tray-ceiling-v111.linecraft',import.meta.url),'utf8'));
  document.entities.push({id:'script-note',type:'TEXT',layer:'0',position:{x:0,y:0},text:'Roof review',height:2,rotation:0,style:'Standard'});
  const editor=createEditor(document);editor.setSpace('model',null);
  const before=JSON.parse(editor.serialize()),derived=structuredClone(editor.state.architectureDerived);
  const result=editor.applyRevision({label:'Note only on tray drawing',steps:[{op:'text',id:'script-note',patch:{text:'Roof reviewed'}}]});assert.equal(result.ok,true);
  const after=JSON.parse(editor.serialize());assert.deepEqual(after.architecture,before.architecture);assert.deepEqual(editor.state.architectureDerived,derived);assert.deepEqual(after.layouts,before.layouts);assert.deepEqual(result.changes.entities.map(e=>e.id),['script-note']);assert.deepEqual(result.changes.documentFields,[]);
});

const gableFixture=async()=>{
  const document=JSON.parse(await readFile(new URL('../samples/gable-v112.linecraft',import.meta.url),'utf8'));
  document.entities.push({id:'script-note',type:'TEXT',layer:'0',position:{x:0,y:-36},text:'R4 gable review',height:6,rotation:0,style:'Standard'});
  return createEditor(document);
};
test('schema-4 gables, separate closures, zero thickness, camera and layouts survive Apply, Undo/Redo and native reopen',async()=>{
  const editor=await gableFixture(),before=editor.serialize(),source=JSON.parse(before),derived=structuredClone(editor.state.architectureDerived);
  assert.equal(source.architecture.schemaVersion,5);
  assert.equal(source.architecture.roofGroups[0].roofType,'GABLE');
  assert.ok(editor.state.entities.some(entity=>editor.getArchitectureOwner(entity.id)?.part==='gable'));
  assert.equal(derived.spaces[0].assumptions.analysisMode,'mathematical-zero-thickness');
  const result=editor.applyRevision({label:'R4 note revision',steps:[{op:'text',id:'script-note',patch:{text:'R4 gable reviewed',position:{x:12,y:-48}}}]});
  assert.equal(result.ok,true,result.message);assert.deepEqual(result.changes.documentFields,[]);
  const after=editor.serialize(),saved=JSON.parse(after);
  for(const key of ['architecture','settings','layouts','camera3d','workspace','viewport'])assert.deepEqual(saved[key],source[key],key);
  assert.deepEqual(editor.state.architectureDerived,derived);
  assert.ok(saved.entities.every(entity=>!entity.id.startsWith('@architecture/')));
  const reopened=createEditor(saved);assert.equal(reopened.serialize(),after);assert.deepEqual(reopened.state.architectureDerived,derived);
  assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,false);
  assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),after);
});
test('scripting uses current R4 semantic edits with one Undo and rejects a late invalid gable decision atomically',async()=>{
  const editor=await gableFixture(),before=editor.serialize(),source=JSON.parse(before).architecture,roofId=source.roofGroups[0].id;
  const steps=[{op:'text',id:'script-note',patch:{text:'Rake extended'}},{op:'architecture',operation:{type:'setRoof',roofGroupId:roofId,values:{rakeOverhang:48}}}];
  const accepted=editor.applyRevision({label:'R4 source and note together',steps});assert.equal(accepted.ok,true,accepted.message);
  assert.deepEqual(accepted.changes.documentFields,['architecture']);assert.equal(editor.state.architecture.roofGroups[0].rakeOverhang,48);
  assert.deepEqual(editor.state.architecture.rooms,source.rooms);assert.deepEqual(editor.state.architecture.walls,source.walls);
  assert.equal(editor.state.architectureDerived.roofs[0].status,'ok');
  const after=editor.serialize();assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
  const rejected=editor.applyRevision({label:'Reject invalid terminal edge',steps:[...steps,{op:'architecture',operation:{type:'setRoof',roofGroupId:roofId,values:{gableAssignments:['missing-source-edge']}}}]});
  assert.equal(rejected.ok,false);assert.equal(editor.serialize(),before);assert.equal(editor.canRedo,true);
  assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),after);
});
test('generated R4 roof and closure surfaces remain guarded from scripted ordinary edits',async()=>{
  const editor=await gableFixture(),before=editor.serialize();
  for(const part of ['surface','gable']){
    const entity=editor.state.entities.find(entity=>editor.getArchitectureOwner(entity.id)?.kind==='roofGroup'&&(part==='gable'?editor.getArchitectureOwner(entity.id).part==='gable':entity.id.endsWith('/surface')));
    assert.ok(entity,part);
    const result=editor.applyRevision({label:`Reject ${part} mesh edit`,steps:[{op:'grip',id:entity.id,index:0,point:{x:0,y:0,z:0}}]});
    assert.equal(result.ok,false);assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,false);
  }
});
test('preview, a rejected revision and a no-op preserve preexisting Redo history and active view',()=>{
  const editor=fixture();editor.setCircleRadius('other',5);const changed=editor.serialize();editor.undo();const before=editor.serialize();
  assert.equal(editor.canRedo,true);
  assert.equal(editor.applyRevision({...revision,dryRun:true}).ok,true);
  assert.equal(editor.applyRevision({...revision,steps:[...revision.steps,{op:'radius',id:'other',radius:-2}]}).ok,false);
  const noop=editor.applyRevision({label:'No changes',steps:[{op:'text',id:'note',patch:{text:'Original note'}}]});
  assert.equal(noop.ok,true);assert.equal(noop.changed,false);assert.equal(noop.wouldChange,false);
  assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,false);assert.equal(editor.canRedo,true);
  assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),changed);
});
test('a drawing edit or replacement during asynchronous hashing rejects the request without a script mutation',async()=>{
  for(const mode of ['edit','replace','command']){
    let editor=fixture(),intercept=false,notifications=0;
    const hashing={randomUUID:()=>webcrypto.randomUUID(),subtle:{digest:async(...args)=>{
      if(intercept){intercept=false;if(mode==='edit')editor.setCircleRadius('other',7);else if(mode==='replace')editor=fixture();else editor.execute('LINE');}
      return webcrypto.subtle.digest(...args);
    }}};
    const api=createScriptingAPI({getEditor:()=>editor,crypto:hashing,onChange:()=>notifications++});
    const original=await api.request({version:1,method:'describe'});intercept=true;
    const result=await api.request({version:1,method:'apply',requestId:`during-${mode}`,params:{...revision,baseToken:original.baseToken}});
    assert.equal(result.ok,false,mode);assert.equal(editor.state.entities.find(entity=>entity.id==='note').text,'Original note');assert.equal(notifications,0);
    if(mode==='command')assert.equal(editor.state.command,'LINE');
  }
});
test('duplicate Apply and Undo retries do not consume history, even after the caller edits its returned report',async()=>{
  const editor=fixture(),api=createScriptingAPI({getEditor:()=>editor,crypto:webcrypto});
  const start=await api.request({version:1,method:'describe'});
  const apply={version:1,method:'apply',requestId:'isolated-apply',params:{...revision,baseToken:start.baseToken}};
  const first=await api.request(apply),expected=structuredClone(first);first.changes.entities[0].after.text='Caller changed report';
  assert.deepEqual(await api.request(apply),expected);
  const undo={version:1,method:'undo',requestId:'isolated-undo',params:{baseToken:expected.baseToken}},undone=await api.request(undo);
  assert.equal(undone.ok,true);assert.deepEqual(await api.request(undo),undone);assert.equal(editor.canUndo,false);assert.equal(editor.canRedo,true);
  const redone=await api.request({version:1,method:'redo',requestId:'isolated-redo',params:{baseToken:undone.baseToken}});
  assert.equal(redone.ok,true);assert.equal(editor.state.entities.find(entity=>entity.id==='note').text,'Revised note');
});
