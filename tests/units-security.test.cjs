'use strict';
// Original focused 1.5 unit-field validation. Electron and chooser/clipboard
// boundaries are mocked; the production main handlers, core and files are real.
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const workspace=path.basename(path.dirname(root))==='outputs'?path.dirname(path.dirname(root)):root;
const MIME='electron application/osclipboard;format="application/x-linecraft-geometry+json"';
const handlers=new Map(),calls={saveDialog:0,openDialog:0,clipboardWrite:0};
let window,items=[],filename,cancelSave=false;
const app=new EventEmitter();
Object.assign(app,{isPackaged:true,whenReady:async()=>{},quit(){},setPath(){},getVersion:()=> 'test'});
class Window extends EventEmitter{
 constructor(){super();window=this;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:pathToFileURL(path.join(root,'index.html')).href},send(){},setWindowOpenHandler(){},closeDevTools(){}});}
 isDestroyed(){return false;}setTitle(){}show(){}close(){}async loadFile(){}
}
class Item{constructor(payloads){this.payloads=payloads;this.types=Object.keys(payloads);}async getType(type){return new Blob([this.payloads[type]],{type});}}
const electron={app,BrowserWindow:Window,ClipboardItem:Item,clipboard:{read:async()=>items,write:async value=>{calls.clipboardWrite++;items=value;}},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},dialog:{showErrorBox(){},showMessageBox:async()=>({response:2}),showSaveDialog:async()=>{calls.saveDialog++;return cancelSave?{canceled:true}:{canceled:false,filePath:filename};},showOpenDialog:async()=>{calls.openDialog++;return{canceled:false,filePaths:[filename]};}},ipcMain:{handle:(channel,callback)=>handlers.set(channel,callback),on(){}},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){},onHeadersReceived(){}}}}};
const originalLoad=Module._load;
Module._load=function(name,parent,isMain){return name==='electron'?electron:originalLoad.call(this,name,parent,isMain);};
require('../desktop/main.cjs');Module._load=originalLoad;

async function main(){
 await new Promise(resolve=>setImmediate(resolve));
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
 const invoke=(channel,...args)=>handlers.get(channel)(event,...args);
 const {createEditor}=await import(pathToFileURL(path.join(root,'core.mjs')).href);
 const folder=path.join(workspace,'work','units-security-tests',`run-${Date.now()}`);await fs.mkdir(folder,{recursive:true});
 const validFile=path.join(folder,'owned-units.linecraft');filename=validFile;
 const editor=createEditor();for(const input of ['L','0,0','100,0',''])assert.equal(editor.execute(input).ok,true);
 const defaultDocument=JSON.parse(editor.serialize());
 const defaults={linearFormat:'decimal',fractionPrecision:4,angularInputUnit:'degrees',angularFormat:'decimal-degrees',angularPrecision:4};
 for(const[key,value]of Object.entries(defaults))assert.equal(defaultDocument.settings[key],value,`Required 1.5 unit field ${key} must exist; never skip missing implementation.`);
 const patch={units:'mm',linearFormat:'architectural',fractionPrecision:5,angularInputUnit:'radians',angularFormat:'dms',angularPrecision:3,dimStyles:defaultDocument.dimStyles.map(style=>({...style,angularPrecision:2,fractionPrecision:6}))};
 assert.equal(editor.updateDrawingSettings(patch).ok,true);
 const document=JSON.parse(editor.serialize()),tests=[];
 const check=async(name,fn)=>{const started=Date.now();try{await fn();tests.push({name,status:'passed',durationMs:Date.now()-started});console.log(`PASS ${name}`);}catch(error){tests.push({name,status:'failed',durationMs:Date.now()-started,error:error.stack||String(error)});console.log(`FAIL ${name}: ${error.message}`);}};
 const invalidSaves=async mutations=>{const before=await fs.readFile(validFile,'utf8'),count=calls.saveDialog;for(const mutate of mutations){const invalid=structuredClone(document);mutate(invalid);const response=await invoke('linecraft:save',JSON.stringify(invalid),true);assert.equal(response.ok,false);assert.equal(response.canceled,undefined);assert.ok(response.error);}assert.equal(calls.saveDialog,count);assert.equal(await fs.readFile(validFile,'utf8'),before);};

 await check('legacy drawings receive explicit decimal and degree defaults without changing geometry',async()=>{
  const legacy=structuredClone(defaultDocument);for(const key of Object.keys(defaults))delete legacy.settings[key];
  const normalized=createEditor();assert.equal(normalized.importJSON(JSON.stringify(legacy)).ok,true);
  for(const[key,value]of Object.entries(defaults))assert.equal(normalized.state.settings[key],value);
  assert.deepEqual(normalized.state.entities,defaultDocument.entities);assert.equal(normalized.canUndo,true);assert.equal(normalized.undo().ok,true);assert.equal(normalized.state.entities.length,0);assert.equal(normalized.redo().ok,true);assert.deepEqual(normalized.state.entities,defaultDocument.entities);for(const[key,value]of Object.entries(defaults))assert.equal(normalized.state.settings[key],value);
 });
 await check('non-inch architectural display and unit-aware dimension precision survive native Save/Open',async()=>{
  assert.equal((await invoke('linecraft:save',editor.serialize(),true)).ok,true);
  const bytes=await fs.readFile(validFile,'utf8'),saved=JSON.parse(bytes);assert.deepEqual(saved.settings,document.settings);assert.deepEqual(saved.dimStyles,document.dimStyles);
  const opened=await invoke('linecraft:open');assert.equal(opened.ok,true);assert.equal(opened.text,bytes);
  const restored=createEditor();assert.equal(restored.importJSON(opened.text).ok,true);assert.deepEqual(restored.state.settings,document.settings);assert.deepEqual(restored.state.dimStyles,document.dimStyles);assert.deepEqual(restored.state.entities,document.entities);
 });
 await check('malformed unit formats, explicit nulls and noninteger precision fail before a Save chooser or overwrite',async()=>{
  const malformed=[{linearFormat:null},{linearFormat:'constructor'},{linearFormat:[]},{fractionPrecision:null},{fractionPrecision:-1},{fractionPrecision:9},{fractionPrecision:.5},{fractionPrecision:'4'},{angularInputUnit:null},{angularInputUnit:'gradients'},{angularInputUnit:{}},{angularFormat:null},{angularFormat:'eval'},{angularPrecision:null},{angularPrecision:-1},{angularPrecision:9},{angularPrecision:1.5},{angularPrecision:'3'}];
  await invalidSaves(malformed.map(value=>document=>Object.assign(document.settings,value)));
 });
 await check('dimension-specific angular and fraction precision reject invalid values atomically through native Save',async()=>{
  await invalidSaves(['angularPrecision','fractionPrecision'].flatMap(key=>[null,-1,9,.5,'4',{},[]].map(value=>document=>{document.dimStyles[0][key]=value;})));
 });
 await check('invalid drawing settings updates leave geometry, settings, revision and Undo/Redo history unchanged',async()=>{
  const serialized=editor.serialize(),revision=editor.state.revision,canUndo=editor.canUndo,canRedo=editor.canRedo;
  for(const invalid of [{linearFormat:null},{angularInputUnit:'owned-invalid'},{angularPrecision:9},{fractionPrecision:'2'},{units:'in',angularFormat:'owned-invalid'},{dimStyles:[{...document.dimStyles[0],angularPrecision:null}]}]){
   const response=editor.updateDrawingSettings(invalid);assert.equal(response.ok,false);assert.equal(editor.serialize(),serialized);assert.equal(editor.state.revision,revision);assert.equal(editor.canUndo,canUndo);assert.equal(editor.canRedo,canRedo);
  }
  assert.equal(editor.undo().ok,true);assert.deepEqual(editor.state.settings,defaultDocument.settings);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),serialized);
 });
 await check('failed native Open of malformed unit metadata preserves the adopted Save path and both original files',async()=>{
  const invalid=structuredClone(document);invalid.settings.angularPrecision=null;filename=path.join(folder,'invalid-units.linecraft');const invalidBytes=JSON.stringify(invalid);await fs.writeFile(filename,invalidBytes);
  const before=await fs.readFile(validFile,'utf8');const opened=await invoke('linecraft:open');assert.equal(opened.ok,false);assert.ok(opened.error);const count=calls.saveDialog;
  assert.equal((await invoke('linecraft:save',editor.serialize(),false)).ok,true);assert.equal(calls.saveDialog,count);assert.equal(await fs.readFile(validFile,'utf8'),before);assert.equal(await fs.readFile(filename,'utf8'),invalidBytes);
 });
 await check('canceled Save As of changed unit settings retains the prior association and never creates the requested file',async()=>{
  const canceledFile=path.join(folder,'canceled-units.linecraft');filename=canceledFile;cancelSave=true;
  assert.equal(editor.updateDrawingSettings({angularFormat:'radians',angularPrecision:8}).ok,true);
  const result=await invoke('linecraft:save',editor.serialize(),true);assert.equal(result.ok,false);assert.equal(result.canceled,true);await assert.rejects(fs.stat(canceledFile),{code:'ENOENT'});
  cancelSave=false;const count=calls.saveDialog;assert.equal((await invoke('linecraft:save',editor.serialize(),false)).ok,true);assert.equal(calls.saveDialog,count);assert.deepEqual(JSON.parse(await fs.readFile(validFile,'utf8')).settings,editor.state.settings);
 });
 await check('portable geometry clipboard carries and validates optional dimension unit precision without touching OS contents',async()=>{
  editor.select(editor.state.entities.map(entity=>entity.id));assert.equal(editor.copySelection({x:0,y:0}).ok,true);const payload=editor.getClipboard();assert.equal(payload.dimStyles[0].angularPrecision,2);assert.equal(payload.dimStyles[0].fractionPrecision,6);
  assert.equal((await invoke('linecraft:clipboard-write',payload)).ok,true);const read=await invoke('linecraft:clipboard-read');assert.equal(read.ok,true);assert.deepEqual(read.data,payload);
  const legacy=structuredClone(payload);for(const style of legacy.dimStyles){delete style.angularPrecision;delete style.fractionPrecision;}assert.equal((await invoke('linecraft:clipboard-write',legacy)).ok,true);assert.equal((await invoke('linecraft:clipboard-read')).ok,true);
 });
 await check('malformed recognized clipboard unit metadata cannot replace prior payload or return unvalidated data',async()=>{
  const payload=editor.getClipboard(),prior=items,count=calls.clipboardWrite;
  for(const[key,value]of [['angularPrecision',null],['angularPrecision',9],['angularPrecision','4'],['fractionPrecision',-.5],['fractionPrecision',{}]]){
   const invalid=structuredClone(payload);invalid.dimStyles[0][key]=value;assert.equal((await invoke('linecraft:clipboard-write',invalid)).ok,false);assert.equal(calls.clipboardWrite,count);assert.equal(items,prior);
   items=[new Item({[MIME]:JSON.stringify(invalid)})];const result=await invoke('linecraft:clipboard-read');assert.equal(result.ok,false);assert.equal(result.data,undefined);items=prior;
  }
 });
 const sourceSHA256=Object.fromEntries(await Promise.all(['desktop/main.cjs','desktop/preload.cjs','core.mjs','units.mjs'].map(async name=>[name,createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex')])));
 const report={framework:'Focused 1.5 unit settings and dimension precision validation through production native IPC',scope:'Mocked Electron shell, chooser and dedicated geometry clipboard; actual core validation and real filesystem. No renderer or native visible window is launched.',completedAt:new Date().toISOString(),osClipboardTouched:false,sourceSHA256,total:tests.length,passed:tests.filter(test=>test.status==='passed').length,failed:tests.filter(test=>test.status==='failed').length,tests};
 await fs.writeFile(path.join(__dirname,'units-security-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} unit IPC validation checks passed`);process.exitCode=report.failed?1:0;
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
