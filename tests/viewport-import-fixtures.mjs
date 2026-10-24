// Independently authored synthetic ASCII DXF; no client-derived fixture values.
export const viewportControls=[
 {name:'front',normal:[0,-1,0]},
 {name:'right',normal:[1,0,0]},
 {name:'bottom',normal:[0,0,-1]},
 {name:'oblique',normal:[1,2,3]},
 {name:'top-twisted',normal:[0,0,1],twist:30},
 {name:'top-full-turn-retains-existing-classification',normal:[0,0,1],twist:360},
 {name:'oblique-twisted',normal:[1,2,3],twist:-17},
 {name:'scaled-near-top-outside-existing-tolerance',normal:[1e-10,0,7]},
 {name:'invalid-zero-direction-remains-diagnostic',normal:[0,0,0]}
];
export function viewportDXF({center=[23,-41],target=[0,0,0],normal=[0,0,1],twist=0,modelUnits=4,paperInches=false,viewHeight=100}={}){
 const record=(type,groups)=>[0,type,...groups.flat()],factor=paperInches?25.4:1;
 const model=record('LINE',[[8,'0'],[10,3],[20,-41],[30,0],[11,43],[21,-41],[31,0]]);
 const paper=record('LINE',[[8,'0'],[67,1],[330,'QA-PAPER'],[410,'QA-CENTER'],[10,10/factor],[20,10/factor],[30,0],[11,20/factor],[21,10/factor],[31,0]]);
 const viewport=record('VIEWPORT',[[5,'QA-VP'],[8,'0'],[67,1],[330,'QA-PAPER'],[410,'QA-CENTER'],[69,2],[10,150/factor],[20,100/factor],[30,0],[40,200/factor],[41,100/factor],[12,center[0]],[22,center[1]],...(normal?[[16,normal[0]],[26,normal[1]],[36,normal[2]]]:[]),[17,target[0]],[27,target[1]],[37,target[2]],[45,viewHeight],[51,twist],[90,16384]]);
 const layout=record('LAYOUT',[[5,'QA-LAYOUT'],[100,'AcDbPlotSettings'],[72,paperInches?0:1],[44,420],[45,297],[40,0],[41,0],[42,0],[43,0],[46,0],[47,0],[100,'AcDbLayout'],[1,'QA-CENTER'],[71,1],[330,'QA-PAPER']]);
 return[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,modelUnits,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...model,...paper,...viewport,0,'ENDSEC',0,'SECTION',2,'OBJECTS',...layout,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
}
