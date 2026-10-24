import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {importDXF as candidate} from '../dwg-import.mjs';
import {createEditor,triangulatePolygon,hatchGeometry} from '../core.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const record=(type,...groups)=>[0,type,...groups.flat()];
const file=(entities,{tables=[],blocks=[],objects=[]}={})=>[0,'SECTION',2,'TABLES',...tables,0,'ENDSEC',0,'SECTION',2,'BLOCKS',...blocks,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...entities,0,'ENDSEC',0,'SECTION',2,'OBJECTS',...objects,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
const sentinel=record('LINE',[8,'Independent'],[10,-100],[20,-100],[11,-90],[21,-100]);
const rectangle=[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:0,y:5}];
const asPoints=points=>points.flatMap(p=>[[10,p.x],[20,p.y],...(p.bulge===undefined?[]:[[42,p.bulge]])]);
const hatch=(points,{handle='A1',layer='Fill',count=points.length,closed=1,loops=1,elevation=0,normal=[0,0,1],after=[],extra=[]}={})=>record('HATCH',[5,handle],[8,layer],[10,0],[20,0],[30,elevation],[210,normal[0]],[220,normal[1]],[230,normal[2]],[2,'SOLID'],[70,1],[71,0],...extra,[91,loops],[92,2],[72,points.some(p=>p.bulge)?1:0],[73,closed],[93,count],...asPoints(points),[97,0],...after,[75,0],[76,1]);
const load=(source,implementation=candidate)=>{const imported=implementation(source);return {...imported,document:JSON.parse(imported.text)};};
const withFill=(points,options={})=>file([...sentinel,...hatch(points,options)]);
const fills=doc=>[...doc.entities,...doc.layouts.flatMap(l=>l.entities)].filter(e=>e.type==='HATCH');
const normalizedWarning=a=>a.report.warnings.find(w=>w.message.startsWith('Exact duplicate adjacent/closing'));
const assertReject=(points,options={},pattern)=>{const a=load(withFill(points,options));assert.equal(fills(a.document).length,0);assert.equal(a.document.entities.length,1);assert.deepEqual(a.report.unsupportedByType,{HATCH:1});assert.equal(normalizedWarning(a),undefined,'Rejected hatches must not claim normalization succeeded');if(pattern)assert.match(a.report.warnings.find(w=>w.message.includes('cannot be represented')).message,pattern);};
const sameCanonical=(points,canonical=rectangle,options={})=>{const a=load(withFill(points,options)),b=load(withFill(canonical,options));assert.deepEqual(a.document.entities,b.document.entities);assert.equal(a.report.unsupportedEntities,0);assert.equal(normalizedWarning(a)?.count,1);return a;};
const area=points=>Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.y-q.x*p.y;},0))/2;

test('duplicate closing vertex imports a solid fill without changing unrelated line',()=>{
 const after=sameCanonical([...rectangle,rectangle[0]]);
 assert.equal(fills(after.document).length,1);assert.equal(after.document.entities.length,2);
 assert.deepEqual(after.document.entities[0].start,{x:-100,y:-100});assert.deepEqual(after.document.entities[0].end,{x:-90,y:-100});
 assert.deepEqual(fills(after.document)[0].boundary.points,[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:0,y:5}]);assert.equal(area(fills(after.document)[0].boundary.points),50);
});
test('consecutive interior repetitions compact without reordering or moving source points',()=>sameCanonical([rectangle[0],rectangle[1],rectangle[1],rectangle[2],rectangle[3]]));
test('repeated first, middle and closing runs reduce only zero-length edges',()=>sameCanonical([rectangle[0],rectangle[0],rectangle[1],rectangle[1],rectangle[2],rectangle[2],rectangle[3],rectangle[0],rectangle[0]]));
test('already valid straight fill is exactly unchanged and receives no normalization warning',()=>{
 const a=load(withFill(rectangle)),fill=fills(a.document)[0];assert.deepEqual(fill.boundary.points,[{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:0,y:5}]);assert.equal(fill.pattern,'solid');assert.equal(fill.layer,'Fill');assert.equal(area(fill.boundary.points),50);assert.equal(a.document.entities[0].type,'LINE');assert.equal(normalizedWarning(a),undefined);
});
test('clockwise concave boundaries retain exact vertex order and area',()=>{
 const p=[{x:0,y:8},{x:3,y:8},{x:3,y:3},{x:8,y:3},{x:8,y:0},{x:0,y:0}];const a=sameCanonical([...p,p[0]],p),e=fills(a.document)[0];assert.deepEqual(e.boundary.points,p);assert.equal(area(e.boundary.points),39);assert.equal(hatchGeometry(e).fills.length,1);triangulatePolygon(e.boundary.points);
});
test('nearby but unequal coordinates remain distinct',()=>{
 const p=[{x:0,y:0},{x:10,y:0},{x:10.000001,y:0.000001},{x:10,y:5},{x:0,y:5}];const a=sameCanonical([...p,p[0]],p);assert.deepEqual(fills(a.document)[0].boundary.points,p);assert.equal(fills(a.document)[0].boundary.points.length,5);
});
test('negative-Z OCS mirroring agrees exactly with supported canonical import',()=>sameCanonical([...rectangle,rectangle[0]],rectangle,{normal:[0,0,-1]}));
test('nonzero XY offsets retain every stored coordinate',()=>{
 const p=rectangle.map(p=>({x:p.x+1e8+0.125,y:p.y-1e8-0.25}));const a=sameCanonical([...p,p[0]],p);assert.deepEqual(fills(a.document)[0].boundary.points,p);
});
test('block transforms agree with independent unchanged canonical import',()=>{
 const block=(p)=>[...record('BLOCK',[2,'OwnedFill'],[10,2],[20,3]),...hatch(p),...record('ENDBLK')],insert=record('INSERT',[2,'OwnedFill'],[8,'BlockLayer'],[10,100],[20,200],[41,-2],[42,3],[43,1],[50,90]);
 const a=load(file([...sentinel,...insert],{blocks:block([...rectangle,rectangle[0]])})),b=load(file([...sentinel,...insert],{blocks:block(rectangle)}));assert.deepEqual(a.document.entities,b.document.entities);const points=fills(a.document)[0].boundary.points;const expected=[{x:109,y:204},{x:109,y:184},{x:94,y:184},{x:94,y:204}];for(let i=0;i<4;i++)for(const key of ['x','y'])assert.ok(Math.abs(points[i][key]-expected[i][key])<1e-10);assert.equal(area(points),300);assert.equal(normalizedWarning(a)?.count,1);
});
test('paper-space owner and millimeter frame remain intact during normalization',()=>{
 const objects=record('LAYOUT',[2,'Owned plot device'],[4,'Owned media'],[72,1],[44,420],[45,297],[100,'AcDbLayout'],[1,'Sheet A'],[71,1],[330,'B0']);
 const paper=p=>file([...sentinel,...hatch(p,{extra:[[67,1],[410,'Sheet A'],[330,'B0']]})],{objects});const a=load(paper([...rectangle,rectangle[0]])),b=load(paper(rectangle));assert.deepEqual(a.document,b.document);assert.equal(a.document.layouts.length,1);assert.equal(a.document.layouts[0].entities.filter(e=>e.type==='HATCH').length,1);assert.equal(a.document.entities.filter(e=>e.type==='HATCH').length,0);assert.equal(a.document.layouts[0].paper.widthMm,420);
});
test('normalization is reported per successfully imported hatch',()=>{
 const a=load(file([...sentinel,...hatch([...rectangle,rectangle[0]],{handle:'A1'}),...hatch([rectangle[0],rectangle[1],rectangle[1],rectangle[2],rectangle[3]],{handle:'A2'}),...hatch(rectangle,{handle:'A3'})]));assert.equal(fills(a.document).length,3);assert.equal(normalizedWarning(a).count,2);assert.equal(a.report.warnings.find(w=>w.message.includes('nonassociative')).count,3);
});
test('single grouped native import has exact complete Undo/Redo and serialization',()=>{
 const a=load(withFill([...rectangle,rectangle[0]])),editor=createEditor(),before=editor.serialize();assert.equal(editor.importJSON(a.text).ok,true);const accepted=editor.serialize();assert.deepEqual(JSON.parse(accepted),a.document);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),accepted);assert.equal(createEditor(JSON.parse(accepted)).serialize(),accepted);
});
test('all-coincident boundary remains rejected',()=>assertReject(Array(5).fill({x:3,y:4}),{},/3\.\.4096|degenerate/));
test('two distinct vertices after exact closure reduction remain rejected',()=>assertReject([{x:0,y:0},{x:10,y:0},{x:0,y:0}],{},/3\.\.4096/));
test('collinear zero-area boundary remains rejected',()=>assertReject([{x:0,y:0},{x:3,y:0},{x:8,y:0},{x:0,y:0}],{},/zero|simple/));
test('self crossing remains rejected after redundant closure removal',()=>assertReject([{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0},{x:0,y:0}],{},/simple/));
test('nonadjacent repeated vertex is not silently deduplicated',()=>assertReject([{x:0,y:0},{x:10,y:0},{x:10,y:5},{x:10,y:0},{x:0,y:5},{x:0,y:0}],{},/simple/));
test('malformed source vertex count is rejected before compaction',()=>assertReject([...rectangle,rectangle[0]],{count:4},/Malformed/));
test('malformed source coordinate remains rejected',()=>assertReject([{x:0,y:0},{x:10,y:0},{x:10,y:'not-a-number'},{x:0,y:5},{x:0,y:0}],{},/Non-XY annotation/));
test('nonzero bulge on an otherwise redundant edge remains explicitly unsupported',()=>assertReject([{...rectangle[0],bulge:1},rectangle[0],...rectangle.slice(1),rectangle[0]],{},/curved/));
test('zero bulges preserve the supported straight boundary',()=>sameCanonical([...rectangle.map(p=>({...p,bulge:0})),{...rectangle[0],bulge:0}]));
test('multiple loops and holes remain explicitly rejected rather than filled over',()=>assertReject([...rectangle,rectangle[0]],{loops:2,after:[[92,2],[72,0],[73,1],[93,4],[10,2],[20,2],[10,3],[20,2],[10,3],[20,3],[10,2],[20,3],[97,0]]},/one straight polyline/));
test('open loops remain explicitly unsupported',()=>assertReject([...rectangle,rectangle[0]],{closed:0},/Open/));
test('non-XY elevation is not flattened during normalization',()=>assertReject([...rectangle,rectangle[0]],{elevation:2},/Non-XY/));
test('more than 4096 raw vertices remains rejected even when most are redundant',()=>assertReject([...rectangle,...Array(4093).fill(rectangle[0])],{},/4096-vertex/));
test('owned reduced DXF fixture reproduces source omission and passes fixed import',()=>{
 const source=fs.readFileSync(path.join(here,'fixtures/duplicate-closing-hatch.dxf'),'utf8');assert.equal(fills(load(source).document).length,1);
});
