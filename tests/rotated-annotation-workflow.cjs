'use strict';
// Actual hidden source/unpacked Open, file services, ordered multi-sheet PDF.
const fs = require('node:fs/promises'), sync = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const {createHash, randomUUID} = require('node:crypto');
const {execFile, spawnSync} = require('node:child_process');
const {promisify} = require('node:util'), {pathToFileURL} = require('node:url');
const execute = promisify(execFile), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(__dirname, '..');
const [executableArgument, entry = '', prefix, manifestName] = process.argv.slice(2);
const paperProfile='rotated-annotation';
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
assert.ok(executableArgument && /^ordinary-grip-[a-z0-9-]+$/.test(prefix) && manifestName,
  'Usage: node tests/rotated-annotation-workflow.cjs EXE SOURCE_ENTRY_OR_EMPTY UNIQUE_PREFIX CANDIDATE_MANIFEST');
assert.equal(process.argv.length,6);
const executable = path.resolve(executableArgument);
const {manifest, manifestFile, candidate} = require('../tools/source-manifest.cjs').loadManifest(manifestName);
assert.equal(candidate, true, 'Use an explicit reviewed candidate manifest.');
const metadata = JSON.parse(sync.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(metadata.version, manifest.version);
assert.equal(metadata.devDependencies.electron, manifest.desktopRuntimePin);
assert.equal(sync.lstatSync(path.join(root, 'node_modules')).isSymbolicLink(), false);
const playwright = require('playwright'), visibility = require('./electron-test-options.cjs');
const run = path.join(root, 'work/rotated-notes', prefix + '-' + Date.now() + '-' + randomUUID().slice(0, 8));
const profile = path.join(run, 'profile'), connection = path.join(run, 'control.json');
const input = path.join(run, 'rotated-input.linecraft'), native = path.join(run, 'rotated-accepted.linecraft');
const pdf = path.join(run, 'rotated-annotation.pdf'), producerFile = path.join(run, 'producer-results.json');
const report = {format:'LinecraftRotatedAnnotationWorkflow/1', status:'running', startedAt:new Date().toISOString(),
  version:manifest.version, manifestFile, run, paperProfile, application:null, pdfAudit:null,
  scope:'Actual hidden source/unpacked application, authenticated controller, owned chooser replies and production PDF. No installed/native human acceptance.'};
const appReport = {format:'LinecraftRotatedAnnotationApplication/1', status:'running', startedAt:new Date().toISOString(),
  source:root, executable, entry:entry || null, version:manifest.version, manifestFile, paperProfile, tests:[], errors:[], network:[], outputs:{},
  scope:'Owned synthetic native drawing; actual Open/Save As/New/Open; temporary UI multi-sheet order; full-state and actual PDF acceptance. No geometry or viewport repair.'};
report.tests=appReport.tests;
report.manifestSHA256=sha(sync.readFileSync(path.join(root,manifestFile)));
let app, page, watchdog, sourceBefore, packagedBefore, inputSHA256, timedOut=false;
const inside = (parent, target) => { const relative = path.relative(parent, target); return relative && !relative.startsWith('..') && !path.isAbsolute(relative); };
async function fingerprint() {
  const result = {};
  for (const row of [...manifest.runtimeFiles, ...manifest.extraResources]) {
    const bytes = await fs.readFile(path.join(root, row.file));
    assert.equal(bytes.length, row.bytes, row.file); assert.equal(sha(bytes), row.sha256, row.file); result[row.file] = row.sha256;
  }
  for (const name of [manifestFile, 'PUBLIC-SOURCE.json', 'package.json', 'package-lock.json',
    'tests/quality-fixtures.mjs', 'tests/rotated-annotation-fixture.mjs', 'tests/rotated-annotation-reference.test.mjs', 'tests/multisheet-fixture.mjs', 'tests/rotated-annotation-workflow.cjs', 'tests/audit-rotated-annotation-pdf.py', 'tests/electron-test-options.cjs']) {
    result[name] = sha(await fs.readFile(path.join(root, name)));
  }
  return result;
}
async function packagedIdentity() {
  if (entry) return null;
  const asar = require('@electron/asar'), resources = path.join(path.dirname(executable), 'resources');
  const archive = path.join(resources, 'app.asar');
  for (const row of manifest.runtimeFiles) assert.equal(sha(asar.extractFile(archive, row.file)), row.sha256, row.file);
  for (const row of manifest.extraResources) {
    const target = row.file.startsWith('third-party/') ? row.file : 'structural/linecraft-structural-adapter.py';
    assert.equal(sha(await fs.readFile(path.join(resources, target))), row.sha256, target);
  }
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json'));
  assert.equal(packaged.version, manifest.version); assert.equal(packaged.main, 'desktop/main.cjs');
  return {version:packaged.version, exeSHA256:sha(await fs.readFile(executable)), asarSHA256:sha(await fs.readFile(archive)),
    runtimeFiles:manifest.runtimeFiles.length, resources:manifest.extraResources.length};
}
const doc = () => page.evaluate(() => JSON.parse(window.linecraft.editor.serialize()));
const action = name => page.evaluate(name => window.linecraft.runAction(name), name);
const cli = async request => {
  const file = path.join(run, 'request-' + randomUUID() + '.json');
  await fs.writeFile(file, JSON.stringify(request), {flag:'wx'});
  const response = await execute(process.execPath, [path.join(root, 'tools/linecraft-control.cjs'), connection, request.method, file],
    {windowsHide:true, timeout:30000, maxBuffer:8*1024*1024});
  const reply = JSON.parse(response.stdout); assert.equal(reply.ok, true, reply.message || reply.error); return reply;
};
const snapshot = () => cli({version:1, method:'snapshot', params:{includeDocument:true}});
const check = async (name, fn) => {
  const start = Date.now();
  try { const details = await fn(); appReport.tests.push({name,status:'passed',durationMs:Date.now()-start,...(details ? {details} : {})}); console.log('PASS ' + name); }
  catch (error) { appReport.tests.push({name,status:'failed',durationMs:Date.now()-start,error:error.stack || String(error)}); throw error; }
};
async function open(file) {
  await app.evaluate((_, file) => globalThis.__rotatedAnnotationQA.open = file, file);
  assert.equal(await action('open'), true);
  if (await page.locator('#import-dialog').evaluate(element => element.open)) await page.locator('#import-close').click();
}
function assertFixture(document) {
 assert.equal(document.settings.units,'in');assert.equal(document.settings.linearFormat,'architectural');assert.equal(document.entities.length,3);assert.deepEqual(document.entities.map(e=>e.id),['rotation-ruler','aligned-calibration','leader-calibration']);
 const d=document.entities[1],l=document.entities[2];assert.equal(d.kind,'aligned');assert.deepEqual(d.p1,{x:40,y:120});assert.deepEqual(d.p2,{x:100,y:200});assert.deepEqual(d.placement,{x:38,y:184});assert.equal(d.textOverride,'ALIGNED <>');assert.equal(l.text,'SYNTHETIC LEADER');assert.deepEqual(l.points,[{x:160,y:130},{x:180,y:150},{x:215,y:150}]);assert.deepEqual(document.layouts.map(s=>s.id),['sheet-b','sheet-a']);
 for(const sheet of document.layouts){assert.equal(sheet.paper.widthMm,420);assert.equal(sheet.paper.heightMm,297);assert.equal(sheet.entities.length,5);assert.equal(sheet.viewports.length,1);const v=sheet.viewports[0];assert.deepEqual(v.frame,{x:40,y:60,width:340,height:200});assert.deepEqual(v.modelCenter,{x:120,y:150,z:0});assert.equal(v.scaleDenominator,sheet.id==='sheet-a'?48:96);assert.equal(v.locked,true);assert.equal(v.plotBorder,false);assert.equal(sheet.entities.find(e=>e.type==='TEXT').text,sheet.id==='sheet-a'?'ROTATED-48-FIRST':'ROTATED-96-SECOND');}
}
async function application() {
  try {
    assert.ok(!sync.existsSync(run), 'Use a fresh owned run directory.');
    if (entry) {
      assert.equal(path.resolve(entry), path.join(root, 'desktop/main.cjs'));
      assert.equal(executable, path.join(root, 'node_modules/electron/dist/electron.exe'));
    } else {
      const actual = await fs.realpath(executable), qaRoot = await fs.realpath(path.join(root, 'work/qa-runs'));
      assert.ok(inside(qaRoot, actual), 'Only an isolated QA candidate may be launched; installed applications are excluded.');
      assert.equal(path.basename(actual), 'Linecraft CAD.exe');
    }
    await fs.mkdir(profile, {recursive:true}); sourceBefore = await fingerprint(); packagedBefore = await packagedIdentity();
    appReport.sourceSHA256 = sourceBefore; appReport.packagedBefore = packagedBefore;
    const drawingFactory=(await import(pathToFileURL(path.join(root,'tests/rotated-annotation-fixture.mjs')))).syntheticRotatedAnnotationDrawing;
    const {createEditor}=await import(pathToFileURL(path.join(root,'core.mjs')));
    const text=createEditor(drawingFactory()).serialize();
    await fs.writeFile(input,text,{flag:'wx'}); inputSHA256=sha(await fs.readFile(input));
    const args = [`--user-data-dir=${profile}`, `--linecraft-control-file=${connection}`];
    if (entry) args.unshift(path.resolve(entry), '--linecraft-no-watch');
    app = await playwright._electron.launch(visibility.prepareLaunch({executablePath:executable,args,timeout:30000}));
    watchdog = setTimeout(() => {
      timedOut=true;
      appReport.error = 'Owned hidden application exceeded its 120-second budget.';
      try { spawnSync('taskkill', ['/PID',String(app.process().pid),'/T','/F'], {windowsHide:true,stdio:'ignore',timeout:10000}); } catch {}
    }, 120000);
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await page.waitForFunction(() => window.linecraft?.scripting && window.linecraftDesktop);
    await visibility.recordVisibility(app, appReport);
    page.on('pageerror', error => appReport.errors.push(String(error)));
    page.on('request', request => { if (/^https?:/.test(request.url())) appReport.network.push(request.url()); });
    appReport.runtime = await app.evaluate(({app,BrowserWindow,dialog,clipboard}) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1280,900);
      globalThis.__rotatedAnnotationQA = {open:'',save:'',openCalls:0,saveCalls:0,clipboardCalls:0};
      dialog.showOpenDialog = async () => { globalThis.__rotatedAnnotationQA.openCalls++; return {canceled:false,filePaths:[globalThis.__rotatedAnnotationQA.open]}; };
      dialog.showSaveDialog = async () => { globalThis.__rotatedAnnotationQA.saveCalls++; return {canceled:false,filePath:globalThis.__rotatedAnnotationQA.save}; };
      dialog.showMessageBox = async () => ({response:1});
      for (const key of ['read','write','readText','writeText','readImage','writeImage','readHTML','readRTF']) if (typeof clipboard[key] === 'function') clipboard[key] = () => { globalThis.__rotatedAnnotationQA.clipboardCalls++; throw Error('OS clipboard forbidden in synthetic QA.'); };
      return {version:app.getVersion(),electron:process.versions.electron,packaged:app.isPackaged};
    });
    assert.equal(appReport.runtime.electron, metadata.devDependencies.electron); assert.equal(appReport.runtime.packaged, !entry);
    if (!entry) assert.equal(appReport.runtime.version, manifest.version);
    await page.setViewportSize({width:1280,height:900});
    for (let index=0; index<150 && !sync.existsSync(connection); index++) await new Promise(resolve => setTimeout(resolve,20));
    assert.ok(sync.existsSync(connection), 'Owned controller descriptor was not created.');
    let accepted;
    await check('actual Open retains the literal synthetic two-sheet document and locked independent scales',async()=>{
      await cli({version:1,method:'describe'}); await open(input); accepted=await doc(); assertFixture(accepted);
      assert.deepEqual(accepted,JSON.parse(await fs.readFile(input,'utf8'))); assert.deepEqual((await snapshot()).document,accepted);
    });
    await check('actual Save As New Open preserves complete state and stored B A tab order',async()=>{
      assert.ok(!sync.existsSync(native)); await app.evaluate((_,file)=>globalThis.__rotatedAnnotationQA.save=file,native);
      assert.equal(await action('save-as'),true); assert.deepEqual(JSON.parse(await fs.readFile(native,'utf8')),accepted);
      assert.equal(await action('new'),true); await open(native); assert.deepEqual(await doc(),accepted); assertFixture(await doc());
    });
    await check('actual ordered multi-sheet PDF uses A B without changing drawing tabs saved bytes or live state',async()=>{
      const savedSHA=sha(await fs.readFile(native)); assert.ok(!sync.existsSync(pdf)); await app.evaluate((_,file)=>globalThis.__rotatedAnnotationQA.save=file,pdf);
      assert.equal(await action('plot'),true); await page.locator('#plot-space').selectOption('layouts');
      assert.deepEqual(await page.evaluate(()=>window.linecraft.getPlotState().orderedLayoutIds),['sheet-b','sheet-a']);
      await page.locator('#plot-layout-order [data-layout-id="sheet-a"] [data-plot-layout-action="up"]').click();
      await page.locator('#plot-color').selectOption('monochrome'); await page.locator('#plot-lineweights').check();
      await page.waitForFunction(()=>!document.getElementById('plot-submit').disabled);
      const plotted=await page.evaluate(()=>window.linecraft.getPlotState()); assert.deepEqual(plotted.orderedLayoutIds,['sheet-a','sheet-b']); assert.deepEqual(plotted.previewSheets.map(s=>s.layoutId),['sheet-a','sheet-b']);
      await page.locator('#plot-submit').click(); await page.waitForFunction(()=>!window.linecraft.get3DState().documentActionBusy);
      assert.equal(await page.locator('#plot-error').textContent(),''); await page.locator('#plot-cancel').click();
      assert.deepEqual(await doc(),accepted); assert.equal(sha(await fs.readFile(native)),savedSHA);
      const bytes=await fs.readFile(pdf); assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
      appReport.outputs={input,native,pdf,inputSHA256,nativeSHA256:savedSHA,pdfSHA256:sha(bytes)};
      return{storedLayoutOrder:['sheet-b','sheet-a'],requestedPDFOrder:['sheet-a','sheet-b'],completeLiveAndSavedStateUnchanged:true};
    });
    await check('isolated workflow stays offline clipboard-free and bound to unchanged input and source',async()=>{
      assert.deepEqual(appReport.errors,[]); assert.deepEqual(appReport.network,[]);
      appReport.chooserCalls=await app.evaluate(()=>({open:globalThis.__rotatedAnnotationQA.openCalls,save:globalThis.__rotatedAnnotationQA.saveCalls,clipboard:globalThis.__rotatedAnnotationQA.clipboardCalls}));
      assert.deepEqual(appReport.chooserCalls,{open:2,save:2,clipboard:0}); await visibility.verifyVisibility(app,appReport);
      assert.deepEqual(await fingerprint(),sourceBefore); assert.deepEqual(await packagedIdentity(),packagedBefore); assert.equal(sha(await fs.readFile(input)),inputSHA256);
    });
    appReport.status='passed';
  } catch (error) { appReport.status='failed'; appReport.error=error.stack || String(error); }
  finally {
    if (app) { await visibility.finalizeVisibility(app,appReport); await app.evaluate(({app})=>app.quit()).catch(()=>{}); await app.close().catch(()=>{}); }
    clearTimeout(watchdog);
    try {
      assert.equal(sync.existsSync(connection),false,'Owned control descriptor survived normal quit.');
      if (sourceBefore) assert.deepEqual(await fingerprint(),sourceBefore);
      if (inputSHA256) assert.equal(sha(await fs.readFile(input)),inputSHA256);
      if (sourceBefore) assert.deepEqual(await packagedIdentity(),packagedBefore);
      appReport.sourceUnchanged=Boolean(sourceBefore); appReport.inputUnchanged=Boolean(inputSHA256); appReport.descriptorRemoved=true;
    } catch (error) { appReport.status='failed'; appReport.preservationError=error.stack || String(error); }
    if (timedOut || appReport.tests.some(test=>test.status==='failed')) appReport.status='failed';
    appReport.total=appReport.tests.length; appReport.passed=appReport.tests.filter(test=>test.status==='passed').length;
    appReport.completedAt=new Date().toISOString();
    if (sync.existsSync(run)) await fs.writeFile(producerFile,JSON.stringify(appReport,null,2)+'\n',{flag:'wx'});
  }
}
(async()=>{
  try {
    await application(); assert.equal(appReport.status,'passed',appReport.error || appReport.preservationError);
    assert.equal(appReport.total,4); assert.equal(appReport.passed,4); report.application={file:producerFile,sha256:sha(await fs.readFile(producerFile)),passed:4};
    report.sourceSHA256=sourceBefore; report.sourceUnchanged=appReport.sourceUnchanged; report.inputUnchanged=appReport.inputUnchanged;
    const receipt=path.join(run,'pdf-audit.json'),render=path.join(run,'renders');
    const python=process.env.CAD_PYTHON || path.join(root,'.venv/Scripts/python.exe');
    const result=spawnSync(python,[path.join(root,'tests/audit-rotated-annotation-pdf.py'),'--producer',producerFile,'--receipt',receipt,'--render-directory',render,'--profile',paperProfile],
      {cwd:root,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});
    await fs.writeFile(path.join(run,'pdf-audit.log'),(result.stdout || '')+(result.stderr || ''),{flag:'wx'});
    assert.equal(result.status,0,result.error?.message || result.stderr || result.stdout);
    const audit=JSON.parse(await fs.readFile(receipt,'utf8')); assert.equal(audit.status,'passed');
    assert.equal(audit.paperProfile,paperProfile); assert.equal(audit.measurements.length,42); assert.equal(audit.negativeControls.length,28); assert.ok(audit.negativeControls.every(row=>row.rejected));
    report.pdfAudit={status:audit.status,file:receipt,sha256:sha(await fs.readFile(receipt)),render,measurements:audit.measurements,negativeControls:audit.negativeControls};
    assert.deepEqual(await fingerprint(),sourceBefore); report.status='passed';
  } catch (error) { report.status='failed'; report.error=error.stack || String(error); process.exitCode=1; }
  finally {
    report.completedAt=new Date().toISOString();
    if (sync.existsSync(run)) await fs.writeFile(path.join(run,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    await fs.writeFile(path.join(__dirname,prefix+'-rotated-annotation-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({status:report.status,appChecks:appReport.passed,pdfMeasurements:report.pdfAudit?.measurements.length || 0}));
    if (report.error) console.error(report.error);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
