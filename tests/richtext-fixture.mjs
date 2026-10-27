// Original three-paragraph calibration; no copied font or client assets.
import {syntheticFontLayoutDrawing} from './font-layout-fixture.mjs';
export const RICHTEXT_SOURCE=String.raw`HHHH\P{\fTimes New Roman|b1|i0;BBBB}\P{\fTimes New Roman|b0|i1;IIII}`;
export const RICHTEXT_PLAIN='HHHH\nBBBB\nIIII';
export function syntheticRichtextDrawing(){
 const drawing=syntheticFontLayoutDrawing(),sheet=drawing.layouts[0];
 sheet.name='SYNTHETIC RICH TEXT';
 sheet.entities=[...sheet.entities.slice(0,3),{id:'rich-paragraphs',type:'MTEXT',layer:'0',color:'#000000',position:{x:20,y:170},height:5,width:150,rotation:0,style:'Measured Times',text:RICHTEXT_PLAIN,
  richText:{version:1,source:RICHTEXT_SOURCE,attachment:1,lineSpacingStyle:2,lineSpacingFactor:1}}];
 return drawing;
}
