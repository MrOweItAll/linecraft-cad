// New synthetic child; original detail model/settings/styles/blocks stay intact.
import {qualityFixture} from './quality-fixtures.mjs';
import {syntheticMultisheetDrawing} from './multisheet-fixture.mjs';
export function syntheticPlanDetailDrawing(){
 const drawing=qualityFixture('detail'),paper=syntheticMultisheetDrawing();
 drawing.layouts=paper.layouts;
 for(const sheet of drawing.layouts){const first=sheet.id==='sheet-a';sheet.name=first?'SYNTHETIC DETAIL 48':'SYNTHETIC DETAIL 24';
  Object.assign(sheet.viewports[0],{frame:{x:40,y:60,width:340,height:200},modelCenter:{x:120,y:150,z:0},scaleDenominator:first?48:24});
  sheet.entities.find(entity=>entity.type==='TEXT').text=first?'DETAIL-48-FIRST':'DETAIL-24-SECOND';
 }
 drawing.activeSpace='paper';drawing.activeLayoutId='sheet-b';drawing.activeViewportId=null;
 return drawing;
}
