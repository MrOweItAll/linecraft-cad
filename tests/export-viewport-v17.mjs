/* Original fixture producer; no Autodesk assets or native drawing data. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createEditor} from '../core.mjs';
import {rawViewportFixtures} from './viewport-fixtures-v17.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),fixtures=rawViewportFixtures(),raw=structuredClone(fixtures.concave.document);
raw.entities.push(...fixtures.offsheet.document.entities);Object.assign(raw.layouts[0].viewports[0],{color:'#336699',lineweight:.35,linetype:'dashed'});
raw.layouts.push({...structuredClone(fixtures.offsheet.document.layouts[0]),id:'offsheet-layout',name:'Original off-sheet rectangle',viewports:[{...structuredClone(fixtures.offsheet.document.layouts[0].viewports[0]),id:'offsheet-view'}]});
const polygon=structuredClone(raw.layouts[0]);polygon.id='inactive-polygon';polygon.name='Original inactive polygon';polygon.entities=[];polygon.viewports[0].id='inactive-polygon-view';polygon.viewports[0].boundary=polygon.viewports[0].boundary.map(p=>({x:p.x+20,y:p.y+10}));polygon.viewports[0].frame={x:40,y:30,width:160,height:130};polygon.viewports[0].plotBorder=true;polygon.viewports[0].layer='Paper blue';polygon.viewports[0].linetype='hidden';raw.layouts.push(polygon);
const editor=createEditor(raw),text=editor.serialize(),dxf=editor.exportDXF(),folder=path.join(root,'samples');fs.mkdirSync(folder,{recursive:true});
const drawing=path.join(folder,'viewport-v17-reference.linecraft'),exchange=path.join(folder,'viewport-v17-reference.dxf');fs.writeFileSync(drawing,text);fs.writeFileSync(exchange,dxf);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceSHA256=Object.fromEntries(['core.mjs','paper-space.mjs','tests/viewport-fixtures-v17.mjs','tests/export-viewport-v17.mjs'].map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
const report={framework:'Original synthetic clipped-viewport DXF fixture export',completedAt:new Date().toISOString(),sourceSHA256,drawing:path.relative(root,drawing).replaceAll(path.sep,'/'),drawingSHA256:hash(text),dxf:path.relative(root,exchange).replaceAll(path.sep,'/'),dxfSHA256:hash(dxf),modelEntities:raw.entities.length,layouts:raw.layouts.length,polygonViewports:2,rectangularViewports:1,scope:'Synthetic authored data and original exporter only. External reader semantics and actual native AutoCAD acceptance are separate checks.'};fs.writeFileSync(path.join(root,'tests/viewport-dxf-v17-export-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
