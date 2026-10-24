/* Original bounded MTEXT control parser/layout. Native source is retained; this
 * covers explicit fonts, heights, widths, tracking, decorations and paragraphs.
 * Unsupported controls are reported, never removed from the retained source. */
import {canonicalFontFamily,measureFontText} from './font-metrics.mjs';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function scaleRichTextSource(source,factor){return source.replace(/\\H([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*;/g,(_,number)=>`\\H${Number(number)*factor};`);}
export function parseRichText(source,base={fontFamily:'Arial',height:1,widthFactor:1}){
  if(typeof source!=='string'||source.length>65536||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source))throw Error('Rich text source must be bounded printable text.');
  let style={fontFamily:canonicalFontFamily(base.fontFamily),height:base.height,widthFactor:base.widthFactor??1,tracking:1,bold:false,italic:false,underline:false,overline:false},paragraph={align:'left',lineSpacing:null,before:0,after:0,left:0,right:0,indent:0},runs=[],paragraphs=[],buffer='',warnings=new Set(),stack=[];
  const flush=()=>{if(buffer){runs.push({text:buffer,...style});buffer='';if(runs.length>8192)throw Error('Rich text exceeds 8192 runs.');}},end=()=>{flush();paragraphs.push({...paragraph,emptyStyle:{...style},runs});runs=[];if(paragraphs.length>4096)throw Error('Rich text exceeds 4096 paragraphs.');};
  for(let i=0;i<source.length;){const c=source[i++];
    if(c==='{'){flush();if(stack.length>=32)throw Error('Rich text nesting exceeds 32.');stack.push({...style});continue;}
    if(c==='}'){flush();if(!stack.length)throw Error('Unbalanced rich text group.');style=stack.pop();continue;}
    if(c==='\r')continue;if(c==='\n'){end();continue;}
    if(c!=='\\'){if(c==='%'&&source[i]==='%'&&/[dpc]/i.test(source[i+1]??'')){buffer+=({d:'°',p:'±',c:'Ø'})[source[i+1].toLowerCase()];i+=2;}else buffer+=c;continue;}
    const code=source[i++];if(code===undefined)throw Error('Incomplete rich text escape.');
    if('\\{}'.includes(code)){buffer+=code;continue;}if(code==='~'){buffer+='\u00a0';continue;}
    if(code==='P'){end();continue;}if('LlOo'.includes(code)){flush();style={...style,[code.toLowerCase()==='l'?'underline':'overline']:code===code.toUpperCase()};continue;}
    if(code==='U'&&source[i]==='+'){const digits=source.slice(i+1,i+5);if(!/^[0-9a-f]{4}$/i.test(digits))throw Error('Malformed rich text Unicode escape.');buffer+=String.fromCharCode(parseInt(digits,16));i+=5;continue;}
    const stop=source.indexOf(';',i);if(stop<0)throw Error(`Unterminated rich text control ${code}.`);const value=source.slice(i,stop);i=stop+1;flush();
    if(code==='f'||code==='F'){const[family,...flags]=value.split('|');style={...style,fontFamily:canonicalFontFamily(family)};for(const flag of flags){if(/^b[01]$/i.test(flag))style.bold=flag[1]==='1';else if(/^i[01]$/i.test(flag))style.italic=flag[1]==='1';else if(!/^[cp]\d+$/i.test(flag))warnings.add(`font-flag:${flag}`);}continue;}
    if(['H','W','T'].includes(code)){const relative=/x$/i.test(value),number=Number(relative?value.slice(0,-1):value);if(!finite(number)||number<=0||number>1e6)throw Error(`Invalid rich text ${code} value.`);const key=code==='H'?'height':code==='W'?'widthFactor':'tracking',next=relative?style[key]*number:number;if(!finite(next)||next<=0||code!=='H'&&next>100)throw Error('Rich text metric is out of bounds.');style={...style,[key]:next};continue;}
    if(code==='p'){for(const part of value.replace(/^x/,'').split(',')){if(!part)continue;if(/^q[clrdj]$/.test(part))paragraph.align=({c:'center',l:'left',r:'right',d:'distributed',j:'justify'})[part[1]];else if(/^s(?:m)?(?:\*|[-+\d.eE]+)$/.test(part)){if(part==='s*')paragraph.lineSpacing=null;else{const n=Number(part.replace(/^sm?/,''));if(!finite(n)||n<=0||n>100)throw Error('Invalid paragraph spacing.');paragraph.lineSpacing=n;}}else if(/^[ilrba][-+\d.eE]+$/.test(part)){const n=Number(part.slice(1));if(!finite(n)||Math.abs(n)>1e6)throw Error('Invalid paragraph offset.');paragraph[({i:'indent',l:'left',r:'right',b:'before',a:'after'})[part[0]]]=n;}else warnings.add(`paragraph:${part}`);}continue;}
    if(code==='A'){warnings.add(`vertical-align:${value}`);continue;}
    if(code==='C'||code==='c'){warnings.add('inline-color');continue;}
    if(code==='S'){buffer+=value.replace(/[\^#]/g,'/');warnings.add('stacked-fraction-layout');continue;}
    warnings.add(`control:${code}`);
  }
  if(stack.length)throw Error('Unbalanced rich text group.');end();return{paragraphs,text:paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n'),warnings:[...warnings]};
}
export function normalizeRichText(raw,entity,style){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Rich text metadata must be an object.');const allowed=['version','source','attachment','lineSpacingStyle','lineSpacingFactor'];for(const key of Reflect.ownKeys(raw)){const d=Object.getOwnPropertyDescriptor(raw,key);if(typeof key!=='string'||!allowed.includes(key)||!d?.enumerable||!('value'in d))throw Error('Unknown or unsafe rich text field.');}
  if(raw.version!==1||!Number.isInteger(raw.attachment)||raw.attachment<1||raw.attachment>9||![1,2].includes(raw.lineSpacingStyle)||!finite(raw.lineSpacingFactor)||raw.lineSpacingFactor<.25||raw.lineSpacingFactor>4)throw Error('Invalid rich text attachment or spacing metadata.');
  const parsed=parseRichText(raw.source,{...style,height:entity.height});if(parsed.text!==entity.text)throw Error('Rich text source and editable plain text do not agree.');return{version:1,source:raw.source,attachment:raw.attachment,lineSpacingStyle:raw.lineSpacingStyle,lineSpacingFactor:raw.lineSpacingFactor};
}
export function layoutRichText(entity,style,fallbackMeasure){
  const parsed=parseRichText(entity.richText.source,{...style,height:entity.height}),lines=[],warnings=new Set(parsed.warnings);let baseline=0,lastHeight=0,lineTop=0;
  const widthOf=(text,run)=>{const measured=measureFontText(text,run.height,run.fontFamily,{bold:run.bold,italic:run.italic,widthFactor:run.widthFactor,tracking:run.tracking,heightMode:'mtext'});if(!measured){warnings.add(`missing-font-metrics:${run.fontFamily}`);return{width:fallbackMeasure(text,run.height,run),metricStatus:'fallback',renderText:text};}if(measured.missingGlyphs)warnings.add(`missing-glyph:${run.fontFamily}`);return measured;};
  for(const paragraph of parsed.paragraphs){const wrapped=[];let current=[],used=0,afterWrap=false;const flush=(wrap=false)=>{if(wrap)while(current.length&&/^[ \t]+$/.test(current.at(-1).text))used-=current.pop().width;wrapped.push({runs:current,width:used});current=[];used=0;afterWrap=wrap;};
    const available=()=>entity.width-paragraph.left-paragraph.right-(wrapped.length?0:paragraph.indent);
    if(!(available()>0))throw Error('Paragraph indent leaves no usable text width.');
    for(const run of paragraph.runs)for(const token of run.text.match(/[^ \t]+|[ \t]+/gu)??[]){let m=widthOf(token,run);if(current.length&&used+m.width>available())flush(true);if(afterWrap&&!current.length&&/^[ \t]+$/.test(token))continue;if(m.width<=available()){current.push({...run,text:token,...m});used+=m.width;}else for(const ch of Array.from(token)){m=widthOf(ch,run);if(current.length&&used+m.width>available())flush(true);current.push({...run,text:ch,...m});used+=m.width;}}
    if(current.length||!wrapped.length)flush();
    for(let index=0;index<wrapped.length;index++){const line=wrapped[index],empty=!line.runs.length,h=empty?paragraph.emptyStyle.height:Math.max(...line.runs.map(r=>r.height)),factor=paragraph.lineSpacing??entity.richText.lineSpacingFactor;
      // Original synthetic native measurements establish outgoing line boxes:
      // inline Multiple uses run height; default AtLeast retains half the
      // nominal height as a minimum. Baselines follow each line's cap top.
      // Empty paragraphs retain the preceding cap clearance when shrinking.
      if(index===0)lineTop-=paragraph.before*entity.height;
      if(empty&&lastHeight>h)lineTop-=lastHeight-h;
      baseline=lineTop-h;
      const advance=paragraph.lineSpacing!==null?h*5/3*factor:entity.richText.lineSpacingStyle===2?entity.height*5/3*factor:Math.max(entity.height/2,h)*5/3*factor;
      lineTop-=advance;
      let x=paragraph.left+(index===0?paragraph.indent:0),available=entity.width-paragraph.left-paragraph.right;
      if(paragraph.align==='center')x+=(available-line.width)/2;else if(paragraph.align==='right')x+=available-line.width;
      const distributed=paragraph.align==='distributed',expanded=line.runs.flatMap(run=>distributed||run.tracking!==1?Array.from(run.text).map(text=>({...run,text,...widthOf(text,{...run,tracking:1})})): [run]);
      const gaps=distributed?Math.max(0,expanded.length-1):0,spaces=expanded.filter(r=>/^[ \t]+$/u.test(r.text)).length;
      const natural=expanded.reduce((sum,run,i)=>sum+run.width*(i===expanded.length-1?1:run.tracking),0),distribute=gaps?Math.max(0,available-natural)/gaps:paragraph.align==='justify'&&index<wrapped.length-1&&spaces?Math.max(0,available-line.width)/spaces:0;
      const placed=expanded.map((run,i)=>{const result={...run,x,y:baseline};x+=run.width*(i===expanded.length-1?1:run.tracking)+(distributed&&i<expanded.length-1||!distributed&&/^[ \t]+$/u.test(run.text)?distribute:0);return result;});lines.push({runs:placed,height:h,baseline,width:distributed?available:line.width});lastHeight=h;
    }lineTop-=paragraph.after*entity.height;
  }
  const bottom=Math.min(0,...lines.map(l=>l.baseline-l.height*.35)),top=0,totalHeight=-bottom,attachment=entity.richText.attachment,dx=(attachment-1)%3===1?-entity.width/2:(attachment-1)%3===2?-entity.width:0,dy=Math.floor((attachment-1)/3)*totalHeight/2;
  const angle=(entity.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),world=(x,y)=>({x:entity.position.x+(x+dx)*c-(y+dy)*s,y:entity.position.y+(x+dx)*s+(y+dy)*c});
  const records=lines.flatMap(line=>line.runs.map(run=>({text:run.text,renderText:run.renderText,position:world(run.x,run.y),width:run.width,height:run.height,rotation:entity.rotation??0,fontFamily:run.fontFamily,widthFactor:run.widthFactor,tracking:run.tracking,fontWeight:run.bold?'bold':'normal',fontStyle:run.italic?'italic':'normal',underline:run.underline,overline:run.overline,metricStatus:run.metricStatus,fontSHA256:run.fontSHA256??null,...(run.capHeight?{fontCapRatio:run.capHeight/run.unitsPerEm}:{}),align:'left'}))),segments=[];
  for(const line of lines)for(const run of line.runs){if(run.underline)segments.push([world(run.x,run.y-(run.underlineOffset??run.height*.15)),world(run.x+run.width,run.y-(run.underlineOffset??run.height*.15))]);if(run.overline)segments.push([world(run.x,run.y+run.height*1.08),world(run.x+run.width,run.y+run.height*1.08)]);}
  return{lines:records,corners:[[0,bottom],[entity.width,bottom],[entity.width,top],[0,top]].map(([x,y])=>world(x,y)),width:entity.width,height:totalHeight,origin:{...entity.position},rotation:entity.rotation??0,fontFamily:style.fontFamily,widthFactor:style.widthFactor,segments,warnings:[...warnings],richText:true};
}
