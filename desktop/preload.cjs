'use strict';

// A narrow, original bridge. The renderer never receives filesystem or Electron access.
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['new', 'open', 'save', 'save-as', 'export-dxf', 'plot', 'publish', 'undo', 'redo', 'fit', 'about', 'close', 'copy', 'cut', 'paste', 'copy-base']);
if (process.argv.includes('--linecraft-development')) {
  actions.add('dev-reload');
  contextBridge.exposeInMainWorld('linecraftDevelopment', true);
}

contextBridge.exposeInMainWorld('linecraftDesktop', Object.freeze({
  openDrawing: () => ipcRenderer.invoke('linecraft:open'),
  saveDrawing: (text, saveAs = false) => ipcRenderer.invoke('linecraft:save', text, saveAs),
  exportDXF: text => ipcRenderer.invoke('linecraft:export-dxf', text),
  plotPDF: payload => ipcRenderer.invoke('linecraft:plot-pdf', payload),
  publishPDF: payload => ipcRenderer.invoke('linecraft:publish-pdf', payload),
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
