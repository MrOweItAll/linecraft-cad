// Child coverage fixture. The original two-A3 reference remains unchanged.
import {syntheticMultisheetDrawing} from './multisheet-fixture.mjs';
export function syntheticMixedPaperDrawing(){
  const drawing=structuredClone(syntheticMultisheetDrawing());
  const a=drawing.layouts.find(layout=>layout.id==='sheet-a'),b=drawing.layouts.find(layout=>layout.id==='sheet-b');
  a.name='SYNTHETIC A4 PORTRAIT';a.paper={size:'Custom',widthMm:210,heightMm:297,orientation:'portrait'};
  a.viewports[0].frame={x:25,y:100,width:160,height:100};
  a.entities.find(entity=>entity.id==='title-border-a').points=[{x:10,y:10},{x:200,y:10},{x:200,y:40},{x:10,y:40}];
  for(const [id,x]of [['title-divider-one-a',140],['title-divider-two-a',180]]){const line=a.entities.find(entity=>entity.id===id);line.start.x=x;line.end.x=x;}
  const label=a.entities.find(entity=>entity.id==='title-label-a');label.position={x:145,y:15};label.text='A4-FIRST';
  b.name='SYNTHETIC A3 LANDSCAPE';b.entities.find(entity=>entity.id==='title-label-b').text='A3-SECOND';
  return drawing;
}
