"""Independent actual PDF vectors, painted polygon clips and physical page metrics.

PyMuPDF is a test-only reader. Geometry tolerance is0.01 mm, painted clipping
0.16 mm and Chromium page quantization0.3 mm; none is an app dependency.
"""
import hashlib,json,math
from pathlib import Path
from datetime import datetime,timezone
import fitz
root=Path(__file__).resolve().parent.parent;folder=root/'tests/viewport-pdf-v17'
producer=json.loads((root/'tests/viewport-pdf-v17-render-results.json').read_text(encoding='utf-8'))
assert producer['failed']==0 and not producer['sourceChangedDuringRun']
mm=25.4/72;tests=[];documents=[]
def page(name,index=0):
    document=fitz.open(folder/(name+'.pdf'));documents.append(document);return document[index]
def near(actual,expected,tolerance=.01):assert abs(actual-expected)<=tolerance,(actual,expected,tolerance)
def check(name,fn):
    try:tests.append({'name':name,'status':'passed','detail':fn()});print('PASS',name)
    except Exception as error:tests.append({'name':name,'status':'failed','error':repr(error)});print('FAIL',name,repr(error))
def strokes(p,wanted):return [drawing for drawing in p.get_drawings() if drawing['type']=='s' and drawing['color'] and all(abs(a-b)<.002 for a,b in zip(drawing['color'],wanted))]
def lengths(drawings):return [math.dist(tuple(item[1]),tuple(item[2]))*mm for drawing in drawings for item in drawing['items'] if item[0]=='l']
def painted(p):
    raster=p.get_pixmap(matrix=fitz.Matrix(4,4),alpha=False);data=raster.samples;hits={'red':[],'green':[],'orange':[]};step=raster.n
    for i in range(0,len(data),step):
        r,g,b=data[i:i+3];position=(i//step%raster.width,i//step//raster.width)
        if r>110 and g<90 and b<90:hits['red'].append(position)
        if g>70 and g>r*1.4 and g>b*1.4:hits['green'].append(position)
        if r>170 and 70<g<200 and b<60:hits['orange'].append(position)
    result={}
    for name,points in hits.items():
        result[name]={'pixels':len(points),'boundsMm':None if not points else [min(x for x,y in points)*mm/4,min(y for x,y in points)*mm/4,(max(x for x,y in points)+1)*mm/4,(max(y for x,y in points)+1)*mm/4]}
    return result
def sizes():
    observed=[]
    for export in producer['exports']:
        data=(root/export['pdf']).read_bytes();assert hashlib.sha256(data).hexdigest()==export['pdfSHA256'];document=fitz.open(stream=data,filetype='pdf');assert len(document)==len(export['pages'])
        for p in document:
            near(p.rect.width*mm,297,.3);near(p.rect.height*mm,210,.3);assert not p.get_images();observed.append({'file':export['name'],'widthMm':p.rect.width*mm,'heightMm':p.rect.height*mm,'rasterImages':0})
    return observed
check('all actual A4 pages and Publish pages match their declared physical sizes and preserve vectors',sizes)
def scale():
    details=[]
    for name in ['concave','inches']:
        p=page(name);green=strokes(p,(0,170/255,0));blue=strokes(p,(0,0,221/255));assert len(green)==len(blue)==1
        green_length=lengths(green)[0];blue_length=lengths(blue)[0];near(green_length,50);near(blue_length,100);near(green[0]['width']*mm,.25)
        details.append({'fixture':name,'modelRulerMm':green_length,'paperRulerMm':blue_length,'lineweightMm':green[0]['width']*mm})
    return details
check('mm and inch models produce the same 50 mm ruler and independently owned 100 mm paper ruler',scale)
cache={name:painted(page(name)) for name in ['concave','inches','offsheet']}
def concave_clip():
    details=[]
    for name in ['concave','inches']:
        observed=cache[name]['red'];bounds=observed['boundsMm'];assert observed['pixels']>100;near(bounds[0],20,.16);near(bounds[2],90,.16);near(bounds[2]-bounds[0],70,.16);details.append({'fixture':name,**observed})
    return details
check('painted red paths stop at the concave 70 mm leg rather than crossing the AABB notch',concave_clip)
def notch():
    details=[]
    for name in ['concave','inches']:
        assert cache[name]['orange']['pixels']==0;details.append({'fixture':name,'orangeNotchPixels':0})
    return details
check('a complete orange model circle in the polygon notch paints zero pixels',notch)
def offsheet():
    observed=cache['offsheet']['red'];bounds=observed['boundsMm'];assert observed['pixels']>100;near(bounds[0],250,.16);near(bounds[2],297,.16);near(bounds[2]-bounds[0],47,.16);return observed
check('off-sheet viewport clipping leaves exactly 47 mm between its 250 mm edge and the 297 mm page edge',offsheet)
def publish():
    first=page('mixed',0);second=page('mixed',1);assert 'MM polygon' in first.get_text() and 'IN polygon' not in first.get_text();assert 'IN polygon' in second.get_text() and 'MM polygon' not in second.get_text()
    detail=[]
    for index,p in enumerate([first,second]):
        observed=painted(p);assert observed['orange']['pixels']==0;bounds=observed['red']['boundsMm'];near(bounds[2]-bounds[0],70,.16);near(lengths(strokes(p,(0,170/255,0)))[0],50);detail.append({'page':index+1,'redBoundsMm':bounds,'orangeNotchPixels':0})
    return detail
check('Publish page order and polygon clipping survive on both unit-equivalent sheets',publish)
def border():
    p=page('border');wanted=(136/255,68/255,170/255);paths=[item for item in p.get_drawings() if item['type']=='f' and item['fill'] and all(abs(a-b)<.002 for a,b in zip(item['fill'],wanted))];assert len(paths)==1
    # Chromium emits dashed SVG strokes as filled vector dash outlines. Measure
    # two actual consecutive horizontal dash rectangles, not an SVG attribute.
    items=paths[0]['items'];assert len(items)>8;assert all(item[0]=='l' for item in items[:8]);first=items[:4];second=items[4:8]
    near(first[0][1].y,first[0][2].y);near(first[1][1].x,first[1][2].x);near(first[3][2].x,first[0][1].x);near(first[3][2].y,first[0][1].y)
    dash=math.dist(tuple(first[0][1]),tuple(first[0][2]))*mm;weight=math.dist(tuple(first[1][1]),tuple(first[1][2]))*mm;gap=(second[0][1].x-first[0][2].x)*mm;near(dash,2);near(weight,.7);near(gap,1)
    return {'lineweightMm':weight,'dashLengthMm':dash,'gapMm':gap,'rgb':[136,68,170],'representation':'Filled vector dash outlines emitted by Chromium, no raster images.'}
check('per-viewport border color, 0.7 mm weight and 2/1 mm dash pattern survive actual PDF vector output',border)
for name in ['concave','inches','offsheet']:
    page(name).get_pixmap(matrix=fitz.Matrix(2,2),alpha=False).save(folder/(name+'.png'))
report={'framework':'Independent PyMuPDF semantic/vector and painted-output audit of actual production Chromium PDFs','completedAt':datetime.now(timezone.utc).isoformat(),'producerSHA256':hashlib.sha256((root/'tests/viewport-pdf-v17-render-results.json').read_bytes()).hexdigest(),'tolerancesMm':{'geometry':.01,'paintedClip':.16,'pageQuantization':.3},'passed':sum(t['status']=='passed' for t in tests),'failed':sum(t['status']=='failed' for t in tests),'total':len(tests),'tests':tests}
(root/'tests/viewport-pdf-v17-audit-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(f"{report['passed']}/{report['total']} PDF audits passed");raise SystemExit(1 if report['failed'] else 0)
