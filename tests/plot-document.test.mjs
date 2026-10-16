import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditor} from '../core.mjs';
import {inferGableCandidates} from '../architecture/roof-gable.mjs';
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

const roofBoundary=[{x:0,y:0},{x:480,y:0},{x:480,y:240},{x:0,y:240}];
const roofPrefix='@architecture/roofGroup/roof-1/';
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function architecturalRoof(gable=false){
 const editor=createEditor({settings:{units:'in'}}),operation={type:'addRoof',boundary:roofBoundary,riseTwice:8,bearingElevation:120,overhang:0};
 if(gable)Object.assign(operation,{roofType:'GABLE',gablePolicy:'ALL_GABLE',gableAssignments:inferGableCandidates(roofBoundary).alternatives.find(item=>item.ridgeDirection==='X').edgeKeys});
 const accepted=editor.applyArchitecture(operation);assert.equal(accepted.ok,true,accepted.message);return editor;
}
function entityBody(svg,id){const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return svg.match(new RegExp(`<g color="[^"]+" data-entity="${escaped}">([\\s\\S]*?)</g>`))?.[1]??'';}
function segments(svg){return [...svg.matchAll(/<path d="M([\d.e+-]+),([\d.e+-]+) L([\d.e+-]+),([\d.e+-]+)"/g)].map(([,x,y,u,v])=>[{x:+x,y:+y},{x:+u,y:+v}]);}
function hasSegment(svg,a,b){return segments(svg).some(([p,q])=>Math.hypot(p.x-a.x,p.y-a.y,q.x-b.x,q.y-b.y)<1e-7||Math.hypot(p.x-b.x,p.y-b.y,q.x-a.x,q.y-a.y)<1e-7);}
function addRoofLayout(editor,viewports){
 const layout=editor.addLayout('Roof plot acceptance',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true,layout.message);
 for(const viewport of viewports){const {frame,...options}=viewport,result=editor.addViewport(layout.layoutId,frame,{locked:true,plotBorder:true,...options});assert.equal(result.ok,true,result.message);}
 return layout.layoutId;
}

test('source-only HIP regenerates one plotted skin and accurate fit extents without native caches',()=>{
 const editor=architecturalRoof(),text=editor.serialize(),raw=JSON.parse(text),before=JSON.stringify(editor.state),result=buildPlotHTML(source(text));
 assert.deepEqual(raw.entities,[]);assert.equal(raw.architecture.schemaVersion,4);assert.equal((result.previewSVG.match(/data-entity=/g)??[]).length,1);
 assert.ok(entityBody(result.previewSVG,roofPrefix+'surface'));assert.deepEqual(result.report.worldBounds,{minX:0,minY:0,minZ:120,maxX:480,maxY:240,maxZ:160});
 assert.equal(result.report.clipped,false);assert.doesNotMatch(result.previewSVG,/NaN|Infinity/);
 for(const [a,b]of segments(result.previewSVG))for(const point of[a,b]){assert.ok(point.x>=10&&point.x<=287);assert.ok(point.y>=10&&point.y<=200);}
 assert.equal(editor.serialize(),text);assert.equal(JSON.stringify(editor.state),before);assert.ok(editor.canUndo);
 assert.equal(editor.undo().ok,true);assert.equal(editor.state.architecture,null);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),text);
});

test('GABLE skin and independent closure base edges print at exact 1:96 in plan and right elevation',()=>{
 const editor=architecturalRoof(true),layoutId=addRoofLayout(editor,[
  {frame:{x:10,y:150,width:190,height:120},scaleDenominator:96,modelCenter:{x:240,y:120,z:120}},
  {frame:{x:220,y:30,width:190,height:120},scaleDenominator:96,modelCenter:{x:240,y:120,z:120},workspace:'3d',camera3d:{yaw:0,pitch:0,mode:'right'}},
 ]),text=editor.serialize(),result=buildPlotHTML(source(text),{options:{space:'layout',layoutId}}),views=result.report.sheets[0].viewports,factor=25.4/96;
 assert.equal(views.length,2);assert.ok(views.every(view=>view.visibleEntities===5&&view.scaleDenominator===96&&view.plotScaleMmPerUnit===factor));
 const groups=[...result.previewSVG.matchAll(/<g data-viewport="[^"]+" clip-path="[^"]+">([\s\S]*?)(?=<\/g><(?:rect|path) [^>]*data-viewport-border=)/g)];
 assert.equal(groups.length,2);const plan=groups[0][1],elevation=groups[1][1];
 const planLeft=105-240*factor,planRight=105+240*factor,planBottom=297-210+120*factor;
 assert.ok(hasSegment(entityBody(plan,roofPrefix+'surface'),{x:planLeft,y:planBottom},{x:planRight,y:planBottom}));near(planRight-planLeft,127);
 const center={x:315,y:297-90},apex={x:315,y:297-90-40*factor},left={x:315-120*factor,y:297-90},right={x:315+120*factor,y:297-90};
 const closureIds=editor.state.entities.filter(entity=>entity.id.includes('/gable-closure-')).map(entity=>entity.id);assert.equal(closureIds.length,4);
 for(const id of closureIds)assert.ok(entityBody(plan,id)&&entityBody(elevation,id),id);
 const closureSVG=closureIds.map(id=>entityBody(elevation,id)).join(''),skinSVG=entityBody(elevation,roofPrefix+'surface');
 assert.ok(hasSegment(closureSVG,center,left)&&hasSegment(closureSVG,center,right));assert.ok(hasSegment(closureSVG,center,apex));
 assert.equal(hasSegment(skinSVG,center,left),false,'the independent closure base must not be mistaken for the sloped skin');assert.equal(hasSegment(skinSVG,center,right),false);
 near(right.x-left.x,63.5);near(center.y-apex.y,40*factor);assert.equal(result.report.clipped,false);assert.ok(result.report.warnings.some(w=>/wireframe/.test(w)));assert.equal(editor.serialize(),text);
});

test('generated roof eaves preserve common 1:192, 1:128, 1:96 and 1:48 paper scales',()=>{
 const editor=architecturalRoof(true),scales=[192,128,96,48],layoutId=addRoofLayout(editor,scales.map((scaleDenominator,index)=>({frame:{x:index%2?220:10,y:index<2?160:10,width:190,height:125},scaleDenominator,modelCenter:{x:240,y:120,z:120}}))),text=editor.serialize(),result=buildPlotHTML(source(text),{options:{space:'layout',layoutId}});
 const bodies=[...result.previewSVG.matchAll(/<g color="[^"]+" data-entity="@architecture\/roofGroup\/roof-1\/surface">([\s\S]*?)<\/g>/g)].map(match=>match[1]);assert.equal(bodies.length,4);
 bodies.forEach((body,index)=>{const horizontal=segments(body).filter(([a,b])=>Math.abs(a.y-b.y)<1e-8).map(([a,b])=>Math.abs(a.x-b.x));near(Math.max(...horizontal),480*25.4/scales[index]);assert.equal(result.report.sheets[0].viewports[index].scaleDenominator,scales[index]);});
 assert.equal(result.report.clipped,false);assert.equal(editor.serialize(),text);assert.ok(editor.state.layouts[0].viewports.every(view=>view.locked));
});

test('model visibility, paper visibility, plot flags and per-viewport freeze apply to skins and closures',()=>{
 const editor=architecturalRoof(true);assert.equal(editor.addLayer('Reference','#333333').ok,true);assert.equal(editor.setCurrentLayer('Reference').ok,true);for(const token of['LINE','0,0','10,0',''])assert.equal(editor.execute(token).ok,true);
 assert.equal(editor.updateLayer('0',{modelVisible:false,paperVisible:true,color:'#1234ab',lineweight:.6,linetype:'hidden',locked:true}).ok,true);
 const layoutId=addRoofLayout(editor,[{frame:{x:10,y:160,width:190,height:125},scaleDenominator:96,modelCenter:{x:240,y:120,z:120},frozenLayers:['0'],layer:'Reference'},{frame:{x:220,y:160,width:190,height:125},scaleDenominator:96,modelCenter:{x:240,y:120,z:120},layer:'Reference'}]);
 assert.doesNotMatch(buildPlotHTML(source(editor.serialize()),{options:{space:'model'}}).previewSVG,/@architecture/);
 const paper=buildPlotHTML(source(editor.serialize()),{options:{space:'layout',layoutId,colorMode:'color'}});assert.deepEqual(paper.report.sheets[0].viewports.map(view=>view.visibleEntities),[1,6]);assert.equal((paper.previewSVG.match(/data-entity="@architecture/g)??[]).length,5);
 assert.match(entityBody(paper.previewSVG,roofPrefix+'surface'),/stroke="#1234ab" stroke-width="0.6"/);assert.match(entityBody(paper.previewSVG,roofPrefix+'gable-closure-0'),/stroke-dasharray="2 1"/);
 for(const flag of['paperVisible','plot','visible']){const raw=JSON.parse(editor.serialize());raw.layers.find(layer=>layer.name==='0')[flag]=false;assert.doesNotMatch(buildPlotHTML(source(JSON.stringify(raw)),{options:{space:'layout',layoutId}}).previewSVG,/@architecture/);}
});

test('plot uses the saved model camera when another paper viewport is active and never mutates its isolated editor',()=>{
 const editor=architecturalRoof(true);assert.equal(editor.setWorkspace('3d').ok,true);assert.equal(editor.set3DView({yaw:0,pitch:0,mode:'right',target:{x:240,y:120,z:120},scale:2}).ok,true);
 const layoutId=addRoofLayout(editor,[{frame:{x:10,y:10,width:190,height:120},scaleDenominator:96,modelCenter:{x:240,y:120,z:120},workspace:'2d'}]),model=buildPlotHTML(source(editor.serialize()),{options:{space:'model',scaleMode:'scale',ratio:96}});
 assert.equal(editor.setSpace('model',layoutId,editor.state.layouts[0].viewports[0].id).ok,true);const text=editor.serialize(),live=JSON.stringify(editor.state);let isolated,isolatedBefore;
 const factory=()=>{isolated=createEditor();const original=isolated.importJSON;isolated.importJSON=input=>{const accepted=original(input);isolatedBefore=JSON.stringify(isolated.state);return accepted;};return isolated;};
 const active=buildPlotHTML(source(text),{options:{space:'model',scaleMode:'scale',ratio:96},createEditor:factory});assert.equal(active.previewSVG,model.previewSVG);assert.equal(editor.serialize(),text);assert.equal(JSON.stringify(editor.state),live);assert.equal(JSON.stringify(isolated.state),isolatedBefore);assert.ok(isolated.canUndo);
});

test('pending and infeasible roofs exclude both skin and closures and issue explicit plot warnings',()=>{
 for(const invalid of['stale-assignment','ridge-limit']){const editor=architecturalRoof(true);for(const token of['LINE','0,0','10,0',''])assert.equal(editor.execute(token).ok,true);const raw=JSON.parse(editor.serialize());if(invalid==='stale-assignment')raw.architecture.roofGroups[0].gableAssignments=['stale-edge'];else raw.architecture.roofGroups[0].maxRidgeElevation=130;
  const text=JSON.stringify(raw),result=buildPlotHTML(source(text));assert.doesNotMatch(result.previewSVG,/@architecture/);assert.equal((result.previewSVG.match(/data-entity=/g)??[]).length,1);assert.ok(result.report.warnings.some(w=>/Architectural roof roof-1 is .*roof and closure geometry is excluded/.test(w)));assert.equal(JSON.stringify(raw),text);
 }
});

test('forged derivative caches cannot replace regenerated output or introduce duplicate roof plots',()=>{
 const editor=architecturalRoof(true),text=editor.serialize(),expected=buildPlotHTML(source(text)),raw=JSON.parse(text);raw.architectureDerived={entities:[{id:'forged-cache',type:'LINE',layer:'0',start:{x:9999,y:9999},end:{x:1e6,y:1e6}}],roofs:[]};
 assert.equal(buildPlotHTML(source(JSON.stringify(raw))).previewSVG,expected.previewSVG);assert.equal((expected.previewSVG.match(/data-entity="@architecture/g)??[]).length,5);
 raw.entities.push(structuredClone(editor.state.entities[0]));assert.throws(()=>buildPlotHTML(source(JSON.stringify(raw))),/architectural IDs are reserved/);raw.entities=[];raw.architecture.roofGroups[0].faces=[];assert.throws(()=>buildPlotHTML(source(JSON.stringify(raw))),/roofGroup: unsupported field faces/);
});

test('historical schema 1, 2 and 3 source-only roofs regenerate once without changing fixture bytes',()=>{
 for(const filename of['roof-space-H-v19.linecraft','ceiling-space-v110.linecraft','tray-ceiling-v111.linecraft']){const file=new URL(`../samples/${filename}`,import.meta.url),text=readFileSync(file,'utf8'),editor=createEditor(JSON.parse(text)),generated=editor.state.entities.filter(entity=>entity.id.startsWith('@architecture/')),result=buildPlotHTML(source(text),{options:{space:'model'}}),ids=[...result.previewSVG.matchAll(/data-entity="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(generated.some(entity=>entity.id.includes('/roofGroup/')));for(const entity of generated)assert.equal(ids.filter(id=>id===entity.id).length,1,`${filename}: ${entity.id}`);assert.equal(readFileSync(file,'utf8'),text);assert.doesNotMatch(result.previewSVG,/NaN|Infinity/);
 }
});
