'use strict';
// Bounded public qualification. Private native recordings are never required or
// replaced with generated expected values. Historical suites are not globbed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),pins={electron:'44.9.3','electron-builder':'26.15.3',playwright:'1.62.1'};
const suites=[
 'ordinary-grip-input.test.mjs','perpendicular-independent.test.mjs','command-completion.test.mjs','trim-comprehensive.test.mjs',
 'units-independent.test.mjs','advanced-independent.test.mjs','layouts-independent.test.mjs','viewport-object-independent.test.mjs',
 'viewport-scales-independent.test.mjs','roof-hip.test.mjs','clearance-independent.test.mjs'
].map(n=>'tests/'+n);
const auxiliaries=['tests/core.test.mjs','tests/public-core-exclusions.json','tests/export-advanced-sample.mjs','tests/historical-native-fixture.mjs','tests/historical-trim-defaults.cjs','tests/viewport-fixtures-v17.mjs','tests/viewport-scales-fixtures-v18.mjs','tests/ordinary-grip-desktop.cjs','tests/ordinary-grip-confirm.cjs','tests/electron-test-options.cjs','tests/audit-drafting-pdf.py','tests/requirements-dev.txt','desktop/dev-tools.cjs','package.json','package-lock.json','PUBLIC-SOURCE.json','tools/verify-public-source.cjs','tools/source-manifest.cjs','tools/qa.cjs','tools/create-candidate-manifest.cjs','tests/quality-fixtures.mjs','tests/quality-smoke.cjs','tests/audit-quality-pdf.py','tests/fixtures/duplicate-closing-hatch.dxf','tests/viewport-import-fixtures.mjs','tests/fixtures/top-viewport-center.dxf','tests/fixtures/viewport-nontop-beta1-reference.json','qa/CANDIDATE-SOURCE.json','qa/CANDIDATE-SOURCE-1.36.1-beta.2.json','tests/tick-width-fixture.mjs','tests/tick-width-reference.test.mjs','tests/tick-width.test.mjs','tests/tick-width-desktop.cjs','tests/tick-width-workflow.cjs','tests/audit-tick-width-pdf.py','qa/CANDIDATE-SOURCE-1.36.1-beta.3.json','tests/paper-solid-fixture.mjs','tests/paper-solid-import.test.mjs','tests/paper-solid-workflow.cjs','tests/audit-paper-solid-pdf.py'];
const manifestOption=process.argv.find(a=>a.startsWith('--manifest='))?.slice(11);
auxiliaries.push('.github/workflows/quality-loop.yml','.github/workflows/windows-beta.yml');
auxiliaries.push('tests/script-descriptor-reference.test.cjs','tests/fixtures/script-descriptor-contract.json');
auxiliaries.push('tests/script-admission-reference.test.cjs','tests/fixtures/script-admission-contract.json');
auxiliaries.push('tests/fixtures/release-receipt-identity.json','tools/prepare-beta-assets.cjs','tests/fixtures/frozen-release-identity.json','tools/frozen-release-identity.cjs','tests/fixtures/release-serialization.json');
auxiliaries.push('tools/observe-script-directory.ps1','tools/script-directory-observation.cjs','tests/fixtures/script-directory-observation.json','tests/script-directory-observer.test.ps1');
const {manifest,manifestFile,candidate}=require('../tools/source-manifest.cjs').loadManifest(manifestOption);
suites.push('tests/release-receipt-identity.test.cjs','tests/frozen-release-identity.test.cjs');
if(candidate)suites.push('tests/script-directory-observation.test.cjs');
if(candidate)suites.push('tests/non-inspector-contract.test.cjs');
auxiliaries.push('tests/non-inspector-contract.cjs','tests/non-inspector-websocket.test.cjs','tests/non-inspector-probe.cjs','tests/observe-owned-windows.ps1','tests/fixtures/non-inspector-beta6-targets.json');
auxiliaries.push('tests/export-joined-roof-sample.mjs');
auxiliaries.push('samples/mixed-pitch-v115.linecraft');
if(candidate)suites.push('tests/structural-files.test.cjs','tests/structural-assignments-files.test.cjs','tests/structural-boundaries-files.test.cjs','tests/structural-file-dispatch.test.cjs');
if(candidate)suites.push('tests/structural-bridge-independent.test.mjs','tests/structural-assignments.test.mjs','tests/structural-boundaries.test.mjs','tests/structural-contract-reference.test.mjs');
auxiliaries.push('tests/multisheet-fixture.mjs','tests/multisheet-reference.test.mjs','tests/multisheet-workflow.cjs','tests/audit-multisheet-pdf.py');
auxiliaries.push('tests/font-layout-fixture.mjs','tests/font-layout-workflow.cjs','tests/audit-font-layout-pdf.py');
auxiliaries.push('tests/architectural_font_reference.py');
if(candidate)suites.push('tests/font-resources.test.mjs');
auxiliaries.push('tests/missing-glyph-fixture.mjs','tests/missing-glyph-workflow.cjs','tests/audit-missing-glyph-pdf.py','qa/CANDIDATE-SOURCE-1.36.1-beta.5.json');
if(candidate)suites.push('tests/missing-glyph.test.mjs');
auxiliaries.push('tests/performance-fixture.mjs','tests/performance-workflow.cjs','tests/audit-performance.py');
auxiliaries.push('tests/reload-fixture.mjs','tests/reload-workflow.cjs','tests/audit-reload.py');
auxiliaries.push('tools/local-development-relay.cjs','tests/local-development-relay.test.cjs','tests/local-development-relay-workflow.cjs','tests/audit-local-relay.py','tests/fixtures/local-relay-request.json');
auxiliaries.push('tests/import-headline.test.cjs','tests/import-headline-workflow.cjs','qa/CANDIDATE-SOURCE-1.36.1-beta.6.json');
auxiliaries.push('tests/mixed-paper-fixture.mjs','tests/mixed-paper-reference.test.mjs');
if(candidate)suites.push('tests/mixed-paper-reference.test.mjs');
auxiliaries.push('tests/plan-detail-fixture.mjs','tests/plan-detail-reference.test.mjs','tests/plan-detail-workflow.cjs','tests/audit-plan-detail-pdf.py');
if(candidate)suites.push('tests/plan-detail-reference.test.mjs');
auxiliaries.push('tests/rotated-annotation-fixture.mjs','tests/rotated-annotation-reference.test.mjs','tests/rotated-annotation-workflow.cjs','tests/audit-rotated-annotation-pdf.py');
if(candidate)suites.push('tests/rotated-annotation-reference.test.mjs');
auxiliaries.push('tests/richtext-fixture.mjs','tests/richtext-reference.test.mjs','tests/richtext-workflow.cjs','tests/audit-richtext-pdf.py');
if(candidate)suites.push('tests/richtext-reference.test.mjs');
if(candidate)suites.push('tests/import-headline.test.cjs');
if(candidate)suites.push('tests/viewport-navigation-independent.test.mjs');
if(candidate)suites.push('tests/hatch-normalization.test.mjs','tests/quality-reference.test.mjs','tests/qa-controls.test.cjs','tests/viewport-center-import.test.mjs','tests/tick-width-reference.test.mjs','tests/tick-width.test.mjs','tests/paper-solid-import.test.mjs','tests/multisheet-reference.test.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const hashFiles=names=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const fingerprintNames=[...new Set([...manifest.runtimeFiles,...manifest.extraResources].map(r=>r.file).concat(suites,auxiliaries,[manifestFile]))].sort();
function dependency(name,entry){
 const base=path.join(root,'node_modules',name);assert.ok(fs.existsSync(base),`Run npm ci: local ${name} is missing.`);
 assert.equal(JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8')).version,pins[name],`${name} pin`);
 assert.ok(!fs.lstatSync(path.join(root,'node_modules')).isSymbolicLink(),'node_modules must be an independent local install, not a junction.');
 const file=path.join(base,entry);assert.ok(fs.existsSync(file),`Local ${name} install is incomplete; enable npm install scripts.`);return file;
}
function runtime(){assert.equal(process.platform,'win32','Desktop and installer qualification require Windows; npm test is portable.');assert.equal(process.arch,'x64');const exe=dependency('electron','dist/electron.exe');assert.equal(fs.readFileSync(path.join(path.dirname(exe),'version'),'utf8').trim().replace(/^v/,''),pins.electron);return exe;}
function childEnvironment(){const env={...process.env};for(const n of ['ELECTRON_RUN_AS_NODE','ELECTRON_OVERRIDE_DIST_PATH','CAD_ELECTRON_RUNTIME','CAD_PLAYWRIGHT_MODULE','NODE_PATH'])delete env[n];env.LINECRAFT_EXPECTED_VERSION=manifest.version;return env;}
function run(executable,args,log){return new Promise((resolve,reject)=>{
 const output=fs.createWriteStream(log,{flags:'wx'}),child=spawn(executable,args,{cwd:root,env:childEnvironment(),windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});
 let failed=false,timedOut=false;const budget=args.some(a=>/builder|install\.js/.test(a))?600000:180000;
 const timer=process.argv[2]==='dev'?null:setTimeout(()=>{timedOut=true;if(process.platform==='win32')require('node:child_process').spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');},budget);
 child.once('error',error=>{failed=true;clearTimeout(timer);output.end();reject(error);});
 child.once('close',(code,signal)=>{clearTimeout(timer);if(timedOut)code='timeout';output.end(()=>{if(failed)return;const text=fs.readFileSync(log,'utf8');if(code===0)resolve(text);else reject(Error(`Stage exited ${code??signal}; see ${path.relative(root,log)}\n${text.split(/\r?\n/).slice(-60).join('\n')}`));});});
 const stop=()=>child.kill();process.once('SIGINT',stop);process.once('SIGTERM',stop);child.once('close',()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);});
});}
function counts(tap){const result={};for(const key of ['tests','pass','fail','cancelled','skipped']){const matches=[...tap.matchAll(new RegExp('^# '+key+' (\\d+)\\s*$','gm'))];assert.ok(matches.length,`Missing TAP ${key} summary`);result[key]=Number(matches.at(-1)[1]);}assert.equal(result.fail,0);assert.equal(result.cancelled,0);return result;}
function verifySource(){assert.equal(manifest.desktopRuntimePin,pins.electron);assert.equal(manifest.version,require('../package.json').version);assert.equal(manifest.runtimeFiles.length,59);assert.equal(manifest.extraResources.length,12);for(const item of [...manifest.runtimeFiles,...manifest.extraResources]){assert.ok(!path.isAbsolute(item.file)&&!item.file.split(/[\\/]/).includes('..'));const bytes=fs.readFileSync(path.join(root,item.file));assert.equal(bytes.length,item.bytes,item.file);assert.equal(sha(bytes),item.sha256,item.file);}return{runtimeFiles:59,extraResources:12};}
function verifyPackaged(executable){
 verifySource();const asar=require('@electron/asar'),resources=path.join(path.dirname(path.resolve(executable)),'resources'),archive=path.join(resources,'app.asar');
 for(const item of manifest.runtimeFiles)assert.equal(sha(asar.extractFile(archive,item.file)),item.sha256,item.file);
 for(const item of manifest.extraResources){const target=item.file.startsWith('third-party/')?item.file:'structural/linecraft-structural-adapter.py';assert.equal(sha(fs.readFileSync(path.join(resources,target))),item.sha256,target);}
 const metadata=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(metadata.version,manifest.version);assert.equal(metadata.main,'desktop/main.cjs');return{runtimeFiles:59,extraResources:12,archiveSHA256:sha(fs.readFileSync(archive))};
}
function stable(report){const after=hashFiles(fingerprintNames),changed=Object.keys(after).filter(n=>after[n]!==report.sourceSHA256[n]);report.changedSource=changed;assert.deepEqual(changed,[],'Bound public inputs changed during qualification.');}
async function stage(report,name,executable,args,validate){
 const row={name,status:'running',command:[path.relative(root,executable)||executable,...args],log:path.join(report.logDirectory,String(report.stages.length+1).padStart(2,'0')+'-'+name.replace(/[^a-z0-9-]+/gi,'-').toLowerCase()+'.log'),startedAt:new Date().toISOString()};report.stages.push(row);console.log(`[Public ${report.stages.length}] ${name}`);
 try{const text=await run(executable,args,row.log);if(validate)row.evidence=await validate(text);row.status='passed';console.log('PASS '+name);}catch(error){row.status='failed';row.error=error.message;throw error;}finally{row.completedAt=new Date().toISOString();}
}
async function pure(report){
 fs.mkdirSync(path.join(root,'samples'),{recursive:true});
 await stage(report,'generate original numerical advanced exchange sample',process.execPath,['tests/export-advanced-sample.mjs'],()=>Object.fromEntries(['samples/advanced-v14-reference.linecraft','samples/advanced-v14-reference.dxf'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])));
 const exclusions=JSON.parse(fs.readFileSync(path.join(root,'tests/public-core-exclusions.json'),'utf8'));assert.equal(exclusions.exactExcludedCases.length,12);
 const core=fs.readFileSync(path.join(root,'tests/core.test.mjs'),'utf8');for(const item of exclusions.exactExcludedCases)assert.ok(core.includes(item.name),`Exclusion disappeared: ${item.name}`);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern='^(?:'+exclusions.exactExcludedCases.map(item=>escape(item.name)).join('|')+')$';
 await stage(report,'generated core; twelve explicitly unavailable private reference cases',process.execPath,['--test','--test-reporter=tap','--test-skip-pattern',pattern,'tests/core.test.mjs'],text=>{const c=counts(text);assert.equal(c.tests,306);assert.equal(c.pass,306);assert.equal(c.skipped,0);return{...c,declaredOriginalCases:318,excludedCount:12,excluded:exclusions.exactExcludedCases.map(item=>item.name),accounting:'Node24 omits excluded selections from TAP totals.306 executed plus12 explicitly unavailable references accounts for318 original declarations.'};});
 for(const file of suites)await stage(report,file,process.execPath,['--test','--test-reporter=tap',file],text=>{const c=counts(text);assert.equal(c.skipped,0);return c;});
 const summary={format:'LinecraftPublicPureSummary/1',scope:'Generated public cases; private native-recording cases explicitly excluded, not passed.',version:report.version,node:report.node,status:'passed',core:report.stages.find(row=>row.name.startsWith('generated core;')).evidence,suites:report.stages.filter(row=>suites.includes(row.name)).map(row=>({file:row.name,...row.evidence})),sourceSHA256:report.sourceSHA256,completedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(root,'work/public-pure-results.json'),JSON.stringify(summary,null,2)+'\n');
}
async function desktop(report,executable,entry,prefix){
 if(candidate)prefix+='-'+(process.env.LINECRAFT_QA_LOCK_ID||String(process.pid));
 dependency('playwright','index.js');if(!entry)report.packagedBefore=verifyPackaged(executable);
 await stage(report,`actual hidden ${prefix}:32 checks and independent PDF9`,process.execPath,['tests/ordinary-grip-desktop.cjs',path.resolve(executable),entry,prefix],()=>{
  const file=path.join(root,'tests',prefix+'-results.json'),result=JSON.parse(fs.readFileSync(file,'utf8'));assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt),'Stale application result');assert.equal(result.total,32);assert.equal(result.passed,32);assert.equal(result.failed,0);assert.equal(result.sourceUnchangedDuringRun,true);assert.equal(result.outputs.pdfAudit.total,9);assert.equal(result.outputs.pdfAudit.passed,9);assert.equal(result.hiddenWindowVerified,true);assert.equal(result.application.packaged,!entry);
  return{application:result.application,report:path.relative(root,file),reportSHA256:sha(fs.readFileSync(file)),passed:32,total:32,pdf:result.outputs.pdf,pdfSHA256:result.outputs.pdfSHA256,pdfAudit:result.outputs.pdfAudit,scope:result.evidenceClass};
 });
 if(candidate)await stage(report,`actual loopback drafting and import smoke: ${prefix}`,process.execPath,['tests/quality-smoke.cjs',path.resolve(executable),entry,prefix],()=>{const file=path.join(root,'tests',prefix+'-quality-results.json'),result=JSON.parse(fs.readFileSync(file));assert.equal(result.status,'passed');assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt));return{report:file,sha256:sha(fs.readFileSync(file)),evidenceClass:result.evidenceClass,checks:result.tests.length};});
 if(candidate)await stage(report,`actual independent tick-width workflow: ${prefix}`,process.execPath,['tests/tick-width-workflow.cjs',path.resolve(executable),entry,prefix,manifestFile],()=>{const file=path.join(root,'tests',prefix+'-tick-results.json'),result=JSON.parse(fs.readFileSync(file));assert.equal(result.status,'passed');assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt));assert.equal(result.application.passed,10);assert.equal(result.pdfAudits.length,3);return{report:file,sha256:sha(fs.readFileSync(file)),appChecks:10,pdfMeasurements:result.pdfAudits.reduce((n,a)=>n+a.measurements.length,0),scope:result.scope};});
 if(candidate)await stage(report,`actual planar paper SOLID workflow: ${prefix}`,process.execPath,['tests/paper-solid-workflow.cjs',path.resolve(executable),entry,prefix,manifestFile],()=>{const file=path.join(root,'tests',prefix+'-paper-solid-results.json'),result=JSON.parse(fs.readFileSync(file));assert.equal(result.status,'passed');assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt));assert.equal(result.application.passed,6);assert.equal(result.pdfAudit.status,'passed');assert.equal(result.pdfAudit.measurements.length,2);assert.equal(result.pdfAudit.negativeControls.length,7);assert.equal(result.sourceUnchanged,true);assert.equal(result.inputUnchanged,true);return{report:file,sha256:sha(fs.readFileSync(file)),appChecks:6,pdfMeasurements:2,negativeControls:7,scope:result.scope};});
 if(candidate)await stage(report,`actual ordered multi-sheet workflow: ${prefix}`,process.execPath,['tests/multisheet-workflow.cjs',path.resolve(executable),entry,prefix,manifestFile],()=>{const file=path.join(root,'tests',prefix+'-multisheet-results.json'),result=JSON.parse(fs.readFileSync(file));assert.equal(result.status,'passed');assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt));assert.equal(result.application.passed,4);assert.equal(result.pdfAudit.status,'passed');assert.equal(result.pdfAudit.measurements.length,18);assert.equal(result.pdfAudit.negativeControls.length,13);assert.ok(result.pdfAudit.negativeControls.every(row=>row.rejected));assert.equal(result.sourceUnchanged,true);assert.equal(result.inputUnchanged,true);return{report:file,sha256:sha(fs.readFileSync(file)),appChecks:4,pdfMeasurements:result.pdfAudit.measurements.length,negativeControls:result.pdfAudit.negativeControls.length,scope:result.scope};});
 if(candidate)await stage(report,`actual registered-font layout workflow: ${prefix}`,process.execPath,['tests/font-layout-workflow.cjs',path.resolve(executable),entry,prefix,manifestFile],()=>{const file=path.join(root,'tests',prefix+'-font-layout-results.json'),result=JSON.parse(fs.readFileSync(file));assert.equal(result.status,'passed');assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt));assert.equal(result.application.passed,4);assert.equal(result.pdfAudit.status,'passed');assert.equal(result.pdfAudit.measurements.length,9);assert.equal(result.pdfAudit.negativeControls.length,17);assert.ok(result.pdfAudit.negativeControls.every(row=>row.rejected));assert.equal(result.sourceUnchanged,true);assert.equal(result.inputUnchanged,true);return{report:file,sha256:sha(fs.readFileSync(file)),appChecks:4,pdfMeasurements:9,negativeControls:17,scope:result.scope};});
 if(candidate)await stage(report,`actual import headline and complete persistence: ${prefix}`,process.execPath,['tests/import-headline-workflow.cjs',path.resolve(executable),entry,prefix,manifestFile],()=>{const file=path.join(root,'tests',prefix+'-import-headline-results.json'),result=JSON.parse(fs.readFileSync(file));assert.equal(result.status,'passed');assert.ok(Date.parse(result.startedAt)>=Date.parse(report.stages.at(-1).startedAt));assert.equal(result.passed,3);assert.equal(result.total,3);assert.equal(result.hiddenWindowVerified,true);assert.equal(result.sourceUnchanged,true);assert.equal(result.inputUnchanged,true);return{report:file,sha256:sha(fs.readFileSync(file)),checks:3,geometry:result.geometry,headline:result.actualHeadline};});
 if(!entry)report.packagedAfter=verifyPackaged(executable);
}
async function main(){
 const[command='test']=process.argv.slice(2),installed=process.argv.slice(3).find(a=>!a.startsWith('--')),outputOption=process.argv.find(a=>a.startsWith('--output='))?.slice(9),buildOutput=outputOption?path.resolve(root,outputOption):path.join(root,'Windows-Release');
 if(candidate&&['unpacked','release'].includes(command))assert.ok(outputOption,'Candidate builds require an explicit isolated --output directory');assert.ok(['test','test-desktop','unpacked','release','dev','test-installed'].includes(command),'Commands: dev | test | test-desktop | unpacked | release | test-installed <exe>');
 if(command==='dev'){fs.mkdirSync(path.join(root,'work'),{recursive:true});if(!fs.existsSync(path.join(root,'node_modules/electron/dist/electron.exe')))await run(process.execPath,[dependency('electron','install.js')],path.join(root,'work/electron-bootstrap-'+Date.now()+'.log'));const exe=runtime();return run(exe,[path.join(root,'desktop/main.cjs'),`--user-data-dir=${path.join(root,'work/development-profile')}`],path.join(root,'work/dev-'+Date.now()+'.log'));}
 const work=path.join(root,'work');fs.mkdirSync(work,{recursive:true});
 const lockFile=path.join(work,'quality-gate.lock.json');let ownsLock=false;
 if(process.env.LINECRAFT_QA_LOCK_ID){const owner=JSON.parse(fs.readFileSync(lockFile));assert.equal(owner.id,process.env.LINECRAFT_QA_LOCK_ID);assert.equal(owner.pid,process.ppid);assert.equal(owner.directory,process.env.LINECRAFT_QA_RUN_DIRECTORY);}
 else{fs.writeFileSync(lockFile,JSON.stringify({id:'direct-'+process.pid,pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx'});ownsLock=true;}
 const logDirectory=process.env.LINECRAFT_QA_RUN_DIRECTORY?path.join(process.env.LINECRAFT_QA_RUN_DIRECTORY,'gate'):path.join(work,'public-gate-'+command+'-'+Date.now());fs.mkdirSync(logDirectory,{recursive:false});
 const report={manifestFile,manifestSHA256:sha(fs.readFileSync(path.join(root,manifestFile))),candidate,format:'LinecraftPublicGate/1',scope:'Generated public qualification only. No private native recordings, client drawings, ordinary installed desktop input, OS choosers or real clipboard access. Installed command means hidden runner acceptance, not native human review.',command,version:require('../package.json').version,node:process.version,platform:process.platform,arch:process.arch,startedAt:new Date().toISOString(),logDirectory,sourceSHA256:{},stages:[]};
 try{
  report.sourceSHA256=hashFiles(fingerprintNames);
  if(candidate&&['unpacked','release'].includes(command)){const relative=path.relative(path.join(work,'qa-runs'),buildOutput);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Candidate output must be a new owned directory under work/qa-runs');assert.ok(!fs.existsSync(buildOutput),'Candidate output must be new; preserve existing artifacts');if(process.env.LINECRAFT_QA_RUN_DIRECTORY)assert.equal(buildOutput,path.join(process.env.LINECRAFT_QA_RUN_DIRECTORY,'build'));}
  report.runtimeBefore=verifySource();
  if(command==='test-installed'){assert.ok(installed,'test-installed requires the installed executable path');await desktop(report,installed,'','ordinary-grip-public-installed');}
  else{
   if(command!=='test-desktop')await pure(report);
   if(command!=='test'){
    if(!fs.existsSync(path.join(root,'node_modules/electron/dist/electron.exe')))await stage(report,'bootstrap pinned local Electron runtime',process.execPath,[dependency('electron','install.js')]);
    const exe=runtime();report.dependencies=Object.fromEntries(Object.keys(pins).map(name=>{dependency(name,name==='electron'?'dist/electron.exe':name==='playwright'?'index.js':'cli.js');return[name,pins[name]];}));
    await desktop(report,exe,path.join(root,'desktop/main.cjs'),'ordinary-grip-public-source');
    if(['unpacked','release'].includes(command)){
     const builder=dependency('electron-builder','cli.js'),unpacked=path.join(buildOutput,'win-unpacked'),builtExe=path.join(unpacked,'Linecraft CAD.exe');stable(report);
     await stage(report,'build Windows x64 unpacked application',process.execPath,[builder,'--publish','never','--win','--x64','--dir','--projectDir',root,`-c.electronDist=${path.dirname(exe)}`,`-c.directories.output=${buildOutput}`]);
     await desktop(report,builtExe,'','ordinary-grip-public-unpacked');stable(report);
     if(command==='release')await stage(report,'compile NSIS from tested unpacked application',process.execPath,[builder,'--publish','never','--win','nsis','--x64','--projectDir',root,'--prepackaged',unpacked,`-c.directories.output=${buildOutput}`],()=>{const file=path.join(buildOutput,`Linecraft-CAD-${report.version}-Setup.exe`),bytes=fs.readFileSync(file);report.installer={file,bytes:bytes.length,sha256:sha(bytes),installed:false};return report.installer;});
    }
   }
  }
  report.runtimeAfter=verifySource();stable(report);report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack||String(error);process.exitCode=1;}
 finally{
  report.completedAt=new Date().toISOString();report.passed=report.stages.filter(r=>r.status==='passed').length;report.total=report.stages.length;
  const filename=path.join(work,`public-${command==='test'?'test':command}-results.json`);fs.writeFileSync(path.join(logDirectory,'results.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');console.log(`${report.status}: ${report.passed}/${report.total} public stages; ${path.relative(root,filename)}`);if(report.error)console.error(report.error);
  if(ownsLock&&JSON.parse(fs.readFileSync(lockFile)).pid===process.pid)fs.unlinkSync(lockFile);
 }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
