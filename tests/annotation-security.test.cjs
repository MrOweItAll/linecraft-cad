'use strict';
// Focused v1.3 validation delta: mocked Electron, real core and filesystem; no OS clipboard.
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const Module = require('node:module');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const workspace = path.basename(path.dirname(root)) === 'outputs' ? path.dirname(path.dirname(root)) : root;
const MIME = 'electron application/osclipboard;format="application/x-linecraft-geometry+json"';
const handlers = new Map(), calls = {write: 0, saveDialog: 0, openDialog: 0};
let windowInstance, readItems = [], chosenPath;
const fakeApp = new EventEmitter(); Object.assign(fakeApp, {isPackaged: true, whenReady: async () => {}, quit() {}, getVersion: () => 'test', setPath() {}});
class FakeWindow extends EventEmitter {
  constructor() {super(); windowInstance = this; this.webContents = new EventEmitter(); Object.assign(this.webContents, {mainFrame: {url: pathToFileURL(path.join(root, 'index.html')).href}, send() {}, setWindowOpenHandler() {}, closeDevTools() {}});}
  isDestroyed() {return false;} setTitle() {} show() {} close() {} async loadFile() {}
}
class FakeClipboardItem {
  constructor(payloads) {this.payloads = payloads; this.types = Object.keys(payloads);}
  async getType(type) {return new Blob([this.payloads[type]], {type});}
}
const fakeElectron = {
  app: fakeApp, BrowserWindow: FakeWindow, ClipboardItem: FakeClipboardItem,
  clipboard: {read: async () => readItems, write: async items => {calls.write++; readItems = items;}},
  Menu: {buildFromTemplate: value => value, setApplicationMenu() {}},
  dialog: {showErrorBox() {}, showMessageBox: async () => ({response: 2}), showSaveDialog: async () => {calls.saveDialog++; return {canceled: false, filePath: chosenPath};}, showOpenDialog: async () => {calls.openDialog++; return {canceled: false, filePaths: [chosenPath]};}},
  ipcMain: {handle: (channel, callback) => handlers.set(channel, callback), on() {}},
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
  const report = {framework: 'Focused v1.3 annotation/settings validation through native IPC', osClipboardTouched: false, scope: 'Mocked Electron dialogs/clipboard; real schema validation and filesystem. Existing transport boundaries remain covered by the separate baseline suites.', startedAt: new Date().toISOString(), tests: []};
  const check = async (name, fn) => {const start = Date.now(); try {await fn(); report.tests.push({name, status: 'passed', durationMs: Date.now() - start}); console.log(`PASS ${name}`);} catch(error) {report.tests.push({name, status: 'failed', durationMs: Date.now() - start, error: error.stack || String(error)}); console.log(`FAIL ${name}: ${error.message}`);}};
  const directory = path.join(workspace, 'work', 'annotation-security-tests', `run-${Date.now()}`); await fs.mkdir(directory, {recursive: true});
  chosenPath = path.join(directory, 'validated.linecraft');
  const editor = createEditor();
  const empty = JSON.parse(editor.serialize());
  const annotations = [
    {id: 'annotation-1', type: 'TEXT', position: {x: 0, y: 0}, text: 'Owned Ω ⌀ <img src=x>', height: 5, rotation: 30, style: 'Standard', layer: '0'},
    {id: 'annotation-2', type: 'MTEXT', position: {x: 0, y: 30}, text: 'First line\nSecond line', width: 80, height: 3, rotation: 0, style: 'Standard', layer: '0'},
    {id: 'annotation-3', type: 'DIMENSION', kind: 'linear', p1: {x: 0, y: 0}, p2: {x: 100, y: 0}, axisAngle: 0, placement: {x: 50, y: 20}, style: 'Standard', scale: 1, layer: '0'},
    {id: 'annotation-4', type: 'DIMENSION', kind: 'radius', center: {x: 200, y: 0}, radius: 25, placement: {x: 240, y: 20}, style: 'Standard', scale: 1, layer: '0'},
  ];
  assert.equal(editor.importJSON(JSON.stringify({...empty, entities: annotations})).ok, true, 'Valid v1.3 annotations must be supported; never skip absent implementation.');
  const document = JSON.parse(editor.serialize());
  assert.ok(document.settings && document.textStyles && document.dimStyles, 'The v1.3 schema must exist; never silently skip this suite.');
  await check('drawing settings and annotation style schema round-trip through validated native Save/Open', async () => {
    assert.equal((await invoke('linecraft:save', editor.serialize(), true)).ok, true);
    const saved = JSON.parse(await fs.readFile(chosenPath, 'utf8')); assert.deepEqual(saved.settings, document.settings); assert.deepEqual(saved.textStyles, document.textStyles); assert.deepEqual(saved.dimStyles, document.dimStyles);
    const opened = await invoke('linecraft:open'); assert.equal(opened.ok, true); assert.deepEqual(JSON.parse(opened.text).settings, document.settings);
  });
  await check('invalid persisted settings fail before a Save dialog or overwriting the adopted file', async () => {
    const before = await fs.readFile(chosenPath, 'utf8'), dialogCount = calls.saveDialog;
    for (const patch of [{precision: -1}, {precision: 1000}, {units: 'http://invalid-owned.test'}, {gridEnabled: 'yes'}, {gridAdaptive: 'yes'}, {gridSpacing: 0}, {snapModes: ['constructor']}]) {
      const invalid = {...document, settings: {...document.settings, ...patch}};
      assert.equal((await invoke('linecraft:save', JSON.stringify(invalid), true)).ok, false, JSON.stringify(patch));
    }
    assert.equal(calls.saveDialog, dialogCount); assert.equal(await fs.readFile(chosenPath, 'utf8'), before);
  });
  await check('TEXT/MTEXT bounds reject collapsed sizes, nonfinite angles, unsupported controls, and oversized contents before writes', async () => {
    const before = await fs.readFile(chosenPath, 'utf8'), dialogCount = calls.saveDialog;
    const patches = [[0, {height: 0}], [0, {rotation: null}], [0, {text: 'one\ntwo'}], [0, {text: 'x'.repeat(2049)}], [0, {text: 'Ω'.repeat(1025)}], [0, {text: 'x'.repeat(65537)}], [0, {text: 'owned\u0000data'}], [0, {style: 'missing-owned-style'}], [1, {width: 0}], [1, {position: {x: null, y: 0}}]];
    for (const [index, patch] of patches) {const invalid = structuredClone(document); Object.assign(invalid.entities[index], patch); assert.equal((await invoke('linecraft:save', JSON.stringify(invalid), true)).ok, false, Object.keys(patch).join(','));}
    assert.equal(calls.saveDialog, dialogCount); assert.equal(await fs.readFile(chosenPath, 'utf8'), before);
  });
  await check('dimension definitions reject invalid subtype, reference, scale, and radial geometry atomically', async () => {
    const before = await fs.readFile(chosenPath, 'utf8'), dialogCount = calls.saveDialog;
    for (const [index, patch] of [[2, {kind: 'constructor'}], [2, {p2: {x: 0, y: 0}}], [2, {axisAngle: null}], [2, {placement: {x: 50, y: null}}], [2, {scale: 0}], [2, {style: 'missing-owned-style'}], [2, {textOverride: null}], [2, {textOverride: 'Ω'.repeat(1025)}], [2, {textOverride: '\\'.repeat(300)}], [3, {radius: -1}], [3, {center: {x: null, y: 0}}]]) {
      const invalid = structuredClone(document); Object.assign(invalid.entities[index], patch); assert.equal((await invoke('linecraft:save', JSON.stringify(invalid), true)).ok, false, Object.keys(patch).join(','));
    }
    assert.equal(calls.saveDialog, dialogCount); assert.equal(await fs.readFile(chosenPath, 'utf8'), before);
  });
  await check('style resources reject arbitrary font paths, invalid style sizes/precision, and missing current references', async () => {
    const dialogCount = calls.saveDialog;
    for (const mutate of [value => value.textStyles[0].fontFamily = 'https://owned-invalid.test/font.ttf', value => value.textStyles[0].defaultHeight = 0, value => value.textStyles[0].widthFactor = 1000, value => value.dimStyles[0].textStyle = 'missing-owned-style', value => value.dimStyles[0].textHeight = 0, value => value.dimStyles[0].precision = 9, value => value.dimStyles[0].scale = null, value => value.currentTextStyle = 'missing-owned-style', value => value.currentDimStyle = 'missing-owned-style', value => value.currentTextStyle = null, value => value.currentDimStyle = null, value => value.settings = null]) {
      const invalid = structuredClone(document); mutate(invalid); assert.equal((await invoke('linecraft:save', JSON.stringify(invalid), true)).ok, false);
    }
    assert.equal(calls.saveDialog, dialogCount);
  });
  editor.select(editor.state.entities.map(entity => entity.id)); assert.equal(editor.copySelection({x: 0, y: 0}).ok, true); const payload = editor.getClipboard();
  await check('portable annotation clipboard validates and carries original text and dimension style definitions', async () => {
    assert.equal((await invoke('linecraft:clipboard-write', payload)).ok, true);
    const response = await invoke('linecraft:clipboard-read'); assert.equal(response.ok, true); assert.deepEqual(response.data, payload); assert.ok(response.data.textStyles?.length); assert.ok(response.data.dimStyles?.length);
    assert.equal(response.data.entities[0].text, annotations[0].text); assert.equal(response.data.entities[1].text, annotations[1].text);
  });
  await check('invalid annotation clipboard cannot replace committed content or return unvalidated data', async () => {
    const writes = calls.write, prior = readItems;
    for (const mutate of [value => value.entities[0].height = 0, value => value.entities[1].width = null, value => value.entities[2].scale = 0, value => value.textStyles[0].fontFamily = 'C:/owned-invalid/font.ttf', value => value.dimStyles[0].textStyle = 'missing-owned-style']) {
      const invalid = structuredClone(payload); mutate(invalid); assert.equal((await invoke('linecraft:clipboard-write', invalid)).ok, false); assert.equal(calls.write, writes); assert.equal(readItems, prior);
      readItems = [new FakeClipboardItem({[MIME]: JSON.stringify(invalid)})]; const response = await invoke('linecraft:clipboard-read'); assert.equal(response.ok, false); assert.equal(response.data, undefined); readItems = prior;
    }
  });
  report.completedAt = new Date().toISOString(); report.total = report.tests.length; report.passed = report.tests.filter(item => item.status === 'passed').length; report.failed = report.total - report.passed;
  await fs.writeFile(path.join(__dirname, 'annotation-security-results.json'), `${JSON.stringify(report, null, 2)}\n`); console.log(`${report.passed}/${report.total} passed`); process.exitCode = report.failed ? 1 : 0;
}
main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
