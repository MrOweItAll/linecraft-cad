'use strict';
// Original, main-only optional JSON exchange. No executable paths or process
// requests come from the drawing, renderer, exported request or imported result.
const fs=require('node:fs/promises');
const path=require('node:path');
const MAX_EXCHANGE=2*1024*1024;
const samePath=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
function shape(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw Error('Invalid structural exchange request.');}
function boundedJSON(value){const text=JSON.stringify(value);if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_EXCHANGE)throw Error('Structural exchange exceeds the 2 MiB limit.');return text;}
async function readExchange(file){
  if(typeof file!=='string'||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.json')throw Error('Choose a structural JSON file.');
  const handle=await fs.open(file,'r');
  try{
    const info=await handle.stat();if(!info.isFile()||info.size>MAX_EXCHANGE)throw Error('Structural exchange must be a file within the 2 MiB limit.');
    const chunks=[];let count=0;
    while(true){const buffer=Buffer.allocUnsafe(Math.min(65536,MAX_EXCHANGE-count+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,count);if(!bytesRead)break;count+=bytesRead;if(count>MAX_EXCHANGE)throw Error('Structural exchange grew beyond its 2 MiB limit.');chunks.push(buffer.subarray(0,bytesRead));}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,count)));
  }finally{await handle.close();}
}
function createStructuralFileService({dialog,getMainWindow,getDrawingPath,validateDrawing,createStructuralRoofExport,validateStructuralRoofExport,validateStructuralRoofResult,createStructuralRoofAssignmentExport,validateStructuralRoofAssignmentExport,validateStructuralRoofAssignmentResult,createStructuralRoofBoundaryExport,validateStructuralRoofBoundaryExport,validateStructuralRoofBoundaryResult,structuralBridgeHash,atomicWrite,readSource=readExchange}){
  const validateRequest=(text,record)=>record?.version===3?validateStructuralRoofBoundaryExport(text,record):record?.version===2?validateStructuralRoofAssignmentExport(text,record):validateStructuralRoofExport(text,record);
  async function exportRequest(payload){
    shape(payload,['text','options']);await validateDrawing(payload.text);
    const assignmentMode=payload.options&&Object.hasOwn(payload.options,'assignments');
    const boundaryMode=Array.isArray(payload.options?.assignments)&&payload.options.assignments.some(row=>row&&Object.hasOwn(row,'areaDefinition'));
    const record=await (boundaryMode?createStructuralRoofBoundaryExport:assignmentMode?createStructuralRoofAssignmentExport:createStructuralRoofExport)(payload.text,payload.options);
    await validateRequest(payload.text,record);
    const text=boundedJSON(record)+'\n';
    const chosen=await dialog.showSaveDialog(getMainWindow(),{title:'Export structural roof request',defaultPath:'Roof-region.linecraft-structural.json',filters:[{name:'Structural roof request',extensions:['json']}]});
    if(chosen.canceled||!chosen.filePath)return{ok:false,canceled:true};
    if(!path.isAbsolute(chosen.filePath))throw Error('Choose an absolute structural JSON destination.');
    const destination=path.extname(chosen.filePath)?path.resolve(chosen.filePath):path.resolve(chosen.filePath)+'.json';
    if(path.extname(destination).toLowerCase()!=='.json'||samePath(destination,getDrawingPath()))throw Error('Choose a separate structural JSON file; the drawing cannot be replaced.');
    // Replacing an older source request is allowed. Its top-level protocol and
    // self-integrity are checked, without claiming its old source is current.
    // A native drawing or unrelated JSON cannot be replaced by this exporter.
    try{
      const existing=await readExchange(destination),assignmentRequest=existing?.version===2||existing?.version===3,requestKeys=['version','kind','status','source','selection','regionId','region',assignmentRequest?'assignments':'member','assumptions','warnings','exportHash'],kinds={1:'linecraft-structural-roof-region',2:'linecraft-structural-roof-assignments',3:'linecraft-structural-roof-boundaries'};
      if(!existing||Array.isArray(existing)||Object.keys(existing).length!==requestKeys.length||Object.keys(existing).some(key=>!requestKeys.includes(key))||![1,2,3].includes(existing.version)||existing.kind!==kinds[existing.version]||existing.status!=='calculation-only')throw Error('That file is not a structural roof request. Choose a new destination.');
      const {exportHash,...body}=existing;if(typeof exportHash!=='string'||structuralBridgeHash(body)!==exportHash)throw Error('The existing structural request failed its integrity check. Choose a new destination.');
    }
    catch(error){if(error.code!=='ENOENT')throw error;}
    await atomicWrite(destination,text);
    return{ok:true,name:path.basename(destination),record};
  }
  async function importResult(payload){
    shape(payload,['text','exportRecord']);await validateDrawing(payload.text);
    boundedJSON(payload.exportRecord);await validateRequest(payload.text,payload.exportRecord);
    const chosen=await dialog.showOpenDialog(getMainWindow(),{title:'Import structural roof result',properties:['openFile'],filters:[{name:'Structural roof result',extensions:['json']}]});
    if(chosen.canceled||!chosen.filePaths?.length)return{ok:false,canceled:true};
    if(chosen.filePaths.length!==1)throw Error('Choose one structural result.');
    const record=await readSource(chosen.filePaths[0]);boundedJSON(record);
    const validated=await (payload.exportRecord.version===3?validateStructuralRoofBoundaryResult:payload.exportRecord.version===2?validateStructuralRoofAssignmentResult:validateStructuralRoofResult)(payload.text,payload.exportRecord,record);
    return{ok:true,name:path.basename(chosen.filePaths[0]),record:validated};
  }
  async function loadRequest(payload){
    shape(payload,['text']);await validateDrawing(payload.text);
    const chosen=await dialog.showOpenDialog(getMainWindow(),{title:'Load structural roof request',properties:['openFile'],filters:[{name:'Structural roof request',extensions:['json']}]});
    if(chosen.canceled||!chosen.filePaths?.length)return{ok:false,canceled:true};
    if(chosen.filePaths.length!==1)throw Error('Choose one structural request.');
    const record=await readSource(chosen.filePaths[0]);boundedJSON(record);
    const validated=await validateRequest(payload.text,record);
    return{ok:true,name:path.basename(chosen.filePaths[0]),record:validated};
  }
  return Object.freeze({exportRequest,importResult,loadRequest});
}
module.exports={createStructuralFileService,readExchange,MAX_EXCHANGE};
