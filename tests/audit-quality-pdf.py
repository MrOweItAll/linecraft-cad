"""Independent literal synthetic rulers/fill audit; does not import Linecraft."""
import argparse, hashlib, json, math
from pathlib import Path
import fitz

def audit():
    parser=argparse.ArgumentParser()
    parser.add_argument('--mode',choices=['drafting','hatch','viewport'],required=True)
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
        elif args.mode=='viewport':
            assert native['settings']['units']=='mm'
            assert len(native['layouts'])==1 and len(native['entities'])==1
            assert native['entities'][0]['start']=={'x':3,'y':-41} and native['entities'][0]['end']=={'x':43,'y':-41}
            layout=native['layouts'][0];assert len(layout['viewports'])==1 and len(layout['entities'])==1
            viewport=layout['viewports'][0]
            assert viewport['modelCenter']=={'x':23,'y':-41,'z':0}
            assert viewport['camera3d']['target']=={'x':23,'y':-41,'z':0}
            assert viewport['frame']=={'x':50,'y':50,'width':200,'height':100}
            assert viewport['scaleDenominator']==1 and viewport['locked'] is True and viewport['workspace']=='2d'
            assert layout['paper']['widthMm']==420 and layout['paper']['heightMm']==297
            assert layout['entities'][0]['start']=={'x':10,'y':10} and layout['entities'][0]['end']=={'x':20,'y':10}
            segments=[]
            for drawing in page.get_drawings():
                if drawing['type'] in ['s','fs']:
                    for item in drawing['items']:
                        if item[0]=='l':segments.append((tuple(value*mm for value in item[1]),tuple(value*mm for value in item[2])))
            def validate(candidates,start,end,length):
                matches=[segment for segment in candidates if min(math.dist(segment[0],start)+math.dist(segment[1],end),math.dist(segment[0],end)+math.dist(segment[1],start))<.04]
                assert len(matches)==1,(start,end,len(matches))
                actual=math.dist(*matches[0]);assert near(actual,length,.02)
                return matches[0],actual
            # Source literal center23,-41, target0 and 1:1 frame center150,100:
            # model ruler130..170 at PDF y297-100; paper sentinel stays10..20.
            assert len(segments)==2,len(segments)
            for label,start,end,length in [('model ruler',(130,197),(170,197),40),('paper sentinel',(10,287),(20,287),10)]:
                segment,actual=validate(segments,start,end,length)
                midpoint=tuple((segment[0][i]+segment[1][i])/2 for i in [0,1])
                expectedMidpoint=tuple((start[i]+end[i])/2 for i in [0,1])
                assert all(near(actualValue,expected,.02) for actualValue,expected in zip(midpoint,expectedMidpoint))
                report['measurements'].append({'object':label,'expectedLengthMm':length,'actualLengthMm':actual,'actualMidpointMm':midpoint,'expectedMidpointMm':expectedMidpoint,'lengthToleranceMm':.02})
            # Remove the actually matched ruler rather than relying on draw order.
            ruler,_=validate(segments,(130,197),(170,197),40)
            probes=[lambda:validate([segment for segment in segments if segment!=ruler],(130,197),(170,197),40),lambda:validate(segments,(130,197),(170,197),80),lambda:validate(segments,(135,197),(175,197),40)]
            for probe in probes:
                try:probe()
                except AssertionError:pass
                else:raise AssertionError('Viewport missing/wrong-scale/shifted-center negative control incorrectly accepted')
            report['negativeControls']=['missing model ruler','wrong physical scale','translated paper center']
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
            scale=3
            pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),colorspace=fitz.csGRAY,clip=clip,alpha=False)
            # MuPDF expands a noninteger clip to whole device pixels and antialiases
            # its partially clipped edge pixels. Count only pixels wholly inside the
            # declared sample region, using the returned device origin and stride.
            left=math.ceil(clip.x0*scale-pix.x);right=math.floor(clip.x1*scale-pix.x)
            top=math.ceil(clip.y0*scale-pix.y);bottom=math.floor(clip.y1*scale-pix.y)
            assert 0<=left<right<=pix.width and 0<=top<bottom<=pix.height
            raw=pix.samples
            samples=bytes(raw[row*pix.stride+column] for row in range(top,bottom) for column in range(left,right))
            def coverage(pixels):
                fraction=sum(value<32 for value in pixels)/len(pixels)
                assert fraction>=.995,fraction
                return fraction
            fraction=coverage(samples)
            for pixels in [bytes([255])*len(samples),bytes([255])*(len(samples)//2)+samples[len(samples)//2:]]:
                try:coverage(pixels)
                except AssertionError:pass
                else:raise AssertionError('Partial/missing-fill negative control was incorrectly accepted')
            report['measurements'].append({'fillWidthMm':bounds.width*mm,'fillHeightMm':bounds.height*mm,'declaredRectangleAreaMm2':240,'interiorDarkFraction':fraction,'minimumInteriorDarkFraction':.995,'fullyInteriorPixels':len(samples),'partiallyClippedEdgePixelsExcluded':pix.width*pix.height-len(samples),'negativeControls':['missing fill','partial fill']})
        raster=args.receipt.with_suffix('.png');assert not raster.exists();page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(raster);report['raster']=str(raster)
        report['status']='passed'
    except Exception as error:
        report['error']=repr(error)
        raise
    finally:
        args.receipt.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':audit()
