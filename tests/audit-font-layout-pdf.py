"""Independent literal registered-font PDF audit; no Linecraft imports or assets.

Installed regular TTFs are read in place and hash-bound. OS/2 cap-height is read
independently from the SFNT directory; MuPDF supplies Unicode glyph advances.
No outlines, font files or production metric tables are copied into evidence.
"""
import argparse
import copy
import hashlib
import json
import math
import os
import re
import struct
from datetime import datetime, timezone
from pathlib import Path

import fitz

MM = 25.4 / 72
POSITION_TOLERANCE_MM = .04
ADVANCE_TOLERANCE_MM = .02
PAGE_TOLERANCE_MM = .3
STROKE_TOLERANCE_MM = .005
SAMPLES = [
    {'family': 'Arial', 'position': (20, 160), 'baseline': (20, 50), 'height': 5, 'widthFactor': 1},
    {'family': 'Times New Roman', 'position': (20, 130), 'baseline': (20, 80), 'height': 5, 'widthFactor': 1},
    {'family': 'Arial', 'position': (20, 100), 'baseline': (20, 110), 'height': 5, 'widthFactor': .75},
]
FONT_FILES = {'Arial': Path(os.environ['SystemRoot']) / 'Fonts' / 'arial.ttf',
              'Times New Roman': Path(os.environ['SystemRoot']) / 'Fonts' / 'times.ttf'}
BORDER = [((10, 200), (287, 200)), ((287, 200), (287, 10)),
          ((287, 10), (10, 10)), ((10, 10), (10, 200))]
DIVIDER = ((180, 200), (180, 175))
RULER = ((20, 150), (120, 150))


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def near(actual, expected, tolerance):
    assert isinstance(actual, (int, float)) and not isinstance(actual, bool)
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected, tolerance)


def mm_point(point):
    return tuple(float(x) * MM for x in point)


def normalized_face(value):
    assert isinstance(value, str) and value
    return re.sub(r'[^a-z0-9]', '', re.sub(r'^[A-Z]{6}\+', '', value).lower())


def font_reference(family, inventory):
    file = FONT_FILES[family]
    assert file.is_file(), ('Required registered font not run: unavailable file', family)
    digest = sha(file)
    matches = [row for row in inventory
               if row.get('family', row.get('fontFamily')) == family
               and row.get('bold') is False and row.get('italic') is False]
    assert len(matches) == 1, ('Required regular inventory row absent or ambiguous', family)
    row = matches[0]
    assert row.get('available') is True, ('Required font not run: unavailable registration', family)
    assert row.get('sha256') == digest, ('Registered service does not bind exact oracle font', family)
    if 'family' in row and 'fontFamily' in row:
        assert row['family'] == row['fontFamily']
    data = file.read_bytes()
    assert len(data) >= 12
    count = struct.unpack_from('>H', data, 4)[0]
    assert 1 <= count <= 256 and 12 + 16 * count <= len(data)
    tables = {}
    for index in range(count):
        base = 12 + 16 * index
        tag = data[base:base + 4].decode('ascii')
        offset, length = struct.unpack_from('>II', data, base + 8)
        assert offset + length <= len(data) and tag not in tables
        tables[tag] = (offset, length)
    head, head_length = tables['head']
    os2, os2_length = tables['OS/2']
    assert head_length >= 54 and os2_length >= 90
    units = struct.unpack_from('>H', data, head + 18)[0]
    assert struct.unpack_from('>H', data, os2)[0] >= 2
    cap_height = struct.unpack_from('>h', data, os2 + 88)[0]
    assert 0 < cap_height <= units
    name, name_length = tables['name']
    assert name_length >= 6
    name_count, string_offset = struct.unpack_from('>HH', data, name + 2)
    assert 6 + name_count * 12 <= name_length
    postscript_names = []
    for index in range(name_count):
        platform, encoding, language, name_id, length, offset = struct.unpack_from('>HHHHHH', data, name + 6 + index * 12)
        if name_id != 6:
            continue
        start = name + string_offset + offset
        assert start >= name and start + length <= name + name_length
        payload = data[start:start + length]
        if platform in [0, 3]:
            text = payload.decode('utf-16-be')
        elif platform == 1:
            text = payload.decode('mac_roman')
        else:
            continue
        postscript_names.append(text)
    assert postscript_names and len(set(map(normalized_face, postscript_names))) == 1
    font = fitz.Font(fontfile=str(file))
    advance_em = font.glyph_advance(72)
    assert math.isfinite(advance_em) and advance_em > 0 and font.has_glyph(72)
    return {'family': family, 'sha256': digest, 'unitsPerEm': units,
            'capHeight': cap_height, 'capRatio': cap_height / units,
            'HAdvancePerEm': advance_em, 'postscriptName': postscript_names[0],
            'faceKey': normalized_face(postscript_names[0]), 'independentParser': 'MuPDF glyph advance + stdlib SFNT OS/2 and name fields'}


def native_document(document):
    assert document['entities'] == [], 'This reference contains no model objects'
    assert len(document['layouts']) == 1
    layout = document['layouts'][0]
    assert layout['name'] == 'SYNTHETIC FONT SHEET'
    assert layout['paper']['widthMm'] == 297 and layout['paper']['heightMm'] == 210
    assert layout['viewports'] == []
    texts = [row for row in layout['entities'] if row['type'] == 'TEXT']
    assert len(texts) == 3
    styles = {row['name']: row for row in document['textStyles']}
    for sample in SAMPLES:
        rows = [row for row in texts if row['position'] == {'x': sample['position'][0], 'y': sample['position'][1]}]
        assert len(rows) == 1
        row = rows[0]
        assert row['text'] == 'HHHH' and row['height'] == 5 and row['rotation'] == 0
        style = styles[row['style']]
        assert style['fontFamily'] == sample['family'] and style['metrics'] == 'registered'
        assert style['widthFactor'] == sample['widthFactor']


def line_segments(drawing):
    segments, first, previous = [], None, None
    for item in drawing['items']:
        if item[0] == 'l':
            a, b = mm_point(item[1]), mm_point(item[2])
            first = a if first is None else first
            previous = b
            segments.append((a, b))
        elif item[0] == 're':
            rect = item[1]
            vertices = [(rect.x0 * MM, rect.y0 * MM), (rect.x1 * MM, rect.y0 * MM),
                        (rect.x1 * MM, rect.y1 * MM), (rect.x0 * MM, rect.y1 * MM)]
            segments.extend(zip(vertices, vertices[1:] + vertices[:1]))
            first = previous = None
        else:
            raise AssertionError(('Unsupported stroke in literal fixture', item[0]))
    if drawing.get('closePath') and first is not None and previous is not None and math.dist(first, previous) > 1e-8:
        segments.append((previous, first))
    return [(a, b) for a, b in segments if math.dist(a, b) > 1e-8]


def extract(page):
    result = {'sizeMm': (page.rect.width * MM, page.rect.height * MM),
              'images': len(page.get_image_info()), 'characters': [], 'strokes': [], 'backgrounds': []}
    for trace in page.get_texttrace():
        assert all(len(char) >= 4 for char in trace['chars'])
        for char in trace['chars']:
            result['characters'].append({'unicode': char[0], 'originMm': mm_point(char[2]),
                'face': trace['font'], 'reportedSizeMm': trace['size'] * MM,
                'opacity': trace.get('opacity'), 'color': trace.get('color'),
                'type': trace.get('type'), 'seqno': trace.get('seqno')})
    for drawing in page.get_drawings():
        kind = drawing['type']
        assert kind in ['s', 'f', 'fs']
        if kind in ['s', 'fs']:
            for a, b in line_segments(drawing):
                result['strokes'].append({'a': a, 'b': b, 'widthMm': drawing['width'] * MM,
                    'color': drawing.get('color'), 'opacity': drawing.get('stroke_opacity'),
                    'seqno': drawing.get('seqno')})
        if kind in ['f', 'fs']:
            assert kind == 'f' and drawing.get('fill') and min(drawing['fill']) > .99
            result['backgrounds'].append({'boundsMm': tuple(x * MM for x in drawing['rect']),
                'opacity': drawing.get('fill_opacity'), 'seqno': drawing.get('seqno')})
    return result


def black_opaque(row):
    assert row['opacity'] == 1, ('Nonopaque/unknown paint', row['opacity'])
    assert row['color'] and all(isinstance(x, (int, float)) and math.isfinite(x) and 0 <= x < .01 for x in row['color'])
    assert isinstance(row['seqno'], int)


def match_segment(strokes, segment):
    found = [(i, row) for i, row in enumerate(strokes)
             if min(math.dist(row['a'], segment[0]) + math.dist(row['b'], segment[1]),
                    math.dist(row['a'], segment[1]) + math.dist(row['b'], segment[0])) <= POSITION_TOLERANCE_MM]
    assert len(found) == 1, ('Missing/duplicate/shifted geometry', segment, len(found))
    return found[0]


def validate_pages(pages, references):
    assert len(pages) == 1
    page = pages[0]
    near(page['sizeMm'][0], 297, PAGE_TOLERANCE_MM)
    near(page['sizeMm'][1], 210, PAGE_TOLERANCE_MM)
    assert page['images'] == 0
    chars = page['characters']
    assert len(chars) == 12 and all(row['unicode'] == 72 for row in chars)
    measurements, used = [], set()
    for sample in SAMPLES:
        reference = references[sample['family']]
        rows = [(i, row) for i, row in enumerate(chars)
                if abs(row['originMm'][1] - sample['baseline'][1]) <= POSITION_TOLERANCE_MM]
        assert len(rows) == 4, ('Missing/shifted text sample', sample['family'], sample['baseline'], len(rows))
        rows.sort(key=lambda pair: pair[1]['originMm'][0])
        expected_advance = reference['HAdvancePerEm'] / reference['capRatio'] * sample['height'] * sample['widthFactor']
        for offset, (index, row) in enumerate(rows):
            assert index not in used
            used.add(index)
            assert normalized_face(row['face']) == reference['faceKey'], ('Wrong PDF face', row['face'], reference['postscriptName'])
            black_opaque(row)
            assert row['type'] == 0, 'Text must paint visible fill glyphs'
            near(row['originMm'][0], sample['baseline'][0] + offset * expected_advance, POSITION_TOLERANCE_MM)
            near(row['originMm'][1], sample['baseline'][1], POSITION_TOLERANCE_MM)
            if offset:
                near(row['originMm'][0] - rows[offset - 1][1]['originMm'][0], expected_advance, ADVANCE_TOLERANCE_MM)
        actual_span = rows[-1][1]['originMm'][0] - rows[0][1]['originMm'][0]
        near(actual_span, 3 * expected_advance, ADVANCE_TOLERANCE_MM)
        measurements.append({'role': 'Registered text glyph origins', 'family': sample['family'],
            'literalText': 'HHHH', 'declaredCapHeightMm': 5, 'widthFactor': sample['widthFactor'],
            'baselineMm': sample['baseline'], 'expectedHAdvanceMm': expected_advance,
            'actualOriginsMm': [row['originMm'] for _, row in rows], 'firstToFourthOriginMm': actual_span,
            'fontFileSHA256': reference['sha256'], 'pdfFace': rows[0][1]['face'],
            'reportedFontSizesMm': [row['reportedSizeMm'] for _, row in rows],
            'inkHeightQualification': 'Not inferred from trace bounding box or nominal cap-height'})
    assert len(used) == len(chars)
    assert len(page['strokes']) == 6
    used_strokes = set()
    for label, segment, width in [('100 mm paper ruler', RULER, .35),
                                   ('Template divider', DIVIDER, None)] + [
                                       ('Template border edge ' + str(i + 1), segment, None) for i, segment in enumerate(BORDER)]:
        index, row = match_segment(page['strokes'], segment)
        assert index not in used_strokes
        used_strokes.add(index)
        black_opaque(row)
        length = math.dist(row['a'], row['b'])
        near(length, math.dist(*segment), ADVANCE_TOLERANCE_MM)
        if width is not None:
            near(row['widthMm'], width, STROKE_TOLERANCE_MM)
        measurements.append({'role': label, 'expectedEndpointsMm': segment,
            'actualEndpointsMm': [row['a'], row['b']], 'actualLengthMm': length,
            'strokeWidthMm': row['widthMm']})
    foreground = [row['seqno'] for row in chars + page['strokes']]
    for row in page['backgrounds']:
        assert row['opacity'] == 1 and row['seqno'] < min(foreground)
        for actual, expected in zip(row['boundsMm'], (0, 0, 297, 210)):
            near(actual, expected, PAGE_TOLERANCE_MM)
    return measurements


def negative_controls(pages, references):
    def reject(label, bad):
        try:
            validate_pages(bad, references)
        except AssertionError as error:
            return {'control': label, 'rejected': True, 'reason': str(error), 'actualPDFBytesModified': False}
        raise AssertionError(('Reader accepted negative control', label))
    controls = [reject('Missing page', []), reject('Duplicate page', pages + pages)]
    mutations = [
        ('Wrong page dimensions', lambda p: p.update(sizeMm=(298, 210))),
        ('Missing glyph', lambda p: p['characters'].pop()),
        ('Wrong character content', lambda p: p['characters'][0].update(unicode=73)),
        ('Wrong font face', lambda p: p['characters'][0].update(face='WrongFont-Regular')),
        ('Shifted baseline', lambda p: p['characters'][0].update(originMm=(20, 51))),
        ('Wrong glyph advance', lambda p: p['characters'][1].update(originMm=(30, 50))),
        ('Transparent glyph', lambda p: p['characters'][0].update(opacity=0)),
        ('Unknown glyph opacity', lambda p: p['characters'][0].update(opacity=None)),
        ('Invisible glyph paint', lambda p: p['characters'][0].update(type=3)),
        ('Gray glyph color', lambda p: p['characters'][0].update(color=(.5, .5, .5))),
        ('Raster surrogate', lambda p: p.update(images=1)),
    ]
    for label, mutate in mutations:
        bad = copy.deepcopy(pages)
        mutate(bad[0])
        controls.append(reject(label, bad))
    bad = copy.deepcopy(pages)
    for row in bad[0]['characters']:
        if abs(row['originMm'][1] - 110) <= POSITION_TOLERANCE_MM:
            row['originMm'] = (20 + (row['originMm'][0] - 20) / .75, row['originMm'][1])
    controls.append(reject('Condensed width factor replaced by one', bad))
    bad = copy.deepcopy(pages)
    index, _ = match_segment(bad[0]['strokes'], RULER)
    del bad[0]['strokes'][index]
    controls.append(reject('Missing calibration ruler', bad))
    bad = copy.deepcopy(pages)
    _, ruler = match_segment(bad[0]['strokes'], RULER)
    ruler['b'] = (130, 150)
    controls.append(reject('Wrong ruler physical length', bad))
    bad = copy.deepcopy(pages)
    maximum = max(row['seqno'] for row in bad[0]['characters'] + bad[0]['strokes'])
    bad[0]['backgrounds'].append({'boundsMm': (0, 0, 297, 210), 'opacity': 1, 'seqno': maximum + 1})
    controls.append(reject('Late white page overpaint', bad))
    return controls


def main():
    global SAMPLES
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', choices=['regular', 'architectural'], default='regular')
    for name in ['producer', 'receipt', 'render-directory']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    assert not args.receipt.exists() and not args.render_directory.exists(), 'Preserve prior evidence'
    producer = json.loads(args.producer.read_text(encoding='utf-8-sig'))
    reference_reader = font_reference
    selected_families = tuple(FONT_FILES)
    if args.profile == 'architectural':
        from architectural_font_reference import font_reference as architectural_reference
        reference_reader = architectural_reference
        selected_families = ('ARCHITXT', 'Technic')
        SAMPLES = [{**row, 'family': selected_families[1] if index == 1 else selected_families[0]}
                   for index, row in enumerate(SAMPLES)]
    outputs = producer['outputs']
    bindings = {'producer': {'file': str(args.producer), 'sha256': sha(args.producer)}}
    for name in ['native', 'pdf']:
        file = Path(outputs[name])
        assert sha(file) == outputs[name + 'SHA256']
        bindings[name] = {'file': str(file), 'sha256': sha(file)}
    report = {'format': 'LinecraftIndependentFontLayoutPDF/1', 'status': 'running', 'profile': args.profile,
        'startedAt': datetime.now(timezone.utc).isoformat(), 'bindings': bindings,
        'scope': 'Actual PDF, literal glyph origins and faces, installed-font independent advances, template geometry and paint; no copied fonts, native consumer or general font/client parity claim.',
        'tolerancesMm': {'position': POSITION_TOLERANCE_MM, 'advance': ADVANCE_TOLERANCE_MM,
                         'page': PAGE_TOLERANCE_MM, 'rulerStroke': STROKE_TOLERANCE_MM},
        'measurements': [], 'negativeControls': [], 'renders': []}
    try:
        assert producer['status'] == 'passed'
        assert producer.get('fontProfile', 'regular') == args.profile
        native_document(json.loads(Path(outputs['native']).read_text(encoding='utf-8-sig')))
        references = {family: reference_reader(family, producer['fontInventory']) for family in selected_families}
        report['fontReferences'] = references
        report['inventoryOnlyFaces'] = [
            {key: row[key] for key in ['family', 'fontFamily', 'bold', 'italic', 'available', 'sha256'] if key in row}
            for row in producer['fontInventory']
            if not (row.get('family', row.get('fontFamily')) in selected_families
                    and row.get('bold') is False and row.get('italic') is False)]
        pdf = fitz.open(outputs['pdf'])
        pages = [extract(page) for page in pdf]
        report['measurements'] = validate_pages(pages, references)
        report['negativeControls'] = negative_controls(pages, references)
        args.render_directory.mkdir()
        for label, scale, clip in [('full', 1.5, None),
                                   ('typography', 3, fitz.Rect(10 / MM, 30 / MM, 150 / MM, 125 / MM))]:
            file = args.render_directory / (label + '.png')
            pdf[0].get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False).save(file)
            report['renders'].append({'kind': label, 'file': str(file), 'sha256': sha(file)})
        for row in bindings.values():
            assert sha(row['file']) == row['sha256']
        for family, reference in references.items():
            assert sha(reference['sourceFile'] if args.profile == 'architectural' else FONT_FILES[family]) == reference['sha256']
        report['visualReview'] = 'Pending fresh full and typography render inspection'
        report['notQualified'] = ['Actual ink cap-height from glyph outlines', 'Other glyphs, rich text and font variants',
            'ARCHITXT/Technic appearance or general six-family parity', 'Native CAD edit/save or client/template/DWT fidelity']
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
