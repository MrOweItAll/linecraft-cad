/* Original vector plotting. Documents are validated, and labels are escaped before HTML. */
import * as core from './core.mjs';
import {projectPoint,cameraBasis} from './3d-view.mjs';

export const PAPERS=Object.freeze({A4:[210,297],A3:[297,420],Letter:[215.9,279.4],Tabloid:[279.4,431.8]});
export const DEFAULT_PLOT_OPTIONS=Object.freeze({paper:'A4',orientation:'landscape',scaleMode:'fit',ratio:1,margin:10,colorMode:'monochrome',lineweights:true});
const units={mm:1,cm:10,m:1000,in:25.4,ft:304.8};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=value=>{if(!Number.isFinite(value))throw Error('Plot geometry exceeds the finite numeric range.');return Number(value.toPrecision(12)).toString();};
const pointString=p=>`${numeric(p.x)},${numeric(p.y)}`;
const midpoint=(a,b)=>Math.sign(a)===Math.sign(b)?a+(b-a)/2:a/2+b/2;

export function normalizePlotOptions(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!Object.hasOwn(DEFAULT_PLOT_OPTIONS,key)))throw Error('Unsupported plot option.');
  const o={...DEFAULT_PLOT_OPTIONS,...raw};
  if(!Object.hasOwn(PAPERS,o.paper)||!['portrait','landscape'].includes(o.orientation)||!['fit','scale'].includes(o.scaleMode)||!['color','grayscale','monochrome'].includes(o.colorMode))throw Error('Unsupported paper, orientation, scale or color mode.');
  if(typeof o.ratio!=='number'||!Number.isFinite(o.ratio)||o.ratio<1||o.ratio>1e9)throw Error('Plot ratio must be between 1 and 1000000000.');
  if(typeof o.margin!=='number'||!Number.isFinite(o.margin)||o.margin<5||o.margin>40)throw Error('Paper margin must be between 5 and 40 mm.');
  if(typeof o.lineweights!=='boolean')throw Error('Plot lineweights must be boolean.');
  return o;
}

function visibleEntities(document){
  const visible=entity=>document.layers.find(layer=>layer.name===entity.layer)?.visible!==false;
  const sources=document.entities.filter(visible),flat=[];
  for(const entity of sources){
    if(entity.type==='INSERT'){
      if(typeof core.expandedInsertEntities!=='function')throw Error('Plotting block references is not ready.');
      flat.push(...core.expandedInsertEntities(entity,document).filter(visible));
    }else flat.push(entity);
  }
  return flat;
}

function curvePoints(entity){
  if(!['CIRCLE','ARC'].includes(entity.type))return null;
  const sweep=entity.type==='CIRCLE'?360:entity.sweepAngle,start=entity.type==='CIRCLE'?0:entity.startAngle,count=Math.max(2,Math.ceil(Math.abs(sweep)/2));
  return Array.from({length:count+1},(_,i)=>{const angle=(start+sweep*i/count)*Math.PI/180;return{x:entity.center.x+entity.radius*Math.cos(angle),y:entity.center.y+entity.radius*Math.sin(angle),z:entity.center.z??0};});
}

function projectedBoundsPoints(entity,document,camera){
  if(entity.type==='HATCH'){
    const geometry=core.hatchGeometry(entity);
    return [...projectedBoundsPoints(entity.boundary,document,camera),...geometry.segments.flat(),...geometry.fills.flatMap(fill=>fill.points)];
  }
  if(entity.type==='ELLIPSE'){
    const sampled=core.sampleCurve(entity,128);
    if(camera.projection==='perspective')return sampled;
    const {right,up}=cameraBasis(camera),a=entity.major,b={x:-a.y*entity.ratio,y:a.x*entity.ratio},extrema=[];
    for(const axis of [right,up]){const parameter=Math.atan2(b.x*axis.x+b.y*axis.y,a.x*axis.x+a.y*axis.y)/(2*Math.PI);extrema.push(core.ellipsePoint(entity,parameter),core.ellipsePoint(entity,parameter+.5));}
    return [...sampled,...extrema];
  }
  if(entity.type==='SPLINE'){
    // The exact span control hull is conservative under orthographic projection.
    // It also covers projected curves when all control points are in front of the eye.
    return [...core.splineBezierSegments(entity).flat(),...core.sampleCurve(entity,128)];
  }
  return curvePoints(entity)||core.entityPoints(entity,document);
}

function drawingPage(source,document,options,width,height,pageIndex){
  const warnings=[],entities=visibleEntities(document),is3D=document.workspace==='3d',perspective=is3D&&document.camera3d.projection==='perspective';
  if(!entities.length)throw Error('The drawing has no visible objects to plot.');
  if(options.scaleMode==='scale'&&document.settings.units==='unitless')throw Error('Set drawing units before plotting at an exact ratio.');
  if(options.scaleMode==='scale'&&perspective)throw Error('Perspective views support Fit to paper only. Use an orthographic view for an exact ratio.');
  if(is3D)warnings.push('The current 3D view is plotted as vector wireframe; shaded surfaces and hidden-line removal are not plotted.');
  const camera={...document.camera3d,scale:1},project=p=>is3D?projectPoint(p,camera,1000,1000):{x:p.x,y:-p.y};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,nearClipped=0;
  const include=p=>{const q=project(p);if(q.clipped||![q.x,q.y].every(Number.isFinite)){nearClipped++;return;}minX=Math.min(minX,q.x);minY=Math.min(minY,q.y);maxX=Math.max(maxX,q.x);maxY=Math.max(maxY,q.y);};
  for(const entity of entities)for(const p of is3D?projectedBoundsPoints(entity,document,camera):core.entityPoints(entity,document))include(p);
  if(minX===Infinity)throw Error('No drawing geometry lies in front of the current view.');
  const availableW=width-2*options.margin,availableH=height-2*options.margin,spanX=maxX-minX,spanY=maxY-minY;
  if(![spanX,spanY].every(Number.isFinite))throw Error('Drawing extents exceed the supported plotting range.');
  const fit=Math.min(spanX?availableW/spanX:Infinity,spanY?availableH/spanY:Infinity);
  const scale=options.scaleMode==='scale'?units[document.settings.units]/options.ratio:fit*.98;
  if(!Number.isFinite(scale)||scale<=0)throw Error('A drawing with finite, nonzero extents is required to plot.');
  const center={x:midpoint(minX,maxX),y:midpoint(minY,maxY)},map=p=>{
    const q=project(p);if(q.clipped||![q.x,q.y].every(Number.isFinite))return null;
    return{x:width/2+(q.x-center.x)*scale,y:height/2+(q.y-center.y)*scale};
  };
  const clipped=nearClipped>0||spanX*scale>availableW+1e-8||spanY*scale>availableH+1e-8;
  if(clipped)warnings.push('Some geometry is clipped by the printable area or the perspective near plane.');
  const parts=[],path=(points,closed=false,fill='none',attrs='')=>{
    const mapped=points.map(map);if(mapped.some(p=>!p))return '';
    return `<path d="M${mapped.map(pointString).join(' L')}${closed?' Z':''}" fill="${fill}" ${attrs}/>`;
  };
  const segment=(a,b,attrs)=>path([a,b],false,'none',attrs);
  const label=text=>{
    if(!text.text)return '';
    const p=map(text.position);if(!p)return '';
    const radians=(text.rotation??0)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
    const px=map({x:text.position.x+c*text.height,y:text.position.y+s*text.height,z:text.position.z??0});
    const py=map({x:text.position.x-s*text.height,y:text.position.y+c*text.height,z:text.position.z??0});
    if(!px||!py)return '';
    const ax=(px.x-p.x),ay=(px.y-p.y),bx=-(py.x-p.x),by=-(py.y-p.y),length=text.width/text.height;
    // One local unit is one cap-height. The fixed host calibration corrects font ascent.
    return `<text transform="matrix(${[ax,ay,bx,by,p.x,p.y].map(numeric).join(' ')})" font-family="${escape(text.fontFamily)}" font-size="1.38888888889" data-cap-height="1" text-anchor="${text.align==='center'?'middle':'start'}"${length>0?` textLength="${numeric(length)}" lengthAdjust="spacingAndGlyphs"`:''} fill="currentColor" stroke="none">${escape(text.text)}</text>`;
  };
  for(const entity of entities){
    const layer=document.layers.find(l=>l.name===entity.layer),rgb=entity.color??layer?.color??'#000000';
    const color=options.colorMode==='monochrome'?'#000000':options.colorMode==='grayscale'?gray(rgb):rgb;
    const weight=options.lineweights?(entity.lineweight??layer?.lineweight??.25):.18;
    const attrs=`stroke="${color}" stroke-width="${numeric(Math.max(.01,weight))}" stroke-linecap="round" stroke-linejoin="round"`;
    let body='';
    if(['TEXT','MTEXT','DIMENSION'].includes(entity.type)){
      const g=core.annotationPrimitives(entity,document);
      if(entity.type==='DIMENSION')body=g.segments.map(([a,b])=>segment(a,b,attrs)).join('')+g.arrows.map(points=>path(points,true,color,'stroke="none"')).join('');
      body+=g.texts.map(label).join('');
    }else if(entity.type==='CIRCLE'&&!is3D){const p=map(entity.center);body=`<circle cx="${numeric(p.x)}" cy="${numeric(p.y)}" r="${numeric(entity.radius*scale)}" fill="none" ${attrs}/>`;
    }else if(entity.type==='ARC'&&!is3D){
      const a=map(core.arcPoint(entity,0)),b=map(core.arcPoint(entity,1)),r=numeric(entity.radius*scale);
      body=`<path d="M${pointString(a)} A${r},${r} 0 ${Math.abs(entity.sweepAngle)>180?1:0} ${entity.sweepAngle<0?1:0} ${pointString(b)}" fill="none" ${attrs}/>`;
    }else if(entity.type==='ELLIPSE'&&!is3D){
      const p=map(entity.center),major=Math.hypot(entity.major.x,entity.major.y)*scale,angle=-Math.atan2(entity.major.y,entity.major.x)*180/Math.PI;
      body=`<ellipse cx="${numeric(p.x)}" cy="${numeric(p.y)}" rx="${numeric(major)}" ry="${numeric(major*entity.ratio)}" transform="rotate(${numeric(angle)} ${numeric(p.x)} ${numeric(p.y)})" fill="none" ${attrs}/>`;
    }else if(entity.type==='SPLINE'&&!perspective){
      body=core.splineBezierSegments(entity).map(points=>{const mapped=points.map(map);if(mapped.some(p=>!p))return '';return`<path d="M${pointString(mapped[0])} C${mapped.slice(1).map(pointString).join(' ')}" fill="none" ${attrs}/>`;}).join('');
    }else if(entity.type==='HATCH'){
      const g=core.hatchGeometry(entity);body=g.fills.map(fill=>path(fill.points,fill.closed,color,'stroke="none"')).join('')+g.segments.map(([a,b])=>segment(a,b,attrs)).join('');
    }else{
      const curve=curvePoints(entity),edges=curve?curve.slice(1).map((p,i)=>[curve[i],p]):core.entityEdges(entity,document);
      if(!edges.length)throw Error(`Plotting ${entity.type} is not supported.`);
      body=edges.map(([a,b])=>segment(a,b,attrs)).join('');
    }
    parts.push(`<g color="${color}" data-entity="${escape(entity.id)}">${body}</g>`);
  }
  const clipId=`plot-area-${pageIndex}`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${numeric(width)}mm" height="${numeric(height)}mm" viewBox="0 0 ${numeric(width)} ${numeric(height)}" role="img" aria-label="${escape(source.title)}"><rect width="100%" height="100%" fill="white"/><defs><clipPath id="${clipId}"><rect x="${numeric(options.margin)}" y="${numeric(options.margin)}" width="${numeric(availableW)}" height="${numeric(availableH)}"/></clipPath></defs><g clip-path="url(#${clipId})">${parts.join('')}</g></svg>`;
  return{svg,plotScaleMmPerUnit:perspective?null:scale,worldBounds:core.bounds3D(entities,document),clipped,warnings};
}

function gray(color){const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16),v=Math.round(.2126*r+.7152*g+.0722*b).toString(16).padStart(2,'0');return`#${v}${v}${v}`;}

// Host executes this fixed code after loading our escaped HTML and fonts, without Node integration.
export const PLOT_FONT_CALIBRATION=`(async()=>{await document.fonts.ready;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');for(const text of document.querySelectorAll('text[data-cap-height]')){ctx.font='100px '+text.getAttribute('font-family');const ascent=ctx.measureText('H').actualBoundingBoxAscent;if(ascent>0&&Number.isFinite(ascent))text.setAttribute('font-size',String(100/ascent));}return true;})()`;

export function buildPlotHTML(sources,{options:rawOptions={},createEditor=core.createEditor}={}){
  const options=normalizePlotOptions(rawOptions);
  if(!Array.isArray(sources)||sources.length<1||sources.length>20)throw Error('Plot requires 1 through 20 drawing sheets.');
  if(sources.reduce((sum,s)=>sum+(typeof s?.text==='string'?BufferlessBytes(s.text):0),0)>100*1024*1024)throw Error('Batch plot input exceeds 100 MiB.');
  const [short,long]=PAPERS[options.paper],width=options.orientation==='landscape'?long:short,height=options.orientation==='landscape'?short:long;
  const sheets=sources.map((source,index)=>{
    if(!source||typeof source.title!=='string'||source.title.length>512||typeof source.text!=='string'||BufferlessBytes(source.text)>25*1024*1024)throw Error('Plot source title or document is invalid or too large.');
    const editor=createEditor(),accepted=editor.importJSON(source.text);if(!accepted.ok)throw Error(accepted.message);
    return drawingPage(source,JSON.parse(editor.serialize()),options,width,height,index);
  });
  const report={pages:sheets.length,paper:options.paper,orientation:options.orientation,scaleMode:options.scaleMode,ratio:options.ratio,plotScaleMmPerUnit:sheets[0].plotScaleMmPerUnit,worldBounds:sheets[0].worldBounds,clipped:sheets.some(s=>s.clipped),warnings:[...new Set(sheets.flatMap(s=>s.warnings))],sheets:sheets.map((s,i)=>({title:sources[i].title,plotScaleMmPerUnit:s.plotScaleMmPerUnit,worldBounds:s.worldBounds,clipped:s.clipped,warnings:s.warnings}))};
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>Linecraft PDF Plot</title><style>@page{size:${numeric(width)}mm ${numeric(height)}mm;margin:0}html,body{margin:0;padding:0;background:white}section{width:${numeric(width)}mm;height:${numeric(height)}mm;overflow:hidden;break-after:page}section:last-child{break-after:auto}svg{display:block}</style></head><body>${sheets.map(s=>`<section>${s.svg}</section>`).join('')}</body></html>`;
  if(BufferlessBytes(html)>50*1024*1024)throw Error('Plot vector document exceeds 50 MiB.');
  return{html,previewSVG:sheets[0].svg,report,pdfOptions:{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,pageSize:{width:width/25.4,height:height/25.4},margins:{top:0,bottom:0,left:0,right:0}}};
}

function BufferlessBytes(text){return new TextEncoder().encode(text).byteLength;}
