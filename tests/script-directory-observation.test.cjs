'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyReferencePattern,validateObservation}=require('../tools/script-directory-observation.cjs');
const reference=require('./fixtures/script-directory-observation.json'),fresh=()=>structuredClone(reference);
test('supported metadata pattern never establishes privacy or runtime admission',()=>{
 assert.deepEqual(classifyReferencePattern(fresh()),{supportedReferencePattern:true,privacyEstablished:false,reasons:[]});
 const second=structuredClone(reference.directories[0]);second.ordinal=1;second.security.protected=false;for(const a of second.security.aces)a.flags=19;
 const v=fresh();v.directories.push(second);assert.equal(classifyReferencePattern(v).supportedReferencePattern,true);
});
const cases=[
 ['foreign owner',v=>v.directories[0].security.ownerRole='other','unsupported-owner'],
 ['unknown owner',v=>v.directories[0].security.ownerRole='unknown','unsupported-owner'],
 ['foreign trustee',v=>v.directories[0].security.aces[1].role='other','unsupported-ace'],
 ['unknown trustee',v=>v.directories[0].security.aces[1].role='unknown','unsupported-ace'],
 ['null or absent DACL',v=>{v.directories[0].security.daclState='unrestricted-or-absent';v.directories[0].security.aces=[];},'unsupported-dacl'],
 ['empty DACL',v=>{v.directories[0].security.daclState='empty';v.directories[0].security.aces=[];},'unsupported-dacl'],
 ['unknown DACL',v=>{v.directories[0].security.daclState='unknown';v.directories[0].security.aces=[];},'unsupported-dacl'],
 ['noncanonical DACL',v=>v.directories[0].security.canonical=false,'unsupported-dacl'],
 ['deny ACE',v=>v.directories[0].security.aces[1].type='deny','unsupported-ace'],
 ['object ACE',v=>v.directories[0].security.aces[1].type='unsupported','unsupported-ace'],
 ['callback ACE',v=>v.directories[0].security.aces[1].callback=true,'unsupported-ace'],
 ['generic access mask',v=>v.directories[0].security.aces[1].mask=268435456,'unsupported-ace'],
 ['partial owner rights',v=>v.directories[0].security.aces[0].mask=1179785,'no-applicable-owner-full-control'],
 ['inherit-only owner rights',v=>v.directories[0].security.aces[0].flags=11,'no-applicable-owner-full-control'],
 ['no-propagate flag',v=>v.directories[0].security.aces[1].flags=7,'unsupported-ace'],
 ['unknown ACE flag',v=>v.directories[0].security.aces[1].flags=64,'unsupported-ace'],
 ['reparse observation',v=>v.directories[0].reparse=true,'unsupported-path-object'],
 ['nondirectory observation',v=>v.directories[0].isDirectory=false,'unsupported-path-object'],
 ['network volume',v=>v.volume.driveType='network','unsupported-volume'],
 ['unsupported filesystem',v=>v.volume.fileSystem='FAT32','unsupported-volume'],
 ['incomplete boundary',v=>v.boundary.complete=false,'incomplete-boundary']
];
for(const [name,change,reason] of cases)test('reference rejects '+name,()=>{const v=fresh();change(v);const r=classifyReferencePattern(v);assert.equal(r.supportedReferencePattern,false);assert.equal(r.privacyEstablished,false);assert.ok(r.reasons.includes(reason));});
test('schema rejects contradictory, polluted or unbounded observations without echoing them',()=>{
 const bad=[v=>v.extra='private sentinel',v=>v.boundary.handleBound=true,v=>v.directories[0].ordinal=1,v=>v.directories[0].security.daclState='empty',v=>v.directories[0].security.aces[0].mask=-1,v=>v.directories[0].security.aces[0].flags=256,v=>v.directories[0].security.aces.length=129,v=>v.directories.length=33,v=>delete v.directories[0],v=>v.directories[0].security.aces.ownerSid='private sentinel',v=>Object.defineProperty(v,'scope',{get(){throw Error('getter must not execute');}}),v=>Object.setPrototypeOf(v,{}),v=>{delete v.directories[0];v.directories[Symbol('private sentinel')]=null;},v=>Object.defineProperty(v.directories,'0',{get(){throw Error('array getter must not execute');}})];
 for(const change of bad){const v=fresh();change(v);assert.throws(()=>validateObservation(v),e=>e.code==='ERR_LINECRAFT_OBSERVATION'&&!e.message.includes('private sentinel'));}
});
