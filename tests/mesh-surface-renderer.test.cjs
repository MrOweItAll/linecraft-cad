'use strict';
// Exact production drawModel in a recorded Canvas host, not browser/GPU coverage.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.mjs'),'utf8');
const start='function drawModel(){',end='\nconst finiteScreenPoint=';
assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
const body=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const quad=()=>({id:'surface',type:'MESH',color:'#aabbcc',vertices:[{x:0,y:0,z:0},{x:10,y:0,z:0},{x:10,y:10,z:0},{x:0,y:10,z:0}],faces:[[0,1,2,3]]});
const key=(a,b)=>[a,b].map(p=>`${p.x},${p.y}`).sort().join('|');
const boundary=['0,0|10,0','10,0|10,10','0,10|10,10','0,0|0,10'].sort();
function verifyPainterOrder(operations){
 const style=o=>o.kind==='fill'?o.fillStyle:o.kind==='stroke'?o.strokeStyle:'';
 const back=operations.flatMap((o,i)=>(style(o)||'').startsWith('#c08020')?[i]:[]);
 const front=operations.flatMap((o,i)=>(style(o)||'').startsWith('#2060c0')?[i]:[]);
 assert.ok(back.length&&front.length);assert.ok(Math.max(...back)<Math.min(...front));
}
async function recorded(meshes,renderMode='shaded',options={}){
 const view3d=await import(pathToFileURL(path.join(root,'3d-view.mjs'))),operations=[];
 let points=[],style={lineCap:options.inheritedLineCap??'butt'},stack=[];
 const ctx={save(){stack.push({...style});},restore(){style=stack.pop();},setLineDash(value){style.dash=Array.from(value);},beginPath(){points=[];},moveTo(x,y){points.push({move:true,x,y});},lineTo(x,y){points.push({x,y});},closePath(){if(points.length)points.push({...points[0],move:false});},fill(){operations.push({kind:'fill',points:structuredClone(points),...style});},stroke(){operations.push({kind:'stroke',points:structuredClone(points),...style});},fillText(){}};
 for(const property of ['fillStyle','strokeStyle','lineWidth','lineCap','globalAlpha','font'])Object.defineProperty(ctx,property,{get:()=>style[property],set:value=>{style[property]=value;}});
 const host={ctx,sceneForOrbit:()=>meshes,renderContext:{includeEdits:false},gripPreview:()=>null,currentRoofDragPreview:()=>null,camera3D:()=>({...view3d.defaultCamera(),renderMode}),state:()=>({selectionIds:[],architecture:null,architectureDerived:null}),inkFor:e=>e.color,architectureOwner:()=>null,roofDisplayEdges:()=>null,view3d,toScreen:p=>({...p,depth:p.z??0,clipped:false}),finiteScreenPoint:p=>Number.isFinite(p.x)&&Number.isFinite(p.y),shadeInk:(ink,intensity)=>`${ink}:${intensity}`,commandPreviewEntities:()=>[],orbitMode:null,drag:null,pointer:null,width:1000,height:1000,selectedSubobject:null,gripPropertyIndices:new Map(),projectionEdges:e=>view3d.meshEdges(e),strokeEntity:(entity,options)=>operations.push({kind:'wire',entity,options})};
 host.state=()=>({selectionIds:options.selected?meshes.map(e=>e.id):[],architecture:null,architectureDerived:null});
 host.roofDisplayEdges=()=>options.roofOwned?[]:null;
 host.commandPreviewEntities=()=>options.ghost?[quad()]:[];
 vm.runInNewContext(`(${body})()`,host,{timeout:1000});
 const fills=operations.filter(o=>o.kind==='fill');
 // Mock shadeInk tags model styles; orientation axes have untagged fixed colors.
 const modelStrokes=operations.filter(o=>o.kind==='stroke'&&/^#[a-f0-9]{6}:/.test(o.strokeStyle||''));
 const strokes=modelStrokes.filter(o=>o.strokeStyle!==o.fillStyle);
 const surfaceStrokes=modelStrokes.filter(o=>o.strokeStyle===o.fillStyle);
 const edges=[];
 for(const stroke of strokes)for(let i=1;i<stroke.points.length;i++)if(!stroke.points[i].move)edges.push(key(stroke.points[i-1],stroke.points[i]));
 return{operations,fills,strokes,surfaceStrokes,edges};
}
test('shaded quad fills100 square units with four real outlines and no fan diagonal',async()=>{
 const mesh=quad(),before=structuredClone(mesh),r=await recorded([mesh]);
 assert.equal(r.fills.length,2);
 const area=r.fills.reduce((sum,f)=>{const p=f.points;return sum+Math.abs(p.slice(0,-1).reduce((s,a,i)=>s+a.x*p[i+1].y-p[i+1].x*a.y,0))/2;},0);
 assert.equal(area,100);assert.equal(r.fills[0].fillStyle,r.fills[1].fillStyle);
 assert.deepEqual(r.edges.sort(),boundary);assert.deepEqual(mesh,before);
 assert.throws(()=>assert.deepEqual(r.edges.slice(1).sort(),boundary),assert.AssertionError);
 assert.throws(()=>assert.deepEqual([...r.edges,'0,0|10,10'].sort(),boundary),assert.AssertionError);
 assert.throws(()=>assert.deepEqual([...r.edges,'20,20|30,30'].sort(),boundary),assert.AssertionError);
});
test('stored coplanar triangles suppress their shared diagonal',async()=>{
 const mesh=quad();mesh.faces=[[0,1,2],[0,2,3]];
 assert.deepEqual((await recorded([mesh])).edges.sort(),boundary);
});
test('opposite winding of adjacent coplanar triangles still leaves four outlines',async()=>{
 const mesh=quad();mesh.faces=[[0,1,2],[3,2,0]];
 assert.deepEqual((await recorded([mesh])).edges.sort(),boundary);
});
test('nonplanar quad retains its real folded diagonal',async()=>{
 const mesh=quad();mesh.vertices[3].z=5;
 const r=await recorded([mesh]);assert.ok(r.edges.includes('0,0|10,10'));assert.equal(r.fills.length,2);assert.notEqual(r.fills[0].fillStyle,r.fills[1].fillStyle);
});
test('wireframe retains existing stored triangulation edges',async()=>{
 const mesh=quad();mesh.faces=[[0,1,2],[0,2,3]];
 const r=await recorded([mesh],'wireframe');assert.equal(r.fills.length,0);
 const wire=r.operations.filter(o=>o.kind==='wire');assert.equal(wire.length,5);assert.deepEqual(wire.map(o=>key(o.entity.start,o.entity.end)).sort(),[...boundary,'0,0|10,10'].sort());
});
test('shaded outlines retain triangle painter ordering instead of a global edge overlay',async()=>{
 const back=quad(),front=quad();back.color='#c08020';front.color='#2060c0';front.vertices=front.vertices.map(p=>({...p,z:1}));
 const r=await recorded([front,back]);
 verifyPainterOrder(r.operations);
 const backStroke=r.operations.find(o=>o.kind==='stroke'&&(o.strokeStyle||'').startsWith('#c08020'));
 const bad=[...r.operations,{...backStroke,fillStyle:'#2060c0:stale-style'}];
 assert.throws(()=>verifyPainterOrder(bad),assert.AssertionError);
});
test('surface classification preserves nonmanifold and duplicate-face uncertainty',async()=>{
 const view=await import(pathToFileURL(path.join(root,'3d-view.mjs')));assert.equal(typeof view.meshShadedTriangles,'function');
 const duplicate=quad();duplicate.faces=[[0,1,2],[0,1,2]];
 const duplicateRows=view.meshShadedTriangles(duplicate);assert.equal(duplicateRows.length,2);assert.ok(duplicateRows.every(t=>t.outlineEdges.every(Boolean)));
 const mesh=quad();mesh.vertices.push({x:5,y:-10,z:0});mesh.faces=[[0,1,2],[1,0,3],[0,1,4]];
 const rows=view.meshShadedTriangles(mesh);assert.equal(rows.length,3);assert.ok(rows.every(t=>t.outlineEdges[0]));
});
test('degenerate faces keep conservative edges and do not mutate source geometry',async()=>{
 const view=await import(pathToFileURL(path.join(root,'3d-view.mjs')));assert.equal(typeof view.meshShadedTriangles,'function');
 const mesh={type:'MESH',vertices:[{x:0,y:0,z:0},{x:5,y:0,z:0},{x:10,y:0,z:0}],faces:[[0,1,2]]},before=structuredClone(mesh);
 const rows=view.meshShadedTriangles(mesh);assert.equal(rows.length,1);assert.ok(rows.every(t=>t.outlineEdges.every(Boolean)));assert.deepEqual(rows[0].points,mesh.vertices);assert.deepEqual(mesh,before);
});
test('crease classification preserves a shallow nonplanar fold',async()=>{
 const view=await import(pathToFileURL(path.join(root,'3d-view.mjs'))),mesh=quad();mesh.vertices[3].z=1e-5;
 const rows=view.meshShadedTriangles(mesh);assert.equal(rows.length,2);assert.ok(rows.every(t=>t.outlineEdges.every(Boolean)));
});
test('coplanar classification handles tiny finite coordinates without reciprocal overflow',async()=>{
 const view=await import(pathToFileURL(path.join(root,'3d-view.mjs'))),mesh=quad();mesh.vertices=mesh.vertices.map(p=>({x:p.x*1e-320,y:p.y*1e-320,z:0}));
 assert.equal(view.meshShadedTriangles(mesh).flatMap(t=>t.outlineEdges).filter(Boolean).length,4);
});
test('distinct vertex indices remain intentional boundaries without coordinate welding',async()=>{
 const view=await import(pathToFileURL(path.join(root,'3d-view.mjs'))),mesh=quad();mesh.vertices=[mesh.vertices[0],mesh.vertices[1],mesh.vertices[2],{...mesh.vertices[0]},{...mesh.vertices[2]},mesh.vertices[3]];mesh.faces=[[0,1,2],[3,4,5]];
 const rows=view.meshShadedTriangles(mesh);assert.equal(rows.length,2);assert.ok(rows.every(t=>t.outlineEdges.every(Boolean)));
});

test('translated flat surface and same-side overlapping faces remain conservative',async()=>{
 const view=await import(pathToFileURL(path.join(root,'3d-view.mjs'))),mesh=quad();mesh.vertices=mesh.vertices.map(p=>({x:p.x+1e12,y:p.y+1e12,z:1e12}));
 const translated=view.meshShadedTriangles(mesh);assert.equal(translated.length,2);assert.deepEqual(translated.map(t=>t.outlineEdges),[[true,true,false],[false,true,true]]);
 const overlap=quad();overlap.vertices[3]={x:5,y:5,z:0};overlap.faces=[[0,1,2],[0,1,3]];const rows=view.meshShadedTriangles(overlap);assert.equal(rows.length,2);assert.ok(rows.every(t=>t.outlineEdges.every(Boolean)));
});
test('separate entities retain their own boundaries even at identical coordinates',async()=>{
 const a=quad(),b=quad();a.faces=[[0,1,2]];b.faces=[[0,2,3]];b.id='other';
 const result=await recorded([a,b]);assert.equal(result.fills.length,2);assert.equal(result.edges.filter(e=>e==='0,0|10,10').length,2);assert.equal(result.edges.length,6);
});

test('internal coplanar edges use exact surface color and solid outline-width butt strokes',async()=>{
 for(const triangles of [false,true]){
  const mesh=quad();if(triangles)mesh.faces=[[0,1,2],[0,2,3]];
  const r=await recorded([mesh],'shaded',{inheritedLineCap:'round'});assert.equal(r.surfaceStrokes.length,2);
  for(const stroke of r.surfaceStrokes){
   assert.equal(stroke.strokeStyle,r.fills[0].fillStyle);assert.equal(stroke.globalAlpha,1);
   assert.equal(stroke.lineWidth,.7);assert.equal(stroke.lineCap,'butt');assert.deepEqual(stroke.dash,[]);
   assert.equal(stroke.points.length,2);assert.equal(key(...stroke.points),'0,0|10,10');
   const index=r.operations.indexOf(stroke);assert.equal(r.operations[index-1].kind,'fill');
   assert.equal(r.operations[index-1].fillStyle,stroke.strokeStyle);
   assert.equal(r.operations[index+1].kind,'stroke');assert.notEqual(r.operations[index+1].strokeStyle,stroke.strokeStyle);
  }
  assert.deepEqual(r.edges.sort(),boundary);
  assert.ok(r.strokes.every(s=>s.lineCap==='round'),'Surface paint must restore inherited outline cap');
 }
});

test('selected opaque surfaces match their actual selection fill color',async()=>{
 const r=await recorded([quad()],'shaded',{selected:true});assert.equal(r.surfaceStrokes.length,2);
 assert.ok(r.surfaceStrokes.every(s=>s.strokeStyle===r.fills[0].fillStyle && s.strokeStyle.startsWith('#79b9ff:')));
});

test('surface-color strokes do not touch roof-owned, translucent preview, or folded paths',async()=>{
 for(const options of [{roofOwned:true},{ghost:true}]){
  const r=await recorded(options.ghost?[]:[quad()],'shaded',options);assert.equal(r.surfaceStrokes.length,0);assert.equal(r.fills.length,2);
  if(options.ghost)assert.ok(r.fills.every(f=>f.globalAlpha===.55));
 }
 const folded=quad();folded.vertices[3].z=5;assert.equal((await recorded([folded])).surfaceStrokes.length,0);
});

test('matching edges stay with their triangle when an occluder interleaves depths',async()=>{
 const mesh=quad();mesh.color='#c08020';mesh.vertices=mesh.vertices.map(p=>({...p,z:p.x/10}));
 const front={...quad(),id:'occluder',color:'#2060c0',faces:[[0,1,2]],vertices:quad().vertices.map(p=>({...p,z:.5}))};
 const r=await recorded([mesh,front]);
 assert.deepEqual(r.fills.map(f=>f.fillStyle.split(':')[0]),['#c08020','#2060c0','#c08020']);
 assert.equal(r.surfaceStrokes.length,2);
 for(const stroke of r.surfaceStrokes){const i=r.operations.indexOf(stroke);assert.equal(r.operations[i-1].kind,'fill');assert.equal(stroke.strokeStyle,r.operations[i-1].fillStyle);}
});
