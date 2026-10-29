import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,UNIT_PRESETS} from '../core.mjs';
import {roofBoundaryEdgeKey} from '../architecture/roof-boundary.mjs';
import {createStructuralRoofExport} from '../architecture/structural-bridge.mjs';
import {createStructuralRoofAssignmentExport,validateStructuralRoofAssignmentResult} from '../architecture/structural-assignments.mjs';
import {createStructuralRoofBoundaryExport,inspectStructuralTributaryBoundaries,measureStructuralTributaryPolygon} from '../architecture/structural-boundaries.mjs';

// Original synthetic arithmetic oracle. No load standard, framing or client plan.
const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-8,`${actual} != ${expected}`);
const rectangle=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
function drawing(){
 const boundary=rectangle(0,0,40,20),editor=createEditor({settings:{...UNIT_PRESETS.architectural,units:'ft'}});
 const added=editor.applyArchitecture({type:'addRoof',name:'Synthetic opposing-plane reference',boundary,roofType:'GABLE',gableAssignments:[1,3].map(i=>roofBoundaryEdgeKey(boundary[i],boundary[(i+1)%4])),riseTwice:16,pitchAssignments:[{edgeKey:roofBoundaryEdgeKey(boundary[0],boundary[1]),riseTwice:12}],bearingElevation:10,overhang:0,heelOffset:0});
 assert.equal(added.ok,true,added.message);return JSON.parse(editor.serialize());
}
const material=[{label:'Synthetic surface declaration',psf:10,basis:'sloping-surface'},{label:'Synthetic horizontal declaration',psf:2,basis:'projected-horizontal'}];
function geometry(doc){return createStructuralRoofExport(doc,{roofGroupId:'roof-1',memberTributaryAreaSF:100,memberLabel:'Synthetic comparison'});}

test('literal opposing planes locate the ridge and both physical faces independently',()=>{
 const doc=drawing(),before=JSON.stringify(doc),request=geometry(doc),south=request.region.faces.find(f=>f.risePer12===6),north=request.region.faces.find(f=>f.risePer12===8);
 // .5*y = (2/3)*(20-y): y=80/7, rise=40/7; eave elevation is10.
 near(request.region.projectedAreaSF,800);near(request.region.maxElevationFt,110/7);
 for(const [face,projected,surface,vertices] of [
  [south,3200/7,1600*Math.sqrt(5)/7,[[0,0,10],[40,0,10],[40,80/7,110/7],[0,80/7,110/7]]],
  [north,2400/7,800*Math.sqrt(13)/7,[[0,20,10],[40,20,10],[40,80/7,110/7],[0,80/7,110/7]]]
 ]){
  assert.ok(face);near(face.projectedAreaSF,projected);near(face.surfaceAreaSF,surface);assert.equal(face.verticesWorldFt.length,4);
  for(const [x,y,z] of vertices)assert.ok(face.verticesWorldFt.some(p=>Math.hypot(p.x-x,p.y-y,p.z-z)<=1e-8));
 }
 assert.equal(JSON.stringify(doc),before);assert.equal(request.status,'calculation-only');
});

test('literal declarations establish per-face dead and live forces without export-derived expected loads',()=>{
 const doc=drawing(),base=geometry(doc),south=base.region.faces.find(f=>f.risePer12===6),north=base.region.faces.find(f=>f.risePer12===8);
 const request=createStructuralRoofAssignmentExport(doc,{roofGroupId:'roof-1',assignments:[
  {id:'south',memberLabel:'Synthetic south',faceId:south.id,projectedTributaryAreaSF:125,deadLoadItems:material},
  {id:'north',memberLabel:'Synthetic north',faceId:north.id,projectedTributaryAreaSF:175,deadLoadItems:material}
 ]});
 const literals=[{id:'south',face:south.id,pitch:6,area:125,deadPSF:5*Math.sqrt(5)+2,deadPounds:625*Math.sqrt(5)+250,R1:.8,livePSF:16,livePounds:2000},
  {id:'north',face:north.id,pitch:8,area:175,deadPSF:10*Math.sqrt(13)/3+2,deadPounds:1750*Math.sqrt(13)/3+350,R1:1,livePSF:20,livePounds:3500}];
 for(const expected of literals){const a=request.assignments.find(x=>x.id===expected.id);near(a.deadLoad.projectedPSF,expected.deadPSF);near(a.deadLoad.pounds,expected.deadPounds);}
 const rounded=x=>Number(x.toFixed(3)),result={version:2,kind:'linecraft-structural-roof-assignment-result',status:'calculation-only',exportHash:request.exportHash,
  source:{documentHash:request.source.documentHash,architectureHash:request.source.architectureHash},regionId:request.regionId,
  engine:{id:'synthetic-literal-declaration',version:'0',sourceCommit:'a'.repeat(40),roofLiveSHA256:'b'.repeat(64)},
  calculationBoundsPSF:{min:0,max:100},calculationPrecision:{factorDecimals:4,loadDecimals:3,forceDecimals:3},
  calculations:literals.map(x=>({assignmentId:x.id,memberLabel:'Synthetic '+x.id,faceId:x.face,pitchRisePer12:x.pitch,projectedTributaryAreaSF:x.area,F:x.pitch,R1:x.R1,R2:1,L0PSF:20,LrPSF:x.livePSF,deadLoadProjectedPSF:rounded(x.deadPSF),deadLoadPounds:rounded(x.deadPounds),roofLivePounds:x.livePounds})),
  warnings:['Synthetic factor declarations only; no engine execution or load-standard approval.']};
 const checked=validateStructuralRoofAssignmentResult(doc,request,result);assert.deepEqual(checked.calculations.map(x=>x.roofLivePounds),[2000,3500]);
 assert.equal(checked.verification.engineExecutionAuthenticity,'unverified');assert.equal(checked.verification.memberCapacity,'not-provided');assert.equal(checked.verification.assignmentAggregation,'none');
 const wrong=structuredClone(result);wrong.calculations[0].deadLoadPounds+=1;assert.throws(()=>validateStructuralRoofAssignmentResult(doc,request,wrong),/basis|arithmetic/);
});

test('literal located rectangles distinguish adjacency overlap and outside-face area',()=>{
 const doc=drawing(),face=geometry(doc).region.faces.find(f=>f.risePer12===6);
 const row=(id,x0,x1)=>({id,memberLabel:'Synthetic independent check',faceId:face.id,areaDefinition:{kind:'drawn-boundary',coordinateSystem:'world-xy-feet',vertices:rectangle(x0,2,x1,6)},deadLoadItems:material});
 const options={roofGroupId:'roof-1',assignments:[row('left',2,12),row('adjacent',12,22)]},before=JSON.stringify(options);
 const review=inspectStructuralTributaryBoundaries(doc,options),request=createStructuralRoofBoundaryExport(doc,options);
 assert.equal(review.canExport,true);assert.equal(review.overlapPairs.length,0);assert.deepEqual(request.assignments.map(x=>x.projectedTributaryAreaSF),[40,40]);assert.equal(JSON.stringify(options),before);
 const overlapping={roofGroupId:'roof-1',assignments:[row('left',2,12),row('overlap',7,17)]},bad=inspectStructuralTributaryBoundaries(doc,overlapping);
 assert.equal(bad.canExport,false);assert.equal(bad.overlapPairs.length,1);near(bad.overlapPairs[0].projectedIntersectionAreaSF,20);assert.throws(()=>createStructuralRoofBoundaryExport(doc,overlapping),/overlap/);
 const outside=rectangle(2,10,12,14),measured=measureStructuralTributaryPolygon(outside,rectangle(0,0,40,80/7));near(measured.projectedAreaSF,40);near(measured.outsideAreaSF,180/7);assert.equal(measured.contained,false);
 const outsideOptions={roofGroupId:'roof-1',assignments:[{...row('outside',2,12),areaDefinition:{kind:'drawn-boundary',coordinateSystem:'world-xy-feet',vertices:outside}}]};
 const outsideReview=inspectStructuralTributaryBoundaries(doc,outsideOptions);assert.equal(outsideReview.canExport,false);assert.ok(outsideReview.diagnostics.some(d=>d.code==='BOUNDARY_OUTSIDE_FACE'));
 assert.throws(()=>createStructuralRoofBoundaryExport(doc,outsideOptions),/must stay within the current source face/);
});
