'use strict';
// Explicit diagnostic only. Never selected by the default application gate.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{promisify}=require('node:util'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const {endpointFromOwnedReports,ownedListener,launchArguments,ownedObservation,CDPConnection}=require('./non-inspector-contract.cjs');
const execute=promisify(execFile),root=path.resolve(__dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}
const within=(file,folder)=>{const relative=path.relative(folder,file);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
async function main(){
 assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.electron,undefined);
 const [mode,target,...extra]=process.argv.slice(2);assert.ok(['source','unpacked'].includes(mode));assert.equal(extra.length,0);assert.ok(mode==='source'?!target:target&&path.isAbsolute(target));
 const {manifest,manifestFile}=require('../tools/source-manifest.cjs').loadManifest('qa/CANDIDATE-SOURCE-1.36.1-beta.6.json');
 const executable=await fsp.realpath(mode==='source'?path.join(root,'node_modules/electron/dist/electron.exe'):target),entry=mode==='source'?path.join(root,'desktop/main.cjs'):'';
 const canonicalRoot=await fsp.realpath(root),approved=require('./fixtures/non-inspector-beta6-targets.json');
 assert.equal(fs.statSync(executable).size,approved[mode].bytes);assert.equal(sha(fs.readFileSync(executable)),approved[mode].sha256,'Unapproved executable identity');
 if(mode==='source'){assert.equal(executable.toLowerCase(),path.join(canonicalRoot,'node_modules/electron/dist/electron.exe').toLowerCase());assert.equal(fs.readFileSync(path.join(root,'node_modules/electron/dist/version'),'utf8').trim(),approved.electronVersion);for(const component of ['node_modules/electron','node_modules/electron/dist'])assert.equal(fs.lstatSync(path.join(root,component)).isSymbolicLink(),false);}
 if(mode==='unpacked'){const qa=await fsp.realpath(path.join(root,'work/qa-runs'));assert.equal(qa.toLowerCase(),path.join(canonicalRoot,'work/qa-runs').toLowerCase());assert.ok(within(executable,qa),'Only an isolated QA-unpacked executable is allowed');}
 assert.equal(fs.lstatSync(path.join(root,'node_modules')).isSymbolicLink(),false);
 const archive=entry?'':path.join(path.dirname(executable),'resources/app.asar'),asar=entry?null:require('@electron/asar');
 const readRuntime=name=>entry?fs.readFileSync(path.join(root,name)):asar.extractFile(archive,name);
 for(const row of manifest.runtimeFiles){const bytes=readRuntime(row.file);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,row.file);}
 const readExtra=name=>fs.readFileSync(entry?path.join(root,name):path.join(path.dirname(executable),'resources',name.startsWith('third-party/')?name:'structural/linecraft-structural-adapter.py'));
 for(const row of manifest.extraResources)assert.equal(sha(readExtra(row.file)),row.sha256,row.file);
 const mainBytes=readRuntime('desktop/main.cjs');assert.ok(mainBytes.includes(Buffer.from("process.argv.includes('--linecraft-test-hidden')")));assert.ok(mainBytes.includes(Buffer.from('offscreen: HIDDEN_TEST')));assert.ok(mainBytes.includes(Buffer.from('if(!HIDDEN_TEST)mainWindow?.show()')));
 const executableSHA256=sha(fs.readFileSync(executable)),archiveSHA256=archive?sha(fs.readFileSync(archive)):null;
 await fsp.mkdir(path.join(root,'work'),{recursive:true});const work=await fsp.mkdtemp(path.join(root,'work/non-inspector-'+mode+'-')),profile=path.join(work,'profile'),scratch=path.join(work,'scratch');await fsp.mkdir(profile);await fsp.mkdir(scratch);
 const env={...process.env,TMP:scratch,TEMP:scratch,TMPDIR:scratch};for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','ELECTRON_RUN_AS_NODE','ELECTRON_OVERRIDE_DIST_PATH','CAD_ELECTRON_RUNTIME','CAD_PLAYWRIGHT_MODULE'])delete env[key];
 const report={format:'LinecraftNonInspectorProbe/1',startedAt:new Date().toISOString(),mode,work,status:'running',executable,executableSHA256,archiveSHA256,manifestFile,manifestSHA256:sha(fs.readFileSync(path.join(root,manifestFile))),tests:[],scope:'Renderer-only Chromium CDP diagnostic. No Node inspector, control descriptor, OS chooser/input, file/PDF acceptance or applied fuse policy.',visibilityScope:'Owned-PID top-level HWND snapshots plus bound hidden-startup code; transient events and compositor not verified.'};
 let child,client,sessionId,closed=false,exitResult,stderr='',forced=false,stdoutFD,stderrFD,budgetTimer;const args=launchArguments(entry,profile);report.arguments=args;let childExit;
 const check=async(name,fn)=>{const started=Date.now();const value=await fn();report.tests.push({name,status:'passed',milliseconds:Date.now()-started,...(value?{details:value}:{})});};
 const evaluate=async expression=>{const reply=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);assert.equal(reply.exceptionDetails,undefined,JSON.stringify(reply.exceptionDetails));return reply.result.value;};
 const sample=async()=>{assert.equal(closed,false);const pwsh=path.join(process.env.ProgramFiles,'PowerShell/7/pwsh.exe');const result=await execute(pwsh,['-NoProfile','-File',path.join(root,'tests/observe-owned-windows.ps1'),'-OwnedProcessId',String(child.pid)],{cwd:root,env,windowsHide:true,timeout:20000,maxBuffer:1024*1024});const value=JSON.parse(result.stdout.replace(/^\uFEFF/,''));return ownedObservation(value,{pid:child.pid,executable,spawnedAt:report.spawnedAt,observedAt:new Date().toISOString()});};
 try{
  budgetTimer=setTimeout(()=>{report.deadlineExceeded=true;forced=true;if(child&&!closed)child.kill();if(client)client.close();},90000);
  stdoutFD=fs.openSync(path.join(work,'stdout.log'),'wx');stderrFD=fs.openSync(path.join(work,'stderr.log'),'wx');
  report.spawnedAt=new Date().toISOString();child=spawn(executable,args,{cwd:root,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  childExit=new Promise(resolve=>{child.once('error',error=>{report.spawnError=error.message;});child.once('close',(code,signal)=>{closed=true;exitResult={code,signal};resolve(exitResult);});});
  assert.ok(child.pid);report.pid=child.pid;
  fs.writeFileSync(path.join(work,'ownership.json'),JSON.stringify({pid:child.pid,executable,executableSHA256,profile,spawnedAt:report.spawnedAt})+'\n',{flag:'wx'});
  for(const stream of [child.stdout,child.stderr])stream.on('error',error=>{report.logFailure=error.message;forced=true;child.kill();});
  child.stdout.on('data',bytes=>{try{fs.writeSync(stdoutFD,bytes);}catch(error){report.logFailure=error.message;forced=true;child.kill();}});
  child.stderr.on('data',bytes=>{try{fs.writeSync(stderrFD,bytes);stderr+=bytes.toString('utf8');if(stderr.length>8*1024*1024){report.logFailure='Diagnostic log budget exceeded';forced=true;child.kill();}}catch(error){report.logFailure=error.message;forced=true;child.kill();}});
  let endpoint,activePort;
  await check('fresh child browser endpoint agrees with owned profile and listening PID',async()=>{
   const deadline=Date.now()+20000;
   while(Date.now()<deadline){assert.equal(closed,false,'Owned application exited during startup');assert.ok(!stderr.includes('Debugger listening on'),'Unexpected Node inspector');const matches=[...stderr.matchAll(/^DevTools listening on (ws:\/\/[^\r\n]+)\r?\n/gm)];assert.ok(matches.length<=1);if(matches.length){try{activePort=await fsp.readFile(path.join(profile,'DevToolsActivePort'),'utf8');endpoint=endpointFromOwnedReports(matches[0][1],activePort);break;}catch(error){if(error.code!=='ENOENT')throw error;}}await delay(50);}
   assert.ok(endpoint,'Owned browser endpoint did not become ready');const netstat=path.join(process.env.SystemRoot,'System32/netstat.exe');const result=await execute(netstat,['-ano','-p','tcp'],{windowsHide:true,timeout:10000,maxBuffer:2*1024*1024});report.listener=ownedListener(result.stdout,endpoint.port,child.pid);report.endpoint=endpoint.endpoint;report.initialVisibility=await sample();
  });
  client=new CDPConnection(endpoint.endpoint);await client.ready;const expectedURL=pathToFileURL(entry?path.join(root,'index.html'):path.join(archive,'index.html')).href;let targetId;
  await check('direct browser CDP reaches exactly the bound application renderer',async()=>{
   const deadline=Date.now()+15000;
   while(Date.now()<deadline){const value=await client.send('Target.getTargets'),all=value.targetInfos.filter(t=>t.type==='page');assert.ok(all.length<=1,'Unexpected extra page target');assert.ok(all.every(t=>['','about:blank',expectedURL].includes(t.url.split('#')[0])),'Unexpected page URL');const pages=all.filter(t=>t.url.split('#')[0]===expectedURL);if(pages.length){targetId=pages[0].targetId;break;}await delay(50);}
   assert.ok(targetId,'Expected application page unavailable');const attached=await client.send('Target.attachToTarget',{targetId,flatten:true});sessionId=attached.sessionId;
   let ready=false;const readyBy=Date.now()+15000;while(Date.now()<readyBy){ready=await evaluate('Boolean(window.linecraft && window.linecraftDesktop && window.linecraft.runAction)');if(ready)break;await delay(50);}assert.equal(ready,true);assert.equal(await evaluate('location.href.split("#")[0]'),expectedURL);assert.equal(await evaluate('Boolean(window.linecraftDevelopment)'),mode==='source');
   const listener=await execute(path.join(process.env.SystemRoot,'System32/netstat.exe'),['-ano','-p','tcp'],{windowsHide:true,timeout:10000,maxBuffer:2*1024*1024});report.attachedListener=ownedListener(listener.stdout,endpoint.port,child.pid);report.attachedVisibility=await sample();
  });
  const baseline=await evaluate('window.linecraft.editor.serialize()');assert.equal(await evaluate('window.linecraft.getDocumentState().dirty'),false);assert.equal(JSON.parse(baseline).entities.length,0);
  let accepted;
  await check('literal renderer LINE has exact 240-unit endpoints',async()=>{
   await evaluate('(()=>{for(const token of ["LINE","0,0","240,0",""])window.linecraft.execute(token);return true;})()');accepted=await evaluate('window.linecraft.editor.serialize()');const doc=JSON.parse(accepted);assert.equal(doc.entities.length,1);assert.equal(doc.entities[0].type,'LINE');assert.deepEqual(doc.entities[0].start,{x:0,y:0});assert.deepEqual(doc.entities[0].end,{x:240,y:0});
  });
  await check('full Undo Redo Undo returns the exact clean baseline',async()=>{
   await evaluate('window.linecraft.runAction("undo")');assert.equal(await evaluate('window.linecraft.editor.serialize()'),baseline);await evaluate('window.linecraft.runAction("redo")');assert.equal(await evaluate('window.linecraft.editor.serialize()'),accepted);await evaluate('window.linecraft.runAction("undo")');assert.equal(await evaluate('window.linecraft.editor.serialize()'),baseline);assert.equal(await evaluate('window.linecraft.getDocumentState().dirty'),false);assert.equal(await evaluate('window.linecraft.get3DState().documentActionBusy'),false);assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'),0);report.finalVisibility=await sample();
  });
  await check('clean renderer close exits the owned child normally',async()=>{
   try{await evaluate('window.linecraft.runAction("close")');}catch(error){report.closeRPC=error.message;}const exit=await bounded(childExit,10000,'Owned child did not close normally');assert.equal(exit.code,0);assert.equal(exit.signal,null);assert.equal(forced,false);
  });
  assert.equal(sha(fs.readFileSync(executable)),executableSHA256);if(archive)assert.equal(sha(fs.readFileSync(archive)),archiveSHA256);for(const row of manifest.runtimeFiles)assert.equal(sha(readRuntime(row.file)),row.sha256);for(const row of manifest.extraResources)assert.equal(sha(readExtra(row.file)),row.sha256);assert.equal(report.logFailure,undefined);report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack||String(error);process.exitCode=1;}
 finally{
  clearTimeout(budgetTimer);
  if(child&&!closed){forced=true;report.killRequested=child.kill();try{await bounded(childExit,5000,'Owned child cleanup unresolved');}catch{}report.status='failed';report.cleanupFailure='Forced termination of the owned diagnostic child';process.exitCode=1;}
  if(client)client.close();for(const fd of [stdoutFD,stderrFD])if(fd!==undefined)fs.closeSync(fd);report.childExit=exitResult;report.forcedTermination=forced;report.unresolvedOwnedChild=Boolean(child&&!closed);report.descendantExitIndependentlyEnumerated=false;report.completedAt=new Date().toISOString();await fsp.writeFile(path.join(work,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(report.status.toUpperCase()+': '+report.tests.length+'/5 non-inspector diagnostic checks; '+path.relative(root,path.join(work,'results.json')));
 }
}
main().catch(error=>{console.error('Non-inspector preflight failed ('+(error.code||error.name)+'); no acceptance claimed.');process.exitCode=1;});
