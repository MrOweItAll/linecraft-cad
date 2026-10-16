'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const fsSync=require('node:fs');
const path=require('node:path');
const {randomBytes,timingSafeEqual}=require('node:crypto');

// Opt-in loopback bridge. It accepts structured requests only, never source code or paths.
async function startScriptControl({connectionFile,dispatch}) {
  if(!path.isAbsolute(connectionFile))throw Error('The scripting connection file must be an absolute path.');
  const token=randomBytes(32).toString('hex');let active=false;
  const server=http.createServer(async(req,res)=>{
    const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    const header=req.headers.authorization??'',expected=`Bearer ${token}`;
    if(req.headers.origin||Buffer.byteLength(header)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(header),Buffer.from(expected))){req.resume();reply(403,{ok:false,error:'Unauthorized local scripting request.'});return;}
    if(req.method!=='POST'||req.url!=='/v1/request'){req.resume();reply(404,{ok:false,error:'Unknown scripting endpoint.'});return;}
    if(active){req.resume();reply(409,{ok:false,error:'Another scripting request is running. Retry after it completes.'});return;}
    active=true;let size=0;const chunks=[];
    try{
      for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw Error('Scripting request exceeds 2 MiB.');chunks.push(chunk);}
      const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!request||request.version!==1||!['describe','snapshot','preview','apply','undo','redo'].includes(request.method))throw Error('Unsupported scripting request.');
      const result=await dispatch(request);reply(200,result);
    }catch(error){if(!res.destroyed)reply(400,{ok:false,error:error.message});}
    finally{active=false;}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const connection={format:'LinecraftControl/1',host:'127.0.0.1',port:server.address().port,token};
  try{await fs.writeFile(connectionFile,JSON.stringify(connection,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
  return {connectionFile,async close(){try{const current=JSON.parse(fsSync.readFileSync(connectionFile,'utf8'));if(current.token===token)fsSync.unlinkSync(connectionFile);}catch{}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
function createWindowDispatcher(getWindow){
  return async request=>{
    const window=getWindow();
    if(!window||window.isDestroyed()||window.webContents.isLoading())return {ok:false,error:'Linecraft is not ready.'};
    // Only this fixed call executes. Supplied text is decoded as JSON, never as code.
    const encoded=JSON.stringify(JSON.stringify(request));
    return window.webContents.executeJavaScript(`window.linecraft?.scripting ? window.linecraft.scripting.request(JSON.parse(${encoded})) : ({ok:false,error:'Scripting is not ready.'})`);
  };
}
module.exports={startScriptControl,createWindowDispatcher};
