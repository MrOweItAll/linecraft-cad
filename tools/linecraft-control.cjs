#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises');
const http=require('node:http');
async function main(){
  const [connectionFile,method,requestFile]=process.argv.slice(2);
  if(!connectionFile||!method)throw Error('Usage: node tools/linecraft-control.cjs CONNECTION_FILE describe|snapshot|preview|apply|undo|redo [REQUEST_JSON_FILE]');
  const connection=JSON.parse(await fs.readFile(connectionFile,'utf8'));
  if(connection.format!=='LinecraftControl/1'||connection.host!=='127.0.0.1'||!Number.isInteger(connection.port)||connection.port<1||connection.port>65535||!/^[a-f0-9]{64}$/.test(connection.token))throw Error('Invalid local connection descriptor.');
  const request=requestFile?JSON.parse(await fs.readFile(requestFile,'utf8')):{version:1,method};
  if(request.method!==method)throw Error('The file method must match the requested method.');
  const body=JSON.stringify(request);if(Buffer.byteLength(body)>2*1024*1024)throw Error('Request exceeds 2 MiB.');
  const result=await new Promise((resolve,reject)=>{
    const req=http.request({host:connection.host,port:connection.port,path:'/v1/request',method:'POST',headers:{Authorization:`Bearer ${connection.token}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
      const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>32*1024*1024){res.destroy(Error('Response exceeds 32 MiB.'));return;}chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});
    });req.setTimeout(60000,()=>req.destroy(Error('Request timed out. An Apply may already have completed; retry the identical requestId or read a snapshot before submitting a new revision.')));req.on('error',reject);req.end(body);
  });
  process.stdout.write(JSON.stringify(result,null,2)+'\n');if(!result.ok)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
