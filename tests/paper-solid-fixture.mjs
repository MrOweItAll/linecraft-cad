// Independently authored synthetic DXF. No client coordinates, text or resources.
export const PAPER_SOLID_LITERALS=Object.freeze({
 layoutName:'SYNTHETIC SOLID SHEET',widthMm:420,heightMm:297,
 rectangle:Object.freeze([{x:20,y:30},{x:60,y:30},{x:60,y:50},{x:20,y:50}]),
 triangle:Object.freeze([{x:20,y:30},{x:60,y:30},{x:20,y:50}]),
 rectangleAreaMm2:800,triangleAreaMm2:400,fillLayer:'Fill',fillColor:'#000000',fillLineweightMm:.35,
 paperSentinel:{start:{x:10,y:10},end:{x:20,y:10},layer:'Paper sentinel',lineweightMm:.2},
 modelSentinel:{start:{x:-100,y:-100},end:{x:-90,y:-100},layer:'Model sentinel',lineweightMm:.18}
});
export const MODEL_PRESERVATION_CASES=Object.freeze([
 {name:'model SOLID',options:{space:'model',type:'SOLID'}},
 {name:'model TRACE',options:{space:'model',type:'TRACE'}},
 {name:'model 3DFACE',options:{space:'model',type:'3DFACE'}},
 {name:'model elevated SOLID',options:{space:'model',elevation:2}},
 {name:'model thick SOLID',options:{space:'model',thickness:2}}
]);
const record=(type,groups=[])=>[0,type,...groups.flat()];
const pointGroups=(code,point)=>[[code,point.x],[code+10,point.y],[code+20,point.z??0]];
function layer(name,handle,width){return record('LAYER',[[5,handle],[100,'AcDbSymbolTableRecord'],[100,'AcDbLayerTableRecord'],[2,name],[70,0],[62,7],[420,0],[6,'CONTINUOUS'],[370,Math.round(width*100)]]);}
export function paperSolidDXF({shape='rectangle',space='paper',type='SOLID',paperInches=false,modelUnits=4,normal=[0,0,1],thickness=0,thicknessValues,
 elevation=0,cornerZ,points,color=0,lineweight=.35,block=null,count=1}={}){
 const factor=paperInches?25.4:1,isPaper=space==='paper',faceFactor=isPaper?factor:1,ownership=isPaper?[[67,1],[330,'90'],[410,PAPER_SOLID_LITERALS.layoutName]]:[[330,'80']];
 const polygon=points??(shape==='triangle'?PAPER_SOLID_LITERALS.triangle:PAPER_SOLID_LITERALS.rectangle);
 if(![3,4].includes(polygon.length))throw Error('Synthetic face fixture requires three or four declared polygon vertices.');
 const base=block?.base??[2,3,0],position=block?.position??[100,200,0],scales=block?.scale??[-2,3,1],rotation=block?.rotation??90;
 const face=(index,inBlock)=>{
  const shifted=polygon.map((point,i)=>({x:(point.x+index*80)/faceFactor,y:point.y/faceFactor,z:(cornerZ?.[i]??point.z??elevation)/faceFactor}));
  // SOLID/TRACE encode a four-corner face in zig-zag order; triangles repeat vertex3.
  const ordered=type==='3DFACE'?(shifted.length===3?[...shifted,shifted[2]]:shifted):shifted.length===3?[...shifted,shifted[2]]:[shifted[0],shifted[1],shifted[3],shifted[2]];
  return record(type,[[5,(0x40+index).toString(16).toUpperCase()],[8,inBlock?'0':'Fill'],...(!inBlock?ownership:[[330,'A0']]),[420,color],[370,Math.round(lineweight*100)],
   ...ordered.flatMap((point,i)=>pointGroups(10+i,point)),...(thicknessValues??[thickness]).map(value=>[39,value]),[210,normal[0]],[220,normal[1]],[230,normal[2]]]);
 };
 const model=record('LINE',[[5,'10'],[8,'Model sentinel'],[10,-100],[20,-100],[30,0],[11,-90],[21,-100],[31,0]]);
 const paper=record('LINE',[[5,'11'],[8,'Paper sentinel'],[67,1],[330,'90'],[410,PAPER_SOLID_LITERALS.layoutName],[10,10/factor],[20,10/factor],[30,0],[11,20/factor],[21,10/factor],[31,0]]);
 const blockRecords=[...record('BLOCK_RECORD',[[5,'80'],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,'*Model_Space']]),...record('BLOCK_RECORD',[[5,'90'],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,'*Paper_Space']]),...(block?record('BLOCK_RECORD',[[5,'A0'],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,'Independent fill block']]):[])];
 const tables=[...record('TABLE',[[2,'LAYER'],[70,4]]),...layer('0','50',.25),...layer('Fill','51',.25),...layer('Model sentinel','52',.18),...layer('Paper sentinel','53',.2),...record('ENDTAB'),...record('TABLE',[[2,'BLOCK_RECORD'],[70,block?3:2]]),...blockRecords,...record('ENDTAB')];
 const blocks=block?[...record('BLOCK',[[5,'30'],[330,'A0'],[8,'0'],[2,'Independent fill block'],[70,0],...pointGroups(10,{x:base[0]/faceFactor,y:base[1]/faceFactor,z:base[2]/faceFactor})]),...Array.from({length:count},(_,index)=>face(index,true)).flat(),...record('ENDBLK',[[5,'31'],[330,'A0'],[8,'0']])]:[];
 const inserted=block?record('INSERT',[[5,'20'],[8,'Fill'],...ownership,[2,'Independent fill block'],...pointGroups(10,{x:position[0]/faceFactor,y:position[1]/faceFactor,z:position[2]/faceFactor}),[41,scales[0]],[42,scales[1]],[43,scales[2]],[50,rotation],...[210,220,230].map((code,index)=>[code,(block.normal??[0,0,1])[index]])]):Array.from({length:count},(_,index)=>face(index,false)).flat();
 const layout=record('LAYOUT',[[5,'B0'],[100,'AcDbPlotSettings'],[72,paperInches?0:1],[44,420],[45,297],[40,0],[41,0],[42,0],[43,0],[46,0],[47,0],[100,'AcDbLayout'],[1,PAPER_SOLID_LITERALS.layoutName],[71,1],[330,'90']]);
 return[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,modelUnits,0,'ENDSEC',0,'SECTION',2,'TABLES',...tables,0,'ENDSEC',0,'SECTION',2,'BLOCKS',...blocks,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...model,...paper,...inserted,0,'ENDSEC',0,'SECTION',2,'OBJECTS',...layout,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
}
