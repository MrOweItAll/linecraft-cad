import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';
import {buildPlotHTML,normalizePlotOptions,PLOT_FONT_CALIBRATION} from '../plot-document.mjs';
const drawing=(sequence,settings={units:'mm'})=>{const e=createEditor({settings});for(const input of sequence){const r=e.execute(input);assert.equal(r.ok,true,`${input}: ${r.message}`);}return e.serialize();};
const source=text=>[{title:'Owned drawing',text}];

test('exact arbitrary-plane circle geometry plots projected continuous vectors and stays inside fitted margins',()=>{
 const e=createEditor({workspace:'3d',settings:{units:'mm'},entities:[{id:'tilted',type:'CIRCLE3D',layer:'0',center:{x:10,y:20,z:30},radius:25,xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:0,z:1}}]}),before=e.serialize(),a=buildPlotHTML(source(before));
 assert.equal(e.serialize(),before);assert.equal(a.report.clipped,false);assert.ok((a.previewSVG.match(/<path /g)||[]).length>=180);assert.doesNotMatch(a.previewSVG,/NaN|Infinity/);
 for(const [,x,y]of a.previewSVG.matchAll(/[ML]([\d.e+-]+),([\d.e+-]+)/g)){assert.ok(Number(x)>=10-1e-8&&Number(x)<=287+1e-8);assert.ok(Number(y)>=10-1e-8&&Number(y)<=200+1e-8);}
});
test('exact 1:2 millimeter plotting has physical 50mm dimension independent of viewport',()=>{
 const text=drawing(['LINE','0,0','100,0','']);const a=buildPlotHTML(source(text),{options:{scaleMode:'scale',ratio:2}});
 const path=a.previewSVG.match(/d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/);
 assert.equal(Number(path[3])-Number(path[1]),50);assert.equal(a.report.plotScaleMmPerUnit,.5);
 const changed=JSON.parse(text);changed.viewport.scale=500;changed.viewport.center={x:1000,y:1000};assert.equal(buildPlotHTML(source(JSON.stringify(changed)),{options:{scaleMode:'scale',ratio:2}}).previewSVG,a.previewSVG);
});
test('inch units have 25.4mm physical scale and correct Letter portrait page',()=>{
 const a=buildPlotHTML(source(drawing(['LINE','0,0','2,0',''],{units:'in'})),{options:{paper:'Letter',orientation:'portrait',scaleMode:'scale'}});
 assert.equal(a.report.plotScaleMmPerUnit,25.4);assert.deepEqual(a.pdfOptions.pageSize,{width:8.5,height:11});assert.match(a.html,/@page\{size:215.9mm 279.4mm/);
});
test('fit accepts unitless while exact ratio rejects ambiguous units',()=>{
 const s=source(drawing(['RECTANG','0,0','100,50'],{units:'unitless'}));assert.equal(buildPlotHTML(s).report.pages,1);assert.throws(()=>buildPlotHTML(s,{options:{scaleMode:'scale'}}),/drawing units/);
});
test('model extents exclude hidden layers while locked visible geometry prints',()=>{
 const e=createEditor({settings:{units:'mm'}});e.execute('LINE');e.execute('0,0');e.execute('10,0');e.execute('');e.addLayer('Hidden','#ff0000');e.setCurrentLayer('Hidden');e.execute('LINE');e.execute('1000,0');e.execute('1010,0');e.execute('');e.setCurrentLayer('0');e.updateLayer('Hidden',{visible:false});e.updateLayer('0',{locked:true});
 const a=buildPlotHTML(source(e.serialize()));assert.equal(a.report.worldBounds.maxX,10);assert.equal((a.previewSVG.match(/data-entity=/g)||[]).length,1);
});
test('label and title escaping prevents executable markup in preview and PDF document',()=>{
 const e=createEditor({settings:{units:'mm'}});const r=e.importJSON({entities:[{id:'own',type:'TEXT',layer:'0',position:{x:0,y:0},text:'<script>alert(1)</script>&"',height:2.5,rotation:0,style:'Standard'}]});assert.equal(r.ok,true,r.message);
 const a=buildPlotHTML([{title:'"><img src=x onerror=evil>',text:e.serialize()}]);assert.doesNotMatch(a.html,/<script>|<img /);assert.match(a.previewSVG,/&lt;script&gt;/);assert.match(a.html,/default-src 'none'/);assert.doesNotMatch(PLOT_FONT_CALIBRATION,/fetch|require\(/);
});
test('batch pages retain independent unit scales, with no drawing edits',()=>{
 const a=drawing(['RECTANG','0,0','20,10']),b=drawing(['RECTANG','0,0','2,1'],{units:'in'}),result=buildPlotHTML([{title:'Metric',text:a},{title:'Imperial',text:b}],{options:{scaleMode:'scale',ratio:2}});
 assert.equal(result.report.pages,2);assert.deepEqual(result.report.sheets.map(s=>s.plotScaleMmPerUnit),[.5,12.7]);assert.equal((result.html.match(/<section\b/g)||[]).length,2);assert.match(result.html,/plot-area-0/);assert.match(result.html,/plot-area-1/);assert.equal(a,drawing(['RECTANG','0,0','20,10']));
});
test('circle and arc stay analytic in 2D output',()=>{
 const a=buildPlotHTML(source(drawing(['CIRCLE','0,0','10','ARC','20,0','30,10','40,0'])));assert.match(a.previewSVG,/<circle /);assert.match(a.previewSVG,/ A[\d.e+-]+,[\d.e+-]+ 0 /);
});
test('orthographic 3D prints vector edges while perspective exact ratios reject',()=>{
 const e=createEditor({settings:{units:'mm'}});for(const s of ['BOX','0,0,0','10,10,0','10'])assert.equal(e.execute(s).ok,true);e.setWorkspace('3d');
 const a=buildPlotHTML(source(e.serialize()),{options:{scaleMode:'scale'}});assert.equal((a.previewSVG.match(/<path /g)||[]).length,12);assert.match(a.report.warnings[0],/wireframe/);e.set3DView({projection:'perspective'});assert.throws(()=>buildPlotHTML(source(e.serialize()),{options:{scaleMode:'scale'}}),/Perspective/);assert.equal(buildPlotHTML(source(e.serialize())).report.plotScaleMmPerUnit,null);
});
test('3D curves are projected as continuous wireframe rather than empty entities',()=>{
 const e=createEditor();for(const s of ['CIRCLE','0,0','10'])assert.equal(e.execute(s).ok,true);e.setWorkspace('3d');const a=buildPlotHTML(source(e.serialize()));assert.ok((a.previewSVG.match(/<path /g)||[]).length>=180);
});
test('exact scale reports clipping and enforces the paper margin',()=>{
 const a=buildPlotHTML(source(drawing(['RECTANG','0,0','1000,1000'])),{options:{scaleMode:'scale'}});assert.equal(a.report.clipped,true);assert.match(a.report.warnings[0],/clipped/);assert.match(a.previewSVG,/<clipPath /);
});
test('invalid options, empty drawings and oversized batches fail explicitly',()=>{
 assert.throws(()=>normalizePlotOptions({ratio:0}),/ratio/);assert.throws(()=>normalizePlotOptions({ratio:NaN}),/ratio/);assert.throws(()=>normalizePlotOptions({paper:'bogus'}),/Unsupported/);assert.throws(()=>normalizePlotOptions({path:'C:\\evil'}),/Unsupported/);assert.throws(()=>buildPlotHTML(source(createEditor().serialize())),/no visible/);assert.throws(()=>buildPlotHTML(Array(21).fill({title:'Empty',text:'{}'})),/20/);
});
test('physical lineweight is independent of drawing units and plot ratio',()=>{
 const a=buildPlotHTML(source(drawing(['LINE','0,0','100,0',''])),{options:{scaleMode:'scale',ratio:100}});assert.match(a.previewSVG,/stroke-width="0.25"/);const b=buildPlotHTML(source(drawing(['LINE','0,0','100,0',''])),{options:{lineweights:false,colorMode:'monochrome'}});assert.match(b.previewSVG,/stroke-width="0.18"/);assert.match(b.previewSVG,/stroke="#000000"/);
});

test('new curves print as exact ellipse and cubic Bezier paths',()=>{
 const e=createEditor({settings:{units:'mm'},entities:[{id:'ellipse',type:'ELLIPSE',center:{x:0,y:0},major:{x:10,y:10},ratio:.5},{id:'spline',type:'SPLINE',degree:3,closed:false,controlPoints:[{x:20,y:0},{x:25,y:20},{x:30,y:-20},{x:40,y:0}],knots:[0,0,0,0,1,1,1,1]}]});
 const a=buildPlotHTML(source(e.serialize()));assert.match(a.previewSVG,/<ellipse /);assert.match(a.previewSVG,/rotate\(-45/);assert.match(a.previewSVG,/ C[\d.e+-]+,[\d.e+-]+ /);assert.doesNotMatch(a.previewSVG,/NaN|Infinity/);
});
test('captured hatch fills and clipped parallel strokes appear in vector plot',()=>{
 const boundary={type:'PLINE',points:[{x:0,y:0},{x:20,y:0},{x:20,y:10},{x:0,y:10}],closed:true};const e=createEditor({entities:[{id:'solid',type:'HATCH',boundary,pattern:'solid',angle:0,spacing:1,origin:{x:0,y:0}},{id:'stripe',type:'HATCH',boundary,pattern:'parallel',angle:90,spacing:5,origin:{x:0,y:0}}]});
 const a=buildPlotHTML(source(e.serialize()),{options:{colorMode:'monochrome'}});assert.match(a.previewSVG,/ Z" fill="#000000" stroke="none"/);assert.ok((a.previewSVG.match(/stroke-width=/g)||[]).length>=3);
});
test('block plot expansion preserves insertion rotation, scaling and inherited layer color',()=>{
 const e=createEditor({settings:{units:'mm'},layers:[{name:'0'},{name:'Blue',color:'#0000ff'}],blocks:[{name:'Tick',base:{x:0,y:0},entities:[{type:'LINE',layer:'0',start:{x:0,y:0},end:{x:10,y:0}}]}],entities:[{id:'insert',type:'INSERT',layer:'Blue',blockName:'Tick',position:{x:100,y:50},scale:2,rotation:90}]});
 const a=buildPlotHTML(source(e.serialize()),{options:{scaleMode:'scale',colorMode:'color'}}),p=a.previewSVG.match(/d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/);assert.equal(Math.abs(Number(p[4])-Number(p[2])),20);assert.match(a.previewSVG,/stroke="#0000ff"/);assert.equal(e.state.entities[0].type,'INSERT');
});

test('3D Fit contains oblique ellipse outlines and curved hatch fills within paper margins',()=>{
 const ellipse={type:'ELLIPSE',center:{x:0,y:0},major:{x:10,y:0},ratio:1};
 for(const entity of [{id:'oval',...ellipse},{id:'fill',type:'HATCH',boundary:ellipse,pattern:'solid',angle:0,spacing:1,origin:{x:0,y:0}}]){
  const e=createEditor({workspace:'3d',entities:[entity]}),a=buildPlotHTML(source(e.serialize()));assert.equal(a.report.clipped,false);
  const paths=[...a.previewSVG.matchAll(/<path d="([^"]+)"/g)];assert.ok(paths.length);
  for(const [,d] of paths)for(const [,,x,y] of d.matchAll(/([ML])([\d.e+-]+),([\d.e+-]+)/g)){assert.ok(Number(x)>=10&&Number(x)<=287,`x ${x} exceeds printable sheet`);assert.ok(Number(y)>=10&&Number(y)<=200,`y ${y} exceeds printable sheet`);}
 }
});
