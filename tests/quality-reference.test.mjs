import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';
import {parseLength} from '../units.mjs';
import {qualityFixture} from './quality-fixtures.mjs';

test('literal imperial rulers and physical-scale arithmetic are independent',()=>{
 assert.equal(parseLength("20'",{units:'in'}),240);
 assert.equal(parseLength("60'",{units:'in'}),720);
 assert.equal(240*25.4/48,127);
 assert.equal(720*25.4/360,50.8);
});
test('accepted move preserves length; grouped undo redo preserves complete semantic state',()=>{
 const editor=createEditor(qualityFixture()),before=editor.serialize();
 for(const token of ['LINE','0,0','240,0',''])assert.equal(editor.execute(token).ok,true);
 const target=editor.state.entities.at(-1),id=target.id;
 const drawn=editor.serialize();
 const result=editor.applyRevision({label:'Known translation',steps:[{op:'grip',id,index:0,point:{x:12,y:24}},{op:'grip',id,index:1,point:{x:252,y:24}}]});assert.equal(result.ok,true,result.message);
 const moved=editor.state.entities.find(e=>e.id===id);assert.deepEqual(moved.start,{x:12,y:24});assert.deepEqual(moved.end,{x:252,y:24});assert.equal(Math.hypot(moved.end.x-moved.start.x,moved.end.y-moved.start.y),240);
 const accepted=editor.serialize();assert.equal(editor.undo().ok,true);assert.equal(editor.serialize(),drawn);assert.equal(editor.redo().ok,true);assert.equal(editor.serialize(),accepted);assert.notEqual(accepted,before);
});
test('synthetic floor, site, detail and larger drawings persist exact supported state',()=>{
 for(const kind of ['drafting','site','detail','large']){const original=qualityFixture(kind);assert.deepEqual(JSON.parse(createEditor(original).serialize()),original);}
 const floor=qualityFixture();assert.equal(floor.entities.find(e=>e.id==='wall-south').end.x,240);assert.equal(floor.entities.find(e=>e.id==='qa-fill').boundary.points.length,4);assert.equal(floor.blocks.length,1);
 const site=qualityFixture('site');assert.equal(site.settings.units,'in');assert.equal(site.entities[0].end.x,720);
 assert.equal(qualityFixture('detail').entities.at(-1).lineweight,.7);assert.equal(qualityFixture('large').entities.length,2000);
});
