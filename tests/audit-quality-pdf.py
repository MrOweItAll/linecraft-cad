"""Independent literal synthetic rulers/fill audit; does not import Linecraft."""
import argparse, hashlib, json, math
from pathlib import Path
import fitz

def audit():
    parser=argparse.ArgumentParser()
    parser.add_argument('--mode',choices=['drafting','hatch'],required=True)
    for name in ['native','pdf','receipt']: parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args()
    assert not args.receipt.exists()
    report={'format':'LinecraftIndependentQualityPDF/1','mode':args.mode,'status':'failed','measurements':[],'bindings':{name:hashlib.sha256(getattr(args,name).read_bytes()).hexdigest() for name in ['native','pdf']}}
    try:
        native=json.loads(args.native.read_text(encoding='utf-8-sig'))
        pdf=fitz.open(args.pdf)
        assert len(pdf)==1
        page=pdf[0]; mm=25.4/72
        near=lambda a,b,t=.03: math.isfinite(a) and abs(a-b)<=t
        assert near(page.rect.width*mm,420,.3) and near(page.rect.height*mm,297,.3)
        assert not page.get_images()
        if args.mode=='drafting':
            assert native['settings']['units']=='in'
            segments=[]
            for drawing in page.get_drawings():
                if drawing['type'] in ['s','fs']:
                    for item in drawing['items']:
                        if item[0]=='l': segments.append((tuple(v*mm for v in item[1]),tuple(v*mm for v in item[2])))
            def validate(candidates,start,end,length):
                matches=[s for s in candidates if min(math.dist(s[0],start)+math.dist(s[1],end),math.dist(s[0],end)+math.dist(s[1],start))<.04]
                assert len(matches)==1,(start,end,len(matches))
                actual=math.dist(*matches[0]);assert near(actual,length,.02)
                return matches[0],actual
            # Literal paper coordinates from declared frames and arithmetic, not producer output.
            for start,end,length in [((41.5,177),(168.5,177),127),((279.6,177),(330.4,177),50.8)]:
                matched,actual=validate(segments,start,end,length)
                # Exercise the same validator with missing ink and independently wrong scale.
                for candidates,expected in [([s for s in segments if s!=matched],length),(segments,length*2)]:
                    try:validate(candidates,start,end,expected)
                    except AssertionError:pass
                    else:raise AssertionError('Negative ruler control was incorrectly accepted')
                report['measurements'].append({'expectedLengthMm':length,'actualLengthMm':actual,'toleranceMm':.02})
            assert 'SYNTHETIC QA REVISED' in page.get_text()
        else:
            fill=next(e for e in native['entities'] if e['type']=='HATCH')
            assert fill['boundary']['points']==[{'x':12.5,'y':7.25},{'x':32.5,'y':7.25},{'x':32.5,'y':19.25},{'x':12.5,'y':19.25}]
            filled=[d for d in page.get_drawings() if d['type'] in ['f','fs'] and d['fill'] and max(d['fill'])<.1]
            # Production PDF may emit two triangles; their union must occupy this literal box.
            relevant=[d['rect'] for d in filled if near(d['rect'].x0*mm,90) or near(d['rect'].x1*mm,110)]
            assert relevant,'No solid fill ink at the declared viewport center'
            bounds=fitz.Rect(relevant[0])
            for rect in relevant[1:]: bounds|=rect
            for actual,expected in zip([bounds.x0*mm,bounds.y0*mm,bounds.x1*mm,bounds.y1*mm],[90,206,110,218]):assert near(actual,expected),(actual,expected)
            # Bounds alone would accept sparse corner triangles. Inspect all interior ink
            # independently, excluding0.1mm edge antialiasing; reject partial/absent masks.
            clip=fitz.Rect(90.1/mm,206.1/mm,109.9/mm,217.9/mm)
            samples=page.get_pixmap(matrix=fitz.Matrix(3,3),colorspace=fitz.csGRAY,clip=clip,alpha=False).samples
            def coverage(pixels):
                fraction=sum(value<32 for value in pixels)/len(pixels)
                assert fraction>=.995,fraction
                return fraction
            fraction=coverage(samples)
            for pixels in [bytes([255])*len(samples),bytes([255])*(len(samples)//2)+samples[len(samples)//2:]]:
                try:coverage(pixels)
                except AssertionError:pass
                else:raise AssertionError('Partial/missing-fill negative control was incorrectly accepted')
            report['measurements'].append({'fillWidthMm':bounds.width*mm,'fillHeightMm':bounds.height*mm,'declaredRectangleAreaMm2':240,'interiorDarkFraction':fraction,'minimumInteriorDarkFraction':.995,'negativeControls':['missing fill','partial fill']})
        raster=args.receipt.with_suffix('.png');assert not raster.exists();page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(raster);report['raster']=str(raster)
        report['status']='passed'
    except Exception as error:
        report['error']=repr(error)
        raise
    finally:
        args.receipt.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':audit()
