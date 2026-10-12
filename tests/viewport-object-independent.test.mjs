import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.mjs';
import {buildPlotHTML} from '../plot-document.mjs';
import {CONCAVE_BOUNDARY,CONCAVE_EXPECTED,makeViewportFixtures} from './viewport-fixtures-v17.mjs';
const point=(x,y,z)=>z===undefined?{x,y}:{x,y,z};
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const accept=(editor,inputs)=>{for(const input of inputs){const response=editor.execute(input);assert.equal(response.ok,true,`${JSON.stringify(input)}: ${response.message}`);}};
const document=editor=>JSON.parse(editor.serialize());
function fixture(){
 const editor=core.createEditor({settings:{units:'mm'},entities:[{id:'owned-model',type:'LINE',layer:'0',start:point(0,0),end:point(1000,0)}]}),layout=editor.addLayout('Original object test',{size:'A3',orientation:'landscape'});
 assert.equal(layout.ok,true);assert.equal(editor.setSpace('paper',layout.layoutId).ok,true);
 const created=editor.addViewport(layout.layoutId,{x:20,y:30,width:100,height:60},{modelCenter:point(500,250,0),scaleDenominator:50,locked:false});assert.equal(created.ok,true);
 const proxy=()=>editor.getPaperObjects(layout.layoutId).find(object=>object.type==='VIEWPORT'&&object.viewportId===created.viewportId);
 return{editor,layoutId:layout.layoutId,viewportId:created.viewportId,proxy,view:()=>editor.state.layouts[0].viewports.find(view=>view.id===created.viewportId)};
}
test('viewport object APIs are present and geometry-only getters retain their existing contract',()=>{
 const f=fixture();for(const name of ['getActiveObjects','getPaperObjects','getSelectionObjects'])assert.equal(typeof f.editor[name],'function',`${name} must exist; never skip incomplete implementation.`);
 assert.equal(f.editor.getActiveObjects().length,1);assert.equal(f.editor.getActiveEntities().length,0);assert.equal(f.editor.getPaperEntities().length,0);assert.equal(f.editor.getModelEntities().length,1);
 assert.equal(f.proxy().type,'VIEWPORT');assert.equal(f.proxy().viewportId,f.viewportId);
});
test('rectangular viewport corners and midpoint grip edits have independently calculated paper coordinates',()=>{
 const f=fixture(),expected=[point(20,30),point(120,30),point(120,90),point(20,90)],before=document(f.editor);
 assert.deepEqual(core.viewportBoundaryPoints(f.view()),expected);
 assert.equal(f.editor.moveGrip(f.proxy().id,4,point(70,20)).ok,true);assert.deepEqual(f.view().frame,{x:20,y:20,width:100,height:70});assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);
});
test('selection uses an unambiguous viewport token even when a historic geometry ID collides',()=>{
 const f=fixture(),raw=document(f.editor);raw.layouts[0].entities=[{id:f.viewportId,type:'LINE',layer:'0',start:point(5,5),end:point(15,5)}];const restored=core.createEditor(raw),proxy=restored.getPaperObjects(f.layoutId).find(object=>object.type==='VIEWPORT');
 assert.notEqual(proxy.id,f.viewportId);restored.select([proxy.id]);assert.equal(restored.getSelectionObjects()[0].type,'VIEWPORT');
 restored.select([f.viewportId]);assert.equal(restored.getSelectionObjects()[0].type,'LINE');assert.equal(restored.getSelectionObjects()[0].id,f.viewportId);
});
test('a historic geometry ID collision cannot change a reserved viewport token or erase an unselected frame',()=>{
 const f=fixture(),raw=document(f.editor),baseToken=`@VIEWPORT/${encodeURIComponent(f.layoutId)}/${encodeURIComponent(f.viewportId)}`;
 raw.layouts[0].entities=[{id:baseToken,type:'LINE',layer:'0',start:point(5,5),end:point(15,5)}];const restored=core.createEditor(raw),proxy=()=>restored.getPaperObjects(f.layoutId).find(object=>object.type==='VIEWPORT'),token=proxy().id,before=document(restored);
 assert.notEqual(token,baseToken);restored.select([baseToken]);accept(restored,['ERASE']);assert.equal(restored.getPaperEntities().length,0);assert.equal(restored.state.layouts[0].viewports.length,1);assert.equal(proxy().id,token);assert.deepEqual(restored.state.layouts[0].viewports[0],before.layouts[0].viewports[0]);
 assert.equal(restored.undo().ok,true);assert.deepEqual(document(restored),before);assert.equal(proxy().id,token);restored.select([baseToken,token]);accept(restored,['ERASE']);assert.equal(restored.getPaperEntities().length,0);assert.equal(restored.state.layouts[0].viewports.length,0);assert.equal(restored.undo().ok,true);assert.deepEqual(document(restored),before);assert.equal(proxy().id,token);
});
test('viewport proxies are never serialized as geometry and their selection tokens survive geometry-independent reload',()=>{
 const f=fixture();f.editor.select([f.proxy().id]);const raw=document(f.editor);assert.equal(raw.entities.some(entity=>entity.type==='VIEWPORT'),false);assert.equal(raw.layouts[0].entities.some(entity=>entity.type==='VIEWPORT'),false);
 const restored=core.createEditor(raw),proxy=restored.getPaperObjects(f.layoutId).find(object=>object.viewportId===f.viewportId);assert.equal(proxy.id,f.proxy().id);assert.deepEqual(raw.layouts[0].viewports[0],document(restored).layouts[0].viewports[0]);
});
test('mixed paper LINE and viewport MOVE is one transaction with exact model and view preservation',()=>{
 const f=fixture();accept(f.editor,['LINE','5,10','45,10','']);const paper=f.editor.getPaperEntities()[0],before=document(f.editor),view=structuredClone(f.view());f.editor.select([paper.id,f.proxy().id]);accept(f.editor,['MOVE','0,0','@10,15']);
 assert.deepEqual(f.view().frame,{x:30,y:45,width:100,height:60});assert.deepEqual(f.editor.getPaperEntities()[0].start,point(15,25));assert.deepEqual(f.editor.getPaperEntities()[0].end,point(55,25));
 for(const key of ['modelCenter','scaleDenominator','camera3d','frozenLayers','locked'])assert.deepEqual(f.view()[key],view[key]);assert.deepEqual(document(f.editor).entities,before.entities);
 assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);assert.equal(f.editor.redo().ok,true);assert.deepEqual(f.view().frame,{x:30,y:45,width:100,height:60});
});
test('viewport SCALE changes the paper frame around its base and keeps the selected physical model ratio',()=>{
 const f=fixture(),model=structuredClone(f.editor.getModelEntities()),before=document(f.editor),anchor=core.viewportModelToPaper(point(500,250),f.view(),{units:'mm'});f.editor.select([f.proxy().id]);accept(f.editor,['SCALE','20,30','2']);assert.deepEqual(f.view().frame,{x:20,y:30,width:200,height:120});assert.equal(f.view().scaleDenominator,50);assert.deepEqual(f.view().modelCenter,point(3000,1750,0));assert.deepEqual(f.editor.getModelEntities(),model);
 // The frame center moves (50,30) mm, so its model center shifts (2500,1500)
 // model mm at 1:50. Model geometry remains at the same absolute paper point.
 const projected=core.viewportModelToPaper(point(500,250),f.view(),{units:'mm'});close(projected.x,anchor.x);close(projected.y,anchor.y);close(projected.x,70);close(projected.y,60);
 const a=core.viewportModelToPaper(point(0,0),f.view(),{units:'mm'}),b=core.viewportModelToPaper(point(1000,0),f.view(),{units:'mm'});close(b.x-a.x,20);close(b.y-a.y,0);
 assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);
});
test('viewport resize compensation follows a rolled orthographic basis and physical inch conversion',()=>{
 const editor=core.createEditor({settings:{units:'in'}}),layout=editor.addLayout('Rolled original fixture',{size:'A3',orientation:'landscape'});assert.equal(layout.ok,true);assert.equal(editor.setSpace('paper',layout.layoutId).ok,true);
 const center=point(500,250,50),made=editor.addViewport(layout.layoutId,{x:20,y:30,width:100,height:60},{workspace:'3d',modelCenter:center,scaleDenominator:10,camera3d:{yaw:-90,pitch:0,roll:90,target:center,projection:'orthographic'}});assert.equal(made.ok,true);
 const original=structuredClone(editor.state.layouts[0].viewports[0]),proxy=editor.getPaperObjects(layout.layoutId).find(object=>object.type==='VIEWPORT'),before=document(editor),anchor=core.viewportModelToPaper(center,original,{units:'in'});editor.select([proxy.id]);accept(editor,['SCALE','20,30','2']);const view=editor.state.layouts[0].viewports[0];
 // For yaw -90, pitch 0, roll 90: right=(0,0,1), up=(-1,0,0).
 // Moving paper center +(50,30) mm at 1:10 shifts model center
 // (-300/25.4,0,+500/25.4) inches; no helper computes this expected value.
 close(view.modelCenter.x,500-300/25.4);close(view.modelCenter.y,250);close(view.modelCenter.z,50+500/25.4);assert.equal(view.scaleDenominator,10);
 const projected=core.viewportModelToPaper(center,view,{units:'in'});close(projected.x,anchor.x);close(projected.y,anchor.y);assert.deepEqual(view.camera3d.target,view.modelCenter);assert.equal(editor.undo().ok,true);assert.deepEqual(document(editor),before);
});
test('COPY repeated destinations create independent viewport IDs and local/global Undo preserve completed transactions',()=>{
 const f=fixture(),before=document(f.editor),source=structuredClone(f.view());f.editor.select([f.proxy().id]);accept(f.editor,['COPY','0,0','@150,0','@300,0']);let views=f.editor.state.layouts[0].viewports;assert.equal(views.length,3);assert.equal(new Set(views.map(view=>view.id)).size,3);assert.deepEqual(views.map(view=>view.frame.x),[20,170,320]);
 for(const view of views)for(const key of ['modelCenter','scaleDenominator','camera3d','frozenLayers','layer'])assert.deepEqual(view[key],source[key]);
 accept(f.editor,['U','']);assert.equal(f.editor.state.layouts[0].viewports.length,2);assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);
});
test('mixed ERASE removes only selected paper objects and Undo restores exact viewport identity and metadata',()=>{
 const f=fixture();accept(f.editor,['LINE','5,10','45,10','']);const before=document(f.editor);f.editor.select([f.proxy().id,f.editor.getPaperEntities()[0].id]);accept(f.editor,['ERASE']);assert.equal(f.editor.state.layouts[0].viewports.length,0);assert.equal(f.editor.getPaperEntities().length,0);assert.deepEqual(document(f.editor).entities,before.entities);assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);
});
test('an invalid mixed MOVE rejects before changing either paper geometry or viewport resources',()=>{
 const f=fixture();assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{frame:{x:999999850,y:30,width:100,height:60}}).ok,true);accept(f.editor,['LINE','5,10','45,10','']);const before=document(f.editor),revision=f.editor.state.revision;f.editor.select([f.proxy().id,f.editor.getPaperEntities()[0].id]);accept(f.editor,['MOVE','0,0']);const response=f.editor.execute('@200,0');assert.equal(response.ok,false);assert.deepEqual(document(f.editor),before);assert.equal(f.editor.state.revision,revision);f.editor.cancel();
});
test('frame layer locking blocks direct and command edits while viewport display lock protects only navigation',()=>{
 const f=fixture();assert.equal(f.editor.addLayer('Frame lock').ok,true);assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{layer:'Frame lock'}).ok,true);assert.equal(f.editor.updateLayer('Frame lock',{locked:true}).ok,true);const before=document(f.editor);
 assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{frame:{...f.view().frame,x:30}}).ok,false);assert.equal(f.editor.deleteViewport(f.layoutId,f.viewportId).ok,false);assert.deepEqual(document(f.editor),before);
 assert.equal(f.editor.updateLayer('Frame lock',{locked:false}).ok,true);assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{locked:true}).ok,true);const locked=structuredClone(f.view());assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{modelCenter:point(0,0,0)},{navigation:true}).ok,false);assert.deepEqual(f.view(),locked);f.editor.select([f.proxy().id]);accept(f.editor,['MOVE','0,0','@10,0']);assert.equal(f.view().frame.x,30);assert.equal(f.view().locked,true);
});
test('viewport cap exhaustion rejects COPY without geometry, identity or resource mutation',()=>{
 const f=fixture();for(let i=1;i<16;i++)assert.equal(f.editor.addViewport(f.layoutId,{x:20+i,y:30,width:100,height:60}).ok,true);const before=document(f.editor);f.editor.select([f.proxy().id]);accept(f.editor,['COPY','0,0']);assert.equal(f.editor.execute('@10,0').ok,false);assert.deepEqual(document(f.editor),before);f.editor.cancel();
});
test('simple concave clipping tests the polygon rather than its AABB, with boundary-inclusive picking',()=>{
 const fixtures=makeViewportFixtures(core.createEditor),view=fixtures.concave.document.layouts[0].viewports[0];assert.equal(core.pointInViewport(CONCAVE_EXPECTED.inside,view),true);assert.equal(core.pointInViewport(CONCAVE_EXPECTED.lowInside,view),true);assert.equal(core.pointInViewport(CONCAVE_EXPECTED.notch,view),false);assert.equal(core.pointInViewport(point(90,110),view),true);assert.equal(core.pointInViewport(point(181,40),view),false);
 const origin=core.viewportModelToPaper(point(0,0),view,{units:'mm'});assert.deepEqual({x:origin.x,y:origin.y},point(100,85));assert.equal(core.pointInViewport(origin,view),false,'The camera AABB center may legitimately lie in the concave notch.');
});
test('polygon physical projection and inverse are independent of model unit choice',()=>{
 const fixtures=makeViewportFixtures(core.createEditor);for(const name of ['concave','inches']){const data=fixtures[name].document,view=data.layouts[0].viewports[0],line=data.entities.find(entity=>entity.id==='green-physical-ruler'),a=core.viewportModelToPaper(line.start,view,data.settings),b=core.viewportModelToPaper(line.end,view,data.settings);close(a.x,30);close(a.y,40);close(b.x,80);close(b.y,40);close(b.x-a.x,50);const restored=core.viewportPaperToModel(a,view,data.settings);close(restored.x,line.start.x);close(restored.y,line.start.y);}
});
test('MVIEW Polygon completes one bounded closed clip and Object retains the original paper polyline',()=>{
 const f=fixture();accept(f.editor,['MVIEW','P',...CONCAVE_BOUNDARY.map(p=>`${p.x},${p.y}`),'C']);let view=f.editor.state.layouts[0].viewports.at(-1);assert.deepEqual(view.boundary,CONCAVE_BOUNDARY);assert.deepEqual(view.frame,CONCAVE_EXPECTED.frame);const count=f.editor.state.layouts[0].viewports.length;
 accept(f.editor,['PLINE',...CONCAVE_BOUNDARY.map(p=>`${p.x},${p.y}`),'C']);const poly=f.editor.getPaperEntities().at(-1);accept(f.editor,['MVIEW','O']);assert.equal(f.editor.submitObject(poly.id,poly.points[0]).ok,true);assert.equal(f.editor.state.layouts[0].viewports.length,count+1);assert.equal(f.editor.getPaperEntities().some(entity=>entity.id===poly.id),true);assert.deepEqual(f.editor.state.layouts[0].viewports.at(-1).boundary,CONCAVE_BOUNDARY);
});
test('polygon MOVE and corner grip validation preserve a simple boundary and exact Undo',()=>{
 const fixtures=makeViewportFixtures(core.createEditor),f=fixtures.concave,view=f.document.layouts[0].viewports[0],proxy=f.editor.getPaperObjects('polygon-sheet').find(object=>object.type==='VIEWPORT');const before=document(f.editor);f.editor.select([proxy.id]);accept(f.editor,['MOVE','0,0','@10,15']);assert.deepEqual(f.editor.state.layouts[0].viewports[0].boundary,CONCAVE_BOUNDARY.map(p=>point(p.x+10,p.y+15)));assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);
 const valid=f.editor.moveGrip(proxy.id,0,point(25,25));assert.equal(valid.ok,true);assert.equal(f.editor.undo().ok,true);assert.deepEqual(document(f.editor),before);
 const invalid=f.editor.moveGrip(proxy.id,0,point(100,100));assert.equal(invalid.ok,false);assert.deepEqual(document(f.editor),before);
});
test('malformed polygon boundaries reject atomically and never silently become rectangular windows',()=>{
 const f=fixture(),before=document(f.editor);const invalid=[null,[],[point(1,1),point(2,2)],[point(20,20),point(100,100),point(20,100),point(100,20)],[point(20,20),point(80,20),point(80,20),point(20,80)],[point(20,20),point(60,60),point(100,100)],[point(20,20),point(80,20),point(80,null),point(20,80)]];
 for(const boundary of invalid){assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{boundary}).ok,false);assert.deepEqual(document(f.editor),before);}
 const tooMany=Array.from({length:65},(_,i)=>point(100+50*Math.cos(i*Math.PI*2/65),100+50*Math.sin(i*Math.PI*2/65)));assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{boundary:tooMany}).ok,false);assert.deepEqual(document(f.editor),before);
});
test('off-sheet finite windows remain valid while coordinate/resource overflows reject unchanged',()=>{
 const f=fixture();assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{frame:{x:-30,y:20,width:100,height:60}}).ok,true);const before=document(f.editor);for(const frame of [{x:1e9+1,y:20,width:100,height:60},{x:0,y:0,width:1e9+1,height:60},{x:0,y:0,width:.001,height:60},{x:NaN,y:20,width:100,height:60}]){assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{frame}).ok,false);assert.deepEqual(document(f.editor),before);}
});
test('active LINE navigation accepts only view fields and keeps anchors, geometry and latest view across Undo',()=>{
 const f=fixture();assert.equal(f.editor.setSpace('model',f.layoutId,f.viewportId).ok,true);const model=structuredClone(f.editor.getModelEntities());accept(f.editor,['LINE','10,20']);const anchors=structuredClone(f.editor.state.commandPoints),last=structuredClone(f.editor.state.lastPoint);
 assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,{modelCenter:point(100,50,0),scaleDenominator:25},{navigation:true}).ok,true);assert.deepEqual(f.editor.state.commandPoints,anchors);assert.deepEqual(f.editor.state.lastPoint,last);assert.equal(f.editor.state.command,'LINE');assert.deepEqual(f.editor.getModelEntities(),model);
 const nav=structuredClone(f.view());for(const patch of [{frame:{x:0,y:0,width:10,height:10}},{boundary:CONCAVE_BOUNDARY},{locked:true},{layer:'0'}]){assert.equal(f.editor.updateViewport(f.layoutId,f.viewportId,patch,{navigation:true}).ok,false);assert.deepEqual(f.view(),nav);assert.deepEqual(f.editor.state.commandPoints,anchors);}
 accept(f.editor,['@30,40','']);const line=f.editor.getModelEntities().at(-1);close(line.start.x,10);close(line.start.y,20);close(line.end.x,40);close(line.end.y,60);assert.equal(f.editor.undo().ok,true);assert.deepEqual(f.editor.getModelEntities(),model);assert.deepEqual(f.view(),nav);assert.equal(f.editor.redo().ok,true);assert.deepEqual(f.view(),nav);close(f.editor.getModelEntities().at(-1).end.x,40);
});
test('manual cursor-anchor arithmetic keeps the same model point inside a concave viewport after zoom',()=>{
 const fixture=makeViewportFixtures(core.createEditor).concave,editor=fixture.editor,view=editor.state.layouts[0].viewports[0];assert.equal(editor.setSpace('model','polygon-sheet',view.id).ok,true);
 const world=point(-500,350,0),before=core.viewportModelToPaper(world,view,{units:'mm'});close(before.x,50);close(before.y,120);assert.equal(core.pointInViewport(before,view),true);
 // At twice the magnification, manual inverse coordinates relative to center(100,85)
 // are(-250,175); shifting the model center by the remaining(-250,175) anchors the cursor.
 assert.equal(editor.updateViewport('polygon-sheet',view.id,{modelCenter:point(-250,175,0),scaleDenominator:5},{navigation:true}).ok,true);const after=core.viewportModelToPaper(world,editor.getActiveViewport(),{units:'mm'});close(after.x,50);close(after.y,120);assert.deepEqual(editor.getActiveViewport().boundary,CONCAVE_BOUNDARY);assert.equal(core.pointInViewport(CONCAVE_EXPECTED.notch,editor.getActiveViewport()),false);
});
test('raw DXF polygon clips resolve exact paper-owned boundaries without changing editable geometry or adding drawing layers',()=>{
 const fixture=makeViewportFixtures(core.createEditor).concave,before=fixture.editor.serialize(),lines=fixture.editor.exportDXF().trimEnd().split(/\r?\n/),records=[];let record=[];
 assert.equal(lines.length%2,0);for(let i=0;i<lines.length;i+=2){const code=Number(lines[i]),value=lines[i+1];if(code===0&&record.length){records.push(record);record=[];}record.push([code,value]);}if(record.length)records.push(record);
 const values=(record,code)=>record.filter(pair=>pair[0]===code).map(pair=>pair[1]),handles=records.flatMap(record=>[...values(record,5),...values(record,105)]);assert.equal(handles.length,new Set(handles).size);const byId=new Map(records.filter(record=>values(record,5).length).map(record=>[values(record,5)[0],record]));
 for(const record of records)for(const [code,value]of record)if([330,331,340,350,360,390].includes(code)&&value!=='0')assert.ok(handles.includes(value),`Unresolved group${code} handle ${value}`);
 const views=records.filter(record=>record[0][1]==='VIEWPORT'),floating=views.find(record=>values(record,69)[0]==='2');assert.ok(floating);assert.ok(Number(values(floating,90)[0])&65536);assert.deepEqual(values(floating,410),['Original polygon fixture']);const clip=byId.get(values(floating,340)[0]);assert.equal(clip[0][1],'LWPOLYLINE');assert.deepEqual(values(clip,330),values(floating,330));assert.deepEqual(values(clip,410),values(floating,410));assert.equal(Number(values(clip,70)[0])&1,1);assert.equal(Number(values(clip,90)[0]),6);
 const x=values(clip,10).map(Number),y=values(clip,20).map(Number);assert.deepEqual(x.map((value,i)=>point(value,y[i])),CONCAVE_BOUNDARY);const layer=records.find(record=>record[0][1]==='LAYER'&&values(record,2)[0]===values(clip,8)[0]);assert.equal(values(layer,290)[0],'0');assert.equal(fixture.editor.serialize(),before);assert.equal(fixture.editor.state.layers.some(item=>item.name===values(clip,8)[0]),false);
 const rectangle=makeViewportFixtures(core.createEditor).offsheet.editor.exportDXF();assert.equal(/^340\r?\n[^\r\n]+$/m.test(rectangle.split('AcDbViewport').slice(-1)[0].split('ENDSEC')[0]),false,'An ordinary rectangle does not acquire a polygon clipping pointer.');
});
test('a diagonal with both endpoints inside a concave viewport reports its interior notch crop without a paper-edge warning',()=>{
 const source=makeViewportFixtures(core.createEditor).concave.document;source.entities=[{id:'original-cross-notch-diagonal',type:'LINE',layer:'Red ruler',start:point(-500,350),end:point(400,-450)}];source.layouts[0].entities=[];const editor=core.createEditor(source),view=editor.state.layouts[0].viewports[0],text=editor.serialize();
 // Independent mapping: world start(-500,350) becomes paper(50,120),
 // end(400,-450) becomes(140,40). At paper x100 the line is y75.555...,
 // inside the missing region x>90,y>70 despite both endpoints being inside.
 assert.equal(core.pointInViewport(point(50,120),view),true);assert.equal(core.pointInViewport(point(140,40),view),true);assert.equal(core.pointInViewport(point(100,120-80*50/90),view),false);
 const built=buildPlotHTML([{title:'Original crossing-notch diagonal',text}],{createEditor:core.createEditor,options:{space:'current'}});assert.equal(built.report.sheets[0].viewports[0].viewportCropped,true);assert.equal(built.report.clipped,false);assert.equal(editor.serialize(),text);
});
