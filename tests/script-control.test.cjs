'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {startScriptControl,createWindowDispatcher}=require('../desktop/script-control.cjs');
async function post(connection,request,headers={}){
  return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:connection.port,path:'/v1/request',method:'POST',headers:{Authorization:`Bearer ${connection.token}`,...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.end(JSON.stringify(request));});
}
test('opt-in loopback bridge and real CLI drive the editor with no screen or mouse',async()=>{
  const {createEditor}=await import('../core.mjs'),{createScriptingAPI}=await import('../linecraft-scripting.mjs');
  const editor=createEditor({entities:[{id:'n',type:'TEXT',layer:'0',position:{x:0,y:0},text:'Before',height:2,rotation:0,style:'Standard'}]});
  const api=createScriptingAPI({getEditor:()=>editor});const dir=await fs.mkdtemp(path.join(os.tmpdir(),'linecraft-script-')),file=path.join(dir,'connection.json');
  const service=await startScriptControl({connectionFile:file,dispatch:request=>api.request(request)});
  try{
    const connection=JSON.parse(await fs.readFile(file,'utf8')),request={version:1,method:'describe'};
    assert.equal((await post({...connection,token:'0'.repeat(64)},request)).status,403);assert.equal((await post(connection,request,{Origin:'https://example.invalid'})).status,403);
    assert.equal((await post(connection,{version:1,method:'evaluate',code:'process.exit()'})).status,400);
    const cli=path.resolve(__dirname,'../tools/linecraft-control.cjs');
    const described=JSON.parse((await promisify(execFile)(process.execPath,[cli,file,'describe'])).stdout);assert.equal(described.ok,true);
    const edit={version:1,method:'apply',requestId:'integration-1',params:{baseToken:described.baseToken,label:'Change one note',steps:[{op:'text',id:'n',patch:{text:'After'}}]}};
    const requestFile=path.join(dir,'request.json');await fs.writeFile(requestFile,JSON.stringify(edit));
    const result=JSON.parse((await promisify(execFile)(process.execPath,[cli,file,'apply',requestFile])).stdout);assert.equal(result.ok,true);assert.equal(editor.state.entities[0].text,'After');assert.equal(editor.undo().ok,true);assert.equal(editor.state.entities[0].text,'Before');
    await assert.rejects(startScriptControl({connectionFile:file,dispatch:async()=>({ok:true})}),/EEXIST/);
  }finally{await service.close();await assert.rejects(fs.stat(file),/ENOENT/);await fs.rm(dir,{recursive:true,force:true});}
});
test('desktop dispatch invokes the fixed renderer API and treats code-like text as data',async()=>{
  const vm=require('node:vm');let received;
  const context={window:{linecraft:{scripting:{request:request=>{received=request;return {ok:true};}}}}};
  const window={isDestroyed:()=>false,webContents:{isLoading:()=>false,executeJavaScript:source=>vm.runInNewContext(source,context)}};
  const dispatch=createWindowDispatcher(()=>window),request={version:1,method:'apply',requestId:'quoted',params:{text:'"); globalThis.injected=true; //\u2028</script>'}};
  assert.equal((await dispatch(request)).ok,true);assert.equal(JSON.stringify(received),JSON.stringify(request));assert.equal(context.injected,undefined);
  window.webContents.isLoading=()=>true;assert.equal((await dispatch(request)).ok,false);
});

async function fixture(t,dispatch=async()=>({ok:true})){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'linecraft-transport-')),file=path.join(dir,'connection.json');
  const service=await startScriptControl({connectionFile:file,dispatch});
  t.after(async()=>{await service.close();await fs.rm(dir,{recursive:true,force:true});});
  return {dir,file,service,connection:JSON.parse(await fs.readFile(file,'utf8'))};
}
test('descriptors are exclusive and invalid paths fail without replacing an existing file',async t=>{
  const {file}=await fixture(t),before=await fs.readFile(file,'utf8');
  await assert.rejects(startScriptControl({connectionFile:file,dispatch:async()=>({ok:true})}),/EEXIST/);
  assert.equal(await fs.readFile(file,'utf8'),before);
  await assert.rejects(startScriptControl({connectionFile:'relative.json',dispatch:async()=>({ok:true})}),/absolute/);
  await assert.rejects(startScriptControl({connectionFile:path.resolve('unused.json')}),/dispatcher/);
});
test('even an empty browser Origin is rejected and authenticated unknown endpoints stay closed',async t=>{
  let calls=0;const {connection}=await fixture(t,async()=>{calls++;return {ok:true};});
  assert.equal((await post(connection,{version:1,method:'describe'},{Origin:''})).status,403);
  assert.equal((await post(connection,{version:1,method:'describe'},{Authorization:'Bearer bad'})).status,403);
  const unknown=await new Promise((resolve,reject)=>{
    const req=http.request({host:connection.host,port:connection.port,path:'/anything',method:'GET',headers:{Authorization:`Bearer ${connection.token}`}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();
  });
  assert.equal(unknown,404);assert.equal(calls,0);
});
test('overlapping requests are rejected without dispatching a second mutation',async t=>{
  let entered,release;const started=new Promise(resolve=>entered=resolve),blocked=new Promise(resolve=>release=resolve);let calls=0;
  const {connection}=await fixture(t,async()=>{calls++;entered();await blocked;return {ok:true};});
  const first=post(connection,{version:1,method:'apply'});await started;
  assert.equal((await post(connection,{version:1,method:'apply'})).status,409);assert.equal(calls,1);
  release();assert.equal((await first).status,200);
  assert.equal((await post(connection,{version:1,method:'snapshot'})).status,200);assert.equal(calls,2);
});
test('normal shutdown removes the descriptor synchronously and repeated close is safe',async t=>{
  const {service,file,connection}=await fixture(t);const closed=service.close();
  assert.equal(require('node:fs').existsSync(file),false);assert.equal(service.close(),closed);await closed;
  await assert.rejects(post(connection,{version:1,method:'describe'}),/ECONNREFUSED|ECONNRESET/);
});
test('shutdown preserves a replacement descriptor that is no longer owned by this service',async t=>{
  const {service,file,connection}=await fixture(t),replacement={...connection,token:'f'.repeat(64)};
  await fs.writeFile(file,JSON.stringify(replacement));await service.close();
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),replacement);
});
test('malformed and oversized transport bodies never reach the renderer dispatcher',async t=>{
  let calls=0;const {connection}=await fixture(t,async()=>{calls++;return {ok:true};});
  async function raw(body){return new Promise((resolve,reject)=>{
    const req=http.request({host:connection.host,port:connection.port,path:'/v1/request',method:'POST',headers:{Authorization:`Bearer ${connection.token}`,'Content-Length':Buffer.byteLength(body)}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.end(body);
  });}
  assert.equal((await raw('{')).status,400);
  try{assert.equal((await raw(JSON.stringify({version:1,method:'apply',text:'x'.repeat(2*1024*1024)}))).status,400);}
  catch(error){assert.match(error.message,/socket hang up|ECONNRESET/);}
  assert.equal(calls,0);
  assert.equal((await post(connection,{version:1,method:'describe'})).status,200);assert.equal(calls,1);
});
test('the CLI rejects non-loopback descriptors and method mismatches without leaking credentials',async t=>{
  const {dir,file,connection}=await fixture(t),cli=path.resolve(__dirname,'../tools/linecraft-control.cjs');
  const badFile=path.join(dir,'bad.json'),requestFile=path.join(dir,'request.json');
  await fs.writeFile(badFile,JSON.stringify({...connection,host:'example.invalid'}));
  await assert.rejects(promisify(execFile)(process.execPath,[cli,badFile,'describe']),error=>{
    assert.match(error.stderr,/Invalid local connection descriptor/);assert.equal(error.stderr.includes(connection.token),false);return true;
  });
  await fs.writeFile(requestFile,JSON.stringify({version:1,method:'snapshot'}));
  await assert.rejects(promisify(execFile)(process.execPath,[cli,file,'apply',requestFile]),error=>{
    assert.match(error.stderr,/file method must match/i);assert.equal(error.stderr.includes(connection.token),false);return true;
  });
});
test('fixed desktop dispatch rejects absent or destroyed windows before running renderer code',async()=>{
  const request={version:1,method:'describe'};
  assert.equal((await createWindowDispatcher(()=>null)(request)).ok,false);
  assert.equal((await createWindowDispatcher(()=>({isDestroyed:()=>true}))(request)).ok,false);
});
