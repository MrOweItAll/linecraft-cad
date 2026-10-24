import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,snapCandidates,findSnap,presetUCS} from '../core.mjs';
import {trimEntityGeometry} from '../trim-geometry.mjs';
const L=(id,x1,y1,x2,y2)=>({id,type:'LINE',layer:'0',start:{x:x1,y:y1},end:{x:x2,y:y2}});
const fixture=()=>[L('target',-20,0,120,0),L('left',0,-40,0,40),L('right',100,-40,100,40)];
const state=e=>JSON.parse(e.serialize()),entity=(e,id='target')=>e.state.entities.find(v=>v.id===id);
const run=(e,...tokens)=>{for(const token of tokens){const r=e.execute(token);assert.equal(r.ok,true,`${token}: ${r.message}`);}};
const ok=r=>assert.equal(r.ok,true,r.message),near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Quick is the new default; repeated exterior trims commit one global group and retain an earlier edit',()=>{
 const e=createEditor({entities:fixture()});run(e,'L','200,0','210,0','');const before=state(e);run(e,'TR');assert.equal(e.getTrimState().mode,'quick');assert.equal(e.state.commandPhase,'target');ok(e.trimPick({x:-10,y:0}));ok(e.trimPick({x:110,y:0}));assert.deepEqual(entity(e).start,{x:0,y:0});assert.deepEqual(entity(e).end,{x:100,y:0});run(e,'');const after=state(e);ok(e.undo());assert.deepEqual(state(e),before);ok(e.redo());assert.deepEqual(state(e),after);ok(e.undo());ok(e.undo());assert.equal(e.state.entities.length,3);
});
test('Standard explicitly selects boundaries and empty confirmation means all visible boundaries',()=>{
 const e=createEditor({entities:fixture()});run(e,'TR','Mode','Standard');assert.equal(e.state.commandPhase,'selection');ok(e.select(['left']));run(e,'');ok(e.trimPick({x:-10,y:0}));assert.equal(entity(e).start.x,0);assert.equal(entity(e).end.x,120);run(e,'');run(e,'TR','');ok(e.trimPick({x:110,y:0}));assert.equal(entity(e).end.x,100);
});
test('Quick erases an ordinary supported untrimmable object and local Undo restores it',()=>{
 const e=createEditor({entities:[L('isolated',0,0,100,0)]}),before=state(e);run(e,'TR');ok(e.trimPick({x:50,y:0}));assert.equal(e.state.entities.length,0);run(e,'U');assert.deepEqual(state(e),before);run(e,'');assert.equal(e.canUndo,false);
});
test('Shift-select extends in TRIM and trims in EXTEND without changing command',()=>{
 const e=createEditor({entities:[L('target',20,0,80,0),...fixture().slice(1)]});run(e,'TR');ok(e.trimPick({x:78,y:0},{extend:true}));assert.equal(entity(e).end.x,100);assert.equal(e.state.command,'TRIM');run(e,'U','');assert.equal(entity(e).end.x,80);run(e,'EX');ok(e.trimPick({x:78,y:0},{extend:true}));assert.equal(e.state.command,'EXTEND');assert.equal(entity(e),undefined); // untrimmable Quick inverse trim erases
});
test('Fence applies two targets as one local action and final grouped Undo/Redo is exact',()=>{
 const e=createEditor({entities:[...fixture(),L('second',-20,20,120,20)]}),before=state(e);run(e,'TR','F','-10,-20','-10,40','');for(const id of['target','second'])assert.equal(entity(e,id).start.x,0);run(e,'U');assert.deepEqual(state(e),before);run(e,'F','-10,-20','-10,40','','');const after=state(e);ok(e.undo());assert.deepEqual(state(e),before);ok(e.redo());assert.deepEqual(state(e),after);
});
test('Two empty Quick clicks create an automatic two-point fence without preliminary selection',()=>{
 const e=createEditor({entities:[...fixture(),L('second',-20,20,120,20)]});run(e,'TR');ok(e.trimPick({x:-10,y:-20}));assert.ok(e.getTrimState().automaticFence);ok(e.trimPick({x:-10,y:30}));assert.equal(entity(e).start.x,0);assert.equal(entity(e,'second').start.x,0);assert.equal(e.getTrimState().automaticFence,null);
});
test('Crossing uses its clockwise fence to trim both right tails; freehand path shares batching',()=>{
 const e=createEditor({entities:[...fixture(),L('second',-20,20,120,20)]});run(e,'TR','C','105,35','115,-15');for(const id of['target','second'])assert.equal(entity(e,id).end.x,100);run(e,'U');ok(e.trimFence([{x:110,y:-20},{x:112,y:5},{x:108,y:22},{x:110,y:35}]));for(const id of['target','second'])assert.equal(entity(e,id).end.x,100);
});
test('Cutting edges temporarily restrict Quick mode and Erase remains inside TRIM',()=>{
 const e=createEditor({entities:fixture()});run(e,'TR','T');ok(e.select(['left']));run(e,'');ok(e.trimPick({x:-10,y:0}));assert.equal(entity(e).end.x,120);run(e,'R');ok(e.trimPick({x:100,y:20}));assert.equal(entity(e,'right'),undefined);run(e,'U');assert.ok(entity(e,'right'));run(e,'');assert.equal(e.state.command,'TRIM');run(e,'');assert.equal(e.state.command,null);
});
test('Finite versus natural implied LINE edge is an explicit exact Standard distinction',()=>{
 const e=createEditor({entities:[L('target',-20,0,120,0),L('cut',100,20,100,40)]});run(e,'TR','O','S');ok(e.select(['cut']));run(e,'','E','N');const before=state(e);assert.equal(e.trimPick({x:110,y:0}).ok,false);assert.deepEqual(state(e),before);run(e,'E','E');ok(e.trimPick({x:110,y:0}));assert.equal(entity(e).end.x,100);
});
test('Natural extension of an ARC cutting boundary follows its complete circle',()=>{
 const line=L('target',-100,0,100,0),arc={id:'cut',type:'ARC',center:{x:0,y:0},radius:50,startAngle:30,sweepAngle:120,layer:'0'};
 assert.throws(()=>trimEntityGeometry(line,[arc],{x:75,y:0}),/No cutting/);const output=trimEntityGeometry(line,[arc],{x:75,y:0},{edgeExtend:true});near(output[0].end.x,50);
});
test('A circle target becomes the exact opposite semicircle; a finite signed arc retains its correct piece',()=>{
 for(const [type,startAngle,sweepAngle]of[['CIRCLE',undefined,undefined],['ARC',0,180],['ARC',180,-180]]){const target={id:'curve',type,center:{x:0,y:0},radius:50,layer:'0',...(type==='ARC'?{startAngle,sweepAngle}:{})},e=createEditor({entities:[target,L('cut',0,-80,0,80)]});run(e,'TR');ok(e.trimPick(type==='CIRCLE'?{x:50,y:0}:{x:35.35533905932738,y:35.35533905932738},{entityId:'curve'}));const result=entity(e,'curve');assert.equal(result.type,'ARC');near(result.radius,50);if(type==='CIRCLE'){near(result.startAngle,90);near(result.sweepAngle,180);}else if(sweepAngle>0){near(result.startAngle,90);near(result.sweepAngle,90);}else{near(result.startAngle,180);near(result.sweepAngle,-90);}}
});
test('Open polylines preserve connectivity and properties through multiple cuts',()=>{
 const source={id:'target',type:'PLINE',points:[{x:-20,y:0},{x:50,y:0},{x:120,y:0},{x:120,y:30}],closed:false,layer:'0',color:'#123456'},e=createEditor({entities:[source,...fixture().slice(1)]});run(e,'TR');ok(e.trimPick({x:-10,y:0}));ok(e.trimPick({x:110,y:0}));assert.deepEqual(entity(e).points,[{x:0,y:0},{x:50,y:0},{x:100,y:0}]);assert.equal(entity(e).color,'#123456');assert.equal(entity(e).closed,false);
});
test('Closed rectangle path opens into one exact connected retained half',()=>{
 const rect={id:'target',type:'RECTANG',layer:'0',points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]},e=createEditor({entities:[rect,L('cut',50,-20,50,120)]});run(e,'TR');ok(e.trimPick({x:100,y:50}));const path=entity(e);assert.equal(path.type,'PLINE');assert.equal(path.closed,false);assert.deepEqual(path.points,[{x:50,y:100},{x:0,y:100},{x:0,y:0},{x:50,y:0}]);
});
test('Circle-circle intersections trim analytically without display sampling',()=>{
 const a={id:'a',type:'CIRCLE',center:{x:0,y:0},radius:50,layer:'0'},b={id:'b',type:'CIRCLE',center:{x:50,y:0},radius:50,layer:'0'},result=trimEntityGeometry(a,[b],{x:50,y:0})[0];near(result.startAngle,60);near(result.sweepAngle,240);
});
test('Finite ARC extension advances to the first natural-circle boundary intersection',()=>{
 const a={id:'a',type:'ARC',center:{x:0,y:0},radius:50,startAngle:0,sweepAngle:45,layer:'0'},result=trimEntityGeometry(a,[L('b',0,-100,0,100)],{x:35.3553390593,y:35.3553390593},{extend:true})[0];near(result.startAngle,0);near(result.sweepAngle,90);
});
test('Visible flat INSERT children act as boundaries without modifying definitions or reference',()=>{
 const block={name:'Cuts',base:{x:0,y:0},entities:[{type:'LINE',layer:'0',start:{x:0,y:-40},end:{x:0,y:40}}]},reference={id:'block',type:'INSERT',layer:'0',blockName:'Cuts',position:{x:0,y:0},scale:1,rotation:0},e=createEditor({blocks:[block],entities:[fixture()[0],reference]});const before=state(e);run(e,'TR','O','S');ok(e.select(['block']));run(e,'');ok(e.trimPick({x:-10,y:0}));assert.equal(entity(e).start.x,0);assert.deepEqual(state(e).blocks,before.blocks);assert.deepEqual(entity(e,'block'),before.entities[1]);
});
test('World-XY hatch boundaries act as cutting geometry while hatch targets reject without approximation',()=>{
 const hatch={id:'h',type:'HATCH',layer:'0',boundary:{type:'RECTANG',points:[{x:0,y:-10},{x:100,y:-10},{x:100,y:10},{x:0,y:10}]},pattern:'solid',origin:{x:0,y:0},angle:0,spacing:10},e=createEditor({entities:[fixture()[0],hatch]});run(e,'TR','O','S');ok(e.select(['h']));run(e,'');ok(e.trimPick({x:-10,y:0}));assert.equal(entity(e).start.x,0);const before=state(e);assert.equal(e.trimPick({x:10,y:1},{entityId:'h'}).ok,false);assert.deepEqual(state(e),before);
});
test('Project None rejects separated XYZ geometry; UCS projects to its XY plane while retaining target Z',()=>{
 const target={id:'target',type:'POLY3D',layer:'0',closed:false,points:[{x:-20,y:0,z:10},{x:120,y:0,z:10}]},e=createEditor({settings:{trimExtendMode:'standard'},entities:[target,L('cut',100,-40,100,40)]});run(e,'TR');ok(e.select(['cut']));run(e,'','P','N');const before=state(e);assert.equal(e.trimPick({x:110,y:0,z:10},{entityId:'target'}).ok,false);assert.deepEqual(state(e),before);run(e,'P','U');ok(e.trimPick({x:110,y:0,z:10},{entityId:'target'}));assert.deepEqual(entity(e).points,[{x:-20,y:0,z:10},{x:100,y:0,z:10}]);
});
test('Project View cuts along an independently supplied current view direction',()=>{
 const target={id:'target',type:'POLY3D',layer:'0',closed:false,points:[{x:-20,y:10,z:0},{x:120,y:10,z:0}]},cut={id:'cut',type:'POLY3D',layer:'0',closed:false,points:[{x:100,y:0,z:-40},{x:100,y:0,z:40}]},e=createEditor({settings:{trimExtendMode:'standard'},entities:[target,cut]});run(e,'TR');ok(e.select(['cut']));run(e,'','P','View');ok(e.setTrimProjectionView({right:{x:1,y:0,z:0},up:{x:0,y:0,z:1}}));ok(e.trimPick({x:110,y:10,z:0},{entityId:'target'}));assert.deepEqual(entity(e).points.at(-1),{x:100,y:10,z:0});
});
test('Locked, hidden and generated target IDs cannot mutate accepted source',()=>{
 const e=createEditor({layers:[{name:'0'},{name:'Locked',locked:true},{name:'Hidden',visible:false}],entities:[...fixture(),{...L('lock',0,100,100,100),layer:'Locked'},{...L('hide',0,200,100,200),layer:'Hidden'}]});run(e,'TR');for(const id of['lock','hide']){const before=state(e);assert.equal(e.trimPick({x:50,y:100},{entityId:id}).ok,false);assert.deepEqual(state(e),before);}const before=state(e);assert.equal(e.trimPick({x:50,y:0},{entityId:'@architecture/roofGroup/no-source/surface'}).ok,false);assert.deepEqual(state(e),before);
});
test('Unsupported ELLIPSE target and collapsed projection reject without Quick erasure',()=>{
 const e=createEditor({entities:[{id:'ell',type:'ELLIPSE',layer:'0',center:{x:0,y:0},major:{x:50,y:0},ratio:.5}]});run(e,'TR');const before=state(e);assert.equal(e.trimPick({x:50,y:0},{entityId:'ell'}).ok,false);assert.deepEqual(state(e),before);
 const circle={id:'c',type:'CIRCLE',layer:'0',center:{x:0,y:0},radius:10};assert.throws(()=>trimEntityGeometry(circle,[L('b',0,-20,0,20)],{x:10,y:0},{project:'view',view:{right:{x:1,y:0,z:0},up:{x:0,y:0,z:1}}}),/collapses/);
});
test('Invalid fences reject atomically and accepted previews are read-only',()=>{
 const e=createEditor({entities:fixture()});run(e,'TR');const before=state(e);assert.equal(e.trimFence([{x:0,y:0},{x:Infinity,y:0}]).ok,false);assert.deepEqual(state(e),before);const preview=e.previewObject('target',{x:-10,y:0});assert.equal(preview[0].start.x,0);assert.deepEqual(state(e),before);assert.equal(e.trimPick({x:0,y:0},{entityId:'target'}).ok,false);assert.deepEqual(state(e),before);
});
test('A selected cutting object can also be trimmed and subsequent cuts use its current fragments',()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:[L('h',-10,0,10,0),L('v',0,-10,0,10),L('other',5,-10,5,10)]});run(e,'TR');ok(e.select(['h','v']));run(e,'');ok(e.trimPick({x:8,y:0},{entityId:'h'}));const before=state(e);assert.equal(e.trimPick({x:5,y:8},{entityId:'other'}).ok,false);assert.deepEqual(state(e),before);run(e,'U');ok(e.trimPick({x:5,y:8},{entityId:'other'}));assert.equal(entity(e,'other').end.y,0);
});
test('Native serialization preserves expanded trim settings and exact accepted paths',()=>{
 const e=createEditor({entities:fixture()});run(e,'TRIMEXTENDMODE','0','EDGEMODE','1','PROJMODE','0','TR');ok(e.select(['left','right']));run(e,'');ok(e.trimPick({x:-10,y:0}));run(e,'');const accepted=state(e),copy=createEditor(accepted);assert.deepEqual(state(copy),accepted);assert.equal(copy.getTrimState().mode,'standard');assert.equal(copy.getTrimState().project,'none');assert.equal(copy.getTrimState().edgeExtend,true);
});
test('New command path retains representable sub-unit cuts on very long lines',()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:[L('target',0,0,1e12,0),L('cut',.1,-1,.1,1)]});run(e,'TR');ok(e.select(['cut']));run(e,'');ok(e.trimPick({x:.05,y:0},{entityId:'target'}));near(entity(e).start.x,.1);assert.equal(entity(e).end.x,1e12);
});
test('Perpendicular core candidates use the accepted anchor and roundtrip settings without changing defaults',()=>{
 const source=L('line',0,0,100,0),anchor={x:37,y:42};const candidates=snapCandidates(source,{snapAnchor:anchor});const perpendicular=candidates.find(v=>v.type==='perpendicular');assert.deepEqual(perpendicular.point,{x:37,y:0});const found=findSnap([source],{x:37.1,y:.1},2,{snapAnchor:anchor,settings:{snapModes:['perpendicular']}});assert.equal(found.type,'perpendicular');assert.deepEqual(found.point,{x:37,y:0});const e=createEditor();assert.equal(e.state.settings.snapModes.includes('perpendicular'),false);ok(e.updateDraftingSettings({snapModes:['perpendicular']}));assert.deepEqual(createEditor(state(e)).state.settings.snapModes,['perpendicular']);
});
test('Standard cutting-boundary Fence and Crossing select geometry without editing it',()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:fixture()}),before=state(e);run(e,'TR','F','-10,30','110,30','');assert.equal(e.state.commandPhase,'selection');assert.deepEqual([...e.state.selectionIds].sort(),['left','right']);assert.deepEqual(state(e),before);run(e,'R','left','A','C','-5,5','5,35');assert.deepEqual([...e.state.selectionIds].sort(),['left','right']);assert.deepEqual(state(e),before);run(e,'');ok(e.trimPick({x:110,y:0}));assert.equal(entity(e).end.x,100);
});
test('Crossing corners use the current tilted view basis while retaining exact target depth',()=>{
 const target={id:'target',type:'POLY3D',layer:'0',closed:false,points:[{x:-20,y:10,z:0},{x:120,y:10,z:0}]},cut={id:'cut',type:'POLY3D',layer:'0',closed:false,points:[{x:100,y:0,z:-40},{x:100,y:0,z:40}]},e=createEditor({workspace:'3d',settings:{trimProject:'view'},entities:[target,cut]});ok(e.setTrimProjectionView({right:{x:1,y:0,z:0},up:{x:0,y:0,z:1}}));run(e,'TR');ok(e.trimFence([{x:105,y:10,z:5},{x:115,y:10,z:-5}],{crossing:true}));assert.deepEqual(entity(e).points.at(-1),{x:100,y:10,z:0});
});
test('A multi-hit fence follows newly split descendants and never trims a removed tail twice',()=>{
 const e=createEditor({entities:[L('target',0,0,100,0),L('left',25,-40,25,40),L('right',75,-40,75,40)]});run(e,'TR');ok(e.trimFence([{x:50,y:-10},{x:50,y:10},{x:90,y:10},{x:90,y:-10}]));assert.deepEqual(entity(e).start,{x:0,y:0});assert.deepEqual(entity(e).end,{x:25,y:0});assert.equal(e.state.entities.filter(entity=>entity.type==='LINE'&&entity.start.y===0&&entity.end.y===0).length,1);
});
test('Drawing trim preferences persist across local and global geometry Undo',()=>{
 const e=createEditor({entities:fixture()});run(e,'TR');ok(e.trimPick({x:-10,y:0}));run(e,'P','None','U');assert.equal(entity(e).start.x,-20);assert.equal(e.state.settings.trimProject,'none');run(e,'');assert.equal(e.canUndo,false);run(e,'TR');ok(e.trimPick({x:110,y:0}));run(e,'');ok(e.undo());assert.equal(e.state.settings.trimProject,'none');assert.equal(entity(e).end.x,120);
});
test('Project View and fence edits reject perspective rather than approximating an orthographic camera',()=>{
 const e=createEditor({workspace:'3d',camera3d:{projection:'perspective'},settings:{trimProject:'view'},entities:fixture()});run(e,'TR');const before=state(e);assert.equal(e.trimPick({x:110,y:0},{entityId:'target'}).ok,false);assert.deepEqual(state(e),before);assert.equal(e.trimFence([{x:110,y:-10},{x:110,y:10}]).ok,false);assert.deepEqual(state(e),before);run(e,'P');assert.equal(e.execute('View').ok,false);assert.deepEqual(state(e),before);
});
test('Unsupported numeric intersection range cannot trigger Quick erase',()=>{
 const e=createEditor({entities:[L('target',0,0,1e308,0),L('cut',1e307,-1e308,1e307,1e308)]});run(e,'TR');const before=state(e);const r=e.trimPick({x:5e307,y:0},{entityId:'target'});assert.equal(r.ok,false);assert.match(r.message,/numeric range/);assert.deepEqual(state(e),before);
});
test('Project None circular target geometry is independent of a rotated or edge-on UCS',()=>{
 const line=L('cut',0,-80,0,80),circle={id:'target',type:'CIRCLE',center:{x:0,y:0},radius:50,layer:'0'},arc={...circle,type:'ARC',startAngle:0,sweepAngle:180};
 for(const target of[circle,arc]){const pick=target.type==='CIRCLE'?{x:50,y:0}:{x:35.35533905932738,y:35.35533905932738},expected=trimEntityGeometry(target,[line],pick,{project:'none'});for(const plane of[presetUCS('XZ'),presetUCS('YZ')])assert.deepEqual(trimEntityGeometry(target,[line],pick,{project:'none',plane}),expected);}
 const e=createEditor({ucs:presetUCS('XZ'),settings:{constructionPlane:'XZ',trimProject:'none',trimExtendMode:'standard'},entities:[circle,line]});run(e,'TR');ok(e.select(['cut']));run(e,'');ok(e.trimPick({x:50,y:0},{entityId:'target'}));near(entity(e).startAngle,90);near(entity(e).sweepAngle,180);assert.deepEqual(e.state.ucs,presetUCS('XZ'));
});
test('Paper TRIM uses sheet XY for UCS and View, preserving model UCS and ignoring prior model camera overrides',()=>{
 for(const project of['ucs','view']){const e=createEditor({workspace:'3d'});ok(e.setUCS('XZ'));ok(e.setTrimProjectionView({right:{x:0,y:1,z:0},up:{x:0,y:0,z:1}}));const modelUCS=structuredClone(e.state.ucs);ok(e.addLayout('Paper'));ok(e.setSpace('paper',e.state.layouts[0].id));ok(e.updateDraftingSettings({trimProject:project}));run(e,'L','0,0','100,0','','L','70,-20','70,20','');const before=state(e);run(e,'TR');ok(e.trimPick({x:90,y:0}));const paperLines=e.state.entities.filter(v=>v.layoutId===e.state.activeLayoutId);assert.equal(paperLines.length,2);assert.deepEqual(paperLines[0].end,{x:70,y:0});assert.deepEqual(e.state.ucs,modelUCS);run(e,'');ok(e.undo());assert.deepEqual(state(e),before);}
});
test('True3D incidence tolerance never converts unrelated long coordinates into a real Z intersection',()=>{
 const line=(id,z)=>({id,type:'POLY3D',layer:'0',closed:false,points:id==='target'?[{x:0,y:0,z},{x:1e12,y:0,z}]:[{x:1e11,y:-10,z},{x:1e11,y:10,z}]});
 for(const [z,gap]of[[0,1],[0,1e-6],[1e12,1],[1e12,.001]]){const target=line('target',z+gap),boundary=line('cut',z);assert.throws(()=>trimEntityGeometry(target,[boundary],{x:9e11,y:0,z:z+gap},{project:'none'}),/No cutting/);const e=createEditor({settings:{trimProject:'none',trimExtendMode:'standard'},entities:[target,boundary]});run(e,'TR');ok(e.select(['cut']));run(e,'');const before=state(e);assert.equal(e.trimPick({x:9e11,y:0,z:z+gap},{entityId:'target'}).ok,false);assert.deepEqual(state(e),before);}
 const output=trimEntityGeometry(line('target',1),[line('cut',1)],{x:9e11,y:0,z:1},{project:'none'});near(output[0].points.at(-1).x,1e11);assert.equal(output[0].points.at(-1).z,1);
});
test('True3D line-circle incidence uses Z precision rather than the target length or circle radius',()=>{
 const circle={id:'circle',type:'CIRCLE',layer:'0',center:{x:0,y:0},radius:50},target={id:'target',type:'POLY3D',layer:'0',closed:false,points:[{x:-1e6,y:0,z:1e-6},{x:1e6,y:0,z:1e-6}]};assert.throws(()=>trimEntityGeometry(target,[circle],{x:100,y:0,z:1e-6},{project:'none'}),/No cutting/);const coplanar={...target,points:target.points.map(p=>({...p,z:0}))},output=trimEntityGeometry(coplanar,[circle],{x:100,y:0,z:0},{project:'none'});near(output[0].points.at(-1).x,50);assert.equal(output[0].points.at(-1).z,0);
});
test('Long line-circle cuts retain the exact analytic chord and circular target parameters',()=>{
 for(const half of[1e6,1e8,1e12]){const line=L('line',-half,0,half,0),circle={id:'circle',type:'CIRCLE',layer:'0',center:{x:0,y:0},radius:1},cut=trimEntityGeometry(line,[circle],{x:half/2,y:0},{project:'none'});assert.equal(cut[0].end.x,1);assert.equal(cut[0].end.y,0);const curved=trimEntityGeometry(circle,[line],{x:0,y:1},{project:'none'})[0];near(curved.startAngle,180);near(curved.sweepAngle,180);}
});
test('Disparate circle radii retain two real intersections rather than a false tangent or Quick erasure',()=>{
 const target={id:'target',type:'CIRCLE',layer:'0',center:{x:0,y:0},radius:1e8},boundary={id:'boundary',type:'CIRCLE',layer:'0',center:{x:1e8,y:0},radius:1},arc=trimEntityGeometry(target,[boundary],{x:1e8,y:0},{project:'none'})[0];assert.equal(arc.type,'ARC');assert.ok(arc.startAngle>0&&arc.startAngle<.000001);assert.ok(arc.sweepAngle<360&&arc.sweepAngle>359.999998);const e=createEditor({settings:{trimProject:'none'},entities:[target,boundary]});run(e,'TR');ok(e.trimPick({x:1e8,y:0},{entityId:'target'}));assert.equal(entity(e).type,'ARC');
});
test('Nearly parallel true3D lines use cross products rather than a canceled Gram determinant',()=>{
 const target={id:'target',type:'POLY3D',layer:'0',closed:false,points:[{x:0,y:0,z:0},{x:100,y:0,z:0}]},boundary={id:'boundary',type:'POLY3D',layer:'0',closed:false,points:[{x:0,y:-1e-7,z:0},{x:100,y:1e-7,z:0}]};for(const project of['none','ucs']){const output=trimEntityGeometry(target,[boundary],{x:75,y:0,z:0},{project});near(output[0].points.at(-1).x,50);assert.equal(output[0].points.at(-1).z,0);}const skew={...boundary,points:boundary.points.map(p=>({...p,z:1e-6}))};assert.throws(()=>trimEntityGeometry(target,[skew],{x:75,y:0,z:0},{project:'none'}),/No cutting/);
});
test('Unsupported visible cutting curves cannot make Quick silently erase an apparently untrimmable line',()=>{
 const ellipse={id:'ellipse',type:'ELLIPSE',layer:'0',center:{x:50,y:0},major:{x:10,y:0},ratio:.5};
 for(const mode of['quick','standard']){const e=createEditor({settings:{trimExtendMode:mode},entities:[L('target',0,0,100,0),ellipse]}),before=state(e);run(e,'TR');if(mode==='standard')run(e,'');const r=e.trimPick({x:90,y:0},{entityId:'target'});assert.equal(r.ok,false);assert.match(r.message,/ambiguous.*ELLIPSE.*unsupported/);assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);run(e,'');assert.equal(e.canUndo,false);assert.deepEqual(state(e),before);}
 const e=createEditor({entities:[L('target',0,0,100,0),ellipse]});run(e,'TR','R');ok(e.trimPick({x:90,y:0},{entityId:'target'}));assert.equal(entity(e),undefined);run(e,'U');assert.ok(entity(e));
});
test('Unsupported INSERT and hatch-outline curves remain visible in all-boundary ambiguity checks',()=>{
 const ellipse={type:'ELLIPSE',layer:'0',center:{x:50,y:0},major:{x:10,y:0},ratio:.5},block={name:'Curved',base:{x:0,y:0},entities:[ellipse]},reference={id:'block',type:'INSERT',layer:'0',blockName:'Curved',position:{x:0,y:0},scale:1,rotation:0},hatch={id:'hatch',type:'HATCH',layer:'0',boundary:ellipse,pattern:'solid',origin:{x:0,y:0},angle:0,spacing:10};
 for(const boundary of[reference,hatch]){const e=createEditor({blocks:[block],entities:[L('target',0,0,100,0),boundary]});run(e,'TR');const before=state(e);assert.equal(e.trimPick({x:90,y:0},{entityId:'target'}).ok,false);assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);}
 const mixed={...block,entities:[L('child',70,-20,70,20),ellipse]},e=createEditor({blocks:[mixed],settings:{trimExtendMode:'standard'},entities:[L('target',0,0,100,0),reference]});run(e,'TR');ok(e.select(['block']));const before=state(e);assert.equal(e.execute('').ok,false);assert.deepEqual(state(e),before);assert.equal(e.state.commandPhase,'selection');
});
test('A supported cut cannot hide a nearer unsupported all-boundary cutter; explicit supported selection remains available',()=>{
 const entities=[L('target',0,0,100,0),L('supported',20,-20,20,20),{id:'ellipse',type:'ELLIPSE',layer:'0',center:{x:50,y:0},major:{x:10,y:0},ratio:.5}];
 for(const mode of['quick','standard']){const e=createEditor({settings:{trimExtendMode:mode},entities});run(e,'TR');if(mode==='standard')run(e,'');const before=state(e);const rejected=e.trimPick({x:90,y:0},{entityId:'target'});assert.equal(rejected.ok,false);assert.match(rejected.message,/ambiguous.*ELLIPSE.*unsupported/);assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);run(e,'T');ok(e.select(['supported']));run(e,'');ok(e.trimPick({x:90,y:0},{entityId:'target'}));assert.equal(entity(e).end.x,20);}
});
const unsupportedSelectorFixture=()=>[L('target',0,0,100,0),L('supported',20,-20,20,20),{id:'ellipse',type:'ELLIPSE',layer:'0',center:{x:50,y:0},major:{x:10,y:0},ratio:.5}];
test('Standard ALL retains unsupported curve candidates and rejects them without editing or adding Undo',()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:unsupportedSelectorFixture()}),before=state(e);run(e,'TR','ALL');assert.deepEqual(e.state.selectionIds,['target','supported','ellipse']);const rejected=e.execute('');assert.equal(rejected.ok,false);assert.match(rejected.message,/unsupported ELLIPSE/);assert.equal(rejected.changed,false);assert.equal(e.state.commandPhase,'selection');assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);ok(e.clearSelection());ok(e.select(['supported']));run(e,'');ok(e.trimPick({x:90,y:0},{entityId:'target'}));assert.equal(entity(e).end.x,20);run(e,'');ok(e.undo());assert.deepEqual(state(e),before);
});
test('Standard LAST chooses the actual latest curved boundary candidate rather than an older supported line',()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:unsupportedSelectorFixture()}),before=state(e);run(e,'TR','LAST');assert.deepEqual(e.state.selectionIds,['ellipse']);const rejected=e.execute('');assert.equal(rejected.ok,false);assert.match(rejected.message,/unsupported ELLIPSE/);assert.equal(e.state.commandPhase,'selection');assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);
});
for(const [name,tokens]of[['Fence',['F','10,0','70,0']],['Crossing',['C','15,-30']]])test(`Standard boundary ${name} cannot silently return a supported subset around unsupported curves`,()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:unsupportedSelectorFixture()}),before=state(e);run(e,'TR');ok(e.select(['supported']));run(e,...tokens);const rejected=e.execute(name==='Fence'?'':'65,30');assert.equal(rejected.ok,false);assert.match(rejected.message,new RegExp(`${name}.*ambiguous.*ELLIPSE.*unsupported`));assert.equal(rejected.changed,false);assert.equal(e.state.commandPhase,'selection');assert.deepEqual(e.state.commandPoints,[]);assert.deepEqual(e.state.selectionIds,['supported']);assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);run(e,'');ok(e.trimPick({x:90,y:0},{entityId:'target'}));assert.equal(entity(e).end.x,20);run(e,'');ok(e.undo());assert.deepEqual(state(e),before);
});
test('Boundary selectors expose nested unsupported curves and ignore hidden curve candidates',()=>{
 const ellipse=unsupportedSelectorFixture().at(-1),block={name:'MixedSelector',base:{x:0,y:0},entities:[L('child',20,-20,20,20),ellipse]},reference={id:'mixed',type:'INSERT',layer:'0',blockName:block.name,position:{x:0,y:0},scale:1,rotation:0};
 for(const selector of['ALL','LAST']){const e=createEditor({blocks:[block],settings:{trimExtendMode:'standard'},entities:[L('target',0,0,100,0),reference]});run(e,'TR',selector);assert.ok(e.state.selectionIds.includes('mixed'));const rejected=e.execute('');assert.equal(rejected.ok,false);assert.match(rejected.message,/unsupported ELLIPSE/);assert.equal(e.canUndo,false);}
 const e=createEditor({layers:[{name:'0'},{name:'Hidden',visible:false}],settings:{trimExtendMode:'standard'},entities:[...unsupportedSelectorFixture().slice(0,2),{...ellipse,layer:'Hidden'}]});run(e,'TR','F','10,10','30,10','');assert.deepEqual(e.state.selectionIds,['supported']);run(e,'');ok(e.trimPick({x:90,y:0},{entityId:'target'}));assert.equal(entity(e).end.x,20);
});
test('Rejected implicit boundary selection preserves an earlier drawing Undo record',()=>{
 const e=createEditor({settings:{trimExtendMode:'standard'},entities:unsupportedSelectorFixture()});const original=state(e);run(e,'L','200,200','210,200','');const before=state(e);assert.equal(e.canUndo,true);run(e,'TR','ALL');assert.equal(e.execute('').ok,false);assert.deepEqual(state(e),before);assert.equal(e.canUndo,false);ok(e.cancel());assert.deepEqual(state(e),before);assert.equal(e.canUndo,true);ok(e.undo());assert.deepEqual(state(e),original);
});
