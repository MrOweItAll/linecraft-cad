'use strict';
// Main-owned native file launch policy. No renderer input can choose a path.
const nativeFS=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const LIMITS=Object.freeze({queue:16,arguments:256,argumentCharacters:65536,pathCharacters:32767,drawingBytes:25*1024*1024});
const record=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&Object.getOwnPropertyDescriptor(value,key).enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value')));
function nativeDrawingPath(value,cwd,pathModule=path){
 if(typeof value!=='string'||!value||value.length>LIMITS.pathCharacters||/[\x00-\x1f\x7f"<>|]/.test(value)||value.startsWith('-'))throw Error('Open requests require a native .linecraft file path.');
 if(/^[a-z][a-z0-9+.-]*:/i.test(value)&&!/^[a-z]:[\\/]/i.test(value))throw Error('URLs and filesystem streams are not native drawing paths.');
 const windows=pathModule===path.win32||pathModule.sep==='\\';
 if(windows){
  if(/^[\\/]{2}[?.][\\/]/.test(value)||/[?*]/.test(value)||/^[a-z]:[^\\/]/i.test(value))throw Error('Device paths, wildcards and drive-relative paths are unsupported.');
  if(value.replace(/^[a-z]:/i,'').includes(':'))throw Error('Filesystem streams are unsupported.');
  for(const segment of value.split(/[\\/]/))if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))throw Error('Device names are not drawing files.');
 }
 if(typeof cwd!=='string'||!pathModule.isAbsolute(cwd))throw Error('An absolute launch working directory is required.');
 const resolved=pathModule.resolve(cwd,value);
 if(resolved.length>LIMITS.pathCharacters||pathModule.extname(resolved).toLowerCase()!=='.linecraft')throw Error('Explorer opening supports native .linecraft files only. Use Open for other drawing formats.');
 return resolved;
}
function parseNativeLaunchArguments(argv,{packaged=true,entry,cwd,pathModule=path}={}){
 if(!Array.isArray(argv)||argv.length>LIMITS.arguments||argv.some(value=>typeof value!=='string')||argv.reduce((total,value)=>total+value.length,0)>LIMITS.argumentCharacters)return{requests:[{kind:'error',name:'Open drawing',error:'Launch arguments exceed the supported limits.'}]};
 if(typeof cwd!=='string'||!pathModule.isAbsolute(cwd))return{requests:[{kind:'error',name:'Open drawing',error:'An absolute launch working directory is required.'}]};
 const requests=[],seen=new Set(),windows=pathModule.sep==='\\';
 for(const argument of argv.slice(1)){
  // Chromium/Electron switches are metadata, never interpreted as file paths.
  if(argument.startsWith('-'))continue;
  if(!packaged&&typeof entry==='string'&&pathModule.resolve(cwd,argument)===pathModule.resolve(entry))continue;
  try{const file=nativeDrawingPath(argument,cwd,pathModule),key=windows?file.toLowerCase():file;if(seen.has(key))continue;seen.add(key);requests.push({kind:'file',path:file});}
  catch(error){requests.push({kind:'error',name:'Open drawing',error:error.message});}
 }
 return{requests};
}
async function readNativeDrawing(filename,{fs=nativeFS,maxBytes=LIMITS.drawingBytes}={}){
 let handle;
 try{
  handle=await fs.open(filename,'r');const status=await handle.stat();if(!status.isFile())throw Error('Select a regular native drawing file.');if(status.size>maxBytes)throw Error('Drawing exceeds the 25 MiB size limit.');
  const chunks=[];let total=0,position=0;
  while(true){const buffer=Buffer.allocUnsafe(Math.min(65536,maxBytes-total+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,position);if(!bytesRead)break;total+=bytesRead;if(total>maxBytes)throw Error('Drawing grew beyond the 25 MiB size limit.');chunks.push(buffer.subarray(0,bytesRead));position+=bytesRead;}
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,total));
 }catch(error){if(error.code)throw Error(`Requested drawing could not be read (${String(error.code).replace(/[^A-Z0-9_]/g,'')}).`);throw error;}
 finally{if(handle)await handle.close();}
}
function createNativeOpenQueue({validateDrawing,onPending=()=>{},fs=nativeFS,pathModule=path,idFactory=randomUUID,limit=LIMITS.queue,maxBytes=LIMITS.drawingBytes}={}){
 if(typeof validateDrawing!=='function'||typeof onPending!=='function'||typeof idFactory!=='function'||!Number.isSafeInteger(limit)||limit<1||limit>LIMITS.queue||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>LIMITS.drawingBytes)throw Error('Native open queue requires bounded main-owned adapters.');
 const queue=[];let ready=false,busy=false,epoch=0,prepared=null,overflow=false;
 const descriptor=item=>item?{id:item.id,name:item.kind==='file'?pathModule.basename(item.path):item.name}:null;
 const promote=()=>{if(!queue.length&&overflow){overflow=false;queue.push({kind:'error',name:'Open drawing',error:'Too many drawing open requests. Additional requests were rejected; open the desired file again.',id:newId()});}};
 function newId(){const id=idFactory();if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id)||queue.some(item=>item.id===id))throw Error('Invalid main-owned open request identity.');return id;}
 function notify(){promote();if(ready&&queue.length)onPending(descriptor(queue[0]));}
 function head(id){promote();if(typeof id!=='string'||!queue[0]||queue[0].id!==id)throw Error('Open request is no longer pending.');return queue[0];}
 async function operation(action){if(busy){const error=Error('Another open request is already in progress.');error.code='OPEN_REQUEST_BUSY';throw error;}busy=true;try{return await action();}finally{busy=false;}}
 function enqueueRequests(requests){
  if(!Array.isArray(requests)||requests.length>LIMITS.arguments)throw Error('Malformed native open requests.');
  const normalized=requests.map(item=>{
   if(!record(item))throw Error('Malformed native open request.');
   if(item.kind==='file'&&Object.keys(item).every(key=>['kind','path'].includes(key))){const file=nativeDrawingPath(item.path,pathModule.dirname(item.path),pathModule);if(!pathModule.isAbsolute(item.path))throw Error('Queued drawing path must be absolute.');return{kind:'file',path:file};}
   if(item.kind==='error'&&Object.keys(item).every(key=>['kind','name','error'].includes(key))&&typeof item.name==='string'&&item.name.length<=255&&typeof item.error==='string'&&item.error.length<=1024)return{kind:'error',name:item.name,error:item.error};
   throw Error('Malformed native open request.');
  });
  let accepted=0,rejected=0;
  for(const item of normalized){if(item.kind==='file'&&queue.some(existing=>existing.kind==='file'&&(pathModule.sep==='\\'?existing.path.toLowerCase()===item.path.toLowerCase():existing.path===item.path)))continue;if(queue.length>=limit){overflow=true;rejected++;continue;}queue.push({...item,id:newId()});accepted++;}
  notify();return{accepted,rejected};
 }
 async function prepare(id){return operation(async()=>{const item=head(id),generation=epoch;if(item.kind==='error')throw Error(item.error);const text=await readNativeDrawing(item.path,{fs,maxBytes});await validateDrawing(text);if(generation!==epoch||queue[0]!==item)throw Error('The renderer changed while the requested drawing was validated.');prepared={item,text,generation};return{ok:true,id:item.id,name:pathModule.basename(item.path),text};});}
 async function commit(id,adopt){return operation(async()=>{
  const item=head(id),candidate=prepared;if(typeof adopt!=='function'||!candidate||candidate.item!==item||candidate.generation!==epoch)throw Error('Prepare the pending drawing before opening it.');
  const current=await readNativeDrawing(item.path,{fs,maxBytes});if(current!==candidate.text){prepared=null;throw Error('Requested drawing changed after validation. Open it again; the current drawing is unchanged.');}
  if(candidate.generation!==epoch||queue[0]!==item)throw Error('The renderer changed before the drawing could be opened.');
  await adopt({path:item.path,text:candidate.text,name:pathModule.basename(item.path)});
  queue.shift();prepared=null;notify();return{ok:true,id,name:pathModule.basename(item.path)};
 });}
 function cancel(id){if(busy){const error=Error('Another open request is already in progress.');error.code='OPEN_REQUEST_BUSY';throw error;}head(id);queue.shift();prepared=null;notify();return{ok:true};}
 function peek(){ready=true;promote();return{ok:true,request:descriptor(queue[0])};}
 function rendererReset(){ready=false;epoch++;prepared=null;}
 return Object.freeze({enqueueRequests,prepare,commit,cancel,peek,rendererReset});
}
function validateOpenRequestPayload(payload){
 if(!record(payload)||Object.keys(payload).some(key=>!['action','id'].includes(key))||!['peek','prepare','commit','cancel'].includes(payload.action))throw Error('Unsupported native open request.');
 if(payload.action==='peek'){if(Object.hasOwn(payload,'id'))throw Error('Pending open lookup does not accept an ID.');}
 else if(typeof payload.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(payload.id))throw Error('A main-owned pending open ID is required.');
 return payload;
}
module.exports={LIMITS,nativeDrawingPath,parseNativeLaunchArguments,readNativeDrawing,createNativeOpenQueue,validateOpenRequestPayload};
