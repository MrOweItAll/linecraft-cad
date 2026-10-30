'use strict';
// Node-only fixture: actual main/queue/core, fake Electron, owned development profile.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const Module=require('node:module'),{EventEmitter}=require('node:events');
const {pathToFileURL}=require('node:url'),{randomUUID,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),mainFile=path.join(root,'desktop/main.cjs');
const A=JSON.stringify({format:'Linecraft/1',entities:[{id:'A',type:'LINE',layer:'0',start:{x:1,y:2},end:{x:11,y:2}}]});
const B=JSON.stringify({format:'Linecraft/1',entities:[{id:'B',type:'CIRCLE',layer:'0',center:{x:20,y:40},radius:8}]});
const C=JSON.stringify({format:'Linecraft/1',entities:[{id:'C',type:'LINE',layer:'0',start:{x:100,y:200},end:{x:130,y:240}}]});
const marker='UNRELATED OWNED FILE',directories=[],hosts=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const failure=()=>Object.assign(Error('SYNTHETIC_PRIVATE_CHECKPOINT_MESSAGE'),{code:'EIO'});
async function host({record='valid',packaged=false}={}){
  const directory=path.join(root,'work','development-state-reference',Date.now()+'-'+randomUUID());
  const profile=path.join(directory,'profile'),a=path.join(directory,'A.linecraft'),b=path.join(directory,'B.linecraft');
  const checkpoint=path.join(profile,'development-document-path.json'),sentinel=path.join(directory,'unrelated.tmp');
  await fs.mkdir(profile,{recursive:true});directories.push(directory);
  await fs.writeFile(a,A);await fs.writeFile(b,B);await fs.writeFile(sentinel,marker);
  const association=(drawingPath=a,importSaveName=null)=>JSON.stringify({format:'LinecraftDevelopmentPath/1',drawingPath,importSaveName});
  let checkpointText=association();
  if(record==='malformed')checkpointText='{broken';
  if(record==='wrong-format')checkpointText=JSON.stringify({format:'Other/1',drawingPath:a});
  if(record==='relative')checkpointText=association('relative.linecraft');
  if(record==='missing-target')checkpointText=association(path.join(directory,'missing.linecraft'));
  if(record==='directory')checkpointText=association(profile);
  if(record==='invalid-target')await fs.writeFile(a,'{invalid');
  if(record==='import-name')checkpointText=association(null,'Imported.linecraft');
  if(record!=='absent')await fs.writeFile(checkpoint,checkpointText);
  const beforeStartup={nativeA:await fs.readFile(a,'utf8'),nativeB:await fs.readFile(b,'utf8'),checkpoint:record==='absent'?null:await fs.readFile(checkpoint,'utf8')};
  const handlers=new Map(),events=new Map(),choices={open:[],save:[],confirm:[]},trace=[],warnings=[];
  let phase=null,window,startup,hold=null,checkpointRenames=0;
  const owned=filename=>assert.ok(path.resolve(filename).startsWith(directory+path.sep),'Only owned writes are permitted.');
  const choose=async queue=>{const result=queue.shift();if(result instanceof Error)throw result;return typeof result==='function'?result():result;};
  const facade={...fs,
    mkdir:async(filename,options)=>{owned(filename);trace.push({operation:'mkdir',filename});if(phase==='mkdir')throw failure();return fs.mkdir(filename,options);},
    open:async(filename,flags,mode)=>{
      owned(filename);assert.equal(flags,'wx');assert.equal(mode,0o600);
      assert.ok(path.basename(filename).startsWith('.')&&filename.endsWith('.tmp'));
      const scoped=path.dirname(filename)===profile;trace.push({operation:'open',filename,scoped});
      if(scoped&&phase==='open')throw failure();
      const handle=await fs.open(filename,flags,mode);let closes=0;
      return {writeFile:async(text,encoding)=>{trace.push({operation:'write',filename,scoped});if(scoped&&['write','cleanup'].includes(phase)){await handle.writeFile(Buffer.from(text).subarray(0,9));throw failure();}return handle.writeFile(text,encoding);},
        sync:async()=>{trace.push({operation:'sync',filename,scoped});if(scoped&&phase==='sync')throw failure();return handle.sync();},
        close:async()=>{trace.push({operation:'close',filename,scoped});if(scoped&&phase==='close'&&++closes===1)throw failure();return handle.close();}};
    },
    rename:async(from,to)=>{
      owned(from);owned(to);const scoped=to===checkpoint;
      trace.push({operation:'rename',from,to,scoped});
      if(scoped){checkpointRenames++;if(hold){const waiting=hold;hold=null;waiting.entered.resolve();await waiting.release.promise;}
        if(phase==='rename'||phase==='compensation'&&checkpointRenames===2)throw failure();}
      return fs.rename(from,to);
    },
    unlink:async filename=>{owned(filename);assert.ok(path.basename(filename).startsWith('.')&&filename.endsWith('.tmp'));trace.push({operation:'unlink',filename});if(path.dirname(filename)===profile&&phase==='cleanup')throw failure();return fs.unlink(filename);},
  };
  const app=new EventEmitter();Object.assign(app,{isPackaged:packaged,
    whenReady:()=>({then:callback=>(startup=Promise.resolve().then(callback))}),
    getPath:key=>{assert.equal(key,'userData');return profile;},
    setPath:(key,value)=>{assert.equal(key,'userData');assert.equal(value,profile);},
    getVersion:()=> 'synthetic',quit:()=>{},
    requestSingleInstanceLock:metadata=>{assert.equal(metadata.profile,profile);assert.deepEqual(metadata.requests,[]);return true;},
  });
  class FakeWindow extends EventEmitter{
    constructor(){super();window=this;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:pathToFileURL(path.join(root,'index.html')).href},send:()=>{},setWindowOpenHandler:()=>{},closeDevTools:()=>{}});}
    isDestroyed(){return false;}setTitle(value){this.title=value;}loadFile(){return Promise.resolve();}
    show(){throw Error('No real or fake window show is expected.');}close(){}
  }
  const electron={app,BrowserWindow:FakeWindow,Menu:{buildFromTemplate:x=>x,setApplicationMenu:()=>{}},
    dialog:{showOpenDialog:async()=>await choose(choices.open)??{canceled:true,filePaths:[]},showSaveDialog:async()=>await choose(choices.save)??{canceled:true},showMessageBox:async()=>await choose(choices.confirm)??{response:2},showErrorBox:()=>{throw Error('Unexpected startup error dialog.');}},
    ipcMain:{handle:(name,callback)=>handlers.set(name,callback),on:(name,callback)=>events.set(name,callback)},
    session:{defaultSession:{setPermissionRequestHandler:()=>{},setPermissionCheckHandler:()=>{},webRequest:{onBeforeRequest:()=>{},onHeadersReceived:()=>{}}}},
  };
  const source=await fs.readFile(mainFile,'utf8'),instance=new Module(mainFile,module),realRequire=Module.createRequire(mainFile);
  instance.filename=mainFile;instance.paths=Module._nodeModulePaths(path.dirname(mainFile));
  instance.require=name=>{if(name==='electron')return electron;if(name==='node:fs/promises')return facade;if(['./dev-watch.cjs','./script-control.cjs','./import-files.cjs'].includes(name))throw Error('Watcher, scripting and converter are outside this fixture.');return realRequire(name);};
  instance.__process=Object.freeze({argv:[process.execPath,...(packaged?[]:[mainFile]),'--linecraft-no-watch','--user-data-dir='+profile],pid:process.pid,platform:process.platform,versions:{},cwd:()=>root});
  instance.__console={warn:(...args)=>warnings.push(args),error:(...args)=>warnings.push(args)};
  const observer='\nmodule.exports.snapshot=()=>({...documentAssociation(),authorization:discardAuthorization,authorized:Boolean(discardAuthorized()),busy:fileOperationBusy});\n';
  instance._compile("'use strict'; const process=module.__process,console=module.__console;\n"+source+observer,mainFile);
  assert.ok(startup);await startup;assert.ok(window&&handlers.has('linecraft:save'));
  const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
  const invoke=(name,...args)=>handlers.get(name)(event,...args),snapshot=()=>structuredClone(instance.exports.snapshot());
  const result={directory,profile,a,b,checkpoint,sentinel,trace,warnings,choices,invoke,snapshot,association,beforeStartup,mainSHA256:hash(source),
    get title(){return window.title;},setPhase:value=>{phase=value;checkpointRenames=0;},
    update:value=>events.get('linecraft:document-state')(event,value),
    invalidUpdate:value=>events.get('linecraft:document-state')({sender:{},senderFrame:{}},value),
    untrustedConfirm:()=>handlers.get('linecraft:confirm-discard')({sender:{},senderFrame:{}},'Untrusted'),
    holdCheckpoint:()=>{hold={entered:deferred(),release:deferred()};return hold;},
    enqueue:filename=>{assert.ok([a,b].includes(filename));app.emit('open-file',{preventDefault:()=>{}},filename);},
    queue:async()=>{app.emit('open-file',{preventDefault:()=>{}},b);const peek=await invoke('linecraft:open-request',{action:'peek'});assert.ok(peek.request);const prepared=await invoke('linecraft:open-request',{action:'prepare',id:peek.request.id});assert.equal(prepared.ok,true,prepared.error);assert.equal(prepared.text,B);return peek.request.id;},
  };hosts.push(result);return result;
}
module.exports={host,A,B,C,marker,hash,directories,hosts,deferred};
