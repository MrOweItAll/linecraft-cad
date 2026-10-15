'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const playwright=require('playwright');

async function main() {
  const executable = process.argv[2];
  if (!executable) throw new Error('Usage: node tests/dev-validator.cjs electron.exe');
  const root = path.resolve(__dirname, '..'), workspace = path.basename(path.dirname(root)) === 'outputs' ? path.dirname(path.dirname(root)) : root;
  const folder = path.join(workspace, 'work', 'validator-tests', `run-${Date.now()}`), source = path.join(folder, 'source');
  await fs.mkdir(source, {recursive: true});
  // Never modify the shared source during the main-process module-cache experiment.
  for (const name of ['index.html', 'app.mjs', 'core.mjs', 'units.mjs', 'paper-space.mjs', 'drawing-plane.mjs', 'viewport-scales.mjs', 'advanced-geometry.mjs', '3d-view.mjs', 'dwg-import.mjs', 'plot-document.mjs', 'styles.css', 'favicon.svg', 'LICENSE']) await fs.copyFile(path.join(root, name), path.join(source, name));
  await fs.cp(path.join(root,'architecture'),path.join(source,'architecture'),{recursive:true});
  await fs.cp(path.join(root, 'desktop'), path.join(source, 'desktop'), {recursive: true});
  const sourceSHA256=Object.fromEntries(await Promise.all(['index.html','app.mjs','core.mjs','units.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs','advanced-geometry.mjs','3d-view.mjs','dwg-import.mjs','plot-document.mjs','desktop/main.cjs','desktop/preload.cjs','desktop/dev-watch.cjs'].map(async name=>[name,createHash('sha256').update(await fs.readFile(path.join(source,name))).digest('hex')])));
  const corePath = path.join(source, 'core.mjs'), core = await fs.readFile(corePath, 'utf8');
  const probe = version => `${core}\nif(typeof process!=='undefined'&&process.versions?.electron)globalThis.__linecraftValidatorProbe=${version};\n`;
  await fs.writeFile(corePath, probe(1));
  const saved = path.join(folder, 'validator-saved.linecraft');
  const report = {framework: 'Actual isolated source Electron main-process validator refresh', installationUsed: false, executable, source, sourceSHA256, startedAt: new Date().toISOString(), scope: 'An independent source copy receives harmless core, units, paper, plane and viewport-scale module-load probes. Hashes describe the copied source before those isolated edits. Real Save/Open IPC and real filesystem writes run; only native file chooser destinations are stubbed.', tests: [], errors: []};
  let app, page;
  const check = async (name, fn) => {
    const begun = Date.now();
    try {await fn(); report.tests.push({name, status: 'passed', durationMs: Date.now() - begun}); console.log(`PASS ${name}`);}
    catch(error) {report.tests.push({name, status: 'failed', durationMs: Date.now() - begun, error: error.stack || String(error)}); console.log(`FAIL ${name}: ${error.message}`); throw error;}
  };
  try {
    app = await playwright._electron.launch(require('./electron-test-options.cjs').prepareLaunch({executablePath: path.resolve(executable), args: [path.join(source, 'desktop/main.cjs'), `--user-data-dir=${path.join(folder, 'profile')}`], timeout: 30000}));
    page = await app.firstWindow();await require('./electron-test-options.cjs').recordVisibility(app,report); page.setDefaultTimeout(5000);
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.waitForFunction(() => window.linecraft?.getDevelopmentState && window.linecraftDesktop);
    await app.evaluate(({dialog}, file) => {dialog.showSaveDialog = async () => ({canceled: false, filePath: file}); dialog.showOpenDialog = async () => ({canceled: false, filePaths: [file]}); dialog.showMessageBox = async () => ({response: 1});}, saved);
    await check('live main Save validates with the initial core and writes a real drawing file', async () => {
      for (const input of ['C', '0,0', '10']) {await page.locator('#command-input').fill(input); await page.locator('#command-input').press('Enter');}
      assert.equal(await page.evaluate(() => window.linecraft.runAction('save')), true);
      assert.equal(await app.evaluate(() => globalThis.__linecraftValidatorProbe), 1);
      assert.equal(JSON.parse(await fs.readFile(saved, 'utf8')).entities[0].radius, 10);
    });
    await check('real core source edit reloads the renderer and refreshes main validation without restarting Electron', async () => {
      const pid = app.process().pid, navigation = page.waitForEvent('framenavigated', {predicate: frame => frame === page.mainFrame(), timeout: 10000});
      await fs.writeFile(corePath, probe(2)); await navigation; await page.waitForFunction(() => window.linecraft?.getDevelopmentState().restored === true);
      assert.equal((await page.evaluate(() => window.linecraft.getDocumentState())).dirty, false);
      assert.equal(await page.evaluate(() => window.linecraft.runAction('save')), true);
      assert.equal(await app.evaluate(() => globalThis.__linecraftValidatorProbe), 2);
      assert.equal(app.process().pid, pid);
      assert.equal(await page.evaluate(() => window.linecraft.runAction('open')), true);
      assert.equal(await app.evaluate(() => globalThis.__linecraftValidatorProbe), 2);
      assert.deepEqual(report.errors, []);
    });
    await check('an already loaded PDF graph explicitly requires restart after a core edit while fresh Save validation still works', async () => {
      // No PDF renderer is stubbed: this also executes a real hidden printToPDF
      // once. Only the native chooser destination is the existing owned stub.
      const document=await page.evaluate(()=>window.linecraft.getDocumentState().text),first=await page.evaluate(text=>window.linecraftDesktop.plotPDF({text}),document);assert.equal(first.ok,true,first.error);assert.match(first.name,/\.pdf$/);
      const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:10000});await fs.writeFile(corePath,probe(3));await navigation;await page.waitForFunction(()=>window.linecraft?.getDevelopmentState().restored===true);
      const before=await page.evaluate(()=>window.linecraft.getDocumentState()),rejected=await page.evaluate(text=>window.linecraftDesktop.plotPDF({text}),before.text);assert.equal(rejected.ok,false);assert.match(rejected.error,/dependency changed.*Restart/i);assert.equal((await page.evaluate(()=>window.linecraft.getDocumentState())).text,before.text);assert.equal(await page.evaluate(()=>window.linecraft.runAction('save')),true);assert.equal(await app.evaluate(()=>globalThis.__linecraftValidatorProbe),3);
    });
    await check('a units helper edit rejects stale native validation and an explicit hidden restart loads the fresh parser', async () => {
      const unitsPath=path.join(source,'units.mjs'),units=await fs.readFile(unitsPath,'utf8'),before=await page.evaluate(()=>window.linecraft.getDocumentState());
      const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:10000});
      await fs.writeFile(unitsPath,`${units}\nif(typeof process!=='undefined'&&process.versions?.electron)globalThis.__linecraftUnitsValidatorProbe=15;\n`);
      await navigation;await page.waitForFunction(()=>window.linecraft?.getDevelopmentState().restored===true);
      const savedBefore=await fs.readFile(saved,'utf8'),rejected=await page.evaluate(text=>window.linecraftDesktop.saveDrawing(text,false),before.text);
      assert.equal(rejected.ok,false);assert.match(rejected.error,/units helper changed.*Restart/i);assert.equal(await fs.readFile(saved,'utf8'),savedBefore);
      assert.equal((await page.evaluate(()=>window.linecraft.getDocumentState())).text,before.text);
      await require('./electron-test-options.cjs').verifyVisibility(app,report);report.firstProcessVisibility=report.finalWindowVisibility;
      await app.evaluate(({app,session})=>{session.defaultSession.flushStorageData();app.exit(0);});await app.close().catch(()=>{});app=null;
      app=await playwright._electron.launch(require('./electron-test-options.cjs').prepareLaunch({executablePath:path.resolve(executable),args:[path.join(source,'desktop/main.cjs'),`--user-data-dir=${path.join(folder,'profile')}`],timeout:30000}));
      page=await app.firstWindow();await require('./electron-test-options.cjs').recordVisibility(app,report);page.setDefaultTimeout(5000);page.on('pageerror',error=>report.errors.push(String(error)));
      await page.waitForFunction(()=>window.linecraft?.getDevelopmentState().restored===true);
      await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});dialog.showMessageBox=async()=>({response:1});},saved);
      const restored=await page.evaluate(()=>window.linecraft.getDocumentState());assert.equal(restored.text,before.text);assert.equal(restored.dirty,before.dirty);
      assert.equal(await page.evaluate(()=>window.linecraft.runAction('save')),true);assert.equal(await app.evaluate(()=>globalThis.__linecraftUnitsValidatorProbe),15);assert.equal(await fs.readFile(saved,'utf8'),savedBefore);
      report.explicitHiddenRestartVerified=true;
    });
    for(const [helper,probeKey] of [['paper-space.mjs','__linecraftPaperValidatorProbe'],['drawing-plane.mjs','__linecraftPlaneValidatorProbe'],['viewport-scales.mjs','__linecraftViewportScaleValidatorProbe'],['architecture/model.mjs','__linecraftArchitectureValidatorProbe']]){
      await check(`a ${helper} edit rejects stale native validation and explicit hidden restart preserves the drawing`,async()=>{
        if(helper.startsWith('architecture/')){await page.evaluate(()=>{const e=window.linecraft.editor;for(const r of[e.updateDrawingSettings({units:'in'}),e.applyArchitecture({type:'addWalls',points:[{x:0,y:0},{x:120,y:0},{x:120,y:96},{x:0,y:96}],closed:true,thickness:6,referenceFace:'right',bearingElevation:96}),e.applyArchitecture({type:'addRoof',overhang:12})])if(!r.ok)throw Error(r.message);});assert.equal(await page.evaluate(()=>window.linecraft.runAction('save')),true);assert.equal(JSON.parse((await page.evaluate(()=>window.linecraft.getDocumentState())).text).format,'Linecraft/2');}
        const helperPath=path.join(source,helper),initial=await fs.readFile(helperPath,'utf8'),before=await page.evaluate(()=>window.linecraft.getDocumentState()),savedBefore=await fs.readFile(saved,'utf8');
        const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:10000});
        await fs.writeFile(helperPath,`${initial}\nif(typeof process!=='undefined'&&process.versions?.electron)globalThis.${probeKey}=16;\n`);
        await navigation;await page.waitForFunction(()=>window.linecraft?.getDevelopmentState().restored===true);
        const rejected=await page.evaluate(text=>window.linecraftDesktop.saveDrawing(text,false),before.text);assert.equal(rejected.ok,false);assert.match(rejected.error,/helper changed.*Restart/i);assert.equal(await fs.readFile(saved,'utf8'),savedBefore);assert.deepEqual(await page.evaluate(()=>window.linecraft.getDocumentState()),before);
        await require('./electron-test-options.cjs').verifyVisibility(app,report);await app.evaluate(({app,session})=>{session.defaultSession.flushStorageData();app.exit(0);});await app.close().catch(()=>{});app=null;
        app=await playwright._electron.launch(require('./electron-test-options.cjs').prepareLaunch({executablePath:path.resolve(executable),args:[path.join(source,'desktop/main.cjs'),`--user-data-dir=${path.join(folder,'profile')}`],timeout:30000}));page=await app.firstWindow();await require('./electron-test-options.cjs').recordVisibility(app,report);page.setDefaultTimeout(5000);page.on('pageerror',error=>report.errors.push(String(error)));await page.waitForFunction(()=>window.linecraft?.getDevelopmentState().restored===true);
        await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});dialog.showMessageBox=async()=>({response:1});},saved);
        assert.deepEqual(await page.evaluate(()=>window.linecraft.getDocumentState()),before);assert.equal(await page.evaluate(()=>window.linecraft.runAction('save')),true);assert.equal(await app.evaluate((_electron,key)=>globalThis[key],probeKey),16);assert.equal(await fs.readFile(saved,'utf8'),savedBefore);
      });
    }
  } catch(error) {if (!report.tests.some(test => test.status === 'failed')) report.tests.push({name: 'development validator initialization', status: 'failed', error: error.stack || String(error)});}
  finally {
    if (app) {await require('./electron-test-options.cjs').finalizeVisibility(app,report);await app.evaluate(({app, session}) => {session.defaultSession.flushStorageData(); app.exit(0);}).catch(() => {}); await app.close().catch(() => {});}
    report.completedAt = new Date().toISOString(); report.total = report.tests.length; report.passed = report.tests.filter(test => test.status === 'passed').length; report.failed = report.total - report.passed;
    await fs.writeFile(path.join(__dirname, 'dev-validator-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.passed}/${report.total} passed; tests/dev-validator-results.json`); process.exitCode = report.failed ? 1 : 0;
  }
}
main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
