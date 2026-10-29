'use strict';
// Explicit pre-fix reference: expected to exit nonzero until path enforcement exists.
// The service source runs with fake networking/files only; no real descriptor/token.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const contract=require('./fixtures/script-descriptor-contract.json');
const source=fs.readFileSync(path.join(__dirname,'../desktop/script-control.cjs'),'utf8');
const localFile=String.raw`C:\synthetic-private\connection.json`;

function harness({existing=false,fault}={}){
 const files=new Map(existing?[[localFile,'preexisting synthetic sentinel']]:[]);
 const state={listenCalls:0,openCalls:0,writeCalls:0,listening:false,unsupportedModules:[]};
 const error=code=>Object.assign(Error('Synthetic '+code+' failure.'),{code});
 let closeFailed=false;
 const disk={
  async open(file,flags,mode){
   state.openCalls++;assert.equal(flags,'wx');assert.equal(mode,0o600);
   if(fault==='open')throw error('EACCES');
   if(files.has(file))throw error('EEXIST');
   files.set(file,'');
   return {
    async writeFile(text){state.writeCalls++;files.set(file,text);if(fault==='write')throw error('EIO');},
    async sync(){if(fault==='sync')throw error('EIO');},
    async close(){if(fault==='close'&&!closeFailed){closeFailed=true;throw error('EIO');}}
   };
  },
  async unlink(file){files.delete(file);}
 };
 const syncDisk={readFileSync(file){if(!files.has(file))throw error('ENOENT');return files.get(file);},unlinkSync(file){files.delete(file);}};
 const network={createServer(){return {
  once(){return this;},
  listen(port,host,ready){assert.equal(port,0);assert.equal(host,'127.0.0.1');state.listenCalls++;state.listening=true;ready();},
  address(){return {port:43210};},
  closeAllConnections(){},
  close(done){state.listening=false;done();}
 };}};
 const modules={'node:http':network,'node:fs/promises':disk,'node:fs':syncDisk,'node:path':path.win32,'node:crypto':{
  randomBytes(size){return Buffer.alloc(size,0x5a);},timingSafeEqual(){throw error('UNEXPECTED_AUTH_CALL');}
 }};
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,Buffer,require(name){
  if(!Object.hasOwn(modules,name)){state.unsupportedModules.push(name);throw error('HARNESS_UNSUPPORTED_MODULE');}
  return modules[name];
 }},{filename:'synthetic-script-control.cjs',timeout:1000});
 return {state,files,start:module.exports.startScriptControl};
}
async function attempt(h,file=localFile){
 let service,error;
 try{service=await h.start({connectionFile:file,dispatch:async()=>({ok:true})});}catch(value){error=value;}
 const beforeCleanup={listenCalls:h.state.listenCalls,openCalls:h.state.openCalls,writeCalls:h.state.writeCalls,descriptorPresent:h.files.has(file)};
 if(service)await service.close();
 assert.deepEqual(h.state.unsupportedModules,[],'Missing harness adapters must never count as security rejection');
 return {service,error,beforeCleanup};
}

for(const fixture of contract.unsafePathCases)test('pending privacy contract: '+fixture.id,async t=>{
 const h=harness();assert.equal(path.win32.isAbsolute(fixture.path),true,'Exercise paths accepted by the old absolute-path guard');
 const result=await attempt(h,fixture.path);
 t.diagnostic(JSON.stringify({case:fixture.id,serviceAccepted:Boolean(result.service),beforeCleanup:result.beforeCleanup,closedAfterHarnessCleanup:!h.state.listening}));
 assert.equal(result.error?.code,contract.unsafePathErrorCode,'Require a deliberate path-policy error, not any incidental startup failure');
 assert.deepEqual(result.beforeCleanup,contract.preflightRejection);
 assert.equal(h.state.listening,false);assert.equal(h.files.size,0);
});

test('control: local lifecycle is observable without an OS endpoint or ACL claim',async()=>{
 const h=harness(),result=await attempt(h);
 assert.equal(result.error,undefined);assert.equal(Boolean(result.service),true);
 assert.deepEqual(result.beforeCleanup,{listenCalls:1,openCalls:1,writeCalls:1,descriptorPresent:true});
 assert.equal(h.state.listening,false);assert.equal(h.files.size,0);
});
test('control: existing absolute-path rejection has no listener or file effects',async()=>{
 const h=harness(),result=await attempt(h,'relative.json');
 assert.match(result.error.message,/absolute/);assert.deepEqual(result.beforeCleanup,contract.preflightRejection);
});
test('control: exclusive creation preserves the preexisting synthetic artifact',async()=>{
 const h=harness({existing:true}),result=await attempt(h);
 assert.equal(result.error?.code,'EEXIST');assert.equal(h.files.get(localFile),'preexisting synthetic sentinel');
 assert.equal(h.state.listening,false);assert.equal(h.state.writeCalls,0);
});
for(const fault of ['open','write','sync','close'])test('control: '+fault+' failure closes the endpoint and cleans owned synthetic bytes',async()=>{
 const h=harness({fault}),result=await attempt(h);
 assert.equal(result.error?.code,fault==='open'?'EACCES':'EIO');
 assert.equal(h.state.listening,false);assert.equal(h.files.size,0);
 assert.doesNotMatch(result.error.message,/(?:5a){32}/);
});
test('control: normal close preserves a replacement synthetic artifact',async()=>{
 const h=harness(),service=await h.start({connectionFile:localFile,dispatch:async()=>({ok:true})});
 h.files.set(localFile,JSON.stringify({token:'replacement nonsecret sentinel'}));
 await service.close();assert.equal(h.state.listening,false);
 assert.equal(h.files.get(localFile),JSON.stringify({token:'replacement nonsecret sentinel'}));
});
