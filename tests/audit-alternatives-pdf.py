"""Read-only R6 actual PDF audit. No Linecraft geometry, quantity or plot imports.
The original 40x20-foot synthetic source supplies independent analytical expectations.
"""
from __future__ import annotations
import argparse,hashlib,json,math,re,subprocess,shutil
from pathlib import Path
from datetime import datetime,timezone
import fitz
MM=25.4/72
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def near(a,b,t=.04):assert abs(a-b)<=t,f'{a} != {b}, tolerance {t}'
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--report',required=True,type=Path);p.add_argument('--label',required=True);p.add_argument('--output-root',type=Path,default=Path.cwd());a=p.parse_args();assert re.fullmatch('[A-Za-z0-9-]+',a.label)
 original=json.loads(a.report.read_text(encoding='utf-8-sig'));assert original['failed']==0
 native=Path(original['outputs']['native']);raw=json.loads(native.read_text(encoding='utf-8-sig'));native_sha=sha(native);arch=raw['architecture'];room=arch['rooms'][0];roof=arch['roofGroups'][0]
 out=a.output_root.resolve();(out/'work').mkdir(parents=True,exist_ok=True);(out/'outputs').mkdir(parents=True,exist_ok=True)
 result={'framework':'Independent actual R6 PDF physical-scale, fixed roof and printed quantity audit','label':a.label,'startedAt':datetime.now(timezone.utc).isoformat(),'native':str(native),'nativeSHA256':native_sha,'scope':'Read-only actual saved source and actual Electron PDFs; independent elementary rectangle, plane intersection and profile integrals. No Linecraft modules imported. Framing remains unverified.','tests':[],'sheets':[]}
 def check(name,fn):
  try:result['tests'].append({'name':name,'status':'passed',**(fn()or{})});print('PASS '+name)
  except Exception as e:result['tests'].append({'name':name,'status':'failed','error':repr(e)});print('FAIL '+name+': '+str(e))
 area=480*240;floor=room['floorElevation'];target=room['targetCeilingElevation'];base=room['ceilingElevation'];tray=room['trayCeiling'];plateau=(tray['max']['x']-tray['min']['x'])*(tray['max']['y']-tray['min']['y'])if tray else 0;raised=tray['raisedElevation']if tray else base
 usable=(area-plateau)*(base-floor)+plateau*(raised-floor);benefit=(area-plateau)*min(base-floor,target-floor)+plateau*min(raised-floor,target-floor)
 pitch=roof['riseTwice']/24;low=arch['walls'][0]['bearingElevation'];high=arch['walls'][2]['bearingElevation'];ridge_y=120+(high-low)/(2*pitch);ridge_z=(low+high+240*pitch)/2;skin=area*math.sqrt(1+pitch*pitch)
 def source_check():
  assert arch['schemaVersion']==6 and re.fullmatch('r6-[a-f0-9]{16}',arch['acceptedAlternativeId'])
  assert raw['settings']['units']=='in';assert len(arch['rooms'])==1 and len(arch['walls'])==4 and len(arch['roofGroups'])==1
  assert {(n['x'],n['y'])for n in arch['wallNodes']}=={(0,0),(480,0),(480,240),(0,240)}
  assert roof['roofType']=='GABLE' and roof['boundarySource']=='walls';assert roof['overhang']==roof['rakeOverhang']==roof['heelOffset']==0 and roof['eaveElevation']is None
  assert [w['bearingElevation']for w in arch['walls']]==[120,120,144,120],'Fixed-roof acceptance must retain all source bearings.'
  assert roof['riseTwice']==8 and roof['bearingElevation']==120;assert room['ceilingFinishThickness']==0 and floor==0 and target==144
  assert arch['assemblies'][0]['layers']==[] and len(arch['assemblies'][0]['reservations'])==1
  assert arch['costAssumptions']=={'prefabricatedTrussDesignSurcharge':0,'manufacturingComplexitySurcharge':0}
  assert all(not e['id'].startswith('@architecture/')for e in raw['entities']);assert not any(k in arch for k in ('derived','faces','alternatives','metrics'))
  near(ridge_y,156,1e-9);near(ridge_z,172,1e-9)
  return{'modelUnits':'in','roomAreaFt2':area/144,'ceilingBaseInches':base,'ceilingRaisedInches':raised,'targetInches':target,'bearingInches':[low,high],'usableVolumeFt3':usable/1728,'targetCappedBenefitFt3':benefit/1728,'roofSkinFt2':skin/144,'nativeSourceOnly':True,'retainedReservations':1}
 check('Actual saved schema6 source preserves fixed roof, independent ceiling, reservations and zero surcharges',source_check)
 for job in original['outputs']['pdfs']:
  file=Path(job['path']);digest=sha(file);doc=fitz.open(file);page=doc[0];layout=next(l for l in raw['layouts']if l['id']==job['layoutId']);label=layout['name'];text=page.get_text();joined=' '.join(text.split());segments=[]
  for drawing in page.get_drawings():
   if drawing['type']not in ('s','fs'):continue
   for item in drawing['items']:
    if item[0]=='l':segments.append((tuple(v*MM for v in item[1]),tuple(v*MM for v in item[2])))
    elif item[0]=='re':
     r=item[1];pts=[tuple(v*MM for v in q)for q in (r.tl,r.tr,r.br,r.bl)];segments.extend(zip(pts,pts[1:]+pts[:1]))
  sheet={'pdf':str(file),'pdfSHA256':digest,'layoutId':layout['id'],'layoutName':label,'vectorSegments':len(segments)};result['sheets'].append(sheet)
  def segment(x,y):
   found=[(u,v)for u,v in segments if min(math.dist(u,x)+math.dist(v,y),math.dist(u,y)+math.dist(v,x))<=.08];assert found,f'Missing actual vector {x} -> {y}';return found[0]
  def paper(point,v):
   delta=[point.get(k,0)-v['modelCenter'].get(k,0)for k in ('x','y','z')];f=v['frame'];scale=25.4/v['scaleDenominator']
   if v['workspace']=='2d':right=[1,0,0];up=[0,1,0]
   else:
    yaw,angle,roll=[math.radians(v['camera3d'].get(k,0))for k in ('yaw','pitch','roll')];cy,sy,cp,sp,cr,sr=math.cos(yaw),math.sin(yaw),math.cos(angle),math.sin(angle),math.cos(roll),math.sin(roll);right=[-sy*cr-cy*sp*sr,cy*cr-sy*sp*sr,cp*sr];up=[-cy*sp*cr+sy*sr,-sy*sp*cr-cy*sr,cp*cr]
   return f['x']+f['width']/2+sum(x*y for x,y in zip(delta,right))*scale,layout['paper']['heightMm']-(f['y']+f['height']/2+sum(x*y for x,y in zip(delta,up))*scale)
  def page_check():
   assert len(doc)==1;near(page.rect.width*MM,420,.3);near(page.rect.height*MM,297,.3);assert 'A3'in text
   assert all(v['locked']for v in layout['viewports']);return{'widthMm':page.rect.width*MM,'heightMm':page.rect.height*MM,'lockedScaleDenominators':[v['scaleDenominator']for v in layout['viewports']]}
  check(label+': actual A3 page and locked native scale declarations',page_check)
  for v in layout['viewports']:
   name=label+f' 1:{v["scaleDenominator"]}'
   def frame_check():
    f=v['frame'];h=297;pts=[(f['x'],h-f['y']),(f['x']+f['width'],h-f['y']),(f['x']+f['width'],h-f['y']-f['height']),(f['x'],h-f['y']-f['height'])]
    for x,y in zip(pts,pts[1:]+pts[:1]):segment(x,y)
    return{'frameMm':f,'scaleDenominator':v['scaleDenominator']}
   check(name+': physical viewport frame retains exact size',frame_check)
   if v['workspace']=='2d':
    def plan_check():
     lengths=[]
     for y,z in [(0,low),(ridge_y,ridge_z),(240,high)]:
      u,w=segment(paper({'x':0,'y':y,'z':z},v),paper({'x':480,'y':y,'z':z},v));lengths.append(math.dist(u,w));near(lengths[-1],480*25.4/v['scaleDenominator'])
     return{'ridgeAndEaveLengthsMm':lengths,'expected40FootLengthMm':480*25.4/v['scaleDenominator']}
    check(name+': generated 40-foot roof ridge and both eaves print at exact physical scale',plan_check)
   else:
    def closure_check():
     assert v['camera3d']['yaw']==v['camera3d']['pitch']==v['camera3d']['roll']==0
     pts={'low':{'x':480,'y':0,'z':low},'split':{'x':480,'y':ridge_y,'z':low},'base':{'x':480,'y':240,'z':low},'high':{'x':480,'y':240,'z':high},'ridge':{'x':480,'y':ridge_y,'z':ridge_z}}
     lengths={}
     for x,y,d in [('low','split',ridge_y),('split','base',240-ridge_y),('split','ridge',ridge_z-low),('base','high',high-low)]:
      u,w=segment(paper(pts[x],v),paper(pts[y],v));near(math.dist(u,w),d*25.4/v['scaleDenominator']);lengths[x+'-'+y]=math.dist(u,w)
     segment(paper(pts['low'],v),paper(pts['ridge'],v));segment(paper(pts['high'],v),paper(pts['ridge'],v));return{'generatedClosurePartsMm':lengths,'ridgeYInches':ridge_y,'ridgeElevationInches':ridge_z}
    check(name+': generated asymmetric gable closure base and independent bearing returns print',closure_check)
  if not layout['viewports']:
   def report_check():
    for fragment in ('R6 MATHEMATICAL ALTERNATIVE',arch['acceptedAlternativeId'],'framing UNVERIFIED','prices and total cost','surcharge = 0','step interface length not quantified'):
     assert fragment in joined,f'Missing printed confidence/value: {fragment}'
    for value in (f'{benefit/1728:.2f}',f'{usable/1728:.2f}',f'{skin/144:.2f}'):
     assert value in joined,f'Independent quantity {value} absent from actual report PDF'
    declared=original['outputs'].get('configurationReportLines',[])
    for line in declared:assert ' '.join(line.split())in joined,'Reviewed text missing from actual PDF: '+line
    for block in page.get_text('dict')['blocks']:
     if 'lines'not in block:continue
     for line in block['lines']:
      for span in line['spans']:
       x0,y0,x1,y1=span['bbox'];assert x0>=0 and y0>=0 and x1<=page.rect.width+.1 and y1<=page.rect.height+.1,'Actual report text clipped off page'
    return{'independentCappedBenefitFt3':benefit/1728,'independentUsableVolumeFt3':usable/1728,'independentRoofSkinFt2':skin/144,'printedReceipt':arch['acceptedAlternativeId'],'fullExpectedLines':len(declared),'textWithinPage':True}
   check(label+': actual report quantities match independent profile integral and partial-confidence labels',report_check)
  def render_check():
   stem=out/'outputs'/f'Linecraft-R6-PDF-{a.label}-{layout["id"]}-1.14.0';poppler=shutil.which('pdftoppm');renderer='Poppler pdftoppm'
   if poppler:subprocess.run([poppler,'-f','1','-singlefile','-scale-to','1800','-png',str(file),str(stem)],check=True,capture_output=True);raster=Path(str(stem)+'.png')
   else:renderer='PyMuPDF fallback';raster=Path(str(stem)+'.png');page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(raster)
   assert raster.stat().st_size>1000;assert sha(file)==digest and sha(native)==native_sha;sheet['raster']=str(raster);return{'raster':str(raster),'rasterSHA256':sha(raster),'renderer':renderer,'nativeAndPDFUnchanged':True}
  check(label+': read-only raster and unchanged native/PDF hashes',render_check);doc.close()
 result['completedAt']=datetime.now(timezone.utc).isoformat();result['total']=len(result['tests']);result['passed']=sum(t['status']=='passed'for t in result['tests']);result['failed']=result['total']-result['passed'];dest=out/'work'/f'alternatives-{a.label}-audit-results.json';dest.write_text(json.dumps(result,indent=2)+'\n');print(f'{result["passed"]}/{result["total"]} actual R6 PDF checks passed');raise SystemExit(bool(result['failed']))
if __name__=='__main__':main()
