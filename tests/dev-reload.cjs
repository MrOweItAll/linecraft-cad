'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const playwright=require('playwright');

async function main() {
  const executable = process.argv[2], entry = process.argv[3];
  if (!executable || !entry) throw new Error('Usage: node tests/dev-reload.cjs "electron.exe" "desktop/main.cjs"');
  const root = path.resolve(__dirname, '..'), workspace = path.basename(path.dirname(root)) === 'outputs' ? path.dirname(path.dirname(root)) : root;
  const folder = path.join(workspace, 'work', 'dev-reload-tests', `run-${Date.now()}`), profile = path.join(folder, 'profile'), savedFile = path.join(folder, 'checkpoint-saved.linecraft');
  await fs.mkdir(folder, {recursive: true});
  const styles = path.join(path.dirname(path.dirname(path.resolve(entry))), 'styles.css'), originalStyleStat = await fs.stat(styles);
  const report = {framework: 'Actual live source Electron file watcher and profile recovery', executable, entry, startedAt: new Date().toISOString(), installationUsed: false, tests: [], errors: [], watcherLogs: []};
  let app, page, navigationCount = 0;
  const launch = async () => {
    app = await playwright._electron.launch(require('./electron-test-options.cjs').prepareLaunch({executablePath: path.resolve(executable), args: [path.resolve(entry), `--user-data-dir=${profile}`]}));
    app.process().stdout?.on('data', data => {for (const line of String(data).split(/\r?\n/)) if (line.includes('[Linecraft dev]')) report.watcherLogs.push(line);});
    page = await app.firstWindow();await require('./electron-test-options.cjs').recordVisibility(app,report);
    page.setDefaultTimeout(5000);
    page.on('framenavigated', frame => {if (frame === page.mainFrame()) navigationCount++;});
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.waitForFunction(() => window.linecraft?.getDevelopmentState && window.linecraftDevelopment === true);
    await app.evaluate(({dialog}) => {dialog.showSaveDialog = async () => ({canceled: true}); dialog.showMessageBox = async () => ({response: 1});});
  };
  const state = () => page.evaluate(() => structuredClone(window.linecraft.editor.state));
  const info = () => page.evaluate(() => window.linecraft.getDocumentState());
  const command = async input => {
    if (await page.locator('#annotation-dialog').evaluate(element => element.open)) {await page.locator('#annotation-content').fill(input); await page.locator('#annotation-apply').click();}
    else {if (input) await page.locator('#command-input').fill(input); await page.locator('#command-input').press('Enter');}
  };
  const sequence = async commands => {for (const input of commands) await command(input);};
  const check = async (name, fn) => {
    const begun = Date.now();
    try {await fn(); report.tests.push({name, status: 'passed', durationMs: Date.now() - begun}); process.stdout.write(`PASS ${name}\n`);}
    catch(error) {report.tests.push({name, status: 'failed', durationMs: Date.now() - begun, error: error.stack || String(error)}); process.stdout.write(`FAIL ${name}: ${error.message}\n`); throw error;}
  };
  const touchAndReload = async () => {
    const navigated = page.waitForEvent('framenavigated', {predicate: frame => frame === page.mainFrame(), timeout: 10000});
    const time = new Date(); await fs.utimes(styles, time, time);
    await navigated; await page.waitForFunction(() => window.linecraft?.getDevelopmentState().restored === true);
  };
  try {
    await launch();
    await check('pinned runtime loads live source with a development-only flag and no installation', async () => {
      assert.equal(await app.evaluate(({app}) => app.isPackaged), false);
      assert.equal(await page.evaluate(() => window.linecraftDevelopment), true);
      assert.equal((await info()).dirty, false);
    });
    await check('actual source-file watcher reload preserves dirty geometry, viewport, and toggles', async () => {
      await sequence(['L', '0,0', '100,0', '@0,50', '', 'REC', '20,10', '@40,20', 'C', '200,50', '25', 'Z', 'E']);
      for (const selector of ['#grid-toggle', '#snap-toggle', '#ortho-toggle']) await page.locator(selector).click();
      const before = await state(); assert.equal(before.entities.length, 4); assert.equal((await info()).dirty, true);
      await touchAndReload();
      const restored = await state(); assert.deepEqual(restored.entities, before.entities); assert.deepEqual(restored.viewport, before.viewport);
      assert.equal((await info()).dirty, true);
      assert.equal(await page.locator('#grid-toggle').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#snap-toggle').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#ortho-toggle').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => window.linecraft.getDevelopmentState().historyReset), true);
      assert.equal(await page.evaluate(() => window.linecraft.editor.canUndo), false);
    });
    await check('reload keeps accepted in-progress LINE segments and ends the active prompt safely', async () => {
      await sequence(['L', '300,0', '310,0']);
      const before = await state(); assert.equal(before.command, 'LINE');
      await touchAndReload();
      assert.deepEqual((await state()).entities, before.entities); assert.equal((await state()).command, null);
      assert.equal(await page.evaluate(() => window.linecraft.getDevelopmentState().activeCommandCanceled), true); assert.equal((await info()).dirty, true);
    });
    await check('saved clean baseline remains clean after constructor normalization and source reload', async () => {
      await app.evaluate(({dialog}, file) => {dialog.showSaveDialog = async () => ({canceled: false, filePath: file});}, savedFile);
      await page.locator('#save-document').click(); await page.waitForFunction(() => !window.linecraft.getDocumentState().dirty);
      const before = await state(), name = (await info()).name;
      await touchAndReload(); assert.deepEqual((await state()).entities, before.entities); assert.equal((await info()).dirty, false); assert.equal((await info()).name, name);
      assert.equal(JSON.parse(await fs.readFile(savedFile, 'utf8')).entities.length, 5);
    });
    await check('source reload waits for a pending native Save As decision without losing dirty edits', async () => {
      await sequence(['L', '400,0', '410,0', '']); const before = await state();
      await app.evaluate(({dialog}) => {dialog.showSaveDialog = () => new Promise(resolve => {globalThis.__finishDevelopmentDialog = resolve;});});
      const pending = page.evaluate(() => window.linecraft.runAction('save-as')).catch(error => {if (!/context|closed/i.test(error.message)) throw error;});
      for (let i = 0; i < 100 && !await app.evaluate(() => Boolean(globalThis.__finishDevelopmentDialog)); i++) await new Promise(resolve => setTimeout(resolve, 10));
      const previousNavigations = navigationCount;
      const navigated = page.waitForEvent('framenavigated', {predicate: frame => frame === page.mainFrame(), timeout: 10000});
      const time = new Date(); await fs.utimes(styles, time, time); await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(navigationCount, previousNavigations, 'reload must remain deferred while the dialog is pending');
      await app.evaluate(() => globalThis.__finishDevelopmentDialog({canceled: true})); await pending; await navigated;
      await page.waitForFunction(() => window.linecraft?.getDevelopmentState().restored);
      assert.deepEqual((await state()).entities, before.entities); assert.equal((await info()).dirty, true);
    });
    await check('controlled source-host restart recovers dirty drawing and native file association', async () => {
      const before = await state(), name = (await info()).name;
      const checkpointTime = Date.now();
      await page.waitForFunction(time => window.linecraft.getDevelopmentState().lastCheckpointTime >= time, checkpointTime - 300);
      const closed = app.waitForEvent('close');
      await app.evaluate(({app, session}) => {session.defaultSession.flushStorageData(); app.exit(0);}).catch(() => {}); await closed; app = null;
      await launch(); assert.deepEqual((await state()).entities, before.entities); assert.deepEqual((await state()).viewport, before.viewport); assert.equal((await info()).name, name); assert.equal((await info()).dirty, true);
      await app.evaluate(({dialog}) => {globalThis.__unexpectedChooserCount = 0; dialog.showSaveDialog = async () => {globalThis.__unexpectedChooserCount++; return {canceled: true};};});
      await page.locator('#save-document').click(); await page.waitForFunction(() => !window.linecraft.getDocumentState().dirty);
      assert.equal(await app.evaluate(() => globalThis.__unexpectedChooserCount), 0);
      assert.deepEqual(JSON.parse(await fs.readFile(savedFile, 'utf8')).entities, (await state()).entities);
    });
    await check('intentional development close clears recovery and associated path before next session', async () => {
      await sequence(['L', '500,0', '520,0', '']);
      const closed = app.waitForEvent('close'); await page.evaluate(() => window.linecraft.runAction('close')).catch(() => {}); await closed; app = null;
      await launch(); assert.equal((await state()).entities.length, 0); assert.equal((await info()).dirty, false);
      assert.equal(await page.evaluate(() => window.linecraft.getDevelopmentState().restored), false);
      let pathRecord = JSON.parse(await fs.readFile(path.join(profile, 'development-document-path.json'), 'utf8'));
      assert.equal(pathRecord.drawingPath, null);
    });
    await check('real renderer reload preserves annotation definitions, named styles, drawing settings and clean baseline', async () => {
      await sequence(['TEXT', '0,0', '5', '0', 'Reload owned annotation', 'DIMLINEAR', '0,0', '30,0', '15,-10']);
      await command('UNITS'); await page.locator('#setting-units').selectOption('mm'); await page.locator('#setting-precision').fill('3'); await page.locator('#setting-text-font').selectOption('Consolas'); await page.locator('#setting-text-height').fill('6'); await page.locator('#settings-apply').click();
      await app.evaluate(({dialog}, file) => {dialog.showSaveDialog = async () => ({canceled: false, filePath: file});}, savedFile);
      await page.locator('#save-document').click(); await page.waitForFunction(() => !window.linecraft.getDocumentState().dirty); const before = await state();
      await touchAndReload(); const restored = await state(); for (const key of ['entities','textStyles','dimStyles','settings','currentTextStyle','currentDimStyle']) assert.deepEqual(restored[key], before[key], key); assert.equal((await info()).dirty, false);
    });
    await check('annotation text draft defers actual watched-file reload until Apply without losing draft or accepted content', async () => {
      await sequence(['TEXTEDIT', (await state()).entities[0].id, '']); await page.waitForFunction(() => document.querySelector('#annotation-dialog').open); await page.locator('#annotation-content').fill('Uncommitted owned reload draft');
      const previousNavigations = navigationCount, before = (await state()).entities;
      const navigated = page.waitForEvent('framenavigated', {predicate: frame => frame === page.mainFrame(), timeout: 10000}); const time = new Date(); await fs.utimes(styles, time, time); await new Promise(resolve => setTimeout(resolve, 350)); assert.equal(navigationCount, previousNavigations); assert.equal(await page.locator('#annotation-content').inputValue(), 'Uncommitted owned reload draft'); assert.deepEqual((await state()).entities, before);
      await page.locator('#annotation-apply').click(); await navigated; await page.waitForFunction(() => window.linecraft?.getDevelopmentState().restored); assert.equal((await state()).entities[0].text, 'Uncommitted owned reload draft'); assert.equal((await info()).dirty, true);
    });
    await check('settings draft defers actual watched-file reload and restores applied settings afterward', async () => {
      await command('UNITS'); await page.locator('#setting-units').selectOption('ft'); const previousNavigations = navigationCount;
      const navigated = page.waitForEvent('framenavigated', {predicate: frame => frame === page.mainFrame(), timeout: 10000}); const time = new Date(); await fs.utimes(styles, time, time); await new Promise(resolve => setTimeout(resolve, 350)); assert.equal(navigationCount, previousNavigations); assert.equal((await state()).settings.units, 'mm');
      await page.locator('#settings-apply').click(); await navigated; await page.waitForFunction(() => window.linecraft?.getDevelopmentState().restored); assert.equal((await state()).settings.units, 'ft'); assert.equal((await info()).dirty, true);
    });
    await check('Architecture input draft defers watched-file reload; closing resumes and preserves semantic source and generated roof',async()=>{
      await page.evaluate(()=>{const e=window.linecraft.editor;for(const r of[e.applyArchitecture({type:'addWalls',points:[{x:0,y:0},{x:20,y:0},{x:20,y:12},{x:0,y:12}],closed:true,thickness:.5,referenceFace:'right',baseElevation:0,bearingElevation:9}),e.applyArchitecture({type:'recognizeRooms'}),e.applyArchitecture({type:'addRoof',overhang:2})])if(!r.ok)throw Error(r.message);});
      await page.locator('#architecture-button').click();await page.locator('#arch-wall-thickness').fill('5 1/2"');const before=await state(),previousNavigations=navigationCount;
      const navigated=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:10000});const time=new Date();await fs.utimes(styles,time,time);await new Promise(resolve=>setTimeout(resolve,350));assert.equal(navigationCount,previousNavigations);assert.equal(await page.locator('#arch-wall-thickness').inputValue(),'5 1/2"');assert.deepEqual((await state()).architecture,before.architecture);
      await page.locator('#architecture-close').click();await navigated;await page.waitForFunction(()=>window.linecraft?.getDevelopmentState().restored);assert.deepEqual((await state()).architecture,before.architecture);assert.deepEqual((await state()).entities,before.entities);assert.equal(await page.evaluate(()=>window.linecraft.runAction('save')),true);const saved=JSON.parse(await fs.readFile(savedFile,'utf8'));assert.equal(saved.format,'Linecraft/2');assert.deepEqual(saved.architecture,before.architecture);assert.ok(saved.entities.every(e=>!e.id.startsWith('@architecture/')));
    });
    await check('development reloads have no script errors or checkpoint restore failures', async () => {
      assert.deepEqual(report.errors, []); const status = await page.evaluate(() => window.linecraft.getDevelopmentState()); assert.equal(status.restoreError, null);
      assert.ok(report.watcherLogs.some(line => line.includes('Reloading renderer')));
    });
    await require('./electron-test-options.cjs').captureScreenshot(app,page,path.join(__dirname, 'dev-reload-final.png'));
  } catch(error) {if (!report.tests.some(test => test.status === 'failed')) report.tests.push({name: 'live development initialization or flow', status: 'failed', error: error.stack || String(error)});}
  finally {
    if (app) {await require('./electron-test-options.cjs').finalizeVisibility(app,report);
      await app.evaluate(({app, session}) => {session.defaultSession.flushStorageData(); app.exit(0);}).catch(() => {});
      await app.close().catch(() => {});
    }
    await fs.utimes(styles, originalStyleStat.atime, originalStyleStat.mtime);
    report.completedAt = new Date().toISOString(); report.total = report.tests.length; report.passed = report.tests.filter(test => test.status === 'passed').length; report.failed = report.total - report.passed;
    await fs.writeFile(path.join(__dirname, 'dev-reload-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`\n${report.passed}/${report.total} passed; report: tests/dev-reload-results.json\n`); process.exitCode = report.failed ? 1 : 0;
  }
}
main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
