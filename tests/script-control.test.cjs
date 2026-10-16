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
