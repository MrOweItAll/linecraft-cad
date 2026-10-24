'use strict';
// Candidate identity is explicit. The published baseline is never rewritten.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function loadManifest(file='PUBLIC-SOURCE.json'){
 const baseBytes=fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json')),base=JSON.parse(baseBytes);
 assert.equal(sha(baseBytes),'c7cb2c46702e7e88b7ddd84aa83b038bf52aa0a5901d3154bf3fb60bba41b5c7','Published v1.36 baseline manifest bytes changed');
 const resolved=path.resolve(root,file),manifest=JSON.parse(fs.readFileSync(resolved));
 if(resolved!==path.join(root,'PUBLIC-SOURCE.json')){
  assert.equal(manifest.format,'LinecraftCandidateSource/1');
  assert.equal(manifest.baselineCommit,'f37aba5ebe19f27088847cd8f983ecf5facf8eac');
  assert.equal(manifest.baselineManifestSHA256,sha(baseBytes),'Immutable release baseline changed');
  assert.notEqual(manifest.version,base.version,'Candidate needs a distinct application version');
  assert.equal(manifest.desktopRuntimePin,base.desktopRuntimePin);
  const previous=new Map([...base.runtimeFiles,...base.extraResources].map(row=>[row.file,row]));
  const current=[...manifest.runtimeFiles,...manifest.extraResources];
  assert.deepEqual(current.map(row=>row.file).sort(),[...previous.keys()].sort());
  const changes=current.filter(row=>row.sha256!==previous.get(row.file).sha256||row.bytes!==previous.get(row.file).bytes);
  assert.deepEqual(changes.map(row=>row.file).sort(),manifest.reviewedChanges.map(row=>row.file).sort());
  for(const change of manifest.reviewedChanges){
   const row=current.find(row=>row.file===change.file);
   assert.equal(change.beforeSHA256,previous.get(change.file).sha256);
   assert.equal(change.afterSHA256,row.sha256);
   assert.ok(change.issue&&change.reason,'Every candidate runtime change requires an issue and reason');
  }
 }
 return{manifest,manifestFile:path.relative(root,resolved),candidate:resolved!==path.join(root,'PUBLIC-SOURCE.json')};
}
module.exports={loadManifest,sha};
