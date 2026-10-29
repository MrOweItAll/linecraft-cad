/* Original paper/layout and orthographic viewport mathematics. */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const copy=value=>JSON.parse(JSON.stringify(value));
export const PAPER_SIZES=Object.freeze(Object.fromEntries(Object.entries({A0:[841,1189],A1:[594,841],A2:[420,594],A3:[297,420],A4:[210,297],A5:[148,210],Letter:[215.9,279.4],Tabloid:[279.4,431.8]}).map(([name,[widthMm,heightMm]])=>[name,Object.freeze({widthMm,heightMm})])));
export const LINETYPES=Object.freeze(['continuous','dashed','hidden','center']);
const MIN_SCALE = 1e-6, MAX_SCALE = 1e6;

export function worldToScreen(p, viewport, width, height) {
  return { x: width / 2 + (p.x - viewport.center.x) * viewport.scale, y: height / 2 - (p.y - viewport.center.y) * viewport.scale };
}

export function screenToWorld(p, viewport, width, height) {
  return { x: viewport.center.x + (p.x - width / 2) / viewport.scale, y: viewport.center.y - (p.y - height / 2) / viewport.scale };
}

/** Return a new viewport with the same world point beneath the supplied screen point. */
export function zoomAt(viewport, factor, screen, width, height) {
  if (!finite(factor) || factor <= 0) throw new Error('Zoom factor must be positive and finite.');
  const anchor = screenToWorld(screen, viewport, width, height);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewport.scale * factor));
  return { center: { x: anchor.x - (screen.x - width / 2) / scale, y: anchor.y + (screen.y - height / 2) / scale }, scale };
}

/** Positive screen deltas drag drawing content right/down. */
export function pan(viewport, dx, dy) {
  return { center: { x: viewport.center.x - dx / viewport.scale, y: viewport.center.y + dy / viewport.scale }, scale: viewport.scale };
}

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
  if(![x,y,width,height,x+width,y+height].every(finite)||Math.abs(x)>1e9||Math.abs(y)>1e9||width<.01||height<.01||width>1e9||height>1e9)throw Error('Viewport frame must have finite coordinates within +/-1000000000 mm and dimensions 0.01..1000000000 mm.');
  return{x,y,width,height};
}
export function viewportBoundaryPoints(view){const f=view.frame;return view.boundary?copy(view.boundary):[{x:f.x,y:f.y},{x:f.x+f.width,y:f.y},{x:f.x+f.width,y:f.y+f.height},{x:f.x,y:f.y+f.height}];}
export function viewportFrameFromPoints(points){if(!Array.isArray(points)||!points.length)throw Error('Viewport boundary needs points.');points.forEach(xy);const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return normalizeFrame({x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y});}
export function normalizeViewportBoundary(raw){
  if(!Array.isArray(raw)||raw.length<3||raw.length>64)throw Error('Viewport polygon needs 3..64 distinct vertices, storing its first vertex once.');
  const points=raw.map(xy);if(points.some(p=>Math.abs(p.x)>1e9||Math.abs(p.y)>1e9))throw Error('Viewport polygon coordinates must be within +/-1000000000 mm.');
  const f=viewportFrameFromPoints(points),scale=Math.max(f.width,f.height),local=points.map(p=>({x:(p.x-f.x)/scale,y:(p.y-f.y)/scale})),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),tol=Number.EPSILON*64;
  if(new Set(points.map(p=>JSON.stringify([p.x,p.y]))).size!==points.length)throw Error('Viewport polygon vertices must be distinct.');
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<=tol&&p.x>=Math.min(a.x,b.x)-tol&&p.x<=Math.max(a.x,b.x)+tol&&p.y>=Math.min(a.y,b.y)-tol&&p.y<=Math.max(a.y,b.y)+tol;
  for(let i=0;i<local.length;i++){const a=local[i],b=local[(i+1)%local.length],c=local[(i+2)%local.length];if(Math.abs(cross(a,b,c))<=tol&&on(a,b,c))throw Error('Viewport polygon cannot retrace an adjacent edge.');for(let j=i+1;j<local.length;j++){if(j===i+1||i===0&&j===local.length-1)continue;const c=local[j],d=local[(j+1)%local.length],ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);if(ab1*ab2<0&&cd1*cd2<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('Viewport polygon must be simple without crossed or touching edges.');}}
  const area=local.reduce((sum,p,i)=>{const q=local[(i+1)%local.length];return sum+p.x*q.y-q.x*p.y;},0);if(Math.abs(area)<=tol)throw Error('Viewport polygon has no usable area.');return points;
}
export function viewportAsObject(view,layoutId,document={}){let id=`@VIEWPORT/${encodeURIComponent(layoutId)}/${encodeURIComponent(view.id)}`;while(document.entityIds?.has(id)||document.entities?.some(entity=>entity.id===id))id='@'+id;return{...copy(view),id,viewportId:view.id,type:'VIEWPORT',layoutId,modelUnitMm:modelUnitMillimeters(document.settings),points:viewportBoundaryPoints(view),closed:true};}
export function normalizePaperViewport(raw,paper,layers,normalizeCamera){
  if(!raw||typeof raw.id!=='string'||!raw.id.length||raw.id.length>255)throw Error('Viewport ID must be a nonempty string of at most 255 characters.');
  const frame=normalizeFrame(raw.frame,paper),boundary=raw.boundary===undefined?undefined:normalizeViewportBoundary(raw.boundary),modelCenter=xyz(raw.modelCenter===undefined?{x:0,y:0,z:0}:raw.modelCenter),scaleDenominator=raw.scaleDenominator===undefined?100:raw.scaleDenominator;
  if(boundary){const bounds=viewportFrameFromPoints(boundary);if(['x','y','width','height'].some(key=>Math.abs(frame[key]-bounds[key])>1e-9*Math.max(1,Math.abs(bounds[key]))))throw Error('Viewport frame must equal its polygon boundary bounds.');}
  if(!finite(scaleDenominator)||scaleDenominator<1e-6||scaleDenominator>1e9)throw Error('Viewport scale denominator must be between 0.000001 and 1000000000.');
  for(const key of ['locked','plotBorder'])if(raw[key]!==undefined&&typeof raw[key]!=='boolean')throw Error(`${key} must be boolean.`);
  const frozenLayers=raw.frozenLayers===undefined?[]:raw.frozenLayers;
  if(!Array.isArray(frozenLayers)||new Set(frozenLayers).size!==frozenLayers.length||frozenLayers.some(name=>!layers.some(layer=>layer.name===name)))throw Error('Viewport freeze list must contain distinct existing layers.');
  const workspace=raw.workspace===undefined?'2d':raw.workspace;if(!['2d','3d'].includes(workspace))throw Error('Viewport workspace must be 2d or 3d.');
  if(raw.camera3d!==undefined&&(!raw.camera3d||typeof raw.camera3d!=='object'||Array.isArray(raw.camera3d)))throw Error('Viewport camera must be an object.');
  const camera3d=normalizeCamera({...raw.camera3d,target:modelCenter,...(raw.camera3d===undefined?{yaw:-90,pitch:90,roll:0,mode:'top',projection:'orthographic'}:{})});
  if(camera3d.projection!=='orthographic')throw Error('Scaled paper viewports support orthographic projection only.');
  const layer=raw.layer===undefined?'0':raw.layer;if(!layers.some(item=>item.name===layer))throw Error('Viewport border layer does not exist.');
  const attributes={};if(raw.color!==undefined){if(typeof raw.color!=='string'||!/^#[0-9a-f]{6}$/i.test(raw.color))throw Error('Viewport color must be a six-digit hex value.');attributes.color=raw.color;}if(raw.colorSource!==undefined){if(!['aci-7','true-color'].includes(raw.colorSource)||!raw.color||raw.colorSource==='aci-7'&&raw.color.toLowerCase()!=='#ffffff')throw Error('Invalid viewport color-source metadata.');attributes.colorSource=raw.colorSource;}if(raw.lineweight!==undefined){if(!finite(raw.lineweight)||raw.lineweight<0||raw.lineweight>10)throw Error('Viewport lineweight must be 0..10 mm.');attributes.lineweight=raw.lineweight;}if(raw.linetype!==undefined){if(!LINETYPES.includes(raw.linetype))throw Error('Viewport linetype is invalid.');attributes.linetype=raw.linetype;}
  return{id:raw.id,frame,...(boundary?{boundary}:{}),modelCenter,scaleDenominator,locked:raw.locked??false,frozenLayers:[...frozenLayers],workspace,camera3d,plotBorder:raw.plotBorder??false,layer,...attributes};
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
    return{id:layout.id,name:layout.name,paper,viewports,entities:copy(entities),...(layout.plotSettings===undefined?{}:{plotSettings:normalizePlotSettings(layout.plotSettings)})};
  });
}
export function normalizePlotSettings(raw){
  const record=(v,keys)=>{if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.getOwnPropertyDescriptor(v,k)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')))throw Error('Plot settings must contain only supported plain data.');};
  record(raw,['marginsMm','originMm','renderOffsetMm','sourcePaperUnits','sourceMediaMm','deviceName','mediaName']);record(raw.marginsMm,['left','bottom','right','top']);record(raw.originMm,['x','y']);record(raw.renderOffsetMm,['x','y']);
  for(const k of ['left','bottom','right','top'])if(!finite(raw.marginsMm[k])||raw.marginsMm[k]<0||raw.marginsMm[k]>5000)throw Error('Plot margins must be finite millimeters from 0 through 5000.');for(const key of ['originMm','renderOffsetMm'])for(const k of ['x','y'])if(!finite(raw[key][k])||Math.abs(raw[key][k])>1e6)throw Error('Plot offsets must be finite bounded millimeters.');
  if(!['mm','in'].includes(raw.sourcePaperUnits)||raw.renderOffsetMm.x!==raw.marginsMm.left+raw.originMm.x||raw.renderOffsetMm.y!==raw.marginsMm.bottom+raw.originMm.y)throw Error('Plot render offset must equal the printable-origin translation.');
  if(raw.sourceMediaMm!==undefined){record(raw.sourceMediaMm,['width','height']);if(![raw.sourceMediaMm.width,raw.sourceMediaMm.height].every(n=>finite(n)&&n>=10&&n<=5000))throw Error('Source paper media dimensions are invalid.');}
  for(const key of ['deviceName','mediaName'])if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>255||/[\x00-\x1f\x7f]/.test(raw[key])))throw Error('Plot device/media names must be bounded plain metadata.');
  return copy(raw);
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
/** Border resizing keeps the same model points anchored to absolute paper. */
export function compensateViewportResize(source,edited,settings={}){
  const units=source.modelUnitMm===undefined?modelUnitMillimeters(settings):source.modelUnitMm;if(!finite(units)||units<=0)throw Error('Viewport model-unit conversion must be positive and finite.');
  const a=source.frame,b=edited.frame,dx=((b.x+b.width/2)-(a.x+a.width/2))*source.scaleDenominator/units,dy=((b.y+b.height/2)-(a.y+a.height/2))*source.scaleDenominator/units,axes=basis(source),c=xyz(source.modelCenter),modelCenter={x:c.x+axes.right.x*dx+axes.up.x*dy,y:c.y+axes.right.y*dx+axes.up.y*dy,z:c.z+axes.right.z*dx+axes.up.z*dy};
  if(!Object.values(modelCenter).every(finite))throw Error('Viewport resize compensation exceeds the finite numeric range.');return{...edited,modelCenter,camera3d:{...edited.camera3d,target:{...modelCenter}}};
}
export function pointInViewport(p,viewport){if(!(p.x>=viewport.frame.x&&p.x<=viewport.frame.x+viewport.frame.width&&p.y>=viewport.frame.y&&p.y<=viewport.frame.y+viewport.frame.height))return false;if(!viewport.boundary)return true;const points=viewport.boundary;let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i],cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);if(Math.abs(cross)<=Number.EPSILON*64*Math.max(1,Math.abs((p.x-a.x)*(b.y-a.y)),Math.abs((p.y-a.y)*(b.x-a.x)))&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y))return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
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
