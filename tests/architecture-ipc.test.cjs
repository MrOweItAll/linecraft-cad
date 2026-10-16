'use strict';
// Architectural source validation and native persistence contracts. Electron and chooser/clipboard
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
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},invoke=(channel,...args)=>handlers.get(channel)(event,...args);
 const {createEditor}=await import(pathToFileURL(path.join(root,'core.mjs')).href),editor=createEditor({settings:{units:'in'}});
 const folder=path.join(workspace,'work','architecture-ipc',`run-${Date.now()}`);await fs.mkdir(folder,{recursive:true});filename=path.join(folder,'semantic.linecraft');
 for(const op of [{type:'addWalls',points:[{x:0,y:0},{x:240,y:0},{x:240,y:144},{x:0,y:144}],closed:true,referenceFace:'right',thickness:6,bearingElevation:108},{type:'recognizeRooms'},{type:'addRoof',overhang:12}])assert.equal(editor.applyArchitecture(op).ok,true);
 const source=editor.serialize(),doc=JSON.parse(source),tests=[];
 const check=async(name,fn)=>{try{await fn();tests.push({name,status:'passed'});console.log(`PASS ${name}`);}catch(error){tests.push({name,status:'failed',error:error.stack});console.log(`FAIL ${name}: ${error.message}`);}};
 await check('production Save/Open retains migrated schema3 source, precision, rooms and regenerated roof; no derived cache is stored',async()=>{
  assert.equal((await invoke('linecraft:save',source,true)).ok,true);const bytes=await fs.readFile(filename,'utf8');assert.equal(bytes,source);assert.equal(JSON.parse(bytes).entities.length,0);const loaded=await invoke('linecraft:open');assert.equal(loaded.ok,true);const restored=createEditor(JSON.parse(loaded.text));assert.deepEqual(restored.state.architecture,editor.state.architecture);assert.deepEqual(restored.state.entities,editor.state.entities);
 });
 await check('future schemas, executable fields, nonzero truss surcharges and forged derivatives reject before chooser or overwrite',async()=>{
  const original=await fs.readFile(filename,'utf8'),choices=calls.saveDialog;
  for(const mutate of [d=>d.architecture.schemaVersion=99,d=>d.architecture.constraints=[{id:'bad',kind:'expression',code:'eval'}],d=>d.architecture.costAssumptions.manufacturingComplexitySurcharge=1,d=>d.architecture.roofGroups[0].riseTwice=8.1,d=>d.architecture.modelUnits='ft',d=>d.entities.push({id:'@architecture/forged',type:'LINE',start:{x:0,y:0},end:{x:1,y:1}})]){
   const bad=structuredClone(doc);mutate(bad);const r=await invoke('linecraft:save',JSON.stringify(bad),true);assert.equal(r.ok,false);assert.ok(r.error);
  }assert.equal(calls.saveDialog,choices);assert.equal(await fs.readFile(filename,'utf8'),original);
 });
 await check('invalid native Open never returns unvalidated architectural source',async()=>{
  const bad=structuredClone(doc);bad.architecture.openings=[{id:'missing',wallId:'not-a-wall',station:0,width:10,sillElevation:0,headElevation:10}];const invalid=path.join(folder,'bad.linecraft');await fs.writeFile(invalid,JSON.stringify(bad));const previous=filename;filename=invalid;try{const r=await invoke('linecraft:open');assert.equal(r.ok,false);assert.equal(r.text,undefined);}finally{filename=previous;}
 });
 await check('bounded bad source rejects without touching the prior native document',async()=>{
  const before=await fs.readFile(filename,'utf8'),bad=structuredClone(doc);bad.architecture.wallNodes=Array.from({length:10001},(_,i)=>({id:`n${i}`,x:i,y:0}));assert.equal((await invoke('linecraft:save',JSON.stringify(bad),true)).ok,false);assert.equal(await fs.readFile(filename,'utf8'),before);
 });
 await check('accepted tray source survives actual native IPC and regenerates its stepped current profile without a cached mesh',async()=>{
  const trayEditor=createEditor(doc),accept=operation=>{const r=trayEditor.applyArchitecture(operation);assert.equal(r.ok,true,r.message);};
  accept({type:'setRoom',roomId:'room-1',values:{ceilingElevation:84,targetCeilingElevation:90,allowCeilingChange:true,minimumClearHeight:72}});
  accept({type:'declareRoofAssembly',roofGroupId:'roof-1',assembly:{name:'Declared empty assembly',layers:[],reservations:[]}});
  accept({type:'setTrayCandidate',roomId:'room-1',candidate:{min:{x:48,y:36},max:{x:192,y:108},baseElevation:84,raisedElevation:96}});
  accept({type:'applyTrayCandidate',roomId:'room-1'});const current=trayEditor.state.architectureDerived.spaces[0].current;
  assert.equal(current.profileType,'tray');assert.equal(current.feasible,true);const text=trayEditor.serialize();assert.equal((await invoke('linecraft:save',text,true)).ok,true);
  const saved=JSON.parse(await fs.readFile(filename,'utf8'));assert.equal(saved.architecture.schemaVersion,3);assert.equal(saved.architecture.rooms[0].trayCeiling.raisedElevation,96);assert.ok(saved.entities.every(v=>!v.id.startsWith('@architecture/')));
  const opened=await invoke('linecraft:open');assert.equal(opened.ok,true);const restored=createEditor(JSON.parse(opened.text));assert.deepEqual(restored.state.architectureDerived.spaces[0].current,current);assert.deepEqual(restored.state.architecture,trayEditor.state.architecture);assert.ok(restored.state.entities.some(v=>v.id==='@architecture/room/room-1/ceiling'));
 });
 const report={framework:'Roof + Space native IPC contracts',scope:'Mock Electron chooser/window and IPC transport; actual production main handlers, actual core, real owned filesystem. No visible application or OS clipboard.',completedAt:new Date().toISOString(),total:tests.length,passed:tests.filter(t=>t.status==='passed').length,failed:tests.filter(t=>t.status==='failed').length,tests};await fs.writeFile(path.join(__dirname,'architecture-ipc-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} architectural IPC checks passed`);process.exitCode=report.failed?1:0;
}
main().catch(error=>{console.error(error);process.exitCode=1;});

