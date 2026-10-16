import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';

// Original synthetic scripting fixture extends the accepted R4 source; it never
// rewrites an older milestone's sample or stores generated architecture meshes.
const raw=JSON.parse(readFileSync(new URL('../samples/gable-v112.linecraft',import.meta.url),'utf8'));
raw.entities.push(
 {id:'script-boundary',type:'LINE',layer:'0',start:{x:0,y:-12},end:{x:480,y:-12}},
 {id:'script-note',type:'TEXT',layer:'0',position:{x:60,y:-72},text:'SCRIPT REVIEW ORIGINAL',height:12,rotation:0,style:'Standard'},
 {id:'script-dimension',type:'DIMENSION',kind:'linear',layer:'0',p1:{x:0,y:0},p2:{x:480,y:0},placement:{x:240,y:-30},axisAngle:0,textOverride:'ORIGINAL <>',style:'Standard',scale:4}
);
const editor=createEditor(raw),accept=r=>assert.equal(r.ok,true,r.message);
accept(editor.setWorkspace('2d'));accept(editor.setSpace('model',null));
// Retain both preexisting R4 viewports and add a simple physically scaled sheet.
const sheet=editor.addLayout('Scripting acceptance A3 - 1 to 96',{size:'A3',orientation:'landscape'});accept(sheet);
accept(editor.addViewport(sheet.layoutId,{x:20,y:45,width:380,height:230},{workspace:'2d',modelCenter:{x:240,y:85,z:0},scaleDenominator:96,locked:true,plotBorder:true}));
const document=JSON.parse(editor.serialize());
document.entities.push(
 {id:'script-titleblock',type:'RECTANG',layer:'0',layoutId:sheet.layoutId,points:[{x:10,y:8},{x:410,y:8},{x:410,y:32},{x:10,y:32}]},
 {id:'script-sheet-title',type:'TEXT',layer:'0',layoutId:sheet.layoutId,position:{x:15,y:16},text:'LINECRAFT SCRIPTING ACCEPTANCE | 1/8 IN = 1 FT | A3',height:4,rotation:0,style:'Standard'}
);
const final=createEditor(document),legacy=JSON.parse(final.serialize());legacy.architecture.schemaVersion=4;for(const group of legacy.architecture.roofGroups)delete group.bearingAssignments;const serialized=JSON.stringify(legacy,null,2),file=new URL('../samples/scripting-v1121.linecraft',import.meta.url);
if(!existsSync(file))writeFileSync(file,serialized,'utf8');else assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),JSON.parse(serialized),'Scripting sample differs; never silently overwrite an established fixture.');
const restored=createEditor(JSON.parse(readFileSync(file,'utf8')));
assert.equal(restored.state.architecture.schemaVersion,5);
assert.deepEqual(restored.state.architecture,editor.state.architecture);
assert.deepEqual(restored.state.architectureDerived,editor.state.architectureDerived);
assert.equal(restored.state.layouts.at(-1).viewports[0].scaleDenominator,96);
assert.ok(!JSON.parse(serialized).entities.some(e=>e.id.startsWith('@architecture/')));
console.log('Validated synthetic schema4 scripting fixture: unchanged R4 gable source, note, dimension, boundary, titleblock and locked physical 1:96 A3 viewport.');
