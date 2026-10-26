"""Independent literal paper SOLID PDF audit; never imports application geometry."""
import argparse
import copy
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import fitz

MM = 25.4 / 72
RECTANGLE = [(20.0, 247.0), (60.0, 247.0), (60.0, 267.0), (20.0, 267.0)]
SENTINEL = [(10.0, 287.0), (20.0, 287.0)]
LENGTH_TOLERANCE = .02
ENDPOINT_TOLERANCE = .04
# Bound derived from the independently declared width/height tolerances.
AREA_TOLERANCE = LENGTH_TOLERANCE * (40 + 20) + LENGTH_TOLERANCE**2


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def near(actual, expected, tolerance):
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected, tolerance)


def point(raw):
    return tuple(value * MM for value in raw)


def same(a, b):
    return math.dist(a, b) < 1e-6


def area(vertices):
    return abs(sum(a[0]*b[1] - b[0]*a[1] for a,b in zip(vertices, vertices[1:] + vertices[:1]))) / 2


def opaque(value, label):
    assert isinstance(value, (int,float)) and not isinstance(value, bool) and math.isfinite(value) and value == 1, (label, value)


def black(color, label):
    assert isinstance(color, (tuple,list)) and color, (label, color)
    assert all(isinstance(value, (int,float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1 for value in color), (label, color)
    assert max(color) < .01, (label, color)


def polygons(drawing):
    result, current = [], []

    def finish():
        nonlocal current
        if current:
            if len(current) > 1 and same(current[0], current[-1]):
                current.pop()
            assert len(current) in [3,4], ('Unexpected filled subpath', current)
            result.append(current)
            current = []

    for item in drawing['items']:
        if item[0] == 'l':
            a, b = point(item[1]), point(item[2])
            if current and not same(current[-1], a):
                finish()
            if not current:
                current = [a]
            current.append(b)
        elif item[0] == 're':
            finish()
            r = item[1]
            result.append([(r.x0*MM,r.y0*MM),(r.x1*MM,r.y0*MM),(r.x1*MM,r.y1*MM),(r.x0*MM,r.y1*MM)])
        elif item[0] == 'qu':
            finish()
            q = item[1]
            result.append([point(q.ul),point(q.ur),point(q.lr),point(q.ll)])
        else:
            raise AssertionError(('Unsupported filled operator', item[0]))
    finish()
    return result


def classify(drawings, enforce_paint=True):
    strokes, fills, proof = [], [], []
    foreground, previous_sequence = False, -1
    for index, drawing in enumerate(drawings):
        kind, sequence = drawing['type'], drawing.get('seqno')
        if enforce_paint:
            assert kind in ['s','f','fs'], ('Unsupported paint record', kind)
            assert isinstance(sequence,int) and not isinstance(sequence,bool) and sequence > previous_sequence, ('Unknown or unordered paint sequence', sequence)
            previous_sequence = sequence
        row = {'index':index, 'seqno':sequence, 'type':kind}
        if kind in ['s','fs']:
            if enforce_paint:
                opaque(drawing.get('stroke_opacity'), 'Unknown or nonopaque stroke')
                black(drawing.get('color'), 'Stroke is not black')
                assert isinstance(drawing.get('dashes'),str) and re.fullmatch(r'\[\s*\]\s*[+-]?0(?:\.0*)?',drawing['dashes'].strip()), ('Stroke is not solid', drawing.get('dashes'))
                assert drawing['items'] and all(item[0]=='l' for item in drawing['items']), ('Unsupported stroke operator', drawing['items'])
            foreground = True
            row.update({'foreground':True,'strokeOpacity':drawing.get('stroke_opacity'),'strokeColor':drawing.get('color')})
            for item in drawing['items']:
                if item[0] == 'l':
                    strokes.append({'a':point(item[1]),'b':point(item[2]),'widthMm':drawing['width']*MM})
        if kind in ['f','fs']:
            assert drawing.get('fill'), 'Missing fill color'
            if enforce_paint:
                opaque(drawing.get('fill_opacity'), 'Unknown or nonopaque fill')
            if min(drawing['fill']) > .99:
                assert kind == 'f' and len(drawing['items']) == 1 and drawing['items'][0][0] == 're', 'Only a full-page white background may be ignored'
                bounds = tuple(value*MM for value in drawing['rect'])
                for actual, expected in zip(bounds, [0,0,420,297]):
                    near(actual, expected, .3)
                if enforce_paint:
                    assert not foreground, ('White cover follows foreground ink', sequence)
                row.update({'whitePageBackground':True,'beforeForeground':not foreground,'fillOpacity':drawing.get('fill_opacity')})
            else:
                if enforce_paint:
                    black(drawing['fill'], 'Fill is not black')
                foreground = True
                row.update({'foreground':True,'fillOpacity':drawing.get('fill_opacity'),'fillColor':drawing['fill']})
                fills.extend(polygons(drawing))
        proof.append(row)
    return strokes, fills, proof


def validate(strokes, fills):
    assert len(strokes) == 1, ('Unexpected or missing sentinel strokes', len(strokes))
    sentinel = strokes[0]
    assert min(math.dist(sentinel['a'],SENTINEL[0])+math.dist(sentinel['b'],SENTINEL[1]),
               math.dist(sentinel['a'],SENTINEL[1])+math.dist(sentinel['b'],SENTINEL[0])) < ENDPOINT_TOLERANCE
    near(math.dist(sentinel['a'],sentinel['b']), 10, LENGTH_TOLERANCE)
    near(sentinel['widthMm'], .2, .005)
    assert len(fills) in [1,2], ('Missing, extra or incomplete paper fill', len(fills))
    assignments, samples = [], [[] for _ in RECTANGLE]
    for poly in fills:
        mapped = [min(range(4),key=lambda index:math.dist(vertex,RECTANGLE[index])) for vertex in poly]
        assert len(set(mapped)) == len(mapped)
        for vertex, index in zip(poly,mapped):
            assert math.dist(vertex,RECTANGLE[index]) < ENDPOINT_TOLERANCE/2, ('Shifted or wrong-sized fill', vertex, RECTANGLE[index])
            samples[index].append(vertex)
        assignments.append(mapped)
    if len(fills) == 1:
        assert len(assignments[0]) == 4
        # A bow-tie must not be accepted as a filled rectangle with the same bounds.
        order = assignments[0]
        assert all((order[(index+1)%4]-order[index])%4 == (order[1]-order[0])%4 for index in range(4))
        assert (order[1]-order[0])%4 in [1,3]
    else:
        assert all(len(indices)==3 for indices in assignments)
        assert set(assignments[0]) & set(assignments[1]) in [{0,2},{1,3}], 'Triangles must share a rectangle diagonal'
        assert set(assignments[0]) | set(assignments[1]) == set(range(4))
    assert all(samples), 'Incomplete filled rectangle coverage'
    corners = [tuple(sum(sample[axis] for sample in group)/len(group) for axis in [0,1]) for group in samples]
    # Check both sides, location and filled area independently of path bounds alone.
    widths = [math.dist(corners[0],corners[1]), math.dist(corners[3],corners[2])]
    heights = [math.dist(corners[0],corners[3]), math.dist(corners[1],corners[2])]
    for value in widths:
        near(value,40,LENGTH_TOLERANCE)
    for value in heights:
        near(value,20,LENGTH_TOLERANCE)
    measured_area = sum(area(poly) for poly in fills)
    near(measured_area,800,AREA_TOLERANCE)
    return [
        {'role':'paper SOLID fill','cornersMm':corners,'widthMm':sum(widths)/2,'heightMm':sum(heights)/2,
         'areaMm2':measured_area,'expectedAreaMm2':800,'coverage':'complete opaque rectangle','filledPaths':len(fills)},
        {'role':'paper sentinel','a':sentinel['a'],'b':sentinel['b'],'lengthMm':math.dist(sentinel['a'],sentinel['b']),'widthMm':sentinel['widthMm']}
    ]


def dark_coverage(pixels):
    assert pixels, 'No fully interior raster samples'
    fraction = sum(value < 32 for value in pixels) / len(pixels)
    assert fraction >= .995, ('Incomplete visible dark fill', fraction)
    return fraction


def raster_coverage(page):
    # Fixed before the first actual run: 0.1 mm inset, 3 pixels per PDF point,
    # gray <32 and minimum0.995 coverage, matching the established HATCH audit.
    bounds_mm = [20.1,247.1,59.9,266.9]
    clip = fitz.Rect(*(value/MM for value in bounds_mm))
    scale = 3
    pix = page.get_pixmap(matrix=fitz.Matrix(scale,scale),colorspace=fitz.csGRAY,clip=clip,alpha=False)
    assert pix.n == 1
    # MuPDF expands clips to device pixels. Exclude pixels only partially inside
    # the declared region using the returned device origin and row stride.
    left=math.ceil(clip.x0*scale-pix.x); right=math.floor(clip.x1*scale-pix.x)
    top=math.ceil(clip.y0*scale-pix.y); bottom=math.floor(clip.y1*scale-pix.y)
    assert 0 <= left < right <= pix.width and 0 <= top < bottom <= pix.height
    raw=pix.samples
    samples=bytes(raw[row*pix.stride+column] for row in range(top,bottom) for column in range(left,right))
    fraction=dark_coverage(samples)
    for label,probe in [('missing',bytes([255])*len(samples)),
                        ('partial',bytes([255])*(len(samples)//2)+samples[len(samples)//2:])]:
        try:
            dark_coverage(probe)
        except AssertionError:
            pass
        else:
            raise AssertionError(('Raster missing/partial-fill probe incorrectly accepted',label))
    return {'sampleBoundsMm':bounds_mm,'insetMm':.1,'pixelsPerPDFPoint':scale,
            'darkThresholdExclusive':32,'minimumInteriorDarkFraction':.995,
            'interiorDarkFraction':fraction,'fullyInteriorPixels':len(samples),
            'partiallyClippedEdgePixelsExcluded':pix.width*pix.height-len(samples),
            'missingAndPartialRasterProbesRejected':True}


def must_reject(name, callback):
    try:
        callback()
    except AssertionError as error:
        return {'control':name,'rejected':True,'reason':str(error),'actualPDFBytesModified':False}
    raise AssertionError(('Negative control incorrectly accepted',name))


def audit():
    parser = argparse.ArgumentParser()
    for name in ['producer','receipt','render']:
        parser.add_argument('--'+name,type=Path,required=True)
    args = parser.parse_args()
    assert not args.receipt.exists() and not args.render.exists(), 'Preserve existing evidence'
    producer = json.loads(args.producer.read_text(encoding='utf-8-sig'))
    binding = producer['outputs']
    native, pdf_file = Path(binding['native']), Path(binding['pdf'])
    report = {'format':'LinecraftIndependentPaperSolidPDF/1','status':'running','startedAt':datetime.now(timezone.utc).isoformat(),
              'scope':'Actual application-saved native/PDF. Independent literal paper coordinates, complete opaque fill, paint order and sentinel; no production geometry imported.',
              'measurements':[], 'negativeControls':[],
              'tolerancesMm':{'endpointCombinedDistance':ENDPOINT_TOLERANCE,'length':LENGTH_TOLERANCE,'strokeWidth':.005,'page':.3},
              'areaToleranceMm2':AREA_TOLERANCE,
              'bindings':{'producer':{'file':str(args.producer),'sha256':sha(args.producer)},'native':{'file':str(native),'sha256':sha(native)},'pdf':{'file':str(pdf_file),'sha256':sha(pdf_file)}}}
    try:
        assert producer['status']=='passed' and producer['sourceUnchanged'] and producer['inputUnchanged']
        assert producer['total']==6 and producer['passed']==6
        assert sha(native)==binding['nativeSHA256'] and sha(pdf_file)==binding['pdfSHA256']
        document=json.loads(native.read_text(encoding='utf-8-sig'))
        assert document['settings']['units']=='mm' and len(document['entities'])==1 and len(document['layouts'])==1
        model=document['entities'][0]
        assert model['type']=='LINE' and model['start']=={'x':-100,'y':-100} and model['end']=={'x':-90,'y':-100}
        assert model['layer']=='Model sentinel'
        model_layer=next(layer for layer in document['layers'] if layer['name']==model['layer'])
        assert model.get('lineweight',model_layer['lineweight'])==.18 and model.get('color',model_layer['color'])=='#000000'
        layout=document['layouts'][0]
        assert layout['name']=='SYNTHETIC SOLID SHEET' and len(layout['entities'])==2 and not layout['viewports']
        assert layout['paper']['widthMm']==420 and layout['paper']['heightMm']==297
        assert layout['plotSettings']['renderOffsetMm']=={'x':0,'y':0}
        assert layout['plotSettings']['sourcePaperUnits']=='mm'
        fill=next(entity for entity in layout['entities'] if entity['type']=='HATCH')
        assert fill['pattern']=='solid' and fill['layer']=='Fill' and fill['color']=='#000000' and fill['lineweight']==.35
        assert fill['boundary']=={'type':'PLINE','points':[{'x':20,'y':30},{'x':60,'y':30},{'x':60,'y':50},{'x':20,'y':50}],'closed':True}
        sentinel=next(entity for entity in layout['entities'] if entity['type']=='LINE')
        assert sentinel['start']=={'x':10,'y':10} and sentinel['end']=={'x':20,'y':10}
        assert sentinel['layer']=='Paper sentinel'
        sentinel_layer=next(layer for layer in document['layers'] if layer['name']==sentinel['layer'])
        assert sentinel.get('color',sentinel_layer['color'])=='#000000' and sentinel.get('lineweight',sentinel_layer['lineweight'])==.2
        assert len({model['id'],fill['id'],sentinel['id']})==3
        pdf=fitz.open(pdf_file)
        assert len(pdf)==1
        page=pdf[0]
        near(page.rect.width*MM,420,.3); near(page.rect.height*MM,297,.3)
        assert not page.get_images(), 'A raster surrogate cannot establish vector fill geometry'
        stream=page.get_drawings()
        strokes,fills,proof=classify(stream)
        report['paintOrderProof']=proof
        report['measurements']=validate(strokes,fills)
        report['rasterCoverage']=raster_coverage(page)
        report['negativeControls'].append(must_reject('missing fill',lambda:validate(strokes,[])))
        shifted=[[(x+1,y) for x,y in poly] for poly in fills]
        report['negativeControls'].append(must_reject('shifted fill',lambda:validate(strokes,shifted)))
        resized=[[(20+(x-20)/2,y) for x,y in poly] for poly in fills]
        report['negativeControls'].append(must_reject('wrong physical size',lambda:validate(strokes,resized)))
        partial=[fills[0][:3]] if len(fills)==1 else fills[:1]
        report['negativeControls'].append(must_reject('partial fill',lambda:validate(strokes,partial)))
        first_fill=next(index for index,row in enumerate(stream) if row['type'] in ['f','fs'] and row.get('fill') and max(row['fill'])<.01)
        for name,key,value in [('transparent fill','fill_opacity',0),('unknown fill opacity','fill_opacity',None)]:
            changed=copy.deepcopy(stream)
            if value is None:
                del changed[first_fill][key]
            else:
                changed[first_fill][key]=value
            # Geometry-only extraction still passes, establishing the value of the paint check.
            old=classify(changed,False); validate(old[0],old[1])
            report['negativeControls'].append(must_reject(name,lambda changed=changed:classify(changed)))
        changed=copy.deepcopy(stream)
        overlay=copy.deepcopy(next(row for row in stream if row['type']=='f' and min(row['fill'])>.99))
        overlay['seqno']=max(row['seqno'] for row in stream)+1
        changed.append(overlay)
        old=classify(changed,False); validate(old[0],old[1])
        report['negativeControls'].append(must_reject('late opaque white cover',lambda:classify(changed)))
        page.get_pixmap(matrix=fitz.Matrix(3,3),alpha=False).save(args.render)
        report['render']={'file':str(args.render),'sha256':sha(args.render)}
        for row in report['bindings'].values():
            assert sha(row['file'])==row['sha256']
        report['status']='passed'
    except Exception as error:
        report['status']='failed'; report['error']=repr(error)
        raise
    finally:
        report['completedAt']=datetime.now(timezone.utc).isoformat()
        report['auditor']={'file':str(Path(__file__)),'sha256':sha(Path(__file__))}
        with args.receipt.open('x',encoding='utf8') as output:
            output.write(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'status':report['status'],'measurements':len(report['measurements']),'negativeControls':len(report['negativeControls'])}))


if __name__=='__main__':
    audit()
