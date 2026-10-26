// A frozen navigation profile derived from the existing original large fixture.
import {qualityFixture} from './quality-fixtures.mjs';
export function performanceFixture(){
  const drawing=qualityFixture('large');
  drawing.viewport={center:{x:599,y:114},scale:.5};
  drawing.workspace='2d';drawing.activeSpace='model';
  return drawing;
}
