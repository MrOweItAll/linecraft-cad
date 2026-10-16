// Structured editing of the current document; no evaluation of supplied JavaScript.
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
    if(request.method==='describe')answer={ok:true,version:1,name:getName(),baseToken:baseline.value,busy:!canEdit()||Boolean(editor.state.command),capabilities:{methods:['describe','snapshot','preview','apply','undo','redo'],operations:['text','dimension','grip','radius','properties','select','commands','architecture','space'],groupedUndo:true,externalCodeEvaluation:false,maxSteps:500}};
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
    let copy;try{copy=structuredClone(request);}catch{return Promise.resolve({ok:false,error:'Request must be structured data.'});}
    const result=queue.then(()=>run(copy)).catch(error=>({ok:false,error:error.message}));queue=result.then(()=>undefined);return result;
  }});
}
