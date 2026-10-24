'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version,tag=`v${version}`,out=path.join(root,'Windows-Release');
assert.ok(process.argv.length<=3&&(!process.argv[2]||process.argv[2]==='--preflight'));
const preflight=process.argv[2]==='--preflight';
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(process.env.GITHUB_REF,preflight?'refs/heads/codex/public-beta-1.36':`refs/tags/${tag}`,'Exact approved tag or named preflight branch required.');
if(!preflight)assert.equal(execFileSync('git',['rev-parse',`${tag}^{commit}`],{cwd:root,encoding:'utf8'}).trim(),commit);
execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:root,stdio:'inherit'});
const gateStart=Date.parse(process.env.GATE_START_UTC);assert.ok(Number.isFinite(gateStart),'CI start timestamp required.');
const release=read('work/public-release-results.json'),installed=read('work/public-test-installed-results.json');
for(const r of [release,installed]){
 assert.equal(r.status,'passed');assert.equal(r.version,version);assert.deepEqual(r.changedSource,[]);
 assert.ok(Date.parse(r.startedAt)>=gateStart&&Date.parse(r.completedAt)<=Date.now(),'Stale or future gate receipt.');
 for(const [name,digest] of Object.entries(r.sourceSHA256))assert.equal(sha(path.join(root,name)),digest,name);
}
assert.equal(release.command,'release');assert.equal(installed.command,'test-installed');
const clean=read('work/public-clean-install-results.json');assert.equal(clean.status,'passed');
assert.equal(clean.version,version);assert.equal(clean.runId,process.env.GITHUB_RUN_ID);assert.ok(Date.parse(clean.startedAt)>=gateStart);
const installer=`Linecraft-CAD-${version}-Setup.exe`,source=`Linecraft-CAD-${version}-Source.zip`;
assert.equal(sha(path.join(out,installer)),clean.installerSha256);
execFileSync('git',['archive','--format=zip',`--prefix=Linecraft-CAD-${version}-Source/`,`--output=${path.join(out,source)}`,commit],{cwd:root,stdio:'inherit'});
const summary={format:'LinecraftPublicBetaVerification/1',version,tag:preflight?null:tag,commit,runId:process.env.GITHUB_RUN_ID,runUrl:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,releaseClass:preflight?'candidate':'prerelease',automaticUpdater:false,codeSigning:'unsigned',historicalQualifiedWindowsRuntime:read('PUBLIC-SOURCE.json').qualifiedWindowsEvidence,freshPublicChecks:{},limits:['Hidden CI tests stub native chooser/discard responses.','Visible installed Windows tests were separately performed on the unchanged application runtime.','Fresh install/uninstall scope is a GitHub-hosted Windows VM; broader Windows/DPI coverage remains beta work.']};
for(const mode of ['source','unpacked','installed']){
 const r=read(`tests/ordinary-grip-public-${mode}-results.json`);assert.equal(r.passed,32);assert.equal(r.failed,0);assert.equal(r.outputs.pdfAudit.passed,9);
 assert.ok(Date.parse(r.startedAt)>=gateStart,'Stale application receipt.');
 summary.freshPublicChecks[mode]={applicationChecks:r.passed,failed:r.failed,pdfChecks:r.outputs.pdfAudit.passed,evidenceClass:r.evidenceClass,tests:r.tests.map(t=>({name:t.name,status:t.status}))};
 if(mode==='installed'){
  for(const [field,name]of [['native','Installed-Acceptance.linecraft'],['pdf','Installed-Acceptance.pdf']]){
   const file=path.resolve(r.outputs[field]),work=path.join(root,'work')+path.sep;
   assert.ok(file.startsWith(work));assert.equal(sha(file),r.outputs[field+'SHA256']);fs.copyFileSync(file,path.join(out,name));
  }
  const audit=JSON.parse(fs.readFileSync(r.outputs.pdfAudit.path,'utf8'));
  summary.actualPdfMeasurements=audit.tests.map(t=>({name:t.name,status:t.status,details:t.details}));
 }
}
summary.cleanInstallation={os:clean.os,scope:clean.scope,checks:clean.checks};
const pure=read('work/public-pure-results.json');assert.equal(pure.status,'passed');summary.freshPublicChecks.pure=pure;
summary.runtimeIdentity={runtimeFiles:59,bundledResources:12,manifestSHA256:sha(path.join(root,'PUBLIC-SOURCE.json')),scope:'Source, unpacked and installed bytes are checked against the same qualified runtime manifest; development tooling metadata is separate.'};
// Do not publish machine-local paths, temporary profiles or connection descriptors.
const strip=(v)=>typeof v==='string'&&(/^[a-z]:[\\/]/i.test(v)||v.includes('\\Users\\'))?'[local path omitted]':Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['cwd','root','work','executable','command','args','stdout','stderr','log','path'].includes(k)).map(([k,x])=>[k,strip(x)])):v;
fs.writeFileSync(path.join(out,'Public-Beta-Verification.json'),JSON.stringify(strip(summary),null,2)+'\n');
const supplement='libredwg-0.13.4-upstream.tar.gz';fs.copyFileSync(path.join(root,'third-party-source',supplement),path.join(out,supplement));
const assets=[installer,source,'Installed-Acceptance.linecraft','Installed-Acceptance.pdf','Public-Beta-Verification.json',supplement];
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),assets.map(n=>`${sha(path.join(out,n))}  ${n}`).join('\n')+'\n');
fs.copyFileSync(path.join(root,'docs','RELEASE-1.36-BETA.md'),path.join(out,'release-notes.md'));
console.log(JSON.stringify({tag,commit,assets:assets.concat('SHA256SUMS.txt')},null,2));
