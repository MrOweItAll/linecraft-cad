import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,makePlanarSurface,planarMeshSurface} from '../core.mjs';
import {defaultCamera,projectPoint,pickMesh,meshShadedTriangles} from '../3d-view.mjs';
import {parseDXF3D} from './mesh-reference.mjs';

// Literal geometry and independent area/volume/topology arithmetic; no generated oracle.
const xy=[{x:0,y:0,z:5},{x:10,y:0,z:5},{x:10,y:20,z:5},{x:0,y:20,z:5}];
const tilted=[{x:1,y:2,z:3},{x:4,y:2,z:7},{x:4,y:8,z:7},{x:1,y:8,z:3}];
const concave=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]].map(([x,y])=>({x,y,z:2}));
const seq=(e,values)=>{for(const v of values){const r=e.execute(v);assert.equal(r.ok,true,`${v}: ${r.message}`);}return e;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const triangles=m=>m.faces.flatMap(f=>f.length===3?[f]:[[f[0],f[1],f[2]],[f[0],f[2],f[3]]]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z];
const area=m=>triangles(m).reduce((s,[a,b,c])=>s+Math.hypot(...cross(subtract(m.vertices[b],m.vertices[a]),subtract(m.vertices[c],m.vertices[a])))/2,0);
const volume=m=>triangles(m).reduce((s,[a,b,c])=>{const p=m.vertices[a],q=m.vertices[b],r=m.vertices[c],n=cross([q.x,q.y,q.z],[r.x,r.y,r.z]);return s+(p.x*n[0]+p.y*n[1]+p.z*n[2])/6;},0);
function closedShell(m){
 const edges=new Map();for(const f of m.faces)for(let i=0;i<f.length;i++){const a=f[i],b=f[(i+1)%f.length],k=[a,b].sort((a,b)=>a-b).join(',');const v=edges.get(k)||[];v.push([a,b]);edges.set(k,v);}
 for(const v of edges.values()){assert.equal(v.length,2);assert.deepEqual(v[0],[v[1][1],v[1][0]]);}
 assert.equal(m.vertices.length-edges.size+m.faces.length,2);assert.ok(volume(m)>0);
}
function draft(points){const e=seq(createEditor(),['3DPOLY']);for(const p of points)assert.equal(e.submitPoint(p).ok,true);return e;}
function surface(points=xy){const e=draft(points);seq(e,['C']);assert.equal(e.state.entities.length,1);assert.equal(e.state.entities[0].type,'MESH');return e;}
const literalMesh=(points=xy)=>({id:'surface',type:'MESH',layer:'0',vertices:structuredClone(points),faces:[[0,1,2],[0,2,3]]});

test('Close creates one surface with the same ID and exact XYZ, area200 and one history transaction',()=>{
 const e=draft(xy),id=e.state.entities[0].id;seq(e,['C']);const m=structuredClone(e.state.entities[0]);assert.equal(m.type,'MESH');assert.equal(m.id,id);assert.equal(e.state.entities.length,1);assert.deepEqual(m.vertices,xy);near(area(m),200);assert.equal(m.faces.length,2);
 assert.ok(!('points'in m)&&!('closed'in m)&&!('primitive'in m));e.undo();assert.equal(e.state.entities.length,0);e.redo();assert.deepEqual(e.state.entities,[m]);
});
test('tilted and reversed outlines retain exact vertices and area30',()=>{
 for(const points of [tilted,[...tilted].reverse()]){const e=surface(points);assert.deepEqual(e.state.entities[0].vertices,points);near(area(e.state.entities[0]),30);}
});
test('concave surface area7 retains the notch and supports real interior face picking',()=>{
 const m=surface(concave).state.entities[0];near(area(m),7);const camera={...defaultCamera(),target:{x:2,y:2,z:2},yaw:-90,pitch:90,scale:50,projection:'orthographic'};
 assert.ok(pickMesh(m,projectPoint({x:.5,y:2,z:2},camera,400,400),camera,400,400));assert.equal(pickMesh(m,projectPoint({x:2,y:2,z:2},camera,400,400),camera,400,400),null);
});
test('collinear boundary vertices remain stored and used in nondegenerate triangles',()=>{
 const p=[[0,0],[2,0],[4,0],[4,3],[0,3]].map(([x,y])=>({x,y,z:0})),m=surface(p).state.entities[0];assert.deepEqual(m.vertices,p);assert.equal(m.faces.length,3);assert.equal(new Set(m.faces.flat()).size,5);near(area(m),12);for(const f of m.faces)assert.ok(area({...m,faces:[f]})>0);
});
test('existing shaded mesh classification preserves only the four rectangle boundary edges',()=>{
 const m=surface().state.entities[0],faces=meshShadedTriangles(m);assert.equal(faces.length,2);assert.equal(faces.flatMap(f=>f.outlineEdges).filter(Boolean).length,4);
});
test('creation roundtrip, clipboard and DXF preserve the actual surface vertices/faces',()=>{
 const e=surface(tilted),m=structuredClone(e.state.entities[0]),saved=e.serialize(),loaded=createEditor(JSON.parse(saved));assert.deepEqual(loaded.state.entities,[m]);
 e.select([m.id]);assert.equal(e.copySelection({x:0,y:0,z:0}).ok,true);assert.deepEqual(e.getClipboard().entities[0].vertices,tilted);
 const d=parseDXF3D(e.exportDXF());assert.equal(d.polylines.length,0);assert.equal(d.faces.length,2);assert.deepEqual(d.faces.map(f=>f.points),m.faces.map(f=>f.map(i=>m.vertices[i])));
});
test('nonplanar, crossing, repeated and collinear closed outlines remain exact paths',()=>{
 const variants=[xy.map((p,i)=>({...p,z:p.z+(i===3?1:0)})),[xy[0],xy[2],xy[1],xy[3]],[xy[0],xy[1],xy[2],xy[0],xy[3]],[0,1,2,3].map(x=>({x,y:0,z:0}))];
 for(const points of variants){const e=draft(points),r=e.execute('C');assert.equal(r.ok,true);assert.equal(e.state.entities.length,1);const p=e.state.entities[0];assert.equal(p.type,'POLY3D');assert.equal(p.closed,true);assert.deepEqual(p.points,points);assert.match(r.message,/path|surface/i);}
});
test('open Enter, local Undo and Escape preserve path behavior without premature fill',()=>{
 const e=draft(xy);assert.equal(e.state.entities[0].type,'POLY3D');seq(e,['U']);assert.equal(e.state.commandPoints.length,3);seq(e,['ESC']);assert.equal(e.state.entities[0].closed,false);e.undo();assert.equal(e.state.entities.length,0);
 const open=draft(xy);seq(open,['']);assert.equal(open.state.entities[0].type,'POLY3D');assert.equal(open.state.entities[0].closed,false);
});
test('repeated start followed by Close removes only the duplicate terminal vertex',()=>{
 const m=surface([...xy,xy[0]]).state.entities[0];assert.deepEqual(m.vertices,xy);near(area(m),200);
});
test('stored closed POLY3D and internal outline-only completion stay compatible',()=>{
 const stored={id:'path',type:'POLY3D',layer:'0',points:structuredClone(xy),closed:true},loaded=createEditor({entities:[stored]});assert.deepEqual(loaded.state.entities,[stored]);
 const e=draft(xy);assert.equal(e.execute('C',{createSurface:false}).ok,true);assert.equal(e.state.entities[0].type,'POLY3D');assert.deepEqual(e.state.entities[0].points,xy);
});
test('EXTRUDE planar surface produces volume600, retains the source and exact base vertices',()=>{
 const source=literalMesh(),e=createEditor({entities:[source]});seq(e,['EXTRUDE','LAST','','3']);assert.equal(e.state.entities.length,2);assert.deepEqual(e.state.entities[0],source);const m=e.state.entities[1];assert.deepEqual(m.vertices.slice(0,4),xy);assert.deepEqual(m.vertices.slice(4),xy.map(p=>({...p,z:p.z+3})));closedShell(m);near(volume(m),600);e.undo();assert.deepEqual(e.state.entities,[source]);e.redo();closedShell(e.state.entities[1]);
});
test('tilted surface extrusion follows (-4/5,0,3/5), signed height and exact base',()=>{
 for(const height of [5,-5]){const source=literalMesh(tilted),e=createEditor({entities:[source]});seq(e,['EXTRUDE','LAST','']);const preview=e.previewScalar(height)[0];seq(e,[String(height)]);const m=e.state.entities[1];assert.deepEqual(m, {...preview,id:m.id});assert.deepEqual(m.vertices.slice(0,4),tilted);
  // New offset coordinates involve normalized floating-point arithmetic; the original base stays exact.
  const expected=tilted.map(p=>({x:p.x-4*height/5,y:p.y,z:p.z+3*height/5}));for(let i=0;i<4;i++)for(const axis of ['x','y','z'])assert.ok(Math.abs(m.vertices[i+4][axis]-expected[i][axis])<=64*Number.EPSILON*Math.max(1,Math.abs(expected[i][axis]),Math.abs(tilted[i][axis])));
  closedShell(m);near(volume(m),150);}
});
test('new concave surfaces extrude volume14 with consistently oriented closed topology',()=>{
 for(const points of [concave,[...concave].reverse()])for(const h of [2,-2]){const e=surface(points),source=structuredClone(e.state.entities[0]);seq(e,['EXTRUDE','LAST','',String(h)]);assert.deepEqual(e.state.entities[0],source);const m=e.state.entities[1];closedShell(m);near(volume(m),14);}
});
test('zero or unrepresentably small extrusion height fails without partial output',()=>{
 const e=createEditor({entities:[literalMesh()]});seq(e,['EXTRUDE','LAST','']);const before=e.serialize();for(const h of ['0','1e-30']){assert.equal(e.execute(h).ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'height');}seq(e,['3']);near(volume(e.state.entities[1]),600);
});
test('nonplanar edit prevents further surface extrusion atomically',()=>{
 const e=createEditor({entities:[literalMesh()]});assert.equal(e.moveGrip('surface',3,{x:0,y:20,z:6}).ok,true);const before=e.serialize();seq(e,['EXTRUDE','LAST']);assert.equal(e.execute('').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.entities.length,1);
});
test('overlap, reversed shared edge, disconnected and holed surfaces cannot extrude',()=>{
 const overlap=literalMesh();overlap.faces.push([0,1,2]);
 const winding=literalMesh();winding.faces[1]=[3,2,0];
 const disconnected={id:'d',type:'MESH',layer:'0',vertices:[{x:0,y:0,z:0},{x:2,y:0,z:0},{x:0,y:2,z:0},{x:5,y:0,z:0},{x:7,y:0,z:0},{x:5,y:2,z:0}],faces:[[0,1,2],[3,4,5]]};
 const ring={id:'r',type:'MESH',layer:'0',vertices:[[0,0],[4,0],[4,4],[0,4],[1,1],[3,1],[3,3],[1,3]].map(([x,y])=>({x,y,z:0})),faces:[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]};
 for(const m of [overlap,winding,disconnected,ring]){const e=createEditor({entities:[m]}),before=e.serialize();seq(e,['EXTRUDE','LAST']);assert.equal(e.execute('').ok,false);assert.equal(e.serialize(),before);}
});
test('mixed valid and invalid surface selection commits no partial extrusion',()=>{
 const a=literalMesh(),b=literalMesh();b.id='other';b.vertices[3].z+=1;const e=createEditor({entities:[a,b]}),before=e.serialize();seq(e,['EXTRUDE','ALL']);assert.equal(e.execute('').ok,false);assert.equal(e.serialize(),before);
});
test('surface creation retains its layer and extrusion inherits explicit display properties',()=>{
 const e=createEditor();assert.equal(e.addLayer('SurfaceLayer',{color:'#774499'}).ok,true);assert.equal(e.setCurrentLayer('SurfaceLayer').ok,true);seq(e,['3DPOLY']);for(const p of xy)assert.equal(e.submitPoint(p).ok,true);const id=e.state.entities[0].id;seq(e,['C']);assert.equal(e.state.entities[0].layer,'SurfaceLayer');assert.equal(e.state.entities[0].id,id);
 e.select([id]);assert.equal(e.setSelectionProperties({color:'#abcdef',lineweight:.35,linetype:'dashed'}).ok,true);seq(e,['EXTRUDE','3']);const m=e.state.entities[1];assert.equal(m.layer,'SurfaceLayer');assert.equal(m.color,'#abcdef');assert.equal(m.lineweight,.35);assert.equal(m.linetype,'dashed');
});
test('surface vertex limit rejects before triangulation and oversized closed outline remains usable',()=>{
 const points=Array.from({length:4097},(_,i)=>({x:i,y:i%2,z:0}));assert.throws(()=>makePlanarSurface(points),/4096/);
 const e=draft(points);const response=e.execute('C');assert.equal(response.ok,true);assert.match(response.message,/4096/);assert.equal(e.state.entities[0].type,'POLY3D');assert.equal(e.state.entities[0].closed,true);assert.deepEqual(e.state.entities[0].points,points);
 const large={id:'large',type:'MESH',layer:'0',vertices:points,faces:[[0,1,2]]};assert.throws(()=>planarMeshSurface(large),/4096/);
});
test('aggregate extrusion vertex limit leaves drawing, pending height and history intact',()=>{
 const large={id:'path',type:'POLY3D',layer:'0',points:Array.from({length:99993},(_,i)=>({x:i,y:100,z:0})),closed:false},source=literalMesh(),e=createEditor({entities:[large,source]});seq(e,['EXTRUDE','surface','']);const before=e.serialize(),canUndo=e.canUndo;assert.equal(e.execute('3').ok,false);assert.equal(e.serialize(),before);assert.equal(e.canUndo,canUndo);assert.equal(e.state.commandPhase,'height');
});
test('crossing and touching geometric boundaries are not accepted as extrusion surfaces',()=>{
 const crossing=literalMesh([xy[0],xy[2],xy[1],xy[3]]);
 const touching={id:'t',type:'MESH',layer:'0',vertices:[[0,0],[4,0],[2,2],[4,4],[0,4],[2,2]].map(([x,y])=>({x,y,z:0})),faces:[[0,1,2],[0,2,5],[5,3,4]]};
 assert.throws(()=>planarMeshSurface(crossing));assert.throws(()=>planarMeshSurface(touching));
});
test('a planar mesh with an interior vertex extrudes without adding interior side walls',()=>{
 const m={id:'fan',type:'MESH',layer:'0',vertices:[...structuredClone(xy),{x:5,y:10,z:5}],faces:[[0,1,4],[1,2,4],[2,3,4],[3,0,4]]},e=createEditor({entities:[m]});seq(e,['EXTRUDE','LAST','','3']);const solid=e.state.entities[1];assert.equal(solid.faces.length,12);closedShell(solid);near(volume(solid),600);assert.deepEqual(solid.vertices.slice(0,5),m.vertices);
});
test('cancel and a subsequent extrusion rebuild the plan for the new source',()=>{
 const a=literalMesh(),b=literalMesh(tilted);b.id='tilted';const e=createEditor({entities:[a,b]});seq(e,['EXTRUDE','surface','']);assert.equal(e.previewScalar(3).length,1);seq(e,['ESC','EXTRUDE','tilted','','5']);assert.deepEqual(e.state.entities[2].vertices.slice(0,4),tilted);closedShell(e.state.entities[2]);near(volume(e.state.entities[2]),150);
});
