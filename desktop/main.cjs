'use strict';

/* Original Electron shell for Linecraft. Geometry and interface remain independent modules. */
const { app, BrowserWindow, Menu, dialog, ipcMain, session, clipboard, ClipboardItem } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL, fileURLToPath } = require('node:url');
const {parseNativeLaunchArguments,nativeDrawingPath,createNativeOpenQueue,validateOpenRequestPayload}=require('./open-files.cjs');

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
const CSP = "default-src 'self' file: data: blob:; script-src 'self' file:; worker-src 'self' file:; style-src 'self' file: 'unsafe-inline'; img-src 'self' file: data: blob:; font-src 'self' file: data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

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
let discardAuthorization = null;
let fontMetricsServicePromise = null;
let developmentFontMetricsVersion = null;
async function fontMetricsService(){
  const metricsPath=path.join(APP_ROOT,'font-metrics.mjs');
  if(!app.isPackaged){
    const status=await fs.stat(metricsPath),version=`${status.mtimeMs}:${status.size}`;
    if(developmentFontMetricsVersion!==null&&developmentFontMetricsVersion!==version)throw Error('A font metrics helper changed. Restart launch-dev.cmd to refresh registered font measurements; the drawing checkpoint is preserved.');
    developmentFontMetricsVersion=version;
  }
  fontMetricsServicePromise??=import(pathToFileURL(metricsPath).href).then(module=>require('./drawing-resources.cjs').createFontMetricsService({parseTrueTypeMetrics:module.parseTrueTypeMetrics}));
  return fontMetricsServicePromise;
}
const nativeOpenQueue=createNativeOpenQueue({validateDrawing,onPending:request=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('linecraft:open-requested',request);}});
function documentAssociation(){return{drawingPath,importSaveName,dirty:documentState.dirty,name:documentState.name,text:documentState.text};}
function sameDocumentAssociation(before){const current=documentAssociation();return Object.keys(current).every(key=>current[key]===before[key]);}
function discardAuthorized(){return discardAuthorization&&sameDocumentAssociation(discardAuthorization);}
async function persistRequestedAssociation(destination,importName=null){
  if(app.isPackaged)return;
  try{await fs.mkdir(app.getPath('userData'),{recursive:true});await atomicWrite(developmentPathFile(),JSON.stringify({format:'LinecraftDevelopmentPath/1',drawingPath:destination,importSaveName:importName}));}
  catch{throw Error('Requested drawing association could not be saved. The current drawing is unchanged.');}
}
async function adoptRequestedDrawing(candidate){
  if(documentState.dirty&&!discardAuthorized())throw Error('Save or explicitly discard the current drawing before opening the requested file.');
  const before=documentAssociation();await persistRequestedAssociation(candidate.path);
  if(!sameDocumentAssociation(before)){
    await persistRequestedAssociation(before.drawingPath,before.importSaveName);
    throw Error('The current drawing changed before the requested file could be opened.');
  }
  drawingPath=candidate.path;importSaveName=null;documentState={dirty:false,name:candidate.name,text:candidate.text};discardAuthorization=null;updateTitle();
}

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
    for(const name of ['object-snaps.mjs','trim-geometry.mjs','advanced-geometry.mjs','units.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs','font-metrics.mjs','rich-text.mjs',...await architectureModuleNames()]){const helper=await fs.stat(path.join(APP_ROOT,name));helpers.push(`${name}:${helper.mtimeMs}:${helper.size}`);}
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
  const parts=[];for(const name of ['core.mjs','object-snaps.mjs','trim-geometry.mjs','units.mjs','advanced-geometry.mjs','3d-view.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs','font-metrics.mjs','rich-text.mjs',...await architectureModuleNames()]){const status=await fs.stat(path.join(APP_ROOT,name));parts.push(`${name}:${status.mtimeMs}:${status.size}`);}
  const version=parts.join('|');if(developmentStaticGraphVersion!==null&&developmentStaticGraphVersion!==version)throw Error('An imported DWG/PDF modeling dependency changed. Restart launch-dev.cmd to refresh its native module graph; the drawing checkpoint is preserved.');developmentStaticGraphVersion=version;
}

function plotNeedsFontMetrics(sources){
  return sources.some(({text})=>{
    // The plot service has already validated each bounded native document.
    // Plain legacy annotations retain their established approximate advances.
    const document=JSON.parse(text),styles=new Map((document.textStyles??[]).map(style=>[style.name,style])),dimensions=new Map((document.dimStyles??[]).map(style=>[style.name,style])),blocks=new Map((document.blocks??[]).map(block=>[block.name,block])),visited=new Set();
    const pending=[...(document.entities??[]),...(document.layouts??[]).flatMap(layout=>layout.entities??[])];
    while(pending.length){
      const entity=pending.pop();
      if(entity.type==='INSERT'&&!visited.has(entity.blockName)){visited.add(entity.blockName);pending.push(...(blocks.get(entity.blockName)?.entities??[]));}
      if(!['TEXT','MTEXT','DIMENSION','LEADER'].includes(entity.type))continue;
      if(entity.type==='MTEXT'&&entity.richText)return true;
      const name=entity.type==='DIMENSION'?(dimensions.get(entity.style??'Standard')?.textStyle??'Standard'):(entity.style??'Standard'),style=styles.get(name);
      if(style&&(style.metrics==='registered'||!['Arial','Segoe UI','Consolas'].includes(style.fontFamily)))return true;
    }
    return false;
  });
}

async function loadPlotService(){
  await guardDevelopmentStaticGraph();
  const modulePath=path.join(APP_ROOT,'plot-document.mjs'),moduleURL=pathToFileURL(modulePath).href;
  if(app.isPackaged)plotPromise??=import(moduleURL);
  else{
    const status=await fs.stat(modulePath),version=`${status.mtimeMs}:${status.size}`,dependencies=[];
    for(const name of ['core.mjs','object-snaps.mjs','trim-geometry.mjs','units.mjs','advanced-geometry.mjs','3d-view.mjs','paper-space.mjs','drawing-plane.mjs','viewport-scales.mjs','font-metrics.mjs','rich-text.mjs',...await architectureModuleNames()]){const item=await fs.stat(path.join(APP_ROOT,name));dependencies.push(`${name}:${item.mtimeMs}:${item.size}`);}
    const dependencyVersion=dependencies.join('|');if(developmentPlotDependencies!==null&&developmentPlotDependencies!==dependencyVersion)throw Error('A PDF modeling dependency changed. Restart launch-dev.cmd before plotting to refresh its native module graph; the drawing checkpoint is preserved.');
    developmentPlotDependencies=dependencyVersion;
    if(developmentPlotVersion!==version){plotPromise=import(`${moduleURL}?development=${encodeURIComponent(version)}`);developmentPlotVersion=version;}
  }
  const module=await plotPromise,core=await loadCore(),{createEditor}=core,{createPlotService}=require('./plot-files.cjs');
  return createPlotService({BrowserWindow,dialog,getMainWindow:()=>mainWindow,getTitle:()=>documentState.name,normalizePlotOptions:module.normalizePlotOptions,fontCalibration:module.PLOT_FONT_CALIBRATION,buildPlotHTML:async(sources,options)=>{
    // Never retain a formerly available profile. Rich/registered annotations
    // refresh the fixed inventory; line-only and legacy plots need no font I/O.
    core.clearFontMetrics();let inventory={fonts:[]};
    if(plotNeedsFontMetrics(sources)){
      inventory=await(await fontMetricsService()).getFontMetrics({families:[...core.FONT_FAMILIES]});
      for(const row of inventory.fonts)if(row.available)core.registerFontMetrics(row.fontFamily,row.metrics,{bold:row.bold,italic:row.italic,sha256:row.sha256});
    }
    const prepared=await module.buildPlotHTML(sources,{options,createEditor});
    prepared.report.fontInventory=inventory.fonts.map(({metrics,...row})=>row);return prepared;
  },atomicWrite,validateDrawing});
}

async function validateDrawing(text) {
  checkText(text);
  require('./drawing-resources.cjs').validateEmbeddedImages(JSON.parse(text));
  const { createEditor } = await loadCore();
  const validation = createEditor().importJSON(text);
  if (!validation.ok) throw new Error(validation.message);
}

async function loadStructuralService(){
  await guardDevelopmentStaticGraph();
  const module=await import(pathToFileURL(path.join(APP_ROOT,'architecture/structural-bridge.mjs')).href);
  const assignments=await import(pathToFileURL(path.join(APP_ROOT,'architecture/structural-assignments.mjs')).href);
  const boundaries=await import(pathToFileURL(path.join(APP_ROOT,'architecture/structural-boundaries.mjs')).href);
  const {createStructuralFileService}=require('./structural-files.cjs');
  return createStructuralFileService({dialog,getMainWindow:()=>mainWindow,getDrawingPath:()=>drawingPath,validateDrawing,createStructuralRoofExport:module.createStructuralRoofExport,validateStructuralRoofExport:module.validateStructuralRoofExport,validateStructuralRoofResult:module.validateStructuralRoofResult,createStructuralRoofAssignmentExport:assignments.createStructuralRoofAssignmentExport,validateStructuralRoofAssignmentExport:assignments.validateStructuralRoofAssignmentExport,validateStructuralRoofAssignmentResult:assignments.validateStructuralRoofAssignmentResult,createStructuralRoofBoundaryExport:boundaries.createStructuralRoofBoundaryExport,validateStructuralRoofBoundaryExport:boundaries.validateStructuralRoofBoundaryExport,validateStructuralRoofBoundaryResult:boundaries.validateStructuralRoofBoundaryResult,structuralBridgeHash:module.structuralBridgeHash,atomicWrite});
}

async function importExchangeDrawing(destination) {
  await guardDevelopmentStaticGraph();
  const importerPath=path.join(APP_ROOT,'dwg-import.mjs'),importerURL=pathToFileURL(importerPath).href;
  if(app.isPackaged)importerPromise??=import(importerURL);
  else{const status=await fs.stat(importerPath),version=`${status.mtimeMs}:${status.size}`;if(developmentImporterVersion!==version){importerPromise=import(`${importerURL}?development=${encodeURIComponent(version)}`);developmentImporterVersion=version;}}
  const module=await importerPromise,{createEditor}=await loadCore();let metadataEncoding=null,metadataNormalization=null;
  const resourceRoot=app.isPackaged?process.resourcesPath:APP_ROOT;
  if(typeof resourceRoot!=='string')throw new Error('The desktop resource directory is unavailable.');
  const {createDrawingImporter}=require('./import-files.cjs');
  const importer=createDrawingImporter({
    converterPath:path.join(resourceRoot,'third-party','libredwg','runtime','dwgread.exe'),
    converterArguments:(input,output,format='DXF')=>['-O',format,'-o',output,input],
    parseDWGMetadata:bytes=>{const decoded=require('./drawing-resources.cjs').decodeFixedReaderMetadata(bytes);metadataEncoding=decoded.encoding;metadataNormalization=decoded.normalization??null;return module.readDWGMetadata(decoded.text);},
    parseDXF:(bytes,{dwgMetadata})=>module.importDXF(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{sourceName:path.basename(destination),createEditor,dwgMetadata}),
    validateDrawing,
  });
  const imported=await importer.importDrawing(destination);
  const resolved=await require('./drawing-resources.cjs').resolveDrawingImages(JSON.parse(imported.text),{drawingPath:destination});
  const text=resolved.resolved?JSON.stringify(resolved.document):imported.text;
  await validateDrawing(text);
  return{...imported,text,importInfo:{...imported.importInfo,warnings:[...(imported.importInfo.warnings??[]),...resolved.warnings.map(row=>row.message),...(metadataEncoding==='windows-1252'?['The fixed DWG reader metadata used its declared Windows-1252 codepage; Unicode DXF text was retained.']:[]),...(metadataNormalization?[`Ignored ${metadataNormalization.count} non-finite values in unused fixed-reader associative-array metadata; source bytes and DXF geometry are unchanged.`]:[])],imageResourcesResolved:resolved.resolved,...(metadataEncoding?{readerMetadataEncoding:metadataEncoding}:{}),...(metadataNormalization?{readerMetadataNormalization:metadataNormalization}:{})}};
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

// Only ordinary Save/Open diagnostics use this catalog. Other IPC contracts stay unchanged.
const FILE_FAILURES = Object.freeze({
  request: ['FILE_REQUEST_INVALID', 'Review the file request and try again.'],
  validation: ['DRAWING_VALIDATION_FAILED', 'Choose a supported drawing within 25 MiB or recover a known-good backup.'],
  dialog: ['FILE_DIALOG_FAILED', 'Retry the file chooser.'],
  write: ['FILE_WRITE_FAILED', 'Keep the drawing open and try Save As to a writable location with free space.'],
  read: ['FILE_READ_FAILED', 'Choose a readable copy of the drawing.'],
  import: ['FILE_IMPORT_FAILED', 'Review the source drawing or choose another supported file.'],
  finalize: ['FILE_FINALIZATION_FAILED', 'Check the current drawing and saved file before trying again.'],
});
const FILE_SYSTEM_CODES = new Set(['EACCES','EBUSY','EEXIST','EIO','EISDIR','EMFILE','ENAMETOOLONG','ENOENT','ENOSPC','ENOTDIR','EPERM','EROFS']);
function ownErrorValue(error, key) {
  try { return error && Object.getOwnPropertyDescriptor(error, key)?.value; }
  catch { return undefined; }
}
function fileSystemCode(error) {
  const value = ownErrorValue(error, 'code');
  return typeof value === 'string' && FILE_SYSTEM_CODES.has(value) ? value : undefined;
}
function fileFailure(error, operation, stage) {
  const diagnostic = {stage}, systemCode = fileSystemCode(error);
  if (systemCode) diagnostic.systemCode = systemCode;
  const message = ownErrorValue(error, 'message');
  // Exact authored messages only: appended backend details are never reflected.
  if (message === 'A modeling, paper, plane or units helper changed. Restart launch-dev.cmd to refresh native validation; the drawing checkpoint is preserved.' ||
      message === 'An imported DWG/PDF modeling dependency changed. Restart launch-dev.cmd to refresh its native module graph; the drawing checkpoint is preserved.') {
    const nextStep = 'A modeling, paper, plane or units helper changed. Restart launch-dev.cmd to refresh native validation.';
    return {ok:false, error:`Could not ${operation} the drawing. ${nextStep}`, code:'DEVELOPMENT_RESTART_REQUIRED', operation, nextStep, diagnostic};
  }
  const [code, nextStep] = FILE_FAILURES[stage];
  return {ok:false, error:`Could not ${operation} the drawing. ${nextStep}`, code, operation, nextStep, diagnostic};
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
    // Windows readers can briefly hold a completed drawing without delete-share.
    // Retry only the atomic rename; retain the fsynced sibling and prior target.
    const delays = process.platform === 'win32' ? [25,50,100,200,400] : [];
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temporary, absolute); break; }
      catch (error) {
        if (!['EPERM','EACCES','EBUSY'].includes(error.code) || attempt >= delays.length) throw error;
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  } finally {
    if (handle) { try { await handle.close(); } catch {} }
    // Cleanup is limited to the unique temporary file created by this operation.
    if (created) { try { await fs.unlink(temporary); } catch (error) { if (error.code !== 'ENOENT') console.warn('Could not remove temporary save file.', fileSystemCode(error) ?? 'UNKNOWN'); } }
  }
  return absolute;
}

function withExtension(filename, extension) { return path.extname(filename) ? filename : `${filename}.${extension}`; }

function registerIPC() {
  ipcMain.handle('linecraft:open-request',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted native open request.');
    try{
      const request=validateOpenRequestPayload(payload);
      if(request.action==='peek')return nativeOpenQueue.peek();
      // Cancel is queue-only and need not wait behind an unrelated file dialog.
      if(request.action==='cancel'){const response=nativeOpenQueue.cancel(request.id);discardAuthorization=null;return response;}
      if(fileOperationBusy)return{ok:false,busy:true,error:'Another file operation is already in progress.'};
      return fileOperation(async()=>{
        try{return request.action==='prepare'?await nativeOpenQueue.prepare(request.id):await nativeOpenQueue.commit(request.id,adoptRequestedDrawing);}
        catch(error){return{...failure(error),...(error.code==='OPEN_REQUEST_BUSY'?{busy:true}:{})};}
      });
    }catch(error){return{...failure(error),...(error.code==='OPEN_REQUEST_BUSY'?{busy:true}:{})};}
  });
  ipcMain.handle('linecraft:structural-export',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted structural request.');
    return fileOperation(async()=>{const service=await loadStructuralService();return service.exportRequest(payload);});
  });
  ipcMain.handle('linecraft:structural-import',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted structural request.');
    return fileOperation(async()=>{const service=await loadStructuralService();return service.importResult(payload);});
  });
  ipcMain.handle('linecraft:structural-request-load',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted structural request.');
    return fileOperation(async()=>{const service=await loadStructuralService();return service.loadRequest(payload);});
  });
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

  ipcMain.handle('linecraft:font-metrics', async (event,payload) => {
    if(!trusted(event))return failure('Untrusted font metric request.');
    try{return await(await fontMetricsService()).getFontMetrics(payload);}catch(error){return failure(error);}
  });
  ipcMain.handle('linecraft:image-resource-choose',(event,payload)=>{
    if(!trusted(event))return failure('Untrusted raster resource request.');
    return fileOperation(async()=>{
      const resources=require('./drawing-resources.cjs'),id=resources.validateChooseImagePayload(payload),beforeAssociation=documentAssociation(),document=JSON.parse(checkText(documentState.text)),existing=document.imageResources?.find(row=>row.id===id);
      if(!existing)throw Error('The selected drawing image resource no longer exists.');
      const chosen=await dialog.showOpenDialog(mainWindow,{title:'Resolve drawing image',properties:['openFile'],filters:[{name:'Raster image',extensions:['png','jpg','jpeg']}]});
      if(chosen.canceled||!chosen.filePaths[0])return canceled();
      const filename=path.resolve(chosen.filePaths[0]),before=await fs.stat(filename);if(!before.isFile()||before.size>resources.LIMITS.imageBytes)throw Error('Choose a PNG/JPEG within the 8 MiB limit.');
      const bytes=await fs.readFile(filename),after=await fs.stat(filename);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==before.size)throw Error('The selected raster changed during reading.');
      const info=resources.imageMetadata(bytes),resource={...existing,...info,sourceName:path.basename(filename),sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),dataURL:`data:${info.mimeType};base64,${bytes.toString('base64')}`};
      document.imageResources=document.imageResources.map(row=>row.id===id?resource:row);await validateDrawing(JSON.stringify(document));
      if(!sameDocumentAssociation(beforeAssociation))throw Error('The drawing changed while the raster chooser was open.');
      return{ok:true,resource};
    });
  });

  ipcMain.handle('linecraft:open', event => {
    if (!trusted(event)) return failure('Untrusted file request.');
    return fileOperation(async () => {
      let operation = 'open', stage = 'dialog';
      try {
      const chosen = await dialog.showOpenDialog(mainWindow, {
        title: 'Open drawing', properties: ['openFile'],
        filters: [{ name: 'Supported drawings', extensions: ['linecraft','json','dwg','dxf'] },{name:'Linecraft drawing',extensions:['linecraft','json']},{name:'DWG/DXF drawing',extensions:['dwg','dxf']}],
      });
      if (chosen.canceled || !chosen.filePaths[0]) return canceled();
      const destination = path.resolve(chosen.filePaths[0]);
      if(['.dwg','.dxf'].includes(path.extname(destination).toLowerCase())){
        operation = 'import'; stage = 'import';
        const imported=await importExchangeDrawing(destination);
        stage = 'finalize';
        // Import is complete and validated before changing any private association.
        // A source DWG/DXF is never an eligible native Save destination.
        drawingPath=null;importSaveName=`${path.parse(destination).name}.linecraft`;discardAuthorization=null;
        await persistDevelopmentPath();documentState={dirty:true,name:importSaveName,text:imported.text};updateTitle();
        return {ok:true,text:imported.text,name:importSaveName,imported:true,importInfo:imported.importInfo};
      }
      stage = 'read';
      const status = await fs.stat(destination);
      stage = 'validation';
      if (!status.isFile()) throw new Error('Select a drawing file.');
      if (status.size > MAX_TEXT_BYTES) throw new Error('Drawing exceeds the 25 MiB size limit.');
      stage = 'read';
      const text = await fs.readFile(destination, 'utf8');
      stage = 'validation';
      await validateDrawing(text);
      stage = 'finalize';
      drawingPath = destination;
      importSaveName = null;
      discardAuthorization = null;
      await persistDevelopmentPath();
      documentState = { dirty: false, name: path.basename(destination), text };
      updateTitle();
      return { ok: true, text, name: path.basename(destination) };
      } catch (error) { return fileFailure(error, operation, stage); }
    });
  });

  ipcMain.handle('linecraft:save', (event, text, saveAs = false) => {
    if (!trusted(event)) return failure('Untrusted file request.');
    return fileOperation(async () => {
      let stage = 'request';
      try {
      if (typeof saveAs !== 'boolean') throw new Error('Save As must be true or false.');
      stage = 'validation';
      await validateDrawing(text);
      let destination = drawingPath;
      if (!destination || saveAs) {
        stage = 'dialog';
        const chosen = await dialog.showSaveDialog(mainWindow, {
          title: saveAs ? 'Save Linecraft drawing as' : 'Save Linecraft drawing',
          defaultPath: drawingPath ?? importSaveName ?? 'Untitled.linecraft',
          filters: [{ name: 'Linecraft drawing', extensions: ['linecraft'] }],
        });
        if (chosen.canceled || !chosen.filePath) return canceled();
        destination = withExtension(chosen.filePath, 'linecraft');
      }
      stage = 'write';
      const writtenPath = await atomicWrite(destination, text);
      stage = 'finalize';
      drawingPath = writtenPath;
      importSaveName = null;
      discardAuthorization = null;
      await persistDevelopmentPath();
      documentState = { dirty: false, name: path.basename(writtenPath), text };
      updateTitle();
      return { ok: true, name: path.basename(writtenPath) };
      } catch (error) { return fileFailure(error, 'save', stage); }
    });
  });

  ipcMain.handle('linecraft:export-dxf', (event, text,assetPayload) => {
    if (!trusted(event)) return failure('Untrusted file request.');
    return fileOperation(async () => {
      checkText(text);
      const resources=require('./drawing-resources.cjs'),assets=resources.validateDXFImageAssets(assetPayload,Buffer.byteLength(text,'utf8'));
      const defaultPath = drawingPath ? path.join(path.dirname(drawingPath), `${path.parse(drawingPath).name}.dxf`) : 'Untitled.dxf';
      const chosen = await dialog.showSaveDialog(mainWindow, {
        title: 'Export DXF', defaultPath, filters: [{ name: 'DXF drawing', extensions: ['dxf'] }],
      });
      if (chosen.canceled || !chosen.filePath) return canceled();
      const destination=withExtension(chosen.filePath,'dxf'),sidecars=assets.length?await resources.writeDXFImageAssets(path.dirname(destination),assets):{files:[],createdPaths:[]};
      let writtenPath;try{writtenPath=await atomicWrite(destination,text);}catch(error){await resources.rollbackDXFImageAssets(sidecars);throw error;}
      return { ok: true, name: path.basename(writtenPath),...(assets.length?{imageAssets:sidecars.files}:{} ) };
    });
  });

  ipcMain.handle('linecraft:confirm-discard', async (event, name) => {
    if (!trusted(event)) return 'cancel';
    const before=documentAssociation();discardAuthorization=null;
    try {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'question', title: 'Unsaved drawing',
        message: `Save changes to ${safeName(name)}?`,
        detail: 'Your drawing has unsaved changes.',
        buttons: ['Save', 'Discard', 'Cancel'], defaultId: 0, cancelId: 2, noLink: true,
      });
      const decision=['save', 'discard', 'cancel'][choice.response] ?? 'cancel';
      if(decision==='discard'&&sameDocumentAssociation(before))discardAuthorization=before;
      return decision;
    } catch { return 'cancel'; }
  });

  ipcMain.handle('linecraft:reset-path', async event => {
    if (!trusted(event)) return failure('Untrusted document request.');
    if (fileOperationBusy) return failure('Another file operation is already in progress.');
    drawingPath = null; importSaveName=null;discardAuthorization=null;documentState = { dirty: false, name: 'Untitled drawing', text: '' }; updateTitle();
    await persistDevelopmentPath();
    return { ok: true };
  });

  ipcMain.on('linecraft:document-state', (event, value) => {
    if (!trusted(event) || !value || typeof value.dirty !== 'boolean' || typeof value.name !== 'string' || typeof value.text !== 'string') return;
    try {
      checkText(value.text);
      documentState = { dirty: value.dirty, name: safeName(value.name), text: value.text };
      if(discardAuthorization&&!discardAuthorized())discardAuthorization=null;
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
  mainWindow.webContents.on('did-start-loading',()=>nativeOpenQueue.rendererReset());
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

// Electron locks are scoped to the selected userData directory. The explicit
// test profile is selected above, so it never forwards to a normal-profile app.
// Legacy Node-only Electron mocks omit this API; a real Electron runtime cannot
// bypass the production lock through that compatibility branch or a user flag.
let primaryInstance=true;
if(typeof app.requestSingleInstanceLock==='function'){
  const profile=path.resolve(app.getPath('userData'));
  const launch=parseNativeLaunchArguments(process.argv,{packaged:app.isPackaged,entry:__filename,cwd:process.cwd()});
  primaryInstance=app.requestSingleInstanceLock({format:'LinecraftNativeLaunch/1',profile,requests:launch.requests});
  if(primaryInstance){
    nativeOpenQueue.enqueueRequests(launch.requests);
    app.on('second-instance',(_event,argv,cwd,additionalData)=>{
      try{
        let requests;
        if(additionalData&&typeof additionalData==='object'&&!Array.isArray(additionalData)&&additionalData.format==='LinecraftNativeLaunch/1'){
          if(Object.keys(additionalData).some(key=>!['format','profile','requests'].includes(key))||typeof additionalData.profile!=='string'||path.resolve(additionalData.profile).toLowerCase()!==profile.toLowerCase())throw Error('A drawing request from a different application profile was rejected.');
          requests=additionalData.requests;
        }else requests=parseNativeLaunchArguments(argv,{packaged:app.isPackaged,entry:__filename,cwd}).requests;
        nativeOpenQueue.enqueueRequests(requests);
      }catch{nativeOpenQueue.enqueueRequests([{kind:'error',name:'Open drawing',error:'The external drawing open request was invalid or belonged to another profile.'}]);}
      if(!HIDDEN_TEST&&mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();if(!mainWindow.isVisible())mainWindow.show();mainWindow.focus();}
    });
    app.on('open-file',(event,filename)=>{
      event.preventDefault();try{const destination=nativeDrawingPath(filename,process.cwd());nativeOpenQueue.enqueueRequests([{kind:'file',path:destination}]);}catch(error){nativeOpenQueue.enqueueRequests([{kind:'error',name:'Open drawing',error:error.message}]);}
    });
  }else app.quit();
}else if(process.versions.electron)throw Error('Electron single-instance support is required.');

if(primaryInstance)app.whenReady().then(async () => {
  await restoreDevelopmentPath(); configureSecurity(); registerIPC(); installMenu(); createWindow();
  // Scripting is opt-in. An ordinary launch never creates a control endpoint.
  const controlArgument=process.argv.find(argument=>argument.startsWith('--linecraft-control-file='));
  if(controlArgument){
    const {startScriptControl,createWindowDispatcher}=require('./script-control.cjs');
    try{
      const service=await startScriptControl({connectionFile:controlArgument.slice('--linecraft-control-file='.length),dispatch:createWindowDispatcher(()=>mainWindow)});
      console.log(`[Linecraft] Local scripting enabled: ${service.connectionFile}`);
      // close removes its owned descriptor synchronously before Electron can exit.
      app.once('will-quit',()=>{void service.close();});
    }catch(error){console.error(`[Linecraft] Local scripting unavailable: ${error.message}`);}
  }
  if (!app.isPackaged && !process.argv.includes('--linecraft-no-watch')) {
    const watcher = require('./dev-watch.cjs').watchDevelopment(APP_ROOT, () => mainWindow);
    app.once('will-quit', () => watcher.close());
  }
});
app.on('window-all-closed', () => app.quit());
