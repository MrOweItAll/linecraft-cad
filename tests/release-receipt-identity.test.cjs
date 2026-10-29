'use strict';
// Actual source executes against fake files/Git. The first asset mutation is a
// sentinel by default. Opt-in downstream cases use only allowlisted in-memory bytes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=require('./fixtures/release-receipt-identity.json');
const frozenReference=require('./fixtures/frozen-release-identity.json');
const serializationReference=require('./fixtures/release-serialization.json');
const prepare=fs.readFileSync(path.join(__dirname,'../tools/prepare-beta-assets.cjs'),'utf8');
const manifestSource=fs.readFileSync(path.join(__dirname,'../tools/source-manifest.cjs'),'utf8');
const baseline=fs.readFileSync(path.join(__dirname,'../PUBLIC-SOURCE.json'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.equal(sha(baseline),fixture.manifestSHA256);
for(const input of [fixture.qualifiedInput,fixture.extraInput,fixture.outputReference.native,fixture.outputReference.pdf])assert.equal(sha(Buffer.from(input.text)),input.sha256);
const virtualRoot=String.raw`C:\synthetic-release`;
const filename=name=>path.win32.resolve(virtualRoot,name);

function execute({change,preflight=false,wrongRef=false,wrongCommit=false,wrongInstaller=false,fileChange,virtualOutputs=false,toolSource=prepare,afterArchive}={}){
 const state={archiveCalls:0,copyCalls:0,writeCalls:0,archiveArguments:null,tagLookups:0,installerReads:0,manifestLoads:0,auditReads:0,dependencyReads:0,copies:[],writes:[],logs:[],harnessFaults:[]};
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
 const outputReference=fixture.outputReference;
 const outputPaths={native:filename(outputReference.native.file),pdf:filename(outputReference.pdf.file),audit:filename(outputReference.auditFile)};
 Object.assign(data.applications.installed.outputs,{native:outputPaths.native,nativeSHA256:outputReference.native.sha256,
  pdf:outputPaths.pdf,pdfSHA256:outputReference.pdf.sha256});
 data.audit=structuredClone(outputReference.audit);
 data.audit.framework=fixture.auditIdentityReference.framework;
 data.audit.bindings=Object.fromEntries(['native','pdf'].map(field=>[field,{
  path:outputPaths[field],sha256:outputReference[field].sha256,bytes:Buffer.byteLength(outputReference[field].text)
 }]));
 Object.assign(data.applications.installed.outputs.pdfAudit,{path:outputPaths.audit,sha256:sha(Buffer.from(JSON.stringify(data.audit)))});
 data.dependencyAudit=structuredClone(fixture.dependencyReference.report);
  if(virtualOutputs){
   for(const mode of appReference.modes){
    const r=data.applications[mode];
    Object.assign(r.application,{location:'C:\\synthetic-profile\\file',path:'synthetic omitted field',nested:{keep:'synthetic',stdout:'synthetic omitted field'}});
    r.tests=[{name:'Synthetic application row',status:'passed',details:'not projected',path:'synthetic omitted field'}];
   }
   Object.assign(data.clean,{os:'Synthetic Windows',scope:'Fake clean-install receipt',checks:[{name:'Synthetic clean row',status:'passed',cwd:'synthetic omitted field'}]});
  }
  if(change)change(data);
 const files=new Map([[filename('PUBLIC-SOURCE.json'),baseline],
  [filename(fixture.qualifiedInput.file),Buffer.from(fixture.qualifiedInput.text)],
  [filename(fixture.extraInput.file),Buffer.from(fixture.extraInput.text)],
  [filename('work/public-release-results.json'),Buffer.from(JSON.stringify(data.release))],
  [filename('work/public-test-installed-results.json'),Buffer.from(JSON.stringify(data.installed))],
  [filename('work/public-pure-results.json'),Buffer.from(JSON.stringify(data.pure))],
  [filename('work/public-clean-install-results.json'),Buffer.from(JSON.stringify(data.clean))],
  [filename('work/public-npm-audit.json'),Buffer.from(JSON.stringify(data.dependencyAudit))],
  ...appReference.modes.map(mode=>[filename(`tests/ordinary-grip-public-${mode}-results.json`),Buffer.from(JSON.stringify(data.applications[mode]))]),
  [filename(`Windows-Release/Linecraft-CAD-${data.package.version}-Setup.exe`),Buffer.from(wrongInstaller?'tampered synthetic bytes':'synthetic installer bytes')]]);
 for(const field of ['native','pdf']){
  const bytes=Buffer.from(outputReference[field].text);files.set(outputPaths[field],bytes);
  for(const entry of outputReference.cases.filter(entry=>entry.operation==='path'))files.set(filename(entry.path+'-'+field),bytes);
 }
 files.set(outputPaths.audit,Buffer.from(JSON.stringify(data.audit)));
  if(virtualOutputs){
   files.set(filename('third-party-source/libredwg-0.13.4-upstream.tar.gz'),Buffer.from(serializationReference.inputBytes.supplement));
   files.set(filename('docs/RELEASE-1.36-BETA.md'),Buffer.from(serializationReference.inputBytes.notes));
  }
  const originalFiles=new Map([...files].map(([name,bytes])=>[name,Buffer.from(bytes)]));
  const knownFiles=new Set(files.keys());
  const created=new Set();
  const copyPairs=serializationReference.expectedCopyPairs.map(pair=>pair.map(filename));
  const writePaths=serializationReference.expectedWritePaths.map(filename);
  const create=(file,bytes)=>{demand(!files.has(file),'unexpected-overwrite');files.set(file,Buffer.from(bytes));created.add(file);knownFiles.add(file);};
 if(fileChange)fileChange(files,outputPaths);
 const boundary=()=>Object.assign(Error('Synthetic asset-mutation boundary reached.'),{code:'HARNESS_ASSET_BOUNDARY'});
 const disk={readFileSync(file,encoding){demand(knownFiles.has(file),'unexpected-read');if(file===frozenReference.installerPath)state.installerReads++;if(file===outputPaths.audit)state.auditReads++;if(file===filename('work/public-npm-audit.json'))state.dependencyReads++;if(!files.has(file))throw Object.assign(Error('Missing known synthetic file.'),{code:'ENOENT'});const value=files.get(file);demand(encoding===undefined||encoding==='utf8','unexpected-read-encoding');return encoding?value.toString(encoding):Buffer.from(value);},
  copyFileSync(...args){
    if(!virtualOutputs){state.copyCalls++;throw boundary();}
    demand(args.length===2&&copyPairs.some(pair=>pair[0]===args[0]&&pair[1]===args[1]),'unexpected-copy');
    demand(files.has(args[0]),'missing-copy-source');create(args[1],files.get(args[0]));state.copyCalls++;state.copies.push(args);
   },writeFileSync(...args){
    if(!virtualOutputs){state.writeCalls++;throw boundary();}
    demand(args.length===2&&writePaths.includes(args[0])&&typeof args[1]==='string','unexpected-write');
    create(args[0],Buffer.from(args[1]));state.writeCalls++;state.writes.push(args[0]);
   }};
 const git={execFileSync(command,args){
  demand(command==='git'&&Array.isArray(args),'unexpected-child-process');
  if(args.length===2&&args[0]==='rev-parse'&&args[1]==='HEAD')return fixture.commit+'\n';
  if(args.length===2&&args[0]==='rev-parse'&&args[1]===`v${data.package.version}^{commit}`){state.tagLookups++;return (wrongCommit?'b'.repeat(40):fixture.commit)+'\n';}
  if(JSON.stringify(args)===JSON.stringify(['diff','--exit-code','HEAD','--']))return '';
  if(args[0]==='archive'){
   state.archiveArguments=structuredClone(args);
   demand(args.length===5&&args[1]==='--format=zip'&&args[2]===`--prefix=Linecraft-CAD-${data.package.version}-Source/`&&
    args[3]===`--output=${filename(`Windows-Release/Linecraft-CAD-${data.package.version}-Source.zip`)}`&&args[4]===fixture.commit,'archive-arguments');
   state.archiveCalls++;
    if(!virtualOutputs)throw boundary();
    create(filename('Windows-Release/Linecraft-CAD-1.36.0-Source.zip'),Buffer.from(serializationReference.inputBytes.archive));
    if(afterArchive)afterArchive(files,outputPaths);return '';
  }
  demand(false,'unexpected-git-command');
 }};
 class Clock extends Date{static now(){return Date.parse(fixture.now);}}
 const context={Buffer,Date:Clock,__dirname:filename('tools'),console:{log(...args){demand(virtualOutputs&&args.length===1&&typeof args[0]==='string','unexpected-console');state.logs.push(args[0]);}},
  process:{argv:['node','prepare-beta-assets.cjs',...(preflight?['--preflight']:[])],env:{
   GITHUB_REF:wrongRef?'refs/heads/unapproved':preflight?'refs/heads/codex/public-beta-1.36':`refs/tags/v${data.package.version}`,
   GATE_START_UTC:fixture.gateStart,GITHUB_RUN_ID:'42',GITHUB_REPOSITORY:'synthetic/example'}}};
 let cachedManifest;
 function load(source){
  const module={exports:{}};
  vm.runInNewContext(source,{...context,module,exports:module.exports,require(name){
   const modules={'node:fs':new Proxy(disk,{get(target,name){demand(Object.hasOwn(target,name),'unexpected-fs-method');return target[name];}}),'node:path':path.win32,'node:assert/strict':assert,'node:crypto':crypto,'node:child_process':git,'../package.json':data.package};
   if(name==='./source-manifest.cjs'){
    if(!cachedManifest){state.manifestLoads++;cachedManifest=load(manifestSource);}
    return cachedManifest;
   }
   demand(Object.hasOwn(modules,name),'unexpected-module');return modules[name];
  }},{filename:'synthetic-release-tool.cjs',timeout:1000});
  return module.exports;
 }
 let error;
 try{load(toolSource);}catch(value){error=value;}
 assert.deepEqual(state.harnessFaults,[],'Unknown adapter calls must not count as receipt rejection');
 return {state,error,files,created,originalFiles};
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

for(const field of ['native','pdf']){
 for(const entry of fixture.outputReference.cases)test('output guard: '+field+' '+entry.id+' rejects before any asset mutation',()=>{
  const result=execute({change(data){
   if(entry.operation==='path')data.applications.installed.outputs[field]=virtualRoot+'/'+entry.path+'-'+field;
   if(entry.operation==='hash')data.applications.installed.outputs[field+'SHA256']='0'.repeat(64);
  },fileChange(files,paths){
   if(entry.operation==='tamper')files.set(paths[field],Buffer.from('Changed synthetic output bytes.'));
   if(entry.operation==='missing')files.delete(paths[field]);
  }});
  assert.equal(result.error?.code,entry.error??'ERR_ASSERTION','Require the intended existing output/file rejection');noAssets(result);
 });
 test('output control: '+field+' normalized in-work path reaches the first archive',()=>{
  const result=execute({change(data){
   data.applications.installed.outputs[field]=virtualRoot+'\\work/acceptance/stage/../'+(field==='native'?'grip-accepted.linecraft':'grip-accepted.pdf');
  }});
  assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
  assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
 });
}
for(const entry of fixture.outputReference.auditCases)test('audit guard: '+entry.id+' rejects before any asset mutation',()=>{
 const result=execute({fileChange(files,paths){
  if(entry.operation==='missing')files.delete(paths.audit);
  else files.set(paths.audit,Buffer.from(entry.operation==='text'?entry.value:JSON.stringify(entry.value)));
 }});
 if(entry.errorName)assert.equal(result.error?.name,entry.errorName,'Require the actual parse/projection error');
 else assert.equal(result.error?.code,entry.error,'Require the known-file read error');
 assert.equal(result.state.auditReads,1);noAssets(result);
});

for(const entry of fixture.auditIdentityReference.cases)test('audit identity: '+entry.id+' rejects before any asset mutation',()=>{
 const result=execute({change(data){
  const auditOperation=['audit','delete-audit','drop-row','binding-path'].includes(entry.operation);
  if(entry.operation==='audit'||entry.operation==='delete-audit'){
   let target=data.audit;for(const field of entry.field.slice(0,-1))target=target[field];
   if(entry.operation==='delete-audit')delete target[entry.field.at(-1)];else target[entry.field.at(-1)]=entry.value;
  }
  if(entry.operation==='drop-row')data.audit.tests.pop();
  if(entry.operation==='binding-path')data.audit.bindings[entry.binding].path=filename('outside/accepted-'+entry.binding);
  // Semantic negatives bind the exact modified bytes; digest negatives do not.
  if(auditOperation)data.applications.installed.outputs.pdfAudit.sha256=sha(Buffer.from(JSON.stringify(data.audit)));
  if(entry.operation==='embedded'||entry.operation==='delete-embedded'){
   const target=data.applications.installed.outputs.pdfAudit;
   if(entry.operation==='delete-embedded')delete target[entry.field[0]];else target[entry.field[0]]=entry.value;
  }
 },fileChange(files,paths){
  if(entry.operation==='raw-tamper')files.set(paths.audit,Buffer.concat([files.get(paths.audit),Buffer.from(' \n')]));
 }});
 assert.equal(result.error?.code,fixture.identityError,'Require the intended audit identity rejection');
 assert.equal(result.state.auditReads,1);noAssets(result);
});
for(const kind of ['formatted exact bytes','reordered audit rows','normalized binding paths'])test('audit identity control: '+kind+' reaches the first archive',()=>{
 const result=execute({change(data){
  if(kind==='reordered audit rows')data.audit.tests.reverse();
  if(kind==='normalized binding paths')for(const field of ['native','pdf'])data.audit.bindings[field].path=virtualRoot+'/work/acceptance/stage/../'+(field==='native'?'grip-accepted.linecraft':'grip-accepted.pdf');
  data.applications.installed.outputs.pdfAudit.sha256=sha(Buffer.from(JSON.stringify(data.audit)));
 },fileChange(files,paths){
  if(kind==='formatted exact bytes'){
   const bytes=Buffer.from(JSON.stringify(JSON.parse(files.get(paths.audit)),null,2)+'\n');files.set(paths.audit,bytes);
   const receiptFile=filename('tests/ordinary-grip-public-installed-results.json'),receipt=JSON.parse(files.get(receiptFile));
   receipt.outputs.pdfAudit.sha256=sha(bytes);files.set(receiptFile,Buffer.from(JSON.stringify(receipt)));
  }
 }});
 assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');assert.equal(result.state.auditReads,1);
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
});

for(const entry of fixture.dependencyReference.cases)test('dependency guard: '+entry.id+' rejects before any asset mutation',()=>{
 const result=execute({change(data){
  if(entry.operation==='set'||entry.operation==='delete'){
   let target=data.dependencyAudit;for(const field of entry.field.slice(0,-1))target=target[field];
   if(entry.operation==='delete')delete target[entry.field.at(-1)];else target[entry.field.at(-1)]=entry.value;
  }
 },fileChange(files){
  const file=filename('work/public-npm-audit.json');
  if(entry.operation==='missing')files.delete(file);
  if(entry.operation==='text')files.set(file,Buffer.from(entry.value));
 }});
 if(entry.errorName)assert.equal(result.error?.name,entry.errorName,'Require the existing dependency parse/property error');
 else assert.equal(result.error?.code,entry.error??'ERR_ASSERTION','Require the existing dependency assertion/file error');
 assert.equal(result.state.dependencyReads,1);noAssets(result);
});
for(const formatted of [false,true])test('dependency control: '+(formatted?'formatted':'minimal')+' numeric zero reaches the first archive',()=>{
 const result=execute({fileChange(files){
  if(formatted){const file=filename('work/public-npm-audit.json');files.set(file,Buffer.from(JSON.stringify(JSON.parse(files.get(file)),null,2)+'\n'));}
 }});
 assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
});

for(const mode of fixture.applicationReference.modes){
 for(const entry of fixture.applicationProjectionReference.cases)test('application projection: '+mode+' '+entry.id+' rejects before any asset mutation',()=>{
  const result=execute({change(data){
   if(entry.operation==='delete')delete data.applications[mode].tests;
   else data.applications[mode].tests=structuredClone(entry.value);
  }});
  assert.equal(result.error?.name,'TypeError','Require the original projection failure, not a harness exception');noAssets(result);
 });
 for(const entry of fixture.applicationProjectionReference.controls)test('application projection control: '+mode+' '+entry.id+' reaches the first archive',()=>{
  const result=execute({change(data){data.applications[mode].tests=structuredClone(entry.value);}});
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

for(const preflight of [false,true])test('frozen wrapper literal: '+(preflight?'preflight':'tag')+' archive identity and Git lookup count',()=>{
 const result=execute({preflight});assert.equal(result.error?.code,'HARNESS_ASSET_BOUNDARY');
 assert.deepEqual(result.state.archiveArguments,frozenReference.archiveArguments);
 assert.equal(result.state.tagLookups,preflight?0:1);assert.equal(result.state.installerReads,1);
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls},{archive:1,copy:0,write:0});
});

// These controls execute the unchanged preparer to completion using fake assets.
// No real ZIP/PDF/installer, filesystem mutation, child process or publisher runs.
function checkVirtual(result,preflight){
 const expected=serializationReference.modes[preflight?'preflight':'tag'];
 assert.equal(result.error,undefined);
 assert.deepEqual({archive:result.state.archiveCalls,copy:result.state.copyCalls,write:result.state.writeCalls,log:result.state.logs.length},{archive:1,copy:4,write:2,log:1});
 assert.deepEqual(result.state.archiveArguments,frozenReference.archiveArguments);
 assert.equal(result.state.tagLookups,preflight?0:1);
 assert.deepEqual(result.state.copies,serializationReference.expectedCopyPairs.map(pair=>pair.map(filename)));
 assert.deepEqual(result.state.writes,serializationReference.expectedWritePaths.map(filename));
 const metadata=result.files.get(filename('Windows-Release/Public-Beta-Verification.json'));
 assert.equal(metadata.toString('utf8'),JSON.stringify(expected.verification,null,2)+'\n');
 assert.equal(sha(metadata),expected.verificationSHA256);
 assert.equal(result.files.get(filename('Windows-Release/SHA256SUMS.txt')).toString('utf8'),expected.checksumText);
 assert.deepEqual(result.state.logs,[expected.finalLog.trimEnd()]);
 const expectedCreated=[...serializationReference.expectedPayloadAssets.slice(1),'SHA256SUMS.txt','release-notes.md'].map(name=>filename('Windows-Release/'+name));
 assert.deepEqual([...result.created].sort(),expectedCreated.sort());
 for(const [file,bytes] of result.originalFiles)assert.deepEqual(result.files.get(file),bytes,'Synthetic inputs remain unchanged');
 for(const [field,name] of [['native','Installed-Acceptance.linecraft'],['pdf','Installed-Acceptance.pdf'],['supplement','libredwg-0.13.4-upstream.tar.gz'],['notes','release-notes.md']])
  assert.equal(result.files.get(filename('Windows-Release/'+name)).toString('utf8'),serializationReference.inputBytes[field]);
}
for(const preflight of [false,true])test('virtual preparation: '+(preflight?'preflight':'tag')+' exact serialized metadata, checksums and final log',()=>{
 checkVirtual(execute({preflight,virtualOutputs:true}),preflight);
});
for(const field of ['native','pdf'])test('virtual preparation: '+field+' changed after archive still rejects at copy-adjacent hash',()=>{
 const result=execute({virtualOutputs:true,afterArchive(files,paths){files.set(paths[field],Buffer.from('Changed synthetic output after archive.'));}});
 assert.equal(result.error?.code,'ERR_ASSERTION');assert.equal(result.state.archiveCalls,1);
 assert.equal(result.state.copyCalls,field==='native'?0:1);assert.equal(result.state.writeCalls,0);
});
for(const [name,toolSource] of [
 ['unknown module',"require('node:net')"],
 ['unknown fs method',"require('node:fs').mkdirSync('outside')"],
 ['unknown read',"require('node:fs').readFileSync('outside')"],
 ['unknown copy',"require('node:fs').copyFileSync('outside','elsewhere')"],
 ['unknown write',"require('node:fs').writeFileSync('outside','bytes')"],
 ['unknown child',"require('node:child_process').execFileSync('node',[])"],
 ['unknown git',"require('node:child_process').execFileSync('git',['status'])"]
])test('virtual adapter: '+name+' fails closed without host fallback',()=>{
 assert.throws(()=>execute({virtualOutputs:true,toolSource}),/Unknown adapter calls/);
});
const mutations=[
 ['verification format',"format:'LinecraftPublicBetaVerification/1'","format:'WrongSyntheticFormat/1'"],
 ['verification tag','tag:preflight?null:tag','tag:tag'],
 ['verification release class',"releaseClass:preflight?'candidate':'prerelease'","releaseClass:'prerelease'"],
 ['payload checksum membership','assets.map(n=>','assets.slice(0,-1).map(n=>'],
 ['final upload names',"assets:assets.concat('SHA256SUMS.txt')","assets:assets"],
 ['canonical final tag','JSON.stringify({tag,commit,assets:','JSON.stringify({tag:null,commit,assets:']
];
for(const [name,before,after] of mutations)test('virtual oracle sensitivity: '+name+' change is detected',()=>{
 assert.equal(prepare.split(before).length,2,'Mutation must match exactly once');
 const result=execute({preflight:true,virtualOutputs:true,toolSource:prepare.replace(before,after)});
 assert.equal(result.error,undefined,'Probe must finish; oracle, not a harness exception, detects altered output');
 assert.throws(()=>checkVirtual(result,true),{code:'ERR_ASSERTION'});
});
