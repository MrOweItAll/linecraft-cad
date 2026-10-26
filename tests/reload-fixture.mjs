// Existing original synthetic paper definitions; fixed model navigation only.
import {syntheticMultisheetDrawing} from './multisheet-fixture.mjs';
export function reloadFixture(){
  const drawing=syntheticMultisheetDrawing();
  drawing.activeSpace='model';drawing.activeLayoutId=null;drawing.workspace='2d';
  drawing.viewport={center:{x:120,y:0},scale:2};
  drawing.settings.orthoEnabled=false;
  return drawing;
}
