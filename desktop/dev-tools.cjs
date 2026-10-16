'use strict';
// Public synthetic workflow: no native drawings, private corpora or caches.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),pins={electron:'44.7.0','electron-builder':'26.15.3',playwright:'1.62.1'};
function dependency(name,entry){const base=path.join(root,'node_modules',name),manifest=path.join(base,'package.json');if(!fs.existsSync(manifest))throw Error(`Run npm ci first: local ${name} is missing.`);if(JSON.parse(fs.readFileSync(manifest)).version!==pins[name])throw Error(`${name} ${pins[name]} is pinned. Run npm ci.`);const file=path.join(base,entry);if(!fs.existsSync(file))throw Error(`Local ${name} is incomplete. Run npm ci with install scripts enabled.`);return file;}
function runtime(){if(process.platform!=='win32')throw Error('Desktop checks and installer builds require Windows x64. Pure npm test is portable.');return dependency('electron','dist/electron.exe');}
function run(executable,args){return new Promise((resolve,reject)=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(executable,args,{cwd:root,env,stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`Check failed (${code??signal}): ${path.basename(executable)} ${args.join(' ')}`)));const stop=()=>child.kill();process.once('SIGINT',stop);process.once('SIGTERM',stop);child.once('exit',()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);});});}
const pureStages=[
 ['structured revision scripting, R4 preservation and authenticated loopback control',['tests/run-scripting-tests.mjs']],
 ['synthetic engine regression',['tests/run-tests.mjs']],
 ['Roof + Space source, exact rooms, independent roof topology and runoff',['tests/run-architecture-tests.mjs']],
 ['Fixed-roof ceiling envelope, analytic volume, headroom and independent sections',['tests/run-clearance-tests.mjs']],
 ['Bounded stepped tray, exact containment, return clearance and accepted profile comparison',['tests/run-tray-tests.mjs']],
 ['Confirmed terminal gable topology, source integration and independent analytical checks',['tests/run-gable-tests.mjs']],
 ['Additive activation, ridge migration, source supports and atomic bearing integration',['tests/run-bearing-tests.mjs']],
 ['Bounded R6 alternatives, target-capped benefit, physical quantities and atomic source history',['tests/run-alternatives-tests.mjs']],
 ['Original source-only R6 room, linked bearings and locked common scales',['tests/export-alternatives-sample.mjs']],
 ['Roof + Space native-file schema and atomic validation',['tests/architecture-ipc.test.cjs']],
 ['regenerate and round-trip original source-only H sample',['tests/export-roof-sample.mjs']],
 ['regenerate and round-trip declared fixed-roof ceiling-space sample',['tests/export-clearance-sample.mjs']],
 ['regenerate and round-trip source-only tray ceiling sample',['tests/export-tray-sample.mjs']],
 ['regenerate and round-trip source-only confirmed gable example',['tests/export-gable-sample.mjs']],
 ['export and round-trip the source-only scripting review fixture',['tests/export-scripting-sample.mjs']],
 ['validate source-only analytical gable PDF fixture and locked plan/elevation sheets',['tests/export-roof-plot-sample.mjs']],
 ['validate source-only unequal-bearing fixture, migration and locked common scales',['tests/export-bearing-sample.mjs']],
 ['independent physical unit and dimension arithmetic',['--test','tests/units-independent.test.mjs']],
 ['unit IPC validation and real files',['tests/units-security.test.cjs']],
 ['independent paper scale, UCS and exact spatial-curve math',['--test','tests/layouts-independent.test.mjs']],
 ['paper/viewport/layer/plane IPC validation and real files',['tests/layouts-security.test.cjs']],
 ['independent viewport objects, clipping owner graphs and resize compensation',['tests/viewport-object-tests.mjs']],
 ['polygon viewport IPC schema, bounded resources and real Save/Open validation',['tests/viewport-security-v17.cjs']],
 ['physical viewport scale catalog, notation and XP factors',['--test','tests/viewport-scales.test.mjs']],
 ['independent architectural scale arithmetic and unchanged geometry',['tests/viewport-scales-tests.mjs']],
 ['viewport scale and XP IPC validation with real files',['tests/viewport-scales-security-v18.cjs']],
 ['original clipped-viewport DXF fixture export',['tests/export-viewport-v17.mjs']],
 ['desktop trust and native file boundaries',['tests/desktop-unit.test.cjs']],
 ['restricted geometry clipboard transport',['tests/clipboard-security.test.cjs']],
 ['annotation/settings validation',['tests/annotation-security.test.cjs']],
 ['independent mesh topology and volume',['tests/mesh-v14.mjs']],
 ['mesh IPC resource validation',['tests/mesh-security.test.cjs']],
 ['independent conic/cubic/hatch/corner math',['--test','tests/advanced-independent.test.mjs']],
 ['advanced schema and block resource validation',['tests/advanced-security.test.cjs']],
 ['vector plot documents and physical sheet arithmetic',['--test','tests/plot-document.test.mjs']],
 ['isolated PDF host and file bounds',['tests/plot-files.test.cjs']],
 ['PDF IPC trust and drawing association',['tests/plot-ipc.test.cjs']],
 ['hidden startup/compositor policy',['tests/hidden-startup.test.cjs']],
 ['independent camera and construction projection',['tests/projection3d.test.mjs']],
 ['DWG converter isolation and bounded failure handling',['tests/import-files.test.cjs']],
 ['synthetic bounded DXF decoder',['--test','tests/dwg-import.test.mjs']]
];
function sourceFiles(folder=root,prefix=''){const result=[];for(const item of fs.readdirSync(folder,{withFileTypes:true})){const name=prefix+item.name;if(['node_modules','Windows-Release','work','.git','.linecraft-dev-profile','__pycache__'].includes(item.name)||['tests/layout-pdf-v16','tests/viewport-pdf-v17','tests/viewport-scales-pdf-v18'].includes(name))continue;if(item.isDirectory())result.push(...sourceFiles(path.join(folder,item.name),name+'/'));else if(item.isFile()&&!/-results\.json$|\.log$/.test(name)&&!(name.startsWith('tests/')&&name.endsWith('.png')))result.push(name);}return result.sort();}
const fingerprint=files=>Object.fromEntries(files.map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
function assertStable(report){const after=fingerprint(Object.keys(report.sourceSHA256)),changed=Object.keys(after).filter(name=>after[name]!==report.sourceSHA256[name]);if(changed.length)throw Error(`Public sources changed: ${changed.join(', ')}. Repeat before building.`);}
async function check(report,name,args){const row={name,status:'running'},start=Date.now();report.stages.push(row);console.log(`[Public check ${report.stages.length}] ${name}`);try{await run(process.execPath,args);row.status='passed';}catch(error){row.status='failed';row.error=error.message;throw error;}finally{row.durationMs=Date.now()-start;}}
async function gate(command){const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,report={scope:'Public synthetic validation; no native CAD evidence, user drawings or internal release fixtures.',command,version,startedAt:new Date().toISOString(),node:process.version,sourceSHA256:fingerprint(sourceFiles()),stages:[]},start=Date.now();
 try{
  for(const[name,args]of pureStages)await check(report,name,args);
  if(command!=='test'){
   const executable=runtime(),entry=path.join(root,'desktop/main.cjs');dependency('playwright','index.js');
   await check(report,'actual fixed reader version and license/source identities',['tests/converter-identity.cjs']);
   await check(report,'actual hidden source units/coordinates/persistence',['tests/units-v15.cjs',executable,entry,'public-source-units']);
   await check(report,'actual hidden source layouts/viewport/layers/UCS',['tests/layouts-v16.cjs',executable,entry,'public-source-layouts']);
   await check(report,'actual hidden source rectangle/polygon selection, grips, commands and navigation',['tests/viewports-v17.cjs',executable,entry,'public-source-viewports']);
   await check(report,'actual hidden source active-command viewport pan and cursor-anchored zoom',['tests/viewport-regression-v17.cjs',executable,entry,'public-source-viewport-navigation']);
   await check(report,'actual hidden production paper PDF and unequal Publish sheets',['tests/run-layout-pdf-v16.cjs',executable]);
   await check(report,'actual hidden production polygon clipping and off-sheet vector PDF',['tests/run-viewport-pdf-v17.cjs',executable]);
   await check(report,'actual hidden source architectural and engineering scale choices, exact custom ratios and lock protection',['tests/viewport-scales-v18.cjs',executable,entry,'public-source-viewport-scales']);
   await check(report,'actual hidden source Roof + Space authoring, owner picking, Save/Open and grouped Undo',['tests/architecture-desktop.cjs',executable,entry,'public-source-architecture']);
   await check(report,'actual hidden source fixed-roof space study, ceiling adoption, reservations and sections',['tests/clearance-desktop.cjs',executable,entry,'public-source-clearance']);
   await check(report,'actual hidden source tray proposal, accepted profile, fixed roof and grouped Undo',['tests/tray-desktop.cjs',executable,entry,'public-source-tray']);
   await check(report,'actual hidden source confirmed terminal gable assignments, atomic edits and persistence',['tests/gable-desktop.cjs',executable,entry,'public-source-gable']);
   await check(report,'actual hidden source real CLI scripting, grouped history, native save and PDF',['tests/scripting-desktop.cjs',executable,entry,'public-source-scripting']);
   await check(report,'actual hidden source generated roof/closure PDF, locked physical scales and frozen layers',['tests/roof-plot-desktop.cjs',executable,entry,'public-source-roof-plot']);
   await check(report,'actual hidden source unequal-bearing draft/apply, grouped history and step/closure PDFs',['tests/bearing-desktop.cjs',executable,entry,'public-source-bearing']);
   await check(report,'actual hidden source R6 bounded search, review, grouped Apply, paper report, native files and PDFs',['tests/alternatives-desktop.cjs',executable,entry,'public-source-alternatives']);
   await check(report,'actual hidden production architectural preset PDF in four assigned model units',['tests/run-viewport-scales-pdf-v18.cjs',executable]);
   await check(report,'actual hidden source watched reload, Architecture draft deferral and recovery',['tests/dev-reload.cjs',executable,entry]);
   await check(report,'actual hidden isolated validator architecture-helper cache protection',['tests/dev-validator.cjs',executable]);
   assertStable(report);
   if(['unpacked','build'].includes(command)){
    const builder=dependency('electron-builder','cli.js'),out=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).build.directories.output,unpacked=path.join(root,out,'win-unpacked'),app=path.join(unpacked,'Linecraft CAD.exe');
    await check(report,'build unpacked Windows x64 application',[builder,'--publish','never','--win','--x64','--dir','--projectDir',root,`-c.electronDist=${path.dirname(executable)}`]);
    await check(report,'actual hidden unpacked unit workflow',['tests/units-v15.cjs',app,'','public-unpacked-units']);
    await check(report,'actual hidden unpacked layout/UCS workflow',['tests/layouts-v16.cjs',app,'','public-unpacked-layouts']);
    await check(report,'actual hidden unpacked rectangle/polygon viewport workflow',['tests/viewports-v17.cjs',app,'','public-unpacked-viewports']);
    await check(report,'actual hidden unpacked active-command viewport pan and zoom',['tests/viewport-regression-v17.cjs',app,'','public-unpacked-viewport-navigation']);
    await check(report,'actual hidden unpacked common viewport scales, XP input and protected lock workflow',['tests/viewport-scales-v18.cjs',app,'','public-unpacked-viewport-scales']);
    await check(report,'actual hidden unpacked Roof + Space modules, authoring and persistence',['tests/architecture-desktop.cjs',app,'','public-unpacked-architecture']);
    await check(report,'actual hidden unpacked fixed-roof space study, ceiling adoption and sections',['tests/clearance-desktop.cjs',app,'','public-unpacked-clearance']);
    await check(report,'actual hidden unpacked tray proposal, accepted source persistence and fixed roof',['tests/tray-desktop.cjs',app,'','public-unpacked-tray']);
    await check(report,'actual hidden unpacked confirmed terminal gable assignments and source persistence',['tests/gable-desktop.cjs',app,'','public-unpacked-gable']);
    await check(report,'actual hidden unpacked real CLI scripting, native save and PDF',['tests/scripting-desktop.cjs',app,'','public-unpacked-scripting']);
    await check(report,'actual hidden unpacked generated roof/closure PDFs and unchanged locked viewports',['tests/roof-plot-desktop.cjs',app,'','public-unpacked-roof-plot']);
    await check(report,'actual hidden unpacked unequal bearings, ridge migration and step/closure PDFs',['tests/bearing-desktop.cjs',app,'','public-unpacked-bearing']);
    await check(report,'actual hidden unpacked R6 bounded alternatives, source history, report and PDFs',['tests/alternatives-desktop.cjs',app,'','public-unpacked-alternatives']);
    await check(report,'packaged converter/license/source byte identities',['tests/converter-identity.cjs',path.join(unpacked,'resources/third-party/libredwg'),'public-unpacked-converter']);
    assertStable(report);
    if(command==='build')await check(report,'compile NSIS from tested unpacked application',[builder,'--publish','never','--win','nsis','--x64','--projectDir',root,'--prepackaged',unpacked]);
   }
  }
  assertStable(report);report.status='passed';
 }catch(error){report.status='failed';report.error=error.message;throw error;}
 finally{report.completedAt=new Date().toISOString();report.durationMs=Date.now()-start;report.passed=report.stages.filter(stage=>stage.status==='passed').length;report.failed=report.status==='passed'?0:Math.max(1,report.stages.filter(stage=>stage.status==='failed').length);fs.mkdirSync(path.join(root,'work'),{recursive:true});fs.writeFileSync(path.join(root,'work',`public-${command}-results.json`),JSON.stringify(report,null,2)+'\n');console.log(`Public ${command}: ${report.passed}/${report.stages.length} stages, ${report.status}.`);}
}
async function main(){const command=process.argv[2]||'dev';if(['test','desktop','unpacked','build'].includes(command))return gate(command);if(command==='dev'){const profile=path.join(root,'.linecraft-dev-profile');fs.mkdirSync(profile,{recursive:true});return run(runtime(),[path.join(root,'desktop/main.cjs'),`--user-data-dir=${profile}`]);}const focused={'test-units':'units-v15.cjs','test-layouts':'layouts-v16.cjs','test-viewports':'viewports-v17.cjs','test-viewport-navigation':'viewport-regression-v17.cjs','test-scales':'viewport-scales-v18.cjs','test-architecture':'architecture-desktop.cjs','test-space':'clearance-desktop.cjs','test-tray':'tray-desktop.cjs','test-gable':'gable-desktop.cjs','test-scripting':'scripting-desktop.cjs','test-roof-plot':'roof-plot-desktop.cjs','test-bearing':'bearing-desktop.cjs','test-alternatives':'alternatives-desktop.cjs'};if(focused[command]){dependency('playwright','index.js');return run(process.execPath,[`tests/${focused[command]}`,runtime(),path.join(root,'desktop/main.cjs'),`public-${command.slice(5)}`]);}if(['test-pdf','test-viewport-pdf','test-scales-pdf'].includes(command)){const producer={'test-pdf':'run-layout-pdf-v16.cjs','test-viewport-pdf':'run-viewport-pdf-v17.cjs','test-scales-pdf':'run-viewport-scales-pdf-v18.cjs'}[command];return run(process.execPath,['tests/'+producer,runtime()]);}throw Error('Use dev, test, desktop, test-units, test-layouts, test-viewports, test-viewport-navigation, test-scales, test-pdf, test-viewport-pdf, test-scales-pdf, test-architecture, test-space, test-tray, test-gable, test-scripting, test-roof-plot, test-bearing, test-alternatives, unpacked or build.');}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
