"""Independent stdlib reader of owned synthetic workload artifacts; no product imports."""
import argparse
import collections
import copy
import hashlib
import json
from pathlib import Path

IDS = ('survey', 'residential', 'multiViewport', 'heavy')
ORDINARY = ('open', 'selectAll', 'clearSelection', 'pan', 'zoom', 'saveAs', 'reopen')
LAYOUT = ('open', 'selectAll', 'clearSelection', 'switchLayoutB', 'switchLayoutC', 'returnLayoutA', 'pan', 'zoom', 'saveAs', 'reopen')


def p(x, y):
    return {'x': x, 'y': y}


def rectangle(x, y, w, h):
    return [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)]


def slots(e):
    if e['type'] == 'LINE':
        return [e['start'], e['end']]
    if e['type'] == 'PLINE':
        return e['points']
    if e['type'] == 'HATCH':
        return e['boundary']['points']
    return []


def coordinate_sum(points):
    return [sum(v[k] for v in points) for k in ('x', 'y')]


def area(points):
    return abs(sum(v['x'] * points[(i + 1) % len(points)]['y'] - points[(i + 1) % len(points)]['x'] * v['y'] for i, v in enumerate(points))) / 2


def selection_ids(key):
    if key == 'survey':
        return [value for i in range(1, 101) for value in (f'survey-parcel-{i:03}', f'survey-label-{i:03}')]
    if key == 'residential':
        return [value for i in range(1, 9) for value in ([f'room-{i}'] + [f'furniture-{i}-{j}' for j in range(4)] + [f'door-{i}', f'fill-{i}', f'room-label-{i}'])]
    if key == 'heavy':
        return [f'heavy-{i:05}' for i in range(10000)]
    return ['paper-ruler-a', 'paper-border-a', 'paper-label-a']


def validate_document(d, key):
    entities = d['entities']
    layouts = d.get('layouts', [])
    all_entities = entities + [e for layout in layouts for e in layout['entities']]
    assert all(not e.get('layoutId') for e in entities)
    assert len({e['id'] for e in all_entities}) == len(all_entities)
    expected = {'survey': {'PLINE': 100, 'TEXT': 100}, 'residential': {'PLINE': 40, 'ARC': 8, 'HATCH': 8, 'TEXT': 8}, 'multiViewport': {'LINE': 403, 'PLINE': 3, 'TEXT': 3}, 'heavy': {'LINE': 10000}}
    assert collections.Counter(e['type'] for e in all_entities) == expected[key]
    assert d['settings']['units'] == ('ft' if key in ('survey', 'residential') else 'in')
    if key != 'multiViewport':
        assert not layouts
        assert [e['id'] for e in entities] == selection_ids(key)
    if key == 'survey':
        for i in range(100):
            row, col = divmod(i, 10)
            parcel, label = entities[2 * i:2 * i + 2]
            assert parcel['closed'] is True
            assert parcel['points'] == rectangle(100 * col, 60 * row, 80, 50)
            assert label['position'] == p(100 * col + 10, 60 * row + 20)
            assert label['text'] == f'SYNTHETIC LOT {i + 1:03}'
        assert coordinate_sum([v for e in entities if e['type'] == 'PLINE' for v in e['points']]) == [196000, 118000]
        assert sum(area(e['points']) for e in entities if e['type'] == 'PLINE') == 400000
        assert coordinate_sum([e['position'] for e in entities if e['type'] == 'TEXT']) == [46000, 29000]
    elif key == 'residential':
        for i in range(8):
            x, y = 18 * (i % 4), 14 * (i // 4)
            room, *rest = entities[8 * i:8 * i + 8]
            assert room['points'] == rectangle(x, y, 16, 12) and room['closed'] is True
            for j in range(4):
                assert rest[j]['points'] == rectangle(x + 2 + 5 * (j % 2), y + 2 + 5 * (j // 2), 2, 3)
                assert rest[j]['closed'] is True
            arc, hatch, text = rest[4:]
            assert arc['center'] == p(x + 16, y + 3) and arc['radius'] == 3
            assert (arc['startAngle'], arc['sweepAngle']) == (90, 90)
            assert hatch['pattern'] == 'solid' and hatch['boundary']['closed'] is True
            assert hatch['boundary']['points'] == rectangle(x + 10, y + 7, 2, 2)
            assert text['position'] == p(x + 2, y + 8) and text['text'] == f'SYNTHETIC ROOM {i + 1}'
        assert coordinate_sum([v for e in entities for v in slots(e)]) == [6496, 2560]
        assert coordinate_sum([v for e in entities if e['type'] == 'PLINE' for v in slots(e)]) == [5280, 2080]
        assert sum(area(e['points']) for e in entities if e['type'] == 'PLINE') == 1728
        assert sum(area(e['boundary']['points']) for e in entities if e['type'] == 'HATCH') == 32
        assert coordinate_sum([e['position'] for e in entities if e['type'] == 'TEXT']) == [232, 120]
        assert coordinate_sum([e['center'] for e in entities if e['type'] == 'ARC']) == [344, 80]
    else:
        size, step, length, prefix, width = (100, 8, 6, 'heavy', 5) if key == 'heavy' else (20, 20, 16, 'model', 3)
        assert len(entities) == size * size
        for i, e in enumerate(entities):
            row, col = divmod(i, size)
            assert e['id'] == f'{prefix}-{i:0{width}}'
            assert e['start'] == p(step * col, step * row)
            assert e['end'] == p(step * col + length, step * row)
        assert coordinate_sum([e['start'] for e in entities]) == ([3960000, 3960000] if key == 'heavy' else [76000, 76000])
        assert coordinate_sum([e['end'] for e in entities]) == ([4020000, 3960000] if key == 'heavy' else [82400, 76000])
    if key == 'multiViewport':
        assert (d['activeSpace'], d['activeLayoutId'], d['activeViewportId']) == ('paper', 'sheet-a', None)
        layer = next(l for l in d['layers'] if l['name'] == 'Viewports')
        assert layer['locked'] is True and layer['visible'] is True
        assert [l['id'] for l in layouts] == ['sheet-a', 'sheet-b', 'sheet-c']
        viewport_ids = []
        for k, layout in enumerate(layouts):
            letter = 'abc'[k]
            assert len(layout['entities']) == 3 and len(layout['viewports']) == 6
            assert (layout['paper']['widthMm'], layout['paper']['heightMm']) == (420, 297)
            ruler, border, label = layout['entities']
            assert [e['id'] for e in layout['entities']] == [f'paper-ruler-{letter}', f'paper-border-{letter}', f'paper-label-{letter}']
            assert [ruler['start'], ruler['end']] == [p(10, 40), p(110, 40)]
            assert border['points'] == rectangle(10, 10, 400, 277) and border['closed'] is True
            assert label['position'] == p(20, 20)
            for i, v in enumerate(layout['viewports']):
                row, col = divmod(i, 3)
                viewport_ids.append(v['id'])
                assert v['id'] == f'view-{letter}-{i}'
                assert v['frame'] == {'x': 20 + 130 * col, 'y': 60 + 90 * row, 'width': 110, 'height': 70}
                assert v['modelCenter'] == {'x': 80 + 80 * col, 'y': 100 + 120 * row, 'z': 0}
                assert v['scaleDenominator'] == (24, 48, 96)[k]
                assert v['layer'] == 'Viewports' and v['locked'] is True and v['plotBorder'] is False
        assert len(set(viewport_ids)) == 18 and not set(viewport_ids).intersection(e['id'] for e in all_entities)
        assert coordinate_sum([v for l in layouts for e in l['entities'] for v in slots(e)]) == [2880, 2022]
    expected_slots = {'survey': 400, 'residential': 192, 'multiViewport': 818, 'heavy': 20000}
    assert sum(len(slots(e)) for e in all_entities) == expected_slots[key]


def validate_plan(rows):
    expected = set()
    for key in IDS:
        for process in range(3):
            expected.add((key, process, 'startup', -1, 'readiness'))
            expected.add((key, process, 'cold-first-open', -1, 'open'))
            for round_index in range(6):
                for operation in LAYOUT if key == 'multiViewport' else ORDINARY:
                    expected.add((key, process, 'warmup' if round_index == 0 else 'measured-warm', round_index, operation))
    assert len(rows) == len(expected) == 582
    assert all(set(row) == {'workload', 'process', 'phase', 'round', 'operation'} for row in rows)
    actual = [(v['workload'], v['process'], v['phase'], v['round'], v['operation']) for v in rows]
    assert len(set(actual)) == 582 and set(actual) == expected
    assert collections.Counter(v['phase'] for v in rows) == {'startup': 12, 'cold-first-open': 12, 'warmup': 93, 'measured-warm': 465}


def validate_selection(actual, key):
    assert actual == selection_ids(key)


def definition_only(producer):
    assert producer['definitionOnly'] is True and producer['applicationExecuted'] is False
    assert producer['observedTimings'] == []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--artifacts', required=True, type=Path)
    parser.add_argument('--receipt', required=True, type=Path)
    args = parser.parse_args()
    directory = args.artifacts.resolve()
    producer = json.loads((directory / 'workload-artifacts.json').read_bytes())
    definition_only(producer)
    assert len(producer['names']) == len(producer['records']) == 32
    assert all(r['outcome'] == 'pass' for r in producer['records'])
    loaded, tests = {}, []
    for name, info in producer['files'].items():
        assert Path(name).name == name and name not in ('.', '..')
        raw = (directory / name).read_bytes()
        assert len(raw) == info['bytes'] and hashlib.sha256(raw).hexdigest() == info['sha256']
        loaded[name] = json.loads(raw)
    assert set(loaded) == {f'{key}-{kind}.linecraft' for key in IDS for kind in ('raw', 'canonical')} | {'planned-rows.json'}
    def check(name, function):
        function()
        tests.append({'name': name, 'status': 'passed'})
    def rejected(name, function):
        try:
            function()
        except (AssertionError, ValueError, KeyError):
            tests.append({'name': name, 'status': 'passed', 'semanticCorruptCopyRejected': True})
        else:
            raise AssertionError('Corrupt copy was accepted: ' + name)
    for key in IDS:
        for kind in ('raw', 'canonical'):
            check(f'{key} {kind} independent literal document', lambda key=key, kind=kind: validate_document(loaded[f'{key}-{kind}.linecraft'], key))
    check('All582 planned keys, phases and operations independently match', lambda: validate_plan(loaded['planned-rows.json']))
    def selections():
        for key in IDS:
            record = next(r for r in producer['records'] if r['name'] == key + ' actual core selection scope and ESC preserve serialization')
            validate_selection(record['selectionIds'], key)
    check('Four actual headless selection snapshots match independent IDs', selections)
    changes = [
        ('survey vertex', 'survey', lambda d: d['entities'][22]['points'][1].__setitem__('x', -1)),
        ('survey duplicate ID', 'survey', lambda d: d['entities'][2].__setitem__('id', d['entities'][0]['id'])),
        ('residential radius', 'residential', lambda d: d['entities'][5].__setitem__('radius', 4)),
        ('residential fill', 'residential', lambda d: d['entities'][6]['boundary']['points'][2].__setitem__('y', -1)),
        ('room closed flag', 'residential', lambda d: d['entities'][0].__setitem__('closed', False)),
        ('furniture closed flag', 'residential', lambda d: d['entities'][1].__setitem__('closed', False)),
        ('inactive viewport missing', 'multiViewport', lambda d: d['layouts'][2]['viewports'].pop()),
        ('paper owner changed', 'multiViewport', lambda d: d['layouts'][1]['entities'].append(d['layouts'][0]['entities'].pop())),
        ('viewport layer unlocked', 'multiViewport', lambda d: d['layers'][1].__setitem__('locked', False)),
        ('heavy unit changed', 'heavy', lambda d: d['settings'].__setitem__('units', 'ft')),
        ('heavy last endpoint changed', 'heavy', lambda d: d['entities'][-1]['end'].__setitem__('x', -1)),
    ]
    for name, key, change in changes:
        altered = copy.deepcopy(loaded[f'{key}-canonical.linecraft'])
        change(altered)
        rejected(name, lambda altered=altered, key=key: validate_document(altered, key))
    rows = copy.deepcopy(loaded['planned-rows.json'])
    rows[1] = copy.deepcopy(rows[0])
    rejected('Duplicate/drop planned key at unchanged582 count', lambda: validate_plan(rows))
    rows = copy.deepcopy(loaded['planned-rows.json'])
    rows[2]['operation'] = 'inventedOperation'
    rejected('Wrong planned operation at unchanged582 count', lambda: validate_plan(rows))
    rejected('Viewport proxy cannot replace a paper selection', lambda: validate_selection(['paper-ruler-a', 'paper-border-a', 'viewport:view-a-0'], 'multiViewport'))
    altered = copy.deepcopy(producer)
    altered['observedTimings'] = [1]
    rejected('Observed timing cannot become definition-only evidence', lambda: definition_only(altered))
    receipt = {'format': 'LinecraftPerformanceWorkloadAudit/1', 'status': 'passed', 'total': len(tests), 'passed': len(tests), 'semanticCorruptCopiesRejected': sum(bool(t.get('semanticCorruptCopyRejected')) for t in tests), 'tests': tests, 'auditorSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'producerSHA256': hashlib.sha256((directory / 'workload-artifacts.json').read_bytes()).hexdigest(), 'observedPerformanceSamples': 0, 'applicationExecuted': False, 'limits': 'Independent stdlib file/hash/literal-geometry/ownership/selection/planned-key reader. No product imports, rendering, timing, memory, native or application qualification.'}
    with args.receipt.open('x', encoding='utf-8') as stream:
        json.dump(receipt, stream, indent=2)
        stream.write('\n')
    print(f"{len(tests)}/{len(tests)} independent checks passed;0 observed timings")


if __name__ == '__main__':
    main()
