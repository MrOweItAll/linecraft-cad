import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {importDXF,readDXF} from '../dwg-import.mjs';
import {createEditor,hatchGeometry} from '../core.mjs';
import {paperSolidDXF,PAPER_SOLID_LITERALS as L,MODEL_PRESERVATION_CASES} from './paper-solid-fixture.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
// Frozen beta3 output-preservation controls only, not an independent correctness
// claim for the older model-face or general transform implementation.
const MODEL_BASELINE=/* BASELINE_CONTROL_DIGESTS */ Object.freeze({
  "model SOLID": {
    "inputSHA256": "da36e34948def2df8b2b8f5b1c29f46f8588182d7badacbbbfbf2c0c835b0f5f",
    "nativeSHA256": "e7830206eaa7cbf949de6e6efc9ca6a911b314c02b4b4d90bc3d5f8e15bc6e1a",
    "reportSHA256": "b4e456e6d04cc10900dab46666257dc94df5a3bc1bd4d1c8eaca4f476be869ce"
  },
  "model TRACE": {
    "inputSHA256": "9051aa9a088e4a144c66be43f03934958bd8ce806ac9eb55f7ade1d54989056a",
    "nativeSHA256": "e7830206eaa7cbf949de6e6efc9ca6a911b314c02b4b4d90bc3d5f8e15bc6e1a",
    "reportSHA256": "b4e456e6d04cc10900dab46666257dc94df5a3bc1bd4d1c8eaca4f476be869ce"
  },
  "model 3DFACE": {
    "inputSHA256": "282980c34ee7cc54a7c26366443ea9258557edbbc6d0778b39e70553d9fe8007",
    "nativeSHA256": "e7830206eaa7cbf949de6e6efc9ca6a911b314c02b4b4d90bc3d5f8e15bc6e1a",
    "reportSHA256": "b4e456e6d04cc10900dab46666257dc94df5a3bc1bd4d1c8eaca4f476be869ce"
  },
  "model elevated SOLID": {
    "inputSHA256": "dd5d57ddb74ce21dd743eb62fbff13476de03fbeb2efe6ef6c2e2aaa3f653777",
    "nativeSHA256": "44e90c24eed0fcb62894149ffb65da33033a7451e06609d56d8616101bd822c5",
    "reportSHA256": "b4e456e6d04cc10900dab46666257dc94df5a3bc1bd4d1c8eaca4f476be869ce"
  },
  "model thick SOLID": {
    "inputSHA256": "75fc59c765bc1abeca0732a156527b5311adf13284a8d0c777d4216cf9c65bd8",
    "nativeSHA256": "e7830206eaa7cbf949de6e6efc9ca6a911b314c02b4b4d90bc3d5f8e15bc6e1a",
    "reportSHA256": "b4e456e6d04cc10900dab46666257dc94df5a3bc1bd4d1c8eaca4f476be869ce"
  }
});
const load=options=>{const result=importDXF(paperSolidDXF(options));return{...result,document:JSON.parse(result.text)};};
const paper=result=>result.document.layouts[0].entities;
const fill=result=>paper(result).filter(entity=>entity.type==='HATCH');
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const points=(actual,expected,tolerance=0)=>{assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i++)for(const axis of ['x','y'])if(tolerance)near(actual[i][axis],expected[i][axis],tolerance);else assert.equal(actual[i][axis],expected[i][axis]);};
const area=vertices=>Math.abs(vertices.reduce((sum,p,index)=>{const q=vertices[(index+1)%vertices.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
function preserveSentinels(result,paperInches=false){
 assert.equal(result.document.entities.length,1);const model=result.document.entities[0];assert.equal(model.type,'LINE');assert.equal(model.layer,'Model sentinel');assert.deepEqual(model.start,L.modelSentinel.start);assert.deepEqual(model.end,L.modelSentinel.end);
 const sentinel=paper(result).find(entity=>entity.layer==='Paper sentinel');assert.ok(sentinel);assert.equal(sentinel.type,'LINE');points([sentinel.start,sentinel.end],[L.paperSentinel.start,L.paperSentinel.end],paperInches?1e-10:0);
 assert.equal(result.document.layouts.length,1);const layout=result.document.layouts[0];assert.equal(layout.name,L.layoutName);assert.equal(layout.paper.widthMm,420);assert.equal(layout.paper.heightMm,297);assert.deepEqual(layout.viewports,[]);assert.deepEqual(layout.plotSettings.renderOffsetMm,{x:0,y:0});
 const ids=[...result.document.entities,...paper(result)].map(entity=>entity.id);assert.equal(new Set(ids).size,ids.length);
}
function rejectWhole(options){assert.throws(()=>load(options),/Imported geometry did not pass document validation|Import rejected|Paper entities|polygon|boundary|HATCH/i,'Unsupported paper SOLID must not be silently omitted or flattened');}

test('synthetic source declares an all-Z0 rectangle and independent layout ownership',()=>{
 const {records}=readDXF(paperSolidDXF()),solid=records.find(record=>record.type==='SOLID');assert.ok(solid);for(const code of [30,31,32,33])assert.equal(Number(solid.groups.find(([key])=>key===code)[1]),0);
 assert.equal(solid.groups.find(([code])=>code===330)[1],'90');assert.equal(records.find(record=>record.type==='LAYOUT').groups.filter(([code])=>code===330).at(-1)[1],'90');
 assert.equal(records.filter(record=>record.type==='SOLID').length,1);assert.equal(records.filter(record=>record.type==='LINE').length,2);
});
test('planar paper SOLID rectangle imports as supported filled 2D geometry at literal placement',()=>{
 const result=load();preserveSentinels(result);assert.equal(paper(result).length,2);assert.equal(fill(result).length,1);const entity=fill(result)[0];assert.equal(entity.layer,'Fill');assert.equal(entity.color,'#000000');assert.equal(entity.lineweight,.35);assert.equal(entity.pattern,'solid');assert.equal(entity.boundary.type,'PLINE');assert.equal(entity.boundary.closed,true);points(entity.boundary.points,L.rectangle);assert.equal(area(entity.boundary.points),800);assert.ok(hatchGeometry(entity).fills.length>0);assert.equal(result.report.unsupportedEntities,0);assert.deepEqual(result.report.unsupportedByType,{});assert.equal(result.report.importedEntities,3);
});
test('repeated third/fourth SOLID vertex retains a literal filled triangle',()=>{
 const result=load({shape:'triangle'});preserveSentinels(result);assert.equal(fill(result).length,1);points(fill(result)[0].boundary.points,L.triangle);assert.equal(area(fill(result)[0].boundary.points),400);assert.equal(result.report.unsupportedEntities,0);
});
test('explicit paper color and lineweight survive without changing layer identity',()=>{
 const result=load({color:0x123456,lineweight:.7});preserveSentinels(result);assert.equal(fill(result)[0].color,'#123456');assert.equal(fill(result)[0].lineweight,.7);assert.equal(fill(result)[0].layer,'Fill');assert.equal(result.document.layers.find(layer=>layer.name==='Fill').color,'#000000');
});
test('two declared paper SOLIDs retain both independent fills and exact entity counts',()=>{
 const result=load({count:2});preserveSentinels(result);assert.equal(fill(result).length,2);assert.equal(paper(result).length,3);assert.equal(result.report.importedEntities,4);points(fill(result)[0].boundary.points,L.rectangle);points(fill(result)[1].boundary.points,[{x:100,y:30},{x:140,y:30},{x:140,y:50},{x:100,y:50}]);
});
test('inch paper coordinates become the independently declared millimetre placement',()=>{
 const result=load({paperInches:true,modelUnits:1});preserveSentinels(result,true);assert.equal(result.document.settings.units,'in');assert.equal(result.document.layouts[0].plotSettings.sourcePaperUnits,'in');points(fill(result)[0].boundary.points,L.rectangle,1e-10);near(area(fill(result)[0].boundary.points),800);
});
test('inch model units do not rescale millimetre paper geometry',()=>{
 const result=load({modelUnits:1});preserveSentinels(result);assert.equal(result.document.settings.units,'in');points(fill(result)[0].boundary.points,L.rectangle);assert.equal(area(fill(result)[0].boundary.points),800);
});
test('negative-Z OCS retains transformed planar paper XY without relocation',()=>{
 const result=load({normal:[0,0,-1]});preserveSentinels(result);points(fill(result)[0].boundary.points,[{x:-20,y:30},{x:-60,y:30},{x:-60,y:50},{x:-20,y:50}]);assert.equal(area(fill(result)[0].boundary.points),800);
});
test('positive scaled Top OCS normal retains the same literal rectangle',()=>{const result=load({normal:[0,0,7]});points(fill(result)[0].boundary.points,L.rectangle);});
test('paper INSERT base, mirror, nonuniform scale and rotation retain independent transformed points',()=>{
 const result=load({block:{}});preserveSentinels(result);const entity=fill(result)[0];assert.equal(entity.layer,'Fill');points(entity.boundary.points,[{x:19,y:164},{x:19,y:84},{x:-41,y:84},{x:-41,y:164}],1e-10);near(area(entity.boundary.points),4800);assert.equal(result.report.unsupportedEntities,0);
});
test('combined negative-Z child OCS and INSERT scale preserve literal final paper coordinates',()=>{
 const result=load({normal:[0,0,-1],block:{base:[0,0,0],position:[100,200,0],scale:[2,3,1],rotation:0}});points(fill(result)[0].boundary.points,[{x:60,y:290},{x:-20,y:290},{x:-20,y:350},{x:60,y:350}]);assert.equal(area(fill(result)[0].boundary.points),4800);
});
test('complete import state persists and history restores exact content without inventing navigation behavior',()=>{
 const result=load(),editor=createEditor();for(const token of ['LINE','0,0','5,0',''])assert.equal(editor.execute(token).ok,true);const before=editor.serialize();assert.equal(editor.importJSON(result.text).ok,true);const accepted=editor.serialize();assert.deepEqual(JSON.parse(accepted),result.document);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);assert.equal(editor.redo().ok,true);
 // Existing beta3 history excludes navigation; Undo removes the layout and
 // reconciles to Model, which Redo retains. Geometry/styles/layouts stay exact.
 const expectedRedo={...JSON.parse(accepted),activeSpace:'model',activeLayoutId:null};assert.equal(expectedRedo.activeViewportId,null);assert.deepEqual(JSON.parse(editor.serialize()),expectedRedo);assert.equal(createEditor(JSON.parse(accepted)).serialize(),accepted);
});

for(const [name,options]of [
 ['one elevated corner',{cornerZ:[0,0,2,0]}],['constant elevation',{elevation:2}],['nonzero thickness',{thickness:2}],
 ['negative thickness',{thickness:-2}],['duplicate thickness with later nonzero',{thicknessValues:[0,2]}],
 ['malformed thickness text',{thickness:'not-a-number'}],['blank thickness',{thickness:''}],['infinite thickness',{thickness:'Infinity'}],
 ['tilted OCS',{normal:[0,1,1]}],['tiny but nonzero transformed Z',{normal:[1e-12,0,1]}],
 ['paper block elevated after transform',{block:{position:[100,200,2]}}],['paper block tilted after transform',{block:{normal:[0,1,1]}}],
 ['all coincident vertices',{points:[{x:20,y:30},{x:20,y:30},{x:20,y:30},{x:20,y:30}]}],
 ['collinear zero-area polygon',{points:[{x:20,y:30},{x:40,y:30},{x:60,y:30},{x:80,y:30}]}],
 ['self-crossing polygon',{points:[{x:20,y:30},{x:60,y:50},{x:60,y:30},{x:20,y:50}]}]
])test(`paper SOLID keeps whole-import rejection: ${name}`,()=>rejectWhole(options));
test('all duplicate thickness records explicitly zero remain supported',()=>{const result=load({thicknessValues:[0,0]});points(fill(result)[0].boundary.points,L.rectangle);});
test('omitted thickness retains the existing zero-thickness default',()=>{const result=load({thicknessValues:[]});points(fill(result)[0].boundary.points,L.rectangle);});
for(const type of ['TRACE','3DFACE'])test(`paper ${type} remains outside the SOLID-only fix`,()=>rejectWhole({type}));
for(const item of MODEL_PRESERVATION_CASES)test(`preserve beta3 model face output only: ${item.name}`,()=>{
 const source=paperSolidDXF(item.options),result=importDXF(source),expected=MODEL_BASELINE[item.name];assert.ok(expected,'Freeze the unchanged beta3 control before implementation');assert.equal(sha(source),expected.inputSHA256);assert.equal(sha(result.text),expected.nativeSHA256);assert.equal(sha(JSON.stringify(result.report)),expected.reportSHA256);
});
