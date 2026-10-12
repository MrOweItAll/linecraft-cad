'use strict';
// Main-only adapter tests. Dialogs and PDF Chromium are mocked; core validation,
// vector-document production and input/output files are real. Actual printToPDF
// physical output is recorded separately in plot-pdf-render-v14-results.json.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {EventEmitter}=require('node:events'),{createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const {createPlotService}=require('../desktop/plot-files.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.basename(path.dirname(root))==='outputs'?path.dirname(path.dirname(root)):root;
const work=path.join(workspace,'work','plot-adapter-files'),PDF=Buffer.from('%PDF-1.7\nOWNED TEST VECTOR OUTPUT\n%%EOF');
async function main(){
 await fs.mkdir(work,{recursive:true});const {createEditor}=await import(pathToFileURL(path.join(root,'core.mjs')).href),plot=await import(pathToFileURL(path.join(root,'plot-document.mjs')).href);
 const drawing=()=>{const e=createEditor({settings:{units:'mm'}});for(const s of ['L','0,0','100,0',''])assert.equal(e.execute(s).ok,true);return e.serialize();},text=drawing(),tests=[];
 const check=async(name,fn)=>{const start=performance.now();try{const detail=await fn();tests.push({name,status:'PASS',durationMs:+(performance.now()-start).toFixed(3),detail});}catch(error){tests.push({name,status:'FAIL',error:error.stack||String(error)});}};
 function fixture(overrides={}){
  const calls={open:[],save:[],windows:[],writes:[]},save=[],open=[];
  class Window extends EventEmitter{
   constructor(options){super();this.options=options;this.destroyed=false;calls.windows.push(this);this.webContents=new EventEmitter();this.webContents.session={webRequest:{onBeforeRequest:(_filter,cb)=>{this.request=cb;}},setPermissionRequestHandler:cb=>{this.permission=cb;},setPermissionCheckHandler:cb=>{this.permissionCheck=cb;}};this.webContents.setWindowOpenHandler=cb=>{this.popup=cb;};this.webContents.executeJavaScript=async code=>{this.executed=code;};this.webContents.printToPDF=async options=>{this.pdfOptions=options;if(overrides.print)return overrides.print(this);return PDF;};}
   async loadURL(url){this.url=url;this.html=decodeURIComponent(url.split(',').slice(1).join(','));if(overrides.load)return overrides.load(this);}
   destroy(){this.destroyed=true;}isDestroyed(){return this.destroyed;}
  }
  const service=createPlotService({BrowserWindow:Window,dialog:{showSaveDialog:async(_parent,options)=>{calls.save.push(options);return save.shift()??{canceled:true};},showOpenDialog:async(_parent,options)=>{calls.open.push(options);return open.shift()??{canceled:true};}},getMainWindow:()=>({owned:true}),getTitle:()=>'<owned drawing>.linecraft',normalizePlotOptions:plot.normalizePlotOptions,fontCalibration:plot.PLOT_FONT_CALIBRATION,buildPlotHTML:(sources,options)=>overrides.build?overrides.build(sources,options):plot.buildPlotHTML(sources,{options,createEditor}),validateDrawing:async value=>{const r=createEditor().importJSON(value);if(!r.ok)throw Error(r.message);},atomicWrite:async(filename,bytes)=>{calls.writes.push(filename);if(overrides.write)return overrides.write(filename,bytes);const temporary=`${filename}.owned-adapter-test.tmp`;let created=false;try{const handle=await fs.open(temporary,'wx');created=true;try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await fs.rename(temporary,filename);}finally{if(created)await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}},...overrides.service});
  return{service,calls,save,open};
 }
 await check('renderer requests cannot supply markup, destinations, printers or arbitrary files',async()=>{
  for(const payload of [{text,html:'<script>x</script>'},{text,path:path.join(work,'forged.pdf')},{text,options:{},printer:'arbitrary'},null]){const f=fixture();await assert.rejects(f.service.plotPDF(payload));assert.equal(f.calls.save.length,0);assert.equal(f.calls.windows.length,0);}
  const f=fixture();await assert.rejects(f.service.publishPDF({options:{},paths:[path.join(work,'private.json')]}));assert.equal(f.calls.open.length,0);
 });
 await check('invalid drawing and unknown plot options are rejected before choosing output',async()=>{
  for(const payload of [{text:'{"entities":[{"type":"UNKNOWN"}]}'},{text:'not JSON'},{text:'x'.repeat(25*1024*1024+1)},{text,options:{paper:'Arbitrary'}},{text,options:{ratio:NaN}}]){const f=fixture();await assert.rejects(f.service.plotPDF(payload));assert.equal(f.calls.save.length,0);assert.equal(f.calls.windows.length,0);}
 });
 await check('empty or entirely hidden drawing rejects an empty PDF before any chooser',async()=>{
  const e=createEditor({settings:{units:'mm'}}),empty=fixture();await assert.rejects(empty.service.plotPDF({text:e.serialize()}),/visible|empty|geometry/i);assert.equal(empty.calls.save.length,0);
  for(const s of ['L','0,0','10,0',''])e.execute(s);e.updateLayer('0',{visible:false});const hidden=fixture();await assert.rejects(hidden.service.plotPDF({text:e.serialize()}),/visible|empty|geometry/i);assert.equal(hidden.calls.save.length,0);
 });
 await check('canceling Plot creates no renderer and preserves an existing destination',async()=>{
  const destination=path.join(work,'canceled.pdf');await fs.writeFile(destination,'OWNED ORIGINAL');const f=fixture();f.save.push({canceled:true,filePath:destination});assert.deepEqual(await f.service.plotPDF({text}),{ok:false,canceled:true});assert.equal(await fs.readFile(destination,'utf8'),'OWNED ORIGINAL');assert.equal(f.calls.windows.length,0);assert.equal(f.calls.writes.length,0);
 });
 await check('real vector document is printed with validated exact scale and a forced PDF extension',async()=>{
  const f=fixture(),destination=path.join(work,'exact-scale');f.save.push({canceled:false,filePath:destination});const result=await f.service.plotPDF({text,options:{paper:'A4',orientation:'landscape',scaleMode:'scale',ratio:2}});assert.equal(result.ok,true);assert.equal(result.name,'exact-scale.pdf');assert.equal(result.pages,1);assert.equal(result.report.plotScaleMmPerUnit,.5);assert.deepEqual(await fs.readFile(`${destination}.pdf`),PDF);
  const window=f.calls.windows[0],line=window.html.match(/d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/);assert.equal(Number(line[3])-Number(line[1]),50);assert.equal(window.executed,plot.PLOT_FONT_CALIBRATION);assert.deepEqual(window.pdfOptions.pageSize,{width:297/25.4,height:210/25.4});assert.equal(window.pdfOptions.preferCSSPageSize,true);assert.equal(window.destroyed,true);assert.equal(window.options.show,false);assert.equal(window.options.focusable,false);assert.equal(window.options.paintWhenInitiallyHidden,true);return{mockedPDFRenderer:true,physicalScaleProof:'Separate actual printToPDF report'};
 });
 await check('isolated PDF renderer denies remote/local resources, permissions, navigation and popups',async()=>{
  const f=fixture();f.save.push({canceled:false,filePath:path.join(work,'isolation.pdf')});await f.service.plotPDF({text});const window=f.calls.windows[0],prefs=window.options.webPreferences;assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.devTools,false);assert.match(prefs.partition,/^linecraft-plot-/);assert.match(window.html,/script-src 'none'/);assert.match(window.html,/connect-src 'none'/);
  const decision=url=>{let result;window.request({url},value=>{result=value;});return result;};assert.deepEqual(decision(window.url),{cancel:false});for(const url of ['https://example.com/','http://127.0.0.1/','file:///C:/private.txt','data:text/html,other'])assert.deepEqual(decision(url),{cancel:true});assert.equal(window.permissionCheck(),false);let permitted=true;window.permission({},'media',value=>{permitted=value;});assert.equal(permitted,false);assert.deepEqual(window.popup(),{action:'deny'});for(const type of ['will-navigate','will-frame-navigate','will-attach-webview']){let denied=false;window.webContents.emit(type,{preventDefault:()=>{denied=true;}});assert.equal(denied,true);}
 });
 await check('Publish reads only chooser-selected native drawings, combines ordered pages and preserves sources',async()=>{
  const names=[path.join(work,'first.linecraft'),path.join(work,'second.json')];const second=createEditor({settings:{units:'in'}});for(const s of ['REC','0,0','2,1'])second.execute(s);const texts=[text,second.serialize()];for(let i=0;i<2;i++)await fs.writeFile(names[i],texts[i]);const hashes=await Promise.all(names.map(async name=>createHash('sha256').update(await fs.readFile(name)).digest('hex')));
  const f=fixture();f.open.push({canceled:false,filePaths:names});f.save.push({canceled:false,filePath:path.join(work,'combined.pdf')});const result=await f.service.publishPDF({options:{scaleMode:'scale',ratio:2}});assert.equal(result.pages,2);assert.deepEqual(result.report.sheets.map(s=>s.plotScaleMmPerUnit),[.5,12.7]);const html=f.calls.windows[0].html;assert.ok(html.indexOf('first.linecraft')<html.indexOf('second.json'));assert.equal((html.match(/<section>/g)||[]).length,2);assert.equal(f.calls.open[0].properties.includes('multiSelections'),true);assert.equal(f.calls.windows.length,1);for(let i=0;i<2;i++)assert.equal(createHash('sha256').update(await fs.readFile(names[i])).digest('hex'),hashes[i]);
 });
 await check('Publish rejects too many, relative and exchange-file selections before PDF output',async()=>{
  for(const names of [Array(21).fill(path.join(work,'first.linecraft')),['relative.linecraft'],[path.join(work,'drawing.dwg')]]){const f=fixture();f.open.push({canceled:false,filePaths:names});await assert.rejects(f.service.publishPDF({options:{}}));assert.equal(f.calls.save.length,0);assert.equal(f.calls.windows.length,0);}
  const f=fixture();assert.deepEqual(await f.service.publishPDF({options:{}}),{ok:false,canceled:true});assert.equal(f.calls.save.length,0);
 });
 await check('malformed second Publish input fails atomically before choosing output',async()=>{
  const bad=path.join(work,'malformed.linecraft');await fs.writeFile(bad,'OWNED MALFORMED');const f=fixture();f.open.push({canceled:false,filePaths:[path.join(work,'first.linecraft'),bad]});await assert.rejects(f.service.publishPDF({options:{}}));assert.equal(f.calls.save.length,0);assert.equal(f.calls.windows.length,0);assert.equal(await fs.readFile(bad,'utf8'),'OWNED MALFORMED');
 });
 await check('Publish rejects invalid UTF8 and oversized files before conversion or rendering',async()=>{
  const invalid=path.join(work,'invalid-utf8.linecraft'),large=path.join(work,'oversized.linecraft');await fs.writeFile(invalid,Buffer.from([0xc3,0x28]));const handle=await fs.open(large,'w');await handle.truncate(25*1024*1024+1);await handle.close();for(const name of [invalid,large]){const f=fixture();f.open.push({canceled:false,filePaths:[name]});await assert.rejects(f.service.publishPDF({options:{}}));assert.equal(f.calls.save.length,0);assert.equal(f.calls.windows.length,0);}
 });
 await check('invalid or oversized PDF bytes cannot replace an existing file',async()=>{
  const destination=path.join(work,'invalid-output.pdf');await fs.writeFile(destination,'OWNED ORIGINAL');for(const bytes of [Buffer.from('not PDF content'),Buffer.alloc(50*1024*1024+1),'%PDF-1.7']){const f=fixture({print:()=>bytes});f.save.push({canceled:false,filePath:destination});await assert.rejects(f.service.plotPDF({text}),/invalid or oversized/);assert.equal(f.calls.windows[0].destroyed,true);assert.equal(f.calls.writes.length,0);assert.equal(await fs.readFile(destination,'utf8'),'OWNED ORIGINAL');}
 });
 await check('renderer failure and timeout destroy hidden windows without writing output',async()=>{
  for(const configuration of [{print:()=>{throw Error('Owned print failure');}},{print:()=>new Promise(()=>{}),service:{timeoutMs:10}}]){const f=fixture(configuration);f.save.push({canceled:false,filePath:path.join(work,'failed-render.pdf')});await assert.rejects(f.service.plotPDF({text}),/failure|time limit/);assert.equal(f.calls.windows[0].destroyed,true);assert.equal(f.calls.writes.length,0);}
 });
 await check('oversized generated markup or wrong page count fails before a chooser',async()=>{
  for(const build of [()=>({html:'x'.repeat(50*1024*1024+1),report:{pages:1}}),()=>({html:'<html><head></head></html>',report:{pages:2}})]){const f=fixture({build});await assert.rejects(f.service.plotPDF({text}));assert.equal(f.calls.save.length,0);assert.equal(f.calls.windows.length,0);}
 });
 await check('filesystem write failure destroys renderer and preserves original contents',async()=>{
  const destination=path.join(work,'write-failure.pdf');await fs.writeFile(destination,'OWNED ORIGINAL');const f=fixture({write:()=>{throw Error('Owned write failure');}});f.save.push({canceled:false,filePath:destination});await assert.rejects(f.service.plotPDF({text}),/write failure/);assert.equal(f.calls.windows[0].destroyed,true);assert.equal(await fs.readFile(destination,'utf8'),'OWNED ORIGINAL');
 });
 const sourceSHA256=Object.fromEntries(await Promise.all(['desktop/plot-files.cjs','desktop/main.cjs','plot-document.mjs','core.mjs','advanced-geometry.mjs'].map(async name=>[name,createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex')]))),report={framework:'Mocked PDF Chromium and native chooser; real core, vector document and filesystem validation',completedAt:new Date().toISOString(),sourceSHA256,total:tests.length,passed:tests.filter(t=>t.status==='PASS').length,failed:tests.filter(t=>t.status==='FAIL').length,tests};await fs.writeFile(path.join(__dirname,'plot-files-v14-results.json'),`${JSON.stringify(report,null,2)}\n`);console.log(`${report.passed}/${report.total} PDF file-boundary checks passed`);process.exitCode=report.failed?1:0;
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
