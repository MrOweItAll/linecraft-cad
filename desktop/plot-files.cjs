'use strict';
// Original main-only vector PDF adapter. Renderer input is drawing JSON/options,
// never executable markup, filesystem destinations, or printer instructions.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const MAX_DRAWING=25*1024*1024,MAX_BATCH=100*1024*1024,MAX_HTML=50*1024*1024,MAX_PDF=50*1024*1024,PRINT_TIMEOUT=30000;
const CSP="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
function payloadShape(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw Error('Invalid PDF request.');}
function drawingText(text){if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_DRAWING)throw Error('PDF input must be a drawing within the 25 MiB size limit.');return text;}
async function readDrawing(filename){
  const handle=await fs.open(filename,'r');
  try{const status=await handle.stat();if(!status.isFile()||status.size>MAX_DRAWING)throw Error('Publish input must be a drawing file within the 25 MiB size limit.');const chunks=[];let total=0,position=0;while(true){const buffer=Buffer.allocUnsafe(Math.min(65536,MAX_DRAWING-total+1)),{bytesRead}=await handle.read(buffer,0,buffer.length,position);if(!bytesRead)break;total+=bytesRead;if(total>MAX_DRAWING)throw Error('Publish drawing grew beyond its size limit.');chunks.push(buffer.subarray(0,bytesRead));position+=bytesRead;}return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,total));}finally{await handle.close();}
}
function pdfPath(filename){if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('Choose an absolute PDF destination.');return path.extname(filename).toLowerCase()==='.pdf'?path.resolve(filename):`${path.resolve(filename)}.pdf`;}

function createPlotService({BrowserWindow,dialog,getMainWindow,getTitle,buildPlotHTML,normalizePlotOptions,fontCalibration,atomicWrite,validateDrawing,readSource=readDrawing,timeoutMs=PRINT_TIMEOUT}){
  async function prepare(sources,options){
    const normalized=normalizePlotOptions(options);if(!Array.isArray(sources)||sources.length<1||sources.length>20)throw Error('PDF output requires 1 through 20 drawings.');let total=0;
    for(const source of sources){drawingText(source.text);total+=Buffer.byteLength(source.text,'utf8');if(total>MAX_BATCH)throw Error('Publish batch exceeds the 100 MiB input limit.');await validateDrawing(source.text);}
    const prepared=await buildPlotHTML(sources,normalized);if(!prepared||typeof prepared.html!=='string'||Buffer.byteLength(prepared.html,'utf8')>MAX_HTML)throw Error('Vector PDF markup exceeds its size limit.');
    if(!prepared.report||prepared.report.pages!==sources.length)throw Error('Vector PDF sheet count is invalid.');
    return prepared;
  }
  async function renderPDF(prepared){
    const html=prepared.html.replace(/<head(?:\s[^>]*)?>/i,match=>`${match}<meta http-equiv="Content-Security-Policy" content="${CSP}">`),url=`data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    let window,timer;
    try{
      window=new BrowserWindow({show:false,paintWhenInitiallyHidden:true,width:800,height:600,skipTaskbar:true,focusable:false,webPreferences:{partition:`linecraft-plot-${randomUUID()}`,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:false,backgroundThrottling:false,focusOnNavigation:false}});
      const contents=window.webContents,session=contents.session;
      if(!session?.webRequest)throw Error('The isolated PDF renderer session is unavailable.');
      session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));session.setPermissionCheckHandler(()=>false);
      session.webRequest.onBeforeRequest({urls:['<all_urls>']},(details,callback)=>callback({cancel:details.url!==url}));
      contents.setWindowOpenHandler(()=>({action:'deny'}));for(const event of ['will-navigate','will-frame-navigate','will-attach-webview'])contents.on(event,event=>event.preventDefault());
      const timeout=new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('PDF generation exceeded its time limit.')),timeoutMs);});
      const render=async()=>{await window.loadURL(url);if(typeof fontCalibration!=='string'||fontCalibration.length>32768)throw Error('Fixed PDF font calibration is unavailable.');await contents.executeJavaScript(fontCalibration);const bytes=await contents.printToPDF(prepared.pdfOptions);if(!Buffer.isBuffer(bytes)||bytes.length<8||bytes.length>MAX_PDF||bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('The PDF renderer returned invalid or oversized output.');return bytes;};
      return await Promise.race([render(),timeout]);
    }finally{clearTimeout(timer);if(window&&!window.isDestroyed())window.destroy();}
  }
  async function savePrepared(prepared,defaultName){
    const chosen=await dialog.showSaveDialog(getMainWindow(),{title:prepared.report.pages>1?'Publish combined PDF':'Plot drawing to PDF',defaultPath:defaultName,filters:[{name:'PDF document',extensions:['pdf']}]});
    if(chosen.canceled||!chosen.filePath)return{ok:false,canceled:true};const destination=pdfPath(chosen.filePath),bytes=await renderPDF(prepared);await atomicWrite(destination,bytes);
    return{ok:true,name:path.basename(destination),pages:prepared.report.pages,report:prepared.report,warnings:prepared.report.warnings??[]};
  }
  async function plotPDF(payload){payloadShape(payload,['text','options']);const title=String(getTitle()||'Untitled drawing').replace(/[\x00-\x1f\x7f]/g,'').slice(0,255),prepared=await prepare([{title,text:payload.text}],payload.options);return savePrepared(prepared,`${path.parse(title).name||'Untitled'}.pdf`);}
  async function publishPDF(payload){
    payloadShape(payload,['options']);const options=normalizePlotOptions(payload.options),chosen=await dialog.showOpenDialog(getMainWindow(),{title:'Choose drawings to publish',properties:['openFile','multiSelections'],filters:[{name:'Linecraft drawings',extensions:['linecraft','json']}]});
    if(chosen.canceled||!chosen.filePaths?.length)return{ok:false,canceled:true};if(chosen.filePaths.length>20)throw Error('Publish accepts at most 20 drawings.');
    const sources=[];let total=0;
    for(const filename of chosen.filePaths){if(typeof filename!=='string'||!path.isAbsolute(filename)||!['.linecraft','.json'].includes(path.extname(filename).toLowerCase()))throw Error('Publish requires native Linecraft drawing files.');const text=await readSource(filename);drawingText(text);total+=Buffer.byteLength(text,'utf8');if(total>MAX_BATCH)throw Error('Publish batch exceeds the 100 MiB input limit.');sources.push({title:path.basename(filename),text});}
    const prepared=await prepare(sources,options);return savePrepared(prepared,'Published drawings.pdf');
  }
  return Object.freeze({plotPDF,publishPDF});
}
module.exports={createPlotService};
