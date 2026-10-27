"""Independent synthetic detail PDF geometry/paint/semantic audit; no product imports."""
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
SHEETS=[{'id':'sheet-a','marker':'DETAIL-48-FIRST','d':48},
        {'id':'sheet-b','marker':'DETAIL-24-SECOND','d':24}]
NOTE='SYNTHETIC QA ORIGINAL'
DIMENSION='''ORIGINAL 20'-0"'''
# Literal model-space reference, independently frozen before app output.
MODEL_SEGMENTS=[('south',((0,60),(240,60)),.25),('east',((240,60),(240,180)),.25),
 ('north',((240,180),(0,180)),.25),('west upper',((0,180),(0,132)),.25),
 ('west lower',((0,96),(0,60)),.25),('dimension',((0,200),(240,200)),.25),
 ('extension left',((0,61),(0,201.25)),.25),('extension right',((240,61),(240,201.25)),.25),
 ('insert',((210,160),(220,160)),.25),('dashed',((0,240),(120,240)),.7)]
MODEL_FILLS=[('solid hatch',[(20,80),(30,80),(30,85),(20,85)],50),
 ('left arrow',[(0,200),(2.5,200.875),(2.5,199.125)],2.1875),
 ('right arrow',[(240,200),(237.5,200.875),(237.5,199.125)],2.1875)]
PAPER_SEGMENTS=[('paper sentinel',((20,237),(120,237)),.35),
 ('border lower',((10,287),(410,287)),.25),('border right',((410,287),(410,257)),.25),
 ('border upper',((410,257),(10,257)),.25),('border left',((10,257),(10,287)),.25),
 ('divider one',((300,287),(300,257)),.25),('divider two',((360,287),(360,257)),.25)]
def projected(p,d):
 return (210+(p[0]-120)*25.4/d,137-(p[1]-150)*25.4/d)
def area(points):
 return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(points,points[1:]+points[:1])))/2
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



def extract(page):
 strokes,fills,backgrounds,capsules=[],[],[],[]
 for drawing in page.get_drawings():
  kind=drawing['type'];assert kind in ('s','f','fs')
  seq=drawing['seqno'];assert type(seq) is int
  if any(i[0]=='c' for i in drawing['items']):
   assert kind=='f';items=drawing['items'];assert len(items)%18==0
   for index in range(0,len(items),18):
    part=items[index:index+18];assert [i[0] for i in part]==['l']+['c']*8+['l']+['c']*8
    boundary=[];previous=None
    for item in part:
     pts=[point(p) for p in item[1:]]
     if previous is not None:assert math.dist(previous,pts[0])<1e-5
     previous=pts[-1]
     if item[0]=='l':boundary.append(pts[0])
     else:
      a,b,c,d=pts
      for k in range(16):
       t=k/16;u=1-t;boundary.append(tuple(u**3*a[j]+3*u*u*t*b[j]+3*u*t*t*c[j]+t**3*d[j] for j in (0,1)))
    assert math.dist(previous,point(part[0][1]))<1e-5
    xs=[v[0] for v in boundary];ys=[v[1] for v in boundary]
    capsules.append({'boundary':boundary,'bounds':(min(xs),min(ys),max(xs),max(ys)),
     'area':area(boundary),'opacity':drawing['fill_opacity'],'color':drawing['fill'],'seqno':seq})
   continue
  segments=line_segments(drawing)
  if kind in ('s','fs'):
   for a,b in segments:
    strokes.append({'a':a,'b':b,'widthMm':drawing['width']*MM,'opacity':drawing['stroke_opacity'],
     'color':drawing['color'],'dashes':drawing['dashes'],'cap':drawing['lineCap'],'seqno':seq})
  if kind in ('f','fs'):
   color=drawing['fill'];assert color
   bounds=tuple(v*MM for v in drawing['rect'])
   if min(color)>.99:
    assert kind=='f' and len(drawing['items'])==1 and drawing['items'][0][0]=='re'
    backgrounds.append({'bounds':bounds,'opacity':drawing['fill_opacity'],'seqno':seq})
   else:
    assert kind=='f','Synthetic fill must not acquire an outline'
    vertices=[a for a,b in segments]
    assert len(vertices) in (3,4),('Unexpected polygon',vertices)
    fills.append({'points':vertices,'area':area(vertices),'bounds':bounds,'opacity':drawing['fill_opacity'],
     'color':color,'seqno':seq})
 traces=[{'text':''.join(chr(c[0]) for c in t['chars']),'opacity':t['opacity'],'color':t['color'],
          'type':t['type'],'seqno':t['seqno'],'font':t['font']} for t in page.get_texttrace()]
 texts=[NOTE,DIMENSION]+[s['marker'] for s in SHEETS]
 return {'size':(page.rect.width*MM,page.rect.height*MM),'media':tuple(v*MM for v in page.mediabox),
  'crop':tuple(v*MM for v in page.cropbox),'rotation':page.rotation,'images':len(page.get_image_info()),
  'text':page.get_text(),'boxes':{text:[tuple(v*MM for v in b) for b in page.search_for(text)] for text in texts},
  'strokes':strokes,'fills':fills,'backgrounds':backgrounds,'traces':traces,'capsules':capsules,
  'raster':raster_samples(page)}

def raster_samples(page):
 # Fixed432dpi reference samples include actual PDF clipping/overpaint.
 d=SHEETS[page.number]['d'];start,y=projected((0,240),d);length=120*25.4/d
 samples=[]
 for role,ends,width in MODEL_SEGMENTS[:-1]:
  a,b=[projected(p,d) for p in ends];samples.append((role+' ink',((a[0]+b[0])/2,(a[1]+b[1])/2),True))
 for role,points,_ in MODEL_FILLS:
  pts=[projected(p,d) for p in points];samples.append((role+' interior',(sum(p[0] for p in pts)/len(pts),sum(p[1] for p in pts)/len(pts)),True))
 for i in range(math.ceil(length/6)):
  a=6*i;b=min(a+4,length)
  samples.append((f'dash {i} interior',(start+(a+b)/2,y),True))
  if b+1<length:samples.append((f'dash {i} gap',(start+b+1,y),False))
 samples += [('first round cap',(start-.2,y),True),('cap outside corner',(start-.3,y+.3),False),
             ('final round cap',(start+length+.2,y),True),('beyond final cap',(start+length+.6,y),False)]
 pix=page.get_pixmap(matrix=fitz.Matrix(6,6),alpha=False)
 result=[]
 for role,(x,y),ink in samples:
  rgb=pix.pixel(round(x/MM*6),round(y/MM*6))[:3]
  result.append({'role':role,'pointMm':(x,y),'expectedInk':ink,'rgb':rgb})
 return result

def native_document(doc):
 assert doc['settings']['units']=='in' and doc['settings']['linearFormat']=='architectural'
 assert [s['id'] for s in doc['layouts']]==['sheet-b','sheet-a']
 entities={e['id']:e for e in doc['entities']};assert len(entities)==10 and len(doc['entities'])==10
 for name,a,b in [('wall-south',(0,60),(240,60)),('wall-east',(240,60),(240,180)),
   ('wall-north',(240,180),(0,180)),('wall-west-1',(0,180),(0,132)),
   ('wall-west-2',(0,96),(0,60)),('detail-weight',(0,240),(120,240))]:
  e=entities[name];assert e['type']=='LINE' and e['start']==dict(zip(('x','y'),a)) and e['end']==dict(zip(('x','y'),b))
 assert entities['detail-weight']['lineweight']==.7 and entities['detail-weight']['linetype']=='dashed'
 n=entities['qa-note'];assert n['type']=='TEXT' and n['text']==NOTE and n['position']=={'x':20,'y':160} and n['height']==6 and n['style']=='Standard'
 dim=entities['qa-dim'];assert dim['kind']=='linear' and dim['textOverride']=='ORIGINAL <>' and dim['placement']=={'x':120,'y':200} and dim['p1']=={'x':0,'y':60} and dim['p2']=={'x':240,'y':60} and dim['scale']==1
 h=entities['qa-fill'];assert h['pattern']=='solid' and h['boundary']['points']==[{'x':20,'y':80},{'x':30,'y':80},{'x':30,'y':85},{'x':20,'y':85}] and h['boundary']['closed'] is True
 block=entities['qa-block'];assert block['blockName']=='Synthetic marker' and block['position']=={'x':210,'y':160} and block['scale']==1 and block['rotation']==0
 assert doc['blocks'][0]['entities'][0]['start']=={'x':0,'y':0} and doc['blocks'][0]['entities'][0]['end']=={'x':10,'y':0}
 style=next(s for s in doc['textStyles'] if s['name']=='Standard');assert style['fontFamily']=='Arial' and style['widthFactor']==1
 ds=next(s for s in doc['dimStyles'] if s['name']=='Standard')
 for key,value in {'textStyle':'Standard','textHeight':2.5,'arrowSize':2.5,'gap':1,'extensionOffset':1,'extensionOvershoot':1.25,'scale':1}.items():assert ds[key]==value
 layer=next(l for l in doc['layers'] if l['name']=='0');assert layer['lineweight']==.25 and layer['color']=='#e5e7eb'
 for s in SHEETS:
  layout=next(l for l in doc['layouts'] if l['id']==s['id']);assert [layout['paper'][k] for k in ('widthMm','heightMm','orientation')]==[420,297,'landscape']
  assert len(layout['viewports'])==1 and len(layout['entities'])==5
  v=layout['viewports'][0];assert v['frame']=={'x':40,'y':60,'width':340,'height':200} and v['modelCenter']=={'x':120,'y':150,'z':0} and v['scaleDenominator']==s['d'] and v['locked'] is True and v['plotBorder'] is False and v['frozenLayers']==[]
  t=next(e for e in layout['entities'] if e['type']=='TEXT');assert t['text']==s['marker'] and t['position']=={'x':310,'y':15} and t['height']==4

def validate_pages(pages):
 assert len(pages)==2
 measurements=[]
 for number,(page,sheet) in enumerate(zip(pages,SHEETS),1):
  d=sheet['d'];assert type(page['rotation']) is int and page['rotation']==0
  for field in ('media','crop'):
   for actual,expected in zip(page[field],(0,0,420,297)):near(actual,expected,PAGE_TOLERANCE)
  for actual,expected in zip(page['size'],(420,297)):near(actual,expected,PAGE_TOLERANCE)
  assert page['images']==0
  measurements.append({'page':number,'role':'paper boxes','sizeMm':page['size'],'mediaMm':page['media'],'cropMm':page['crop'],'rotation':page['rotation']})
  assert len(page['strokes'])==16,('Unexpected solid stroke count',len(page['strokes']))
  used=set()
  segments=[(name,tuple(projected(p,d) for p in ends),width) for name,ends,width in MODEL_SEGMENTS[:-1]]+PAPER_SEGMENTS
  for role,ends,width in segments:
   idx,row=match_segment(page['strokes'],ends);assert idx not in used;used.add(idx)
   opaque(row['opacity'],'stroke');black(row['color'],'stroke');near(row['widthMm'],width,STROKE_TOLERANCE)
   near(math.dist(row['a'],row['b']),math.dist(*ends),LENGTH_TOLERANCE)
   dash=re.fullmatch(r'\[([^\]]*)\]\s*([-+0-9.eE]+)',row['dashes'].strip());assert dash
   values=[float(v)*MM for v in dash[1].split()];near(float(dash[2])*MM,0,STROKE_TOLERANCE)
   assert values==[]
   measurements.append({'page':number,'role':role,'expectedEndpointsMm':ends,'actualEndpointsMm':[row['a'],row['b']],
    'lengthMm':math.dist(row['a'],row['b']),'strokeWidthMm':row['widthMm'],'dashMm':values})
  start,y=projected((0,240),d);length=120*25.4/d;radius=.35
  assert len(page['capsules'])==math.ceil(length/6)
  for i,cap in enumerate(page['capsules']):
   x0=start+6*i;x1=start+min(6*i+4,length)
   opaque(cap['opacity'],'dash fill');black(cap['color'],'dash fill')
   for actual,literal in zip(cap['bounds'],(x0-radius,y-radius,x1+radius,y+radius)):near(actual,literal,LENGTH_TOLERANCE)
   near(cap['area'],(x1-x0)*.7+math.pi*radius**2,AREA_TOLERANCE)
   for xval,yval in cap['boundary']:
    # Every boundary point lies on the independently defined capsule perimeter.
    dx=max(x0-xval,0,xval-x1);near(math.hypot(dx,yval-y),radius,STROKE_TOLERANCE)
  measurements.append({'page':number,'role':'physical dashed line','expectedCenterlineMm':(projected((0,240),d),projected((120,240),d)),
   'nominalLengthMm':length,'dashOnMm':4,'dashOffMm':2,'roundRadiusMm':radius,'capsules':[{'boundsMm':c['bounds'],'areaMm2':c['area']} for c in page['capsules']]})
  assert len(page['fills'])==3
  used=set()
  for role,points,model_area in MODEL_FILLS:
   literal=[projected(p,d) for p in points]
   matches=[(i,f) for i,f in enumerate(page['fills']) if len(f['points'])==len(literal) and all(min(math.dist(a,b) for b in f['points'])<ENDPOINT_TOLERANCE/2 for a in literal)]
   assert len(matches)==1,('Missing duplicate or misplaced fill',role)
   i,fill=matches[0];assert i not in used;used.add(i);opaque(fill['opacity'],'fill');black(fill['color'],'fill')
   near(fill['area'],model_area*(25.4/d)**2,AREA_TOLERANCE)
   measurements.append({'page':number,'role':role,'expectedVerticesMm':literal,'actualVerticesMm':fill['points'],'areaMm2':fill['area'],'boundsMm':fill['bounds']})
  other=next(s['marker'] for s in SHEETS if s!=sheet);assert other not in page['text']
  # Broad, declared semantic regions: exact native heights/styles remain a separate claim.
  cells={NOTE:(90,100,240,150),DIMENSION:(140,70,280,120),sheet['marker']:(300,257,410,287)}
  for text,cell in cells.items():
   assert page['text'].count(text)==1,(text,page['text'])
   boxes=page['boxes'][text];assert len(boxes)==1;box=boxes[0]
   assert all(math.isfinite(v) for v in box) and cell[0]<=box[0]<box[2]<=cell[2] and cell[1]<=box[1]<box[3]<=cell[3],(text,box,cell)
   assert text in ''.join(t['text'] for t in page['traces'])
   measurements.append({'page':number,'role':'semantic annotation','text':text,'boundsMm':box,'declaredCellMm':cell})
  assert page['traces']
  for trace in page['traces']:
   assert trace['type']==0;opaque(trace['opacity'],'text');black(trace['color'],'text');assert type(trace['seqno']) is int
   assert trace['font'] in ('ArialMT','Arial'),'Requested Arial sample uses another face'
  foreground=[r['seqno'] for r in page['strokes']+page['fills']+page['traces']+page['capsules']]
  assert page['backgrounds']
  for bg in page['backgrounds']:
   opaque(bg['opacity'],'background');assert bg['seqno']<min(foreground),'Late white overpaint'
   assert any(all(abs(a-b)<=PAGE_TOLERANCE for a,b in zip(bg['bounds'],bounds)) for bounds in [(0,0,420,297),(40,37,380,237)])
  assert page['raster']
  for sample in page['raster']:
   rgb=sample['rgb'];assert len(rgb)==3 and all(type(v) is int and 0<=v<=255 for v in rgb)
   assert max(rgb)<128 if sample['expectedInk'] else min(rgb)>240,('Actual raster ink/gap mismatch',sample)
  measurements.append({'page':number,'role':'actual raster clipping paint and gap samples','samples':page['raster']})
 return measurements

def negative_controls(pages):
 controls=[]
 def reject(name,data):
  try:validate_pages(data)
  except AssertionError as e:controls.append({'control':name,'rejected':True,'reason':str(e),'actualPDFBytesModified':False});return
  raise AssertionError(('Control incorrectly accepted',name))
 reject('missing page',pages[:1]);reject('extra page',pages+[pages[0]]);reject('wrong requested order',pages[::-1]);reject('duplicate first sheet',[pages[0],pages[0]])
 def change(name,fn):
  bad=copy.deepcopy(pages);fn(bad);reject(name,bad)
 change('wrong MediaBox',lambda p:p[0].__setitem__('media',(0,0,210,297)))
 change('shifted CropBox',lambda p:p[0].__setitem__('crop',(1,0,420,297)))
 change('rotation',lambda p:p[0].__setitem__('rotation',90))
 change('raster surrogate',lambda p:p[0].__setitem__('images',1))
 change('missing wall',lambda p:p[0]['strokes'].pop(0))
 def wall(p):return match_segment(p[0]['strokes'],((146.5,184.625),(273.5,184.625)))[1]
 change('correct length shifted wall',lambda p:wall(p).update(a=(147.5,184.625),b=(274.5,184.625)))
 change('wrong model scale',lambda p:wall(p).update(b=(337,232.25)))
 change('wrong physical lineweight',lambda p:wall(p).update(widthMm=.5))
 change('transparent stroke',lambda p:wall(p).update(opacity=0))
 change('unknown opacity',lambda p:wall(p).update(opacity=None))
 change('continuous instead of distinct dashes',lambda p:p[0]['capsules'].pop())
 change('viewport scaled dash array',lambda p:p[0]['capsules'][0].update(bounds=(0,0,2,1)))
 change('dash phase changed',lambda p:p[0]['capsules'][0].update(bounds=(147,89,151,90)))
 change('square instead of round caps',lambda p:p[0]['capsules'][0].update(area=4*.7))
 change('missing filled geometry',lambda p:p[0]['fills'].pop())
 change('transparent fill',lambda p:p[0]['fills'][0].update(opacity=0))
 change('wrong fill area',lambda p:p[0]['fills'][0].update(area=999))
 change('wrong dimension text',lambda p:p[0].update(text=p[0]['text'].replace(DIMENSION,'WRONG')))
 change('invisible annotation',lambda p:p[0]['traces'][0].update(type=3))
 change('late white overpaint',lambda p:p[0]['backgrounds'].append({'bounds':(0,0,420,297),'opacity':1,'seqno':999999}))
 change('clipped or hidden geometry',lambda p:p[0]['raster'][0].update(rgb=(255,255,255)))
 change('filled dash gap',lambda p:next(s for s in p[0]['raster'] if not s['expectedInk']).update(rgb=(0,0,0)))
 change('invisible fill interior',lambda p:next(s for s in p[0]['raster'] if s['role']=='solid hatch interior').update(rgb=(255,255,255)))
 change('transparent dash fill',lambda p:p[0]['capsules'][0].update(opacity=0))
 assert len(controls)==28
 return controls

def main():
 parser=argparse.ArgumentParser()
 for name in ('producer','receipt','render-directory'):parser.add_argument('--'+name,type=Path,required=True)
 parser.add_argument('--profile',choices=['plan-detail'],required=True)
 args=parser.parse_args();assert not args.receipt.exists() and not args.render_directory.exists()
 producer=json.loads(args.producer.read_text(encoding='utf-8-sig'));outputs=producer['outputs']
 bindings={'producer':{'file':str(args.producer),'sha256':sha(args.producer)}}
 for name in ('input','native','pdf'):
  assert sha(outputs[name])==outputs[name+'SHA256'];bindings[name]={'file':outputs[name],'sha256':sha(outputs[name])}
 report={'format':'LinecraftIndependentPlanDetailPDF/1','status':'running','startedAt':datetime.now(timezone.utc).isoformat(),
  'bindings':bindings,'paperProfile':args.profile,'measurements':[],'negativeControls':[],'renders':[],
  'scope':'Synthetic model/block/dimension/fill/dash geometry and paint plus semantic annotation cells only. No glyph ink-height, client, domain or native-input acceptance.',
  'tolerances':{'lengthMm':.02,'combinedEndpointsMm':.04,'strokeMm':.005,'pageMm':.3,'fillAreaMm2':.02}}
 try:
  assert producer['status']=='passed' and producer['sourceUnchanged'] is True and producer['inputUnchanged'] is True and producer['paperProfile']=='plan-detail'
  documents=[json.loads(Path(outputs[n]).read_text(encoding='utf-8-sig')) for n in ('input','native')];assert documents[0]==documents[1]
  for document in documents:native_document(document)
  pdf=fitz.open(outputs['pdf']);pages=[extract(page) for page in pdf]
  report['measurements']=validate_pages(pages);report['negativeControls']=negative_controls(pages)
  args.render_directory.mkdir()
  for i,page in enumerate(pdf,1):
   for kind,scale,clip in [('full',1.5,None),('detail',3,fitz.Rect(75/MM,30/MM,345/MM,240/MM))]:
    file=args.render_directory/f'page-{i}-{kind}.png';page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=clip,alpha=False).save(file)
    report['renders'].append({'page':i,'kind':kind,'file':str(file),'sha256':sha(file)})
  for binding in bindings.values():assert sha(binding['file'])==binding['sha256']
  report['status']='passed'
 except Exception as error:report['status']='failed';report['error']=repr(error);raise
 finally:
  report['completedAt']=datetime.now(timezone.utc).isoformat();report['auditor']={'file':str(Path(__file__)),'sha256':sha(__file__)}
  with args.receipt.open('x',encoding='utf8') as f:f.write(json.dumps(report,indent=2)+'\n')
  print(json.dumps({'status':report['status'],'measurements':len(report['measurements']),'negativeControls':len(report['negativeControls'])}))
if __name__=='__main__':main()
