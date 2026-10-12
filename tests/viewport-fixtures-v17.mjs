/* Original synthetic polygon/physical-scale fixtures; no native source material. */
import assert from 'node:assert/strict';
const point=(x,y)=>({x,y}),line=(id,layer,start,end)=>({id,type:'LINE',layer,start,end});
export const CONCAVE_BOUNDARY=Object.freeze([[20,20],[180,20],[180,70],[90,70],[90,150],[20,150]].map(([x,y])=>Object.freeze(point(x,y))));
export const CONCAVE_EXPECTED=Object.freeze({frame:Object.freeze({x:20,y:20,width:160,height:130}),inside:Object.freeze(point(50,120)),notch:Object.freeze(point(140,120)),lowInside:Object.freeze(point(140,40)),redVisibleLengthMm:70,greenLengthMm:50});
const layers=[{name:'0',color:'#e5e7eb',lineweight:.25},{name:'Red ruler',color:'#dd2222',lineweight:.5},{name:'Green ruler',color:'#00aa00',lineweight:.25},{name:'Orange notch',color:'#ff8800',lineweight:.5},{name:'Paper blue',color:'#0000dd',lineweight:.25}];
const native=(units,entities,viewport,paperEntities=[])=>({format:'Linecraft/1',settings:{units,gridEnabled:false,snapEnabled:false},layers,entities,layouts:[{id:'polygon-sheet',name:'Original polygon fixture',paper:{size:'A4',orientation:'landscape'},entities:paperEntities,viewports:[{id:'polygon-view',modelCenter:{x:0,y:0,z:0},scaleDenominator:10,workspace:'2d',locked:false,plotBorder:false,layer:'0',frozenLayers:[],...viewport}]}],activeSpace:'paper',activeLayoutId:'polygon-sheet',activeViewportId:null});
export function rawViewportFixtures(){
  const frame={...CONCAVE_EXPECTED.frame},boundary=CONCAVE_BOUNDARY.map(p=>({...p}));
  // Independent paper mapping: center(100,85), one model mm projects to0.1 paper mm.
  const entities=[line('red-cross-notch','Red ruler',point(-900,350),point(900,350)),line('green-physical-ruler','Green ruler',point(-700,-450),point(-200,-450)),{id:'orange-in-gap',type:'CIRCLE',layer:'Orange notch',center:point(400,350),radius:20}];
  const paper=label=>[line('paper-blue-ruler','Paper blue',point(50,170),point(150,170)),{id:'paper-unit-label',type:'TEXT',layer:'0',position:point(200,180),text:label,height:3,rotation:0,style:'Standard'}];
  const concave=native('mm',entities,{frame,boundary},paper('MM polygon'));
  // The same physical model, stored in inches. Paper and clipping coordinates stay mm.
  const inchEntities=entities.map(entity=>entity.type==='CIRCLE'?{...entity,center:point(entity.center.x/25.4,entity.center.y/25.4),radius:entity.radius/25.4}:{...entity,start:point(entity.start.x/25.4,entity.start.y/25.4),end:point(entity.end.x/25.4,entity.end.y/25.4)});
  const inches=native('in',inchEntities,{frame:{...frame},boundary:boundary.map(p=>({...p}))},paper('IN polygon'));
  // The model line projects to paper x240..360,y180. VP clips250..350; A4 clips at297.
  const offsheet=native('mm',[line('offsheet-red-ruler','Red ruler',point(-600,-150),point(600,-150))],{frame:{x:250,y:160,width:100,height:70}});
  return{concave:{document:concave,expected:{...CONCAVE_EXPECTED,paperRulerMm:100,orangeVisible:false}},inches:{document:inches,expected:{...CONCAVE_EXPECTED,paperRulerMm:100,orangeVisible:false}},offsheet:{document:offsheet,expected:{visiblePaperRange:[250,297],redVisibleLengthMm:47,paperSize:[297,210]}}};
}
export function makeViewportFixtures(createEditor){
  assert.equal(typeof createEditor,'function');
  return Object.fromEntries(Object.entries(rawViewportFixtures()).map(([name,fixture])=>{
    const editor=createEditor(fixture.document),document=JSON.parse(editor.serialize()),view=document.layouts[0].viewports[0];
    if(fixture.document.layouts[0].viewports[0].boundary)assert.deepEqual(view.boundary,fixture.document.layouts[0].viewports[0].boundary,'Polygon clipping must exist; never silently use its bounding rectangle.');
    assert.deepEqual(view.frame,fixture.document.layouts[0].viewports[0].frame);
    return[name,{...fixture,editor,document,text:editor.serialize()}];
  }));
}
