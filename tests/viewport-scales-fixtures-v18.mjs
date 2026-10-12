/* Original physical scale fixtures with independently specified millimeter results. */
export const ARCHITECTURAL_CASES=Object.freeze([
 Object.freeze({id:'architectural-in-1-8-per-ft',label:'1/8" = 1\'-0"',denominator:96,printed24ftMm:76.2,printed100ftMm:317.5,frame:{x:10,y:10,width:190,height:100},expectedPaperX:[66.9,143.1],expectedPaperY:60}),
 Object.freeze({id:'architectural-in-1-4-per-ft',label:'1/4" = 1\'-0"',denominator:48,printed24ftMm:152.4,printed100ftMm:635,frame:{x:210,y:10,width:190,height:100},expectedPaperX:[228.8,381.2],expectedPaperY:60}),
 Object.freeze({id:'architectural-in-1-16-per-ft',label:'1/16" = 1\'-0"',denominator:192,printed24ftMm:38.1,printed100ftMm:158.75,frame:{x:10,y:150,width:190,height:100},expectedPaperX:[85.95,124.05],expectedPaperY:200}),
 Object.freeze({id:'architectural-in-3-32-per-ft',label:'3/32" = 1\'-0"',denominator:128,printed24ftMm:57.15,printed100ftMm:238.125,frame:{x:210,y:150,width:190,height:100},expectedPaperX:[276.425,333.575],expectedPaperY:200}),
]);
export const PHYSICAL_UNIT_CASES=Object.freeze([
 Object.freeze({unit:'in',length24ft:288,length100ft:1200}),Object.freeze({unit:'ft',length24ft:24,length100ft:100}),Object.freeze({unit:'mm',length24ft:7315.2,length100ft:30480}),Object.freeze({unit:'m',length24ft:7.3152,length100ft:30.48}),
]);
export function rawArchitecturalScaleDrawing(unitCase){
 const unit=unitCase.unit,length=unitCase.length24ft;
 return{settings:{units:unit,gridEnabled:false,snapEnabled:false},layers:[{name:'0',color:'#000000',lineweight:.25}],entities:[{id:'original-24-foot-ruler',type:'LINE',layer:'0',start:{x:0,y:0},end:{x:length,y:0}}],layouts:[{id:'architectural-scale-sheet',name:`Original ${unit} architectural scales`,paper:{size:'A3',orientation:'landscape'},entities:ARCHITECTURAL_CASES.map((scale,index)=>({id:`original-scale-label-${index}`,type:'TEXT',layer:'0',position:{x:scale.frame.x+5,y:scale.frame.y+78},height:4,rotation:0,style:'Standard',text:`${unit} | ${scale.label} | 24 ft = ${scale.printed24ftMm} mm`})),viewports:ARCHITECTURAL_CASES.map((scale,index)=>({id:`original-scale-view-${index}`,frame:{...scale.frame},modelCenter:{x:length/2,y:0,z:0},scaleDenominator:scale.denominator,locked:false,plotBorder:false,workspace:'2d',layer:'0',frozenLayers:[]}))}],activeSpace:'paper',activeLayoutId:'architectural-scale-sheet',activeViewportId:null};
}
