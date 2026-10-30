import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEditor} from '../core.mjs';

// Explicit pending recovery references, outside the selected passing gate.
// Artificial, one-shot per-editor state-read faults; no product/global hooks.
const copy=v=>structuredClone(v),doc=e=>JSON.parse(e.serialize());
const L=(id,x1,y1,x2,y2)=>({id,type:'LINE',layer:'0',start:{x:x1,y:y1},end:{x:x2,y:y2}});
const originals=()=>[L('a',0,0,10,0),L('b',0,5,0,15)];
const translated=(x,ids)=>[L(ids[0],x,0,x+10,0),L(ids[1],x,5,x,15)];
const reflected=ids=>[L(ids[0],40,0,30,0),L(ids[1],40,5,40,15)];
const rotated=()=>[L('a',0,0,0,10),L('b',-5,0,-15,0)];
const ok=r=>assert.equal(r.ok,true,r.message),run=(e,...tokens)=>tokens.forEach(t=>ok(e.execute(t)));
const ctx=e=>copy(Object.fromEntries(['command','commandPhase','commandData','commandSelectionIds','commandPoints','prompt','lastPoint'].map(k=>[k,e.state[k]])));
const observe=(e,saved)=>({document:doc(e),selection:copy(e.state.selectionIds),context:ctx(e),revision:e.state.revision,contentDirty:JSON.stringify(doc(e))!==JSON.stringify(saved),space:copy(Object.fromEntries(['activeSpace','activeLayoutId','activeViewportId','workspace','viewport','paperViewport','camera3d'].map(k=>[k,e.state[k]]))),paperOrder:e.state.activeLayoutId?e.getPaperObjects().map(v=>v.id):[]});
const has=(entities,expected)=>expected.every(v=>{const e=entities.find(q=>q.id===v.id);return e?.type===v.type&&e.layer===v.layer&&['start','end'].every(p=>['x','y'].every(a=>e[p][a]===v[p][a]));});
const near=(a,b)=>Math.abs(a-b)<=1e-12;
const hasRotated=entities=>rotated().every(v=>{const e=entities.find(q=>q.id===v.id);return e&&['start','end'].every(p=>['x','y'].every(a=>near(e[p][a],v[p][a])));});
const reports={},errors={};
function sample(name,fn){if(reports[name])return reports[name];try{return reports[name]=fn();}catch(error){errors[name]={message:error.message,stack:error.stack};throw error;}}
function model(history=false){
  const e=createEditor({entities:[...originals(),{id:'marker',type:'CIRCLE',layer:'0',center:{x:100,y:100},radius:4}]}),saved=doc(e);assert.deepEqual(saved.entities.slice(0,2),originals());let priorRedo=null;
  if(history){ok(e.setCircleRadius('marker',5));ok(e.setCircleRadius('marker',6));priorRedo=doc(e);ok(e.undo());assert.equal(doc(e).entities.find(v=>v.id==='marker').radius,5);}
  return {e,saved,beforeCommand:doc(e),priorRedo,priorCanUndo:e.canUndo,priorCanRedo:e.canRedo};
}
function begin(e,command='COPY',options={}){ok(e.select(options.ids||['a','b']));run(e,command);if(options.single)run(e,'SINGLE');run(e,options.base||'0,0');}
function inject(e,{phase='commit',predicate,input,preparation=false}){
  const original=Object.getOwnPropertyDescriptor(e.state,'entities'),revision=e.state.revision,selection=copy(e.state.selectionIds);let backing=original.value,armed=true,fired=0,proof;
  const sentinel='Synthetic differential '+phase+' failure';
  Object.defineProperty(e.state,'entities',{configurable:true,enumerable:original.enumerable,get(){
    if(armed&&e.state.revision===revision&&predicate(backing)){
      const error=Error(sentinel),stack=error.stack;
      const phaseReady=preparation?stack.includes('planObjects'):phase==='commit'?JSON.stringify(e.state.selectionIds)===JSON.stringify(selection)&&stack.includes('commitObjects'):phase==='history'?e.state.selectionIds.length===0&&e.state.command!==null&&stack.includes('record'):e.state.command===null&&stack.includes('finish')&&stack.includes('result');
      if(phaseReady){armed=false;fired++;proof=copy({entities:backing,layouts:e.state.layouts,selection:e.state.selectionIds,context:ctx(e),revision:e.state.revision,canUndo:e.canUndo,canRedo:e.canRedo,stack});throw error;}
    }
    return backing;
  },set(value){backing=value;}});
  let response;try{response=e.execute(input);}finally{Object.defineProperty(e.state,'entities',{...original,value:backing});}
  assert.equal(fired,1,'Fault predicate must reach exactly one selected boundary.');assert.equal(response.ok,false);assert.equal(response.changed,false);assert.equal(response.message,sentinel);
  return {response,proof,fired,failedInputLog:copy(e.state.history.at(-1))};
}
function multipleSuccess(history){return sample('multiple-success-'+history,()=>{
  const m=model(history),{e,saved}=m;begin(e);run(e,'10,0','20,0','U','20,0');const accepted=observe(e,saved);run(e,'EXIT');const exited=observe(e,saved);ok(e.undo());const undone=doc(e);ok(e.redo());const redone=doc(e);
  return {before:m.beforeCommand,accepted,exited,undone,redone};
});}
function multipleFault(history){return sample('multiple-fault-'+history,()=>{
  const m=model(history),{e,saved}=m;begin(e);run(e,'10,0');const before=observe(e,saved),fault=inject(e,{predicate:a=>has(a,[...translated(10,['e1','e2']),...translated(20,['e3','e4'])]),input:'20,0'}),after=observe(e,saved);
  run(e,'20,0');const retry=observe(e,saved);run(e,'U');const localUndo=observe(e,saved);run(e,'EXIT');const exit=observe(e,saved);ok(e.undo());const undone=doc(e);ok(e.redo());const redone=doc(e);
  return {beforeCommand:m.beforeCommand,before,fault,after,retry,localUndo,exit,undone,redone};
});}
function exitFault(history){return sample('exit-fault-'+history,()=>{
  const m=model(history),{e,saved}=m;begin(e);run(e,'10,0');const before=observe(e,saved),fault=inject(e,{phase:'history',predicate:a=>has(a,translated(10,['e1','e2'])),input:'EXIT'}),after=observe(e,saved);run(e,'EXIT');const retry=observe(e,saved);ok(e.undo());const undone=doc(e);ok(e.redo());const redone=doc(e);ok(e.undo());const olderUndo=e.undo(),afterOlderUndo=doc(e);
  return {beforeCommand:m.beforeCommand,saved,before,fault,after,retry,undone,redone,olderUndo,afterOlderUndo,history};
});}
for(const history of [false,true])test(`COPY multiple successful destinations, local Undo, retry and global group: history=${history}`,()=>{
  const t=multipleSuccess(history),expected=[...t.before.entities,...translated(10,['e1','e2']),...translated(20,['e5','e6'])];assert.deepEqual(t.accepted.document.entities,expected);assert.equal(t.accepted.context.commandData.copyCount,2);assert.deepEqual(t.exited.document,t.accepted.document);assert.deepEqual(t.undone,t.before);assert.deepEqual(t.redone,t.exited.document);
});
test('failed later COPY destination restores immediate pre-batch state and retains accepted first copies',()=>{const cases=[false,true].map(multipleFault);for(const t of cases)assert.deepEqual(t.after,t.before);});
test('retry after rejected COPY leaves only accepted copies with fresh reserved IDs',()=>{for(const t of [false,true].map(multipleFault)){assert.deepEqual(t.retry.document.entities,[...t.beforeCommand.entities,...translated(10,['e1','e2']),...translated(20,['e5','e6'])]);assert.equal(t.retry.context.commandData.copyCount,2);}});
test('COPY local Undo after retry removes that accepted destination only',()=>{for(const t of [false,true].map(multipleFault)){assert.deepEqual(t.localUndo.document,t.before.document);assert.equal(t.localUndo.context.commandData.copyCount,1);assert.deepEqual(t.localUndo.context.lastPoint,{x:10,y:0});}});
test('COPY exit/global history excludes the rejected destination',()=>{for(const t of [false,true].map(multipleFault)){assert.deepEqual(t.exit.document,t.before.document);assert.deepEqual(t.undone,t.beforeCommand);assert.deepEqual(t.redone,t.before.document);}});
test('COPY retries retain existing IDs and do not reuse rejected tentative IDs',()=>{for(const t of [false,true].map(multipleFault)){assert.ok(has(t.fault.proof.entities,translated(20,['e3','e4'])));assert.ok(has(t.retry.document.entities,translated(20,['e5','e6'])));assert.ok(has(t.retry.document.entities,translated(10,['e1','e2'])));assert.deepEqual(t.retry.document.entities.slice(0,2),originals());}});
test('failed COPY Exit restores immediate pre-exit continuation and selection',()=>{for(const t of [false,true].map(exitFault))assert.deepEqual(t.after,t.before);});
test('retry COPY Exit allocates no new geometry and creates one ordinary history group',()=>{for(const t of [false,true].map(exitFault)){assert.deepEqual(t.retry.document,t.before.document);assert.equal(t.retry.context.command,null);assert.deepEqual(t.undone,t.beforeCommand);assert.deepEqual(t.redone,t.before.document);assert.equal(t.olderUndo.ok,t.history);assert.deepEqual(t.afterOlderUndo,t.saved);}});
test('locally undoing every COPY destination leaves no empty group and preserves prior Redo',()=>{
  for(const history of [false,true]){const t=sample('all-local-undo-'+history,()=>{const m=model(history),{e}=m;begin(e);run(e,'10,0','U','EXIT');const after=doc(e),canUndo=e.canUndo,canRedo=e.canRedo,redo=e.redo(),afterRedo=doc(e);return {before:m.beforeCommand,priorRedo:m.priorRedo,after,canUndo,canRedo,redo,afterRedo};});assert.deepEqual(t.after,t.before);assert.equal(t.canUndo,history);assert.equal(t.canRedo,history);assert.equal(t.redo.ok,history);if(history)assert.deepEqual(t.afterRedo,t.priorRedo);}
});
test('Escape retains an accepted COPY destination with the established global group',()=>{
  const t=sample('copy-escape',()=>{const m=model(true),{e}=m;begin(e);run(e,'10,0');const accepted=doc(e);ok(e.cancel());const after=doc(e);ok(e.undo());const undone=doc(e);ok(e.redo());return {before:m.beforeCommand,accepted,after,undone,redone:doc(e)};});assert.deepEqual(t.after,t.accepted);assert.deepEqual(t.undone,t.before);assert.deepEqual(t.redone,t.accepted);
});
function singleFault(history,phase){return sample(`single-fault-${history}-${phase}`,()=>{
  const m=model(history),{e,saved}=m;begin(e,'COPY',{single:true});const before=observe(e,saved),fault=inject(e,{phase,predicate:a=>has(a,translated(10,['e1','e2'])),input:'10,0'}),after=observe(e,saved);run(e,'10,0');const retry=observe(e,saved);ok(e.undo());const undone=doc(e);ok(e.redo());return {before,fault,after,retry,beforeCommand:m.beforeCommand,undone,redone:doc(e)};
});}
for(const history of [false,true])for(const phase of ['commit','history'])test(`COPY single rejects atomically: history=${history}, boundary=${phase}`,()=>{const t=singleFault(history,phase);assert.deepEqual(t.after,t.before);assert.deepEqual(t.retry.document.entities,[...t.beforeCommand.entities,...translated(10,['e3','e4'])]);assert.deepEqual(t.undone,t.beforeCommand);assert.deepEqual(t.redone,t.retry.document);});
for(const history of [false,true])test(`COPY single successful history and default-mode convention: history=${history}`,()=>{
  const t=sample('single-success-'+history,()=>{const m=model(history),{e}=m;begin(e,'COPY',{single:true});run(e,'10,0');const after=doc(e),lastPoint=copy(e.state.lastPoint);ok(e.undo());const undone=doc(e);ok(e.redo());const redone=doc(e);ok(e.undo());ok(e.select(['a','b']));run(e,'COPY');const defaultMode=e.state.commandData.copyMode;ok(e.cancel());return {before:m.beforeCommand,after,undone,redone,lastPoint,defaultMode};});assert.deepEqual(t.after.entities,[...t.before.entities,...translated(10,['e1','e2'])]);assert.deepEqual(t.lastPoint,{x:10,y:0});assert.deepEqual(t.undone,t.before);assert.deepEqual(t.redone,t.after);assert.equal(t.defaultMode,'multiple');
});
const routes=['mirror-keep','mirror-delete','rotate-typed','rotate-point'];
function routeStart(e,route){if(route.startsWith('mirror')){begin(e,'MIRROR',{base:'20,0'});run(e,'20,20');assert.equal(e.state.commandPhase,'delete-choice');assert.equal(Object.hasOwn(e.state.commandData,'deleteOriginal'),false);}else begin(e,'ROTATE');}
const routeInput=route=>route==='mirror-keep'?'N':route==='mirror-delete'?'Y':route==='rotate-typed'?'90':'0,10';
const routePredicate=route=>route==='mirror-keep'?a=>has(a,[...originals(),...reflected(['e1','e2'])]):route==='mirror-delete'?a=>has(a,reflected(['a','b'])):hasRotated;
function routeFault(route,history,phase){return sample(`route-fault-${route}-${history}-${phase}`,()=>{
  const m=model(history),{e,saved}=m;routeStart(e,route);const before=observe(e,saved),fault=inject(e,{phase,predicate:routePredicate(route),input:routeInput(route)}),after=observe(e,saved);const cancel=e.cancel(),afterCancel=doc(e),canUndo=e.canUndo,canRedo=e.canRedo,redo=e.redo(),afterRedo=doc(e);return {before,fault,after,cancel,afterCancel,canUndo,canRedo,redo,afterRedo,priorRedo:m.priorRedo,history};
});}
for(const route of routes)for(const phase of ['commit','history'])test(`${route} restores pre-input state at ${phase}, clean and prior history`,()=>{const cases=[false,true].map(h=>routeFault(route,h,phase));for(const t of cases){assert.deepEqual(t.after,t.before);assert.equal(t.cancel.changed,false);assert.deepEqual(t.afterCancel,t.before.document);assert.equal(t.canUndo,t.history);assert.equal(t.canRedo,t.history);if(t.history){assert.equal(t.redo.ok,true);assert.deepEqual(t.afterRedo,t.priorRedo);}}});
for(const route of routes)test(`${route} separately preserves terminal caller context on rejection`,()=>{for(const t of [false,true].map(h=>routeFault(route,h,'commit')))assert.deepEqual(t.after.context,t.before.context);});
for(const route of routes)test(`${route} successful literal geometry and caller convention`,()=>{
  const t=sample('route-success-'+route,()=>{const m=model(true),{e}=m;routeStart(e,route);run(e,routeInput(route));const after=doc(e),lastPoint=copy(e.state.lastPoint);ok(e.undo());const undone=doc(e);ok(e.redo());return {before:m.beforeCommand,after,lastPoint,undone,redone:doc(e)};});
  if(route==='mirror-keep')assert.deepEqual(t.after.entities,[...t.before.entities,...reflected(['e1','e2'])]);else if(route==='mirror-delete')assert.deepEqual(t.after.entities,[...reflected(['a','b']),...t.before.entities.slice(2)]);else {assert.ok(hasRotated(t.after.entities));const structural=entities=>entities.map(v=>v.type==='LINE'?{...v,start:{...v.start,x:0,y:0},end:{...v.end,x:0,y:0}}:v);assert.deepEqual(structural(t.after.entities),structural(t.before.entities));}
  assert.deepEqual(t.after.entities.find(v=>v.id==='marker'),t.before.entities.find(v=>v.id==='marker'));assert.deepEqual(t.lastPoint,route.startsWith('mirror')?{x:20,y:0}:route==='rotate-point'?{x:0,y:10}:{x:0,y:0});assert.deepEqual(t.undone,t.before);assert.deepEqual(t.redone,t.after);
});
function paper(){
  const e=createEditor({format:'Linecraft/1',settings:{units:'mm'},entities:[L('model',0,0,1000,0)],layouts:[{id:'sheet',name:'Synthetic paper',paper:{size:'A3',orientation:'landscape'},entities:[L('paper',5,10,45,10)],viewports:[{id:'vp1',frame:{x:20,y:30,width:100,height:60},modelCenter:{x:500,y:250,z:0},scaleDenominator:50,workspace:'2d',locked:false,plotBorder:false,layer:'0',frozenLayers:[]}]}],activeSpace:'paper',activeLayoutId:'sheet',activeViewportId:null});const saved=doc(e);assert.deepEqual(e.getPaperObjects().map(v=>v.id),['paper','@VIEWPORT/sheet/vp1']);return {e,saved};
}
const paperIDs=['paper','@VIEWPORT/sheet/vp1'];
function paperPredicate(e,command){return a=>{const target=a.find(v=>v.id===(command==='MOVE'?'paper':'e1')),view=e.state.layouts[0].viewports.find(v=>v.id===(command==='MOVE'?'vp1':'vp2'));return target?.start.x===(command==='MOVE'?15:155)&&target.start.y===(command==='MOVE'?25:10)&&view?.frame.x===(command==='MOVE'?30:170)&&view.frame.y===(command==='MOVE'?45:30);};}
function paperFault(command){return sample('paper-fault-'+command,()=>{const {e,saved}=paper();begin(e,command,{ids:paperIDs});const before=observe(e,saved),fault=inject(e,{predicate:paperPredicate(e,command),input:command==='MOVE'?'@10,15':'@150,0'}),after=observe(e,saved);return {before,fault,after};});}
for(const command of ['MOVE','COPY'])test(`mixed paper LINE/viewport ${command} rejects without changing document, tokens or order`,()=>{const t=paperFault(command);assert.deepEqual(t.after,t.before);});
test('mixed paper MOVE keeps exact model/view metadata and stable token/order through history',()=>{
  const t=sample('paper-success-MOVE',()=>{const {e,saved}=paper();begin(e,'MOVE',{ids:paperIDs});run(e,'@10,15');const after=observe(e,saved);ok(e.undo());const undone=observe(e,saved);ok(e.redo());return {before:saved,after,undone,redone:observe(e,saved)};});assert.deepEqual(t.after.document.layouts[0].entities[0],L('paper',15,25,55,25));assert.deepEqual(t.after.document.layouts[0].viewports,[{...t.before.layouts[0].viewports[0],frame:{x:30,y:45,width:100,height:60}}]);assert.deepEqual(t.after.document.entities,t.before.entities);assert.deepEqual(t.after.document.layouts[0].viewports[0].modelCenter,{x:500,y:250,z:0});assert.deepEqual(t.after.paperOrder,paperIDs);assert.deepEqual(t.undone.document,t.before);assert.deepEqual(t.redone.document,t.after.document);assert.deepEqual(t.redone.paperOrder,t.after.paperOrder);
});
test('mixed paper COPY preserves tokens/order and never reuses undone entity/viewport reservations',()=>{
  const t=sample('paper-success-COPY',()=>{const {e,saved}=paper();begin(e,'COPY',{ids:paperIDs});run(e,'@150,0','EXIT');const after=observe(e,saved);ok(e.undo());const undone=observe(e,saved);ok(e.redo());const redone=observe(e,saved);ok(e.undo());begin(e,'COPY',{ids:paperIDs});run(e,'@150,0','EXIT');return {before:saved,after,undone,redone,replaced:observe(e,saved)};});
  assert.deepEqual(t.after.document.layouts[0].entities,[L('paper',5,10,45,10),L('e1',155,10,195,10)]);assert.deepEqual(t.after.document.layouts[0].viewports,[t.before.layouts[0].viewports[0],{...t.before.layouts[0].viewports[0],id:'vp2',frame:{x:170,y:30,width:100,height:60}}]);assert.deepEqual(t.after.paperOrder,[...paperIDs,'e1','@VIEWPORT/sheet/vp2']);assert.deepEqual(t.after.document.entities,t.before.entities);assert.deepEqual(t.undone.document,t.before);assert.deepEqual(t.redone.document,t.after.document);assert.deepEqual(t.redone.paperOrder,t.after.paperOrder);assert.deepEqual(t.replaced.paperOrder,[...paperIDs,'e2','@VIEWPORT/sheet/vp3']);
});
function publication(history){return sample('post-publication-'+history,()=>{
  const m=model(history),{e,saved}=m;begin(e,'MOVE');const before=observe(e,saved),fault=inject(e,{phase:'publication',predicate:a=>has(a,[L('a',5,7,15,7),L('b',5,12,5,22)]),input:'5,7'}),after=observe(e,saved),canUndoImmediately=e.canUndo,canRedoImmediately=e.canRedo;const cancel=e.cancel(),afterCancel=doc(e),canUndo=e.canUndo,canRedo=e.canRedo,redo=e.redo(),afterRedo=doc(e),undo=e.undo(),afterUndo=doc(e);return {before,fault,after,canUndoImmediately,canRedoImmediately,cancel,afterCancel,canUndo,canRedo,redo,afterRedo,undo,afterUndo,priorRedo:m.priorRedo,history};
});}
for(const history of [false,true])test(`post-publication completion fault restores pre-input state: history=${history}`,()=>{const t=publication(history);assert.equal(t.fault.proof.context.command,null);assert.equal(t.fault.proof.canUndo,true);assert.equal(t.fault.proof.canRedo,false);assert.deepEqual(t.after,t.before);});
test('post-publication rejection restores actual history entries, not just document bytes',()=>{for(const t of [false,true].map(publication)){assert.equal(t.cancel.changed,false);assert.deepEqual(t.afterCancel,t.before.document);assert.equal(t.canUndo,t.history);assert.equal(t.canRedo,t.history);if(t.history){assert.equal(t.redo.ok,true);assert.deepEqual(t.afterRedo,t.priorRedo);}}});
test('a pre-assignment preparation read fault leaves state and prior history intact',()=>{
  for(const history of [false,true]){const t=sample('preparation-'+history,()=>{const m=model(history),{e,saved}=m;begin(e,'MOVE');const before=observe(e,saved),fault=inject(e,{phase:'preparation',preparation:true,predicate:a=>has(a,originals()),input:'5,7'}),after=observe(e,saved);const cancel=e.cancel(),canUndo=e.canUndo,canRedo=e.canRedo;return {before,fault,after,cancel,canUndo,canRedo};});assert.deepEqual(t.after,t.before);assert.equal(t.cancel.changed,false);assert.equal(t.canUndo,history);assert.equal(t.canRedo,history);}
});
function rejectedSingleCancel(history,phase){return sample(`single-cancel-${history}-${phase}`,()=>{
  const m=model(history),{e,saved}=m;begin(e,'COPY',{single:true});const before=observe(e,saved),fault=inject(e,{phase,predicate:a=>has(a,translated(10,['e1','e2'])),input:'10,0'}),cancel=e.cancel(),afterCancel=doc(e),canUndo=e.canUndo,canRedo=e.canRedo,redo=e.redo(),afterRedo=doc(e),undo=e.undo(),afterUndo=doc(e),olderUndo=e.undo(),afterOlderUndo=doc(e);return {before,fault,cancel,afterCancel,canUndo,canRedo,redo,afterRedo,undo,afterUndo,olderUndo,afterOlderUndo,priorRedo:m.priorRedo,saved,history};
});}
test('rejected COPY single then Cancel preserves the actual old history branch without retry',()=>{
  const cases=[false,true].flatMap(history=>['commit','history'].map(phase=>rejectedSingleCancel(history,phase)));for(const t of cases){assert.equal(t.cancel.changed,false);assert.deepEqual(t.afterCancel,t.before.document);assert.equal(t.canUndo,t.history);assert.equal(t.canRedo,t.history);assert.equal(t.redo.ok,t.history);assert.equal(t.undo.ok,t.history);if(t.history){assert.deepEqual(t.afterRedo,t.priorRedo);assert.deepEqual(t.afterUndo,t.before.document);assert.equal(t.olderUndo.ok,true);assert.deepEqual(t.afterOlderUndo,t.saved);}else {assert.equal(t.olderUndo.ok,false);assert.deepEqual(t.afterUndo,t.saved);}}
});
function rejectedMultipleUnwind(history){return sample('multiple-rejected-unwind-'+history,()=>{
  const m=model(history),{e,saved}=m;begin(e);run(e,'10,0');const before=observe(e,saved),fault=inject(e,{predicate:a=>has(a,[...translated(10,['e1','e2']),...translated(20,['e3','e4'])]),input:'20,0'});run(e,'U','EXIT');const after=doc(e),canUndo=e.canUndo,canRedo=e.canRedo,redo=e.redo(),afterRedo=doc(e),undo=e.undo(),afterUndo=doc(e);return {before,fault,after,canUndo,canRedo,redo,afterRedo,undo,afterUndo,beforeCommand:m.beforeCommand,priorRedo:m.priorRedo,saved,history};
});}
test('unwinding the accepted COPY destination after later rejection preserves the pre-command history',()=>{
  const cases=[false,true].map(rejectedMultipleUnwind);for(const t of cases){assert.deepEqual(t.after,t.beforeCommand);assert.equal(t.canUndo,t.history);assert.equal(t.canRedo,t.history);assert.equal(t.redo.ok,t.history);assert.equal(t.undo.ok,t.history);if(t.history){assert.deepEqual(t.afterRedo,t.priorRedo);assert.deepEqual(t.afterUndo,t.beforeCommand);}else assert.deepEqual(t.afterUndo,t.saved);}
});
test('reference inventory and one-shot proof/error-log guards are complete',()=>{
  assert.equal(Object.keys(errors).length,0);assert.equal(Object.keys(reports).length,49);
  for(const t of Object.values(reports))if(t.fault){assert.equal(t.fault.fired,1);assert.equal(t.fault.failedInputLog.ok,false);assert.ok(t.fault.proof.stack.includes('core.mjs'));}
});
after(()=>{if(process.env.LINECRAFT_REFERENCE_REPORT){const target=process.env.LINECRAFT_REFERENCE_REPORT;assert.ok(path.isAbsolute(target));fs.writeFileSync(target,JSON.stringify({format:'LinecraftTransformDifferentialReference/1',runtime:{node:process.version,platform:process.platform,arch:process.arch},faultModel:'Artificial one-shot per-editor synchronous state-read faults at declared preparation/commit/pre-Undo/post-publication completion boundaries; no OOM/persistent/private-stack mutation or natural-input claim.',reports,errors},null,2)+'\n',{flag:'wx'});}});
