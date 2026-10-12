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
  const privateRoot=path.resolve(tempRoot),binary=path.resolve(converterPath);
  async function boundedRead(filename,maxBytes){
    const handle=await fs.open(filename,'r');
    try{
      const status=await handle.stat();if(!status.isFile())throw new Error('Select a drawing file.');if(status.size>maxBytes)throw new Error(`Drawing exceeds the ${Math.floor(maxBytes/1048576)} MiB import size limit.`);
      const chunks=[];let total=0,position=0;
      while(true){const buffer=Buffer.allocUnsafe(Math.min(65536,maxBytes-total+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,position);if(!bytesRead)break;total+=bytesRead;if(total>maxBytes)throw new Error('Drawing grew beyond the import size limit.');chunks.push(buffer.subarray(0,bytesRead));position+=bytesRead;}
      return Buffer.concat(chunks,total);
    }finally{await handle.close();}
  }
  function convert(input,output,cwd,format,budget){
    return new Promise((resolve,reject)=>{
      let child,settled=false,timer,abortError=null;const diagnosticChunks=[];
      const finish=(error,result={warnings:[]})=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
      if(Date.now()>=budget.deadline){finish(new Error('DWG conversion exceeded its time limit. The original drawing is unchanged.'));return;}
      try{child=spawn(binary,converterArguments(input,output,format),{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}
      catch(error){finish(new Error(`DWG converter could not start: ${error.message}`));return;}
      // Wait for close before removing private files; Windows can retain handles
      // until the terminated converter process has actually exited.
      const abort=message=>{if(settled||abortError)return;abortError=new Error(message);try{child.kill('SIGKILL');}catch{finish(abortError);}};
      for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{budget.outputBytes+=Buffer.byteLength(chunk);if(budget.outputBytes>limits.processOutput)abort('DWG converter exceeded its output limit.');else if(stream===child.stderr)diagnosticChunks.push(Buffer.from(chunk));});
      child.once('error',error=>finish(abortError??new Error(`DWG converter could not start: ${error.message}`)));
      child.once('close',(code,signal)=>{
        if(abortError||code!==0){finish(abortError??new Error(`DWG conversion failed (${signal??code}). The original drawing is unchanged.`));return;}
        const diagnostics=Buffer.concat(diagnosticChunks).toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,''),lines=diagnostics.split(/\r?\n/).filter(line=>/\b(?:error|fatal|warn(?:ing)?|unsupported|unhandled|unknown|skipped|missing)\b/i.test(line));
        if(lines.some(line=>/\b(?:error|fatal)\b/i.test(line))){finish(new Error('DWG converter reported an error despite its exit status. The original drawing is unchanged.'));return;}
        finish(null,{warnings:lines.slice(0,20).map(line=>line.slice(0,2048)),warningCount:lines.length});
      });
      timer=setTimeout(()=>abort('DWG conversion exceeded its time limit. The original drawing is unchanged.'),Math.max(1,budget.deadline-Date.now()));
    });
  }
  async function safelyRemove(directory,realDirectory){
    const resolved=path.resolve(directory);
    if(path.dirname(resolved)!==privateRoot||!path.basename(resolved).startsWith('linecraft-import-'))return;
    try{const status=await fs.lstat(resolved);if(status.isSymbolicLink()||!status.isDirectory()||await fs.realpath(resolved)!==realDirectory)return;await fs.rm(resolved,{recursive:true,force:true});}catch(error){if(error.code!=='ENOENT')console.warn('Private import cleanup was skipped.');}
  }
  async function importDrawing(filename){
    if(typeof filename!=='string'||!path.isAbsolute(filename))throw new Error('Choose an absolute drawing file.');
    const extension=path.extname(filename).toLowerCase();if(!['.dwg','.dxf'].includes(extension))throw new Error('This import accepts DWG or DXF files.');
    const original=await boundedRead(filename,extension==='.dwg'?limits.dwg:limits.dxfInput);
    let bytes=original,temporary=null,realTemporary=null,conversion={warnings:[],warningCount:0},dwgMetadata;
    try{
      if(extension==='.dwg'){
        const binaryStatus=await fs.stat(binary);if(!binaryStatus.isFile())throw new Error('The bundled DWG converter is unavailable.');
        await fs.mkdir(privateRoot,{recursive:true});temporary=await fs.mkdtemp(path.join(privateRoot,'linecraft-import-'));realTemporary=await fs.realpath(temporary);
        const input=path.join(temporary,'input.dwg'),output=path.join(temporary,'output.dxf'),budget={deadline:Date.now()+limits.timeoutMs,outputBytes:0};
        await fs.writeFile(input,original,{flag:'wx',mode:0o600});conversion=await convert(input,output,temporary,'DXF',budget);
        const readOutput=async(filename,label)=>{const status=await fs.lstat(filename);if(status.isSymbolicLink()||!status.isFile()||path.dirname(await fs.realpath(filename))!==realTemporary)throw new Error(`DWG converter did not produce a private regular ${label} file.`);return boundedRead(filename,limits.dxf);};
        bytes=await readOutput(output,'DXF');
        if(parseDWGMetadata){
          const metadataOutput=path.join(temporary,'metadata.json'),second=await convert(input,metadataOutput,temporary,'JSON',budget);
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
    }finally{if(temporary)await safelyRemove(temporary,realTemporary);}
  }
  return Object.freeze({importDrawing});
}

module.exports={createDrawingImporter,LIMITS};
