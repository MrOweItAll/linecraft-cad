// Independent default-style calibration, not a production drafting convention.
import {qualityFixture} from './quality-fixtures.mjs';
import {syntheticMultisheetDrawing} from './multisheet-fixture.mjs';
export function syntheticRotatedAnnotationDrawing(){
 const drawing=qualityFixture('detail');
 drawing.entities=[{id:'rotation-ruler',type:'LINE',layer:'0',start:{x:0,y:60},end:{x:240,y:60}},
  {id:'aligned-calibration',type:'DIMENSION',kind:'aligned',layer:'0',p1:{x:40,y:120},p2:{x:100,y:200},placement:{x:38,y:184},textOverride:'ALIGNED <>',style:'Standard',scale:1},
  {id:'leader-calibration',type:'LEADER',layer:'0',points:[{x:160,y:130},{x:180,y:150},{x:215,y:150}],text:'SYNTHETIC LEADER',height:6,style:'Standard',arrowSize:2.5,arrowType:'closed-filled'}];
 drawing.blocks=[];drawing.layouts=syntheticMultisheetDrawing().layouts;
 for(const sheet of drawing.layouts){const first=sheet.id==='sheet-a';sheet.name=first?'SYNTHETIC ROTATION 48':'SYNTHETIC ROTATION 96';
  Object.assign(sheet.viewports[0],{frame:{x:40,y:60,width:340,height:200},modelCenter:{x:120,y:150,z:0},scaleDenominator:first?48:96});
  sheet.entities.find(e=>e.type==='TEXT').text=first?'ROTATED-48-FIRST':'ROTATED-96-SECOND';
 }
 drawing.activeSpace='paper';drawing.activeLayoutId='sheet-b';drawing.activeViewportId=null;return drawing;
}
