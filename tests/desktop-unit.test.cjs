'use strict';
// Supplemental contract tests: mocked Electron shell, real filesystem and drawing validation.
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const workspaceRoot = path.basename(path.dirname(root)) === 'outputs' ? path.dirname(path.dirname(root)) : root;
const work = path.join(workspaceRoot, 'work', 'desktop-security-files');
const handlers = new Map(), events = new Map(), requests = {};
const openChoices = [], saveChoices = [];
let openDialogs = 0, saveDialogs = 0, windowInstance;
const fakeApp = new EventEmitter();
Object.assign(fakeApp, { isPackaged: true, whenReady: async () => {}, getVersion: () => '1.0.0', setPath: () => {}, quit: () => {} });
class FakeWindow extends EventEmitter {
  constructor(options) {
    super(); this.options = options; this.destroyed = false; this.messages = []; windowInstance = this;
    this.webContents = new EventEmitter();
    Object.assign(this.webContents, {
      mainFrame: { url: pathToFileURL(path.join(root, 'index.html')).href },
      send: (channel, action) => this.messages.push({ channel, action }),
      setWindowOpenHandler: callback => { this.popupHandler = callback; }, closeDevTools: () => {},
    });
  }
  isDestroyed() { return this.destroyed; }
  setTitle(value) { this.title = value; }
  show() {}
  async loadFile() {}
  close() {
    let prevented = false;
    this.emit('close', { preventDefault: () => { prevented = true; } });
    if (!prevented) { this.destroyed = true; this.emit('closed'); }
  }
}
const fakeElectron = {
  app: fakeApp, BrowserWindow: FakeWindow,
  Menu: { buildFromTemplate: value => value, setApplicationMenu: value => { requests.menu = value; } },
  dialog: {
    showOpenDialog: async () => { openDialogs++; return openChoices.shift() ?? { canceled: true }; },
    showSaveDialog: async () => { saveDialogs++; return saveChoices.shift() ?? { canceled: true }; },
    showMessageBox: async () => ({ response: 2 }), showErrorBox: () => {},
  },
  ipcMain: { handle: (channel, callback) => handlers.set(channel, callback), on: (channel, callback) => events.set(channel, callback) },
  session: { defaultSession: {
    setPermissionRequestHandler: callback => { requests.permission = callback; },
    setPermissionCheckHandler: callback => { requests.permissionCheck = callback; },
    webRequest: {
      onBeforeRequest: (_filter, callback) => { requests.request = callback; },
      onHeadersReceived: callback => { requests.headers = callback; },
    },
  } },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) { return request === 'electron' ? fakeElectron : originalLoad.call(this, request, parent, isMain); };
require(path.join(root, 'desktop/main.cjs'));
Module._load = originalLoad;

async function main() {
  await new Promise(resolve => setImmediate(resolve));
  await fs.mkdir(work, { recursive: true });
  const event = { sender: windowInstance.webContents, senderFrame: windowInstance.webContents.mainFrame };
  const invoke = (channel, ...args) => handlers.get(channel)(event, ...args);
  const { createEditor } = await import(pathToFileURL(path.join(root, 'core.mjs')).href);
  const editor = createEditor();
  for (const command of ['L', '0,0', '10,0', '']) editor.execute(command);
  const initialText = editor.serialize();
  const validPath = path.join(work, 'associated.linecraft');
  const invalidPath = path.join(work, 'malformed.json');
  await fs.writeFile(validPath, initialText);
  await fs.writeFile(invalidPath, '{"broken":');
  const results = [];
  const check = async (name, action) => {
    const start = performance.now();
    try { await action(); results.push({ name, status: 'PASS', durationMs: +(performance.now() - start).toFixed(3) }); }
    catch (error) { results.push({ name, status: 'FAIL', error: error.message }); }
  };

  await check('production window uses isolation, sandbox, no Node and no developer tools', () => {
    const options = windowInstance.options.webPreferences;
    assert.equal(options.contextIsolation, true); assert.equal(options.sandbox, true);
    assert.equal(options.nodeIntegration, false); assert.equal(options.devTools, false);
    assert.deepEqual(windowInstance.popupHandler({ url: 'https://example.com/' }), { action: 'deny' });
  });
  await check('spoofed sender and child frame cannot invoke filesystem channels', async () => {
    const before = openDialogs;
    assert.equal((await handlers.get('linecraft:open')({ sender: {}, senderFrame: event.senderFrame })).ok, false);
    assert.equal((await handlers.get('linecraft:open')({ sender: event.sender, senderFrame: { url: event.senderFrame.url } })).ok, false);
    assert.equal(openDialogs, before);
    assert.equal(await handlers.get('linecraft:confirm-discard')({ sender: {}, senderFrame: event.senderFrame }, 'name'), 'cancel');
  });
  await check('remote requests and file traversal blocked; bundled files and data allowed', () => {
    const decision = url => { let value; requests.request({ url }, outcome => { value = outcome; }); return value; };
    assert.deepEqual(decision('https://example.com/private'), { cancel: true });
    assert.deepEqual(decision('http://127.0.0.1:8999/'), { cancel: true });
    assert.deepEqual(decision(pathToFileURL(path.resolve(root, '..', 'owned-outside.js')).href), { cancel: true });
    assert.deepEqual(decision(pathToFileURL(path.join(root, 'app.mjs')).href), { cancel: false });
    assert.deepEqual(decision('data:image/svg+xml,small'), { cancel: false });
    assert.equal(requests.permissionCheck(), false);
    let permitted = true; requests.permission({}, 'media', value => { permitted = value; }); assert.equal(permitted, false);
  });
  await check('CSP denies network connections, injected object/frame content and eval', () => {
    let response;
    requests.headers({ responseHeaders: { 'Content-Security-Policy': ['bad'] } }, value => { response = value; });
    const policy = response.responseHeaders['Content-Security-Policy'][0];
    assert.ok(policy.includes("connect-src 'none'")); assert.ok(policy.includes("object-src 'none'"));
    assert.ok(policy.includes("frame-src 'none'")); assert.ok(!policy.includes('unsafe-eval'));
  });
  await check('native keyboard routes shortcuts once, consuming repeats and preserving ordinary keys', () => {
    const press = input => {
      let prevented = false;
      windowInstance.webContents.emit('before-input-event', { preventDefault: () => { prevented = true; } }, { type: 'keyDown', control: true, meta: false, alt: false, shift: false, isAutoRepeat: false, ...input });
      return prevented;
    };
    const before = windowInstance.messages.length;
    for (const [key, shift, expected] of [['n', false, 'new'], ['O', false, 'open'], ['s', false, 'save'], ['s', true, 'save-as'], ['z', false, 'undo'], ['z', true, 'redo'], ['y', false, 'redo'], ['0', false, 'fit']]) {
      const count = windowInstance.messages.length;
      assert.equal(press({ key, shift }), true);
      assert.equal(windowInstance.messages.length, count + 1);
      assert.equal(windowInstance.messages.at(-1).action, expected);
    }
    assert.equal(press({ key: 'o', control: false, meta: true }), true);
    assert.equal(windowInstance.messages.at(-1).action, 'open');
    const after = windowInstance.messages.length;
    assert.equal(after, before + 9);
    assert.equal(press({ key: 'o', isAutoRepeat: true }), true);
    for (const input of [{ key: 'o', alt: true }, { key: 'o', control: false }, { key: 'o', type: 'keyUp' }, { key: 'k' }]) assert.equal(press(input), false);
    assert.equal(windowInstance.messages.length, after);
  });
  await check('failed Open leaves associated save path intact', async () => {
    openChoices.push({ canceled: false, filePaths: [validPath] });
    assert.equal((await invoke('linecraft:open')).ok, true);
    openChoices.push({ canceled: false, filePaths: [invalidPath] });
    assert.equal((await invoke('linecraft:open')).ok, false);
    const count = saveDialogs;
    assert.equal((await invoke('linecraft:save', initialText, false)).ok, true);
    assert.equal(saveDialogs, count);
    assert.equal(await fs.readFile(invalidPath, 'utf8'), '{"broken":');
    assert.equal(await fs.readFile(validPath, 'utf8'), initialText);
  });
  await check('canceled Save As preserves prior path and original file', async () => {
    saveChoices.push({ canceled: true });
    const response = await invoke('linecraft:save', initialText, true);
    assert.equal(response.canceled, true);
    const count = saveDialogs;
    assert.equal((await invoke('linecraft:save', initialText, false)).ok, true);
    assert.equal(saveDialogs, count);
    assert.equal(await fs.readFile(validPath, 'utf8'), initialText);
  });
  await check('invalid or oversized save text rejected before dialog and leaves files intact', async () => {
    const count = saveDialogs;
    assert.equal((await invoke('linecraft:save', '{}not-json', true)).ok, false);
    const response = await invoke('linecraft:save', 'x'.repeat(25 * 1024 * 1024 + 1), true);
    assert.equal(response.ok, false); assert.match(response.error, /25 MiB/); assert.equal(saveDialogs, count);
    assert.equal(await fs.readFile(validPath, 'utf8'), initialText);
  });
  await check('atomic overwrite replaces exact contents and removes only owned temporary file', async () => {
    const marker = path.join(work, 'unrelated.tmp'); await fs.writeFile(marker, 'preserve');
    editor.execute('REC'); editor.execute('20,20'); editor.execute('30,40');
    const changed = editor.serialize();
    assert.equal((await invoke('linecraft:save', changed, false)).ok, true);
    assert.equal(await fs.readFile(validPath, 'utf8'), changed);
    assert.equal(await fs.readFile(marker, 'utf8'), 'preserve');
    assert.deepEqual((await fs.readdir(work)).filter(name => name.startsWith('.associated.linecraft.')), []);
  });
  await check('failed Save As cleans its temporary sibling and retains prior association', async () => {
    const impossible = path.join(work, 'directory-target.linecraft'); await fs.mkdir(impossible, { recursive: true });
    saveChoices.push({ canceled: false, filePath: impossible });
    assert.equal((await invoke('linecraft:save', initialText, true)).ok, false);
    assert.deepEqual((await fs.readdir(work)).filter(name => name.startsWith('.directory-target.linecraft.')), []);
    const count = saveDialogs;
    assert.equal((await invoke('linecraft:save', initialText, false)).ok, true); assert.equal(saveDialogs, count);
    assert.equal((await fs.stat(impossible)).isDirectory(), true);
  });
  await check('close remains guarded after repeated attempts until trusted allowClose', () => {
    windowInstance.close(); windowInstance.close(); assert.equal(windowInstance.destroyed, false);
    assert.equal(windowInstance.messages.filter(value => value.action === 'close').length, 2);
    events.get('linecraft:allow-close')({ sender: {}, senderFrame: event.senderFrame }); assert.equal(windowInstance.destroyed, false);
    events.get('linecraft:allow-close')(event); assert.equal(windowInstance.destroyed, true);
  });
  const report = { kind: 'Supplemental contract test: mocked Electron shell with real filesystem and core validation', executedAt: new Date().toISOString(), results, passed: results.filter(value => value.status === 'PASS').length, failed: results.filter(value => value.status === 'FAIL').length };
  await fs.writeFile(path.join(__dirname, 'desktop-security-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
