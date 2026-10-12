'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Development only: renderer edits reload; main/preload edits require an explicit restart. */
function watchDevelopment(root, getWindow, {debounceMs = 180, log = console.log} = {}) {
  const rendererFiles = new Set(['app.mjs', 'core.mjs', 'units.mjs', '3d-view.mjs', 'advanced-geometry.mjs', 'dwg-import.mjs', 'plot-document.mjs', 'styles.css', 'index.html', 'favicon.svg']);
  const hostFiles = new Set(['main.cjs', 'preload.cjs', 'import-files.cjs', 'plot-files.cjs', 'dev-watch.cjs']);
  const pending = new Set();
  const watchers = [];
  let timer = null, closed = false;
  const flush = () => {
    timer = null;
    if (closed || !pending.size) return;
    const changed = [...pending].sort(); pending.clear();
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    log(`[Linecraft dev] Reloading renderer after: ${changed.join(', ')}. Drawing checkpoint will be restored.`);
    window.webContents.send('linecraft:action', 'dev-reload');
  };
  watchers.push(fs.watch(root, (_event, name) => {
    if (!name || !rendererFiles.has(String(name))) return;
    pending.add(String(name)); clearTimeout(timer); timer = setTimeout(flush, debounceMs);
  }));
  watchers.push(fs.watch(path.join(root, 'desktop'), (_event, name) => {
    if (name && hostFiles.has(String(name))) log(`[Linecraft dev] Host file changed: desktop/${name}. Restart launch-dev.cmd explicitly to load it; the development profile retains its drawing checkpoint.`);
  }));
  for (const watcher of watchers) watcher.on('error', error => log(`[Linecraft dev] Watch error: ${error.message}`));
  log('[Linecraft dev] Watching app/core/3D/import modules, styles, index, and original favicon. No installer is used.');
  return {close() {closed = true; clearTimeout(timer); for (const watcher of watchers) watcher.close();}};
}
module.exports = {watchDevelopment};
