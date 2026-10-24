// Original deterministic examples. Literal geometry, no client-derived content.
import {createEditor,UNIT_PRESETS} from '../core.mjs';
export const line=(id,x1,y1,x2,y2)=>({id,type:'LINE',layer:'0',start:{x:x1,y:y1},end:{x:x2,y:y2}});
export function qualityFixture(kind='drafting'){
 const document={settings:{...UNIT_PRESETS.architectural,gridEnabled:false,snapEnabled:false,snapModes:[]},entities:[]};
 if(kind==='large')document.entities=Array.from({length:2000},(_,i)=>line('large-'+i,(i%100)*12,Math.floor(i/100)*12,(i%100)*12+10,Math.floor(i/100)*12));
 else if(kind==='site'){
  document.settings={...document.settings,...UNIT_PRESETS.surveyor};
  document.entities=[line('site-ruler',0,0,720,0),line('site-north',0,0,0,360),{id:'site-label',type:'TEXT',layer:'0',position:{x:0,y:380},height:12,rotation:0,style:'Standard',text:'SYNTHETIC SITE | NORTH'}];
 }else{
  document.entities=[line('wall-south',0,60,240,60),line('wall-east',240,60,240,180),line('wall-north',240,180,0,180),line('wall-west-1',0,180,0,132),line('wall-west-2',0,96,0,60),
   {id:'qa-note',type:'TEXT',layer:'0',position:{x:20,y:160},height:6,rotation:0,style:'Standard',text:'SYNTHETIC QA ORIGINAL'},
   {id:'qa-dim',type:'DIMENSION',kind:'linear',layer:'0',p1:{x:0,y:60},p2:{x:240,y:60},placement:{x:120,y:200},axisAngle:0,textOverride:'ORIGINAL <>',style:'Standard',scale:1},
   {id:'qa-fill',type:'HATCH',layer:'0',boundary:{type:'PLINE',closed:true,points:[{x:20,y:80},{x:30,y:80},{x:30,y:85},{x:20,y:85}]},pattern:'solid',angle:0,spacing:1,origin:{x:20,y:80}},
   {id:'qa-block',type:'INSERT',blockName:'Synthetic marker',layer:'0',position:{x:210,y:160},scale:1,rotation:0}];
  document.blocks=[{name:'Synthetic marker',base:{x:0,y:0},entities:[{type:'LINE',layer:'0',start:{x:0,y:0},end:{x:10,y:0}}]}];
  if(kind==='detail')document.entities.push({...line('detail-weight',0,240,120,240),lineweight:0.7,linetype:'dashed'});
 }
 return JSON.parse(createEditor(document).serialize());
}
