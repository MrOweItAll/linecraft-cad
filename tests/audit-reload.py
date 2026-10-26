"""Independent literal geometry and reload/restart state audit.

Only Python standard-library JSON/hash/arithmetic facilities are used. This
reader imports no product code and never mutates original observations/files.
Controlled development recovery and explicit saved-file reopen are separate
contracts; neither establishes crash durability or native installed acceptance.
"""
import argparse
import copy
import hashlib
import json
import math
import traceback
from datetime import datetime, timezone
from pathlib import Path


SOURCE_STAGES = [
    'opened', 'dirty-before-reload', 'dirty-after-reload',
    'dirty-after-inert-history', 'clean-before-reload', 'clean-after-reload',
    'dirty-before-restart', 'dirty-after-restart', 'after-restart-save',
    'intentional-close-next-session',
]
UNPACKED_STAGES = [
    'opened', 'edited', 'saved', 'after-dev-reload-noop',
    'restarted-blank', 'reopened',
]
ADDITIONS = [((300, 20), (330, 60)), ((400, 0), (410, 0)),
             ((500, 0), (500, 20))]


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        assert key not in result, ('duplicate JSON key', key)
        result[key] = value
    return result


def read_json(file):
    return json.loads(Path(file).read_bytes().decode('utf-8-sig'),
                      object_pairs_hook=unique_object)


def number(value, expected):
    assert type(value) in (int, float) and math.isfinite(value), value
    assert value == expected, (value, expected)


def point(actual, x, y, z=None):
    assert isinstance(actual, dict)
    number(actual['x'], x)
    number(actual['y'], y)
    if z is not None:
        number(actual['z'], z)
    elif 'z' in actual:
        number(actual['z'], 0)


def line(entity, start, end):
    assert entity['type'] == 'LINE'
    point(entity['start'], *start)
    point(entity['end'], *end)


def literal_input(document):
    assert document['format'] == 'Linecraft/1'
    assert document['settings']['units'] == 'in'
    assert document['settings']['gridEnabled'] is False
    assert document['settings']['snapEnabled'] is False
    assert document['workspace'] == '2d'
    assert document['activeSpace'] == 'model'
    assert document['activeLayoutId'] is None
    assert document['activeViewportId'] is None
    point(document['viewport']['center'], 120, 0)
    number(document['viewport']['scale'], 2)
    assert len(document['entities']) == 1
    ruler = document['entities'][0]
    assert ruler['id'] == 'model-ruler'
    line(ruler, (0, 0), (240, 0))
    assert [layout['id'] for layout in document['layouts']] == ['sheet-b', 'sheet-a']
    for layout, letter, denominator, marker in zip(
            document['layouts'], ['b', 'a'], [96, 48],
            ['QA-A02-SECOND', 'QA-A01-FIRST']):
        assert layout['name'] == 'SYNTHETIC ' + letter.upper()
        paper = layout['paper']
        assert paper['size'] == 'Custom'
        number(paper['widthMm'], 420)
        number(paper['heightMm'], 297)
        assert paper['orientation'] == 'landscape'
        assert len(layout['entities']) == 5
        entities = layout['entities']
        assert [e['id'] for e in entities] == [
            'sentinel-' + letter, 'title-border-' + letter,
            'title-divider-one-' + letter, 'title-divider-two-' + letter,
            'title-label-' + letter,
        ]
        line(entities[0], (20, 60), (120, 60))
        number(entities[0]['lineweight'], .35)
        border = entities[1]
        assert border['type'] == 'PLINE' and border['closed'] is True
        assert len(border['points']) == 4
        for p, xy in zip(border['points'], [(10, 10), (410, 10),
                                           (410, 40), (10, 40)]):
            point(p, *xy)
        line(entities[2], (300, 10), (300, 40))
        line(entities[3], (360, 10), (360, 40))
        label = entities[4]
        assert label['type'] == 'TEXT' and label['text'] == marker
        point(label['position'], 310, 15)
        number(label['height'], 4)
        number(label['rotation'], 0)
        assert label['style'] == 'Standard'
        assert len(layout['viewports']) == 1
        viewport = layout['viewports'][0]
        assert viewport['id'] == 'view-' + letter
        assert viewport['frame'] == {'x': 100, 'y': 100, 'width': 220, 'height': 100}
        point(viewport['modelCenter'], 120, 0, 0)
        number(viewport['scaleDenominator'], denominator)
        assert viewport['locked'] is True and viewport['plotBorder'] is False
        assert viewport['workspace'] == '2d' and viewport['layer'] == '0'
        assert viewport['frozenLayers'] == []
    return {'modelEntities': 1, 'modelRulerLengthInches': 240,
            'paperLayouts': 2, 'paperEntities': 10,
            'paperSizesMm': [[420, 297], [420, 297]],
            'viewportDenominators': [96, 48],
            'addedLengthsInches': [50, 10, 20]}


def unchanged_fields(document, initial, additions, navigated, toggles):
    assert len(document['entities']) == additions + 1
    assert document['entities'][0] == initial['entities'][0]
    ids = [entity['id'] for entity in document['entities']]
    assert all(isinstance(i, str) and i for i in ids)
    assert len(ids) == len(set(ids))
    for entity, endpoints in zip(document['entities'][1:], ADDITIONS[:additions]):
        line(entity, *endpoints)
    for key in set(initial) | set(document):
        if key not in ('entities', 'viewport', 'settings'):
            assert document[key] == initial[key], key
    settings = copy.deepcopy(initial['settings'])
    if toggles:
        settings.update(gridEnabled=True, snapEnabled=True, orthoEnabled=True)
    assert document['settings'] == settings
    viewport = copy.deepcopy(initial['viewport'])
    if navigated:
        viewport['center']['x'] = 108
        viewport['center']['y'] = 6
    assert document['viewport'] == viewport


def runtime(meta, dirty, name, command=None, undo=False, redo=False, selection=None):
    assert meta['info']['dirty'] is dirty
    assert meta['info']['name'] == name
    state = meta['runtime']
    assert state['command'] == command
    assert state['selectionIds'] == ([] if selection is None else selection)
    assert state['canUndo'] is undo
    assert state['canRedo'] is redo


def recovered(meta, active=False):
    development = meta['development']
    assert development['restored'] is True
    assert development['historyReset'] is True
    assert development['activeCommandCanceled'] is active
    assert development.get('restoreError') is None
    assert development.get('checkpointError') is None


def blank(meta, document, development):
    runtime(meta, False, 'Untitled drawing')
    assert document['entities'] == [] and document['layouts'] == []
    assert document['activeSpace'] == 'model'
    assert document['activeLayoutId'] is None
    assert document['activeViewportId'] is None
    assert meta['development']['restored'] is False
    assert meta['development'].get('restoreError') is None
    if development:
        assert meta['pathRecord']['drawingPath'] is None


def validate(observation):
    report, initial, documents = (observation[key] for key in
                                  ['producer', 'input', 'documents'])
    assert report['status'] == 'passed'
    variant = report['variant']
    assert variant in ('source', 'unpacked')
    reference = literal_input(initial)
    stages = SOURCE_STAGES if variant == 'source' else UNPACKED_STAGES
    assert set(report['checkpoints']) == set(stages)
    assert set(documents) == set(stages)
    meta = report['checkpoints']
    assert documents['opened'] == initial
    saved_name = Path(report['outputs']['saved']['file']).name
    measurements = [{'name': 'independent literal input', 'status': 'passed',
                     'expected': reference}]
    if variant == 'source':
        runtime(meta['opened'], False, saved_name)
        for stage in ['dirty-before-reload', 'dirty-after-reload',
                      'dirty-after-inert-history', 'clean-before-reload',
                      'clean-after-reload']:
            unchanged_fields(documents[stage], initial, 2, True, True)
        assert documents['dirty-before-reload'] == documents['dirty-after-reload']
        assert documents['dirty-after-reload'] == documents['dirty-after-inert-history']
        assert documents['dirty-after-reload'] == documents['clean-before-reload']
        assert documents['clean-before-reload'] == documents['clean-after-reload']
        runtime(meta['dirty-before-reload'], True, saved_name,
                command='LINE', undo=True)
        runtime(meta['dirty-after-reload'], True, saved_name)
        runtime(meta['dirty-after-inert-history'], True, saved_name)
        recovered(meta['dirty-after-reload'], active=True)
        recovered(meta['dirty-after-inert-history'], active=True)
        runtime(meta['clean-before-reload'], False, saved_name, redo=True,
                selection=[e['id'] for e in documents['clean-before-reload']['entities']])
        runtime(meta['clean-after-reload'], False, saved_name)
        recovered(meta['clean-after-reload'])
        for stage in ['dirty-before-restart', 'dirty-after-restart',
                      'after-restart-save']:
            unchanged_fields(documents[stage], initial, 3, True, True)
        assert documents['dirty-before-restart'] == documents['dirty-after-restart']
        assert documents['dirty-after-restart'] == documents['after-restart-save']
        runtime(meta['dirty-before-restart'], True, saved_name, undo=True)
        runtime(meta['dirty-after-restart'], True, saved_name)
        runtime(meta['after-restart-save'], False, saved_name)
        recovered(meta['dirty-after-restart'])
        recovered(meta['after-restart-save'])
        blank(meta['intentional-close-next-session'],
              documents['intentional-close-next-session'], True)
        assert observation['saved'] == documents['after-restart-save']
    else:
        input_name = Path(report['input']['file']).name
        runtime(meta['opened'], False, input_name)
        unchanged_fields(documents['edited'], initial, 2, True, False)
        runtime(meta['edited'], True, input_name, undo=True)
        for stage in ['saved', 'after-dev-reload-noop', 'reopened']:
            assert documents[stage] == documents['edited']
            runtime(meta[stage], False, saved_name,
                    undo=stage != 'reopened')
            assert meta[stage]['development']['restored'] is False
        assert report['devReloadResult'] is False
        blank(meta['restarted-blank'], documents['restarted-blank'], False)
        assert observation['saved'] == documents['saved']
    for stage in stages:
        measurements.append({'name': stage, 'status': 'passed',
                             'modelEntities': len(documents[stage]['entities']),
                             'paperLayouts': len(documents[stage]['layouts'])})
    measurements.append({'name': 'saved native file exact accepted state',
                         'status': 'passed'})
    return reference, measurements


def negative_controls(original):
    source = original['producer']['variant'] == 'source'
    recovered_stage = 'dirty-after-reload' if source else 'reopened'
    dirty_stage = 'dirty-after-restart' if source else 'edited'
    controls = []

    def reject(name, mutate):
        changed = copy.deepcopy(original)
        mutate(changed)
        try:
            validate(changed)
        except (AssertionError, KeyError, TypeError, ValueError, IndexError):
            controls.append({'name': name, 'rejected': True})
            return
        raise AssertionError('Corrupt observation accepted: ' + name)

    reject('wrong independent ruler length',
           lambda o: o['input']['entities'][0]['end'].__setitem__('x', 239))
    reject('lost accepted entity',
           lambda o: o['documents'][recovered_stage]['entities'].pop())
    reject('lost navigation',
           lambda o: o['documents'][recovered_stage]['viewport']['center'].__setitem__('x', 120))
    reject('incorrect dirty baseline',
           lambda o: o['producer']['checkpoints'][dirty_stage]['info'].__setitem__('dirty', False))
    reject('incorrect native name',
           lambda o: o['producer']['checkpoints'][recovered_stage]['info'].__setitem__('name', 'wrong.linecraft'))
    reject('retained undo history',
           lambda o: o['producer']['checkpoints'][recovered_stage]['runtime'].__setitem__('canUndo', True))
    reject('retained active prompt',
           lambda o: o['producer']['checkpoints'][recovered_stage]['runtime'].__setitem__('command', 'LINE'))
    reject('lost paper layout',
           lambda o: o['documents'][recovered_stage]['layouts'].pop())
    reject('saved file corruption', lambda o: o['saved']['entities'].pop())
    reject('retained transient selection',
           lambda o: o['producer']['checkpoints'][recovered_stage]['runtime'].__setitem__('selectionIds', ['model-ruler']))
    reject('retained redo history',
           lambda o: o['producer']['checkpoints'][recovered_stage]['runtime'].__setitem__('canRedo', True))
    reject('nonboolean dirty flag',
           lambda o: o['producer']['checkpoints'][dirty_stage]['info'].__setitem__('dirty', 1))
    assert len(controls) == 12 and all(control['rejected'] for control in controls)
    return controls


def load_observation(producer_file):
    producer_file = Path(producer_file)
    producer = read_json(producer_file)
    bindings = [{'role': 'producer', 'file': str(producer_file),
                 'sha256': sha(producer_file)}]

    def bound(role, row):
        file = Path(row['file'])
        assert isinstance(row['sha256'], str) and len(row['sha256']) == 64
        assert sha(file) == row['sha256'], (role, 'file hash mismatch')
        bindings.append({'role': role, 'file': str(file),
                         'sha256': row['sha256']})
        return read_json(file)

    initial = bound('input', producer['input'])
    documents = {name: bound('checkpoint-' + name, row)
                 for name, row in producer['checkpoints'].items()}
    saved = bound('saved', producer['outputs']['saved'])
    return {'producer': producer, 'input': initial,
            'documents': documents, 'saved': saved}, bindings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--producer', required=True)
    parser.add_argument('--receipt', required=True)
    args = parser.parse_args()
    report = {'format': 'LinecraftIndependentReloadAudit/1', 'status': 'running',
              'startedAt': datetime.now(timezone.utc).isoformat(),
              'scope': 'Literal synthetic geometry, full accepted native state, dirty/name, transient/history reset and controlled source recovery versus explicit packaged saved-file reopen; no crash durability/native installed claim',
              'bindings': [], 'measurements': [], 'negativeControls': []}
    try:
        observation, report['bindings'] = load_observation(args.producer)
        reference, measurements = validate(observation)
        report['variant'] = observation['producer']['variant']
        report['literalReference'] = reference
        report['measurements'] = measurements
        report['negativeControls'] = negative_controls(observation)
        report['status'] = 'passed'
    except Exception:
        report['status'] = 'failed'
        report['error'] = traceback.format_exc()
    finally:
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        report['auditor'] = {'file': str(Path(__file__)),
                             'sha256': sha(Path(__file__))}
        with Path(args.receipt).open('x', encoding='utf-8', newline='\n') as stream:
            json.dump(report, stream, indent=2)
            stream.write('\n')
        print(json.dumps({'status': report['status'],
                          'measurements': len(report['measurements']),
                          'negativeControls': len(report['negativeControls'])}))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
