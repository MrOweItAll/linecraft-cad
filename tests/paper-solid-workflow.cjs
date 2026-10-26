'use strict';
// Actual hidden source/unpacked import, controller edit, file services and PDF.
const fs = require('node:fs/promises'), sync = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const {createHash, randomUUID} = require('node:crypto');
const {execFile, spawnSync} = require('node:child_process');
const {promisify} = require('node:util'), {pathToFileURL} = require('node:url');
const execute = promisify(execFile), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(__dirname, '..');
const [executableArgument, entry = '', prefix, manifestName] = process.argv.slice(2);
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
assert.ok(executableArgument && /^ordinary-grip-[a-z0-9-]+$/.test(prefix) && manifestName,
  'Usage: node tests/paper-solid-workflow.cjs EXE SOURCE_ENTRY_OR_EMPTY UNIQUE_PREFIX CANDIDATE_MANIFEST');
assert.equal(process.argv.length, 6);
const executable = path.resolve(executableArgument);
const {manifest, manifestFile, candidate} = require('../tools/source-manifest.cjs').loadManifest(manifestName);
assert.equal(candidate, true, 'Use an explicit reviewed candidate manifest.');
const metadata = JSON.parse(sync.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(metadata.version, manifest.version);
assert.equal(metadata.devDependencies.electron, manifest.desktopRuntimePin);
assert.equal(sync.lstatSync(path.join(root, 'node_modules')).isSymbolicLink(), false);
const playwright = require('playwright'), visibility = require('./electron-test-options.cjs');
const run = path.join(root, 'work/paper-solid', prefix + '-' + Date.now() + '-' + randomUUID().slice(0, 8));
const profile = path.join(run, 'profile'), connection = path.join(run, 'control.json');
const input = path.join(run, 'paper-solid-input.dxf'), native = path.join(run, 'paper-solid-accepted.linecraft');
const pdf = path.join(run, 'paper-solid.pdf'), producerFile = path.join(run, 'producer-results.json');
const report = {format:'LinecraftPaperSolidWorkflow/1', status:'running', startedAt:new Date().toISOString(),
  version:manifest.version, manifestFile, run, application:null, pdfAudit:null,
  scope:'Actual hidden source/unpacked application, authenticated controller, owned chooser replies and production PDF. No installed/native human acceptance.'};
const appReport = {format:'LinecraftPaperSolidApplication/1', status:'running', startedAt:new Date().toISOString(),
  source:root, executable, entry:entry || null, version:manifest.version, manifestFile, tests:[], errors:[], network:[], outputs:{},
  scope:'Untouched independently authored DXF imported by actual app; bounded MOVE and history; Save As/New/Open; unchanged imported layout plotted. No viewport or geometry repair.'};
report.tests=appReport.tests;
report.manifestSHA256=sha(sync.readFileSync(path.join(root,manifestFile)));
let app, page, watchdog, sourceBefore, packagedBefore, inputSHA256, timedOut=false;
const context = document => document.layouts[0];
const paperFill = document => context(document).entities.find(entity => entity.type === 'HATCH');
const literalBoundary = [{x:20,y:30},{x:60,y:30},{x:60,y:50},{x:20,y:50}];
const area = points => Math.abs(points.reduce((sum,p,index) => {
  const q = points[(index + 1) % points.length]; return sum + p.x*q.y - q.x*p.y;
}, 0)) / 2;
const inside = (parent, target) => { const relative = path.relative(parent, target); return relative && !relative.startsWith('..') && !path.isAbsolute(relative); };
async function fingerprint() {
  const result = {};
  for (const row of [...manifest.runtimeFiles, ...manifest.extraResources]) {
    const bytes = await fs.readFile(path.join(root, row.file));
    assert.equal(bytes.length, row.bytes, row.file); assert.equal(sha(bytes), row.sha256, row.file); result[row.file] = row.sha256;
  }
  for (const name of [manifestFile, 'PUBLIC-SOURCE.json', 'package.json', 'package-lock.json',
    'tests/paper-solid-fixture.mjs', 'tests/paper-solid-workflow.cjs', 'tests/audit-paper-solid-pdf.py', 'tests/electron-test-options.cjs']) {
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
const mutation = async (method, params = {}) => {
  const before = await snapshot();
  return cli({version:1, method, requestId:randomUUID(), params:{...params, baseToken:before.baseToken}});
};
const check = async (name, fn) => {
  const start = Date.now();
  try { const details = await fn(); appReport.tests.push({name,status:'passed',durationMs:Date.now()-start,...(details ? {details} : {})}); console.log('PASS ' + name); }
  catch (error) { appReport.tests.push({name,status:'failed',durationMs:Date.now()-start,error:error.stack || String(error)}); throw error; }
};
async function open(file) {
  await app.evaluate((_, file) => globalThis.__paperSolidQA.open = file, file);
  assert.equal(await action('open'), true);
  if (await page.locator('#import-dialog').evaluate(element => element.open)) await page.locator('#import-close').click();
}
function assertImported(document) {
  assert.equal(document.settings.units, 'mm'); assert.equal(document.entities.length, 1); assert.equal(document.layouts.length, 1);
  const model = document.entities[0]; assert.equal(model.type, 'LINE');
  assert.deepEqual(model.start, {x:-100,y:-100}); assert.deepEqual(model.end, {x:-90,y:-100});
  assert.equal(model.layer, 'Model sentinel');
  const modelLayer=document.layers.find(layer=>layer.name===model.layer);
  assert.equal(model.lineweight??modelLayer.lineweight, .18); assert.equal(model.color??modelLayer.color,'#000000');
  const layout = context(document); assert.equal(layout.name, 'SYNTHETIC SOLID SHEET');
  assert.equal(layout.paper.widthMm, 420); assert.equal(layout.paper.heightMm, 297);
  assert.equal(layout.entities.length, 2); assert.equal(layout.viewports.length, 0);
  assert.deepEqual(layout.plotSettings.renderOffsetMm, {x:0,y:0});
  assert.equal(layout.plotSettings.sourcePaperUnits, 'mm');
  const fill = paperFill(document); assert.ok(fill, 'Paper SOLID fill was lost or kept as an unsafe spatial entity.');
  assert.equal(fill.layer, 'Fill'); assert.equal(fill.color, '#000000'); assert.equal(fill.lineweight, .35);
  assert.equal(fill.pattern, 'solid'); assert.equal(fill.boundary.type, 'PLINE'); assert.equal(fill.boundary.closed, true);
  assert.deepEqual(fill.boundary.points, literalBoundary); assert.equal(area(fill.boundary.points), 800);
  const line = layout.entities.find(entity => entity.type === 'LINE'); assert.ok(line);
  assert.equal(line.layer, 'Paper sentinel'); const paperLayer=document.layers.find(layer=>layer.name===line.layer);
  assert.equal(line.color??paperLayer.color, '#000000'); assert.equal(line.lineweight??paperLayer.lineweight, .2);
  assert.deepEqual(line.start, {x:10,y:10}); assert.deepEqual(line.end, {x:20,y:10});
  assert.equal(new Set([model.id, fill.id, line.id]).size, 3);
  assert.equal(document.activeSpace, 'paper'); assert.equal(document.activeLayoutId, layout.id); assert.equal(document.activeViewportId, null);
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
    const {paperSolidDXF} = await import(pathToFileURL(path.join(root, 'tests/paper-solid-fixture.mjs')));
    const text = paperSolidDXF(); assert.equal(typeof text, 'string');
    await fs.writeFile(input, text, {flag:'wx'}); inputSHA256 = sha(await fs.readFile(input));
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
      globalThis.__paperSolidQA = {open:'',save:'',openCalls:0,saveCalls:0,clipboardCalls:0};
      dialog.showOpenDialog = async () => { globalThis.__paperSolidQA.openCalls++; return {canceled:false,filePaths:[globalThis.__paperSolidQA.open]}; };
      dialog.showSaveDialog = async () => { globalThis.__paperSolidQA.saveCalls++; return {canceled:false,filePath:globalThis.__paperSolidQA.save}; };
      dialog.showMessageBox = async () => ({response:1});
      for (const key of ['read','write','readText','writeText','readImage','writeImage','readHTML','readRTF']) if (typeof clipboard[key] === 'function') clipboard[key] = () => { globalThis.__paperSolidQA.clipboardCalls++; throw Error('OS clipboard forbidden in synthetic QA.'); };
      return {version:app.getVersion(),electron:process.versions.electron,packaged:app.isPackaged};
    });
    assert.equal(appReport.runtime.electron, metadata.devDependencies.electron); assert.equal(appReport.runtime.packaged, !entry);
    if (!entry) assert.equal(appReport.runtime.version, manifest.version);
    await page.setViewportSize({width:1280,height:900});
    for (let index=0; index<150 && !sync.existsSync(connection); index++) await new Promise(resolve => setTimeout(resolve,20));
    assert.ok(sync.existsSync(connection), 'Owned controller descriptor was not created.');
    let imported, moved, fillId, layoutId;
    await check('untouched synthetic paper SOLID imports through the actual app with literal fill and both sentinels', async () => {
      const described = await cli({version:1,method:'describe'}); assert.equal(described.capabilities.groupedUndo,true);
      await open(input); imported = await doc(); assertImported(imported);
      assert.deepEqual((await snapshot()).document, imported); fillId=paperFill(imported).id; layoutId=context(imported).id;
      assert.equal(sha(await fs.readFile(input)), inputSHA256);
      return {fillId,layoutId,areaMm2:800,importedGeometryRepairedByScript:false,viewportsCreatedOrChanged:false};
    });
    await check('one real-controller MOVE changes only the selected fill by literal displacement5,7', async () => {
      await mutation('apply', {label:'Synthetic paper fill MOVE',steps:[
        {op:'space',space:'paper',layoutId}, {op:'select',ids:[fillId]}, {op:'commands',tokens:['MOVE','0,0','5,7']}
      ]});
      moved=await doc(); const expected=structuredClone(imported), fill=paperFill(expected);
      fill.boundary.points=fill.boundary.points.map(point=>({x:point.x+5,y:point.y+7}));
      fill.origin={x:fill.origin.x+5,y:fill.origin.y+7};
      assert.deepEqual(moved,expected); assert.equal(area(paperFill(moved).boundary.points),800);
    });
    await check('grouped Undo Redo Undo restore the complete imported moved and imported documents', async () => {
      await mutation('undo'); assert.deepEqual(await doc(),imported);
      await mutation('redo'); assert.deepEqual(await doc(),moved);
      await mutation('undo'); assert.deepEqual(await doc(),imported);
    });
    await check('actual Save As New Open retains complete document IDs ownership layout and unchanged fill', async () => {
      assert.ok(!sync.existsSync(native)); await app.evaluate((_,file)=>globalThis.__paperSolidQA.save=file,native);
      assert.equal(await action('save-as'),true); assert.deepEqual(JSON.parse(await fs.readFile(native,'utf8')),imported);
      assert.equal(await action('new'),true); await open(native); assert.deepEqual(await doc(),imported); assertImported(await doc());
    });
    await check('actual PDF plots the imported layout unchanged and preserves saved plus live full state', async () => {
      assert.ok(!sync.existsSync(pdf)); await app.evaluate((_,file)=>globalThis.__paperSolidQA.save=file,pdf);
      assert.equal(await action('plot'),true); await page.locator('#plot-space').selectOption('layout');
      await page.locator('#plot-layout-id').selectOption(layoutId); await page.locator('#plot-color').selectOption('color');
      await page.locator('#plot-lineweights').check(); await page.waitForFunction(()=>!document.getElementById('plot-submit').disabled);
      await page.locator('#plot-submit').click(); await page.waitForFunction(()=>!window.linecraft.get3DState().documentActionBusy);
      assert.equal(await page.locator('#plot-error').textContent(),''); await page.locator('#plot-cancel').click();
      assert.deepEqual(await doc(),imported); assert.deepEqual(JSON.parse(await fs.readFile(native,'utf8')),imported);
      const bytes=await fs.readFile(pdf); assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
      appReport.outputs={input,native,pdf,inputSHA256,nativeSHA256:sha(await fs.readFile(native)),pdfSHA256:sha(bytes)};
    });
    await check('hidden workflow remains offline clipboard-free and bound to unchanged source candidate and input', async () => {
      assert.deepEqual(appReport.errors,[]); assert.deepEqual(appReport.network,[]);
      appReport.chooserCalls=await app.evaluate(()=>({open:globalThis.__paperSolidQA.openCalls,save:globalThis.__paperSolidQA.saveCalls,clipboard:globalThis.__paperSolidQA.clipboardCalls}));
      assert.equal(appReport.chooserCalls.clipboard,0); assert.equal(appReport.chooserCalls.open,2); assert.equal(appReport.chooserCalls.save,2);
      await visibility.verifyVisibility(app,appReport); assert.deepEqual(await fingerprint(),sourceBefore);
      assert.deepEqual(await packagedIdentity(),packagedBefore); assert.equal(sha(await fs.readFile(input)),inputSHA256);
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
    assert.equal(appReport.total,6); assert.equal(appReport.passed,6); report.application={file:producerFile,sha256:sha(await fs.readFile(producerFile)),passed:6};
    report.sourceSHA256=sourceBefore; report.sourceUnchanged=appReport.sourceUnchanged; report.inputUnchanged=appReport.inputUnchanged;
    const receipt=path.join(run,'pdf-audit.json'),render=path.join(run,'paper-solid.png');
    const python=process.env.CAD_PYTHON || path.join(root,'.venv/Scripts/python.exe');
    const result=spawnSync(python,[path.join(root,'tests/audit-paper-solid-pdf.py'),'--producer',producerFile,'--receipt',receipt,'--render',render],
      {cwd:root,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});
    await fs.writeFile(path.join(run,'pdf-audit.log'),(result.stdout || '')+(result.stderr || ''),{flag:'wx'});
    assert.equal(result.status,0,result.error?.message || result.stderr || result.stdout);
    const audit=JSON.parse(await fs.readFile(receipt,'utf8')); assert.equal(audit.status,'passed');
    assert.equal(audit.measurements.length,2); assert.equal(audit.negativeControls.length,7);
    report.pdfAudit={status:audit.status,file:receipt,sha256:sha(await fs.readFile(receipt)),render,measurements:audit.measurements,negativeControls:audit.negativeControls};
    assert.deepEqual(await fingerprint(),sourceBefore); report.status='passed';
  } catch (error) { report.status='failed'; report.error=error.stack || String(error); process.exitCode=1; }
  finally {
    report.completedAt=new Date().toISOString();
    if (sync.existsSync(run)) await fs.writeFile(path.join(run,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    await fs.writeFile(path.join(__dirname,prefix+'-paper-solid-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({status:report.status,appChecks:appReport.passed,pdfMeasurements:report.pdfAudit?.measurements.length || 0}));
    if (report.error) console.error(report.error);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
