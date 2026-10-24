"""Read actual native/PDF bytes using independent geometry; never imports Linecraft.

The fixture declares a 100-inch trimmed ruler in two locked 1:48/1:96 windows
on A3 landscape paper. PyMuPDF is a test reader, not an app prerequisite.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import fitz

MM = 25.4 / 72


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def near(actual, expected, tolerance=.02):
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected, tolerance)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native', type=Path, required=True)
    parser.add_argument('--pdf', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    assert not args.receipt.exists(), 'Choose a new receipt path.'
    source = json.loads(args.native.read_text(encoding='utf-8-sig'))
    pdf = fitz.open(args.pdf)
    report = dict(framework='Independent actual drafting PDF vector and physical scale audit', evidenceClass='Reads actual saved native drawing and production PDF. No producer imports, edit APIs, synthetic replacement PDF or installed/native desktop claim.', startedAt=datetime.now(timezone.utc).isoformat(), pyMuPDFVersion=fitz.VersionBind, tests=[], bindings={key: dict(path=str(file.resolve()), sha256=sha(file), bytes=file.stat().st_size) for key, file in dict(native=args.native, pdf=args.pdf, auditor=Path(__file__)).items()})

    def check(name, fn):
        try:
            detail = fn()
            report['tests'].append(dict(name=name, status='passed', **({'details': detail} if detail is not None else {})))
            print('PASS ' + name)
        except Exception as error:
            report['tests'].append(dict(name=name, status='failed', error=repr(error)))
            print('FAIL ' + name + ': ' + str(error))

    def native_content():
        target = next(entity for entity in source['entities'] if entity['id'] == 'target')
        assert target['type'] == 'LINE'
        assert target['start'] == dict(x=0, y=0) and target['end'] == dict(x=100, y=0)
        assert source['settings']['units'] == 'in'
        assert source['settings']['gridEnabled'] is False
        assert source['settings']['snapEnabled'] is False
        assert source['settings']['snapModes'] == []
        assert source['settings']['trimExtendMode'] == 'quick'
        assert source['settings']['trimProject'] == 'ucs'
        assert source['settings']['trimEdgeExtend'] is False
        assert len(source['entities']) == 4
        for name, x in [('cut-left', 0), ('cut-right', 100)]:
            entity = next(item for item in source['entities'] if item['id'] == name)
            assert entity['start'] == dict(x=x, y=-40)
            assert entity['end'] == dict(x=x, y=40)
        note = next(item for item in source['entities'] if item['id'] == 'unchanged-note')
        assert note['text'] == 'UNCHANGED SYNTHETIC NOTE'
        assert note['position'] == dict(x=20, y=70)
        return dict(trimmedRulerInches=100, targetIdRetained=True, unmodifiedCuttersAndNote=True)

    check('Saved actual native has exact 100-inch ruler and unchanged guide/settings content', native_content)
    layout = source['layouts'][0]

    def native_layout():
        assert len(source['layouts']) == 1
        assert layout['paper'] == dict(size='A3', orientation='landscape', widthMm=420, heightMm=297)
        assert len(layout['viewports']) == 2
        for viewport, x, denominator in zip(layout['viewports'], [20, 210], [48, 96]):
            assert viewport['frame'] == dict(x=x, y=30, width=160, height=110)
            assert viewport['modelCenter'] == dict(x=50, y=20, z=0)
            assert viewport['scaleDenominator'] == denominator
            assert viewport['locked'] is True
            assert viewport['workspace'] == '2d'
        assert len(layout['entities']) == 1
        paper_line = layout['entities'][0]
        assert paper_line['type'] == 'LINE'
        assert paper_line['start'] == dict(x=20, y=200)
        assert paper_line['end'] == dict(x=140, y=200)
        return dict(lockedRatios=[48, 96], unchangedPaperLine=True)

    check('Native retains independently declared locked viewports and paper line', native_layout)

    def physical_page():
        assert len(pdf) == 1
        page = pdf[0]
        near(page.rect.width * MM, 420, .3)
        near(page.rect.height * MM, 297, .3)
        assert not page.get_images()
        assert page.get_text().count('UNCHANGED SYNTHETIC NOTE') == 2
        return dict(widthMm=page.rect.width * MM, heightMm=page.rect.height * MM, rasterImages=0, noteCopies=2)

    check('Actual output is one A3 vector sheet with two unchanged note copies', physical_page)
    page = pdf[0]
    segments = []
    for drawing in page.get_drawings():
        if drawing['type'] not in ('s', 'fs'):
            continue
        for item in drawing['items']:
            if item[0] == 'l':
                segments.append(dict(a=tuple(v * MM for v in item[1]), b=tuple(v * MM for v in item[2]), widthMm=drawing['width'] * MM))

    def find(a, b, candidates=segments):
        matches = [segment for segment in candidates if min(math.dist(segment['a'], a) + math.dist(segment['b'], b), math.dist(segment['a'], b) + math.dist(segment['b'], a)) < .03]
        assert len(matches) == 1, (a, b, len(matches))
        return matches[0]

    expected = []
    # Paper coordinates are mathematical bottom-up; PDF reader coordinates are top-down.
    for center_x, denominator in [(100, 48), (290, 96)]:
        factor = 25.4 / denominator
        expected.append(dict(denominator=denominator, start=(center_x - 50 * factor, 297 - (85 - 20 * factor)), end=(center_x + 50 * factor, 297 - (85 - 20 * factor)), expectedLengthMm=100 * factor, factor=factor))

    for row in expected:
        def ruler(row=row):
            actual = find(row['start'], row['end'])
            near(math.dist(actual['a'], actual['b']), row['expectedLengthMm'])
            return dict(denominator=row['denominator'], modelInches=100, paperLengthMm=math.dist(actual['a'], actual['b']), expectedLengthMm=row['expectedLengthMm'], actualStartMm=actual['a'], actualEndMm=actual['b'])
        check('Actual 100-inch ruler has exact physical scale at 1:' + str(row['denominator']), ruler)

    def cutting_edges():
        for row in expected:
            x1, x2 = row['start'][0], row['end'][0]
            y = row['start'][1]
            for x in [x1, x2]:
                line = find((x, y - 40 * row['factor']), (x, y + 40 * row['factor']))
                near(math.dist(line['a'], line['b']), 80 * row['factor'])
        return dict(unchangedCutterInstances=4, modelCutterInches=80)

    check('Both actual cutters retain exact lengths at both viewport scales', cutting_edges)

    def no_tails():
        counts = []
        for row in expected:
            low, high = row['start'][0], row['end'][0]
            y = row['start'][1]
            collinear = [segment for segment in segments if abs(segment['a'][1] - y) < .01 and abs(segment['b'][1] - y) < .01 and abs(segment['a'][0] - segment['b'][0]) > .01]
            # Restrict to this viewport's interior so another window cannot alias.
            frame_x = 20 if row['denominator'] == 48 else 210
            collinear = [segment for segment in collinear if min(segment['a'][0], segment['b'][0]) > frame_x + .5 and max(segment['a'][0], segment['b'][0]) < frame_x + 159.5]
            assert len(collinear) == 1
            assert min(collinear[0]['a'][0], collinear[0]['b'][0]) >= low - .02
            assert max(collinear[0]['a'][0], collinear[0]['b'][0]) <= high + .02
            counts.append(len(collinear))
        return dict(targetSegmentCountPerViewport=counts, noLeftOrRightTailInk=True)

    check('Actual PDF retains neither discarded exterior tail', no_tails)

    def negatives():
        row = expected[0]
        found = find(row['start'], row['end'])
        probes = [lambda: find(row['start'], row['end'], [segment for segment in segments if segment is not found]), lambda: near(math.dist(found['a'], found['b']), 100 * 25.4 / 96), lambda: find((row['start'][0] - 20 * row['factor'], row['start'][1]), row['end'])]
        for probe in probes:
            try:
                probe()
            except AssertionError:
                pass
            else:
                raise AssertionError('Negative control unexpectedly accepted')
        return dict(missingRulerRejected=True, wrongScaleRejected=True, untrimmedTailRejected=True, actualBytesModified=False)

    check('Independent negative controls reject missing ruler wrong scale and untrimmed tail', negatives)

    def render():
        output = args.receipt.with_suffix('.png')
        assert not output.exists()
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(output)
        report['raster'] = dict(path=str(output.resolve()), sha256=sha(output), bytes=output.stat().st_size)
        for binding in report['bindings'].values():
            assert sha(binding['path']) == binding['sha256']
        return dict(actualPDFRenderedOnly=True, nativeAndPDFBytesUnchanged=True, visualReviewPending=True)

    check('Actual PDF renders for separate visual inspection without changing inputs', render)
    report.update(completedAt=datetime.now(timezone.utc).isoformat(), total=len(report['tests']))
    report['passed'] = sum(test['status'] == 'passed' for test in report['tests'])
    report['failed'] = report['total'] - report['passed']
    report['status'] = 'passed' if report['failed'] == 0 else 'failed'
    with args.receipt.open('x', encoding='utf-8') as file:
        json.dump(report, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(receipt=str(args.receipt.resolve()), passed=report['passed'], total=report['total'], failed=report['failed'])))
    return 1 if report['failed'] else 0


if __name__ == '__main__':
    sys.exit(main())
