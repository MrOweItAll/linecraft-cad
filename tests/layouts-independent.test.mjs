/* Independent expected arithmetic and integrity checks, not native parity claims. */
import {test as nativeTest,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createEditor,formatDimension,annotationPrimitives} from '../core.mjs';
import {normalizePaper,normalizeFrame,normalizePaperViewport,modelUnitMillimeters,viewportModelToPaper,viewportPaperToModel,pointInViewport,isEntityVisible} from '../paper-space.mjs';
import {presetUCS,normalizeUCS,ucsFromThreePoints,constructionPlane,planeToWorld,worldToPlane,intersectPlaneRay,planeCamera,spatialCurvePoint,spatialCurveBounds,validateSpatialCurve,sampleSpatialCurve,spatialCurveOCS} from '../drawing-plane.mjs';
const records=[],files=['core.mjs','paper-space.mjs','drawing-plane.mjs'],hashes=()=>Object.fromEntries(files.map(name=>[name,createHash('sha256').update(fs.readFileSync(new URL(`../${name}`,import.meta.url))).digest('hex')]));
const sourceSHA256=hashes();
function test(name,fn){nativeTest(name,()=>{const started=performance.now();try{fn();records.push({name,status:'passed',durationMs:performance.now()-started});}catch(error){records.push({name,status:'failed',durationMs:performance.now()-started,error:error.stack});throw error;}});}
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const nearPoint=(a,b,tolerance=1e-10)=>{for(const key of Object.keys(b))near(a[key],b[key],tolerance);};
const point=(x,y,z=0)=>({x,y,z});
const viewport=(patch={})=>({id:'viewport',frame:{x:10,y:20,width:100,height:80},modelCenter:point(0,0),scaleDenominator:1000,workspace:'2d',camera3d:{yaw:-90,pitch:90,roll:0,projection:'orthographic'},locked:false,frozenLayers:[],...patch});
const accept=(editor,inputs)=>{for(const input of inputs){const result=editor.execute(input);assert.equal(result.ok,true,`${input}: ${result.message}`);}};

test('standard paper dimensions and orientation are physical millimeters, with bounded custom sheets',()=>{
 for(const [size,width,height]of [['A4',210,297],['A3',297,420],['A0',841,1189],['Letter',215.9,279.4],['Tabloid',279.4,431.8]]){
  assert.deepEqual(normalizePaper({size,orientation:'portrait'}),{size,orientation:'portrait',widthMm:width,heightMm:height});
  assert.deepEqual(normalizePaper({size,orientation:'landscape'}),{size,orientation:'landscape',widthMm:height,heightMm:width});
 }
 assert.deepEqual(normalizePaper({size:'Custom',orientation:'portrait',widthMm:250,heightMm:350}),{size:'Custom',orientation:'portrait',widthMm:250,heightMm:350});
 for(const raw of [{size:null},{orientation:null},{size:'constructor'},{size:'Custom',widthMm:9,heightMm:100},{size:'Custom',widthMm:5001,heightMm:100},{size:'Custom',widthMm:Infinity,heightMm:100},{size:'A4',widthMm:300}])assert.throws(()=>normalizePaper(raw));
});
test('model physical-unit factors agree with SI definitions and keep unitless legacy plots in millimeters',()=>{
 for(const [units,expected]of [['unitless',1],['mm',1],['cm',10],['m',1000],['in',25.4],['ft',304.8]])assert.equal(modelUnitMillimeters({units}),expected);
 assert.throws(()=>modelUnitMillimeters({units:'constructor'}));
});
test('a 100-foot segment in inch and meter models is 30.48 millimeters at 1:1000',()=>{
 const view=viewport(),a=viewportModelToPaper(point(0,0),view,{units:'in'}),b=viewportModelToPaper(point(1200,0),view,{units:'in'}),c=viewportModelToPaper(point(30.48,0),view,{units:'m'});
 nearPoint(a,{x:60,y:60});near(b.x-a.x,30.48);near(c.x-a.x,30.48);near(b.y,60);near(c.y,60);
});
test('two viewport frames and centers preserve independent scales and do not fit to unrelated geometry',()=>{
 const one=viewport({frame:{x:10,y:20,width:90,height:60},modelCenter:point(600,0)}),two=viewport({frame:{x:110,y:20,width:90,height:60},modelCenter:point(600,0),scaleDenominator:500});
 nearPoint(viewportModelToPaper(point(0,0),one,{units:'in'}),{x:39.76,y:50});nearPoint(viewportModelToPaper(point(1200,0),one,{units:'in'}),{x:70.24,y:50});
 nearPoint(viewportModelToPaper(point(0,0),two,{units:'in'}),{x:124.52,y:50});nearPoint(viewportModelToPaper(point(1200,0),two,{units:'in'}),{x:185.48,y:50});
 const far=viewportModelToPaper(point(1e9,0),one,{units:'in'});assert.equal(pointInViewport(far,one),false);assert.equal(one.scaleDenominator,1000);
});
test('XY paper/world round trips retain the model-center depth plane and expose separate projection depth',()=>{
 const view=viewport({modelCenter:point(100,200,7),scaleDenominator:25}),p=point(123,245,7),paper=viewportModelToPaper(p,view,{units:'cm'});
 nearPoint(viewportPaperToModel(paper,view,{units:'cm'}),p);const above=viewportModelToPaper({...p,z:12},view,{units:'cm'});near(above.depth,5);nearPoint(viewportPaperToModel(above,view,{units:'cm'}),p);
});
test('front and right orthographic paper cameras have independently computed XYZ axes',()=>{
 const front=viewport({workspace:'3d',scaleDenominator:1,camera3d:{yaw:-90,pitch:0,roll:0}}),right=viewport({workspace:'3d',scaleDenominator:1,camera3d:{yaw:0,pitch:0,roll:0}});
 nearPoint(viewportModelToPaper(point(3,4,5),front,{units:'mm'}),{x:63,y:65,depth:-4});nearPoint(viewportModelToPaper(point(3,4,5),right,{units:'mm'}),{x:64,y:65,depth:3});
 nearPoint(viewportPaperToModel({x:63,y:65},front,{units:'mm'}),point(3,0,5));
});
test('a ninety-degree camera roll maps front coordinates to plus Z and minus X without changing scale',()=>{
 const view=viewport({workspace:'3d',scaleDenominator:1,camera3d:{yaw:-90,pitch:0,roll:90}});
 nearPoint(viewportModelToPaper(point(3,4,5),view,{units:'mm'}),{x:65,y:57,depth:-4});
});
test('viewport clip inclusion uses its frame only, including exact borders and excluding outside points',()=>{
 const view=viewport();for(const p of [{x:10,y:20},{x:110,y:100},{x:60,y:60}])assert.equal(pointInViewport(p,view),true);
 for(const p of [{x:9.99,y:60},{x:110.01,y:60},{x:60,y:100.01}])assert.equal(pointInViewport(p,view),false);
});
test('viewport frame/scale/freeze validation rejects unsafe nested values and perspective scale',()=>{
 const paper=normalizePaper(),layers=[{name:'0'}],camera=raw=>createEditor({camera3d:raw}).state.camera3d,base=viewport();
 for(const frame of [{x:-1,y:0,width:10,height:10},{x:0,y:0,width:.005,height:10},{x:0,y:0,width:421,height:10},{x:0,y:null,width:10,height:10}])assert.throws(()=>normalizeFrame(frame,paper));
 for(const patch of [{scaleDenominator:0},{scaleDenominator:1e10},{scaleDenominator:null},{frozenLayers:['missing']},{frozenLayers:['0','0']},{locked:'true'},{workspace:null},{modelCenter:{x:0,y:0,z:null}},{camera3d:{projection:'perspective'}}])assert.throws(()=>normalizePaperViewport({...base,...patch},paper,layers,camera));
});
test('global/model/paper visibility rules are distinct from locking and plot flags',()=>{
 const layer={name:'Owned',visible:true,modelVisible:false,paperVisible:true,locked:true,plot:false},document={layers:[layer],layouts:[{id:'sheet',viewports:[{id:'view',frozenLayers:[]}]}]},model={layer:'Owned'},paper={layer:'Owned',layoutId:'sheet'};
 assert.equal(isEntityVisible(model,document,{space:'model',layoutId:null,viewportId:null}),false);
 assert.equal(isEntityVisible(paper,document,{space:'paper',layoutId:'sheet',viewportId:null}),true);
 assert.equal(isEntityVisible(model,document,{space:'model',layoutId:'sheet',viewportId:'view'}),false);
 assert.equal(isEntityVisible(model,document,{space:'paper',layoutId:'sheet',viewportId:'view'}),true);
 layer.paperVisible=false;layer.modelVisible=true;
 assert.equal(isEntityVisible(model,document,{space:'model',layoutId:null,viewportId:null}),true);assert.equal(isEntityVisible(paper,document,{space:'paper',layoutId:'sheet',viewportId:null}),false);
 layer.visible=false;assert.equal(isEntityVisible(model,document,{space:'model',layoutId:null,viewportId:null}),false);
});
test('freezing one viewport leaves another viewport, standalone model and paper-owned content unaffected',()=>{
 const document={layers:[{name:'Owned'}],layouts:[{id:'sheet',viewports:[{id:'a',frozenLayers:['Owned']},{id:'b',frozenLayers:[]}]}]},model={layer:'Owned'},paper={layer:'Owned',layoutId:'sheet'};
 assert.equal(isEntityVisible(model,document,{space:'paper',layoutId:'sheet',viewportId:'a'}),false);assert.equal(isEntityVisible(model,document,{space:'paper',layoutId:'sheet',viewportId:'b'}),true);assert.equal(isEntityVisible(model,document,{space:'model',layoutId:null,viewportId:null}),true);assert.equal(isEntityVisible(paper,document,{space:'paper',layoutId:'sheet',viewportId:null}),true);
});
test('XY/XZ/YZ presets are right-handed frames with independent expected normal directions',()=>{
 assert.deepEqual(presetUCS('XY').zAxis,point(0,0,1));assert.deepEqual(presetUCS('XZ').zAxis,point(0,-1,0));assert.deepEqual(presetUCS('YZ').zAxis,point(1,0,0));
});
test('rotated translated plane transforms match hand-computed coordinates and invert exactly',()=>{
 const plane=constructionPlane({origin:point(10,20,30),xAxis:point(0,1,0),yAxis:point(-1,0,0),zAxis:point(0,0,1)});
 const world=planeToWorld(point(2,3,4),plane);assert.deepEqual(world,point(7,22,34));assert.deepEqual(worldToPlane(world,plane),point(2,3,4));
});
test('construction elevation moves along the chosen UCS normal rather than global Z',()=>{
 const plane=constructionPlane(presetUCS('XZ',point(10,20,30)),5);assert.deepEqual(plane.origin,point(10,15,30));assert.deepEqual(plane.normal,point(0,-1,0));assert.deepEqual(planeToWorld(point(2,3),plane),point(12,15,33));
});
test('three-point UCS orthogonalizes a skew second direction and rejects degenerate points',()=>{
 const frame=ucsFromThreePoints(point(10,20,30),point(12,20,30),point(12,23,30));assert.deepEqual(frame,presetUCS('XY',point(10,20,30)));
 for(const points of [[point(0,0),point(0,0),point(1,1)],[point(0,0),point(1,0),point(2,0)],[point(0,0),point(1,0),point(2,1e-16)]])assert.throws(()=>ucsFromThreePoints(...points));
});
test('ray/plane intersections are exact for non-XY planes and safely reject parallel or behind-camera rays',()=>{
 const plane=constructionPlane(presetUCS('XZ',point(0,20,0)));
 assert.deepEqual(intersectPlaneRay({origin:point(5,50,8),direction:point(0,-1,0),perspective:true},plane),point(5,20,8));
 assert.equal(intersectPlaneRay({origin:point(5,50,8),direction:point(1,0,0)},plane),null);assert.equal(intersectPlaneRay({origin:point(5,50,8),direction:point(0,1,0),perspective:true},plane),null);
});
test('UCS validation rejects null coordinates, singular/skew/left-handed bases and nonfinite origins',()=>{
 for(const patch of [{origin:point(Infinity,0)},{origin:{x:0,y:0,z:null}},{xAxis:point(0,0)},{xAxis:point(2,0)},{yAxis:point(1,0)},{zAxis:point(0,0,-1)}])assert.throws(()=>normalizeUCS({...presetUCS(),...patch}));
});
test('plane camera points at the plane origin and has an orthographic normal orientation',()=>{
 const camera=planeCamera(constructionPlane(presetUCS('XZ',point(10,20,30)),5));assert.deepEqual(camera.target,point(10,15,30));near(camera.yaw,-90);near(camera.pitch,0);assert.equal(camera.projection,'orthographic');
});
test('legacy model documents normalize without creating layouts or changing accepted geometry',()=>{
 const entity={id:'old',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:10,y:0}},editor=createEditor({entities:[entity],layers:[{name:'0'}]});
 assert.deepEqual(editor.getModelEntities(),[entity]);assert.equal(editor.state.layouts.length,0);assert.equal(editor.state.activeSpace,'model');assert.equal(editor.state.activeLayoutId,null);assert.equal(editor.state.layers[0].modelVisible,true);assert.equal(editor.state.layers[0].paperVisible,true);assert.equal(editor.state.layers[0].linetype,'continuous');
});
test('paper command ownership stays separate from model geometry and supports one-group Undo/Redo',()=>{
 const model={id:'model',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:1200,y:0}},editor=createEditor({settings:{units:'in'},entities:[model]}),created=editor.addLayout('Owned sheet',{size:'A4',orientation:'portrait'});assert.equal(created.ok,true);assert.equal(editor.setSpace('paper',created.layoutId).ok,true);
 accept(editor,['LINE','0,0','100,0','']);assert.equal(editor.getModelEntities().length,1);assert.equal(editor.getPaperEntities(created.layoutId).length,1);let serialized=JSON.parse(editor.serialize());assert.deepEqual(serialized.entities,[model]);assert.equal(serialized.layouts[0].entities[0].end.x,100);assert.equal(serialized.layouts[0].entities[0].layoutId,undefined);
 const before=editor.getPaperEntities(created.layoutId);assert.equal(editor.undo().ok,true);assert.equal(editor.getPaperEntities(created.layoutId).length,0);assert.deepEqual(editor.getModelEntities(),[model]);assert.equal(editor.redo().ok,true);assert.deepEqual(editor.getPaperEntities(created.layoutId),before);
});
test('locked viewport navigation and out-of-sheet paper changes reject without state/history mutation',()=>{
 const editor=createEditor(),layout=editor.addLayout('Lock test'),view=editor.addViewport(layout.layoutId,{x:20,y:20,width:300,height:200},{locked:true});assert.equal(view.ok,true);const before=editor.serialize(),canUndo=editor.canUndo;
 assert.equal(editor.updateViewport(layout.layoutId,view.viewportId,{modelCenter:point(10,0)},{navigation:true}).ok,false);assert.equal(editor.serialize(),before);assert.equal(editor.canUndo,canUndo);
 assert.equal(editor.updateLayout(layout.layoutId,{paper:{size:'A5'}}).ok,false);assert.equal(editor.serialize(),before);
});
test('layer rename updates model/paper ownership and all viewport freeze/border references in one undoable step',()=>{
 const editor=createEditor({layers:[{name:'0'},{name:'Owned'}],entities:[{id:'model',type:'LINE',layer:'Owned',start:{x:0,y:0},end:{x:1,y:0}}]}),layout=editor.addLayout('Rename test'),view=editor.addViewport(layout.layoutId,{x:10,y:10,width:100,height:50},{layer:'Owned',frozenLayers:['Owned']});assert.equal(view.ok,true);const before=editor.serialize();assert.equal(editor.renameLayer('Owned','Renamed').ok,true);
 const data=JSON.parse(editor.serialize());assert.equal(data.entities[0].layer,'Renamed');assert.equal(data.layouts[0].viewports[0].layer,'Renamed');assert.deepEqual(data.layouts[0].viewports[0].frozenLayers,['Renamed']);assert.equal(createEditor().importJSON(editor.serialize()).ok,true);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
});
test('deleting a layout removes only its owned paper geometry and Undo restores the exact drawing',()=>{
 const editor=createEditor({entities:[{id:'model',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:1,y:0}}]}),a=editor.addLayout('First'),b=editor.addLayout('Second');assert.equal(editor.setSpace('paper',a.layoutId).ok,true);accept(editor,['LINE','0,0','20,0','']);assert.equal(editor.setSpace('paper',b.layoutId).ok,true);accept(editor,['LINE','0,0','40,0','']);const before=editor.serialize();assert.equal(editor.deleteLayout(a.layoutId).ok,true);assert.equal(editor.getModelEntities().length,1);assert.equal(editor.getPaperEntities(a.layoutId).length,0);assert.equal(editor.getPaperEntities(b.layoutId).length,1);assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),before);
});
test('a paper dimension remains a 100 millimeter decimal measurement in an inch/architectural model',()=>{
 const dimension={id:'paper-dimension',type:'DIMENSION',kind:'linear',p1:{x:20,y:180},p2:{x:120,y:180},axisAngle:0,placement:{x:70,y:165},style:'Standard',scale:1,layer:'0'};
 const editor=createEditor({settings:{units:'in',linearFormat:'architectural'},layouts:[{id:'paper',name:'Owned paper',paper:{size:'A4',orientation:'portrait'},entities:[dimension],viewports:[]}]});
 const entity=editor.getPaperEntities('paper')[0],formatted=formatDimension(entity,editor.state),geometry=annotationPrimitives(entity,editor.state);
 assert.equal(entity.layoutId,'paper');assert.equal(formatted.measurement,100);assert.equal(formatted.label,'100.00');assert.equal(geometry.label,'100.00');
 assert.ok(geometry.segments.some(([a,b])=>a.y===165&&b.y===165&&Math.abs(b.x-a.x)===100));
 assert.notEqual(formatDimension({...entity,layoutId:undefined},editor.state).label,'100.00');
 const restored=createEditor(JSON.parse(editor.serialize()));assert.equal(formatDimension(restored.getPaperEntities('paper')[0],restored.state).label,'100.00');
});
test('an XZ circle has exact cardinal XYZ points, independent world extents and published arbitrary-axis OCS coordinates',()=>{
 const entity={type:'CIRCLE3D',center:point(10,20,30),radius:5,xAxis:point(1,0,0),yAxis:point(0,0,1)};validateSpatialCurve(entity);
 for(const[f,p]of[[0,point(15,20,30)],[.25,point(10,20,35)],[.5,point(5,20,30)],[.75,point(10,20,25)]])assert.deepEqual(spatialCurvePoint(entity,f),p);
 const extents=spatialCurveBounds(entity);for(const[key,min,max]of[['x',5,15],['y',20,20],['z',25,35]]){near(Math.min(...extents.map(p=>p[key])),min);near(Math.max(...extents.map(p=>p[key])),max);}
 const ocs=spatialCurveOCS(entity);nearPoint(ocs.normal,point(0,-1,0));nearPoint(ocs.center,point(10,30,-20));near(ocs.angleOffset,0);
 assert.equal(sampleSpatialCurve(entity,32).length,33);assert.deepEqual(sampleSpatialCurve(entity,32)[0],sampleSpatialCurve(entity,32).at(-1));
});
test('signed spatial arcs preserve their real traced span and exclude circle extrema outside that span',()=>{
 const minor={type:'ARC3D',center:point(10,20,30),radius:5,xAxis:point(1,0,0),yAxis:point(0,0,1),startAngle:0,sweepAngle:-90};validateSpatialCurve(minor);
 assert.deepEqual(spatialCurvePoint(minor,0),point(15,20,30));assert.deepEqual(spatialCurvePoint(minor,1),point(10,20,25));nearPoint(spatialCurvePoint(minor,.5),point(10+5/Math.sqrt(2),20,30-5/Math.sqrt(2)));
 const extent=spatialCurveBounds(minor);near(Math.min(...extent.map(p=>p.x)),10);near(Math.max(...extent.map(p=>p.x)),15);near(Math.min(...extent.map(p=>p.z)),25);near(Math.max(...extent.map(p=>p.z)),30);
 const major={...minor,sweepAngle:270};const majorBounds=spatialCurveBounds(major);near(Math.min(...majorBounds.map(p=>p.x)),5);near(Math.max(...majorBounds.map(p=>p.z)),35);assert.deepEqual(spatialCurvePoint(major,1),spatialCurvePoint(minor,1));
});
test('spatial curve validation rejects malformed bases, collapsed numeric resolution and unsafe subdivision counts',()=>{
 const entity={type:'CIRCLE3D',center:point(10,20,30),radius:5,xAxis:point(1,0,0),yAxis:point(0,0,1)};
 for(const patch of [{radius:0},{radius:null},{radius:Infinity},{center:point(1e20,0,0),radius:1},{xAxis:point(0,0,0)},{xAxis:point(2,0,0)},{yAxis:point(1,0,0)},{yAxis:{x:0,y:0,z:null}},{type:'ARC3D',startAngle:0,sweepAngle:0},{type:'ARC3D',startAngle:0,sweepAngle:360}])assert.throws(()=>validateSpatialCurve({...entity,...patch}));
 for(const count of [3,4097,4.5,null,Infinity])assert.throws(()=>sampleSpatialCurve(entity,count));
});

after(()=>{const finalHashes=hashes(),report={framework:'Independent paper scale, orthographic projection, UCS vector arithmetic and scope-integrity tests',scope:'Original expected arithmetic and public APIs; no native AutoCAD or GUI is operated.',completedAt:new Date().toISOString(),sourceSHA256,sourceChangedDuringRun:JSON.stringify(sourceSHA256)!==JSON.stringify(finalHashes),total:records.length,passed:records.filter(test=>test.status==='passed').length,failed:records.filter(test=>test.status==='failed').length,tests:records};fs.writeFileSync(new URL('layouts-independent-v16-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');});
