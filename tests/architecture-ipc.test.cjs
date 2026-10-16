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
 await check('production Save/Open retains migrated schema4 source, precision, rooms and regenerated roof; no derived cache is stored',async()=>{
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
 await check('zero-thickness tray without an assembly survives actual native IPC and regenerates its stepped profile',async()=>{
  const trayEditor=createEditor(doc),accept=operation=>{const r=trayEditor.applyArchitecture(operation);assert.equal(r.ok,true,r.message);};
  accept({type:'setRoom',roomId:'room-1',values:{ceilingElevation:84,targetCeilingElevation:90,allowCeilingChange:true,minimumClearHeight:72}});
  accept({type:'setTrayCandidate',roomId:'room-1',candidate:{min:{x:48,y:36},max:{x:192,y:108},baseElevation:84,raisedElevation:96}});
  accept({type:'applyTrayCandidate',roomId:'room-1'});const current=trayEditor.state.architectureDerived.spaces[0].current;
  assert.equal(current.profileType,'tray');assert.equal(current.feasible,true);const text=trayEditor.serialize();assert.equal((await invoke('linecraft:save',text,true)).ok,true);
  const saved=JSON.parse(await fs.readFile(filename,'utf8'));assert.equal(saved.architecture.schemaVersion,5);assert.equal(saved.architecture.rooms[0].trayCeiling.raisedElevation,96);assert.deepEqual(saved.architecture.assemblies,[]);assert.equal(saved.architecture.roofGroups[0].assemblyId,null);assert.ok(saved.entities.every(v=>!v.id.startsWith('@architecture/')));
  const opened=await invoke('linecraft:open');assert.equal(opened.ok,true);const restored=createEditor(JSON.parse(opened.text));assert.deepEqual(restored.state.architectureDerived.spaces[0].current,current);assert.deepEqual(restored.state.architecture,trayEditor.state.architecture);assert.ok(restored.state.entities.some(v=>v.id==='@architecture/room/room-1/ceiling'));
 });
 await check('atomic zero-thickness offsets and retained reservations persist through native Save/Open',async()=>{
  const zeroEditor=createEditor(doc),accept=operation=>{const r=zeroEditor.applyArchitecture(operation);assert.equal(r.ok,true,r.message);},reservation={id:'retained',kind:'service',description:'Explicit mathematical reservation',min:{x:48,y:36,z:95},max:{x:96,y:72,z:108}};
  accept({type:'setRoom',roomId:'room-1',values:{ceilingFinishThickness:.5}});accept({type:'declareRoofAssembly',roofGroupId:'roof-1',assembly:{layers:[{name:'Optional layer',material:'test',normalThickness:3}],reservations:[reservation]}});
  accept({type:'useZeroThickness',roomId:'room-1',roofGroupId:'roof-1'});const text=zeroEditor.serialize(),study=zeroEditor.state.architectureDerived.spaces[0];assert.equal(study.assumptions.analysisMode,'mathematical-zero-thickness');assert.equal(study.assumptions.roofNormalThickness,0);assert.equal(study.assumptions.ceilingFinishThickness,0);assert.equal(study.maxFlatCeilingElevation,95);assert.equal((await invoke('linecraft:save',text,true)).ok,true);
  const opened=await invoke('linecraft:open');assert.equal(opened.ok,true);const restored=createEditor(JSON.parse(opened.text));assert.equal(restored.serialize(),text);assert.deepEqual(restored.state.architectureDerived.spaces[0],study);assert.deepEqual(restored.state.architecture.assemblies[0].reservations,[reservation]);
 });
 await check('confirmed gable assignments and distinct closure meshes survive production native IPC without derived persistence',async()=>{
  const gableEditor=createEditor(doc),{inferGableCandidates}=await import(pathToFileURL(path.join(root,'architecture/roof-gable.mjs')).href),candidates=inferGableCandidates(gableEditor.state.architecture.roofGroups[0].boundary),assignment=candidates.edges.filter(edge=>edge.a.x===edge.b.x).map(edge=>edge.key);
  const result=gableEditor.applyArchitecture({type:'setRoof',roofGroupId:'roof-1',values:{roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:assignment,rakeOverhang:12}});assert.equal(result.ok,true,result.message);const text=gableEditor.serialize(),before=gableEditor.state.architectureDerived;assert.equal(before.roofs[0].status,'ok');assert.ok(before.entities.some(entity=>before.owners[entity.id]?.part==='gable'));assert.equal((await invoke('linecraft:save',text,true)).ok,true);
  const saved=JSON.parse(await fs.readFile(filename,'utf8'));assert.equal(saved.architecture.schemaVersion,5);assert.deepEqual(saved.architecture.roofGroups[0].gableAssignments,assignment);assert.equal(saved.architecture.roofGroups[0].rakeOverhang,12);assert.ok(saved.entities.every(entity=>!entity.id.startsWith('@architecture/')));assert.ok(!('gableClosures'in saved.architecture.roofGroups[0]));const opened=await invoke('linecraft:open');assert.equal(opened.ok,true);const restored=createEditor(JSON.parse(opened.text));assert.equal(restored.serialize(),text);assert.deepEqual(restored.state.architectureDerived,before);
 });
 const report={framework:'Roof + Space native IPC contracts',scope:'Mock Electron chooser/window and IPC transport; actual production main handlers, actual core, real owned filesystem. No visible application or OS clipboard.',completedAt:new Date().toISOString(),total:tests.length,passed:tests.filter(t=>t.status==='passed').length,failed:tests.filter(t=>t.status==='failed').length,tests};await fs.writeFile(path.join(__dirname,'architecture-ipc-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} architectural IPC checks passed`);process.exitCode=report.failed?1:0;
}
main().catch(error=>{console.error(error);process.exitCode=1;});

