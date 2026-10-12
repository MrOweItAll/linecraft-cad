/* Original physical viewport scale catalog and parsing. No preset ID is persisted. */
import {parseLength} from './units.mjs';

export const MIN_VIEWPORT_SCALE_DENOMINATOR=1e-6;
export const MAX_VIEWPORT_SCALE_DENOMINATOR=1e9;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const NUMBER='[+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const numeric=new RegExp(`^${NUMBER}$`);
const ratio=new RegExp(`^(${NUMBER})\\s*:\\s*(${NUMBER})$`);
const zoomFactor=new RegExp(`^(${NUMBER})(?:\\s*/\\s*(${NUMBER}))?\\s*XP$`,'i');
function denominator(value){
  if(!finite(value)||value<MIN_VIEWPORT_SCALE_DENOMINATOR||value>MAX_VIEWPORT_SCALE_DENOMINATOR)throw Error('Viewport scale denominator must be between 0.000001 and 1000000000.');
  return value;
}
function item(id,groupId,label,paperLengthMm,modelLengthMm,scaleDenominator=modelLengthMm/paperLengthMm){return Object.freeze({id,groupId,label,scaleDenominator:denominator(scaleDenominator),paperLengthMm,modelLengthMm});}
const architectural=[
  ['1-128','1/128',1/128],['1-64','1/64',1/64],['1-32','1/32',1/32],['1-16','1/16',1/16],
  ['3-32','3/32',3/32],['1-8','1/8',1/8],['3-16','3/16',3/16],['1-4','1/4',1/4],
  ['3-8','3/8',3/8],['1-2','1/2',1/2],['3-4','3/4',3/4],['1','1',1],
  ['1-and-1-2','1-1/2',1.5],['3','3',3],['6','6',6],['12','1\'-0',12],
].map(([id,text,inches])=>item(`architectural-in-${id}-per-ft`,'architectural',inches===12?'1\'-0" = 1\'-0"':`${text}" = 1'-0"`,inches*25.4,304.8,12/inches));
const ratios=[1,2,4,5,8,10,16,20,25,30,40,50,100,200,250,500,1000].map(value=>item(`ratio-1-${value}`,'ratios',`1:${value}`,1,value));
for(const value of [2,4,8,10,100,1000])ratios.push(item(`ratio-${value}-1`,'ratios',`${value}:1`,value,1));
// These feet-per-paper-inch choices are original conveniences, not a claim
// that every native drawing's editable Standard Scale list contains them.
const engineering=[10,20,30,40,50,60,100,200,500,1000].map(feet=>item(`engineering-in-1-per-ft-${feet}`,'engineering',`1" = ${feet}'-0"`,25.4,feet*304.8,12*feet));
export const VIEWPORT_SCALE_GROUPS=Object.freeze([
  Object.freeze({id:'architectural',label:'Architectural (inches = feet)',scales:Object.freeze(architectural)}),
  Object.freeze({id:'ratios',label:'Ratios (paper : model)',scales:Object.freeze(ratios)}),
  Object.freeze({id:'engineering',label:'Engineering (1 inch = feet)',scales:Object.freeze(engineering)}),
]);
export const VIEWPORT_SCALES=Object.freeze(VIEWPORT_SCALE_GROUPS.flatMap(group=>group.scales));
const byId=new Map(VIEWPORT_SCALES.map(scale=>[scale.id,scale]));
export function getViewportScale(id){return typeof id==='string'?byId.get(id)??null:null;}

/** Positive physical denominator: a scale of 1/8 inch per foot is exactly 96. */
export function parseViewportScale(input){
  if(typeof input==='number')return denominator(input);
  if(typeof input!=='string'||!input.trim()||input.length>256||/[\x00-\x1f]/.test(input))throw Error('Enter a viewport ratio or physical scale, for example 1:96 or 1/8" = 1\'-0".');
  const text=input.trim().replace(/[‘’′]/g,"'").replace(/[“”″]/g,'"').replace(/−/g,'-');
  if(numeric.test(text))return denominator(Number(text));
  const parts=text.match(ratio);
  if(parts){const paper=Number(parts[1]),model=Number(parts[2]);if(!finite(paper)||!finite(model)||paper<=0||model<=0)throw Error('Both ratio values must be positive and finite.');return denominator(model/paper);}
  const lengths=text.split('=');
  if(lengths.length===2&&lengths.every(value=>/(?:['"]|(?:mm|cm|m|inches|inch|in|feet|foot|ft)\s*$)/i.test(value.trim()))){
    const paper=parseLength(lengths[0],{units:'in'}),model=parseLength(lengths[1],{units:'in'});
    if(paper<=0||model<=0)throw Error('Both physical scale lengths must be positive.');
    return denominator(model/paper);
  }
  throw Error('Invalid viewport scale. Use a denominator, paper:model ratio, or explicit physical lengths such as 1/8" = 1\'-0".');
}

/** Label only round-off neighbours, never a genuinely different custom scale. */
export function matchViewportScale(value,{preferredGroup='ratios'}={}){
  denominator(value);
  if(!VIEWPORT_SCALE_GROUPS.some(group=>group.id===preferredGroup))throw Error('Unsupported viewport scale group.');
  const order=[...VIEWPORT_SCALES.filter(scale=>scale.groupId===preferredGroup),...VIEWPORT_SCALES.filter(scale=>scale.groupId!==preferredGroup)];
  return order.find(scale=>Math.abs(value-scale.scaleDenominator)<=Number.EPSILON*16*Math.max(Math.abs(value),Math.abs(scale.scaleDenominator)))??null;
}
export function formatViewportScale(value,options={}){return matchViewportScale(value,options)?.label??`1:${String(value)}`;}

/** Raw scale expressed as millimeters of paper per assigned model unit. */
export function parseViewportZoomFactor(input){
  if(typeof input!=='string'||!input.trim()||input.length>256||/[\x00-\x1f]/.test(input))throw Error('Enter a positive factorXP, for example 25.4/96XP for an inch model.');
  const match=input.trim().match(zoomFactor);if(!match)throw Error('ZOOM XP accepts one positive number or numerator/denominator fraction followed by XP.');
  const numerator=Number(match[1]),divisor=Number(match[2]??1),factor=numerator/divisor;
  if(!finite(numerator)||!finite(divisor)||numerator<=0||divisor<=0||!finite(factor)||factor<=0)throw Error('ZOOM XP factor must be positive and finite.');
  return factor;
}
