'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadManifest}=require('./source-manifest.cjs');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version,tag=`v${version}`,out=path.join(root,'Windows-Release');
assert.ok(process.argv.length<=3&&(!process.argv[2]||process.argv[2]==='--preflight'));
const preflight=process.argv[2]==='--preflight';
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(process.env.GITHUB_REF,preflight?'refs/heads/codex/public-beta-1.36':`refs/tags/${tag}`,'Exact approved tag or named preflight branch required.');
if(!preflight)assert.equal(execFileSync('git',['rev-parse',`${tag}^{commit}`],{cwd:root,encoding:'utf8'}).trim(),commit);
execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:root,stdio:'inherit'});
const gateStart=Date.parse(process.env.GATE_START_UTC);assert.ok(Number.isFinite(gateStart),'CI start timestamp required.');
// Keep the historical baseline selector. Candidate release support is separate.
const {manifest,manifestFile,candidate}=loadManifest(),manifestSHA256=sha(path.join(root,manifestFile));
function identity(actual,expected,reason){if(actual!==expected)throw Object.assign(Error(`Release receipt identity mismatch: ${reason}.`),{code:'ERR_LINECRAFT_RELEASE_IDENTITY'});}
function chronology(receipt,endField,label){
 const start=typeof receipt.startedAt==='string'?Date.parse(receipt.startedAt):NaN;
 const end=typeof receipt[endField]==='string'?Date.parse(receipt[endField]):NaN;
 identity(Number.isFinite(start)&&Number.isFinite(end)&&gateStart<=start&&start<=end&&end<=Date.now(),true,label+' chronology');
}
identity(version,manifest.version,'package/manifest version');
const release=read('work/public-release-results.json'),installed=read('work/public-test-installed-results.json'),pure=read('work/public-pure-results.json');
for(const [label,r] of [['release',release],['installed',installed]]){
 identity(r?.format,'LinecraftPublicGate/1',label+' format');
 assert.equal(r.status,'passed');assert.equal(r.version,version);assert.deepEqual(r.changedSource,[]);
 identity(r.manifestFile,manifestFile,label+' manifest file');
 identity(r.manifestSHA256,manifestSHA256,label+' manifest hash');
 identity(r.candidate,candidate,label+' candidate flag');
 identity(r.sourceSHA256?.[manifestFile],manifestSHA256,label+' bound manifest hash');
 chronology(r,'completedAt',label);
 for(const [name,digest] of Object.entries(r.sourceSHA256))assert.equal(sha(path.join(root,name)),digest,name);
}
assert.equal(release.command,'release');assert.equal(installed.command,'test-installed');
identity(pure?.format,'LinecraftPublicPureSummary/1','pure format');
assert.equal(pure.status,'passed');identity(pure.version,version,'pure version');
const pureCompletedAt=typeof pure.completedAt==='string'?Date.parse(pure.completedAt):NaN;
identity(Number.isFinite(pureCompletedAt)&&pureCompletedAt>=gateStart&&pureCompletedAt<=Date.now(),true,'pure completion time');
const pureInputs=pure.sourceSHA256;
identity(pureInputs!==null&&typeof pureInputs==='object'&&!Array.isArray(pureInputs),true,'pure source inputs');
identity(pureInputs[manifestFile],manifestSHA256,'pure bound manifest hash');
const pureNames=Object.keys(pureInputs).sort();
for(const [label,r] of [['release',release],['installed',installed]]){
 const names=Object.keys(r.sourceSHA256).sort();
 identity(pureNames.length===names.length&&pureNames.every((name,index)=>name===names[index]),true,'pure/'+label+' source input names');
 for(const name of pureNames){
  identity(typeof pureInputs[name]==='string'&&/^[a-f0-9]{64}$/.test(pureInputs[name]),true,'pure source digest format');
  identity(pureInputs[name],r.sourceSHA256[name],'pure/'+label+' source input hash');
 }
}
const clean=read('work/public-clean-install-results.json');identity(clean?.format,'LinecraftCleanRunnerInstall/1','clean format');assert.equal(clean.status,'passed');
assert.equal(clean.version,version);assert.equal(clean.runId,process.env.GITHUB_RUN_ID);chronology(clean,'finishedAt','clean');
const installer=`Linecraft-CAD-${version}-Setup.exe`,source=`Linecraft-CAD-${version}-Source.zip`;
assert.equal(sha(path.join(out,installer)),clean.installerSha256);
// Admit the existing application/PDF requirements before creating any assets.
const applicationModes=['source','unpacked','installed'],applications={};
for(const mode of applicationModes){
 const r=read(`tests/ordinary-grip-public-${mode}-results.json`);assert.equal(r.passed,32);assert.equal(r.failed,0);assert.equal(r.outputs.pdfAudit.passed,9);
 assert.equal(r.application.electron,require('../package.json').devDependencies.electron,'Application did not run the patched vendor runtime.');
 assert.ok(Date.parse(r.startedAt)>=gateStart,'Stale application receipt.');
 applications[mode]=r;
}
// Admit both installed outputs and the existing audit projection before mutation.
const installedOutputs=[['native','Installed-Acceptance.linecraft'],['pdf','Installed-Acceptance.pdf']].map(([field,name])=>{
 const file=path.resolve(applications.installed.outputs[field]),work=path.join(root,'work')+path.sep;
 assert.ok(file.startsWith(work));const digest=applications.installed.outputs[field+'SHA256'];assert.equal(sha(file),digest);
 return{field,file,name,digest};
});
const installedAuditBytes=fs.readFileSync(applications.installed.outputs.pdfAudit.path);
const installedAudit=JSON.parse(installedAuditBytes.toString('utf8'));
const installedPdfMeasurements=installedAudit.tests.map(t=>({name:t.name,status:t.status,details:t.details}));
// Parse/project first to preserve existing malformed-audit rejection behavior.
identity(createHash('sha256').update(installedAuditBytes).digest('hex'),applications.installed.outputs.pdfAudit.sha256,'PDF audit byte hash');
identity(installedAudit.framework,'Independent actual drafting PDF vector and physical scale audit','PDF audit framework');
identity(installedAudit.status,'passed','PDF audit status');
identity(installedAudit.total,9,'PDF audit total');identity(installedAudit.passed,9,'PDF audit passed');identity(installedAudit.failed,0,'PDF audit failed');
identity(applications.installed.outputs.pdfAudit.total,9,'embedded PDF audit total');
identity(Array.isArray(installedAudit.tests)&&installedAudit.tests.length===9&&installedAudit.tests.every(t=>t.status==='passed'),true,'PDF audit rows');
for(const {field,file,digest}of installedOutputs){
 const binding=installedAudit.bindings?.[field];
 identity(typeof binding?.path==='string'&&path.resolve(binding.path)===file,true,'PDF audit '+field+' path');
 identity(binding?.sha256,digest,'PDF audit '+field+' digest');
}
execFileSync('git',['archive','--format=zip',`--prefix=Linecraft-CAD-${version}-Source/`,`--output=${path.join(out,source)}`,commit],{cwd:root,stdio:'inherit'});
const summary={format:'LinecraftPublicBetaVerification/1',version,tag:preflight?null:tag,commit,runId:process.env.GITHUB_RUN_ID,runUrl:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,releaseClass:preflight?'candidate':'prerelease',automaticUpdater:false,codeSigning:'unsigned',historicalQualifiedWindowsRuntime:read('PUBLIC-SOURCE.json').qualifiedWindowsEvidence,freshPublicChecks:{},limits:['Hidden CI tests stub native chooser/discard responses.','Historical visible installed Windows checks preceded the vendor security refresh; current public gates exercise the patched vendor runtime separately.','Fresh install/uninstall scope is a GitHub-hosted Windows VM; broader Windows/DPI coverage remains beta work.']};
for(const mode of applicationModes){
 const r=applications[mode];
 summary.freshPublicChecks[mode]={application:r.application,applicationChecks:r.passed,failed:r.failed,pdfChecks:r.outputs.pdfAudit.passed,evidenceClass:r.evidenceClass,tests:r.tests.map(t=>({name:t.name,status:t.status}))};
 if(mode==='installed'){
  for(const {file,name,digest}of installedOutputs){
   // Retain the copy-adjacent hash guard after early admission.
   assert.equal(sha(file),digest);fs.copyFileSync(file,path.join(out,name));
  }
  summary.actualPdfMeasurements=installedPdfMeasurements;
 }
}
summary.cleanInstallation={os:clean.os,scope:clean.scope,checks:clean.checks};
summary.freshPublicChecks.pure=pure;
const audit=read('work/public-npm-audit.json');assert.equal(audit.metadata.vulnerabilities.total,0);
summary.dependencyAudit={vulnerabilities:audit.metadata.vulnerabilities,dependencies:audit.metadata.dependencies,scope:'Current npm advisory response for the locked dependencies, including the bundled Electron runtime.'};
summary.desktopRuntime=require('../package.json').devDependencies.electron;
summary.runtimeIdentity={runtimeFiles:59,bundledResources:12,manifestSHA256:sha(path.join(root,'PUBLIC-SOURCE.json')),scope:'Original application code and resources retain qualified identities; the patched vendor desktop runtime is separately exercised in each public application gate.'};
// Do not publish machine-local paths, temporary profiles or connection descriptors.
const strip=(v)=>typeof v==='string'&&(/^[a-z]:[\\/]/i.test(v)||v.includes('\\Users\\'))?'[local path omitted]':Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['cwd','root','work','executable','command','args','stdout','stderr','log','path'].includes(k)).map(([k,x])=>[k,strip(x)])):v;
fs.writeFileSync(path.join(out,'Public-Beta-Verification.json'),JSON.stringify(strip(summary),null,2)+'\n');
const supplement='libredwg-0.13.4-upstream.tar.gz';fs.copyFileSync(path.join(root,'third-party-source',supplement),path.join(out,supplement));
const assets=[installer,source,'Installed-Acceptance.linecraft','Installed-Acceptance.pdf','Public-Beta-Verification.json',supplement];
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),assets.map(n=>`${sha(path.join(out,n))}  ${n}`).join('\n')+'\n');
fs.copyFileSync(path.join(root,'docs','RELEASE-1.36-BETA.md'),path.join(out,'release-notes.md'));
console.log(JSON.stringify({tag,commit,assets:assets.concat('SHA256SUMS.txt')},null,2));
