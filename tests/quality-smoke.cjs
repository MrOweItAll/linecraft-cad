'use strict';
// Real controller transport and actual app file/PDF services; test-owned choosers.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto'),{execFile,spawnSync}=require('node:child_process'),{promisify}=require('node:util'),{pathToFileURL}=require('node:url');
const execute=promisify(execFile),visibility=require('./electron-test-options.cjs'),playwright=require('playwright');
const sha=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 const [executable,entry,prefix]=process.argv.slice(2);assert.ok(executable&&/^ordinary-grip-[a-z0-9-]+$/.test(prefix));
 const root=path.resolve(__dirname,'..'),work=path.join(root,'work/quality-smoke',prefix+'-'+Date.now()),profile=path.join(work,'profile'),connection=path.join(os.tmpdir(),'linecraft-qa-'+randomUUID()+'.json');await fs.mkdir(profile,{recursive:true});
 const report={format:'LinecraftDraftingSmoke/1',startedAt:new Date().toISOString(),work,status:'running',evidenceClass:'Actual hidden Electron and real authenticated CLI transport, owned native chooser replies, production import/save/reopen/DXF/PDF. Independent PDF reader. No physical input or installed/native acceptance.',tests:[],errors:[],network:[],outputs:{}};
 let app,page;
 const check=async(name,fn)=>{const started=Date.now();try{const details=await fn();report.tests.push({name,status:'passed',durationMs:Date.now()-started,...(details?{details}:{})});console.log('PASS '+name);}catch(error){report.tests.push({name,status:'failed',error:error.stack||String(error)});throw error;}};
 const action=name=>page.evaluate(name=>window.linecraft.runAction(name),name),doc=()=>page.evaluate(()=>JSON.parse(window.linecraft.editor.serialize()));
 const cli=async request=>{const file=path.join(work,'request-'+randomUUID()+'.json');await fs.writeFile(file,JSON.stringify(request));const result=await execute(process.execPath,[path.join(root,'tools/linecraft-control.cjs'),connection,request.method,file],{windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});const reply=JSON.parse(result.stdout);assert.equal(reply.ok,true,reply.message||reply.error);return reply;};
 const snapshot=()=>cli({version:1,method:'snapshot',params:{includeDocument:true}});
 const apply=async steps=>{const before=await snapshot();return cli({version:1,method:'apply',requestId:randomUUID(),params:{baseToken:before.baseToken,label:'Synthetic QA revision',steps}});};
 const open=async file=>{await app.evaluate((_,file)=>globalThis.__quality.open=file,file);assert.equal(await action('open'),true);if(await page.locator('#import-dialog').evaluate(e=>e.open))await page.locator('#import-close').click();};
 const save=async file=>{await app.evaluate((_,file)=>globalThis.__quality.save=file,file);assert.equal(await action('save-as'),true);assert.deepEqual(JSON.parse(await fs.readFile(file)),await doc());};
 const plot=async(file,layoutId)=>{await app.evaluate((_,file)=>globalThis.__quality.save=file,file);assert.equal(await action('plot'),true);await page.locator('#plot-space').selectOption('layout');await page.locator('#plot-layout-id').selectOption(layoutId);await page.waitForFunction(()=>!document.getElementById('plot-submit').disabled);await page.locator('#plot-submit').click();await page.waitForFunction(()=>!window.linecraft.get3DState().documentActionBusy);assert.equal(await page.locator('#plot-error').textContent(),'');assert.equal((await fs.readFile(file)).subarray(0,5).toString(),'%PDF-');await page.locator('#plot-cancel').click();};
 const audit=async(mode,native,pdf)=>{const receipt=path.join(work,mode+'-audit.json'),python=process.env.CAD_PYTHON||path.join(root,'.venv/Scripts/python.exe');const result=spawnSync(python,[path.join(root,'tests/audit-quality-pdf.py'),'--mode',mode,'--native',native,'--pdf',pdf,'--receipt',receipt],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stderr||result.stdout||result.error?.message);const data=JSON.parse(await fs.readFile(receipt));assert.equal(data.status,'passed');report.outputs[mode]={native,pdf,receipt,pdfSHA256:sha(await fs.readFile(pdf)),raster:data.raster};return data;};
 try{
  const args=[`--user-data-dir=${profile}`,`--linecraft-control-file=${connection}`];if(entry)args.unshift(path.resolve(entry),'--linecraft-no-watch');
  app=await playwright._electron.launch(visibility.prepareLaunch({executablePath:path.resolve(executable),args,timeout:30000}));page=await app.firstWindow();page.setDefaultTimeout(15000);await page.waitForFunction(()=>window.linecraft?.scripting&&window.linecraftDesktop);await visibility.recordVisibility(app,report);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
  report.application=await app.evaluate(({app,BrowserWindow,dialog,clipboard})=>{BrowserWindow.getAllWindows()[0].setContentSize(1280,900);globalThis.__quality={open:'',save:'',clipboardCalls:0};dialog.showOpenDialog=async()=>({canceled:false,filePaths:[globalThis.__quality.open]});dialog.showSaveDialog=async()=>({canceled:false,filePath:globalThis.__quality.save});dialog.showMessageBox=async()=>({response:1});for(const key of ['read','write','readText','writeText'])clipboard[key]=()=>{globalThis.__quality.clipboardCalls++;throw Error('QA forbids OS clipboard');};return{packaged:app.isPackaged,version:app.getVersion(),electron:process.versions.electron};});await page.setViewportSize({width:1280,height:900});
  const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json')));assert.equal(report.application.electron,metadata.devDependencies.electron);if(!entry)assert.equal(report.application.version,metadata.version);
  for(let i=0;i<150;i++){if(await fs.stat(connection).then(()=>true,()=>false))break;await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(await fs.stat(connection),'Owned descriptor was not created');
  await check('real controller describes capabilities and opens an owned deterministic native drawing',async()=>{
   const describe=await cli({version:1,method:'describe'});assert.equal(describe.capabilities.groupedUndo,true);assert.equal(describe.capabilities.externalCodeEvaluation,false);
   const {qualityFixture}=await import(pathToFileURL(path.join(root,'tests/quality-fixtures.mjs'))),fixture=qualityFixture(),file=path.join(work,'input.linecraft');await fs.writeFile(file,JSON.stringify(fixture));await open(file);assert.deepEqual((await snapshot()).document,fixture);assert.equal(report.application.packaged,!entry);
  });
  let targetId;
  await check('20-foot LINE uses literal 240-inch geometry through real controller commands',async()=>{
   await apply([{op:'commands',tokens:['LINE','0,0',"20',0",'']}]);const target=(await doc()).entities.at(-1);targetId=target.id;assert.equal(target.type,'LINE');assert.deepEqual(target.start,{x:0,y:0});assert.deepEqual(target.end,{x:240,y:0});
  });
  await check('grouped translation and annotation edits preserve length and exact full Undo/Redo state',async()=>{
   const before=await doc();await apply([{op:'grip',id:targetId,index:0,point:{x:12,y:24}},{op:'grip',id:targetId,index:1,point:{x:252,y:24}},{op:'text',id:'qa-note',patch:{text:'SYNTHETIC QA REVISED'}},{op:'dimension',id:'qa-dim',patch:{textOverride:'QA <>'}}]);
   const accepted=await doc(),target=accepted.entities.find(e=>e.id===targetId);assert.deepEqual(target.start,{x:12,y:24});assert.deepEqual(target.end,{x:252,y:24});assert.equal(Math.hypot(target.end.x-target.start.x,target.end.y-target.start.y),240);assert.equal(accepted.entities.find(e=>e.id==='qa-note').text,'SYNTHETIC QA REVISED');assert.equal(accepted.entities.find(e=>e.id==='qa-dim').textOverride,'QA <>');
   for(const entity of before.entities.filter(e=>![targetId,'qa-note','qa-dim'].includes(e.id)))assert.deepEqual(accepted.entities.find(e=>e.id===entity.id),entity);
   for(const key of Object.keys(before).filter(key=>key!=='entities'))assert.deepEqual(accepted[key],before[key],key);
   let snap=await snapshot();await cli({version:1,method:'undo',requestId:randomUUID(),params:{baseToken:snap.baseToken}});assert.deepEqual(await doc(),before);snap=await snapshot();await cli({version:1,method:'redo',requestId:randomUUID(),params:{baseToken:snap.baseToken}});assert.deepEqual(await doc(),accepted);
  });
  let layoutId;
  await check('controller creates a sheet and two locked physical viewports using discovered IDs',async()=>{
   await apply([{op:'commands',tokens:['LINE','0,-300',"60',-300",'']},{op:'layout',action:'create',name:'Synthetic QA A3',patch:{paper:{size:'A3',orientation:'landscape'}}}]);layoutId=(await doc()).layouts.at(-1).id;
   await apply([{op:'viewport',action:'create',layoutId,patch:{frame:{x:20,y:30,width:170,height:180},modelCenter:{x:132,y:24,z:0},scaleDenominator:48,locked:true,plotBorder:true}},{op:'viewport',action:'create',layoutId,patch:{frame:{x:220,y:30,width:170,height:180},modelCenter:{x:360,y:-300,z:0},scaleDenominator:360,locked:true,plotBorder:true}}]);
   const views=(await doc()).layouts.at(-1).viewports;assert.deepEqual(views.map(v=>v.scaleDenominator),[48,360]);assert.ok(views.every(v=>v.locked));
  });
  await check('actual Save As close/new reopen preserves all semantic drawing fields and IDs',async()=>{
   const file=path.join(work,'drafting.linecraft'),accepted=await doc();await save(file);assert.equal(await action('new'),true);await open(file);assert.deepEqual(await doc(),accepted);
  });
  await check('actual app DXF export contains independent literal ruler coordinates',async()=>{
   const file=path.join(work,'drafting.dxf');await app.evaluate((_,file)=>globalThis.__quality.save=file,file);assert.equal(await action('export-dxf'),true);
   const lines=(await fs.readFile(file,'utf8')).trim().split(/\r?\n/),records=[];let record;
   for(let i=0;i<lines.length;i+=2){const code=Number(lines[i]),value=lines[i+1]?.trim();if(code===0){record={type:value,groups:[]};records.push(record);}else record?.groups.push([code,value]);}
   const value=(r,c)=>Number(r.groups.find(g=>g[0]===c)?.[1]);
   for(const points of [[12,24,252,24],[0,-300,720,-300]])assert.equal(records.filter(r=>r.type==='LINE'&&[10,20,11,21].every((code,i)=>value(r,code)===points[i])).length,1);
   report.outputs.dxf={file,sha256:sha(await fs.readFile(file)),scope:'Independent group-code reader validates two ruler segments; not complete DXF fidelity'};
  });
  await check('actual PDF independently measures the 127mm and50.8mm ruler examples',async()=>{
   const native=path.join(work,'drafting.linecraft'),pdf=path.join(work,'drafting.pdf');await plot(pdf,layoutId);const result=await audit('drafting',native,pdf);return{measurements:result.measurements};
  });
  await check('actual DXF import retains the repaired fill, Save/reopen and measured PDF ink',async()=>{
   await open(path.join(root,'tests/fixtures/duplicate-closing-hatch.dxf'));let imported=await doc(),fill=imported.entities.find(e=>e.type==='HATCH');assert.ok(fill,'Redundant-closing HATCH was lost by actual app import');assert.deepEqual(fill.boundary.points,[{x:12.5,y:7.25},{x:32.5,y:7.25},{x:32.5,y:19.25},{x:12.5,y:19.25}]);assert.equal(imported.settings.units,'unitless');assert.deepEqual(imported.entities[0].start,{x:-100,y:-100});assert.deepEqual(imported.entities[0].end,{x:-90,y:-100});
   await apply([{op:'layout',action:'create',name:'Synthetic HATCH output',patch:{paper:{size:'A3',orientation:'landscape'}}}]);const id=(await doc()).layouts.at(-1).id;await apply([{op:'viewport',action:'create',layoutId:id,patch:{frame:{x:20,y:30,width:160,height:110},modelCenter:{x:22.5,y:13.25,z:0},scaleDenominator:1,locked:true,plotBorder:true}}]);
   const native=path.join(work,'hatch.linecraft'),pdf=path.join(work,'hatch.pdf'),accepted=await doc();await save(native);assert.equal(await action('new'),true);await open(native);assert.deepEqual(await doc(),accepted);await plot(pdf,id);await audit('hatch',native,pdf);
  });
  await check('actual imported Top viewport retains its raw center and scale through Save/reopen and measured PDF',async()=>{
   await open(path.join(root,'tests/fixtures/top-viewport-center.dxf'));const imported=await doc();assert.equal(imported.settings.units,'mm');assert.equal(imported.layouts.length,1);assert.equal(imported.entities.length,1);
   assert.deepEqual(imported.entities[0].start,{x:3,y:-41});assert.deepEqual(imported.entities[0].end,{x:43,y:-41});const layout=imported.layouts[0];assert.equal(layout.name,'QA-CENTER');assert.equal(layout.viewports.length,1);assert.equal(layout.entities.length,1);
   const viewport=layout.viewports[0];assert.deepEqual(viewport.modelCenter,{x:23,y:-41,z:0});assert.deepEqual(viewport.frame,{x:50,y:50,width:200,height:100});assert.equal(viewport.scaleDenominator,1);assert.equal(viewport.locked,true);assert.equal(viewport.workspace,'2d');assert.deepEqual(viewport.camera3d.target,{x:23,y:-41,z:0});
   assert.deepEqual(layout.entities[0].start,{x:10,y:10});assert.deepEqual(layout.entities[0].end,{x:20,y:10});
   // Plot the imported layout unchanged; creating/correcting a viewport here
   // would bypass the import defect this check is intended to catch.
   const native=path.join(work,'viewport.linecraft'),pdf=path.join(work,'viewport.pdf');await save(native);assert.equal(await action('new'),true);await open(native);assert.deepEqual(await doc(),imported);await plot(pdf,layout.id);assert.deepEqual(await doc(),imported);const result=await audit('viewport',native,pdf);return{measurements:result.measurements,importedViewportUnchanged:true};
  });
  await check('hidden test stays offline without clipboard access or renderer errors',async()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);assert.equal(await app.evaluate(()=>globalThis.__quality.clipboardCalls),0);await visibility.verifyVisibility(app,report);});
  report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack||String(error);console.error(report.error);}
 finally{
  if(app){await visibility.finalizeVisibility(app,report);await app.evaluate(({app})=>app.quit()).catch(()=>{});await app.close().catch(()=>{});}
  const removed=await fs.stat(connection).then(()=>false,error=>error.code==='ENOENT');report.descriptorRemoved=removed;if(!removed){report.status='failed';report.error=(report.error||'')+' Owned descriptor survived normal shutdown.';await fs.rm(connection,{force:true});}
  if(report.tests.some(t=>t.status==='failed'))report.status='failed';report.completedAt=new Date().toISOString();await fs.writeFile(path.join(work,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});await fs.writeFile(path.join(__dirname,prefix+'-quality-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.status}: ${report.tests.length} quality workflow checks`);if(report.status!=='passed')process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
