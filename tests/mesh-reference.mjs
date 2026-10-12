import assert from 'node:assert/strict';
import {readDXFRecords} from './reference-annotations.mjs';

// Independent test mathematics: no runtime modeling/projection helpers are imported.
const xyz=point=>Array.isArray(point)?point:[point.x,point.y,point.z];
const subtract=(a,b)=>a.map((value,index)=>value-b[index]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);

export function meshBounds(vertices){
  const points=vertices.map(xyz);assert.ok(points.length,'Mesh requires vertices.');
  for(const point of points)assert.ok(point.length===3&&point.every(Number.isFinite),'Mesh vertex must contain three finite coordinates.');
  return points.reduce((result,point)=>({min:result.min.map((value,axis)=>Math.min(value,point[axis])),max:result.max.map((value,axis)=>Math.max(value,point[axis]))}),{min:[...points[0]],max:[...points[0]]});
}

export function meshTopology(mesh){
  const vertices=mesh.vertices.map(xyz),edges=new Map(),used=new Set();
  let triangles=0;
  for(const face of mesh.faces){
    assert.ok(Array.isArray(face)&&[3,4].includes(face.length),'Only triangle/quad faces are supported.');
    assert.equal(new Set(face).size,face.length,'Face indices must be distinct.');
    assert.ok(face.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length),'Face index is outside the vertex table.');
    triangles+=face.length-2;
    for(let index=0;index<face.length;index++){
      const start=face[index],end=face[(index+1)%face.length],key=start<end?`${start}:${end}`:`${end}:${start}`;
      used.add(start);const edge=edges.get(key)??{uses:0,balance:0};edge.uses++;edge.balance+=start<end?1:-1;edges.set(key,edge);
    }
    const a=vertices[face[0]],b=vertices[face[1]],c=vertices[face[2]];
    assert.ok(Math.hypot(...cross(subtract(b,a),subtract(c,a)))>0,'Face has zero area.');
  }
  const boundary=[...edges.entries()].filter(([,edge])=>edge.uses!==2),orientation=[...edges.entries()].filter(([,edge])=>edge.balance!==0);
  return {vertices:vertices.length,usedVertices:used.size,faces:mesh.faces.length,edges:edges.size,triangles,eulerCharacteristic:used.size-edges.size+mesh.faces.length,closed:boundary.length===0,consistentlyOriented:orientation.length===0,boundary,orientation};
}

export function meshSignedVolume(mesh){
  const vertices=mesh.vertices.map(xyz),origin=vertices[0],relative=vertices.map(point=>subtract(point,origin));
  let volume=0;
  for(const face of mesh.faces)for(let index=1;index<face.length-1;index++)volume+=dot(relative[face[0]],cross(relative[face[index]],relative[face[index+1]]))/6;
  return volume;
}

export function polygonArea(points){return Math.abs(points.reduce((sum,point,index)=>{const next=points[(index+1)%points.length];return sum+point.x*next.y-next.x*point.y;},0))/2;}

export function closeNumbers(actual,expected,tolerance=1e-8){
  if(typeof expected==='number')return Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance;
  if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((value,index)=>closeNumbers(actual[index],value,tolerance));
  if(expected&&typeof expected==='object')return actual&&typeof actual==='object'&&Object.keys(expected).length===Object.keys(actual).length&&Object.entries(expected).every(([key,value])=>closeNumbers(actual[key],value,tolerance));
  return actual===expected;
}

export function parseDXF3D(text){
  const {records}=readDXFRecords(text),faces=[],polylines=[],ignoredModelTypes={};let current=null;
  const first=(record,code)=>record.groups.find(([key])=>key===code)?.[1];
  const number=(record,code,fallback)=>{const value=first(record,code);if(value===undefined&&fallback!==undefined)return fallback;const result=Number(value);assert.ok(value!==undefined&&Number.isFinite(result),`Nonfinite/missing ${record.type} group${code}.`);return result;};
  const point=(record,code)=>({x:number(record,code),y:number(record,code+10),z:number(record,code+20,0)});
  const model=record=>record.section==='ENTITIES'&&first(record,67)?.trim()!=='1'&&(!first(record,410)||first(record,410).trim()==='Model');
  for(const record of records){
    if(!model(record))continue;
    if(record.type==='3DFACE'){
      const points=[10,11,12,13].map(code=>point(record,code));if(closeNumbers(points[2],points[3],1e-12))points.pop();
      faces.push({layer:first(record,8)?.trim()??'0',points,visibilityFlags:number(record,70,0)});
    }else if(record.type==='POLYLINE'){
      const flags=number(record,70,0);current=flags&8?{layer:first(record,8)?.trim()??'0',flags,closed:Boolean(flags&1),points:[],vertexFlags:[],complete:false}:null;if(current)polylines.push(current);
    }else if(record.type==='VERTEX'&&current){current.points.push(point(record,10));current.vertexFlags.push(number(record,70,0));}
    else if(record.type==='SEQEND'&&current){current.complete=true;current=null;}
    else ignoredModelTypes[record.type]=(ignoredModelTypes[record.type]??0)+1;
  }
  for(const polyline of polylines)assert.ok(polyline.complete,'3D polyline requires SEQEND.');
  return {faces,polylines,ignoredModelTypes};
}
