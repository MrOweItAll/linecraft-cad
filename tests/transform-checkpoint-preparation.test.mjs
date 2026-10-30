import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEditor} from '../core.mjs';
const L=(id,x1,y1,x2,y2)=>({id,type:'LINE',layer:'0',start:{x:x1,y:y1},end:{x:x2,y:y2}});
const originals=()=>[L('a',0,0,10,0),L('b',0,5,0,15)];
const doc=e=>JSON.parse(e.serialize()),ok=r=>assert.equal(r.ok,true,r.message);
const run=(e,...tokens)=>tokens.forEach(token=>ok(e.execute(token)));
const keys=['selectionIds','command','commandPhase','commandData','commandSelectionIds','commandPoints','prompt','lastPoint','revision','activeSpace','activeLayoutId','activeViewportId','viewport','paperViewport','camera3d','workspace'];
const observe=e=>({document:doc(e),context:structuredClone(Object.fromEntries(keys.map(key=>[key,e.state[key]])))});
const reports={};
function fixture(history=true){const e=createEditor({entities:[...originals(),{id:'marker',type:'CIRCLE',layer:'0',center:{x:100,y:100},radius:4}]}),saved=doc(e);let priorRedo=null;if(history){ok(e.setCircleRadius('marker',5));ok(e.setCircleRadius('marker',6));priorRedo=doc(e);ok(e.undo());}return {e,saved,beforeCommand:doc(e),priorRedo,history};}
function begin(e,command){ok(e.select(['a','b']));run(e,command,'0,0');}
function reject(e,input,field='entities'){
  const descriptor=Object.getOwnPropertyDescriptor(e.state,field);let value=descriptor.value,fired=0,proof;
  const sentinel='Synthetic checkpoint preparation failure';
  Object.defineProperty(e.state,field,{configurable:true,enumerable:descriptor.enumerable,get(){if(fired===0){fired++;proof={stack:Error().stack,command:e.state.command,phase:e.state.commandPhase,lastPoint:structuredClone(e.state.lastPoint),deleteOriginalOwned:Object.hasOwn(e.state.commandData,'deleteOriginal')};throw Error(sentinel);}return value;},set(next){value=next;}});
  let response;try{response=e.execute(input);}finally{Object.defineProperty(e.state,field,{...descriptor,value});}
  assert.equal(fired,1);assert.equal(response.ok,false);assert.equal(response.changed,false);assert.equal(response.message,sentinel);assert.equal(e.state.history.at(-1).ok,false);return {field,fired,proof,response};
}
function capture(name,m,input,field='entities'){const before=observe(m.e),fault=reject(m.e,input,field),after=observe(m.e);return reports[name]={before,fault,after};}
function unchanged(t){assert.deepEqual(t.after,t.before);assert.ok(t.fault.proof.stack.includes('transformAttempt'),'Fault must occur in checkpoint preparation.');assert.ok(!t.fault.proof.stack.includes('completeTransform'),'Checkpoint must reject before terminal callback.');}
function oldHistory(m){const {e}=m;ok(e.cancel());assert.deepEqual(doc(e),m.beforeCommand);assert.equal(e.canUndo,m.history);assert.equal(e.canRedo,m.history);const redo=e.redo();assert.equal(redo.ok,m.history);if(m.history){assert.deepEqual(doc(e),m.priorRedo);ok(e.undo());assert.deepEqual(doc(e),m.beforeCommand);ok(e.undo());assert.deepEqual(doc(e),m.saved);}}
test('MOVE checkpoint preparation rejects unchanged in clean and prior-history contexts',()=>{
 const cases=[false,true].map(history=>{const m=fixture(history);begin(m.e,'MOVE');return {m,t:capture('move-'+history,m,'5,7')};});for(const {m,t} of cases){unchanged(t);oldHistory(m);}
});
test('point ROTATE preparation rejects before lastPoint changes and preserves owned undefined',()=>{
 const m=fixture();begin(m.e,'ROTATE');m.e.state.commandData.ownedUndefined=undefined;const t=capture('rotate',m,'0,10');unchanged(t);assert.deepEqual(t.fault.proof.lastPoint,{x:0,y:0});assert.ok(Object.hasOwn(m.e.state.commandData,'ownedUndefined'));oldHistory(m);
});
test('MIRROR preparation rejects before either terminal deletion choice is written',()=>{
 const cases=['N','Y'].map(choice=>{const m=fixture();begin(m.e,'MIRROR');run(m.e,'0,10');return {m,t:capture('mirror-'+choice,m,choice)};});for(const {m,t} of cases){unchanged(t);assert.equal(t.fault.proof.deleteOriginalOwned,false);oldHistory(m);}
});
test('later COPY preparation retains accepted copies and does not allocate tentative IDs',()=>{
 const m=fixture(),{e}=m;begin(e,'COPY');run(e,'10,0');const t=capture('copy-destination',m,'20,0');const afterReject=observe(e);run(e,'20,0');const retry=doc(e);run(e,'U','U','EXIT');const unwound=doc(e),canRedo=e.canRedo;ok(e.redo());const redone=doc(e);unchanged(t);assert.deepEqual(afterReject,t.before);assert.deepEqual(retry.entities,[...m.beforeCommand.entities,L('e1',10,0,20,0),L('e2',10,5,10,15),L('e3',20,0,30,0),L('e4',20,5,20,15)]);assert.deepEqual(unwound,m.beforeCommand);assert.equal(canRedo,true);assert.deepEqual(redone,m.priorRedo);
});
test('COPY Exit preparation retains continuation and prior history after local unwind',()=>{
 const m=fixture(),{e}=m;begin(e,'COPY');run(e,'10,0');const t=capture('copy-exit',m,'EXIT');run(e,'U','EXIT');const after=doc(e);ok(e.redo());const redone=doc(e);unchanged(t);assert.deepEqual(after,m.beforeCommand);assert.deepEqual(redone,m.priorRedo);
});
test('late checkpoint capture failure rejects without publishing a partial checkpoint',()=>{
 const m=fixture();begin(m.e,'MOVE');const t=capture('late-revision',m,'5,7','revision');unchanged(t);oldHistory(m);
});
test('normal completion ignores unrelated UI callback data and keeps literal geometry/history',()=>{
 const m=fixture(),{e}=m;e.state.unrelatedUICallback=()=>42;begin(e,'MOVE');run(e,'5,7');const after=doc(e);ok(e.undo());const undone=doc(e);ok(e.redo());const redone=doc(e);reports.control={after,undone,redone};assert.deepEqual(after.entities,[L('a',5,7,15,7),L('b',5,12,5,22),m.beforeCommand.entities[2]]);assert.deepEqual(undone,m.beforeCommand);assert.deepEqual(redone,after);assert.equal(e.state.unrelatedUICallback(),42);
});
test('checkpoint preparation reference inventory is complete',()=>{assert.deepEqual(Object.keys(reports).sort(),['move-false','move-true','rotate','mirror-N','mirror-Y','copy-destination','copy-exit','late-revision','control'].sort());});
after(()=>{const target=process.env.LINECRAFT_PREPARATION_REPORT;if(target){assert.ok(path.isAbsolute(target));fs.writeFileSync(target,JSON.stringify({format:'LinecraftCheckpointPreparationReference/1',reports},null,2)+'\n',{flag:'wx'});}});
