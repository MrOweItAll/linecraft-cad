"""Independent physical vector positions and plain labels in real Chromium PDFs."""
import json,hashlib,math
from pathlib import Path
from datetime import datetime,timezone
import fitz
root=Path(__file__).resolve().parent.parent;folder=root/'tests/viewport-scales-pdf-v18';producer=json.loads((root/'tests/viewport-scales-pdf-v18-render-results.json').read_text(encoding='utf8'));assert producer['failed']==0 and not producer['sourceChangedDuringRun']
mm=25.4/72;tests=[]
expected=[{'label':'1/8" = 1\'-0"','x':[66.9,143.1],'y':60,'length':76.2},{'label':'1/4" = 1\'-0"','x':[228.8,381.2],'y':60,'length':152.4},{'label':'1/16" = 1\'-0"','x':[85.95,124.05],'y':200,'length':38.1},{'label':'3/32" = 1\'-0"','x':[276.425,333.575],'y':200,'length':57.15}]
def near(actual,wanted,tolerance=.01):assert abs(actual-wanted)<=tolerance,(actual,wanted,tolerance)
def check(name,fn):
 try:tests.append({'name':name,'status':'passed','detail':fn()});print('PASS',name)
 except Exception as error:tests.append({'name':name,'status':'failed','error':repr(error)});print('FAIL',name,repr(error))
def audit_page(page,unit):
 near(page.rect.width*mm,420,.3);near(page.rect.height*mm,297,.3);assert not page.get_images();text=page.get_text();assert all(f'{unit} | {scale["label"]}' in text for scale in expected),(unit,text)
 lines=[]
 for drawing in page.get_drawings():
  if drawing['type']=='s' and drawing['color'] and max(drawing['color'])<.01:
   for item in drawing['items']:
    if item[0]=='l':lines.append({'x':sorted([item[1].x*mm,item[2].x*mm]),'y':(item[1].y+item[2].y)*mm/2,'length':math.dist(tuple(item[1]),tuple(item[2]))*mm,'weight':drawing['width']*mm})
 assert len(lines)==4,(unit,lines);result=[]
 for scale in expected:
  candidates=sorted(lines,key=lambda line:abs(line['x'][0]-scale['x'][0])+abs(line['length']-scale['length']));actual=candidates[0];near(actual['x'][0],scale['x'][0]);near(actual['x'][1],scale['x'][1]);near(actual['y'],297-scale['y']);near(actual['length'],scale['length']);near(actual['weight'],.25);result.append({'label':scale['label'],**actual})
 return {'unit':unit,'paperMm':[page.rect.width*mm,page.rect.height*mm],'vectors':result,'searchableLabels':True,'rasterImages':0}
for unit in ['in','ft','mm','m']:
 def single(unit=unit):
  metadata=next(item for item in producer['exports'] if item['name']==unit);data=(root/metadata['pdf']).read_bytes();assert hashlib.sha256(data).hexdigest()==metadata['pdfSHA256'];document=fitz.open(stream=data,filetype='pdf');assert len(document)==1;detail=audit_page(document[0],unit);document[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(folder/f'{unit}.png');return detail
 check(f'actual {unit} PDF contains four correctly positioned physical architectural rulers and labels',single)
def publish():
 metadata=next(item for item in producer['exports'] if item['name']=='all-units');data=(root/metadata['pdf']).read_bytes();assert hashlib.sha256(data).hexdigest()==metadata['pdfSHA256'];document=fitz.open(stream=data,filetype='pdf');assert len(document)==4;return[audit_page(page,unit) for page,unit in zip(document,['in','ft','mm','m'])]
check('actual Publish preserves all four unit pages and all sixteen physical scale placements',publish)
report={'framework':'Independent PyMuPDF architectural viewport ruler, page and label audit','completedAt':datetime.now(timezone.utc).isoformat(),'producerSHA256':hashlib.sha256((root/'tests/viewport-scales-pdf-v18-render-results.json').read_bytes()).hexdigest(),'tolerancesMm':{'geometry':.01,'pageQuantization':.3},'passed':sum(test['status']=='passed' for test in tests),'failed':sum(test['status']=='failed' for test in tests),'total':len(tests),'tests':tests};(root/'tests/viewport-scales-pdf-v18-audit-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(f'{report["passed"]}/{report["total"]} scale PDF audits passed');raise SystemExit(bool(report['failed']))
