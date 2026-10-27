"""Independent rotated annotation geometry/paint/semantics; no product imports."""
import argparse, copy, hashlib, json, math, re
from datetime import datetime, timezone
from pathlib import Path
import fitz
MM=25.4/72
LENGTH_TOLERANCE=.02
ENDPOINT_TOLERANCE=.04
STROKE_TOLERANCE=.005
PAGE_TOLERANCE=.3
AREA_TOLERANCE=.02
DIRECTION_TOLERANCE=.0001
DIMENSION='''ALIGNED 8'-4"'''
LEADER='SYNTHETIC LEADER'
SHEETS=[{'id':'sheet-a','marker':'ROTATED-48-FIRST','d':48},
        {'id':'sheet-b','marker':'ROTATED-96-SECOND','d':96}]
# Independently frozen 60-80-100 and 45-degree model reference.
MODEL_SEGMENTS=[('ruler',((0,60),(240,60))),
 ('left extension',((39.2,120.6),(7,144.75))),('right extension',((99.2,200.6),(67,224.75))),
 ('aligned dimension',((8,144),(68,224))),('leader diagonal',((160,130),(180,150))),
 ('leader landing',((180,150),(215,150)))]
ARROWS=[('left arrow',[(8,144),(8.8,146.525),(10.2,145.475)],(8.8,146.15)),
 ('right arrow',[(68,224),(65.8,222.525),(67.2,221.475)],(66.16,222.63)),
 ('leader arrow',[(160,130),(161.14904851942814,132.3864853865046),(162.3864853865046,131.14904851942814)],(161.09601551083914,132.01525432638166))]
ARROW_EXTERIORS=[(8.2,146.6),(65.56,223.08),(160.56568542494924,132.54558441227156)]
PAPER_SEGMENTS=[('paper sentinel',((20,237),(120,237)),.35),
 ('border lower',((10,287),(410,287)),.25),('border right',((410,287),(410,257)),.25),
 ('border upper',((410,257),(10,257)),.25),('border left',((10,257),(10,287)),.25),
 ('divider one',((300,287),(300,257)),.25),('divider two',((360,287),(360,257)),.25)]
def projected(p,d):return (210+(p[0]-120)*25.4/d,137-(p[1]-150)*25.4/d)
def area(points):return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(points,points[1:]+points[:1])))/2
def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def near(actual, expected, tolerance):
    assert isinstance(actual, (int, float)) and not isinstance(actual, bool)
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected, tolerance)


def point(raw):
    return tuple(float(value) * MM for value in raw)


def opaque(value, label):
    assert isinstance(value, (int, float)) and not isinstance(value, bool)
    assert math.isfinite(value) and value == 1, (label, value)


def black(color, label):
    assert isinstance(color, (list, tuple)) and color, (label, color)
    assert all(isinstance(value, (int, float)) and math.isfinite(value)
               and 0 <= value < .01 for value in color), (label, color)


def line_segments(drawing):
    segments = []
    first = previous = None
    for item in drawing['items']:
        kind = item[0]
        if kind == 'l':
            a, b = point(item[1]), point(item[2])
            if first is None:
                first = a
            segments.append((a, b))
            previous = b
        elif kind == 're':
            r = item[1]
            vertices = [(r.x0 * MM, r.y0 * MM), (r.x1 * MM, r.y0 * MM),
                        (r.x1 * MM, r.y1 * MM), (r.x0 * MM, r.y1 * MM)]
            segments.extend(zip(vertices, vertices[1:] + vertices[:1]))
            first = previous = None
        elif kind == 'qu':
            q = item[1]
            vertices = [point(q.ul), point(q.ur), point(q.lr), point(q.ll)]
            segments.extend(zip(vertices, vertices[1:] + vertices[:1]))
            first = previous = None
        else:
            raise AssertionError(('Unexpected stroke operator', kind))
    if drawing.get('closePath') and first is not None and previous is not None and math.dist(first, previous) > 1e-8:
        segments.append((previous, first))
    return [(a, b) for a, b in segments if math.dist(a, b) > 1e-8]


def match_segment(strokes, expected):
    a, b = expected
    found = [(index, row) for index, row in enumerate(strokes)
             if min(math.dist(row['a'], a) + math.dist(row['b'], b),
                    math.dist(row['a'], b) + math.dist(row['b'], a)) < ENDPOINT_TOLERANCE]
    assert len(found) == 1, ('Missing, duplicate or shifted segment', expected, len(found))
    return found[0]




def raster_samples(page):
 d=SHEETS[page.number]['d'];samples=[]
 for role,ends in MODEL_SEGMENTS:
  a,b=ends;samples.append((role+' midpoint',((a[0]+b[0])/2,(a[1]+b[1])/2),True))
 for role,vertices,interior in ARROWS:samples.append((role+' off-stroke interior',interior,True))
 for i,p in enumerate([(120,100),(180,210)]+ARROW_EXTERIORS):samples.append((f'clear {i}',p,False))
 result=[]
 for role,model,ink in samples:
  x,y=projected(model,d)
  # Small 2mm patches at 1728dpi resolve the 1:96 arrow margin without huge pages.
  pix=page.get_pixmap(matrix=fitz.Matrix(24,24),clip=fitz.Rect((x-1)/MM,(y-1)/MM,(x+1)/MM,(y+1)/MM),alpha=False)
  rgb=pix.pixel(round(x/MM*24)-pix.x,round(y/MM*24)-pix.y)[:3]
  result.append({'role':role,'modelPoint':model,'pointMm':(x,y),'expectedInk':ink,'rgb':rgb})
 return result

def extract(page):
 strokes,fills,backgrounds=[],[],[]
 for drawing in page.get_drawings():
  kind=drawing['type'];assert kind in ('s','f','fs');seq=drawing['seqno'];assert type(seq) is int
  segments=line_segments(drawing)
  if kind in ('s','fs'):
   for a,b in segments:strokes.append({'a':a,'b':b,'widthMm':drawing['width']*MM,'opacity':drawing['stroke_opacity'],'color':drawing['color'],'dashes':drawing['dashes'],'seqno':seq})
  if kind in ('f','fs'):
   color=drawing['fill'];assert color;bounds=tuple(v*MM for v in drawing['rect'])
   if min(color)>.99:
    assert kind=='f' and len(drawing['items'])==1 and drawing['items'][0][0]=='re'
    backgrounds.append({'bounds':bounds,'opacity':drawing['fill_opacity'],'seqno':seq})
   else:
    assert kind=='f';vertices=[a for a,b in segments];assert len(vertices)==3
    fills.append({'points':vertices,'area':area(vertices),'opacity':drawing['fill_opacity'],'color':color,'seqno':seq})
 traces=[{'text':''.join(chr(c[0]) for c in t['chars']),'opacity':t['opacity'],'color':t['color'],'type':t['type'],'seqno':t['seqno'],'font':t['font'],'direction':t['dir']} for t in page.get_texttrace()]
 texts=[DIMENSION,LEADER]+[s['marker'] for s in SHEETS]
 return {'size':(page.rect.width*MM,page.rect.height*MM),'media':tuple(v*MM for v in page.mediabox),'crop':tuple(v*MM for v in page.cropbox),
  'rotation':page.rotation,'images':len(page.get_image_info()),'text':page.get_text(),'boxes':{t:[tuple(v*MM for v in b) for b in page.search_for(t)] for t in texts},
  'strokes':strokes,'fills':fills,'backgrounds':backgrounds,'traces':traces,'raster':raster_samples(page)}

def native_document(doc):
 assert doc['settings']['units']=='in' and doc['settings']['linearFormat']=='architectural'
 assert [s['id'] for s in doc['layouts']]==['sheet-b','sheet-a'];assert doc['blocks']==[]
 assert [e['id'] for e in doc['entities']]==['rotation-ruler','aligned-calibration','leader-calibration']
 r,d,l=doc['entities'];assert r['type']=='LINE' and r['start']=={'x':0,'y':60} and r['end']=={'x':240,'y':60}
 assert d['type']=='DIMENSION' and d['kind']=='aligned' and d['p1']=={'x':40,'y':120} and d['p2']=={'x':100,'y':200} and d['placement']=={'x':38,'y':184} and d['textOverride']=='ALIGNED <>' and d['scale']==1 and d['style']=='Standard'
 assert l['type']=='LEADER' and l['points']==[{'x':160,'y':130},{'x':180,'y':150},{'x':215,'y':150}] and l['text']==LEADER and l['height']==6 and l['arrowSize']==2.5 and l['arrowType']=='closed-filled' and l['style']=='Standard'
 ts=next(s for s in doc['textStyles'] if s['name']=='Standard');assert ts['fontFamily']=='Arial' and ts['widthFactor']==1
 ds=next(s for s in doc['dimStyles'] if s['name']=='Standard')
 for k,v in {'textStyle':'Standard','textHeight':2.5,'arrowSize':2.5,'gap':1,'extensionOffset':1,'extensionOvershoot':1.25,'scale':1}.items():assert ds[k]==v
 layer=next(l for l in doc['layers'] if l['name']=='0');assert layer['lineweight']==.25 and layer['color']=='#e5e7eb'
 for sheet in SHEETS:
  layout=next(l for l in doc['layouts'] if l['id']==sheet['id']);assert [layout['paper'][k] for k in ('widthMm','heightMm','orientation')]==[420,297,'landscape']
  assert len(layout['viewports'])==1 and len(layout['entities'])==5
  v=layout['viewports'][0];assert v['frame']=={'x':40,'y':60,'width':340,'height':200} and v['modelCenter']=={'x':120,'y':150,'z':0} and v['scaleDenominator']==sheet['d'] and v['locked'] is True and v['plotBorder'] is False and v['frozenLayers']==[]
  marker=next(e for e in layout['entities'] if e['type']=='TEXT');assert marker['text']==sheet['marker'] and marker['position']=={'x':310,'y':15} and marker['height']==4

def validate_pages(pages):
 assert len(pages)==2;measurements=[]
 for number,(page,sheet) in enumerate(zip(pages,SHEETS),1):
  d=sheet['d'];assert type(page['rotation']) is int and page['rotation']==0
  for key in ('media','crop'):
   for a,b in zip(page[key],(0,0,420,297)):near(a,b,PAGE_TOLERANCE)
  for a,b in zip(page['size'],(420,297)):near(a,b,PAGE_TOLERANCE)
  assert page['images']==0
  measurements.append({'page':number,'role':'paper boxes','sizeMm':page['size'],'mediaMm':page['media'],'cropMm':page['crop'],'rotation':page['rotation']})
  assert len(page['strokes'])==13
  segments=[(name,tuple(projected(p,d) for p in ends),.25) for name,ends in MODEL_SEGMENTS]+PAPER_SEGMENTS;used=set()
  for role,ends,width in segments:
   i,row=match_segment(page['strokes'],ends);assert i not in used;used.add(i);opaque(row['opacity'],'stroke');black(row['color'],'stroke')
   near(row['widthMm'],width,STROKE_TOLERANCE);near(math.dist(row['a'],row['b']),math.dist(*ends),LENGTH_TOLERANCE)
   assert re.fullmatch(r'\[\s*\]\s*[+-]?0(?:\.0*)?',row['dashes'].strip())
   measurements.append({'page':number,'role':role,'expectedEndpointsMm':ends,'actualEndpointsMm':[row['a'],row['b']],'lengthMm':math.dist(row['a'],row['b']),'strokeWidthMm':row['widthMm']})
  assert len(page['fills'])==3;used=set()
  for role,points,_ in ARROWS:
   literal=[projected(p,d) for p in points];matches=[(i,f) for i,f in enumerate(page['fills']) if all(min(math.dist(a,b) for b in f['points'])<ENDPOINT_TOLERANCE/2 for a in literal)]
   assert len(matches)==1,(role,matches);i,fill=matches[0];assert i not in used;used.add(i);opaque(fill['opacity'],'arrow');black(fill['color'],'arrow');near(fill['area'],2.1875*(25.4/d)**2,AREA_TOLERANCE)
   measurements.append({'page':number,'role':role,'expectedVerticesMm':literal,'actualVerticesMm':fill['points'],'areaMm2':fill['area']})
  other=next(s['marker'] for s in SHEETS if s!=sheet);assert other not in page['text']
  cells={DIMENSION:(140,90,220,150),LEADER:(225,120,320,145),sheet['marker']:(300,257,410,287)}
  assert sorted(page['text'].splitlines())==sorted(cells)
  for text,cell in cells.items():
   assert page['text'].count(text)==1;boxes=page['boxes'][text];assert len(boxes)==1;box=boxes[0]
   assert all(math.isfinite(v) for v in box) and cell[0]<=box[0]<box[2]<=cell[2] and cell[1]<=box[1]<box[3]<=cell[3],(text,box,cell)
   traces=[t for t in page['traces'] if t['text']==text];assert len(traces)==1,(text,page['traces'])
   trace=traces[0];direction=(.6,-.8) if text==DIMENSION else (1,0)
   for a,b in zip(trace['direction'],direction):near(a,b,DIRECTION_TOLERANCE)
   measurements.append({'page':number,'role':'semantic text and baseline','text':text,'boundsMm':box,'declaredCellMm':cell,'expectedDirection':direction,'actualDirection':trace['direction']})
  assert len(page['traces'])==3
  for t in page['traces']:
   assert t['type']==0;opaque(t['opacity'],'text');black(t['color'],'text');assert t['font'] in ('ArialMT','Arial') and type(t['seqno']) is int
  foreground=[r['seqno'] for r in page['strokes']+page['fills']+page['traces']];assert page['backgrounds']
  for bg in page['backgrounds']:
   opaque(bg['opacity'],'background');assert bg['seqno']<min(foreground)
   assert any(all(abs(a-b)<=PAGE_TOLERANCE for a,b in zip(bg['bounds'],bounds)) for bounds in [(0,0,420,297),(40,37,380,237)])
  assert len(page['raster'])==14
  for sample in page['raster']:
   rgb=sample['rgb'];assert len(rgb)==3 and all(type(v) is int and 0<=v<=255 for v in rgb)
   assert max(rgb)<128 if sample['expectedInk'] else min(rgb)>240,('Actual ink/clear sample mismatch',sample)
  measurements.append({'page':number,'role':'actual off-stroke arrow and geometry raster samples','samples':page['raster']})
 return measurements

def negative_controls(pages):
 controls=[]
 def reject(name,data):
  try:validate_pages(data)
  except AssertionError as e:controls.append({'control':name,'rejected':True,'reason':str(e),'actualPDFBytesModified':False});return
  raise AssertionError(('Control incorrectly accepted',name))
 reject('missing page',pages[:1]);reject('extra page',pages+[pages[0]]);reject('swapped sheets',pages[::-1]);reject('duplicate sheet',[pages[0],pages[0]])
 def change(name,fn):
  bad=copy.deepcopy(pages);fn(bad);reject(name,bad)
 change('wrong MediaBox',lambda p:p[0].update(media=(0,0,210,297)))
 change('cropped page',lambda p:p[0].update(crop=(1,0,420,297)))
 change('rotated page',lambda p:p[0].update(rotation=90))
 change('raster surrogate',lambda p:p[0].update(images=1))
 change('missing segment',lambda p:p[0]['strokes'].pop())
 def ruler(p):return match_segment(p[0]['strokes'],((146.5,184.625),(273.5,184.625)))[1]
 change('same length shifted ruler',lambda p:ruler(p).update(a=(147.5,184.625),b=(274.5,184.625)))
 change('wrong physical scale',lambda p:ruler(p).update(b=(210,184.625)))
 change('wrong lineweight',lambda p:ruler(p).update(widthMm=.5))
 change('transparent stroke',lambda p:ruler(p).update(opacity=0))
 change('unknown opacity',lambda p:ruler(p).update(opacity=None))
 change('dashed ordinary stroke',lambda p:ruler(p).update(dashes='[4 2] 0'))
 change('missing filled arrow',lambda p:p[0]['fills'].pop())
 change('transparent arrow',lambda p:p[0]['fills'][0].update(opacity=0))
 change('wrong arrow area',lambda p:p[0]['fills'][0].update(area=9))
 change('wrong arrow location',lambda p:p[0]['fills'][0].update(points=[(0,0),(1,1),(2,0)]))
 change('missing dimension semantics',lambda p:p[0].update(text=p[0]['text'].replace(DIMENSION,'WRONG')))
 def textrow(p,text):return next(t for t in p[0]['traces'] if t['text']==text)
 change('wrong rotated dimension baseline',lambda p:textrow(p,DIMENSION).update(direction=(1,0)))
 change('wrong horizontal leader baseline',lambda p:textrow(p,LEADER).update(direction=(.6,-.8)))
 change('transparent annotation',lambda p:p[0]['traces'][0].update(opacity=0))
 change('invisible annotation',lambda p:p[0]['traces'][0].update(type=3))
 change('late white overpaint',lambda p:p[0]['backgrounds'].append({'bounds':(0,0,420,297),'opacity':1,'seqno':999999}))
 change('clipped geometry',lambda p:p[0]['raster'][0].update(rgb=(255,255,255)))
 change('clipped off-stroke arrow interior',lambda p:next(s for s in p[0]['raster'] if s['role']=='leader arrow off-stroke interior').update(rgb=(255,255,255)))
 change('unexpected ink in clear gap',lambda p:next(s for s in p[0]['raster'] if not s['expectedInk']).update(rgb=(0,0,0)))
 assert len(controls)==28
 return controls

def main():
 parser=argparse.ArgumentParser()
 for name in ('producer','receipt','render-directory'):parser.add_argument('--'+name,type=Path,required=True)
 parser.add_argument('--profile',choices=['rotated-annotation'],required=True)
 args=parser.parse_args();assert not args.receipt.exists() and not args.render_directory.exists()
 producer=json.loads(args.producer.read_text(encoding='utf-8-sig'));outputs=producer['outputs'];bindings={'producer':{'file':str(args.producer),'sha256':sha(args.producer)}}
 for name in ('input','native','pdf'):
  assert sha(outputs[name])==outputs[name+'SHA256'];bindings[name]={'file':outputs[name],'sha256':sha(outputs[name])}
 report={'format':'LinecraftIndependentRotatedAnnotationPDF/1','status':'running','startedAt':datetime.now(timezone.utc).isoformat(),'bindings':bindings,'paperProfile':args.profile,'measurements':[],'negativeControls':[],'renders':[],
  'scope':'Synthetic rotated default geometry, vector/polygon paint, actual declared raster sites and semantic text/baseline only. No glyph inkheight or client/domain/native/installed acceptance.',
  'tolerances':{'lengthMm':.02,'combinedEndpointsMm':.04,'strokeMm':.005,'pageMm':.3,'fillAreaMm2':.02,'textDirectionComponent':.0001},'rasterProtocol':{'matrix':24,'dpi':1728,'patchSizeMm':2,'inkThresholdExclusive':128,'clearThresholdExclusive':240}}
 try:
  assert producer['status']=='passed' and producer['sourceUnchanged'] is True and producer['inputUnchanged'] is True and producer['paperProfile']=='rotated-annotation'
  documents=[json.loads(Path(outputs[n]).read_text(encoding='utf-8-sig')) for n in ('input','native')];assert documents[0]==documents[1]
  for doc in documents:native_document(doc)
  pdf=fitz.open(outputs['pdf']);pages=[extract(page) for page in pdf];report['measurements']=validate_pages(pages);report['negativeControls']=negative_controls(pages)
  args.render_directory.mkdir()
  for i,page in enumerate(pdf,1):
   for kind,scale,clip in [('full',1.5,None),('annotation',5,fitz.Rect(140/MM,90/MM,315/MM,152/MM))]:
    file=args.render_directory/f'page-{i}-{kind}.png';page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=clip,alpha=False).save(file);report['renders'].append({'page':i,'kind':kind,'file':str(file),'sha256':sha(file)})
  for binding in bindings.values():assert sha(binding['file'])==binding['sha256']
  report['status']='passed'
 except Exception as error:report['status']='failed';report['error']=repr(error);raise
 finally:
  report['completedAt']=datetime.now(timezone.utc).isoformat();report['auditor']={'file':str(Path(__file__)),'sha256':sha(__file__)}
  with args.receipt.open('x',encoding='utf8') as f:f.write(json.dumps(report,indent=2)+'\n')
  print(json.dumps({'status':report['status'],'measurements':len(report['measurements']),'negativeControls':len(report['negativeControls'])}))
if __name__=='__main__':main()
