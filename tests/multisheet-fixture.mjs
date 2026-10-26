// Independently authored synthetic sheets. No client content or template assets.
export const MULTISHEET_ORDER = Object.freeze(['sheet-a', 'sheet-b']);
const line = (id, x1, y1, x2, y2, lineweight=.25) => ({id,type:'LINE',layer:'0',color:'#000000',lineweight,start:{x:x1,y:y1},end:{x:x2,y:y2}});
function sheet(letter, denominator, marker) {
  return {id:`sheet-${letter}`,name:`SYNTHETIC ${letter.toUpperCase()}`,paper:{size:'Custom',widthMm:420,heightMm:297,orientation:'landscape'},
    entities:[
      line(`sentinel-${letter}`,20,60,120,60,.35),
      {id:`title-border-${letter}`,type:'PLINE',layer:'0',color:'#000000',lineweight:.25,closed:true,points:[{x:10,y:10},{x:410,y:10},{x:410,y:40},{x:10,y:40}]},
      line(`title-divider-one-${letter}`,300,10,300,40),line(`title-divider-two-${letter}`,360,10,360,40),
      {id:`title-label-${letter}`,type:'TEXT',layer:'0',position:{x:310,y:15},height:4,rotation:0,style:'Standard',text:marker}
    ],viewports:[{id:`view-${letter}`,frame:{x:100,y:100,width:220,height:100},modelCenter:{x:120,y:0,z:0},scaleDenominator:denominator,locked:true,plotBorder:false,workspace:'2d',layer:'0',frozenLayers:[]}]};
}
export function syntheticMultisheetDrawing() {
  return {settings:{units:'in',gridEnabled:false,snapEnabled:false,snapModes:[]},
    layers:[{name:'0',color:'#000000',visible:true,locked:false,lineweight:.25}],
    textStyles:[{name:'Standard',fontFamily:'Arial',widthFactor:1}],
    entities:[line('model-ruler',0,0,240,0)],
    // Deliberately opposite the requested PDF order, so tab-order output fails.
    layouts:[sheet('b',96,'QA-A02-SECOND'),sheet('a',48,'QA-A01-FIRST')],
    activeSpace:'paper',activeLayoutId:'sheet-b',activeViewportId:null};
}
