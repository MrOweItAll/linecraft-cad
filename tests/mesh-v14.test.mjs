import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,parseCoordinate3D,makeBoxMesh,makeCylinderMesh,makeSphereMesh,extrudeProfile,rotateEntity3D,bounds3D} from '../core.mjs';
import {meshBounds,meshTopology,meshSignedVolume,polygonArea,closeNumbers,parseDXF3D} from './mesh-reference.mjs';
import {readDXFRecords} from './reference-annotations.mjs';

const sequence=(editor,values)=>{for(const value of values){const result=editor.execute(value);assert.equal(result.ok,true,`${JSON.stringify(value)}: ${result.message}`);}return editor;};
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const closed=mesh=>{const topology=meshTopology(mesh);assert.equal(topology.closed,true);assert.equal(topology.consistentlyOriented,true);assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.usedVertices,topology.vertices);assert.ok(meshSignedVolume(mesh)>0);return topology;};
const box=()=>makeBoxMesh({x:1,y:2,z:3},{x:11,y:22,z:3},30);
const doc=editor=>JSON.parse(editor.serialize());

test('XYZ absolute/relative Cartesian input preserves Z and rejects unsupported 3D polar/nonfinite forms',()=>{
  assert.deepEqual(parseCoordinate3D('1,2,3'),{x:1,y:2,z:3});assert.deepEqual(parseCoordinate3D('@10,-20,0.5',{x:1,y:2,z:3}),{x:11,y:-18,z:3.5});assert.deepEqual(parseCoordinate3D('1,2'),{x:1,y:2,z:0});
  for(const text of ['@10<90','1,2,Infinity','1,2,NaN','1,2,3,4','@1e309,0,0'])assert.throws(()=>parseCoordinate3D(text));
});
test('BOX command yields a closed outward mesh with independently exact bounds/volume and one Undo',()=>{
  const editor=sequence(createEditor(),['BOX','1,2,3','@10,20,0','30']),mesh=editor.state.entities[0];assert.equal(mesh.type,'MESH');assert.equal(mesh.primitive,'BOX');assert.deepEqual(meshBounds(mesh.vertices),{min:[1,2,3],max:[11,22,33]});assert.equal(closed(mesh).faces,6);near(meshSignedVolume(mesh),6000);
  editor.undo();assert.equal(editor.state.entities.length,0);editor.redo();assert.deepEqual(editor.state.entities[0],mesh);
  const negative=makeBoxMesh({x:1,y:2,z:3},{x:11,y:22,z:3},-30);closed(negative);assert.deepEqual(meshBounds(negative.vertices),{min:[1,2,-27],max:[11,22,3]});near(meshSignedVolume(negative),6000);
});
test('BOX opposite-corner Z error retains the prompt and commits no partial geometry',()=>{
  const editor=sequence(createEditor(),['BOX','0,0,5']);const result=editor.execute('10,20,6');assert.equal(result.ok,false);assert.equal(editor.state.entities.length,0);assert.equal(editor.state.command,'BOX');assert.equal(editor.state.commandPhase,'opposite-corner');sequence(editor,['10,20,5','10']);assert.equal(editor.state.entities.length,1);
});
test('32-sided CYLINDER has closed caps and independent polygonal volume rather than an analytic-solid claim',()=>{
  for(const height of [12,-12]){const mesh=makeCylinderMesh({x:100,y:200,z:30},5,height,32),topology=closed(mesh);assert.equal(topology.vertices,66);assert.equal(topology.faces,96);near(meshSignedVolume(mesh),32*25*Math.sin(2*Math.PI/32)/2*Math.abs(height),1e-7);assert.deepEqual(meshBounds(mesh.vertices),{min:[95,195,Math.min(30,30+height)],max:[105,205,Math.max(30,30+height)]});}
});
test('SPHERE vertices lie on their radius, pole caps close, and polygonal volume is bounded independently',()=>{
  const center={x:-100,y:50,z:20},mesh=makeSphereMesh(center,10);closed(mesh);assert.deepEqual(meshBounds(mesh.vertices),{min:[-110,40,10],max:[-90,60,30]});for(const p of mesh.vertices)near(Math.hypot(p.x-center.x,p.y-center.y,p.z-center.z),10,1e-12);const volume=meshSignedVolume(mesh),analytic=4*Math.PI*1000/3;assert.ok(volume<analytic&&volume>analytic*.97,{volume,analytic});
});
test('concave EXTRUDE closes every edge and matches shoelace area times signed height without editing the profile',()=>{
  const points=[{x:0,y:0},{x:6,y:0},{x:6,y:2},{x:2,y:2},{x:2,y:6},{x:0,y:6}],profile={type:'PLINE',points,closed:true,layer:'0'},before=structuredClone(profile);
  for(const reverse of [false,true])for(const height of [7,-7]){const mesh=extrudeProfile({...profile,points:reverse?[...points].reverse():points},height);closed(mesh);near(meshSignedVolume(mesh),polygonArea(points)*Math.abs(height));assert.deepEqual(meshBounds(mesh.vertices),{min:[0,0,Math.min(0,height)],max:[6,6,Math.max(0,height)]});}assert.deepEqual(profile,before);
});
test('EXTRUDE rejects self-intersection/open profiles/zero height and removes only redundant collinear geometry',()=>{
  const profile={type:'PLINE',closed:true,layer:'0',points:[{x:0,y:0},{x:2,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}]};const result=extrudeProfile(profile,5);closed(result);near(meshSignedVolume(result),80);assert.equal(profile.points.length,5);
  assert.throws(()=>extrudeProfile({...profile,closed:false},5));assert.throws(()=>extrudeProfile(profile,0));assert.throws(()=>extrudeProfile({...profile,points:[{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}]},5));
});
test('world X/Y/Z cardinal rotations match independent equations and retain closed topology/volume',()=>{
  const original=box(),base={x:1,y:2,z:3};
  for(const axis of ['X','Y','Z']){const rotated=rotateEntity3D(original,base,axis,90),expected=original.vertices.map(p=>{const x=p.x-base.x,y=p.y-base.y,z=p.z-base.z;return axis==='X'?{x:p.x,y:base.y-z,z:base.z+y}:axis==='Y'?{x:base.x+z,y:p.y,z:base.z-x}:{x:base.x-y,y:base.y+x,z:p.z};});assert.deepEqual(rotated.vertices,expected);closed(rotated);near(meshSignedVolume(rotated),6000);assert.deepEqual(rotateEntity3D(rotated,base,axis,-90).vertices,original.vertices);}
});
test('3DPOLY local Undo and Close retain exact XYZ vertices and one global transaction',()=>{
  const editor=sequence(createEditor(),['3DPOLY','10,20,30','@5,0,4','@0,5,-2','U','@0,10,6','C']),entity=editor.state.entities[0];assert.equal(entity.type,'MESH');assert.deepEqual(entity.faces,[[0,1,2]]);assert.deepEqual(entity.vertices,[{x:10,y:20,z:30},{x:15,y:20,z:34},{x:15,y:30,z:40}]);editor.undo();assert.equal(editor.state.entities.length,0);editor.redo();assert.deepEqual(editor.state.entities[0],entity);
});
test('ROTATE3D command selection/axis/base/angle has exact geometry Undo/Redo',()=>{
  const editor=sequence(createEditor(),['BOX','1,2,3','11,22,3','30']),before=structuredClone(editor.state.entities);sequence(editor,['ROTATE3D','L','','X','1,2,3','90']);assert.deepEqual(editor.state.entities[0].vertices,before[0].vertices.map(p=>({x:p.x,y:5-p.z,z:1+p.y})));editor.undo();assert.deepEqual(editor.state.entities,before);editor.redo();closed(editor.state.entities[0]);
});
test('invalid MESH indices/degeneracy/nonfinite points and malformed camera reject atomic document import',()=>{
  const editor=sequence(createEditor(),['BOX','0,0,0','10,20,0','30']),before=editor.serialize();
  const mutations=[value=>value.entities[0].faces[0][0]=999,value=>value.entities[0].faces[0]=[0,0,1],value=>value.entities[0].vertices[0].z=null,value=>value.entities[0].vertices[0].z=Infinity,value=>value.entities[0].vertices[0]=value.entities[0].vertices[1],value=>value.camera3d.pitch=91,value=>value.camera3d.projection='javascript:evil',value=>value.camera3d.fov=151];
  for(const mutate of mutations){const value=doc(editor);mutate(value);assert.equal(editor.importJSON(JSON.stringify(value)).ok,false);assert.equal(editor.serialize(),before);}
});
test('portable 3D clipboard preserves XYZ base/face topology, rejects bad data and pastes exact displacement',()=>{
  const editor=sequence(createEditor(),['BOX','0,0,5','10,20,5','30','3DPOLY','30,0,10','40,5,15','']);editor.select(editor.state.entities.map(entity=>entity.id));assert.equal(editor.copySelection({x:0,y:0,z:5}).ok,true);const payload=editor.getClipboard();assert.deepEqual(payload.base,{x:0,y:0,z:5});
  const bad=structuredClone(payload);bad.entities[0].faces[0][0]=999;assert.equal(editor.setClipboard(bad).ok,false);assert.deepEqual(editor.getClipboard(),payload);
  const source=structuredClone(editor.state.entities);sequence(editor,['PASTECLIP','100,200,305']);assert.equal(editor.state.entities.length,4);for(let index=0;index<2;index++){const key=source[index].type==='MESH'?'vertices':'points';assert.deepEqual(editor.state.entities[index+2][key],source[index][key].map(p=>({x:p.x+100,y:p.y+200,z:p.z+300})));}editor.undo();assert.deepEqual(editor.state.entities,source);
});
test('3D vertex grips are undoable and collapsed face grips reject without changing geometry',()=>{
  const editor=sequence(createEditor(),['BOX','0,0,0','10,20,0','30']),before=structuredClone(editor.state.entities[0]);assert.equal(editor.moveGrip(before.id,0,{x:-1,y:-2,z:-3}).ok,true);assert.deepEqual(editor.state.entities[0].vertices[0],{x:-1,y:-2,z:-3});editor.undo();assert.deepEqual(editor.state.entities[0],before);const unchanged=editor.serialize();assert.equal(editor.moveGrip(before.id,0,before.vertices[1]).ok,false);assert.equal(editor.serialize(),unchanged);
});
test('3D workspace/camera/construction settings save and restore with independent XYZ union bounds',()=>{
  const editor=sequence(createEditor(),['BOX','1,2,3','11,22,3','30']);assert.equal(editor.setWorkspace('3d').ok,true);assert.equal(editor.set3DView({target:{x:6,y:12,z:18},yaw:33,pitch:12,roll:7,projection:'perspective',distance:300,fov:60,autoTarget:false}).ok,true);assert.equal(editor.updateDrawingSettings({constructionElevation:17}).ok,true);const saved=editor.serialize(),loaded=createEditor();assert.equal(loaded.importJSON(saved).ok,true);assert.deepEqual(loaded.state.camera3d,editor.state.camera3d);assert.equal(loaded.state.workspace,'3d');assert.equal(loaded.state.settings.constructionElevation,17);assert.deepEqual(bounds3D(loaded.state.entities),{minX:1,maxX:11,minY:2,maxY:22,minZ:3,maxZ:33});assert.ok(closeNumbers(meshBounds(loaded.state.entities[0].vertices),{min:[1,2,3],max:[11,22,33]}));
});
test('original DXF preserves each mesh face XYZ and a complete parent-owned 3D POLYLINE vertex chain',()=>{
  const editor=sequence(createEditor(),['BOX','0,0,5','10,20,5','30','CYLINDER','50,0,0','5','10','SPHERE','100,0,0','10','3DPOLY','0,50,5','10,60,15','20,50,25']);assert.equal(editor.execute('C',{createSurface:false}).ok,true);
  const text=editor.exportDXF(),parsed=parseDXF3D(text),meshes=editor.state.entities.filter(entity=>entity.type==='MESH'),expected=meshes.flatMap(mesh=>mesh.faces.map(face=>({layer:mesh.layer,points:face.map(index=>mesh.vertices[index]),visibilityFlags:0})));
  assert.equal(parsed.faces.length,614);assert.ok(closeNumbers(parsed.faces,expected));assert.equal(parsed.polylines.length,1);assert.deepEqual(parsed.polylines[0].points,editor.state.entities.at(-1).points);assert.equal(parsed.polylines[0].closed,true);assert.ok(parsed.polylines[0].flags&8);assert.ok(parsed.polylines[0].vertexFlags.every(flags=>flags===32));
  const records=readDXFRecords(text).records,first=(record,code)=>record.groups.find(([key])=>key===code)?.[1]?.trim(),handles=records.map(record=>first(record,5)??first(record,105)).filter(Boolean);assert.equal(new Set(handles).size,handles.length);const model=records.find(record=>record.type==='BLOCK_RECORD'&&first(record,2)==='*Model_Space'),poly=records.find(record=>record.section==='ENTITIES'&&record.type==='POLYLINE');assert.ok(model&&poly);for(const record of records.filter(record=>record.section==='ENTITIES'&&record.type==='3DFACE'))assert.equal(first(record,330),first(model,5));for(const record of records.filter(record=>record.section==='ENTITIES'&&['VERTEX','SEQEND'].includes(record.type)))assert.equal(first(record,330),first(poly,5));
});
