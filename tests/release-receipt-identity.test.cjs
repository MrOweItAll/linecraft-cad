'use strict';
// Actual source executes against fake files/Git. The first asset mutation is a
// sentinel, never a real archive/copy/write or downstream release simulation.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=require('./fixtures/release-receipt-identity.json');
const prepare=fs.readFileSync(path.join(__dirname,'../tools/prepare-beta-assets.cjs'),'utf8');
const manifestSource=fs.readFileSync(path.join(__dirname,'../tools/source-manifest.cjs'),'utf8');
const baseline=fs.readFileSync(path.join(__dirname,'../PUBLIC-SOURCE.json'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.equal(sha(baseline),fixture.manifestSHA256);
for(const input of [fixture.qualifiedInput,fixture.extraInput])assert.equal(sha(Buffer.from(input.text)),input.sha256);
const virtualRoot=String.raw`C:\synthetic-release`;
const filename=name=>path.win32.resolve(virtualRoot,name);

function execute({change,preflight=false,wrongRef=false,wrongCommit=false,wrongInstaller=false}={}){
 const state={archiveCalls:0,copyCalls:0,writeCalls:0,manifestLoads:0,harnessFaults:[]};
 const demand=(condition,reason)=>{if(!condition){state.harnessFaults.push(reason);throw Object.assign(Error('Unsupported synthetic adapter operation.'),{code:'HARNESS_FAULT'});}};
 const inputs=()=>({[fixture.manifestFile]:fixture.manifestSHA256,[fixture.qualifiedInput.file]:fixture.qualifiedInput.sha256});
 const gate=command=>({format:'LinecraftPublicGate/1',version:fixture.version,command,status:'passed',changedSource:[],
  manifestFile:fixture.manifestFile,manifestSHA256:fixture.manifestSHA256,candidate:fixture.candidate,
  sourceSHA256:inputs(),startedAt:fixture.startedAt,completedAt:fixture.completedAt});
 const data={package:{version:fixture.version,devDependencies:{electron:'44.9.3'}},release:gate('release'),installed:gate('test-installed'),
  pure:{format:'LinecraftPublicPureSummary/1',version:fixture.version,status:'passed',node:'v24.13.0',core:{},suites:[],
   sourceSHA256:inputs(),completedAt:fixture.completedAt},
  clean:{format:'LinecraftCleanRunnerInstall/1',version:fixture.version,status:'passed',runId:'42',startedAt:fixture.startedAt,
   finishedAt:fixture.completedAt,installerSha256:sha(Buffer.from('synthetic installer bytes'))}};
 const appReference=fixture.applicationReference;
 data.applications=Object.fromEntries(appReference.modes.map(mode=>[mode,{
  framework:'Synthetic ordinary-grip application receipt for prefix admission only',evidenceClass:'Fake receipt; no application execution',
  startedAt:fixture.startedAt,completedAt:fixture.completedAt,total:32,passed:appReference.passed,failed:appReference.failed,
  application:{electron:appReference.electron,version:mode==='source'?appReference.electron:fixture.version,linecraftManifestVersion:fixture.version},
  outputs:{pdfAudit:{passed:appReference.pdfPassed,total:9}},tests:[]
 }]));
 if(change)change(data);
 const files=new Map([[filename('PUBLIC-SOURCE.json'),baseline],
  [filename(fixture.qualifiedInput.file),Buffer.from(fixture.qualifiedInput.text)],
  [filename(fixture.extraInput.file),Buffer.from(fixture.extraInput.text)],
  [filename('work/public-release-results.json'),Buffer.from(JSON.stringify(data.release))],
  [filename('work/public-test-installed-results.json'),Buffer.from(JSON.stringify(data.installed))],
  [filename('work/public-pure-results.json'),Buffer.from(JSON.stringify(data.pure))],
  [filename('work/public-clean-install-results.json'),Buffer.from(JSON.stringify(data.clean))],
  ...appReference.modes.map(mode=>[filename(`tests/ordinary-grip-public-${mode}-results.json`),Buffer.from(JSON.stringify(data.applications[mode]))]),
  [filename(`Windows-Release/Linecraft-CAD-${data.package.version}-Setup.exe`),Buffer.from(wrongInstaller?'tampered synthetic bytes':'synthetic installer bytes')]]);
 const boundary=()=>Object.assign(Error('Synthetic asset-mutation boundary reached.'),{code:'HARNESS_ASSET_BOUNDARY'});
 const disk={readFileSync(file,encoding){demand(files.has(file),'unexpected-read');const value=files.get(file);return encoding?value.toString(encoding):value;},
  copyFileSync(){state.copyCalls++;throw boundary();},writeFileSync(){state.writeCalls++;throw boundary();}};
 const git={execFileSync(command,args){
  demand(command==='git'&&Array.isArray(args),'unexpected-child-process');
  if(args.length===2&&args[0]==='rev-parse'&&args[1]==='HEAD')return fixture.commit+'\n';
  if(args.length===2&&args[0]==='rev-parse'&&args[1]===`v${data.package.version}^{commit}`)return (wrongCommit?'b'.repeat(40):fixture.commit)+'\n';
  if(JSON.stringify(args)===JSON.stringify(['diff','--exit-code','HEAD','--']))return '';
  if(args[0]==='archive'){
   demand(args.length===5&&args[1]==='--format=zip'&&args[2]===`--prefix=Linecraft-CAD-${data.package.version}-Source/`&&
    args[3]===`--output=${filename(`Windows-Release/Linecraft-CAD-${data.package.version}-Source.zip`)}`&&args[4]===fixture.commit,'archive-arguments');
   state.archiveCalls++;throw boundary();
  }
  demand(false,'unexpected-git-command');
 }};
 class Clock extends Date{static now(){return Date.parse(fixture.now);}}
 const context={Buffer,Date:Clock,__dirname:filename('tools'),console:{log(){demand(false,'unexpected-output-before-boundary');}},
  process:{argv:['node','prepare-beta-assets.cjs',...(preflight?['--preflight']:[])],env:{
   GITHUB_REF:wrongRef?'refs/heads/unapproved':preflight?'refs/heads/codex/public-beta-1.36':`refs/tags/v${data.package.version}`,
   GATE_START_UTC:fixture.gateStart,GITHUB_RUN_ID:'42',GITHUB_REPOSITORY:'synthetic/example'}}};
 let cachedManifest;
 function load(source){
  const module={exports:{}};
  vm.runInNewContext(source,{...context,module,exports:module.exports,require(name){
   const modules={'node:fs':disk,'node:path':path.win32,'node:assert/strict':assert,'node:crypto':crypto,'node:child_process':git,'../package.json':data.package};
   if(name==='./source-manifest.cjs'){
    if(!cachedManifest){state.manifestLoads++;cachedManifest=load(manifestSource);}
    return cachedManifest;
   }
   demand(Object.hasOwn(modules,name),'unexpected-module');return modules[name];
  }},{filename:'synthetic-release-tool.cjs',timeout:1000});
  return module.exports;
 }
 let error;
 try{load(prepare);}catch(value){error=value;}
 assert.deepEqual(state.harnessFaults,[],'Unknown adapter calls must not count as receipt rejection');
 return {state,error};
}

function noAssets(result){assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:0,copy:0,write:0});}
for(const entry of fixture.cases)test('guard: '+entry.id+' rejects before any asset mutation',()=>{
 const result=execute({change(data){
  if(entry.operation==='coherent-other-version')for(const record of Object.values(data))record.version=entry.version;
  else if(entry.operation==='delete-bound-manifest')delete data[entry.receipt].sourceSHA256[fixture.manifestFile];
  else if(entry.operation==='delete-field')delete data[entry.receipt][entry.field];
  else if(entry.operation==='rename-field'){data[entry.receipt][entry.to]=data[entry.receipt][entry.from];delete data[entry.receipt][entry.from];}
  else if(entry.operation==='set-input')data[entry.receipt].sourceSHA256[entry.input]=entry.value;
  else if(entry.operation==='delete-input')delete data[entry.receipt].sourceSHA256[entry.input];
  else data[entry.receipt][entry.field]=entry.value;
 }});
 assert.equal(result.error?.code,entry.error??fixture.identityError,'Require the intended receipt/identity rejection, not a harness or later-stage exception');noAssets(result);
});

for(const mode of fixture.applicationReference.modes){
 for(const entry of fixture.applicationReference.cases)test('application guard: '+mode+' '+entry.id+' rejects before any asset mutation',()=>{
  const result=execute({change(data){
   let target=data.applications[mode];for(const field of entry.field.slice(0,-1))target=target[field];
   target[entry.field.at(-1)]=entry.value;
  }});
  assert.equal(result.error?.code,'ERR_ASSERTION','Require the existing application assertion, not a harness or later-stage exception');noAssets(result);
 });
 test('application control: '+mode+' start equals CI start and reaches the first asset boundary',()=>{
  const result=execute({change(data){data.applications[mode].startedAt=fixture.gateStart;}});
  assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
  assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
 });
}

for(const preflight of [false,true])test('control: valid synthetic historical '+(preflight?'preflight':'tag')+' reaches the first asset boundary',()=>{
 const result=execute({preflight});assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
});
for(const [name,change] of [['pure completion equals gate start',d=>{d.pure.completedAt=fixture.gateStart;}],
 ['pure completion equals current time',d=>{d.pure.completedAt=fixture.now;}],
 ['pure input property order differs',d=>{d.pure.sourceSHA256=Object.fromEntries(Object.entries(d.pure.sourceSHA256).reverse());}]])test('control: '+name+' reaches the asset boundary',()=>{
 const result=execute({change});assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
});
for(const [name,change] of [['release zero duration at CI start',d=>{d.release.startedAt=fixture.gateStart;d.release.completedAt=fixture.gateStart;}],
 ['installed zero duration at current time',d=>{d.installed.startedAt=fixture.now;d.installed.completedAt=fixture.now;}],
 ['clean zero duration at CI start',d=>{d.clean.startedAt=fixture.gateStart;d.clean.finishedAt=fixture.gateStart;}],
 ['clean zero duration at current time',d=>{d.clean.startedAt=fixture.now;d.clean.finishedAt=fixture.now;}],
 ['clean PowerShell round-trip fractions',d=>{d.clean.startedAt='2026-10-01T00:01:00.1234567Z';d.clean.finishedAt='2026-10-01T00:02:00.7654321Z';}]])test('control: '+name+' reaches the asset boundary',()=>{
 const result=execute({change});assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
});
for(const [name,options] of [['unapproved ref',{wrongRef:true}],['different tag commit',{wrongCommit:true}],
 ['missing release start time',{change:d=>{delete d.release.startedAt;}}],['missing installed start time',{change:d=>{delete d.installed.startedAt;}}],
 ['missing release completion',{change:d=>{delete d.release.completedAt;}}],['missing installed completion',{change:d=>{delete d.installed.completedAt;}}],
 ['invalid release completion',{change:d=>{d.release.completedAt='not-a-time';}}],['invalid installed completion',{change:d=>{d.installed.completedAt='not-a-time';}}],
 ['wrong release completion alias',{change:d=>{d.release.finishedAt=d.release.completedAt;delete d.release.completedAt;}}],
 ['wrong installed completion alias',{change:d=>{d.installed.finishedAt=d.installed.completedAt;delete d.installed.completedAt;}}],
 ['wrong release command',{change:d=>{d.release.command='test';}}],['wrong installed command',{change:d=>{d.installed.command='release';}}],
 ['changed release source hash',{change:d=>{d.release.sourceSHA256[fixture.manifestFile]='0'.repeat(64);}}],
 ['changed installed source hash',{change:d=>{d.installed.sourceSHA256[fixture.manifestFile]='0'.repeat(64);}}],['changed installer hash',{wrongInstaller:true}]])test('control: '+name+' remains rejected before assets',()=>{
 const result=execute(options);assert.ok(['ERR_ASSERTION',fixture.identityError].includes(result.error?.code),'Require an existing or identity guard rejection');noAssets(result);
});
