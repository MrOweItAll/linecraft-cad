"""Independent literal two-sheet PDF audit; imports no Linecraft production code."""
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
LENGTH_TOLERANCE = .02
ENDPOINT_TOLERANCE = .04
STROKE_TOLERANCE = .005
PAGE_TOLERANCE = .3
MARKER_HEIGHT_MM = 4
SHEETS = [
    {'id': 'sheet-a', 'marker': 'QA-A01-FIRST', 'denominator': 48,
     'ruler': ((146.5, 147), (273.5, 147)), 'rulerLength': 127},
    {'id': 'sheet-b', 'marker': 'QA-A02-SECOND', 'denominator': 96,
     'ruler': ((178.25, 147), (241.75, 147)), 'rulerLength': 63.5},
]
REGULAR_SHEETS = SHEETS
PAPER_PROFILE = 'regular'
MIXED_SHEETS = [
    {'id': 'sheet-a', 'marker': 'A4-FIRST', 'denominator': 48,
     'page': (210, 297),
     'frame': {'x': 25, 'y': 100, 'width': 160, 'height': 100},
     'markerPosition': (145, 15), 'borderRight': 200,
     'dividers': (140, 180), 'cell': (140, 257, 180, 287),
     'ruler': ((41.5, 147), (168.5, 147)), 'rulerLength': 127},
    {'id': 'sheet-b', 'marker': 'A3-SECOND', 'denominator': 96,
     'page': (420, 297),
     'frame': {'x': 100, 'y': 100, 'width': 220, 'height': 100},
     'markerPosition': (310, 15), 'borderRight': 410,
     'dividers': (300, 360), 'cell': (300, 257, 360, 287),
     'ruler': ((178.25, 147), (241.75, 147)), 'rulerLength': 63.5},
]


def select_profile(name):
    global SHEETS, PAPER_PROFILE
    assert name in ('regular', 'mixed-paper')
    PAPER_PROFILE = name
    SHEETS = MIXED_SHEETS if name == 'mixed-paper' else REGULAR_SHEETS


def expected_border(sheet):
    right = sheet.get('borderRight', 410)
    return [((10, 257), (right, 257)), ((right, 257), (right, 287)),
            ((right, 287), (10, 287)), ((10, 287), (10, 257))]


def expected_dividers(sheet):
    return [((x, 257), (x, 287)) for x in sheet.get('dividers', (300, 360))]


BORDER = [((10, 257), (410, 257)), ((410, 257), (410, 287)),
          ((410, 287), (10, 287)), ((10, 287), (10, 257))]
SENTINEL = ((20, 237), (120, 237))
DIVIDERS = [((300, 257), (300, 287)), ((360, 257), (360, 287))]


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def near(actual, expected, tolerance):
    assert isinstance(actual, (int, float)) and not isinstance(actual, bool)
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected, tolerance)


def point(raw):
    return tuple(float(value) * MM for value in raw)


def opaque(value, label):
    assert isinstance(value, (int, float)) and not isinstance(value, bool)
    assert math.isfinite(value) and value == 1, (label, value)


def black(color, label):
    assert isinstance(color, (list, tuple)) and color, (label, color)
    assert all(isinstance(value, (int, float)) and math.isfinite(value)
               and 0 <= value < .01 for value in color), (label, color)


def appearance(document, entity, width):
    layer = next(row for row in document['layers'] if row['name'] == entity['layer'])
    assert entity.get('color', layer['color']).lower() == '#000000'
    assert entity.get('lineweight', layer['lineweight']) == width


def native_document(document):
    assert document['settings']['units'] == 'in'
    assert [row['id'] for row in document['layouts']] == ['sheet-b', 'sheet-a']
    assert len(document['entities']) == 1
    ruler = document['entities'][0]
    assert ruler['id'] == 'model-ruler' and ruler['type'] == 'LINE'
    assert ruler['start'] == {'x': 0, 'y': 0} and ruler['end'] == {'x': 240, 'y': 0}
    appearance(document, ruler, .25)
    style = next(row for row in document['textStyles'] if row['name'] == 'Standard')
    assert style['fontFamily'] == 'Arial'
    all_ids = [ruler['id']]
    for expected in SHEETS:
        layout = next(row for row in document['layouts'] if row['id'] == expected['id'])
        assert (layout['paper']['widthMm'], layout['paper']['heightMm']) == expected.get('page', (420, 297))
        if PAPER_PROFILE == 'mixed-paper':
            assert layout['paper']['orientation'] == ('portrait' if expected['id'] == 'sheet-a' else 'landscape')
        assert len(layout['viewports']) == 1
        viewport = layout['viewports'][0]
        assert viewport['frame'] == expected.get('frame', {'x': 100, 'y': 100, 'width': 220, 'height': 100})
        if PAPER_PROFILE == 'mixed-paper':
            assert viewport['plotBorder'] is False and viewport['frozenLayers'] == []
        assert viewport['modelCenter'] == {'x': 120, 'y': 0, 'z': 0}
        assert viewport['scaleDenominator'] == expected['denominator'] and viewport['locked'] is True
        assert viewport['workspace'] == '2d'
        entities = layout['entities']
        assert len(entities) == 5
        assert sorted(row['type'] for row in entities) == ['LINE', 'LINE', 'LINE', 'PLINE', 'TEXT']
        marker = next(row for row in entities if row['type'] == 'TEXT')
        assert marker['text'] == expected['marker'] and marker['position'] == dict(zip(('x', 'y'), expected.get('markerPosition', (310, 15))))
        assert marker['height'] == MARKER_HEIGHT_MM and marker['rotation'] == 0 and marker['style'] == 'Standard'
        appearance(document, marker, .25)
        border = next(row for row in entities if row['type'] == 'PLINE')
        assert border['closed'] is True
        assert border['points'] == [{'x': 10, 'y': 10}, {'x': expected.get('borderRight', 410), 'y': 10},
                                    {'x': expected.get('borderRight', 410), 'y': 40}, {'x': 10, 'y': 40}]
        appearance(document, border, .25)
        lines = [row for row in entities if row['type'] == 'LINE']
        for start, end, width in [({'x': 20, 'y': 60}, {'x': 120, 'y': 60}, .35),
                                  ({'x': expected.get('dividers', (300, 360))[0], 'y': 10}, {'x': expected.get('dividers', (300, 360))[0], 'y': 40}, .25),
                                  ({'x': expected.get('dividers', (300, 360))[1], 'y': 10}, {'x': expected.get('dividers', (300, 360))[1], 'y': 40}, .25)]:
            matches = [row for row in lines if row['start'] == start and row['end'] == end]
            assert len(matches) == 1
            appearance(document, matches[0], width)
        all_ids.extend(row['id'] for row in entities)
    assert len(all_ids) == len(set(all_ids))


def line_segments(drawing):
    segments = []
    first = previous = None
    for item in drawing['items']:
        kind = item[0]
        if kind == 'l':
            a, b = point(item[1]), point(item[2])
            if first is None:
                first = a
            segments.append((a, b))
            previous = b
        elif kind == 're':
            r = item[1]
            vertices = [(r.x0 * MM, r.y0 * MM), (r.x1 * MM, r.y0 * MM),
                        (r.x1 * MM, r.y1 * MM), (r.x0 * MM, r.y1 * MM)]
            segments.extend(zip(vertices, vertices[1:] + vertices[:1]))
            first = previous = None
        elif kind == 'qu':
            q = item[1]
            vertices = [point(q.ul), point(q.ur), point(q.lr), point(q.ll)]
            segments.extend(zip(vertices, vertices[1:] + vertices[:1]))
            first = previous = None
        else:
            raise AssertionError(('Unexpected stroke operator', kind))
    if drawing.get('closePath') and first is not None and previous is not None and math.dist(first, previous) > 1e-8:
        segments.append((previous, first))
    return [(a, b) for a, b in segments if math.dist(a, b) > 1e-8]


def extract(page):
    strokes, backgrounds, sequences = [], [], []
    for drawing in page.get_drawings():
        kind, sequence = drawing['type'], drawing.get('seqno')
        assert kind in ['s', 'f', 'fs']
        assert isinstance(sequence, int) and not isinstance(sequence, bool)
        sequences.append(sequence)
        if kind in ['s', 'fs']:
            for a, b in line_segments(drawing):
                strokes.append({'a': a, 'b': b, 'widthMm': drawing['width'] * MM,
                                'opacity': drawing.get('stroke_opacity'), 'color': drawing.get('color'),
                                'dashes': drawing.get('dashes'), 'seqno': sequence})
        if kind in ['f', 'fs']:
            color = drawing.get('fill')
            assert color and min(color) > .99, ('Unexpected filled geometry', color)
            assert kind == 'f' and len(drawing['items']) == 1 and drawing['items'][0][0] == 're'
            backgrounds.append({'boundsMm': tuple(float(value) * MM for value in drawing['rect']),
                                'opacity': drawing.get('fill_opacity'), 'seqno': sequence})
    assert sequences == sorted(sequences) and len(sequences) == len(set(sequences))
    traces = [{'text': ''.join(chr(char[0]) for char in trace['chars']),
               'opacity': trace.get('opacity'), 'color': trace.get('color'),
               'type': trace.get('type'), 'seqno': trace.get('seqno')}
              for trace in page.get_texttrace()]
    return {'sizeMm': (page.rect.width * MM, page.rect.height * MM),
            'mediaBoxMm': tuple(float(v) * MM for v in page.mediabox),
            'cropBoxMm': tuple(float(v) * MM for v in page.cropbox), 'rotation': page.rotation,
            'images': len(page.get_image_info()),
            'text': page.get_text(), 'markerBoundsMm': {sheet['marker']: [tuple(float(v) * MM for v in box)
                   for box in page.search_for(sheet['marker'])] for sheet in SHEETS},
            'strokes': strokes, 'backgrounds': backgrounds, 'textTraces': traces}


def match_segment(strokes, expected):
    a, b = expected
    found = [(index, row) for index, row in enumerate(strokes)
             if min(math.dist(row['a'], a) + math.dist(row['b'], b),
                    math.dist(row['a'], b) + math.dist(row['b'], a)) < ENDPOINT_TOLERANCE]
    assert len(found) == 1, ('Missing, duplicate or shifted segment', expected, len(found))
    return found[0]


def validate_pages(pages):
    assert len(pages) == 2, ('Unexpected PDF page count', len(pages))
    measurements = []
    for number, (page, expected) in enumerate(zip(pages, SHEETS), 1):
        width, height = expected.get('page', (420, 297))
        near(page['sizeMm'][0], width, PAGE_TOLERANCE)
        near(page['sizeMm'][1], height, PAGE_TOLERANCE)
        if PAPER_PROFILE == 'mixed-paper':
            assert type(page['rotation']) is int and page['rotation'] == 0
            for field in ['mediaBoxMm', 'cropBoxMm']:
                assert len(page[field]) == 4
                for actual, literal in zip(page[field], (0, 0, width, height)):
                    near(actual, literal, PAGE_TOLERANCE)
            measurements.append({'page': number, 'layoutId': expected['id'], 'role': 'paper boxes',
                                 'expectedSizeMm': [width, height], 'actualSizeMm': page['sizeMm'],
                                 'mediaBoxMm': page['mediaBoxMm'], 'cropBoxMm': page['cropBoxMm'], 'rotation': page['rotation']})
        assert page['images'] == 0, 'Raster surrogate does not establish vector geometry'
        assert page['text'].count(expected['marker']) == 1
        other = next(sheet['marker'] for sheet in SHEETS if sheet['id'] != expected['id'])
        assert other not in page['text'], 'Other sheet marker leaked or page order is wrong'
        bounds = page['markerBoundsMm'][expected['marker']]
        assert len(bounds) == 1, ('Marker is missing or duplicated', bounds)
        x0, y0, x1, y1 = bounds[0]
        assert all(math.isfinite(value) for value in bounds[0])
        cell = expected.get('cell', (300, 257, 360, 287))
        assert cell[0] <= x0 < x1 <= cell[2] and cell[1] <= y0 < y1 <= cell[3], ('Marker outside title-block cell', bounds)
        assert page['textTraces'], 'No actual text paint found'
        for trace in page['textTraces']:
            assert trace['type'] == 0, ('Invisible or unsupported text paint', trace['type'])
            opaque(trace['opacity'], 'Unknown or nonopaque text')
            black(trace['color'], 'Text is not black')
            assert isinstance(trace['seqno'], int)
        assert expected['marker'] in ''.join(trace['text'] for trace in page['textTraces'])
        strokes = page['strokes']
        assert len(strokes) == 8, ('Unexpected segment count', len(strokes))
        for row in strokes:
            opaque(row['opacity'], 'Unknown or nonopaque stroke')
            black(row['color'], 'Stroke is not black')
            assert isinstance(row['dashes'], str) and re.fullmatch(r'\[\s*\]\s*[+-]?0(?:\.0*)?', row['dashes'].strip())
        foreground = [row['seqno'] for row in strokes] + [row['seqno'] for row in page['textTraces']]
        for background in page['backgrounds']:
            opaque(background['opacity'], 'Unknown or nonopaque page background')
            for actual, literal in zip(background['boundsMm'], (0, 0, width, height)):
                near(actual, literal, PAGE_TOLERANCE)
            assert background['seqno'] < min(foreground), 'White overpaint follows foreground ink'
        used = set()
        expected_segments = [('model ruler', expected['ruler'], .25), ('paper sentinel', SENTINEL, .35)]
        expected_segments += [('title-block edge ' + str(i + 1), segment, .25) for i, segment in enumerate(expected_border(expected))]
        expected_segments += [('title-block divider ' + str(i + 1), segment, .25) for i, segment in enumerate(expected_dividers(expected))]
        for role, segment, width in expected_segments:
            index, row = match_segment(strokes, segment)
            assert index not in used
            used.add(index)
            length = math.dist(row['a'], row['b'])
            near(length, math.dist(*segment), LENGTH_TOLERANCE)
            near(row['widthMm'], width, STROKE_TOLERANCE)
            measurements.append({'page': number, 'layoutId': expected['id'], 'role': role,
                                 'expectedEndpointsMm': segment, 'actualEndpointsMm': [row['a'], row['b']],
                                 'lengthMm': length, 'strokeWidthMm': row['widthMm']})
        assert len(used) == len(strokes)
        measurements.append({'page': number, 'layoutId': expected['id'], 'role': 'title-block marker',
                             'text': expected['marker'], 'boundsMm': bounds[0], 'cellMm': list(cell)})
    return measurements


def must_reject(name, data):
    try:
        validate_pages(data)
    except AssertionError as error:
        return {'control': name, 'rejected': True, 'reason': str(error), 'actualPDFBytesModified': False}
    raise AssertionError(('Negative control incorrectly accepted', name))


def negative_controls(pages):
    controls = [must_reject('missing page', pages[:1]), must_reject('extra page', pages + [pages[0]]),
                must_reject('swapped page order', list(reversed(pages))),
                must_reject('duplicated first sheet', [pages[0], pages[0]])]
    bad = copy.deepcopy(pages)
    bad[0]['text'] = bad[0]['text'].replace(SHEETS[0]['marker'], '')
    controls.append(must_reject('missing sheet marker', bad))
    for name, segment in [('missing model ruler', SHEETS[0]['ruler']), ('missing title-block edge', expected_border(SHEETS[0])[0])]:
        bad = copy.deepcopy(pages)
        index, _ = match_segment(bad[0]['strokes'], segment)
        del bad[0]['strokes'][index]
        controls.append(must_reject(name, bad))
    bad = copy.deepcopy(pages)
    index, row = match_segment(bad[0]['strokes'], SHEETS[0]['ruler'])
    row['a'] = (row['a'][0] - 10, row['a'][1])
    row['b'] = (row['b'][0] + 10, row['b'][1])
    controls.append(must_reject('wrong physical ruler scale', bad))
    for value, name in [(0, 'transparent stroke'), (None, 'unknown stroke opacity')]:
        bad = copy.deepcopy(pages)
        bad[0]['strokes'][0]['opacity'] = value
        controls.append(must_reject(name, bad))
    bad = copy.deepcopy(pages)
    bad[0]['textTraces'][0]['opacity'] = 0
    controls.append(must_reject('transparent text', bad))
    bad = copy.deepcopy(pages)
    maximum = max([row['seqno'] for row in bad[0]['strokes']] + [row['seqno'] for row in bad[0]['textTraces']])
    bad[0]['backgrounds'].append({'boundsMm': (0, 0, SHEETS[0].get('page', (420, 297))[0], 297), 'opacity': 1, 'seqno': maximum + 1})
    controls.append(must_reject('late white page overpaint', bad))
    bad = copy.deepcopy(pages)
    bad[0]['images'] = 1
    controls.append(must_reject('raster image surrogate or overpaint', bad))
    if PAPER_PROFILE == 'mixed-paper':
        controls.extend(additional_mixed_controls(pages, must_reject, match_segment))
    return controls


def additional_mixed_controls(pages, must_reject, match_segment):
    """Ten extras + the original thirteen = twenty-three mixed controls.

    Each mutation is on a deepcopy; raw PDF/native files stay immutable. This
    proposal calls page metadata mediaBoxMm/cropBoxMm as four coordinate tuples,
    and rotation as integer degrees. Adapt field names only if extraction differs.
    """
    controls = []
    bad = copy.deepcopy(pages)
    bad[0]['sizeMm'] = (420, 297)
    bad[0]['mediaBoxMm'] = (0, 0, 420, 297)
    bad[0]['cropBoxMm'] = (0, 0, 420, 297)
    controls.append(must_reject('both sheets forced to A3', bad))

    bad = copy.deepcopy(pages)
    bad[1]['sizeMm'] = (210, 297)
    bad[1]['mediaBoxMm'] = (0, 0, 210, 297)
    bad[1]['cropBoxMm'] = (0, 0, 210, 297)
    controls.append(must_reject('both sheets forced to A4', bad))

    bad = copy.deepcopy(pages)
    bad[0]['mediaBoxMm'] = (0, 0, 420, 297)
    controls.append(must_reject('raw MediaBox wrong while visible size retained', bad))

    bad = copy.deepcopy(pages)
    bad[0]['cropBoxMm'] = (1, 0, 210, 297)
    controls.append(must_reject('cropped or shifted page box', bad))

    bad = copy.deepcopy(pages)
    bad[0]['rotation'] = 90
    controls.append(must_reject('unexpected page rotation', bad))

    bad = copy.deepcopy(pages)
    _, row = match_segment(bad[0]['strokes'], MIXED_SHEETS[0]['ruler'])
    row['a'] = (row['a'][0] + 1, row['a'][1])
    row['b'] = (row['b'][0] + 1, row['b'][1])
    controls.append(must_reject('correct-length model ruler shifted', bad))

    bad = copy.deepcopy(pages)
    _, row = match_segment(bad[0]['strokes'], SENTINEL)
    row['b'] = (row['a'][0] + 50, row['a'][1])
    controls.append(must_reject('paper sentinel incorrectly viewport-scaled', bad))

    bad = copy.deepcopy(pages)
    boxes = bad[0]['markerBoundsMm'][MIXED_SHEETS[0]['marker']]
    boxes.append(boxes[0])
    controls.append(must_reject('duplicate marker bounds', bad))

    bad = copy.deepcopy(pages)
    bad[0]['textTraces'][0]['type'] = 3
    controls.append(must_reject('invisible text with opaque metadata', bad))

    bad = copy.deepcopy(pages)
    _, row = match_segment(bad[0]['strokes'], MIXED_SHEETS[0]['ruler'])
    row['widthMm'] = .5
    controls.append(must_reject('wrong physical model stroke width', bad))
    return controls



def main():
    parser = argparse.ArgumentParser()
    for name in ['producer', 'receipt', 'render-directory']:
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--profile', choices=['regular', 'mixed-paper'], default='regular')
    args = parser.parse_args()
    select_profile(args.profile)
    assert not args.receipt.exists() and not args.render_directory.exists(), 'Preserve existing evidence'
    producer = json.loads(args.producer.read_text(encoding='utf-8-sig'))
    outputs = producer['outputs']
    bindings = {'producer': {'file': str(args.producer), 'sha256': sha(args.producer)}}
    for name in ['input', 'native', 'pdf']:
        file = Path(outputs[name])
        assert sha(file) == outputs[name + 'SHA256']
        bindings[name] = {'file': str(file), 'sha256': sha(file)}
    report = {'format': 'LinecraftIndependentMultisheetPDF/1', 'status': 'running',
              'startedAt': datetime.now(timezone.utc).isoformat(), 'bindings': bindings, 'paperProfile': args.profile,
              'scope': 'Actual application-produced PDF, independent literal page/order/text/vector dimensions and paint checks; no production projection imports or font/client parity claim.',
              'tolerancesMm': {'length': LENGTH_TOLERANCE, 'endpointCombinedDistance': ENDPOINT_TOLERANCE,
                               'strokeWidth': STROKE_TOLERANCE, 'page': PAGE_TOLERANCE},
              'measurements': [], 'negativeControls': [], 'renders': []}
    try:
        assert producer['status'] == 'passed' and producer['sourceUnchanged'] is True and producer['inputUnchanged'] is True
        assert producer.get('paperProfile', 'regular') == args.profile, 'Producer profile mismatch'
        for name in ['input', 'native']:
            native_document(json.loads(Path(outputs[name]).read_text(encoding='utf-8-sig')))
        pdf = fitz.open(outputs['pdf'])
        pages = [extract(page) for page in pdf]
        report['measurements'] = validate_pages(pages)
        report['negativeControls'] = negative_controls(pages)
        args.render_directory.mkdir()
        for i, page in enumerate(pdf, 1):
            for label, scale, clip in [('full', 1.5, None), ('title-block', 3, fitz.Rect(0, 250 / MM, (SHEETS[i - 1].get('page', (420, 297))[0] if PAPER_PROFILE == 'mixed-paper' else 420) / MM, 297 / MM))]:
                file = args.render_directory / f'page-{i}-{label}.png'
                page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False).save(file)
                report['renders'].append({'page': i, 'kind': label, 'file': str(file), 'sha256': sha(file)})
        report['pageOrder'] = [sheet['id'] for sheet in SHEETS]
        report['nativeLiteralChecks'] = 'Input and actual saved document both retain the declared model, layouts, viewports, title-block geometry, markers and styles.'
        report['visualReview'] = 'Pending independent inspection of fresh full and detail renders'
        for row in bindings.values():
            assert sha(row['file']) == row['sha256']
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = repr(error)
        raise
    finally:
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        report['auditor'] = {'file': str(Path(__file__)), 'sha256': sha(Path(__file__))}
        with args.receipt.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
        print(json.dumps({'status': report['status'], 'measurements': len(report['measurements']),
                          'negativeControls': len(report['negativeControls'])}))


if __name__ == '__main__':
    main()
