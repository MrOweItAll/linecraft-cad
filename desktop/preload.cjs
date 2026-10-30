'use strict';

// A narrow, original bridge. The renderer never receives filesystem or Electron access.
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['new', 'open', 'save', 'save-as', 'export-dxf', 'plot', 'publish', 'undo', 'redo', 'fit', 'about', 'close', 'copy', 'cut', 'paste', 'copy-base']);
if (process.argv.includes('--linecraft-development')) {
  actions.add('dev-reload');
  contextBridge.exposeInMainWorld('linecraftDevelopment', true);
}

contextBridge.exposeInMainWorld('linecraftDesktop', Object.freeze({
  ...(process.argv.includes('--linecraft-development')?{developmentRecovery:payload=>ipcRenderer.invoke('linecraft:development-recovery',payload)}:{}),
  openRequest: payload => ipcRenderer.invoke('linecraft:open-request',payload),
  onOpenRequest(callback) {
    if(typeof callback!=='function')throw new TypeError('An open request callback is required.');
    const listener=(_event,request)=>{if(request&&typeof request==='object'&&Object.keys(request).every(key=>['id','name'].includes(key))&&typeof request.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(request.id)&&typeof request.name==='string'&&request.name.length<=255)callback({id:request.id,name:request.name});};
    ipcRenderer.on('linecraft:open-requested',listener);
    return()=>ipcRenderer.removeListener('linecraft:open-requested',listener);
  },
  openDrawing: () => ipcRenderer.invoke('linecraft:open'),
  getFontMetrics: payload => ipcRenderer.invoke('linecraft:font-metrics', payload),
  chooseImageResource: payload => ipcRenderer.invoke('linecraft:image-resource-choose', payload),
  saveDrawing: (text, saveAs = false) => ipcRenderer.invoke('linecraft:save', text, saveAs),
  exportDXF: (text,assets) => assets===undefined?ipcRenderer.invoke('linecraft:export-dxf', text):ipcRenderer.invoke('linecraft:export-dxf', text,assets),
  plotPDF: payload => ipcRenderer.invoke('linecraft:plot-pdf', payload),
  publishPDF: payload => ipcRenderer.invoke('linecraft:publish-pdf', payload),
  exportStructuralRoofRequest: payload => ipcRenderer.invoke('linecraft:structural-export', payload),
  importStructuralRoofResult: payload => ipcRenderer.invoke('linecraft:structural-import', payload),
  loadStructuralRoofRequest: payload => ipcRenderer.invoke('linecraft:structural-request-load', payload),
  readGeometryClipboard: () => ipcRenderer.invoke('linecraft:clipboard-read'),
  writeGeometryClipboard: data => ipcRenderer.invoke('linecraft:clipboard-write', data),
  editText: action => ipcRenderer.invoke('linecraft:text-edit', action),
  confirmDiscard: name => ipcRenderer.invoke('linecraft:confirm-discard', name),
  setDocumentState: state => ipcRenderer.send('linecraft:document-state', state),
  resetDocumentPath: () => ipcRenderer.invoke('linecraft:reset-path'),
  allowClose: () => ipcRenderer.send('linecraft:allow-close'),
  onAction(callback) {
    if (typeof callback !== 'function') throw new TypeError('An action callback is required.');
    const listener = (_event, action) => { if (typeof action === 'string' && actions.has(action)) callback(action); };
    ipcRenderer.on('linecraft:action', listener);
    return () => ipcRenderer.removeListener('linecraft:action', listener);
  },
}));
