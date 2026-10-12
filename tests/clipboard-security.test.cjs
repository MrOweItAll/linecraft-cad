'use strict';
// Mocked Electron shell + real core validation; never touches the user's OS clipboard.
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const Module = require('node:module');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const MIME = 'electron application/osclipboard;format="application/x-linecraft-geometry+json"';
const handlers = new Map(), events = new Map(), calls = {read: 0, write: 0, payloadTypes: [], text: []};
let windowInstance, menu, readItems = [], written = [], rejectWrite = false, silentWrite = false, deferredWrite = null;
const fakeApp = new EventEmitter(); Object.assign(fakeApp, {isPackaged: true, whenReady: async () => {}, quit() {}, getVersion: () => 'test', setPath() {}});
class FakeWindow extends EventEmitter {
  constructor(options) {super(); this.options = options; windowInstance = this; this.messages = []; this.webContents = new EventEmitter(); Object.assign(this.webContents, {mainFrame: {url: pathToFileURL(path.join(root, 'index.html')).href}, send: (channel, action) => this.messages.push({channel, action}), setWindowOpenHandler() {}, closeDevTools() {}}); for (const action of ['copy', 'cut', 'paste', 'selectAll', 'undo', 'redo']) this.webContents[action] = () => calls.text.push(action);}
  isDestroyed() {return false;} setTitle() {} show() {} close() {} async loadFile() {}
}
class FakeClipboardItem {
  constructor(payloads) {this.payloads = payloads; this.types = Object.keys(payloads);}
  async getType(type) {calls.payloadTypes.push(type); const payload = this.payloads[type]; if (typeof payload === 'function') return payload(); return payload instanceof Blob ? payload : new Blob([payload], {type});}
}
const fakeElectron = {
  app: fakeApp, BrowserWindow: FakeWindow, ClipboardItem: FakeClipboardItem,
  clipboard: {
    read: async () => {calls.read++; return readItems;},
    write: async items => {calls.write++; if (deferredWrite) await deferredWrite; if (rejectWrite) throw new Error('Synthetic write failure'); if (silentWrite) return; written = items; readItems = items;},
    readText: () => {throw new Error('Ordinary clipboard text must never be read by geometry IPC.');},
  },
  Menu: {buildFromTemplate: value => value, setApplicationMenu: value => {menu = value;}},
  dialog: {showErrorBox() {}, showMessageBox: async () => ({response: 2})},
  ipcMain: {handle: (channel, callback) => handlers.set(channel, callback), on: (channel, callback) => events.set(channel, callback)},
  session: {defaultSession: {setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, webRequest: {onBeforeRequest() {}, onHeadersReceived() {}}}},
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {return name === 'electron' ? fakeElectron : originalLoad.call(this, name, parent, isMain);};
require(path.join(root, 'desktop/main.cjs')); Module._load = originalLoad;

async function main() {
  await new Promise(resolve => setImmediate(resolve));
  const event = {sender: windowInstance.webContents, senderFrame: windowInstance.webContents.mainFrame};
  const invoke = (channel, ...args) => handlers.get(channel)(event, ...args);
  const {createEditor} = await import(pathToFileURL(path.join(root, 'core.mjs')).href);
  const editor = createEditor(); for (const input of ['C', '10,20', '5', 'ALL']) editor.execute(input); assert.equal(editor.copySelection().ok, true); const payload = editor.getClipboard();
  const report = {framework: 'Mocked Electron clipboard transport and real core validation', executedAt: new Date().toISOString(), osClipboardTouched: false, tests: []};
  const check = async (name, fn) => {const started = performance.now(); try {await fn(); report.tests.push({name, status: 'passed', durationMs: +(performance.now() - started).toFixed(3)}); console.log(`PASS ${name}`);} catch(error) {report.tests.push({name, status: 'failed', error: error.stack || String(error)}); console.log(`FAIL ${name}: ${error.message}`);}};
  await check('spoofed sender/frame cannot read, write, or invoke text actions', async () => {
    const before = {...calls, payloadTypes: [...calls.payloadTypes], text: [...calls.text]};
    for (const forged of [{sender: {}, senderFrame: event.senderFrame}, {sender: event.sender, senderFrame: {url: event.senderFrame.url}}]) for (const [channel, args] of [['linecraft:clipboard-read', []], ['linecraft:clipboard-write', [payload]], ['linecraft:text-edit', ['copy']]]) assert.equal((await handlers.get(channel)(forged, ...args)).ok, false);
    assert.deepEqual(calls, before);
  });
  await check('geometry write authors exactly two fixed MIME representations in one transaction', async () => {
    const before = calls.write; assert.equal((await invoke('linecraft:clipboard-write', payload)).ok, true); assert.equal(calls.write, before + 1); assert.equal(written.length, 1);
    assert.deepEqual(written[0].types.sort(), [MIME, 'text/plain'].sort());
    const json = written[0].payloads[MIME]; assert.equal(typeof json, 'string'); assert.equal(json, written[0].payloads['text/plain']); assert.deepEqual(JSON.parse(json), payload);
  });
  await check('geometry read retrieves only the dedicated MIME, leaving ordinary payloads unfetched', async () => {
    calls.payloadTypes = []; const trap = () => {throw new Error('An unrelated synthetic payload was fetched.');};
    readItems = [new FakeClipboardItem({'text/plain': trap, 'image/png': trap, [MIME]: JSON.stringify(payload)})];
    const response = await invoke('linecraft:clipboard-read'); assert.equal(response.ok, true); assert.deepEqual(response.data, payload); assert.deepEqual(calls.payloadTypes, [MIME]);
  });
  await check('clipboard without dedicated geometry format returns no content and fetches no payload', async () => {
    calls.payloadTypes = []; readItems = [new FakeClipboardItem({'text/plain': () => {throw new Error('Unrelated payload accessed.');}})];
    const response = await invoke('linecraft:clipboard-read'); assert.equal(response.ok, false); assert.equal(response.data, undefined); assert.deepEqual(calls.payloadTypes, []);
  });
  await check('malformed and invalid recognized geometry are rejected without echoing clipboard text', async () => {
    for (const text of ['invalid-synthetic-private-marker', JSON.stringify({...payload, base: {x: null, y: 0}})]) {readItems = [new FakeClipboardItem({[MIME]: text})]; const response = await invoke('linecraft:clipboard-read'); assert.equal(response.ok, false); assert.equal(response.data, undefined); assert.equal(response.error, 'Clipboard does not contain valid Linecraft geometry.');}
  });
  await check('invalid geometry and oversized renderer input fail before any clipboard write', async () => {
    const before = calls.write;
    for (const value of [{...payload, base: {x: Infinity, y: 0}}, {...payload, entities: [{type: 'UNKNOWN', start: {x: 0, y: 0}}]}, {...payload, entities: [{type: 'LINE', start: {x: 0, y: 0}, end: {x: 0, y: 0}, layer: '0'}]}, 'x'.repeat(25 * 1024 * 1024 + 1)]) assert.equal((await invoke('linecraft:clipboard-write', value)).ok, false);
    assert.equal(calls.write, before);
  });
  await check('a silently uncommitted native write cannot return success or fetch unrelated content', async () => {
    readItems = [new FakeClipboardItem({'text/plain': () => {throw new Error('Unrelated content fetched.');}})]; calls.payloadTypes = []; silentWrite = true;
    assert.equal((await invoke('linecraft:clipboard-write', payload)).ok, false); assert.deepEqual(calls.payloadTypes, []); silentWrite = false;
  });
  await check('oversized native geometry is rejected before copying blob bytes into JSON', async () => {
    const blob = new Blob(['x'.repeat(25 * 1024 * 1024 + 1)]); let arrayRead = false; blob.arrayBuffer = async () => {arrayRead = true; throw new Error('Oversized blob should not be copied.');};
    readItems = [new FakeClipboardItem({[MIME]: blob})]; assert.equal((await invoke('linecraft:clipboard-read')).ok, false); assert.equal(arrayRead, false);
  });
  await check('malformed UTF-8 is rejected before geometry normalization', async () => {
    readItems = [new FakeClipboardItem({[MIME]: new Blob([Buffer.from([0xff, 0xfe, 0x7b, 0x7d])])})]; assert.equal((await invoke('linecraft:clipboard-read')).ok, false);
  });
  await check('asynchronous clipboard operation serializes requests and write failure is explicit', async () => {
    let release; deferredWrite = new Promise(resolve => {release = resolve;}); const started = calls.write, pending = invoke('linecraft:clipboard-write', payload);
    for (let i = 0; i < 100 && calls.write === started; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.write, started + 1); const reads = calls.read; assert.equal((await invoke('linecraft:clipboard-read')).ok, false); assert.equal(calls.read, reads);
    release(); assert.equal((await pending).ok, true); deferredWrite = null;
    rejectWrite = true; assert.equal((await invoke('linecraft:clipboard-write', payload)).ok, false); rejectWrite = false;
  });
  await check('native text editing is a six-action allowlist with no data returned', async () => {
    calls.text = []; for (const action of ['copy', 'cut', 'paste', 'select-all', 'undo', 'redo']) assert.deepEqual(await invoke('linecraft:text-edit', action), {ok: true});
    assert.deepEqual(calls.text, ['copy', 'cut', 'paste', 'selectAll', 'undo', 'redo']);
    for (const action of ['executeJavaScript', 'constructor', '__proto__', ['copy'], null]) assert.equal((await invoke('linecraft:text-edit', action)).ok, false);
    assert.equal(calls.text.length, 6);
  });
  await check('contextual native menus have no duplicate clipboard accelerators and main leaves C/X/V to the DOM', () => {
    const edit = menu.find(item => item.label === '&Edit').submenu, clipboardItems = edit.filter(item => /Ctrl\+(?:Shift\+)?[CXV]/.test(item.label || ''));
    assert.equal(clipboardItems.length, 4); for (const item of clipboardItems) assert.equal(item.accelerator, undefined);
    for (const input of [{key: 'c'}, {key: 'x'}, {key: 'v'}, {key: 'c', shift: true}]) {let prevented = false; const before = windowInstance.messages.length; windowInstance.webContents.emit('before-input-event', {preventDefault() {prevented = true;}}, {type: 'keyDown', control: true, ...input}); assert.equal(prevented, false); assert.equal(windowInstance.messages.length, before);}
    const before = windowInstance.messages.length; for (const item of clipboardItems) item.click(); assert.deepEqual(windowInstance.messages.slice(before).map(item => item.action), ['cut', 'copy', 'paste', 'copy-base']);
  });
  report.total = report.tests.length; report.passed = report.tests.filter(item => item.status === 'passed').length; report.failed = report.total - report.passed;
  await fs.writeFile(path.join(__dirname, 'clipboard-security-results.json'), `${JSON.stringify(report, null, 2)}\n`); console.log(`${report.passed}/${report.total} passed`); process.exitCode = report.failed ? 1 : 0;
}
main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
