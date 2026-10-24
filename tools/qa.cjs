'use strict';
// Small wrapper around the existing gate; no scheduler, installer, or publisher.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,spawnSync,execFileSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {loadManifest,sha}=require('./source-manifest.cjs');
const root=path.resolve(__dirname,'..'),work=path.join(root,'work');
const modes={fast:{command:'test',timeout:300000},application:{command:'test-desktop',timeout:600000},candidate:{command:'release',timeout:1800000}};
async function main(){
 const [mode,...args]=process.argv.slice(2);assert.ok(modes[mode],'Usage: node tools/qa.cjs fast|application|candidate [--manifest=qa/CANDIDATE-SOURCE.json]');
 assert.ok(args.every(arg=>arg.startsWith('--manifest='))&&args.length<=1,'Only one explicit manifest option is accepted');
 fs.mkdirSync(work,{recursive:true});
 const id=Date.now()+'-'+randomUUID().slice(0,8),directory=path.join(work,'qa-runs',id),lock=path.join(work,'quality-gate.lock.json');
 fs.mkdirSync(directory,{recursive:true});
 const report={format:'LinecraftQualityRun/1',id,mode,startedAt:new Date().toISOString(),status:'running',directory,stages:[],unattendedExecution:false};
 let acquired=false;
 try{
  try{fs.writeFileSync(lock,JSON.stringify({id,pid:process.pid,startedAt:report.startedAt,directory}),{flag:'wx'});acquired=true;}
  catch(error){if(error.code==='EEXIST')throw Error('Another QA lock exists. Inspect its PID and run evidence; preserve/archive a proven stale lock before resuming.');throw error;}
  const identity=loadManifest(args[0]?.slice('--manifest='.length));
  report.manifest={file:identity.manifestFile,sha256:sha(fs.readFileSync(path.join(root,identity.manifestFile))),version:identity.manifest.version,candidate:identity.candidate};
  const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  report.source={commit:git('rev-parse','HEAD'),branch:git('branch','--show-current'),status:git('status','--porcelain=v1'),node:process.version,platform:process.platform};
  report.source.clean=!report.source.status;
  const output=path.join(directory,'build'),command=modes[mode].command;
  const row={command:['node','desktop/dev-tools.cjs',command,'--manifest='+identity.manifestFile,'--output='+output],startedAt:new Date().toISOString(),log:path.join(directory,'gate.log')};report.stages.push(row);
  const log=fs.openSync(row.log,'wx'),env={...process.env,LINECRAFT_QA_LOCK_ID:id,LINECRAFT_QA_RUN_DIRECTORY:directory};delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,row.command.slice(1),{cwd:root,env,windowsHide:true,stdio:['ignore',log,log]});
   let timedOut=false;const stop=()=>{if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');};
   const timer=setTimeout(()=>{timedOut=true;stop();},modes[mode].timeout);
   const interrupted=()=>{timedOut=true;stop();};process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
   child.once('error',reject);child.once('close',code=>{clearTimeout(timer);process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted);row.exitCode=code;row.timedOut=timedOut;row.completedAt=new Date().toISOString();timedOut?reject(Error('QA command exceeded its finite budget; only its owned process tree was stopped.')):code===0?resolve():reject(Error('Required gate failed; inspect gate.log.'));});
  }).finally(()=>fs.closeSync(log));
  const gateFile=path.join(directory,'gate','results.json'),gate=JSON.parse(fs.readFileSync(gateFile));
  assert.equal(gate.status,'passed');assert.ok(Date.parse(gate.startedAt)>=Date.parse(row.startedAt));
  assert.equal(gate.manifestSHA256,report.manifest.sha256);assert.equal(gate.version,report.manifest.version);assert.equal(gate.logDirectory,path.join(directory,'gate'));
  fs.copyFileSync(gateFile,path.join(directory,'gate-results.json'));report.gate={file:path.join(directory,'gate-results.json'),sha256:sha(fs.readFileSync(gateFile)),stages:gate.total};
  report.installer=gate.installer||null;report.status='passed';
  report.dailyUseReady=false;report.notVerified=['visible candidate Windows input and ordinary native dialogs','installed candidate acceptance','broader Windows/DPI/font coverage'];
  report.scope=mode==='candidate'?'Local reviewable candidate build; daily-use promotion awaits separate native acceptance and authorization.':'Automated checks only; no installed/native human acceptance claim.';
 }catch(error){report.status=error.message.includes('lock exists')?'blocked':'failed';report.error=error.stack||String(error);process.exitCode=1;}
 finally{
  report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');
  const summary=`${report.status.toUpperCase()}: ${mode}\nVersion: ${report.manifest?.version||'unavailable'}\nCommit: ${report.source?.commit||'unavailable'}\nGate: ${report.gate?.stages??0} stages\nDaily-use readiness: not established\n${report.error?report.error.split('\n')[0]+'\n':''}`;
  fs.writeFileSync(path.join(directory,'SUMMARY.txt'),summary);console.log(summary+`Evidence: ${directory}`);
  if(acquired&&JSON.parse(fs.readFileSync(lock)).id===id)fs.unlinkSync(lock);
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
