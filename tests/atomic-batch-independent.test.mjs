import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';

// Artificial synchronous state-read fault, after a proven accepted mutation.
// This does not model a malformed drawing or claim renderer/native acceptance.
const copy=value=>structuredClone(value);
const line=(id,x1,y1,x2,y2)=>({id,type:'LINE',layer:'0',start:{x:x1,y:y1},end:{x:x2,y:y2}});
const fixture=()=>[line('target',-20,0,120,0),line('left',0,-40,0,40),line('right',100,-40,100,40),line('second',-20,20,120,20)];
const fence=[{x:-10,y:-20},{x:-10,y:40}];
const document=e=>JSON.parse(e.serialize());
const ok=response=>assert.equal(response.ok,true,response.message);
const run=(e,...tokens)=>tokens.forEach(token=>ok(e.execute(token)));
const command=e=>copy(Object.fromEntries(['command','commandPhase','commandData','commandSelectionIds','commandPoints','prompt','lastPoint'].map(key=>[key,e.state[key]])));
const observe=(e,saved)=>({document:document(e),selection:copy(e.state.selectionIds),command:command(e),revision:e.state.revision,contentDirty:JSON.stringify(document(e))!==JSON.stringify(saved)});

function prepared(history=false){
  const e=createEditor({entities:fixture()}),saved=document(e);
  assert.deepEqual(saved.entities,fixture());
  let afterA,afterB;
  if(history){
    run(e,'L','200,100','210,100','');afterA=document(e);
    run(e,'L','200,120','210,120','');afterB=document(e);
    assert.deepEqual(afterA.entities.at(-1),line('e1',200,100,210,100));
    assert.deepEqual(afterB.entities.at(-1),line('e2',200,120,210,120));
    ok(e.undo());assert.deepEqual(document(e),afterA);
  }
  return {e,saved,afterA,afterB};
}

function failAfterFirstMutation(e,{erase=false,expectedEndX=120}={}){
  const original=Object.getOwnPropertyDescriptor(e.state,'entities'),revision=e.state.revision;
  let backing=original.value,armed=true,fired=0,proof;
  const sentinel='Synthetic mid-batch read failure';
  Object.defineProperty(e.state,'entities',{
    configurable:true,enumerable:original.enumerable,
    get(){
      const first=backing.find(v=>v.id==='target'),second=backing.find(v=>v.id==='second');
      if(armed&&e.state.revision===revision+1&&(erase?!first:first?.start.x===0)&&second?.start.x===-20){
        armed=false;fired++;
        proof=copy({first:first??null,second,revision:e.state.revision});
        throw Error(sentinel);
      }
      return backing;
    },
    set(value){backing=value;}
  });
  let response;
  try{response=e.trimFence(fence,erase?{erase:true}:{});}
  finally{Object.defineProperty(e.state,'entities',{...original,value:backing});}
  assert.equal(fired,1,'Fault must occur once after an accepted mutation.');
  assert.equal(response.ok,false);assert.equal(response.message,sentinel);
  assert.equal(proof.revision,revision+1);
  assert.deepEqual(proof.second,line('second',-20,20,120,20));
  if(erase)assert.equal(proof.first,null);
  else{assert.deepEqual(proof.first.start,{x:0,y:0});assert.equal(proof.first.end.x,expectedEndX);}
  return response;
}

for(const erase of [false,true])for(const history of [false,true]){
  test(`failed ${erase?'erase':'trim'} fence restores pre-batch state and ${history?'prior Undo/Redo':'empty history'}`,()=>{
    const {e,saved,afterA,afterB}=prepared(history);
    run(e,'TR');ok(e.select(['target','second']));const before=observe(e,saved);
    assert.equal(before.contentDirty,history);
    failAfterFirstMutation(e,{erase});const after=observe(e,saved);
    assert.deepEqual(after,before);
    assert.deepEqual(after.document.entities.slice(0,4),fixture());
    assert.equal(e.execute('U').ok,false,'Failed batch adds no local Undo step.');
    assert.deepEqual(document(e),before.document);
    ok(e.cancel());assert.deepEqual(document(e),before.document);
    assert.equal(e.canUndo,history);assert.equal(e.canRedo,history);
    if(history){ok(e.redo());assert.deepEqual(document(e),afterB);ok(e.undo());assert.deepEqual(document(e),afterA);ok(e.undo());assert.deepEqual(document(e),saved);}
    else{assert.equal(e.undo().ok,false);assert.equal(e.redo().ok,false);}
  });
}

for(const erase of [false,true]){
  test(`successful ${erase?'erase':'trim'} fence keeps local and single global Undo/Redo semantics`,()=>{
    const {e,saved}=prepared();run(e,'TR');ok(e.select(['target','second']));
    const before=document(e),expected=fixture();
    if(erase){expected.splice(3,1);expected.splice(0,1);}else{expected[0].start.x=0;expected[3].start.x=0;}
    ok(e.trimFence(fence,erase?{erase:true}:{}));const accepted=document(e);
    assert.deepEqual(accepted.entities,expected);
    assert.deepEqual(e.state.selectionIds,erase?[]:['target','second']);
    assert.notDeepEqual(accepted,saved);
    ok(e.execute('U'));assert.deepEqual(document(e),before);
    ok(e.trimFence(fence,erase?{erase:true}:{}));ok(e.cancel());
    assert.deepEqual(document(e),accepted);
    ok(e.undo());assert.deepEqual(document(e),before);
    ok(e.redo());assert.deepEqual(document(e),accepted);
    ok(e.undo());assert.equal(e.undo().ok,false,'Successful fence creates only one global entry.');
  });
}

test('failed later fence retains an earlier accepted trim and its existing local Undo',()=>{
  const {e,saved}=prepared();run(e,'TR');ok(e.trimPick({x:110,y:0},{entityId:'target'}));ok(e.select(['target','second']));
  const before=observe(e,saved);assert.deepEqual(before.document.entities[0].end,{x:100,y:0});
  failAfterFirstMutation(e,{expectedEndX:100});assert.deepEqual(observe(e,saved),before);
  ok(e.execute('U'));assert.deepEqual(document(e).entities,fixture());
});

test('invalid fence is rejected before mutation and adds no history',()=>{
  const {e,saved}=prepared();run(e,'TR');ok(e.select(['target','second']));const before=observe(e,saved);
  assert.equal(e.trimFence([{x:0,y:0},{x:Infinity,y:0}]).ok,false);
  assert.deepEqual(observe(e,saved),before);ok(e.cancel());assert.equal(e.canUndo,false);assert.equal(e.canRedo,false);
});
