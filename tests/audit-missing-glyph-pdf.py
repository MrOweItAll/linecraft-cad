"""Independent missing-profile-glyph diagnostics and actual PDF preservation audit.

No Linecraft runtime import. Existing registered Technic is read in place by the
independent SFNT reference; no font assets or outlines are copied. Empty-set ink,
fallback identity and character spacing are observations, not qualified fidelity.
"""
import argparse
import copy
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import fitz
from architectural_font_reference import SFNT, font_reference, normalized_face

MM = 25.4 / 72
TEXT = 'H\u2205H'
ANNOTATIONS = ['glyph-text', 'glyph-mtext', 'glyph-rich', 'glyph-leader', 'glyph-dimension']
POSITION_TOLERANCE_MM = .04
LENGTH_TOLERANCE_MM = .02
PAGE_TOLERANCE_MM = .3
STROKE_TOLERANCE_MM = .005
RULER = ((20, 150), (120, 150))


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def near(actual, expected, tolerance):
    assert isinstance(actual, (int, float)) and not isinstance(actual, bool)
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected, tolerance)


def unmapped_reference(inventory):
    reference = font_reference('Technic', inventory)
    file = Path(reference['sourceFile'])
    data = file.read_bytes()
    assert hashlib.sha256(data).hexdigest() == reference['sha256']
    font = SFNT(data)
    at, length = font.table('cmap', 4)
    count = font.u16(at + 2)
    assert 0 < count <= 128 and 4 + count * 8 <= length
    records = []
    for index in range(count):
        position = at + 4 + index * 8
        platform, encoding = font.u16(position), font.u16(position + 2)
        start = at + font.u32(position + 4)
        assert at <= start and start + 2 <= at + length
        form = font.u16(start)
        row = {'platform': platform, 'encoding': encoding, 'format': form}
        if platform == 0 or platform == 3 and encoding in [0, 1, 10]:
            assert form in [4, 12]
            assert font.cmap_lookup(start, at + length, 0x2205) == 0
            row['proof'] = 'U+2205 maps to glyph0'
        elif platform == 1 and encoding == 0:
            assert form == 0 and font.u16(start + 2) >= 262
            assert start + font.u16(start + 2) <= at + length
            try:
                encoded = '\u2205'.encode('mac_roman')
            except UnicodeEncodeError:
                row['proof'] = 'U+2205 is not representable in Macintosh Roman'
            else:
                assert len(encoded) == 1 and data[start + 6 + encoded[0]] == 0
                row['proof'] = 'Macintosh Roman mapping is glyph0'
        else:
            raise AssertionError(('Unverified cmap', platform, encoding, form))
        records.append(row)
    independent = fitz.Font(fontfile=str(file))
    assert independent.has_glyph(0x2205) == 0
    reference['missingCharacter'] = {'codepoint': 0x2205, 'literal': '\u2205',
        'allCmapRecordsAccountedFor': count, 'records': records,
        'MuPDFGlyph': 0, 'requiredNativeAndPDFText': TEXT,
        'scope': 'No cmap representation; no claim that an unencoded outline is absent'}
    return reference


def native_document(document):
    assert document['entities'] == []
    assert len(document['layouts']) == 1
    layout = document['layouts'][0]
    assert layout['id'] == 'font-sheet' and layout['name'] == 'SYNTHETIC FONT SHEET'
    assert layout['paper']['widthMm'] == 297 and layout['paper']['heightMm'] == 210
    assert layout['viewports'] == []
    entities = {row['id']: row for row in layout['entities']}
    assert len(entities) == len(layout['entities'])
    expected_types = {'glyph-text': 'TEXT', 'glyph-mtext': 'MTEXT', 'glyph-rich': 'MTEXT',
                      'glyph-leader': 'LEADER', 'glyph-dimension': 'DIMENSION'}
    for key in ANNOTATIONS:
        assert entities[key]['type'] == expected_types[key]
        field = 'textOverride' if key == 'glyph-dimension' else 'text'
        assert entities[key][field] == TEXT
    assert entities['glyph-rich']['richText']['source'] == TEXT
    styles = {row['name']: row for row in document['textStyles']}
    for key in ANNOTATIONS[:-1]:
        style = styles[entities[key]['style']]
        assert style['fontFamily'] == 'Technic' and style['metrics'] == 'registered'
    dimension = entities['glyph-dimension']
    dimension_style = next(row for row in document['dimStyles'] if row['name'] == dimension['style'])
    assert styles[dimension_style['textStyle']]['fontFamily'] == 'Technic'
    assert dimension_style['scale'] == 1


def mm_point(point):
    return tuple(float(value) * MM for value in point)


def extract(page):
    result = {'sizeMm': (page.rect.width * MM, page.rect.height * MM),
              'characters': [], 'strokes': [], 'whiteFills': [], 'images': len(page.get_image_info())}
    for trace in page.get_texttrace():
        for char in trace['chars']:
            result['characters'].append({'unicode': char[0], 'originMm': mm_point(char[2]),
                'face': trace['font'], 'type': trace.get('type'), 'opacity': trace.get('opacity'),
                'color': trace.get('color'), 'seqno': trace.get('seqno')})
    for drawing in page.get_drawings():
        if drawing['type'] in ['s', 'fs']:
            for item in drawing['items']:
                if item[0] == 'l':
                    result['strokes'].append({'a': mm_point(item[1]), 'b': mm_point(item[2]),
                        'widthMm': drawing['width'] * MM, 'color': drawing.get('color'),
                        'opacity': drawing.get('stroke_opacity'), 'seqno': drawing.get('seqno')})
        if drawing['type'] in ['f', 'fs'] and drawing.get('fill') and min(drawing['fill']) > .99:
            result['whiteFills'].append({'boundsMm': tuple(value * MM for value in drawing['rect']),
                'opacity': drawing.get('fill_opacity'), 'seqno': drawing.get('seqno')})
    return result


def opaque_black(row):
    assert row['opacity'] == 1 and isinstance(row['seqno'], int)
    assert row['color'] and all(isinstance(value, (int, float)) and math.isfinite(value)
                                and 0 <= value < .01 for value in row['color'])


def ruler(strokes):
    rows = [row for row in strokes if min(
        math.dist(row['a'], RULER[0]) + math.dist(row['b'], RULER[1]),
        math.dist(row['a'], RULER[1]) + math.dist(row['b'], RULER[0])) <= POSITION_TOLERANCE_MM]
    assert len(rows) == 1, ('Missing/duplicate/shifted ruler', len(rows))
    return rows[0]


def validate(observation, reference):
    warnings, reported = observation['warnings'], observation['reportedWarnings']
    assert warnings == reported
    assert isinstance(warnings, list) and len(warnings) == 5 and all(isinstance(row, str) for row in warnings)
    for warning in warnings:
        assert sum(bool(re.search(r'(?<![\w-])' + re.escape(key) + r'(?![\w-])', warning)) for key in ANNOTATIONS) == 1
    measurements = []
    for key in ANNOTATIONS:
        pattern = re.compile(r'(?<![\w-])' + re.escape(key) + r'(?![\w-])')
        rows = [row for row in warnings if pattern.search(row)]
        assert len(rows) == 1, ('Missing/duplicate annotation diagnostic', key)
        assert 'missing-glyph:Technic' in rows[0]
        measurements.append({'role': 'Explicit missing-glyph diagnostic', 'annotationId': key, 'warning': rows[0]})
    assert len(observation['pages']) == 1
    page = observation['pages'][0]
    near(page['sizeMm'][0], 297, PAGE_TOLERANCE_MM)
    near(page['sizeMm'][1], 210, PAGE_TOLERANCE_MM)
    assert page['images'] == 0
    measurements.append({'role': 'Literal paper dimensions', 'actualSizeMm': page['sizeMm'], 'expectedSizeMm': [297, 210]})
    chars = page['characters']
    assert len(chars) == 15
    assert sum(row['unicode'] == 72 for row in chars) == 10
    assert sum(row['unicode'] == 0x2205 for row in chars) == 5
    for row in chars:
        opaque_black(row)
        assert row['type'] == 0
        assert isinstance(row['face'], str) and row['face']
        if row['unicode'] == 72:
            assert normalized_face(row['face']) == reference['faceKey']
    fallback = [row for row in chars if row['unicode'] == 0x2205]
    measurements.append({'role': 'Requested PDF Unicode and supported H face', 'HCount': 10,
        'emptySetCount': 5, 'requiredHFace': reference['postscriptName'],
        'missingCharacterFaceObservations': [{'face': row['face'], 'originMm': row['originMm']} for row in fallback],
        'notQualified': 'Unsupported empty-set shape, fallback identity and spacing are not inferred from Unicode preservation'})
    calibration = ruler(page['strokes'])
    opaque_black(calibration)
    near(math.dist(calibration['a'], calibration['b']), 100, LENGTH_TOLERANCE_MM)
    near(calibration['widthMm'], .35, STROKE_TOLERANCE_MM)
    foreground = [row['seqno'] for row in chars] + [calibration['seqno']]
    for white in page['whiteFills']:
        if all(abs(actual - expected) <= PAGE_TOLERANCE_MM for actual, expected in zip(white['boundsMm'], [0, 0, 297, 210])):
            assert white['seqno'] < min(foreground), 'Late white page overpaint'
    measurements.append({'role': '100 mm independent paper ruler', 'actualEndpointsMm': [calibration['a'], calibration['b']],
        'actualLengthMm': math.dist(calibration['a'], calibration['b']), 'strokeWidthMm': calibration['widthMm']})
    assert len(measurements) == 8
    return measurements


def negative_controls(observation, reference):
    controls = []
    def reject(name, mutate):
        bad = copy.deepcopy(observation)
        mutate(bad)
        try:
            validate(bad, reference)
        except AssertionError as error:
            controls.append({'control': name, 'rejected': True, 'reason': str(error), 'actualPDFBytesModified': False})
            return
        raise AssertionError(('Reader accepted negative control', name))
    def both(value, transform):
        value['warnings'] = [transform(row) for row in value['warnings']]
        value['reportedWarnings'] = list(value['warnings'])
    reject('Missing diagnostics', lambda value: value.update(warnings=[], reportedWarnings=[]))
    reject('Duplicate diagnostic', lambda value: value.update(warnings=value['warnings'] + [value['warnings'][0]], reportedWarnings=value['reportedWarnings'] + [value['reportedWarnings'][0]]))
    reject('Wrong diagnostic family', lambda value: both(value, lambda row: row.replace('missing-glyph:Technic', 'missing-glyph:Arial')))
    reject('Wrong annotation ID', lambda value: both(value, lambda row: row.replace('glyph-text', 'unrelated-annotation')))
    reject('Response/report warning disagreement', lambda value: value['warnings'].pop())
    reject('Missing page', lambda value: value.update(pages=[]))
    reject('Duplicate page', lambda value: value['pages'].append(copy.deepcopy(value['pages'][0])))
    reject('Wrong paper dimensions', lambda value: value['pages'][0].update(sizeMm=(298, 210)))
    reject('Missing Unicode character', lambda value: value['pages'][0]['characters'].pop())
    reject('Wrong empty-set Unicode', lambda value: next(row for row in value['pages'][0]['characters'] if row['unicode'] == 0x2205).update(unicode=73))
    reject('Wrong supported H face', lambda value: next(row for row in value['pages'][0]['characters'] if row['unicode'] == 72).update(face='WrongFont'))
    reject('Transparent text', lambda value: value['pages'][0]['characters'][0].update(opacity=0))
    reject('Gray text', lambda value: value['pages'][0]['characters'][0].update(color=(.5, .5, .5)))
    reject('Raster surrogate', lambda value: value['pages'][0].update(images=1))
    reject('Missing ruler', lambda value: value['pages'][0]['strokes'].remove(ruler(value['pages'][0]['strokes'])))
    reject('Wrong ruler length', lambda value: ruler(value['pages'][0]['strokes']).update(b=(130, 150)))
    reject('Wrong ruler stroke', lambda value: ruler(value['pages'][0]['strokes']).update(widthMm=.7))
    reject('Late white overpaint', lambda value: value['pages'][0]['whiteFills'].append({'boundsMm': (0, 0, 297, 210), 'opacity': 1, 'seqno': 1000000}))
    assert len(controls) == 18
    return controls


def main():
    parser = argparse.ArgumentParser()
    for name in ['producer', 'receipt', 'render-directory']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    assert not args.receipt.exists() and not args.render_directory.exists(), 'Preserve prior evidence'
    producer = json.loads(args.producer.read_text(encoding='utf-8-sig'))
    outputs = producer['outputs']
    bindings = {'producer': {'file': str(args.producer), 'sha256': sha(args.producer)}}
    for name in ['native', 'pdf']:
        assert sha(outputs[name]) == outputs[name + 'SHA256']
        bindings[name] = {'file': outputs[name], 'sha256': sha(outputs[name])}
    report = {'format': 'LinecraftIndependentMissingGlyphPDF/1', 'status': 'running',
        'startedAt': datetime.now(timezone.utc).isoformat(), 'bindings': bindings,
        'measurements': [], 'negativeControls': [], 'renders': [],
        'scope': 'Missing-glyph diagnostic and Unicode preservation; no unsupported-glyph shape/spacing or general face fidelity claim',
        'tolerancesMm': {'position': POSITION_TOLERANCE_MM, 'length': LENGTH_TOLERANCE_MM,
                         'page': PAGE_TOLERANCE_MM, 'rulerStroke': STROKE_TOLERANCE_MM}}
    try:
        assert producer['status'] == 'passed'
        assert producer.get('fontProfile') == 'missing-glyph'
        native_document(json.loads(Path(outputs['native']).read_text(encoding='utf-8-sig')))
        reference = unmapped_reference(producer['fontInventory'])
        report['fontReference'] = reference  # sourceFile is PRIVATE evidence only.
        pdf = fitz.open(outputs['pdf'])
        observation = {'warnings': producer['plotResponse']['warnings'],
                       'reportedWarnings': producer['plotResponse']['report']['warnings'],
                       'pages': [extract(page) for page in pdf]}
        report['observations'] = observation
        args.render_directory.mkdir()
        if len(pdf) == 1:
            for kind, scale, clip in [('full', 1.5, None), ('annotations', 2.5, fitz.Rect(10 / MM, 25 / MM, 280 / MM, 140 / MM))]:
                file = args.render_directory / (kind + '.png')
                pdf[0].get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False).save(file)
                report['renders'].append({'kind': kind, 'file': str(file), 'sha256': sha(file)})
        report['measurements'] = validate(observation, reference)
        report['negativeControls'] = negative_controls(observation, reference)
        for bound in bindings.values():
            assert sha(bound['file']) == bound['sha256']
        assert sha(reference['sourceFile']) == reference['sha256']
        report['visualReview'] = 'Pending fresh full/annotation render review'
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
