"""Independent raw-JSON geometry, navigation and timing-protocol audit.

No Linecraft imports or geometry/normalization routines are used. Timings are
observations of the declared hidden application boundary, not approved usability
thresholds, physical input latency or compositor/present measurements.
"""
import argparse
import copy
import hashlib
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path

OPERATIONS = ['open', 'selectAll', 'clearSelection', 'pan', 'zoom', 'saveAs', 'reopen']
CHECKPOINTS = ['open', 'selected', 'cleared', 'pan', 'zoom', 'saved', 'reopened']
IDS = ['large-' + str(index) for index in range(2000)]
VIEWPORT_TOLERANCE = 1e-9
INITIAL_VIEWPORT = {'center': {'x': 599, 'y': 114}, 'scale': .5}


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def finite_positive(value):
    assert isinstance(value, (int, float)) and not isinstance(value, bool)
    assert math.isfinite(value) and value > 0, value


def near(actual, expected):
    assert isinstance(actual, (int, float)) and not isinstance(actual, bool)
    assert math.isfinite(actual) and abs(actual - expected) <= VIEWPORT_TOLERANCE, (actual, expected)


def literal_geometry(document):
    assert isinstance(document, dict)
    assert document['format'] == 'Linecraft/1'
    assert document['settings']['units'] == 'in'
    assert document['workspace'] == '2d' and document['activeSpace'] == 'model'
    assert document['activeLayoutId'] is None and document['activeViewportId'] is None
    assert document['layouts'] == []
    entities = document['entities']
    assert len(entities) == 2000
    assert [row['id'] for row in entities] == IDS
    sums = [0, 0, 0, 0]
    total_length = 0
    bounds = [math.inf, math.inf, -math.inf, -math.inf]
    for index, entity in enumerate(entities):
        x, y = (index % 100) * 12, (index // 100) * 12
        assert entity['type'] == 'LINE' and entity['layer'] == '0'
        assert entity['start'] == {'x': x, 'y': y}
        assert entity['end'] == {'x': x + 10, 'y': y}
        assert not entity.get('layoutId')
        a, b = entity['start'], entity['end']
        for point in [a, b]:
            assert set(point) == {'x', 'y'}
            assert all(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) for value in point.values())
        length = math.hypot(b['x'] - a['x'], b['y'] - a['y'])
        assert length == 10
        total_length += length
        sums = [sums[0] + a['x'], sums[1] + a['y'], sums[2] + b['x'], sums[3] + b['y']]
        bounds = [min(bounds[0], a['x'], b['x']), min(bounds[1], a['y'], b['y']),
                  max(bounds[2], a['x'], b['x']), max(bounds[3], a['y'], b['y'])]
    assert sums == [1188000, 228000, 1208000, 228000]
    assert total_length == 20000
    assert bounds == [0, 0, 1198, 228]
    return {'entityCount': 2000, 'columns': 100, 'rows': 20, 'lineLengthInches': 10,
            'totalLengthInches': total_length, 'boundsInches': bounds,
            'coordinateSums': sums, 'idOrder': 'large-0 through large-1999'}


def viewport(document, expected):
    view = document['viewport']
    assert set(view) == {'center', 'scale'} and set(view['center']) == {'x', 'y'}
    near(view['center']['x'], expected['center']['x'])
    near(view['center']['y'], expected['center']['y'])
    near(view['scale'], expected['scale'])


def without_viewport(document):
    return {key: value for key, value in document.items() if key != 'viewport'}


def validate(observation):
    producer = observation['producer']
    assert producer['status'] == 'passed'
    assert producer['variant'] in ['source', 'unpacked']
    protocol = producer['protocol']
    assert type(protocol['warmupRounds']) is int and protocol['warmupRounds'] == 1
    assert type(protocol['measuredRounds']) is int and protocol['measuredRounds'] == 5
    assert protocol['operations'] == OPERATIONS
    assert protocol['panDeltaCss'] == {'dx': 24, 'dy': 12}
    assert protocol['wheelDeltaY'] == -80
    canvas = producer['canvas']
    for key in ['width', 'height', 'dpr']:
        finite_positive(canvas[key])
    reference = observation['input']
    fixture = literal_geometry(reference)
    assert reference['viewport'] == INITIAL_VIEWPORT
    rounds = producer['rounds']
    assert len(rounds) == 6 and len(observation['states']) == 6
    measurements, transitions = [], []
    raw = {name: {'actionRoundTripMs': [], 'throughFrameDrainMs': []} for name in OPERATIONS}
    for index, round_data in enumerate(rounds):
        assert type(round_data['index']) is int and round_data['index'] == index
        assert round_data['warmup'] is (index == 0)
        samples = round_data['samples']
        assert len(samples) == 7 and [row['operation'] for row in samples] == OPERATIONS
        for sample in samples:
            action, drained = sample['actionRoundTripMs'], sample['throughFrameDrainMs']
            finite_positive(action)
            finite_positive(drained)
            assert drained >= action, ('Frame boundary precedes action boundary', sample)
            measurements.append({'round': index, 'warmup': index == 0, **sample})
            if index > 0:
                for metric in ['actionRoundTripMs', 'throughFrameDrainMs']:
                    raw[sample['operation']][metric].append(sample[metric])
        checkpoints = round_data['checkpoints']
        assert set(checkpoints) == set(CHECKPOINTS)
        states = observation['states'][index]
        assert set(states) == set(CHECKPOINTS)
        for state in states.values():
            literal_geometry(state)
        assert states['open'] == reference
        assert states['selected'] == reference and checkpoints['selected']['selectionIds'] == IDS
        assert states['cleared'] == reference and checkpoints['cleared']['selectionIds'] == []
        navigation = round_data['navigation']
        assert navigation['panDeltaCss'] == {'dx': 24, 'dy': 12}
        expected_pan = {'center': {'x': 599 - 24 / .5, 'y': 114 + 12 / .5}, 'scale': .5}
        assert without_viewport(states['pan']) == without_viewport(reference)
        viewport(states['pan'], expected_pan)
        wheel = navigation['wheel']
        assert wheel['deltaY'] == -80
        assert wheel['width'] == canvas['width'] and wheel['height'] == canvas['height']
        anchor = wheel['anchorCss']
        assert set(anchor) == {'x', 'y'}
        assert all(isinstance(anchor[key], (int, float)) and not isinstance(anchor[key], bool)
                   and math.isfinite(anchor[key]) for key in ['x', 'y'])
        assert 0 <= anchor['x'] <= wheel['width'] and 0 <= anchor['y'] <= wheel['height']
        factor = math.exp(.12)
        new_scale = .5 * factor
        offset_x, offset_y = anchor['x'] - wheel['width'] / 2, anchor['y'] - wheel['height'] / 2
        world_x = expected_pan['center']['x'] + offset_x / .5
        world_y = expected_pan['center']['y'] - offset_y / .5
        expected_zoom = {'center': {'x': world_x - offset_x / new_scale,
                                    'y': world_y + offset_y / new_scale}, 'scale': new_scale}
        assert without_viewport(states['zoom']) == without_viewport(reference)
        viewport(states['zoom'], expected_zoom)
        assert states['saved'] == states['zoom'], 'Save changed complete drawing state'
        assert states['reopened'] == states['zoom'], 'Reopen changed complete saved drawing state'
        transitions.append({'round': index, 'panExpected': expected_pan,
                            'zoomExpected': expected_zoom, 'wheelFactor': factor,
                            'completeSavedAndReopenedStateMatches': True})
    expected_summary = {}
    assert set(producer['summary']) == set(OPERATIONS)
    for operation, metrics in raw.items():
        expected_summary[operation] = {}
        assert set(producer['summary'][operation]) == {'actionRoundTripMs', 'throughFrameDrainMs'}
        for name, samples in metrics.items():
            assert len(samples) == 5
            expected = {'min': min(samples), 'median': statistics.median(samples), 'max': max(samples)}
            actual = producer['summary'][operation][name]
            assert set(actual) == {'min', 'median', 'max'}
            for value in actual.values():
                finite_positive(value)
            assert actual == expected, ('Incorrect summary or warmup contamination', operation, name, actual, expected)
            expected_summary[operation][name] = expected
    assert len(measurements) == 42 and len(transitions) == 6
    return fixture, measurements, transitions, expected_summary


def copied_observation(original):
    # Producer metadata is small. Full entity arrays stay shared unless the
    # selected control explicitly changes one document; actual files are untouched.
    return {'producer': copy.deepcopy(original['producer']), 'input': original['input'],
            'states': [dict(row) for row in original['states']]}


def negative_controls(observation):
    result = []
    def reject(name, mutate):
        bad = copied_observation(observation)
        mutate(bad)
        try:
            validate(bad)
        except (AssertionError, KeyError, ValueError, TypeError) as error:
            result.append({'control': name, 'rejected': True, 'reason': str(error),
                           'actualProducerOrDrawingBytesModified': False})
            return
        raise AssertionError(('Reader accepted negative control', name))
    def edited_state(value, checkpoint):
        document = copy.deepcopy(value['states'][0][checkpoint])
        value['states'][0][checkpoint] = document
        return document
    reject('Missing entity', lambda value: edited_state(value, 'open')['entities'].pop())
    reject('Wrong line length', lambda value: edited_state(value, 'open')['entities'][0]['end'].update(x=11))
    reject('Duplicate entity identity', lambda value: edited_state(value, 'open')['entities'][1].update(id='large-0'))
    reject('Wrong model units', lambda value: edited_state(value, 'open')['settings'].update(units='mm'))
    reject('Incomplete live selection', lambda value: value['producer']['rounds'][0]['checkpoints']['selected']['selectionIds'].pop())
    reject('Pan changed semantic content', lambda value: edited_state(value, 'pan')['settings'].update(precision=-1))
    reject('Wrong pan arithmetic', lambda value: edited_state(value, 'pan')['viewport']['center'].update(x=552))
    reject('Wrong wheel scale', lambda value: edited_state(value, 'zoom')['viewport'].update(scale=.6))
    reject('Nonpositive action duration', lambda value: value['producer']['rounds'][0]['samples'][0].update(actionRoundTripMs=-1))
    reject('Frame drain precedes action', lambda value: value['producer']['rounds'][0]['samples'][0].update(throughFrameDrainMs=value['producer']['rounds'][0]['samples'][0]['actionRoundTripMs'] / 2))
    reject('Missing measured round', lambda value: value['producer']['rounds'].pop())
    reject('Incorrect summary median', lambda value: value['producer']['summary']['open']['actionRoundTripMs'].update(median=value['producer']['summary']['open']['actionRoundTripMs']['median'] + 1))
    reject('Incorrect operation order', lambda value: value['producer']['rounds'][0]['samples'][0].update(operation='selectAll'))
    reject('Saved state corruption', lambda value: edited_state(value, 'saved')['entities'][0]['end'].update(x=20))
    reject('Warmup included as measured', lambda value: value['producer']['rounds'][0].update(warmup=False))
    assert len(result) == 15 and all(row['rejected'] for row in result)
    return result


def load_bound(row, root, bindings, label):
    file = Path(row['file'])
    if not file.is_absolute():
        file = root / file
    digest = sha(file)
    assert digest == row['sha256'], ('Binding mismatch', label)
    bindings.append({'role': label, 'file': str(file), 'sha256': digest})
    return json.loads(file.read_bytes().decode('utf-8-sig'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--producer', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    assert not args.receipt.exists(), 'Preserve prior evidence'
    producer = json.loads(args.producer.read_bytes().decode('utf-8-sig'))
    bindings = [{'role': 'producer', 'file': str(args.producer), 'sha256': sha(args.producer)}]
    report = {'format': 'LinecraftIndependentPerformanceAudit/1', 'status': 'running',
              'startedAt': datetime.now(timezone.utc).isoformat(), 'bindings': bindings,
              'scope': 'Literal synthetic geometry, complete state/navigation transitions and declared timing protocol; no native physical input, compositor latency or approved usability threshold claim',
              'viewportArithmeticTolerance': VIEWPORT_TOLERANCE,
              'measurements': [], 'negativeControls': []}
    try:
        input_document = load_bound(producer['input'], args.producer.parent, bindings, 'input')
        states = []
        for index, round_data in enumerate(producer['rounds']):
            states.append({key: load_bound(round_data['checkpoints'][key], args.producer.parent,
                                           bindings, 'round-' + str(index) + '-' + key)
                           for key in CHECKPOINTS})
        observation = {'producer': producer, 'input': input_document, 'states': states}
        fixture, measurements, transitions, summary = validate(observation)
        report.update(variant=producer['variant'], fixture=fixture, measurements=measurements,
                      transitions=transitions, independentlyRecomputedSummary=summary)
        report['negativeControls'] = negative_controls(observation)
        for row in bindings:
            assert sha(row['file']) == row['sha256'], ('Evidence changed during audit', row['role'])
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
