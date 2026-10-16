"""Independent read-only native/PDF vector audit; no Linecraft producer imports.

python tests/audit-roof-plot-pdf.py --report SOURCE-DESKTOP-RESULTS --label source
python tests/audit-roof-plot-pdf.py --pdf ACTUAL.pdf --native SAVED.linecraft --layout-id layout2 --label visible
"""
from __future__ import annotations
import argparse, hashlib, json, math, re
from pathlib import Path
from datetime import datetime, timezone
import fitz

ROOT=Path(__file__).resolve().parent.parent
MM=25.4/72
def digest(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def near(a,b,t=.04): assert abs(a-b)<=t, f'{a} != {b} within {t} mm'
def distance(a,b): return math.dist(a,b)

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',type=Path);parser.add_argument('--pdf',type=Path);parser.add_argument('--native',type=Path);parser.add_argument('--layout-id');parser.add_argument('--label',required=True);parser.add_argument('--output-root',type=Path,default=Path.cwd());args=parser.parse_args();output_root=args.output_root.resolve();(output_root/'work').mkdir(parents=True,exist_ok=True);(output_root/'outputs').mkdir(parents=True,exist_ok=True)
 assert re.fullmatch('[A-Za-z0-9-]+',args.label)
 if args.report:
  source=json.loads(args.report.read_text());assert source['failed']==0
  native=Path(source['outputs']['native']);jobs=source['outputs']['pdfs']
 else:
  assert args.native and args.pdf and args.layout_id
  native=args.native;jobs=[{'path':str(args.pdf),'layoutId':args.layout_id}]
 document=json.loads(native.read_text(encoding='utf-8'));native_hash=digest(native)
 report={'framework':'Independent PyMuPDF analytical roof/closure physical-vector audit','scope':'Read-only existing native and actual PDF; no Linecraft geometry/plot imports. Fixed analytical source roof; source-to-paper transform independently calculated from camera axes.','label':args.label,'native':str(native),'nativeSHA256':native_hash,'pyMuPDFVersion':fitz.VersionBind,'startedAt':datetime.now(timezone.utc).isoformat(),'tests':[],'sheets':[]}
 def check(name,fn):
  try: report['tests'].append({'name':name,'status':'passed',**(fn()or{})});print('PASS '+name)
  except Exception as e: report['tests'].append({'name':name,'status':'failed','error':repr(e)});print('FAIL '+name+': '+str(e))
 def native_check():
  arch=document['architecture'];roof=arch['roofGroups'][0]
  assert document['entities']==[],'No ordinary model geometry may substitute for roof/closures.'
  assert arch['schemaVersion'] in (4,5) and len(arch['roofGroups'])==1 and arch['walls']==[]
  assert roof['roofType']=='GABLE' and roof['riseTwice']==8 and roof['bearingElevation']==120
  assert roof['overhang']==roof['rakeOverhang']==roof['heelOffset']==0
  assert arch['levels'][0]['defaultCeilingElevation']==96 and arch['levels'][0]['defaultBearingElevation']==120
  assert arch['costAssumptions']=={'prefabricatedTrussDesignSurcharge':0,'manufacturingComplexitySurcharge':0}
  assert {(p['x'],p['y'])for p in roof['boundary']}=={(0,0),(480,0),(480,240),(0,240)}
  assert set(roof['gableAssignments'])=={'edge:0,0|0,240','edge:480,0|480,240'}
  assert document['settings']['units']=='in'
  return {'mathematicalModel':True,'bearingInches':120,'ceilingInches':96,'analyticalRidgeInches':160,'ridgeLengthInches':480,'gableWidthInches':240,'gableRiseInches':40,'ordinaryModelObjects':0}
 check('native saved source establishes an independent analytical zero-thickness roof',native_check)
 for index,job in enumerate(jobs):
  file=Path(job['path']);before=digest(file);pdf=fitz.open(file);page=pdf[0];layout=next(l for l in document['layouts']if l['id']==job['layoutId']);label=layout['name'];segments=[]
  for d in page.get_drawings():
   if d['type'] not in ('s','fs'):continue
   for item in d['items']:
    if item[0]=='l':segments.append((tuple(v*MM for v in item[1]),tuple(v*MM for v in item[2])))
    elif item[0]=='re':
     r=item[1];p=[tuple(v*MM for v in q)for q in [r.tl,r.tr,r.br,r.bl]];segments.extend(zip(p,p[1:]+p[:1]))
  sheet={'pdf':str(file),'pdfSHA256':before,'layoutId':layout['id'],'layoutName':label,'vectorSegments':len(segments),'measurements':[]};report['sheets'].append(sheet)
  def segment(a,b,t=.04):
   found=[(p,q)for p,q in segments if min(distance(p,a)+distance(q,b),distance(p,b)+distance(q,a))<=2*t]
   assert found,f'No actual PDF vector {a} -> {b}';return found[0]
  def paper(p,v):
   c=v['modelCenter'];delta=[p.get(k,0)-c.get(k,0)for k in ('x','y','z')];f=v['frame'];s=25.4/v['scaleDenominator']
   if v['workspace']=='2d':right=[1,0,0];up=[0,1,0]
   else:
    yaw,pitch,roll=[math.radians(v['camera3d'].get(k,0))for k in ('yaw','pitch','roll')];cy,sy,cp,sp,cr,sr=math.cos(yaw),math.sin(yaw),math.cos(pitch),math.sin(pitch),math.cos(roll),math.sin(roll)
    right=[-sy*cr-cy*sp*sr,cy*cr-sy*sp*sr,cp*sr];up=[-cy*sp*cr+sy*sr,-sy*sp*cr-cy*sr,cp*cr]
   x=f['x']+f['width']/2+sum(a*b for a,b in zip(delta,right))*s;y=f['y']+f['height']/2+sum(a*b for a,b in zip(delta,up))*s
   return x,layout['paper']['heightMm']-y
  def page_check():
   assert len(pdf)==1;near(page.rect.width*MM,420,.3);near(page.rect.height*MM,297,.3)
   assert all(v['locked']for v in layout['viewports']);assert 'A3' in page.get_text()
   return {'widthMm':page.rect.width*MM,'heightMm':page.rect.height*MM,'lockedViewports':len(layout['viewports'])}
  check(label+': actual one-page A3 sheet and locked native viewports',page_check)
  for v in layout['viewports']:
   name=f'{label} {v["id"]} 1:{v["scaleDenominator"]}'
   def border_check():
    f=v['frame'];h=layout['paper']['heightMm'];corners=[(f['x'],h-f['y']),(f['x']+f['width'],h-f['y']),(f['x']+f['width'],h-f['y']-f['height']),(f['x'],h-f['y']-f['height'])]
    for a,b in zip(corners,corners[1:]+corners[:1]):segment(a,b)
    return {'frameMm':f,'scaleDenominator':v['scaleDenominator'],'mmPerModelInch':25.4/v['scaleDenominator']}
   check(name+': physical viewport frame without fit rescaling',border_check)
   if '0'in v['frozenLayers']:
    def negative():
     f=v['frame'];h=layout['paper']['heightMm'];inside=lambda p:f['x']+.5<p[0]<f['x']+f['width']-.5 and h-f['y']-f['height']+.5<p[1]<h-f['y']-.5
     found=[(a,b)for a,b in segments if inside(a)or inside(b)];assert found==[],f'Frozen viewport contains {len(found)} interior vectors.'
     return {'interiorVectorCount':0,'frozenLayers':v['frozenLayers']}
    check(name+': frozen architecture layer emits no interior roof or closure vectors',negative)
   elif v['workspace']=='2d':
    def plan_check():
     lengths=[]
     # Ridge cannot be supplied by the closure base in plan: it spans the 40ft X-axis.
     for a,b in [({'x':0,'y':120,'z':160},{'x':480,'y':120,'z':160}),({'x':0,'y':0,'z':120},{'x':480,'y':0,'z':120}),({'x':0,'y':240,'z':120},{'x':480,'y':240,'z':120})]:
      p,q=segment(paper(a,v),paper(b,v));near(distance(p,q),480*25.4/v['scaleDenominator']);lengths.append(distance(p,q))
     item={'ridgeAndEaveLengthsMm':lengths,'expected40FeetMm':480*25.4/v['scaleDenominator']};sheet['measurements'].append(item);return item
    check(name+': generated ridge and both eaves have exact common physical scale',plan_check)
   else:
    def closure_check():
     assert v['camera3d']['yaw']==v['camera3d']['pitch']==v['camera3d']['roll']==0
     a={'x':480,'y':0,'z':120};m={'x':480,'y':120,'z':120};b={'x':480,'y':240,'z':120};peak={'x':480,'y':120,'z':160}
     base=[]
     for p,q in [(a,m),(m,b)]:
      u,w=segment(paper(p,v),paper(q,v));base.append(distance(u,w))
     u,w=segment(paper(m,v),paper(peak,v));height=distance(u,w);near(height,40*25.4/v['scaleDenominator']);near(sum(base),240*25.4/v['scaleDenominator'])
     for p in [a,b]:segment(paper(p,v),paper(peak,v))
     item={'closureBaseHalvesMm':base,'closureBaseWidthMm':sum(base),'closureRiseMm':height,'proof':'Base at z120 and center return to z160 are absent from sloping roof edges; with zero ordinary model objects these actual vectors prove separate generated closure printing.'};sheet['measurements'].append(item);return item
    check(name+': separate gable closure base, split, sloping edges and 40-inch rise print accurately',closure_check)
  def raster_check():
   target=output_root/'outputs'/f'Linecraft-Roof-PDF-{args.label}-{layout["id"]}-1.12.2.png';pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False);pix.save(target);assert target.stat().st_size>1000;assert digest(file)==before;assert digest(native)==native_hash;sheet['raster']=str(target);return {'raster':str(target),'rasterSHA256':digest(target),'sourceFilesUnchanged':True}
  check(label+': read-only raster and immutable actual native/PDF hashes',raster_check);pdf.close()
 report['completedAt']=datetime.now(timezone.utc).isoformat();report['total']=len(report['tests']);report['passed']=sum(t['status']=='passed'for t in report['tests']);report['failed']=report['total']-report['passed'];out=output_root/'work'/f'roof-plot-{args.label}-audit-results.json';out.write_text(json.dumps(report,indent=2)+'\n');print(f'{report["passed"]}/{report["total"]} independent roof/closure PDF checks passed');raise SystemExit(1 if report['failed']else 0)
if __name__=='__main__':main()
