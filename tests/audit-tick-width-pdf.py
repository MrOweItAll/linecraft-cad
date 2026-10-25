"""Independent actual-PDF tick coverage, perpendicular width and legacy audit."""
import argparse, hashlib, json, math
from datetime import datetime, timezone
from pathlib import Path
import fitz

parser=argparse.ArgumentParser()
parser.add_argument('--mode',choices=['legacy','explicit','cleared'],required=True)
for name in ['producer','receipt','render']:parser.add_argument('--'+name,type=Path,required=True)
args=parser.parse_args();assert not args.receipt.exists() and not args.render.exists()
sha=lambda file:hashlib.sha256(file.read_bytes()).hexdigest()
producer=json.loads(args.producer.read_text());binding=producer['outputs'][args.mode];native=Path(binding['native']);pdf_file=Path(binding['pdf'])
report={'format':'LinecraftIndependentTickWidthPDF/1','status':'running','startedAt':datetime.now(timezone.utc).isoformat(),'mode':args.mode,'scope':'Actual app-saved native/PDF; independent literal centerlines, filled coverage and physical width. No producer geometry imported.','tolerancesMm':{'endpointCombinedDistance':.04,'length':.02,'width':.005,'page':.3},'bindings':{'producer':{'file':str(args.producer),'sha256':sha(args.producer)},'native':{'file':str(native),'sha256':sha(native)},'pdf':{'file':str(pdf_file),'sha256':sha(pdf_file)}},'measurements':[]}
MM=25.4/72
def near(actual,expected,tolerance):assert math.isfinite(actual) and abs(actual-expected)<=tolerance,(actual,expected,tolerance)
def point(p):return tuple(v*MM for v in p)
def same(a,b):return math.dist(a,b)<1e-6
def polygon_area(vertices):return abs(sum(a[0]*b[1]-b[0]*a[1]for a,b in zip(vertices,vertices[1:]+vertices[:1])))/2
def polygons(drawing):
    result=[];current=[]
    def finish():
        nonlocal current
        if current:
            if len(current)>1 and same(current[0],current[-1]):current.pop()
            assert len(current)in [3,4],('Unexpected filled subpath',current)
            result.append(current);current=[]
    for item in drawing['items']:
        if item[0]=='l':
            a,b=point(item[1]),point(item[2])
            if current and not same(current[-1],a):finish()
            if not current:current=[a]
            current.append(b)
        elif item[0]=='re':
            finish();r=item[1];result.append([(r.x0*MM,r.y0*MM),(r.x1*MM,r.y0*MM),(r.x1*MM,r.y1*MM),(r.x0*MM,r.y1*MM)])
        elif item[0]=='qu':
            finish();q=item[1];result.append([point(q.ul),point(q.ur),point(q.lr),point(q.ll)])
        else:raise AssertionError(('Unexpected filled curve',item[0]))
    finish();return result
def stroke(strokes,start,end,length,width):
    matches=[row for row in strokes if min(math.dist(row['a'],start)+math.dist(row['b'],end),math.dist(row['a'],end)+math.dist(row['b'],start))<.04]
    assert len(matches)==1,(start,end,len(matches));row=matches[0];near(math.dist(row['a'],row['b']),length,.02);near(row['widthMm'],width,.005);return row
def tick(fills,start,end,width):
    dx,dy=end[0]-start[0],end[1]-start[1];length=math.hypot(dx,dy);nx,ny=-dy/length,dx/length
    corners=[(start[0]+nx*width/2,start[1]+ny*width/2),(end[0]+nx*width/2,end[1]+ny*width/2),(end[0]-nx*width/2,end[1]-ny*width/2),(start[0]-nx*width/2,start[1]-ny*width/2)]
    selected=[];mapped=[];corner_samples=[[]for _ in range(4)]
    for index,poly in enumerate(fills):
        assignments=[min(range(4),key=lambda i:math.dist(vertex,corners[i]))for vertex in poly]
        if all(math.dist(vertex,corners[i])<.02 for vertex,i in zip(poly,assignments)):
            assert len(set(assignments))==len(assignments);selected.append(index);mapped.append(assignments)
            for vertex,i in zip(poly,assignments):corner_samples[i].append(vertex)
    assert len(selected)in [1,2],('Incomplete/duplicate tick ink',start,end,selected)
    if len(selected)==1:assert len(mapped[0])==4
    else:
        assert all(len(indices)==3 for indices in mapped)
        shared=set(mapped[0])&set(mapped[1]);assert shared in [{0,2},{1,3}],('Triangles must share a diagonal',mapped)
        assert set(mapped[0])|set(mapped[1])==set(range(4))
    assert all(corner_samples)
    actual=[tuple(sum(p[axis]for p in samples)/len(samples)for axis in [0,1])for samples in corner_samples]
    a=tuple((actual[0][i]+actual[3][i])/2 for i in [0,1]);b=tuple((actual[1][i]+actual[2][i])/2 for i in [0,1])
    assert min(math.dist(a,start)+math.dist(b,end),math.dist(a,end)+math.dist(b,start))<.04
    near(math.dist(a,b),length,.02)
    # End caps must span the requested perpendicular width, not merely a bounding box.
    center_vector=((b[0]-a[0])/math.dist(a,b),(b[1]-a[1])/math.dist(a,b));normal=(-center_vector[1],center_vector[0])
    measured=[]
    for left,right in [(actual[0],actual[3]),(actual[1],actual[2])]:
        vector=(left[0]-right[0],left[1]-right[1]);perpendicular=abs(vector[0]*normal[0]+vector[1]*normal[1]);parallel=abs(vector[0]*center_vector[0]+vector[1]*center_vector[1]);near(perpendicular,width,.005);near(parallel,0,.005);measured.append(perpendicular)
    actual_area=sum(polygon_area(fills[index])for index in selected);near(actual_area,width*length,.005)
    return {'a':a,'b':b,'centerlineLengthMm':math.dist(a,b),'perpendicularWidthMm':sum(measured)/2,'filledAreaMm2':actual_area,'filledPathIndices':selected,'coverage':'complete quadrilateral; paired triangles share one diagonal'if len(selected)==2 else'complete quadrilateral path'}

try:
    assert producer['status']=='passed' and producer['sourceUnchanged'];assert sha(native)==binding['nativeSHA256'] and sha(pdf_file)==binding['pdfSHA256']
    document=json.loads(native.read_text());entity=document['entities'][0];style=next(row for row in document['dimStyles']if row['name']==entity['style'])
    assert entity['p1']=={'x':0,'y':0} and entity['p2']=={'x':1000,'y':0} and entity['placement']=={'x':500,'y':200} and entity['axisAngle']==0 and entity['lineweight']==.1 and entity['scale']==1
    for key,value in {'arrowType':'architectural-tick','arrowSize':25,'textHeight':40,'gap':20,'extensionOffset':10,'extensionOvershoot':30,'scale':1}.items():assert style[key]==value
    if args.mode=='explicit':assert style['tickWidth']==12
    else:assert'tickWidth'not in style
    assert document['settings']['units']=='mm' and len(document['entities'])==1 and len(document['layouts'])==1
    for viewport,x,denominator in zip(document['layouts'][0]['viewports'],[20,220],[50,100]):assert viewport['frame']=={'x':x,'y':30,'width':160,'height':100} and viewport['modelCenter']=={'x':500,'y':200,'z':0} and viewport['scaleDenominator']==denominator and viewport['locked']is True and viewport['plotBorder']is False
    pdf=fitz.open(pdf_file);assert len(pdf)==1;page=pdf[0];near(page.rect.width*MM,420,.3);near(page.rect.height*MM,297,.3);assert not page.get_images()
    strokes=[];fills=[];page_backgrounds=[]
    for drawing in page.get_drawings():
        if drawing['type']in ['s','fs']:
            for item in drawing['items']:
                if item[0]=='l':strokes.append({'a':point(item[1]),'b':point(item[2]),'widthMm':drawing['width']*MM})
        if drawing['type']in ['f','fs']:
            assert drawing['fill']
            if min(drawing['fill'])>.99:
                # Independently observed Chromium page backgrounds are white,
                # single full-page rectangles. No arbitrary white mask is ignored.
                assert drawing['type']=='f' and len(drawing['items'])==1 and drawing['items'][0][0]=='re'
                bounds=tuple(value*MM for value in drawing['rect'])
                for actual,expected in zip(bounds,[0,0,420,297]):near(actual,expected,.3)
                page_backgrounds.append(bounds)
            else:
                assert max(drawing['fill'])<.01,('Unexpected colored fill',drawing['fill'])
                fills.extend(polygons(drawing))
    report['whiteFullPageBackgrounds']=page_backgrounds
    body=[(50,'extension-left',(90,220.8),(90,216.4),4.4),(50,'extension-right',(110,220.8),(110,216.4),4.4),(50,'dimension',(90,217),(110,217),20),(100,'extension-left',(295,218.9),(295,216.7),2.2),(100,'extension-right',(305,218.9),(305,216.7),2.2),(100,'dimension',(295,217),(305,217),10)]
    ticks=[(50,'tick-left',(89.5,217.5),(90.5,216.5),math.sqrt(2),.24),(50,'tick-right',(110.5,216.5),(109.5,217.5),math.sqrt(2),.24),(100,'tick-left',(294.75,217.25),(295.25,216.75),math.sqrt(.5),.12),(100,'tick-right',(305.25,216.75),(304.75,217.25),math.sqrt(.5),.12)]
    for denominator,role,start,end,length in body:report['measurements'].append({'denominator':denominator,'role':role,**stroke(strokes,start,end,length,.1)})
    if args.mode=='explicit':
        assert len(strokes)==6,len(strokes);used=[]
        for denominator,role,start,end,length,width in ticks:
            result=tick(fills,start,end,width);used.extend(result['filledPathIndices']);report['measurements'].append({'denominator':denominator,'role':role,'expectedWidthMm':width,**result})
        assert sorted(used)==list(range(len(fills))),'Every filled path must belong to one expected tick'
        first=tick(fills,ticks[0][2],ticks[0][3],.24);omitted=first['filledPathIndices'][0]
        probes=[lambda:tick([poly for i,poly in enumerate(fills)if i!=omitted],ticks[0][2],ticks[0][3],.24),lambda:tick(fills,ticks[2][2],ticks[2][3],.24),lambda:tick(fills,ticks[0][2],ticks[0][3],.1),lambda:stroke(strokes,(90,217),(110,217),20,.24)]
        report['negativeControls']=['missing/partial tick ink','fixed paper width at1:100','inherited body width on tick','tick width leaking into ordinary dimension line']
    else:
        assert not fills and len(strokes)==10
        for denominator,role,start,end,length,_ in ticks:report['measurements'].append({'denominator':denominator,'role':role,**stroke(strokes,start,end,length,.1)})
        probes=[lambda:stroke(strokes,ticks[0][2],ticks[0][3],math.sqrt(2),.24),lambda:stroke(strokes,ticks[0][2],ticks[0][3],math.sqrt(.5),.1)]
        report['negativeControls']=['explicit width incorrectly used for legacy tick','wrong legacy tick length']
    for probe in probes:
        try:probe()
        except AssertionError:pass
        else:raise AssertionError('Independent negative control incorrectly accepted')
    page.get_pixmap(matrix=fitz.Matrix(3,3),alpha=False).save(args.render);report['render']={'file':str(args.render),'sha256':sha(args.render)}
    for binding in report['bindings'].values():assert sha(Path(binding['file']))==binding['sha256']
    report['status']='passed'
except Exception as error:report['status']='failed';report['error']=repr(error);raise
finally:
    report['completedAt']=datetime.now(timezone.utc).isoformat();report['auditor']={'file':str(Path(__file__)),'sha256':sha(Path(__file__))}
    with args.receipt.open('x',encoding='utf8')as output:output.write(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'mode':args.mode,'measurements':len(report['measurements']),'receipt':str(args.receipt)}))
