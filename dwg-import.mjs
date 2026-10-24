/* Original bounded ASCII DXF importer. DWG decoding is performed separately by GNU LibreDWG. */
import {createEditor as defaultCreateEditor,textLayout,triangulatePolygon,parseRichText,canonicalFontFamily,modelUnitMillimeters} from './core.mjs';
import {validateEllipse,validateSpline} from './advanced-geometry.mjs';

const MAX_BYTES=50*1024*1024,MAX_RECORDS=1000000,MAX_ENTITIES=100000;
const first=(record,code,fallback)=>record.groups.find(pair=>pair[0]===code)?.[1]??fallback;
const num=(record,code,fallback)=>{const raw=first(record,code,fallback);if(raw===undefined||String(raw).trim()===''||!Number.isFinite(Number(raw)))throw Error(`Invalid ${record.type} coordinate/value ${code}.`);return Number(raw);};
const xyz=(record,code=10)=>({x:num(record,code),y:num(record,code+10),z:num(record,code+20,0)});
const eq=(a,b)=>a.x===b.x&&a.y===b.y&&a.z===b.z;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit=a=>{const n=Math.hypot(a.x,a.y,a.z);if(!Number.isFinite(n)||!n)throw Error('Invalid extrusion normal.');return mul(a,1/n);};
const xy=a=>{if(a.z!==0)throw Error('Non-XY annotation.');return{x:a.x,y:a.y};};
const angle=a=>a*180/Math.PI;
const radians=a=>a*Math.PI/180;
const identity=p=>({...p});

/** Fixed reader's independent JSON layer data avoids its 0.13.4 DXF color-sign defect. */
export function readDWGMetadata(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_BYTES)throw Error('DWG metadata must be bounded UTF-8 JSON.');
  const raw=JSON.parse(source),version=raw?.FILEHEADER?.version;
  if(raw?.created_by!=='LibreDWG 0.13.4'||!/^AC\d{4}$/.test(version)||!Array.isArray(raw.OBJECTS)||raw.OBJECTS.length>MAX_RECORDS)throw Error('Unsupported DWG reader metadata.');
  const modern=['AC1015','AC1018','AC1021','AC1024','AC1027','AC1032'].includes(version),names=new Set(),layers=[];
  const flag=value=>{if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>65535)throw Error('Invalid DWG layer flag metadata.');return value;};
  const boolean=value=>{if(value===true||value===1)return true;if(value===false||value===0)return false;throw Error('Invalid DWG layer boolean metadata.');};
  for(const record of raw.OBJECTS){
    if(record?.object!=='LAYER')continue;
    const name=record.name;if(typeof name!=='string'||!name.trim()||name.length>255||/[<>/\\";:?*|,=\x00-\x1f]/.test(name)||names.has(name))throw Error('Invalid or duplicate DWG layer metadata name.');names.add(name);
    let frozen,off,locked;
    if(modern){const bits=flag(record.flag0);frozen=!!(bits&1);off=!!(bits&2);locked=!!(bits&8);}
    else if(Object.hasOwn(record,'off')){frozen=boolean(record.frozen);off=boolean(record.off);locked=boolean(record.locked);}
    else if(['AC1012','AC1014'].includes(version)){const bits=flag(record.flag0);frozen=!!(bits&1);off=!!(bits&32);locked=!!(bits&4);}
    else{const bits=flag(record.flag),index=record.color?.index;if(!Number.isInteger(index)||Math.abs(index)>32768)throw Error('Unsupported legacy DWG layer metadata.');frozen=!!(bits&1);locked=!!(bits&4);off=index<0;}
    layers.push({name,visible:!frozen&&!off,locked});
  }
  if(!layers.length||layers.length>100000)throw Error('DWG metadata has no bounded layer table.');
  return{version,layers};
}

/** Parse original ASCII records without evaluating values or following file references. */
export function readDXF(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_BYTES)throw Error('DXF must be ASCII text of at most 50MiB.');
  if(source.startsWith('AutoCAD Binary DXF'))throw Error('Binary DXF is unsupported; convert to ASCII DXF.');
  // GNU's Windows writer can produce CRCRLF; all recognized record line endings are transport.
  const rows=source.replace(/^\uFEFF/,'').split(/\r*\n|\r/),records=[],header=Object.create(null);
  if(rows.length>MAX_RECORDS*2+2)throw Error('DXF exceeds one million group pairs.');
  let section=null,pending=false,current=null,variable=null,ended=false;
  const flush=()=>{if(current)records.push(current);current=null;};
  for(let i=0;i+1<rows.length;i+=2){
    if(!/^\s*\d+\s*$/.test(rows[i]))throw Error(`Invalid DXF group code at line ${i+1}.`);
    const code=Number(rows[i]),value=rows[i+1],token=value.trim();if(code>1071)throw Error('DXF group code is out of range.');
    if(code===0&&token==='SECTION'){flush();pending=true;continue;}
    if(pending){if(code!==2)throw Error('DXF section name is missing.');section=token;pending=false;continue;}
    if(code===0&&token==='ENDSEC'){flush();section=null;variable=null;continue;}
    if(code===0&&token==='EOF'){flush();ended=true;break;}
    if(section==='HEADER'){if(code===9){variable=token;header[variable]=[];}else if(variable)header[variable].push([code,value]);continue;}
    if(code===0){flush();current={section,type:token,groups:[]};}else if(current)current.groups.push([code,value]);
  }
  if(!ended||pending)throw Error('DXF is truncated or has no EOF marker.');
  return{records,header};
}

/** Plain content only; CAD rich formatting is reported separately as flattened. */
export function decodeCADText(source,mtext=false){
  let text='',formatted=false;
  for(let i=0;i<source.length;i++){
    const unicode=/^\\U\+([0-9a-f]{4})/i.exec(source.slice(i));
    if(unicode){text+=String.fromCharCode(parseInt(unicode[1],16));i+=6;continue;}
    if(source.slice(i,i+2)==='%%'){
      const next=source[i+2]?.toLowerCase();
      if(next==='%'){text+='%';i+=2;continue;}
      if('dpc'.includes(next??'!')){text+=({d:'°',p:'±',c:'Ø'})[next];i+=2;continue;}
      if('uok'.includes(next??'!')){formatted=true;i+=2;continue;}
      const code=/^%%(\d{3})/.exec(source.slice(i));if(code){text+=String.fromCharCode(Number(code[1]));i+=4;continue;}
    }
    if(!mtext){text+=source[i];continue;}
    if(source.slice(i,i+2)==='{}'){i++;continue;}
    if(source[i]==='{'||source[i]==='}'){formatted=true;continue;}
    if(source[i]!=='\\'){text+=source[i];continue;}
    const next=source[++i];
    if(next==='\\'||next==='{'||next==='}')text+=next;
    else if(next==='P')text+='\n';else if(next==='~')text+='\u00a0';
    else if('LlOoKk'.includes(next??'!'))formatted=true;
    else if('fFHWTAQCcp'.includes(next??'!')){const end=source.indexOf(';',i+1);if(end<0)throw Error('Unterminated MTEXT formatting.');formatted=true;i=end;}
    else if(next==='S'){const end=source.indexOf(';',i+1);if(end<0)throw Error('Unterminated MTEXT stack.');text+=source.slice(i+1,end).replace(/[\^#]/g,'/');formatted=true;i=end;}
    else{text+='\\'+(next??'');formatted=true;}
  }
  return{text,formatted};
}

function aciColor(index){
  const basic=['#ffffff','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffffff','#808080','#c0c0c0'];
  const n=Math.abs(index);if(n<10)return basic[n];if(n>=250)return['#333333','#505050','#696969','#828282','#bebebe','#ffffff'][Math.min(5,n-250)];
  const h=(Math.floor((n-10)/10)%24)/4,s=(n%2)?0.5:1,v=[255,165,127,76,38][Math.floor(n%10/2)]/255;
  const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c,rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return'#'+rgb.map(value=>Math.round((value+m)*255).toString(16).padStart(2,'0')).join('');
}
function color(record,fallback){const trueColor=first(record,420);if(trueColor!==undefined)return'#'+(Number(trueColor)>>>0&0xffffff).toString(16).padStart(6,'0');const index=num(record,62,256);return index===256?undefined:index===0?fallback:aciColor(index);}
function colorSource(record){return first(record,420)!==undefined?'true-color':Math.abs(num(record,62,256))===7?'aci-7':undefined;}
function ocs(record){
  const n=unit({x:num(record,210,0),y:num(record,220,0),z:num(record,230,1)});
  const a=unit(cross(Math.abs(n.x)<1/64&&Math.abs(n.y)<1/64?{x:0,y:1,z:0}:{x:0,y:0,z:1},n)),b=cross(n,a);
  return{a,b,n,point:p=>add(add(mul(a,p.x),mul(b,p.y)),mul(n,p.z)),standard:n.x===0&&n.y===0&&n.z===1};
}
function compact(points,closed=false){const p=points.filter((v,i)=>!i||!eq(v,points[i-1]));if(closed&&p.length>1&&eq(p[0],p.at(-1)))p.pop();return p;}

/** Import model space; recursively expand ordinary INSERTs with bounded affine transformations. */
export function importDXF(source,{sourceName='Imported DXF',createEditor=defaultCreateEditor,dwgMetadata=null}={}){
  const {records,header}=readDXF(source),warnings=new Map(),unsupported=new Map(),entities=[],layers=new Map(),blocks=new Map(),styles=new Map(),dimStyles=new Map(),handleStyles=new Map(),imageResources=[],layouts=[];let currentPaperLayout=null;
  const warn=(key,message)=>{const old=warnings.get(key);warnings.set(key,{message,count:(old?.count??0)+1});};
  const skip=(type,message)=>{unsupported.set(type,(unsupported.get(type)??0)+1);if(message)warn(type,message);};
  const hv=name=>header[name]?.[0]?.[1];
  const ensureLayer=name=>{if(!layers.has(name))layers.set(name,{name,color:'#ffffff',lineweight:.25,visible:true,locked:false});return name;};
  const linetypeFor=(record,entity=false)=>{const name=first(record,6,entity?'BYLAYER':'CONTINUOUS').trim().toUpperCase();if(entity&&['BYLAYER','BYBLOCK'].includes(name))return undefined;if(['CONTINUOUS','DASHED','HIDDEN','CENTER'].includes(name))return name.toLowerCase();warn('linetype','Unsupported custom linetypes import with continuous display; native pattern definitions are not copied.');return 'continuous';};
  const safeName=(value,fallback='Standard')=>{const name=String(value??fallback).trim();if(!name||name.length>255||/[<>\/:;?*|=,\x00-\x1f]/.test(name)){warn('resource-name','Invalid resource names were replaced.');return fallback;}return name;};
  ensureLayer('0');styles.set('Standard',{name:'Standard',fontFamily:'Arial',defaultHeight:2.5,defaultRotation:0,widthFactor:1});
  for(const record of records.filter(r=>r.section==='TABLES')){
    if(record.type==='LAYER'){const name=safeName(first(record,2),'0'),flags=num(record,70,0),source=colorSource(record);layers.set(name,{name,color:color(record)??aciColor(num(record,62,7)),...(source?{colorSource:source}:{}),lineweight:Math.max(0,num(record,370,25))/100,visible:num(record,62,7)>=0&&!(flags&1),locked:!!(flags&4),linetype:linetypeFor(record),plot:num(record,290,1)!==0});}
    if(record.type==='STYLE'){const name=safeName(first(record,2)),file=first(record,3,'').toLowerCase().replace(/^.*[\\/]/,'');let fontFamily;try{fontFamily=canonicalFontFamily(file.replace(/\.ttf$/i,'').replace(/^times$/i,'Times New Roman').replace(/^technic_$/i,'Technic').replace(/^consola$/i,'Consolas').replace(/^segoeui$/i,'Segoe UI'));}catch{fontFamily=file.includes('arial')?'Arial':file.includes('consola')?'Consolas':file.includes('segoe')?'Segoe UI':'Arial';if(!/arial|consola|segoe/.test(file))warn('font','Unsupported source fonts use installed Arial; native font metrics are not retained.');}styles.set(name,{name,fontFamily,defaultHeight:num(record,40,0)>0?num(record,40):2.5,defaultRotation:0,widthFactor:num(record,41,1)});if(first(record,5))handleStyles.set(first(record,5).trim(),name);}
  }
  if(dwgMetadata!==null){
    if(!dwgMetadata||!Array.isArray(dwgMetadata.layers)||dwgMetadata.layers.length>100000)throw Error('Invalid trusted DWG layer metadata.');
    const seen=new Set();for(const sourceLayer of dwgMetadata.layers){
      if(!sourceLayer||typeof sourceLayer.name!=='string'||typeof sourceLayer.visible!=='boolean'||typeof sourceLayer.locked!=='boolean'||seen.has(sourceLayer.name))throw Error('Invalid trusted DWG layer state.');seen.add(sourceLayer.name);
      const layer=layers.get(sourceLayer.name);if(!layer)throw Error('DWG layer metadata does not match the converted layer table.');
      if(layer.visible!==sourceLayer.visible||layer.locked!==sourceLayer.locked)warn('dwg-layer-state','Layer visibility and locking were restored from decoded DWG metadata because this fixed reader changes layer color signs in its DXF output.');
      layer.visible=sourceLayer.visible;layer.locked=sourceLayer.locked;
    }
    if([...layers.keys()].some(name=>!seen.has(name)))throw Error('Converted drawing contains a layer absent from DWG source metadata.');
  }
  dimStyles.set('Standard',{name:'Standard',textStyle:'Standard',textHeight:2.5,arrowSize:2.5,extensionOffset:1,extensionOvershoot:1.25,gap:1,precision:2,scale:1,prefix:'',suffix:''});
  for(const record of records.filter(r=>r.section==='TABLES'&&r.type==='DIMSTYLE')){
    const name=safeName(first(record,2)),post=decodeCADText(first(record,3,'<>'),true).text,parts=post.split('<>');let textStyle=handleStyles.get(first(record,340,'').trim())??'Standard';if(!styles.has(textStyle))textStyle='Standard';
    const dimensionPrecision=Math.max(0,Math.min(8,num(record,271,2))),dimensionFormat=num(record,277,2),angularFormat=num(record,275,Number(hv('$AUNITS')??0)),angularPlaces=num(record,179,-1),unitOverrides={};
    if(dimensionFormat===4)unitOverrides.fractionPrecision=dimensionPrecision;
    if(angularPlaces>=0)unitOverrides.angularPrecision=Math.max(0,Math.min(8,[1,4].includes(angularFormat)?angularPlaces-4:angularPlaces));
    if(![0,1,3].includes(angularFormat))warn('dimension-angular-display','Unsupported source dimension angle presentation follows the drawing display format.');
    const expectedLinear=({2:'decimal',3:'engineering',4:'architectural'})[dimensionFormat],drawingLinear=({2:'decimal',3:'engineering',4:'architectural'})[Number(hv('$LUNITS')??2)]??'decimal';
    if(expectedLinear&&expectedLinear!==drawingLinear)warn('dimension-linear-display','Source dimension-specific linear format follows the drawing display format; geometric measurements are retained.');
    const physicalFactor=['engineering','architectural'].includes(expectedLinear)?({0:1,1:1,2:12,4:1/25.4,5:1/2.54,6:1/.0254})[Number(hv('$INSUNITS')??0)]??1:1;
    if(Math.abs(num(record,144,1)-physicalFactor)>1e-10*Math.max(1,Math.abs(physicalFactor)))warn('dimension-measurement-factor','Source alternate dimension measurement factor is not retained; dimensions measure their original definition geometry in the assigned drawing units.');
    const tick=num(record,142,0);dimStyles.set(name,{name,textStyle,textHeight:num(record,140,2.5),arrowSize:tick>0?tick:num(record,41,2.5),...(tick>0?{arrowType:'architectural-tick'}:{}),extensionOffset:num(record,42,1),extensionOvershoot:num(record,44,1.25),gap:num(record,147,1),precision:dimensionPrecision,...unitOverrides,scale:num(record,40,1)||1,prefix:parts.length===2?parts[0]:'',suffix:parts.length===2?parts[1]:''});
  }
  let current=null;
  for(const record of records.filter(r=>r.section==='BLOCKS')){
    if(record.type==='BLOCK'){current={name:first(record,2,'').trim(),base:xyz(record),flags:num(record,70,0),records:[]};blocks.set(current.name,current);}
    else if(record.type==='ENDBLK')current=null;else current?.records.push(record);
  }
  const publish=entity=>{if(entities.length>=MAX_ENTITIES)throw Error('Imported drawing exceeds 100000 objects.');entities.push({id:`e${entities.length+1}`,...entity,...(currentPaperLayout?{layoutId:currentPaperLayout.id}:{})});};
  const styleFor=(record,context)=>{const layer=ensureLayer(safeName(first(record,8,'0'),'0')==='0'&&context.layer?context.layer:safeName(first(record,8,'0'),'0')),ink=color(record,context.color),source=colorSource(record)??(num(record,62,256)===0?context.colorSource:undefined),linetype=linetypeFor(record,true);return{layer,...(ink?{color:ink,...(source?{colorSource:source}:{})}:{}),...(linetype?{linetype}:{}),...(num(record,370,-1)>=0?{lineweight:num(record,370)/100}:{})};};
  const path=(points,closed,common)=>{const p=compact(points,closed);if(p.length<(closed?3:2))throw Error('Collapsed imported path.');if(p.every(v=>v.z===0))publish({...common,type:'PLINE',points:p.map(xy),closed});else publish({...common,type:'POLY3D',points:p,closed});};
  const line=(a,b,common)=>{if(eq(a,b))throw Error('Collapsed imported line.');if(a.z===0&&b.z===0)publish({...common,type:'LINE',start:xy(a),end:xy(b)});else publish({...common,type:'POLY3D',points:[a,b],closed:false});};
  const curve=(center,radius,start,sweep,isCircle,transform,common)=>{
    if(!(radius>0&&Number.isFinite(radius)))throw Error('Invalid curve radius.');
    const c=transform(center),ux=transform(add(center,{x:radius,y:0,z:0})),uy=transform(add(center,{x:0,y:radius,z:0})),u={x:ux.x-c.x,y:ux.y-c.y,z:ux.z-c.z},v={x:uy.x-c.x,y:uy.y-c.y,z:uy.z-c.z},ru=Math.hypot(u.x,u.y,u.z),rv=Math.hypot(v.x,v.y,v.z),orthogonal=Math.abs(u.x*v.x+u.y*v.y+u.z*v.z)<=1e-10*ru*rv;
    if(c.z===0&&u.z===0&&v.z===0&&Math.abs(ru-rv)<=1e-10*Math.max(ru,rv)&&orthogonal){
      if(isCircle)publish({...common,type:'CIRCLE',center:xy(c),radius:ru});
      else{const sign=u.x*v.y-u.y*v.x<0?-1:1;publish({...common,type:'ARC',center:xy(c),radius:ru,startAngle:angle(Math.atan2(u.y,u.x))+sign*start,sweepAngle:sign*sweep});}
    }else if(ru>0&&rv>0&&Number.isFinite(ru)&&Number.isFinite(rv)&&Math.abs(ru-rv)<=1e-10*Math.max(ru,rv)&&orthogonal){
      const basis={center:c,radius:ru,xAxis:mul(u,1/ru),yAxis:mul(v,1/rv)};
      publish({...common,type:isCircle?'CIRCLE3D':'ARC3D',...basis,...(isCircle?{}:{startAngle:start,sweepAngle:sweep})});
    }else{
      const count=Math.max(8,Math.ceil(Math.abs(sweep)/5)),points=Array.from({length:isCircle?count:count+1},(_,i)=>transform(add(center,{x:radius*Math.cos(radians(start+sweep*i/count)),y:radius*Math.sin(radians(start+sweep*i/count)),z:0})));
      path(points,isCircle,common);warn('tessellated-curve','Nonuniformly scaled circles/arcs are polygonal approximations with at most 5-degree angular steps.');
    }
  };
  const decodeRecords=(list,context={transform:identity,layer:null,color:null},depth=0,ancestry=[])=>{
    if(depth>16)throw Error('Block nesting exceeds 16 levels.');
    for(let i=0;i<list.length;i++){
      const record=list[i];if(['VERTEX','SEQEND','ATTRIB','ATTDEF'].includes(record.type)){if(record.type==='ATTRIB'||record.type==='ATTDEF')skip(record.type,'Block attributes are not editable/imported annotations.');continue;}
      const common=styleFor(record,context),transform=context.transform;
      try{
        if(record.type==='LEADER'){
          if(num(record,72,0)!==0)throw Error('Spline leaders are unsupported.');const points=[];let p=null;for(const[c,raw]of record.groups){if(c===10){if(p)points.push(p);p={x:Number(raw),y:NaN,z:0};}else if(p&&c===20)p.y=Number(raw);else if(p&&c===30)p.z=Number(raw);}if(p)points.push(p);if(points.length!==num(record,76))throw Error('Leader vertex count is malformed.');const annotation=records.find(r=>first(r,5)===first(record,340)&&r.type==='MTEXT');if(!annotation)throw Error('Only text-annotated leaders are supported.');const primary=annotation.groups.findIndex(([c])=>c===101),a={...annotation,groups:primary<0?annotation.groups:annotation.groups.slice(0,primary)},content=decodeCADText(a.groups.filter(([c])=>c===1||c===3).map(([,v])=>v).join(''),true).text;if(/[\r\n]/.test(content))throw Error('Only single-line leader annotations are supported.');let style=safeName(first(a,7));if(!styles.has(style))style='Standard';const dim=dimStyles.get(safeName(first(record,3)))??dimStyles.get('Standard'),origin=transform({x:0,y:0,z:0}),up=transform({x:0,y:1,z:0}),scale=Math.hypot(up.x-origin.x,up.y-origin.y);publish({...common,type:'LEADER',points:points.map(p=>xy(transform(p))),text:content,style,height:num(a,40)*scale,arrowSize:dim.arrowSize*dim.scale*scale,arrowType:dim.arrowType??'closed-filled'});warn('leader-landing','Leader vertices and annotation text are editable; native automatic annotation gap/attachment is represented by the explicit Linecraft endpoint baseline.');continue;
        }
        if(record.type==='MTEXT'&&list.some(r=>r.type==='LEADER'&&first(r,340)===first(record,5)))continue;
        if(record.type==='VIEWPORT'){continue;}
        if(record.type==='IMAGE'){
          const def=records.find(item=>item.type==='IMAGEDEF'&&first(item,5)===first(record,340));if(!def)throw Error('IMAGE definition is missing.');const width=num(record,13,num(def,10)),height=num(record,23,num(def,20)),id=`image-${first(def,5,'resource')}`;let resource=imageResources.find(r=>r.id===id);if(!resource){const sourceName=first(def,1,'');resource={id,name:sourceName.replace(/^.*[\\/]/,'')||id,width,height,sourceName:sourceName||`${id}.jpg`};imageResources.push(resource);}
          const origin=transform(xyz(record)),zero=transform({x:0,y:0,z:0}),u=transform(mul(xyz(record,11),width)),v=transform(mul(xyz(record,12),height));publish({...common,type:'IMAGE',resourceId:id,position:xy(origin),uVector:{x:u.x-zero.x,y:u.y-zero.y},vVector:{x:v.x-zero.x,y:v.y-zero.y}});warn('image-sidecar','Raster images retain their placement and linked resource; the safe desktop resource resolver must supply the matching JPEG/PNG.');continue;
        }
        if(record.type==='LINE'){line(transform(xyz(record)),transform(xyz(record,11)),common);continue;}
        if(record.type==='CIRCLE'||record.type==='ARC'){
          const basis=ocs(record),apply=p=>transform(basis.point(p)),start=num(record,50,0),sweep=record.type==='CIRCLE'?360:((num(record,51)-start)%360+360)%360;
          curve(xyz(record),num(record,40),start,sweep,record.type==='CIRCLE',apply,common);continue;
        }
        if(record.type==='ELLIPSE'){
          const center=xyz(record),major=xyz(record,11),normal=ocs(record).n,ratio=num(record,40),start=num(record,41,0),end=num(record,42,2*Math.PI);
          if(!(ratio>0&&ratio<=1)||Math.abs(end-start-2*Math.PI)>1e-8)throw Error('Only complete ellipses are supported.');
          const minor=mul(cross(normal,major),ratio),c=transform(center),a=transform(add(center,major)),b=transform(add(center,minor)),u={x:a.x-c.x,y:a.y-c.y,z:a.z-c.z},v={x:b.x-c.x,y:b.y-c.y,z:b.z-c.z};
          if(c.z===0&&u.z===0&&v.z===0){
            // Singular axes of the transformed conic retain exact ellipses even under shear.
            const s=Math.max(Math.abs(u.x),Math.abs(u.y),Math.abs(v.x),Math.abs(v.y));if(!s||!Number.isFinite(s))throw Error('Collapsed ellipse axes.');
            const ux=u.x/s,uy=u.y/s,vx=v.x/s,vy=v.y/s,qx=ux*ux+vx*vx,qy=uy*uy+vy*vy,qxy=ux*uy+vx*vy,trace=qx+qy,disc=Math.hypot(qx-qy,2*qxy),large=(trace+disc)/2,small=(ux*vy-uy*vx)**2/large,theta=.5*Math.atan2(2*qxy,qx-qy),length=s*Math.sqrt(large);
            const entity={...common,type:'ELLIPSE',center:xy(c),major:{x:length*Math.cos(theta),y:length*Math.sin(theta)},ratio:Math.sqrt(small/large)};validateEllipse(entity);publish(entity);
          }else{
            path(Array.from({length:128},(_,n)=>transform(add(center,add(mul(major,Math.cos(n*2*Math.PI/128)),mul(minor,Math.sin(n*2*Math.PI/128)))))),true,common);warn('ellipse-tessellated','Non-XY ellipses import as 128-segment spatial approximations.');
          }continue;
        }
        if(record.type==='SPLINE'){
          const flags=num(record,70,0);if(num(record,71)!==3||flags&7)throw Error('Only open, nonrational clamped cubic splines are supported.');
          const vertices=[];let vertex=null;for(const[code,raw]of record.groups){if(code===10){if(vertex)vertices.push(vertex);vertex={x:Number(raw),y:NaN,z:0};}else if(vertex&&code===20)vertex.y=Number(raw);else if(vertex&&code===30)vertex.z=Number(raw);}if(vertex)vertices.push(vertex);
          const weights=record.groups.filter(([code])=>code===41).map(([,v])=>Number(v));if(weights.some(v=>v!==1))throw Error('Rational weights are unsupported.');
          const rawKnots=record.groups.filter(([code])=>code===40).map(([,v])=>Number(v)),a=rawKnots[3],b=rawKnots.at(-4);if(!(b>a))throw Error('Invalid spline parameter range.');
          const entity={...common,type:'SPLINE',degree:3,closed:false,controlPoints:vertices.map(p=>xy(transform(p))),knots:rawKnots.map(k=>(k-a)/(b-a))};validateSpline(entity);publish(entity);continue;
        }
        if(record.type==='HATCH'){
          if(num(record,70,0)!==1||num(record,91)!==1||!(num(record,92,0)&2))throw Error('Only solid hatches with one straight polyline boundary are supported.');
          const begin=record.groups.findIndex(([code])=>code===92),end=record.groups.findIndex(([code],index)=>index>begin&&code===97),groups=record.groups.slice(begin+1,end<0?undefined:end),loop={type:'HATCH-boundary',groups};
          if(num(loop,73,0)!==1||groups.some(([code,raw])=>code===42&&Number(raw)!==0))throw Error('Open or curved hatch loops are unsupported.');
          const points=[];let vertex=null;for(const[code,raw]of groups){if(code===10){if(vertex)points.push(vertex);vertex={x:Number(raw),y:NaN,z:0};}else if(vertex&&code===20)vertex.y=Number(raw);}if(vertex)points.push(vertex);
          if(points.length!==num(loop,93)||points.length<3||points.length>4096)throw Error('Malformed hatch boundary or exceeds the 4096-vertex limit.');
          // Remove only exact zero-length source edges, before any OCS/block transform.
          const boundary=compact(points,true),basis=ocs(record),elevation=num(record,30,0),polygon=boundary.map(p=>xy(transform(basis.point({...p,z:elevation}))));
          triangulatePolygon(polygon);if(boundary.length!==points.length)warn('hatch-redundant-vertices','Exact duplicate adjacent/closing vertices were removed from straight solid HATCH boundaries; all other vertices were retained.');publish({...common,type:'HATCH',boundary:{type:'PLINE',points:polygon,closed:true},pattern:'solid',angle:0,spacing:1,origin:polygon[0]});warn('hatch-import','Supported solid hatches retain captured nonassociative boundaries.');continue;
        }
        if(record.type==='LWPOLYLINE'||record.type==='POLYLINE'){
          const flags=num(record,70,0),closed=!!(flags&1),basis=ocs(record),vertices=[];
          if(record.type==='LWPOLYLINE'){
            let vertex=null;for(const[code,raw]of record.groups){if(code===10){if(vertex)vertices.push(vertex);vertex={x:Number(raw),y:NaN,z:num(record,38,0),bulge:0};}else if(vertex&&code===20)vertex.y=Number(raw);else if(vertex&&code===42)vertex.bulge=Number(raw);}if(vertex)vertices.push(vertex);
          }else{
            while(list[i+1]?.type==='VERTEX'){const child=list[++i];if(flags&64){vertices.push({record:child});}else{const p=xyz(child);if(!(flags&8))p.z=num(record,30,0);vertices.push({...p,bulge:num(child,42,0)});}}if(list[i+1]?.type==='SEQEND')i++;
            if(flags&64){
              const points=vertices.filter(v=>!(num(v.record,70,0)&128)||num(v.record,70,0)&64).map(v=>transform(xyz(v.record))),faces=vertices.filter(v=>num(v.record,70,0)&128&&!(num(v.record,70,0)&64)).map(v=>[71,72,73,74].map(code=>Math.abs(num(v.record,code,0))-1).filter(index=>index>=0));
              publish({...common,type:'MESH',vertices:points,faces});continue;
            }
            if(flags&16){skip('POLYLINE-mesh','Legacy rectangular polygon meshes are not decoded.');continue;}
          }
          if(vertices.some(v=>!['x','y','z','bulge'].every(key=>Number.isFinite(v[key]))))throw Error('Malformed polyline vertex.');
          const apply=flags&8&&record.type==='POLYLINE'?transform:p=>transform(basis.point(p));
          if(!vertices.some(v=>v.bulge)){path(vertices.map(apply),closed,common);continue;}
          for(let n=0;n<(closed?vertices.length:vertices.length-1);n++){
            const a=vertices[n],b=vertices[(n+1)%vertices.length],bulge=a.bulge;if(!bulge){line(apply(a),apply(b),common);continue;}
            if(a.z!==b.z)throw Error('Nonplanar bulged path.');const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(!d)throw Error('Collapsed bulged segment.');
            const offset=d*(1-bulge*bulge)/(4*bulge),c={x:(a.x+b.x)/2-dy/d*offset,y:(a.y+b.y)/2+dx/d*offset,z:a.z};curve(c,d*(1+bulge*bulge)/(4*Math.abs(bulge)),angle(Math.atan2(a.y-c.y,a.x-c.x)),angle(4*Math.atan(bulge)),false,apply,common);
          }
          warn('bulged-polyline','Bulged polylines import as individual analytic line/arc segments.');continue;
        }
        if(record.type==='3DFACE'||record.type==='SOLID'||record.type==='TRACE'){
          const basis=ocs(record),p=[10,11,12,13].map(code=>record.type==='3DFACE'?transform(xyz(record,code)):transform(basis.point(xyz(record,code))));
          if(record.type!=='3DFACE'){[p[2],p[3]]=[p[3],p[2]];}else if(num(record,70,0))warn('face-hidden-edges','Source face edge invisibility is not retained in wireframe display.');const vertices=compact(p,true);publish({...common,type:'MESH',vertices,faces:[vertices.map((_,index)=>index)]});continue;
        }
        if(record.type==='INSERT'){
          const name=first(record,2,'').trim(),block=blocks.get(name);if(!block){skip('INSERT-missing','An INSERT references a missing block.');continue;}if(block.flags&4){skip('INSERT-xref','External reference files are not followed or loaded.');continue;}if(ancestry.includes(name))throw Error('Cyclic block references.');
          const basis=ocs(record),position=basis.point(xyz(record)),sx=num(record,41,1),sy=num(record,42,1),sz=num(record,43,1),rotation=radians(num(record,50,0)),columns=num(record,70,1),rows=num(record,71,1);
          if(!sx||!sy||!sz||!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||rows<1||columns*rows>10000)throw Error('Invalid block scale or array.');
          const c=Math.cos(rotation),s=Math.sin(rotation);
          for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
            const apply=p=>{const x=(p.x-block.base.x)*sx+column*num(record,44,0),y=(p.y-block.base.y)*sy+row*num(record,45,0),z=(p.z-block.base.z)*sz;return transform(add(position,add(add(mul(basis.a,x*c-y*s),mul(basis.b,x*s+y*c)),mul(basis.n,z))));};
            decodeRecords(block.records,{transform:apply,layer:common.layer,color:common.color??layers.get(common.layer)?.color,colorSource:common.colorSource??layers.get(common.layer)?.colorSource},depth+1,[...ancestry,name]);
          }
          warn('block-expanded','Ordinary blocks are expanded into editable primitives; block identities and attributes are not retained.');continue;
        }
        if(record.type==='TEXT'||record.type==='MTEXT'){
          const embedded=record.groups.findIndex(([code])=>code===101),main={...record,groups:embedded<0?record.groups:record.groups.slice(0,embedded)},basis=ocs(main),apply=p=>transform(basis.point(p)),horizontal=num(main,72,0),vertical=num(main,73,0),anchor=record.type==='TEXT'&&first(main,11)!==undefined&&(![0,3,5].includes(horizontal)||vertical!==0)?xyz(main,11):xyz(main),position=apply(anchor);
          const directionIndex=main.groups.findLastIndex(([code])=>code===11),rotationIndex=main.groups.findLastIndex(([code])=>code===50),rotation=record.type==='MTEXT'?num(main,50,0):radians(num(main,50,0));
          const direction=record.type==='MTEXT'&&directionIndex>rotationIndex?unit(xyz(main,11)):{x:Math.cos(rotation),y:Math.sin(rotation),z:0},tip=apply(add(anchor,direction)),up=apply(add(anchor,{x:-direction.y,y:direction.x,z:0}));
          if(position.z!==0||tip.z!==0||up.z!==0)throw Error('Non-XY text is unsupported.');const hScale=Math.hypot(up.x-position.x,up.y-position.y),widthScale=Math.hypot(tip.x-position.x,tip.y-position.y);
          let style=safeName(first(main,7));if(!styles.has(style)){style='Standard';warn('missing-style','Missing annotation styles use Standard.');}
          const sourceStyle=styles.get(style),factor=(record.type==='TEXT'?num(main,41,sourceStyle.widthFactor):sourceStyle.widthFactor)*widthScale/hScale;
          if(Math.abs(factor-sourceStyle.widthFactor)>1e-12){let derived=`ImportedText${styles.size+1}`;while(styles.has(derived))derived+='x';styles.set(derived,{...sourceStyle,name:derived,widthFactor:factor});style=derived;}
          const rawContent=record.type==='MTEXT'?main.groups.filter(([code])=>code===1||code===3).map(([,raw])=>raw).join(''):first(main,1,''),decoded=decodeCADText(rawContent,record.type==='MTEXT');if(!decoded.text.trim())throw Error('Empty imported text.');
          if(record.type==='TEXT'&&(horizontal!==0||vertical!==0))warn('text-alignment','Source TEXT alignment uses the shared text-box metrics.');
          if(Math.abs(widthScale-hScale)>1e-10*Math.max(widthScale,hScale))warn('text-nonuniform','Nonuniform text scaling cannot retain native glyph proportions.');
          const entity={...common,type:record.type,position:xy(position),text:decoded.text,height:num(main,40)*hScale,rotation:angle(Math.atan2(tip.y-position.y,tip.x-position.x)),style};
          if(record.type==='MTEXT'){
            entity.width=num(main,41)>0?num(main,41)*widthScale:Math.max(entity.height,decoded.text.length*entity.height*.6);
            // Relative controls scale naturally with base height. Absolute height
            // controls must follow a paper-unit/block scale exactly once.
            const scaledRaw=rawContent.replace(/\\H([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*;/g,(_,n)=>`\\H${Number(n)*hScale};`),parsed=parseRichText(scaledRaw,{...styles.get(style),height:entity.height});entity.text=parsed.text;entity.richText={version:1,source:scaledRaw,attachment:num(main,71,1),lineSpacingStyle:num(main,73,1),lineSpacingFactor:num(main,44,1)};parsed.warnings.forEach(w=>warn(`rich-${w}`,`MTEXT retains unsupported formatting source: ${w}.`));publish(entity);continue;
          }
          const layout=textLayout(entity,{textStyles:[...styles.values()]}),c=Math.cos(radians(entity.rotation)),s=Math.sin(radians(entity.rotation));let dx=0,dy=0;
          if(record.type==='TEXT'){dx=horizontal===1||horizontal===4?-layout.width/2:horizontal===2?-layout.width:0;dy=horizontal===4||vertical===2?-.325*entity.height:vertical===3?-entity.height:vertical===1?.35*entity.height:0;}
          else{const attachment=num(main,71,1);dx=(attachment-1)%3===1?-entity.width/2:(attachment-1)%3===2?-entity.width:0;dy=Math.floor((attachment-1)/3)*layout.height/2;}
          entity.position={x:entity.position.x+dx*c-dy*s,y:entity.position.y+dx*s+dy*c};publish(entity);continue;
        }
        if(record.type==='DIMENSION'){
          const kind=({0:'linear',1:'aligned',3:'diameter',4:'radius',5:'angular'})[num(record,70)&7];if(!kind){const block=blocks.get(first(record,2,''));if(block){decodeRecords(block.records,context,depth+1,ancestry);warn('dimension-exploded','Unsupported dimension types import as cached picture primitives.');}else skip('DIMENSION','Dimension subtype has no supported definition or picture block.');continue;}
          let style=safeName(first(record,3));if(!dimStyles.has(style))style='Standard';const origin=transform(xyz(record)),xAxis=transform(add(xyz(record),{x:1,y:0,z:0})),yAxis=transform(add(xyz(record),{x:0,y:1,z:0})),sx=Math.hypot(xAxis.x-origin.x,xAxis.y-origin.y),sy=Math.hypot(yAxis.x-origin.x,yAxis.y-origin.y);
          if(origin.z!==0||xAxis.z!==0||yAxis.z!==0||Math.abs(sx-sy)>1e-10*Math.max(sx,sy))throw Error('Nonplanar/nonuniform dimension is unsupported.');
          const entity={...common,type:'DIMENSION',kind,placement:xy(origin),style,scale:sx};
          if(['linear','aligned','angular'].includes(kind)){entity.p1=xy(transform(xyz(record,13)));entity.p2=xy(transform(xyz(record,14)));if(kind==='angular')entity.vertex=xy(transform(xyz(record,15)));if(kind==='linear')entity.axisAngle=num(record,50,0)+angle(Math.atan2(xAxis.y-origin.y,xAxis.x-origin.x));}
          else{const opposite=transform(xyz(record,15)),center=kind==='radius'?origin:mul(add(origin,opposite),.5);entity.center=xy(center);entity.radius=Math.hypot(opposite.x-center.x,opposite.y-center.y);entity.placement=xy(opposite);}
          const override=decodeCADText(first(record,1,'')).text;if(override&&override!=='<>')entity.textOverride=override;publish(entity);warn('dimension-layout','Imported dimensions retain nonassociative definitions; native automatic label layout may differ.');continue;
        }
        if(record.type==='POINT'){skip('POINT','Standalone points are unsupported.');continue;}
        skip(record.type,`Unsupported ${record.type} objects were not imported.`);
      }catch(error){
        if(/nesting exceeds|Cyclic block|exceeds 100000/.test(error.message))throw error;
        skip(record.type,`Some ${record.type} objects cannot be represented: ${error.message}`);
      }
    }
  };
  const modelRecords=records.filter(record=>record.section==='ENTITIES'&&first(record,67,'0').trim()!=='1'&&(!first(record,410)||first(record,410).trim()==='Model'));
  decodeRecords(modelRecords);
  // Paper geometry is owned by its persisted block record, including inactive
  // layouts stored in BLOCKS. Do not relocate it to Model or invent geometry.
  const layoutRecords=records.filter(r=>r.type==='LAYOUT').map(record=>{const split=record.groups.findIndex(([c,v])=>c===100&&v==='AcDbLayout'),plot={...record,groups:record.groups.slice(0,split)},layout={...record,groups:record.groups.slice(split+1)};return{record,plot,layout,name:first(layout,1,''),owner:layout.groups.filter(([c])=>c===330).at(-1)?.[1],order:num(layout,71,0)};}).filter(r=>r.name&&r.name!=='Model').sort((a,b)=>a.order-b.order);
  for(const sourceLayout of layoutRecords){
    const owned=records.filter(r=>['ENTITIES','BLOCKS'].includes(r.section)&&!['BLOCK','ENDBLK','VERTEX','SEQEND'].includes(r.type)&&(first(r,330)===sourceLayout.owner||first(r,410)===sourceLayout.name));
    if(!owned.some(r=>r.type!=='VIEWPORT'))continue;if(layouts.length>=32)throw Error('Imported drawing exceeds 32 paper layouts.');
    const inch=num(sourceLayout.plot,72,1)===0,paperFactor=inch?25.4:1,sourceWidth=num(sourceLayout.plot,44,420),sourceHeight=num(sourceLayout.plot,45,297),media=first(sourceLayout.plot,4,''),canonical=/ARCH_D_\(36\.00_x_24\.00_Inches\)/i.test(media)&&Math.abs(sourceWidth-914.4)<.001&&Math.abs(sourceHeight-609.6)<.001;
    const width=canonical?914.4:sourceWidth,height=canonical?609.6:sourceHeight,marginsMm={left:num(sourceLayout.plot,40,0),bottom:num(sourceLayout.plot,41,0),right:num(sourceLayout.plot,42,0),top:num(sourceLayout.plot,43,0)},originMm={x:num(sourceLayout.plot,46,0),y:num(sourceLayout.plot,47,0)},layout={id:`layout${layouts.length+1}`,name:safeName(sourceLayout.name,`Imported sheet ${layouts.length+1}`),paper:{size:'Custom',orientation:width>=height?'landscape':'portrait',widthMm:width,heightMm:height},entities:[],viewports:[],plotSettings:{marginsMm,originMm,renderOffsetMm:{x:marginsMm.left+originMm.x,y:marginsMm.bottom+originMm.y},sourcePaperUnits:inch?'in':'mm',sourceMediaMm:{width:sourceWidth,height:sourceHeight},deviceName:first(sourceLayout.plot,2,''),mediaName:media}};layouts.push(layout);currentPaperLayout=layout;
    decodeRecords(owned.filter(r=>r.type!=='VIEWPORT'),{transform:p=>mul(p,paperFactor),layer:null,color:null});
    for(const viewport of owned.filter(r=>r.type==='VIEWPORT')){
      if(num(viewport,69,1)===1){warn('overall-paper-viewport','The overall paper navigation viewport is represented by the layout itself and written as one overall viewport on export.');continue;}
      if(layout.viewports.length>=16)throw Error('Imported layout exceeds 16 model viewports.');
      try{const center=xyz(viewport),w=num(viewport,40)*paperFactor,h=num(viewport,41)*paperFactor,viewHeight=num(viewport,45),normal=unit({x:num(viewport,16,0),y:num(viewport,26,0),z:num(viewport,36,1)}),yaw=angle(Math.atan2(normal.y,normal.x)),pitch=angle(Math.asin(normal.z)),roll=num(viewport,51,0),cy=Math.cos(radians(yaw)),sy=Math.sin(radians(yaw)),cp=Math.cos(radians(pitch)),sp=Math.sin(radians(pitch)),cr=Math.cos(radians(roll)),sr=Math.sin(radians(roll)),right={x:-sy*cr-cy*sp*sr,y:cy*cr-sy*sp*sr,z:cp*sr},up={x:-cy*sp*cr+sy*sr,y:-sy*sp*cr-cy*sr,z:cp*cr},target={x:num(viewport,17,0),y:num(viewport,27,0),z:num(viewport,37,0)},top=Math.abs(normal.x)<1e-12&&Math.abs(normal.y)<1e-12&&normal.z>0&&roll===0,modelCenter=top?add(target,{x:num(viewport,12,0),y:num(viewport,22,0),z:0}):add(target,add(mul(right,num(viewport,12,0)),mul(up,num(viewport,22,0)))),units=({0:'unitless',1:'in',2:'ft',4:'mm',5:'cm',6:'m'})[Number(hv('$INSUNITS'))]??'unitless',scaleDenominator=modelUnitMillimeters({units})*viewHeight/h;
        const frame={x:center.x*paperFactor-w/2,y:center.y*paperFactor-h/2,width:w,height:h},frozenLayers=viewport.groups.filter(([c])=>c===331).map(([,handle])=>records.find(r=>r.type==='LAYER'&&first(r,5)===handle)).filter(Boolean).map(r=>safeName(first(r,2),'0')),view={id:`viewport-${first(viewport,5,`${layout.id}-${layout.viewports.length+1}`)}`,frame,modelCenter,scaleDenominator,locked:!!(num(viewport,90,0)&16384),frozenLayers,layer:ensureLayer(safeName(first(viewport,8,'0'),'0')),workspace:top?'2d':'3d',camera3d:{yaw:top?-90:yaw,pitch:top?90:pitch,roll,mode:top?'top':'custom',projection:'orthographic'},plotBorder:false};layout.viewports.push(view);
      }catch(error){skip('VIEWPORT',`A paper viewport could not be represented: ${error.message}`);}
    }
    currentPaperLayout=null;
  }
  if(!entities.length&&!layouts.length)throw Error('The file has no supported model-space drawing geometry or paper layout content.');
  const units=({0:'unitless',1:'in',2:'ft',4:'mm',5:'cm',6:'m'})[Number(hv('$INSUNITS'))]??'unitless',rawPrecision=Number(hv('$LUPREC')??4),currentLayer=safeName(hv('$CLAYER'),'0');ensureLayer(currentLayer);
  const linearCode=Number(hv('$LUNITS')??2),angularCode=Number(hv('$AUNITS')??0),rawAngularPrecision=Number(hv('$AUPREC')??([1,4].includes(angularCode)?0:4)),precision=Number.isInteger(rawPrecision)&&rawPrecision>=0&&rawPrecision<=8?rawPrecision:4;
  const linearFormat=({2:'decimal',3:'engineering',4:'architectural'})[linearCode]??'decimal',angularFormat=({0:'decimal-degrees',1:'dms',3:'radians',4:'dms'})[angularCode]??'decimal-degrees';
  if(![2,3,4].includes(linearCode))warn('linear-display','Unsupported source linear display format uses decimal output; coordinates and assigned units are retained.');
  if(![0,1,3,4].includes(angularCode))warn('angular-display','Unsupported source angular display format uses decimal degrees; geometric angles are retained.');
  if(angularCode===4)warn('surveyor-bearings','Source survey bearings use degrees/minutes/seconds display; north/south bearing presentation is not retained.');
  const nativeAngularPrecision=Number.isInteger(rawAngularPrecision)&&rawAngularPrecision>=0&&rawAngularPrecision<=8?rawAngularPrecision:4;
  if(angularFormat==='dms'&&nativeAngularPrecision<4)warn('coarse-dms','Source degrees-only or degree/minute precision uses whole-second DMS display; geometric angles are retained.');
  const unitSettings={units,precision,linearFormat,fractionPrecision:linearFormat==='architectural'?precision:4,angularInputUnit:angularCode===3?'radians':'degrees',angularFormat,angularPrecision:angularFormat==='dms'?Math.max(0,nativeAngularPrecision-4):nativeAngularPrecision};
  const document={format:'Linecraft/1',entities,layers:[...layers.values()],currentLayer,textStyles:[...styles.values()],dimStyles:[...dimStyles.values()],settings:unitSettings,workspace:entities.some(entity=>['MESH','POLY3D','CIRCLE3D','ARC3D'].includes(entity.type))?'3d':'2d',...(layouts.length?{layouts,activeSpace:'paper',activeLayoutId:layouts[0].id}:{}),...(imageResources.length?{imageResources,rasterSettings:{frame:num(records.find(record=>record.type==='RASTERVARIABLES')??{groups:[]},70,1)}}:{})};
  const editor=createEditor(),accepted=editor.importJSON(JSON.stringify(document));if(!accepted.ok)throw Error(`Imported geometry did not pass document validation: ${accepted.message}`);
  const text=editor.serialize();if(new TextEncoder().encode(text).length>25*1024*1024)throw Error('Normalized drawing exceeds the 25MiB document limit.');
  const report={sourceFormat:'DXF',sourceName:String(sourceName).slice(0,1024),modelSourceEntities:modelRecords.filter(record=>!['VERTEX','SEQEND'].includes(record.type)).length,importedEntities:editor.state.entities.length,unsupportedByType:Object.fromEntries(unsupported),unsupportedEntities:[...unsupported.values()].reduce((sum,n)=>sum+n,0),warnings:[...warnings.values()],modelSpaceOnly:!layouts.length,paperLayouts:layouts.map(l=>({id:l.id,name:l.name,entities:editor.state.entities.filter(e=>e.layoutId===l.id).length,viewports:l.viewports.length,paper:l.paper,plotSettings:l.plotSettings})),sourceLayerStatesFromDWG:dwgMetadata!==null,sourceAssociationAdopted:false,originalFileWritten:false,scope:'Supported model and owned paper primitives with bounded ordinary block expansion, editable rich MTEXT and linked raster resources. Unsupported objects, missing image/font resources and rich-text layout limitations are reported; proprietary solids, xrefs and unrestricted native compatibility are not claimed.'};
  return{text,report};
}
