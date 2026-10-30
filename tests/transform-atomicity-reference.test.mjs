import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';

// Pending failure-recovery contract: five expected failures on beta8.
// Explicit only; this is not a selected passing candidate gate.
// Faults are artificial per-editor read exceptions after full geometry assignment.
const copy=value=>structuredClone(value);
const line=(id,x1,y1,x2,y2)=>({id,type:'LINE',layer:'0',start:{x:x1,y:y1},end:{x:x2,y:y2}});
const initial=()=>[line('a',0,0,10,0),line('b',0,5,0,15)];
const moved=()=>[line('a',5,7,15,7),line('b',5,12,5,22)];
const document=e=>JSON.parse(e.serialize());
const ok=response=>assert.equal(response.ok,true,response.message);
const run=(e,...tokens)=>tokens.forEach(token=>ok(e.execute(token)));
const context=e=>copy(Object.fromEntries(['command','commandPhase','commandData','commandSelectionIds','commandPoints','prompt','lastPoint'].map(key=>[key,e.state[key]])));
const observe=(e,saved)=>({document:document(e),selection:copy(e.state.selectionIds),context:context(e),revision:e.state.revision,contentDirty:JSON.stringify(document(e))!==JSON.stringify(saved)});
function prepared(history=false){
  const e=createEditor({entities:initial()}),saved=document(e);assert.deepEqual(saved.entities,initial());let afterA,afterB;
  if(history){run(e,'L','200,100','210,100','');afterA=document(e);assert.deepEqual(afterA.entities.at(-1),line('e1',200,100,210,100));run(e,'L','200,120','210,120','');afterB=document(e);assert.deepEqual(afterB.entities.at(-1),line('e2',200,120,210,120));ok(e.undo());assert.deepEqual(document(e),afterA);}
  return {e,saved,afterA,afterB};
}
function start(e,command='MOVE'){ok(e.select(['a','b']));run(e,command,'0,0');}
function rejectedMove(history,phase){
  const state=prepared(history),{e,saved}=state;start(e);const before=observe(e,saved);
  const original=Object.getOwnPropertyDescriptor(e.state,'entities');let backing=original.value,armed=true,count=0,proof;
  const sentinel='Synthetic MOVE '+phase+' failure';
  Object.defineProperty(e.state,'entities',{
    configurable:true,enumerable:original.enumerable,
    get(){
      const a=backing.find(v=>v.id==='a'),b=backing.find(v=>v.id==='b');
      const geometry=a?.start.x===5&&a.start.y===7&&a.end.x===15&&a.end.y===7&&b?.start.x===5&&b.start.y===12&&b.end.x===5&&b.end.y===22;
      const selected=phase==='commit'?e.state.selectionIds.join(',')==='a,b':e.state.selectionIds.length===0;
      if(armed&&geometry&&selected&&e.state.revision===before.revision){armed=false;count++;const error=Error(sentinel);proof=copy({entities:backing,selection:e.state.selectionIds,revision:e.state.revision,stack:error.stack});throw error;}
      return backing;
    },set(value){backing=value;}
  });
  let response;
  try{response=e.execute('5,7');}
  finally{Object.defineProperty(e.state,'entities',{...original,value:backing});}
  assert.equal(count,1);assert.equal(response.ok,false);assert.equal(response.changed,false);assert.equal(response.message,sentinel);
  assert.deepEqual(proof.entities.slice(0,2),moved());assert.equal(proof.revision,before.revision);
  assert.deepEqual(proof.selection,phase==='commit'?['a','b']:[]);
  assert.ok(proof.stack.includes(phase==='commit'?'commitObjects':'record'));
  if(phase==='history')assert.ok(proof.stack.includes('finish'));
  const after=observe(e,saved),cancel=e.cancel(),afterCancel=document(e),canUndo=e.canUndo,canRedo=e.canRedo,redo=e.redo(),afterRedo=document(e);
  return {...state,before,after,cancel,afterCancel,canUndo,canRedo,redo,afterRedo};
}

for(const history of [false,true])for(const phase of ['commit','history']){
  test(`rejected MOVE restores state at ${phase} boundary with ${history?'prior':'empty'} history`,()=>{
    const s=rejectedMove(history,phase);assert.equal(s.before.contentDirty,history);assert.deepEqual(s.after,s.before);
  });
}
test('Cancel after a rejected MOVE records no new edit and preserves the previous Redo branch',()=>{
  const cases=[false,true].flatMap(history=>['commit','history'].map(phase=>rejectedMove(history,phase)));assert.equal(cases.length,4);
  for(const s of cases){assert.equal(s.cancel.changed,false);assert.deepEqual(s.afterCancel,s.before.document);assert.equal(s.canUndo,Boolean(s.afterA));assert.equal(s.canRedo,Boolean(s.afterB));if(s.afterB){assert.equal(s.redo.ok,true);assert.deepEqual(s.afterRedo,s.afterB);}else assert.equal(s.redo.ok,false);}
});
for(const history of [false,true]){
  test(`successful MOVE preserves geometry and ordinary Undo/Redo with ${history?'prior':'empty'} history`,()=>{
    const {e,saved,afterA}=prepared(history);start(e);const before=document(e);run(e,'5,7');const after=document(e);
    assert.deepEqual(after.entities.slice(0,2),moved());assert.deepEqual(e.state.selectionIds,[]);assert.equal(e.state.command,null);assert.equal(e.canRedo,false);
    if(history)assert.deepEqual(after.entities.at(-1),line('e1',200,100,210,100));
    ok(e.undo());assert.deepEqual(document(e),before);ok(e.redo());assert.deepEqual(document(e),after);ok(e.undo());assert.equal(e.undo().ok,history);assert.deepEqual(document(e),saved);if(history)assert.deepEqual(before,afterA);
  });
}
test('invalid MOVE input fails before mutation and preserves both history contexts',()=>{
  for(const history of [false,true]){const {e,saved,afterB}=prepared(history);start(e);const before=observe(e,saved);assert.equal(e.execute('Infinity,0').ok,false);assert.deepEqual(observe(e,saved),before);assert.equal(e.cancel().changed,false);assert.equal(e.canUndo,history);assert.equal(e.canRedo,history);if(history){ok(e.redo());assert.deepEqual(document(e),afterB);}}
});
test('typed ROTATE 90 retains literal geometry and one ordinary Undo/Redo group',()=>{
  const {e,saved}=prepared();start(e,'ROTATE');run(e,'90');const after=document(e),expected=[{start:{x:0,y:0},end:{x:0,y:10}},{start:{x:-5,y:0},end:{x:-15,y:0}}];
  for(let i=0;i<2;i++){assert.equal(after.entities[i].id,initial()[i].id);for(const point of ['start','end'])for(const axis of ['x','y'])assert.ok(Math.abs(after.entities[i][point][axis]-expected[i][point][axis])<=1e-12);}
  ok(e.undo());assert.deepEqual(document(e),saved);ok(e.redo());assert.deepEqual(document(e),after);ok(e.undo());assert.equal(e.undo().ok,false);
});
