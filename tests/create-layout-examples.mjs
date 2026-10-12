/* Original public demonstration drawings from synthetic physical fixtures. */
import fs from 'node:fs';
import {createEditor} from '../core.mjs';
import {layoutFixtures} from './layout-fixtures-v16.mjs';
const fixtures=layoutFixtures();fs.mkdirSync(new URL('../samples/',import.meta.url),{recursive:true});
for(const key of ['inch','meter']){
 const document=structuredClone(fixtures[key].document),sheet=document.layouts[0];
 document.entities=document.entities.filter(entity=>entity.id!=='far-model');
 sheet.entities.find(entity=>entity.id==='paper-title').text=`${key==='inch'?'Inches':'Meters'} model: 100-foot line`;
 document.activeSpace='paper';document.activeViewportId=null;
 document.paperViewport={center:{x:sheet.paper.widthMm/2,y:sheet.paper.heightMm/2},scale:2};
 fs.writeFileSync(new URL(`../samples/layouts-${key}-v16.linecraft`,import.meta.url),createEditor(document).serialize());
}
console.log('Two original layout examples generated without native drawings or private metadata.');
