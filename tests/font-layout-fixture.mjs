// Fresh synthetic paper typography; no proprietary template or font assets.
export function syntheticFontLayoutDrawing() {
  const line=(id,x1,y1,x2,y2,lineweight=.25)=>({id,type:'LINE',layer:'0',color:'#000000',lineweight,start:{x:x1,y:y1},end:{x:x2,y:y2}});
  return {settings:{units:'mm',gridEnabled:false,snapEnabled:false,snapModes:[]},
    layers:[{name:'0',color:'#000000',visible:true,locked:false,lineweight:.25}],
    textStyles:[{name:'Standard',fontFamily:'Arial'},
      {name:'Measured Arial',fontFamily:'Arial',metrics:'registered',widthFactor:1},
      {name:'Measured Times',fontFamily:'Times New Roman',metrics:'registered',widthFactor:1},
      {name:'Condensed Arial',fontFamily:'Arial',metrics:'registered',widthFactor:.75}],
    entities:[],layouts:[{id:'font-sheet',name:'SYNTHETIC FONT SHEET',
      paper:{size:'A4',widthMm:297,heightMm:210,orientation:'landscape'},viewports:[],
      entities:[{id:'synthetic-template-border',type:'PLINE',layer:'0',color:'#000000',lineweight:.25,closed:true,points:[{x:10,y:10},{x:287,y:10},{x:287,y:200},{x:10,y:200}]},
        line('synthetic-template-divider',180,10,180,35),line('paper-ruler',20,60,120,60,.35),
        ...[['arial',160,'Measured Arial'],['times',130,'Measured Times'],['condensed',100,'Condensed Arial']].map(([id,y,style])=>({id:'font-'+id,type:'TEXT',layer:'0',color:'#000000',position:{x:20,y},height:5,rotation:0,style,text:'HHHH'}))]}],
    activeSpace:'paper',activeLayoutId:'font-sheet',activeViewportId:null};
}

export function syntheticArchitecturalFontDrawing() {
  const drawing=syntheticFontLayoutDrawing();
  drawing.textStyles=[{name:'Standard',fontFamily:'Arial'},
    {name:'Measured ARCHITXT',fontFamily:'ARCHITXT',metrics:'registered',widthFactor:1},
    {name:'Measured Technic',fontFamily:'Technic',metrics:'registered',widthFactor:1},
    {name:'Condensed ARCHITXT',fontFamily:'ARCHITXT',metrics:'registered',widthFactor:.75}];
  const styles={'Measured Arial':'Measured ARCHITXT','Measured Times':'Measured Technic','Condensed Arial':'Condensed ARCHITXT'};
  const ids={'font-arial':'font-architxt','font-times':'font-technic','font-condensed':'font-architxt-condensed'};
  drawing.layouts[0].entities=drawing.layouts[0].entities.map(entity=>entity.type==='TEXT'?{...entity,id:ids[entity.id],style:styles[entity.style]}:entity);
  return drawing;
}
