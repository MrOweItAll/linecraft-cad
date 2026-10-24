// Structured editing of the current document; no evaluation of supplied JavaScript.
import {validateScriptLayoutStep,validateScriptViewportStep,validateScriptSheetSetStep,validateScriptAnnotationStyleStep,validateScriptStepList} from './core.mjs';
const ownData=(value,key)=>{
  if(!value||typeof value!=='object')return undefined;
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  if(descriptor&&!Object.hasOwn(descriptor,'value'))throw Error('Scripting request fields must be plain data, without accessors.');
  return descriptor?.value;
};
const plainFields=(value,fields,required,label)=>{
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).some(key=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);return typeof key!=='string'||!fields.includes(key)||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value');})||required.some(key=>!Object.hasOwn(value,key)))throw Error(`${label} must contain only the required own plain-data fields: ${fields.join(', ')}.`);
};
function validateResolveSheetSetRequest(request){
  plainFields(request,['version','method','params'],['version','method','params'],'Sheet-set resolution request');
  if(request.version!==1||request.method!=='resolveSheetSet')throw Error('Expected Linecraft scripting protocol version 1.');
  plainFields(request.params,['sheetSetId'],['sheetSetId'],'Sheet-set resolution params');
  const id=request.params.sheetSetId;if(typeof id!=='string'||!id.length||id.length>255||/[\x00-\x1f\x7f]/.test(id))throw Error('An exact sheetSetId string is required.');
}
function validateResourcesBeforeClone(request){
  let method=request&&typeof request==='object'?Object.getOwnPropertyDescriptor(request,'method'):null;
  if(!method&&request&&typeof request==='object')for(let owner=Object.getPrototypeOf(request);owner&&!method;owner=Object.getPrototypeOf(owner))method=Object.getOwnPropertyDescriptor(owner,'method');
  if(method&&!Object.hasOwn(method,'value'))throw Error('Scripting method must be plain data, without accessors.');
  if(method?.value==='resolveSheetSet')validateResolveSheetSetRequest(request);
  const steps=ownData(ownData(request,'params'),'steps');if(!Array.isArray(steps))return;let hasSheetSetStep=false;
  for(let index=0;index<steps.length;index++){
    const step=ownData(steps,String(index));
    if(!step||typeof step!=='object')continue;
    let descriptor=Object.getOwnPropertyDescriptor(step,'op');if(!descriptor)for(let owner=Object.getPrototypeOf(step);owner&&!descriptor;owner=Object.getPrototypeOf(owner))descriptor=Object.getOwnPropertyDescriptor(owner,'op');
    if(descriptor&&!Object.hasOwn(descriptor,'value'))throw Error(`Step ${index+1}: operation must be plain data.`);
    if(descriptor?.value==='layout')try{validateScriptLayoutStep(step);}catch(error){throw Error(`Step ${index+1}: ${error.message}`);}
    if(descriptor?.value==='viewport')try{validateScriptViewportStep(step);}catch(error){throw Error(`Step ${index+1}: ${error.message}`);}
    if(descriptor?.value==='sheetSet')try{validateScriptSheetSetStep(step);hasSheetSetStep=true;}catch(error){throw Error(`Step ${index+1}: ${error.message}`);}
    if(['textStyle','dimStyle'].includes(descriptor?.value))try{validateScriptAnnotationStyleStep(step);hasSheetSetStep=true;}catch(error){throw Error(`Step ${index+1}: ${error.message}`);}
  }
  if(hasSheetSetStep)validateScriptStepList(steps);
}
export function createScriptingAPI({getEditor,canEdit=()=>true,onChange=()=>{},getName=()=>'',crypto=globalThis.crypto}) {
  const sessions=new WeakMap(),seen=new Map();let queue=Promise.resolve();
  const token=async editor=>{
    let session=sessions.get(editor);if(!session){session=crypto.randomUUID();sessions.set(editor,session);}
    const text=editor.serialize(),bytes=new TextEncoder().encode(text);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return {text,value:`${session}:${Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}`};
  };
  async function run(request){
    if(!request||request.version!==1||typeof request.method!=='string')return {ok:false,error:'Expected Linecraft scripting protocol version 1.'};
    const params=request.params??{},editor=getEditor();
    if(!editor)return {ok:false,error:'No drawing is available.'};
    const mutable=['apply','undo','redo'].includes(request.method),id=request.requestId;
    if(mutable&&(typeof id!=='string'||!/^[A-Za-z0-9_.-]{1,100}$/.test(id)))return {ok:false,error:'A unique requestId is required for a mutation.'};
    const signature=JSON.stringify(request);
    if(mutable&&seen.has(id)){const entry=seen.get(id);return entry.signature===signature?structuredClone(entry.result):{ok:false,error:'requestId was already used for a different request.'};}
    const baseline=await token(editor);
    if(editor!==getEditor()||editor.serialize()!==baseline.text)return {ok:false,error:'Drawing changed while reading it. Retry the read.'};
    let answer;
    if(request.method==='describe')answer={ok:true,version:1,name:getName(),baseToken:baseline.value,busy:!canEdit()||Boolean(editor.state.command),capabilities:{methods:['describe','snapshot','preview','apply','undo','redo','resolveSheetSet'],operations:['text','dimension','grip','radius','properties','select','commands','architecture','space','layer','layout','viewport','sheetSet','textStyle','dimStyle'],annotationStyleOperations:editor.getScriptingAnnotationStyleCapabilities(),layerOperations:editor.getScriptingLayerCapabilities(),layoutOperations:editor.getScriptingLayoutCapabilities(),viewportOperations:editor.getScriptingViewportCapabilities(),sheetSetOperations:editor.getScriptingSheetSetCapabilities(),groupedUndo:true,externalCodeEvaluation:false,maxSteps:500}};
    else if(request.method==='resolveSheetSet'){
      const inspected=editor.inspectSheetSet(params.sheetSetId),resolved=editor.resolveSheetSet(params.sheetSetId);
      answer={...resolved,sheetSetId:params.sheetSetId,sheetSet:inspected.ok?inspected:null,status:!inspected.ok?'not-found':inspected.valid?'resolved':'missing-layouts',baseToken:baseline.value};
    }
    else if(request.method==='snapshot'){
      if(params.ids!==undefined&&(!Array.isArray(params.ids)||params.ids.some(id=>typeof id!=='string')))return {ok:false,error:'ids must be an array of object IDs.'};
      const ids=params.ids?new Set(params.ids):null;
      answer={ok:true,name:getName(),baseToken:baseline.value,entities:structuredClone(editor.state.entities.filter(entity=>!ids||ids.has(entity.id))),units:editor.state.settings.units};
      if(params.includeDocument===true)answer.document=JSON.parse(baseline.text);
    }else if(['preview','apply','undo','redo'].includes(request.method)){
      if(!canEdit()||editor.state.command)return {ok:false,error:'Drawing is busy. Finish the current gesture, command, dialog or file operation.'};
      if(typeof params.baseToken!=='string'||params.baseToken!==baseline.value)return {ok:false,error:'Stale drawing: read a fresh snapshot and review the new state.'};
      if(request.method==='preview'||request.method==='apply'){
        const response=editor.applyRevision({label:params.label,steps:params.steps,dryRun:request.method==='preview'});
        answer={...response,baseToken:(await token(editor)).value};
      }else answer={...editor[request.method](),baseToken:(await token(editor)).value};
      if(answer.ok&&answer.changed){try{onChange(answer);}catch(error){answer.viewRefreshError=error.message;}}
    }else answer={ok:false,error:'Unknown scripting method.'};
    if(mutable){seen.set(id,{signature,result:structuredClone(answer)});while(seen.size>64)seen.delete(seen.keys().next().value);}
    return answer;
  }
  return Object.freeze({request(request){
    let copy;try{validateResourcesBeforeClone(request);copy=structuredClone(request);}catch(error){return Promise.resolve({ok:false,error:error.message||'Request must be structured data.'});}
    const result=queue.then(()=>run(copy)).catch(error=>({ok:false,error:error.message}));queue=result.then(()=>undefined);return result;
  }});
}
