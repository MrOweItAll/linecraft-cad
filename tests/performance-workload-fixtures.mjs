// Synthetic schematic workloads only; no client/template content or domain approval.
// Deliberately does not import the independent expected-value contract.
export const PERFORMANCE_WORKLOAD_IDS=Object.freeze(['survey','residential','multiViewport','heavy']);
const point=(x,y)=>({x,y});
const line=(id,x,y,endX,endY)=>({id,type:'LINE',layer:'0',start:point(x,y),end:point(endX,endY)});
const rectangle=(id,x,y,width,height)=>({id,type:'PLINE',layer:'0',closed:true,points:[point(x,y),point(x+width,y),point(x+width,y+height),point(x,y+height)]});
const label=(id,text,x,y,height)=>({id,type:'TEXT',layer:'0',position:point(x,y),height,rotation:0,style:'Standard',text});
function base(units,entities,center,scale=1){return {format:'Linecraft/1',settings:{units,gridEnabled:false,snapEnabled:false,snapModes:[]},layers:[{name:'0',color:'#000000',visible:true,locked:false,lineweight:.25}],textStyles:[{name:'Standard',fontFamily:'Arial',widthFactor:1}],entities,layouts:[],workspace:'2d',activeSpace:'model',activeLayoutId:null,activeViewportId:null,viewport:{center,scale},paperViewport:{center:point(210,148.5),scale:1}};}
function survey(){
  const entities=[];
  for(let row=0;row<10;row++)for(let col=0;col<10;col++){
    const n=String(row*10+col+1).padStart(3,'0'),x=col*100,y=row*60;
    entities.push(rectangle('survey-parcel-'+n,x,y,80,50),label('survey-label-'+n,'SYNTHETIC LOT '+n,x+10,y+20,2.5));
  }
  return base('ft',entities,point(490,295),.7);
}
function residential(){
  const entities=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const n=row*4+col+1,x=col*18,y=row*14;
    entities.push(rectangle('room-'+n,x,y,16,12));
    for(let j=0;j<4;j++)entities.push(rectangle('furniture-'+n+'-'+j,x+2+5*(j%2),y+2+5*Math.floor(j/2),2,3));
    entities.push({id:'door-'+n,type:'ARC',layer:'0',center:point(x+16,y+3),radius:3,startAngle:90,sweepAngle:90});
    const boundary=rectangle('unused',x+10,y+7,2,2);delete boundary.id;delete boundary.layer;
    entities.push({id:'fill-'+n,type:'HATCH',layer:'0',boundary,pattern:'solid',angle:0,spacing:1,origin:point(x+10,y+7)},label('room-label-'+n,'SYNTHETIC ROOM '+n,x+2,y+8,.8));
  }
  return base('ft',entities,point(35,13),10);
}
function multiViewport(){
  const entities=[];
  for(let row=0;row<20;row++)for(let col=0;col<20;col++)entities.push(line('model-'+String(row*20+col).padStart(3,'0'),col*20,row*20,col*20+16,row*20));
  const drawing=base('in',entities,point(198,190),1);
  drawing.layers.push({name:'Viewports',color:'#000000',visible:true,locked:true,lineweight:.13});
  drawing.layouts=['a','b','c'].map((letter,i)=>{
    const viewports=[];
    for(let row=0;row<2;row++)for(let col=0;col<3;col++)viewports.push({id:'view-'+letter+'-'+(row*3+col),frame:{x:20+130*col,y:60+90*row,width:110,height:70},modelCenter:{x:80+80*col,y:100+120*row,z:0},scaleDenominator:[24,48,96][i],locked:true,plotBorder:false,workspace:'2d',layer:'Viewports',frozenLayers:[]});
    return {id:'sheet-'+letter,name:'SYNTHETIC SHEET '+letter.toUpperCase(),paper:{size:'Custom',widthMm:420,heightMm:297,orientation:'landscape'},entities:[line('paper-ruler-'+letter,10,40,110,40),rectangle('paper-border-'+letter,10,10,400,277),label('paper-label-'+letter,'SYNTHETIC SHEET '+letter.toUpperCase(),20,20,4)],viewports};
  });
  drawing.activeSpace='paper';drawing.activeLayoutId='sheet-a';return drawing;
}
function heavy(){
  const entities=[];
  for(let row=0;row<100;row++)for(let col=0;col<100;col++)entities.push(line('heavy-'+String(row*100+col).padStart(5,'0'),col*8,row*8,col*8+6,row*8));
  return base('in',entities,point(399,396),.7);
}
export function performanceWorkload(id){const make={survey,residential,multiViewport,heavy}[id];if(!PERFORMANCE_WORKLOAD_IDS.includes(id)||typeof make!=='function')throw Error('Unknown synthetic performance workload.');return make();}
