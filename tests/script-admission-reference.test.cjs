'use strict';
// Explicit pre-fix references. Expected nonzero until the proposed admission
// seam exists. The loaded service is not patched or replaced by a model.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const contract=require('./fixtures/script-admission-contract.json');
const source=fs.readFileSync(path.join(__dirname,'../desktop/script-control.cjs'),'utf8');
const localFile=String.raw`C:\synthetic-private\connection.json`;
const token=Buffer.alloc(32,0x5a).toString('hex'); // deterministic nonsecret
const marker='SYNTHETIC_PRIVATE_ERROR_MARKER';
const failure=code=>Object.assign(Error(marker),{code});
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
const bounded=promise=>{
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('HARNESS_TIMEOUT')),500);})]).finally(()=>clearTimeout(timer));
};

function harness({mode='allow',existing=false}={}){
 let identity=0,owned=null,onRevoked,handler;
 const object=contents=>({id:++identity,contents});
 const files=new Map(existing?[[localFile,object('preexisting synthetic sentinel')]]:[]);
 const state={tokenCalls:0,listenCalls:0,nodeOpenCalls:0,writeCalls:0,dispatchCalls:0,
  helperPrepareCalls:0,helperCreateCalls:0,helperPublishCalls:0,helperCheckCalls:0,helperCloseCalls:0,
  listening:false,revoked:false,unsupportedModules:[],harnessFaults:[],events:[],diagnostics:[]};
 const event=name=>state.events.push(name);
 const demand=(condition,label)=>{if(!condition){state.harnessFaults.push(label);throw failure('HARNESS_ADAPTER');}};
 let releasePublication;
 const publicationGate=new Promise(resolve=>{releasePublication=resolve;});
 const write=async(file,text)=>{state.writeCalls++;event('write');file.contents=text;};
 const lease={sessionId:contract.sessionId,
  async publish(connection){
   state.helperPublishCalls++;event('helper.publish');
   demand(owned&&connection?.format==='LinecraftControl/1'&&connection.host==='127.0.0.1'&&connection.port===43210&&connection.token===token,'publish-input');
   if(mode==='deferred')await publicationGate;
   await write(owned,JSON.stringify(connection));
   if(mode==='publish')throw failure('EIO');
   return {version:1,sessionId:contract.sessionId,ready:true};
  },
  async checkReady(request){
   state.helperCheckCalls++;event('helper.checkReady');
   demand(request?.sessionId===contract.sessionId&&Number.isSafeInteger(request.sequence)&&request.sequence>=1,'check-ready-input');
   if(state.revoked)throw failure('HELPER_EOF');
   return {version:1,sessionId:mode==='wrong-session'?'synthetic-stale-session':contract.sessionId,
    sequence:mode==='wrong-sequence'?request.sequence-1:request.sequence,ready:true};
  },
  async close(){
   state.helperCloseCalls++;event('helper.close');
   if(mode==='cleanup')throw failure('EACCES');
   for(const [name,value] of files)if(value===owned)files.delete(name);
   return {removed:![...files.values()].includes(owned)};
  }
 };
 const admission={async prepare(request){
  state.helperPrepareCalls++;event('helper.prepare');
  demand(request?.connectionFile===localFile&&typeof request.onRevoked==='function','prepare-input');
  onRevoked=request.onRevoked;
  if(mode==='denied')throw Object.assign(Error('Synthetic unsupported path policy.'),{code:contract.pathError});
  state.helperCreateCalls++;event('helper.create');
  if(mode==='prepare')throw failure('EACCES');
  if(files.has(localFile))throw failure('EEXIST');
  owned=object('');files.set(localFile,owned);return lease;
 }};
 const disk={async open(file,flags,permissions){
  state.nodeOpenCalls++;event('node.open');demand(file===localFile&&flags==='wx'&&permissions===0o600,'legacy-open-input');
  if(files.has(file))throw failure('EEXIST');
  const opened=object('');files.set(file,opened);
  return {async writeFile(text){await write(opened,text);},async sync(){event('node.sync');},async close(){event('node.close');}};
 },async unlink(file){event('node.unlink');if(mode==='cleanup')throw failure('EACCES');files.delete(file);}};
 const syncDisk={readFileSync(file){if(!files.has(file))throw failure('ENOENT');return files.get(file).contents;},
  unlinkSync(file){event('node.unlinkSync');if(mode==='cleanup')throw failure('EACCES');files.delete(file);}};
 const network={createServer(callback){demand(typeof callback==='function','http-handler');handler=callback;event('createServer');return {
  once(){return this;},listen(port,host,ready){demand(port===0&&host==='127.0.0.1'&&typeof ready==='function','listen-input');state.listenCalls++;event('listen');state.listening=true;ready();},
  address(){return {port:43210};},closeAllConnections(){event('closeAllConnections');},close(done){event('server.close');state.listening=false;done();}
 };}};
 const modules={'node:http':network,'node:fs/promises':disk,'node:fs':syncDisk,'node:path':path.win32,'node:crypto':{
  randomBytes(size){demand(size===32,'token-size');state.tokenCalls++;event('token');return Buffer.alloc(size,0x5a);},
  timingSafeEqual(a,b){return crypto.timingSafeEqual(a,b);}
 }};
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,Buffer,require(name){
  if(!Object.hasOwn(modules,name)){state.unsupportedModules.push(name);throw failure('HARNESS_UNSUPPORTED_MODULE');}
  return modules[name];
 }},{filename:'synthetic-script-control.cjs',timeout:1000});
 const snapshot=()=>({tokenCalls:state.tokenCalls,listenCalls:state.listenCalls,nodeOpenCalls:state.nodeOpenCalls,
  writeCalls:state.writeCalls,dispatchCalls:state.dispatchCalls,descriptorPresent:files.has(localFile)});
 const cleanHarness=()=>{
  assert.deepEqual(state.unsupportedModules,[],'Unsupported modules are harness errors, never admission rejection');
  assert.deepEqual(state.harnessFaults,[],'Malformed adapter calls are harness errors, never admission rejection');
 };
 return {state,files,snapshot,cleanHarness,releasePublication,
  start(file=localFile){return module.exports.startScriptControl({connectionFile:file,admission,
   onDiagnostic:value=>state.diagnostics.push(value),dispatch:async()=>{state.dispatchCalls++;event('dispatch');return {ok:true};}});},
  revoke(){state.revoked=true;if(onRevoked)onRevoked({sessionId:contract.sessionId,reason:'helper-eof'});},
  replace(){const previous=files.get(localFile),replacement=object(previous.contents);files.set(localFile,replacement);return replacement;},
  async request({authorized=true,origin=false}={}){
   assert.equal(typeof handler,'function','Actual service must supply the HTTP handler');
   const headers={authorization:authorized?`Bearer ${token}`:`Bearer ${'0'.repeat(64)}`};if(origin)headers.origin='https://synthetic.invalid';
   const request={headers,method:'POST',url:'/v1/request',resume(){},async *[Symbol.asyncIterator](){yield Buffer.from('{"version":1,"method":"snapshot"}');}};
   const response={destroyed:false,status:null,body:null,writeHead(code){this.status=code;},end(text){this.body=JSON.parse(text);}};
   await bounded(handler(request,response));return response;
  }
 };
}

async function startup(h){
 let service,error;
 try{service=await bounded(h.start());}catch(value){error=value;}
 return {service,error};
}
function diagnostic(t,h){
 t.diagnostic(JSON.stringify({beforeHarnessCleanup:h.snapshot(),helperCalls:{prepare:h.state.helperPrepareCalls,publish:h.state.helperPublishCalls,
  check:h.state.helperCheckCalls,close:h.state.helperCloseCalls},listening:h.state.listening,events:h.state.events}));
}
function before(h,first,second){
 const a=h.state.events.indexOf(first),b=h.state.events.indexOf(second);
 assert.ok(a>=0&&b>=0&&a<b,`${first} must precede ${second}`);
}
async function close(service,h){
 try{h.releasePublication();if(service)await bounded(Promise.resolve(service.close()));}
 finally{h.cleanHarness();}
}

test('pending admission: preflight refusal has deliberate policy error and zero effects',async t=>{
 const h=harness({mode:'denied'}),result=await startup(h);
 try{diagnostic(t,h);assert.equal(result.error?.code,contract.pathError);assert.equal(h.state.helperPrepareCalls,1);
  assert.deepEqual(h.snapshot(),contract.preflightEffects);assert.equal(h.state.helperCreateCalls,0);
 }finally{await close(result.service,h);}
});
test('pending admission: child preparation failure precedes token and listener',async t=>{
 const h=harness({mode:'prepare'}),result=await startup(h);
 try{diagnostic(t,h);assert.equal(result.error?.code,contract.securityError);assert.equal(h.state.helperPrepareCalls,1);
  assert.equal(h.state.helperCreateCalls,1);assert.deepEqual(h.snapshot(),contract.preflightEffects);assert.ok(!result.error.message.includes(marker));
 }finally{await close(result.service,h);}
});
test('pending admission: publication failure revokes inert endpoint and owned child',async t=>{
 const h=harness({mode:'publish'}),result=await startup(h);
 try{diagnostic(t,h);assert.equal(result.error?.code,contract.securityError);assert.equal(h.state.helperPublishCalls,1);
  assert.equal(h.state.helperPrepareCalls,1);assert.equal(h.state.helperCreateCalls,1);assert.equal(h.state.helperCloseCalls,1);assert.equal(h.state.nodeOpenCalls,0);
  for(const [a,b] of [['helper.prepare','helper.create'],['helper.create','token'],['helper.create','listen'],['listen','helper.publish'],['helper.publish','server.close'],['server.close','helper.close']])before(h,a,b);
  assert.equal(h.state.dispatchCalls,0);assert.equal(h.state.listening,false);assert.equal(h.files.size,0);assert.ok(!result.error.message.includes(marker));
 }finally{await close(result.service,h);}
});
test('pending admission: actual handler is inert while publication is deferred',async t=>{
 const h=harness({mode:'deferred'});let service,error;
 const settled=h.start().then(value=>{service=value;},value=>{error=value;});
 try{await nextTurn();const response=await h.request();diagnostic(t,h);assert.equal(h.state.helperPublishCalls,1);
  assert.equal(response.status,contract.requestRejectionStatus);assert.equal(h.state.dispatchCalls,0);assert.equal(h.state.writeCalls,0);assert.equal(h.files.has(localFile),true);
 }finally{h.releasePublication();try{await bounded(settled);}finally{await close(service,h);}assert.equal(error,undefined);}
});
test('pending admission: helper EOF revokes readiness before another actual request',async t=>{
 const h=harness(),result=await startup(h);
 try{assert.equal(result.error,undefined);h.revoke();await nextTurn();const response=await h.request();diagnostic(t,h);
  assert.equal(response.status,contract.requestRejectionStatus);assert.equal(h.state.dispatchCalls,0);assert.equal(h.state.listening,false);
 }finally{await close(result.service,h);}
});
for(const mode of ['wrong-session','wrong-sequence'])test('pending admission: '+mode+' acknowledgment cannot authorize dispatch',async t=>{
 const h=harness({mode}),result=await startup(h);
 try{assert.equal(result.error,undefined);const response=await h.request();diagnostic(t,h);assert.equal(h.state.helperCheckCalls,1);
  assert.equal(response.status,contract.requestRejectionStatus);assert.equal(h.state.dispatchCalls,0);
 }finally{await close(result.service,h);}
});
test('pending admission: close preserves a replacement object with identical contents',async t=>{
 const h=harness(),result=await startup(h);
 try{assert.equal(result.error,undefined);const replacement=h.replace();await bounded(Promise.resolve(result.service.close()));diagnostic(t,h);assert.equal(h.files.get(localFile)===replacement,true,'Replacement object identity must be preserved');assert.equal(h.state.listening,false);
  assert.equal(h.state.diagnostics.length,0,'A preserved replacement alone is not an owned residual artifact');
 }finally{await close(result.service,h);}
});
test('pending admission: failed owned cleanup emits only a fixed residual diagnostic',async t=>{
 const h=harness({mode:'cleanup'}),result=await startup(h);
 try{assert.equal(result.error,undefined);await bounded(Promise.resolve(result.service.close()));diagnostic(t,h);assert.equal(h.state.listening,false);assert.equal(h.files.has(localFile),true);
  assert.equal(JSON.stringify(h.state.diagnostics)===JSON.stringify([{code:contract.residualDiagnostic}]),true,'Require exactly the fixed redacted residual diagnostic');
  assert.ok(!JSON.stringify(h.state.diagnostics).includes(marker));
 }finally{await close(result.service,h);}
});

test('control: actual service and authenticated handler work in the fake environment',async()=>{
 const h=harness(),result=await startup(h);
 try{assert.equal(result.error,undefined);assert.equal((await h.request()).status,200);assert.equal(h.state.dispatchCalls,1);}
 finally{await close(result.service,h);assert.equal(h.state.listening,false);assert.equal(h.files.size,0);}
});
for(const [name,options] of [['wrong bearer',{authorized:false}],['browser Origin',{origin:true}]])test('control: '+name+' does not dispatch',async()=>{
 const h=harness(),result=await startup(h);
 try{assert.equal(result.error,undefined);assert.equal((await h.request(options)).status,403);assert.equal(h.state.dispatchCalls,0);}
 finally{await close(result.service,h);}
});
test('control: exclusive creation keeps a preexisting synthetic object',async()=>{
 const h=harness({existing:true}),existing=h.files.get(localFile),result=await startup(h);
 try{assert.equal(result.error?.code,'EEXIST');assert.equal(h.files.get(localFile),existing);assert.equal(h.state.listening,false);assert.equal(h.state.writeCalls,0);}
 finally{await close(result.service,h);}
});
test('control: relative-path rejection has no token, endpoint or descriptor effects',async()=>{
 const h=harness();let error;
 try{await h.start('relative.json');}catch(value){error=value;}
 h.cleanHarness();assert.match(error.message,/absolute/);assert.deepEqual(h.snapshot(),contract.preflightEffects);
});
