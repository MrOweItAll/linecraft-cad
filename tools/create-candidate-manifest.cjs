'use strict';
// Deliberate, no-overwrite identity creation after reviewing a specific change.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {sha}=require('./source-manifest.cjs'),root=path.resolve(__dirname,'..');
const [output,file,issue,reason]=process.argv.slice(2);
assert.ok(output&&file&&issue&&reason,'Usage: node tools/create-candidate-manifest.cjs <new-manifest> <reviewed-runtime-file> <issue> <reason>');
const baseline=fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json')),manifest=JSON.parse(baseline),item=manifest.runtimeFiles.find(row=>row.file===file);
assert.ok(item,'Only one explicitly reviewed existing runtime file may change in this milestone');
const before=item.sha256,bytes=fs.readFileSync(path.join(root,file));item.bytes=bytes.length;item.sha256=sha(bytes);assert.notEqual(item.sha256,before);
const candidate={format:'LinecraftCandidateSource/1',version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,baselineCommit:'f37aba5ebe19f27088847cd8f983ecf5facf8eac',baselineManifestSHA256:sha(baseline),scope:'Private/local reviewable candidate identity; not a release or daily-use acceptance receipt.',desktopRuntimePin:manifest.desktopRuntimePin,runtimeFiles:manifest.runtimeFiles,extraResources:manifest.extraResources,reviewedChanges:[{file,issue,reason,beforeSHA256:before,afterSHA256:item.sha256}]};
fs.writeFileSync(path.resolve(root,output),JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
require('./source-manifest.cjs').loadManifest(output);console.log('Created explicit candidate identity: '+output);
