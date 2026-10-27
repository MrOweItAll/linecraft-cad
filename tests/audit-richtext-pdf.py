"""Independent rich-MTEXT binary metrics, persistence and actual PDF audit."""
import argparse,copy,hashlib,json,math,os,re,struct
from datetime import datetime,timezone
from pathlib import Path
import fitz
MM=25.4/72
POSITION_TOLERANCE_MM=.04
ADVANCE_TOLERANCE_MM=.02
PAGE_TOLERANCE_MM=.3
STROKE_TOLERANCE_MM=.005
SOURCE=r'HHHH\P{\fTimes New Roman|b1|i0;BBBB}\P{\fTimes New Roman|b0|i1;IIII}'
PLAIN='HHHH\nBBBB\nIIII'
SPECS=[('times.ttf',False,False,'HHHH',45),('timesbd.ttf',True,False,'BBBB',160/3),('timesi.ttf',False,True,'IIII',185/3)]
BORDER=[((10,200),(287,200)),((287,200),(287,10)),((287,10),(10,10)),((10,10),(10,200))]
DIVIDER=((180,200),(180,175));RULER=((20,150),(120,150))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def near(a,b,t):
 assert type(a) in (int,float) and math.isfinite(a) and abs(a-b)<=t,(a,b,t)
def mm_point(p):return tuple(float(v)*MM for v in p)
def facekey(s):return re.sub(r'[^a-z0-9]','',re.sub(r'^[A-Z]{6}\+','',s).lower())
def font_ref(name,bold,italic,sample,registry_name):
 p=Path(os.environ['SystemRoot'])/'Fonts'/name;b=p.read_bytes()
 u16=lambda o:struct.unpack_from('>H',b,o)[0]
 i16=lambda o:struct.unpack_from('>h',b,o)[0]
 u32=lambda o:struct.unpack_from('>I',b,o)[0]
 count=u16(4);assert 0<count<=256
 tables={}
 for i in range(count):
  at=12+16*i;tag=b[at:at+4].decode('ascii');off=u32(at+8);length=u32(at+12)
  assert tag not in tables and off+length<=len(b);tables[tag]=(off,length)
 head=tables['head'][0];units=u16(head+18);loca_format=i16(head+50)
 os2=tables['OS/2'][0];os2version=u16(os2);assert os2version>=2 and tables['OS/2'][1]>=90
 cap=i16(os2+88);hhea=tables['hhea'][0];hmtx=tables['hmtx'][0];nmetrics=u16(hhea+34)
 cmap=tables['cmap'][0];maps=[]
 for i in range(u16(cmap+2)):
  at=cmap+4+i*8;platform=u16(at);encoding=u16(at+2);off=cmap+u32(at+4);fmt=u16(off)
  if platform==0 or platform==3 and encoding in (1,10):
   if fmt in (4,12):maps.append((platform,encoding,fmt,off))
 assert maps
 def mapping(cp,row):
  platform,encoding,fmt,off=row
  if fmt==12:
   for j in range(u32(off+12)):
    at=off+16+12*j;first,last,gid=struct.unpack_from('>III',b,at)
    if first<=cp<=last:return gid+cp-first
   return 0
  segcount=u16(off+6)//2;ends=off+14;starts=ends+2*segcount+2;deltas=starts+2*segcount;ranges=deltas+2*segcount
  for j in range(segcount):
   first=u16(starts+2*j);last=u16(ends+2*j)
   if first<=cp<=last:
    delta=i16(deltas+2*j);ro=u16(ranges+2*j)
    if not ro:return (cp+delta)&65535
    gid=u16(ranges+2*j+ro+2*(cp-first));return (gid+delta)&65535 if gid else 0
  return 0
 glyphs={}
 for cp in (65,72,66,73):
  ids={mapping(cp,m) for m in maps};assert len(ids)==1 and next(iter(ids))>0,(name,cp,ids)
  gid=ids.pop();loca=tables['loca'][0];glyf=tables['glyf'][0]
  off=u32(loca+4*gid) if loca_format else 2*u16(loca+2*gid)
  nextoff=u32(loca+4*(gid+1)) if loca_format else 2*u16(loca+2*(gid+1))
  assert nextoff>off
  bounds=struct.unpack_from('>hhhh',b,glyf+off+2)
  glyphs[chr(cp)]={'unicode':cp,'glyphId':gid,'advanceUnits':u16(hmtx+4*min(gid,nmetrics-1)),'glyphBoundsUnits':list(bounds)}
 a_apex=glyphs['A']['glyphBoundsUnits'][3];assert 0<a_apex<=units
 nameoff,namelen=tables['name'];ncount=u16(nameoff+2);stroff=u16(nameoff+4);names=[]
 for i in range(ncount):
  at=nameoff+6+12*i;platform,enc,lang,nid,length,off=struct.unpack_from('>HHHHHH',b,at)
  if nid!=6:continue
  payload=b[nameoff+stroff+off:nameoff+stroff+off+length]
  if platform in (0,3):names.append(payload.decode('utf-16be'))
  elif platform==1:names.append(payload.decode('mac_roman'))
 assert names and len(set(names))==1
 code=ord(sample[0]);g=glyphs[sample[0]];advance=g['advanceUnits']/a_apex*5
 return {'fontFamily':'Times New Roman','bold':bold,'italic':italic,'file':str(p),'bytes':len(b),'sha256':sha(p),
  'unitsPerEm':units,'OS2CapHeight':cap,'mtextApexBasis':a_apex,'mtextBasisRatio':a_apex/units,'postscriptName':names[0],
  'sample':sample,'glyphs':glyphs,'expectedEmFontSizeMm':5*units/a_apex,'glyphAdvanceMm':advance,
  'expectedGlyphOriginsMm':[[20+i*advance,45+(0 if not bold and not italic else 25/3 if bold else 50/3)] for i in range(4)],
  'nominalFourGlyphAdvanceWidthMm':4*advance,'firstToFourthOriginMm':3*advance,
  'referenceMethod':'Direct stdlib SFNT table/cmap/hmtx/loca/glyf/OS2/name parsing plus producer availability/hash binding; no product parser'}
def line_segments(drawing):
    segments, first, previous = [], None, None
    for item in drawing['items']:
        if item[0] == 'l':
            a, b = mm_point(item[1]), mm_point(item[2])
            first = a if first is None else first
            previous = b
            segments.append((a, b))
        elif item[0] == 're':
            rect = item[1]
            vertices = [(rect.x0 * MM, rect.y0 * MM), (rect.x1 * MM, rect.y0 * MM),
                        (rect.x1 * MM, rect.y1 * MM), (rect.x0 * MM, rect.y1 * MM)]
            segments.extend(zip(vertices, vertices[1:] + vertices[:1]))
            first = previous = None
        else:
            raise AssertionError(('Unsupported stroke in literal fixture', item[0]))
    if drawing.get('closePath') and first is not None and previous is not None and math.dist(first, previous) > 1e-8:
        segments.append((previous, first))
    return [(a, b) for a, b in segments if math.dist(a, b) > 1e-8]



def references(producer):
 refs=[]
 for filename,bold,italic,sample,baseline in SPECS:
  ref=font_ref(filename,bold,italic,sample,'')
  for inventory in (producer['fontInventory'],producer['rendererFontState']['fonts']):
   rows=[r for r in inventory if r.get('fontFamily',r.get('family'))=='Times New Roman' and r.get('bold') is bold and r.get('italic') is italic]
   assert len(rows)==1;row=rows[0];assert row['available'] is True and row['sha256']==ref['sha256']
   if 'fontFamily' in row and 'family' in row:assert row['fontFamily']==row['family']
   if 'localFaceLoaded' in row:assert row['localFaceLoaded'] is True and row['metricError'] is None
  ref['baseline']=baseline;refs.append(ref)
 return refs

def native_document(d):
 assert d['settings']['units']=='mm' and d['entities']==[] and len(d['layouts'])==1
 s=d['layouts'][0];assert s['id']=='font-sheet' and s['name']=='SYNTHETIC RICH TEXT' and s['viewports']==[]
 assert [s['paper'][k] for k in ('widthMm','heightMm','orientation')]==[297,210,'landscape']
 assert len(s['entities'])==4;assert sorted(e['type'] for e in s['entities'])==['LINE','LINE','MTEXT','PLINE']
 e=next(e for e in s['entities'] if e['type']=='MTEXT');assert e['id']=='rich-paragraphs' and e['text']==PLAIN and e['position']=={'x':20,'y':170} and e['height']==5 and e['width']==150 and e['rotation']==0 and e['style']=='Measured Times'
 assert e['richText']=={'version':1,'source':SOURCE,'attachment':1,'lineSpacingStyle':2,'lineSpacingFactor':1}
 style=next(s for s in d['textStyles'] if s['name']==e['style']);assert style['fontFamily']=='Times New Roman' and style['metrics']=='registered' and style['widthFactor']==1

def extract(page,refs):
 chars=[];strokes=[];backgrounds=[]
 for t in page.get_texttrace():
  for c in t['chars']:chars.append({'unicode':c[0],'originMm':mm_point(c[2]),'face':t['font'],'sizeMm':t['size']*MM,'direction':t['dir'],'opacity':t['opacity'],'color':t['color'],'type':t['type'],'seqno':t['seqno']})
 for drawing in page.get_drawings():
  kind=drawing['type'];assert kind in ('s','f','fs')
  if kind in ('s','fs'):
   for a,b in line_segments(drawing):strokes.append({'a':a,'b':b,'widthMm':drawing['width']*MM,'opacity':drawing['stroke_opacity'],'color':drawing['color'],'seqno':drawing['seqno'],'dashes':drawing['dashes']})
  if kind in ('f','fs'):
   assert kind=='f' and drawing['fill'] and min(drawing['fill'])>.99 and len(drawing['items'])==1 and drawing['items'][0][0]=='re'
   backgrounds.append({'bounds':tuple(v*MM for v in drawing['rect']),'opacity':drawing['fill_opacity'],'seqno':drawing['seqno']})
 ink=[]
 for ref in refs:
  g=ref['glyphs'][ref['sample'][0]];scale=5/ref['mtextApexBasis'];x0,y0,x1,y1=g['glyphBoundsUnits']
  for i,(x,y) in enumerate(ref['expectedGlyphOriginsMm']):
   # Expected direct-SFNT bounds, not actual PDF text boxes; positive ink only.
   bounds=(x+x0*scale,y-y1*scale,x+x1*scale,y-y0*scale)
   pix=page.get_pixmap(matrix=fitz.Matrix(8,8),clip=fitz.Rect(*(v/MM for v in bounds)),alpha=False)
   data=pix.samples;dark=sum(max(data[j:j+3])<128 for j in range(0,len(data),pix.n));total=pix.width*pix.height
   assert total>0;ink.append({'sample':ref['sample'],'glyph':i,'expectedBoundsMm':bounds,'darkFraction':dark/total,'pixels':total})
 clear=[]
 for x,y in [(100,50),(100,60),(170,40)]:
  pix=page.get_pixmap(matrix=fitz.Matrix(8,8),clip=fitz.Rect((x-.5)/MM,(y-.5)/MM,(x+.5)/MM,(y+.5)/MM),alpha=False)
  clear.append({'pointMm':(x,y),'rgb':pix.pixel(round(x/MM*8)-pix.x,round(y/MM*8)-pix.y)[:3]})
 return {'size':(page.rect.width*MM,page.rect.height*MM),'media':tuple(v*MM for v in page.mediabox),'crop':tuple(v*MM for v in page.cropbox),'rotation':page.rotation,'images':len(page.get_image_info()),'text':page.get_text(),'chars':chars,'strokes':strokes,'backgrounds':backgrounds,'ink':ink,'clear':clear}

def opaque_black(r):
 assert type(r['opacity']) in (int,float) and r['opacity']==1
 assert r['color'] and all(type(v) in (int,float) and math.isfinite(v) and 0<=v<.01 for v in r['color'])
 assert type(r['seqno']) is int
def match_segment(strokes,segment):
 matches=[(i,r) for i,r in enumerate(strokes) if min(math.dist(r['a'],segment[0])+math.dist(r['b'],segment[1]),math.dist(r['a'],segment[1])+math.dist(r['b'],segment[0]))<=POSITION_TOLERANCE_MM]
 assert len(matches)==1,(segment,matches);return matches[0]
def validate_pages(pages,refs):
 assert len(pages)==1;p=pages[0];out=[]
 assert type(p['rotation']) is int and p['rotation']==0
 for field in ('media','crop'):
  for a,b in zip(p[field],(0,0,297,210)):near(a,b,PAGE_TOLERANCE_MM)
 for a,b in zip(p['size'],(297,210)):near(a,b,PAGE_TOLERANCE_MM)
 assert p['images']==0 and p['text'].splitlines()==['HHHH','BBBB','IIII']
 out.append({'role':'paper boxes','sizeMm':p['size'],'mediaMm':p['media'],'cropMm':p['crop'],'rotation':p['rotation']})
 assert len(p['strokes'])==6;used=set()
 for role,ends,width in [('border '+str(i),s,.25) for i,s in enumerate(BORDER)]+[('divider',DIVIDER,.25),('paper ruler',RULER,.35)]:
  i,r=match_segment(p['strokes'],ends);assert i not in used;used.add(i);opaque_black(r);assert re.fullmatch(r'\[\s*\]\s*[+-]?0(?:\.0*)?',r['dashes'].strip());near(r['widthMm'],width,STROKE_TOLERANCE_MM);near(math.dist(r['a'],r['b']),math.dist(*ends),ADVANCE_TOLERANCE_MM)
  out.append({'role':role,'expectedEndpointsMm':ends,'actualEndpointsMm':[r['a'],r['b']],'lengthMm':math.dist(r['a'],r['b']),'strokeWidthMm':r['widthMm']})
 assert len(p['chars'])==12;used=set();baselines=[]
 for ref in refs:
  rows=[(i,r) for i,r in enumerate(p['chars']) if abs(r['originMm'][1]-ref['baseline'])<=POSITION_TOLERANCE_MM];assert len(rows)==4
  rows.sort(key=lambda a:a[1]['originMm'][0]);points=[]
  for n,(i,r) in enumerate(rows):
   assert i not in used;used.add(i);assert r['unicode']==ord(ref['sample'][0]);assert facekey(r['face'])==facekey(ref['postscriptName']);assert r['type']==0;opaque_black(r)
   for a,b in zip(r['direction'],(1,0)):near(a,b,.0001)
   near(r['sizeMm'],ref['expectedEmFontSizeMm'],ADVANCE_TOLERANCE_MM)
   for a,b in zip(r['originMm'],ref['expectedGlyphOriginsMm'][n]):near(a,b,POSITION_TOLERANCE_MM)
   if n:near(r['originMm'][0]-rows[n-1][1]['originMm'][0],ref['glyphAdvanceMm'],ADVANCE_TOLERANCE_MM)
   points.append(r['originMm'])
  baselines.append(sum(p[1] for p in points)/4)
  out.append({'role':'rich paragraph glyphs','text':ref['sample'],'bold':ref['bold'],'italic':ref['italic'],'face':rows[0][1]['face'],'fontSHA256':ref['sha256'],'expectedEmSizeMm':ref['expectedEmFontSizeMm'],'actualEmSizeMm':rows[0][1]['sizeMm'],'expectedAdvanceMm':ref['glyphAdvanceMm'],'actualOriginsMm':points,'expectedOriginsMm':ref['expectedGlyphOriginsMm']})
 for a,b in zip(baselines,baselines[1:]):near(b-a,25/3,ADVANCE_TOLERANCE_MM)
 out.append({'role':'exact paragraph baseline spacing','actualBaselinesMm':baselines,'expectedAdvanceMm':25/3})
 foreground=[r['seqno'] for r in p['strokes']+p['chars']];assert p['backgrounds']
 for r in p['backgrounds']:
  assert type(r['opacity']) in (int,float) and r['opacity']==1 and r['seqno']<min(foreground)
  for a,b in zip(r['bounds'],(0,0,297,210)):near(a,b,PAGE_TOLERANCE_MM)
 assert len(p['ink'])==12 and len(p['clear'])==3
 for r in p['ink']:assert math.isfinite(r['darkFraction']) and .02<=r['darkFraction']<=1
 for r in p['clear']:assert len(r['rgb'])==3 and all(type(v) is int and 240<v<=255 for v in r['rgb'])
 out.append({'role':'actual declared glyph ink and clear-site samples','glyphSamples':p['ink'],'clearSites':p['clear'],'minimumDarkFraction':.02,'rasterDpi':576})
 return out

def negative_controls(pages,refs):
 result=[]
 def reject(name,p,r=refs):
  try:validate_pages(p,r)
  except AssertionError as e:result.append({'control':name,'rejected':True,'reason':str(e),'actualPDFBytesModified':False});return
  raise AssertionError(('Control accepted',name))
 reject('missing page',[]);reject('extra page',pages+pages)
 def change(name,fn):
  p=copy.deepcopy(pages);fn(p[0]);reject(name,p)
 change('bad MediaBox',lambda p:p.update(media=(0,0,210,297)))
 change('cropped or shifted page',lambda p:p.update(crop=(1,0,297,210)))
 change('unexpected page rotation',lambda p:p.update(rotation=90))
 change('raster surrogate',lambda p:p.update(images=1))
 change('missing glyph',lambda p:p['chars'].pop())
 def character(p,unicode):return next(r for r in p['chars'] if r['unicode']==unicode)
 change('regular face substituted for bold',lambda p:character(p,66).update(face='TimesNewRomanPSMT'))
 change('regular face substituted for italic',lambda p:character(p,73).update(face='TimesNewRomanPSMT'))
 change('wrong glyph content',lambda p:p['chars'][0].update(unicode=65))
 change('wrong glyph origin',lambda p:p['chars'][0].update(originMm=(21,45)))
 change('wrong glyph advance',lambda p:p['chars'][1].update(originMm=(29,45)))
 change('wrong font em size',lambda p:p['chars'][0].update(sizeMm=5))
 change('wrong paragraph baseline',lambda p:character(p,66).update(originMm=(20,55)))
 change('transparent glyph',lambda p:p['chars'][0].update(opacity=0))
 change('unknown glyph opacity',lambda p:p['chars'][0].update(opacity=None))
 change('invisible glyph',lambda p:p['chars'][0].update(type=3))
 change('nonblack glyph',lambda p:p['chars'][0].update(color=(1,1,1)))
 change('late white overpaint',lambda p:p['backgrounds'].append({'bounds':(0,0,297,210),'opacity':1,'seqno':999999}))
 change('missing paper ruler',lambda p:p['strokes'].pop())
 change('wrong ruler length',lambda p:match_segment(p['strokes'],RULER)[1].update(b=(70,150)))
 change('wrong physical stroke',lambda p:p['strokes'][0].update(widthMm=.8))
 change('blank or fully hidden glyph ink',lambda p:p['ink'][0].update(darkFraction=0))
 change('unexpected gap ink',lambda p:p['clear'][0].update(rgb=(0,0,0)))
 change('swapped semantic paragraphs',lambda p:p.update(text='BBBB\nHHHH\nIIII\n'))
 bad=copy.deepcopy(refs);bad[0]['expectedEmFontSizeMm']=5*bad[0]['unitsPerEm']/bad[0]['OS2CapHeight'];reject('OS2 cap substituted for MTEXT A apex',copy.deepcopy(pages),bad)
 assert len(result)==26;return result

def main():
 parser=argparse.ArgumentParser()
 for name in ('producer','receipt','render-directory'):parser.add_argument('--'+name,type=Path,required=True)
 parser.add_argument('--profile',choices=['richtext'],required=True);args=parser.parse_args();assert not args.receipt.exists() and not args.render_directory.exists()
 producer=json.loads(args.producer.read_text(encoding='utf-8-sig'));outputs=producer['outputs'];bindings={'producer':{'file':str(args.producer),'sha256':sha(args.producer)}}
 for name in ('input','native','pdf'):
  assert sha(outputs[name])==outputs[name+'SHA256'];bindings[name]={'file':outputs[name],'sha256':sha(outputs[name])}
 report={'format':'LinecraftIndependentRichtextPDF/1','status':'running','startedAt':datetime.now(timezone.utc).isoformat(),'profile':'richtext','bindings':bindings,'measurements':[],'negativeControls':[],'renders':[],'fontReferences':[],
  'scope':'Three single-run registered-Times paragraphs only: native source, face/metric/origin/spacing and declared positive glyph-ink checks. No general wrapping, exact inkheight or client/domain/native acceptance.',
  'tolerancesMm':{'position':.04,'advanceAndEmSize':.02,'page':.3,'stroke':.005}}
 try:
  assert producer['status']=='passed' and producer['fontProfile']=='richtext' and producer['sourceUnchanged'] is True and producer['inputUnchanged'] is True
  docs=[json.loads(Path(outputs[n]).read_text(encoding='utf-8-sig')) for n in ('input','native')];assert docs[0]==docs[1]
  for d in docs:native_document(d)
  refs=references(producer);report['fontReferences']=refs;pdf=fitz.open(outputs['pdf']);pages=[extract(p,refs) for p in pdf];report['measurements']=validate_pages(pages,refs);report['negativeControls']=negative_controls(pages,refs)
  args.render_directory.mkdir()
  for kind,scale,clip in [('full',2,None),('typography',5,fitz.Rect(15/MM,35/MM,55/MM,68/MM))]:
   file=args.render_directory/f'page-1-{kind}.png';pdf[0].get_pixmap(matrix=fitz.Matrix(scale,scale),clip=clip,alpha=False).save(file);report['renders'].append({'page':1,'kind':kind,'file':str(file),'sha256':sha(file)})
  for b in bindings.values():assert sha(b['file'])==b['sha256']
  for ref in refs:assert sha(ref['file'])==ref['sha256']
  report['status']='passed'
 except Exception as e:report['status']='failed';report['error']=repr(e);raise
 finally:
  report['completedAt']=datetime.now(timezone.utc).isoformat();report['auditor']={'file':str(Path(__file__)),'sha256':sha(__file__)}
  with args.receipt.open('x',encoding='utf8') as f:f.write(json.dumps(report,indent=2)+'\n')
  print(json.dumps({'status':report['status'],'measurements':len(report['measurements']),'negativeControls':len(report['negativeControls'])}))
if __name__=='__main__':main()
