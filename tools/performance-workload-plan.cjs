'use strict';
// Read-only definition metadata. This module has no application-launch capability.
const nativeFS=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const IDS=Object.freeze(['survey','residential','multiViewport','heavy']);
const SOURCE_FILES=Object.freeze(['core.mjs','tests/performance-workload-fixtures.mjs','tests/performance-workloads-reference.test.mjs','tests/fixtures/performance-workload-contract.json']);
const FILES=Object.freeze([...IDS.flatMap(id=>['raw','canonical'].map(kind=>`${id}-${kind}.linecraft`)),'planned-rows.json']);
const LIMITS=Object.freeze({producerBytes:1048576,fileBytes:4194304,totalReadBytes:16777216});
const ORDINARY=['open','selectAll','clearSelection','pan','zoom','saveAs','reopen'];
const LAYOUT=['open','selectAll','clearSelection','switchLayoutB','switchLayoutC','returnLayoutA','pan','zoom','saveAs','reopen'];
const ownedErrors=new WeakSet(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MESSAGES={EXPECTATIONS:'Independent workload plan expectations are invalid.',INPUT:'Choose owned absolute workload and source directories.',FILE:'A workload plan input could not be read as an owned regular file.',LIMIT:'Workload plan inputs exceed their fixed byte budget.',SOURCE:'Workload plan source identity does not match independent expectations.',HASH:'Workload plan file identity does not match independent expectations.',METADATA:'Workload definition metadata is invalid.',OWNERSHIP:'Workload file roles or persisted owners do not match the definition.',MATRIX:'The complete planned workload row matrix does not match.',OBSERVATIONS:'Workload definitions must not contain application observations.'};
function failure(kind){const error=new Error(MESSAGES[kind]);error.name='PerformancePlanError';error.code='PERF_PLAN_'+kind;error.stack=`${error.name}: ${error.message}`;ownedErrors.add(error);return error;}
function requireValue(value,kind){if(!value)throw failure(kind);}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&Object.keys(value).sort().join('\0')===[...keys].sort().join('\0');
const role=name=>{if(name==='planned-rows.json')return null;const kind=name.endsWith('-raw.linecraft')?'raw':'canonical';return {workload:name.slice(0,-('-'+kind+'.linecraft').length),kind};};
function fileMap(map,kind){
  requireValue(exactKeys(map,FILES),kind);
  for(const name of FILES){const r=map[name],owner=role(name);requireValue(exactKeys(r,owner?['sha256','bytes','workload','kind']:['sha256','bytes']),kind);requireValue(typeof r.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256)&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<=(owner?LIMITS.fileBytes:LIMITS.producerBytes),kind);if(owner)requireValue(r.workload===owner.workload&&r.kind===owner.kind,kind==='EXPECTATIONS'?kind:'OWNERSHIP');}
}
function sourceMap(map,kind){requireValue(exactKeys(map,SOURCE_FILES)&&SOURCE_FILES.every(name=>typeof map[name]==='string'&&/^[a-f0-9]{64}$/.test(map[name])),kind);}
function expectations(value){requireValue(exactKeys(value,['format','sourceSHA256','files'])&&value.format==='LinecraftPerformancePlanExpectations/1','EXPECTATIONS');sourceMap(value.sourceSHA256,'EXPECTATIONS');fileMap(value.files,'EXPECTATIONS');}
function documentMetadata(doc,id){
  requireValue(object(doc)&&doc.format==='Linecraft/1'&&Array.isArray(doc.entities)&&Array.isArray(doc.layouts)&&object(doc.settings),'METADATA');
  requireValue(doc.entities.length===({survey:200,residential:64,multiViewport:400,heavy:10000}[id])&&doc.layouts.length===(id==='multiViewport'?3:0),'OWNERSHIP');
  const all=[...doc.entities,...doc.layouts.flatMap(l=>{requireValue(object(l)&&Array.isArray(l.entities)&&Array.isArray(l.viewports),'OWNERSHIP');return l.entities;})];
  requireValue(all.every(e=>object(e)&&typeof e.type==='string'&&typeof e.id==='string'&&e.id.length<=128&&e.layoutId===undefined)&&new Set(all.map(e=>e.id)).size===all.length,'OWNERSHIP');
  const counts=Object.create(null);for(const e of all)counts[e.type]=(counts[e.type]??0)+1;
  const expected={survey:{PLINE:100,TEXT:100},residential:{PLINE:40,ARC:8,HATCH:8,TEXT:8},multiViewport:{LINE:403,PLINE:3,TEXT:3},heavy:{LINE:10000}}[id];
  requireValue(exactKeys(counts,Object.keys(expected))&&Object.keys(expected).every(type=>counts[type]===expected[type]),'OWNERSHIP');
  requireValue(doc.settings.units===(['survey','residential'].includes(id)?'ft':'in'),'OWNERSHIP');
  if(id!=='multiViewport'){requireValue(doc.layouts.length===0&&doc.activeSpace==='model','OWNERSHIP');return;}
  requireValue(doc.entities.length===400&&doc.activeSpace==='paper'&&doc.activeLayoutId==='sheet-a'&&doc.activeViewportId===null&&Array.isArray(doc.layers),'OWNERSHIP');
  const layer=doc.layers.find(l=>l.name==='Viewports');requireValue(layer?.visible===true&&layer.locked===true,'OWNERSHIP');
  requireValue(doc.layouts.length===3&&doc.layouts.every((l,i)=>l.id==='sheet-'+'abc'[i]),'OWNERSHIP');
  const viewIDs=[];
  for(let i=0;i<3;i++){const l=doc.layouts[i],letter='abc'[i],paperIDs=['paper-ruler-'+letter,'paper-border-'+letter,'paper-label-'+letter];requireValue(l.entities.length===3&&l.entities.every((e,j)=>e.id===paperIDs[j])&&l.viewports.length===6,'OWNERSHIP');for(let j=0;j<6;j++){const v=l.viewports[j];requireValue(object(v)&&v.id===`view-${letter}-${j}`&&v.layer==='Viewports'&&v.locked===true&&v.plotBorder===false,'OWNERSHIP');viewIDs.push(v.id);}}
  requireValue(new Set(viewIDs).size===18&&viewIDs.every(id=>!all.some(e=>e.id===id)),'OWNERSHIP');
}
function matrix(rows){
  requireValue(Array.isArray(rows)&&rows.length===582,'MATRIX');const expected=new Set();
  for(const id of IDS)for(let process=0;process<3;process++){expected.add([id,process,'startup',-1,'readiness'].join(':'));expected.add([id,process,'cold-first-open',-1,'open'].join(':'));for(let round=0;round<6;round++)for(const operation of id==='multiViewport'?LAYOUT:ORDINARY)expected.add([id,process,round===0?'warmup':'measured-warm',round,operation].join(':'));}
  const found=new Set();for(const row of rows){requireValue(exactKeys(row,['workload','process','phase','round','operation'])&&typeof row.workload==='string'&&Number.isInteger(row.process)&&typeof row.phase==='string'&&Number.isInteger(row.round)&&typeof row.operation==='string','MATRIX');const key=[row.workload,row.process,row.phase,row.round,row.operation].join(':');requireValue(expected.has(key)&&!found.has(key),'MATRIX');found.add(key);}requireValue(found.size===expected.size,'MATRIX');
}
async function loadPerformanceWorkloadPlan({artifactDirectory,sourceDirectory,expected,fs=nativeFS}={}){
  try{
    expectations(expected);requireValue(typeof artifactDirectory==='string'&&path.isAbsolute(artifactDirectory)&&typeof sourceDirectory==='string'&&path.isAbsolute(sourceDirectory),'INPUT');
    async function root(directory){const stat=await fs.lstat(directory);requireValue(stat.isDirectory()&&!stat.isSymbolicLink(),'FILE');return {directory:path.resolve(directory),real:await fs.realpath(directory)};}
    const artifactRoot=await root(artifactDirectory),sourceRoot=await root(sourceDirectory);let total=0;
    async function read(relative,owner,cap){
      let handle,result,error;
      try{
        const filename=path.join(owner.directory,...relative.split('/')),stat=await fs.lstat(filename);requireValue(stat.isFile()&&!stat.isSymbolicLink(),'FILE');
        const actual=await fs.realpath(filename);requireValue(path.relative(owner.real,actual)===relative.split('/').join(path.sep),'FILE');
        handle=await fs.open(filename,'r');const status=await handle.stat();requireValue(status.isFile(),'FILE');requireValue(Number.isSafeInteger(status.size)&&status.size>=0&&status.size<=cap,'LIMIT');
        const chunks=[];let size=0,position=0;
        while(true){const buffer=Buffer.allocUnsafe(Math.min(65536,cap-size+1,LIMITS.totalReadBytes-total+1));const {bytesRead}=await handle.read(buffer,0,buffer.length,position);requireValue(Number.isInteger(bytesRead)&&bytesRead>=0&&bytesRead<=buffer.length,'FILE');if(!bytesRead)break;size+=bytesRead;total+=bytesRead;requireValue(size<=cap&&total<=LIMITS.totalReadBytes,'LIMIT');chunks.push(buffer.subarray(0,bytesRead));position+=bytesRead;}
        result=Buffer.concat(chunks,size);
      }catch(cause){error=ownedErrors.has(cause)?cause:failure('FILE');}
      finally{if(handle)try{await handle.close();}catch{error??=failure('FILE');}}
      if(error)throw error;return result;
    }
    for(const name of SOURCE_FILES)requireValue(sha(await read(name,sourceRoot,LIMITS.fileBytes))===expected.sourceSHA256[name],'SOURCE');
    const parse=bytes=>{try{return JSON.parse(bytes.toString('utf8'));}catch{throw failure('METADATA');}};
    const producer=parse(await read('workload-artifacts.json',artifactRoot,LIMITS.producerBytes));
    requireValue(exactKeys(producer,['format','names','records','files','sourceSHA256','definitionOnly','applicationExecuted','observedTimings','limits'])&&producer.format==='LinecraftPerformanceWorkloadReference/1'&&Array.isArray(producer.names)&&Array.isArray(producer.records),'METADATA');
    requireValue(producer.definitionOnly===true&&producer.applicationExecuted===false&&Array.isArray(producer.observedTimings)&&producer.observedTimings.length===0,'OBSERVATIONS');
    sourceMap(producer.sourceSHA256,'SOURCE');requireValue(SOURCE_FILES.every(name=>producer.sourceSHA256[name]===expected.sourceSHA256[name]),'SOURCE');fileMap(producer.files,'METADATA');
    for(const name of FILES){const info=producer.files[name],pin=expected.files[name];requireValue(info.sha256===pin.sha256&&info.bytes===pin.bytes,'HASH');const bytes=await read(name,artifactRoot,name==='planned-rows.json'?LIMITS.producerBytes:LIMITS.fileBytes);requireValue(bytes.length===pin.bytes&&sha(bytes)===pin.sha256,'HASH');const parsed=parse(bytes);if(name==='planned-rows.json')matrix(parsed);else documentMetadata(parsed,role(name).workload);}
    const files=Object.fromEntries(FILES.map(name=>[name,Object.freeze({...expected.files[name]})]));
    return Object.freeze({format:'LinecraftPerformancePlanMetadata/1',status:'definition-plan-valid',definitionOnly:true,applicationLaunchAuthorized:false,observedPerformanceRows:0,geometryValidatedByLoader:false,environmentQualified:false,workloads:4,documents:8,plannedRows:582,plannedActionRows:570,plannedStartupRows:12,inputBytesRead:total,sourceSHA256:Object.freeze({...expected.sourceSHA256}),files:Object.freeze(files)});
  }catch(error){throw ownedErrors.has(error)?error:failure('METADATA');}
}
module.exports=Object.freeze({loadPerformanceWorkloadPlan,LIMITS});
