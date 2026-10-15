'use strict';

/* Original Electron shell for Linecraft. Geometry and interface remain independent modules. */
const { app, BrowserWindow, Menu, dialog, ipcMain, session, clipboard, ClipboardItem } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL, fileURLToPath } = require('node:url');

const APP_ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(APP_ROOT, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_PATH).href;
const MAX_TEXT_BYTES = 25 * 1024 * 1024;
// Explicit test CLI only; ordinary launches retain the visible native window.
const HIDDEN_TEST = process.argv.includes('--linecraft-test-hidden');
if(HIDDEN_TEST){
  // Harnesses override these fixed methods with owned file destinations. An
  // unstubbed test action must never display an operating-system dialog.
  dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});
  dialog.showSaveDialog=async()=>({canceled:true});
  dialog.showMessageBox=async()=>({response:2});
  dialog.showErrorBox=(title,message)=>console.error(`${title}: ${message}`);
}
const ACTIONS = new Set(['new', 'open', 'save', 'save-as', 'export-dxf', 'plot', 'publish', 'undo', 'redo', 'fit', 'about', 'close', 'copy', 'cut', 'paste', 'copy-base']);
// Fixed main-authored MIME keys; renderer data can never name OS formats or files.
const GEOMETRY_CLIPBOARD_MIME = 'electron application/osclipboard;format="application/x-linecraft-geometry+json"';
const TEXT_EDIT_METHODS = new Map([['copy', 'copy'], ['cut', 'cut'], ['paste', 'paste'], ['select-all', 'selectAll'], ['undo', 'undo'], ['redo', 'redo']]);
const CSP = "default-src 'self' file: data: blob:; script-src 'self' file:; style-src 'self' file: 'unsafe-inline'; img-src 'self' file: data: blob:; font-src 'self' file: data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

// Separate profiles make automated desktop tests isolated from normal application settings.
const profileArgument = process.argv.find(argument => argument.startsWith('--user-data-dir='));
if (profileArgument) {
  const profilePath = profileArgument.slice('--user-data-dir='.length);
  if (path.isAbsolute(profilePath)) app.setPath('userData', path.resolve(profilePath));
  else throw new Error('--user-data-dir must name an absolute directory.');
}

let mainWindow = null;
let drawingPath = null;
let importSaveName = null;
let allowWindowClose = false;
let fileOperationBusy = false;
let documentState = { dirty: false, name: 'Untitled drawing', text: '' };
let corePromise = null;
let developmentCoreVersion = null;
let importerPromise = null;
let developmentImporterVersion = null;
let developmentModelHelperVersion = null;
let plotPromise = null;
let developmentPlotVersion = null;
let developmentPlotDependencies = null;
let developmentStaticGraphVersion = null;
let clipboardOperationBusy = false;

function failure(error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
function canceled() { return { ok: false, canceled: true }; }
function safeName(name) { return typeof name === 'string' ? name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || 'Untitled drawing' : 'Untitled drawing'; }

function trusted(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const contents = mainWindow.webContents;
  return event.sender === contents && event.senderFrame === contents.mainFrame && event.senderFrame.url.split('#')[0] === INDEX_URL;
}

function checkText(text) {
  if (typeof text !== 'string') throw new Error('Drawing contents must be text.');
  if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) throw new Error('Drawing exceeds the 25 MiB size limit.');
  return text;
}

async function architectureModuleNames(){return (await fs.readdir(path.join(APP_ROOT,'architecture'))).filter(name=>/^[a-z0-9-]+\.mjs$/.test(name)).sort().map(name=>`architecture/${name}`);}

async function loadCore() {
  const corePath = path.join(APP_ROOT, 'core.mjs'), coreURL = pathToFileURL(corePath).href;
  if (app.isPackaged) corePromise ??= import(coreURL);
  else {
    const helpers=[];
    for(const name of ['advanced-geometry.mjs','units.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs',...await architectureModuleNames()]){const helper=await fs.stat(path.join(APP_ROOT,name));helpers.push(`${name}:${helper.mtimeMs}:${helper.size}`);}
    const helperVersion=helpers.join('|');
    if(developmentModelHelperVersion!==null&&developmentModelHelperVersion!==helperVersion)throw Error('A modeling, paper, plane or units helper changed. Restart launch-dev.cmd to refresh native validation; the drawing checkpoint is preserved.');
    developmentModelHelperVersion=helperVersion;
    const status = await fs.stat(corePath), version = `${status.mtimeMs}:${status.size}`;
    if (developmentCoreVersion !== version) {
      corePromise = import(`${coreURL}?development=${encodeURIComponent(version)}`);
      developmentCoreVersion = version;
    }
  }
  return corePromise;
}

async function guardDevelopmentStaticGraph(){
  if(app.isPackaged)return;
  const parts=[];for(const name of ['core.mjs','units.mjs','advanced-geometry.mjs','3d-view.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs',...await architectureModuleNames()]){const status=await fs.stat(path.join(APP_ROOT,name));parts.push(`${name}:${status.mtimeMs}:${status.size}`);}
  const version=parts.join('|');if(developmentStaticGraphVersion!==null&&developmentStaticGraphVersion!==version)throw Error('An imported DWG/PDF modeling dependency changed. Restart launch-dev.cmd to refresh its native module graph; the drawing checkpoint is preserved.');developmentStaticGraphVersion=version;
}

async function loadPlotService(){
  await guardDevelopmentStaticGraph();
  const modulePath=path.join(APP_ROOT,'plot-document.mjs'),moduleURL=pathToFileURL(modulePath).href;
  if(app.isPackaged)plotPromise??=import(moduleURL);
  else{
    const status=await fs.stat(modulePath),version=`${status.mtimeMs}:${status.size}`,dependencies=[];
    for(const name of ['core.mjs','units.mjs','advanced-geometry.mjs','3d-view.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs',...await architectureModuleNames()]){const item=await fs.stat(path.join(APP_ROOT,name));dependencies.push(`${name}:${item.mtimeMs}:${item.size}`);}
    const dependencyVersion=dependencies.join('|');if(developmentPlotDependencies!==null&&developmentPlotDependencies!==dependencyVersion)throw Error('A PDF modeling dependency changed. Restart launch-dev.cmd before plotting to refresh its native module graph; the drawing checkpoint is preserved.');
    developmentPlotDependencies=dependencyVersion;
    if(developmentPlotVersion!==version){plotPromise=import(`${moduleURL}?development=${encodeURIComponent(version)}`);developmentPlotVersion=version;}
  }
  const module=await plotPromise,{createEditor}=await loadCore(),{createPlotService}=require('./plot-files.cjs');
  return createPlotService({BrowserWindow,dialog,getMainWindow:()=>mainWindow,getTitle:()=>documentState.name,normalizePlotOptions:module.normalizePlotOptions,fontCalibration:module.PLOT_FONT_CALIBRATION,buildPlotHTML:(sources,options)=>module.buildPlotHTML(sources,{options,createEditor}),atomicWrite,validateDrawing});
}

async function validateDrawing(text) {
  checkText(text);
  const { createEditor } = await loadCore();
  const validation = createEditor().importJSON(text);
  if (!validation.ok) throw new Error(validation.message);
}

async function importExchangeDrawing(destination) {
  await guardDevelopmentStaticGraph();
  const importerPath=path.join(APP_ROOT,'dwg-import.mjs'),importerURL=pathToFileURL(importerPath).href;
  if(app.isPackaged)importerPromise??=import(importerURL);
  else{const status=await fs.stat(importerPath),version=`${status.mtimeMs}:${status.size}`;if(developmentImporterVersion!==version){importerPromise=import(`${importerURL}?development=${encodeURIComponent(version)}`);developmentImporterVersion=version;}}
  const module=await importerPromise,{createEditor}=await loadCore();
  const resourceRoot=app.isPackaged?process.resourcesPath:APP_ROOT;
  if(typeof resourceRoot!=='string')throw new Error('The desktop resource directory is unavailable.');
  const {createDrawingImporter}=require('./import-files.cjs');
  const importer=createDrawingImporter({
    converterPath:path.join(resourceRoot,'third-party','libredwg','runtime','dwgread.exe'),
    converterArguments:(input,output,format='DXF')=>['-O',format,'-o',output,input],
    parseDWGMetadata:bytes=>module.readDWGMetadata(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),
    parseDXF:(bytes,{dwgMetadata})=>module.importDXF(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{sourceName:path.basename(destination),createEditor,dwgMetadata}),
    validateDrawing,
  });
  return importer.importDrawing(destination);
}

async function normalizeClipboard(data) {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  checkText(serialized);
  const { createEditor } = await loadCore();
  const validator = createEditor();
  if (!validator.setClipboard(data).ok) throw new Error('Clipboard geometry is invalid.');
  const normalized = validator.getClipboard();
  if (!normalized || normalized.format !== 'LinecraftClipboard/1') throw new Error('Clipboard geometry is invalid.');
  const text = JSON.stringify(normalized);
  checkText(text);
  return { data: normalized, text };
}

async function clipboardOperation(operation, errorMessage) {
  if (clipboardOperationBusy) return failure('Another clipboard operation is already in progress.');
  clipboardOperationBusy = true;
  try { return await operation(); }
  catch { return failure(errorMessage); }
  finally { clipboardOperationBusy = false; }
}

async function readGeometryClipboardRepresentation() {
  // read() returns lazy readers; only this fixed registered format is retrieved.
  const items = await clipboard.read();
  const item = items.find(item => item.types.includes(GEOMETRY_CLIPBOARD_MIME));
  if (!item) return null;
  const blob = await item.getType(GEOMETRY_CLIPBOARD_MIME);
  if (!(blob instanceof Blob) || blob.size > MAX_TEXT_BYTES) throw new Error('Invalid clipboard data.');
  // Some OS raw-format allocations include a terminating NUL. JSON never does.
  const text = new TextDecoder('utf-8', {fatal: true}).decode(await blob.arrayBuffer()).replace(/\0+$/, '');
  return {text, hasTextRepresentation: item.types.includes('text/plain')};
}

function developmentPathFile() {return path.join(app.getPath('userData'), 'development-document-path.json');}
async function persistDevelopmentPath() {
  if (app.isPackaged) return;
  try {
    await fs.mkdir(app.getPath('userData'), {recursive: true});
    await atomicWrite(developmentPathFile(), JSON.stringify({format: 'LinecraftDevelopmentPath/1', drawingPath,importSaveName}));
  } catch (error) {console.warn(`[Linecraft dev] Could not checkpoint the file association: ${error.message}`);}
}
async function restoreDevelopmentPath() {
  if (app.isPackaged) return;
  try {
    const saved = JSON.parse(await fs.readFile(developmentPathFile(), 'utf8'));
    if (saved.format !== 'LinecraftDevelopmentPath/1') return;
    if(typeof saved.importSaveName==='string'&&path.basename(saved.importSaveName)===saved.importSaveName&&saved.importSaveName.endsWith('.linecraft'))importSaveName=safeName(saved.importSaveName);
    if(typeof saved.drawingPath !== 'string' || !path.isAbsolute(saved.drawingPath))return;
    const status = await fs.stat(saved.drawingPath);
    if (!status.isFile() || status.size > MAX_TEXT_BYTES) return;
    await validateDrawing(await fs.readFile(saved.drawingPath, 'utf8'));
    drawingPath = path.resolve(saved.drawingPath);
  } catch (error) {if (error.code !== 'ENOENT') console.warn(`[Linecraft dev] File association recovery skipped: ${error.message}`);}
}

function updateTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const name = drawingPath ? path.basename(drawingPath) : safeName(documentState.name);
  mainWindow.setTitle(`${documentState.dirty ? '● ' : ''}${name} — Linecraft CAD`);
}

function sendAction(action) {
  if (ACTIONS.has(action) && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('linecraft:action', action);
}

async function fileOperation(operation) {
  if (fileOperationBusy) return failure('Another file operation is already in progress.');
  fileOperationBusy = true;
  try { return await operation(); }
  catch (error) { return failure(error); }
  finally { fileOperationBusy = false; }
}

/** Write a new sibling, flush it, then rename it into place. Never delete the destination. */
async function atomicWrite(destination, text) {
  if (!path.isAbsolute(destination)) throw new Error('Choose an absolute file path.');
  const absolute = path.resolve(destination);
  const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${process.pid}.${randomUUID()}.tmp`);
  let handle = null, created = false;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    created = true;
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    await fs.rename(temporary, absolute);
  } finally {
    if (handle) { try { await handle.close(); } catch {} }
    // Cleanup is limited to the unique temporary file created by this operation.
    if (created) { try { await fs.unlink(temporary); } catch (error) { if (error.code !== 'ENOENT') console.warn('Could not remove temporary save file:', error.message); } }
  }
  return absolute;
}

function withExtension(filename, extension) { return path.extname(filename) ? filename : `${filename}.${extension}`; }

function registerIPC() {
  ipcMain.handle('linecraft:plot-pdf',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted PDF request.');
    return fileOperation(async()=>{const plot=await loadPlotService();return plot.plotPDF(payload);});
  });
  ipcMain.handle('linecraft:publish-pdf',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted PDF request.');
    return fileOperation(async()=>{const plot=await loadPlotService();return plot.publishPDF(payload);});
  });
  ipcMain.handle('linecraft:clipboard-write', (event, data) => {
    if (!trusted(event)) return failure('Untrusted clipboard request.');
    return clipboardOperation(async () => {
      const normalized = await normalizeClipboard(data);
      // Electron 44 commits all representations in one atomic native write.
      await clipboard.write([new ClipboardItem({
        [GEOMETRY_CLIPBOARD_MIME]: normalized.text,
        'text/plain': normalized.text,
      })]);
      const verification = await readGeometryClipboardRepresentation();
      if (!verification?.hasTextRepresentation || verification.text !== normalized.text) throw new Error('Clipboard write could not be verified.');
      return { ok: true };
    }, 'Geometry could not be copied to the clipboard.');
  });

  ipcMain.handle('linecraft:clipboard-read', event => {
    if (!trusted(event)) return failure('Untrusted clipboard request.');
    return clipboardOperation(async () => {
      const representation = await readGeometryClipboardRepresentation();
      if (!representation) return failure('Clipboard does not contain Linecraft geometry.');
      const normalized = await normalizeClipboard(representation.text);
      return { ok: true, data: normalized.data };
    }, 'Clipboard does not contain valid Linecraft geometry.');
  });

  ipcMain.handle('linecraft:text-edit', (event, action) => {
    if (!trusted(event)) return failure('Untrusted text editing request.');
    const method = typeof action === 'string' ? TEXT_EDIT_METHODS.get(action) : null;
    if (!method) return failure('Unknown text editing action.');
    try {mainWindow.webContents[method](); return {ok: true};}
    catch {return failure('Text editing is not available.');}
  });

  ipcMain.handle('linecraft:open', event => {
    if (!trusted(event)) return failure('Untrusted file request.');
    return fileOperation(async () => {
      const chosen = await dialog.showOpenDialog(mainWindow, {
        title: 'Open drawing', properties: ['openFile'],
        filters: [{ name: 'Supported drawings', extensions: ['linecraft','json','dwg','dxf'] },{name:'Linecraft drawing',extensions:['linecraft','json']},{name:'DWG/DXF drawing',extensions:['dwg','dxf']}],
      });
      if (chosen.canceled || !chosen.filePaths[0]) return canceled();
      const destination = path.resolve(chosen.filePaths[0]);
      if(['.dwg','.dxf'].includes(path.extname(destination).toLowerCase())){
        const imported=await importExchangeDrawing(destination);
        // Import is complete and validated before changing any private association.
        // A source DWG/DXF is never an eligible native Save destination.
        drawingPath=null;importSaveName=`${path.parse(destination).name}.linecraft`;
        await persistDevelopmentPath();documentState={dirty:true,name:importSaveName,text:imported.text};updateTitle();
        return {ok:true,text:imported.text,name:importSaveName,imported:true,importInfo:imported.importInfo};
      }
      const status = await fs.stat(destination);
      if (!status.isFile()) throw new Error('Select a drawing file.');
      if (status.size > MAX_TEXT_BYTES) throw new Error('Drawing exceeds the 25 MiB size limit.');
      const text = await fs.readFile(destination, 'utf8');
      await validateDrawing(text);
      drawingPath = destination;
      importSaveName = null;
      await persistDevelopmentPath();
      documentState = { dirty: false, name: path.basename(destination), text };
      updateTitle();
      return { ok: true, text, name: path.basename(destination) };
    });
  });

  ipcMain.handle('linecraft:save', (event, text, saveAs = false) => {
    if (!trusted(event)) return failure('Untrusted file request.');
    return fileOperation(async () => {
      if (typeof saveAs !== 'boolean') throw new Error('Save As must be true or false.');
      await validateDrawing(text);
      let destination = drawingPath;
      if (!destination || saveAs) {
        const chosen = await dialog.showSaveDialog(mainWindow, {
          title: saveAs ? 'Save Linecraft drawing as' : 'Save Linecraft drawing',
          defaultPath: drawingPath ?? importSaveName ?? 'Untitled.linecraft',
          filters: [{ name: 'Linecraft drawing', extensions: ['linecraft'] }],
        });
        if (chosen.canceled || !chosen.filePath) return canceled();
        destination = withExtension(chosen.filePath, 'linecraft');
      }
      const writtenPath = await atomicWrite(destination, text);
      drawingPath = writtenPath;
      importSaveName = null;
      await persistDevelopmentPath();
      documentState = { dirty: false, name: path.basename(writtenPath), text };
      updateTitle();
      return { ok: true, name: path.basename(writtenPath) };
    });
  });

  ipcMain.handle('linecraft:export-dxf', (event, text) => {
    if (!trusted(event)) return failure('Untrusted file request.');
    return fileOperation(async () => {
      checkText(text);
      const defaultPath = drawingPath ? path.join(path.dirname(drawingPath), `${path.parse(drawingPath).name}.dxf`) : 'Untitled.dxf';
      const chosen = await dialog.showSaveDialog(mainWindow, {
        title: 'Export DXF', defaultPath, filters: [{ name: 'DXF drawing', extensions: ['dxf'] }],
      });
      if (chosen.canceled || !chosen.filePath) return canceled();
      const writtenPath = await atomicWrite(withExtension(chosen.filePath, 'dxf'), text);
      return { ok: true, name: path.basename(writtenPath) };
    });
  });

  ipcMain.handle('linecraft:confirm-discard', async (event, name) => {
    if (!trusted(event)) return 'cancel';
    try {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'question', title: 'Unsaved drawing',
        message: `Save changes to ${safeName(name)}?`,
        detail: 'Your drawing has unsaved changes.',
        buttons: ['Save', 'Discard', 'Cancel'], defaultId: 0, cancelId: 2, noLink: true,
      });
      return ['save', 'discard', 'cancel'][choice.response] ?? 'cancel';
    } catch { return 'cancel'; }
  });

  ipcMain.handle('linecraft:reset-path', async event => {
    if (!trusted(event)) return failure('Untrusted document request.');
    if (fileOperationBusy) return failure('Another file operation is already in progress.');
    drawingPath = null; importSaveName=null;documentState = { dirty: false, name: 'Untitled drawing', text: '' }; updateTitle();
    await persistDevelopmentPath();
    return { ok: true };
  });

  ipcMain.on('linecraft:document-state', (event, value) => {
    if (!trusted(event) || !value || typeof value.dirty !== 'boolean' || typeof value.name !== 'string' || typeof value.text !== 'string') return;
    try {
      checkText(value.text);
      documentState = { dirty: value.dirty, name: safeName(value.name), text: value.text };
      updateTitle();
    } catch {}
  });

  ipcMain.on('linecraft:allow-close', event => {
    if (!trusted(event)) return;
    allowWindowClose = true;
    mainWindow.close();
  });
}

function configureSecurity() {
  const contentsSession = session.defaultSession;
  contentsSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  contentsSession.setPermissionCheckHandler(() => false);
  contentsSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    let allowed = false;
    try {
      const url = new URL(details.url);
      if (url.protocol === 'file:') {
        const resource = path.resolve(fileURLToPath(url));
        const relative = path.relative(APP_ROOT, resource);
        allowed = relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
      } else allowed = url.protocol === 'data:' || url.protocol === 'blob:';
    } catch {}
    callback({ cancel: !allowed });
  });
  contentsSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const name of Object.keys(headers)) if (name.toLowerCase() === 'content-security-policy') delete headers[name];
    headers['Content-Security-Policy'] = [CSP];
    callback({ responseHeaders: headers });
  });
}

async function showAbout() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await dialog.showMessageBox(mainWindow, {
    type: 'info', title: 'About Linecraft CAD', message: 'Linecraft CAD',
    detail: `Version ${app.getVersion()}\n\nIndependent 2D drafting and polygonal 3D modeling.\nOriginal application code and interface artwork.\nDWG input uses the separately distributed GNU LibreDWG converter.\n\nDrawings are stored locally.`,
    buttons: ['OK'], noLink: true,
  });
}

function installMenu() {
  const action = (label, command, accelerator) => ({ label, accelerator, click: () => sendAction(command) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '&File', submenu: [
      action('&New drawing', 'new', 'CmdOrCtrl+N'), action('&Open…', 'open', 'CmdOrCtrl+O'),
      { type: 'separator' }, action('&Save', 'save', 'CmdOrCtrl+S'), action('Save &As…', 'save-as', 'CmdOrCtrl+Shift+S'),
      action('&Export DXF…', 'export-dxf'), action('&Plot to PDF…','plot','CmdOrCtrl+P'),
      action('P&ublish combined PDF…','publish'), { type: 'separator' }, action('E&xit', 'close', 'Alt+F4'),
    ] },
    { label: '&Edit', submenu: [
      action('&Undo', 'undo', 'CmdOrCtrl+Z'), action('&Redo', 'redo', 'CmdOrCtrl+Y'),
      { label: 'Redo (alternate)', visible: false, accelerator: 'CmdOrCtrl+Shift+Z', acceleratorWorksWhenHidden: true, click: () => sendAction('redo') },
      { type: 'separator' },
      // Context is resolved in the renderer. No menu accelerators duplicate DOM C/X/V.
      action('&Cut\tCtrl+X', 'cut'), action('&Copy\tCtrl+C', 'copy'), action('&Paste\tCtrl+V', 'paste'),
      action('Copy with &base point\tCtrl+Shift+C', 'copy-base'), { role: 'selectAll' },
    ] },
    { label: '&View', submenu: [action('&Fit drawing', 'fit', 'CmdOrCtrl+0'), { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: '&Help', submenu: [{ label: '&About Linecraft CAD', click: () => { void showAbout(); } }] },
  ]));
}

function createWindow() {
  allowWindowClose = false;
  mainWindow = new BrowserWindow({
    width: 1380, height: 880, minWidth: 950, minHeight: 620, show: false,paintWhenInitiallyHidden:true,
    title: 'Linecraft CAD', backgroundColor: '#111b22', icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false,
      sandbox: true, webSecurity: true, allowRunningInsecureContent: false, devTools: !app.isPackaged,
      additionalArguments: app.isPackaged ? [] : ['--linecraft-development'],
      backgroundThrottling: !HIDDEN_TEST,
      focusOnNavigation: !HIDDEN_TEST,
      // Hidden regression windows still produce current compositor frames.
      // Normal desktop launches retain the standard visible-window renderer.
      offscreen: HIDDEN_TEST,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || (!input.control && !input.meta) || input.alt) return;
    const key = String(input.key).toLowerCase();
    const action = key === 'n' ? 'new' : key === 'o' ? 'open' : key === 's' ? (input.shift ? 'save-as' : 'save')
      : key === 'z' ? (input.shift ? 'redo' : 'undo') : key === 'y' ? 'redo' : key === 'p' ? 'plot' : key === '0' ? 'fit' : null;
    if (!action) return;
    // Consume both DOM and menu delivery, then route one explicit application action.
    event.preventDefault();
    if (!input.isAutoRepeat) sendAction(action);
  });
  mainWindow.webContents.on('will-navigate', (event, destination) => {
    const next = typeof destination === 'string' ? destination : destination?.url ?? event.url ?? '';
    if (!app.isPackaged && next.split('#')[0] === INDEX_URL) return;
    event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('devtools-opened', () => { if (app.isPackaged) mainWindow.webContents.closeDevTools(); });
  mainWindow.once('ready-to-show', () => { if(!HIDDEN_TEST)mainWindow?.show(); updateTitle(); });
  mainWindow.on('close', event => {
    if (allowWindowClose) return;
    event.preventDefault();
    // Every attempt is forwarded; a canceled save must not disable a later close attempt.
    sendAction('close');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(INDEX_PATH).catch(error => {
    dialog.showErrorBox('Linecraft could not start', error.message);
    allowWindowClose = true;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });
}

app.whenReady().then(async () => {
  await restoreDevelopmentPath(); configureSecurity(); registerIPC(); installMenu(); createWindow();
  if (!app.isPackaged && !process.argv.includes('--linecraft-no-watch')) {
    const watcher = require('./dev-watch.cjs').watchDevelopment(APP_ROOT, () => mainWindow);
    app.once('will-quit', () => watcher.close());
  }
});
app.on('window-all-closed', () => app.quit());
