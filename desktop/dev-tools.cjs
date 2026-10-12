'use strict';
// Public source workflow. Native-reference evidence belongs to a separate internal gate.
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pins = {electron: '44.7.0', 'electron-builder': '26.15.3', playwright: '1.62.1'};

function dependency(name, entry) {
  const base = path.join(root, 'node_modules', name);
  if (!fs.existsSync(path.join(base, 'package.json'))) throw Error(`Run npm ci first: local ${name} is missing.`);
  const actual = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8')).version;
  if (actual !== pins[name]) throw Error(`${name} ${pins[name]} is pinned; found ${actual}. Run npm ci.`);
  const filename = path.join(base, entry);
  if (!fs.existsSync(filename)) throw Error(`Local ${name} runtime is incomplete. Run npm ci with dependency install scripts enabled.`);
  return filename;
}
function runtime() {
  if (process.platform !== 'win32') throw Error('The desktop host and Windows installer build require Windows x64. Pure npm test checks are portable.');
  return dependency('electron', 'dist/electron.exe');
}
function run(executable, args) {
  return new Promise((resolve, reject) => {
    const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(executable, args, {cwd: root, env, stdio: 'inherit', windowsHide: true});
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(`Check failed: ${path.basename(executable)} ${args.join(' ')} (${code ?? signal}).`)));
    const stop = () => child.kill();
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    child.once('exit', () => {process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);});
  });
}
const stages = [
  ['synthetic engine regression', ['tests/run-tests.mjs']],
  ['independent physical units and formatted dimensions', ['--test', 'tests/units-independent.test.mjs']],
  ['unit fields through mocked native IPC and real files', ['tests/units-security.test.cjs']],
  ['desktop IPC isolation and file boundaries', ['tests/desktop-unit.test.cjs']],
  ['restricted geometry clipboard transport', ['tests/clipboard-security.test.cjs']],
  ['annotation and drawing settings validation', ['tests/annotation-security.test.cjs']],
  ['independent mesh topology and volume', ['tests/mesh-v14.mjs']],
  ['mesh resource and IPC validation', ['tests/mesh-security.test.cjs']],
  ['independent curves, hatch and corner mathematics', ['--test', 'tests/advanced-independent.test.mjs']],
  ['advanced entity validation through mocked native IPC', ['tests/advanced-security.test.cjs']],
  ['vector sheet scale and bounded plot documents', ['--test', 'tests/plot-document.test.mjs']],
  ['isolated PDF host and file bounds', ['tests/plot-files.test.cjs']],
  ['PDF IPC authority and drawing association', ['tests/plot-ipc.test.cjs']],
  ['hidden startup and compositor preflight policy', ['tests/hidden-startup.test.cjs']],
  ['independent 3D projection and orbit mathematics', ['tests/projection3d.test.mjs']],
  ['DWG process isolation and failure handling', ['tests/import-files.test.cjs']],
  ['synthetic bounded DXF decoder', ['--test', 'tests/dwg-import.test.mjs']],
];
function sourceFiles(folder = root, prefix = '') {
  const result = [];
  for (const item of fs.readdirSync(folder, {withFileTypes: true})) {
    if (['node_modules', 'Windows-Release', 'work', '.git', '.linecraft-dev-profile'].includes(item.name)) continue;
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) result.push(...sourceFiles(path.join(folder, item.name), `${name}/`));
    else if (item.isFile() && !/-results\.json$|\.(?:png|log)$/.test(item.name)) result.push(name);
  }
  return result.sort();
}
function fingerprint(files) {
  return Object.fromEntries(files.map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')]));
}
function assertStable(report) {
  const after = fingerprint(Object.keys(report.sourceSHA256));
  const changed = Object.keys(after).filter(name => after[name] !== report.sourceSHA256[name]);
  if (changed.length) throw Error(`Source changed during public checks: ${changed.join(', ')}. Repeat the gate before building.`);
}
async function check(report, name, args) {
  const row = {name, status: 'running'}, started = Date.now(); report.stages.push(row);
  console.log(`\n[Public check ${report.stages.length}] ${name}`);
  try {await run(process.execPath, args); row.status = 'passed';}
  catch (error) {row.status = 'failed'; row.error = error.message; throw error;}
  finally {row.durationMs = Date.now() - started;}
}
async function publicGate(build) {
  const report = {scope: 'Public synthetic checks; excludes native AutoCAD corpora, user drawings and internal desktop release gate.',
    version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
    startedAt: new Date().toISOString(), node: process.version, sourceSHA256: fingerprint(sourceFiles()), stages: []};
  try {
    for (const [name, args] of stages) await check(report, name, args);
    if (build) {
      const executable = runtime(); dependency('playwright', 'index.js');
      await check(report, 'actual fixed reader version and complete licenses/source identities', ['tests/converter-identity.cjs']);
      await check(report, 'actual hidden desktop unit dialog, command input and persistence', ['tests/units-v15.cjs', executable, path.join(root, 'desktop/main.cjs'), 'public-units']);
      assertStable(report);
      await check(report, 'compile Windows x64 NSIS installer', [dependency('electron-builder', 'cli.js'), '--win', 'nsis', '--x64',
        `--config.electronDist=${path.dirname(executable)}`]);
    }
    assertStable(report); report.status = 'passed';
  } catch (error) {report.status = 'failed'; report.error = error.message; throw error;}
  finally {
    report.completedAt = new Date().toISOString();
    fs.mkdirSync(path.join(root, 'work'), {recursive: true});
    fs.writeFileSync(path.join(root, 'work/public-gate-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Public ${build ? 'build' : 'synthetic test'} gate: ${report.status}, ${report.stages.filter(s => s.status === 'passed').length}/${report.stages.length} stages.`);
  }
}
async function main() {
  const command = process.argv[2] || 'dev';
  if (command === 'test') return publicGate(false);
  if (command === 'build') return publicGate(true);
  if (command === 'dev') {
    const profile = path.join(root, '.linecraft-dev-profile'); fs.mkdirSync(profile, {recursive: true});
    return run(runtime(), [path.join(root, 'desktop/main.cjs'), `--user-data-dir=${profile}`]);
  }
  if (command === 'test-units') {
    dependency('playwright', 'index.js');
    return run(process.execPath, ['tests/units-v15.cjs', runtime(), path.join(root, 'desktop/main.cjs'), 'public-units']);
  }
  if (command === 'unpacked') return run(process.execPath, [dependency('electron-builder', 'cli.js'), '--win', '--x64', '--dir',
    `--config.electronDist=${path.dirname(runtime())}`]);
  throw Error('Use dev, test, test-units, unpacked or build.');
}
main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
