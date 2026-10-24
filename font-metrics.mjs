/* Original, bounded OpenType metric reader. No glyph outlines or font assets are
 * copied into drawings. The fixed desktop font service supplies these metrics.
 * Format references: Microsoft OpenType head/hhea/hmtx/cmap/OS2/kern tables. */
export const FONT_FAMILIES=Object.freeze(['Arial','Segoe UI','Consolas','ARCHITXT','Times New Roman','Technic']);
export function canonicalFontFamily(value){
  if(typeof value!=='string')throw Error('Font family must be a string.');
  const clean=value.trim().replace(/\.(ttf|otf)$/i,'').replace(/[_-]/g,' '),key=clean.toLowerCase().replace(/\s/g,'');
  const family=FONT_FAMILIES.find(item=>item.toLowerCase().replace(/\s/g,'')===key);
  if(!family)throw Error(`Unsupported font family: ${value}.`);return family;
}
export function parseTrueTypeMetrics(input){
  const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
  if(!bytes||bytes.byteLength<12||bytes.byteLength>16*1024*1024)throw Error('Font must be a bounded OpenType byte buffer.');
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),check=(p,n)=>{if(!Number.isInteger(p)||p<0||n<0||p+n>d.byteLength)throw Error('Font table lies outside its buffer.');};
  const u16=p=>(check(p,2),d.getUint16(p)),i16=p=>(check(p,2),d.getInt16(p)),u32=p=>(check(p,4),d.getUint32(p)),tag=p=>(check(p,4),String.fromCharCode(...bytes.subarray(p,p+4)));
  if(![0x00010000,0x74727565,0x4f54544f].includes(u32(0)))throw Error('Unsupported font container; use a single registered TTF/OTF face.');
  const count=u16(4);if(count<1||count>256)throw Error('Font table count exceeds its limit.');check(12,count*16);const tables=new Map();
  for(let i=0;i<count;i++){const p=12+i*16,name=tag(p),offset=u32(p+8),length=u32(p+12);check(offset,length);if(tables.has(name))throw Error('Duplicate font table.');tables.set(name,{offset,length});}
  const table=(name,min)=>{const t=tables.get(name);if(!t||t.length<min)throw Error(`Missing or truncated font ${name} table.`);return t.offset;};
  const head=table('head',54),hhea=table('hhea',36),maxp=table('maxp',6),unitsPerEm=u16(head+18),numGlyphs=u16(maxp+4),n=u16(hhea+34),hmtx=table('hmtx',n*4+(numGlyphs-n)*2);
  if(unitsPerEm<16||unitsPerEm>16384||!numGlyphs||!n||n>numGlyphs)throw Error('Invalid font glyph metrics.');
  const advances=Array.from({length:numGlyphs},(_,i)=>u16(hmtx+Math.min(i,n-1)*4)),cmap=table('cmap',4),maps=u16(cmap+2);if(maps>128)throw Error('Font cmap count exceeds its limit.');check(cmap+4,maps*8);
  const candidates=[];for(let i=0;i<maps;i++){const p=cmap+4+i*8,platform=u16(p),encoding=u16(p+2),start=cmap+u32(p+4),format=u16(start);if([4,12].includes(format)&&(platform===0||platform===3&&[0,1,10].includes(encoding)))candidates.push({start,format,symbol:platform===3&&encoding===0,rank:(format===12?20:10)+(platform===0?3:encoding===10?2:encoding===1?1:0)});}
  candidates.sort((a,b)=>b.rank-a.rank);const selected=candidates[0];if(!selected)throw Error('Font has no supported Unicode/symbol cmap.');const cmapEnd=cmap+tables.get('cmap').length;let iterations=0;const mapping=new Map(),put=(cp,g)=>{if(++iterations>200000)throw Error('Font character decoding exceeds its work budget.');if(g&&g<numGlyphs){if(mapping.size>=100000&&!mapping.has(cp))throw Error('Font character map exceeds 100000 entries.');mapping.set(cp,g);}};
  const p=selected.start;if(p<cmap||p+4>cmapEnd)throw Error('Font cmap lies outside its table.');if(selected.format===12){const length=u32(p+4),groups=u32(p+12);check(p,length);if(p+length>cmapEnd||length<16||groups>100000||16+groups*12>length)throw Error('Invalid font cmap groups.');for(let i=0;i<groups;i++){const q=p+16+i*12,a=u32(q),b=u32(q+4),g=u32(q+8);if(a>b||b>0x10ffff||b-a>100000)throw Error('Invalid font cmap range.');for(let cp=a;cp<=b;cp++)put(cp,g+cp-a);}}
  else{const length=u16(p+2),segments=u16(p+6)/2;check(p,length);if(p+length>cmapEnd||!Number.isInteger(segments)||segments<1||16+segments*8>length)throw Error('Invalid font cmap segments.');const ends=p+14,starts=ends+segments*2+2,deltas=starts+segments*2,ranges=deltas+segments*2;for(let i=0;i<segments;i++){const a=u16(starts+2*i),b=u16(ends+2*i),delta=i16(deltas+2*i),range=u16(ranges+2*i);if(a>b)throw Error('Invalid font cmap interval.');for(let cp=a;cp<=b&&cp!==65535;cp++){let g;if(range){const q=ranges+2*i+range+2*(cp-a);if(q+2>p+length)throw Error('Font glyph map exceeds its table.');g=u16(q);if(g)g=(g+delta)&65535;}else g=(cp+delta)&65535;put(cp,g);}}}
  // Some registered legacy symbol faces expose the same private-use mapping in
  // a higher-priority Unicode table. Retain the verified Windows-symbol origin.
  const symbol=selected.symbol||(!mapping.has(72)&&mapping.has(0xf048)&&candidates.some(item=>item.symbol&&item.start===selected.start));
  let capHeight=0;const os2=tables.get('OS/2');if(os2&&os2.length>=90&&u16(os2.offset)>=2)capHeight=i16(os2.offset+88);
  const hGlyph=mapping.get(72)??(symbol?mapping.get(0xf048):undefined),loca=tables.get('loca'),glyf=tables.get('glyf');
  if(!(capHeight>0)&&hGlyph!==undefined&&loca&&glyf){const long=i16(head+50)===1,q=loca.offset+hGlyph*(long?4:2);if(q+(long?4:2)>loca.offset+loca.length)throw Error('Glyph location exceeds its table.');const off=long?u32(q):u16(q)*2;if(off+10>glyf.length)throw Error('Cap glyph exceeds its table.');capHeight=i16(glyf.offset+off+8)-i16(glyf.offset+off+4);}
  if(!(capHeight>0))capHeight=unitsPerEm*.7;
  // Native measured MTEXT character height is baseline-to-uppercase-A apex.
  // This differs from OS/2 sCapHeight and H's full ink bounds for these faces.
  let mtextCapHeight=capHeight;const aGlyph=mapping.get(65)??(symbol?mapping.get(0xf041):undefined);
  if(aGlyph!==undefined&&loca&&glyf){const long=i16(head+50)===1,q=loca.offset+aGlyph*(long?4:2);if(q+(long?4:2)>loca.offset+loca.length)throw Error('A glyph location exceeds its table.');const off=long?u32(q):u16(q)*2;if(off+10>glyf.length)throw Error('A cap glyph exceeds its table.');const apex=i16(glyf.offset+off+8);if(apex>0)mtextCapHeight=apex;}
  const kerning=[],kern=tables.get('kern');if(kern&&kern.length>=4&&u16(kern.offset)===0){const subtables=u16(kern.offset+2);if(subtables>256)throw Error('Font kerning subtable count exceeds its budget.');let q=kern.offset+4;for(let i=0;i<subtables;i++){if(q+6>kern.offset+kern.length)throw Error('Font kerning header exceeds its table.');const length=u16(q+2),coverage=u16(q+4);if(length<6||q+length>kern.offset+kern.length)throw Error('Invalid font kerning table.');if((coverage>>8)===0&&(coverage&1)&&!(coverage&6)){if(length<14)throw Error('Truncated font kerning record.');const pairs=u16(q+6);if(kerning.length+pairs>200000||14+pairs*6>length)throw Error('Font kerning exceeds its limit.');for(let j=0;j<pairs;j++){const k=q+14+j*6;kerning.push([u16(k),u16(k+2),i16(k+4)]);}}q+=length;}}
  return {version:1,unitsPerEm,capHeight,mtextCapHeight,ascent:i16(hhea+4),descent:i16(hhea+6),lineGap:i16(hhea+8),cmap:[...mapping].sort((a,b)=>a[0]-b[0]),advances,kerning,symbol};
}
const registered=new Map();
export function registerFontMetrics(family,profile,{bold=false,italic=false,sha256=null}={}){
  family=canonicalFontFamily(family);if(!profile||profile.version!==1||!Number.isFinite(profile.unitsPerEm)||profile.unitsPerEm<16||profile.unitsPerEm>16384||!Number.isFinite(profile.capHeight)||!(profile.capHeight>0)||profile.capHeight>65535||!['ascent','descent','lineGap'].every(k=>Number.isFinite(profile[k])&&Math.abs(profile[k])<=65535)||typeof profile.symbol!=='boolean'||!Array.isArray(profile.advances)||!profile.advances.length||profile.advances.length>65535||!Array.isArray(profile.cmap)||profile.cmap.length>100000||!Array.isArray(profile.kerning)||profile.kerning.length>200000)throw Error('Malformed font metric profile.');
  if(profile.advances.some(x=>!Number.isFinite(x)||x<0||x>65535)||profile.cmap.some(pair=>!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||pair[0]<0||pair[0]>0x10ffff||!Number.isInteger(pair[1])||pair[1]<0||pair[1]>=profile.advances.length)||profile.kerning.some(pair=>!Array.isArray(pair)||pair.length!==3||!pair.every(Number.isFinite)))throw Error('Invalid font metric entries.');
  if(profile.mtextCapHeight!==undefined&&(!Number.isFinite(profile.mtextCapHeight)||profile.mtextCapHeight<=0||profile.mtextCapHeight>65535))throw Error('Invalid MTEXT metric height basis.');
  if(sha256!==null&&!/^[a-f0-9]{64}$/i.test(sha256))throw Error('Invalid font metric fingerprint.');
  const saved=structuredClone(profile);registered.set(`${family}|${!!bold}|${!!italic}`,{...saved,fontFamily:family,sha256,map:new Map(saved.cmap),pairs:new Map(saved.kerning.map(([a,b,x])=>[`${a},${b}`,x]))});return true;
}
export function clearFontMetrics(){registered.clear();}
export function registeredFontMetrics(family,{bold=false,italic=false}={}){return registered.get(`${canonicalFontFamily(family)}|${!!bold}|${!!italic}`)??null;}
export function measureFontText(text,height,family,{bold=false,italic=false,widthFactor=1,tracking=1,kerning=false,heightMode='cap'}={}){
  const p=registeredFontMetrics(family,{bold,italic});if(!p)return null;let width=0,previous=null,missing=0,renderText='',lastAdvance=0;
  for(const character of Array.from(text)){let cp=character.codePointAt(0),glyph=p.map.get(cp);if(glyph===undefined&&p.symbol&&cp<=255&&p.map.has(cp+0xf000)){cp+=0xf000;glyph=p.map.get(cp);}if(glyph===undefined){glyph=0;missing++;}if(kerning&&previous!==null)width+=p.pairs.get(`${previous},${glyph}`)??0;lastAdvance=p.advances[glyph];width+=lastAdvance*tracking;previous=glyph;renderText+=String.fromCodePoint(cp);}
  // Tracking changes the distance between glyph origins, not the final glyph's
  // own width. Consumers can place glyphs separately without distorting ink.
  if(previous!==null)width-=lastAdvance*(tracking-1);
  const basis=heightMode==='mtext'?(p.mtextCapHeight??p.capHeight):p.capHeight;
  return {width:width/basis*height*widthFactor,renderText:text,...(p.symbol?{symbolRenderText:renderText}:{}),missingGlyphs:missing,fontSHA256:p.sha256,capHeight:basis,unitsPerEm:p.unitsPerEm,underlineOffset:Math.max(0,-p.descent)/basis*height,metricStatus:'registered'};
}
