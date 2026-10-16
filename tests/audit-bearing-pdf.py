"""Read-only independent R5 native/PDF analytical audit; imports no Linecraft code.

python tests/audit-bearing-pdf.py --report tests/source-bearing-results.json --label source
python tests/audit-bearing-pdf.py --pdf actual.pdf --native saved.linecraft --layout-id layout2 --label visible
"""
from __future__ import annotations
import argparse, hashlib, json, math, re
from pathlib import Path
from datetime import datetime, timezone
import fitz

MM=25.4/72
def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def near(actual,expected,tolerance=.04): assert abs(actual-expected)<=tolerance,f'{actual} != {expected} within {tolerance} mm'

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 for field in ('report','pdf','native'):parser.add_argument('--'+field,type=Path)
 parser.add_argument('--layout-id');parser.add_argument('--label',required=True);parser.add_argument('--output-root',type=Path,default=Path.cwd());args=parser.parse_args()
 assert re.fullmatch('[A-Za-z0-9-]+',args.label)
 output_root=args.output_root.resolve();(output_root/'work').mkdir(parents=True,exist_ok=True);(output_root/'outputs').mkdir(parents=True,exist_ok=True)
 if args.report:
  source=json.loads(args.report.read_text());assert source['failed']==0
  default_native=Path(source['outputs']['native']);jobs=source['outputs']['pdfs']
 else:
  assert args.pdf and args.native and args.layout_id
  default_native=args.native;jobs=[{'path':str(args.pdf),'layoutId':args.layout_id}]
 report={'framework':'Independent PyMuPDF R5 additive-bearing physical vector audit','scope':'Existing actual PDF and source-only native files read without Linecraft solver/plot imports. Independently solves the two-plane intersection, gable closures, and declared HIP activation-step triangles. No framing approval.','label':args.label,'pyMuPDFVersion':fitz.VersionBind,'startedAt':datetime.now(timezone.utc).isoformat(),'tests':[],'sheets':[]}
 def check(name,fn):
  try:report['tests'].append({'name':name,'status':'passed',**(fn()or{})});print('PASS '+name)
  except Exception as error:report['tests'].append({'name':name,'status':'failed','error':repr(error)});print('FAIL '+name+': '+str(error))
 checked_natives=set()
 for job in jobs:
  native=Path(job.get('native',default_native));document=json.loads(native.read_text(encoding='utf-8'));native_hash=digest(native);roof=document['architecture']['roofGroups'][0];hip=roof['roofType']=='HIP'
  if str(native) not in checked_natives:
   def source_check():
    arch=document['architecture'];assert arch['schemaVersion']==5
    assert document['entities']==[] and arch['walls']==[] and len(arch['roofGroups'])==1,'No ordinary geometry or walls may substitute for generated roof interfaces.'
    assert roof['roofType'] in ('GABLE','HIP') and roof['riseTwice']==8 and roof['bearingElevation']==120
    assert roof['bearingAssignments']==[{'edgeKey':'edge:0,240|480,240','elevation':144}]
    assert roof['overhang']==roof['rakeOverhang']==roof['heelOffset']==0 and roof['eaveElevation'] is None
    assert arch['levels'][0]['defaultCeilingElevation']==96 and arch['levels'][0]['defaultBearingElevation']==120
    assert arch['costAssumptions']=={'prefabricatedTrussDesignSurcharge':0,'manufacturingComplexitySurcharge':0}
    assert {(p['x'],p['y'])for p in roof['boundary']}=={(0,0),(480,0),(480,240),(0,240)}
    assert document['settings']['units']=='in'
    if not hip:assert set(roof['gableAssignments'])=={'edge:0,0|0,240','edge:480,0|480,240'}
    else:assert roof['gableAssignments']==[]
    # Equation: 120 + y/3 = 144 + (240-y)/3, independent of the producer.
    width,pitch,low,high=240,1/3,120,144;ridge_y=width/2+(high-low)/(2*pitch);ridge_z=(low+high+pitch*width)/2
    near(ridge_y,156,1e-9);near(ridge_z,172,1e-9)
    return {'native':str(native),'nativeSHA256':native_hash,'roofType':roof['roofType'],'bearingInches':[low,high],'ceilingInches':96,'ridgeYInches':ridge_y,'ridgeElevationInches':ridge_z,'ridgeMigrationInches':36,'ordinaryModelObjects':0,'mathematicalZeroThickness':True}
   check(f'{roof["roofType"]} saved native establishes independent analytical unequal-bearing source',source_check);checked_natives.add(str(native))
  file=Path(job['path']);before=digest(file);pdf=fitz.open(file);page=pdf[0];layout=next(l for l in document['layouts']if l['id']==job['layoutId']);label=layout['name'];segments=[]
  for drawing in page.get_drawings():
   if drawing['type'] not in ('s','fs'):continue
   for item in drawing['items']:
    if item[0]=='l':segments.append((tuple(v*MM for v in item[1]),tuple(v*MM for v in item[2])))
    elif item[0]=='re':
     r=item[1];points=[tuple(v*MM for v in q)for q in [r.tl,r.tr,r.br,r.bl]];segments.extend(zip(points,points[1:]+points[:1]))
  sheet={'pdf':str(file),'pdfSHA256':before,'native':str(native),'nativeSHA256':native_hash,'layoutId':layout['id'],'layoutName':label,'roofType':roof['roofType'],'vectorSegments':len(segments),'measurements':[]};report['sheets'].append(sheet)
  def segment(a,b,tolerance=.04):
   found=[(p,q)for p,q in segments if min(math.dist(p,a)+math.dist(q,b),math.dist(p,b)+math.dist(q,a))<=2*tolerance]
   assert found,f'No actual PDF vector {a} -> {b}'
   return found[0]
  def paper(point,view):
   center=view['modelCenter'];delta=[point.get(k,0)-center.get(k,0)for k in ('x','y','z')];frame=view['frame'];scale=25.4/view['scaleDenominator']
   if view['workspace']=='2d':right=[1,0,0];up=[0,1,0]
   else:
    yaw,pitch,roll=[math.radians(view['camera3d'].get(k,0))for k in ('yaw','pitch','roll')];cy,sy,cp,sp,cr,sr=math.cos(yaw),math.sin(yaw),math.cos(pitch),math.sin(pitch),math.cos(roll),math.sin(roll)
    right=[-sy*cr-cy*sp*sr,cy*cr-sy*sp*sr,cp*sr];up=[-cy*sp*cr+sy*sr,-sy*sp*cr-cy*sr,cp*cr]
   x=frame['x']+frame['width']/2+sum(a*b for a,b in zip(delta,right))*scale;y=frame['y']+frame['height']/2+sum(a*b for a,b in zip(delta,up))*scale
   return x,layout['paper']['heightMm']-y
  def page_check():
   assert len(pdf)==1;near(page.rect.width*MM,420,.3);near(page.rect.height*MM,297,.3)
   assert all(v['locked']for v in layout['viewports']);assert 'A3' in page.get_text()
   return {'widthMm':page.rect.width*MM,'heightMm':page.rect.height*MM,'lockedViewports':len(layout['viewports'])}
  check(label+': actual A3 landscape page and locked native scales',page_check)
  for view in layout['viewports']:
   name=f'{label} {view["id"]} 1:{view["scaleDenominator"]}'
   def border_check():
    frame=view['frame'];height=layout['paper']['heightMm'];points=[(frame['x'],height-frame['y']),(frame['x']+frame['width'],height-frame['y']),(frame['x']+frame['width'],height-frame['y']-frame['height']),(frame['x'],height-frame['y']-frame['height'])]
    for a,b in zip(points,points[1:]+points[:1]):segment(a,b)
    return {'frameMm':frame,'scaleDenominator':view['scaleDenominator'],'mmPerModelInch':25.4/view['scaleDenominator']}
   check(name+': exact physical viewport frame without fit scaling',border_check)
   if '0' in view['frozenLayers']:
    def negative_check():
     frame=view['frame'];height=layout['paper']['heightMm'];inside=lambda p:frame['x']+.5<p[0]<frame['x']+frame['width']-.5 and height-frame['y']-frame['height']+.5<p[1]<height-frame['y']-.5
     found=[(a,b)for a,b in segments if inside(a)or inside(b)];assert found==[],f'{len(found)} unexpected frozen interior vectors'
     return {'interiorVectorCount':0,'frozenLayers':view['frozenLayers']}
    check(name+': frozen layer excludes all roof and closure interior vectors',negative_check)
   elif view['workspace']=='2d':
    def plan_check():
     assert not hip,'HIP plan requires a different ridge-span assertion; this bounded audit covers the GABLE plan.'
     lengths=[]
     for a,b in [({'x':0,'y':156,'z':172},{'x':480,'y':156,'z':172}),({'x':0,'y':0,'z':120},{'x':480,'y':0,'z':120}),({'x':0,'y':240,'z':144},{'x':480,'y':240,'z':144})]:
      p,q=segment(paper(a,view),paper(b,view));length=math.dist(p,q);near(length,480*25.4/view['scaleDenominator']);lengths.append(length)
     expected_migration=36*25.4/view['scaleDenominator'];ridge=paper({'x':240,'y':156,'z':172},view);equal=paper({'x':240,'y':120,'z':160},view);near(abs(ridge[1]-equal[1]),expected_migration)
     item={'ridgeAndEaveLengthsMm':lengths,'expected40FeetMm':480*25.4/view['scaleDenominator'],'ridgeMigrationMm':expected_migration,'ridgeYInches':156};sheet['measurements'].append(item);return item
    check(name+': generated 40-foot ridge moves 3 feet toward high bearing at exact scale',plan_check)
   elif hip:
    def step_check():
     assert view['camera3d']['yaw']==-90 and view['camera3d']['pitch']==view['camera3d']['roll']==0
     widths=[];rises=[]
     for x,tip in [(0,72),(480,408)]:
      base={'x':x,'y':240,'z':120};top={'x':x,'y':240,'z':144};inside={'x':tip,'y':240,'z':144}
      a,b=segment(paper(base,view),paper(top,view));rises.append(math.dist(a,b));near(rises[-1],24*25.4/view['scaleDenominator'])
      a,b=segment(paper(top,view),paper(inside,view));widths.append(math.dist(a,b));near(widths[-1],72*25.4/view['scaleDenominator']);segment(paper(base,view),paper(inside,view))
     item={'stepReturnRisesMm':rises,'stepReturnWidthsMm':widths,'stepAreaSquareInches':1728,'proof':'The vertical 24-inch corner return and horizontal 72-inch top are absent from sloping roof-skin edges; zero ordinary objects/walls prove actual generated step closures printed.'};sheet['measurements'].append(item);return item
    check(name+': both generated 24-inch by 72-inch activation-step returns print physically',step_check)
   else:
    def closure_check():
     assert view['camera3d']['yaw']==view['camera3d']['pitch']==view['camera3d']['roll']==0
     low={'x':480,'y':0,'z':120};mid={'x':480,'y':156,'z':120};highbase={'x':480,'y':240,'z':120};high={'x':480,'y':240,'z':144};ridge={'x':480,'y':156,'z':172};widths=[]
     for a,b,expected in [(low,mid,156),(mid,highbase,84)]:
      p,q=segment(paper(a,view),paper(b,view));widths.append(math.dist(p,q));near(widths[-1],expected*25.4/view['scaleDenominator'])
     p,q=segment(paper(mid,view),paper(ridge,view));ridge_rise=math.dist(p,q);near(ridge_rise,52*25.4/view['scaleDenominator'])
     p,q=segment(paper(highbase,view),paper(high,view));high_rise=math.dist(p,q);near(high_rise,24*25.4/view['scaleDenominator'])
     for point in (low,high):segment(paper(point,view),paper(ridge,view))
     item={'closureBasePartsMm':widths,'closureBaseWidthMm':sum(widths),'ridgeRiseAboveDefaultBearingMm':ridge_rise,'highBearingReturnMm':high_rise,'proof':'Default-bearing base, 52-inch center split and 24-inch high-eave return are absent from sloping skin; with no ordinary objects/walls they prove separate generated closure printing.'};sheet['measurements'].append(item);return item
    check(name+': asymmetric gable base, 52-inch rise and 24-inch high-bearing return print accurately',closure_check)
  def raster_check():
   target=output_root/'outputs'/f'Linecraft-Bearing-PDF-{args.label}-{roof["roofType"].lower()}-{layout["id"]}-1.13.0.png';page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(target);assert target.stat().st_size>1000;assert digest(file)==before and digest(native)==native_hash;sheet['raster']=str(target);return {'raster':str(target),'rasterSHA256':digest(target),'sourceFilesUnchanged':True}
  check(label+': read-only raster review and immutable actual native/PDF hashes',raster_check);pdf.close()
 report['completedAt']=datetime.now(timezone.utc).isoformat();report['total']=len(report['tests']);report['passed']=sum(t['status']=='passed'for t in report['tests']);report['failed']=report['total']-report['passed'];target=output_root/'work'/f'bearing-{args.label}-audit-results.json';target.write_text(json.dumps(report,indent=2)+'\n');print(f'{report["passed"]}/{report["total"]} independent R5 actual PDF checks passed');raise SystemExit(1 if report['failed']else 0)

if __name__=='__main__':main()
