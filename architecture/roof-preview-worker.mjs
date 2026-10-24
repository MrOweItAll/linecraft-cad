/* Original module Web Worker. It accepts finite detached roof proposals only;
 * no editor, DOM, filesystem, executable input or accepted document is exposed. */
import {solveRoofDragPreview} from './roof-drag-preview.mjs';
import {ROOF_PREVIEW_PROTOCOL_VERSION,normalizeRoofPreviewRequest,roofPreviewIdentity,validateRoofPreviewResult} from './roof-preview-client.mjs';

const clock=()=>typeof performance==='object'?performance.now():Date.now();
const positive=value=>Number.isSafeInteger(value)&&value>0;
export function executeRoofPreviewMessage(message){
  let request=null;const envelope={version:ROOF_PREVIEW_PROTOCOL_VERSION,jobId:positive(message?.jobId)?message.jobId:null,epoch:positive(message?.epoch)?message.epoch:null};
  try{
    if(!message||typeof message!=='object'||Array.isArray(message)||Object.keys(message).some(key=>!['version','type','jobId','epoch','request'].includes(key))||message.version!==ROOF_PREVIEW_PROTOCOL_VERSION||message.type!=='solve'||!positive(message.jobId)||!positive(message.epoch))throw Error('Unsupported roof preview worker protocol.');
    request=normalizeRoofPreviewRequest(message.request);const started=clock();
    const result=solveRoofDragPreview(request.architecture,request.settings,{roofGroupId:request.roofGroupId,componentId:request.componentId,bounds:request.bounds});
    validateRoofPreviewResult(result,request);return{...envelope,type:'result',identity:roofPreviewIdentity(request),result,solveElapsedMs:Math.max(0,clock()-started)};
  }catch(error){return{...envelope,type:'error',identity:request?roofPreviewIdentity(request):null,message:String(error.message||'The background roof preview failed.').slice(0,1000)};}
}

/** Exported only to permit a disclosed Node worker_threads host adapter in the
 * portable tests. Production uses the browser's module Web Worker surface. */
export function installRoofPreviewWorker(scope){
  if(!scope||typeof scope.addEventListener!=='function'||typeof scope.postMessage!=='function')throw Error('Roof preview requires a worker message surface.');
  scope.addEventListener('message',event=>scope.postMessage(executeRoofPreviewMessage(event.data)));
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function'&&typeof document==='undefined')installRoofPreviewWorker(self);
