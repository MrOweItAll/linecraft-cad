"""Independent raw clipping ownership and ezdxf semantic decoding, not native acceptance."""
import argparse,hashlib,json,os,sys
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('file',type=Path)
parser.add_argument('--drawing',type=Path,required=True)
parser.add_argument('--library-dir',type=Path)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
os.environ['XDG_CACHE_HOME']=str(root/'work/dxf-cache')
if args.library_dir:sys.path.insert(0,str(args.library_dir.resolve()))
import ezdxf
data=json.loads(args.drawing.read_text(encoding='utf8'))
lines=args.file.read_text(encoding='utf8').splitlines()
assert len(lines)%2==0
records=[];current=[]
for i in range(0,len(lines),2):
 code=int(lines[i]);value=lines[i+1]
 if code==0:
  if current:records.append(current)
  current=[]
 current.append((code,value))
if current:records.append(current)
def values(record,code):return [v for k,v in record if k==code]
by_handle={values(r,5)[0]:r for r in records if values(r,5)}
section=None;block=None;locations={}
for record in records:
 kind=record[0][1]
 if kind=='SECTION':section=values(record,2)[0]
 if kind=='BLOCK':block=values(record,2)[0]
 if values(record,5):locations[values(record,5)[0]]={'section':section,'block':block}
 if kind=='ENDBLK':block=None
 if kind=='ENDSEC':section=None
document=ezdxf.readfile(args.file)
tests=[]
def near(actual,expected,tolerance=1e-8):
 if isinstance(expected,(list,tuple)):
  assert len(actual)==len(expected),(actual,expected)
  for a,b in zip(actual,expected):near(a,b,tolerance)
 else:assert abs(actual-expected)<=tolerance,(actual,expected)
def check(name,fn):
 try:tests.append({'name':name,'status':'passed','detail':fn()})
 except Exception as error:tests.append({'name':name,'status':'failed','error':repr(error)})
def graph():
 handles=[v for r in records for k,v in r if k in (5,105)];assert len(handles)==len(set(handles))
 references=0
 for record in records:
  for code,value in record:
   if code in (330,331,340,350,360,390) and value!='0':assert value in handles,(record[0][1],code,value);references+=1
 return {'uniqueHandles':len(handles),'resolvedPointers':references}
check('all raw owner, clip, dictionary and style handles resolve uniquely',graph)
def geometry():
 actual=list(document.modelspace());assert len(actual)==len(data['entities'])
 for item,source in zip(actual,data['entities']):
  assert item.dxftype()==source['type']
  if source['type']=='LINE':near(tuple(item.dxf.start),[source['start']['x'],source['start']['y'],0]);near(tuple(item.dxf.end),[source['end']['x'],source['end']['y'],0])
  elif source['type']=='CIRCLE':near(tuple(item.dxf.center),[source['center']['x'],source['center']['y'],0]);near(item.dxf.radius,source['radius'])
 return {'unchangedModelEntities':len(actual)}
check('viewport clipping records never enter model space or alter model geometry',geometry)
def ownership():
 assert document.layouts.names_in_taborder()==['Model']+[s['name'] for s in data['layouts']]
 result=[]
 for index,sheet in enumerate(data['layouts']):
  layout=document.layouts.get(sheet['name']);actual=list(layout);expected=len(sheet['entities'])+len(sheet['viewports'])+1+sum('boundary' in v for v in sheet['viewports']);assert len(actual)==expected,(layout.name,len(actual),expected)
  for item in actual:
   assert item.dxf.owner==layout.dxf.block_record_handle,(layout.name,item.dxftype(),item.dxf.owner)
   record=by_handle[item.dxf.handle];assert values(record,330)==[layout.dxf.block_record_handle];assert values(record,410)==[layout.name];assert values(record,67)==['1']
   location=locations[item.dxf.handle];assert location['section']==('ENTITIES' if index==0 else 'BLOCKS'),location
   if index>0:assert location['block']==layout.block_record.dxf.name
  near(layout.dxf.paper_width,sheet['paper']['widthMm']);near(layout.dxf.paper_height,sheet['paper']['heightMm']);result.append({'layout':layout.name,'objects':len(actual),'rawSection':'ENTITIES' if index==0 else 'BLOCKS'})
 return result
check('active and inactive layout ownership survives external normalization with raw section agreement',ownership)
def clips():
 result=[]
 for sheet in data['layouts']:
  layout=document.layouts.get(sheet['name']);floating=[v for v in layout.query('VIEWPORT') if v.dxf.id>1];assert len(floating)==len(sheet['viewports'])
  for view,source in zip(floating,sheet['viewports']):
   record=by_handle[view.dxf.handle];flags=int(values(record,90)[0]);pointer=values(record,340)
   if 'boundary' not in source:assert not flags&65536;assert pointer==[];continue
   assert flags&65536;assert len(pointer)==1;clip=document.entitydb[pointer[0]];raw=by_handle[pointer[0]];assert clip.dxftype()=='LWPOLYLINE';assert clip.closed;assert clip.dxf.owner==view.dxf.owner;assert values(raw,330)==[view.dxf.owner];assert values(raw,410)==[layout.name];near(list(clip.get_points('xy')),[[p['x'],p['y']] for p in source['boundary']]);assert len(clip)==len(source['boundary'])
   result.append({'layout':layout.name,'viewportHandle':view.dxf.handle,'clipHandle':clip.dxf.handle,'vertices':len(clip),'flags':flags})
 assert len(result)==2
 return result
check('concave boundaries decode as exact closed paper polylines linked by group340 and flag65536',clips)
def appearance():
 original=set(layer['name'] for layer in data['layers']);temporary=[]
 for sheet in data['layouts']:
  layout=document.layouts.get(sheet['name']);floating=[v for v in layout.query('VIEWPORT') if v.dxf.id>1]
  for view,source in zip(floating,sheet['viewports']):
   if 'boundary' not in source:continue
   clip=document.entitydb[values(by_handle[view.dxf.handle],340)[0]];layer=document.layers.get(clip.dxf.layer)
   if not source['plotBorder']:
    assert clip.dxf.layer not in original;assert layer.dxf.plot==0;temporary.append(clip.dxf.layer)
   else:assert clip.dxf.layer==source['layer'];assert layer.dxf.plot==1
   assert clip.dxf.true_color==int(source['color'][1:],16);assert clip.dxf.lineweight==35;assert clip.dxf.linetype.upper()==source['linetype'].upper()
 assert len(temporary)==1
 assert all(not name.startswith('Linecraft viewport clip') for name in original)
 return {'exportOnlyNoPlotLayers':temporary,'appearanceOverridesVerified':2}
check('export-only nonplot clip layers retain explicit color, weight and linetype without mutating the drawing',appearance)
def scale():
 result=[]
 for sheet in data['layouts']:
  layout=document.layouts.get(sheet['name']);views=[v for v in layout.query('VIEWPORT') if v.dxf.id>1]
  for view,source in zip(views,sheet['viewports']):
   f=source['frame'];near(tuple(view.dxf.center),[f['x']+f['width']/2,f['y']+f['height']/2,0]);near(view.dxf.width,f['width']);near(view.dxf.height,f['height']);near(view.dxf.view_height,f['height']*source['scaleDenominator']);near(tuple(view.dxf.view_target_point),[source['modelCenter'][k] for k in ('x','y','z')]);near(view.dxf.height/view.dxf.view_height,1/source['scaleDenominator']);result.append({'layout':layout.name,'paperPerModelUnit':view.dxf.height/view.dxf.view_height,'modelViewHeight':view.dxf.view_height})
 return result
check('clip shape never changes physical ratio, camera target or off-sheet frame extents',scale)
def audit():
 result=document.audit();assert not result.errors and not result.fixes,{'errors':[str(e) for e in result.errors],'fixes':[str(e) for e in result.fixes]};return {'errors':0,'fixes':0,'nativeAutoCADAcceptanceClaimed':False}
check('external ezdxf audit reports zero errors and zero repairs',audit)
report={'framework':'Independent raw DXF graph and external ezdxf viewport clipping semantics','completedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'scope':'Original synthetic data; no actual AutoCAD execution. Audit success alone does not establish native interoperability.','libraryVersion':ezdxf.__version__,'dxfSHA256':hashlib.sha256(args.file.read_bytes()).hexdigest(),'drawingSHA256':hashlib.sha256(args.drawing.read_bytes()).hexdigest(),'total':len(tests),'passed':sum(t['status']=='passed' for t in tests),'failed':sum(t['status']=='failed' for t in tests),'tests':tests}
args.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report,indent=2));sys.exit(bool(report['failed']))
