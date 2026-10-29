'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const reference=require('./fixtures/frozen-release-identity.json');
const source=fs.readFileSync(path.join(__dirname,'../tools/frozen-release-identity.cjs'),'utf8');
const faults=[],moduleRecord={exports:{}};
function deny(){faults.push('ambient operation');throw Error('Pure planner accessed an unavailable capability.');}
vm.runInNewContext(source,{module:moduleRecord,exports:moduleRecord.exports,require:deny,process:undefined,Date:undefined,console:{log:deny,error:deny},fetch:undefined},{filename:'pure-frozen-release-identity.cjs',timeout:1000});
const {planFrozenReleaseIdentity:plan}=moduleRecord.exports;
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function check(input,expected){
 const snapshot=structuredClone(input);freeze(input);const result=plan(input);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),expected);assert.deepEqual(input,snapshot);
 assert.deepEqual(faults,[]);return result;
}
test('literal historical tag tuple returns exact independent names and metadata',()=>{
 check(structuredClone(reference.tagInput),{...reference.expectedCommon,...reference.expectedTag});
});
test('literal preflight tuple has no verification tag and needs no tag commit',()=>{
 check(structuredClone(reference.preflightInput),{...reference.expectedCommon,...reference.expectedPreflight});
});
test('matching alternate HEAD and tag commit remain valid',()=>{
 check({...reference.tagInput,head:reference.alternateHead,tagCommit:reference.alternateHead},{...reference.expectedCommon,...reference.expectedTag,commit:reference.alternateHead});
});
test('preflight ignores an unused tag commit without changing its canonical tag',()=>{
 check({...reference.preflightInput,tagCommit:reference.alternateHead},{...reference.expectedCommon,...reference.expectedPreflight});
});
for(const entry of reference.negativeCases)test('frozen planner API rejects '+entry.id,()=>{
 const input={...structuredClone(reference.tagInput),...structuredClone(entry.patch)};if(entry.delete)delete input[entry.delete];
 const snapshot=structuredClone(input);freeze(input);
 assert.throws(()=>plan(input),error=>error.code==='ERR_LINECRAFT_RELEASE_IDENTITY'&&/^Frozen release identity mismatch: [a-z ]+\.$/.test(error.message));
 assert.deepEqual(input,snapshot);assert.deepEqual(faults,[]);
});
test('non-record inputs fail with a fixed identity error',()=>{
 for(const input of [null,undefined,[],17])assert.throws(()=>plan(input),error=>error.code==='ERR_LINECRAFT_RELEASE_IDENTITY');
 assert.deepEqual(faults,[]);
});
test('each plan returns fresh immutable data without a publication authority flag',()=>{
 const input=freeze(structuredClone(reference.tagInput)),first=plan(input),second=plan(input);
 assert.notEqual(first,second);assert.notEqual(first.payloadAssets,second.payloadAssets);
 for(const value of [first,first.payloadAssets,first.uploadAssets])assert.equal(Object.isFrozen(value),true);
 assert.equal(Object.hasOwn(first,'publicationAllowed'),false);assert.deepEqual(faults,[]);
});
