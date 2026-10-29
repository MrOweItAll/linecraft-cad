'use strict';
const test=require('node:test');
// Actual main IPC and filesystem; mocked Electron shell/chooser, no windows.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),Module=require('node:module'),{EventEmitter}=require('node:events'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
assert.equal(process.versions.electron,undefined,'Run mocked host checks under Node, never Electron.');
assert.ok(!process.argv.some(arg=>arg.startsWith('--linecraft-')),'Mocked host checks reject application control flags.');
assert.equal(process.argv.length,2,'Mocked host checks accept no drawing paths or application arguments.');
const root=path.resolve(__dirname,'..'),work=path.join(process.env.LINECRAFT_QA_RUN_DIRECTORY||path.join(root,'work'),'structural-v1-'+Date.now()+'-'+process.pid);
const handlers=new Map(),events=new Map(),saveChoices=[],openChoices=[],calls={save:0,open:0};let window,heldChoice=null;
const app=new EventEmitter();Object.assign(app,{isPackaged:true,whenReady:async()=>{},setPath(){},getVersion:()=> 'test',quit(){}});
class Window extends EventEmitter{
 constructor(options){super();window=this;this.options=options;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:pathToFileURL(path.join(root,'index.html')).href},send(){},setWindowOpenHandler(){},closeDevTools(){}});}
 async loadFile(){}setTitle(title){this.title=title;}show(){}isDestroyed(){return false;}close(){}
}
const electron={app,BrowserWindow:Window,Menu:{buildFromTemplate:v=>v,setApplicationMenu(){}},dialog:{showErrorBox(){},showMessageBox:async()=>({response:2}),showSaveDialog:async()=>{calls.save++;return heldChoice?await heldChoice:saveChoices.shift()??{canceled:true};},showOpenDialog:async()=>{calls.open++;return openChoices.shift()??{canceled:true,filePaths:[]};}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:(name,fn)=>events.set(name,fn)},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){},onHeadersReceived(){}}}}};
const load=Module._load;Module._load=function(name,parent,isMain){return name==='electron'?electron:load.call(this,name,parent,isMain);};try{require('../desktop/main.cjs');}finally{Module._load=load;}
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));if(!process.env.LINECRAFT_QA_RUN_DIRECTORY)await fs.mkdir(path.join(root,'work'),{recursive:true});await fs.mkdir(work,{recursive:false});
 const {createEditor}=await import(pathToFileURL(path.join(root,'core.mjs'))),{createJoinedRoofSample}=await import(pathToFileURL(path.join(root,'tests/export-joined-roof-sample.mjs'))),bridge=await import(pathToFileURL(path.join(root,'architecture/structural-bridge.mjs')));
 const editor=createEditor(createJoinedRoofSample()),text=editor.serialize(),options={roofGroupId:'roof-1',componentId:'main',faceIds:null,memberTributaryAreaSF:100,memberLabel:'Synthetic same-member comparison'};
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},invoke=(channel,...args)=>handlers.get(channel)(event,...args),sourceFile=path.join(work,'original.json'),requestFile=path.join(work,'roof-request.json'),tests=[];
 const check=async(name,fn)=>test(name,async()=>{try{await fn();tests.push({name,status:'passed'});console.log('PASS '+name);}catch(error){tests.push({name,status:'failed',error:error.stack});console.log('FAIL '+name+': '+error.message);throw error;}});
 let record;
 await check('forged sender, child frame and remote URL reject both structural channels before native prompts',async()=>{
  const before={...calls};for(const forged of [{sender:{},senderFrame:event.senderFrame},{sender:event.sender,senderFrame:{url:event.senderFrame.url}}])for(const channel of ['linecraft:structural-export','linecraft:structural-import'])assert.equal((await handlers.get(channel)(forged,{text,options})).ok,false);
  const original=event.senderFrame.url;event.senderFrame.url='https://untrusted.invalid';for(const channel of ['linecraft:structural-export','linecraft:structural-import'])assert.equal((await invoke(channel,{text,options})).ok,false);event.senderFrame.url=original;assert.deepEqual(calls,before);
 });
 await check('malformed source, extra path/code fields and missing tributary area reject before native chooser',async()=>{
  const before={...calls};for(const payload of [{text:'broken',options},{text,options,path:requestFile},{text,options,code:'execute'},{text,options:{...options,memberTributaryAreaSF:0}},{text,options:{...options,memberTributaryAreaSF:undefined}}])assert.equal((await invoke('linecraft:structural-export',payload)).ok,false);assert.deepEqual(calls,before);
 });
 await check('export writes the source-derived request atomically and retains the native Save association',async()=>{
  saveChoices.push({canceled:false,filePath:sourceFile});assert.equal((await invoke('linecraft:save',text,true)).ok,true);const title=window.title;
  saveChoices.push({canceled:false,filePath:requestFile});const result=await invoke('linecraft:structural-export',{text,options});assert.equal(result.ok,true,result.error);record=result.record;assert.deepEqual(JSON.parse(await fs.readFile(requestFile,'utf8')),bridge.createStructuralRoofExport(text,options));assert.deepEqual(result.record,record);assert.equal(window.title,title);assert.equal(await fs.readFile(sourceFile,'utf8'),text);
  const dialogs=calls.save;assert.equal((await invoke('linecraft:save',text,false)).ok,true);assert.equal(calls.save,dialogs);assert.deepEqual((await fs.readdir(work)).filter(n=>n.startsWith('.roof-request.')),[]);
  saveChoices.push({canceled:false,filePath:requestFile});assert.equal((await invoke('linecraft:structural-export',{text,options})).ok,true);
 });
 // Independent host reference: identities bind the request; numeric declarations are literal.
 await check('literal V1 result imports through host and rejects substituted protocol/source identity',async()=>{
  assert.deepEqual(record.region.faces.map(f=>f.risePer12).sort((a,b)=>a-b),[6,6,8,8]);
  const result={version:1,kind:'linecraft-structural-roof-result',status:'calculation-only',exportHash:record.exportHash,
   source:{documentHash:record.source.documentHash,architectureHash:record.source.architectureHash},regionId:record.regionId,
   engine:{id:'synthetic-literal-host-reference',version:'test-only',sourceCommit:'1'.repeat(40),roofLiveSHA256:'2'.repeat(64)},
   calculationBoundsPSF:{min:12,max:20},calculationPrecision:{factorDecimals:4,loadDecimals:3},
   calculations:[6,8].flatMap(pitch=>record.region.faces.filter(f=>f.risePer12===pitch).map(face=>({faceId:face.id,pitchRisePer12:pitch,memberTributaryAreaSF:100,F:pitch,R1:.8,R2:1,L0PSF:20,LrPSF:16}))),
   warnings:['Synthetic arithmetic declaration only; no actual engine execution or engineering approval.']};
  const file=path.join(work,'literal-v1-result.json'),requestBytes=await fs.readFile(requestFile),drawingBefore=editor.serialize();
  await fs.writeFile(file,JSON.stringify(result));openChoices.push({canceled:false,filePaths:[file]});const accepted=await invoke('linecraft:structural-import',{text,exportRecord:record});
  assert.equal(accepted.ok,true,accepted.error);assert.deepEqual(accepted.record.calculations.map(x=>x.LrPSF),[16,16,16,16]);assert.equal(accepted.record.verification.engineExecutionAuthenticity,'unverified');assert.equal(accepted.record.verification.memberCapacity,'not-provided');
  for(const mutate of [x=>x.version=2,x=>x.kind='linecraft-structural-roof-assignment-result',x=>x.exportHash='0'.repeat(64),x=>x.source.documentHash='0'.repeat(64),x=>x.source.architectureHash='0'.repeat(64),x=>x.regionId='foreign-region']){
   const bad=structuredClone(result);mutate(bad);await fs.writeFile(file,JSON.stringify(bad));openChoices.push({canceled:false,filePaths:[file]});assert.equal((await invoke('linecraft:structural-import',{text,exportRecord:record})).ok,false);
  }
  assert.equal(editor.serialize(),drawingBefore);assert.equal(await fs.readFile(sourceFile,'utf8'),text);assert.ok((await fs.readFile(requestFile)).equals(requestBytes));
 });
 await check('cancel leaves the drawing and prior exported request byte-exact',async()=>{
  const before=await fs.readFile(requestFile);saveChoices.push({canceled:true});assert.deepEqual(await invoke('linecraft:structural-export',{text,options}),{ok:false,canceled:true});openChoices.push({canceled:true,filePaths:[]});assert.deepEqual(await invoke('linecraft:structural-import',{text,exportRecord:record}),{ok:false,canceled:true});assert.ok((await fs.readFile(requestFile)).equals(before));assert.equal(await fs.readFile(sourceFile,'utf8'),text);
 });
 await check('current native drawing, non-JSON path and unrelated JSON cannot be replaced',async()=>{
  const other=path.join(work,'unrelated.json'),spoofed=path.join(work,'spoofed-native.json'),badHash=path.join(work,'bad-hash.json');await fs.writeFile(other,'{"keep":true}');const nativeWithSentinel=JSON.stringify({...JSON.parse(text),kind:'linecraft-structural-roof-region'});await fs.writeFile(spoofed,nativeWithSentinel);const tampered=structuredClone(record);tampered.member.tributaryAreaSF=101;await fs.writeFile(badHash,JSON.stringify(tampered));for(const target of [sourceFile,path.join(work,'drawing.linecraft'),other,spoofed,badHash]){saveChoices.push({canceled:false,filePath:target});assert.equal((await invoke('linecraft:structural-export',{text,options})).ok,false);}assert.equal(await fs.readFile(sourceFile,'utf8'),text);assert.equal(await fs.readFile(other,'utf8'),'{"keep":true}');assert.equal(await fs.readFile(spoofed,'utf8'),nativeWithSentinel);assert.equal(JSON.parse(await fs.readFile(badHash,'utf8')).member.tributaryAreaSF,101);assert.equal(await fs.stat(path.join(work,'drawing.linecraft')).catch(e=>e.code),'ENOENT');
 });
 await check('stale and tampered export imports fail before reading any selected result',async()=>{
  const before=calls.open;const changed=JSON.parse(text);changed.architecture.levels[0].defaultCeilingElevation+=1;
  assert.equal((await invoke('linecraft:structural-import',{text:JSON.stringify(changed),exportRecord:record})).ok,false);
  const altered=structuredClone(record);altered.memberTributaryAreaSF=999;assert.equal((await invoke('linecraft:structural-import',{text,exportRecord:altered})).ok,false);assert.equal(calls.open,before);
 });
 await check('malformed, oversized, invalid UTF-8 and non-file result choices fail without drawing writes',async()=>{
  const malformed=path.join(work,'malformed.json'),oversized=path.join(work,'oversized.json'),invalidUTF8=path.join(work,'invalid-utf8.json'),directory=path.join(work,'directory.json');await fs.writeFile(malformed,'{"version":');await fs.writeFile(oversized,Buffer.alloc(2*1024*1024+1,32));await fs.writeFile(invalidUTF8,Buffer.from([0xff,0xfe,0xfa]));await fs.mkdir(directory);
  for(const file of [malformed,oversized,invalidUTF8,directory]){openChoices.push({canceled:false,filePaths:[file]});assert.equal((await invoke('linecraft:structural-import',{text,exportRecord:record})).ok,false);}assert.equal(await fs.readFile(sourceFile,'utf8'),text);
 });
 await check('pending structural native choice excludes concurrent Open/Save and clears the shared file gate',async()=>{
  let finish;heldChoice=new Promise(resolve=>{finish=resolve;});const before=calls.save,operation=invoke('linecraft:structural-export',{text,options});for(let i=0;i<300&&calls.save===before;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.save,before+1);
  assert.equal((await invoke('linecraft:save',text,false)).ok,false);assert.equal((await invoke('linecraft:open')).ok,false);finish({canceled:true});assert.equal((await operation).canceled,true);heldChoice=null;assert.equal((await invoke('linecraft:save',text,false)).ok,true);
 });
 await check('optional protocol never adds process execution, arbitrary path access or drawing mutation to preload',async()=>{
  const preload=await fs.readFile(path.join(root,'desktop/preload.cjs'),'utf8'),service=await fs.readFile(path.join(root,'desktop/structural-files.cjs'),'utf8');assert.match(preload,/exportStructuralRoofRequest: payload => ipcRenderer\.invoke\('linecraft:structural-export', payload\)/);assert.match(preload,/importStructuralRoofResult: payload => ipcRenderer\.invoke\('linecraft:structural-import', payload\)/);assert.doesNotMatch(service,/child_process|\bexec\(|\bspawn\(|eval\(|new Function/);assert.equal(editor.serialize(),text);
 });
 const names=['desktop/main.cjs','desktop/preload.cjs','desktop/structural-files.cjs','architecture/structural-bridge.mjs','tests/structural-files.test.cjs'],sourceSHA256=Object.fromEntries(await Promise.all(names.map(async name=>[name,createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex')])));
 const result={framework:'R13 actual main IPC registration, real roof module/filesystem, mocked Electron shell and owned native chooser destinations; no windows or external engine executed',completedAt:new Date().toISOString(),sourceSHA256,work,tests,total:tests.length,passed:tests.filter(t=>t.status==='passed').length,failed:tests.filter(t=>t.status==='failed').length};await fs.writeFile(path.join(work,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(`${result.passed}/${result.total} structural file checks passed`);process.exitCode=result.failed?1:0;
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
