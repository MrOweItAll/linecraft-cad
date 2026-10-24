'use strict';
// Original, fixed desktop resource adapters. Renderer requests never name files,
// registry keys, executables, URLs or font bytes. Client assets stay in drawings.
const nativeFS=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFile:nativeExecFile}=require('node:child_process');
const LIMITS=Object.freeze({fontBytes:16*1024*1024,imageBytes:8*1024*1024,totalImageBytes:16*1024*1024,pixels:40000000,dimension:32768});
const FONT_SPECS=Object.freeze({
 'Arial':[['Arial (TrueType)','arial.ttf',false,false]],
 'Segoe UI':[['Segoe UI (TrueType)','segoeui.ttf',false,false]],
 'Consolas':[['Consolas (TrueType)','consola.ttf',false,false]],
 'ARCHITXT':[['ARchitxt (TrueType)','ARCHITXT.TTF',false,false]],
 'Times New Roman':[['Times New Roman (TrueType)','times.ttf',false,false],['Times New Roman Bold (TrueType)','timesbd.ttf',true,false],['Times New Roman Italic (TrueType)','timesi.ttf',false,true],['Times New Roman Bold Italic (TrueType)','timesbi.ttf',true,true]],
 'Technic':[['Technic (TrueType)','technic_.ttf',false,false]],
});
function record(value,keys){if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Use a plain resource request.');for(const key of Reflect.ownKeys(value)){if(typeof key!=='string'||!keys.includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))throw Error('Unknown or accessor resource request field.');}return value;}
function validateFontMetricsPayload(value){record(value,['families']);const a=value.families;if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length<1||a.length>16)throw Error('Request one to sixteen supported font families.');for(const key of Reflect.ownKeys(a)){if(key==='length')continue;if(typeof key!=='string'||!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=a.length||!Object.hasOwn(Object.getOwnPropertyDescriptor(a,key),'value'))throw Error('Font families must be a dense plain array.');}for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i))throw Error('Sparse font families are not supported.');const used=new Set();return a.map(name=>{if(typeof name!=='string'||name.length>80)throw Error('Invalid font family.');const family=Object.keys(FONT_SPECS).find(x=>x.toLowerCase()===name.toLowerCase());if(!family)throw Error('Unsupported font family.');if(used.has(family))throw Error('Duplicate font family.');used.add(family);return family;});}
const beneath=(file,root)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
function parseRegistryFonts(text){const result=new Map();if(typeof text!=='string'||Buffer.byteLength(text)>256*1024)throw Error('Font registry response exceeds its limit.');for(const line of text.split(/\r?\n/)){const m=line.match(/^\s+(.+?)\s+REG_SZ\s+(.+?)\s*$/);if(m)result.set(m[1].toLowerCase(),m[2]);}return result;}
function createFontMetricsService({parseTrueTypeMetrics,fs=nativeFS,execFile=nativeExecFile,platform=process.platform,systemRoot=process.env.SystemRoot||'C:/Windows',localAppData=process.env.LOCALAPPDATA,userHome=os.homedir()}={}){
 if(typeof parseTrueTypeMetrics!=='function')throw Error('A fixed original font parser is required.');
 let registryPromise=null;const cache=new Map(),roots=[...new Set([path.resolve(systemRoot,'Fonts'),...(localAppData?[path.resolve(localAppData,'Microsoft/Windows/Fonts')]:[]),...(userHome?[path.resolve(userHome,'AppData/Local/Microsoft/Windows/Fonts')]:[])])];
 async function registry(){if(platform!=='win32')return{registered:new Map(),diagnostics:[]};registryPromise??=Promise.all(['HKLM','HKCU'].map(hive=>new Promise(resolve=>execFile(path.resolve(systemRoot,'System32/reg.exe'),['query',hive+'\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'],{encoding:'utf8',timeout:3000,maxBuffer:256*1024,windowsHide:true},(error,stdout)=>{try{resolve(error?{rows:new Map(),diagnostic:hive+' font inventory could not be read.'}:{rows:parseRegistryFonts(stdout)});}catch{resolve({rows:new Map(),diagnostic:hive+' font inventory response exceeded its supported format or budget.'});}})))).then(rows=>({registered:new Map(rows.flatMap(r=>[...r.rows])),diagnostics:rows.flatMap(r=>r.diagnostic?[r.diagnostic]:[])}));try{return await registryPromise;}finally{registryPromise=null;}}
 async function metrics(family,spec,registered,inventoryIncomplete=false){const[registeredName,fallback,bold,italic]=spec,row={fontFamily:family,bold,italic,available:false};try{
  if(platform!=='win32')throw Error('Registered Windows font metrics are unavailable on this platform.');const value=registered.get(registeredName.toLowerCase());if(!value)throw Error(inventoryIncomplete?'Font registration could not be verified because part of the Windows font inventory was unavailable.':'Font is not registered for this Windows user.');
  if(/[\x00-\x1f\x7f%]/.test(value)||value.length>1024)throw Error('Registered font location is unsupported.');
  const candidates=path.isAbsolute(value)?[path.resolve(value)]:(!/[\\/:]/.test(value)&&value.toLowerCase()===fallback.toLowerCase()?roots.map(r=>path.join(r,value)):[]);let actual=null;
  for(const file of candidates){try{const real=await fs.realpath(file);for(const root of roots){let realRoot;try{realRoot=await fs.realpath(root);}catch{continue;}if(beneath(real,realRoot)){actual=real;break;}}if(actual)break;}catch{}}
  if(!actual)throw Error('Registered font is outside the supported font directories.');const before=await fs.stat(actual);if(!before.isFile()||before.size<12||before.size>LIMITS.fontBytes)throw Error('Registered font exceeds its byte limit.');const cacheKey=actual+':'+before.size+':'+before.mtimeMs;let profile=cache.get(cacheKey);
  if(!profile){const bytes=await fs.readFile(actual),after=await fs.stat(actual);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||bytes.length!==before.size)throw Error('Registered font changed during reading.');profile={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),metrics:parseTrueTypeMetrics(bytes)};if(cache.size>=16)cache.clear();cache.set(cacheKey,profile);}
  return{...row,available:true,...structuredClone(profile)};
 }catch(error){return{...row,diagnostic:typeof error.code==='string'?'Registered font could not be read ('+error.code.replace(/[^A-Z0-9_-]/g,'').slice(0,32)+').':String(error.message).slice(0,300)};}}
 return{async getFontMetrics(payload){const families=validateFontMetricsPayload(payload),inventory=await registry(),fonts=[];for(const family of families)for(const spec of FONT_SPECS[family])fonts.push(await metrics(family,spec,inventory.registered,inventory.diagnostics.length>0));return{ok:true,fonts,diagnostics:[...inventory.diagnostics,...fonts.filter(r=>!r.available).map(r=>r.fontFamily+': '+r.diagnostic)]};}};
}
function imageMetadata(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>LIMITS.imageBytes)throw Error('Raster resource exceeds its byte limit.');let width,height,mimeType;
 if(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(8)===13&&bytes.subarray(12,16).toString('ascii')==='IHDR'){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);mimeType='image/png';}
 else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){let p=2,segments=0;while(p+4<=bytes.length&&segments++<65536){if(bytes[p++]!==255)throw Error('Invalid JPEG marker.');while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const size=bytes.readUInt16BE(p);if(size<2||p+size>bytes.length)throw Error('Invalid JPEG segment.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)throw Error('Invalid JPEG frame.');height=bytes.readUInt16BE(p+3);width=bytes.readUInt16BE(p+5);mimeType='image/jpeg';break;}p+=size;}}
 if(!mimeType||!width||!height||width>LIMITS.dimension||height>LIMITS.dimension||width*height>LIMITS.pixels)throw Error('Use a bounded PNG or JPEG raster resource.');return{width,height,mimeType};
}
function safeSidecarName(value){if(typeof value!=='string'||!value||value.length>1024||/[\x00-\x1f\x7f:]/.test(value)||path.win32.isAbsolute(value)||path.posix.isAbsolute(value))throw Error('Raster source must be a relative local filename.');const clean=value.replace(/\\/g,'/').replace(/^\.\//,'');if(clean.split('/').some(x=>!x||x==='.'||x==='..')||!['.png','.jpg','.jpeg'].includes(path.posix.extname(clean).toLowerCase()))throw Error('Unsupported raster source filename.');return clean;}
function validateChooseImagePayload(payload){record(payload,['resourceId']);if(typeof payload.resourceId!=='string'||!payload.resourceId||payload.resourceId.length>255||/[\x00-\x1f\x7f]/.test(payload.resourceId))throw Error('Choose an existing image resource.');return payload.resourceId;}
async function resolveDrawingImages(document,{drawingPath,fs=nativeFS}={}){
 if(!document||typeof document!=='object'||typeof drawingPath!=='string'||!path.isAbsolute(drawingPath))throw Error('A main-owned selected drawing is required.');const result=structuredClone(document),warnings=[];if(!Array.isArray(result.imageResources)||!result.imageResources.length)return{document:result,warnings,resolved:0};if(result.imageResources.length>64)throw Error('Too many raster resources.');const directory=await fs.realpath(path.dirname(drawingPath));let total=0,resolved=0;
 for(const resource of result.imageResources){if(resource.dataURL)continue;try{const name=safeSidecarName(resource.sourceName),candidate=path.resolve(directory,name),real=await fs.realpath(candidate);if(!beneath(real,directory))throw Error('Raster source escapes the selected drawing directory.');const before=await fs.stat(real);if(!before.isFile()||before.size>LIMITS.imageBytes||total+before.size>LIMITS.totalImageBytes)throw Error('Raster resource exceeds its byte budget.');const bytes=await fs.readFile(real),after=await fs.stat(real);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||bytes.length!==before.size)throw Error('Raster changed during reading.');const metadata=imageMetadata(bytes);if(metadata.width!==resource.width||metadata.height!==resource.height)throw Error('Raster dimensions differ from the drawing resource.');total+=bytes.length;Object.assign(resource,metadata,{sha256:crypto.createHash('sha256').update(bytes).digest('hex'),dataURL:'data:'+metadata.mimeType+';base64,'+bytes.toString('base64')});resolved++;}catch(error){warnings.push({code:'image-resource',resourceId:resource.id,message:error.message});}}
 return{document:result,warnings,resolved};
}
function validateEmbeddedImages(document){
 const resources=document?.imageResources;if(resources===undefined)return;if(!Array.isArray(resources)||resources.length>64)throw Error('Image resource list exceeds its limit.');let total=0;for(const resource of resources){if(resource.dataURL===undefined)continue;if(typeof resource.dataURL!=='string'||resource.dataURL.length>Math.ceil(LIMITS.imageBytes/3)*4+64)throw Error('Inline raster exceeds its byte limit.');const match=resource.dataURL.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw Error('Malformed inline raster.');const bytes=Buffer.from(match[2],'base64');if(bytes.toString('base64')!==match[2])throw Error('Inline raster base64 is not canonical.');const metadata=imageMetadata(bytes);if(metadata.width!==resource.width||metadata.height!==resource.height||metadata.mimeType!==match[1]||resource.mimeType!==undefined&&metadata.mimeType!==resource.mimeType)throw Error('Inline raster metadata disagrees with its bytes.');if(resource.sha256!==undefined&&crypto.createHash('sha256').update(bytes).digest('hex')!==String(resource.sha256).toLowerCase())throw Error('Inline raster SHA256 disagrees with its bytes.');total+=bytes.length;if(total>LIMITS.totalImageBytes)throw Error('Inline raster resources exceed their shared byte budget.');}
}
function validateDXFImageAssets(payload,textBytes=0){
 if(payload===undefined)return[];record(payload,['images']);const images=payload.images;if(!Array.isArray(images)||Object.getPrototypeOf(images)!==Array.prototype||images.length>64)throw Error('Use a bounded raster asset list.');if(Reflect.ownKeys(images).some(k=>k!=='length'&&(typeof k!=='string'||!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=images.length||!Object.hasOwn(Object.getOwnPropertyDescriptor(images,k),'value'))))throw Error('Raster assets must be plain data.');const result=[],names=new Set();let total=0;
 for(let i=0;i<images.length;i++){if(!Object.hasOwn(images,i))throw Error('Raster assets must be dense.');const row=record(images[i],['fileName','dataURL','sha256']);if(typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||typeof row.dataURL!=='string'||row.dataURL.length>LIMITS.imageBytes*4/3+128)throw Error('Invalid raster asset identity.');const match=row.dataURL.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw Error('Only inline PNG/JPEG raster assets are supported.');const bytes=Buffer.from(match[2],'base64');if(bytes.toString('base64')!==match[2])throw Error('Raster base64 must be canonical.');const metadata=imageMetadata(bytes),ext=metadata.mimeType==='image/png'?'png':'jpg';if(match[1]!==metadata.mimeType||row.fileName!==`linecraft-image-${row.sha256}.${ext}`||crypto.createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Raster asset name, content and fingerprint disagree.');if(names.has(row.fileName))throw Error('Duplicate raster asset filename.');names.add(row.fileName);total+=bytes.length;if(total>LIMITS.totalImageBytes||textBytes+total>25*1024*1024)throw Error('DXF and raster assets exceed their shared byte budget.');result.push({fileName:row.fileName,bytes,sha256:row.sha256});}
 return result;
}
async function writeDXFImageAssets(directory,assets,{fs=nativeFS}={}){
 const realDirectory=await fs.realpath(directory),prepared=[],created=[];for(const row of assets){const file=path.join(realDirectory,row.fileName);if(!beneath(file,realDirectory)||path.basename(row.fileName)!==row.fileName)throw Error('Raster destination is outside the selected directory.');try{const status=await fs.lstat(file);if(status.isSymbolicLink()||!status.isFile()||status.size!==row.bytes.length)throw Error('A different raster file already exists; choose another output directory.');const existing=await fs.readFile(file);if(crypto.createHash('sha256').update(existing).digest('hex')!==row.sha256)throw Error('A different raster file already exists; choose another output directory.');prepared.push({...row,file,existing:true});}catch(error){if(error.code!=='ENOENT')throw error;prepared.push({...row,file,existing:false});}}
 try{for(const row of prepared)if(!row.existing){await fs.writeFile(row.file,row.bytes,{flag:'wx'});created.push(row.file);const check=await fs.readFile(row.file);if(crypto.createHash('sha256').update(check).digest('hex')!==row.sha256)throw Error('Written raster verification failed.');}return{created:created.length,reused:prepared.length-created.length,files:prepared.map(row=>({name:row.fileName,sha256:row.sha256,bytes:row.bytes.length})),createdPaths:created};}catch(error){for(const file of created){try{const status=await fs.lstat(file),row=prepared.find(r=>r.file===file);if(status.isFile()&&!status.isSymbolicLink()&&crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')===row.sha256)await fs.unlink(file);}catch{}}throw error;}
}
async function rollbackDXFImageAssets(result,{fs=nativeFS}={}){for(const file of result.createdPaths??[]){const row=result.files.find(r=>r.name===path.basename(file));if(!row)continue;try{const status=await fs.lstat(file);if(status.isFile()&&!status.isSymbolicLink()&&status.size===row.bytes&&crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')===row.sha256)await fs.unlink(file);}catch{}}}
function decodeFixedReaderMetadata(bytes){
 if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))throw Error('Fixed reader metadata must be bytes.');
 if(bytes.byteLength>50*1024*1024)throw Error('Fixed reader metadata exceeds its byte limit.');
 let text,encoding='utf-8',fallbackUsed=false;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(error){
  // LibreDWG 0.13.4 can emit raw declared ANSI_1252 bytes in JSON. This is
  // deliberately not a general replacement-character or guessed encoding path.
  const c1=[0x20ac,null,0x201a,0x0192,0x201e,0x2026,0x2020,0x2021,0x02c6,0x2030,0x0160,0x2039,0x0152,null,0x017d,null,null,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x02dc,0x2122,0x0161,0x203a,0x0153,null,0x017e,0x0178];
  for(const b of bytes)if(b>=0x80&&b<=0x9f&&c1[b-0x80]===null)throw Error('Fixed reader metadata contains undefined Windows-1252 bytes.');
  text=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength).toString('latin1').replace(/[\x80-\x9f]/g,c=>String.fromCodePoint(c1[c.charCodeAt(0)-0x80]));encoding='windows-1252';fallbackUsed=true;
 }
 // Only the observed fixed-reader dialect is tolerated. The scanner never
 // touches quoted text. Unique markers let structural validation prove every
 // bare token belongs to a direct unused associative-array matrix entry.
 const marker='__linecraft_reader_nan_'+crypto.randomUUID()+'_',positions=[],parts=[];if(text.includes(marker))throw Error('Fixed reader marker collision.');let cursor=0;
 for(let i=0;i<text.length;i++){
  if(text[i]==='"'){for(i++;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]==='"')break;}continue;}
  if(text.slice(i,i+3)==='nan'&&(i===0||/[\s[:,]/.test(text[i-1]))&&(i+3===text.length||/[\s,\]}]/.test(text[i+3]))){
   if(positions.length>=256)throw Error('Fixed reader non-finite metadata exceeds its token limit.');
   parts.push(text.slice(cursor,i),JSON.stringify(marker+positions.length));positions.push(i);i+=2;cursor=i+1;
  }
 }
 parts.push(text.slice(cursor));let raw;try{raw=JSON.parse(positions.length?parts.join(''):text,(_key,value)=>{if(typeof value==='number'&&!Number.isFinite(value))throw Error('Non-finite number.');return value;});}catch{throw Error('Fixed reader metadata is malformed JSON or contains unsupported non-finite values.');}
 const declared=raw?.created_by==='LibreDWG 0.13.4'&&raw?.FILEHEADER?.codepage===30&&/^AC\d{4}$/.test(raw.FILEHEADER.version);
 if(fallbackUsed&&!declared)throw Error('Non-UTF-8 fixed reader metadata requires declared codepage30 (Windows-1252).');
 let normalization;
 if(positions.length){
  if(!declared||!Array.isArray(raw.OBJECTS)||raw.OBJECTS.length>1000000)throw Error('Only the declared fixed-reader associative-array metadata dialect is supported.');
  const handled=new Set(),paths=[];
  for(let i=0;i<raw.OBJECTS.length;i++){
   const object=raw.OBJECTS[i],matrix=object?.transmatrix;
   if(object?.object!=='ASSOCARRAYACTIONBODY'||!Array.isArray(matrix)||matrix.length!==16)continue;
   for(let j=0;j<matrix.length;j++){
    const value=matrix[j];if(typeof value==='string'&&value.startsWith(marker)){
     const index=Number(value.slice(marker.length));if(!Number.isInteger(index)||index<0||index>=positions.length||value!==marker+index||handled.has(index))throw Error('Invalid fixed-reader metadata marker.');
     matrix[j]=null;handled.add(index);paths.push(`OBJECTS[${i}].transmatrix[${j}]`);
    }
   }
   if(matrix.some(value=>value!==null&&(typeof value!=='number'||!Number.isFinite(value))))throw Error('Unsupported associative-array matrix metadata.');
  }
  if(handled.size!==positions.length)throw Error('Non-finite fixed-reader metadata occurs outside supported unused associative-array matrix entries.');
  normalization={count:paths.length,paths,sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Unused ASSOCARRAYACTIONBODY transform metadata only; source bytes and separately validated DXF geometry are unchanged.'};const normalized=[];let start=0;for(const position of positions){normalized.push(text.slice(start,position),'null');start=position+3;}normalized.push(text.slice(start));text=normalized.join('');
 }
 return{text,encoding,fallbackUsed,...(normalization?{normalization}:{})};
}
module.exports={LIMITS,FONT_SPECS,validateFontMetricsPayload,parseRegistryFonts,createFontMetricsService,imageMetadata,safeSidecarName,validateChooseImagePayload,resolveDrawingImages,validateEmbeddedImages,validateDXFImageAssets,writeDXFImageAssets,rollbackDXFImageAssets,decodeFixedReaderMetadata};
