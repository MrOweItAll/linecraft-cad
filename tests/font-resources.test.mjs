import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createEditor,clearFontMetrics} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {syntheticArchitecturalFontDrawing} from './font-layout-fixture.mjs';
const {createFontMetricsService}=createRequire(import.meta.url)('../desktop/drawing-resources.cjs');
const noIO=()=>{throw Error('Unexpected resource I/O');};
const base={platform:'win32',systemRoot:path.resolve('synthetic-system-root'),userHome:path.resolve('synthetic-user-root'),localAppData:path.resolve('synthetic-app-root'),parseTrueTypeMetrics:noIO};
const forbiddenFS={realpath:noIO,stat:noIO,readFile:noIO};

test('unsupported font family is rejected before any registry or file access',async()=>{
  const service=createFontMetricsService({...base,fs:forbiddenFS,execFile:noIO});
  await assert.rejects(service.getFontMetrics({families:['Unsupported Synthetic Face']}),/Unsupported font family/);
});

test('missing registrations remain unavailable without filesystem reads',async()=>{
  let queries=0;
  const service=createFontMetricsService({...base,fs:forbiddenFS,execFile:(_exe,args,_options,done)=>{queries++;assert.deepEqual(args.slice(0,1),['query']);done(null,'');}});
  const result=await service.getFontMetrics({families:['ARCHITXT','Technic']});
  assert.equal(queries,2);assert.equal(result.ok,true);assert.equal(result.fonts.length,2);
  for(const row of result.fonts){assert.equal(row.available,false);assert.match(row.diagnostic,/not registered/);assert.equal(Object.hasOwn(row,'metrics'),false);assert.equal(Object.hasOwn(row,'sha256'),false);}
});

test('unreadable inventory reports unverified registration without leaking raw errors',async()=>{
  const service=createFontMetricsService({...base,fs:forbiddenFS,execFile:(_exe,_args,_options,done)=>done(Error('DO_NOT_EXPORT_PRIVATE_SENTINEL'))});
  const result=await service.getFontMetrics({families:['Technic']});
  assert.equal(result.fonts[0].available,false);assert.match(result.fonts[0].diagnostic,/could not be verified/);
  assert.ok(result.diagnostics.some(x=>/HKLM/.test(x)));assert.ok(result.diagnostics.some(x=>/HKCU/.test(x)));
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPORT_PRIVATE_SENTINEL/);
});

test('a cached profile cannot survive a removed registration on the next inventory',async()=>{
  let registered=true,reads=0,parses=0;
  const bytes=Buffer.alloc(12,7); // Synthetic service input; no installed font bytes.
  const fs={realpath:async file=>file,stat:async()=>({isFile:()=>true,size:12,mtimeMs:1}),readFile:async()=>{reads++;return bytes;}};
  const profile={version:1,unitsPerEm:1000,capHeight:700,mtextCapHeight:700,ascent:800,descent:-200,lineGap:0,cmap:[[72,1]],advances:[500,600],kerning:[],symbol:false};
  const service=createFontMetricsService({...base,fs,parseTrueTypeMetrics:()=>{parses++;return profile;},execFile:(_exe,_args,_options,done)=>done(null,registered?'    Technic (TrueType)    REG_SZ    technic_.ttf\n':'')});
  const first=await service.getFontMetrics({families:['Technic']});
  assert.equal(first.fonts[0].available,true);assert.deepEqual(first.fonts[0].metrics,profile);
  assert.equal(first.fonts[0].sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(reads,1);assert.equal(parses,1);
  registered=false;
  const second=await service.getFontMetrics({families:['Technic']});
  assert.equal(second.fonts[0].available,false);assert.match(second.fonts[0].diagnostic,/not registered/);
  assert.equal(Object.hasOwn(second.fonts[0],'metrics'),false);assert.equal(Object.hasOwn(second.fonts[0],'sha256'),false);assert.equal(reads,1);assert.equal(parses,1);
});

test('unavailable metric profiles warn without changing requested architectural font names or drawing',()=>{
  clearFontMetrics();
  const editor=createEditor(syntheticArchitecturalFontDrawing()),before=editor.serialize();
  const plotted=buildPlotHTML([{title:'Synthetic architectural fonts',text:before}],{options:{space:'layout',layoutId:'font-sheet'}});
  assert.equal(plotted.report.warnings.filter(x=>/approximate text metrics.*unavailable/.test(x)).length,3);
  assert.match(plotted.previewSVG,/font-family="ARCHITXT"/);assert.match(plotted.previewSVG,/font-family="Technic"/);
  assert.equal(editor.serialize(),before);assert.equal(JSON.parse(before).textStyles.find(s=>s.name==='Measured Technic').fontFamily,'Technic');
});
