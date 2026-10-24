/* Original detached roof-preview worker protocol and bounded scheduler.
 * The editor remains the only authority that can accept a source transaction. */
import {architectureInputHash} from './editor-adapter.mjs';

export const ROOF_PREVIEW_PROTOCOL_VERSION=1;
export const ROOF_PREVIEW_LIMITS=Object.freeze({requestCharacters:8*1024*1024,resultCharacters:32*1024*1024,entities:2048,vertices:100000,triangles:200000});
const plain=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(`${label} must be a plain object.`);};
const keys=(value,allowed,label)=>{plain(value,label);if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error(`${label} contains an unsupported field.`);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const hash=value=>typeof value==='string'&&/^[0-9a-f]{16}$/.test(value);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const requestFields=['requestId','generation','sourceHash','settingsHash','boundsHash','architecture','settings','roofGroupId','componentId','bounds'];
const identityFields=['requestId','generation','sourceHash','settingsHash','boundsHash','roofGroupId','componentId'];
const boundedJSON=(value,limit,label)=>{let text;try{text=JSON.stringify(value,(_key,item)=>{if(typeof item==='number'&&!Number.isFinite(item))throw Error('Nonfinite number');if(['function','symbol','bigint'].includes(typeof item))throw Error('Unsupported value');return item;});}catch{throw Error(`${label} must contain finite serializable data.`);}if(!text||text.length>limit)throw Error(`${label} exceeds the bounded data limit.`);return text;};
export const roofPreviewIdentity=request=>Object.fromEntries(identityFields.map(key=>[key,request[key]]));
const sameIdentity=(a,b)=>Boolean(a&&b&&identityFields.every(key=>a[key]===b[key]));
const sameContext=(a,b)=>Boolean(a&&b&&['sourceHash','settingsHash','roofGroupId','componentId'].every(key=>a[key]===b[key]));

/** Copy before queuing: callers cannot revise a pending worker snapshot. The
 * worker independently verifies all three hashes before invoking the solver. */
export function normalizeRoofPreviewRequest(raw,{verifyHashes=true}={}){
  keys(raw,requestFields,'Roof preview request');
  if(typeof raw.requestId!=='string'||!raw.requestId||raw.requestId.length>128||/[\x00-\x1f]/.test(raw.requestId)||!Number.isSafeInteger(raw.generation)||raw.generation<1)throw Error('A preview requires a bounded request ID and positive generation.');
  if(![raw.sourceHash,raw.settingsHash,raw.boundsHash].every(hash)||!identifier(raw.roofGroupId)||!identifier(raw.componentId))throw Error('A preview requires source, settings, bounds and owner identities.');
  keys(raw.bounds,['minX','minY','maxX','maxY'],'Roof preview bounds');
  if(!['minX','minY','maxX','maxY'].every(key=>finite(raw.bounds[key])&&Math.abs(raw.bounds[key])<=1e9)||raw.bounds.minX>=raw.bounds.maxX||raw.bounds.minY>=raw.bounds.maxY)throw Error('Preview bounds must be finite, ordered model coordinates.');
  plain(raw.architecture,'Architectural snapshot');plain(raw.settings,'Drawing settings snapshot');
  boundedJSON(raw,ROOF_PREVIEW_LIMITS.requestCharacters,'Roof preview request');
  const request=structuredClone(raw);request.bounds={minX:raw.bounds.minX,minY:raw.bounds.minY,maxX:raw.bounds.maxX,maxY:raw.bounds.maxY};
  if(verifyHashes&&(architectureInputHash(request.architecture)!==request.sourceHash||architectureInputHash(request.settings)!==request.settingsHash||architectureInputHash({roofGroupId:request.roofGroupId,componentId:request.componentId,bounds:request.bounds})!==request.boundsHash))throw Error('Preview snapshot hashes do not match its source, settings or bounds.');
  return request;
}

/** Fail closed on a mismatched or malformed worker result. This validates the
 * detached preview envelope; it never grants authority to commit its geometry. */
export function validateRoofPreviewResult(result,request){
  keys(result,['status','roofStatus','roofGroupId','componentId','sourceHash','boundsHash','generationHash','bounds','diagnostics','counts','entities','triangles','edges'],'Roof preview result');
  if(!['valid','review','invalid'].includes(result.status)||typeof result.roofStatus!=='string'||result.roofStatus.length>160||['roofGroupId','componentId','sourceHash','boundsHash'].some(key=>result[key]!==request[key]))throw Error('Worker result does not match the requested roof source.');
  if(JSON.stringify(result.bounds)!==JSON.stringify(request.bounds))throw Error('Worker result bounds differ from the request.');
  keys(result.counts,['faces','triangles','edges','closures'],'Preview geometry counts');
  if(!['faces','triangles','edges','closures'].every(key=>Number.isSafeInteger(result.counts[key])&&result.counts[key]>=0)||!Array.isArray(result.diagnostics)||result.diagnostics.length>2048||!result.diagnostics.every(s=>typeof s==='string'&&s.length<=10000))throw Error('Worker result counts or diagnostics are invalid.');
  if(!['entities','triangles','edges'].every(key=>Array.isArray(result[key]))||result.entities.length>ROOF_PREVIEW_LIMITS.entities||result.triangles.length>ROOF_PREVIEW_LIMITS.triangles||result.edges.length>ROOF_PREVIEW_LIMITS.triangles*3||result.counts.triangles!==result.triangles.length||result.counts.edges!==result.edges.length)throw Error('Worker result geometry exceeds its bounded contract.');
  if(result.status==='invalid'){if(result.entities.length||result.triangles.length||result.edges.length||Object.values(result.counts).some(Boolean)||result.generationHash!==null)throw Error('An invalid preview must not expose geometry.');}
  else if(!hash(result.generationHash)||!result.entities.length||!result.triangles.length||result.counts.faces<1||result.counts.closures!==result.entities.filter(e=>!e.id?.endsWith('/surface')).length)throw Error('A solved preview must contain qualified geometry and a generation hash.');
  let vertices=0,triangles=0;const prefix=`@architecture/roofGroup/${request.roofGroupId}/`,ids=new Set();
  for(const entity of result.entities){
    if(entity?.type!=='MESH'||typeof entity.id!=='string'||!entity.id.startsWith(prefix)||ids.has(entity.id)||!Array.isArray(entity.vertices)||!Array.isArray(entity.faces)||!entity.vertices.every(p=>p&&['x','y','z'].every(key=>finite(p[key])))||!entity.faces.every(face=>Array.isArray(face)&&face.length===3&&face.every(i=>Number.isInteger(i)&&i>=0&&i<entity.vertices.length)))throw Error('A worker mesh is malformed or has foreign ownership.');
    ids.add(entity.id);vertices+=entity.vertices.length;triangles+=entity.faces.length;
  }
  if(vertices>ROOF_PREVIEW_LIMITS.vertices||triangles!==result.triangles.length)throw Error('Worker mesh resource or triangle counts do not agree.');
  if(!result.triangles.every(t=>ids.has(t.entityId)&&Array.isArray(t.points)&&t.points.length===3&&t.points.every(p=>p&&['x','y','z'].every(key=>finite(p[key]))))||!result.edges.every(e=>ids.has(e.entityId)&&[e.a,e.b].every(p=>p&&['x','y','z'].every(key=>finite(p[key])))))throw Error('Worker display geometry is malformed or has foreign ownership.');
  boundedJSON(result,ROOF_PREVIEW_LIMITS.resultCharacters,'Roof preview result');
  return result;
}

/** One active solve and one replaceable latest pending request. A worker can be
 * terminated without waiting for its CPU-bound solver to return. All callbacks
 * are guarded by worker instance, epoch, job, source and settings identities. */
export function createRoofPreviewClient({workerFactory=()=>new Worker(new URL('./roof-preview-worker.mjs',import.meta.url),{type:'module'}),onEvent=()=>{},intervalMs=120,initialDelayMs=16,timeoutMs=15000,now=()=>performance.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
  if(typeof workerFactory!=='function'||typeof onEvent!=='function'||![intervalMs,initialDelayMs,timeoutMs].every(finite)||intervalMs<16||intervalMs>1000||initialDelayMs<0||initialDelayMs>intervalMs||timeoutMs<intervalMs||timeoutMs>60000)throw Error('Invalid roof preview worker scheduling options.');
  let worker=null,workerSerial=0,epoch=1,jobSequence=0,active=null,pending=null,latest=null,startTimer=null,timeoutTimer=null,lastStarted=-Infinity,disposed=false,status='idle',lastCancellationReason=null;
  const stats={requestsReceived:0,started:0,completed:0,cancelled:0,errors:0,staleMessages:0,previousResults:0,workersCreated:0,workersTerminated:0};
  const metadata=job=>job?{...roofPreviewIdentity(job.request),jobId:job.jobId,epoch:job.epoch,requestedAt:job.requestedAt,startedAt:job.startedAt??null}:null;
  const getState=()=>({status,disposed,epoch,lastCancellationReason,latest:metadata(latest),active:metadata(active),pending:metadata(pending),stats:{...stats}});
  const emit=(type,job,extra={})=>onEvent({type,identity:roofPreviewIdentity(job.request),jobId:job.jobId,epoch:job.epoch,requestedAt:job.requestedAt,startedAt:job.startedAt??null,...extra,stats:{...stats}});
  const clearStart=()=>{if(startTimer!==null)clearTimer(startTimer);startTimer=null;};
  const clearTimeoutTimer=()=>{if(timeoutTimer!==null)clearTimer(timeoutTimer);timeoutTimer=null;};
  const terminate=()=>{if(worker){const old=worker;worker=null;workerSerial++;stats.workersTerminated++;try{old.terminate();}catch{}}};
  const isLatest=job=>job===latest&&job?.epoch===epoch;
  const fail=(job,message)=>{clearTimeoutTimer();active=null;terminate();stats.errors++;if(isLatest(job)){clearStart();pending=null;status='error';emit('error',job,{message:String(message||'Background roof preview failed.').slice(0,1000),completedAt:now(),isCurrent:true});}else{stats.staleMessages++;schedule();}};
  const receive=(event,serial,instance)=>{
    if(disposed||worker!==instance||serial!==workerSerial){stats.staleMessages++;return;}
    const job=active,message=event?.data;
    if(!job||message?.jobId!==job.jobId||message?.epoch!==job.epoch){stats.staleMessages++;return;}
    if(message?.version!==ROOF_PREVIEW_PROTOCOL_VERSION||!sameIdentity(message.identity,job.request)||!['result','error'].includes(message.type)){fail(job,'Background roof preview returned an invalid protocol identity.');return;}
    if(message.type==='error'){fail(job,message.message);return;}
    try{validateRoofPreviewResult(message.result,job.request);if(!finite(message.solveElapsedMs)||message.solveElapsedMs<0)throw Error('Invalid background solve timing.');}catch(error){fail(job,error.message);return;}
    clearTimeoutTimer();active=null;stats.completed++;const completedAt=now(),current=isLatest(job);
    try{
      if(current){status='idle';emit('result',job,{result:message.result,isCurrent:true,completedAt,elapsedMs:completedAt-job.startedAt,solveElapsedMs:message.solveElapsedMs});}
      else if(latest&&job.epoch===epoch&&sameContext(job.request,latest.request)){status='waiting';stats.previousResults++;emit('result',job,{result:message.result,isCurrent:false,completedAt,elapsedMs:completedAt-job.startedAt,solveElapsedMs:message.solveElapsedMs});}
      else stats.staleMessages++;
    }finally{schedule();}
  };
  const ensureWorker=()=>{
    if(worker)return worker;
    const instance=workerFactory();if(!instance||typeof instance.postMessage!=='function'||typeof instance.terminate!=='function'||typeof instance.addEventListener!=='function'){try{instance?.terminate?.();}catch{}throw Error('A module Web Worker is unavailable.');}
    worker=instance;const serial=++workerSerial;stats.workersCreated++;
    instance.addEventListener('message',event=>receive(event,serial,instance));
    const error=event=>{event?.preventDefault?.();if(worker!==instance||serial!==workerSerial||!active){stats.staleMessages++;return;}fail(active,event?.message||'Background roof preview worker failed.');};
    instance.addEventListener('error',error);instance.addEventListener('messageerror',error);return instance;
  };
  const start=()=>{
    startTimer=null;if(disposed||!pending||active)return;
    const job=pending;pending=null;active=job;job.startedAt=now();lastStarted=job.startedAt;status='solving';stats.started++;
    try{const instance=ensureWorker();emit('started',job,{isCurrent:isLatest(job)});if(active!==job||worker!==instance||disposed)return;timeoutTimer=setTimer(()=>{if(active===job)fail(job,'Background roof preview exceeded its time limit.');},timeoutMs);instance.postMessage({version:ROOF_PREVIEW_PROTOCOL_VERSION,type:'solve',jobId:job.jobId,epoch:job.epoch,request:job.request});}catch(error){if(active===job)fail(job,error.message);}
  };
  function schedule(){
    if(disposed||!pending||active||startTimer!==null)return;
    status='waiting';const delay=Math.max(initialDelayMs,lastStarted+intervalMs-now());startTimer=setTimer(start,delay);
  }
  const cancel=(reason='cancelled')=>{
    if(disposed)return false;clearStart();clearTimeoutTimer();if(active||pending||latest)stats.cancelled++;active=null;pending=null;latest=null;epoch++;lastStarted=-Infinity;lastCancellationReason=String(reason).slice(0,128);terminate();status='idle';return true;
  };
  return{
    request(raw){
      if(disposed)throw Error('The roof preview worker client is disposed.');
      let request;try{request=normalizeRoofPreviewRequest(raw,{verifyHashes:false});}catch(error){cancel('invalid-request');throw error;}
      stats.requestsReceived++;
      if(latest&&sameIdentity(latest.request,request)){if(JSON.stringify(latest.request)!==JSON.stringify(request)){cancel('identity-reused');throw Error('A roof preview identity cannot be reused for different snapshot data.');}return{accepted:false,duplicate:true,identity:roofPreviewIdentity(request)};}
      if(latest&&!sameContext(latest.request,request))cancel('source-settings-context-changed');
      const job={request,jobId:++jobSequence,epoch,requestedAt:now()};pending=job;latest=job;status='waiting';schedule();return{accepted:true,duplicate:false,identity:roofPreviewIdentity(request)};
    },
    cancel,
    dispose(){if(!disposed){cancel('disposed');disposed=true;status='disposed';}},
    getState
  };
}
