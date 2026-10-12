/* Independently authored v1.5 unit invariants; no native desktop control. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLength,parseAngle,formatLength,formatAngle,formatArea,UNIT_PRESETS,dxfUnitFormat} from '../units.mjs';
import {createEditor,parseCoordinate,parseCoordinate3D,formatDimension} from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {importDXF} from '../dwg-import.mjs';
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} differs from ${b}`);
const run=(editor,inputs)=>{for(const text of inputs){const result=editor.execute(text);assert.equal(result.ok,true,`${text}: ${result.message}`);}return editor.state;};
const presets=()=>Object.fromEntries(Object.entries(UNIT_PRESETS).map(([k,v])=>[k,{...v}]));

test('native DMS seconds precision starts at4 and reports the four-decimal interchange limit',()=>{
 for(let secondsPlaces=0;secondsPlaces<=8;secondsPlaces++){
  const settings={...UNIT_PRESETS.surveyor,angularPrecision:secondsPlaces},format=dxfUnitFormat(settings);
  assert.equal(format.auprec,Math.min(8,secondsPlaces+4));
  assert.equal(format.warnings.some(w=>/four decimal/.test(w)),secondsPlaces>4);
  const editor=createEditor({settings});run(editor,['LINE','0,0','1,0','']);const restored=JSON.parse(importDXF(editor.exportDXF()).text);
  assert.equal(restored.settings.angularPrecision,Math.min(4,secondsPlaces));
 }
});

test('three requested presets assign inches and separate linear/angular presentation',()=>{
 const p=presets();for(const key of ['architectural','surveyor','engineering'])assert.equal(p[key].units,'in');
 assert.equal(p.architectural.linearFormat,'architectural');assert.equal(p.surveyor.linearFormat,'engineering');assert.equal(p.surveyor.angularFormat,'dms');assert.equal(p.engineering.linearFormat,'engineering');assert.equal(p.engineering.angularFormat,'decimal-degrees');
 assert.ok(Object.isFrozen(UNIT_PRESETS));
});
test('straight, curly and prime feet/inch markers convert physically in every model unit',()=>{
 for(const text of ["100'",'100’','100′','100 ft','100ft'])for(const [units,expected]of [['in',1200],['ft',100],['m',30.48],['cm',3048],['mm',30480],['unitless',1200]])near(parseLength(text,{units}),expected);
 for(const text of ['12"','12”','12″','12 in']){near(parseLength(text,{units:'in'}),12);near(parseLength(text,{units:'m'}),.3048);}
 near(parseLength('1m',{units:'in'}),39.37007874015748);near(parseLength('2.54cm',{units:'in'}),1);
});
test('mixed imperial fractions and signs are complete values, never evaluated expressions',()=>{
 for(const text of ["5'6 1/2\"","5'-6-1/2\"",'5’ 6 1/2”'])near(parseLength(text,{units:'in'}),66.5);
 near(parseLength('-5\'6 1/2"',{units:'in'}),-66.5);near(parseLength('1/2"',{units:'in'}),.5);near(parseLength('1.25e2 ft',{units:'in'}),1500);
 for(const text of ['1/0"','12""','NaN','1e309ft','1 m cm','--2"','5\'6”junk','globalThis.owned()'])assert.throws(()=>parseLength(text,{units:'in'}),undefined,text);
});
test('angular context treats primes as minutes/seconds while length context treats them as feet/inches',()=>{
 near(parseLength("12'",{units:'in'}),144);near(parseAngle("12'"),.2);near(parseLength('12"',{units:'in'}),12);near(parseAngle('12"'),1/300);
 near(parseAngle('45d30\'15"'),45.504166666666666);near(parseAngle('45°30′15″'),45.504166666666666);near(parseAngle('-45d30\'15"'),-45.504166666666666);
 near(parseAngle('1.5707963267948966rad'),90);near(parseAngle('90deg'),90);near(parseAngle('5400',{angularInputUnit:'minutes'}),90);near(parseAngle('324000',{angularInputUnit:'seconds'}),90);near(parseAngle('1.5707963267948966',{angularInputUnit:'radians'}),90);
 for(const text of ['45d60\'0"','45d0\'60"','90radjunk','1e309deg','12ft'])assert.throws(()=>parseAngle(text),undefined,text);
});
test('unit-aware Cartesian, relative, polar and XYZ input has exact model coordinates',()=>{
 const inch={units:'in',angularInputUnit:'radians'};
 assert.deepEqual(parseCoordinate('100’,12”',undefined,inch),{x:1200,y:12});
 assert.deepEqual(parseCoordinate('@5\'6 1/2",-12”',{x:10,y:20},inch),{x:76.5,y:8});
 const p=parseCoordinate('@100’<1.5707963267948966',{x:1,y:2},inch);near(p.x,1);near(p.y,1202);
 assert.deepEqual(parseCoordinate3D('@1’,2’,3’',{x:1,y:2,z:3},inch),{x:13,y:26,z:39});
 assert.throws(()=>parseCoordinate('1’,2’,3’',undefined,inch),/Z|XY/);
});
test('architectural fractions and engineering decimals carry correctly at a foot boundary',()=>{
 const arch={units:'in',linearFormat:'architectural',fractionPrecision:4};
 assert.equal(parseLength(formatLength(66.5,arch),arch),66.5);assert.equal(parseLength(formatLength(11.999,arch),arch),12);
 const eng={units:'in',linearFormat:'engineering',precision:3};near(parseLength(formatLength(11.99996,eng,{trim:false}),eng),12);near(parseLength(formatLength(-.5,eng,{trim:false}),eng),-.5);
 const metricArch={...arch,units:'m'};near(parseLength(formatLength(.3048,metricArch),metricArch),.3048);
});
test('all requested angle displays round-trip without confusing input defaults',()=>{
 for(const angularFormat of ['decimal-degrees','dms','radians','decimal-minutes','decimal-seconds']){
  const settings={angularFormat,angularInputUnit:'radians',angularPrecision:6};near(parseAngle(formatAngle(45.5,settings,{trim:false}),settings),45.5,1e-6);
 }
 const dms={angularFormat:'dms',angularPrecision:2};near(parseAngle(formatAngle(1-0.0002/3600,dms),dms),1);
 assert.ok(formatArea(144,{units:'in',linearFormat:'architectural',precision:2}).includes('1'));
});
test('presets and unit changes are one undoable drawing preference without resizing accepted geometry',()=>{
 const e=createEditor();run(e,['L','0,0','1200,0','']);const geometry=structuredClone(e.state.entities),old=structuredClone(e.state.settings);
 assert.equal(e.updateDrawingSettings(UNIT_PRESETS.architectural).ok,true);assert.deepEqual(e.state.entities,geometry);assert.equal(e.state.settings.units,'in');
 assert.equal(e.undo().ok,true);assert.deepEqual(e.state.settings,old);assert.deepEqual(e.state.entities,geometry);assert.equal(e.redo().ok,true);assert.equal(e.state.settings.linearFormat,'architectural');
 const reopened=createEditor(JSON.parse(e.serialize()));assert.deepEqual(reopened.state.settings,e.state.settings);assert.deepEqual(reopened.state.entities,geometry);
});
test('command distances, 3D heights and polar angles use assigned units while scale stays dimensionless',()=>{
 const e=createEditor({settings:UNIT_PRESETS.engineering});run(e,['L','0,0','@100’<0','','C','0,0','12”','BOX','0,0,0','1’,2’,0','3’']);
 assert.deepEqual(e.state.entities[0].end,{x:1200,y:0});assert.equal(e.state.entities[1].radius,12);assert.equal(Math.max(...e.state.entities[2].vertices.map(p=>p.z)),36);
 e.setWorkspace('2d');run(e,['SCALE',e.state.entities[0].id,'','0,0']);const before=structuredClone(e.state.entities);assert.equal(e.execute('2’').ok,false);assert.deepEqual(e.state.entities,before);assert.equal(e.execute('2').ok,true);assert.equal(e.state.entities[0].end.x,2400);
});
test('malformed units preserve the active prompt, accepted geometry and valid recovery',()=>{
 const e=createEditor({settings:UNIT_PRESETS.architectural});run(e,['CIRCLE','0,0']);const before=JSON.stringify(e.state.entities);
 assert.equal(e.execute('12”oops').ok,false);assert.equal(JSON.stringify(e.state.entities),before);assert.equal(e.execute('12”').ok,true);assert.equal(e.state.entities[0].radius,12);
 const s=structuredClone(e.state.settings);assert.equal(e.updateDrawingSettings({angularInputUnit:'ft'}).ok,false);assert.deepEqual(e.state.settings,s);
});
test('linear and angular dimensions inherit format but retain independent geometric measurements',()=>{
 const e=createEditor({settings:UNIT_PRESETS.architectural});run(e,['DIMLINEAR','0,0','100’,0','50’,-12”']);const dim=e.state.entities[0],formatted=formatDimension(dim,e.state);assert.equal(formatted.measurement,1200);assert.match(formatted.label,/100'/);
 const s=createEditor({settings:UNIT_PRESETS.surveyor});run(s,['DIMANGULAR','0,0','10,0','0,10','5,5']);const angle=formatDimension(s.state.entities[0],s.state);assert.equal(angle.measurement,90);assert.match(angle.label,/90(?:d|°).*'/);
});
test('an architectural 100-foot line plots at 30.48mm for exact scale1:1000',()=>{
 const e=createEditor({settings:UNIT_PRESETS.architectural});run(e,['L','0,0','100’,0','']);const out=buildPlotHTML([{title:'Unit test',text:e.serialize()}],{options:{scaleMode:'scale',ratio:1000}});
 assert.equal(out.report.plotScaleMmPerUnit,.0254);const path=out.previewSVG.match(/d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/);assert.ok(path);near(Math.abs(Number(path[3])-Number(path[1])),30.48);
});
test('DXF preserves requested preset headers and decoded unit preferences without changing vertices',()=>{
 for(const key of ['architectural','surveyor','engineering']){
  const e=createEditor({settings:UNIT_PRESETS[key]});run(e,['L','0,0','100’,0','']);const dxf=e.exportDXF(),r=importDXF(dxf),d=JSON.parse(r.text);
  assert.equal(d.settings.units,'in');assert.equal(d.settings.linearFormat,UNIT_PRESETS[key].linearFormat);assert.equal(d.settings.angularFormat,UNIT_PRESETS[key].angularFormat);assert.deepEqual(d.entities[0].end,{x:1200,y:0});
 }
});

test('single quoted LINE length follows an explicit direction and preserves coordinates and Undo',()=>{
 const e=createEditor({settings:UNIT_PRESETS.architectural});run(e,['LINE','10,20']);assert.equal(e.execute('100’',{direction:{x:0,y:1}}).ok,true);assert.deepEqual(e.state.entities[0].end,{x:10,y:1220});
 assert.equal(e.execute('12”').ok,true);assert.deepEqual(e.state.entities[1].end,{x:10,y:1232});assert.equal(e.execute('').ok,true);assert.equal(e.undo().ok,true);assert.equal(e.state.entities.length,0);assert.equal(e.redo().ok,true);assert.deepEqual(e.state.entities[1].end,{x:10,y:1232});
});
test('DXF angular style precision and fractional display survive independent import with exact definitions',()=>{
 const s=createEditor({settings:UNIT_PRESETS.surveyor});const style={...s.state.dimStyles[0],angularPrecision:3};assert.equal(s.updateDrawingSettings({dimStyles:[style]}).ok,true);
 run(s,['DIMANGULAR','0,0','10,0','0,10','5,5']);const result=importDXF(s.exportDXF()),document=JSON.parse(result.text),dimension=document.entities.find(e=>e.type==='DIMENSION');
 assert.equal(document.dimStyles.find(style=>style.name===dimension.style).angularPrecision,3);assert.equal(formatDimension(dimension,document).label,formatDimension(s.state.entities[0],s.state).label);
 const a=createEditor({settings:UNIT_PRESETS.architectural});assert.equal(a.updateDrawingSettings({dimStyles:[{...a.state.dimStyles[0],fractionPrecision:5}]}).ok,true);run(a,['DIMLINEAR','0,0','12.03125,0','6,-3']);
 const imported=JSON.parse(importDXF(a.exportDXF()).text),linear=imported.entities.find(e=>e.type==='DIMENSION');assert.equal(imported.dimStyles.find(style=>style.name===linear.style).fractionPrecision,5);assert.equal(formatDimension(linear,imported).label,formatDimension(a.state.entities[0],a.state).label);
});
