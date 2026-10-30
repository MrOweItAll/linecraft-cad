'use strict';
// Original main-process import adapter. It has no renderer-facing execution API.
const nativeFS=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn:nativeSpawn}=require('node:child_process');

const LIMITS=Object.freeze({drawing:25*1024*1024,dwg:50*1024*1024,dxfInput:50*1024*1024,dxf:50*1024*1024,processOutput:512*1024,timeoutMs:30000});

function createDrawingImporter({converterPath,converterArguments,parseDXF,parseDWGMetadata,validateDrawing,fs=nativeFS,spawn=nativeSpawn,tempRoot=os.tmpdir(),limits=LIMITS}){
  if(typeof converterPath!=='string'||!path.isAbsolute(converterPath)||typeof converterArguments!=='function'||typeof parseDXF!=='function'||typeof validateDrawing!=='function')throw new Error('Drawing importer requires fixed main-process adapters.');
  if(parseDWGMetadata!==undefined&&typeof parseDWGMetadata!=='function')throw new Error('DWG metadata requires a fixed main-process decoder.');
  const privateRoot=path.resolve(tempRoot),binary=path.resolve(converterPath),pendingImports=new Set();
  const closeGraceMs=1000;
  const hasPath=text=>/(?:^|[^A-Za-z0-9_])[A-Za-z]:|\\|(?<!\d)\/|\/(?!\d)/.test(text);
  function warningText(line){
    if(!hasPath(line))return line.slice(0,2048);
    // Only an authored leading object diagnostic before the ORIGINAL path
    // and before any quote can contribute a class token. Ambiguous quoted
    // filenames never supply fragments to the returned warning.
    const marker=line.search(/(?:^|[^A-Za-z0-9_])[A-Za-z]:|\\|(?<!\d)\/|\/(?!\d)/);
    const context=(marker<0?line:line.slice(0,marker)).split(/["']/)[0];
    const object=context.trimStart().match(/^(?:WARN(?:ING)?:\s*)?Unsupported object (ACDB[A-Z0-9_]{1,60})\b/i);
    return object?`WARNING: Unsupported object ${object[1]}. Path details omitted.`:'DWG converter reported a warning. Path details omitted.';
  }
  async function boundedRead(filename,maxBytes){
    const handle=await fs.open(filename,'r');
    try{
      const status=await handle.stat();if(!status.isFile())throw new Error('Select a drawing file.');if(status.size>maxBytes)throw new Error(`Drawing exceeds the ${Math.floor(maxBytes/1048576)} MiB import size limit.`);
      const chunks=[];let total=0,position=0;
      while(true){const buffer=Buffer.allocUnsafe(Math.min(65536,maxBytes-total+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,position);if(!bytesRead)break;total+=bytesRead;if(total>maxBytes)throw new Error('Drawing grew beyond the import size limit.');chunks.push(buffer.subarray(0,bytesRead));position+=bytesRead;}
      return Buffer.concat(chunks,total);
    }finally{await handle.close();}
  }
  function convert(input,output,cwd,format,budget,custody){
    return new Promise((resolve,reject)=>{
      let child,settled=false,closed=false,timer,grace,abortError=null;const diagnosticChunks=[];
      const finish=(error,result={warnings:[]})=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);error?reject(error):resolve(result);};
      if(Date.now()>=budget.deadline){finish(new Error('DWG conversion exceeded its time limit. The original drawing is unchanged.'));return;}
      try{child=spawn(binary,converterArguments(input,output,format),{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}
      catch{finish(new Error('DWG converter could not start.'));return;}
      custody.children.add(child);
      const abort=message=>{
        if(settled||closed||abortError)return;
        abortError=new Error(message);clearTimeout(timer);
        // A successful kill request is not exit confirmation. Set state before
        // calling kill because an adapter may synchronously deliver close.
        try{child.kill('SIGKILL');}catch{}
        if(!closed&&!settled)grace=setTimeout(()=>finish(abortError),closeGraceMs);
      };
      for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{
        if(settled||closed||abortError)return;
        budget.outputBytes+=Buffer.byteLength(chunk);
        if(budget.outputBytes>limits.processOutput)abort('DWG converter exceeded its output limit.');
        else if(stream===child.stderr)diagnosticChunks.push(Buffer.from(chunk));
      });
      // Keep an owned listener for late/repeated error events, without changing
      // a settled result or treating an error as confirmed process exit.
      child.on('error',()=>abort('DWG converter could not start.'));
      child.once('close',(code,signal)=>{
        closed=true;custody.children.delete(child);void custody.cleanup();
        if(settled)return;
        if(abortError||code!==0){finish(abortError??new Error(`DWG conversion failed (${signal??code}). The original drawing is unchanged.`));return;}
        const diagnostics=Buffer.concat(diagnosticChunks).toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,''),lines=diagnostics.split(/\r?\n/).filter(line=>/\b(?:error|fatal|warn(?:ing)?|unsupported|unhandled|unknown|skipped|missing)\b/i.test(line));
        if(lines.some(line=>/\b(?:error|fatal)\b/i.test(line))){finish(new Error('DWG converter reported an error despite its exit status. The original drawing is unchanged.'));return;}
        finish(null,{warnings:lines.slice(0,20).map(warningText),warningCount:lines.length});
      });
      timer=setTimeout(()=>abort('DWG conversion exceeded its time limit. The original drawing is unchanged.'),Math.max(1,budget.deadline-Date.now()));
    });
  }
  async function safelyRemove(directory,realDirectory){
    const resolved=path.resolve(directory);
    if(path.dirname(resolved)!==privateRoot||!path.basename(resolved).startsWith('linecraft-import-'))return false;
    try{const status=await fs.lstat(resolved);if(status.isSymbolicLink()||!status.isDirectory()||await fs.realpath(resolved)!==realDirectory)return false;await fs.rm(resolved,{recursive:true,force:true});return true;}catch(error){if(error.code==='ENOENT')return true;console.warn('Private import cleanup was skipped.');return false;}
  }
  async function importDrawing(filename){
    if(typeof filename!=='string'||!path.isAbsolute(filename))throw new Error('Choose an absolute drawing file.');
    const extension=path.extname(filename).toLowerCase();if(!['.dwg','.dxf'].includes(extension))throw new Error('This import accepts DWG or DXF files.');
    const custody=extension==='.dwg'?{children:new Set(),finalizing:false,cleanupPromise:null}:null;
    if(custody&&pendingImports.size)throw new Error('A previous DWG import has not completed cleanup. Keep the original and use a DXF copy while it is unresolved.');
    if(custody)pendingImports.add(custody);
    let bytes,temporary=null,realTemporary=null,conversion={warnings:[],warningCount:0},dwgMetadata;
    if(custody)custody.cleanup=()=>{
      if(!custody.finalizing||custody.children.size)return;
      if(!custody.cleanupPromise)custody.cleanupPromise=Promise.resolve().then(async()=>{
        if(!temporary||await safelyRemove(temporary,realTemporary))pendingImports.delete(custody);
      }).catch(()=>{console.warn('Private import cleanup was skipped.');});
      return custody.cleanupPromise;
    };
    try{
      const original=await boundedRead(filename,extension==='.dwg'?limits.dwg:limits.dxfInput);bytes=original;
      if(extension==='.dwg'){
        const binaryStatus=await fs.stat(binary);if(!binaryStatus.isFile())throw new Error('The bundled DWG converter is unavailable.');
        await fs.mkdir(privateRoot,{recursive:true});temporary=await fs.mkdtemp(path.join(privateRoot,'linecraft-import-'));realTemporary=await fs.realpath(temporary);
        const input=path.join(temporary,'input.dwg'),output=path.join(temporary,'output.dxf'),budget={deadline:Date.now()+limits.timeoutMs,outputBytes:0};
        await fs.writeFile(input,original,{flag:'wx',mode:0o600});conversion=await convert(input,output,temporary,'DXF',budget,custody);
        const readOutput=async(filename,label)=>{const status=await fs.lstat(filename);if(status.isSymbolicLink()||!status.isFile()||path.dirname(await fs.realpath(filename))!==realTemporary)throw new Error(`DWG converter did not produce a private regular ${label} file.`);return boundedRead(filename,limits.dxf);};
        bytes=await readOutput(output,'DXF');
        if(parseDWGMetadata){
          const metadataOutput=path.join(temporary,'metadata.json'),second=await convert(input,metadataOutput,temporary,'JSON',budget,custody);
          dwgMetadata=await parseDWGMetadata(await readOutput(metadataOutput,'JSON metadata'));
          if(!dwgMetadata||typeof dwgMetadata!=='object'||Array.isArray(dwgMetadata))throw new Error('DWG metadata decoder returned invalid layer information.');
          conversion={warnings:[...conversion.warnings,...second.warnings].slice(0,20),warningCount:conversion.warningCount+second.warningCount};
        }
      }
      const parsed=await parseDXF(bytes,{dwgMetadata});
      if(!parsed||typeof parsed.text!=='string')throw new Error('Drawing import did not produce a valid document.');
      if(Buffer.byteLength(parsed.text,'utf8')>limits.drawing)throw new Error('Imported document exceeds the 25 MiB drawing size limit.');
      await validateDrawing(parsed.text);
      const summary=parsed.report;
      if(!summary||!Number.isInteger(summary.importedEntities)||summary.importedEntities<=0)throw new Error('This drawing contains no supported objects.');
      return {text:parsed.text,importInfo:{...summary,warnings:[...(Array.isArray(summary.warnings)?summary.warnings:[]),...conversion.warnings],converterWarningCount:conversion.warningCount,sourceFormat:extension.slice(1).toUpperCase(),converted:extension==='.dwg'}};
    }finally{if(custody){custody.finalizing=true;await custody.cleanup();}}
  }
  return Object.freeze({importDrawing});
}

module.exports={createDrawingImporter,LIMITS};
