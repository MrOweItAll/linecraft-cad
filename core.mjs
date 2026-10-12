/* Linecraft geometry and command engine. Original implementation; no external dependencies. */
import {validateEllipse,ellipsePoint,ellipseBoundsPoints,validateSpline,makeClampedKnots,splinePoint,splineBezierSegments,splineBoundsPoints,sampleCurve,boundaryPolygon,boundaryContains,hatchGeometry,filletLines,chamferLines} from './advanced-geometry.mjs';
import {parseLength,parseAngle,formatLength,formatAngle,formatArea,UNIT_PRESETS,UNIT_SETTINGS_DEFAULTS,normalizeUnitSettings,dxfUnitFormat} from './units.mjs';
export {parseLength,parseAngle,formatLength,formatAngle,formatArea,UNIT_PRESETS,dxfUnitFormat};
export {ellipsePoint,splinePoint,splineBezierSegments,sampleCurve,hatchGeometry,filletLines,chamferLines};
export const ADVANCED_COMMANDS=Object.freeze(['HATCH','DIMANGULAR','BLOCK','INSERT','ARRAYRECT','FILLET','CHAMFER','ELLIPSE','SPLINE','STRETCH','PEDIT']);
const NUMBER = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const CARTESIAN = new RegExp(`^(${NUMBER})\\s*,\\s*(${NUMBER})(?:\\s*,\\s*(${NUMBER}))?$`);
const POLAR = new RegExp(`^(${NUMBER})\\s*<\\s*(${NUMBER})$`);
const EPS = 1e-10;
const clone = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const samePoint = (a, b) => a.x === b.x && a.y === b.y;
const TRANSFORMS = new Set(['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR','ROTATE3D']);
const SELECT_COMMANDS = new Set([...TRANSFORMS, 'ERASE', 'COPYCLIP', 'COPYBASE', 'CUTCLIP', 'TRIM', 'EXTEND', 'BREAK', 'JOIN', 'EXPLODE','TEXTEDIT','EXTRUDE','ARRAYRECT','PEDIT','BLOCK']);
const TYPES3D=new Set(['MESH','POLY3D']),DRAW3D=new Set(['BOX','CYLINDER','SPHERE','3DPOLY']);
const MAX_MESH_VERTICES=100000,MAX_MESH_FACES=200000,MAX_EXTRUSION_VERTICES=4096;
const REPEATED_EDITS = new Set(['TRIM', 'EXTEND', 'OFFSET']);
const TEXT_TYPES=new Set(['TEXT','MTEXT']);
const DIM_COMMANDS=new Set(['DIMLINEAR','DIMALIGNED','DIMRADIUS','DIMDIAMETER','DIMANGULAR']);
const MIN_SCALE = 1e-6, MAX_SCALE = 1e6;
const DEFAULT_SETTINGS={units:'unitless',precision:4,...UNIT_SETTINGS_DEFAULTS,gridEnabled:true,snapEnabled:true,orthoEnabled:false,snapModes:['endpoint','midpoint','center','quadrant'],gridAdaptive:true,gridSpacing:10,constructionElevation:0,constructionPlane:'XY'};
const DEFAULT_CAMERA3D={target:{x:0,y:0,z:0},orbitCenter:null,scale:10,yaw:45,pitch:35.264389682754654,roll:0,mode:'iso',renderMode:'shaded',projection:'orthographic',distance:200,fov:45,autoTarget:true};
const DEFAULT_TEXT_STYLE={name:'Standard',fontFamily:'Arial',defaultHeight:2.5,defaultRotation:0,widthFactor:1};
const DEFAULT_DIM_STYLE={name:'Standard',textStyle:'Standard',textHeight:2.5,arrowSize:2.5,gap:1,extensionOffset:1,extensionOvershoot:1.25,precision:2,scale:1,prefix:'',suffix:''};

function positive(value,label){if(!finite(value)||value<=0)throw new Error(`${label} must be positive and finite.`);return value;}
function normalizeTextStyle(raw){
  const style={...DEFAULT_TEXT_STYLE,...raw};
  if(!validLayerName(style.name))throw new Error('Text style name is invalid.');
  if(!['Arial','Segoe UI','Consolas'].includes(style.fontFamily))throw new Error('Supported fonts are Arial, Segoe UI and Consolas.');
  positive(style.defaultHeight,'Default text height');if(!finite(style.defaultRotation))throw new Error('Default text rotation must be finite.');style.defaultRotation%=360;
  if(!finite(style.widthFactor)||style.widthFactor<.01||style.widthFactor>100)throw new Error('Text width factor must be between 0.01 and 100.');
  return {name:style.name,fontFamily:style.fontFamily,defaultHeight:style.defaultHeight,defaultRotation:style.defaultRotation,widthFactor:style.widthFactor};
}
function normalizeDimStyle(raw,textStyles){
  const style={...DEFAULT_DIM_STYLE,...raw};
  if(!validLayerName(style.name)||!textStyles.some(item=>item.name===style.textStyle))throw new Error('Dimension style name or text style reference is invalid.');
  for(const key of ['textHeight','arrowSize','scale'])positive(style[key],key);
  for(const key of ['gap','extensionOffset','extensionOvershoot'])if(!finite(style[key])||style[key]<0)throw new Error(`${key} must be nonnegative and finite.`);
  if(!Number.isInteger(style.precision)||style.precision<0||style.precision>8)throw new Error('Dimension precision must be an integer from 0 through 8.');
  for(const key of ['prefix','suffix'])if(typeof style[key]!=='string'||style[key].length>256||/[\r\n\x00-\x1f]/.test(style[key])||style[key].includes('<>'))throw new Error('Dimension prefix/suffix must be plain single-line text of at most 256 characters without a measurement placeholder.');
  if(new TextEncoder().encode(`${escapeDXFMText(style.prefix)}<>${escapeDXFMText(style.suffix)}`).length>2048)throw new Error('Dimension prefix/suffix exceed the encoded exchange limit.');
  for(const key of ['fractionPrecision','angularPrecision'])if(raw?.[key]!==undefined&&(!Number.isInteger(raw[key])||raw[key]<0||raw[key]>8))throw new Error(`${key} must be an integer from zero through eight.`);
  return {...Object.fromEntries(Object.keys(DEFAULT_DIM_STYLE).map(key=>[key,style[key]])),...Object.fromEntries(['fractionPrecision','angularPrecision'].filter(key=>raw?.[key]!==undefined).map(key=>[key,raw[key]]))};
}
function normalizeSettings(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Drawing settings must be an object.');
  const settings={...clone(DEFAULT_SETTINGS),...raw};
  Object.assign(settings,normalizeUnitSettings(settings));
  if(!['unitless','mm','cm','m','in','ft'].includes(settings.units))throw new Error('Unsupported drawing unit.');
  if(!Number.isInteger(settings.precision)||settings.precision<0||settings.precision>8)throw new Error('Drawing precision must be an integer from 0 through 8.');
  for(const key of ['gridEnabled','snapEnabled','orthoEnabled','gridAdaptive'])if(typeof settings[key]!=='boolean')throw new Error(`${key} must be boolean.`);
  positive(settings.gridSpacing,'Grid spacing');
  if(!finite(settings.constructionElevation)||settings.constructionPlane!=='XY')throw new Error('Construction plane must be XY with a finite elevation.');
  if(!Array.isArray(settings.snapModes)||settings.snapModes.some(mode=>!['endpoint','midpoint','center','quadrant'].includes(mode)))throw new Error('Snap modes must be a supported subset.');
  settings.snapModes=[...new Set(settings.snapModes)];return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key=>[key,settings[key]]));
}
function validateText(entity,document){
  point(entity.position);positive(entity.height,'Text height');if(!finite(entity.rotation))throw new Error('Text rotation must be finite.');
  if(typeof entity.text!=='string'||!entity.text.length||entity.text.length>65536||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(entity.text))throw new Error('Text must contain 1 through 65536 printable characters.');
  if(entity.type==='TEXT'&&/[\r\n\t]/.test(entity.text))throw new Error('TEXT is single-line; use MTEXT for multiline content.');
  if(entity.type==='TEXT'&&new TextEncoder().encode(escapeDXFText(entity.text)).length>2048)throw new Error('TEXT exceeds the 2048-byte encoded exchange limit; use MTEXT for longer content.');
  if(entity.type==='MTEXT')positive(entity.width,'MTEXT width');
  if(!document.textStyles.some(style=>style.name===entity.style))throw new Error('Entity text style does not exist.');
  textLayout(entity,document).corners.forEach(point);
}
function styleContext(document={}){return{...document,textStyles:document.textStyles??[DEFAULT_TEXT_STYLE],dimStyles:document.dimStyles??[DEFAULT_DIM_STYLE],settings:document.settings??DEFAULT_SETTINGS};}
function glyphAdvance(character,font){
  if(font==='Consolas')return .6;
  if(character===' ')return .34;if(/[ilI.,'!|]/.test(character))return .28;if(/[MW@#]/.test(character))return .9;
  return character.codePointAt(0)>0x2ff?.8:.62;
}
function textWidth(text,height,style){return Array.from(text).reduce((sum,c)=>sum+glyphAdvance(c,style.fontFamily),0)*height*style.widthFactor;}
function textWorld(entity,x,y){const[c,s]=angleBasis(entity.rotation??0);return point({x:entity.position.x+x*c-y*s,y:entity.position.y+x*s+y*c});}

/** Deterministic original metric approximation; Canvas and selection share wrapping and line positions. */
export function textLayout(entity,rawDocument={}){
  const document=styleContext(rawDocument),style=document.textStyles.find(item=>item.name===entity.style)??DEFAULT_TEXT_STYLE;
  const content=entity.text.replace(/\r\n?/g,'\n').replace(/\t/g,'    '),lines=[];
  for(const paragraph of content.split('\n')){
    if(entity.type!=='MTEXT'){lines.push(paragraph);continue;}
    let current='',currentWidth=0;
    const flush=()=>{lines.push(current);current='';currentWidth=0;};
    for(const token of paragraph.match(/\S+|\s+/gu)??[]){
      const tokenWidth=textWidth(token,entity.height,style);
      if(current&&currentWidth+tokenWidth>entity.width)flush();
      if(tokenWidth<=entity.width){current+=token;currentWidth+=tokenWidth;continue;}
      for(const character of Array.from(token)){
        const advance=glyphAdvance(character,style.fontFamily)*entity.height*style.widthFactor;
        if(current&&currentWidth+advance>entity.width)flush();current+=character;currentWidth+=advance;
      }
    }
    lines.push(current);
  }
  const widths=lines.map(line=>textWidth(line,entity.height,style)),width=Math.max(entity.type==='MTEXT'?entity.width:0,...widths),height=entity.height*(entity.type==='MTEXT'?Math.max(1,lines.length)*1.35:1.35);
  const top=entity.type==='MTEXT'?0:entity.height,bottom=entity.type==='MTEXT'?-height:-entity.height*.35;
  return{lines:lines.map((text,index)=>({text,position:textWorld(entity,0,entity.type==='MTEXT'?-entity.height*(index*1.35+1):0),width:widths[index],height:entity.height,rotation:entity.rotation??0,fontFamily:style.fontFamily,widthFactor:style.widthFactor,align:'left'})),corners:[[0,bottom],[width,bottom],[width,top],[0,top]].map(([x,y])=>textWorld(entity,x,y)),width,height,origin:{...entity.position},rotation:entity.rotation??0,fontFamily:style.fontFamily,widthFactor:style.widthFactor};
}
function validateDimension(entity,document){
  if(!['linear','aligned','radius','diameter','angular'].includes(entity.kind))throw new Error('Unsupported dimension kind.');
  point(entity.placement);positive(entity.scale,'Dimension scale');
  if(!document.dimStyles.some(style=>style.name===entity.style))throw new Error('Dimension style does not exist.');
  if(['linear','aligned'].includes(entity.kind)){
    point(entity.p1);point(entity.p2);if(samePoint(entity.p1,entity.p2))throw new Error('Dimension origins must differ.');
    if(entity.kind==='linear'&&!finite(entity.axisAngle))throw new Error('Linear dimension angle must be finite.');
  }else if(entity.kind==='angular'){point(entity.vertex);point(entity.p1);point(entity.p2);angularDefinition(entity);}
  else validateCircle(entity.center,entity.radius);
  if(entity.textOverride!==undefined&&(typeof entity.textOverride!=='string'||entity.textOverride.length>2048||/[\r\n\x00-\x1f]/.test(entity.textOverride)))throw new Error('Dimension override must be single-line text of at most 2048 characters.');
  const geometry=annotationPrimitives(entity,document);positive(geometry.measurement,'Dimension measurement');geometry.boundsPoints.forEach(point);
  if(new TextEncoder().encode(escapeDXFText(geometry.label)).length>2048||entity.textOverride!=null&&new TextEncoder().encode(escapeDXFMText(entity.textOverride)).length>2048)throw new Error('Dimension label exceeds the encoded exchange limit.');
}
export function formatDimension(entity,rawDocument={}){
  const document=styleContext(rawDocument),style=document.dimStyles.find(item=>item.name===entity.style)??DEFAULT_DIM_STYLE;
  let measurement;
  if(entity.kind==='aligned')measurement=Math.hypot(entity.p2.x-entity.p1.x,entity.p2.y-entity.p1.y);
  else if(entity.kind==='linear'){const[c,s]=angleBasis(entity.axisAngle);measurement=Math.abs((entity.p2.x-entity.p1.x)*c+(entity.p2.y-entity.p1.y)*s);}
  else if(entity.kind==='angular')measurement=Math.abs(angularDefinition(entity).sweep);
  else measurement=entity.radius*(entity.kind==='diameter'?2:1);
  if(!finite(measurement))throw new Error('Dimension measurement exceeds the supported numeric range.');
  const numeric=entity.kind==='angular'?formatAngle(measurement,document.settings,{precision:style.angularPrecision??style.precision}):formatLength(measurement,document.settings,{precision:style.precision,fractionPrecision:style.fractionPrecision??document.settings.fractionPrecision}),automatic=`${style.prefix}${entity.kind==='radius'?'R':entity.kind==='diameter'?'Ø':''}${numeric}${style.suffix}`;
  return{measurement,label:entity.textOverride?entity.textOverride.replaceAll('<>',automatic):automatic};
}
function angularDefinition(entity){
  const vertex=entity.vertex,a=point({x:entity.p1.x-vertex.x,y:entity.p1.y-vertex.y}),b=point({x:entity.p2.x-vertex.x,y:entity.p2.y-vertex.y}),d=point({x:entity.placement.x-vertex.x,y:entity.placement.y-vertex.y}),radius=Math.hypot(d.x,d.y);
  if(Math.hypot(a.x,a.y)===0||Math.hypot(b.x,b.y)===0||!finite(radius)||radius===0)throw new Error('Angular rays and placement must differ from the vertex.');
  const start=Math.atan2(a.y,a.x)*180/Math.PI,end=Math.atan2(b.y,b.x)*180/Math.PI,ccw=positiveAngle(end-start),placement=positiveAngle(Math.atan2(d.y,d.x)*180/Math.PI-start);if(ccw<1e-10||360-ccw<1e-10)throw new Error('Angular dimension rays cannot have the same direction.');
  return{start,sweep:placement<=ccw+1e-10?ccw:ccw-360,radius};
}
export function annotationPrimitives(entity,rawDocument={}){
  const document=styleContext(rawDocument);
  if(TEXT_TYPES.has(entity.type)){const layout=textLayout(entity,document);return{segments:layout.corners.map((p,index)=>[p,layout.corners[(index+1)%4]]),arrows:[],texts:layout.lines,boundsPoints:layout.corners};}
  if(entity.type!=='DIMENSION')return{segments:[],arrows:[],texts:[],boundsPoints:[]};
  const style=document.dimStyles.find(item=>item.name===entity.style)??DEFAULT_DIM_STYLE,factor=style.scale*entity.scale,h=style.textHeight*factor,arrow=style.arrowSize*factor,gap=style.gap*factor;
  const{measurement,label}=formatDimension(entity,document),segments=[],arrows=[],definition=[];let q1,q2,u,v,labelPosition,rotation;
  const shifted=(p,direction,amount)=>point({x:p.x+direction.x*amount,y:p.y+direction.y*amount});
  if(entity.kind==='angular'){
    const{start,sweep,radius}=angularDefinition(entity),count=Math.max(16,Math.ceil(Math.abs(sweep)/3)),arc=Array.from({length:count+1},(_,i)=>{const[c,s]=angleBasis(start+sweep*i/count);return shifted(entity.vertex,{x:c,y:s},radius);});q1=arc[0];q2=arc.at(-1);segments.push(...arc.slice(0,-1).map((p,i)=>[p,arc[i+1]]));
    for(const[p,angle]of[[entity.p1,start],[entity.p2,start+sweep]]){const[c,s]=angleBasis(angle),ray={x:c,y:s},length=Math.hypot(p.x-entity.vertex.x,p.y-entity.vertex.y),side=Math.sign(radius-length)||1;segments.push([shifted(entity.vertex,ray,length+side*style.extensionOffset*factor),shifted(entity.vertex,ray,radius+side*style.extensionOvershoot*factor)]);}
    for(const[p,angle,direction]of[[q1,start,Math.sign(sweep)],[q2,start+sweep,-Math.sign(sweep)]]){const[c,s]=angleBasis(angle),tangent={x:-s*direction,y:c*direction},normal={x:c,y:s};arrows.push([p,shifted(shifted(p,tangent,arrow),normal,arrow*.35),shifted(shifted(p,tangent,arrow),normal,-arrow*.35)]);}
    const middle=start+sweep/2,[c,s]=angleBasis(middle);labelPosition=shifted(entity.vertex,{x:c,y:s},radius+gap+h*.6);rotation=middle+90;definition.push(entity.vertex,entity.p1,entity.p2,entity.placement);
  }else if(['linear','aligned'].includes(entity.kind)){
    const angle=entity.kind==='linear'?entity.axisAngle:Math.atan2(entity.p2.y-entity.p1.y,entity.p2.x-entity.p1.x)*180/Math.PI,[c,s]=angleBasis(angle);u={x:c,y:s};v={x:-s,y:c};rotation=angle;
    q1=shifted(entity.p1,v,(entity.placement.x-entity.p1.x)*v.x+(entity.placement.y-entity.p1.y)*v.y);q2=shifted(entity.p2,v,(entity.placement.x-entity.p2.x)*v.x+(entity.placement.y-entity.p2.y)*v.y);
    if((q2.x-q1.x)*u.x+(q2.y-q1.y)*u.y<0){u={x:-u.x,y:-u.y};[q1,q2]=[q2,q1];}
    for(const[p,q]of [[entity.p1,shifted(entity.p1,v,(entity.placement.x-entity.p1.x)*v.x+(entity.placement.y-entity.p1.y)*v.y)],[entity.p2,shifted(entity.p2,v,(entity.placement.x-entity.p2.x)*v.x+(entity.placement.y-entity.p2.y)*v.y)]]){
      const side=Math.sign((q.x-p.x)*v.x+(q.y-p.y)*v.y)||1;segments.push([shifted(p,v,side*style.extensionOffset*factor),shifted(q,v,side*style.extensionOvershoot*factor)]);
    }
    labelPosition=shifted({x:midpoint(q1.x,q2.x),y:midpoint(q1.y,q2.y)},v,gap+h*.6);definition.push(entity.p1,entity.p2,entity.placement);
    arrows.push([q1,shifted(shifted(q1,u,arrow),v,arrow*.35),shifted(shifted(q1,u,arrow),v,-arrow*.35)],[q2,shifted(shifted(q2,u,-arrow),v,arrow*.35),shifted(shifted(q2,u,-arrow),v,-arrow*.35)]);
    segments.push([q1,q2]);
  }else{
    const dx=entity.placement.x-entity.center.x,dy=entity.placement.y-entity.center.y,length=Math.hypot(dx,dy);if(!finite(length)||!length)throw new Error('Radial dimension placement must differ from the center.');
    u={x:dx/length,y:dy/length};v={x:-u.y,y:u.x};q2=shifted(entity.center,u,entity.radius);q1=entity.kind==='diameter'?shifted(entity.center,u,-entity.radius):entity.center;
    segments.push([q1,q2],[q2,entity.placement]);arrows.push([q2,shifted(shifted(q2,u,arrow),v,arrow*.35),shifted(shifted(q2,u,arrow),v,-arrow*.35)]);
    if(entity.kind==='diameter')arrows.push([q1,shifted(shifted(q1,u,-arrow),v,arrow*.35),shifted(shifted(q1,u,-arrow),v,-arrow*.35)]);
    labelPosition=entity.placement;rotation=0;definition.push(entity.center,entity.placement);
  }
  rotation=readableAngle(rotation);
  if(['linear','aligned'].includes(entity.kind)){const[c,s]=angleBasis(rotation);labelPosition=shifted({x:midpoint(q1.x,q2.x),y:midpoint(q1.y,q2.y)},{x:-s,y:c},gap+h*.6);}
  const textStyle=document.textStyles.find(item=>item.name===style.textStyle)??DEFAULT_TEXT_STYLE;
  const width=textWidth(label,h,textStyle),[c,s]=angleBasis(rotation),textOrigin=point({x:labelPosition.x-width/2*c,y:labelPosition.y-width/2*s});
  const layout=textLayout({type:'TEXT',position:textOrigin,text:label,height:h,rotation,style:style.textStyle},document);
  return{segments,arrows,texts:[{text:label,position:labelPosition,width,height:h,rotation,fontFamily:textStyle.fontFamily,widthFactor:textStyle.widthFactor,align:'center'}],boundsPoints:[...segments.flat(),...arrows.flat(),...layout.corners],definitionPoints:definition,measurement,label,dimensionLine:[q1,q2]};
}
export const dimensionGeometry=annotationPrimitives;

function midpoint(a, b) {
  if (a === b) return a;
  return Math.sign(a) === Math.sign(b) ? a + (b - a) / 2 : a / 2 + b / 2;
}

function validateRectangle(points) {
  const [a, b, c, d] = points;
  const ux = b.x - a.x, uy = b.y - a.y, vx = d.x - a.x, vy = d.y - a.y;
  const uLength = Math.hypot(ux, uy), vLength = Math.hypot(vx, vy);
  if (!finite(uLength) || !finite(vLength) || uLength === 0 || vLength === 0) throw new Error('RECTANG needs finite, nonzero edge lengths.');
  const magnitude = Math.max(...points.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
  // World-coordinate rounding grows with the origin, independently of the rectangle size.
  const ulp = Math.max(Number.MIN_VALUE, magnitude === 0 ? Number.MIN_VALUE : 2 ** (Math.floor(Math.log2(magnitude)) - 52));
  const spatialTolerance = Math.max(Math.max(uLength, vLength) * 1e-8, ulp * 4);
  const angularTolerance = Math.max(1e-8, 4 * (ulp / uLength + ulp / vLength));
  const cosine = (ux / uLength) * (vx / vLength) + (uy / uLength) * (vy / vLength);
  const closureX = ux + vx - (c.x - a.x), closureY = uy + vy - (c.y - a.y);
  if (!finite(cosine) || !finite(closureX) || !finite(closureY) || Math.abs(cosine) > angularTolerance || Math.abs(closureX) > spatialTolerance || Math.abs(closureY) > spatialTolerance) throw new Error('RECTANG must have four ordered rectangular corners.');
}

function angleBasis(degrees) {
  if (!finite(degrees)) throw new Error('Angle must be finite.');
  const normalized = degrees % 360;
  const radians = normalized * Math.PI / 180;
  return normalized === 0 ? [1, 0] : normalized === 90 || normalized === -270 ? [0, 1] : normalized === 180 || normalized === -180 ? [-1, 0] : normalized === 270 || normalized === -90 ? [0, -1] : [Math.cos(radians), Math.sin(radians)];
}
function readableAngle(angle){angle%=360;if(angle>180)angle-=360;if(angle<=-180)angle+=360;if(angle>90)angle-=180;if(angle<-90)angle+=180;return angle;}

function scalar(text, label) {
  if (typeof text === 'number' && finite(text)) return text;
  if (typeof text !== 'string' || !new RegExp(`^${NUMBER}$`).test(text.trim()) || !finite(Number(text))) throw new Error(`${label} must be a finite number.`);
  return Number(text);
}

function point(value) {
  if (!value || !finite(value.x) || !finite(value.y)) throw new Error('Enter finite X and Y coordinates.');
  if (value.z != null && value.z !== 0) throw new Error('Only the XY plane is supported; Z must be 0.');
  return { x: value.x, y: value.y };
}

/** Parse absolute Cartesian/polar or @relative coordinates. Angles use degrees CCW from +X. */
export function parseCoordinate(text, base = { x: 0, y: 0 },settings={}) {
  if (typeof text === 'object') return point(text);
  if (typeof text !== 'string') throw new Error('Enter a coordinate pair, such as 10,20 or @5,0.');
  let source = text.trim();
  const relative = source.startsWith('@');
  if (relative || source.startsWith('#')) source = source.slice(1).trim();
  const origin = relative ? point(base) : { x: 0, y: 0 };
  const components=source.split(',');
  if (components.length===2||components.length===3) {
    const x = parseLength(components[0],settings);
    const y = parseLength(components[1],settings);
    const z = components[2] == null ? 0 : parseLength(components[2],settings);
    if (!finite(z) || z !== 0) throw new Error('Only the XY plane is supported; Z must be 0.');
    return point({ x: origin.x + x, y: origin.y + y });
  }
  const polar=source.split('<');
  if (polar.length===2) {
    const distance = parseLength(polar[0],settings);
    const angle = parseAngle(polar[1],settings);
    if (!finite(distance) || !finite(angle)) throw new Error('Enter finite distance and angle values.');
    const cardinal = angleBasis(angle);
    return point({ x: origin.x + distance * cardinal[0], y: origin.y + distance * cardinal[1] });
  }
  throw new Error('Invalid point. Use X,Y, #X,Y, @dX,dY, or @distance<angle.');
}
const parsePoint2D=parseCoordinate;

function point3(value){
  if(!value||!finite(value.x)||!finite(value.y)||value.z!==undefined&&!finite(value.z))throw new Error('Enter finite X,Y,Z coordinates.');
  return{x:value.x,y:value.y,z:value.z===undefined?0:value.z};
}
const samePoint3=(a,b)=>a.x===b.x&&a.y===b.y&&(a.z??0)===(b.z??0);
export function parseCoordinate3D(text,base={x:0,y:0,z:0},settings={}){
  if(typeof text==='object')return point3(text);
  if(typeof text!=='string')throw new Error('Enter X,Y,Z or @dX,dY,dZ.');
  let source=text.trim();const relative=source.startsWith('@');if(relative||source.startsWith('#'))source=source.slice(1).trim();
  const components=source.split(',');if(![2,3].includes(components.length)||source.includes('<'))throw new Error('3D points use Cartesian X,Y,Z or @dX,dY,dZ; 3D polar input is not supported.');
  const origin=relative?point3(base):{x:0,y:0,z:0};return point3({x:origin.x+parseLength(components[0],settings),y:origin.y+parseLength(components[1],settings),z:origin.z+(components[2]===undefined?0:parseLength(components[2],settings))});
}
function normalizeCamera3D(raw=DEFAULT_CAMERA3D){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('3D camera must be an object.');
  const camera={...DEFAULT_CAMERA3D,...raw,target:point3(raw.target===undefined?DEFAULT_CAMERA3D.target:raw.target),orbitCenter:raw.orbitCenter==null?null:point3(raw.orbitCenter)};
  if(!finite(camera.scale)||camera.scale<MIN_SCALE||camera.scale>MAX_SCALE||!finite(camera.yaw)||!finite(camera.pitch)||!finite(camera.roll)||camera.pitch<-90||camera.pitch>90)throw new Error('3D camera needs finite angles, pitch -90..90, and scale 0.000001..1000000.');
  if(!['iso','seiso','neiso','swiso','nwiso','top','bottom','front','back','left','right','custom'].includes(camera.mode)||!['shaded','wireframe'].includes(camera.renderMode)||!['orthographic','perspective'].includes(camera.projection)||typeof camera.autoTarget!=='boolean'||!finite(camera.distance)||camera.distance<1e-6||camera.distance>1e12||!finite(camera.fov)||camera.fov<5||camera.fov>150)throw new Error('Unsupported 3D camera mode, projection, distance, FOV or AutoTarget (distance 0.000001..1000000000000).');
  camera.yaw%=360;camera.roll%=360;return Object.fromEntries(Object.keys(DEFAULT_CAMERA3D).map(key=>[key,camera[key]]));
}
function faceNormal(vertices,face){
  const a=vertices[face[0]],b=vertices[face[1]],c=vertices[face[2]],u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[c.x-a.x,c.y-a.y,c.z-a.z];
  const scale=Math.max(...u.map(Math.abs),...v.map(Math.abs));if(!finite(scale)||!scale)throw new Error('MESH face span is degenerate or exceeds the numeric range.');
  const [ux,uy,uz]=u.map(value=>value/scale),[vx,vy,vz]=v.map(value=>value/scale),normal={x:uy*vz-uz*vy,y:uz*vx-ux*vz,z:ux*vy-uy*vx};
  if(!finite(Math.hypot(normal.x,normal.y,normal.z))||Math.hypot(normal.x,normal.y,normal.z)<=Number.EPSILON*8)throw new Error('MESH contains a degenerate face.');return normal;
}
export function validateMesh(entity){
  if(!Array.isArray(entity.vertices)||entity.vertices.length<3||entity.vertices.length>MAX_MESH_VERTICES)throw new Error('MESH requires 3..100000 vertices.');
  if(!Array.isArray(entity.faces)||!entity.faces.length||entity.faces.length>MAX_MESH_FACES)throw new Error('MESH requires 1..200000 faces.');
  entity.vertices.forEach(point3);const used=new Set();
  for(const face of entity.faces){
    if(!Array.isArray(face)||![3,4].includes(face.length)||new Set(face).size!==face.length||face.some(index=>!Number.isInteger(index)||index<0||index>=entity.vertices.length))throw new Error('MESH faces require 3 or 4 distinct valid vertex indices.');
    face.forEach(index=>used.add(index));faceNormal(entity.vertices,face);if(face.length===4)faceNormal(entity.vertices,[face[0],face[2],face[3]]);
  }
  if(used.size!==entity.vertices.length)throw new Error('MESH vertices must belong to a face.');
  if(entity.primitive!==undefined&&!['BOX','CYLINDER','SPHERE','EXTRUDE'].includes(entity.primitive))throw new Error('Unsupported MESH primitive label.');return entity;
}
function validatePolyline3D(points,closed){
  if(!Array.isArray(points)||points.length<(closed?3:2)||points.length>MAX_MESH_VERTICES)throw new Error('3DPOLY requires 2..100000 points, or at least 3 when closed.');
  if(typeof closed!=='boolean')throw new Error('3DPOLY closed flag must be boolean.');points.forEach(point3);
  for(let i=1;i<points.length;i++)if(samePoint3(points[i-1],points[i]))throw new Error('Adjacent 3DPOLY vertices must differ.');
  if(closed&&samePoint3(points[0],points.at(-1)))throw new Error('Closed 3DPOLY stores distinct terminal vertices.');
}
function meshResult(vertices,faces,primitive){return validateMesh({type:'MESH',vertices:vertices.map(point3),faces,primitive});}
function signedHeight(value){if(!finite(value)||value===0)throw new Error('Height must be nonzero and finite.');return value;}
function validateBoxBase(a,b){
  if(a.z!==b.z)throw new Error('BOX opposite corner must lie in the first corner XY plane.');if(a.x===b.x||a.y===b.y)throw new Error('BOX needs nonzero length and width.');
  validateRectangle([{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y},{x:a.x,y:b.y}]);
}
function validateCylinderRadius(center,radius){
  positive(radius,'Cylinder radius');const ring=Array.from({length:32},(_,i)=>{const[x,y]=angleBasis(i*360/32);return point3({x:center.x+radius*x,y:center.y+radius*y,z:center.z});});
  for(let i=0;i<ring.length;i++)faceNormal([center,ring[i],ring[(i+1)%ring.length]],[0,1,2]);return radius;
}
export function makeBoxMesh(rawFirst,rawOpposite,height){
  const a=point3(rawFirst),b=point3(rawOpposite);signedHeight(height);validateBoxBase(a,b);
  const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y),vertices=[];
  for(const z of [a.z,a.z+height])vertices.push({x:x0,y:y0,z},{x:x1,y:y0,z},{x:x1,y:y1,z},{x:x0,y:y1,z});
  const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];if(height<0)faces.forEach(face=>face.reverse());return meshResult(vertices,faces,'BOX');
}
export function makeCylinderMesh(rawCenter,radius,height,segmentsCount=32){
  const c=point3(rawCenter);positive(radius,'Cylinder radius');signedHeight(height);if(!Number.isInteger(segmentsCount)||segmentsCount<3||segmentsCount>128)throw new Error('Cylinder segments must be an integer from 3 through 128.');
  const vertices=[],faces=[];for(const z of [c.z,c.z+height])for(let j=0;j<segmentsCount;j++){const[x,y]=angleBasis(j*360/segmentsCount);vertices.push({x:c.x+radius*x,y:c.y+radius*y,z});}
  const bottom=vertices.length;vertices.push({...c},{...c,z:c.z+height});
  for(let j=0;j<segmentsCount;j++){const next=(j+1)%segmentsCount;faces.push([j,next,next+segmentsCount,j+segmentsCount],[bottom,next,j],[bottom+1,j+segmentsCount,next+segmentsCount]);}
  if(height<0)faces.forEach(face=>face.reverse());return meshResult(vertices,faces,'CYLINDER');
}
export function makeSphereMesh(rawCenter,radius,latitudeSegments=16,longitudeSegments=32){
  const c=point3(rawCenter);positive(radius,'Sphere radius');if(!Number.isInteger(latitudeSegments)||latitudeSegments<3||latitudeSegments>64||!Number.isInteger(longitudeSegments)||longitudeSegments<3||longitudeSegments>128)throw new Error('Sphere subdivisions are bounded integers: latitude 3..64, longitude 3..128.');
  const vertices=[{...c,z:c.z+radius}],faces=[];
  for(let i=1;i<latitudeSegments;i++){const polar=i*Math.PI/latitudeSegments;for(let j=0;j<longitudeSegments;j++){const[x,y]=angleBasis(j*360/longitudeSegments);vertices.push({x:c.x+radius*Math.sin(polar)*x,y:c.y+radius*Math.sin(polar)*y,z:c.z+radius*Math.cos(polar)});}}
  const south=vertices.length;vertices.push({...c,z:c.z-radius});const ring=(i,j)=>1+(i-1)*longitudeSegments+(j+longitudeSegments)%longitudeSegments;
  for(let j=0;j<longitudeSegments;j++){faces.push([0,ring(1,j),ring(1,j+1)]);for(let i=1;i<latitudeSegments-1;i++)faces.push([ring(i,j),ring(i+1,j),ring(i+1,j+1),ring(i,j+1)]);faces.push([south,ring(latitudeSegments-1,j+1),ring(latitudeSegments-1,j)]);}
  return meshResult(vertices,faces,'SPHERE');
}
/** Normalize locally, reject self intersections, and ear-clip a simple concave XY polygon. */
export function triangulatePolygon(rawPoints){
  if(!Array.isArray(rawPoints)||rawPoints.length<3||rawPoints.length>MAX_EXTRUSION_VERTICES)throw new Error('EXTRUDE profiles require 3..4096 vertices.');
  const original=rawPoints.map(point),origin=original[0],scale=Math.max(...original.flatMap(p=>[Math.abs(p.x-origin.x),Math.abs(p.y-origin.y)]));
  if(!finite(scale)||scale===0)throw new Error('EXTRUDE profile span is degenerate or exceeds the numeric range.');
  let vertices=original.map((p,index)=>({x:(p.x-origin.x)/scale,y:(p.y-origin.y)/scale,index}));const tolerance=Number.EPSILON*64;
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),on=(a,b,p)=>Math.abs(cross(a,b,p))<=tolerance&&p.x>=Math.min(a.x,b.x)-tolerance&&p.x<=Math.max(a.x,b.x)+tolerance&&p.y>=Math.min(a.y,b.y)-tolerance&&p.y<=Math.max(a.y,b.y)+tolerance;
  for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++){if(j===i+1||i===0&&j===vertices.length-1)continue;const a=vertices[i],b=vertices[(i+1)%vertices.length],c=vertices[j],d=vertices[(j+1)%vertices.length],abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);if(on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||abC*abD<0&&cdA*cdB<0)throw new Error('EXTRUDE profile must be simple, without self-intersections or touching edges.');}
  let changed=true;while(changed&&vertices.length>3){changed=false;for(let i=0;i<vertices.length;i++)if(on(vertices[(i-1+vertices.length)%vertices.length],vertices[(i+1)%vertices.length],vertices[i])){vertices.splice(i,1);changed=true;break;}}
  let twiceArea=0;vertices.forEach((p,i)=>{const q=vertices[(i+1)%vertices.length];twiceArea+=p.x*q.y-q.x*p.y;});if(Math.abs(twiceArea)<=tolerance)throw new Error('EXTRUDE profile has zero or numerically unresolved area.');if(twiceArea<0)vertices.reverse();
  const remaining=vertices.map((_,i)=>i),triangles=[];
  while(remaining.length>3){let clipped=false;for(let i=0;i<remaining.length;i++){const ia=remaining[(i-1+remaining.length)%remaining.length],ib=remaining[i],ic=remaining[(i+1)%remaining.length],a=vertices[ia],b=vertices[ib],c=vertices[ic];if(cross(a,b,c)<=tolerance)continue;
    if(remaining.some(index=>![ia,ib,ic].includes(index)&&cross(a,b,vertices[index])>=-tolerance&&cross(b,c,vertices[index])>=-tolerance&&cross(c,a,vertices[index])>=-tolerance))continue;
    triangles.push([ia,ib,ic]);remaining.splice(i,1);clipped=true;break;}
    if(!clipped)throw new Error('EXTRUDE triangulation could not resolve this polygon.');
  }triangles.push([...remaining]);return{points:vertices.map(vertex=>({...original[vertex.index]})),triangles};
}
export function extrudeProfile(entity,height){
  signedHeight(height);if(!['RECTANG','PLINE'].includes(entity.type)||entity.type==='PLINE'&&!entity.closed)throw new Error('EXTRUDE requires a closed planar RECTANG or PLINE.');
  const{points,triangles}=triangulatePolygon(entity.points),n=points.length,vertices=[...points.map(p=>({...p,z:0})),...points.map(p=>({...p,z:height}))],faces=[];
  for(const t of triangles)faces.push([...t].reverse(),t.map(index=>index+n));
  for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);if(height<0)faces.forEach(face=>face.reverse());
  return{...meshResult(vertices,faces,'EXTRUDE'),layer:entity.layer,...(entity.color?{color:entity.color}:{}),...(entity.lineweight!==undefined?{lineweight:entity.lineweight}:{})};
}
export function entityEdges(entity,document={}){
  if(entity.type==='MESH'){const seen=new Set(),edges=[];for(const face of entity.faces)face.forEach((index,i)=>{const next=face[(i+1)%face.length],key=index<next?`${index}:${next}`:`${next}:${index}`;if(!seen.has(key)){seen.add(key);edges.push([entity.vertices[index],entity.vertices[next]]);}});return edges;}
  if(entity.type==='POLY3D')return entity.points.slice(0,entity.closed?undefined:-1).map((p,i)=>[p,entity.points[(i+1)%entity.points.length]]);
  return segments(entity,document);
}
export function bounds3D(entities,document={}){
  let result=null;for(const entity of entities)for(const p of entityPoints(entity,document)){const z=p.z??0;if(!result)result={minX:p.x,maxX:p.x,minY:p.y,maxY:p.y,minZ:z,maxZ:z};else{result.minX=Math.min(result.minX,p.x);result.maxX=Math.max(result.maxX,p.x);result.minY=Math.min(result.minY,p.y);result.maxY=Math.max(result.maxY,p.y);result.minZ=Math.min(result.minZ,z);result.maxZ=Math.max(result.maxZ,z);}}return result;
}
export function rotateEntity3D(entity,rawBase,axis,degrees){
  if(!TYPES3D.has(entity.type))throw new Error('ROTATE3D supports MESH and POLY3D only.');const base=point3(rawBase);if(!['X','Y','Z'].includes(axis)||!finite(degrees))throw new Error('ROTATE3D requires world axis X/Y/Z and a finite angle.');
  const[c,s]=angleBasis(degrees),mapping=p=>{const x=p.x-base.x,y=p.y-base.y,z=p.z-base.z;return axis==='X'?{x:p.x,y:base.y+y*c-z*s,z:base.z+y*s+z*c}:axis==='Y'?{x:base.x+x*c+z*s,y:p.y,z:base.z-x*s+z*c}:{x:base.x+x*c-y*s,y:base.y+x*s+y*c,z:p.z};};return mapEntity(entity,mapping);
}

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

export function entityPoints(entity,document={}) {
  if(entity.type==='ELLIPSE')return ellipseBoundsPoints(entity);
  if(entity.type==='SPLINE')return splineBoundsPoints(entity);
  if(entity.type==='HATCH')return entityPoints(entity.boundary,document);
  if(entity.type==='INSERT')return visibleInsertEntities(entity,document).flatMap(child=>entityPoints(child,document));
  if(entity.type==='MESH')return entity.vertices;
  if(entity.type==='POLY3D')return entity.points;
  if(TEXT_TYPES.has(entity.type)||entity.type==='DIMENSION')return annotationPrimitives(entity,document).boundsPoints;
  if (entity.type === 'ARC') {
    const extrema = [arcPoint(entity, 0), arcPoint(entity, 1)];
    for (const angle of [0,90,180,270]) if (angleOnArc(entity,angle)) { const [x,y]=angleBasis(angle); extrema.push({x:entity.center.x+entity.radius*x,y:entity.center.y+entity.radius*y}); }
    return extrema;
  }
  if (entity.type === 'CIRCLE') {
    const { center: c, radius: r } = entity;
    return [{ x: c.x + r, y: c.y }, { x: c.x, y: c.y + r }, { x: c.x - r, y: c.y }, { x: c.x, y: c.y - r }];
  }
  return entity.type === 'LINE' ? [entity.start, entity.end] : ['RECTANG', 'PLINE'].includes(entity.type) ? entity.points : [];
}

export function entityGripPoints(entity,document={}) {
  if(entity.type==='ELLIPSE')return[entity.center,ellipsePoint(entity,0),ellipsePoint(entity,.25)];
  if(entity.type==='SPLINE')return entity.controlPoints;
  if(entity.type==='HATCH')return entityGripPoints(entity.boundary,document);
  if(entity.type==='INSERT')return[entity.position];
  if(TEXT_TYPES.has(entity.type))return entity.type==='MTEXT'?[entity.position,textWorld(entity,entity.width,0)]:[entity.position];
  if(entity.type==='DIMENSION')return entity.kind==='angular'?[entity.vertex,entity.p1,entity.p2,entity.placement]:['linear','aligned'].includes(entity.kind)?[entity.p1,entity.p2,entity.placement]:[entity.center,entity.placement];
  return entity.type === 'ARC' ? [arcPoint(entity,0),arcPoint(entity,0.5),arcPoint(entity,1),{...entity.center}] : entity.type === 'CIRCLE' ? [{ ...entity.center }, ...entityPoints(entity,document)] : entityPoints(entity,document);
}

function validateCircle(center, radius) {
  point(center);
  if (!finite(radius) || radius <= 0) throw new Error('CIRCLE radius must be positive and finite.');
  for (const value of [center.x + radius, center.x - radius, center.y + radius, center.y - radius]) if (!finite(value)) throw new Error('CIRCLE extents must be finite.');
}

const positiveAngle = angle => {const value=angle%360;return value<0?value+360:value;};
function validateArc(entity) {
  validateCircle(entity.center,entity.radius);
  if (!finite(entity.startAngle) || !finite(entity.sweepAngle) || entity.sweepAngle === 0 || Math.abs(entity.sweepAngle) >= 360) throw new Error('ARC needs a finite start angle and a nonzero sweep smaller than 360 degrees.');
}

export function arcPoint(entity, fraction) {
  const [cosine,sine]=angleBasis(entity.startAngle%360+entity.sweepAngle*fraction);
  return {x:entity.center.x+entity.radius*cosine,y:entity.center.y+entity.radius*sine};
}

function angleOnArc(entity, angle) {
  const start=entity.startAngle%360;
  const difference=entity.sweepAngle>0?positiveAngle(angle%360-start):positiveAngle(start-angle%360);
  return difference<=Math.abs(entity.sweepAngle)+1e-11;
}

/** Original circumcircle calculation anchored at the first point to limit origin cancellation. */
export function arcThroughPoints(rawFirst,rawMiddle,rawLast) {
  const a=point(rawFirst),b=point(rawMiddle),c=point(rawLast);
  if(samePoint(a,b)||samePoint(a,c)||samePoint(b,c))throw new Error('ARC requires three distinct points.');
  const scale=Math.max(Math.hypot(b.x-a.x,b.y-a.y),Math.hypot(c.x-a.x,c.y-a.y));
  if(!finite(scale)||!scale)throw new Error('ARC point span exceeds the supported numeric range.');
  const bx=(b.x-a.x)/scale,by=(b.y-a.y)/scale,cx=(c.x-a.x)/scale,cy=(c.y-a.y)/scale;
  const determinant=bx*cy-by*cx;
  if(Math.abs(determinant)<=Number.EPSILON*16)throw new Error('ARC points are collinear or numerically indistinguishable from collinear.');
  const bSquared=bx*bx+by*by,cSquared=cx*cx+cy*cy;
  const center=point({x:a.x+scale*(bSquared*cy-cSquared*by)/(2*determinant),y:a.y+scale*(bx*cSquared-cx*bSquared)/(2*determinant)});
  const radius=Math.hypot(a.x-center.x,a.y-center.y),startAngle=Math.atan2(a.y-center.y,a.x-center.x)*180/Math.PI,endAngle=Math.atan2(c.y-center.y,c.x-center.x)*180/Math.PI;
  const sweepAngle=determinant>0?positiveAngle(endAngle-startAngle):-positiveAngle(startAngle-endAngle);
  const entity={type:'ARC',center,radius,startAngle,sweepAngle}; validateArc(entity); return entity;
}

function validatePolyline(points, closed) {
  if (!Array.isArray(points) || points.length < (closed ? 3 : 2)) throw new Error('PLINE requires two points, or three points when closed.');
  points.forEach(point);
  for (let index = 1; index < points.length; index++) if (samePoint(points[index - 1], points[index])) throw new Error('Adjacent PLINE vertices must differ.');
  if (closed && samePoint(points[0], points.at(-1))) throw new Error('Closed PLINE stores distinct end vertices.');
}

function mapEntity(entity, mapping, radiusFactor = 1,rawDocument={}) {
  const transformed = clone(entity);
  if(entity.type==='ELLIPSE'){
    transformed.center=point(mapping(entity.center));transformed.major=point({x:entity.major.x*radiusFactor,y:entity.major.y*radiusFactor});validateEllipse(transformed);
  }else if(entity.type==='SPLINE'){
    transformed.controlPoints=entity.controlPoints.map(p=>point(mapping(p)));validateSpline(transformed);splineBoundsPoints(transformed).forEach(point);
  }else if(entity.type==='HATCH'){
    transformed.boundary=mapEntity(entity.boundary,mapping,radiusFactor,rawDocument);transformed.origin=point(mapping(entity.origin));transformed.spacing*=radiusFactor;validateHatch(transformed);
  }else if(entity.type==='INSERT'){
    transformed.position=point(mapping(entity.position));transformed.scale*=radiusFactor;validateInsert(transformed,rawDocument);
  }else if(entity.type==='MESH'){
    transformed.vertices=entity.vertices.map(p=>point3(mapping(p)));validateMesh(transformed);
  }else if(entity.type==='POLY3D'){
    transformed.points=entity.points.map(p=>point3(mapping(p)));validatePolyline3D(transformed.points,transformed.closed);
  }else if(TEXT_TYPES.has(entity.type)){
    transformed.position=point(mapping(entity.position));transformed.height*=radiusFactor;if(entity.type==='MTEXT')transformed.width*=radiusFactor;
    validateText(transformed,styleContext(rawDocument));
  }else if(entity.type==='DIMENSION'){
    transformed.placement=point(mapping(entity.placement));transformed.scale*=radiusFactor;
    if(['linear','aligned','angular'].includes(entity.kind)){transformed.p1=point(mapping(entity.p1));transformed.p2=point(mapping(entity.p2));if(entity.kind==='angular')transformed.vertex=point(mapping(entity.vertex));}
    else{transformed.center=point(mapping(entity.center));transformed.radius*=radiusFactor;}
    validateDimension(transformed,styleContext(rawDocument));
  }else if (entity.type === 'LINE') {
    transformed.start = point(mapping(entity.start)); transformed.end = point(mapping(entity.end));
    if (samePoint(transformed.start, transformed.end)) throw new Error('Transformation collapses LINE endpoints.');
  } else if (['RECTANG', 'PLINE'].includes(entity.type)) {
    transformed.points = entity.points.map(p => point(mapping(p)));
    if (entity.type === 'RECTANG') validateRectangle(transformed.points); else validatePolyline(transformed.points, transformed.closed);
  } else if (['CIRCLE','ARC'].includes(entity.type)) {
    transformed.center = point(mapping(entity.center)); transformed.radius *= radiusFactor; validateCircle(transformed.center, transformed.radius);
  } else throw new Error('Unsupported entity type.');
  return transformed;
}

export function translateEntity(entity, rawDelta,document={}) {
  const is3D=TYPES3D.has(entity.type),delta = is3D?point3(rawDelta):point(rawDelta);
  return mapEntity(entity, p => ({ x: p.x + delta.x, y: p.y + delta.y,...(is3D?{z:p.z+delta.z}:{}) }),1,document);
}

export function rotateEntity(entity, rawBase, degrees,document={}) {
  if(TYPES3D.has(entity.type))return rotateEntity3D(entity,rawBase,'Z',degrees);
  const base = point(rawBase), [cosine, sine] = angleBasis(degrees);
  const rotated = p => {
    const x = p.x - base.x, y = p.y - base.y;
    return point({ x: base.x + (x * cosine - y * sine), y: base.y + (x * sine + y * cosine) });
  };
  const source=clone(entity);
  const rotateMetadata=shape=>{if(shape.type==='ELLIPSE')shape.major=point({x:shape.major.x*cosine-shape.major.y*sine,y:shape.major.x*sine+shape.major.y*cosine});if(shape.type==='HATCH'){shape.angle=(shape.angle+degrees)%180;rotateMetadata(shape.boundary);}if(shape.type==='INSERT')shape.rotation=(shape.rotation+degrees)%360;};rotateMetadata(source);
  if(TEXT_TYPES.has(entity.type))source.rotation=(entity.rotation%360+degrees%360)%360;
  if(entity.type==='DIMENSION'&&entity.kind==='linear')source.axisAngle=(entity.axisAngle%360+degrees%360)%360;
  const transformed=mapEntity(source, rotated,1,document);
  if(entity.type==='ARC')transformed.startAngle=(entity.startAngle%360+degrees%360)%360;
  return transformed;
}

export function scaleEntity(entity, rawBase, factor,document={}) {
  const is3D=TYPES3D.has(entity.type),base = is3D?point3(rawBase):point(rawBase);
  if (!finite(factor) || factor <= 0) throw new Error('Scale factor must be positive and finite.');
  return mapEntity(entity, p => ({ x: base.x + (p.x - base.x) * factor, y: base.y + (p.y - base.y) * factor,...(is3D?{z:base.z+(p.z-base.z)*factor}:{}) }), factor,document);
}

export function mirrorEntity(entity, rawFirst, rawSecond,document={}) {
  if(TYPES3D.has(entity.type))throw new Error('MIRROR supports planar 2D entities; use ROTATE3D or 3D MOVE for meshes and paths.');
  const a = point(rawFirst), b = point(rawSecond), length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!finite(length) || length === 0) throw new Error('Mirror axis needs two distinct finite points.');
  const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
  const cosine=ux*ux-uy*uy,sine=2*ux*uy;
  const source=clone(entity),reflectAngle=angle=>{const[x,y]=angleBasis(angle);return Math.atan2(x*sine-y*cosine,x*cosine+y*sine)*180/Math.PI;};
  if(entity.type==='INSERT')throw new Error('MIRROR of INSERT requires a reflected block scale and is outside the supported positive-scale block workflow.');
  const reflectMetadata=shape=>{if(shape.type==='ELLIPSE')shape.major=point({x:shape.major.x*cosine+shape.major.y*sine,y:shape.major.x*sine-shape.major.y*cosine});if(shape.type==='HATCH'){shape.angle=reflectAngle(shape.angle);reflectMetadata(shape.boundary);}};reflectMetadata(source);
  if(TEXT_TYPES.has(entity.type))source.rotation=reflectAngle(entity.rotation);
  if(entity.type==='DIMENSION'&&entity.kind==='linear')source.axisAngle=reflectAngle(entity.axisAngle);
  const reflectedPoint=p=>{
    const x = p.x - a.x, y = p.y - a.y;
    return point({ x: a.x + (x*cosine+y*sine), y: a.y + (x*sine-y*cosine) });
  };
  const transformed=mapEntity(source,reflectedPoint,1,document);
  if(TEXT_TYPES.has(entity.type)){
    const original=textLayout(entity,document),target=reflectedPoint({x:midpoint(original.corners[0].x,original.corners[2].x),y:midpoint(original.corners[0].y,original.corners[2].y)});
    transformed.rotation=readableAngle(transformed.rotation);const layout=textLayout(transformed,document),center={x:midpoint(layout.corners[0].x,layout.corners[2].x),y:midpoint(layout.corners[0].y,layout.corners[2].y)};
    transformed.position=point({x:transformed.position.x+(target.x-center.x),y:transformed.position.y+(target.y-center.y)});validateText(transformed,styleContext(document));
  }
  if(entity.type==='ARC') {
    const [x,y]=angleBasis(entity.startAngle),along=x*ux+y*uy;
    transformed.startAngle=Math.atan2(2*along*uy-y,2*along*ux-x)*180/Math.PI; transformed.sweepAngle=-entity.sweepAngle;
  }
  return transformed;
}

/** Offset supports individual lines, circles and oriented rectangles. */
export function offsetEntity(entity, distance, rawSide) {
  const side = point(rawSide);
  if (!finite(distance) || distance <= 0) throw new Error('Offset distance must be positive and finite.');
  const changedGeometry=changed=>{
    if(JSON.stringify(entity)===JSON.stringify(changed))throw new Error('Offset distance is smaller than the coordinate precision at this geometry.');
    return changed;
  };
  if (entity.type === 'LINE') {
    const dx = entity.end.x - entity.start.x, dy = entity.end.y - entity.start.y, length = Math.hypot(dx, dy);
    if (!finite(length) || !length) throw new Error('LINE has no usable direction.');
    const nx = -dy / length, ny = dx / length, signed = (side.x - entity.start.x) * nx + (side.y - entity.start.y) * ny;
    if (!finite(signed) || signed === 0) throw new Error('Pick a point to one side of the LINE.');
    return changedGeometry(translateEntity(entity, { x: nx * distance * Math.sign(signed), y: ny * distance * Math.sign(signed) }));
  }
  if (entity.type === 'CIRCLE') {
    const separation = Math.hypot(side.x - entity.center.x, side.y - entity.center.y);
    if (!finite(separation) || separation === entity.radius) throw new Error('Pick inside or outside the CIRCLE.');
    const changed = clone(entity); changed.radius += separation < entity.radius ? -distance : distance;
    validateCircle(changed.center, changed.radius); return changedGeometry(changed);
  }
  if (entity.type === 'RECTANG') {
    const [a, b, , d] = entity.points, width = Math.hypot(b.x - a.x, b.y - a.y), height = Math.hypot(d.x - a.x, d.y - a.y);
    const ux = (b.x - a.x) / width, uy = (b.y - a.y) / width, vx = (d.x - a.x) / height, vy = (d.y - a.y) / height;
    const x = (side.x - a.x) * ux + (side.y - a.y) * uy, y = (side.x - a.x) * vx + (side.y - a.y) * vy;
    if(!finite(x)||!finite(y))throw new Error('Offset side point exceeds the supported numeric range.');
    if(((x===0||x===width)&&y>=0&&y<=height)||((y===0||y===height)&&x>=0&&x<=width))throw new Error('Pick inside or outside the RECTANG, away from its edge.');
    const inside = x > 0 && x < width && y > 0 && y < height, signed = inside ? distance : -distance;
    if (width - 2 * signed <= 0 || height - 2 * signed <= 0) throw new Error('Offset would collapse the RECTANG.');
    const origin = { x: a.x + signed * ux + signed * vx, y: a.y + signed * uy + signed * vy };
    const w = width - 2 * signed, h = height - 2 * signed;
    const changed = clone(entity);
    changed.points = [origin, { x: origin.x + w * ux, y: origin.y + w * uy }, { x: origin.x + w * ux + h * vx, y: origin.y + w * uy + h * vy }, { x: origin.x + h * vx, y: origin.y + h * vy }].map(point);
    validateRectangle(changed.points); return changedGeometry(changed);
  }
  throw new Error('OFFSET currently supports LINE, CIRCLE and RECTANG.');
}

/** Preview and commit share the same constrained grip geometry. */
export function previewGrip(entity, index, rawPoint,document={}) {
  const p = TYPES3D.has(entity.type)?point3(rawPoint):point(rawPoint), edited = clone(entity);
  if(entity.type==='ELLIPSE'){
    if(index===0)edited.center=p;else if(index===1)edited.major=point({x:p.x-entity.center.x,y:p.y-entity.center.y});else if(index===2){const length=Math.hypot(entity.major.x,entity.major.y),minor=Math.abs((p.x-entity.center.x)*(-entity.major.y/length)+(p.y-entity.center.y)*(entity.major.x/length));edited.ratio=minor/length;}else throw new Error('ELLIPSE grip index is invalid.');validateEllipse(edited);
  }else if(entity.type==='SPLINE'){
    if(!Number.isInteger(index)||index<0||index>=edited.controlPoints.length)throw new Error('SPLINE control grip index is invalid.');edited.controlPoints[index]=p;validateSpline(edited);splineBoundsPoints(edited).forEach(point);
  }else if(entity.type==='HATCH'){edited.boundary=previewGrip(entity.boundary,index,p,document);validateHatch(edited);}
  else if(entity.type==='INSERT'){if(index!==0)throw new Error('INSERT has one insertion grip.');edited.position=p;validateInsert(edited,document);}
  else if(TYPES3D.has(entity.type)){
    const key=entity.type==='MESH'?'vertices':'points';if(!Number.isInteger(index)||index<0||index>=edited[key].length)throw new Error('3D grip index is invalid.');edited[key][index]=p;
    if(entity.type==='MESH'){delete edited.primitive;validateMesh(edited);}else validatePolyline3D(edited.points,edited.closed);
  }else if(TEXT_TYPES.has(entity.type)){
    if(index===0)edited.position=p;
    else if(entity.type==='MTEXT'&&index===1){const[c,s]=angleBasis(entity.rotation);edited.width=(p.x-entity.position.x)*c+(p.y-entity.position.y)*s;}
    else throw new Error('Text grip index is invalid.');
    validateText(edited,styleContext(document));
  }else if(entity.type==='DIMENSION'){
    const keys=entity.kind==='angular'?['vertex','p1','p2','placement']:['linear','aligned'].includes(entity.kind)?['p1','p2','placement']:['center','placement'];
    if(!keys[index])throw new Error('Dimension grip index is invalid.');edited[keys[index]]=p;validateDimension(edited,styleContext(document));
  }else if (entity.type === 'LINE') {
    if (![0, 1].includes(index)) throw new Error('LINE grip index must be 0 or 1.');
    if (samePoint(p, index === 0 ? entity.end : entity.start)) throw new Error('LINE endpoints must differ.');
    edited[index === 0 ? 'start' : 'end'] = p;
  } else if (entity.type === 'CIRCLE') {
    if (![0, 1, 2, 3, 4].includes(index)) throw new Error('CIRCLE grip index must be 0 through 4.');
    if (index === 0) edited.center = p;
    else edited.radius = Math.hypot(p.x - entity.center.x, p.y - entity.center.y);
    validateCircle(edited.center, edited.radius);
  } else if (entity.type === 'ARC') {
    if(![0,1,2,3].includes(index))throw new Error('ARC grip index must be 0 through 3.');
    if(index===3)edited.center=p;
    else {
      const grips=entityGripPoints(entity);grips[index]=p;Object.assign(edited,arcThroughPoints(grips[0],grips[1],grips[2]));
    }
    validateArc(edited);
  } else if (entity.type === 'PLINE') {
    if (!Number.isInteger(index) || index < 0 || index >= entity.points.length) throw new Error('PLINE grip index is invalid.');
    edited.points[index] = p; validatePolyline(edited.points, edited.closed);
  } else if (entity.type === 'RECTANG') {
    if (![0, 1, 2, 3].includes(index)) throw new Error('RECTANG grip index must be 0 through 3.');
    const current = entity.points[index], opposite = entity.points[(index + 2) % 4];
    const next = (index + 1) % 4, previous = (index + 3) % 4;
    const edgeU = { x: entity.points[next].x - current.x, y: entity.points[next].y - current.y };
    const edgeV = { x: entity.points[previous].x - current.x, y: entity.points[previous].y - current.y };
    const lenU = Math.hypot(edgeU.x, edgeU.y), lenV = Math.hypot(edgeV.x, edgeV.y);
    const ux = edgeU.x / lenU, uy = edgeU.y / lenU, vx = edgeV.x / lenV, vy = edgeV.y / lenV;
    const delta = { x: p.x - opposite.x, y: p.y - opposite.y };
    const alongU = delta.x * ux + delta.y * uy, alongV = delta.x * vx + delta.y * vy;
    if (!finite(alongU) || !finite(alongV) || alongU === 0 || alongV === 0) throw new Error('RECTANG needs nonzero width and height.');
    edited.points[index] = p;
    edited.points[next] = point({ x: opposite.x + alongV * vx, y: opposite.y + alongV * vy });
    edited.points[previous] = point({ x: opposite.x + alongU * ux, y: opposite.y + alongU * uy });
    validateRectangle(edited.points);
  } else throw new Error('Unsupported entity type.');
  return edited;
}

function segments(entity,document={}) {
  if(['ELLIPSE','SPLINE'].includes(entity.type)){const points=sampleCurve(entity,128);return points.slice(0,-1).map((p,i)=>[p,points[i+1]]);}
  if(entity.type==='HATCH')return hatchGeometry(entity).segments;
  if(entity.type==='INSERT')return visibleInsertEntities(entity,document).flatMap(child=>segments(child,document));
  if(TYPES3D.has(entity.type))return entityEdges(entity,document);
  if(TEXT_TYPES.has(entity.type)||entity.type==='DIMENSION'){const picture=annotationPrimitives(entity,document);return[...picture.segments,...picture.arrows.flatMap(triangle=>triangle.map((p,index)=>[p,triangle[(index+1)%3]]))];}
  if (entity.type === 'LINE') return [[entity.start, entity.end]];
  if (entity.type === 'RECTANG') return entity.points.map((p, index) => [p, entity.points[(index + 1) % 4]]);
  if (entity.type === 'PLINE') return entity.points.slice(0, entity.closed ? undefined : -1).map((p, index) => [p, entity.points[(index + 1) % entity.points.length]]);
  return [];
}

export function expandedInsertEntities(entity,document={}){
  if(entity.type!=='INSERT')return[clone(entity)];const block=document.blocks?.find(block=>block.name===entity.blockName);if(!block)throw new Error(`Block definition ${entity.blockName} does not exist.`);
  return block.entities.map((child,index)=>{
    let expanded=translateEntity(rotateEntity(scaleEntity(child,{x:0,y:0},entity.scale,document),{x:0,y:0},entity.rotation,document),entity.position,document);
    expanded.id=`${entity.id??'insert'}/${index}`;if(child.layer==='0'){expanded.layer=entity.layer;if(child.color===undefined&&entity.color!==undefined)expanded.color=entity.color;if(child.lineweight===undefined&&entity.lineweight!==undefined)expanded.lineweight=entity.lineweight;}return expanded;
  });
}
export function expandedEntities(entities,document={}){return entities.flatMap(entity=>entity.type==='INSERT'?expandedInsertEntities(entity,document):[entity]);}
export function visibleInsertEntities(entity,document={}){return expandedInsertEntities(entity,document).filter(child=>document.layers?.find(layer=>layer.name===child.layer)?.visible!==false);}
export function entityDisplayPrimitives(entity,document={}){
  const empty={segments:[],paths:[],fills:[],texts:[]};
  if(entity.type==='INSERT'){const all=visibleInsertEntities(entity,document).map(child=>entityDisplayPrimitives(child,document));return Object.fromEntries(Object.keys(empty).map(key=>[key,all.flatMap(item=>item[key])]));}
  if(entity.type==='HATCH')return hatchGeometry(entity);
  if(['ELLIPSE','SPLINE'].includes(entity.type))return{...empty,paths:[{points:sampleCurve(entity,128),closed:entity.type==='ELLIPSE'}],...(entity.type==='SPLINE'?{beziers:splineBezierSegments(entity)}:{})};
  if(TEXT_TYPES.has(entity.type))return{...empty,texts:textLayout(entity,document).lines};
  if(entity.type==='DIMENSION'){const p=annotationPrimitives(entity,document);return{...empty,segments:p.segments,texts:p.texts,fills:p.arrows.map(points=>({points,closed:true}))};}
  if(entity.type==='MESH')return{...empty,segments:entityEdges(entity,document),fills:entity.faces.map(face=>({points:face.map(index=>entity.vertices[index]),closed:true}))};
  if(['PLINE','RECTANG','POLY3D'].includes(entity.type))return{...empty,paths:[{points:entity.points,closed:entity.type==='RECTANG'||entity.closed}]};
  if(entity.type==='CIRCLE'){const points=boundaryPolygon(entity,128);return{...empty,paths:[{points,closed:true}]};}
  if(entity.type==='ARC')return{...empty,paths:[{points:Array.from({length:65},(_,i)=>arcPoint(entity,i/64)),closed:false}]};
  if(entity.type==='LINE')return{...empty,segments:[[entity.start,entity.end]]};throw new Error(`No display geometry for ${entity.type}.`);
}

export function bounds(entities,document={}) {
  const points = entities.flatMap(entity=>entityPoints(entity,document));
  if (!points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
}

export function zoomExtents(entities, viewport, width, height, padding = 40,document={}) {
  const box = bounds(entities,document);
  if (!box) return { center: { x: 0, y: 0 }, scale: 10 };
  const drawingWidth = box.maxX - box.minX, drawingHeight = box.maxY - box.minY;
  const fits = [];
  if (drawingWidth > 0) fits.push(Math.max(1, width - padding * 2) / drawingWidth);
  if (drawingHeight > 0) fits.push(Math.max(1, height - padding * 2) / drawingHeight);
  const intendedScale = fits.length ? Math.min(...fits) : 10;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, intendedScale));
  return { center: { x: midpoint(box.minX, box.maxX), y: midpoint(box.minY, box.maxY) }, scale };
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!length) return Math.hypot(p.x - a.x, p.y - a.y);
  const ux = dx / length, uy = dy / length;
  const projection = Math.max(0, Math.min(length, (p.x - a.x) * ux + (p.y - a.y) * uy));
  return Math.hypot(p.x - a.x - projection * ux, p.y - a.y - projection * uy);
}

function lineBasis(line) {
  if (line?.type !== 'LINE') throw new Error('This operation requires a LINE target.');
  const dx = line.end.x - line.start.x, dy = line.end.y - line.start.y, length = Math.hypot(dx, dy);
  if (!finite(length) || length === 0) throw new Error('LINE needs a finite, nonzero length.');
  return { length, ux: dx / length, uy: dy / length };
}

function lineParameter(line, raw) {
  const p = point(raw), { length, ux, uy } = lineBasis(line);
  const value = ((p.x - line.start.x) * ux + (p.y - line.start.y) * uy) / length;
  if (!finite(value)) throw new Error('Point projection exceeds the supported numeric range.');
  return value;
}

function pointOnLine(line, t) {
  return point({ x: line.start.x + (line.end.x - line.start.x) * t, y: line.start.y + (line.end.y - line.start.y) * t });
}

/** Parameters on an infinite LINE intersecting finite boundary segments or circles. */
export function lineIntersections(line, boundaries) {
  const { length, ux, uy } = lineBasis(line), values = [];
  for (const boundary of boundaries) {
    if (boundary.id != null && boundary.id === line.id) continue;
    if (['CIRCLE','ARC'].includes(boundary.type)) {
      const x = boundary.center.x - line.start.x, y = boundary.center.y - line.start.y;
      const along = x * ux + y * uy, perpendicular = Math.abs(x * uy - y * ux), radius = boundary.radius;
      if (!finite(along) || !finite(perpendicular)) throw new Error('Intersection exceeds the supported numeric range.');
      const radialTolerance=Math.max(Number.MIN_VALUE,Number.EPSILON*16*Math.max(perpendicular,radius));
      if (perpendicular-radius > radialTolerance) continue;
      const radialDistance=Math.abs(perpendicular-radius)<=radialTolerance?radius:perpendicular;
      const halfChord = radius * Math.sqrt(Math.max(0, 1 - (radialDistance / radius) ** 2));
      for(const distance of [along-halfChord,along+halfChord]) {
        const t=distance/length,p=pointOnLine(line,t);
        if(boundary.type==='CIRCLE'||angleOnArc(boundary,Math.atan2(p.y-boundary.center.y,p.x-boundary.center.x)*180/Math.PI))values.push(t);
      }
    } else {
      for (const [a, b] of segments(boundary)) {
        const boundaryLength = Math.hypot(b.x - a.x, b.y - a.y);
        if (!finite(boundaryLength) || !boundaryLength) continue;
        const vx = (b.x - a.x) / boundaryLength, vy = (b.y - a.y) / boundaryLength, denominator = ux * vy - uy * vx;
        if (Math.abs(denominator) <= Number.EPSILON * 16) continue; // Collinear boundaries have no unique cut.
        const x = a.x - line.start.x, y = a.y - line.start.y;
        const targetDistance = (x * vy - y * vx) / denominator, boundaryDistance = (x * uy - y * ux) / denominator;
        const s = boundaryDistance / boundaryLength;
        const tolerance=Number.EPSILON*16*Math.max(1,Math.abs(s));
        if (s >= -tolerance && s <= 1 + tolerance) values.push(targetDistance / length);
      }
    }
  }
  if (values.some(value => !finite(value))) throw new Error('Intersection exceeds the supported numeric range.');
  values.sort((a, b) => a - b);
  return values.filter((value,index)=>!index||Math.abs(value-values[index-1])>Number.EPSILON*8*Math.max(Number.MIN_VALUE,Math.abs(value),Math.abs(values[index-1])));
}

function fragmentsOutside(line, low, high) {
  const fragments = [];
  if (low > 0) fragments.push({ ...clone(line), end: pointOnLine(line, low) });
  if (high < 1) fragments.push({ ...clone(line), start: pointOnLine(line, high) });
  return fragments;
}

/** Remove the picked interval between cutting edges; a middle cut can produce two LINEs. */
export function trimLine(line, boundaries, rawPick) {
  const projected = lineParameter(line, rawPick), q = Math.max(0, Math.min(1, projected)), cuts = lineIntersections(line, boundaries).filter(t => t > 0 && t < 1 && !samePoint(pointOnLine(line,t),line.start) && !samePoint(pointOnLine(line,t),line.end));
  if (!cuts.length) throw new Error('No cutting edge intersects the interior of that LINE.');
  if (projected < -1e-12 || projected > 1 + 1e-12) throw new Error('Pick a point on the LINE segment to remove.');
  if (cuts.some(t => samePoint(pointOnLine(line,q),pointOnLine(line,t)))) throw new Error('Pick a segment away from the cutting edge.');
  const partitions = [0, ...cuts, 1];
  const interval = partitions.findIndex((t, index) => index < partitions.length - 1 && q >= t && q <= partitions[index + 1]);
  return fragmentsOutside(line, partitions[interval], partitions[interval + 1]);
}

export function extendLine(line, boundaries, rawPick) {
  const q = lineParameter(line, rawPick), intersections = lineIntersections(line, boundaries), changed = clone(line);
  if (q <= 0.5) {
    const candidates = intersections.filter(t => t < 0 && !samePoint(pointOnLine(line,t),line.start));
    if (!candidates.length) throw new Error('No boundary intersects beyond the start of that LINE.');
    changed.start = pointOnLine(line, Math.max(...candidates));
  } else {
    const candidates = intersections.filter(t => t > 1 && !samePoint(pointOnLine(line,t),line.end));
    if (!candidates.length) throw new Error('No boundary intersects beyond the end of that LINE.');
    changed.end = pointOnLine(line, Math.min(...candidates));
  }
  return changed;
}

export function breakLine(line, rawFirst, rawSecond) {
  const first = lineParameter(line, rawFirst), second = lineParameter(line, rawSecond);
  if ([first, second].some(t => t < -1e-12 || t > 1 + 1e-12)) throw new Error('BREAK points must project onto the LINE segment.');
  const low = Math.max(0, Math.min(first, second)), high = Math.min(1, Math.max(first, second));
  return fragmentsOutside(line, low, high);
}

function entityAttributes(entity) {
  const {start,end,points,closed,center,radius,startAngle,sweepAngle,...attributes}=clone(entity);return attributes;
}

/** JOIN requires exact shared endpoints and rejects disconnected or branching selections atomically. */
export function joinEntities(entities) {
  if(!entities.length)throw new Error('Select connected LINE or open PLINE objects to JOIN.');
  const paths=entities.map(entity=>{
    if(entity.type==='LINE'){lineBasis(entity);return [clone(entity.start),clone(entity.end)];}
    if(entity.type==='PLINE'&&!entity.closed)return clone(entity.points);
    throw new Error('JOIN currently accepts LINE and open straight PLINE objects.');
  });
  const key=p=>JSON.stringify([p.x,p.y]),connections=new Map();
  paths.forEach((path,index)=>{
    for(const endpoint of [path[0],path.at(-1)]){
      const token=key(endpoint),connected=connections.get(token)??[];connected.push(index);connections.set(token,connected);
      if(connected.length>2)throw new Error('JOIN selection has branching paths.');
    }
  });
  const first=paths[0],used=new Set([0]),right=[],left=[];
  const extend=(initial,forward,pieces)=>{
    let endpoint=initial;
    while(true){
      const index=(connections.get(key(endpoint))??[]).find(candidate=>!used.has(candidate));
      if(index==null)break;
      used.add(index);const path=paths[index];
      const oriented=(forward?samePoint(path[0],endpoint):samePoint(path.at(-1),endpoint))?path:[...path].reverse();
      pieces.push(forward?oriented.slice(1):oriented.slice(0,-1));endpoint=forward?oriented.at(-1):oriented[0];
    }
  };
  extend(first.at(-1),true,right);extend(first[0],false,left);
  if(used.size!==paths.length)throw new Error('JOIN objects must share exact endpoints in one connected path.');
  const vertices=[...left.reverse().flat(),...first,...right.flat()];
  const closed=samePoint(vertices[0],vertices.at(-1));if(closed)vertices.pop();
  validatePolyline(vertices,closed);
  return {...entityAttributes(entities[0]),type:'PLINE',points:vertices,closed};
}

export function explodeEntity(entity) {
  if(!['RECTANG','PLINE'].includes(entity.type))throw new Error('EXPLODE currently accepts RECTANG and straight PLINE objects.');
  return segments(entity).map(([start,end])=>({...entityAttributes(entity),type:'LINE',start:clone(start),end:clone(end)}));
}

export function hitTest(entities, p, tolerance,document={}) {
  let winner = null, best = tolerance;
  // Last-drawn entity wins ties, matching visual stacking.
  for (let index = entities.length - 1; index >= 0; index--) {
    const entity = entities[index];
    if(entity.type==='INSERT'&&hitTest(visibleInsertEntities(entity,document),p,tolerance,document)!==null&&winner===null){winner=entity.id;best=0;}
    if(entity.type==='HATCH'&&entity.pattern==='solid'&&boundaryContains(entity.boundary,p)&&winner===null){winner=entity.id;best=0;}
    if(TEXT_TYPES.has(entity.type)){
      const dx=p.x-entity.position.x,dy=p.y-entity.position.y,[c,s]=angleBasis(entity.rotation),x=dx*c+dy*s,y=-dx*s+dy*c,layout=textLayout(entity,document);
      const top=entity.type==='MTEXT'?0:entity.height,bottom=entity.type==='MTEXT'?-layout.height:-entity.height*.35;
      if(x>=-tolerance&&x<=layout.width+tolerance&&y>=bottom-tolerance&&y<=top+tolerance&&winner===null){winner=entity.id;best=0;}
    }
    if(entity.type==='DIMENSION'){
      const picture=annotationPrimitives(entity,document);
      const insideText=picture.texts.some(text=>{const dx=p.x-text.position.x,dy=p.y-text.position.y,[c,s]=angleBasis(text.rotation),x=dx*c+dy*s,y=-dx*s+dy*c;return x>=-text.width/2-tolerance&&x<=text.width/2+tolerance&&y>=-text.height*.35-tolerance&&y<=text.height+tolerance;});
      const insideArrow=picture.arrows.some(triangle=>{
        const[a,b,c]=triangle,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
        if(!finite(area)||area===0)return false;
        const signs=triangle.map((a,index)=>{const b=triangle[(index+1)%3];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});return signs.every(sign=>finite(sign)&&sign>=0)||signs.every(sign=>finite(sign)&&sign<=0);
      });
      if((insideText||insideArrow)&&winner===null){winner=entity.id;best=0;}
    }
    if(entity.type==='ARC'){
      const angle=Math.atan2(p.y-entity.center.y,p.x-entity.center.x)*180/Math.PI;
      const distance=angleOnArc(entity,angle)?Math.abs(Math.hypot(p.x-entity.center.x,p.y-entity.center.y)-entity.radius):Math.min(...[arcPoint(entity,0),arcPoint(entity,1)].map(endpoint=>Math.hypot(p.x-endpoint.x,p.y-endpoint.y)));
      if(distance<=best&&(winner===null||distance<best)){winner=entity.id;best=distance;}
    }
    if (entity.type === 'CIRCLE') {
      const distance = Math.abs(Math.hypot(p.x - entity.center.x, p.y - entity.center.y) - entity.radius);
      if (distance <= best && (winner === null || distance < best)) { winner = entity.id; best = distance; }
    }
    for (const [a, b] of segments(entity,document)) {
      const distance = distanceToSegment(p, a, b);
      if (distance <= best && (winner === null || distance < best)) { winner = entity.id; best = distance; }
    }
  }
  return winner;
}

function inBox(p, box) { return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY; }

function segmentCrossesBox(a, b, box) {
  // Slab clipping handles parallel and zero-length segments without slope division.
  let low = 0, high = 1;
  for (const axis of ['x', 'y']) {
    const delta = b[axis] - a[axis];
    const min = axis === 'x' ? box.minX : box.minY, max = axis === 'x' ? box.maxX : box.maxY;
    if (delta === 0) { if (a[axis] < min || a[axis] > max) return false; continue; }
    const first = (min - a[axis]) / delta, second = (max - a[axis]) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
    if (low > high) return false;
  }
  return true;
}

/** Window requires full containment. Crossing also includes edges intersecting the box. */
export function entitiesInBox(entities, start, end, crossing = end.x < start.x,document={}) {
  const box = { minX: Math.min(start.x, end.x), maxX: Math.max(start.x, end.x), minY: Math.min(start.y, end.y), maxY: Math.max(start.y, end.y) };
  return entities.filter(entity => {
    if(entity.type==='INSERT'&&crossing)return entitiesInBox(visibleInsertEntities(entity,document),start,end,true,document).length>0;
    if(entity.type==='HATCH'&&entity.pattern==='solid'&&crossing&&(boundaryContains(entity.boundary,{x:midpoint(box.minX,box.maxX),y:midpoint(box.minY,box.maxY)})||entitiesInBox([{...entity.boundary,id:entity.id}],start,end,true,document).length))return true;
    if(entity.type==='ARC'&&crossing){
      if(entityPoints(entity).some(p=>inBox(p,box)))return true;
      const corners=[{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.maxX,y:box.maxY},{x:box.minX,y:box.maxY}];
      return corners.some((start,index)=>{
        const edge={type:'LINE',start,end:corners[(index+1)%4]};if(samePoint(edge.start,edge.end))return hitTest([entity],edge.start,0)!=null;
        return lineIntersections(edge,[entity]).some(t=>t>=0&&t<=1);
      });
    }
    if (entity.type === 'CIRCLE' && crossing) {
      const c = entity.center;
      const dx = Math.max(box.minX - c.x, 0, c.x - box.maxX), dy = Math.max(box.minY - c.y, 0, c.y - box.maxY);
      const nearest = Math.hypot(dx, dy);
      const farthest = Math.hypot(Math.max(Math.abs(box.minX - c.x), Math.abs(box.maxX - c.x)), Math.max(Math.abs(box.minY - c.y), Math.abs(box.maxY - c.y)));
      return nearest <= entity.radius && farthest >= entity.radius;
    }
    const points = entityPoints(entity,document);
    return crossing ? points.some(p => inBox(p, box)) || segments(entity,document).some(([a, b]) => segmentCrossesBox(a, b, box)) || (TEXT_TYPES.has(entity.type)||entity.type==='DIMENSION')&&hitTest([entity],{x:midpoint(box.minX,box.maxX),y:midpoint(box.minY,box.maxY)},0,document)!=null : points.length > 0 && points.every(p => inBox(p, box));
  }).map(entity => entity.id);
}

/** Endpoint/midpoint and circle center/quadrant snaps use a world tolerance. */
export function snapCandidates(entity,document={}){
    if(entity.type==='ELLIPSE')return[{point:entity.center,type:'center'},...[0,.25,.5,.75].map(f=>({point:ellipsePoint(entity,f),type:'quadrant'}))];
    if(entity.type==='SPLINE')return[{point:splinePoint(entity,0),type:'endpoint'},{point:splinePoint(entity,1),type:'endpoint'}];
    if(entity.type==='HATCH')return snapCandidates(entity.boundary,document);
    if(entity.type==='INSERT'){const children=visibleInsertEntities(entity,document);return children.length?[{point:entity.position,type:'endpoint'},...children.flatMap(child=>snapCandidates(child,document))]:[];}
    const candidates = TEXT_TYPES.has(entity.type)?[{point:entity.position,type:'endpoint'}]:entity.type==='DIMENSION'?entityGripPoints(entity,document).map(point=>({point,type:'endpoint'})):entity.type === 'ARC'
      ? [{point:arcPoint(entity,0),type:'endpoint'},{point:arcPoint(entity,1),type:'endpoint'},{point:arcPoint(entity,0.5),type:'midpoint'},{point:entity.center,type:'center'}]
      : entity.type === 'CIRCLE'
      ? [{ point: entity.center, type: 'center' }, ...entityPoints(entity).map(p => ({ point: p, type: 'quadrant' }))]
      : entityPoints(entity).map(p => ({ point: p, type: 'endpoint' }));
    if(!TEXT_TYPES.has(entity.type)&&entity.type!=='DIMENSION')for (const [a, b] of segments(entity)) candidates.push({ point: { x: midpoint(a.x, b.x), y: midpoint(a.y, b.y),...(TYPES3D.has(entity.type)?{z:midpoint(a.z,b.z)}:{}) }, type: 'midpoint' });
    return candidates;
}
export function findSnap(entities, p, tolerance,document={}) {
  let best = tolerance, winner = null;
  for (const entity of entities) {
    const candidates=snapCandidates(entity,document);
    for (const candidate of candidates) {
      if(document.settings?.snapModes&&!document.settings.snapModes.includes(candidate.type))continue;
      const distance = Math.hypot(p.x - candidate.point.x, p.y - candidate.point.y);
      if (distance <= best && (winner === null || distance < best - EPS || (Math.abs(distance - best) < EPS && candidate.type === 'endpoint' && winner.type !== 'endpoint'))) {
        best = distance; winner = { point: { ...candidate.point }, type: candidate.type, entityId: entity.id };
      }
    }
  }
  return winner;
}

function validLayerName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 255 && !/[<>/\\";:?*|,=\x00-\x1f]/.test(name);
}

function normalizeLayer(layer) {
  if (!layer || !validLayerName(layer.name)) throw new Error('Layer name is invalid.');
  const color = layer.color ?? '#e5e7eb';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Color must be a six-digit hex value.');
  const lineweight = layer.lineweight ?? 0.25;
  if (!finite(lineweight) || lineweight < 0 || lineweight > 10) throw new Error('Lineweight must be between 0 and 10 mm.');
  return { name: layer.name, color, visible: layer.visible !== false, locked: layer.locked === true, lineweight };
}
function normalizeHatchBoundary(raw){
  if(!raw||!['RECTANG','PLINE','CIRCLE','ELLIPSE'].includes(raw.type))throw new Error('HATCH supports one closed RECTANG/PLINE, CIRCLE or ELLIPSE boundary.');
  if(['RECTANG','PLINE'].includes(raw.type)&&(!Array.isArray(raw.points)||raw.points.length>4096))throw new Error('HATCH boundary exceeds the 4096-vertex limit or has malformed vertices.');
  const boundary={type:raw.type};if(['RECTANG','PLINE'].includes(raw.type)){boundary.points=Array.isArray(raw.points)?raw.points.map(point):null;if(raw.type==='RECTANG'){if(boundary.points?.length!==4)throw new Error('RECTANG boundary needs four vertices.');validateRectangle(boundary.points);}else{if(raw.closed!==true)throw new Error('HATCH PLINE boundary must be closed.');boundary.closed=true;validatePolyline(boundary.points,true);}triangulatePolygon(boundary.points);}
  else{boundary.center=point(raw.center);if(raw.type==='CIRCLE'){boundary.radius=raw.radius;validateCircle(boundary.center,boundary.radius);}else{boundary.major=point(raw.major);boundary.ratio=raw.ratio;validateEllipse(boundary);}}return boundary;
}
function validateHatch(entity){
  normalizeHatchBoundary(entity.boundary);point(entity.origin);if(!['solid','parallel'].includes(entity.pattern)||!finite(entity.angle))throw new Error('HATCH needs solid/parallel pattern and a finite angle.');positive(entity.spacing,'Hatch spacing');hatchGeometry(entity);return entity;
}
// Bound actual display work, including definitions and each referenced instance.
function validateHatchResources(document){
  let total=0;const blockCounts=new Map(),cost=entity=>{if(entity.type!=='HATCH')return 0;const geometry=hatchGeometry(entity);return geometry.segments.length+geometry.fills.reduce((sum,fill)=>sum+fill.points.length,0);},add=count=>{total+=count;if(total>100000)throw new Error('Drawing exceeds the 100000 aggregate HATCH-segment/solid-edge resource limit.');};
  for(const block of document.blocks??[]){let count=0;for(const entity of block.entities){const value=cost(entity);add(value);count+=value;}blockCounts.set(block.name,count);}
  for(const entity of document.entities??[])add(entity.type==='INSERT'?(blockCounts.get(entity.blockName)??0):cost(entity));return total;
}
// Count dispatch and bounded curve work without expanding INSERT geometry. Hatch
// pattern complexity and XYZ topology have separate, stricter geometry budgets.
function validateExpandedResources(document){
  let total=0;const counts=new Map(),add=value=>{total+=value;if(!Number.isSafeInteger(total)||total>100000)throw new Error('Drawing exceeds the 100000 expanded planar-primitive/curve-work resource limit.');};
  const cost=entity=>{
    if(!entity||typeof entity!=='object')throw new Error('Unsupported entity type.');
    if(entity.type==='LINE')return 1;if(entity.type==='RECTANG')return 4;
    if(entity.type==='PLINE')return Math.max(1,(entity.points?.length??0)-(entity.closed?0:1));
    if(['CIRCLE','ELLIPSE'].includes(entity.type))return 128;if(entity.type==='ARC')return 64;
    if(entity.type==='SPLINE')return 128+(entity.controlPoints?.length??0);
    if(TEXT_TYPES.has(entity.type))return 1+Math.ceil((entity.text?.length??0)/16);
    if(entity.type==='DIMENSION'){const style=document.dimStyles?.find(item=>item.name===entity.style)??DEFAULT_DIM_STYLE;return(entity.kind==='angular'?128:10)+Math.ceil(((entity.textOverride?.length??0)+(style.prefix?.length??0)+(style.suffix?.length??0)+32)/16);}
    if(entity.type==='HATCH')return 1;return 0;
  };
  for(const block of document.blocks??[]){if(!block||!Array.isArray(block.entities))throw new Error('Malformed block definition.');let count=0;for(const entity of block.entities){const value=cost(entity);add(value);count+=value;}counts.set(block.name,count);}
  for(const entity of document.entities??[]){if(entity?.type==='INSERT'){const count=counts.get(entity.blockName);if(count===undefined)throw new Error(`Block definition ${entity.blockName} does not exist.`);add(1+count);}else add(cost(entity));}return total;
}
function validateInsert(entity,document){
  point(entity.position);positive(entity.scale,'Block scale');if(!finite(entity.rotation)||!document.blocks?.some(block=>block.name===entity.blockName))throw new Error('INSERT needs an existing block definition and a finite rotation.');expandedInsertEntities(entity,document).flatMap(child=>entityPoints(child,document)).forEach(point);return entity;
}

function normalizeDocument(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid drawing document.');
  if (input.format != null && input.format !== 'Linecraft/1') throw new Error('Unsupported drawing format.');
  const layers = (input.layers ?? [{ name: '0' }]).map(normalizeLayer);
  if (!layers.some(layer => layer.name === '0')) layers.unshift(normalizeLayer({ name: '0' }));
  if (new Set(layers.map(layer => layer.name)).size !== layers.length) throw new Error('Duplicate layer names.');
  const currentLayer = input.currentLayer ?? '0';
  if (!layers.some(layer => layer.name === currentLayer)) throw new Error('Current layer does not exist.');
  const textStyles=(input.textStyles===undefined?[DEFAULT_TEXT_STYLE]:input.textStyles).map(normalizeTextStyle);
  if(!textStyles.some(style=>style.name==='Standard'))textStyles.unshift({...DEFAULT_TEXT_STYLE});
  if(new Set(textStyles.map(style=>style.name)).size!==textStyles.length)throw new Error('Duplicate text style names.');
  const dimStyles=(input.dimStyles===undefined?[DEFAULT_DIM_STYLE]:input.dimStyles).map(style=>normalizeDimStyle(style,textStyles));
  if(!dimStyles.some(style=>style.name==='Standard'))dimStyles.unshift(normalizeDimStyle(DEFAULT_DIM_STYLE,textStyles));
  if(new Set(dimStyles.map(style=>style.name)).size!==dimStyles.length)throw new Error('Duplicate dimension style names.');
  const settings=normalizeSettings(input.settings===undefined?{}:input.settings),currentTextStyle=input.currentTextStyle===undefined?'Standard':input.currentTextStyle,currentDimStyle=input.currentDimStyle===undefined?'Standard':input.currentDimStyle;
  if(!textStyles.some(style=>style.name===currentTextStyle)||!dimStyles.some(style=>style.name===currentDimStyle))throw new Error('Current annotation style does not exist.');
  const rawBlocks=input.blocks===undefined?[]:input.blocks;if(!Array.isArray(rawBlocks)||rawBlocks.length>64)throw new Error('Drawing supports up to 64 flat block definitions.');const names=new Set();
  if(!Array.isArray(input.entities??[]))throw new Error('Entities must be an array.');
  for(const block of rawBlocks)if(!block||!Array.isArray(block.entities)||!block.entities.length||block.entities.length>10000||block.entities.some(entity=>!entity||TYPES3D.has(entity.type)||entity.type==='INSERT'))throw new Error('Blocks require 1..10000 flat planar entities; nested INSERT and 3D content are unsupported.');
  validateExpandedResources({entities:input.entities??[],blocks:rawBlocks,dimStyles});
  const blocks=rawBlocks.map(block=>{
    if(!block||!validLayerName(block.name)||names.has(block.name))throw new Error('Block names must be valid and unique.');names.add(block.name);const base=point(block.base);
    if(!Array.isArray(block.entities)||!block.entities.length||block.entities.length>10000||block.entities.some(entity=>!entity||TYPES3D.has(entity.type)||entity.type==='INSERT'))throw new Error('Blocks require 1..10000 flat planar entities; nested INSERT and 3D content are unsupported.');
    const normalized=normalizeDocument({layers,textStyles,dimStyles,settings,entities:block.entities.map((entity,i)=>({...entity,id:`block${i}`}))});return{name:block.name,base,entities:normalized.entities.map(({id,...entity})=>entity)};
  });if(blocks.reduce((sum,block)=>sum+block.entities.length,0)>50000)throw new Error('Total block geometry exceeds 50000 entities.');
  const annotationContext={textStyles,dimStyles,settings,blocks};
  const ids = new Set();
  if (!Array.isArray(input.entities ?? [])) throw new Error('Entities must be an array.');
  const entities = (input.entities ?? []).map((raw, index) => {
    if (!raw || !['LINE', 'RECTANG', 'CIRCLE', 'PLINE','ARC','TEXT','MTEXT','DIMENSION','MESH','POLY3D','ELLIPSE','SPLINE','HATCH','INSERT'].includes(raw.type)) throw new Error('Unsupported entity type.');
    const id = raw.id ?? `e${index + 1}`;
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error('Entity IDs must be unique nonempty strings.');
    ids.add(id);
    const layer = raw.layer ?? '0';
    if (!layers.some(item => item.name === layer)) throw new Error(`Entity layer ${layer} does not exist.`);
    const entity = { id, type: raw.type, layer };
    if(raw.type==='ELLIPSE'){entity.center=point(raw.center);entity.major=point(raw.major);entity.ratio=raw.ratio;validateEllipse(entity);}
    else if(raw.type==='SPLINE'){entity.controlPoints=Array.isArray(raw.controlPoints)&&raw.controlPoints.length<=1024?raw.controlPoints.map(point):null;entity.degree=raw.degree;entity.knots=Array.isArray(raw.knots)?[...raw.knots]:null;entity.closed=raw.closed;validateSpline(entity);splineBoundsPoints(entity).forEach(point);}
    else if(raw.type==='HATCH'){entity.boundary=normalizeHatchBoundary(raw.boundary);entity.pattern=raw.pattern;entity.angle=raw.angle;entity.spacing=raw.spacing;entity.origin=point(raw.origin);validateHatch(entity);}
    else if(raw.type==='INSERT'){entity.blockName=raw.blockName;entity.position=point(raw.position);entity.scale=raw.scale;entity.rotation=raw.rotation;validateInsert(entity,annotationContext);}
    else if(raw.type==='MESH'){
      if(!Array.isArray(raw.vertices)||raw.vertices.length>MAX_MESH_VERTICES||!Array.isArray(raw.faces)||raw.faces.length>MAX_MESH_FACES)throw new Error('MESH exceeds its vertex/face resource limits or has malformed arrays.');
      entity.vertices=Array.isArray(raw.vertices)?raw.vertices.map(point3):raw.vertices;entity.faces=Array.isArray(raw.faces)?raw.faces.map(face=>Array.isArray(face)?[...face]:face):raw.faces;if(raw.primitive!==undefined)entity.primitive=raw.primitive;validateMesh(entity);
    }else if(raw.type==='POLY3D'){
      if(!Array.isArray(raw.points)||raw.points.length>MAX_MESH_VERTICES)throw new Error('3DPOLY points exceed the resource limit or are malformed.');
      entity.points=Array.isArray(raw.points)?raw.points.map(point3):raw.points;entity.closed=raw.closed;validatePolyline3D(entity.points,entity.closed);
    }else if(TEXT_TYPES.has(raw.type)){
      entity.position=point(raw.position);entity.text=raw.text;entity.height=raw.height;entity.rotation=raw.rotation===undefined?0:raw.rotation;entity.style=raw.style===undefined?'Standard':raw.style;if(raw.type==='MTEXT')entity.width=raw.width;
      validateText(entity,annotationContext);entity.rotation%=360;
    }else if(raw.type==='DIMENSION'){
      entity.kind=raw.kind;entity.placement=point(raw.placement);entity.style=raw.style===undefined?'Standard':raw.style;entity.scale=raw.scale===undefined?1:raw.scale;
      if(['linear','aligned','angular'].includes(raw.kind)){entity.p1=point(raw.p1);entity.p2=point(raw.p2);if(raw.kind==='linear')entity.axisAngle=raw.axisAngle===undefined?0:raw.axisAngle;if(raw.kind==='angular')entity.vertex=point(raw.vertex);}
      else{entity.center=point(raw.center);entity.radius=raw.radius;}
      if(raw.textOverride!==undefined)entity.textOverride=raw.textOverride;validateDimension(entity,annotationContext);if(entity.kind==='linear')entity.axisAngle%=360;
    }else if (raw.type === 'LINE') {
      entity.start = point(raw.start); entity.end = point(raw.end);
      if(samePoint(entity.start,entity.end))throw new Error('LINE endpoints must differ.');
    }
    else if (raw.type === 'CIRCLE'||raw.type==='ARC') {
      entity.center = point(raw.center); entity.radius = raw.radius; validateCircle(entity.center, entity.radius);
      if(raw.type==='ARC'){entity.startAngle=raw.startAngle;entity.sweepAngle=raw.sweepAngle;validateArc(entity);entity.startAngle%=360;}
    } else if (raw.type === 'PLINE') {
      if (typeof raw.closed !== 'boolean') throw new Error('PLINE closed flag must be boolean.');
      entity.points = Array.isArray(raw.points) ? raw.points.map(point) : null; entity.closed = raw.closed;
      validatePolyline(entity.points, entity.closed);
    } else {
      if (!Array.isArray(raw.points) || raw.points.length !== 4) throw new Error('RECTANG requires four corners.');
      entity.points = raw.points.map(point);
      validateRectangle(entity.points);
    }
    if (raw.color != null) {
      if (!/^#[0-9a-f]{6}$/i.test(raw.color)) throw new Error('Entity color is invalid.');
      entity.color = raw.color;
    }
    if (raw.lineweight != null) {
      if (!finite(raw.lineweight) || raw.lineweight < 0 || raw.lineweight > 10) throw new Error('Entity lineweight is invalid.');
      entity.lineweight = raw.lineweight;
    }
    return entity;
  });
  if(entities.reduce((sum,entity)=>sum+(entity.type==='MESH'?entity.vertices.length:entity.type==='POLY3D'?entity.points.length:0),0)>MAX_MESH_VERTICES||entities.reduce((sum,entity)=>sum+(entity.type==='MESH'?entity.faces.length:0),0)>MAX_MESH_FACES)throw new Error('Drawing exceeds the 100000 3D-vertex or 200000 face resource limit.');
  validateHatchResources({entities,blocks});
  const rawViewport = input.viewport ?? { center: { x: 0, y: 0 }, scale: 10 };
  if (!finite(rawViewport.scale) || rawViewport.scale < MIN_SCALE || rawViewport.scale > MAX_SCALE) throw new Error('Viewport scale must be between 0.000001 and 1000000 pixels per unit.');
  const viewport = { center: point(rawViewport.center), scale: rawViewport.scale };
  const workspace=input.workspace===undefined?'2d':input.workspace;if(!['2d','3d'].includes(workspace))throw new Error('Workspace must be 2d or 3d.');
  const camera3d=normalizeCamera3D(input.camera3d===undefined?DEFAULT_CAMERA3D:input.camera3d);
  return { entities, layers, currentLayer, viewport,textStyles,dimStyles,currentTextStyle,currentDimStyle,settings,blocks,workspace,camera3d };
}

function normalizeClipboard(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  if (!raw || raw.format !== 'LinecraftClipboard/1') throw new Error('Unsupported clipboard geometry format.');
  if (!Array.isArray(raw.entities) || !raw.entities.length) throw new Error('Clipboard contains no geometry.');
  const base=raw.entities.some(entity=>TYPES3D.has(entity?.type))?point3(raw.base):point(raw.base);
  if (raw.entities.length > 100000) throw new Error('Clipboard entity count exceeds 100000.');
  const layerNames = [...new Set(raw.entities.map(entity => entity?.layer ?? '0'))];
  const layers = raw.layers == null ? layerNames.map(name => normalizeLayer({ name })) : raw.layers;
  const normalized = normalizeDocument({ layers,textStyles:raw.textStyles,dimStyles:raw.dimStyles,blocks:raw.blocks, entities: raw.entities.map((entity, index) => ({ ...entity, id: `clipboard${index}` })) });
  normalized.blocks.forEach(block=>block.entities.forEach(entity=>{if(entity.layer!=='0')layerNames.push(entity.layer);}));
  return { format: 'LinecraftClipboard/1', base, entities: normalized.entities.map(({ id, ...entity }) => entity), layers: normalized.layers.filter(layer=>layerNames.includes(layer.name)),textStyles:normalized.textStyles,dimStyles:normalized.dimStyles,blocks:normalized.blocks };
}

function escapeDXFText(text){return text.replace(/[\\%^]/g,character=>`\\U+${character.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}`);}
function escapeDXFMText(text){
  // Empty formatting groups keep literal control-token characters separated
  // through native DXF decoding and MTEXT's subsequent formatting pass.
  return Array.from(text.replace(/\r\n?/g,'\n'),character=>{
    if(character==='\\')return '\\\\{}';
    if(character==='%')return '%{}';
    if(character==='{')return '\\{';if(character==='}')return '\\}';
    if(character==='^')return '\\U+005E';
    if(character==='\n')return '\\P';if(character==='\t')return '    ';
    return character;
  }).join('');
}
function assertExportableSingleLineText(text,kind){
  const token=text.match(/%%(?:[dpcuok%]|\d{3})|\\U\+[0-9a-f]{4}/i)?.[0];
  if(token)throw new Error(`DXF export cannot preserve the literal ${kind} control sequence "${token}". ${kind==='TEXT'?'Use MTEXT for this text.':'Edit the dimension label to avoid this sequence.'} The drawing is unchanged.`);
}

/** Original DXF serializer using the published R2013 database record schema. */
function writeDXF(document) {
  const unitFormat=dxfUnitFormat(document.settings);
  // Reject before serialization or a native file chooser can adopt a path.
  // Source/JSON annotation content is broader than plain native TEXT exchange.
  for(const entity of [...document.entities,...document.blocks.flatMap(block=>block.entities)]){
    if(entity.type==='TEXT')assertExportableSingleLineText(entity.text,'TEXT');
    if(entity.type==='DIMENSION')assertExportableSingleLineText(formatDimension(entity,document).label,'dimension label');
  }
  const rows = [], pair = (code, value) => rows.push(String(code), String(value));
  let next = 1;
  const allocate = () => (next++).toString(16).toUpperCase();
  const tableNames = ['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD'];
  const tableIds = Object.fromEntries(tableNames.map(name => [name, allocate()]));
  const activeView = allocate(), lineTypes = ['BYBLOCK', 'BYLAYER', 'CONTINUOUS'].map(name => ({ name, id: allocate() }));
  const layerIds = new Map(document.layers.map(layer => [layer.name, allocate()]));
  const textStyleIds=new Map(document.textStyles.map(style=>[style.name,allocate()]));
  const appId=allocate(),exportDimStyles=document.dimStyles.map(style=>({...style})),dimensionPictures=[];
  const allDimensionSources=[...document.entities.map((entity,index)=>({entity,key:`model:${index}`,index})),...document.blocks.flatMap(block=>block.entities.map((entity,index)=>({entity,key:`block:${block.name}:${index}`,index:index+document.entities.length})))];
  allDimensionSources.forEach(({entity,index,key})=>{
    if(entity.type!=='DIMENSION')return;
    let styleName=entity.style;
    if(entity.scale!==1){
      let number=index+1;do{styleName=`LinecraftDimensionScale${number++}`;}while(exportDimStyles.some(style=>style.name===styleName));
      const source=document.dimStyles.find(style=>style.name===entity.style);exportDimStyles.push({...source,name:styleName,scale:source.scale*entity.scale});
    }
    const geometry=annotationPrimitives(entity,document),picture={entity,index,key,name:`*D${dimensionPictures.length+1}`,styleName,record:allocate(),begin:allocate(),end:allocate(),geometry,parts:[]};
    geometry.segments.forEach(([start,end])=>picture.parts.push({type:'LINE',id:allocate(),start,end}));
    geometry.arrows.forEach(points=>picture.parts.push({type:'SOLID',id:allocate(),points}));
    geometry.texts.forEach(text=>picture.parts.push({type:'TEXT',id:allocate(),...text,style:document.dimStyles.find(style=>style.name===entity.style).textStyle}));
    dimensionPictures.push(picture);
  });
  const dimStyleIds=new Map(exportDimStyles.map(style=>[style.name,allocate()]));
  const userBlocks=document.blocks.map(block=>({...block,record:allocate(),begin:allocate(),end:allocate(),handles:block.entities.map(()=>allocate())}));
  const modelRecord = allocate(), paperRecord = allocate();
  const modelBegin = allocate(), modelEnd = allocate(), paperBegin = allocate(), paperEnd = allocate();
  const rootDictionary = allocate(), groupDictionary = allocate(), layoutDictionary = allocate(), plotDictionary = allocate();
  const plotStyleDictionary = allocate(), normalPlotStyle = allocate();
  const modelLayout = allocate(), paperLayout = allocate();
  const entityIds = document.entities.map(() => allocate());
  const threeDHandles=document.entities.map((entity,index)=>entity.type==='MESH'?entity.faces.map((_,faceIndex)=>faceIndex===0?entityIds[index]:allocate()):entity.type==='POLY3D'?{vertices:entity.points.map(()=>allocate()),end:allocate()}:null);
  const box = bounds3D(document.entities,document) ?? { minX: 0, minY: 0,minZ:0, maxX: 1, maxY: 1,maxZ:0 };
  const middle = { x: midpoint(box.minX, box.maxX), y: midpoint(box.minY, box.maxY) };
  const point3 = (code, p) => { pair(code, p.x); pair(code + 10, p.y); pair(code + 20, p.z ?? 0); };
  const beginSection = name => { pair(0, 'SECTION'); pair(2, name); };
  const endSection = () => pair(0, 'ENDSEC');
  const beginTable = (name, count) => { pair(0, 'TABLE'); pair(2, name); pair(5, tableIds[name]); pair(330, '0'); pair(100, 'AcDbSymbolTable'); pair(70, count); };
  const symbol = (type, id, table, subclass, name) => {
    pair(0, type); pair(5, id); pair(330, tableIds[table]); pair(100, 'AcDbSymbolTableRecord'); pair(100, subclass); pair(2, name);
  };
  const lineweight = value => {
    const hundredths = value * 100, supported = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
    return supported.reduce((best, candidate) => Math.abs(candidate - hundredths) < Math.abs(best - hundredths) ? candidate : best);
  };
  const fontFiles={'Arial':'Arial.ttf','Segoe UI':'segoeui.ttf','Consolas':'consola.ttf'};
  const entityHeader=(type,handle,entity,owner=modelRecord)=>{
    pair(0,type);pair(5,handle);pair(330,owner);pair(100,'AcDbEntity');pair(8,entity.layer);if(owner===modelRecord)pair(410,'Model');pair(370,entity.lineweight==null?(owner!==modelRecord&&entity.layer==='0'?-2:-1):lineweight(entity.lineweight));if(entity.color)pair(420,Number.parseInt(entity.color.slice(1),16));
    if(userBlocks.some(block=>block.record===owner)&&entity.layer==='0'&&!entity.color)pair(62,0);
  };
  const textRecord=(entity)=>{
    pair(100,'AcDbText');point3(10,entity.position);pair(40,entity.height);pair(1,escapeDXFText(entity.text));pair(50,positiveAngle(entity.rotation));pair(41,1);pair(7,entity.style);pair(71,0);pair(72,entity.align==='center'?1:0);
    if(entity.align==='center')point3(11,entity.position);pair(100,'AcDbText');pair(73,0);
  };

  beginSection('HEADER');
  pair(9, '$ACADVER'); pair(1, 'AC1027'); pair(9, '$DWGCODEPAGE'); pair(3, 'ANSI_1252');
  pair(9, '$HANDSEED'); pair(5, next.toString(16).toUpperCase());
  pair(9, '$INSBASE'); point3(10, { x: 0, y: 0 });
  pair(9, '$EXTMIN'); point3(10, { x: box.minX, y: box.minY,z:box.minZ }); pair(9, '$EXTMAX'); point3(10, { x: box.maxX, y: box.maxY,z:box.maxZ });
  pair(9, '$TILEMODE'); pair(70, 1); pair(9, '$INSUNITS'); pair(70,({unitless:0,in:1,ft:2,mm:4,cm:5,m:6})[document.settings.units]);pair(9,'$LUNITS');pair(70,unitFormat.lunits);pair(9,'$LUPREC');pair(70,unitFormat.luprec);pair(9,'$TEXTSTYLE');pair(7,document.currentTextStyle);pair(9,'$DIMSTYLE');pair(2,document.currentDimStyle);if(document.settings.angularFormat!=='decimal-degrees'||document.settings.angularPrecision!==4){pair(9,'$AUNITS');pair(70,unitFormat.aunits);pair(9,'$AUPREC');pair(70,unitFormat.auprec);}pair(9, '$PSTYLEMODE'); pair(290, 1); endSection();
  beginSection('CLASSES');
  for (const [name, subclass, instances] of [['ACDBDICTIONARYWDFLT', 'AcDbDictionaryWithDefault', 1], ['ACDBPLACEHOLDER', 'AcDbPlaceHolder', 1], ['LAYOUT', 'AcDbLayout', 2]]) {
    pair(0, 'CLASS'); pair(1, name); pair(2, subclass); pair(3, 'ObjectDBX Classes'); pair(90, 0); pair(91, instances); pair(280, 0); pair(281, 0);
  }
  endSection();
  beginSection('TABLES');
  beginTable('VPORT', 1); symbol('VPORT', activeView, 'VPORT', 'AcDbViewportTableRecord', '*ACTIVE'); pair(70, 0);
  pair(10, 0); pair(20, 0); pair(11, 1); pair(21, 1); pair(12, middle.x); pair(22, middle.y);
  pair(13, 0); pair(23, 0); pair(14, 10); pair(24, 10); pair(15, 10); pair(25, 10);
  point3(16, { x: 0, y: 0, z: 1 }); point3(17, { x: 0, y: 0 });
  const viewHeight = Math.max(box.maxY - box.minY, box.maxX / 1.6 - box.minX / 1.6, 1);
  pair(40, finite(viewHeight) && viewHeight <= Number.MAX_VALUE / 1.2 ? viewHeight * 1.2 : Number.MAX_VALUE); pair(41, 1.6);
  pair(42, 50); pair(43, 0); pair(44, 0); pair(50, 0); pair(51, 0); pair(71, 0); pair(72, 1000); pair(73, 1); pair(74, 3); pair(75, 0); pair(76, 0); pair(77, 0); pair(78, 0); pair(0, 'ENDTAB');
  beginTable('LTYPE', lineTypes.length);
  for (const type of lineTypes) {
    symbol('LTYPE', type.id, 'LTYPE', 'AcDbLinetypeTableRecord', type.name); pair(70, 0); pair(3, type.name === 'CONTINUOUS' ? 'Solid line' : ''); pair(72, 65); pair(73, 0); pair(40, 0);
  }
  pair(0, 'ENDTAB');
  beginTable('LAYER', document.layers.length);
  for (const layer of document.layers) {
    symbol('LAYER', layerIds.get(layer.name), 'LAYER', 'AcDbLayerTableRecord', layer.name); pair(70, layer.locked ? 4 : 0);
    pair(62, layer.visible ? 7 : -7); pair(6, 'CONTINUOUS'); pair(420, Number.parseInt(layer.color.slice(1), 16)); pair(290, 1); pair(370, lineweight(layer.lineweight)); pair(390, normalPlotStyle); pair(347, '0');
  }
  pair(0, 'ENDTAB');
  beginTable('STYLE', document.textStyles.length);
  for(const style of document.textStyles){symbol('STYLE',textStyleIds.get(style.name),'STYLE','AcDbTextStyleTableRecord',style.name);pair(70,0);pair(40,0);pair(41,style.widthFactor);pair(50,0);pair(71,0);pair(42,style.defaultHeight);pair(3,fontFiles[style.fontFamily]);pair(4,'');}
  pair(0,'ENDTAB');
  for (const name of ['VIEW', 'UCS']) { beginTable(name, 0); pair(0, 'ENDTAB'); }
  beginTable('APPID', 1); symbol('APPID', appId, 'APPID', 'AcDbRegAppTableRecord', 'ACAD'); pair(70, 0); pair(0, 'ENDTAB');
  beginTable('DIMSTYLE', exportDimStyles.length); pair(100, 'AcDbDimStyleTable'); pair(71, 0);
  for(const style of exportDimStyles){
    pair(0,'DIMSTYLE');pair(105,dimStyleIds.get(style.name));pair(330,tableIds.DIMSTYLE);pair(100,'AcDbSymbolTableRecord');pair(100,'AcDbDimStyleTableRecord');pair(2,style.name);pair(70,0);pair(3,`${escapeDXFMText(style.prefix)}<>${escapeDXFMText(style.suffix)}`);
    pair(40,style.scale);pair(41,style.arrowSize);pair(42,style.extensionOffset);pair(44,style.extensionOvershoot);pair(140,style.textHeight);pair(147,style.gap);pair(144,unitFormat.dimlfac);pair(271,document.settings.linearFormat==='architectural'?(style.fractionPrecision??document.settings.fractionPrecision):style.precision);pair(277,unitFormat.dimlunit);pair(278,46);pair(73,0);pair(74,0);pair(77,1);pair(340,textStyleIds.get(style.textStyle));pair(371,-1);pair(372,-1);if(document.settings.linearFormat!=='decimal'){pair(276,2);pair(78,0);}if(document.settings.angularFormat!=='decimal-degrees'||style.angularPrecision!==undefined){const p=style.angularPrecision??style.precision;pair(275,unitFormat.dimaunit);pair(179,document.settings.angularFormat==='dms'?Math.min(8,p+4):p);pair(79,0);}
  }
  pair(0,'ENDTAB');
  beginTable('BLOCK_RECORD', 2+dimensionPictures.length+userBlocks.length);
  for (const [name, id, layout] of [['*Model_Space', modelRecord, modelLayout], ['*Paper_Space', paperRecord, paperLayout]]) {
    symbol('BLOCK_RECORD', id, 'BLOCK_RECORD', 'AcDbBlockTableRecord', name); pair(340, layout); pair(70, 0); pair(280, 1); pair(281, 0);
  }
  for(const picture of dimensionPictures){symbol('BLOCK_RECORD',picture.record,'BLOCK_RECORD','AcDbBlockTableRecord',picture.name);pair(70,0);pair(280,1);pair(281,0);}
  for(const block of userBlocks){symbol('BLOCK_RECORD',block.record,'BLOCK_RECORD','AcDbBlockTableRecord',block.name);pair(70,0);pair(280,1);pair(281,0);}
  pair(0, 'ENDTAB'); endSection();
  beginSection('BLOCKS');
  for (const [name, owner, begin, end] of [['*Model_Space', modelRecord, modelBegin, modelEnd], ['*Paper_Space', paperRecord, paperBegin, paperEnd]]) {
    pair(0, 'BLOCK'); pair(5, begin); pair(330, owner); pair(100, 'AcDbEntity'); pair(8, '0'); pair(100, 'AcDbBlockBegin'); pair(2, name); pair(70, 0); point3(10, { x: 0, y: 0 }); pair(3, name); pair(1, '');
    pair(0, 'ENDBLK'); pair(5, end); pair(330, owner); pair(100, 'AcDbEntity'); pair(8, '0'); pair(100, 'AcDbBlockEnd');
  }
  for(const picture of dimensionPictures){
    pair(0,'BLOCK');pair(5,picture.begin);pair(330,picture.record);pair(100,'AcDbEntity');pair(8,'0');pair(100,'AcDbBlockBegin');pair(2,picture.name);pair(70,1);point3(10,{x:0,y:0});pair(3,picture.name);pair(1,'');
    for(const part of picture.parts){
      pair(0,part.type);pair(5,part.id);pair(330,picture.record);pair(100,'AcDbEntity');pair(8,'0');pair(62,0);pair(370,-2);
      if(part.type==='LINE'){pair(100,'AcDbLine');point3(10,part.start);point3(11,part.end);}
      else if(part.type==='SOLID'){pair(100,'AcDbTrace');point3(10,part.points[0]);point3(11,part.points[1]);point3(12,part.points[2]);point3(13,part.points[2]);}
      else textRecord(part);
    }
    pair(0,'ENDBLK');pair(5,picture.end);pair(330,picture.record);pair(100,'AcDbEntity');pair(8,'0');pair(100,'AcDbBlockEnd');
  }
  function writeEntity(entity,index,owner=modelRecord,key=`model:${index}`,handle=entityIds[index],resources=threeDHandles[index]){
    if(entity.type==='MESH'){
      entity.faces.forEach((face,faceIndex)=>{entityHeader('3DFACE',resources[faceIndex],entity,owner);pair(100,'AcDbFace');for(let corner=0;corner<4;corner++)point3(10+corner,entity.vertices[face[Math.min(corner,face.length-1)]]);pair(70,0);});return;
    }
    if(entity.type==='POLY3D'){
      entityHeader('POLYLINE',handle,entity,owner);pair(100,'AcDb3dPolyline');pair(66,1);point3(10,{x:0,y:0,z:0});pair(70,8+(entity.closed?1:0));
      entity.points.forEach((p,vertexIndex)=>{entityHeader('VERTEX',resources.vertices[vertexIndex],entity,handle);pair(100,'AcDbVertex');pair(100,'AcDb3dPolylineVertex');point3(10,p);pair(70,32);});
      entityHeader('SEQEND',resources.end,entity,handle);return;
    }
    entityHeader(['RECTANG','PLINE'].includes(entity.type)?'LWPOLYLINE':entity.type,handle,entity,owner);
    if(entity.type==='ELLIPSE'){pair(100,'AcDbEllipse');point3(10,entity.center);point3(11,entity.major);point3(210,{x:0,y:0,z:1});pair(40,entity.ratio);pair(41,0);pair(42,Math.PI*2);}
    else if(entity.type==='SPLINE'){pair(100,'AcDbSpline');point3(210,{x:0,y:0,z:1});pair(70,8);pair(71,3);pair(72,entity.knots.length);pair(73,entity.controlPoints.length);pair(74,0);pair(42,1e-7);pair(43,1e-7);pair(44,1e-10);entity.knots.forEach(k=>pair(40,k));entity.controlPoints.forEach(p=>point3(10,p));}
    else if(entity.type==='HATCH'){
      const boundary=entity.boundary;pair(100,'AcDbHatch');point3(10,{x:0,y:0,z:0});point3(210,{x:0,y:0,z:1});pair(2,entity.pattern==='solid'?'SOLID':'LINECRAFT_PARALLEL');pair(70,entity.pattern==='solid'?1:0);pair(71,0);pair(91,1);
      if(['RECTANG','PLINE'].includes(boundary.type)){pair(92,3);pair(72,0);pair(73,1);pair(93,boundary.points.length);boundary.points.forEach(p=>{pair(10,p.x);pair(20,p.y);});}
      else{pair(92,1);pair(93,1);pair(72,boundary.type==='CIRCLE'?2:3);pair(10,boundary.center.x);pair(20,boundary.center.y);if(boundary.type==='CIRCLE')pair(40,boundary.radius);else{pair(11,boundary.major.x);pair(21,boundary.major.y);pair(40,boundary.ratio);}pair(50,0);pair(51,360);pair(73,1);}
      pair(97,0);pair(75,0);pair(76,entity.pattern==='solid'?1:0);
      if(entity.pattern==='parallel'){const[c,s]=angleBasis(entity.angle);pair(52,0);pair(41,1);pair(77,0);pair(78,1);pair(53,entity.angle);pair(43,entity.origin.x);pair(44,entity.origin.y);pair(45,-s*entity.spacing);pair(46,c*entity.spacing);pair(79,0);}pair(98,0);
    }
    else if(entity.type==='INSERT'){pair(100,'AcDbBlockReference');pair(2,entity.blockName);point3(10,entity.position);pair(41,entity.scale);pair(42,entity.scale);pair(43,entity.scale);pair(50,positiveAngle(entity.rotation));point3(210,{x:0,y:0,z:1});}
    else if(entity.type==='TEXT')textRecord(entity);
    else if(entity.type==='MTEXT'){
      pair(100,'AcDbMText');point3(10,entity.position);pair(40,entity.height);pair(41,entity.width);pair(71,1);pair(72,1);pair(7,entity.style);const[c,s]=angleBasis(entity.rotation);point3(11,{x:c,y:s});pair(73,2);pair(44,1);
      const characters=Array.from(escapeDXFMText(entity.text));while(characters.length>=250)pair(3,characters.splice(0,250).join(''));pair(1,characters.join(''));
    }else if(entity.type==='DIMENSION'){
      const picture=dimensionPictures.find(item=>item.key===key),geometry=picture.geometry,radial=['radius','diameter'].includes(entity.kind);
      const dimStyle=document.dimStyles.find(style=>style.name===entity.style),angularLiteral=entity.kind==='angular'&&(['decimal-minutes','decimal-seconds'].includes(document.settings.angularFormat)||document.settings.angularFormat==='dms'&&(dimStyle.angularPrecision??dimStyle.precision)>4);
      pair(100,'AcDbDimension');pair(280,0);pair(2,picture.name);point3(10,radial?entity.kind==='radius'?entity.center:geometry.dimensionLine[0]:entity.placement);point3(11,geometry.texts[0].position);pair(70,32+(radial?128:0)+({linear:0,aligned:1,diameter:3,radius:4,angular:5})[entity.kind]);pair(71,5);if(entity.kind!=='angular')pair(42,geometry.measurement);pair(1,escapeDXFMText(angularLiteral?geometry.label:entity.textOverride??''));pair(3,picture.styleName);
      if(radial){pair(100,entity.kind==='radius'?'AcDbRadialDimension':'AcDbDiametricDimension');point3(15,geometry.dimensionLine[1]);pair(40,Math.hypot(entity.placement.x-geometry.dimensionLine[1].x,entity.placement.y-geometry.dimensionLine[1].y));}
      else if(entity.kind==='angular'){pair(100,'AcDb3PointAngularDimension');point3(13,entity.p1);point3(14,entity.p2);point3(15,entity.vertex);}
      else{pair(100,'AcDbAlignedDimension');point3(13,entity.p1);point3(14,entity.p2);if(entity.kind==='linear'){pair(50,positiveAngle(entity.axisAngle));pair(100,'AcDbRotatedDimension');}}
    }
    else if (entity.type === 'LINE') { pair(100, 'AcDbLine'); point3(10, entity.start); point3(11, entity.end); }
    else if (entity.type === 'CIRCLE'||entity.type==='ARC') {
      pair(100, 'AcDbCircle'); point3(10, entity.center); pair(40, entity.radius);
      if(entity.type==='ARC'){pair(100,'AcDbArc');pair(50,positiveAngle(entity.startAngle%360+(entity.sweepAngle<0?entity.sweepAngle:0)));pair(51,positiveAngle(entity.startAngle%360+(entity.sweepAngle>0?entity.sweepAngle:0)));}
    }
    else { pair(100, 'AcDbPolyline'); pair(90, entity.points.length); pair(70, entity.type === 'RECTANG' || entity.closed ? 1 : 0); for (const p of entity.points) { pair(10, p.x); pair(20, p.y); } }
  }
  for(const block of userBlocks){
    pair(0,'BLOCK');pair(5,block.begin);pair(330,block.record);pair(100,'AcDbEntity');pair(8,'0');pair(100,'AcDbBlockBegin');pair(2,block.name);pair(70,0);point3(10,{x:0,y:0});pair(3,block.name);pair(1,'');
    block.entities.forEach((entity,index)=>writeEntity(entity,index,block.record,`block:${block.name}:${index}`,block.handles[index],null));
    pair(0,'ENDBLK');pair(5,block.end);pair(330,block.record);pair(100,'AcDbEntity');pair(8,'0');pair(100,'AcDbBlockEnd');
  }
  endSection();beginSection('ENTITIES');document.entities.forEach((entity,index)=>writeEntity(entity,index));
  endSection(); beginSection('OBJECTS');
  const dictionary = (id, owner, entries = []) => {
    pair(0, 'DICTIONARY'); pair(5, id); pair(330, owner); pair(100, 'AcDbDictionary'); pair(281, 1);
    for (const [name, target] of entries) { pair(3, name); pair(350, target); }
  };
  dictionary(rootDictionary, '0', [['ACAD_GROUP', groupDictionary], ['ACAD_LAYOUT', layoutDictionary], ['ACAD_PLOTSETTINGS', plotDictionary], ['ACAD_PLOTSTYLENAME', plotStyleDictionary]]);
  dictionary(groupDictionary, rootDictionary); dictionary(layoutDictionary, rootDictionary, [['Model', modelLayout], ['Layout1', paperLayout]]); dictionary(plotDictionary, rootDictionary);
  pair(0, 'ACDBDICTIONARYWDFLT'); pair(5, plotStyleDictionary); pair(330, rootDictionary); pair(100, 'AcDbDictionary'); pair(281, 1); pair(3, 'Normal'); pair(350, normalPlotStyle); pair(100, 'AcDbDictionaryWithDefault'); pair(340, normalPlotStyle);
  pair(0, 'ACDBPLACEHOLDER'); pair(5, normalPlotStyle); pair(330, plotStyleDictionary);
  for (const [name, id, record, order] of [['Model', modelLayout, modelRecord, 0], ['Layout1', paperLayout, paperRecord, 1]]) {
    pair(0, 'LAYOUT'); pair(5, id); pair(330, layoutDictionary); pair(100, 'AcDbPlotSettings');
    pair(1, ''); pair(2, ''); pair(4, ''); pair(6, '');
    for (const code of [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 140, 141]) pair(code, 0);
    pair(142, 1); pair(143, 1); pair(70, name === 'Model' ? 1024 : 0); pair(72, 1); pair(73, 0); pair(74, 5);
    pair(100, 'AcDbLayout'); pair(1, name); pair(70, 1); pair(71, order); pair(10, 0); pair(20, 0); pair(11, 420); pair(21, 297);
    point3(12, { x: 0, y: 0 }); point3(14, name === 'Model' ? { x: box.minX, y: box.minY } : { x: 0, y: 0 }); point3(15, name === 'Model' ? { x: box.maxX, y: box.maxY } : { x: 0, y: 0 });
    pair(146, 0); point3(13, { x: 0, y: 0 }); point3(16, { x: 1, y: 0 }); point3(17, { x: 0, y: 1 }); pair(76, 0); pair(330, record);
  }
  endSection(); pair(0, 'EOF'); return rows.join('\r\n') + '\r\n';
}

export function createEditor(initialState = {}) {
  const document = normalizeDocument(initialState);
  const state = {
    ...document, command: null, commandPhase: null, commandData: {}, commandSelectionIds: [], commandPoints: [], prompt: 'Command:', selectionIds: [],
    history: [], message: '', revision: 0, clipboardRevision: 0, lastPoint: { x: 0, y: 0 }, canvasSize: { width: 1000, height: 700 },
  };
  let nextId = 1, transactionBefore = null, transactionIds = [], transformSources = [], copyBatches = [], editingSteps = [], clipboard = null, pendingCut = null;
  const allocatedIds=new Set(document.entities.map(entity=>entity.id));
  const undoStack = [], redoStack = [];
  const snapshot = () => clone({ entities: state.entities, layers: state.layers, currentLayer: state.currentLayer,textStyles:state.textStyles,dimStyles:state.dimStyles,currentTextStyle:state.currentTextStyle,currentDimStyle:state.currentDimStyle,settings:state.settings,blocks:state.blocks });
  const layerOf = entity => state.layers.find(layer => layer.name === entity.layer);
  const editable = entity => { const layer = layerOf(entity); return layer && layer.visible && !layer.locked; };
  const validateSelection = () => { state.selectionIds = state.selectionIds.filter(id => state.entities.some(entity => entity.id === id && editable(entity))); };
  const result = (ok, message, changed = false) => {
    state.message = message;
    if (changed) state.revision++;
    return { ok, message, changed };
  };
  const restore = data => { Object.assign(state, clone(data));state.entities.forEach(entity=>allocatedIds.add(entity.id));validateSelection(); };
  const record = before => {
    const after = snapshot();
    const beforeJSON=JSON.stringify(before),afterJSON=JSON.stringify(after);if(beforeJSON===afterJSON)return false;
    undoStack.push({before,after,bytes:2*(beforeJSON.length+afterJSON.length)});
    let storedBytes=undoStack.reduce((sum,entry)=>sum+entry.bytes,0);
    while(undoStack.length>1&&(undoStack.length>300||storedBytes>64*1024*1024)){storedBytes-=undoStack.shift().bytes;}
    redoStack.length = 0;
    return true;
  };
  const idle = () => { state.command = null; state.commandPhase = null; state.commandData = {}; state.commandSelectionIds = []; state.commandPoints = []; state.prompt = 'Command:'; transactionBefore = null; transactionIds = []; transformSources = []; copyBatches = []; editingSteps = []; pendingCut = null; };
  const finish = message => {
    const changed = transactionBefore ? record(transactionBefore) : false;
    idle();
    return result(true, message, changed);
  };
  const id = () => { let value; do { value = `e${nextId++}`; } while (allocatedIds.has(value));allocatedIds.add(value);return value; };
  const acceptTransformSelection = () => {
    validateSelection();
    if (!state.selectionIds.length) return result(false, 'No objects selected. Select objects and press Enter.');
    state.commandSelectionIds = [...state.selectionIds];
    const selected = new Set(state.commandSelectionIds);
    transformSources = clone(state.entities.filter(entity => selected.has(entity.id)));
    state.commandData.threeD=transformSources.some(entity=>TYPES3D.has(entity.type));
    if(state.command==='ARRAYRECT'){state.commandPhase='rows';state.commandData.targetKind='none';state.prompt='ARRAYRECT Enter row count (1..100):';return result(true,`${transformSources.length} source objects accepted.`);}
    if(state.command==='PEDIT'){
      if(transformSources.length!==1||!['LINE','PLINE','RECTANG'].includes(transformSources[0].type))throw new Error('PEDIT requires one LINE, PLINE or RECTANG path.');const source=transformSources[0];state.commandData.peditId=source.id;state.commandData.targetKind='none';
      if(source.type==='LINE'){state.commandPhase='convert';state.prompt='PEDIT Convert LINE to a straight PLINE? [Yes/No] <Yes>:';}
      else{if(source.type==='RECTANG'){const before=snapshot();state.entities=state.entities.map(entity=>entity.id===source.id?{...entity,type:'PLINE',closed:true}:entity);editingSteps.push(before);}state.commandPhase='option';state.prompt='PEDIT Enter [Open/Close/Join/Reverse/Undo] <finish>:';}return result(true,'Polyline path accepted.');
    }
    if(state.command==='BLOCK'){
      if(!state.commandData.blockName||!state.commandPoints.length)throw new Error('BLOCK requires a name and base point first.');if(transformSources.some(entity=>TYPES3D.has(entity.type)||entity.type==='INSERT'))throw new Error('BLOCK supports flat planar geometry; nested references and 3D content are not supported.');
      const base=state.commandPoints[0],entities=transformSources.map(source=>{const{id:discard,...local}=translateEntity(source,{x:-base.x,y:-base.y},state);return local;}),block={name:state.commandData.blockName,base:{...base},entities};
      const reference={id:id(),type:'INSERT',blockName:block.name,position:{...base},scale:1,rotation:0,layer:state.currentLayer};drawingLayerReady();
      const proposed=normalizeDocument({...snapshot(),blocks:[...state.blocks,block],entities:[...state.entities.filter(entity=>!selected.has(entity.id)),reference],viewport:state.viewport,camera3d:state.camera3d,workspace:state.workspace});state.blocks=proposed.blocks;state.entities=proposed.entities;state.selectionIds=[reference.id];return finish(`Block ${block.name} created and source geometry converted to one INSERT.`);
    }
    if(state.command==='EXTRUDE'){
      for(const entity of transformSources){if(!['RECTANG','PLINE'].includes(entity.type)||entity.type==='PLINE'&&!entity.closed)throw new Error('EXTRUDE requires closed planar RECTANG or PLINE profiles.');triangulatePolygon(entity.points);}
      state.commandPhase='height';state.commandData.targetKind='point';state.commandData.heightBase={...transformSources[0].points[0],z:0};state.prompt='EXTRUDE Specify nonzero height (source profiles retained):';return result(true,`${transformSources.length} closed profiles accepted.`);
    }
    if(state.command==='ROTATE3D'){
      if(transformSources.some(entity=>!TYPES3D.has(entity.type)))throw new Error('ROTATE3D requires only MESH or POLY3D objects.');
      state.commandPhase='axis';state.commandData.targetKind='none';state.prompt='ROTATE3D Specify world axis [X/Y/Z]:';return result(true,`${transformSources.length} 3D objects accepted.`);
    }
    if(state.command==='TEXTEDIT'){
      if(transformSources.length!==1||!TEXT_TYPES.has(transformSources[0].type))return result(false,'TEXTEDIT requires exactly one TEXT or MTEXT object.');
      state.commandPhase='text';state.commandData.targetKind='none';state.commandData.text=transformSources[0].text;state.prompt='TEXTEDIT Enter replacement text:';return result(true,'Text object accepted.');
    }
    if (state.command === 'ERASE') {
      state.entities = state.entities.filter(entity => !selected.has(entity.id)); state.selectionIds = [];
      return finish(`${transformSources.length} objects erased.`);
    }
    if(state.command==='JOIN') {
      const sources=state.commandSelectionIds.map(entityId=>transformSources.find(entity=>entity.id===entityId));
      const joined=joinEntities(sources);state.entities=state.entities.flatMap(entity=>selected.has(entity.id)?entity.id===joined.id?[joined]:[]:[entity]);state.selectionIds=[joined.id];
      return finish(`${transformSources.length} objects joined into one ${joined.closed?'closed':'open'} PLINE.`);
    }
    if(state.command==='EXPLODE') {
      const exploded=transformSources.map(source=>({source,fragments:explodeEntity(source)})); // Validate every source before mutation.
      const byId=new Map(exploded.map(({source,fragments})=>[source.id,fragments]));const created=[];
      state.entities=state.entities.flatMap(entity=>byId.has(entity.id)?byId.get(entity.id).map(fragment=>{fragment.id=id();created.push(fragment.id);return fragment;}):[entity]);state.selectionIds=created;
      return finish(`${transformSources.length} objects exploded into ${created.length} LINEs.`);
    }
    if (['COPYCLIP', 'CUTCLIP'].includes(state.command)) {
      const copied = captureClipboard();
      if (state.command === 'CUTCLIP') {
        pendingCut = clone(transformSources); state.commandPhase = 'clipboard-ready'; state.commandData.targetKind = 'none';
        state.prompt = 'CUTCLIP Waiting for clipboard acknowledgement:';
        return result(true, 'Clipboard geometry prepared; source objects retained until acknowledgement.');
      }
      return finish(copied.message);
    }
    if(state.command==='COPYBASE') {
      if(!state.commandPoints.length)return result(false,'Specify the clipboard base point before selecting objects.');
      captureClipboard(state.commandPoints[0]);return finish('Objects copied with explicit clipboard base point.');
    }
    if (['TRIM', 'EXTEND'].includes(state.command)) {
      if(transformSources.some(entity=>!['LINE','CIRCLE','RECTANG','PLINE','ARC'].includes(entity.type)))return result(false,'TRIM/EXTEND boundaries must be LINE, CIRCLE, RECTANG, PLINE or ARC.');
      state.commandPhase = 'target'; state.commandData.targetKind = 'object'; state.selectionIds = [];
      state.prompt = `${state.command} Select LINE to ${state.command.toLowerCase()} or [Undo] <finish>:`;
    } else if (state.command === 'BREAK') {
      if (transformSources.length !== 1 || transformSources[0].type !== 'LINE') return result(false, 'BREAK requires exactly one LINE.');
      state.commandPhase = 'first-break'; state.commandData.targetKind = 'point'; state.prompt = 'BREAK Specify first break point:';
    } else {
      state.commandPhase = 'base'; state.commandData.targetKind = 'point'; state.prompt = `${state.command} Specify base point:`;
    }
    return result(true, `${transformSources.length} objects accepted.`);
  };
  const captureClipboard = rawBase => {
    const sources = transformSources.length ? transformSources : state.entities.filter(entity => state.selectionIds.includes(entity.id) && editable(entity));
    if (!sources.length) throw new Error('Select objects to copy to the clipboard.');
    const is3D=sources.some(entity=>TYPES3D.has(entity.type)),box = is3D?bounds3D(sources,state):bounds(sources,state), base = rawBase == null ? { x: box.minX, y: box.minY,...(is3D?{z:box.minZ}:{}) } : is3D?point3(rawBase):point(rawBase);
    const layerNames = new Set(sources.map(entity => entity.layer));
    const blockNames=new Set(sources.filter(entity=>entity.type==='INSERT').map(entity=>entity.blockName)),blocks=state.blocks.filter(block=>blockNames.has(block.name));blocks.forEach(block=>block.entities.forEach(entity=>{if(entity.layer!=='0')layerNames.add(entity.layer);}));
    clipboard = normalizeClipboard({ format: 'LinecraftClipboard/1', base, entities: sources, layers: state.layers.filter(layer => layerNames.has(layer.name)),textStyles:state.textStyles,dimStyles:state.dimStyles,blocks });
    state.clipboardRevision++;
    return result(true, `${sources.length} objects copied to the geometry clipboard.`);
  };
  const clipboardGeometry = rawTarget => {
    if (!clipboard) throw new Error('The geometry clipboard is empty.');
    const proposedBlocks=[...state.blocks,...clipboard.blocks.filter(block=>!state.blocks.some(existing=>existing.name===block.name))];validateExpandedResources({entities:[...state.entities,...clipboard.entities],blocks:proposedBlocks,dimStyles:[...state.dimStyles,...clipboard.dimStyles.filter(style=>!state.dimStyles.some(existing=>existing.name===style.name))]});
    const is3D=clipboard.entities.some(entity=>TYPES3D.has(entity.type)),target = is3D?point3(rawTarget):point(rawTarget), delta = is3D?point3({x:target.x-clipboard.base.x,y:target.y-clipboard.base.y,z:target.z-(clipboard.base.z??0)}):point({ x: target.x - clipboard.base.x, y: target.y - clipboard.base.y });
    return clipboard.entities.map(entity => translateEntity(entity, delta,clipboard));
  };
  const pasteClipboard = rawTarget => {
    const transformed = clipboardGeometry(rawTarget), additions = [];
    for (const source of clipboard.layers) {
      const existing = state.layers.find(layer => layer.name === source.name);
      if (existing && (!existing.visible || existing.locked)) throw new Error(`Clipboard layer ${source.name} must be visible and unlocked.`);
      if (!existing) additions.push({ ...source, visible: true, locked: false });
    }
    const neededBlocks=new Set(transformed.filter(entity=>entity.type==='INSERT').map(entity=>entity.blockName)),styleEntities=[...transformed,...clipboard.blocks.filter(block=>neededBlocks.has(block.name)).flatMap(block=>block.entities)];
    const newBlocks=clipboard.blocks.filter(block=>neededBlocks.has(block.name)).filter(source=>{const existing=state.blocks.find(block=>block.name===source.name);if(existing&&JSON.stringify(existing)!==JSON.stringify(source))throw new Error(`Clipboard block name ${source.name} conflicts with the destination definition.`);return !existing;});
    if(state.blocks.length+newBlocks.length>64||[...state.blocks,...newBlocks].reduce((sum,block)=>sum+block.entities.length,0)>50000)throw new Error('Pasted blocks exceed definition resource limits.');
    const neededText=new Set(styleEntities.filter(entity=>TEXT_TYPES.has(entity.type)).map(entity=>entity.style)),neededDim=new Set(styleEntities.filter(entity=>entity.type==='DIMENSION').map(entity=>entity.style));
    for(const style of clipboard.dimStyles)if(neededDim.has(style.name))neededText.add(style.textStyle);
    const mergeStyles=(key,needed)=>clipboard[key].filter(source=>needed.has(source.name)).filter(source=>{
      const existing=state[key].find(style=>style.name===source.name);
      if(existing&&JSON.stringify(existing)!==JSON.stringify(source))throw new Error(`Clipboard ${key} name ${source.name} conflicts with the destination definition.`);
      return !existing;
    });
    const newTextStyles=mergeStyles('textStyles',neededText),newDimStyles=mergeStyles('dimStyles',neededDim);
    check3DResources(transformed,[],[...state.blocks,...newBlocks]);
    state.layers.push(...additions);
    state.blocks.push(...newBlocks);
    state.textStyles.push(...newTextStyles);state.dimStyles.push(...newDimStyles);
    for (const entity of transformed) { entity.id = id(); state.entities.push(entity); }
    state.selectionIds = transformed.map(entity => entity.id); state.lastPoint = clipboard.entities.some(entity=>TYPES3D.has(entity.type))?point3(rawTarget):point(rawTarget);
    return finish(`${transformed.length} objects pasted.`);
  };
  const editingUndo = () => {
    const before = editingSteps.pop();
    if (!before) return result(false, `No ${state.command} edit to undo.`);
    restore(before); state.commandPhase = state.command === 'OFFSET' ? 'object' : 'target'; state.commandData.targetKind = 'object';
    return result(true, `Last ${state.command} edit removed.`, true);
  };
  const replaceLine = (source, fragments) => {
    const before = snapshot();
    const replacements = fragments.map((fragment, index) => ({ ...fragment, id: index === 0 ? source.id : id() }));
    if(replacements.length===1&&JSON.stringify(replacements[0])===JSON.stringify(source))return result(false,`${state.command} would not alter that LINE.`);
    check3DResources(replacements,[source.id]);
    state.entities = state.entities.flatMap(entity => entity.id === source.id ? replacements : [entity]);
    if(state.commandSelectionIds.includes(source.id))state.commandSelectionIds.push(...replacements.slice(1).map(entity=>entity.id));
    editingSteps.push(before); validateSelection();
    return result(true, `${state.command} edit completed.`, true);
  };
  const liveBoundaries=()=>state.entities.filter(entity=>state.commandSelectionIds.includes(entity.id)&&layerOf(entity)?.visible);
  const pickEditingTarget = (rawPoint,requestedId) => {
    const p = point(rawPoint), entityId = requestedId??hitTest(state.entities.filter(editable), p, 8 / state.viewport.scale,state);
    const target = state.entities.find(entity => entity.id === entityId);
    if (!target||!editable(target)) return result(false, 'No editable object at that point.');
    if (state.command === 'OFFSET') {
      if (!['LINE', 'CIRCLE', 'RECTANG'].includes(target.type)) return result(false, 'OFFSET currently supports LINE, CIRCLE and RECTANG.');
      state.commandData.offsetSource = clone(target); state.commandPhase = 'side'; state.commandData.targetKind = 'point';
      state.prompt = 'OFFSET Specify point on side to offset:'; return result(true, 'OFFSET object accepted.');
    }
    if (target.type !== 'LINE') return result(false, `${state.command} currently supports LINE targets.`);
    return state.command === 'TRIM' ? replaceLine(target, trimLine(target, liveBoundaries(), p)) : replaceLine(target, [extendLine(target, liveBoundaries(), p)]);
  };
  const startCommand = command => {
    validateSelection();
    state.command = command;
    state.commandPhase = null; state.commandData = {}; state.commandSelectionIds = [];
    state.commandPoints = [];
    transactionBefore = snapshot();
    transactionIds = []; transformSources = []; copyBatches = []; editingSteps = [];
    if (command === 'COPY') state.commandData = { copyMode: 'multiple', copyCount: 0 };
    if(command==='ELLIPSE'){state.selectionIds=[];state.commandPhase='axis-first';state.commandData.targetKind='point';state.prompt='ELLIPSE Specify first axis endpoint or [Center]:';return result(true,'ELLIPSE started.');}
    if(command==='SPLINE'){state.selectionIds=[];state.commandPhase='control-point';state.commandData.targetKind='point';state.prompt='SPLINE Specify control vertex (open cubic CV method):';return result(true,'SPLINE uses actual cubic control vertices, not fit-point interpolation.');}
    if(command==='HATCH'){state.selectionIds=[];state.commandPhase='pattern';state.commandData={targetKind:'none',pattern:'solid',angle:0,spacing:10};state.prompt='HATCH Enter [Solid/Parallel] <Solid>:';return result(true,'Choose a bounded original hatch pattern.');}
    if(command==='FILLET'||command==='CHAMFER'){state.selectionIds=[];state.commandPhase=command==='FILLET'?'radius':'distance-first';state.commandData.targetKind='none';state.prompt=command==='FILLET'?'FILLET Specify nonnegative radius:':'CHAMFER Specify first nonnegative distance:';return result(true,`${command} supports two picked LINEs with trim/extend.`);}
    if(command==='STRETCH'){state.selectionIds=[];state.commandPhase='window-first';state.commandData.targetKind='point';state.prompt='STRETCH Specify first crossing-window corner:';return result(true,'Specify one crossing window to retain outside vertices.');}
    if(command==='BLOCK'||command==='INSERT'){state.commandPhase='name';state.commandData.targetKind='none';state.prompt=`${command} Enter block name:`;return result(true,`${command} uses persistent flat block definitions.`);}
    if(DRAW3D.has(command)){
      state.selectionIds=[];state.commandData={targetKind:'point',threeD:true};state.commandPhase=command==='BOX'?'first-corner':command==='3DPOLY'?'poly-point':'center';
      state.prompt=command==='BOX'?'BOX Specify first corner (X,Y,Z):':command==='3DPOLY'?'3DPOLY Specify first point (X,Y,Z):':`${command} Specify center (X,Y,Z):`;return result(true,`${command} started.`);
    }
    if(command==='3DORBITCTR'){state.commandPhase='orbit-center';state.commandData={targetKind:'point',threeD:true};state.prompt='3DORBITCTR Specify orbit center (X,Y,Z):';return result(true,'Specify an explicit 3D orbit target.');}
    if(command==='VPOINT'){state.commandPhase='view-vector';state.commandData={targetKind:'none',threeD:true};state.prompt='VPOINT Specify nonzero XYZ view direction:';return result(true,'Specify an XYZ vector from the target toward the viewer.');}
    if(command==='PLAN'){state.commandPhase='plan-choice';state.commandData.targetKind='none';state.prompt='PLAN Enter [World] <World>:';return result(true,'World XY plan view is supported.');}
    if(command==='TEXT'||command==='MTEXT'){
      const style=state.textStyles.find(style=>style.name===state.currentTextStyle);state.selectionIds=[];
      state.commandData={style:style.name,height:style.defaultHeight,rotation:style.defaultRotation,targetKind:'point'};
      state.commandPhase=command==='TEXT'?'position':'first-corner';state.prompt=command==='TEXT'?'TEXT Specify insertion point:':'MTEXT Specify first corner:';return result(true,`${command} started.`);
    }
    if(DIM_COMMANDS.has(command)){
      state.selectionIds=[];state.commandPhase=command==='DIMANGULAR'?'vertex':['DIMRADIUS','DIMDIAMETER'].includes(command)?'object':'origin-first';state.commandData={style:state.currentDimStyle,targetKind:state.commandPhase==='object'?'object':'point'};
      state.prompt=command==='DIMANGULAR'?'DIMANGULAR Specify angle vertex:':state.commandPhase==='object'?`${command} Select a CIRCLE:`:`${command} Specify first extension origin:`;return result(true,`${command} started.`);
    }
    if(['DIST','ID','AREA'].includes(command)){
      state.selectionIds=[];state.commandPhase='measure-point';state.commandData.targetKind='point';state.prompt=`${command} Specify ${command==='ID'?'point':'first point'}:`;return result(true,`${command} started.`);
    }
    if(command==='COPYBASE') {
      state.commandPhase='base';state.commandData.targetKind='point';state.prompt='COPYBASE Specify base point:';
      return result(true,'Specify the clipboard base point before selecting objects.');
    }
    if (SELECT_COMMANDS.has(command)) {
      state.commandPhase = 'selection'; state.prompt = `${command} Select objects, then press Enter:`;
      if (state.selectionIds.length) return acceptTransformSelection();
      return result(true, `${command} started. Select objects.`);
    }
    state.selectionIds = [];
    if (command === 'PASTECLIP') {
      if (!clipboard) { idle(); return result(false, 'The geometry clipboard is empty.'); }
      state.commandPhase = 'target'; state.commandData.targetKind = 'point'; state.prompt = 'PASTECLIP Specify insertion point:';
      return result(true, 'Specify clipboard insertion point.');
    }
    if (command === 'OFFSET') {
      state.commandPhase = 'distance'; state.commandData.targetKind = 'none'; state.prompt = 'OFFSET Specify positive offset distance:';
      return result(true, 'Enter a positive offset distance.');
    }
    if(command==='ARC'){state.commandPhase='arc-first';state.commandData.targetKind='point';state.prompt='ARC Specify start point:';}
    else if (command === 'CIRCLE') { state.commandPhase = 'center'; state.prompt = 'CIRCLE Specify center point:'; }
    else state.prompt = ['LINE', 'PLINE'].includes(command) ? `${command} Specify first point:` : 'RECTANG Specify first corner:';
    return result(true, `${command} started.`);
  };
  const updateLinePrompt = () => {
    state.prompt = state.commandPoints.length > 2 ? `${state.command} Specify next point or [Close/Undo]:` : `${state.command} Specify next point or [Undo]:`;
  };
  const completeCircle = radius => {
    const center = state.commandPoints[0];
    validateCircle(center, radius);
    const entity={ id: id(), type: 'CIRCLE', center: { ...center }, radius, layer: state.currentLayer };check3DResources([entity]);state.entities.push(entity);
    return finish('CIRCLE completed.');
  };
  const transformedGeometry = rawValue => {
    if(state.command==='COPY'||state.command==='MIRROR'&&!state.commandData.deleteOriginal)check3DResources(transformSources);
    const base = state.commandPoints[0];
    if(state.command==='ROTATE3D')return transformSources.map(entity=>rotateEntity3D(entity,base,state.commandData.axis,rawValue));
    if (state.command === 'ROTATE') return transformSources.map(entity => rotateEntity(entity, base, rawValue,state));
    if (state.command === 'SCALE') return transformSources.map(entity => scaleEntity(entity, base, rawValue,state));
    if (state.command === 'MIRROR') return transformSources.map(entity => mirrorEntity(entity, base, rawValue,state));
    const is3D=state.commandData.threeD,destination = is3D?point3(rawValue):point(rawValue), delta = is3D?point3({x:destination.x-base.x,y:destination.y-base.y,z:destination.z-(base.z??0)}):point({ x: destination.x - base.x, y: destination.y - base.y });
    return transformSources.map(entity => translateEntity(entity, delta,state));
  };
  const completeTransform = value => {
    const command = state.command, transformed = transformedGeometry(value);
    if (command === 'COPY' || command === 'MIRROR' && !state.commandData.deleteOriginal) {
      check3DResources(transformed);
      const ids = [];
      for (const entity of transformed) { entity.id = id(); ids.push(entity.id); state.entities.push(entity); }
      copyBatches.push({ ids, destination: { ...value } }); state.commandData.copyCount = copyBatches.length;
      if (command === 'COPY' && state.commandData.copyMode === 'multiple') {
        state.prompt = 'COPY Specify second point or [Exit/Undo] <Exit>:';
        return result(true, `${transformed.length} objects copied. Enter another point or press Enter to finish.`, true);
      }
    } else {
      check3DResources(transformed,transformed.map(entity=>entity.id));
      const byId = new Map(transformed.map(entity => [entity.id, entity]));
      state.entities = state.entities.map(entity => byId.get(entity.id) ?? entity);
    }
    state.selectionIds = [];
    return finish(`${command} completed for ${transformed.length} objects.`);
  };
  const drawingLayerReady=()=>{const layer=state.layers.find(item=>item.name===state.currentLayer);if(!layer?.visible||layer.locked)throw new Error('The current layer must be visible and unlocked to draw.');};
  const threeDPointMode=()=>DRAW3D.has(state.command)||['ROTATE3D','3DORBITCTR','VPOINT','COPYBASE'].includes(state.command)||state.command==='EXTRUDE'&&state.commandPhase==='height'||state.commandData.threeD===true||state.command==='PASTECLIP'&&clipboard?.entities.some(entity=>TYPES3D.has(entity.type));
  const parseInputPoint=(raw,base=state.lastPoint)=>threeDPointMode()?parseCoordinate3D(raw,base,state.settings):parsePoint2D(raw,{x:base.x,y:base.y},state.settings);
  const parseCoordinate=parseInputPoint;
  const lengthScalar=raw=>parseLength(raw,state.settings),angleScalar=raw=>parseAngle(raw,state.settings),scalarInput=raw=>typeof raw==='string'&&!/[<,]/.test(raw);
  const distancePoint=(raw,options={})=>{const distance=lengthScalar(raw),last=state.commandPoints.at(-1),previous=state.commandPoints.at(-2);if(!last)throw new Error('Specify a coordinate pair before direct distance.');const vector=point(options.direction??(previous?{x:last.x-previous.x,y:last.y-previous.y}:{x:1,y:0})),length=Math.hypot(vector.x,vector.y);if(!finite(length)||length===0)throw new Error('Direct distance needs a finite nonzero direction.');return point({x:last.x+distance*vector.x/length,y:last.y+distance*vector.y/length});};
  const check3DResources=(entities,replaced=[],blocks=state.blocks)=>{
    const all=[...state.entities.filter(entity=>!replaced.includes(entity.id)),...entities];validateExpandedResources({entities:all,blocks,dimStyles:state.dimStyles});if(all.reduce((sum,entity)=>sum+(entity.type==='MESH'?entity.vertices.length:entity.type==='POLY3D'?entity.points.length:0),0)>MAX_MESH_VERTICES||all.reduce((sum,entity)=>sum+(entity.type==='MESH'?entity.faces.length:0),0)>MAX_MESH_FACES)throw new Error('Drawing exceeds the 100000 3D-vertex or 200000 face resource limit.');validateHatchResources({entities:all,blocks});
  };
  const preparedPrimitive=value=>{
    const command=state.command,base=state.commandPoints[0];
    if(command==='BOX')return{...makeBoxMesh(base,state.commandPoints[1],value),layer:state.currentLayer};
    if(command==='CYLINDER')return{...makeCylinderMesh(base,state.commandData.radius,value),layer:state.currentLayer};
    if(command==='SPHERE')return{...makeSphereMesh(base,value),layer:state.currentLayer};
    if(command==='EXTRUDE')return transformSources.map(entity=>extrudeProfile(entity,value));
    throw new Error('No 3D primitive is pending.');
  };
  const completePrimitive=value=>{
    drawingLayerReady();const prepared=preparedPrimitive(value),entities=Array.isArray(prepared)?prepared:[prepared];check3DResources(entities);
    entities.forEach(entity=>{entity.id=id();state.entities.push(entity);});state.selectionIds=[];return finish(`${state.command} completed as ${entities.length} polygonal MESH object${entities.length===1?'':'s'}.`);
  };
  const completeEllipse=minor=>{
    drawingLayerReady();positive(minor,'Other-axis distance');const original=state.commandData.major,length=Math.hypot(original.x,original.y),major=minor>length?{x:-original.y/length*minor,y:original.x/length*minor}:{...original},entity={id:id(),type:'ELLIPSE',center:{...state.commandData.center},major,ratio:Math.min(minor,length)/Math.max(minor,length),layer:state.currentLayer};validateEllipse(entity);check3DResources([entity]);state.entities.push(entity);return finish('ELLIPSE completed.');
  };
  const preparedInsert=(position,scale=state.commandData.scale??1,rotation=state.commandData.rotation??0)=>{const entity={type:'INSERT',blockName:state.commandData.blockName,position:point(position),scale,rotation,layer:state.currentLayer};check3DResources([entity]);validateInsert(entity,state);return entity;};
  const completeInsert=rotation=>{drawingLayerReady();const entity=preparedInsert(state.commandPoints[0],state.commandData.scale,rotation);check3DResources([entity]);entity.id=id();state.entities.push(entity);state.selectionIds=[];return finish(`Block ${entity.blockName} inserted.`);};
  const completeArray=()=>{
    const{rows,columns,rowSpacing,columnSpacing}=state.commandData,count=rows*columns;if(count>1000||transformSources.length*(count-1)>10000)throw new Error('ARRAYRECT is limited to 1000 cells and 10000 new objects.');const created=[];
    check3DResources(Array.from({length:rows*columns-1},()=>transformSources).flat());
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){if(row===0&&column===0)continue;const delta={x:column*columnSpacing,y:row*rowSpacing};for(const source of transformSources)created.push(translateEntity(source,delta,state));}check3DResources(created);
    created.forEach(entity=>{entity.id=id();state.entities.push(entity);});state.selectionIds=[];return finish(`ARRAYRECT created ${created.length} ordinary copies; the array is nonassociative.`);
  };
  const cornerConnector=(prepared,first,second)=>{
    const extra=prepared.arc??prepared.connector;if(extra&&first.layer!==second.layer){drawingLayerReady();extra.layer=state.currentLayer;delete extra.color;delete extra.lineweight;}return extra;
  };
  const chooseCornerOrHatch=(entityId,rawPick)=>{
    const source=state.entities.find(entity=>entity.id===entityId),pick=point(rawPick??(source?.type==='LINE'?{x:midpoint(source.start.x,source.end.x),y:midpoint(source.start.y,source.end.y)}:{x:0,y:0}));if(!source||!layerOf(source)?.visible)throw new Error('Pick a visible source object.');
    if(state.command==='HATCH'){
      drawingLayerReady();const boundary=normalizeHatchBoundary(source),origin=boundary.center?{...boundary.center}:{...boundary.points[0]},entity={id:id(),type:'HATCH',boundary,origin,pattern:state.commandData.pattern,angle:state.commandData.angle,spacing:state.commandData.spacing,layer:state.currentLayer};validateHatch(entity);check3DResources([entity]);state.entities.push(entity);return finish('HATCH completed with a captured nonassociative boundary.');
    }
    if(source.type!=='LINE'||!editable(source))throw new Error(`${state.command} requires editable LINE objects.`);
    if(state.commandPhase==='first-line'){state.commandData.cornerFirst={source:clone(source),pick};state.commandPhase='second-line';state.prompt=`${state.command} Pick second LINE near the side to retain:`;return result(true,'First LINE and retained side captured.');}
    const first=state.commandData.cornerFirst,live=state.entities.find(entity=>entity.id===first.source.id);if(!live||!editable(live)||JSON.stringify(live)!==JSON.stringify(first.source))throw new Error('First corner source changed or is no longer editable.');
    const prepared=state.command==='FILLET'?filletLines(first.source,source,first.pick,pick,state.commandData.radius):chamferLines(first.source,source,first.pick,pick,state.commandData.distance1,state.commandData.distance2),extra=cornerConnector(prepared,first.source,source);
    if(extra?.type==='ARC')validateArc(extra);if(extra?.type==='LINE'&&samePoint(extra.start,extra.end))throw new Error('CHAMFER connector collapses.');check3DResources([prepared.first,prepared.second,...(extra?[extra]:[])],[prepared.first.id,prepared.second.id]);const replacements=new Map([[prepared.first.id,prepared.first],[prepared.second.id,prepared.second]]);state.entities=state.entities.map(entity=>replacements.get(entity.id)??entity);if(extra){extra.id=id();state.entities.push(extra);}state.selectionIds=[];return finish(`${state.command} trimmed/extended both LINEs${extra?' and added the corner geometry':''}.`);
  };
  const pickCornerOrHatch=p=>{
    const candidates=state.entities.filter(entity=>state.command==='HATCH'?layerOf(entity)?.visible&&['RECTANG','PLINE','CIRCLE','ELLIPSE'].includes(entity.type):editable(entity)&&entity.type==='LINE'),entityId=hitTest(candidates,p,8/state.viewport.scale,state);if(!entityId)return result(false,'Pick a supported object edge or enter its entity ID.');return chooseCornerOrHatch(entityId,p);
  };
  const acceptStretchWindow=(rawStart,rawEnd)=>{
    const start=point(rawStart),end=point(rawEnd),box={minX:Math.min(start.x,end.x),maxX:Math.max(start.x,end.x),minY:Math.min(start.y,end.y),maxY:Math.max(start.y,end.y)};if(box.minX===box.maxX||box.minY===box.maxY)throw new Error('STRETCH crossing window needs nonzero width and height.');
    const crossed=new Set(entitiesInBox(state.entities.filter(editable),start,end,true,state)),items=[];
    for(const source of state.entities.filter(entity=>crossed.has(entity.id))){if(TYPES3D.has(source.type))throw new Error('STRETCH supports planar objects only; a crossing 3D object rejects this operation.');const points=entityPoints(source,state),whole=points.length&&points.every(p=>inBox(p,box));if(whole){items.push({source:clone(source),whole:true});continue;}
      const controls=source.type==='LINE'?[source.start,source.end]:['PLINE','RECTANG'].includes(source.type)?source.points:source.type==='SPLINE'?source.controlPoints:null;
      if(controls){const indices=controls.map((p,i)=>inBox(p,box)?i:-1).filter(i=>i>=0);if(indices.length)items.push({source:clone(source),whole:false,indices});}
      else if(!['CIRCLE','ELLIPSE','INSERT'].includes(source.type))throw new Error(`Partial ${source.type} stretching is unsupported; fully enclose it or change the crossing window.`);
    }
    if(!items.length)throw new Error('No movable objects or supported vertices are inside the crossing window.');state.commandData.stretchItems=items;state.commandData.stretchWindow={start,end};state.selectionIds=items.map(item=>item.source.id);state.commandPoints=[];state.commandPhase='base';state.commandData.targetKind='point';state.prompt='STRETCH Specify base point:';return result(true,`${items.length} objects/vertex sets accepted.`);
  };
  const stretchGeometry=destination=>{
    const base=state.commandPoints[0],p=point(destination),delta=point({x:p.x-base.x,y:p.y-base.y});return state.commandData.stretchItems.map(({source,whole,indices})=>{
      const live=state.entities.find(entity=>entity.id===source.id);if(!live||!editable(live)||JSON.stringify(live)!==JSON.stringify(source))throw new Error('A STRETCH source changed or is no longer editable.');if(whole)return translateEntity(source,delta,state);const changed=clone(source),move=p=>point({x:p.x+delta.x,y:p.y+delta.y});
      if(source.type==='LINE'){if(indices.includes(0))changed.start=move(source.start);if(indices.includes(1))changed.end=move(source.end);if(samePoint(changed.start,changed.end))throw new Error('STRETCH would collapse a LINE.');}
      else if(source.type==='SPLINE'){changed.controlPoints=source.controlPoints.map((p,i)=>indices.includes(i)?move(p):{...p});validateSpline(changed);splineBoundsPoints(changed).forEach(point);}
      else{changed.points=source.points.map((p,i)=>indices.includes(i)?move(p):{...p});if(source.type==='RECTANG'){changed.type='PLINE';changed.closed=true;}validatePolyline(changed.points,changed.closed);}return changed;
    });
  };
  const completeStretch=destination=>{const changed=stretchGeometry(destination);check3DResources(changed,changed.map(entity=>entity.id));const byId=new Map(changed.map(entity=>[entity.id,entity]));state.entities=state.entities.map(entity=>byId.get(entity.id)??entity);state.selectionIds=[];state.lastPoint={...point(destination)};return finish('Crossing-window STRETCH completed.');};
  const peditOptionPrompt=()=>{const source=state.entities.find(entity=>entity.id===state.commandData.peditId);state.commandData.targetKind='none';if(['LINE','RECTANG'].includes(source?.type)){state.commandPhase='convert';state.prompt=`PEDIT Convert ${source.type} to a straight PLINE? [Yes/No] <Yes>:`;}else{state.commandPhase='option';state.prompt='PEDIT Enter [Open/Close/Join/Reverse/Undo] <finish>:';}};
  const peditChange=mode=>{
    const source=state.entities.find(entity=>entity.id===state.commandData.peditId);if(!source||!editable(source))throw new Error('PEDIT source is unavailable or locked.');const before=snapshot(),changed=clone(source);
    if(mode==='convert'){if(!['LINE','RECTANG'].includes(source.type))throw new Error('Only LINE/RECTANG require path conversion.');changed.type='PLINE';changed.points=source.type==='LINE'?[source.start,source.end]:clone(source.points);changed.closed=source.type==='RECTANG';delete changed.start;delete changed.end;}
    else if(mode==='open')changed.closed=false;else if(mode==='close')changed.closed=true;else if(mode==='reverse')changed.points.reverse();validatePolyline(changed.points,changed.closed);check3DResources([changed],[changed.id]);state.entities=state.entities.map(entity=>entity.id===changed.id?changed:entity);if(JSON.stringify(source)!==JSON.stringify(changed))editingSteps.push(before);peditOptionPrompt();return result(true,`PEDIT ${mode} accepted.`,JSON.stringify(source)!==JSON.stringify(changed));
  };
  const peditJoin=()=>{
    const source=state.entities.find(entity=>entity.id===state.commandData.peditId);if(!source||!editable(source))throw new Error('PEDIT source is unavailable or locked.');const others=state.entities.filter(entity=>state.selectionIds.includes(entity.id)&&entity.id!==source.id&&editable(entity));if(!others.length)throw new Error('Select at least one additional editable LINE/open PLINE to join.');const joined=joinEntities([source,...others]),ids=new Set([source.id,...others.map(entity=>entity.id)]),before=snapshot();state.entities=state.entities.flatMap(entity=>ids.has(entity.id)?entity.id===source.id?[joined]:[]:[entity]);editingSteps.push(before);state.selectionIds=[];peditOptionPrompt();return result(true,'Connected paths joined.',true);
  };
  const preparedDimension=placement=>{
    const command=state.command,entity={type:'DIMENSION',kind:command==='DIMANGULAR'?'angular':command==='DIMLINEAR'?'linear':command==='DIMALIGNED'?'aligned':command==='DIMRADIUS'?'radius':'diameter',placement:point(placement),style:state.commandData.style,scale:1,layer:state.currentLayer};
    if(entity.kind==='angular')[entity.vertex,entity.p1,entity.p2]=state.commandPoints;
    else if(['linear','aligned'].includes(entity.kind)){
      [entity.p1,entity.p2]=state.commandPoints;
      if(entity.kind==='linear'){
        const mid={x:midpoint(entity.p1.x,entity.p2.x),y:midpoint(entity.p1.y,entity.p2.y)};
        entity.axisAngle=state.commandData.axisAngle??(Math.abs(placement.x-mid.x)>Math.abs(placement.y-mid.y)?90:0);
        if(state.commandData.axisAngle==null&&(entity.axisAngle===0?entity.p1.x===entity.p2.x:entity.p1.y===entity.p2.y))entity.axisAngle=entity.axisAngle===0?90:0;
      }
    }else{entity.center={...state.commandData.circle.center};entity.radius=state.commandData.circle.radius;}
    validateDimension(entity,state);return entity;
  };
  const numeric=value=>formatLength(value,state.settings);
  const finishMeasurement=measurement=>{
    state.lastMeasurement=measurement;const message=measurement.kind==='point'?`X=${numeric(measurement.point.x)}, Y=${numeric(measurement.point.y)}`:measurement.kind==='area'?`Area=${formatArea(measurement.area,state.settings)}, perimeter=${numeric(measurement.perimeter)}`:`Distance=${numeric(measurement.distance)}, delta X=${numeric(measurement.dx)}, delta Y=${numeric(measurement.dy)}`;
    return finish(message);
  };

  const editor = {
    state,
    execute(input,options={}) {
      const inputText = typeof input === 'string' ? state.commandPhase==='text'?input:input.trim() : input;
      const priorPrompt = state.prompt;
      let response;
      try {
        const token = typeof inputText === 'string' ? inputText.toUpperCase().replace(/^[_.]+/, '') : '';
        if (['ESC', 'ESCAPE', 'CANCEL'].includes(token)) response = editor.cancel();
        else if(state.commandPhase==='text')response=editor.submitText(typeof input==='string'?input:String(input));
        else if(state.command==='ELLIPSE'){
          if(state.commandPhase==='axis-first'&&['C','CENTER'].includes(token)){state.commandPhase='ellipse-center';state.prompt='ELLIPSE Specify center:';response=result(true,'Center construction selected.');}
          else if(state.commandPhase==='minor-distance'&&scalarInput(inputText))response=completeEllipse(lengthScalar(inputText));
          else if(['A','ARC','R','ROTATION','I','ISOCIRCLE'].includes(token))response=result(false,'ELLIPSE supports full axis/center construction with a second-axis distance only.');
          else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }else if(state.command==='SPLINE'){
          if(['M','METHOD'].includes(token)){state.commandPhase='method';state.commandData.targetKind='none';state.prompt='SPLINE Enter method [CV] <CV>:';response=result(true,'Only cubic control-vertex construction is supported.');}
          else if(state.commandPhase==='method'){if(inputText===''||['CV','CONTROLVERTICES'].includes(token)){state.commandPhase='control-point';state.commandData.targetKind='point';state.prompt='SPLINE Specify control vertex:';response=result(true,'CV method selected.');}else response=result(false,'Fit-point/other-degree methods are unsupported; choose CV.');}
          else if(inputText===''){if(state.commandPoints.length<4)response=result(false,'A cubic SPLINE requires at least four control vertices.');else response=finish('Open cubic SPLINE completed.');}
          else if(['U','UNDO'].includes(token)){if(!state.commandPoints.length)response=result(false,'No SPLINE control vertex to undo.');else{state.commandPoints.pop();if(state.commandPoints.length<4){state.entities=state.entities.filter(entity=>entity.id!==transactionIds[0]);transactionIds=[];}else{const spline=state.entities.find(entity=>entity.id===transactionIds[0]);spline.controlPoints=clone(state.commandPoints);spline.knots=makeClampedKnots(state.commandPoints.length);}if(state.commandPoints.length)state.lastPoint={...state.commandPoints.at(-1)};response=result(true,'Last SPLINE control vertex removed.',true);}}
          else if(['C','CLOSE','F','FIT','D','DEGREE'].includes(token))response=result(false,'SPLINE supports open degree-three CV construction; periodic/Fit/degree options are unsupported.');
          else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }else if(['BLOCK','INSERT'].includes(state.command)&&state.commandPhase!=='selection'){
          if(state.commandPhase==='name'){
            if(typeof inputText!=='string'||!validLayerName(inputText))response=result(false,'Enter a valid nonempty block name.');
            else if(state.command==='BLOCK'&&state.blocks.some(block=>block.name===inputText))response=result(false,'That block name already exists; redefining blocks is unsupported.');
            else if(state.command==='INSERT'&&!state.blocks.some(block=>block.name===inputText))response=result(false,`Block not found. Available: ${state.blocks.map(block=>block.name).join(', ')||'(none)'}`);
            else{state.commandData.blockName=inputText;state.commandPhase=state.command==='BLOCK'?'block-base':'position';state.commandData.targetKind='point';state.prompt=state.command==='BLOCK'?'BLOCK Specify base point:':'INSERT Specify insertion point:';response=result(true,'Block name accepted.');}
          }else if(state.commandPhase==='insert-scale'){const scale=inputText===''?1:positive(scalar(inputText,'Block scale'),'Block scale');state.commandData.scale=scale;state.commandPhase='insert-angle';state.prompt='INSERT Specify rotation angle <0>:';response=result(true,'Uniform scale accepted.');}
          else if(state.commandPhase==='insert-angle')response=completeInsert(inputText===''?0:angleScalar(inputText));
          else response=editor.submitPoint(parseCoordinate(inputText,state.lastPoint));
        }else if(state.command==='ARRAYRECT'&&state.commandPhase!=='selection'){
          const value=['rows','columns'].includes(state.commandPhase)?scalar(inputText,state.commandPhase):lengthScalar(inputText);if(['rows','columns'].includes(state.commandPhase)){
            if(!Number.isInteger(value)||value<1||value>100)throw new Error('Array rows/columns must be integers from 1 through 100.');state.commandData[state.commandPhase]=value;
            if(state.commandPhase==='rows'){state.commandPhase='columns';state.prompt='ARRAYRECT Enter column count (1..100):';}else{if(state.commandData.rows*value>1000||transformSources.length*(state.commandData.rows*value-1)>10000)throw new Error('Array exceeds the 1000-cell/10000-copy limit.');state.commandPhase='row-spacing';state.prompt='ARRAYRECT Specify signed row spacing:';}response=result(true,'Array count accepted.');
          }else if(state.commandPhase==='row-spacing'){if(value===0&&state.commandData.rows>1)throw new Error('Multiple array rows require nonzero spacing.');state.commandData.rowSpacing=value;state.commandPhase='column-spacing';state.prompt='ARRAYRECT Specify signed column spacing:';response=result(true,'Row spacing accepted.');}
          else{if(value===0&&state.commandData.columns>1)throw new Error('Multiple array columns require nonzero spacing.');state.commandData.columnSpacing=value;response=completeArray();}
        }else if(['FILLET','CHAMFER'].includes(state.command)){
          if(state.commandPhase==='radius'){if(['R','RADIUS'].includes(token))response=result(true,'Enter the nonnegative fillet radius.');else{const radius=lengthScalar(inputText);if(radius<0)throw new Error('FILLET radius must be nonnegative.');state.commandData.radius=radius;state.commandPhase=state.commandData.cornerFirst?'second-line':'first-line';state.commandData.targetKind='object';state.prompt=`FILLET Pick ${state.commandData.cornerFirst?'second':'first'} LINE near the side to retain:`;response=result(true,'Radius accepted.');}}
          else if(state.commandPhase==='distance-first'){if(['D','DISTANCE'].includes(token))response=result(true,'Enter the first chamfer distance.');else{const value=lengthScalar(inputText);if(value<0)throw new Error('CHAMFER distances must be nonnegative.');state.commandData.distance1=value;state.commandPhase='distance-second';state.prompt='CHAMFER Specify second nonnegative distance:';response=result(true,'First distance accepted.');}}
          else if(state.commandPhase==='distance-second'){const value=lengthScalar(inputText);if(value<0)throw new Error('CHAMFER distances must be nonnegative.');state.commandData.distance2=value;state.commandPhase='first-line';state.commandData.targetKind='object';state.prompt='CHAMFER Pick first LINE near the side to retain:';response=result(true,'Second distance accepted.');}
          else if(state.command==='FILLET'&&['R','RADIUS'].includes(token)){state.commandPhase='radius';state.commandData.targetKind='none';state.prompt='FILLET Specify nonnegative radius:';response=result(true,'Specify another radius.');}
          else if(typeof inputText==='string'&&state.entities.some(entity=>entity.id===inputText))response=chooseCornerOrHatch(inputText);
          else response=editor.submitPoint(parseCoordinate(inputText,state.lastPoint));
        }else if(state.command==='HATCH'){
          if(state.commandPhase==='pattern'){if(inputText===''||['S','SOLID'].includes(token)){state.commandData.pattern='solid';state.commandPhase='boundary';state.commandData.targetKind='object';state.prompt='HATCH Pick one closed boundary object:';response=result(true,'Solid pattern selected.');}else if(['P','PARALLEL'].includes(token)){state.commandData.pattern='parallel';state.commandPhase='hatch-angle';state.prompt='HATCH Specify parallel-line angle:';response=result(true,'Parallel pattern selected.');}else response=result(false,'HATCH supports Solid or Parallel only.');}
          else if(state.commandPhase==='hatch-angle'){state.commandData.angle=angleScalar(inputText)%180;state.commandPhase='hatch-spacing';state.prompt='HATCH Specify positive line spacing:';response=result(true,'Pattern angle accepted.');}
          else if(state.commandPhase==='hatch-spacing'){state.commandData.spacing=positive(lengthScalar(inputText),'Hatch spacing');state.commandPhase='boundary';state.commandData.targetKind='object';state.prompt='HATCH Pick one closed boundary object:';response=result(true,'Pattern spacing accepted.');}
          else if(typeof inputText==='string'&&state.entities.some(entity=>entity.id===inputText))response=chooseCornerOrHatch(inputText);
          else response=editor.submitPoint(parseCoordinate(inputText,state.lastPoint));
        }else if(state.command==='STRETCH')response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        else if(state.command==='PEDIT'&&state.commandPhase!=='selection'){
          if(state.commandPhase==='convert'){if(inputText===''||['Y','YES'].includes(token))response=peditChange('convert');else if(['N','NO'].includes(token))response=finish('PEDIT conversion declined.');else response=result(false,'Choose Yes or No.');}
          else if(state.commandPhase==='join-selection'){if(inputText==='')response=peditJoin();else if(['ALL','SELECT ALL'].includes(token))response=editor.select(state.entities.filter(entity=>entity.id!==state.commandData.peditId).map(entity=>entity.id),{add:true});else if(typeof inputText==='string'&&state.entities.some(entity=>entity.id===inputText))response=editor.select([inputText],{add:true});else response=editor.submitPoint(parseCoordinate(inputText,state.lastPoint));}
          else if(inputText===''){state.selectionIds=[];response=finish('PEDIT completed.');}
          else if(['O','OPEN','C','CLOSE','R','REVERSE'].includes(token))response=peditChange(({O:'open',OPEN:'open',C:'close',CLOSE:'close',R:'reverse',REVERSE:'reverse'})[token]);
          else if(['J','JOIN'].includes(token)){state.selectionIds=[];state.commandPhase='join-selection';state.commandData.targetKind='object';state.prompt='PEDIT Select additional LINE/open PLINE paths, then Enter:';response=result(true,'Select connected paths.');}
          else if(['U','UNDO'].includes(token)){const previous=editingSteps.pop();if(!previous)response=result(false,'No PEDIT edit to undo.');else{restore(previous);peditOptionPrompt();response=result(true,'Last PEDIT edit removed.',true);}}
          else response=result(false,'PEDIT supports Open, Close, Join, Reverse, Undo or Enter.');
        }
        else if(state.command==='VPOINT')response=editor.submitPoint(parseCoordinate3D(inputText));
        else if(state.command==='PLAN'){
          if(inputText===''||['W','WORLD'].includes(token)){state.camera3d=normalizeCamera3D({...state.camera3d,yaw:-90,pitch:90,roll:0,mode:'top',projection:'orthographic'});response=finish('World XY plan view.');}
          else response=result(false,'PLAN supports World only; UCS options are not implemented.');
        }
        else if(state.command==='3DORBITCTR')response=editor.submitPoint(parseCoordinate(inputText,state.lastPoint));
        else if(state.command==='3DPOLY'){
          if(inputText==='')response=finish('3DPOLY completed.');
          else if(['U','UNDO'].includes(token)){
            if(state.commandPoints.length<2)response=result(false,'No 3DPOLY segment to undo.');
            else{state.commandPoints.pop();const path=state.entities.find(entity=>entity.id===transactionIds[0]);if(state.commandPoints.length===1){state.entities=state.entities.filter(entity=>entity.id!==transactionIds[0]);transactionIds=[];}else path.points=clone(state.commandPoints);state.lastPoint={...state.commandPoints.at(-1)};updateLinePrompt();response=result(true,'Last 3DPOLY segment removed.',true);}
          }else if(['C','CLOSE'].includes(token)){
            const points=clone(state.commandPoints);if(points.length>2&&samePoint3(points[0],points.at(-1)))points.pop();validatePolyline3D(points,true);const path=state.entities.find(entity=>entity.id===transactionIds[0]);path.points=points;path.closed=true;state.lastPoint={...points[0]};response=finish('3DPOLY closed.');
          }else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }else if(['BOX','CYLINDER','SPHERE'].includes(state.command)||state.command==='EXTRUDE'&&state.commandPhase==='height'){
          if(['radius','height'].includes(state.commandPhase)&&scalarInput(inputText)){
            const value=lengthScalar(inputText);if(state.commandPhase==='radius'&&state.command==='CYLINDER'){validateCylinderRadius(state.commandPoints[0],value);state.commandData.radius=value;state.commandPhase='height';state.commandData.heightBase={...state.commandPoints[0]};state.prompt='CYLINDER Specify nonzero height:';response=result(true,'Radius accepted.');}
            else response=completePrimitive(value);
          }else if(inputText==='')response=result(false,'Enter the requested 3D point or numeric value, or Escape to cancel.');
          else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }
        else if(state.command==='TEXT'||state.command==='MTEXT'){
          if(state.command==='MTEXT'&&state.commandPhase==='second-corner'&&['H','HEIGHT'].includes(token)){state.commandPhase='mtext-height';state.prompt='MTEXT Specify text height:';response=result(true,'Specify positive text height.');}
          else if(['height','mtext-height'].includes(state.commandPhase)){
            const height=inputText===''?state.commandData.height:positive(lengthScalar(inputText),'Text height');state.commandData.height=height;
            state.commandPhase=state.command==='TEXT'?'rotation':'second-corner';state.prompt=state.command==='TEXT'?'TEXT Specify rotation angle:':'MTEXT Specify opposite corner:';response=result(true,'Text height accepted.');
          }else if(state.commandPhase==='rotation'&&(inputText===''||scalarInput(inputText))){
            state.commandData.rotation=inputText===''?state.commandData.rotation:angleScalar(inputText);state.commandPhase='text';state.commandData.targetKind='none';state.prompt='TEXT Enter text:';response=result(true,'Text rotation accepted.');
          }else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }else if(DIM_COMMANDS.has(state.command)){
          if(state.command==='DIMLINEAR'&&state.commandPhase==='placement'&&['H','HORIZONTAL','V','VERTICAL'].includes(token)){
            state.commandData.axisAngle=['H','HORIZONTAL'].includes(token)?0:90;response=result(true,'Dimension direction accepted.');
          }else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }else if(['DIST','ID','AREA'].includes(state.command)){
          if(state.command==='AREA'&&['U','UNDO'].includes(token)){
            if(!state.commandPoints.length)response=result(false,'No AREA point to undo.');
            else{state.commandPoints.pop();if(state.commandPoints.length)state.lastPoint={...state.commandPoints.at(-1)};state.prompt=state.commandPoints.length?'AREA Specify next point or Enter to finish:':'AREA Specify first point:';response=result(true,'Last AREA point removed.');}
          }else if(state.command==='AREA'&&(inputText===''||['C','CLOSE'].includes(token))){
            if(state.commandPoints.length<3)response=result(false,'AREA requires at least three points.');
            else{const origins=state.commandPoints,base=origins[0];let area=0,perimeter=0;origins.forEach((p,index)=>{const q=origins[(index+1)%origins.length];area+=(p.x-base.x)*(q.y-base.y)-(q.x-base.x)*(p.y-base.y);perimeter+=Math.hypot(q.x-p.x,q.y-p.y);});if(!finite(area)||!finite(perimeter))throw new Error('Measurement exceeds the supported numeric range.');response=finishMeasurement({kind:'area',area:Math.abs(area)/2,perimeter});}
          }else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        }
        else if (state.command === 'ZOOM') {
          if (token === 'E' || token === 'EXTENTS') {
            const visible = state.entities.filter(entity => layerOf(entity)?.visible);
            state.viewport = zoomExtents(visible, state.viewport, state.canvasSize.width, state.canvasSize.height,40,state);
            idle(); response = result(true, 'Zoom extents.', true);
          } else if (inputText === '') { idle(); response = result(true, 'ZOOM canceled.'); }
          else response = result(false, 'ZOOM supports E (Extents).');
        } else if (SELECT_COMMANDS.has(state.command) && state.commandPhase === 'selection') {
            if (inputText === '') response = acceptTransformSelection();
            else if (['ALL', 'SELECT ALL'].includes(token)) response = editor.select(state.entities.map(entity => entity.id), { add: true });
            else if (['LAST', 'L'].includes(token)) { const last = state.entities.filter(editable).at(-1); response = last ? editor.select([last.id], { add: true }) : result(false, 'No objects available.'); }
            else if (typeof inputText === 'string' && state.entities.some(entity => entity.id === inputText)) response = editor.select([inputText], { add: true });
            else response = editor.submitPoint(parseCoordinate(inputText, state.lastPoint));
        } else if (state.command === 'CUTCLIP') response = result(false, 'CUTCLIP awaits clipboard acknowledgement; Escape cancels without erasing.');
        else if (state.command === 'COPYBASE') {
          if (inputText === '') response = result(false, 'Specify an explicit clipboard base point.');
          else response = editor.submitPoint(parseCoordinate(inputText, state.lastPoint));
        } else if (state.command === 'PASTECLIP') {
          if (inputText === '') response = result(false, 'Specify an insertion point or press Escape.');
          else response = pasteClipboard(parseCoordinate(inputText, clipboard.base));
        } else if (REPEATED_EDITS.has(state.command)) {
          if (['U', 'UNDO'].includes(token)) response = editingUndo();
          else if (inputText === '') { state.selectionIds = []; response = finish(`${state.command} completed.`); }
          else if (state.command === 'OFFSET' && state.commandPhase === 'distance') {
            const distance = lengthScalar(inputText);
            if (distance <= 0) throw new Error('Offset distance must be positive and finite.');
            state.commandData.distance = distance; state.commandPhase = 'object'; state.commandData.targetKind = 'object';
            state.prompt = 'OFFSET Select object to offset or [Undo] <finish>:'; response = result(true, 'Offset distance accepted.');
          } else if (typeof inputText === 'string' && state.entities.some(entity => entity.id === inputText) && state.commandData.targetKind === 'object') {
            const entity = state.entities.find(entity => entity.id === inputText);
            if (!editable(entity)) response = result(false, 'Object must be visible and unlocked.');
            else {
              if (state.command === 'OFFSET') {
                if (!['LINE', 'CIRCLE', 'RECTANG'].includes(entity.type)) throw new Error('OFFSET currently supports LINE, CIRCLE and RECTANG.');
                state.commandData.offsetSource = clone(entity); state.commandPhase = 'side'; state.commandData.targetKind = 'point'; state.prompt = 'OFFSET Specify point on side to offset:';
                response = result(true, 'OFFSET object accepted.');
              } else response = result(false, 'TRIM/EXTEND require a point identifying which end or segment to edit.');
            }
          } else response = editor.submitPoint(parseCoordinate(inputText, state.lastPoint));
        } else if (state.command === 'BREAK') {
          if (inputText === '') response = result(false, 'Specify both break points or press Escape.');
          else response = editor.submitPoint(parseCoordinate(inputText, state.commandPoints.at(-1) ?? state.lastPoint));
        } else if (TRANSFORMS.has(state.command)) {
          if(state.command==='ROTATE3D'&&state.commandPhase==='axis'){
            if(!['X','Y','Z'].includes(token))response=result(false,'ROTATE3D supports world axis X, Y or Z only.');
            else{state.commandData.axis=token;state.commandPhase='base';state.commandData.targetKind='point';state.prompt=`ROTATE3D Specify a point on the world ${token} axis:`;response=result(true,`${token} axis accepted.`);}
          }else if (state.command === 'COPY' && state.commandPhase === 'mode') {
            if (inputText === '' || ['S', 'SINGLE', 'M', 'MULTIPLE'].includes(token)) {
              if (inputText !== '') state.commandData.copyMode = ['S', 'SINGLE'].includes(token) ? 'single' : 'multiple';
              state.commandPhase = 'base'; state.prompt = 'COPY Specify base point or [Mode]:'; response = result(true, `COPY mode: ${state.commandData.copyMode}.`);
            } else response = result(false, 'Choose Single or Multiple copy mode.');
          } else if (state.command === 'COPY' && state.commandPhase === 'base' && ['M', 'O', 'MO', 'MODE'].includes(token)) {
            state.commandPhase = 'mode'; state.prompt = `COPY Enter copy mode [Single/Multiple] <${state.commandData.copyMode === 'single' ? 'Single' : 'Multiple'}>:`; response = result(true, 'Choose Single or Multiple copy mode.');
          } else if (state.command === 'COPY' && state.commandPhase === 'base' && ['S', 'SINGLE', 'MULTIPLE'].includes(token)) {
            state.commandData.copyMode = ['S', 'SINGLE'].includes(token) ? 'single' : 'multiple'; response = result(true, `COPY mode: ${state.commandData.copyMode}.`);
          } else if (state.command === 'COPY' && state.commandPhase === 'target' && ['U', 'UNDO'].includes(token)) {
            const batch = copyBatches.pop();
            if (!batch) response = result(false, 'No COPY destination to undo.');
            else {
              const ids = new Set(batch.ids); state.entities = state.entities.filter(entity => !ids.has(entity.id));
              state.lastPoint = { ...(copyBatches.at(-1)?.destination ?? state.commandPoints[0]) }; state.commandData.copyCount = copyBatches.length;
              state.prompt = 'COPY Specify second point or [Exit/Undo] <Exit>:'; response = result(true, 'Last COPY destination removed.', true);
            }
          } else if (state.command === 'COPY' && state.commandPhase === 'target' && (inputText === '' || ['E', 'EXIT'].includes(token))) {
            state.selectionIds = []; response = finish('COPY completed.');
          } else if (state.command === 'MIRROR' && state.commandPhase === 'delete-choice') {
            if (inputText === '' || ['N', 'NO', 'Y', 'YES'].includes(token)) {
              state.commandData.deleteOriginal = ['Y', 'YES'].includes(token); response = completeTransform(state.commandPoints[1]);
            } else response = result(false, 'Choose Yes or No to delete the source objects.');
          } else if (state.command === 'SCALE' && state.commandPhase === 'factor' && typeof inputText === 'string' && new RegExp(`^${NUMBER}$`).test(inputText)) response = completeTransform(scalar(inputText, 'Scale factor'));
          else if ((state.commandPhase === 'base' && ['D', 'DISPLACEMENT'].includes(token)) || (state.command === 'COPY' && state.commandPhase === 'target' && ['A', 'ARRAY'].includes(token)) || (state.command === 'ROTATE' && state.commandPhase === 'angle' && ['R', 'REFERENCE', 'C', 'COPY'].includes(token)) || (state.command === 'SCALE' && state.commandPhase === 'factor' && ['R', 'REFERENCE', 'C', 'COPY'].includes(token))) response = result(false, `That ${state.command} option is not implemented. Follow the current point or angle prompt.`);
          else if (inputText === '') response = result(false, state.commandPhase === 'angle' ? 'Enter a rotation angle or pick a direction point.' : 'Enter a point or press Escape to cancel.');
          else if (state.commandPhase === 'angle' && scalarInput(inputText)) response = completeTransform(angleScalar(inputText));
          else response = editor.submitPoint(parseCoordinate(inputText, state.commandPoints.at(-1) ?? state.lastPoint));
        } else if(state.command==='ARC') {
          if(inputText==='')response=result(false,'ARC requires three points, or press Escape to cancel.');
          else if(['C','CENTER','E','END','D','DIRECTION','A','ANGLE','R','RADIUS','L','LENGTH'].includes(token))response=result(false,'ARC currently supports three-point construction only.');
          else response=editor.submitPoint(parseCoordinate(inputText,state.commandPoints.at(-1)??state.lastPoint));
        } else if (state.command === 'CIRCLE') {
          if (inputText === '') response = result(false, 'Enter a center or positive radius, or press Escape to cancel.');
          else if (state.commandPhase === 'center' && ['3P', '2P', 'TTR'].includes(token)) response = result(false, 'That CIRCLE construction mode is not implemented. Specify a center point and radius.');
          else if (state.commandPhase === 'radius' && ['D', 'DIAMETER'].includes(token)) {
            state.commandData.diameter = true; state.prompt = 'CIRCLE Specify diameter:'; response = result(true, 'Diameter input selected.');
          } else if (state.commandPhase === 'radius' && scalarInput(inputText)) {
            const distance = lengthScalar(inputText);
            response = completeCircle(state.commandData.diameter ? distance / 2 : distance);
          } else response = editor.submitPoint(parseCoordinate(inputText, state.commandPoints.at(-1) ?? state.lastPoint));
        } else if (state.command) {
          if (inputText === '') response = finish(`${state.command} completed.`);
          else if (state.command === 'PLINE' && ['U', 'UNDO'].includes(token)) {
            if (state.commandPoints.length < 2) response = result(false, 'No PLINE segment to undo.');
            else {
              state.commandPoints.pop(); const polyline = state.entities.find(entity => entity.id === transactionIds[0]);
              if (state.commandPoints.length === 1) { state.entities = state.entities.filter(entity => entity.id !== transactionIds[0]); transactionIds = []; }
              else polyline.points = clone(state.commandPoints);
              state.lastPoint = { ...state.commandPoints.at(-1) }; updateLinePrompt(); response = result(true, 'Last PLINE segment removed.', true);
            }
          } else if (state.command === 'PLINE' && ['C', 'CLOSE'].includes(token)) {
            if (state.commandPoints.length < 3) response = result(false, 'Close requires at least three PLINE vertices.');
            else {
              const polyline = state.entities.find(entity => entity.id === transactionIds[0]);
              const points = clone(state.commandPoints); if (samePoint(points[0], points.at(-1))) points.pop();
              validatePolyline(points, true);check3DResources([{...polyline,points,closed:true}],[polyline.id]); polyline.points = points; polyline.closed = true; state.lastPoint = { ...points[0] }; response = finish('PLINE closed.');
            }
          } else if (state.command === 'PLINE' && ['A', 'ARC', 'W', 'WIDTH', 'H', 'HALFWIDTH'].includes(token)) response = result(false, 'PLINE currently supports straight, zero-width segments.');
          else if (state.command === 'LINE' && ['U', 'UNDO'].includes(token)) {
            if (!transactionIds.length) response = result(false, 'No LINE segment to undo.');
            else {
              const lastId = transactionIds.pop();
              state.entities = state.entities.filter(entity => entity.id !== lastId);
              state.commandPoints.pop(); state.lastPoint = { ...state.commandPoints.at(-1) }; updateLinePrompt();
              response = result(true, 'Last LINE segment removed.', true);
            }
          } else if (state.command === 'LINE' && ['C', 'CLOSE'].includes(token)) {
            if (state.commandPoints.length < 3) response = result(false, 'Close requires at least two LINE segments.');
            else {
              const a = state.commandPoints.at(-1), b = state.commandPoints[0];
              if (!samePoint(a, b)) { const entity = { id: id(), type: 'LINE', start: { ...a }, end: { ...b }, layer: state.currentLayer };check3DResources([entity]); state.entities.push(entity); transactionIds.push(entity.id); }
              state.lastPoint = { ...b }; response = finish('LINE closed.');
            }
          } else if(['LINE','PLINE'].includes(state.command)&&state.commandPoints.length&&scalarInput(inputText))response=editor.submitPoint(distancePoint(inputText,options));
          else response = editor.submitPoint(parseCoordinate(inputText, state.commandPoints.at(-1) ?? state.lastPoint));
        } else if (['L', 'LINE'].includes(token)) response = startCommand('LINE');
        else if(['ELLIPSE','EL','SPLINE','SPL','HATCH','H','FILLET','F','CHAMFER','CHA','ARRAYRECT','AR','STRETCH','S','PEDIT','PE','BLOCK','B','INSERT','I'].includes(token))response=startCommand(({EL:'ELLIPSE',SPL:'SPLINE',H:'HATCH',F:'FILLET',CHA:'CHAMFER',AR:'ARRAYRECT',S:'STRETCH',PE:'PEDIT',B:'BLOCK',I:'INSERT'})[token]??token);
        else if(DRAW3D.has(token)||['EXTRUDE','ROTATE3D','3DORBITCTR','VPOINT','PLAN'].includes(token))response=startCommand(token);
        else if(['3DORBIT','3DFORBIT'].includes(token))response=result(true,`${token} navigation is available in the 3D workspace orbit controls.`);
        else if (['PL', 'PLINE', 'POLYLINE'].includes(token)) response = startCommand('PLINE');
        else if(['TEXT','DT','DTEXT'].includes(token))response=startCommand('TEXT');
        else if(['MTEXT','-MTEXT','MT','T'].includes(token))response=startCommand('MTEXT');
        else if(['TEXTEDIT','DDEDIT','ED'].includes(token))response=startCommand('TEXTEDIT');
        else if(['DIMLINEAR','DLI','DIMALIGNED','DAL','DIMRADIUS','DRA','DIMDIAMETER','DDI','DIMANGULAR','DAN'].includes(token))response=startCommand(({DLI:'DIMLINEAR',DAL:'DIMALIGNED',DRA:'DIMRADIUS',DDI:'DIMDIAMETER',DAN:'DIMANGULAR'})[token]??token);
        else if(['DIST','DI','ID','AREA','AA'].includes(token))response=startCommand(({DI:'DIST',AA:'AREA'})[token]??token);
        else if(['STYLE','ST','DIMSTYLE','UNITS'].includes(token))response=result(true,`Edit ${token==='ST'?'style':token.toLowerCase()} in the Settings dialog.`);
        else if(['A','ARC'].includes(token))response=startCommand('ARC');
        else if (['REC', 'RECTANG', 'RECTANGLE'].includes(token)) response = startCommand('RECTANG');
        else if (['C', 'CIRCLE'].includes(token)) response = startCommand('CIRCLE');
        else if (['M', 'MOVE'].includes(token)) response = startCommand('MOVE');
        else if (['CO', 'CP', 'COPY'].includes(token)) response = startCommand('COPY');
        else if (['RO', 'ROTATE'].includes(token)) response = startCommand('ROTATE');
        else if (['SC', 'SCALE'].includes(token)) response = startCommand('SCALE');
        else if (['MI', 'MIRROR'].includes(token)) response = startCommand('MIRROR');
        else if (['TR', 'TRIM'].includes(token)) response = startCommand('TRIM');
        else if (['EX', 'EXTEND'].includes(token)) response = startCommand('EXTEND');
        else if (['O', 'OFFSET'].includes(token)) response = startCommand('OFFSET');
        else if (['BR', 'BREAK'].includes(token)) response = startCommand('BREAK');
        else if(['J','JOIN'].includes(token))response=startCommand('JOIN');
        else if(['X','EXPLODE'].includes(token))response=startCommand('EXPLODE');
        else if (['COPYCLIP', 'COPYBASE', 'CUTCLIP', 'PASTECLIP'].includes(token)) response = startCommand(token);
        else if (['U', 'UNDO'].includes(token)) response = editor.undo();
        else if (['REDO', 'MREDO'].includes(token)) response = editor.redo();
        else if (['E', 'ERASE', 'DELETE'].includes(token)) response = startCommand('ERASE');
        else if (['Z', 'ZOOM'].includes(token)) { state.command = 'ZOOM'; state.commandPoints = []; state.prompt = 'ZOOM Enter option [Extents]:'; response = result(true, 'Enter E for extents.'); }
        else if (['Z E', 'ZOOM E', 'ZE', 'EXTENTS'].includes(token)) {
          state.viewport = zoomExtents(state.entities.filter(entity => layerOf(entity)?.visible), state.viewport, state.canvasSize.width, state.canvasSize.height,40,state);
          response = result(true, 'Zoom extents.', true);
        } else if (['ALL', 'SELECT ALL'].includes(token)) { editor.select(state.entities.map(entity => entity.id)); response = result(true, `${state.selectionIds.length} objects selected.`); }
        else if (inputText === '') response = result(true, 'Ready.');
        else response = result(false, `Unknown command: ${String(inputText)}. Use a drawing or editing command, U, REDO, or ZOOM.`);
      } catch (error) { response = result(false, error.message); }
      state.history.push({ input: typeof inputText === 'string' ? inputText : JSON.stringify(inputText), prompt: priorPrompt, message: response.message, ok: response.ok });
      if (state.history.length > 200) state.history.shift();
      return response;
    },
    submitPoint(raw) {
      try {
        const p = threeDPointMode()?point3(raw):point(raw);
        if(state.command==='ELLIPSE'){
          drawingLayerReady();if(['axis-first','ellipse-center'].includes(state.commandPhase)){state.commandPoints=[p];state.lastPoint={...p};if(state.commandPhase==='ellipse-center'){state.commandData.center=p;state.commandPhase='major-endpoint';state.prompt='ELLIPSE Specify first-axis endpoint:';}else{state.commandPhase='axis-second';state.prompt='ELLIPSE Specify other endpoint of first axis:';}return result(true,'Ellipse axis origin accepted.');}
          if(['axis-second','major-endpoint'].includes(state.commandPhase)){const first=state.commandPoints[0],center=state.commandPhase==='axis-second'?{x:midpoint(first.x,p.x),y:midpoint(first.y,p.y)}:first,major=state.commandPhase==='axis-second'?{x:p.x/2-first.x/2,y:p.y/2-first.y/2}:{x:p.x-center.x,y:p.y-center.y};point(major);positive(Math.hypot(major.x,major.y),'First-axis length');state.commandData.center=center;state.commandData.major=major;state.commandPoints.push(p);state.commandPhase='minor-distance';state.prompt='ELLIPSE Specify positive distance to other axis:';state.lastPoint={...p};return result(true,'First axis accepted.');}
          return completeEllipse(Math.hypot(p.x-state.commandData.center.x,p.y-state.commandData.center.y));
        }
        if(state.command==='SPLINE'){
          if(state.commandPhase==='method')return result(false,'Choose the CV method in the command line.');drawingLayerReady();const controls=[...clone(state.commandPoints),p];if(controls.length>1024)throw new Error('SPLINE exceeds 1024 control vertices.');
          if(controls.length>=4){const entity={id:transactionIds[0],type:'SPLINE',degree:3,controlPoints:controls,knots:makeClampedKnots(controls.length),closed:false,layer:state.currentLayer};validateSpline(entity);splineBoundsPoints(entity).forEach(point);check3DResources([entity],transactionIds);if(!transactionIds.length){entity.id=id();state.entities.push(entity);transactionIds.push(entity.id);}else state.entities=state.entities.map(source=>source.id===entity.id?entity:source);}
          state.commandPoints.push(p);state.lastPoint={...p};state.prompt='SPLINE Specify next control vertex or [Undo] <finish after four vertices>:';return result(true,'Control vertex accepted.',controls.length>=4);
        }
        if(state.command==='BLOCK'&&state.commandPhase==='block-base'){state.commandPoints=[p];state.commandPhase='selection';state.commandData.targetKind='object';state.prompt='BLOCK Select flat planar source objects, then Enter:';state.lastPoint={...p};if(state.selectionIds.length)return acceptTransformSelection();return result(true,'Block base accepted. Select source objects.');}
        if(state.command==='INSERT'&&state.commandPhase==='position'){state.commandPoints=[p];state.commandData.scale=1;state.commandPhase='insert-scale';state.commandData.targetKind='none';state.prompt='INSERT Specify positive uniform scale <1>:';return result(true,'Insertion point accepted.');}
        if(['HATCH','FILLET','CHAMFER'].includes(state.command)&&state.commandData.targetKind==='object')return pickCornerOrHatch(p);
        if(state.command==='PEDIT'&&state.commandPhase==='join-selection'){const entityId=hitTest(state.entities.filter(editable),p,8/state.viewport.scale,state);return entityId?editor.select([entityId],{add:true}):result(false,'No joinable object at that point.');}
        if(state.command==='STRETCH'){
          if(state.commandPhase==='window-first'){state.commandPoints=[p];state.commandPhase='window-second';state.prompt='STRETCH Specify opposite crossing-window corner:';return result(true,'First crossing-window corner accepted.');}
          if(state.commandPhase==='window-second')return acceptStretchWindow(state.commandPoints[0],p);
          if(state.commandPhase==='base'){state.commandPoints=[p];state.commandPhase='target';state.prompt='STRETCH Specify second point:';return result(true,'Stretch base accepted.');}return completeStretch(p);
        }
        if(state.command==='VPOINT'){
          const length=Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z));if(length===0)throw new Error('VPOINT view direction must be nonzero.');const x=p.x/length,y=p.y/length,z=p.z/length;
          state.camera3d=normalizeCamera3D({...state.camera3d,yaw:Math.atan2(y,x)*180/Math.PI,pitch:Math.atan2(z,Math.hypot(x,y))*180/Math.PI,roll:0,mode:'custom',projection:'orthographic'});return finish('3D view direction updated.');
        }
        if(state.command==='3DORBITCTR'){state.camera3d=normalizeCamera3D({...state.camera3d,orbitCenter:p,autoTarget:false});state.lastPoint={...p};return finish('3D orbit center updated without recentering the view.');}
        if(DRAW3D.has(state.command)){
          drawingLayerReady();
          if(state.command==='3DPOLY'){
            if(!state.commandPoints.length){state.commandPoints=[p];state.lastPoint={...p};state.prompt='3DPOLY Specify next point or [Undo]:';return result(true,'First 3D point accepted.');}
            const points=[...clone(state.commandPoints),p];validatePolyline3D(points,false);const path={id:transactionIds[0],type:'POLY3D',points,closed:false,layer:state.currentLayer};check3DResources([path],transactionIds);
            if(!transactionIds.length){path.id=id();state.entities.push(path);transactionIds.push(path.id);}else state.entities=state.entities.map(entity=>entity.id===path.id?path:entity);
            state.commandPoints.push(p);state.lastPoint={...p};updateLinePrompt();return result(true,'3DPOLY segment added.',true);
          }
          if(['first-corner','center'].includes(state.commandPhase)){state.commandPoints=[p];state.lastPoint={...p};state.commandPhase=state.command==='BOX'?'opposite-corner':'radius';state.prompt=state.command==='BOX'?'BOX Specify opposite corner in the same XY plane:':`${state.command} Specify positive radius:`;return result(true,'3D origin accepted.');}
          if(state.command==='BOX'&&state.commandPhase==='opposite-corner'){
            validateBoxBase(state.commandPoints[0],p);state.commandPoints.push(p);state.lastPoint={...p};state.commandData.heightBase={...state.commandPoints[0]};state.commandPhase='height';state.prompt='BOX Specify nonzero height:';return result(true,'Base rectangle accepted.');
          }
          if(state.commandPhase==='radius'){
            const center=state.commandPoints[0];if(state.command==='CYLINDER'&&p.z!==center.z)throw new Error('Cylinder radius point must be in the center XY plane.');const radius=positive(Math.hypot(p.x-center.x,p.y-center.y,p.z-center.z),'Radius');
            if(state.command==='SPHERE')return completePrimitive(radius);
            validateCylinderRadius(center,radius);state.commandData.radius=radius;state.commandData.heightBase={...center};state.commandPhase='height';state.prompt='CYLINDER Specify nonzero height:';state.lastPoint={...p};return result(true,'Radius accepted.');
          }
          if(state.commandPhase==='height')return completePrimitive(p.z-state.commandData.heightBase.z);
          return result(false,'Enter the requested 3D point or numeric value.');
        }
        if(state.command==='EXTRUDE'&&state.commandPhase==='height')return completePrimitive((raw.z===undefined?state.settings.constructionElevation:point3(raw).z)-state.commandData.heightBase.z);
        if(state.command==='TEXT'||state.command==='MTEXT'){
          drawingLayerReady();
          if(['position','first-corner'].includes(state.commandPhase)){state.commandPoints=[p];state.lastPoint={...p};state.commandPhase=state.command==='TEXT'?'height':'second-corner';state.prompt=state.command==='TEXT'?'TEXT Specify height:':'MTEXT Specify opposite corner or [Height]:';return result(true,'Text origin accepted.');}
          if(state.command==='TEXT'&&state.commandPhase==='height'){state.commandData.height=positive(Math.hypot(p.x-state.commandPoints[0].x,p.y-state.commandPoints[0].y),'Text height');state.commandPhase='rotation';state.prompt='TEXT Specify rotation angle:';return result(true,'Text height accepted.');}
          if(state.command==='TEXT'&&state.commandPhase==='rotation'){const origin=state.commandPoints[0];if(samePoint(origin,p))throw new Error('Rotation direction point must differ from insertion.');state.commandData.rotation=Math.atan2(p.y-origin.y,p.x-origin.x)*180/Math.PI;state.commandPhase='text';state.commandData.targetKind='none';state.prompt='TEXT Enter text:';return result(true,'Text rotation accepted.');}
          if(state.command==='MTEXT'&&state.commandPhase==='second-corner'){const first=state.commandPoints[0];state.commandData.width=positive(Math.abs(p.x-first.x),'MTEXT width');state.commandData.position={x:Math.min(p.x,first.x),y:Math.max(p.y,first.y)};state.commandPhase='text';state.commandData.targetKind='none';state.prompt='MTEXT Enter multiline text:';return result(true,'Text box accepted.');}
          return result(false,'Enter the requested text or numeric value.');
        }
        if(DIM_COMMANDS.has(state.command)){
          drawingLayerReady();
          if(state.command==='DIMANGULAR'&&state.commandPhase!=='placement'){
            if(state.commandPhase==='vertex'){state.commandPoints=[p];state.commandPhase='ray-first';state.prompt='DIMANGULAR Specify point on first ray:';}
            else{const vertex=state.commandPoints[0];if(samePoint(vertex,p))throw new Error('Angular ray point must differ from its vertex.');if(state.commandPhase==='ray-second'){const first=state.commandPoints[1],a=Math.atan2(first.y-vertex.y,first.x-vertex.x),b=Math.atan2(p.y-vertex.y,p.x-vertex.x);if(Math.abs(Math.sin(a-b))<1e-12&&Math.cos(a-b)>0)throw new Error('Angular rays need distinct directions.');}state.commandPoints.push(p);state.commandPhase=state.commandPhase==='ray-first'?'ray-second':'placement';state.prompt=state.commandPhase==='placement'?'DIMANGULAR Specify arc placement to choose minor/reflex sector:':'DIMANGULAR Specify point on second ray:';}state.lastPoint={...p};return result(true,'Angular definition point accepted.');
          }
          if(state.commandPhase==='object'){
            const circleId=hitTest(state.entities.filter(entity=>entity.type==='CIRCLE'&&layerOf(entity)?.visible),p,8/state.viewport.scale,state),circle=state.entities.find(entity=>entity.id===circleId);
            if(!circle)return result(false,'Pick a visible CIRCLE circumference.');state.commandData.circle=clone(circle);state.commandPhase='placement';state.commandData.targetKind='point';state.prompt=`${state.command} Specify dimension placement:`;return result(true,'Circle radius captured.');
          }
          if(state.commandPhase==='origin-first'){state.commandPoints=[p];state.lastPoint={...p};state.commandPhase='origin-second';state.prompt=`${state.command} Specify second extension origin:`;return result(true,'First extension origin accepted.');}
          if(state.commandPhase==='origin-second'){if(samePoint(state.commandPoints[0],p))throw new Error('Dimension origins must differ.');state.commandPoints.push(p);state.lastPoint={...p};state.commandPhase='placement';state.prompt=`${state.command} Specify dimension placement${state.command==='DIMLINEAR'?' or [Horizontal/Vertical]':''}:`;return result(true,'Second extension origin accepted.');}
          const entity=preparedDimension(p);check3DResources([entity]);entity.id=id();state.entities.push(entity);state.lastPoint={...p};return finish(`${state.command} completed.`);
        }
        if(['DIST','ID','AREA'].includes(state.command)){
          if(state.command==='ID'){state.lastPoint={...p};return finishMeasurement({kind:'point',point:p});}
          if(state.command==='DIST'&&state.commandPoints.length){const first=state.commandPoints[0],dx=p.x-first.x,dy=p.y-first.y,distance=Math.hypot(dx,dy);if(!finite(distance))throw new Error('Distance exceeds the supported numeric range.');state.lastPoint={...p};return finishMeasurement({kind:'distance',distance,dx,dy,p1:first,p2:p});}
          if(state.commandPoints.length&&samePoint(state.commandPoints.at(-1),p))throw new Error('Consecutive measurement points must differ.');state.commandPoints.push(p);state.lastPoint={...p};state.prompt=state.command==='DIST'?'DIST Specify second point:':'AREA Specify next point or Enter to finish:';return result(true,'Measurement point accepted.');
        }
        if (SELECT_COMMANDS.has(state.command) && state.commandPhase === 'selection') {
          const entityId = hitTest(state.entities.filter(editable), p, 8 / state.viewport.scale,state);
          return entityId ? editor.select([entityId], { add: true }) : result(false, 'No selectable object at that point.');
        }
        if (state.command === 'COPYBASE') {
          state.commandPoints=[p];state.lastPoint={...p};
          if(state.selectionIds.length)return acceptTransformSelection();
          state.commandPhase='selection';state.commandData.targetKind='object';state.prompt='COPYBASE Select objects, then press Enter:';
          return result(true,'Clipboard base point accepted. Select objects.');
        }
        if (state.command === 'PASTECLIP') return pasteClipboard(p);
        if (REPEATED_EDITS.has(state.command)) {
          if (state.command === 'OFFSET' && state.commandPhase === 'distance') return result(false, 'Enter a numeric offset distance first.');
          if (state.commandData.targetKind === 'object') return pickEditingTarget(p);
          const source = state.commandData.offsetSource, live = state.entities.find(entity => entity.id === source.id);
          if (!live || !editable(live) || JSON.stringify(live) !== JSON.stringify(source)) return result(false, 'OFFSET source is no longer editable or has changed.');
          const offset = offsetEntity(source, state.commandData.distance, p), before = snapshot();
          check3DResources([offset]);offset.id = id(); state.entities.push(offset); editingSteps.push(before); state.commandPhase = 'object'; state.commandData.targetKind = 'object';
          state.prompt = 'OFFSET Select object to offset or [Undo] <finish>:'; state.lastPoint = { ...p };
          return result(true, 'OFFSET object created.', true);
        }
        if (state.command === 'BREAK') {
          const source = transformSources[0];
          if (state.commandPhase === 'first-break') {
            const t = lineParameter(source, p);
            if (t < 0 || t > 1) return result(false, 'First BREAK point must project onto the LINE.');
            state.commandPoints = [p]; state.commandPhase = 'second-break'; state.prompt = 'BREAK Specify second break point:'; state.lastPoint = { ...p };
            return result(true, 'First break point accepted.');
          }
          const fragments = breakLine(source, state.commandPoints[0], p), edited=replaceLine(source, fragments);
          if(!edited.ok)return edited;
          state.selectionIds = [];
          state.lastPoint = { ...p }; return finish('BREAK completed.');
        }
        if (TRANSFORMS.has(state.command)) {
          if (state.commandPhase === 'mode') return result(false, 'Choose Single or Multiple copy mode using the command line.');
          if (state.commandPhase === 'selection') {
            const entityId = hitTest(state.entities.filter(editable), p, 8 / state.viewport.scale,state);
            return entityId ? editor.select([entityId], { add: true }) : result(false, 'No selectable object at that point.');
          }
          if (state.commandPhase === 'base') {
            state.commandPoints = [p]; state.commandData.base = { ...p }; state.lastPoint = { ...p };
            state.commandPhase = ['ROTATE','ROTATE3D'].includes(state.command) ? 'angle' : state.command === 'SCALE' ? 'factor' : state.command === 'MIRROR' ? 'mirror-second' : 'target';
            state.prompt = ['ROTATE','ROTATE3D'].includes(state.command) ? `${state.command} Specify rotation angle:` : state.command === 'SCALE' ? 'SCALE Specify positive scale factor:' : state.command === 'MIRROR' ? 'MIRROR Specify second point of mirror axis:' : `${state.command} Specify second point:`;
            return result(true, 'Base point accepted.');
          }
          if (state.commandPhase === 'angle') {
            const base = state.commandPoints[0];
            if(state.command==='ROTATE3D'){
              const axis=state.commandData.axis,dx=p.x-base.x,dy=p.y-base.y,dz=p.z-base.z,first=axis==='X'?dy:axis==='Y'?dz:dx,second=axis==='X'?dz:axis==='Y'?dx:dy;if(first===0&&second===0)return result(false,'Direction point must differ from the rotation axis.');return completeTransform(Math.atan2(second,first)*180/Math.PI);
            }
            if (samePoint(base, p)) return result(false, 'Pick a direction point away from the base point.');
            state.lastPoint = { ...p };
            return completeTransform(Math.atan2(p.y - base.y, p.x - base.x) * 180 / Math.PI);
          }
          if (state.commandPhase === 'factor') {
            const base = state.commandPoints[0]; return completeTransform(Math.hypot(p.x - base.x, p.y - base.y,...(state.commandData.threeD?[p.z-base.z]:[])));
          }
          if (state.commandPhase === 'mirror-second') {
            transformedGeometry(p); // Validate all geometry before asking about deletion.
            state.commandPoints.push(p); state.commandPhase = 'delete-choice'; state.commandData.targetKind = 'none';
            state.prompt = 'MIRROR Delete source objects? [Yes/No] <No>:'; return result(true, 'Mirror axis accepted.');
          }
          if (state.commandPhase === 'delete-choice') return result(false, 'Choose Yes or No using the command line.');
          const response=completeTransform(p);if(response.ok)state.lastPoint={...p};return response;
        }
        if (!['LINE', 'PLINE', 'RECTANG', 'CIRCLE','ARC'].includes(state.command)) return result(false, 'Start a drawing command before entering a point.');
        const layer = state.layers.find(item => item.name === state.currentLayer);
        if (layer.locked || !layer.visible) return result(false, 'The current layer must be visible and unlocked to draw.');
        if(state.command==='ARC') {
          if(state.commandPoints.length<2){
            if(state.commandPoints.length&&samePoint(state.commandPoints[0],p))return result(false,'ARC points must differ.');
            state.commandPoints.push(p);state.lastPoint={...p};state.commandPhase=state.commandPoints.length===1?'arc-second':'arc-third';state.prompt=state.commandPoints.length===1?'ARC Specify second point:':'ARC Specify end point:';
            return result(true,'ARC point accepted.');
          }
          const arc={id:id(),...arcThroughPoints(state.commandPoints[0],state.commandPoints[1],p),layer:state.currentLayer};check3DResources([arc]);state.entities.push(arc);state.lastPoint={...p};return finish('ARC completed.');
        }
        if (state.command === 'CIRCLE') {
          if (state.commandPhase === 'center') {
            state.commandPoints = [p]; state.commandData.diameter = false; state.commandPhase = 'radius'; state.lastPoint = { ...p };
            state.prompt = 'CIRCLE Specify radius or [Diameter]:'; return result(true, 'Center accepted.');
          }
          const center = state.commandPoints[0], distance = Math.hypot(p.x - center.x, p.y - center.y);
          state.lastPoint = { ...p }; return completeCircle(state.commandData.diameter ? distance / 2 : distance);
        }
        if (!state.commandPoints.length) {
          state.commandPoints.push(p); state.lastPoint = { ...p };
          state.prompt = ['LINE', 'PLINE'].includes(state.command) ? `${state.command} Specify next point or [Undo]:` : 'RECTANG Specify opposite corner:';
          return result(true, 'First point accepted.');
        }
        const previous = state.commandPoints.at(-1);
        if (state.command === 'PLINE') {
          if (samePoint(previous, p)) return result(false, 'Adjacent PLINE vertices must differ.');
          const vertices = [...clone(state.commandPoints), p]; validatePolyline(vertices, false);
          check3DResources([{type:'PLINE',points:vertices,closed:false,layer:state.currentLayer}],transactionIds);
          if (!transactionIds.length) {
            const entity = { id: id(), type: 'PLINE', points: vertices, closed: false, layer: state.currentLayer }; state.entities.push(entity); transactionIds.push(entity.id);
          } else state.entities.find(entity => entity.id === transactionIds[0]).points = vertices;
          state.commandPoints.push(p); state.lastPoint = { ...p }; updateLinePrompt(); return result(true, 'PLINE segment added.', true);
        }
        if (state.command === 'LINE') {
          if (samePoint(previous, p)) return result(false, 'LINE endpoints must differ.');
          const entity = { id: id(), type: 'LINE', start: { ...previous }, end: p, layer: state.currentLayer };
          check3DResources([entity]);
          state.entities.push(entity); transactionIds.push(entity.id); state.commandPoints.push(p); state.lastPoint = { ...p }; updateLinePrompt();
          return result(true, 'LINE segment added.', true);
        }
        const first = state.commandPoints[0];
        if (first.x === p.x || first.y === p.y) return result(false, 'RECTANG needs nonzero width and height.');
        const corners = [{ ...first }, { x: p.x, y: first.y }, { ...p }, { x: first.x, y: p.y }];
        validateRectangle(corners);
        const entity={ id: id(), type: 'RECTANG', points: corners, layer: state.currentLayer };check3DResources([entity]);state.entities.push(entity);
        state.lastPoint = { ...p };
        return finish('RECTANG completed.');
      } catch (error) { return result(false, error.message); }
    },
    cancel() {
      if (state.command) { if (SELECT_COMMANDS.has(state.command)) state.selectionIds = []; return finish(`${state.command} canceled; completed objects retained.`); }
      editor.clearSelection();
      return result(true, 'Selection cleared.');
    },
    previewCommand(raw) {
      try {
        const p = threeDPointMode()?point3(raw):point(raw);
        if(state.command==='STRETCH'&&state.commandPhase==='target')return stretchGeometry(p);
        if(state.command==='INSERT'&&state.commandPhase==='position')return[preparedInsert(p)];
        if(state.command==='SPLINE'&&state.commandPoints.length){const controls=[...clone(state.commandPoints),p];if(controls.length>=4){const entity={type:'SPLINE',controlPoints:controls,degree:3,knots:makeClampedKnots(controls.length),closed:false,layer:state.currentLayer};validateSpline(entity);return[entity];}return[{type:'PLINE',points:controls,closed:false,layer:state.currentLayer}];}
        if(state.command==='ELLIPSE'&&state.commandPhase==='minor-distance'){const original=state.commandData.major,length=Math.hypot(original.x,original.y),minor=Math.hypot(p.x-state.commandData.center.x,p.y-state.commandData.center.y),major=minor>length?{x:-original.y/length*minor,y:original.x/length*minor}:{...original},entity={type:'ELLIPSE',center:{...state.commandData.center},major,ratio:Math.min(minor,length)/Math.max(minor,length),layer:state.currentLayer};validateEllipse(entity);return[entity];}
        if(state.command==='3DPOLY'&&state.commandPoints.length)return[{type:'POLY3D',points:[state.commandPoints.at(-1),p],closed:false,layer:state.currentLayer}];
        if(['BOX','CYLINDER','SPHERE','EXTRUDE'].includes(state.command)){
          if(state.commandPhase==='height'){const value=p.z-state.commandData.heightBase.z,prepared=preparedPrimitive(value);return Array.isArray(prepared)?prepared:[prepared];}
          if(state.command==='BOX'&&state.commandPhase==='opposite-corner'){const a=state.commandPoints[0];validateBoxBase(a,p);return[{type:'POLY3D',points:[a,{x:p.x,y:a.y,z:a.z},p,{x:a.x,y:p.y,z:a.z}],closed:true,layer:state.currentLayer}];}
          if(state.commandPhase==='radius'){const c=state.commandPoints[0],radius=Math.hypot(p.x-c.x,p.y-c.y,p.z-c.z);if(state.command==='SPHERE')return[{...makeSphereMesh(c,radius),layer:state.currentLayer}];if(p.z!==c.z)return[];validateCylinderRadius(c,radius);return[{type:'POLY3D',points:Array.from({length:32},(_,i)=>{const[x,y]=angleBasis(i*360/32);return{x:c.x+radius*x,y:c.y+radius*y,z:c.z};}),closed:true,layer:state.currentLayer}];}
        }
        if(DIM_COMMANDS.has(state.command)&&state.commandPhase==='placement')return [preparedDimension(p)];
        if(state.command==='ARC'&&state.commandPhase==='arc-third')return [{...arcThroughPoints(state.commandPoints[0],state.commandPoints[1],p),layer:state.currentLayer}];
        if (state.command === 'PASTECLIP') return clipboardGeometry(p);
        if (state.command === 'OFFSET' && state.commandPhase === 'side') return [offsetEntity(state.commandData.offsetSource, state.commandData.distance, p)];
        if (['TRIM', 'EXTEND'].includes(state.command) && state.commandPhase === 'target') {
          const entityId = hitTest(state.entities.filter(editable), p, 8 / state.viewport.scale,state), target = state.entities.find(entity => entity.id === entityId);
          if (!target || target.type !== 'LINE') return [];
          return state.command === 'TRIM' ? trimLine(target, liveBoundaries(), p) : [extendLine(target, liveBoundaries(), p)];
        }
        if (state.command === 'CIRCLE' && state.commandPhase === 'radius') {
          const center = state.commandPoints[0], distance = Math.hypot(p.x - center.x, p.y - center.y);
          const radius = state.commandData.diameter ? distance / 2 : distance;
          validateCircle(center, radius);
          return [{ type: 'CIRCLE', center: { ...center }, radius, layer: state.currentLayer }];
        }
        if (TRANSFORMS.has(state.command) && ['target', 'angle', 'factor', 'mirror-second', 'delete-choice'].includes(state.commandPhase)) {
          if (state.commandPhase === 'angle') {
            const base = state.commandPoints[0];
            if(state.command==='ROTATE3D'){const axis=state.commandData.axis,dx=p.x-base.x,dy=p.y-base.y,dz=p.z-base.z;return transformedGeometry(Math.atan2(axis==='X'?dz:axis==='Y'?dx:dy,axis==='X'?dy:axis==='Y'?dz:dx)*180/Math.PI);}
            return transformedGeometry(Math.atan2(p.y - base.y, p.x - base.x) * 180 / Math.PI);
          }
          if (state.commandPhase === 'factor') { const base = state.commandPoints[0]; return transformedGeometry(Math.hypot(p.x - base.x, p.y - base.y)); }
          if (state.commandPhase === 'delete-choice') return transformedGeometry(state.commandPoints[1]);
          return transformedGeometry(p);
        }
        return [];
      } catch { return []; }
    },
    previewScalar(value){
      try{if(['LINE','PLINE'].includes(state.command)&&state.commandPoints.length)return editor.previewCommand(distancePoint(value));const number=typeof value==='number'?scalar(value,'Preview value'):['angle','insert-angle','rotation','hatch-angle'].includes(state.commandPhase)?angleScalar(value):['factor','insert-scale','rows','columns'].includes(state.commandPhase)?scalar(value,'Preview value'):lengthScalar(value);if(state.command==='ELLIPSE'&&state.commandPhase==='minor-distance'){const original=state.commandData.major,length=Math.hypot(original.x,original.y),major=number>length?{x:-original.y/length*number,y:original.x/length*number}:{...original},entity={type:'ELLIPSE',center:{...state.commandData.center},major,ratio:Math.min(number,length)/Math.max(number,length),layer:state.currentLayer};validateEllipse(entity);return[entity];}
      if(state.command==='INSERT'&&['insert-scale','insert-angle'].includes(state.commandPhase))return[preparedInsert(state.commandPoints[0],state.commandPhase==='insert-scale'?number:state.commandData.scale,state.commandPhase==='insert-angle'?number:0)];
      if(['BOX','CYLINDER','SPHERE','EXTRUDE'].includes(state.command)&&['radius','height'].includes(state.commandPhase)){
        if(state.command==='CYLINDER'&&state.commandPhase==='radius'){const c=state.commandPoints[0];validateCylinderRadius(c,number);return[{type:'POLY3D',points:Array.from({length:32},(_,i)=>{const[x,y]=angleBasis(i*360/32);return{x:c.x+number*x,y:c.y+number*y,z:c.z};}),closed:true,layer:state.currentLayer}];}
        const prepared=preparedPrimitive(number);return Array.isArray(prepared)?prepared:[prepared];
      }if(TRANSFORMS.has(state.command)&&['angle','factor'].includes(state.commandPhase))return transformedGeometry(number);return[];}catch{return[];}
    },
    undo() {
      if (['LINE', 'PLINE','3DPOLY','SPLINE','PEDIT'].includes(state.command) || REPEATED_EDITS.has(state.command) && state.commandPhase !== 'selection' || (state.command === 'COPY' && state.commandPhase === 'target')) return editor.execute('U');
      if (state.command) return result(false, 'Finish or cancel the active command before undo.');
      const entry = undoStack.pop();
      if (!entry) return result(false, 'Nothing to undo.');
      restore(entry.before); redoStack.push(entry); return result(true, 'Undo completed.', true);
    },
    redo() {
      if (state.command) return result(false, 'Finish or cancel the active command before redo.');
      const entry = redoStack.pop();
      if (!entry) return result(false, 'Nothing to redo.');
      restore(entry.after); undoStack.push(entry); return result(true, 'Redo completed.', true);
    },
    select(ids, options = {}) {
      const valid = [...new Set(ids)].filter(id => state.entities.some(entity => entity.id === id && editable(entity)));
      const selected = new Set(options.add || options.toggle ? state.selectionIds : []);
      for (const id of valid) { if (options.toggle && selected.has(id)) selected.delete(id); else selected.add(id); }
      state.selectionIds = [...selected];
      return result(true, `${state.selectionIds.length} objects selected.`);
    },
    clearSelection() { state.selectionIds = []; return result(true, 'Selection cleared.'); },
    setStretchWindow(start,end){try{if(state.command!=='STRETCH'||!['window-first','window-second'].includes(state.commandPhase))return result(false,'Start STRETCH before defining its crossing window.');return acceptStretchWindow(start,end);}catch(error){return result(false,error.message);}},
    submitObject(entityId,rawPoint){
      try{
        const source=state.entities.find(entity=>entity.id===entityId);if(!source||!layerOf(source)?.visible)return result(false,'Object is unavailable or hidden.');
        if(SELECT_COMMANDS.has(state.command)&&state.commandPhase==='selection'||state.command==='PEDIT'&&state.commandPhase==='join-selection')return editor.select([entityId],{add:true});
        if(['HATCH','FILLET','CHAMFER'].includes(state.command)&&state.commandData.targetKind==='object')return chooseCornerOrHatch(entityId,rawPoint);
        if(REPEATED_EDITS.has(state.command)&&state.commandData.targetKind==='object')return pickEditingTarget(rawPoint,entityId);
        if(['DIMRADIUS','DIMDIAMETER'].includes(state.command)&&state.commandPhase==='object'){if(source.type!=='CIRCLE')return result(false,'Pick a visible CIRCLE circumference.');state.commandData.circle=clone(source);state.commandPhase='placement';state.commandData.targetKind='point';state.prompt=`${state.command} Specify dimension placement:`;return result(true,'Circle radius captured.');}
        return result(false,'The active command is not requesting an object pick.');
      }catch(error){return result(false,error.message);}
    },
    previewObject(entityId,rawPoint){
      try{const source=state.entities.find(entity=>entity.id===entityId);if(!source||!layerOf(source)?.visible)return[];const p=point(rawPoint);
        if(state.command==='HATCH'&&state.commandPhase==='boundary'){const boundary=normalizeHatchBoundary(source),entity={type:'HATCH',boundary,origin:boundary.center?{...boundary.center}:{...boundary.points[0]},pattern:state.commandData.pattern,angle:state.commandData.angle,spacing:state.commandData.spacing,layer:state.currentLayer};validateHatch(entity);return[entity];}
        if(['FILLET','CHAMFER'].includes(state.command)&&state.commandPhase==='second-line'&&editable(source)){const first=state.commandData.cornerFirst,live=state.entities.find(entity=>entity.id===first.source.id);if(!live||!editable(live)||JSON.stringify(live)!==JSON.stringify(first.source))return[];const prepared=state.command==='FILLET'?filletLines(first.source,source,first.pick,p,state.commandData.radius):chamferLines(first.source,source,first.pick,p,state.commandData.distance1,state.commandData.distance2),extra=cornerConnector(prepared,first.source,source);return[prepared.first,prepared.second,...(extra?[extra]:[])];}
        if(['TRIM','EXTEND'].includes(state.command)&&state.commandPhase==='target'&&editable(source)&&source.type==='LINE')return state.command==='TRIM'?trimLine(source,liveBoundaries(),p):[extendLine(source,liveBoundaries(),p)];return[];
      }catch{return[];}
    },
    submitText(raw){
      try{
        if(state.commandPhase!=='text'||!['TEXT','MTEXT','TEXTEDIT'].includes(state.command))return result(false,'No text entry is pending.');
        if(state.command==='TEXTEDIT'){
          const source=transformSources[0],live=state.entities.find(entity=>entity.id===source.id);if(!live||!editable(live))throw new Error('Text object is no longer editable.');
          const edited={...clone(live),text:raw};validateText(edited,state);check3DResources([edited],[live.id]);state.entities=state.entities.map(entity=>entity.id===live.id?edited:entity);state.selectionIds=[];return finish('Text edited.');
        }
        drawingLayerReady();
        const entity={id:id(),type:state.command,position:state.command==='TEXT'?{...state.commandPoints[0]}:{...state.commandData.position},text:raw,height:state.commandData.height,rotation:state.commandData.rotation%360,style:state.commandData.style,layer:state.currentLayer};if(state.command==='MTEXT')entity.width=state.commandData.width;
        validateText(entity,state);check3DResources([entity]);state.entities.push(entity);return finish(`${state.command} completed.`);
      }catch(error){return result(false,error.message);}
    },
    updateDrawingSettings(patch){
      if(state.command)return result(false,'Finish or cancel the active command before changing drawing preferences.');
      try{
        if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Preference patch must be an object.');
        const reserved=['textStyles','dimStyles','currentTextStyle','currentDimStyle'],proposal={...snapshot(),viewport:state.viewport,camera3d:state.camera3d,workspace:state.workspace,settings:{...state.settings}};
        for(const[key,value]of Object.entries(patch)){if(reserved.includes(key))proposal[key]=value;else if(Object.hasOwn(DEFAULT_SETTINGS,key))proposal.settings[key]=value;else if(key==='settings'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Settings patch must be an object.');proposal.settings={...proposal.settings,...value};}else throw new Error(`Unsupported drawing preference: ${key}.`);}
        const normalized=normalizeDocument(proposal),before=snapshot();Object.assign(state,normalized);const changed=record(before);return result(true,'Drawing preferences updated.',changed);
      }catch(error){return result(false,error.message);}
    },
    updateDraftingSettings(patch){
      try{
        const allowed=['gridEnabled','snapEnabled','orthoEnabled','snapModes','gridAdaptive','gridSpacing','constructionElevation','constructionPlane'];
        if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!allowed.includes(key)))throw new Error('Quick drafting settings accept only grid/snap/ortho fields.');
        const normalized=normalizeSettings({...state.settings,...patch}),changed=JSON.stringify(normalized)!==JSON.stringify(state.settings);state.settings=normalized;
        const update=data=>{if(data?.settings)for(const key of Object.keys(patch))data.settings[key]=clone(normalized[key]);};
        update(transactionBefore);editingSteps.forEach(update);for(const entry of [...undoStack,...redoStack]){update(entry.before);update(entry.after);}
        return result(true,'Drafting controls updated.',changed);
      }catch(error){return result(false,error.message);}
    },
    updateTextStyle(name,patch={}){
      if(!patch||Object.keys(patch).some(key=>!Object.hasOwn(DEFAULT_TEXT_STYLE,key)))return result(false,'Unsupported text style property.');
      const existing=state.textStyles.find(style=>style.name===name),styles=state.textStyles.filter(style=>style.name!==name);
      styles.push({...DEFAULT_TEXT_STYLE,...existing,...patch,name});return editor.updateDrawingSettings({textStyles:styles});
    },
    updateDimensionStyle(name,patch={}){
      if(!patch||Object.keys(patch).some(key=>!Object.hasOwn(DEFAULT_DIM_STYLE,key)&&!['fractionPrecision','angularPrecision'].includes(key)))return result(false,'Unsupported dimension style property.');
      const existing=state.dimStyles.find(style=>style.name===name),styles=state.dimStyles.filter(style=>style.name!==name);
      styles.push({...DEFAULT_DIM_STYLE,...existing,...patch,name});return editor.updateDrawingSettings({dimStyles:styles});
    },
    setTextProperties(entityId,patch){
      if(state.command)return result(false,'Finish or cancel the active command before editing text.');
      try{const source=state.entities.find(entity=>entity.id===entityId);if(!source||!TEXT_TYPES.has(source.type)||!editable(source))throw new Error('Choose an editable text object.');
        if(!patch||Object.keys(patch).some(key=>!['position','text','height','rotation','style',...(source.type==='MTEXT'?['width']:[])].includes(key)))throw new Error('Unsupported text property.');
        const edited={...clone(source),...patch};validateText(edited,state);edited.rotation%=360;check3DResources([edited],[entityId]);const before=snapshot();state.entities=state.entities.map(entity=>entity.id===entityId?edited:entity);return result(true,'Text properties updated.',record(before));
      }catch(error){return result(false,error.message);}
    },
    setDimensionProperties(entityId,patch){
      if(state.command)return result(false,'Finish or cancel the active command before editing dimensions.');
      try{const source=state.entities.find(entity=>entity.id===entityId);if(!source||source.type!=='DIMENSION'||!editable(source))throw new Error('Choose an editable dimension.');
        const allowed=['placement','style','scale','textOverride',...(source.kind==='angular'?['vertex','p1','p2']:['linear','aligned'].includes(source.kind)?['p1','p2',...(source.kind==='linear'?['axisAngle']:[])]:['center','radius'])];
        if(!patch||Object.keys(patch).some(key=>!allowed.includes(key)))throw new Error('Unsupported dimension property.');
        const edited={...clone(source),...patch};validateDimension(edited,state);if(edited.kind==='linear')edited.axisAngle%=360;check3DResources([edited],[entityId]);const before=snapshot();state.entities=state.entities.map(entity=>entity.id===entityId?edited:entity);return result(true,'Dimension properties updated.',record(before));
      }catch(error){return result(false,error.message);}
    },
    setAdvancedProperties(entityId,patch){
      if(state.command)return result(false,'Finish or cancel the active command before editing geometry properties.');
      try{const source=state.entities.find(entity=>entity.id===entityId);if(!source||!editable(source)||!['ELLIPSE','SPLINE','HATCH','INSERT'].includes(source.type))throw new Error('Choose an editable ellipse, spline, hatch or block reference.');
        const allowed=({ELLIPSE:['center','major','ratio'],SPLINE:['controlPoints'],HATCH:['pattern','angle','spacing','origin','boundary'],INSERT:['blockName','position','scale','rotation']})[source.type];if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!allowed.includes(key)))throw new Error('Unsupported advanced geometry property.');
        const proposal={...clone(source),...patch},proposedEntities=state.entities.map(entity=>entity.id===entityId?proposal:entity);validateExpandedResources({entities:proposedEntities,blocks:state.blocks,dimStyles:state.dimStyles});const normalized=normalizeDocument({...snapshot(),entities:proposedEntities,viewport:state.viewport,camera3d:state.camera3d,workspace:state.workspace}).entities.find(entity=>entity.id===entityId),before=snapshot();state.entities=state.entities.map(entity=>entity.id===entityId?normalized:entity);return result(true,'Geometry properties updated.',record(before));
      }catch(error){return result(false,error.message);}
    },
    getClipboard() { return clipboard ? clone(clipboard) : null; },
    setClipboard(data) {
      try {
        if (state.command && !['PASTECLIP'].includes(state.command)) return result(false, 'Finish or cancel the active command before replacing clipboard geometry.');
        const normalized = normalizeClipboard(data); clipboard = normalized; state.clipboardRevision++;
        return result(true, `${clipboard.entities.length} clipboard objects accepted.`);
      } catch (error) { return result(false, error.message); }
    },
    copySelection(base) {
      if (state.command) return result(false, 'Finish or cancel the active command before copying.');
      try { validateSelection(); return captureClipboard(base); } catch (error) { return result(false, error.message); }
    },
    cutSelection(base) {
      if (state.command) return result(false, 'Finish or cancel the active command before cutting.');
      try {
        const response = startCommand('CUTCLIP');
        if (response.ok && state.commandPhase === 'clipboard-ready' && base != null) captureClipboard(base);
        return response;
      } catch (error) { editor.cancel(); return result(false, error.message); }
    },
    finishClipboardCut(success) {
      if (state.command !== 'CUTCLIP' || state.commandPhase !== 'clipboard-ready' || !pendingCut) return result(false, 'No pending clipboard cut.');
      if (success !== true) { state.selectionIds = []; return finish('Clipboard write failed or canceled; source objects retained.'); }
      const expected = new Set(pendingCut.map(entity => entity.id));
      if (state.selectionIds.length !== expected.size || state.selectionIds.some(entityId => !expected.has(entityId)) || pendingCut.some(source => {
        const live = state.entities.find(entity => entity.id === source.id);
        return !live || !editable(live) || JSON.stringify(source) !== JSON.stringify(live);
      })) { state.selectionIds = []; finish('Clipboard cut canceled because source objects or selection changed.'); return result(false, 'Clipboard cut canceled because source objects or selection changed.'); }
      state.entities = state.entities.filter(entity => !expected.has(entity.id)); state.selectionIds = [];
      return finish(`${expected.size} objects cut to the geometry clipboard.`);
    },
    deleteSelected() {
      if (state.command) return result(false, 'Finish or cancel the active command before erasing.');
      validateSelection();
      if (!state.selectionIds.length) return result(false, 'Select objects to erase.');
      const before = snapshot(), count = state.selectionIds.length, selected = new Set(state.selectionIds);
      state.entities = state.entities.filter(entity => !selected.has(entity.id)); state.selectionIds = [];
      record(before); return result(true, `${count} objects erased.`, true);
    },
    moveGrip(entityId, index, raw) {
      if (state.command) return result(false, 'Finish or cancel the active command before editing grips.');
      try {
        const entity = state.entities.find(item => item.id === entityId),p=entity&&TYPES3D.has(entity.type)?point3(raw):point(raw);
        if (!entity || !editable(entity)) return result(false, 'Object is unavailable or its layer is locked.');
        const before = snapshot();
        const edited = previewGrip(entity, index, p,state);check3DResources([edited],[entityId]);
        state.entities = state.entities.map(item => item.id === entityId ? edited : item);
        const changed = record(before); return result(true, 'Grip moved.', changed);
      } catch (error) { return result(false, error.message); }
    },
    setCircleRadius(entityId, radius) {
      if (state.command) return result(false, 'Finish or cancel the active command before changing the radius.');
      try {
        const entity = state.entities.find(item => item.id === entityId);
        if (!entity || entity.type !== 'CIRCLE') return result(false, 'Choose a circle to change its radius.');
        if (!editable(entity)) return result(false, 'Object is unavailable or its layer is locked.');
        validateCircle(entity.center, radius);
        const before = snapshot(); entity.radius = radius;
        const changed = record(before); return result(true, 'Circle radius updated.', changed);
      } catch (error) { return result(false, error.message); }
    },
    setSelectionProperties(properties) {
      if (state.command) return result(false, 'Finish or cancel the active command before changing properties.');
      try {
        validateSelection();
        if (!state.selectionIds.length) return result(false, 'Select objects to change properties.');
        if (properties.layer != null && !state.layers.some(layer => layer.name === properties.layer)) return result(false, 'Target layer does not exist.');
        if (properties.color != null && properties.color !== 'BYLAYER' && !/^#[0-9a-f]{6}$/i.test(properties.color)) return result(false, 'Color must be a six-digit hex value or BYLAYER.');
        if (properties.lineweight != null && properties.lineweight !== 'BYLAYER' && (!finite(properties.lineweight) || properties.lineweight < 0 || properties.lineweight > 10)) return result(false, 'Lineweight must be between 0 and 10 mm or BYLAYER.');
        const before = snapshot(), selected = new Set(state.selectionIds);
        for (const entity of state.entities) {
          if (!selected.has(entity.id)) continue;
          if (properties.layer != null) entity.layer = properties.layer;
          if (Object.hasOwn(properties, 'color')) { if (properties.color == null || properties.color === 'BYLAYER') delete entity.color; else entity.color = properties.color; }
          if (Object.hasOwn(properties, 'lineweight')) { if (properties.lineweight == null || properties.lineweight === 'BYLAYER') delete entity.lineweight; else entity.lineweight = properties.lineweight; }
        }
        const changed = record(before); validateSelection(); return result(true, 'Object properties updated.', changed);
      } catch (error) { return result(false, error.message); }
    },
    addLayer(name, properties = {}) {
      if (state.command) return result(false, 'Finish or cancel the active command before adding a layer.');
      try {
        const layer = normalizeLayer({ ...properties, name });
        if (state.layers.some(item => item.name === name)) return result(false, 'Layer name already exists.');
        const before = snapshot(); state.layers.push(layer); record(before); return result(true, `Layer ${name} added.`, true);
      } catch (error) { return result(false, error.message); }
    },
    updateLayer(name, properties) {
      if (state.command) return result(false, 'Finish or cancel the active command before editing a layer.');
      try {
        const index = state.layers.findIndex(layer => layer.name === name);
        if (index < 0) return result(false, 'Layer does not exist.');
        if(!properties||typeof properties!=='object'||Array.isArray(properties)||Object.keys(properties).some(key=>!['name','color','visible','locked','lineweight'].includes(key)))return result(false,'Unsupported layer property.');
        const nextName=Object.hasOwn(properties,'name')?properties.name:name;
        if(nextName!==name&&(name==='0'||state.layers.some(layer=>layer.name===nextName)))return result(false,name==='0'?'Layer 0 cannot be renamed.':'Target layer name already exists.');
        const layer = normalizeLayer({ ...state.layers[index], ...properties, name:nextName });
        const before = snapshot(); state.layers[index] = layer;
        if(nextName!==name){for(const entity of state.entities)if(entity.layer===name)entity.layer=nextName;for(const block of state.blocks)for(const entity of block.entities)if(entity.layer===name)entity.layer=nextName;if(state.currentLayer===name)state.currentLayer=nextName;}
        const changed = record(before); validateSelection();
        return result(true, `Layer ${nextName} updated.`, changed);
      } catch (error) { return result(false, error.message); }
    },
    renameLayer(name,nextName){return editor.updateLayer(name,{name:nextName});},
    deleteLayer(name) {
      if (state.command) return result(false, 'Finish or cancel the active command before deleting a layer.');
      if (name === '0' || name === state.currentLayer) return result(false, 'Layer 0 and the current layer cannot be deleted.');
      if (state.entities.some(entity => entity.layer === name)||state.blocks.some(block=>block.entities.some(entity=>entity.layer===name))) return result(false, 'Layer contains objects in the drawing or a block definition.');
      if (!state.layers.some(layer => layer.name === name)) return result(false, 'Layer does not exist.');
      const before = snapshot(); state.layers = state.layers.filter(layer => layer.name !== name); record(before);
      return result(true, `Layer ${name} deleted.`, true);
    },
    setCurrentLayer(name) {
      if (state.command) return result(false, 'Finish or cancel the active command before switching layers.');
      const layer = state.layers.find(item => item.name === name);
      if (!layer) return result(false, 'Layer does not exist.');
      if (!layer.visible || layer.locked) return result(false, 'Current layer must be visible and unlocked.');
      const before = snapshot(); state.currentLayer = name; const changed = record(before);
      return result(true, `Current layer: ${name}.`, changed);
    },
    setViewSize(width, height) {
      if (finite(width) && width > 0 && finite(height) && height > 0) state.canvasSize = { width, height };
    },
    setWorkspace(mode){if(!['2d','3d'].includes(mode))return result(false,'Workspace must be 2d or 3d.');state.workspace=mode;return result(true,`${mode.toUpperCase()} workspace active.`);},
    set3DView(patch){try{if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!Object.hasOwn(DEFAULT_CAMERA3D,key)))throw new Error('Unsupported 3D view property.');state.camera3d=normalizeCamera3D({...state.camera3d,...patch});return result(true,'3D view updated.');}catch(error){return result(false,error.message);}},
    serialize() { return JSON.stringify({ format: 'Linecraft/1', ...snapshot(), viewport: clone(state.viewport),workspace:state.workspace,camera3d:clone(state.camera3d) }, null, 2); },
    importJSON(source) {
      if (state.command) return result(false, 'Finish or cancel the active command before importing.');
      try {
        const imported = normalizeDocument(typeof source === 'string' ? JSON.parse(source) : source);
        imported.entities.forEach(entity=>allocatedIds.add(entity.id));
        const before = snapshot(); Object.assign(state, imported); state.selectionIds = []; state.lastPoint = { x: 0, y: 0 };
        const changed = record(before); return result(true, `Loaded ${state.entities.length} objects.`, changed);
      } catch (error) { return result(false, `Import rejected: ${error.message}`); }
    },
    exportDXF() {
      return writeDXF(state);
    },
    getExportWarnings(){const warnings=[...dxfUnitFormat(state.settings).warnings];if(state.settings.angularFormat==='dms'&&state.dimStyles.some(style=>(style.angularPrecision??style.precision)>4)&&!warnings.some(warning=>warning.includes('four decimal places')))warnings.push('Native DXF DMS dimension precision is limited to four decimal places of seconds; original labels retain the selected precision as explicit text.');return warnings;},
    get canUndo() {
      if(state.command==='SPLINE')return state.commandPoints.length>0;
      if(state.command==='PEDIT')return editingSteps.length>0;
      if(['LINE','PLINE','3DPOLY'].includes(state.command))return transactionIds.length>0;
      if(state.command==='COPY'&&state.commandPhase==='target')return copyBatches.length>0;
      if(REPEATED_EDITS.has(state.command)&&state.commandPhase!=='selection')return editingSteps.length>0;
      return !state.command&&undoStack.length>0;
    },
    get canRedo() { return !state.command && redoStack.length > 0; },
  };
  return editor;
}
