'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {loadManifest,sha}=require('../tools/source-manifest.cjs'),root=path.resolve(__dirname,'..'),work=path.join(root,'work');
test('unreviewed candidate runtime drift fails while immutable baseline remains unchanged',()=>{
 fs.mkdirSync(work,{recursive:true});const bytes=fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json')),base=JSON.parse(bytes),file=path.join(work,'invalid-candidate-'+randomUUID()+'.json');
 const bad={...base,format:'LinecraftCandidateSource/1',version:'1.36.1-test',baselineCommit:'f37aba5ebe19f27088847cd8f983ecf5facf8eac',baselineManifestSHA256:sha(bytes),reviewedChanges:[]};bad.runtimeFiles[0].sha256='0'.repeat(64);
 try{fs.writeFileSync(file,JSON.stringify(bad),{flag:'wx'});assert.throws(()=>loadManifest(file));assert.deepEqual(fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json')),bytes);}finally{fs.unlinkSync(file);}
});
test('overlap is rejected nonzero without modifying the existing lock or launching the gate',()=>{
 fs.mkdirSync(work,{recursive:true});const lock=path.join(work,'quality-gate.lock.json');let owned=false;
 if(!fs.existsSync(lock)){fs.writeFileSync(lock,JSON.stringify({id:randomUUID(),pid:process.pid,purpose:'owned overlap negative control'}),{flag:'wx'});owned=true;}
 const before=fs.readFileSync(lock);
 try{
  const result=spawnSync(process.execPath,['tools/qa.cjs','fast'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(result.status,1);assert.match(result.stdout,/BLOCKED/);assert.deepEqual(fs.readFileSync(lock),before);assert.doesNotMatch(result.stdout,/\[Public/);
  const env={...process.env};delete env.LINECRAFT_QA_LOCK_ID;delete env.LINECRAFT_QA_RUN_DIRECTORY;
  const direct=spawnSync(process.execPath,['desktop/dev-tools.cjs','test','--manifest=qa/CANDIDATE-SOURCE.json'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(direct.status,1);assert.match(direct.stderr,/EEXIST/);assert.deepEqual(fs.readFileSync(lock),before);
 }finally{if(owned&&fs.readFileSync(lock).equals(before))fs.unlinkSync(lock);}
});
