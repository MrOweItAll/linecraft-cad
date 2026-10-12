/* Original paper/layout and orthographic viewport mathematics. */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const copy=value=>JSON.parse(JSON.stringify(value));
export const PAPER_SIZES=Object.freeze(Object.fromEntries(Object.entries({A0:[841,1189],A1:[594,841],A2:[420,594],A3:[297,420],A4:[210,297],A5:[148,210],Letter:[215.9,279.4],Tabloid:[279.4,431.8]}).map(([name,[widthMm,heightMm]])=>[name,Object.freeze({widthMm,heightMm})])));
export const LINETYPES=Object.freeze(['continuous','dashed','hidden','center']);
export function modelUnitMillimeters(settings={}){const values={unitless:1,mm:1,cm:10,m:1000,in:25.4,ft:304.8},unit=settings.units===undefined?'unitless':settings.units;if(!Object.hasOwn(values,unit))throw Error('Unsupported model unit.');return values[unit];}
export function normalizePaper(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Paper specification must be an object.');
  const size=raw.size===undefined?'A3':raw.size,orientation=raw.orientation===undefined?'landscape':raw.orientation;
  if(!['portrait','landscape'].includes(orientation))throw Error('Paper orientation must be portrait or landscape.');
  let widthMm,heightMm;
  if(size==='Custom'){widthMm=raw.widthMm;heightMm=raw.heightMm;}
  else{const preset=PAPER_SIZES[size];if(!preset)throw Error('Unsupported paper size.');[widthMm,heightMm]=orientation==='portrait'?[preset.widthMm,preset.heightMm]:[preset.heightMm,preset.widthMm];
    if(raw.widthMm!==undefined&&raw.widthMm!==widthMm||raw.heightMm!==undefined&&raw.heightMm!==heightMm)throw Error('Preset paper dimensions must match its size and orientation.');}
  if(!finite(widthMm)||!finite(heightMm)||widthMm<10||heightMm<10||widthMm>5000||heightMm>5000)throw Error('Paper dimensions must be finite between 10 and 5000 mm.');
  return{size,orientation,widthMm,heightMm};
}
const xy=p=>{if(!p||!finite(p.x)||!finite(p.y))throw Error('Enter finite paper/model coordinates.');return{x:p.x,y:p.y};};
const xyz=p=>({...xy(p),z:p.z===undefined?0:(finite(p.z)?p.z:(()=>{throw Error('Model center Z must be finite.');})())});
export function normalizeFrame(raw,paper){
  if(!raw||typeof raw!=='object')throw Error('Viewport frame must be an object.');
  const{x,y,width,height}=raw;
  if(![x,y,width,height].every(finite)||x<0||y<0||width<.01||height<.01||x+width>paper.widthMm+1e-9||y+height>paper.heightMm+1e-9)throw Error('Viewport frame must be finite, positive and inside its paper sheet.');
  return{x,y,width,height};
}
export function normalizePaperViewport(raw,paper,layers,normalizeCamera){
  if(!raw||typeof raw.id!=='string'||!raw.id.length||raw.id.length>255)throw Error('Viewport ID must be a nonempty string of at most 255 characters.');
  const frame=normalizeFrame(raw.frame,paper),modelCenter=xyz(raw.modelCenter===undefined?{x:0,y:0,z:0}:raw.modelCenter),scaleDenominator=raw.scaleDenominator===undefined?100:raw.scaleDenominator;
  if(!finite(scaleDenominator)||scaleDenominator<1e-6||scaleDenominator>1e9)throw Error('Viewport scale denominator must be between 0.000001 and 1000000000.');
  for(const key of ['locked','plotBorder'])if(raw[key]!==undefined&&typeof raw[key]!=='boolean')throw Error(`${key} must be boolean.`);
  const frozenLayers=raw.frozenLayers===undefined?[]:raw.frozenLayers;
  if(!Array.isArray(frozenLayers)||new Set(frozenLayers).size!==frozenLayers.length||frozenLayers.some(name=>!layers.some(layer=>layer.name===name)))throw Error('Viewport freeze list must contain distinct existing layers.');
  const workspace=raw.workspace===undefined?'2d':raw.workspace;if(!['2d','3d'].includes(workspace))throw Error('Viewport workspace must be 2d or 3d.');
  if(raw.camera3d!==undefined&&(!raw.camera3d||typeof raw.camera3d!=='object'||Array.isArray(raw.camera3d)))throw Error('Viewport camera must be an object.');
  const camera3d=normalizeCamera({...raw.camera3d,target:modelCenter,...(raw.camera3d===undefined?{yaw:-90,pitch:90,roll:0,mode:'top',projection:'orthographic'}:{})});
  if(camera3d.projection!=='orthographic')throw Error('Scaled paper viewports support orthographic projection only.');
  const layer=raw.layer===undefined?'0':raw.layer;if(!layers.some(item=>item.name===layer))throw Error('Viewport border layer does not exist.');
  return{id:raw.id,frame,modelCenter,scaleDenominator,locked:raw.locked??false,frozenLayers:[...frozenLayers],workspace,camera3d,plotBorder:raw.plotBorder??false,layer};
}
export function normalizeLayouts(raw,layers,normalizeCamera){
  if(!Array.isArray(raw)||raw.length>32)throw Error('Drawing supports at most 32 layouts.');
  const names=new Set(),ids=new Set(),vpIds=new Set();
  return raw.map(layout=>{
    if(!layout||typeof layout.id!=='string'||!layout.id.length||layout.id.length>255||ids.has(layout.id))throw Error('Layout IDs must be distinct nonempty strings.');
    if(typeof layout.name!=='string'||!layout.name.trim()||layout.name.length>255||/[<>/\\";:?*|,=\x00-\x1f]/.test(layout.name)||layout.name.toLowerCase()==='model'||names.has(layout.name.toLowerCase()))throw Error('Layout names must be distinct valid names other than Model.');
    ids.add(layout.id);names.add(layout.name.toLowerCase());const paper=normalizePaper(layout.paper);
    const rawViewports=layout.viewports===undefined?[]:layout.viewports;if(!Array.isArray(rawViewports)||rawViewports.length>16)throw Error('Each layout supports at most 16 viewports.');
    const viewports=rawViewports.map(view=>{const vp=normalizePaperViewport(view,paper,layers,normalizeCamera);if(vpIds.has(vp.id))throw Error('Viewport IDs must be globally distinct.');vpIds.add(vp.id);return vp;});
    const entities=layout.entities===undefined?[]:layout.entities;if(!Array.isArray(entities))throw Error('Paper entities must be an array.');
    return{id:layout.id,name:layout.name,paper,viewports,entities:copy(entities)};
  });
}
function basis(viewport){
  if(viewport.workspace!=='3d')return{right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},normal:{x:0,y:0,z:1}};
  const c=viewport.camera3d,rad=Math.PI/180,cy=Math.cos(c.yaw*rad),sy=Math.sin(c.yaw*rad),cp=Math.cos(c.pitch*rad),sp=Math.sin(c.pitch*rad),cr=Math.cos(c.roll*rad),sr=Math.sin(c.roll*rad);
  return{right:{x:-sy*cr-cy*sp*sr,y:cy*cr-sy*sp*sr,z:cp*sr},up:{x:-cy*sp*cr+sy*sr,y:-sy*sp*cr-cy*sr,z:cp*cr},normal:{x:cy*cp,y:sy*cp,z:sp}};
}
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export function viewportModelToPaper(rawPoint,viewport,settings={}){
  const p=xyz(rawPoint),c=xyz(viewport.modelCenter),delta={x:p.x-c.x,y:p.y-c.y,z:p.z-c.z},axes=basis(viewport),factor=modelUnitMillimeters(settings)/viewport.scaleDenominator;
  const result={x:viewport.frame.x+viewport.frame.width/2+dot(delta,axes.right)*factor,y:viewport.frame.y+viewport.frame.height/2+dot(delta,axes.up)*factor,depth:dot(delta,axes.normal)};
  if(!Object.values(result).every(finite))throw Error('Viewport projection exceeds the finite numeric range.');return result;
}
export function viewportPaperToModel(rawPoint,viewport,settings={}){
  const p=xy(rawPoint),axes=basis(viewport),factor=viewport.scaleDenominator/modelUnitMillimeters(settings),x=(p.x-viewport.frame.x-viewport.frame.width/2)*factor,y=(p.y-viewport.frame.y-viewport.frame.height/2)*factor,c=xyz(viewport.modelCenter);
  const result={x:c.x+axes.right.x*x+axes.up.x*y,y:c.y+axes.right.y*x+axes.up.y*y,z:c.z+axes.right.z*x+axes.up.z*y};
  if(!Object.values(result).every(finite))throw Error('Viewport inverse projection exceeds the finite numeric range.');return result;
}
export function pointInViewport(p,viewport){return p.x>=viewport.frame.x&&p.x<=viewport.frame.x+viewport.frame.width&&p.y>=viewport.frame.y&&p.y<=viewport.frame.y+viewport.frame.height;}
export function normalizePaperView(raw={center:{x:210,y:148.5},scale:2}){const center=xy(raw.center);if(!finite(raw.scale)||raw.scale<1e-6||raw.scale>1e6)throw Error('Paper view scale must be 0.000001..1000000 pixels/mm.');return{center,scale:raw.scale};}
export function isEntityVisible(entity,document={},context={}){
  const layoutId=context.layoutId===undefined?document.activeLayoutId:context.layoutId,viewportId=context.viewportId===undefined?document.activeViewportId:context.viewportId;
  const space=context.space??(layoutId?'paper':'model'),layer=document.layers?.find(item=>item.name===entity.layer);
  if(layer?.visible===false)return false;
  if(space==='model')return !entity.layoutId&&layer?.modelVisible!==false;
  if(layer?.paperVisible===false)return false;
  if(entity.layoutId)return entity.layoutId===layoutId&&!viewportId;
  if(!viewportId)return false;
  const viewport=document.layouts?.find(layout=>layout.id===layoutId)?.viewports.find(view=>view.id===viewportId);
  return !!viewport&&!viewport.frozenLayers.includes(entity.layer);
}
