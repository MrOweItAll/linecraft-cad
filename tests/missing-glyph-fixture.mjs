// Synthetic absent-character diagnostics; no client or font assets.
import {syntheticFontLayoutDrawing} from './font-layout-fixture.mjs';
export const MISSING_GLYPH_TEXT='H\u2205H';
export function syntheticMissingGlyphDrawing(){
  const drawing=syntheticFontLayoutDrawing();
  drawing.textStyles=[{name:'Standard',fontFamily:'Arial'},{name:'Measured Technic',fontFamily:'Technic',metrics:'registered',widthFactor:1}];
  drawing.dimStyles=[{name:'Measured Dimension',textStyle:'Measured Technic',textHeight:5,arrowSize:2.5}];
  const common={layer:'0',color:'#000000',style:'Measured Technic',height:5,text:MISSING_GLYPH_TEXT};
  drawing.layouts[0].entities=[...drawing.layouts[0].entities.slice(0,3),
    {...common,id:'glyph-text',type:'TEXT',position:{x:20,y:170},rotation:0},
    {...common,id:'glyph-mtext',type:'MTEXT',position:{x:20,y:140},rotation:0,width:80},
    {...common,id:'glyph-rich',type:'MTEXT',position:{x:20,y:110},rotation:0,width:80,richText:{version:1,source:MISSING_GLYPH_TEXT,attachment:1,lineSpacingStyle:1,lineSpacingFactor:1}},
    {...common,id:'glyph-leader',type:'LEADER',points:[{x:150,y:150},{x:170,y:155},{x:190,y:155}],arrowSize:2.5,arrowType:'closed-filled'},
    {id:'glyph-dimension',type:'DIMENSION',layer:'0',color:'#000000',style:'Measured Dimension',kind:'linear',p1:{x:150,y:70},p2:{x:250,y:70},placement:{x:150,y:95},scale:1,axisAngle:0,textOverride:MISSING_GLYPH_TEXT}];
  return drawing;
}
