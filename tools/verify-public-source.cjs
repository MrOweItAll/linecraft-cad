'use strict';
// Read-only runtime identity gate. Development metadata is deliberately separate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(manifest.version,require('../package.json').version);
assert.equal(manifest.runtimeFiles.length,59);assert.equal(manifest.extraResources.length,12);
for(const item of [...manifest.runtimeFiles,...manifest.extraResources]){
 assert.ok(!path.isAbsolute(item.file)&&!item.file.split(/[\\/]/).includes('..'));
 const bytes=fs.readFileSync(path.join(root,item.file));assert.equal(bytes.length,item.bytes,item.file);assert.equal(sha(bytes),item.sha256,item.file);
}
if(process.argv.includes('--packaged')){
 const asar=require('@electron/asar'),base=path.join(root,'Windows-Release','win-unpacked','resources'),archive=path.join(base,'app.asar');
 for(const item of manifest.runtimeFiles)assert.equal(sha(asar.extractFile(archive,item.file)),item.sha256,item.file);
 for(const item of manifest.extraResources){
  const target=item.file.startsWith('third-party/')?item.file:'structural/linecraft-structural-adapter.py';
  assert.equal(sha(fs.readFileSync(path.join(base,target))),item.sha256,target);
 }
 const files=asar.listPackage(archive).filter(n=>!asar.statFile(archive,n.replace(/^[/\\]/,'')).files);
 assert.equal(files.length,60,'59 code/assets plus controlled package metadata');
 const packaged=JSON.parse(asar.extractFile(archive,'package.json'));
 assert.equal(packaged.version,manifest.version);assert.equal(packaged.main,'desktop/main.cjs');
}
console.log('Verified 59 original runtime files and 12 bundled resources'+(process.argv.includes('--packaged')?' in source and actual ASAR/resources.':' in source.'));
