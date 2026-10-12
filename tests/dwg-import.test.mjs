import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importDXF,decodeCADText,readDWGMetadata} from '../dwg-import.mjs';
import {createEditor,formatDimension} from '../core.mjs';
const record=(type,...groups)=>[0,type,...groups.flat()];
const file=(entities,tables=[],blocks=[],ending='\n')=>[0,'SECTION',2,'TABLES',...tables,0,'ENDSEC',0,'SECTION',2,'BLOCKS',...blocks,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...entities,0,'ENDSEC',0,'EOF'].join(ending)+ending;
const load=source=>{const r=importDXF(source);return{...r,document:JSON.parse(r.text)};};
const line=(a,b,layer='0')=>record('LINE',[8,layer],[10,a[0]],[20,a[1]],[30,a[2]??0],[11,b[0]],[21,b[1]],[31,b[2]??0]);

test('exact WCS LINE endpoints retain nonzero Z instead of flattening',()=>{
 const d=load(file([...line([0,0,0],[100,0,0]),...line([0,0,10],[100,60,30])])).document;
 assert.equal(d.workspace,'3d');assert.equal(d.entities[0].type,'LINE');assert.deepEqual(d.entities[1].points,[{x:0,y:0,z:10},{x:100,y:60,z:30}]);
});
test('GNU Windows CRCRLF transport leaves single-line annotation content unchanged',()=>{
 const e=load(file(record('TEXT',[10,1],[20,2],[40,5],[1,'Owned import']),[],[],'\r\r\n')).document.entities[0];assert.equal(e.text,'Owned import');
});

test('complete ellipses retain analytic conic geometry through nonuniform block scaling',()=>{
 const blocks=[...record('BLOCK',[2,'Oval'],[10,0],[20,0]),...record('ELLIPSE',[10,0],[20,0],[11,10],[21,0],[40,.5],[41,0],[42,2*Math.PI]),...record('ENDBLK')];
 const a=load(file(record('INSERT',[2,'Oval'],[10,100],[20,50],[41,2],[42,3],[43,1],[50,90]),[],blocks)).document.entities[0];assert.equal(a.type,'ELLIPSE');assert.deepEqual(a.center,{x:100,y:50});assert.ok(Math.abs(Math.hypot(a.major.x,a.major.y)-20)<1e-10);assert.ok(Math.abs(a.ratio-.75)<1e-10);
});
test('clamped cubic spline import retains exact control data and normalized knot intervals',()=>{
 const a=load(file(record('SPLINE',[70,8],[71,3],[72,8],[73,4],...[10,10,10,10,20,20,20,20].map(v=>[40,v]),[10,0],[20,0],[10,10],[20,30],[10,20],[20,30],[10,30],[20,0]))).document.entities[0];assert.equal(a.type,'SPLINE');assert.deepEqual(a.knots,[0,0,0,0,1,1,1,1]);assert.deepEqual(a.controlPoints,[{x:0,y:0},{x:10,y:30},{x:20,y:30},{x:30,y:0}]);
});
test('one solid polygonal hatch boundary imports as a fill, with explicit associativity warning',()=>{
 const a=load(file(record('HATCH',[10,0],[20,0],[30,0],[2,'SOLID'],[70,1],[71,0],[91,1],[92,2],[72,0],[73,1],[93,4],[10,0],[20,0],[10,10],[20,0],[10,10],[20,5],[10,0],[20,5],[97,0],[75,0],[76,1])));assert.equal(a.document.entities[0].type,'HATCH');assert.equal(a.document.entities[0].pattern,'solid');assert.equal(a.document.entities[0].boundary.points.length,4);assert.match(a.report.warnings[0].message,/nonassociative/);
});
test('legacy planar POLYLINE elevation is retained in XYZ coordinates',()=>{
 const a=load(file([...record('POLYLINE',[70,0],[10,0],[20,0],[30,25]),...record('VERTEX',[10,0],[20,0],[30,0]),...record('VERTEX',[10,10],[20,20],[30,0]),...record('SEQEND')])).document.entities[0];assert.equal(a.type,'POLY3D');assert.deepEqual(a.points,[{x:0,y:0,z:25},{x:10,y:20,z:25}]);
});
test('unsupported elliptical arcs and rational splines are reported alongside accepted geometry',()=>{
 const a=load(file([...line([0,0],[10,0]),...record('ELLIPSE',[10,0],[20,0],[11,10],[21,0],[40,.5],[41,0],[42,Math.PI]),...record('SPLINE',[70,4],[71,3])]));assert.equal(a.document.entities.length,1);assert.deepEqual(a.report.unsupportedByType,{ELLIPSE:1,SPLINE:1});
});

test('three-point angular dimensions import editable definitions with measured degree labels',()=>{
 const e=createEditor({entities:[{id:'angular',type:'DIMENSION',kind:'angular',vertex:{x:10,y:20},p1:{x:30,y:20},p2:{x:10,y:40},placement:{x:25,y:35},scale:1,style:'Standard'}]});const a=load(e.exportDXF());assert.equal(a.document.entities.length,1);assert.equal(a.document.entities[0].kind,'angular');assert.deepEqual(a.document.entities[0].vertex,{x:10,y:20});assert.equal(formatDimension(a.document.entities[0],a.document).measurement,90);assert.equal(a.report.unsupportedEntities,0);
});

test('DWG source flag metadata restores visible layers while ordinary DXF keeps negative color visibility',()=>{
 const converted=file(line([0,0],[10,0]),record('LAYER',[2,'0'],[62,-7],[70,0]));
 assert.equal(load(converted).document.layers[0].visible,false);
 const metadata=readDWGMetadata(JSON.stringify({created_by:'LibreDWG 0.13.4',FILEHEADER:{version:'AC1032'},OBJECTS:[{object:'LAYER',name:'0',flag0:1008}]}));const a=importDXF(converted,{dwgMetadata:metadata});assert.equal(JSON.parse(a.text).layers[0].visible,true);assert.equal(a.report.sourceLayerStatesFromDWG,true);assert.match(a.report.warnings[0].message,/restored from decoded DWG metadata/);
});
test('metadata preserves actual frozen/off/locked source states and rejects missing or malformed fields',()=>{
 const make=objects=>JSON.stringify({created_by:'LibreDWG 0.13.4',FILEHEADER:{version:'AC1032'},OBJECTS:objects});
 const a=readDWGMetadata(make([{object:'LAYER',name:'0',flag0:1008},{object:'LAYER',name:'Off',flag0:2},{object:'LAYER',name:'Frozen',flag0:1},{object:'LAYER',name:'Locked',flag0:8}]));assert.deepEqual(a.layers.map(l=>[l.name,l.visible,l.locked]),[['0',true,false],['Off',false,false],['Frozen',false,false],['Locked',true,true]]);
 assert.throws(()=>readDWGMetadata(make([{object:'LAYER',name:'0'}])),/flag metadata/);assert.throws(()=>readDWGMetadata(make([{object:'LAYER',name:'0',flag0:0},{object:'LAYER',name:'0',flag0:0}])),/duplicate/);assert.throws(()=>importDXF(file(line([0,0],[1,0])),{dwgMetadata:{layers:[{name:'Missing',visible:true,locked:false}]}}),/does not match/);
});
test('bounded ordinary block expansion respects source base, rotation, scale and layer inheritance',()=>{
 const blocks=[...record('BLOCK',[2,'OwnedBlock'],[10,10],[20,20]),...line([10,20],[20,20]),...record('ENDBLK')];
 const inserts=record('INSERT',[2,'OwnedBlock'],[8,'Geometry'],[10,100],[20,50],[41,2],[42,2],[43,2],[50,90]);
 const e=load(file(inserts,[],blocks)).document.entities[0];assert.equal(e.layer,'Geometry');assert.deepEqual(e.start,{x:100,y:50});assert.ok(Math.abs(e.end.x-100)<1e-12);assert.equal(e.end.y,70);
});
test('nested insert transforms preserve depth and report expanded block identity',()=>{
 const blocks=[...record('BLOCK',[2,'Inner'],[10,0],[20,0]),...line([0,0,0],[1,2,3]),...record('ENDBLK'),...record('BLOCK',[2,'Outer'],[10,0],[20,0]),...record('INSERT',[2,'Inner'],[10,10],[20,0],[30,5]),...record('ENDBLK')];
 const d=load(file(record('INSERT',[2,'Outer'],[10,100],[20,20],[30,30]),[],blocks));assert.deepEqual(d.document.entities[0].points,[{x:110,y:20,z:35},{x:111,y:22,z:38}]);assert.ok(d.report.warnings.some(w=>w.message.includes('expanded')));
});
test('cyclic blocks and truncated ASCII input fail instead of returning a misleading empty model',()=>{
 const blocks=[...record('BLOCK',[2,'Cycle'],[10,0],[20,0]),...record('INSERT',[2,'Cycle'],[10,0],[20,0]),...record('ENDBLK')];
 assert.throws(()=>load(file(record('INSERT',[2,'Cycle'],[10,0],[20,0]),[],blocks)),/Cyclic/);assert.throws(()=>load('0\nSECTION\n2\nENTITIES\n'),/truncated/);
});
test('nonuniform circles become explicitly reported polygonal geometry rather than a false analytic circle',()=>{
 const blocks=[...record('BLOCK',[2,'Ring'],[10,0],[20,0]),...record('CIRCLE',[10,0],[20,0],[40,10]),...record('ENDBLK')];
 const d=load(file(record('INSERT',[2,'Ring'],[10,0],[20,0],[41,2],[42,1]),[],blocks));const e=d.document.entities[0];assert.equal(e.type,'PLINE');assert.equal(e.points.length,72);assert.equal(Math.max(...e.points.map(p=>p.x)),20);assert.equal(Math.max(...e.points.map(p=>p.y)),10);assert.ok(d.report.warnings.some(w=>w.message.includes('polygonal')));
});
test('bulged polylines retain analytic arc geometry and disclose segmentation',()=>{
 const e=load(file(record('LWPOLYLINE',[70,0],[10,0],[20,0],[42,1],[10,10],[20,0]))).document.entities[0];assert.equal(e.type,'ARC');assert.deepEqual(e.center,{x:5,y:0});assert.equal(e.radius,5);assert.equal(e.sweepAngle,180);
});
test('literal MTEXT controls protected by empty groups stay literal while native formatting decodes',()=>{
 assert.equal(decodeCADText('50%{} | %{}%{}d | \\\\{}U+1234',true).text,'50% | %%d | \\U+1234');assert.equal(decodeCADText('First\\PSecond %%d',true).text,'First\nSecond °');
});
test('TEXT alignment uses source alignment point and original metric offset with an explicit warning',()=>{
 const d=load(file(record('TEXT',[10,0],[20,0],[11,100],[21,50],[72,1],[40,5],[1,'HH'])));const e=d.document.entities[0];assert.ok(e.position.x<100&&e.position.x>90);assert.equal(e.position.y,50);assert.ok(d.report.warnings.some(w=>w.message.includes('alignment')));
});
test('DXF three-dimensional faces retain finite XYZ topology and unsupported solids are counted',()=>{
 const face=record('3DFACE',[10,0],[20,0],[30,5],[11,10],[21,0],[31,5],[12,10],[22,10],[32,10],[13,0],[23,10],[33,10]);
 const d=load(file([...face,...record('3DSOLID',[1,'Owned unsupported data'])]));assert.equal(d.document.entities[0].type,'MESH');assert.equal(d.document.entities[0].vertices[2].z,10);assert.deepEqual(d.document.entities[0].faces,[[0,1,2,3]]);assert.equal(d.report.unsupportedByType['3DSOLID'],1);
});
test('external references are counted without following their paths; files containing only unsupported objects fail',()=>{
 const block=[...record('BLOCK',[2,'External'],[70,4],[10,0],[20,0],[1,'C:\\unrelated\\never-open.dwg']),...record('ENDBLK')];
 const d=load(file([...line([0,0],[1,1]),...record('INSERT',[2,'External'],[10,0],[20,0])],[],block));assert.equal(d.document.entities.length,1);assert.equal(d.report.unsupportedByType['INSERT-xref'],1);assert.throws(()=>load(file(record('3DSOLID',[1,'Owned unsupported']))),/no supported/);
});
test('source drawing linear and angular unit header fields preserve display choices without changing XYZ',()=>{
 const header=(linear,angular,precision=3)=>[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,1,9,'$LUNITS',70,linear,9,'$LUPREC',70,precision,9,'$AUNITS',70,angular,9,'$AUPREC',70,2,0,'ENDSEC'].join('\n')+'\n';
 for(const [linear,angular,linearFormat,angularFormat]of [[4,0,'architectural','decimal-degrees'],[3,1,'engineering','dms'],[3,3,'engineering','radians']]){
  const d=load(header(linear,angular)+file(line([0,0],[1200,12]))).document;
  assert.equal(d.settings.units,'in');assert.equal(d.settings.linearFormat,linearFormat);assert.equal(d.settings.angularFormat,angularFormat);assert.equal(d.settings.angularPrecision,angularFormat==='dms'?0:2);assert.deepEqual(d.entities[0].end,{x:1200,y:12});
  if(linear===4)assert.equal(d.settings.fractionPrecision,3);
 }
});
test('unsupported survey-bearing, grad and scientific source displays report bounded fallback and retain geometry',()=>{
 const header=angular=>[0,'SECTION',2,'HEADER',9,'$LUNITS',70,1,9,'$AUNITS',70,angular,0,'ENDSEC'].join('\n')+'\n';
 const bearing=load(header(4)+file(line([0,0],[10,20])));assert.equal(bearing.document.settings.angularFormat,'dms');assert.ok(bearing.report.warnings.some(w=>/bearing/.test(w.message)));assert.ok(bearing.report.warnings.some(w=>/linear display/.test(w.message)));
 const grad=load(header(2)+file(line([0,0],[10,20])));assert.equal(grad.document.settings.angularFormat,'decimal-degrees');assert.ok(grad.report.warnings.some(w=>/angular display/.test(w.message)));assert.deepEqual(grad.document.entities[0].end,{x:10,y:20});
});
