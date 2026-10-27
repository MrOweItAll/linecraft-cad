"""Independent stdlib audit of the frozen eight-event synthetic relay scenario.

No product imports, app execution or network access. Claim material is read only
to derive its hash; raw tokens are never copied into observations or receipts.
"""
import argparse
import copy
import hashlib
import json
import re
import traceback
from datetime import datetime, timezone
from pathlib import Path

HEX = re.compile(r'^[a-f0-9]{64}$')
SLUG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')
REFERENCE_BYTES = b'{"markers":2}\n'
REFERENCE_ARTIFACT = {'name': 'reference.json',
                      'sha256': hashlib.sha256(REFERENCE_BYTES).hexdigest(),
                      'bytes': len(REFERENCE_BYTES)}
EXPECTED_REQUEST = {'key': 'synthetic-titleblock-001',
                    'title': 'Synthetic title-block review',
                    'detail': 'Check the synthetic sheet marker count.',
                    'fixtureClass': 'synthetic',
                    'artifacts': [REFERENCE_ARTIFACT]}
EXPECTED_KINDS = ['submitted', 'claim', 'progress', 'needs-decision',
                  'resolve-decision', 'claim', 'progress', 'complete']
EXPECTED_STATUSES = ['queued', 'running', 'running', 'needs_decision',
                     'queued', 'running', 'running', 'completed']


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':'), allow_nan=False)


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        assert key not in result, ('duplicate JSON key', key)
        result[key] = value
    return result


def decode(raw):
    return json.loads(raw.decode('utf-8'), object_pairs_hook=no_duplicate_keys,
                      parse_constant=lambda value: (_ for _ in ()).throw(
                          AssertionError('nonfinite JSON constant')))


def exact_keys(value, keys):
    assert isinstance(value, dict) and set(value) == set(keys)


def owner(value):
    exact_keys(value, ['workerId', 'epoch', 'tokenHash'])
    assert isinstance(value['workerId'], str) and SLUG.fullmatch(value['workerId'])
    assert type(value['epoch']) is int and value['epoch'] > 0
    assert isinstance(value['tokenHash'], str) and HEX.fullmatch(value['tokenHash'])


def validate(observation):
    request_id = sha(EXPECTED_REQUEST['key'].encode())
    assert observation['requestId'] == request_id
    previous = None
    operations = set()
    state = None
    timeline = []
    claimed = []
    for index, row in enumerate(observation['events']):
        assert row['name'] == 'event-%06d.json' % index
        raw = row['raw']
        assert 0 < len(raw) <= 32768
        event = decode(raw)
        assert raw == (canonical(event) + '\n').encode('utf-8')
        exact_keys(event, ['format', 'requestId', 'revision', 'previousHash',
                           'operationId', 'time', 'action'])
        assert event['format'] == 'LinecraftSyntheticRelayEvent/1'
        assert event['requestId'] == request_id
        assert type(event['revision']) is int and event['revision'] == index
        assert event['previousHash'] == previous
        operation = event['operationId']
        assert isinstance(operation, str) and SLUG.fullmatch(operation)
        assert operation not in operations
        operations.add(operation)
        assert re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', event['time'])
        datetime.fromisoformat(event['time'].replace('Z', '+00:00'))
        action = event['action']
        assert isinstance(action, dict)
        kind = action['kind']
        if index == 0:
            assert operation == 'submit'
            exact_keys(action, ['kind', 'request'])
            assert kind == 'submitted' and action['request'] == EXPECTED_REQUEST
            state = {'status': 'queued', 'epoch': 0, 'owner': None,
                     'progress': [], 'decision': None, 'outcome': None}
        else:
            assert operation != 'submit'
            assert state['status'] not in ('completed', 'failed', 'canceled')
            if kind == 'claim':
                exact_keys(action, ['kind', 'workerId', 'owner'])
                owner(action['owner'])
                assert state['status'] == 'queued'
                assert action['workerId'] == action['owner']['workerId']
                assert action['owner']['epoch'] == state['epoch'] + 1
                state['epoch'] += 1
                state['owner'] = copy.deepcopy(action['owner'])
                state['status'] = 'running'
                claimed.append(copy.deepcopy(action['owner']))
            elif kind == 'resolve-decision':
                exact_keys(action, ['kind', 'resolution', 'actor'])
                assert state['status'] == 'needs_decision'
                assert state['owner'] is None
                assert action['resolution'] == 'Synthetic option A'
                assert action['actor'] == 'synthetic-reviewer'
                state['decision'].update(resolution=action['resolution'],
                                         actor=action['actor'])
                state['status'] = 'queued'
            else:
                assert state['status'] == 'running'
                owner(action['owner'])
                assert action['owner'] == state['owner']
                if kind == 'progress':
                    exact_keys(action, ['kind', 'message', 'owner'])
                    expected_message = ('Two synthetic sheet markers observed.'
                                        if index == 2 else
                                        'Synthetic option A recorded; no drawing execution.')
                    assert action['message'] == expected_message
                    state['progress'].append({'message': action['message'],
                                              'workerId': state['owner']['workerId']})
                elif kind == 'needs-decision':
                    exact_keys(action, ['kind', 'question', 'owner'])
                    assert action['question'] == 'Choose synthetic option A or B.'
                    state['decision'] = {'question': action['question'],
                                         'resolution': None, 'actor': None}
                    state['owner'] = None
                    state['status'] = 'needs_decision'
                elif kind == 'complete':
                    exact_keys(action, ['kind', 'summary', 'artifacts', 'owner'])
                    assert action['summary'] == 'Local protocol scenario verified.'
                    assert action['artifacts'] == [REFERENCE_ARTIFACT]
                    state['status'] = 'completed'
                    state['outcome'] = {'summary': action['summary'],
                                        'artifacts': action['artifacts']}
                    state['owner'] = None
                else:
                    raise AssertionError('unexpected scenario command')
        assert index < len(EXPECTED_KINDS)
        assert kind == EXPECTED_KINDS[index]
        assert state['status'] == EXPECTED_STATUSES[index]
        timeline.append({'revision': index, 'kind': kind,
                         'status': state['status'], 'epoch': state['epoch'],
                         'ownerWorkerId': state['owner']['workerId'] if state['owner'] else None})
        previous = sha(raw)
    assert len(observation['events']) == 8
    assert [row['workerId'] for row in claimed] == ['drafting', 'developer']
    assert [row['epoch'] for row in claimed] == [1, 2]
    assert claimed[0]['tokenHash'] != claimed[1]['tokenHash']
    for expected in claimed:
        assert any(row['workerId'] == expected['workerId'] and
                   row['epoch'] == expected['epoch'] and
                   row['tokenHash'] == expected['tokenHash']
                   for row in observation['claims'])
    assert state['status'] == 'completed' and state['owner'] is None
    assert state['epoch'] == 2 and len(state['progress']) == 2
    return {'requestId': request_id,
            'requestHash': sha(canonical(EXPECTED_REQUEST).encode()),
            'committedEvents': 8, 'finalRevision': 7,
            'finalState': state, 'timeline': timeline,
            'artifactReference': REFERENCE_ARTIFACT,
            'lastEventSHA256': previous}


def negative_controls(observation):
    controls = []

    def reject(name, mutate, repair_links=True):
        changed = copy.deepcopy(observation)
        events = [decode(row['raw']) for row in changed['events']]
        mutate(events, changed)
        previous = None
        for row, event in zip(changed['events'], events):
            if repair_links:
                event['previousHash'] = previous
            row['raw'] = (canonical(event) + '\n').encode()
            previous = sha(row['raw'])
        try:
            validate(changed)
        except (AssertionError, KeyError, TypeError, ValueError, IndexError):
            controls.append({'name': name, 'rejected': True})
            return
        raise AssertionError('Corrupt copied observation accepted: ' + name)

    reject('broken previous hash', lambda events, _: events[2].__setitem__('previousHash', '0' * 64), False)
    reject('wrong revision', lambda events, _: events[4].__setitem__('revision', 9))
    reject('duplicate operation id', lambda events, _: events[6].__setitem__('operationId', events[2]['operationId']))
    reject('unknown executable field', lambda events, _: events[2]['action'].__setitem__('command', 'forbidden'))
    reject('wrong first owner epoch', lambda events, _: events[1]['action']['owner'].__setitem__('epoch', 2))
    reject('old owner after handoff', lambda events, _: events[6]['action'].__setitem__('owner', copy.deepcopy(events[1]['action']['owner'])))
    reject('decision bypass', lambda events, _: events[4]['action'].__setitem__('kind', 'progress'))
    reject('artifact hash changed', lambda events, _: events[7]['action']['artifacts'][0].__setitem__('sha256', '0' * 64))
    reject('wrong independent marker bytes', lambda events, _: events[0]['action']['request']['artifacts'][0].__setitem__('bytes', 13))
    reject('noninteger epoch', lambda events, _: events[5]['action']['owner'].__setitem__('epoch', True))
    reject('terminal not completed', lambda events, _: events[7]['action'].__setitem__('kind', 'fail'))
    reject('lost persisted capability binding', lambda _, changed: changed.__setitem__('claims', []))
    assert len(controls) == 12
    return controls


def checked_file(file):
    file = Path(file)
    assert file.is_file() and not file.is_symlink()
    assert file.stat().st_size <= 32768
    for ancestor in file.parents:
        assert not ancestor.is_symlink()
    return file.read_bytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--store', required=True)
    parser.add_argument('--request-id', required=True)
    parser.add_argument('--receipt', required=True)
    args = parser.parse_args()
    report = {'format': 'LinecraftIndependentSyntheticRelayAudit/1',
              'status': 'running', 'startedAt': datetime.now(timezone.utc).isoformat(),
              'scope': 'Independent exact synthetic eight-event local ledger, hash chain, state/owner/decision progression and artifact metadata; no outbound, CAD execution, auth or power-loss claim',
              'bindings': [], 'measurements': [], 'negativeControls': []}
    try:
        root = Path(args.store)
        marker = root / 'store.json'
        marker_raw = checked_file(marker)
        assert decode(marker_raw) == {'format': 'LinecraftSyntheticRelayStore/1'}
        report['bindings'].append({'role': 'marker', 'file': str(marker), 'sha256': sha(marker_raw)})
        directory = root / 'requests' / args.request_id
        names = sorted(entry.name for entry in directory.iterdir())
        assert names == ['event-%06d.json' % i for i in range(8)]
        rows = []
        for name in names:
            file = directory / name
            raw = checked_file(file)
            rows.append({'name': name, 'raw': raw})
            report['bindings'].append({'role': name, 'file': str(file), 'sha256': sha(raw)})
        claims = []
        for file in sorted((root / 'claims').glob('claim-*.json')):
            raw = checked_file(file)
            claim = decode(raw)
            exact_keys(claim, ['requestId', 'workerId', 'epoch', 'token'])
            assert claim['requestId'] == args.request_id
            assert isinstance(claim['token'], str) and HEX.fullmatch(claim['token'])
            claims.append({'workerId': claim['workerId'], 'epoch': claim['epoch'],
                           'tokenHash': sha(claim['token'].encode())})
            report['bindings'].append({'role': 'private claim capability',
                                       'file': str(file), 'sha256': sha(raw)})
        observation = {'requestId': args.request_id, 'events': rows, 'claims': claims}
        summary = validate(observation)
        report['summary'] = summary
        report['measurements'] = summary['timeline'] + [
            {'name': 'literal request and marker metadata', 'status': 'passed'},
            {'name': 'final owner/decision/progress/outcome', 'status': 'passed'},
            {'name': 'durable private capability hashes match claims', 'status': 'passed'},
        ]
        report['negativeControls'] = negative_controls(observation)
        report['limits'] = ['No inference about attempted replay/error commands from final ledger alone; command receipts require separate review',
                             'Claim files are local private capabilities, not external authentication',
                             'Hash chains detect accidental corruption; no hostile same-user or power-loss durability claim']
        report['status'] = 'passed'
    except Exception:
        report['status'] = 'failed'
        report['error'] = traceback.format_exc()
    finally:
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        report['auditor'] = {'file': str(Path(__file__)),
                             'sha256': sha(Path(__file__).read_bytes())}
        with Path(args.receipt).open('x', encoding='utf-8', newline='\n') as stream:
            json.dump(report, stream, indent=2)
            stream.write('\n')
        print(json.dumps({'status': report['status'],
                          'measurements': len(report['measurements']),
                          'negativeControls': len(report['negativeControls'])}))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
