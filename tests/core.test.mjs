import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.mjs';
import {makeClampedKnots,splineBoundsPoints,boundaryContains} from '../advanced-geometry.mjs';

// Original synthetic mathematical inputs; private native evidence is excluded.
const accepted = (editor, commands) => {
  for (const command of commands) { const response = editor.execute(command); assert.equal(response.ok, true, `${String(command)}: ${response.message}`); }
};

const EPS = 1e-9;
const point = (actual, expected, message = 'point') => {
  assert.ok(actual && Number.isFinite(actual.x) && Number.isFinite(actual.y), `${message} is finite`);
  assert.ok(Math.abs(actual.x - expected[0]) < EPS, `${message}.x: ${actual.x} != ${expected[0]}`);
  assert.ok(Math.abs(actual.y - expected[1]) < EPS, `${message}.y: ${actual.y} != ${expected[1]}`);
};
const submit = (editor, commands) => commands.map(input => editor.execute(input));
const line = (editor, first = '0,0', second = '100,0') => submit(editor, ['L', first, second, '']);
const geometry = editor => structuredClone(editor.state.entities);
const coordinates = entities => entities.map(entity => entity.type === 'LINE'
  ? {type: entity.type, start: entity.start, end: entity.end}
  : {type: entity.type, points: entity.points});
const fixtureEntities = () => [
  {id: 'a', type: 'LINE', start: {x: 0, y: 0}, end: {x: 100, y: 0}, layer: '0'},
  {id: 'b', type: 'LINE', start: {x: 100, y: 0}, end: {x: 100, y: 50}, layer: '0'},
  {id: 'c', type: 'RECTANG', points: [{x: 20, y: 10}, {x: 60, y: 10}, {x: 60, y: 30}, {x: 20, y: 30}], layer: '0'},
];

test('shared sequence: LINE accepts absolute and relative Cartesian input', () => {
  const e = core.createEditor();
  const responses = submit(e, ['L', '0,0', '100,0', '@0,50', '']);
  assert.ok(responses.every(response => response.ok));
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities.length, 2);
  point(e.state.entities[0].start, [0, 0]);
  point(e.state.entities[0].end, [100, 0]);
  point(e.state.entities[1].start, [100, 0]);
  point(e.state.entities[1].end, [100, 50]);
});

test('shared sequence: RECTANG accepts relative opposite corner', () => {
  const e = core.createEditor();
  submit(e, ['RECTANG', '20,10', '@40,20']);
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities.length, 1);
  assert.equal(e.state.entities[0].type, 'RECTANG');
  [[20, 10], [60, 10], [60, 30], [20, 30]].forEach((p, i) => point(e.state.entities[0].points[i], p));
});

test('shared sequence: U removes rectangle and REDO restores exact geometry', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '100,0', '@0,50', '', 'RECTANG', '20,10', '@40,20']);
  const before = geometry(e);
  assert.equal(before.length, 3);
  e.execute('U');
  assert.deepEqual(e.state.entities, before.slice(0, 2));
  e.execute('REDO');
  assert.deepEqual(e.state.entities, before);
});

test('shared sequence: relative polar coordinate gives exact direction and distance', () => {
  const e = core.createEditor();
  submit(e, ['LINE', '200,0', '@50<90', '']);
  assert.equal(e.state.entities.length, 1);
  point(e.state.entities[0].start, [200, 0]);
  point(e.state.entities[0].end, [200, 50]);
});

test('coordinates retain signed fractional precision', () => {
  const e = core.createEditor();
  submit(e, ['LINE', '-12.125,0.0625', '@2.375,-4.8125', '']);
  point(e.state.entities[0].start, [-12.125, 0.0625]);
  point(e.state.entities[0].end, [-9.75, -4.75]);
});

test('relative polar input supports negative angles', () => {
  const e = core.createEditor();
  submit(e, ['L', '10,20', '@25<-90', '']);
  point(e.state.entities[0].end, [10, -5]);
});

test('invalid coordinate preserves active command, geometry, and next-point base', () => {
  const e = core.createEditor();
  submit(e, ['LINE', '10,20', '30,40']);
  const before = geometry(e);
  for (const invalid of ['tomato', '1,', '1,2,3', 'NaN,2', 'Infinity,2', '@1<oops']) {
    assert.equal(e.execute(invalid).ok, false, `${invalid} must be rejected`);
    assert.deepEqual(e.state.entities, before);
    assert.equal(e.state.command, 'LINE');
  }
  e.execute('@5,6');
  point(e.state.entities[1].start, [30, 40]);
  point(e.state.entities[1].end, [35, 46]);
});

test('unknown command adds no geometry or undo operation', () => {
  const e = core.createEditor();
  assert.equal(e.execute('NOT_A_COMMAND').ok, false);
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities.length, 0);
  e.execute('U');
  assert.equal(e.state.entities.length, 0);
});

test('rectangle with reversed corners remains axis aligned', () => {
  const e = core.createEditor();
  submit(e, ['REC', '60,30', '20,10']);
  const vertices = e.state.entities[0].points.map(p => [p.x, p.y]).sort();
  assert.deepEqual(vertices, [[20, 10], [20, 30], [60, 10], [60, 30]].sort());
});

test('one global Undo removes every segment of one completed LINE command', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '10,0', '@0,10', '@-10,0', '']);
  assert.equal(e.state.entities.length, 3);
  e.execute('U');
  assert.equal(e.state.entities.length, 0);
  e.execute('REDO');
  assert.equal(e.state.entities.length, 3);
});

test('LINE local Undo removes only latest segment and restores previous endpoint', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '10,0', '@0,10', 'U']);
  assert.equal(e.state.command, 'LINE');
  assert.equal(e.state.entities.length, 1);
  e.execute('@5,0');
  point(e.state.entities[1].start, [10, 0]);
  point(e.state.entities[1].end, [15, 0]);
  e.execute('');
  e.execute('U');
  assert.equal(e.state.entities.length, 0);
});

test('LINE Close closes to original first point', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '20,0', '@0,10', 'C']);
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities.length, 3);
  point(e.state.entities[2].start, [20, 10]);
  point(e.state.entities[2].end, [0, 0]);
});

test('cancel retains completed LINE segments as one undo transaction', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '20,0', '@0,10']);
  e.cancel();
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities.length, 2);
  e.execute('U');
  assert.equal(e.state.entities.length, 0);
});

test('cancel before second rectangle corner creates no entity', () => {
  const e = core.createEditor();
  submit(e, ['RECTANG', '0,0']);
  e.cancel();
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities.length, 0);
});

test('new drawing operation after Undo invalidates redo branch', () => {
  const e = core.createEditor();
  line(e);
  e.execute('U');
  submit(e, ['REC', '5,5', '15,15']);
  const beforeRedo = geometry(e);
  e.execute('REDO');
  assert.deepEqual(e.state.entities, beforeRedo);
});

test('selection can replace, add, toggle, and clear without altering geometry', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '10,0', '@0,10', '']);
  const before = geometry(e);
  const [a, b] = e.state.entities.map(entity => entity.id);
  e.select([a]);
  assert.deepEqual(e.state.selectionIds, [a]);
  e.select([b], {add: true});
  assert.deepEqual(new Set(e.state.selectionIds), new Set([a, b]));
  e.select([a], {toggle: true});
  assert.deepEqual(e.state.selectionIds, [b]);
  e.clearSelection();
  assert.deepEqual(e.state.selectionIds, []);
  assert.deepEqual(e.state.entities, before);
});

test('deleting selection is undoable and restores exact entity data', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '10,0', '@0,10', '']);
  const before = geometry(e);
  e.select([before[0].id]);
  e.deleteSelected();
  assert.deepEqual(e.state.entities, [before[1]]);
  assert.deepEqual(e.state.selectionIds, []);
  e.execute('U');
  assert.deepEqual(e.state.entities, before);
});

test('LINE endpoint grip edits exact coordinates and supports Undo', () => {
  const e = core.createEditor();
  line(e);
  const before = geometry(e);
  e.moveGrip(before[0].id, 1, {x: 12.5, y: -7.25});
  point(e.state.entities[0].end, [12.5, -7.25]);
  point(e.state.entities[0].start, [0, 0]);
  e.execute('U');
  assert.deepEqual(e.state.entities, before);
});

test('current layer is assigned to newly drawn entities', () => {
  const e = core.createEditor();
  e.addLayer('Walls', {color: '#dd7722', lineweight: 0.5});
  e.setCurrentLayer('Walls');
  line(e);
  assert.equal(e.state.entities[0].layer, 'Walls');
  assert.equal(e.state.layers.find(layer => layer.name === 'Walls').color, '#dd7722');
});

test('selected object properties update only selected entities and are undoable', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '10,0', '@0,10', '']);
  e.addLayer('Detail', {color: '#44bb99'});
  const before = geometry(e);
  e.select([before[0].id]);
  e.setSelectionProperties({layer: 'Detail', color: '#112233', lineweight: 0.75});
  assert.equal(e.state.entities[0].layer, 'Detail');
  assert.equal(e.state.entities[0].color, '#112233');
  assert.equal(e.state.entities[0].lineweight, 0.75);
  assert.deepEqual(e.state.entities[1], before[1]);
  e.execute('U');
  assert.deepEqual(e.state.entities, before);
});

test('JSON export/import round-trip preserves geometry and layers', () => {
  const e = core.createEditor();
  e.addLayer('Detail', {color: '#44bb99'});
  e.setCurrentLayer('Detail');
  submit(e, ['L', '-5.125,6.875', '100,0', '@0,50', '', 'REC', '20,10', '@40,20']);
  const saved = e.serialize();
  const restored = core.createEditor();
  restored.importJSON(saved);
  assert.deepEqual(coordinates(restored.state.entities), coordinates(e.state.entities));
  assert.deepEqual(restored.state.layers, e.state.layers);
  assert.equal(restored.state.currentLayer, e.state.currentLayer);
});

test('malformed JSON import rejects atomically and preserves current drawing', () => {
  const e = core.createEditor();
  line(e);
  e.addLayer('Existing');
  const original = JSON.parse(e.serialize());
  const invalidDocuments = [
    '{unfinished',
    {...original, format: 'unknown-format'},
    {...original, entities: [{id: 'bad', type: 'LINE', start: {x: null, y: 0}, end: {x: 1, y: 1}, layer: '0'}]},
    {...original, entities: [{id: 'bad', type: 'RECTANG', points: [{x: 0, y: 0}, {x: 2, y: 1}, {x: 2, y: 2}, {x: 0, y: 2}], layer: '0'}]},
    {...original, entities: [original.entities[0], original.entities[0]]},
  ];
  for (const invalid of invalidDocuments) {
    assert.equal(e.importJSON(invalid).ok, false);
    assert.deepEqual(JSON.parse(e.serialize()), original);
  }
});

test('locked layers prevent selection, deletion, grip editing, and new geometry', () => {
  const e = core.createEditor();
  e.addLayer('Protected');
  e.setCurrentLayer('Protected');
  line(e);
  e.updateLayer('Protected', {locked: true});
  const before = geometry(e);
  e.select([before[0].id]);
  assert.deepEqual(e.state.selectionIds, []);
  assert.equal(e.deleteSelected().ok, false);
  assert.equal(e.moveGrip(before[0].id, 1, {x: 50, y: 50}).ok, false);
  submit(e, ['L', '200,200', '250,250', '']);
  assert.deepEqual(e.state.entities, before);
  e.cancel();
  e.updateLayer('Protected', {locked: false});
  e.select([before[0].id]);
  assert.deepEqual(e.state.selectionIds, [before[0].id]);
});

test('rectangle corner grip preserves axis alignment and opposite corner', () => {
  const e = core.createEditor();
  submit(e, ['REC', '20,10', '60,30']);
  const before = geometry(e);
  assert.equal(e.moveGrip(before[0].id, 0, {x: 5, y: 2}).ok, true);
  assert.deepEqual(e.state.entities[0].points, [{x: 5, y: 2}, {x: 60, y: 2}, {x: 60, y: 30}, {x: 5, y: 30}]);
  const valid = geometry(e);
  assert.equal(e.moveGrip(before[0].id, 0, {x: 60, y: 2}).ok, false);
  assert.deepEqual(e.state.entities, valid);
  e.execute('U');
  assert.deepEqual(e.state.entities, before);
});

test('DXF export encodes LINE endpoints and closed rectangle as plain text exchange geometry', () => {
  const e = core.createEditor();
  submit(e, ['L', '0,0', '100,0', '@0,50', '', 'RECTANG', '20,10', '@40,20']);
  const pairs = e.exportDXF().trim().split(/\r?\n/);
  assert.equal(pairs.length % 2, 0);
  const records = [];
  for (let i = 0; i < pairs.length; i += 2) {
    if (pairs[i].trim() === '0') records.push({type: pairs[i + 1].trim(), groups: []});
    else records.at(-1)?.groups.push([pairs[i].trim(), pairs[i + 1].trim()]);
  }
  const lines = records.filter(record => record.type === 'LINE');
  assert.equal(lines.length, 2);
  const values = Object.fromEntries(lines[1].groups);
  nearNumber(values['10'], 100); nearNumber(values['20'], 0);
  nearNumber(values['11'], 100); nearNumber(values['21'], 50);
  const rectangle = records.find(record => record.type === 'LWPOLYLINE');
  assert.ok(rectangle);
  assert.ok(rectangle.groups.some(([code, value]) => code === '90' && value === '4'));
  assert.ok(rectangle.groups.some(([code, value]) => code === '70' && value === '1'));
  assert.equal(rectangle.groups.filter(([code]) => code === '10').length, 4);
  assert.equal(records.at(-1).type, 'EOF');
  function nearNumber(actual, expected) {assert.ok(Math.abs(Number(actual) - expected) < EPS);}
});

test('screen/world conversion uses positive world Y upward and exact inverse', () => {
  const viewport = {center: {x: 10, y: 20}, scale: 2};
  point(core.worldToScreen({x: 30, y: 45}, viewport, 800, 600), [440, 250]);
  for (const p of [{x: 0, y: 0}, {x: 10, y: 20}, {x: -0.125, y: 987.25}]) {
    const screen = core.worldToScreen(p, viewport, 800, 600);
    point(core.screenToWorld(screen, viewport, 800, 600), [p.x, p.y]);
  }
});

test('pan shifts drawing by requested screen pixels without changing geometry', () => {
  const viewport = {center: {x: 10, y: 20}, scale: 2};
  const p = {x: 17, y: -6};
  const before = core.worldToScreen(p, viewport, 800, 600);
  const after = core.worldToScreen(p, core.pan(viewport, 35, -23), 800, 600);
  point(after, [before.x + 35, before.y - 23]);
  point(viewport.center, [10, 20], 'original viewport center');
});

test('cursor-centered zoom preserves world point under cursor', () => {
  const viewport = {center: {x: -10, y: 30}, scale: 2};
  const cursor = {x: 620, y: 130};
  const anchor = core.screenToWorld(cursor, viewport, 800, 600);
  const zoomed = core.zoomAt(viewport, 2.5, cursor, 800, 600);
  assert.equal(zoomed.scale, 5);
  point(core.screenToWorld(cursor, zoomed, 800, 600), [anchor.x, anchor.y]);
  assert.equal(viewport.scale, 2);
});

test('zoom extents fits every shared-sequence vertex with requested margin', () => {
  const entities = fixtureEntities();
  entities.push({id: 'd', type: 'LINE', start: {x: 200, y: 0}, end: {x: 200, y: 50}, layer: '0'});
  const before = structuredClone(entities);
  const viewport = core.zoomExtents(entities, {center: {x: 0, y: 0}, scale: 10}, 800, 600, 40);
  point(viewport.center, [100, 25]);
  for (const entity of entities) {
    for (const p of entity.type === 'LINE' ? [entity.start, entity.end] : entity.points) {
      const screen = core.worldToScreen(p, viewport, 800, 600);
      assert.ok(screen.x >= 40 - EPS && screen.x <= 760 + EPS);
      assert.ok(screen.y >= 40 - EPS && screen.y <= 560 + EPS);
    }
  }
  assert.deepEqual(entities, before);
});

test('zoom extents handles empty drawing and a single point without nonfinite values', () => {
  const initial = {center: {x: 0, y: 0}, scale: 10};
  for (const entities of [[], [{id: 'point', type: 'LINE', start: {x: 3, y: 4}, end: {x: 3, y: 4}, layer: '0'}]]) {
    const viewport = core.zoomExtents(entities, initial, 800, 600);
    assert.ok(Number.isFinite(viewport.center.x) && Number.isFinite(viewport.center.y));
    assert.ok(Number.isFinite(viewport.scale) && viewport.scale > 0);
  }
});

test('hit test identifies LINE by finite segment distance', () => {
  const entities = fixtureEntities().slice(0, 1);
  assert.equal(core.hitTest(entities, {x: 50, y: 1}, 2), 'a');
  assert.equal(core.hitTest(entities, {x: 50, y: 3}, 2), null);
  assert.equal(core.hitTest(entities, {x: 110, y: 0}, 2), null);
});

test('hit test identifies rectangle edges and excludes distant empty space', () => {
  const entities = fixtureEntities().slice(2);
  assert.equal(core.hitTest(entities, {x: 40, y: 10.5}, 1), 'c');
  assert.equal(core.hitTest(entities, {x: 40, y: 20}, 1), null);
});

test('window selection requires complete containment and includes boundary', () => {
  const entities = fixtureEntities();
  assert.deepEqual(new Set(core.entitiesInBox(entities, {x: 0, y: 0}, {x: 100, y: 50}, false)), new Set(['a', 'b', 'c']));
  assert.deepEqual(core.entitiesInBox(entities, {x: 25, y: 9}, {x: 55, y: 31}, false), []);
  assert.deepEqual(core.entitiesInBox(entities, {x: 20, y: 10}, {x: 60, y: 30}, false), ['c']);
});

test('crossing selection includes intersected edges when no endpoint is inside', () => {
  const entities = fixtureEntities();
  assert.deepEqual(core.entitiesInBox(entities, {x: 45, y: -2}, {x: 55, y: 2}, true), ['a']);
  assert.deepEqual(core.entitiesInBox(entities, {x: 30, y: 9}, {x: 40, y: 11}, true), ['c']);
});

test('selection boxes handle reversed corners geometrically', () => {
  const entities = fixtureEntities();
  const forward = core.entitiesInBox(entities, {x: 0, y: 0}, {x: 100, y: 50}, false);
  const reversed = core.entitiesInBox(entities, {x: 100, y: 50}, {x: 0, y: 0}, false);
  assert.deepEqual(new Set(reversed), new Set(forward));
});

test('object snap identifies exact endpoint within tolerance', () => {
  const snap = core.findSnap(fixtureEntities().slice(0, 1), {x: 0.2, y: -0.1}, 1);
  assert.ok(snap);
  point(snap.point, [0, 0]);
  assert.equal(snap.entityId, 'a');
});

test('object snap identifies exact midpoint within tolerance', () => {
  const snap = core.findSnap(fixtureEntities().slice(0, 1), {x: 50.2, y: 0.1}, 1);
  assert.ok(snap);
  point(snap.point, [50, 0]);
  assert.equal(snap.entityId, 'a');
});

test('object snap does not attract beyond tolerance', () => {
  assert.equal(core.findSnap(fixtureEntities().slice(0, 1), {x: 50, y: 10}, 1), null);
});

test('CIRCLE center and positive scalar radius creates exact geometry and grouped undo', () => {
  const e = core.createEditor();
  const responses = submit(e, ['C', '150,80', '25']);
  assert.ok(responses.every(response => response.ok));
  assert.equal(e.state.command, null);
  assert.equal(e.state.entities[0].type, 'CIRCLE');
  point(e.state.entities[0].center, [150, 80]);
  assert.equal(e.state.entities[0].radius, 25);
  const before = geometry(e); e.undo(); assert.equal(e.state.entities.length, 0); e.redo(); assert.deepEqual(e.state.entities, before);
});

test('CIRCLE radius point computes Euclidean distance and relative coordinate base', () => {
  const e = core.createEditor(); submit(e, ['CIRCLE', '20,30', '@3,4']);
  point(e.state.entities[0].center, [20, 30]); assert.equal(e.state.entities[0].radius, 5);
});

test('CIRCLE Diameter option interprets numeric size as twice the radius', () => {
  const e = core.createEditor(); submit(e, ['CIRCLE', '-10,20', 'D', '40']);
  assert.equal(e.state.entities[0].radius, 20); point(e.state.entities[0].center, [-10, 20]);
});

test('invalid CIRCLE radius preserves the center prompt and adds no geometry', () => {
  const e = core.createEditor(); submit(e, ['CIRCLE', '5,6']);
  for (const input of ['0', '-2', 'Infinity', 'NaN', '5,6']) {
    assert.equal(e.execute(input).ok, false); assert.equal(e.state.commandPhase, 'radius'); assert.equal(e.state.entities.length, 0);
  }
  assert.equal(e.execute('10').ok, true); assert.equal(e.state.entities[0].radius, 10);
});

test('unimplemented CIRCLE construction options are explicit and retain center phase', () => {
  const e = core.createEditor(); e.execute('CIRCLE');
  for (const input of ['3P', '2P', 'Ttr']) {
    const result = e.execute(input); assert.equal(result.ok, false); assert.match(result.message, /not implemented/); assert.equal(e.state.commandPhase, 'center');
  }
  e.cancel(); assert.equal(e.state.entities.length, 0); assert.equal(e.canUndo, false);
});

test('CIRCLE bounds and zoom extents include all extrema', () => {
  const circle = {id: 'circle', type: 'CIRCLE', center: {x: 25, y: -5}, radius: 10, layer: '0'};
  assert.deepEqual(core.bounds([circle]), {minX: 15, maxX: 35, minY: -15, maxY: 5});
  const viewport = core.zoomExtents([circle], {center: {x: 0, y: 0}, scale: 10}, 800, 600, 40);
  for (const p of core.entityPoints(circle)) { const screen = core.worldToScreen(p, viewport, 800, 600); assert.ok(screen.x >= 40 && screen.x <= 760 && screen.y >= 40 && screen.y <= 560); }
});

test('CIRCLE hit test selects circumference and excludes center', () => {
  const circle = {id: 'circle', type: 'CIRCLE', center: {x: 0, y: 0}, radius: 10, layer: '0'};
  assert.equal(core.hitTest([circle], {x: 9.8, y: 0}, 0.5), 'circle');
  assert.equal(core.hitTest([circle], {x: 0, y: 0}, 0.5), null);
  assert.equal(core.hitTest([circle], {x: 11, y: 0}, 0.5), null);
});

test('CIRCLE window and crossing selection operate on circumference, not filled disk', () => {
  const circle = {id: 'circle', type: 'CIRCLE', center: {x: 0, y: 0}, radius: 10, layer: '0'};
  assert.deepEqual(core.entitiesInBox([circle], {x: -10, y: -10}, {x: 10, y: 10}, false), ['circle']);
  assert.deepEqual(core.entitiesInBox([circle], {x: -9, y: -10}, {x: 10, y: 10}, false), []);
  assert.deepEqual(core.entitiesInBox([circle], {x: 6, y: 6}, {x: 8, y: 8}, true), ['circle']);
  assert.deepEqual(core.entitiesInBox([circle], {x: -2, y: -2}, {x: 2, y: 2}, true), []);
  assert.deepEqual(core.entitiesInBox([circle], {x: 12, y: 12}, {x: 15, y: 15}, true), []);
});

test('CIRCLE center and quadrant snaps report exact locations', () => {
  const circle = {id: 'circle', type: 'CIRCLE', center: {x: 20, y: 30}, radius: 5, layer: '0'};
  const center = core.findSnap([circle], {x: 20.1, y: 30.1}, 0.5); assert.equal(center.type, 'center'); point(center.point, [20, 30]);
  const quadrant = core.findSnap([circle], {x: 20.1, y: 34.9}, 0.5); assert.equal(quadrant.type, 'quadrant'); point(quadrant.point, [20, 35]);
  assert.equal(core.entityGripPoints(circle).length, 5);
});

test('CIRCLE grips move center or change radius and undo exact geometry', () => {
  const e = core.createEditor(); submit(e, ['C', '0,0', '10']); const id = e.state.entities[0].id;
  const original = geometry(e); assert.equal(e.moveGrip(id, 0, {x: 30, y: 40}).ok, true);
  point(e.state.entities[0].center, [30, 40]); assert.equal(e.state.entities[0].radius, 10); e.undo(); assert.deepEqual(e.state.entities, original);
  assert.equal(e.moveGrip(id, 1, {x: 3, y: 4}).ok, true); assert.equal(e.state.entities[0].radius, 5); e.undo(); assert.deepEqual(e.state.entities, original);
  assert.equal(e.moveGrip(id, 1, {x: 0, y: 0}).ok, false); assert.deepEqual(e.state.entities, original);
});

test('MOVE typed pick selection then base/destination translates exact geometry', () => {
  const e = core.createEditor(); line(e); const original = geometry(e);
  submit(e, ['M', '50,0', '', '0,0', '@10,20']);
  assert.equal(e.state.command, null); point(e.state.entities[0].start, [10, 20]); point(e.state.entities[0].end, [110, 20]);
  assert.equal(e.state.entities[0].id, original[0].id); e.undo(); assert.deepEqual(e.state.entities, original); e.redo(); point(e.state.entities[0].start, [10, 20]);
});

test('MOVE supports pickfirst selection and ignores locked layers', () => {
  const e = core.createEditor(); line(e); e.addLayer('Locked'); e.setCurrentLayer('Locked'); line(e, '0,50', '100,50'); e.setCurrentLayer('0'); e.updateLayer('Locked', {locked: true});
  e.select(e.state.entities.map(entity => entity.id)); e.execute('MOVE'); assert.equal(e.state.commandPhase, 'base');
  submit(e, ['0,0', '5,6']); point(e.state.entities[0].start, [5, 6]); point(e.state.entities[1].start, [0, 50]);
});

test('empty transform selection cannot advance and Escape adds no undo group', () => {
  const e = core.createEditor(); line(e); const original = geometry(e);
  e.execute('MOVE'); assert.equal(e.execute('').ok, false); assert.equal(e.state.commandPhase, 'selection');
  assert.equal(e.execute('500,500').ok, false); e.cancel(); assert.deepEqual(e.state.entities, original);
  e.undo(); assert.equal(e.state.entities.length, 0);
});

test('transform selection accepts IDs and ALL before Enter', () => {
  const e = core.createEditor(); line(e); submit(e, ['CIRCLE', '20,20', '5']); const original = geometry(e);
  e.execute('MOVE'); e.execute(original[0].id); assert.deepEqual(e.state.selectionIds, [original[0].id]);
  e.execute('ALL'); e.execute(''); assert.equal(e.state.commandSelectionIds.length, 2);
  submit(e, ['0,0', '@10,10']); point(e.state.entities[0].start, [10, 10]); point(e.state.entities[1].center, [30, 30]);
});

test('COPY preserves originals, properties and layer, creates new IDs and one undo group', () => {
  const e = core.createEditor(); e.addLayer('Source'); e.setCurrentLayer('Source'); line(e);
  e.select([e.state.entities[0].id]); e.setSelectionProperties({color: '#12abef', lineweight: 0.5});
  const original = geometry(e); submit(e, ['CO', '0,0', '@25,15', '']);
  assert.equal(e.state.entities.length, 2); assert.deepEqual(e.state.entities[0], original[0]);
  const copy = e.state.entities[1]; assert.notEqual(copy.id, original[0].id); assert.equal(copy.layer, 'Source'); assert.equal(copy.color, '#12abef'); assert.equal(copy.lineweight, 0.5);
  point(copy.start, [25, 15]); point(copy.end, [125, 15]); e.undo(); assert.deepEqual(e.state.entities, original); e.redo(); assert.equal(e.state.entities.length, 2);
});

test('ROTATE signed degree angle preserves distance and exact cardinal coordinates', () => {
  const e = core.createEditor(); line(e, '10,0', '30,0'); e.select([e.state.entities[0].id]); const original = geometry(e);
  submit(e, ['RO', '0,0', '90']); point(e.state.entities[0].start, [0, 10]); point(e.state.entities[0].end, [0, 30]);
  e.undo(); assert.deepEqual(e.state.entities, original); e.select([original[0].id]); submit(e, ['ROTATE', '0,0', '-90']); point(e.state.entities[0].start, [0, -10]); point(e.state.entities[0].end, [0, -30]);
});

test('ROTATE direction point computes angle from base point', () => {
  const e = core.createEditor(); line(e, '10,10', '30,10'); e.select([e.state.entities[0].id]);
  submit(e, ['ROTATE', '10,10', '@0,20']); point(e.state.entities[0].start, [10, 10]); point(e.state.entities[0].end, [10, 30]);
});

test('ROTATE preserves rectangle shape and circle radius around a shared base', () => {
  const e = core.createEditor(); submit(e, ['REC', '10,0', '20,10', 'CIRCLE', '30,0', '5']);
  e.select(e.state.entities.map(entity => entity.id)); submit(e, ['ROTATE', '0,0', '90']);
  [[0,10],[0,20],[-10,20],[-10,10]].forEach((p,index) => point(e.state.entities[0].points[index], p));
  point(e.state.entities[1].center, [0,30]); assert.equal(e.state.entities[1].radius, 5);
  const imported = core.createEditor(JSON.parse(e.serialize())); assert.deepEqual(imported.state.entities, e.state.entities);
});

test('rotated rectangle grip preview matches commit and retains orthogonal edges', () => {
  const e = core.createEditor(); submit(e, ['REC', '0,0', '20,10']); e.select([e.state.entities[0].id]); submit(e, ['RO', '0,0', '45']);
  const original = geometry(e), entity = e.state.entities[0], p = {x: -3, y: -5};
  const preview = core.previewGrip(entity, 0, p); assert.equal(e.moveGrip(entity.id, 0, p).ok, true); assert.deepEqual(e.state.entities[0], preview);
  point(preview.points[2], [original[0].points[2].x, original[0].points[2].y]);
  const [a,b,,d] = preview.points; assert.ok(Math.abs((b.x-a.x)*(d.x-a.x)+(b.y-a.y)*(d.y-a.y)) < EPS);
  assert.doesNotThrow(() => core.createEditor(JSON.parse(e.serialize()))); e.undo(); assert.deepEqual(e.state.entities, original);
});

test('transform previews are pure and do not change document or history', () => {
  const e = core.createEditor(); line(e); e.select([e.state.entities[0].id]); submit(e, ['MOVE', '0,0']);
  const original = geometry(e), beforeHistory = e.state.history.length;
  const preview = e.previewCommand({x: 10, y: 20}); point(preview[0].start, [10,20]);
  assert.deepEqual(e.state.entities, original); assert.equal(e.state.history.length, beforeHistory); e.cancel(); assert.deepEqual(e.state.entities, original);
});

test('invalid transform destination is rejected before mutating any selected entities', () => {
  const e = core.createEditor(); line(e); e.select([e.state.entities[0].id]); submit(e, ['MOVE', '-1e308,0']);
  const original = geometry(e); assert.equal(e.execute('1e308,0').ok, false); assert.deepEqual(e.state.entities, original); assert.equal(e.state.commandPhase, 'target');
  e.cancel(); assert.deepEqual(e.state.entities, original);
});

test('CIRCLE JSON import rejects invalid radius atomically and DXF exports native circle geometry', () => {
  const e = core.createEditor(); submit(e, ['C', '12.5,-4', '3.25']); const original = geometry(e);
  const serialized = JSON.parse(e.serialize()); serialized.entities[0].radius = -5;
  assert.equal(e.importJSON(serialized).ok, false); assert.deepEqual(e.state.entities, original);
  const dxf = e.exportDXF(); assert.match(dxf, /0\r\nCIRCLE\r\n/); assert.match(dxf, /100\r\nAcDbCircle\r\n10\r\n12\.5\r\n20\r\n-4\r\n30\r\n0\r\n40\r\n3\.25\r\n/);
});

test('synthetic sequence: circle radius recovery, diameter, Last MOVE and COPY', () => {
  const e = core.createEditor(); submit(e, ['C', '150,25']);
  assert.equal(e.execute('-5').ok, false); assert.equal(e.state.commandPhase, 'radius'); assert.equal(e.state.entities.length, 0);
  const outcomes = submit(e, ['25', 'CIRCLE', '220,25', 'D', '20', 'MOVE', 'L', '', '0,0', '@10,5', 'COPY', 'L', '', '0,0', '@30,0']);
  assert.ok(outcomes.every(outcome => outcome.ok));
  assert.equal(e.state.entities.length, 3);
  [[150,25,25],[230,30,10],[260,30,10]].forEach(([x,y,radius], index) => {
    point(e.state.entities[index].center, [x,y]); assert.equal(e.state.entities[index].radius, radius);
  });
});

test('unimplemented transform options reject explicitly without losing active geometry or phase', () => {
  const e = core.createEditor(); line(e); const original = geometry(e); e.select([original[0].id]); e.execute('COPY');
  assert.match(e.execute('Displacement').message, /not implemented/); assert.equal(e.state.commandPhase, 'base');
  e.execute('0,0'); assert.match(e.execute('Array').message, /not implemented/); assert.equal(e.state.commandPhase, 'target'); e.cancel();
  e.select([original[0].id]); submit(e, ['ROTATE', '0,0']);
  for (const input of ['Reference', 'Copy']) { assert.match(e.execute(input).message, /not implemented/); assert.equal(e.state.commandPhase, 'angle'); }
  assert.deepEqual(e.state.entities, original); e.cancel();
});

test('interactive COPY defaults to repeated destinations and Enter completes one undo group', () => {
  const e = core.createEditor(); line(e); const original = geometry(e); e.select([original[0].id]);
  submit(e, ['COPY', '0,0', '20,0']); assert.equal(e.state.command, 'COPY'); assert.equal(e.state.commandPhase, 'target');
  assert.equal(e.state.commandData.copyMode, 'multiple'); assert.equal(e.state.entities.length, 2);
  e.execute('40,0'); assert.equal(e.state.entities.length, 3); point(e.state.entities[1].start, [20,0]); point(e.state.entities[2].start, [40,0]);
  assert.equal(e.state.commandData.copyCount, 2); e.execute(''); assert.equal(e.state.command, null);
  const completed = geometry(e); e.undo(); assert.deepEqual(e.state.entities, original); e.redo(); assert.deepEqual(e.state.entities, completed);
});

test('COPY local Undo removes one whole destination batch and global Undo removes remaining copies', () => {
  const e = core.createEditor(); submit(e, ['REC', '0,0', '10,20', 'CIRCLE', '40,0', '5']);
  const original = geometry(e); e.select(e.state.entities.map(entity => entity.id)); submit(e, ['COPY', '0,0', '20,0', '40,0']);
  assert.equal(e.state.entities.length, 6); assert.equal(e.undo().ok, true); assert.equal(e.state.entities.length, 4); assert.equal(e.state.commandData.copyCount, 1);
  point(e.state.entities[2].points[0], [20,0]); point(e.state.entities[3].center, [60,0]);
  e.execute('EXIT'); e.undo(); assert.deepEqual(e.state.entities, original); e.redo(); assert.equal(e.state.entities.length, 4);
});

test('COPY Escape retains completed copies and closes their transaction', () => {
  const e = core.createEditor(); line(e); const original = geometry(e); e.select([original[0].id]); submit(e, ['CO', '0,0', '20,0', '40,0']);
  const completed = geometry(e); e.cancel(); assert.equal(e.state.command, null); assert.deepEqual(e.state.entities, completed); assert.deepEqual(e.state.selectionIds, []);
  e.undo(); assert.deepEqual(e.state.entities, original); e.redo(); assert.deepEqual(e.state.entities, completed);
});

test('COPY Single mode completes after one destination and mode does not persist', () => {
  const e = core.createEditor(); line(e); const originalId = e.state.entities[0].id; e.select([originalId]);
  submit(e, ['COPY', 'MODE']); assert.equal(e.state.commandPhase, 'mode'); assert.equal(e.execute('unknown').ok, false);
  submit(e, ['Single', '0,0', '20,0']); assert.equal(e.state.command, null); assert.equal(e.state.entities.length, 2);
  e.select([originalId]); e.execute('COPY'); assert.equal(e.state.commandData.copyMode, 'multiple'); e.cancel();
});

test('COPY mode default acceptance and removal of all copies leave no empty transaction', () => {
  const e = core.createEditor(); line(e); const original = geometry(e); e.select([original[0].id]);
  submit(e, ['COPY', 'MO', '', '0,0']); assert.equal(e.state.commandData.copyMode, 'multiple');
  assert.equal(e.execute('U').ok, false); submit(e, ['20,0', 'Undo', '']); assert.deepEqual(e.state.entities, original);
  e.undo(); assert.equal(e.state.entities.length, 0);
});

test('synthetic repeated COPY sequence: every relative destination uses the original base', () => {
  const e = core.createEditor(); submit(e, ['CIRCLE', '260,30', '10', 'CO', 'L', '', '0,0', '@20,0', '@40,0', '']);
  assert.equal(e.state.command, null); assert.equal(e.state.entities.length, 3);
  [[260,30],[280,30],[300,30]].forEach((p,index) => { point(e.state.entities[index].center, p); assert.equal(e.state.entities[index].radius, 10); });
  const complete = geometry(e); e.undo(); assert.equal(e.state.entities.length, 1); e.redo(); assert.deepEqual(e.state.entities, complete);
});

test('repeated COPY relative Cartesian and polar destinations keep a nonzero base fixed', () => {
  const e = core.createEditor(); line(e); e.select([e.state.entities[0].id]);
  submit(e, ['COPY', '10,5', '@20,0', '@40,0', '@10<90', '']);
  [[0,0],[20,0],[40,0],[0,10]].forEach((p,index) => point(e.state.entities[index].start, p));
});







test('typed radius property retains exact scalar precision at a large center and supports Undo/Redo', () => {
  const e = core.createEditor(); submit(e, ['CIRCLE', '1000000000000,1000000000000', '10']);
  const id = e.state.entities[0].id, original = geometry(e);
  assert.equal(e.setCircleRadius(id, 0.1).ok, true); assert.equal(e.state.entities[0].radius, 0.1);
  point(e.state.entities[0].center, [1e12,1e12]); assert.equal(core.createEditor(JSON.parse(e.serialize())).state.entities[0].radius, 0.1);
  e.undo(); assert.deepEqual(e.state.entities, original); e.redo(); assert.equal(e.state.entities[0].radius, 0.1);
});

test('radius property validation is atomic and protects locked circles and active commands', () => {
  const e = core.createEditor(); submit(e, ['CIRCLE', '20,30', '10']); const id = e.state.entities[0].id, original = geometry(e);
  for (const radius of [0,-5,Infinity,NaN,'12']) { assert.equal(e.setCircleRadius(id, radius).ok, false); assert.deepEqual(e.state.entities, original); }
  e.updateLayer('0', {locked: true}); assert.equal(e.setCircleRadius(id, 20).ok, false); assert.deepEqual(e.state.entities, original);
  e.updateLayer('0', {locked: false}); e.execute('LINE'); assert.equal(e.setCircleRadius(id, 20).ok, false); assert.deepEqual(e.state.entities, original); e.cancel();
  assert.equal(e.setCircleRadius('missing', 20).ok, false); assert.deepEqual(e.state.entities, original);
});

test('large-origin non-cardinal rectangles round-trip using coordinate resolution', () => {
  for (const [origin,size] of [[1e8,0.01],[1e12,10],[-1e12,10]]) for (const angle of [13,30,61]) {
    const e = core.createEditor(); const xy = (x,y) => `${x},${y}`;
    const outcomes = submit(e, ['RECTANG', xy(origin,origin), xy(origin+size,origin+size*2), 'ROTATE', 'L', '', xy(origin,origin), String(angle)]);
    assert.ok(outcomes.every(outcome => outcome.ok), `${origin}/${size}/${angle}`);
    const actual = geometry(e); const imported = core.createEditor(); assert.equal(imported.importJSON(e.serialize()).ok, true); assert.deepEqual(imported.state.entities, actual);
    e.undo(); e.redo(); assert.deepEqual(e.state.entities, actual);
  }
});

test('rectangle coordinate tolerance rejects real skew, wrong closure and sub-unit malformed corners', () => {
  const e = core.createEditor(); submit(e, ['REC', '1000000000000,1000000000000', '1000000000010,1000000000020']);
  const original = geometry(e), skew = JSON.parse(e.serialize());
  skew.entities[0].points[2].x += 1; skew.entities[0].points[3].x += 1;
  assert.equal(e.importJSON(skew).ok, false); assert.deepEqual(e.state.entities, original);
  const open = JSON.parse(e.serialize()); open.entities[0].points[2].y += 1;
  assert.equal(e.importJSON(open).ok, false); assert.deepEqual(e.state.entities, original);
  const tiny = {entities:[{id:'tiny',type:'RECTANG',layer:'0',points:[{x:0,y:0},{x:1e-12,y:0},{x:1e-10,y:2e-12},{x:0,y:2e-12}]}]};
  assert.equal(e.importJSON(tiny).ok, false); assert.deepEqual(e.state.entities, original);
});

test('rectangle construction rejects overflowed edge spans before adding unsaveable geometry', () => {
  const e = core.createEditor(); submit(e, ['REC', '-1e308,-1e308']); assert.equal(e.execute('1e308,1e308').ok, false);
  assert.equal(e.state.entities.length, 0); assert.equal(e.state.command, 'RECTANG'); e.cancel(); assert.equal(e.canUndo, false);
});

test('multi-object transform validates every result before mutating the selected document', () => {
  const e = core.createEditor(); submit(e, ['LINE','0,0','1,0','','RECTANG','10,0','11,1']);
  const original = geometry(e); e.select(e.state.entities.map(entity => entity.id)); submit(e, ['MOVE','0,0']);
  assert.equal(e.execute('1e20,1e20').ok, false); assert.deepEqual(e.state.entities, original); assert.equal(e.state.commandPhase, 'target'); e.cancel();
});

test('very small signed rotation and polar angles retain scientific-notation precision', () => {
  const line = {id:'angle',type:'LINE',start:{x:0,y:0},end:{x:1e12,y:0},layer:'0'};
  for (const angle of [1e-12,-1e-12,1e-15,-1e-15]) {
    const expectedY = 1e12*Math.sin(angle*Math.PI/180);
    const rotated = core.rotateEntity(line,{x:0,y:0},angle); assert.ok(Math.abs(rotated.end.y-expectedY) < Math.abs(expectedY)*1e-12);
    const polar = core.parseCoordinate(`@1000000000000<${angle}`,{x:0,y:0}); assert.ok(Math.abs(polar.y-expectedY) < Math.abs(expectedY)*1e-12);
  }
});

test('Fit uses sub-unit extents and reaches the supported upper scale for tiny circles and lines', () => {
  const base = {center:{x:0,y:0},scale:10};
  const circle = {id:'small',type:'CIRCLE',center:{x:0,y:0},radius:0.1,layer:'0'};
  assert.equal(core.zoomExtents([circle],base,800,600,40).scale, 2600);
  circle.radius = 1e-6; assert.equal(core.zoomExtents([circle],base,800,600,40).scale, 1e6);
  const vertical = {id:'vertical',type:'LINE',start:{x:0,y:0},end:{x:0,y:1e-6},layer:'0'};
  assert.equal(core.zoomExtents([vertical],base,800,600,40).scale, 1e6);
});

test('finite extreme-coordinate Fit and midpoint snaps do not overflow or invalidate persistence', () => {
  const e = core.createEditor(); submit(e, ['LINE','1e308,0','1e308,1','','Z','E']);
  assert.equal(e.state.viewport.center.x, 1e308); assert.equal(e.state.viewport.center.y, 0.5);
  assert.equal(core.createEditor().importJSON(e.serialize()).ok, true);
  const snapped = core.findSnap(e.state.entities,{x:1e308,y:0.5},0.1); assert.equal(snapped.type,'midpoint'); assert.equal(snapped.point.x,1e308);
  const opposing = {id:'opposing',type:'LINE',start:{x:-1e308,y:0},end:{x:1e308,y:0},layer:'0'};
  const fitted = core.zoomExtents([opposing],e.state.viewport,800,600); assert.ok(Number.isFinite(fitted.center.x)); assert.ok(Number.isFinite(fitted.center.y)); assert.ok(Number.isFinite(fitted.scale));
});

test('unsupported viewport scales are rejected atomically while boundary scales stay valid', () => {
  const e = core.createEditor(); line(e); const original = geometry(e), viewport = structuredClone(e.state.viewport);
  for (const scale of [0,1e-320,1e-7,1e7,Infinity,NaN]) {
    const doc = JSON.parse(e.serialize()); doc.viewport.scale = scale; assert.equal(e.importJSON(doc).ok,false); assert.deepEqual(e.state.entities,original); assert.deepEqual(e.state.viewport,viewport);
  }
  for (const scale of [1e-6,1e6]) { const doc = JSON.parse(e.serialize()); doc.viewport.scale=scale; assert.doesNotThrow(() => core.createEditor(doc)); }
});

test('modern DXF ownership graph contains valid symbol tables, layout links and plot-style targets', () => {
  const e = core.createEditor(); submit(e,['CIRCLE','10,20','5','REC','30,40','50,60']);
  const lines = e.exportDXF().trimEnd().split(/\r?\n/), records=[]; let record=null;
  for(let i=0;i<lines.length;i+=2){const code=Number(lines[i]),value=lines[i+1]; if(code===0){record={type:value,fields:[]};records.push(record);}else record?.fields.push([code,value]);}
  const field=(record,code)=>record.fields.find(pair=>pair[0]===code)?.[1];
  const database=records.filter(record=>!['SECTION','ENDSEC','ENDTAB','EOF','CLASS'].includes(record.type));
  const ids=database.map(record=>field(record,record.type==='DIMSTYLE'?105:5));
  assert.ok(ids.every(id=>id&&/^[0-9A-F]+$/.test(id))); assert.equal(new Set(ids).size,ids.length);
  const lookup=new Map(database.map((record,index)=>[ids[index],record]));
  for(const record of database)for(const[code,target]of record.fields)if([330,340,350,390,347].includes(code)&&target!=='0')assert.ok(lookup.has(target),`${record.type} dangling ${code}/${target}`);
  const tableNames=new Set(records.filter(record=>record.type==='TABLE').map(record=>field(record,2)));
  for(const name of ['APPID','STYLE','BLOCK_RECORD','LTYPE','LAYER'])assert.ok(tableNames.has(name));
  assert.ok(records.some(record=>record.type==='APPID'&&field(record,2)==='ACAD'));
  for(const entity of database.filter(record=>['LINE','CIRCLE','LWPOLYLINE'].includes(record.type)))assert.equal(lookup.get(field(entity,330)).type,'BLOCK_RECORD');
  for(const layer of database.filter(record=>record.type==='LAYER'))assert.equal(lookup.get(field(layer,390)).type,'ACDBPLACEHOLDER');
  const plotDictionary=database.find(record=>record.type==='ACDBDICTIONARYWDFLT'); assert.equal(lookup.get(field(plotDictionary,340)).type,'ACDBPLACEHOLDER');
  assert.ok(!e.exportDXF().includes('$CTAB')); assert.ok(e.exportDXF().includes('AC1027'));
});

test('ERASE prompts for selection, accepts Last and All, and groups Undo/Redo', () => {
  const e=core.createEditor({entities:fixtureEntities()});
  accepted(e,['E','L','']); assert.equal(e.state.entities.length,2); assert.equal(e.state.command,null);
  accepted(e,['U']); assert.equal(e.state.entities.length,3); accepted(e,['REDO']); assert.equal(e.state.entities.length,2);
  accepted(e,['E','ALL','']); assert.equal(e.state.entities.length,0); accepted(e,['U']); assert.equal(e.state.entities.length,2);
});

test('ERASE pickfirst deletes only editable selected objects and empty selection retains prompt', () => {
  const e=core.createEditor({entities:fixtureEntities()});
  accepted(e,['E']); assert.equal(e.execute('').ok,false); assert.equal(e.state.commandPhase,'selection'); accepted(e,['ESC']);
  e.select(['a','b']); accepted(e,['ERASE']); assert.deepEqual(e.state.entities.map(entity=>entity.id),['c']);
  accepted(e,['U']); assert.equal(e.state.entities.length,3);
});

test('geometry clipboard copies normalized IDs-free entities and exact explicit base without drawing mutation', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a','c']); const before=e.serialize();
  assert.equal(e.copySelection({x:10,y:20}).ok,true); const data=e.getClipboard();
  assert.equal(data.format,'LinecraftClipboard/1'); point(data.base,[10,20]); assert.equal(data.entities.length,2);
  assert.ok(data.entities.every(entity=>!('id'in entity))); assert.equal(e.serialize(),before); assert.equal(e.canUndo,false);
  data.entities[0].start.x=900; point(e.getClipboard().entities[0].start,[0,0]);
});

test('clipboard rejects malformed geometry and metadata atomically', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a']); e.copySelection(); const before=e.getClipboard();
  for(const bad of [{...before,format:'other'}, {...before,base:{x:Infinity,y:0}}, {...before,entities:[]}, {...before,entities:[{type:'CIRCLE',center:{x:0,y:0},radius:-1,layer:'0'}]}, {...before,layers:[{name:'bad/name'}]}]) {
    assert.equal(e.setClipboard(bad).ok,false); assert.deepEqual(e.getClipboard(),before);
  }
});

test('COPYBASE and PASTECLIP use stable relative base, import missing layers and group undo', () => {
  const source=core.createEditor({entities:fixtureEntities()}); source.addLayer('Detail',{color:'#ff4400',lineweight:0.5});
  source.select(['a']); source.setSelectionProperties({layer:'Detail',color:'#336699'});
  accepted(source,['COPYBASE','10,20']); const data=source.getClipboard(); point(data.base,[10,20]);
  const destination=core.createEditor(); assert.equal(destination.setClipboard(JSON.stringify(data)).ok,true);
  accepted(destination,['PASTECLIP','@100,50']); const pasted=destination.state.entities[0];
  point(pasted.start,[100,50]); point(pasted.end,[200,50]); assert.equal(pasted.color,'#336699'); assert.equal(pasted.layer,'Detail');
  assert.equal(destination.state.layers.find(layer=>layer.name==='Detail').color,'#ff4400');
  accepted(destination,['U']); assert.equal(destination.state.entities.length,0); assert.equal(destination.state.layers.length,1);
  accepted(destination,['REDO']); assert.equal(destination.state.entities.length,1);
  accepted(destination,['PASTECLIP','0,0']); point(destination.state.entities[1].start,[-10,-20]); point(destination.getClipboard().base,[10,20]);
});

test('PASTE preview is pure and rejects locked target layers before any layer or entity changes', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a']); e.copySelection(); e.updateLayer('0',{locked:true});
  accepted(e,['PASTECLIP']); const before=e.serialize(); const preview=e.previewCommand({x:20,y:30}); point(preview[0].start,[20,30]);
  assert.equal(e.serialize(),before); assert.equal(e.execute('20,30').ok,false); assert.equal(e.serialize(),before); accepted(e,['ESC']);
});

test('CUTCLIP requires successful acknowledgement and groups deletion only after a successful native write', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a','b']); accepted(e,['CUTCLIP']);
  assert.equal(e.state.commandPhase,'clipboard-ready'); assert.equal(e.state.entities.length,3); assert.equal(e.canUndo,false);
  assert.equal(e.finishClipboardCut(false).ok,true); assert.equal(e.state.entities.length,3); assert.equal(e.canUndo,false);
  e.select(['a','b']); accepted(e,['CUTCLIP']); assert.equal(e.finishClipboardCut(true).ok,true); assert.equal(e.state.entities.length,1);
  accepted(e,['U']); assert.equal(e.state.entities.length,3); accepted(e,['REDO']); assert.equal(e.state.entities.length,1);
});

test('CUTCLIP pending Escape, changed selection or changed source can never erase geometry', () => {
  for(const action of ['escape','selection','geometry']) {
    const e=core.createEditor({entities:fixtureEntities()}); e.select(['a']); accepted(e,['CUTCLIP']);
    if(action==='escape') accepted(e,['ESC']); else if(action==='selection') e.select(['b']); else e.state.entities[0].end.x=120;
    assert.equal(e.finishClipboardCut(true).ok,false); assert.equal(e.state.entities.length,3);
  }
});

test('PLINE stores one entity, supports local Undo and Close, and global Undo restores the entire command', () => {
  const e=core.createEditor(); accepted(e,['PL','0,100','30,100','30,130','U','40,100','40,120','C']);
  const p=e.state.entities[0]; assert.equal(p.type,'PLINE'); assert.equal(p.closed,true); assert.equal(p.points.length,4);
  [[0,100],[30,100],[40,100],[40,120]].forEach((value,index)=>point(p.points[index],value));
  accepted(e,['U']); assert.equal(e.state.entities.length,0); accepted(e,['REDO']); assert.deepEqual(e.state.entities[0],p);
});

test('PLINE open completion, grip editing, snaps, hit selection and JSON/DXF retain shape', () => {
  const e=core.createEditor(); accepted(e,['PL','0,0','10,0','10,10','']);
  const polyline=e.state.entities[0]; assert.equal(polyline.closed,false); assert.equal(core.entityGripPoints(polyline).length,3);
  assert.equal(core.hitTest([polyline],{x:10,y:5},0.1),polyline.id); assert.equal(core.hitTest([polyline],{x:5,y:5},0.1),null);
  assert.equal(core.findSnap([polyline],{x:5,y:0},0.1).type,'midpoint');
  assert.deepEqual(core.entitiesInBox([polyline],{x:12,y:6},{x:8,y:4},true),[polyline.id]);
  assert.equal(e.moveGrip(polyline.id,1,{x:12,y:0}).ok,true); point(e.state.entities[0].points[1],[12,0]);
  assert.equal(e.moveGrip(polyline.id,1,{x:0,y:0}).ok,false);
  assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.entities,e.state.entities);
  assert.match(e.exportDXF(),/AcDbPolyline\r\n90\r\n3\r\n70\r\n0/);
});

test('PLINE local Undo down to one point and cancel creates no empty transaction', () => {
  const e=core.createEditor(); accepted(e,['PL','0,0','10,0','U','ESC']); assert.equal(e.state.entities.length,0); assert.equal(e.canUndo,false);
  accepted(e,['PL','0,0']); const before=e.serialize(); assert.equal(e.execute('ARC').ok,false); assert.equal(e.serialize(),before); accepted(e,['ESC']);
});

test('SCALE applies exact positive scalar to mixed geometry and rejects invalid factors atomically', () => {
  const e=core.createEditor({entities:fixtureEntities()}); accepted(e,['C','10,10','5']); e.select(e.state.entities.map(entity=>entity.id));
  accepted(e,['SC','0,0']); const before=e.serialize(); assert.equal(e.execute('-2').ok,false); assert.equal(e.execute('0').ok,false); assert.equal(e.serialize(),before);
  accepted(e,['2']); point(e.state.entities[0].end,[200,0]); point(e.state.entities[3].center,[20,20]); assert.equal(e.state.entities[3].radius,10);
  accepted(e,['U']); point(e.state.entities[0].end,[100,0]); assert.equal(e.state.entities[3].radius,5);
});

test('SCALE overflow in any selected entity leaves all entities and command phase unchanged', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a','c']); accepted(e,['SC','0,0']); const before=e.serialize();
  assert.equal(e.execute('1e308').ok,false); assert.equal(e.serialize(),before); assert.equal(e.state.commandPhase,'factor');
});

test('MIRROR preserves originals by default, copies properties and supports original deletion choice', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a','c']); accepted(e,['MI','0,0','0,10','']);
  assert.equal(e.state.entities.length,5); point(e.state.entities[3].end,[-100,0]); point(e.state.entities[4].points[2],[-60,30]);
  accepted(e,['U']); assert.equal(e.state.entities.length,3); e.select(['c']); accepted(e,['MI','0,0','0,10','Y']);
  assert.equal(e.state.entities.length,3); assert.equal(e.state.entities[2].id,'c'); point(e.state.entities[2].points[2],[-60,30]);
  accepted(e,['U']); point(e.state.entities[2].points[2],[60,30]);
});

test('MIRROR arbitrary axis is involutive and invalid coincident axis rejects before deletion', () => {
  const e=core.createEditor({entities:fixtureEntities()}); const source=e.state.entities[2];
  const reflected=core.mirrorEntity(source,{x:4,y:-3},{x:19,y:24}), twice=core.mirrorEntity(reflected,{x:4,y:-3},{x:19,y:24});
  source.points.forEach((p,index)=>point(twice.points[index],[p.x,p.y]));
  e.select(['c']); accepted(e,['MI','0,0']); const before=e.serialize(); assert.equal(e.execute('0,0').ok,false); assert.equal(e.serialize(),before);
});

test('TRIM repeated picked end edits honor finite LINE boundaries and local/global Undo', () => {
  const e=core.createEditor({entities:[
    {id:'target',type:'LINE',start:{x:0,y:0},end:{x:100,y:0},layer:'0'},
    {id:'boundary',type:'LINE',start:{x:70,y:-10},end:{x:70,y:10},layer:'0'}]});
  accepted(e,['TR','boundary','','90,0']); point(e.state.entities[0].end,[70,0]); assert.equal(e.state.commandPhase,'target');
  accepted(e,['U']); point(e.state.entities[0].end,[100,0]); accepted(e,['90,0','']); accepted(e,['U']); point(e.state.entities[0].end,[100,0]);
  accepted(e,['REDO']); point(e.state.entities[0].end,[70,0]);
});

test('TRIM circle boundaries produce two exact fragments when the middle is picked', () => {
  const source={id:'line',type:'LINE',start:{x:-20,y:0},end:{x:20,y:0},layer:'0',color:'#336699'};
  const circle={id:'circle',type:'CIRCLE',center:{x:0,y:0},radius:10,layer:'0'};
  const fragments=core.trimLine(source,[circle],{x:0,y:0}); assert.equal(fragments.length,2);
  point(fragments[0].start,[-20,0]); point(fragments[0].end,[-10,0]); point(fragments[1].start,[10,0]); point(fragments[1].end,[20,0]);
  const e=core.createEditor({entities:[source,circle]}); accepted(e,['TR','circle','','0,0','']);
  const lines=e.state.entities.filter(entity=>entity.type==='LINE'); assert.equal(lines.length,2); assert.equal(new Set(lines.map(entity=>entity.id)).size,2); assert.ok(lines.every(entity=>entity.color==='#336699'));
});

test('TRIM rectangle and PLINE boundaries intersect actual finite edges; absent cuts reject atomically', () => {
  const line={id:'line',type:'LINE',start:{x:0,y:20},end:{x:100,y:20},layer:'0'};
  const rectangle=fixtureEntities()[2]; const fragments=core.trimLine(line,[rectangle],{x:40,y:20});
  point(fragments[0].end,[20,20]); point(fragments[1].start,[60,20]);
  const e=core.createEditor({entities:[line,{id:'p',type:'PLINE',points:[{x:70,y:0},{x:70,y:40}],closed:false,layer:'0'}]});
  accepted(e,['TR','p','','90,20','']); point(e.state.entities[0].end,[70,20]);
  const far={id:'far',type:'LINE',start:{x:50,y:60},end:{x:50,y:80},layer:'0'};
  assert.deepEqual(core.lineIntersections(line,[far]),[]); assert.throws(()=>core.trimLine(line,[far],{x:20,y:20}),/No cutting/);
});

test('EXTEND selects the picked endpoint and nearest finite boundary, including circle intersections', () => {
  const line={id:'line',type:'LINE',start:{x:0,y:50},end:{x:40,y:50},layer:'0'};
  const near={id:'near',type:'LINE',start:{x:80,y:40},end:{x:80,y:60},layer:'0'};
  const far={id:'far',type:'LINE',start:{x:100,y:40},end:{x:100,y:60},layer:'0'};
  point(core.extendLine(line,[near,far],{x:35,y:50}).end,[80,50]);
  const circle={id:'circle',type:'CIRCLE',center:{x:-30,y:50},radius:10,layer:'0'};
  point(core.extendLine(line,[circle],{x:5,y:50}).start,[-20,50]);
  const e=core.createEditor({entities:[line,near]}); accepted(e,['EX','near','','35,50','U','35,50','']); point(e.state.entities[0].end,[80,50]);
  accepted(e,['U']); point(e.state.entities[0].end,[40,50]);
});

test('TRIM/EXTEND unsupported targets, ambiguous cut points and parallel boundaries preserve the drawing', () => {
  const e=core.createEditor({entities:fixtureEntities()}); accepted(e,['TR','b','']); const before=e.serialize();
  assert.equal(e.execute('40,10').ok,false); assert.equal(e.serialize(),before); accepted(e,['ESC']);
  const source={type:'LINE',start:{x:0,y:0},end:{x:100,y:0}};
  assert.throws(()=>core.trimLine(source,[{type:'LINE',start:{x:50,y:-10},end:{x:50,y:10}}],{x:50,y:0}),/away/);
  assert.throws(()=>core.extendLine(source,[{type:'LINE',start:{x:200,y:0},end:{x:300,y:0}}],{x:90,y:0}),/No boundary/);
});

test('OFFSET LINE uses the picked side and repeated edits share local/global Undo', () => {
  const e=core.createEditor(); line(e); accepted(e,['O','10','50,0','50,-10']); point(e.state.entities[1].start,[0,-10]); point(e.state.entities[1].end,[100,-10]);
  assert.equal(e.state.commandPhase,'object'); accepted(e,['U']); assert.equal(e.state.entities.length,1);
  accepted(e,['50,0','50,10','']); assert.equal(e.state.entities.length,2); accepted(e,['U']); assert.equal(e.state.entities.length,1);
});

test('OFFSET circles and oriented rectangles preserve exact distances; collapsed inward offsets reject', () => {
  const circle={id:'c',type:'CIRCLE',center:{x:220,y:10},radius:10,layer:'0'};
  assert.equal(core.offsetEntity(circle,3,{x:240,y:10}).radius,13); assert.equal(core.offsetEntity(circle,3,{x:220,y:10}).radius,7);
  assert.throws(()=>core.offsetEntity(circle,10,{x:220,y:10}),/positive/);
  const rectangle=core.rotateEntity(fixtureEntities()[2],{x:0,y:0},37);
  const center={x:(rectangle.points[0].x+rectangle.points[2].x)/2,y:(rectangle.points[0].y+rectangle.points[2].y)/2};
  const inner=core.offsetEntity(rectangle,3,center); assert.ok(Math.abs(Math.hypot(inner.points[1].x-inner.points[0].x,inner.points[1].y-inner.points[0].y)-34)<EPS);
  assert.ok(Math.abs(Math.hypot(inner.points[3].x-inner.points[0].x,inner.points[3].y-inner.points[0].y)-14)<EPS);
  assert.throws(()=>core.offsetEntity(rectangle,10,center),/collapse/);
});

test('OFFSET invalid distance, unsupported PLINE source and on-line side rejection are atomic', () => {
  const e=core.createEditor(); accepted(e,['PL','0,0','10,0','']); accepted(e,['O']); const before=e.serialize();
  assert.equal(e.execute('-1').ok,false); assert.equal(e.serialize(),before); accepted(e,['1']); assert.equal(e.execute('5,0').ok,false); accepted(e,['ESC']);
  line(e,'0,20','10,20'); accepted(e,['O','1','5,20']); const after=e.serialize(); assert.equal(e.execute('6,20').ok,false); assert.equal(e.serialize(),after);
});

test('BREAK two points preserves left/right fragments and supports touching split and global Undo', () => {
  const e=core.createEditor(); line(e,'400,0','500,0'); accepted(e,['BR','L','','430,0','470,0']);
  assert.equal(e.state.entities.length,2); point(e.state.entities[0].end,[430,0]); point(e.state.entities[1].start,[470,0]);
  accepted(e,['U']); assert.equal(e.state.entities.length,1); point(e.state.entities[0].end,[500,0]);
  accepted(e,['BR','L','','450,0','450,0']); assert.equal(e.state.entities.length,2); point(e.state.entities[0].end,[450,0]); point(e.state.entities[1].start,[450,0]);
});

test('BREAK projections preserve segment order and reject out-of-range second point without edits', () => {
  const source={type:'LINE',start:{x:0,y:0},end:{x:100,y:0},layer:'0'};
  const result=core.breakLine(source,{x:70,y:10},{x:30,y:-20}); point(result[0].end,[30,0]); point(result[1].start,[70,0]);
  const e=core.createEditor({entities:[{...source,id:'line'}]}); accepted(e,['BR','L','','30,0']); const before=e.serialize();
  assert.equal(e.execute('200,0').ok,false); assert.equal(e.serialize(),before); assert.equal(e.state.commandPhase,'second-break');
});

test('editing previews are pure and clipboard/offset/scale/mirror commit the same geometry', () => {
  const e=core.createEditor({entities:fixtureEntities()}); e.select(['a']); accepted(e,['SC','0,0']); const before=e.serialize();
  const preview=e.previewCommand({x:2,y:0}); assert.equal(e.serialize(),before); accepted(e,['2']); point(e.state.entities[0].end,[preview[0].end.x,preview[0].end.y]);
  e.select(['a']); accepted(e,['MI','0,0']); const reflected=e.previewCommand({x:0,y:10}); accepted(e,['0,10','']); point(e.state.entities.at(-1).end,[reflected[0].end.x,reflected[0].end.y]);
});

test('ARC three-point construction follows the middle point for both signed sweeps and groups Undo',()=>{
  const e=core.createEditor();accepted(e,['A','10,0','0,10','-10,0']);const arc=e.state.entities[0];
  assert.equal(arc.type,'ARC');point(arc.center,[0,0]);assert.equal(arc.radius,10);assert.equal(arc.startAngle,0);assert.equal(arc.sweepAngle,180);
  point(core.arcPoint(arc,0),[10,0]);point(core.arcPoint(arc,.5),[0,10]);point(core.arcPoint(arc,1),[-10,0]);
  accepted(e,['U']);assert.equal(e.state.entities.length,0);accepted(e,['REDO']);assert.deepEqual(e.state.entities[0],arc);
  accepted(e,['ARC','10,0','0,-10','-10,0']);assert.equal(e.state.entities[1].sweepAngle,-180);point(core.arcPoint(e.state.entities[1],.5),[0,-10]);
});

test('ARC clockwise major sweep, origin-independent circumcircle and scientific precision retain geometry',()=>{
  const arc=core.arcThroughPoints({x:1,y:0},{x:-1,y:0},{x:0,y:1});point(arc.center,[0,0]);assert.equal(arc.sweepAngle,-270);point(core.arcPoint(arc,1),[0,1]);
  const large=core.arcThroughPoints({x:1e12+10,y:1e12},{x:1e12,y:1e12+10},{x:1e12-10,y:1e12});
  assert.equal(large.center.x,1e12);assert.equal(large.center.y,1e12);assert.equal(large.radius,10);assert.equal(large.sweepAngle,180);
  const tiny=core.arcThroughPoints({x:1e-15,y:0},{x:0,y:1e-15},{x:-1e-15,y:0});assert.equal(tiny.radius,1e-15);assert.equal(tiny.sweepAngle,180);
});

test('ARC rejects duplicate/collinear points and unsupported modes without leaving its recoverable prompt',()=>{
  const e=core.createEditor();accepted(e,['A','0,0']);assert.equal(e.execute('0,0').ok,false);assert.equal(e.state.commandPhase,'arc-second');
  accepted(e,['10,0']);const before=e.serialize();assert.equal(e.execute('20,0').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'arc-third');
  assert.equal(e.execute('CENTER').ok,false);accepted(e,['10,10']);assert.equal(e.state.entities.length,1);
});

test('ARC actual sweep bounds, hit tests, window/crossing and snaps exclude the untraced circle',()=>{
  const arc={id:'arc',...core.arcThroughPoints({x:10,y:0},{x:0,y:10},{x:-10,y:0}),layer:'0'};
  const box=core.bounds([arc]);assert.ok(Math.abs(box.minY)<EPS);assert.equal(box.maxY,10);assert.equal(box.minX,-10);assert.equal(box.maxX,10);
  assert.equal(core.hitTest([arc],{x:0,y:10},.1),'arc');assert.equal(core.hitTest([arc],{x:0,y:-10},.1),null);
  assert.deepEqual(core.entitiesInBox([arc],{x:-11,y:-1},{x:11,y:11},false),['arc']);
  assert.deepEqual(core.entitiesInBox([arc],{x:1,y:9},{x:-1,y:11},true),['arc']);
  assert.deepEqual(core.entitiesInBox([arc],{x:1,y:-11},{x:-1,y:-9},true),[]);
  assert.equal(core.findSnap([arc],{x:10,y:0},.1).type,'endpoint');assert.equal(core.findSnap([arc],{x:0,y:10},.1).type,'midpoint');assert.equal(core.findSnap([arc],{x:0,y:0},.1).type,'center');
});

test('ARC grips reconstruct through start/mid/end and center grip translates without changing the sweep',()=>{
  const arc={id:'arc',...core.arcThroughPoints({x:10,y:0},{x:0,y:10},{x:-10,y:0}),layer:'0'};
  assert.equal(core.entityGripPoints(arc).length,4);const preview=core.previewGrip(arc,1,{x:0,y:20});point(core.arcPoint(preview,.5),[0,20]);
  const e=core.createEditor({entities:[arc]});assert.equal(e.moveGrip('arc',1,{x:0,y:20}).ok,true);assert.deepEqual(e.state.entities[0],preview);
  accepted(e,['U']);assert.equal(e.moveGrip('arc',3,{x:30,y:40}).ok,true);point(e.state.entities[0].center,[30,40]);assert.equal(e.state.entities[0].sweepAngle,180);
});

test('ARC translate/rotate/scale/mirror preserve exact angular direction and clipboard round trip',()=>{
  const arc={id:'arc',...core.arcThroughPoints({x:10,y:0},{x:0,y:10},{x:-10,y:0}),layer:'0'};
  const moved=core.translateEntity(arc,{x:20,y:30});point(moved.center,[20,30]);assert.equal(moved.startAngle,0);
  const rotated=core.rotateEntity(arc,{x:0,y:0},90);point(core.arcPoint(rotated,0),[0,10]);assert.equal(rotated.sweepAngle,180);
  const scaled=core.scaleEntity(arc,{x:0,y:0},2);assert.equal(scaled.radius,20);assert.equal(scaled.startAngle,0);
  const mirrored=core.mirrorEntity(arc,{x:0,y:0},{x:10,y:0});assert.equal(mirrored.sweepAngle,-180);point(core.arcPoint(mirrored,.5),[0,-10]);
  const e=core.createEditor({entities:[arc]});e.select(['arc']);e.copySelection({x:0,y:0});const other=core.createEditor();assert.equal(other.setClipboard(e.getClipboard()).ok,true);accepted(other,['PASTECLIP','20,30']);point(other.state.entities[0].center,[20,30]);assert.equal(other.state.entities[0].sweepAngle,180);
});

test('ARC JSON and DXF preserve shape, including clockwise export as reversed counterclockwise endpoints',()=>{
  const e=core.createEditor();accepted(e,['A','10,0','0,-10','-10,0']);assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.entities,e.state.entities);
  const before=e.serialize(),bad=JSON.parse(before);bad.entities[0].sweepAngle=360;assert.equal(e.importJSON(bad).ok,false);assert.equal(e.serialize(),before);
  assert.match(e.exportDXF(),/AcDbCircle\r\n10\r\n0\r\n20\r\n0\r\n30\r\n0\r\n40\r\n10\r\n100\r\nAcDbArc\r\n50\r\n180\r\n51\r\n0/);
});

test('finite ARC cutting boundaries reject intersections on the untraced circle',()=>{
  const arc={id:'arc',...core.arcThroughPoints({x:10,y:0},{x:0,y:10},{x:-10,y:0}),layer:'0'};
  const upper={id:'line',type:'LINE',start:{x:-20,y:5},end:{x:20,y:5},layer:'0'},lower={...upper,start:{x:-20,y:-5},end:{x:20,y:-5}};
  const intersections=core.lineIntersections(upper,[arc]);assert.equal(intersections.length,2);assert.deepEqual(core.lineIntersections(lower,[arc]),[]);
  const fragments=core.trimLine(upper,[arc],{x:0,y:5});assert.ok(Math.abs(fragments[0].end.x+Math.sqrt(75))<EPS);assert.ok(Math.abs(fragments[1].start.x-Math.sqrt(75))<EPS);
});

test('JOIN reverses and prepends connected LINE/PLINE paths, retains source style and groups Undo',()=>{
  const entities=[{id:'a',type:'LINE',start:{x:10,y:0},end:{x:20,y:0},layer:'0',color:'#ff4400'},
    {id:'b',type:'LINE',start:{x:10,y:0},end:{x:0,y:0},layer:'0'},
    {id:'c',type:'PLINE',points:[{x:30,y:10},{x:30,y:0},{x:20,y:0}],closed:false,layer:'0'}];
  const e=core.createEditor({entities});accepted(e,['J','ALL','']);assert.equal(e.state.entities.length,1);const joined=e.state.entities[0];assert.equal(joined.id,'a');assert.equal(joined.color,'#ff4400');assert.equal(joined.closed,false);
  [[0,0],[10,0],[20,0],[30,0],[30,10]].forEach((value,index)=>point(joined.points[index],value));accepted(e,['U']);assert.deepEqual(e.state.entities,entities);accepted(e,['REDO']);assert.deepEqual(e.state.entities[0],joined);
});

test('JOIN closes a connected loop and rejects disconnected/branching/unsupported selections atomically',()=>{
  const lines=[{id:'a',type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'0'},{id:'b',type:'LINE',start:{x:10,y:0},end:{x:0,y:10},layer:'0'},{id:'c',type:'LINE',start:{x:0,y:10},end:{x:0,y:0},layer:'0'}];
  const e=core.createEditor({entities:lines});e.select(['a','b','c']);accepted(e,['J']);assert.equal(e.state.entities[0].closed,true);assert.equal(e.state.entities[0].points.length,3);
  for(const added of [{id:'d',type:'LINE',start:{x:20,y:0},end:{x:30,y:0},layer:'0'},{id:'d',type:'LINE',start:{x:10,y:0},end:{x:10,y:10},layer:'0'},{id:'d',type:'CIRCLE',center:{x:0,y:0},radius:2,layer:'0'}]){
    const editor=core.createEditor({entities:[...lines,added]});editor.select(editor.state.entities.map(entity=>entity.id));const before=editor.serialize();assert.equal(editor.execute('J').ok,false);assert.equal(editor.serialize(),before);assert.equal(editor.state.commandPhase,'selection');
  }
});

test('EXPLODE preserves oriented RECTANG and open/closed PLINE segments, styles and grouped Undo',()=>{
  const rectangle=core.rotateEntity(fixtureEntities()[2],{x:0,y:0},37);rectangle.color='#00ff55';
  const polyline={id:'p',type:'PLINE',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10}],closed:false,layer:'0'};
  const e=core.createEditor({entities:[rectangle,polyline]});e.select(['c','p']);accepted(e,['X']);assert.equal(e.state.entities.length,6);assert.ok(e.state.entities.every(entity=>entity.type==='LINE'));assert.equal(new Set(e.state.entities.map(entity=>entity.id)).size,6);
  for(let index=0;index<4;index++){point(e.state.entities[index].start,[rectangle.points[index].x,rectangle.points[index].y]);point(e.state.entities[index].end,[rectangle.points[(index+1)%4].x,rectangle.points[(index+1)%4].y]);assert.equal(e.state.entities[index].color,'#00ff55');}
  accepted(e,['U']);assert.deepEqual(e.state.entities,[rectangle,polyline]);accepted(e,['REDO']);assert.equal(e.state.entities.length,6);
});

test('EXPLODE unsupported mixed selection rejects before replacing any valid selected source',()=>{
  const e=core.createEditor({entities:fixtureEntities()});e.select(['a','c']);const before=e.serialize();assert.equal(e.execute('X').ok,false);assert.equal(e.serialize(),before);assert.equal(e.canUndo,false);accepted(e,['ESC']);
});

test('TRIM retains representable sub-unit cut positions on very long lines',()=>{
  const line={id:'target',type:'LINE',start:{x:0,y:0},end:{x:1e12,y:0},layer:'0'};
  const edge={id:'boundary',type:'LINE',start:{x:0.1,y:-1},end:{x:0.1,y:1},layer:'0'};
  const result=core.trimLine(line,[edge],{x:0.05,y:0});assert.equal(result.length,1);assert.equal(result[0].start.x,0.1);assert.equal(result[0].end.x,1e12);
});

test('TRIM uses current boundary fragments after editing a selected cutting edge and local Undo',()=>{
  const e=core.createEditor({entities:[{id:'horizontal',type:'LINE',start:{x:-10,y:0},end:{x:10,y:0},layer:'0'},
    {id:'vertical',type:'LINE',start:{x:0,y:-10},end:{x:0,y:10},layer:'0'},
    {id:'other',type:'LINE',start:{x:5,y:-10},end:{x:5,y:10},layer:'0'}]});
  accepted(e,['TR','horizontal','vertical','','8,0']);point(e.state.entities[0].end,[0,0]);const before=e.serialize();assert.equal(e.execute('5,8').ok,false);assert.equal(e.serialize(),before);
  accepted(e,['U','5,8']);point(e.state.entities.find(entity=>entity.id==='other').end,[5,0]);accepted(e,['']);
});

test('JOIN preserves the first picked source layer and properties regardless of drawing order',()=>{
  const e=core.createEditor({entities:[{id:'early',type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'0',color:'#ff0000'},
    {id:'picked',type:'LINE',start:{x:10,y:0},end:{x:20,y:0},layer:'0',color:'#00ff00'}]});
  e.select(['picked','early']);accepted(e,['J']);assert.equal(e.state.entities[0].id,'picked');assert.equal(e.state.entities[0].color,'#00ff00');
});

test('local command Undo availability follows actual edit transactions and redo never mutates an active command',()=>{
  const e=core.createEditor();accepted(e,['L','0,0']);assert.equal(e.canUndo,false);accepted(e,['10,0']);assert.equal(e.canUndo,true);accepted(e,['U']);assert.equal(e.canUndo,false);accepted(e,['ESC']);
  line(e);accepted(e,['U']);assert.equal(e.canRedo,true);accepted(e,['L']);assert.equal(e.canRedo,false);assert.equal(e.redo().ok,false);accepted(e,['ESC']);assert.equal(e.canRedo,true);
});

test('ARC imported large start angles normalize before rotation and finite-sweep evaluation',()=>{
  const raw={id:'a',type:'ARC',center:{x:0,y:0},radius:10,startAngle:1e308,sweepAngle:90,layer:'0'};
  const e=core.createEditor({entities:[raw]}),arc=e.state.entities[0];assert.equal(arc.startAngle,1e308%360);
  const rotated=core.rotateEntity(raw,{x:0,y:0},90);assert.equal(rotated.startAngle,(1e308%360+90)%360);
  point(core.arcPoint(rotated,0),[core.arcPoint({...raw,startAngle:1e308%360+90},0).x,core.arcPoint({...raw,startAngle:1e308%360+90},0).y]);
});

test('OFFSET rejects distances below geometric coordinate precision rather than creating duplicate proxies',()=>{
  assert.throws(()=>core.offsetEntity({type:'LINE',start:{x:1e12,y:1e12},end:{x:1e12+10,y:1e12},layer:'0'},1e-10,{x:1e12,y:1e12+1}),/precision/);
  assert.throws(()=>core.offsetEntity({type:'CIRCLE',center:{x:0,y:0},radius:1e12,layer:'0'},1e-10,{x:2e12,y:0}),/precision/);
});

test('BREAK at one endpoint produces no empty transaction and remains recoverable',()=>{
  const e=core.createEditor();line(e);accepted(e,['BR','L','','0,0']);const before=e.serialize();assert.equal(e.execute('0,0').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'second-break');
  accepted(e,['10,0']);assert.equal(e.state.entities[0].start.x,10);
});

test('OFFSET rectangle exact edge picks and overflowed side projections reject without guessing a side',()=>{
  const rectangle=fixtureEntities()[2];assert.throws(()=>core.offsetEntity(rectangle,1,{x:20,y:20}),/away/);
  const huge={type:'RECTANG',points:[{x:1e308,y:1e308},{x:1.1e308,y:1e308},{x:1.1e308,y:1.1e308},{x:1e308,y:1.1e308}],layer:'0'};
  assert.throws(()=>core.offsetEntity(huge,1e306,{x:-1e308,y:-1e308}),/numeric range/);
});



test('COPYBASE base-first grammar accepts base first, then prompted selection; pickfirst still asks for base',()=>{
  const e=core.createEditor({entities:fixtureEntities()});accepted(e,['COPYBASE']);assert.equal(e.state.commandPhase,'base');accepted(e,['10,20']);assert.equal(e.state.commandPhase,'selection');accepted(e,['L','']);point(e.getClipboard().base,[10,20]);assert.equal(e.getClipboard().entities[0].type,'RECTANG');
  e.select(['a']);accepted(e,['COPYBASE']);assert.equal(e.state.commandPhase,'base');accepted(e,['30,40']);assert.equal(e.state.command,null);point(e.getClipboard().base,[30,40]);assert.equal(e.getClipboard().entities[0].type,'LINE');
});

test('mirror avoids avoidable doubled-projection overflow for finite extreme coordinates',()=>{
  const circle={type:'CIRCLE',center:{x:1e308,y:1},radius:1,layer:'0'};
  const mirrored=core.mirrorEntity(circle,{x:0,y:0},{x:1,y:0});assert.equal(mirrored.center.x,1e308);assert.equal(mirrored.center.y,-1);
  const switched=core.mirrorEntity({type:'CIRCLE',center:{x:1e308,y:1e308},radius:1,layer:'0'},{x:0,y:0},{x:1,y:1});assert.ok(Number.isFinite(switched.center.x));assert.ok(Number.isFinite(switched.center.y));
});

test('deterministic independent circle fixtures verify three-point ARC centers, radius, endpoints and direction',()=>{
  for(let index=0;index<40;index++) {
    const center={x:index*13.7-300,y:index*-7.3+150},radius=3+index*.17,start=-173+index*11.31,sweep=(index%2?-1:1)*(23+index*7.9);
    const fixture=fraction=>{const angle=(start+sweep*fraction)*Math.PI/180;return{x:center.x+radius*Math.cos(angle),y:center.y+radius*Math.sin(angle)};};
    const a=fixture(0),b=fixture(.37),c=fixture(1),arc=core.arcThroughPoints(a,b,c);point(arc.center,[center.x,center.y]);assert.ok(Math.abs(arc.radius-radius)<EPS);assert.equal(Math.sign(arc.sweepAngle),Math.sign(sweep));assert.ok(Math.abs(arc.sweepAngle-sweep)<1e-8);point(core.arcPoint(arc,0),[a.x,a.y]);point(core.arcPoint(arc,1),[c.x,c.y]);
  }
});

test('JOIN handles thousands of unordered exact-connected segments with a bounded adjacency traversal',()=>{
  const count=4000,entities=Array.from({length:count},(_,index)=>({id:`segment${index}`,type:'LINE',start:{x:index,y:0},end:{x:index+1,y:0},layer:'0'}));
  const order=[...entities.slice(2000),...entities.slice(0,2000).reverse()];const joined=core.joinEntities(order);
  assert.equal(joined.points.length,count+1);assert.equal(joined.id,'segment2000');assert.equal(joined.closed,false);point(joined.points[0],[0,0]);point(joined.points.at(-1),[count,0]);
});

test('new entity IDs stay unique across imported documents, Undo/Redo and large clipboard batches',()=>{
  const e=core.createEditor();line(e);const imported={format:'Linecraft/1',entities:[{id:'e2',type:'LINE',start:{x:20,y:0},end:{x:30,y:0},layer:'0'}]};
  assert.equal(e.importJSON(imported).ok,true);line(e,'40,0','50,0');assert.equal(new Set(e.state.entities.map(entity=>entity.id)).size,2);assert.notEqual(e.state.entities[1].id,'e2');
  accepted(e,['U','U']);assert.equal(e.state.entities[0].id,'e1');
  const data={format:'LinecraftClipboard/1',base:{x:0,y:0},entities:Array.from({length:2000},(_,index)=>({type:'LINE',start:{x:index,y:0},end:{x:index,y:1},layer:'0'}))};
  assert.equal(e.setClipboard(data).ok,true);accepted(e,['PASTECLIP','0,0']);assert.equal(e.state.entities.length,2001);assert.equal(new Set(e.state.entities.map(entity=>entity.id)).size,2001);accepted(e,['U']);assert.equal(e.state.entities.length,1);
});

test('zero-length imported LINE and clipboard payloads reject atomically so Cut never produces unplaceable validated geometry',()=>{
  const degenerate={type:'LINE',start:{x:10,y:20},end:{x:10,y:20},layer:'0'};
  assert.throws(()=>core.createEditor({entities:[degenerate]}),/endpoints must differ/);
  const e=core.createEditor({entities:fixtureEntities()});e.select(['a']);assert.equal(e.copySelection().ok,true);const before=e.serialize(),clipboard=e.getClipboard();
  assert.equal(e.importJSON({entities:[degenerate]}).ok,false);assert.equal(e.serialize(),before);assert.deepEqual(e.state.selectionIds,['a']);
  assert.equal(e.setClipboard({format:'LinecraftClipboard/1',base:{x:0,y:0},entities:[degenerate]}).ok,false);assert.deepEqual(e.getClipboard(),clipboard);
  accepted(e,['CUTCLIP']);assert.equal(e.finishClipboardCut(true).ok,true);accepted(e,['PASTECLIP',clipboard.base]);assert.equal(e.state.entities.length,3);point(e.state.entities.at(-1).start,[0,0]);point(e.state.entities.at(-1).end,[100,0]);
});

test('circle intersections retain tangencies under floating-point roundoff and reject genuinely separated lines',()=>{
  const circle={type:'CIRCLE',center:{x:0,y:0},radius:1};
  for(let degrees=1;degrees<360;degrees++) {
    const angle=degrees*Math.PI/180,p={x:Math.cos(angle),y:Math.sin(angle)},t={x:-Math.sin(angle),y:Math.cos(angle)};
    const tangent={type:'LINE',start:{x:p.x-2*t.x,y:p.y-2*t.y},end:{x:p.x+2*t.x,y:p.y+2*t.y}};
    const cuts=core.lineIntersections(tangent,[circle]);assert.equal(cuts.length,1,`tangent at ${degrees} degrees`);assert.ok(cuts.every(value=>Math.abs(value-.5)<1e-7));
    const outside={type:'LINE',start:{x:p.x*(1+1e-7)-2*t.x,y:p.y*(1+1e-7)-2*t.y},end:{x:p.x*(1+1e-7)+2*t.x,y:p.y*(1+1e-7)+2*t.y}};
    assert.deepEqual(core.lineIntersections(outside,[circle]),[],`real gap at ${degrees} degrees`);
    const inside={type:'LINE',start:{x:p.x*(1-1e-7)-2*t.x,y:p.y*(1-1e-7)-2*t.y},end:{x:p.x*(1-1e-7)+2*t.x,y:p.y*(1-1e-7)+2*t.y}};
    assert.equal(core.lineIntersections(inside,[circle]).length,2,`real secant at ${degrees} degrees`);
  }
});



test('legacy drawings gain independent annotation/style/settings defaults and round-trip without changing existing geometry',()=>{
  const e=core.createEditor({entities:fixtureEntities()});assert.equal(e.state.currentTextStyle,'Standard');assert.equal(e.state.textStyles[0].fontFamily,'Arial');assert.equal(e.state.settings.units,'unitless');assert.equal(e.state.settings.gridAdaptive,true);assert.deepEqual(e.state.entities,fixtureEntities());assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.entities,e.state.entities);
});
test('TEXT precise definition and raw leading/trailing spaces survive creation, text editing and grouped Undo',()=>{
  const e=core.createEditor();accepted(e,['TEXT','10.25,20.5','5','30','  Original Ø note  ']);const text=e.state.entities[0];assert.equal(text.type,'TEXT');assert.equal(text.text,'  Original Ø note  ');assert.equal(text.height,5);assert.equal(text.rotation,30);point(text.position,[10.25,20.5]);
  accepted(e,['TEXTEDIT','L','','  edited  ']);assert.equal(e.state.entities[0].text,'  edited  ');accepted(e,['U']);assert.deepEqual(e.state.entities[0],text);accepted(e,['U']);assert.equal(e.state.entities.length,0);
});
test('TEXT invalid height/rotation/content retains recoverable phases and no geometry',()=>{
  const e=core.createEditor();accepted(e,['TEXT','0,0']);assert.equal(e.execute('-1').ok,false);assert.equal(e.state.commandPhase,'height');accepted(e,['2']);assert.equal(e.execute('Infinity').ok,false);accepted(e,['0']);assert.equal(e.submitText('one\ntwo').ok,false);assert.equal(e.state.commandPhase,'text');assert.equal(e.submitText('').ok,false);assert.equal(e.submitText('ESC').ok,true);assert.equal(e.state.entities[0].text,'ESC');
});
test('MTEXT original deterministic wrapping, box orientation and multiline content use shared layout bounds',()=>{
  const e=core.createEditor();accepted(e,['MTEXT','0,100','H','5','20,80']);assert.equal(e.submitText('First line\nSecond line').ok,true);const entity=e.state.entities[0];assert.equal(entity.width,20);assert.equal(entity.height,5);point(entity.position,[0,100]);
  const layout=core.textLayout(entity,e.state);assert.ok(layout.lines.length>=2);assert.ok(layout.lines.every(line=>line.width<=20));assert.ok(layout.corners.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.deepEqual(core.annotationPrimitives(entity,e.state).boundsPoints,layout.corners);assert.equal(core.hitTest([entity],{x:10,y:95},.1,e.state),entity.id);assert.deepEqual(core.entitiesInBox([entity],{x:15,y:97},{x:5,y:93},true,e.state),[entity.id]);
  assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.entities,e.state.entities);
});
test('drawing preference changes validate all styles/settings atomically and group into one Undo',()=>{
  const e=core.createEditor(),before=e.serialize();const styles=[...e.state.textStyles,{name:'Notes',fontFamily:'Consolas',defaultHeight:3,defaultRotation:0,widthFactor:1}];
  assert.equal(e.updateDrawingSettings({units:'mm',precision:3,gridSpacing:25,gridAdaptive:false,snapModes:['endpoint'],textStyles:styles,currentTextStyle:'Notes'}).ok,true);assert.equal(e.state.currentTextStyle,'Notes');assert.equal(e.state.settings.units,'mm');assert.equal(e.state.settings.gridSpacing,25);accepted(e,['U']);assert.equal(e.serialize(),before);
  const invalid=e.updateDrawingSettings({units:'ft',textStyles:[{name:'Standard',fontFamily:'https://host/font.ttf'}]});assert.equal(invalid.ok,false);assert.equal(e.serialize(),before);
});
test('styles upsert named definitions, reject invalid resources/references and change future text defaults',()=>{
  const e=core.createEditor();assert.equal(e.updateTextStyle('Notes',{fontFamily:'Segoe UI',defaultHeight:7,defaultRotation:45,widthFactor:.8}).ok,true);assert.equal(e.updateDrawingSettings({currentTextStyle:'Notes'}).ok,true);accepted(e,['TEXT','0,0','','','Note']);assert.equal(e.state.entities[0].height,7);assert.equal(e.state.entities[0].rotation,45);assert.equal(e.state.entities[0].style,'Notes');
  const before=e.serialize();assert.equal(e.updateDimensionStyle('Bad',{textStyle:'missing'}).ok,false);assert.equal(e.updateTextStyle('Bad',{fontFamily:'../remote.ttf'}).ok,false);assert.equal(e.updateTextStyle('Bad',{widthFactor:0}).ok,false);assert.equal(e.updateDrawingSettings({snapModes:['intersection']}).ok,false);assert.equal(e.serialize(),before);
});
test('DIMLINEAR explicit horizontal/vertical axes measure definition projections and DIMALIGNED measures true length',()=>{
  const e=core.createEditor();accepted(e,['DIMLINEAR','0,0','100,50','H','50,80']);const horizontal=e.state.entities[0];assert.equal(horizontal.kind,'linear');assert.equal(horizontal.axisAngle,0);assert.equal(core.formatDimension(horizontal,e.state).measurement,100);assert.equal(core.formatDimension(horizontal,e.state).label,'100.00');
  accepted(e,['DIMLINEAR','0,0','100,50','V','120,25']);assert.equal(core.formatDimension(e.state.entities[1],e.state).measurement,50);
  accepted(e,['DIMALIGNED','0,0','3,4','-4,3']);assert.equal(core.formatDimension(e.state.entities[2],e.state).measurement,5);assert.equal(core.annotationPrimitives(e.state.entities[2],e.state).arrows.length,2);
});
test('linear dimension autoaxis avoids zero projections, rejects explicit degenerate axes, and previews purely',()=>{
  const e=core.createEditor();accepted(e,['DIMLINEAR','0,0','0,50','H']);const before=e.serialize();assert.equal(e.execute('10,25').ok,false);assert.equal(e.serialize(),before);accepted(e,['V']);const preview=e.previewCommand({x:10,y:25});assert.equal(preview.length,1);assert.equal(e.serialize(),before);accepted(e,['10,25']);assert.equal(e.state.entities[0].axisAngle,90);
});
test('DIMRADIUS/DIMDIAMETER capture circle geometry, produce R/diameter labels and reject center placement',()=>{
  const e=core.createEditor();accepted(e,['CIRCLE','100,100','10','DIMRADIUS','110,100']);assert.equal(e.execute('100,100').ok,false);accepted(e,['130,110']);const radius=e.state.entities[1];assert.equal(radius.kind,'radius');assert.equal(radius.radius,10);assert.equal(core.formatDimension(radius,e.state).label,'R10.00');
  accepted(e,['DIMDIAMETER','110,100','130,120']);assert.equal(core.formatDimension(e.state.entities[2],e.state).label,'Ø20.00');assert.equal(core.annotationPrimitives(e.state.entities[2],e.state).arrows.length,2);
  e.select([e.state.entities[0].id]);e.moveGrip(e.state.entities[0].id,0,{x:200,y:200});point(radius.center,[100,100]);assert.equal(radius.radius,10);
});
test('dimension labels stay readable with reversed extension origins and bounds share their actual text position',()=>{
  const e=core.createEditor();accepted(e,['DIMALIGNED','100,0','0,0','50,20']);const picture=core.annotationPrimitives(e.state.entities[0],e.state);assert.equal(picture.texts[0].rotation,0);assert.ok(picture.texts[0].position.y>20);assert.ok(picture.boundsPoints.some(p=>p.y>picture.texts[0].position.y));
});
test('text/dimension scalar edits are exact, undoable and reject subtype-inapplicable properties',()=>{
  const e=core.createEditor();accepted(e,['TEXT','1000000000000,0','1','0','A']);const text=e.state.entities[0];assert.equal(e.setTextProperties(text.id,{height:.1,text:' exact '}).ok,true);assert.equal(e.state.entities[0].height,.1);const before=e.serialize();assert.equal(e.setTextProperties(text.id,{width:10}).ok,false);assert.equal(e.serialize(),before);
  accepted(e,['DIMLINEAR','0,0','10,0','5,10']);const dimension=e.state.entities[1];assert.equal(e.setDimensionProperties(dimension.id,{textOverride:'Length <> mm',scale:2}).ok,true);assert.equal(core.formatDimension(e.state.entities[1],e.state).label,'Length 10.00 mm');const saved=e.serialize();assert.equal(e.setDimensionProperties(dimension.id,{radius:20}).ok,false);assert.equal(e.serialize(),saved);accepted(e,['U']);assert.equal(e.state.entities[1].scale,1);
});
test('annotation transforms preserve definitions, change text/dimension size with SCALE, and retain JSON exactness',()=>{
  const e=core.createEditor();accepted(e,['TEXT','0,0','2','0','Note','DIMLINEAR','0,0','10,0','5,5']);e.select(e.state.entities.map(entity=>entity.id));accepted(e,['SCALE','0,0','2']);assert.equal(e.state.entities[0].height,4);assert.equal(e.state.entities[1].scale,2);assert.equal(core.formatDimension(e.state.entities[1],e.state).measurement,20);
  e.select(e.state.entities.map(entity=>entity.id));accepted(e,['ROTATE','0,0','90']);assert.equal(e.state.entities[0].rotation,90);assert.equal(e.state.entities[1].axisAngle,90);point(e.state.entities[1].p2,[0,20]);assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.entities,e.state.entities);
});
test('clipboard preserves named annotation styles and rejects destination conflicts before any mutation',()=>{
  const source=core.createEditor();source.updateTextStyle('Notes',{fontFamily:'Consolas'});source.updateDrawingSettings({currentTextStyle:'Notes'});accepted(source,['TEXT','0,0','3','0','Note']);source.select([source.state.entities[0].id]);source.copySelection({x:0,y:0});const data=source.getClipboard();assert.ok(data.textStyles.some(style=>style.name==='Notes'));
  const target=core.createEditor();assert.equal(target.setClipboard(data).ok,true);accepted(target,['PASTECLIP','20,30']);point(target.state.entities[0].position,[20,30]);assert.equal(target.state.textStyles.find(style=>style.name==='Notes').fontFamily,'Consolas');accepted(target,['U']);assert.equal(target.state.textStyles.some(style=>style.name==='Notes'),false);
  target.updateTextStyle('Notes',{fontFamily:'Arial'});accepted(target,['PASTECLIP']);const before=target.serialize();assert.equal(target.execute('0,0').ok,false);assert.equal(target.serialize(),before);
});
test('DIST/ID/AREA produce accurate ephemeral measurements without drawing edits or history',()=>{
  const e=core.createEditor();accepted(e,['DIST','0,0','3,4']);assert.equal(e.state.lastMeasurement.distance,5);point(e.state.lastPoint,[3,4]);accepted(e,['ID','@1,2']);point(e.state.lastMeasurement.point,[4,6]);accepted(e,['AREA','0,0','10,0','10,20','0,20','']);assert.equal(e.state.lastMeasurement.area,200);assert.equal(e.state.lastMeasurement.perimeter,60);assert.equal(e.state.entities.length,0);assert.equal(e.canUndo,false);
});
test('annotation imports reject malformed text, dimensions, settings and styles atomically',()=>{
  const e=core.createEditor({entities:fixtureEntities()}),before=e.serialize();
  for(const entities of [[{type:'TEXT',position:{x:0,y:0},height:-1,text:'Bad'}],[{type:'MTEXT',position:{x:0,y:0},height:1,width:0,text:'Bad'}],[{type:'DIMENSION',kind:'linear',p1:{x:0,y:0},p2:{x:0,y:10},placement:{x:10,y:10},axisAngle:0}]]){assert.equal(e.importJSON({entities}).ok,false);assert.equal(e.serialize(),before);}
  assert.equal(e.importJSON({entities:[],textStyles:[{name:'Standard',fontFamily:'file://font'}]}).ok,false);assert.equal(e.importJSON({entities:[],settings:{gridSpacing:0}}).ok,false);assert.equal(e.serialize(),before);
});

test('annotation numeric defaults apply only to absent fields; explicit null rotation, scale and axis angle reject atomically',()=>{
  const e=core.createEditor(),text={type:'TEXT',position:{x:0,y:0},height:1,text:'Note'},dimension={type:'DIMENSION',kind:'linear',p1:{x:0,y:0},p2:{x:10,y:0},placement:{x:5,y:5}};
  assert.equal(e.importJSON({entities:[text,dimension]}).ok,true);const before=e.serialize();
  for(const entity of [{...text,rotation:null},{...dimension,axisAngle:null},{...dimension,scale:null}]){assert.equal(e.importJSON({entities:[entity]}).ok,false);assert.equal(e.serialize(),before);assert.equal(e.setClipboard({format:'LinecraftClipboard/1',base:{x:0,y:0},entities:[entity]}).ok,false);}
});

test('quick drafting toggles work during point commands and stay unchanged through local/global geometry Undo',()=>{
  const e=core.createEditor();line(e);accepted(e,['L','0,10']);assert.equal(e.updateDraftingSettings({snapEnabled:false,orthoEnabled:true}).ok,true);assert.equal(e.state.command,'LINE');assert.equal(e.updateDrawingSettings({units:'mm'}).ok,false);accepted(e,['10,10','']);accepted(e,['U']);assert.equal(e.state.settings.snapEnabled,false);assert.equal(e.state.settings.orthoEnabled,true);accepted(e,['U','REDO']);assert.equal(e.state.settings.snapEnabled,false);assert.equal(e.updateDraftingSettings({units:'ft'}).ok,false);
});

test('AREA local Undo changes measurement vertices without creating document history',()=>{
  const e=core.createEditor();accepted(e,['AREA','0,0','10,0','10,30','U','10,20','0,20','']);assert.equal(e.state.lastMeasurement.area,200);assert.equal(e.state.lastMeasurement.perimeter,60);assert.equal(e.canUndo,false);
});

test('annotation DXF exports original dimension picture blocks, named style pointers and subtype definitions',()=>{
  const e=core.createEditor();e.updateTextStyle('Notes',{fontFamily:'Consolas'});e.updateDimensionStyle('Detail',{textStyle:'Notes',precision:3});e.updateDrawingSettings({currentDimStyle:'Detail',units:'mm'});
  accepted(e,['TEXT','0,100','5','30','Unicode Ø label','MTEXT','0,200','H','4','80,160']);assert.equal(e.submitText('First paragraph\nLiteral {brace} \\ slash').ok,true);
  accepted(e,['DIMLINEAR','0,0','100,0','50,20','DIMALIGNED','0,0','30,40','-20,20','CIRCLE','200,0','10','DIMRADIUS','210,0','230,20','DIMDIAMETER','210,0','230,-20']);
  const dxf=e.exportDXF(),rows=dxf.trimEnd().split(/\r?\n/),records=[];let record;
  for(let index=0;index<rows.length;index+=2){const code=Number(rows[index]),value=rows[index+1];if(code===0){record={type:value,pairs:[]};records.push(record);}else record?.pairs.push([code,value]);}
  const field=(record,code)=>record.pairs.find(pair=>pair[0]===code)?.[1],handles=new Map(records.map(record=>[field(record,record.type==='DIMSTYLE'?105:5),record]));
  const dims=records.filter(record=>record.type==='DIMENSION');assert.equal(dims.length,4);assert.deepEqual(dims.map(record=>Number(field(record,70))&7),[0,1,4,3]);assert.deepEqual(dims.map(record=>Number(field(record,70))),[32,33,164,163]);
  for(const dim of dims){const name=field(dim,2),block=records.find(record=>record.type==='BLOCK'&&field(record,2)===name),owner=handles.get(field(block,330));assert.equal(owner.type,'BLOCK_RECORD');assert.equal(field(owner,2),name);assert.ok(records.some(record=>['LINE','SOLID','TEXT'].includes(record.type)&&field(record,330)===field(owner,5)));assert.equal(field(dim,3),'Detail');}
  for(const style of records.filter(record=>record.type==='DIMSTYLE'))assert.equal(handles.get(field(style,340)).type,'STYLE');
  assert.ok(dxf.includes('consola.ttf'));assert.match(dxf,/AcDbMText/);assert.ok(dxf.includes(String.raw`First paragraph\PLiteral \{brace\} \\{} slash`));assert.ok(dxf.includes('$INSUNITS'));
});

test('long MTEXT chunks preserve Unicode code points and escaped content; oversized TEXT rejects before creation',()=>{
  const e=core.createEditor();accepted(e,['MTEXT','0,100','100,0']);const content='🧭'.repeat(300)+'\n{literal}';assert.equal(e.submitText(content).ok,true);const dxf=e.exportDXF();assert.ok(dxf.includes('\r\n3\r\n'));assert.ok(!dxf.includes('\ufffd'));assert.ok(dxf.includes('\\P\\{literal\\}'));
  accepted(e,['TEXT','0,0','1','0']);assert.equal(e.submitText('a'.repeat(2049)).ok,false);assert.equal(e.state.commandPhase,'text');assert.equal(e.submitText('short').ok,true);
});

test('MTEXT wraps at word boundaries with character fallback only for overlong tokens and conservative descent bounds',()=>{
  const e=core.createEditor();accepted(e,['MTEXT','0,100','H','5','20,0']);assert.equal(e.submitText('First line supercalifragilistic').ok,true);const layout=core.textLayout(e.state.entities[0],e.state);assert.equal(layout.lines[0].text,'First ');assert.equal(layout.lines[1].text,'line ');assert.ok(layout.lines.some(line=>line.text.startsWith('super')));assert.ok(layout.lines.every(line=>line.width<=20));assert.equal(layout.height,layout.lines.length*5*1.35);
});

test('dimension label and filled-arrow picks/crossing boxes select the dimension beyond its stroked lines',()=>{
  const e=core.createEditor();accepted(e,['DIMLINEAR','0,0','100,0','50,20']);const entity=e.state.entities[0],picture=core.annotationPrimitives(entity,e.state),label=picture.texts[0];assert.equal(core.hitTest([entity],label.position,.01,e.state),entity.id);
  assert.deepEqual(core.entitiesInBox([entity],{x:label.position.x+1,y:label.position.y+.5},{x:label.position.x-1,y:label.position.y-.5},true,e.state),[entity.id]);
  const triangle=picture.arrows[0],center={x:triangle.reduce((s,p)=>s+p.x,0)/3,y:triangle.reduce((s,p)=>s+p.y,0)/3};assert.equal(core.hitTest([entity],center,0,e.state),entity.id);
});

test('encoded dimension override and style prefix/suffix limits prevent unexportable validated pictures',()=>{
  const e=core.createEditor();accepted(e,['DIMLINEAR','0,0','100,0','50,20']);const before=e.serialize();assert.equal(e.setDimensionProperties(e.state.entities[0].id,{textOverride:'Ω'.repeat(1025)}).ok,false);assert.equal(e.serialize(),before);assert.equal(e.updateDimensionStyle('Long',{prefix:'🧭'.repeat(256),suffix:'🧭'.repeat(256)}).ok,false);assert.equal(e.updateDimensionStyle('Macro',{prefix:'<>'}).ok,false);assert.equal(e.serialize(),before);
});

test('readable text mirroring preserves the reflected logical box while retaining original glyph content',()=>{
  const e=core.createEditor();accepted(e,['TEXT','10,20','5','30','Readable note','MTEXT','40,100','H','3','80,60']);e.submitText('First line\nSecond line');
  for(const entity of e.state.entities){const mirrored=core.mirrorEntity(entity,{x:0,y:0},{x:0,y:100},e.state),original=core.textLayout(entity,e.state),layout=core.textLayout(mirrored,e.state);assert.equal(mirrored.text,entity.text);assert.ok(mirrored.rotation>=-90&&mirrored.rotation<=90);for(const p of original.corners)assert.ok(layout.corners.some(q=>Math.abs(q.x+p.x)<EPS&&Math.abs(q.y-p.y)<EPS));}
});

test('dimension arrows that collapse below world-coordinate resolution never select unrelated empty space',()=>{
  const e=core.createEditor();accepted(e,['DIMLINEAR','1000000000000,0','1000000000010,0','1000000000005,20']);assert.equal(e.setDimensionProperties(e.state.entities[0].id,{scale:1e-12}).ok,true);
  assert.equal(core.hitTest(e.state.entities,{x:0,y:500},.1,e.state),null);assert.deepEqual(core.entitiesInBox(e.state.entities,{x:1,y:501},{x:-1,y:499},true,e.state),[]);
});



test('explicit null annotation preferences and overrides reject atomically instead of silently defaulting',()=>{
  const e=core.createEditor();accepted(e,['DIMLINEAR','0,0','10,0','5,5']);const before=e.serialize();
  for(const patch of [{settings:null},{textStyles:null},{dimStyles:null},{currentTextStyle:null},{currentDimStyle:null}]){assert.equal(e.importJSON({...JSON.parse(before),...patch}).ok,false);assert.equal(e.serialize(),before);assert.equal(e.updateDrawingSettings(patch).ok,false);assert.equal(e.serialize(),before);}
  assert.equal(e.setDimensionProperties(e.state.entities[0].id,{textOverride:null}).ok,false);assert.equal(e.serialize(),before);
});

test('MTEXT literal percent, Unicode-looking slash, braces and carets use literal control separators',()=>{
  const e=core.createEditor();accepted(e,['MTEXT','0,100','H','5','200,0']);
  const content=String.raw`50% | %%d | \P | {braces} | ^J | ^M | \U+1234`;
  assert.equal(e.submitText(content).ok,true);const saved=e.serialize(),dxf=e.exportDXF();
  assert.ok(dxf.includes(String.raw`50%{} | %{}%{}d | \\{}P | \{braces\} | \U+005EJ | \U+005EM | \\{}U+1234`));
  assert.equal(e.state.entities[0].text,content);assert.equal(e.serialize(),saved);
  const restored=core.createEditor(JSON.parse(saved));assert.equal(restored.state.entities[0].text,content);assert.equal(restored.exportDXF(),dxf);
});

test('reserved literal TEXT stays valid internally while DXF export rejects before any drawing/history mutation',()=>{
  for(const content of ['%%d','%%P','%%c','%%o','%%U','%%k','%%%','%%123',String.raw`\U+1234`,String.raw`\u+ABCD`]){
    const e=core.createEditor();accepted(e,['TEXT','0,0','5','0']);assert.equal(e.submitText(content).ok,true);
    const saved=e.serialize(),undo=e.canUndo;assert.throws(()=>e.exportDXF(),/DXF export cannot preserve the literal TEXT control sequence/);
    assert.equal(e.serialize(),saved);assert.equal(e.canUndo,undo);assert.equal(core.createEditor(JSON.parse(saved)).state.entities[0].text,content);
  }
  const e=core.createEditor();accepted(e,['TEXT','0,0','5','0']);const content=String.raw`50% | \P | {braces} | ^J | ^M | Ω`;assert.equal(e.submitText(content).ok,true);
  assert.doesNotThrow(()=>e.exportDXF());assert.equal(e.state.entities[0].text,content);
});

test('dimension literal-control label prevents whole export while keeping override, style and geometry editable',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','','DIMLINEAR','0,0','10,0','5,10']);const dimension=e.state.entities[1];
  assert.equal(e.setDimensionProperties(dimension.id,{textOverride:'Literal %%d'}).ok,true);let saved=e.serialize();
  assert.throws(()=>e.exportDXF(),/literal dimension label control sequence/);assert.equal(e.serialize(),saved);
  assert.equal(e.setDimensionProperties(dimension.id,{textOverride:'<> at 50%'}).ok,true);assert.doesNotThrow(()=>e.exportDXF());
  assert.equal(e.updateDimensionStyle('Standard',{prefix:String.raw`\U+1234 `}).ok,true);assert.equal(e.setDimensionProperties(dimension.id,{textOverride:'<>'}).ok,true);saved=e.serialize();
  assert.throws(()=>e.exportDXF(),/literal dimension label control sequence/);assert.equal(e.serialize(),saved);
});

// Independent tetrahedral integration and edge incidence check exported mesh
// geometry, rather than reusing the generator's construction formulas.
function signedMeshVolume(mesh){
  const origin=mesh.vertices[0];let volume=0;
  for(const face of mesh.faces)for(let i=1;i<face.length-1;i++){
    const points=[mesh.vertices[face[0]],mesh.vertices[face[i]],mesh.vertices[face[i+1]]].map(p=>[p.x-origin.x,p.y-origin.y,p.z-origin.z]);const[a,b,c]=points;
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }return volume;
}
function closedOrientedMesh(mesh){
  const edges=new Map();for(const face of mesh.faces)face.forEach((a,i)=>{const b=face[(i+1)%face.length],key=a<b?`${a}:${b}`:`${b}:${a}`,entry=edges.get(key)??{count:0,direction:0};entry.count++;entry.direction+=a<b?1:-1;edges.set(key,entry);});
  for(const edge of edges.values()){assert.equal(edge.count,2,'every closed edge belongs to exactly two faces');assert.equal(edge.direction,0,'adjacent faces traverse shared edges oppositely');}
  assert.ok(signedMeshVolume(mesh)>0,'outward orientation gives positive volume');
}
const xyz=(actual,expected)=>{point(actual,expected);assert.ok(Math.abs(actual.z-expected[2])<1e-9,`${actual.z} != ${expected[2]}`);};

test('3D Cartesian parser preserves exact XYZ, relative bases, zero defaults and rejects unsupported polar/nonfinite input',()=>{
  assert.deepEqual(core.parseCoordinate3D('1.25,-2.5,3.75'),{x:1.25,y:-2.5,z:3.75});assert.deepEqual(core.parseCoordinate3D('@2,-3,4',{x:10,y:20,z:30}),{x:12,y:17,z:34});
  assert.deepEqual(core.parseCoordinate3D('#1,2'),{x:1,y:2,z:0});assert.deepEqual(core.parseCoordinate3D('@1,2',{x:5,y:6,z:7}),{x:6,y:8,z:7});
  for(const raw of ['@5<30','1,2,Infinity','1,2,1e309',{x:1,y:2,z:null}])assert.throws(()=>core.parseCoordinate3D(raw));assert.throws(()=>core.parseCoordinate('1,2,3'));
});

test('BOX signed height creates an outward closed mesh with exact six faces, XYZ bounds and volume',()=>{
  for(const height of [30,-30]){const mesh=core.makeBoxMesh({x:10,y:20,z:3},{x:0,y:0,z:3},height);assert.equal(mesh.vertices.length,8);assert.equal(mesh.faces.length,6);closedOrientedMesh(mesh);assert.equal(signedMeshVolume(mesh),6000);assert.deepEqual(core.bounds3D([mesh]),{minX:0,maxX:10,minY:0,maxY:20,minZ:Math.min(3,3+height),maxZ:Math.max(3,3+height)});}
});

test('default cylinder caps and sphere poles are closed, oriented and approximate their analytic primitives within bounded tessellation',()=>{
  const cylinder=core.makeCylinderMesh({x:10,y:-20,z:3},5,7);assert.equal(cylinder.vertices.length,66);assert.equal(cylinder.faces.length,96);closedOrientedMesh(cylinder);
  const expected=32/2*Math.sin(2*Math.PI/32)*25*7;assert.ok(Math.abs(signedMeshVolume(cylinder)-expected)<1e-9);assert.ok(signedMeshVolume(cylinder)/(Math.PI*25*7)>.99);
  const sphere=core.makeSphereMesh({x:0,y:0,z:0},10);assert.equal(sphere.vertices.length,482);assert.equal(sphere.faces.length,512);closedOrientedMesh(sphere);assert.deepEqual(core.bounds3D([sphere]),{minX:-10,maxX:10,minY:-10,maxY:10,minZ:-10,maxZ:10});
  assert.ok(signedMeshVolume(sphere)/(4/3*Math.PI*1000)>.97);assert.ok(signedMeshVolume(sphere)<4/3*Math.PI*1000);
});

test('primitive construction rejects zero/overflow dimensions and unbounded subdivisions before mutation',()=>{
  for(const action of [()=>core.makeBoxMesh({x:0,y:0,z:0},{x:0,y:5,z:0},10),()=>core.makeBoxMesh({x:0,y:0,z:0},{x:3,y:5,z:1},10),()=>core.makeCylinderMesh({x:0,y:0,z:0},0,10),()=>core.makeCylinderMesh({x:0,y:0,z:0},2,0),()=>core.makeCylinderMesh({x:0,y:0,z:0},2,3,129),()=>core.makeSphereMesh({x:1e308,y:0,z:0},1e308),()=>core.makeSphereMesh({x:0,y:0,z:0},2,65,32)])assert.throws(action);
});

test('BOX command preview equals committed mesh and one Undo/Redo groups the whole construction',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,3','10,20,3']);const before=e.serialize(),preview=e.previewScalar(30);assert.equal(preview.length,1);assert.equal(e.serialize(),before);
  accepted(e,['30']);const mesh=e.state.entities[0];assert.equal(mesh.type,'MESH');assert.deepEqual(mesh.vertices,preview[0].vertices);assert.deepEqual(mesh.faces,preview[0].faces);const saved=e.serialize();accepted(e,['U']);assert.equal(e.state.entities.length,0);accepted(e,['REDO']);assert.equal(e.serialize(),saved);
});

test('CYLINDER/SPHERE command radius recovery and previews preserve active prompts on invalid dimensions',()=>{
  const e=core.createEditor();accepted(e,['CYLINDER','50,0,5']);assert.equal(e.execute('-2').ok,false);assert.equal(e.state.commandPhase,'radius');assert.equal(e.state.entities.length,0);assert.equal(e.previewScalar(4).length,1);
  accepted(e,['4']);assert.equal(e.state.commandPhase,'height');assert.equal(e.previewScalar(-8).length,1);accepted(e,['-8','SPHERE','100,0,20']);const preview=e.previewScalar(6)[0];accepted(e,['6']);assert.deepEqual(e.state.entities[1].vertices,preview.vertices);closedOrientedMesh(e.state.entities[0]);closedOrientedMesh(e.state.entities[1]);
});

test('concave EXTRUDE ear-clipped caps match independent polygon area, retain profile, and undo only new mesh',()=>{
  const e=core.createEditor();accepted(e,['PLINE','0,0','4,0','4,1','1,1','1,4','0,4','C']);const profile=structuredClone(e.state.entities[0]);accepted(e,['EXTRUDE','Last','']);const preview=e.previewScalar(3)[0];accepted(e,['3']);assert.equal(e.state.entities.length,2);assert.deepEqual(e.state.entities[0],profile);const mesh=e.state.entities[1];closedOrientedMesh(mesh);assert.equal(mesh.vertices.length,12);assert.equal(mesh.faces.length,14);assert.ok(Math.abs(signedMeshVolume(mesh)-21)<1e-9);assert.deepEqual(mesh.vertices,preview.vertices);accepted(e,['U']);assert.deepEqual(e.state.entities,[profile]);
});

test('clockwise and collinear profile vertices extrude with outward caps while source vertices remain untouched',()=>{
  const points=[{x:0,y:0},{x:0,y:4},{x:1,y:4},{x:1,y:1},{x:4,y:1},{x:4,y:0},{x:2,y:0}];const profile={type:'PLINE',points,closed:true,layer:'0'},saved=JSON.stringify(profile);
  const mesh=core.extrudeProfile(profile,-5);closedOrientedMesh(mesh);assert.ok(Math.abs(signedMeshVolume(mesh)-35)<1e-9);assert.equal(mesh.vertices.length,12);assert.equal(JSON.stringify(profile),saved);
});

test('EXTRUDE rejects self-intersection, touching edges, open profiles and mixed invalid selection atomically',()=>{
  for(const points of [[{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}],[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:0},{x:0,y:4}]])assert.throws(()=>core.extrudeProfile({type:'PLINE',points,closed:true,layer:'0'},2));
  const e=core.createEditor();accepted(e,['RECTANG','0,0','10,10','LINE','20,0','30,0','']);e.select(e.state.entities.map(entity=>entity.id));const saved=e.serialize();assert.equal(e.execute('EXTRUDE').ok,false);assert.equal(e.serialize(),saved);assert.equal(e.state.commandPhase,'selection');
});

test('3DPOLY accepts XYZ segments, local Undo/Close, Escape retention and grouped global history',()=>{
  const e=core.createEditor();accepted(e,['3DPOLY','0,0,0','10,0,5','@0,10,5','U','@0,20,10','C']);const path=e.state.entities[0];assert.equal(path.type,'POLY3D');assert.equal(path.closed,true);assert.deepEqual(path.points,[{x:0,y:0,z:0},{x:10,y:0,z:5},{x:10,y:20,z:15}]);accepted(e,['U']);assert.equal(e.state.entities.length,0);accepted(e,['REDO','3DPOLY','50,0,2','60,0,4','ESC']);assert.equal(e.state.entities.length,2);accepted(e,['U']);assert.equal(e.state.entities.length,1);
});

test('3D MOVE and repeated COPY use full XYZ and original base for every relative destination',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,3','10,20,3','30','MOVE','Last','','0,0,0','@1,2,4','COPY','Last','','0,0,0','@10,0,5','@20,0,7','']);
  assert.equal(e.state.entities.length,3);xyz(e.state.entities[0].vertices[0],[1,2,7]);xyz(e.state.entities[1].vertices[0],[11,2,12]);xyz(e.state.entities[2].vertices[0],[21,2,14]);accepted(e,['U']);assert.equal(e.state.entities.length,1);
});

test('mixed 2D/3D selection rejects nonzero Z transforms atomically and allows planar common displacement',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,0','10,10,0','10','LINE','20,0','30,0','']);e.select(e.state.entities.map(entity=>entity.id));accepted(e,['MOVE','0,0,0']);const saved=e.serialize(),last=structuredClone(e.state.lastPoint);
  assert.equal(e.execute('@0,0,5').ok,false);assert.equal(e.serialize(),saved);assert.deepEqual(e.state.lastPoint,last);accepted(e,['@2,3,0']);xyz(e.state.entities[0].vertices[0],[2,3,0]);point(e.state.entities[1].start,[22,3]);
});

test('3D SCALE preserves XYZ about its explicit base and ROTATE3D follows right-handed world axes',()=>{
  const path={type:'POLY3D',points:[{x:1,y:2,z:3},{x:2,y:4,z:6}],closed:false,layer:'0'},scaled=core.scaleEntity(path,{x:1,y:1,z:1},2);xyz(scaled.points[0],[1,3,5]);xyz(scaled.points[1],[3,7,11]);
  for(const[axis,input,expected]of[['X',[0,1,0],[0,0,1]],['Y',[0,0,1],[1,0,0]],['Z',[1,0,0],[0,1,0]]]){const p={type:'POLY3D',points:[{x:0,y:0,z:0},{x:input[0],y:input[1],z:input[2]}],closed:false};xyz(core.rotateEntity3D(p,{x:0,y:0,z:0},axis,90).points[1],expected);}
  const e=core.createEditor();accepted(e,['3DPOLY','0,0,0','0,10,0','','ROTATE3D','Last','','X','0,0,0']);const preview=e.previewScalar(90)[0];accepted(e,['90']);xyz(e.state.entities[0].points[1],[0,0,10]);assert.deepEqual(e.state.entities[0].points,preview.points);accepted(e,['U']);xyz(e.state.entities[0].points[1],[0,10,0]);
});

test('ROTATE3D rejects non-3D selection and unsupported axes while preserving the pending command',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','']);e.select([e.state.entities[0].id]);const saved=e.serialize();assert.equal(e.execute('ROTATE3D').ok,false);assert.equal(e.serialize(),saved);accepted(e,['ESC','BOX','0,0,0','2,3,0','4','ROTATE3D','Last','']);assert.equal(e.execute('2POINTS').ok,false);assert.equal(e.state.commandPhase,'axis');accepted(e,['Z','0,0,0','90']);
});

test('3D grip edits retain XYZ and reject collapsed faces/duplicate path points with unchanged history',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,0','10,10,0','10']);const mesh=e.state.entities[0],saved=e.serialize();assert.equal(e.moveGrip(mesh.id,0,mesh.vertices[1]).ok,false);assert.equal(e.serialize(),saved);assert.equal(e.moveGrip(mesh.id,6,{x:12,y:12,z:15}).ok,true);xyz(e.state.entities[0].vertices[6],[12,12,15]);assert.equal(e.state.entities[0].primitive,undefined);accepted(e,['U']);assert.equal(e.serialize(),saved);
  accepted(e,['3DPOLY','20,0,1','30,0,2','']);const path=e.state.entities[1],before=e.serialize();assert.equal(e.moveGrip(path.id,1,path.points[0]).ok,false);assert.equal(e.serialize(),before);
});

test('3D validation rejects malformed topology, nonfinite XYZ, unreferenced vertices and resource excess atomically',()=>{
  const mesh={id:'mesh',...core.makeBoxMesh({x:0,y:0,z:0},{x:2,y:3,z:0},4),layer:'0'},e=core.createEditor({entities:[mesh]}),saved=e.serialize();
  const bads=[{...mesh,faces:[[0,0,1]]},{...mesh,faces:[[0,1,999]]},{...mesh,faces:[[0,1,2,3,4]]},{...mesh,vertices:mesh.vertices.map((p,i)=>i===0?{...p,z:null}:p)},{...mesh,vertices:[...mesh.vertices,{x:100,y:100,z:100}]},{...mesh,vertices:Array.from({length:100001},()=>({x:0,y:0,z:0}))}];
  for(const bad of bads){assert.equal(e.importJSON({entities:[bad]}).ok,false);assert.equal(e.serialize(),saved);}assert.throws(()=>core.createEditor({entities:[{id:'path',type:'POLY3D',points:[{x:0,y:0,z:0},{x:0,y:0,z:0}],closed:false,layer:'0'}]}));
});

test('3D JSON and geometry clipboard preserve XYZ, faces, styles and relative-placement base',()=>{
  const e=core.createEditor();accepted(e,['BOX','10,20,30','15,25,30','5','3DPOLY','0,0,10','1,2,20','']);e.select(e.state.entities.map(entity=>entity.id));assert.equal(e.copySelection({x:0,y:0,z:5}).ok,true);const clipboard=e.getClipboard();assert.deepEqual(clipboard.base,{x:0,y:0,z:5});
  const target=core.createEditor();assert.equal(target.setClipboard(clipboard).ok,true);accepted(target,['PASTECLIP','@100,200,300']);xyz(target.state.entities[0].vertices[0],[110,220,330]);xyz(target.state.entities[1].points[0],[100,200,310]);assert.deepEqual(target.state.entities[0].faces,e.state.entities[0].faces);assert.deepEqual(core.createEditor(JSON.parse(target.serialize())).state.entities,target.state.entities);
});

test('3D locked/hidden layer guards cover command selection, erase, construction and vertex edits',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,0','2,3,0','4']);const id=e.state.entities[0].id;e.updateLayer('0',{locked:true});assert.equal(e.select([id]).ok,true);assert.equal(e.state.selectionIds.length,0);assert.equal(e.moveGrip(id,0,{x:1,y:1,z:1}).ok,false);accepted(e,['BOX']);assert.equal(e.execute('0,0,0').ok,false);assert.equal(e.state.entities.length,1);
});

test('3D mesh edges, grips and XY compatibility bounds include every vertex while vertex snaps retain Z',()=>{
  const mesh={id:'m',...core.makeBoxMesh({x:0,y:0,z:2},{x:10,y:20,z:2},30),layer:'0'};assert.equal(core.entityEdges(mesh).length,12);assert.equal(core.entityGripPoints(mesh).length,8);assert.deepEqual(core.bounds([mesh]),{minX:0,minY:0,maxX:10,maxY:20});assert.equal(core.findSnap([mesh],{x:0,y:0},.1).point.z,2);
});

test('3D camera/workspace persist separately from geometry Undo and quick construction elevation survives active path Undo',()=>{
  const e=core.createEditor();assert.equal(e.setWorkspace('3d').ok,true);assert.equal(e.set3DView({target:{x:10,y:20,z:30},projection:'perspective',distance:300,fov:60,roll:15,autoTarget:false}).ok,true);assert.equal(e.canUndo,false);
  accepted(e,['3DPOLY','0,0,0','10,0,5']);assert.equal(e.updateDraftingSettings({constructionElevation:12}).ok,true);accepted(e,['ESC','U']);assert.equal(e.state.settings.constructionElevation,12);assert.equal(e.state.camera3d.target.z,30);assert.equal(e.state.workspace,'3d');const restored=core.createEditor(JSON.parse(e.serialize()));assert.deepEqual(restored.state.camera3d,e.state.camera3d);assert.equal(restored.state.workspace,'3d');
  assert.equal(e.updateDrawingSettings({precision:3}).ok,true);assert.equal(e.state.workspace,'3d');assert.deepEqual(e.state.camera3d.target,{x:10,y:20,z:30});
});

test('3D camera and construction preferences reject malformed values atomically; typed orbit center accepts XYZ without geometry history',()=>{
  const e=core.createEditor(),before=e.serialize();for(const patch of [{target:{x:0,y:0,z:null}},{scale:1e-320},{distance:1e-320},{pitch:91},{projection:'fisheye'},{autoTarget:null},{fov:180}]){assert.equal(e.set3DView(patch).ok,false);assert.equal(e.serialize(),before);}assert.equal(e.updateDrawingSettings({constructionPlane:'ZZ'}).ok,false);assert.equal(e.serialize(),before);
  const viewTarget=structuredClone(e.state.camera3d.target);accepted(e,['3DORBITCTR','10,20,30']);assert.deepEqual(e.state.camera3d.orbitCenter,{x:10,y:20,z:30});assert.deepEqual(e.state.camera3d.target,viewTarget);assert.equal(e.state.camera3d.autoTarget,false);assert.equal(e.canUndo,false);
});

test('3D DXF emits genuine XYZ 3DFACE triangles/quads and owned 3D POLYLINE vertices without ACIS proxies',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,3','10,20,3','30','3DPOLY','0,0,2','10,0,5','10,10,8','C']);const dxf=e.exportDXF(),rows=dxf.trimEnd().split(/\r?\n/),records=[];let record;
  for(let i=0;i<rows.length;i+=2){const code=Number(rows[i]),value=rows[i+1];if(code===0){record={type:value,pairs:[]};records.push(record);}else record?.pairs.push([code,value]);}const field=(r,code)=>r.pairs.find(p=>p[0]===code)?.[1];
  const faces=records.filter(r=>r.type==='3DFACE'),poly=records.find(r=>r.type==='POLYLINE'),vertices=records.filter(r=>r.type==='VERTEX'),end=records.find(r=>r.type==='SEQEND');assert.equal(faces.length,6);assert.equal(vertices.length,3);assert.equal(field(poly,70),'9');assert.equal(field(vertices[2],30),'8');assert.equal(field(vertices[2],70),'32');assert.ok(vertices.every(r=>field(r,330)===field(poly,5)));assert.equal(field(end,330),field(poly,5));assert.ok(faces.every(r=>r.pairs.some(([c,v])=>c===100&&v==='AcDbFace')));assert.ok(faces.some(r=>field(r,30)==='33'));assert.ok(!dxf.includes('3DSOLID'));assert.ok(!dxf.includes('AcDbModelerGeometry'));
  const handles=records.map(r=>field(r,r.type==='DIMSTYLE'?105:5)).filter(Boolean);assert.equal(new Set(handles).size,handles.length);
});

test('3D primitive validation preserves radius recovery and does not use an unresolved placeholder height at large Z',()=>{
  const e=core.createEditor();accepted(e,['CYLINDER','1e308,0,0']);const before=e.serialize(),base=structuredClone(e.state.commandPoints);
  assert.equal(e.execute('1e308').ok,false);assert.deepEqual(e.previewScalar(1e308),[]);assert.equal(e.state.commandPhase,'radius');assert.equal(e.serialize(),before);assert.deepEqual(e.state.commandPoints,base);
  accepted(e,['ESC','CYLINDER','0,0,0','5','10']);assert.equal(e.state.entities.length,1);
  accepted(e,['BOX','0,0,1e20','1000000,2000000,1e20']);assert.equal(e.state.commandPhase,'height');accepted(e,['1000000']);assert.equal(e.state.entities.length,2);closedOrientedMesh(e.state.entities[1]);
});

test('VPOINT SE direction and PLAN World change only view; zero vector and unsupported UCS preserve recovery',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,0','10,20,0','30']);const geometry=structuredClone(e.state.entities),revision=e.state.revision;accepted(e,['VPOINT']);assert.equal(e.execute('0,0,0').ok,false);assert.equal(e.state.commandPhase,'view-vector');accepted(e,['1,-1,1']);assert.equal(e.state.camera3d.yaw,-45);assert.ok(Math.abs(e.state.camera3d.pitch-35.264389682754654)<1e-10);assert.deepEqual(e.state.entities,geometry);assert.equal(e.state.revision,revision);
  accepted(e,['VPOINT','1e308,1e308,1e308']);assert.equal(e.state.camera3d.yaw,45);assert.ok(Math.abs(e.state.camera3d.pitch-35.264389682754654)<1e-10);accepted(e,['PLAN']);assert.equal(e.execute('UCS').ok,false);assert.equal(e.state.commandPhase,'plan-choice');accepted(e,['W']);assert.equal(e.state.camera3d.mode,'top');assert.equal(e.state.camera3d.pitch,90);accepted(e,['U']);assert.equal(e.state.entities.length,0);
});

// Advanced editing is grounded in published command concepts and independent math.
// These cases are not presented as new actual-AutoCAD observations.
test('ELLIPSE endpoint and Center flows store exact axes, including a first minor axis',()=>{
  const e=core.createEditor();accepted(e,['EL','0,0','10,0','10']);const a=e.state.entities[0];point(a.center,[5,0]);point(a.major,[0,10]);assert.equal(a.ratio,.5);point(core.ellipsePoint(a,.25),[0,0]);
  accepted(e,['ELLIPSE','C','20,30','30,30','4']);assert.deepEqual(e.state.entities[1],{id:'e2',type:'ELLIPSE',center:{x:20,y:30},major:{x:10,y:0},ratio:.4,layer:'0'});const before=JSON.stringify(e.state.entities);accepted(e,['U','REDO']);assert.equal(JSON.stringify(e.state.entities),before);
});

test('ELLIPSE unsupported options and degenerate distances preserve the prompt for corrected entry',()=>{
  const e=core.createEditor();accepted(e,['ELLIPSE','0,0']);assert.equal(e.execute('0,0').ok,false);accepted(e,['10,0']);for(const value of ['0','-1','ARC','Rotation','1e309'])assert.equal(e.execute(value).ok,false);assert.equal(e.state.commandPhase,'minor-distance');assert.equal(e.state.entities.length,0);accepted(e,['3']);assert.equal(e.state.entities[0].ratio,.6);
});

test('ELLIPSE exact conic survives positive scale, rotate, mirror, JSON and scalar ratio changes',()=>{
  const e=core.createEditor();accepted(e,['ELLIPSE','C','1e12,2e12','1000000000010,2000000000000','3']);const id=e.state.entities[0].id;assert.equal(e.setAdvancedProperties(id,{ratio:.1}).ok,true);assert.equal(e.state.entities[0].ratio,.1);e.select([id]);accepted(e,['ROTATE','1e12,2e12','90']);point(e.state.entities[0].major,[0,10]);const a=e.state.entities[0],b=core.scaleEntity(a,a.center,2),c=core.mirrorEntity(b,{x:0,y:0},{x:1,y:0});assert.equal(c.ratio,.1);point(c.major,[0,-20]);assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.entities,e.state.entities);
});

test('SPLINE CV flow stores a true cubic curve, exact Bezier span and grouped history',()=>{
  const e=core.createEditor();accepted(e,['SPL','M','CV','0,0','0,10','10,10','10,0','']);const spline=e.state.entities[0];assert.equal(spline.type,'SPLINE');assert.deepEqual(spline.knots,[0,0,0,0,1,1,1,1]);point(core.splinePoint(spline,.5),[5,7.5]);core.splineBezierSegments(spline)[0].forEach((p,i)=>point(p,[[0,0],[0,10],[10,10],[10,0]][i]));accepted(e,['U']);assert.equal(e.state.entities.length,0);accepted(e,['REDO']);assert.deepEqual(e.state.entities[0],spline);
});

test('SPLINE local Undo below four CVs removes provisional geometry and Escape retains the accepted curve',()=>{
  const e=core.createEditor();accepted(e,['SPLINE','0,0','0,10','10,10','10,0','U']);assert.equal(e.state.entities.length,0);assert.equal(e.execute('').ok,false);accepted(e,['10,0','20,0','U','ESC']);assert.equal(e.state.entities[0].controlPoints.length,4);accepted(e,['U']);assert.equal(e.state.entities.length,0);
});

test('SPLINE rejects Fit, periodic, malformed knots and all-coincident geometry atomically',()=>{
  const e=core.createEditor();accepted(e,['SPLINE','M']);assert.equal(e.execute('FIT').ok,false);assert.equal(e.state.commandPhase,'method');accepted(e,['CV','0,0','0,0','0,0']);assert.equal(e.execute('0,0').ok,false);accepted(e,['10,0']);assert.equal(e.execute('CLOSE').ok,false);accepted(e,['']);const before=e.serialize(),s=e.state.entities[0];
  for(const bad of [{...s,knots:[0,0,0,0,.5,1,1,1]},{...s,degree:2},{...s,closed:true},{...s,controlPoints:Array.from({length:1025},()=>({x:0,y:0}))}]){assert.equal(e.importJSON({entities:[bad]}).ok,false);assert.equal(e.serialize(),before);}
});

test('tiny SPLINE extrema remain accurate below a drawing-unit floor',()=>{
  const s={type:'SPLINE',degree:3,closed:false,controlPoints:[{x:0,y:0},{x:0,y:1e-18},{x:1e-18,y:1e-18},{x:0,y:0}],knots:makeClampedKnots(4)},p=splineBoundsPoints(s);assert.ok(Math.abs(Math.max(...p.map(p=>p.x))/(1e-18)-4/9)<1e-14);assert.ok(Math.abs(Math.max(...p.map(p=>p.y))/(1e-18)-.75)<1e-14);assert.ok(core.snapCandidates(s).every(c=>c.type==='endpoint'));assert.equal(core.snapCandidates(s).length,2);
});

test('DIMANGULAR three-point definitions choose the minor or reflex sector and recompute live',()=>{
  const e=core.createEditor();accepted(e,['DAN','0,0','10,0','0,10','5,5','DIMANGULAR','0,0','10,0','0,10','-5,-5']);assert.equal(core.formatDimension(e.state.entities[0],e.state).measurement,90);assert.equal(core.formatDimension(e.state.entities[1],e.state).measurement,270);assert.equal(core.formatDimension(e.state.entities[1],e.state).label,'270.00°');const id=e.state.entities[0].id;assert.equal(e.setDimensionProperties(id,{p2:{x:10,y:10}}).ok,true);assert.equal(core.formatDimension(e.state.entities[0],e.state).measurement,45);accepted(e,['U']);assert.equal(core.formatDimension(e.state.entities[0],e.state).measurement,90);
});

test('DIMANGULAR transforms preserve the measured angle and expose vertex plus two rays and placement grips',()=>{
  const e=core.createEditor();accepted(e,['DIMANGULAR','10,20','20,20','10,30','15,25']);const dim=e.state.entities[0],m=core.mirrorEntity(dim,{x:0,y:0},{x:1,y:0},e.state),r=core.rotateEntity(dim,{x:0,y:0},33,e.state),s=core.scaleEntity(dim,{x:0,y:0},2,e.state);for(const d of [m,r,s])assert.ok(Math.abs(core.formatDimension(d,e.state).measurement-90)<1e-10);assert.equal(core.entityGripPoints(dim).length,4);const layout=core.annotationPrimitives(dim,e.state);assert.ok(layout.segments.length>3);assert.ok(layout.texts[0].rotation>=-90&&layout.texts[0].rotation<=90);assert.equal(e.moveGrip(dim.id,1,dim.vertex).ok,false);
});

test('HATCH captures a nonassociative boundary and generates finite solid or clipped parallel geometry',()=>{
  const e=core.createEditor();accepted(e,['REC','0,0','20,10','H','PARALLEL','0','2','e1']);const hatch=e.state.entities[1],original=structuredClone(hatch.boundary),segments=core.hatchGeometry(hatch).segments;assert.equal(segments.length,5);for(const [a,b] of segments){assert.equal(a.x,0);assert.equal(b.x,20);assert.equal(a.y,b.y);}assert.equal(e.moveGrip('e1',2,{x:30,y:20}).ok,true);assert.deepEqual(e.state.entities[1].boundary,original);accepted(e,['CIRCLE','50,10','5','HATCH','SOLID','e3']);const solid=e.state.entities.at(-1);assert.equal(core.hatchGeometry(solid).fills.length,1);assert.equal(core.hitTest([solid],{x:50,y:10},.1,e.state),solid.id);
});

test('concave parallel HATCH retains separated spans rather than filling a notch',()=>{
  const boundary={type:'PLINE',closed:true,points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:6,y:10},{x:6,y:3},{x:4,y:3},{x:4,y:10},{x:0,y:10}]},h={type:'HATCH',boundary,pattern:'parallel',origin:{x:0,y:0},angle:0,spacing:1},spans=core.hatchGeometry(h).segments.filter(([a])=>a.y===5);assert.equal(spans.length,2);assert.deepEqual(spans,[[{x:0,y:5},{x:4,y:5}],[{x:6,y:5},{x:10,y:5}]]);assert.equal(boundaryContains(boundary,{x:5,y:5}),false);
});

test('giant finite circular HATCH clipping avoids quadratic underflow and emits nine chords',()=>{
  const h={type:'HATCH',boundary:{type:'CIRCLE',center:{x:0,y:0},radius:1e300},origin:{x:0,y:0},pattern:'parallel',angle:0,spacing:2e299},segments=core.hatchGeometry(h).segments;assert.equal(segments.length,9);assert.ok(segments.flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});

test('HATCH rejects open/self-intersecting boundaries and excessive scanline or unsafe index counts',()=>{
  const e=core.createEditor();accepted(e,['PLINE','0,0','10,0','10,10','','HATCH','SOLID']);assert.equal(e.execute('e1').ok,false);assert.equal(e.state.entities.length,1);accepted(e,['ESC']);const before=e.serialize();const raw={id:'h',type:'HATCH',boundary:{type:'PLINE',closed:true,points:[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]},origin:{x:0,y:0},pattern:'solid',angle:0,spacing:1};assert.equal(e.importJSON({entities:[raw]}).ok,false);assert.equal(e.serialize(),before);
  const circle={...raw,boundary:{type:'CIRCLE',center:{x:0,y:0},radius:10},pattern:'parallel',spacing:.001};assert.throws(()=>core.hatchGeometry(circle),/5000/);assert.throws(()=>core.hatchGeometry({...circle,spacing:1,origin:{x:0,y:1e20}}),/safe-index/);assert.throws(()=>core.hatchGeometry({...raw,boundary:{type:'PLINE',closed:true,points:Array.from({length:4097},(_,i)=>({x:i,y:0}))}}),/4096/);
});

test('HATCH caps actual concave clipped segments while building, rather than only scanlines',()=>{
  const points=[{x:0,y:0},{x:100,y:0},{x:100,y:10}];for(let x=99;x>=0;x--)points.push({x,y:x%2?2:10});const h={type:'HATCH',boundary:{type:'PLINE',closed:true,points},origin:{x:0,y:0},pattern:'parallel',angle:0,spacing:.05};assert.throws(()=>core.hatchGeometry(h),/5000-segment/);
});

const hatchFixture=(id,spacing=1)=>({id,type:'HATCH',layer:'0',boundary:{type:'CIRCLE',center:{x:0,y:0},radius:2000},origin:{x:0,y:0},pattern:'parallel',angle:0,spacing});
test('aggregate HATCH budget rejects import, ARRAYRECT, new hatch and exact property edits before mutation',()=>{
  const entities=Array.from({length:25},(_,i)=>hatchFixture(`h${i}`)),e=core.createEditor({entities}),before=e.serialize();assert.throws(()=>core.createEditor({entities:[...entities,hatchFixture('tooMany')]}),/100000 aggregate/);
  accepted(e,['CIRCLE','10000,0','2000','HATCH','PARALLEL','0','1']);const saved=e.serialize();assert.equal(e.execute(e.state.entities.at(-1).id).ok,false);assert.equal(e.serialize(),saved);accepted(e,['ESC']);
  assert.equal(e.setAdvancedProperties('h0',{spacing:.5}).ok,false);assert.equal(e.serialize(),saved);e.select(['h0']);accepted(e,['ARRAYRECT','1','2','0']);assert.equal(e.execute('10000').ok,false);assert.equal(e.serialize(),saved);accepted(e,['ESC']);assert.equal(e.state.entities.filter(x=>x.type==='HATCH').length,25);assert.notEqual(saved,before);
});

test('block definitions and every INSERT instance count toward the aggregate HATCH resource budget',()=>{
  const child={...hatchFixture('unused'),id:undefined},block={name:'Fill',base:{x:0,y:0},entities:[child]},insert=i=>({id:`i${i}`,type:'INSERT',blockName:'Fill',position:{x:i*5000,y:0},scale:1,rotation:0,layer:'0'}),e=core.createEditor({blocks:[block],entities:Array.from({length:24},(_,i)=>insert(i))}),before=e.serialize();accepted(e,['INSERT','Fill','200000,0','1']);assert.equal(e.execute('0').ok,false);assert.equal(e.serialize(),before);accepted(e,['ESC']);assert.throws(()=>core.createEditor({blocks:[block],entities:Array.from({length:25},(_,i)=>insert(i))}),/100000 aggregate/);
});

const cornerFixture=(different=false)=>core.createEditor({layers:[{name:'0'},{name:'a',color:'#ff0000'},{name:'b',color:'#00ff00'},{name:'current',color:'#0000ff'}],currentLayer:'current',entities:[{id:'a',type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'a',color:'#ffaa00',lineweight:.5},{id:'b',type:'LINE',start:{x:10,y:0},end:{x:10,y:10},layer:different?'b':'a'}]});
test('FILLET constructs tangent geometry on retained LINE sides and groups both trims with the arc',()=>{
  const e=cornerFixture(),before=geometry(e);accepted(e,['F','2']);assert.equal(e.submitObject('a',{x:5,y:0}).ok,true);const preview=e.previewObject('b',{x:10,y:5});assert.equal(preview.length,3);assert.deepEqual(e.state.entities,before);assert.equal(e.submitObject('b',{x:10,y:5}).ok,true);const arc=e.state.entities.at(-1);point(arc.center,[8,2]);assert.equal(arc.radius,2);point(e.state.entities[0].end,[8,0]);point(e.state.entities[1].start,[10,2]);assert.equal(arc.layer,'a');accepted(e,['U']);assert.deepEqual(e.state.entities,before);accepted(e,['REDO']);assert.equal(e.state.entities.length,3);
});

test('CHAMFER distances are applied to their picked source lines, including a sharp zero-distance corner',()=>{
  const e=cornerFixture();accepted(e,['CHA','D','2','3']);e.submitObject('a',{x:5,y:0});assert.equal(e.submitObject('b',{x:10,y:5}).ok,true);point(e.state.entities[0].end,[8,0]);point(e.state.entities[1].start,[10,3]);const connector=e.state.entities[2];point(connector.start,[8,0]);point(connector.end,[10,3]);accepted(e,['U','CHAMFER','0','0']);e.submitObject('a',{x:5,y:0});assert.equal(e.submitObject('b',{x:10,y:5}).ok,true);assert.equal(e.state.entities.length,2);
});

test('mixed-layer FILLET and CHAMFER use current-layer ByLayer connectors and undo atomically',()=>{
  for(const command of ['FILLET','CHAMFER']){const e=cornerFixture(true),before=geometry(e);accepted(e,command==='FILLET'?[command,'2']:[command,'2','3']);e.submitObject('a',{x:5,y:0});const preview=e.previewObject('b',{x:10,y:5});assert.equal(preview.at(-1).layer,'current');assert.equal(e.submitObject('b',{x:10,y:5}).ok,true);const extra=e.state.entities.at(-1);assert.equal(extra.layer,'current');assert.equal(extra.color,undefined);assert.equal(extra.lineweight,undefined);assert.equal(e.state.entities[0].color,'#ffaa00');accepted(e,['U']);assert.deepEqual(e.state.entities,before);accepted(e,['REDO']);assert.equal(e.state.entities.at(-1).layer,'current');}
});

test('locked current layer rejects mixed-layer connector before either source is trimmed',()=>{
  const e=cornerFixture(true);e.updateLayer('current',{locked:true});const before=geometry(e);accepted(e,['FILLET','2']);e.submitObject('a',{x:5,y:0});assert.deepEqual(e.previewObject('b',{x:10,y:5}),[]);const r=e.submitObject('b',{x:10,y:5});assert.equal(r.ok,false);assert.match(r.message,/current layer/);assert.deepEqual(e.state.entities,before);assert.equal(e.state.commandPhase,'second-line');
});

test('excessive corner radius, parallel lines and exact-intersection picks fail without a partial edit',()=>{
  const e=cornerFixture(),before=geometry(e);accepted(e,['FILLET','100']);assert.equal(e.submitObject('a',{x:10,y:0}).ok,true);assert.equal(e.submitObject('b',{x:10,y:5}).ok,false);assert.deepEqual(e.state.entities,before);accepted(e,['R','2']);assert.equal(e.submitObject('b',{x:10,y:5}).ok,false);assert.deepEqual(e.state.entities,before);accepted(e,['ESC','FILLET','100']);e.submitObject('a',{x:5,y:0});assert.equal(e.submitObject('b',{x:10,y:5}).ok,false);assert.deepEqual(e.state.entities,before);accepted(e,['R','2']);assert.equal(e.submitObject('b',{x:10,y:5}).ok,true);
  const lines=[{id:'x',type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'0'},{id:'y',type:'LINE',start:{x:0,y:2},end:{x:10,y:2},layer:'0'}],p=core.createEditor({entities:lines});accepted(p,['CHAMFER','1','1']);p.submitObject('x',{x:5,y:0});assert.equal(p.submitObject('y',{x:5,y:2}).ok,false);assert.deepEqual(p.state.entities,lines);
});

test('ARRAYRECT produces ordinary signed-spacing copies, preserves source and groups one history entry',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','','AR','LAST','','2','3','-20','30']);assert.equal(e.state.entities.length,6);const positions=e.state.entities.map(x=>[x.start.x,x.start.y]);assert.deepEqual(positions,[[0,0],[30,0],[60,0],[0,-20],[30,-20],[60,-20]]);assert.equal(new Set(e.state.entities.map(x=>x.id)).size,6);accepted(e,['U']);assert.equal(e.state.entities.length,1);accepted(e,['REDO']);assert.equal(e.state.entities.length,6);
});

test('ARRAYRECT preserves XYZ and rejects oversized, zero-spacing or overflow results atomically',()=>{
  const e=core.createEditor();accepted(e,['3DPOLY','0,0,7','1,2,9','','ARRAYRECT','LAST','','2']);assert.equal(e.execute('1000').ok,false);assert.equal(e.state.commandPhase,'columns');accepted(e,['2']);assert.equal(e.execute('0').ok,false);accepted(e,['10','20']);assert.deepEqual(e.state.entities[3].points,[{x:20,y:10,z:7},{x:21,y:12,z:9}]);
  const f=core.createEditor();accepted(f,['LINE','1e308,0','1e308,10','','ARRAYRECT','LAST','','1','3','0']);const before=f.serialize();assert.equal(f.execute('1e308').ok,false);assert.equal(f.serialize(),before);
});

test('STRETCH changes only inside LINE endpoints while moving fully contained objects',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','','CIRCLE','10,0','1','S']);assert.equal(e.setStretchWindow({x:12,y:-2},{x:8,y:2}).ok,true);accepted(e,['0,0']);const before=geometry(e),preview=e.previewCommand({x:5,y:3});assert.deepEqual(e.state.entities,before);assert.equal(preview.length,2);accepted(e,['@5,3']);point(e.state.entities[0].start,[0,0]);point(e.state.entities[0].end,[15,3]);point(e.state.entities[1].center,[15,3]);accepted(e,['U']);assert.deepEqual(e.state.entities,before);assert.equal(e.execute('ST').ok,true);assert.equal(e.state.command,null);
});

test('partial rectangular STRETCH becomes an honest closed PLINE and preserves outside vertices',()=>{
  const e=core.createEditor();accepted(e,['REC','0,0','10,10','STRETCH','12,-2','8,12','0,0','@5,0']);const p=e.state.entities[0];assert.equal(p.type,'PLINE');assert.equal(p.closed,true);assert.deepEqual(p.points,[{x:0,y:0},{x:15,y:0},{x:15,y:10},{x:0,y:10}]);accepted(e,['U']);assert.equal(e.state.entities[0].type,'RECTANG');
});

test('STRETCH rejects crossing 3D or unsupported partial annotations before capturing/mutating geometry',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','','BOX','8,-1,0','12,1,0','3','STRETCH']);const before=e.serialize();assert.equal(e.setStretchWindow({x:11,y:-2},{x:9,y:2}).ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'window-first');accepted(e,['ESC']);const text={id:'t',type:'TEXT',layer:'0',position:{x:0,y:0},text:'Long label',height:5,rotation:0,style:'Standard'},t=core.createEditor({entities:[text]});accepted(t,['STRETCH']);assert.equal(t.setStretchWindow({x:2,y:-1},{x:1,y:1}).ok,false);assert.equal(t.state.entities[0].text,'Long label');
});

test('PEDIT LINE conversion, reverse and local Undo recover valid phases and group global history',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','','PE','LAST','','Y','Reverse','U']);assert.deepEqual(e.state.entities[0].points,[{x:0,y:0},{x:10,y:0}]);accepted(e,['U']);assert.equal(e.state.entities[0].type,'LINE');assert.equal(e.state.commandPhase,'convert');accepted(e,['Y','Reverse','']);assert.deepEqual(e.state.entities[0].points,[{x:10,y:0},{x:0,y:0}]);accepted(e,['U']);assert.equal(e.state.entities[0].type,'LINE');accepted(e,['REDO']);assert.equal(e.state.entities[0].type,'PLINE');
});

test('PEDIT Open/Close and connected Join repeat honestly; disconnected joins reject atomically',()=>{
  const e=core.createEditor();accepted(e,['PLINE','0,0','10,0','10,10','C','PEDIT','LAST','','OPEN','CLOSE','U','']);assert.equal(e.state.entities[0].closed,false);accepted(e,['LINE','10,10','20,10','','PEDIT','e1','','JOIN','e2','']);assert.equal(e.state.entities.length,1);assert.deepEqual(e.state.entities[0].points,[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:20,y:10}]);accepted(e,['U','']);assert.equal(e.state.entities.length,2);
  accepted(e,['LINE','100,100','110,100','','PEDIT','e1','','JOIN','e3']);const before=geometry(e);assert.equal(e.execute('').ok,false);assert.deepEqual(e.state.entities,before);assert.equal(e.state.commandPhase,'join-selection');
});

test('BLOCK persists local definition and replaces sources with a reference as one undoable operation',()=>{
  const e=core.createEditor();accepted(e,['LINE','10,20','20,20','','BLOCK','Part','10,20','LAST','']);assert.equal(e.state.blocks.length,1);assert.deepEqual(e.state.blocks[0].base,{x:10,y:20});assert.deepEqual(e.state.blocks[0].entities[0].start,{x:0,y:0});assert.equal(e.state.blocks[0].entities[0].id,undefined);assert.equal(e.state.entities[0].type,'INSERT');point(core.expandedInsertEntities(e.state.entities[0],e.state)[0].start,[10,20]);accepted(e,['U']);assert.equal(e.state.blocks.length,0);assert.equal(e.state.entities[0].type,'LINE');accepted(e,['REDO']);assert.equal(e.state.blocks.length,1);assert.equal(e.state.entities[0].type,'INSERT');
});

test('INSERT transforms real definition geometry with uniform scale/rotation and supports exact properties',()=>{
  const e=core.createEditor();accepted(e,['LINE','10,20','20,20','','BLOCK','Part','10,20','LAST','','INSERT','Part','100,200','2','90']);const insert=e.state.entities[1],line=core.expandedInsertEntities(insert,e.state)[0];point(line.start,[100,200]);point(line.end,[100,220]);assert.equal(e.setAdvancedProperties(insert.id,{scale:3,rotation:0,position:{x:150,y:250}}).ok,true);point(core.expandedInsertEntities(e.state.entities[1],e.state)[0].end,[180,250]);accepted(e,['U']);assert.equal(e.state.entities[1].scale,2);assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.blocks,e.state.blocks);
});

test('INSERT layer-zero children inherit reference overrides while explicit child styles stay intact',()=>{
  const e=core.createEditor({layers:[{name:'0'},{name:'red',color:'#ff0000'}],blocks:[{name:'Part',base:{x:0,y:0},entities:[{type:'LINE',layer:'0',start:{x:0,y:0},end:{x:10,y:0}},{type:'LINE',layer:'red',color:'#ff9900',lineweight:.7,start:{x:0,y:1},end:{x:10,y:1}}]}],entities:[{id:'i',type:'INSERT',blockName:'Part',layer:'red',position:{x:50,y:50},scale:2,rotation:0,color:'#123456',lineweight:.5}]});const children=core.expandedInsertEntities(e.state.entities[0],e.state);assert.equal(children[0].layer,'red');assert.equal(children[0].color,'#123456');assert.equal(children[0].lineweight,.5);assert.equal(children[1].color,'#ff9900');assert.equal(children[1].lineweight,.7);assert.equal(e.state.blocks[0].entities[0].color,undefined);assert.equal(core.hitTest(e.state.entities,{x:55,y:50},.1,e.state),'i');
});

test('BLOCK rejects nested/3D content, duplicate names and malformed definitions without partial state',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0,0','1,1,0','2','BLOCK','Bad','0,0','LAST']);const before=e.serialize();assert.equal(e.execute('').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.blocks.length,0);accepted(e,['ESC','LINE','0,0','10,0','','BLOCK','Part','0,0','LAST','','BLOCK']);assert.equal(e.execute('Part').ok,false);assert.equal(e.state.commandPhase,'name');assert.throws(()=>core.createEditor({blocks:[{name:'A',base:{x:0,y:0},entities:[{type:'INSERT',blockName:'A',position:{x:0,y:0},scale:1,rotation:0}]}]}),/nested/);
});

test('block clipboard carries definitions/styles and conflicts reject paste before any mutation',()=>{
  const e=core.createEditor();accepted(e,['ELLIPSE','C','10,20','20,20','3','BLOCK','Part','10,20','LAST','']);e.select([e.state.entities[0].id]);assert.equal(e.copySelection({x:10,y:20}).ok,true);const payload=e.getClipboard();assert.equal(payload.blocks.length,1);const target=core.createEditor();assert.equal(target.setClipboard(payload).ok,true);accepted(target,['PASTECLIP','100,200']);assert.equal(target.state.blocks.length,1);point(core.expandedInsertEntities(target.state.entities[0],target.state)[0].center,[100,200]);accepted(target,['U']);assert.equal(target.state.blocks.length,0);
  const conflict=core.createEditor({blocks:[{name:'Part',base:{x:0,y:0},entities:[{type:'LINE',start:{x:0,y:0},end:{x:1,y:0},layer:'0'}]}]});assert.equal(conflict.setClipboard(payload).ok,true);accepted(conflict,['PASTECLIP']);const before=conflict.serialize();assert.equal(conflict.execute('100,200').ok,false);assert.equal(conflict.serialize(),before);
});

test('advanced entity geometry, resources and clipboard reject malformed fields with unchanged drawing',()=>{
  const e=core.createEditor();accepted(e,['ELLIPSE','C','0,0','10,0','5']);const before=e.serialize(),a=e.state.entities[0];for(const bad of [{...a,ratio:null},{...a,major:{x:0,y:0}},{...a,center:{x:0,y:0,z:1}}]){assert.equal(e.importJSON({entities:[bad]}).ok,false);assert.equal(e.serialize(),before);}assert.equal(e.setAdvancedProperties(a.id,{ratio:0}).ok,false);assert.equal(e.serialize(),before);e.updateLayer('0',{locked:true});assert.equal(e.setAdvancedProperties(a.id,{ratio:.3}).ok,false);assert.equal(e.moveGrip(a.id,0,{x:1,y:1}).ok,false);
});

test('explicit object IDs preserve projected overlap choice and preview remains read-only',()=>{
  const lines=[{id:'under',type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'0'},{id:'chosen',type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'0'},{id:'vertical',type:'LINE',start:{x:10,y:0},end:{x:10,y:10},layer:'0'}],e=core.createEditor({entities:lines});accepted(e,['FILLET','2']);assert.equal(e.submitObject('chosen',{x:5,y:0}).ok,true);const preview=e.previewObject('vertical',{x:10,y:5});assert.equal(preview[0].id,'chosen');assert.deepEqual(e.state.entities,lines);assert.equal(e.submitObject('vertical',{x:10,y:5}).ok,true);assert.deepEqual(e.state.entities[0],lines[0]);point(e.state.entities[1].end,[8,0]);
});

test('advanced DXF emits analytic curves, real HATCH, named BLOCK/INSERT and owned angular picture records',()=>{
  const e=core.createEditor();accepted(e,['ELLIPSE','C','0,0','10,0','5','SPLINE','0,20','0,30','10,30','10,20','','DIMANGULAR','20,0','30,0','20,10','25,5','HATCH','PARALLEL','0','2','e1']);e.select(['e1','e2','e3','e4']);accepted(e,['BLOCK','Part','0,0','','INSERT','Part','100,100','2','30']);const rows=e.exportDXF().trimEnd().split(/\r?\n/),records=[];let record;for(let i=0;i<rows.length;i+=2){const code=Number(rows[i]),value=rows[i+1];if(code===0){record={type:value,pairs:[]};records.push(record);}else record?.pairs.push([code,value]);}const field=(r,c)=>r.pairs.find(p=>p[0]===c)?.[1],all=(r,c)=>r.pairs.filter(p=>p[0]===c).map(p=>p[1]);
  const ellipse=records.find(r=>r.type==='ELLIPSE'),spline=records.find(r=>r.type==='SPLINE'),hatch=records.find(r=>r.type==='HATCH'),block=records.find(r=>r.type==='BLOCK'&&field(r,2)==='Part'),dim=records.find(r=>r.type==='DIMENSION'),refs=records.filter(r=>r.type==='INSERT');assert.equal(field(ellipse,40),'0.5');assert.equal(field(ellipse,11),'10');assert.equal(field(spline,71),'3');assert.equal(all(spline,40).length,8);assert.equal(all(spline,10).length,4);assert.equal(field(hatch,91),'1');assert.equal(field(hatch,71),'0');assert.equal(field(hatch,78),'1');assert.equal(refs.length,2);assert.equal(field(refs[1],41),'2');assert.equal(field(dim,70),'37');assert.equal(field(dim,42),undefined);assert.ok(all(dim,100).includes('AcDb3PointAngularDimension'));assert.equal(field(dim,330),field(block,330));
  const picture=records.find(r=>r.type==='BLOCK'&&field(r,2)===field(dim,2));assert.ok(picture);assert.notEqual(field(picture,330),field(block,330));const children=records.filter(r=>field(r,330)===field(block,330)&&['ELLIPSE','SPLINE','DIMENSION','HATCH'].includes(r.type));assert.equal(children.length,4);assert.ok(children.every(r=>field(r,370)==='-2'));const handles=records.map(r=>field(r,r.type==='DIMSTYLE'?105:5)).filter(Boolean);assert.equal(new Set(handles).size,handles.length);const valid=new Set(handles);for(const r of records)for(const [code,value]of r.pairs)if([330,340,347,350,360,390].includes(code)&&value!=='0')assert.ok(valid.has(value),`${r.type} dangling ${code}:${value}`);
});

test('angular extension gaps face an inside placement and stop beyond the measured arc',()=>{
  const e=core.createEditor();accepted(e,['DIMANGULAR','0,0','20,0','0,20','3,4']);const geometry=core.annotationPrimitives(e.state.entities[0],e.state),extensions=geometry.segments.slice(-2);point(extensions[0][0],[19,0]);point(extensions[0][1],[3.75,0]);point(extensions[1][0],[0,19]);point(extensions[1][1],[0,3.75]);
});

test('aggregate HATCH paste, COPY and boundary grip changes reject before geometry/resource mutation',()=>{
  const entities=Array.from({length:25},(_,i)=>hatchFixture(`h${i}`)),e=core.createEditor({entities}),before=e.serialize();assert.equal(e.moveGrip('h0',1,{x:4000,y:0}).ok,false);assert.equal(e.serialize(),before);e.select(['h0']);assert.equal(e.copySelection({x:0,y:0}).ok,true);accepted(e,['PASTECLIP']);assert.equal(e.execute('10000,0').ok,false);assert.equal(e.serialize(),before);accepted(e,['ESC']);e.select(['h0']);accepted(e,['COPY','0,0']);assert.equal(e.execute('@10000,0').ok,false);assert.equal(e.serialize(),before);accepted(e,['ESC']);assert.equal(e.canUndo,false);
});

test('advanced capability inventory is immutable and every listed command has a real engine handler',()=>{
  assert.equal(Object.isFrozen(core.ADVANCED_COMMANDS),true);assert.equal(core.ADVANCED_COMMANDS.length,11);for(const command of core.ADVANCED_COMMANDS){const e=core.createEditor(),r=e.execute(command);assert.equal(r.ok,true,`${command}: ${r.message}`);assert.equal(e.state.command,command);}assert.throws(()=>core.ADVANCED_COMMANDS.push('FAKE'));
});

test('hidden nonzero block child layers disappear from display, picks, snaps and Fit while remaining saved/exportable',()=>{
  const child=(layer,x)=>({type:'LINE',layer,start:{x,y:0},end:{x:x+10,y:0}}),e=core.createEditor({layers:[{name:'0'},{name:'hidden',visible:false}],blocks:[{name:'Part',base:{x:0,y:0},entities:[child('0',0),child('hidden',1000)]}],entities:[{id:'i',type:'INSERT',blockName:'Part',layer:'0',position:{x:0,y:0},scale:1,rotation:0}]}),insert=e.state.entities[0];assert.equal(core.expandedInsertEntities(insert,e.state).length,2);assert.equal(core.visibleInsertEntities(insert,e.state).length,1);assert.deepEqual(core.bounds([insert],e.state),{minX:0,minY:0,maxX:10,maxY:0});assert.equal(core.entityDisplayPrimitives(insert,e.state).segments.length,1);assert.equal(core.hitTest([insert],{x:1005,y:0},.1,e.state),null);assert.deepEqual(core.entitiesInBox([insert],{x:1011,y:-1},{x:999,y:1},true,e.state),[]);assert.ok(core.snapCandidates(insert,e.state).every(c=>c.point.x<1000));assert.equal(e.exportDXF().includes('1000'),true);e.select(['i']);assert.equal(e.copySelection().ok,true);assert.equal(e.getClipboard().blocks[0].entities.length,2);assert.equal(e.updateLayer('0',{visible:false}).ok,true);assert.equal(core.visibleInsertEntities(insert,e.state).length,0);assert.deepEqual(core.snapCandidates(insert,e.state),[]);
});

const lineBlock=(name,count)=>({name,base:{x:0,y:0},entities:Array.from({length:count},(_,i)=>({type:'LINE',layer:'0',start:{x:i,y:0},end:{x:i+.5,y:0}}))});
const blockReference=(id,name='Part')=>({id,type:'INSERT',blockName:name,position:{x:0,y:0},scale:1,rotation:0,layer:'0'});
test('expanded block import rejects repeated cheap references before reading any child geometry or insertion coordinates',()=>{
  const block=lineBlock('Part',1000);let childReads=0,positionReads=0;Object.defineProperty(block.entities[0],'start',{get(){childReads++;return{x:0,y:0};},enumerable:true});
  const references=Array.from({length:1000},(_,i)=>{const ref=blockReference(`i${i}`);Object.defineProperty(ref,'position',{get(){positionReads++;return{x:0,y:0};},enumerable:true});return ref;});assert.throws(()=>core.createEditor({blocks:[block],entities:references}),/100000 expanded/);assert.equal(childReads,0);assert.equal(positionReads,0);
  const e=core.createEditor();accepted(e,['LINE','0,0','10,0','']);const before=e.serialize();assert.equal(e.importJSON({blocks:[block],entities:references}).ok,false);assert.equal(e.serialize(),before);assert.equal(childReads,0);assert.equal(positionReads,0);
});

test('oversized block ARRAYRECT preflights its whole proposed array before any repeated child transformation',()=>{
  const e=core.createEditor({blocks:[lineBlock('Part',1000)],entities:[blockReference('i')]}),before=e.serialize();e.select(['i']);accepted(e,['ARRAYRECT','10','100','20']);const child=e.state.blocks[0].entities[0],original=child.start;let reads=0;Object.defineProperty(child,'start',{get(){reads++;throw Error('Child expansion was reached.');},enumerable:true,configurable:true});const response=e.execute('20');Object.defineProperty(child,'start',{value:original,writable:true,enumerable:true,configurable:true});assert.equal(response.ok,false);assert.match(response.message,/100000 expanded/);assert.equal(reads,0);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'column-spacing');accepted(e,['ESC']);assert.equal(e.canUndo,false);
});

test('block COPY resource overflow retains accepted batches, supports local recovery and adds no failed edit',()=>{
  const e=core.createEditor({blocks:[lineBlock('Part',1000)],entities:Array.from({length:97},(_,i)=>blockReference(`i${i}`))}),before=e.serialize();e.select(['i0']);accepted(e,['COPY','0,0','@10,0']);assert.equal(e.state.entities.length,98);const copied=e.serialize();const response=e.execute('@20,0');assert.equal(response.ok,false);assert.match(response.message,/100000 expanded/);assert.equal(e.serialize(),copied);assert.equal(e.state.commandPhase,'target');accepted(e,['U','']);assert.equal(e.serialize(),before);assert.equal(e.canUndo,false);
});

test('block INSERT and native-independent clipboard placement enforce combined definition/reference budget atomically',()=>{
  const e=core.createEditor({blocks:[lineBlock('Part',1000)],entities:Array.from({length:98},(_,i)=>blockReference(`i${i}`))}),before=e.serialize();accepted(e,['INSERT','Part','10,0','1']);const r=e.execute('0');assert.equal(r.ok,false);assert.match(r.message,/100000 expanded/);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'insert-angle');assert.deepEqual(e.previewScalar(1),[]);accepted(e,['ESC']);e.select(['i0']);assert.equal(e.copySelection({x:0,y:0}).ok,true);accepted(e,['PASTECLIP']);const child=e.state.blocks[0].entities[0],original=child.start;let reads=0;Object.defineProperty(child,'start',{get(){reads++;throw Error('Paste expansion was reached.');},enumerable:true,configurable:true});const pasted=e.execute('20,0');Object.defineProperty(child,'start',{value:original,writable:true,enumerable:true,configurable:true});assert.equal(pasted.ok,false);assert.match(pasted.message,/100000 expanded/);assert.equal(reads,0);assert.equal(e.serialize(),before);accepted(e,['ESC']);assert.equal(e.canUndo,false);
});

test('changing an INSERT to a larger existing definition rejects before validating expanded children',()=>{
  const e=core.createEditor({blocks:[lineBlock('Small',1000),lineBlock('Big',2000)],entities:Array.from({length:96},(_,i)=>blockReference(`i${i}`,'Small'))}),before=e.serialize(),child=e.state.blocks[1].entities[0],original=child.start;let reads=0;Object.defineProperty(child,'start',{get(){reads++;throw Error('Large block expansion was reached.');},enumerable:true,configurable:true});const r=e.setAdvancedProperties('i0',{blockName:'Big'});Object.defineProperty(child,'start',{value:original,writable:true,enumerable:true,configurable:true});assert.equal(r.ok,false);assert.match(r.message,/100000 expanded/);assert.equal(reads,0);assert.equal(e.serialize(),before);assert.equal(e.canUndo,false);assert.equal(e.moveGrip('i0',0,{x:1,y:2}).ok,true);accepted(e,['U']);assert.equal(e.serialize(),before);
});

test('expanded curve-work budget counts real curve tessellation and prevents accepted drawings from becoming unsaveable',()=>{
  const ellipse={type:'ELLIPSE',center:{x:0,y:0},major:{x:10,y:0},ratio:.5,layer:'0'},block={name:'Curves',base:{x:0,y:0},entities:Array.from({length:100},()=>({...ellipse}))};assert.throws(()=>core.createEditor({blocks:[block],entities:Array.from({length:8},(_,i)=>blockReference(`i${i}`,'Curves'))}),/100000 expanded/);
  const points=Array.from({length:100001},(_,i)=>({x:i,y:0})),e=core.createEditor({entities:[{id:'path',type:'PLINE',closed:false,points,layer:'0'}]}),before=e.serialize();accepted(e,['LINE','0,1']);assert.equal(e.execute('1,1').ok,false);assert.equal(e.serialize(),before);assert.deepEqual(e.state.commandPoints,[{x:0,y:1}]);accepted(e,['ESC']);assert.equal(e.canUndo,false);
});

test('deleting a layer referenced only by a used or unused block rejects without geometry/resource/history mutation',()=>{
  for(const used of [false,true]){const e=core.createEditor({layers:[{name:'0'},{name:'Blue'}],blocks:[{name:'Mark',base:{x:0,y:0},entities:[{type:'LINE',layer:'Blue',start:{x:0,y:0},end:{x:10,y:0}}]}],entities:used?[blockReference('i','Mark')]:[]}),before=e.serialize(),revision=e.state.revision;const r=e.deleteLayer('Blue');assert.equal(r.ok,false);assert.equal(r.changed,false);assert.match(r.message,/block definition/);assert.equal(e.serialize(),before);assert.equal(e.state.revision,revision);assert.equal(e.canUndo,false);assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.blocks,e.state.blocks);}
});

test('layer rename updates model entities, every stored block and current reference as one Undo/Redo operation',()=>{
  const line={type:'LINE',layer:'Blue',start:{x:0,y:0},end:{x:10,y:0}},e=core.createEditor({layers:[{name:'0'},{name:'Blue',color:'#0000ff'}],currentLayer:'Blue',blocks:[{name:'Used',base:{x:0,y:0},entities:[line]},{name:'Unused',base:{x:0,y:0},entities:[line,{...line,layer:'0'}]}],entities:[{id:'l',...line},{...blockReference('i','Used'),layer:'Blue'}]}),before=e.serialize();assert.equal(e.updateLayer('Blue',{name:'Green',color:'#00ff00'}).ok,true);assert.equal(e.state.currentLayer,'Green');assert.ok(e.state.entities.every(entity=>entity.layer==='Green'));assert.equal(e.state.blocks[0].entities[0].layer,'Green');assert.equal(e.state.blocks[1].entities[0].layer,'Green');assert.equal(e.state.blocks[1].entities[1].layer,'0');assert.equal(e.state.layers[1].color,'#00ff00');assert.deepEqual(core.createEditor(JSON.parse(e.serialize())).state.blocks,e.state.blocks);const after=e.serialize();accepted(e,['U']);assert.equal(e.serialize(),before);accepted(e,['REDO']);assert.equal(e.serialize(),after);assert.equal(e.renameLayer('Green','Final').ok,true);assert.equal(e.state.blocks[0].entities[0].layer,'Final');
});

test('invalid, duplicate and layer-zero rename reject before any references or history change',()=>{
  const e=core.createEditor({layers:[{name:'0'},{name:'Blue'},{name:'Taken'}],blocks:[{name:'Mark',base:{x:0,y:0},entities:[{type:'LINE',layer:'Blue',start:{x:0,y:0},end:{x:10,y:0}}]}]}),before=e.serialize();for(const [name,target] of [['Blue','Taken'],['Blue','bad/name'],['Blue',null],['0','New']]){const r=e.renameLayer(name,target);assert.equal(r.ok,false);assert.equal(r.changed,false);assert.equal(e.serialize(),before);assert.equal(e.canUndo,false);}assert.equal(e.updateLayer('Blue',{unsupported:'value'}).ok,false);assert.equal(e.serialize(),before);
});

test('PEDIT Undo restoring RECTANG requires truthful reconversion before Open and preserves JSON/DXF/global history',()=>{
  const rectangle={id:'r',type:'RECTANG',layer:'0',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]},e=core.createEditor({entities:[rectangle]}),before=e.serialize();accepted(e,['PEDIT','LAST','','U']);assert.equal(e.state.entities[0].type,'RECTANG');assert.equal(e.state.commandPhase,'convert');assert.match(e.state.prompt,/Convert RECTANG/);const reverted=e.serialize();assert.equal(e.execute('OPEN').ok,false);assert.equal(e.serialize(),reverted);assert.equal(e.state.commandPhase,'convert');accepted(e,['Y','OPEN','']);const path=e.state.entities[0];assert.equal(path.type,'PLINE');assert.equal(path.closed,false);assert.deepEqual(path.points,rectangle.points);const opened=e.serialize(),restored=core.createEditor(JSON.parse(opened));assert.equal(restored.state.entities[0].type,'PLINE');assert.equal(restored.state.entities[0].closed,false);assert.deepEqual(restored.state.entities[0].points,rectangle.points);
  const rows=e.exportDXF().trimEnd().split(/\r?\n/);let inPolyline=false;const pairs=[];for(let i=0;i<rows.length;i+=2){const code=Number(rows[i]),value=rows[i+1];if(code===0){if(inPolyline)break;inPolyline=value==='LWPOLYLINE';}else if(inPolyline)pairs.push([code,value]);}assert.equal(pairs.find(([code])=>code===70)?.[1],'0');assert.equal(pairs.find(([code])=>code===90)?.[1],'4');assert.equal(pairs.filter(([code])=>code===10).length,4);accepted(e,['U']);assert.equal(e.serialize(),before);assert.equal(e.state.entities[0].type,'RECTANG');accepted(e,['REDO']);assert.equal(e.serialize(),opened);
});

test('PEDIT rectangle conversion local Undo can decline without an empty history or recover through repeated edits',()=>{
  const rectangle={id:'r',type:'RECTANG',layer:'0',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]},e=core.createEditor({entities:[rectangle]}),before=e.serialize();accepted(e,['PEDIT','LAST','','U','N']);assert.equal(e.state.command,null);assert.equal(e.serialize(),before);assert.equal(e.canUndo,false);e.clearSelection();accepted(e,['PEDIT','LAST','','U','Y','REVERSE','U']);assert.equal(e.state.entities[0].type,'PLINE');assert.deepEqual(e.state.entities[0].points,rectangle.points);accepted(e,['U']);assert.equal(e.state.entities[0].type,'RECTANG');assert.equal(e.state.commandPhase,'convert');accepted(e,['N']);assert.equal(e.serialize(),before);assert.equal(e.canUndo,false);
});

test('explicit imperial and metric lengths convert into assigned model units without locale/eval shortcuts',()=>{
  for(const token of ["100'",'100ft','100feet','100foot','100′','100’'])assert.equal(core.parseLength(token,{units:'in'}),1200);for(const token of ['12"','12”','12″','12in','12inches'])assert.equal(core.parseLength(token,{units:'in'}),12);assert.equal(core.parseLength("100'",{units:'m'}),30.48);assert.equal(core.parseLength('1m',{units:'m'}),1);assert.equal(core.parseLength('1m',{units:'mm'}),1000);assert.equal(core.parseLength('12in',{units:'ft'}),1);assert.equal(core.parseLength("100'",{units:'unitless'}),1200);assert.equal(core.parseLength('100',{units:'ft'}),100);
});

test('whole-sign compounds and fractional feet/inches accept attached aliases with no arithmetic evaluation',()=>{
  const s={units:'in'};for(const token of ["5'6 1/2\"","5'-6-1/2\"",'5ft6 1/2in','5feet6.5inches'])assert.equal(core.parseLength(token,s),66.5);assert.equal(core.parseLength("-5'-6 1/2\"",s),-66.5);assert.equal(core.parseLength('-1/2"',s),-.5);assert.equal(core.parseLength('1 1/2ft',s),18);for(const token of ['1/0"',"5'6'",'12"oops',"5'\"",'2+2','100ftoops','-1/-2','1e309','12""'])assert.throws(()=>core.parseLength(token,s));
});

test('angle context separates degree/DMS/radian and arcminute/arcsecond tokens from length markers',()=>{
  const s={angularInputUnit:'radians'};assert.equal(core.parseAngle('90d',s),90);assert.equal(core.parseAngle('90°',s),90);assert.equal(core.parseAngle('5400\u2032',s),90);assert.equal(core.parseAngle('324000″',s),90);assert.equal(core.parseAngle(String(Math.PI/2),s),90);assert.equal(core.parseAngle(`${Math.PI/2}rad`,{angularInputUnit:'seconds'}),90);assert.equal(core.parseAngle('30min'),.5);assert.equal(core.parseAngle('30sec'),30/3600);assert.equal(core.parseAngle('-45d30\'15"'),-(45+.5+15/3600));assert.equal(core.parseLength("30'",{units:'in'}),360);for(const token of ['45d60\'0"','45d0\'60"','45.5d1\'','1radjunk','1/2d',"45d0'1'",'Infinity'])assert.throws(()=>core.parseAngle(token));
});

test('coordinate formats preserve exact absolute, relative and polar unit conversions in XY/XYZ',()=>{
  point(core.parseCoordinate("#100',12\"",undefined,{units:'in'}),[1200,12]);point(core.parseCoordinate("@5'6 1/2\",-1'",{x:10,y:20},{units:'in'}),[76.5,8]);point(core.parseCoordinate('@10ft<5400\'',undefined,{units:'in',angularInputUnit:'radians'}),[0,120]);xyz(core.parseCoordinate3D('@1ft,2ft,-3ft',{x:1,y:2,z:3},{units:'in'}),[13,26,-33]);assert.throws(()=>core.parseCoordinate("0,0,1'",undefined,{units:'in'}),/XY/);assert.throws(()=>core.parseCoordinate3D('@1ft<90d',undefined,{units:'in'}),/polar/);
});

test('direct LINE/PLINE distance uses explicit pointer direction, last segment direction or initial +X',()=>{
  const e=core.createEditor({settings:core.UNIT_PRESETS.architectural});accepted(e,['LINE']);assert.equal(e.execute("100'").ok,false);accepted(e,['0,0',"100'",'']);point(e.state.entities[0].end,[1200,0]);accepted(e,['PLINE','0,0']);assert.equal(e.execute('12"',{direction:{x:0,y:2}}).ok,true);accepted(e,['6"','']);assert.deepEqual(e.state.entities[1].points,[{x:0,y:0},{x:0,y:12},{x:0,y:18}]);accepted(e,['LINE','0,0']);const before=e.serialize();assert.equal(e.execute('1ft',{direction:{x:0,y:0}}).ok,false);assert.equal(e.serialize(),before);assert.equal(e.execute('1ft',{direction:{x:1,y:1}}).ok,true);point(e.state.entities.at(-1).end,[12/Math.sqrt(2),12/Math.sqrt(2)]);
});

test('all physical scalar commands accept length literals while counts, scales and angles keep separate grammars',()=>{
  const e=core.createEditor({settings:core.UNIT_PRESETS.engineering});accepted(e,['CIRCLE','0,0','12"','RECTANG','0,0','10ft,5ft','ELLIPSE','C','0,0','10ft,0','2ft','BOX','0,0,0','1ft,2ft,0','3ft','CYLINDER','100,0,0','6"','-1ft','SPHERE','200,0,0','1ft']);assert.equal(e.state.entities[0].radius,12);assert.equal(e.state.entities[2].ratio,.2);assert.equal(Math.max(...e.state.entities[3].vertices.map(p=>p.z)),36);assert.equal(Math.min(...e.state.entities[4].vertices.map(p=>p.z)),-12);
  accepted(e,['OFFSET','6"','e1','20,0','']);assert.equal(e.state.entities.at(-1).radius,18);e.select(['e1']);accepted(e,['SCALE','0,0']);assert.equal(e.execute('2ft').ok,false);accepted(e,['2']);assert.equal(e.state.entities[0].radius,24);accepted(e,['ARRAYRECT','LAST','']);assert.equal(e.execute('2ft').ok,false);accepted(e,['2','2','1ft','2ft']);
});

test('selected angular input units apply to ROTATE, ROTATE3D, TEXT, INSERT and HATCH; numeric APIs remain degrees',()=>{
  const e=core.createEditor({settings:{units:'in',angularInputUnit:'radians'}});accepted(e,['LINE','0,0','10,0','','ROTATE','LAST','','0,0',String(Math.PI/2)]);point(e.state.entities[0].end,[0,10]);accepted(e,['TEXT','0,0','1"','90d','Note','HATCH','PARALLEL','90d','1"']);assert.equal(e.state.commandData.angle,90);accepted(e,['ESC','BOX','0,0,0','2,3,0','4','ROTATE3D','LAST','','Z','0,0,0',`${Math.PI/2}rad`]);assert.equal(e.state.entities.at(-1).vertices[1].x,0);assert.equal(e.state.entities.at(-1).vertices[1].y,2);e.setWorkspace('2d');accepted(e,['LINE','20,0','30,0','','BLOCK','Part','20,0','LAST','','INSERT','Part','50,0','1','90d']);assert.equal(e.state.entities.at(-1).rotation,90);const rotated=core.rotateEntity({type:'LINE',start:{x:0,y:0},end:{x:10,y:0},layer:'0'},{x:0,y:0},90);point(rotated.end,[0,10]);
});

test('malformed length/angle input leaves active command bases and accepted geometry intact for recovery',()=>{
  const e=core.createEditor({settings:core.UNIT_PRESETS.surveyor});accepted(e,['CIRCLE','0,0']);const before=e.serialize(),points=structuredClone(e.state.commandPoints);assert.equal(e.execute('1/0"').ok,false);assert.equal(e.serialize(),before);assert.deepEqual(e.state.commandPoints,points);accepted(e,['12"','ROTATE','LAST','','0,0']);const base=structuredClone(e.state.commandPoints),geometry=e.serialize();assert.equal(e.execute('45d61\'').ok,false);assert.equal(e.serialize(),geometry);assert.deepEqual(e.state.commandPoints,base);assert.equal(e.state.commandPhase,'angle');accepted(e,['90d']);
});

test('architectural and engineering formatting carry rounded inches into feet and preserve whole-compound signs',()=>{
  const a=core.UNIT_PRESETS.architectural,g=core.UNIT_PRESETS.engineering;assert.equal(core.formatLength(66.5,a),"5'-6 1/2\"");assert.equal(core.formatLength(-66.5,a),"-5'-6 1/2\"");assert.equal(core.formatLength(11.999,a),"1'-0\"");assert.equal(core.formatLength(-.001,a),"0'-0\"");assert.equal(core.formatLength(11.99996,g),"1'-0.000\"");assert.equal(core.formatLength(12,g,{precision:2}),"1'-0.00\"");assert.equal(core.formatLength(.3048,{...a,units:'m'}),"1'-0\"");assert.equal(core.formatArea(144,{...a,precision:2}),'1.00 ft²');assert.equal(core.formatArea(2,{units:'m',precision:2}),'2.00 m²');
});

test('angle display formats round/carry with bounded precision and independently selected input defaults',()=>{
  assert.equal(core.formatAngle(45.5,{angularFormat:'dms',angularPrecision:0}),"45°30'0\"");assert.equal(core.formatAngle(1-.0002/3600,{angularFormat:'dms',angularPrecision:2}),"1°0'0.00\"");assert.equal(core.formatAngle(-.5,{angularFormat:'dms',angularPrecision:0}),"-0°30'0\"");assert.equal(core.formatAngle(90,{angularFormat:'radians',angularPrecision:4}),'1.5708 rad');assert.equal(core.formatAngle(90,{angularFormat:'decimal-minutes',angularPrecision:1}),"5400.0'");assert.equal(core.formatAngle(90,{angularFormat:'decimal-seconds',angularPrecision:0}),'324000"');for(const angularFormat of ['decimal-degrees','dms','radians','decimal-minutes','decimal-seconds']){const settings={angularFormat,angularInputUnit:'radians',angularPrecision:6},degreePerUnit={'decimal-degrees':1,dms:1/3600,radians:180/Math.PI,'decimal-minutes':1/60,'decimal-seconds':1/3600}[angularFormat];assert.ok(Math.abs(core.parseAngle(core.formatAngle(45.5,settings),settings)-45.5)<=.5e-6*degreePerUnit+1e-12);}
});

test('units preferences are one atomic Undo operation, survive JSON and do not rescale old geometry',()=>{
  const e=core.createEditor();accepted(e,['LINE','0,0','1200,0','']);const before=geometry(e),old=structuredClone(e.state.settings);assert.equal(e.updateDrawingSettings(core.UNIT_PRESETS.architectural).ok,true);assert.deepEqual(e.state.entities,before);accepted(e,['U']);assert.deepEqual(e.state.settings,old);assert.deepEqual(e.state.entities,before);accepted(e,['REDO']);const reopened=core.createEditor(JSON.parse(e.serialize()));assert.deepEqual(reopened.state.settings,e.state.settings);assert.deepEqual(reopened.state.entities,before);const saved=e.serialize(),revision=e.state.revision;for(const patch of [{linearFormat:null},{fractionPrecision:9},{angularInputUnit:'feet'},{angularFormat:'compass'},{angularPrecision:'2'}]){assert.equal(e.updateDrawingSettings(patch).ok,false);assert.equal(e.serialize(),saved);assert.equal(e.state.revision,revision);}
});

test('length and angular dimensions use shared format with independent style precision and unchanged measurement',()=>{
  const e=core.createEditor({settings:core.UNIT_PRESETS.architectural});accepted(e,['DIMLINEAR','0,0','100ft,0','50ft,-1ft']);assert.equal(core.formatDimension(e.state.entities[0],e.state).measurement,1200);assert.equal(core.formatDimension(e.state.entities[0],e.state).label,"100'-0\"");assert.equal(e.updateDrawingSettings(core.UNIT_PRESETS.surveyor).ok,true);accepted(e,['DIMANGULAR','0,0','10,0','0,10','5,5']);assert.equal(core.formatDimension(e.state.entities[1],e.state).label,"90°0'0.00\"");assert.equal(e.updateDimensionStyle('Standard',{angularPrecision:0,fractionPrecision:6}).ok,true);assert.equal(core.formatDimension(e.state.entities[1],e.state).label,"90°0'0\"");assert.equal(core.formatDimension(e.state.entities[0],e.state).measurement,1200);const before=e.serialize();assert.equal(e.updateDimensionStyle('Standard',{angularPrecision:null}).ok,false);assert.equal(e.serialize(),before);
});

test('ID, DIST and AREA messages use drawing formats while retaining unrounded query values',()=>{
  const e=core.createEditor({settings:core.UNIT_PRESETS.architectural});accepted(e,['ID','1ft,6 1/2"']);assert.match(e.state.message,/X=1'-0"/);assert.equal(e.state.lastMeasurement.point.y,6.5);accepted(e,['DIST','0,0','1ft,0']);assert.match(e.state.message,/Distance=1'-0"/);assert.equal(e.state.lastMeasurement.distance,12);accepted(e,['AREA','0,0','1ft,0','1ft,1ft','0,1ft','']);assert.match(e.state.message,/ft²/);assert.equal(e.state.lastMeasurement.area,144);
});

test('DXF requested presets write precise linear/angular metadata and real canonical model coordinates',()=>{
  for(const [name,lunits] of [['architectural',4],['engineering',3],['surveyor',3]]){const e=core.createEditor({settings:core.UNIT_PRESETS[name]});accepted(e,['LINE','0,0','100ft,0','']);const dxf=e.exportDXF().replace(/\r\n/g,'\n');assert.ok(dxf.includes(`9\n$LUNITS\n70\n${lunits}\n`));assert.ok(dxf.includes('11\n1200\n'));if(name==='surveyor'){assert.ok(dxf.includes('9\n$AUNITS\n70\n1\n'));assert.ok(dxf.includes('9\n$AUPREC\n70\n4\n'));}}
  const e=core.createEditor();accepted(e,['DIMANGULAR','0,0','10,0','0,10','5,5']);const dxf=e.exportDXF();assert.equal(dxf.includes('$AUNITS'),false);assert.equal(dxf.includes('275\n'),false);
});

test('custom non-inch imperial DXF keeps geometry units, converts dimensions physically and accumulates angular fallback warnings',()=>{
  const e=core.createEditor({settings:{units:'m',linearFormat:'architectural',fractionPrecision:4,angularFormat:'decimal-minutes'}});accepted(e,['DIMLINEAR','0,0','100ft,0','50ft,-1ft','DIMANGULAR','0,0','10,0','0,10','5,5']);const dxf=e.exportDXF().replace(/\r\n/g,'\n');assert.ok(dxf.includes('9\n$INSUNITS\n70\n6\n'));assert.ok(dxf.includes('9\n$LUNITS\n70\n2\n'));assert.ok(dxf.includes('144\n39.37007874015748\n'));assert.ok(dxf.includes('277\n4\n'));assert.ok(dxf.includes('271\n4\n'));assert.equal(core.formatDimension(e.state.entities[0],e.state).label,"100'-0\"");assert.equal(core.formatDimension(e.state.entities[1],e.state).label,"5400.00'");const warnings=e.getExportWarnings().join(' ');assert.match(warnings,/decimal model units/);assert.match(warnings,/arcminute\/arcsecond/);assert.ok(dxf.includes('1\n5400.00\'\n'));
});

test('DMS style precision beyond native range warns and exports its complete explicit label without losing definitions',()=>{
  const e=core.createEditor({settings:core.UNIT_PRESETS.surveyor});assert.equal(e.updateDimensionStyle('Standard',{angularPrecision:8}).ok,true);accepted(e,['DIMANGULAR','0,0','10,0','0,10','5,5']);assert.equal(core.formatDimension(e.state.entities[0],e.state).label,'90°0\'0.00000000"');assert.match(e.getExportWarnings().join(' '),/four decimal places/);const rows=e.exportDXF().replace(/\r\n/g,'\n');assert.ok(rows.includes('179\n8\n'));assert.ok(rows.includes('1\n90°0\'0.00000000"\n'));assert.equal(e.state.entities[0].textOverride,undefined);const restored=core.createEditor(JSON.parse(e.serialize()));assert.equal(restored.state.dimStyles[0].angularPrecision,8);assert.equal(core.formatDimension(restored.state.entities[0],restored.state).measurement,90);
});

test('native whole-second DMS precision4 maps independently from Linecraft second-decimal counts and preserves overflow labels',()=>{
  // Actual native angtos(mode1, precision4) and Autodesk String Conversions
  // both establish whole seconds at native4, rather than native2.
  for(let p=0;p<=8;p++){
    const mapping=core.dxfUnitFormat({angularFormat:'dms',angularPrecision:p});
    assert.equal(mapping.auprec,Math.min(8,p+4));
    assert.equal(mapping.warnings.some(w=>/four decimal places/.test(w)),p>4);
  }
  for(const p of [0,4,5]){
    const e=core.createEditor({settings:{...core.UNIT_PRESETS.surveyor,angularPrecision:p}});
    assert.equal(e.updateDimensionStyle('Standard',{angularPrecision:p}).ok,true);
    accepted(e,['DIMANGULAR','0,0','10,0','0,10','5,5']);
    const saved=e.serialize(),label=core.formatDimension(e.state.entities[0],e.state).label,dxf=e.exportDXF().replace(/\r\n/g,'\n');
    assert.ok(dxf.includes(`9\n$AUPREC\n70\n${Math.min(8,p+4)}\n`));
    assert.ok(dxf.includes(`179\n${Math.min(8,p+4)}\n`));
    const angular=dxf.slice(dxf.indexOf('0\nDIMENSION\n')); // exclude picture TEXT group1
    assert.equal(angular.includes(`1\n${label}\n`),p>4);
    assert.equal(e.getExportWarnings().some(w=>/four decimal places/.test(w)),p>4);
    assert.equal(e.serialize(),saved,'Export must preserve canonical definitions and selected precision');
  }
});

test('dimension clipboard keeps canonical values and style precision without adopting another drawing unit assignment',()=>{
  const source=core.createEditor({settings:core.UNIT_PRESETS.surveyor});assert.equal(source.updateDimensionStyle('Standard',{angularPrecision:1,fractionPrecision:5}).ok,true);accepted(source,['DIMANGULAR','0,0','10,0','0,10','5,5']);source.select([source.state.entities[0].id]);assert.equal(source.copySelection({x:0,y:0}).ok,true);const clipboard=source.getClipboard();assert.equal(clipboard.settings,undefined);const target=core.createEditor({settings:{units:'m'}});assert.equal(target.updateDimensionStyle('Standard',{angularPrecision:1,fractionPrecision:5}).ok,true);assert.equal(target.setClipboard(clipboard).ok,true);accepted(target,['PASTECLIP','0,0']);assert.equal(target.state.settings.units,'m');assert.equal(target.state.settings.angularFormat,'decimal-degrees');assert.equal(core.formatDimension(target.state.entities[0],target.state).measurement,90);assert.equal(core.formatDimension(target.state.entities[0],target.state).label,'90.0°');
});

test('unit conversions avoid spurious intermediate overflow while rejecting truly unrepresentable results',()=>{
  assert.equal(core.parseLength('1e308m',{units:'m'}),1e308);assert.equal(core.parseLength('1e308mm',{units:'m'}),1e305);assert.ok(Number.isFinite(core.parseLength('1e308ft',{units:'m'})));assert.throws(()=>core.parseLength('1e308m',{units:'in'}),/finite numeric range/);assert.notEqual(core.formatAngle(1e308,{angularFormat:'radians'}),'out of range');assert.equal(core.formatAngle(1e308,{angularFormat:'decimal-minutes'}),'out of range');assert.equal(core.formatAngle(1e308,{angularFormat:'decimal-seconds'}),'out of range');
});

// Paper/UCS engine checks are independent definitions and command/history
// invariants. Native interface observations are recorded separately.
const paperFixture=()=>{const e=core.createEditor({settings:{units:'in'}});line(e,'0,0','1200,0');const result=e.addLayout('Sheet',{size:'A3',orientation:'landscape'});assert.equal(result.ok,true);const view=e.addViewport(result.layoutId,{x:10,y:10,width:200,height:120},{scaleDenominator:100,modelCenter:{x:600,y:0}});assert.equal(view.ok,true);return{e,layoutId:result.layoutId,viewportId:view.viewportId};};
test('legacy models gain safe paper/visibility/UCS defaults without moving any accepted geometry',()=>{
  const source={entities:fixtureEntities()},e=core.createEditor(source);assert.deepEqual(coordinates(e.getModelEntities()),coordinates(source.entities));assert.deepEqual(e.state.layouts,[]);assert.equal(e.state.activeSpace,'model');assert.equal(e.state.activeLayoutId,null);assert.equal(e.state.layers[0].linetype,'continuous');assert.equal(e.state.layers[0].modelVisible,true);assert.equal(e.state.layers[0].paperVisible,true);assert.deepEqual(e.state.ucs,core.presetUCS());
});
test('named A0-A5 and Letter/Tabloid paper dimensions are exact for both orientations',()=>{
  for(const[size,paper]of Object.entries(core.PAPER_SIZES))for(const orientation of ['portrait','landscape']){const e=core.createEditor(),r=e.addLayout('Drawing',{size,orientation});assert.equal(r.ok,true);const actual=e.state.layouts[0].paper;assert.equal(actual.widthMm,orientation==='portrait'?paper.widthMm:paper.heightMm);assert.equal(actual.heightMm,orientation==='portrait'?paper.heightMm:paper.widthMm);}
  const e=core.createEditor();assert.equal(e.addLayout('Model').ok,false);assert.equal(e.addLayout('Sheet').ok,true);const before=e.serialize();assert.equal(e.addLayout('sheet').ok,false);assert.equal(e.serialize(),before);
});
test('LAYOUT New/Rename/Delete command flows each create one real Undo entry',()=>{
  const e=core.createEditor();accepted(e,['LAYOUT','NEW','Plan']);assert.equal(e.state.layouts.length,1);accepted(e,['U']);assert.equal(e.state.layouts.length,0);accepted(e,['REDO','LAYOUT','RENAME','Plan','Plan A']);assert.equal(e.state.layouts[0].name,'Plan A');accepted(e,['U']);assert.equal(e.state.layouts[0].name,'Plan');accepted(e,['LAYOUT','DELETE','Plan']);assert.equal(e.state.layouts.length,0);accepted(e,['U']);assert.equal(e.state.layouts[0].name,'Plan');
});
test('PSPACE/MVIEW/MSPACE create and activate a real scaled viewport with recoverable invalid corners',()=>{
  const e=core.createEditor();accepted(e,['PSPACE']);assert.equal(e.state.activeSpace,'paper');assert.equal(e.state.layouts.length,1);accepted(e,['MVIEW','10,10']);const before=e.serialize();assert.equal(e.execute('500,400').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'viewport-second');accepted(e,['210,130']);assert.equal(e.state.layouts[0].viewports.length,1);accepted(e,['MSPACE']);assert.equal(e.state.activeSpace,'model');assert.equal(e.state.activeViewportId,e.state.layouts[0].viewports[0].id);accepted(e,['PSPACE']);assert.equal(e.state.activeViewportId,null);accepted(e,['MODEL']);assert.equal(e.state.activeLayoutId,null);
});
test('paper LINE scalar units use millimeters while model geometry and assigned inches remain unchanged',()=>{
  const{e,layoutId}=paperFixture(),model=structuredClone(e.getModelEntities());assert.equal(e.setSpace('paper',layoutId).ok,true);accepted(e,['LINE','0,0','12",0','']);assert.ok(Math.abs(e.getPaperEntities()[0].end.x-304.8)<1e-10);assert.deepEqual(e.getModelEntities(),model);assert.equal(e.state.settings.units,'in');assert.equal(e.getDrawingSettings().units,'mm');const saved=JSON.parse(e.serialize());assert.equal(saved.entities.length,1);assert.equal(saved.layouts[0].entities.length,1);assert.equal(saved.layouts[0].entities[0].layoutId,undefined);
});
test('selection, Last, All, Erase and Undo operate only in the active model or paper owner scope',()=>{
  const{e,layoutId}=paperFixture(),modelId=e.getModelEntities()[0].id;e.setSpace('paper',layoutId);accepted(e,['LINE','0,0','20,0','']);const paperId=e.getPaperEntities()[0].id;e.select([modelId]);assert.deepEqual(e.state.selectionIds,[]);accepted(e,['ERASE','ALL','']);assert.equal(e.getPaperEntities().length,0);assert.equal(e.getModelEntities().length,1);accepted(e,['U']);assert.equal(e.getPaperEntities()[0].id,paperId);e.setSpace('model',null);e.select([paperId]);assert.deepEqual(e.state.selectionIds,[]);accepted(e,['ERASE','L','']);assert.equal(e.getModelEntities().length,0);assert.equal(e.getPaperEntities(layoutId).length,1);
});
test('paper geometry Save/Open and import with reused prior IDs preserve owner scope exactly',()=>{
  const{e,layoutId}=paperFixture();e.setSpace('paper',layoutId);accepted(e,['REC','10,20','30,40']);const saved=e.serialize(),reopened=core.createEditor(JSON.parse(saved));assert.equal(reopened.getModelEntities().length,1);assert.equal(reopened.getPaperEntities().length,1);assert.equal(reopened.state.activeSpace,'paper');assert.deepEqual(JSON.parse(reopened.serialize()),JSON.parse(saved));const target=core.createEditor();line(target);assert.equal(target.importJSON(saved).ok,true);assert.equal(target.getModelEntities().length,1);assert.equal(target.getPaperEntities().length,1);
});
test('viewport physical 1:100 projection converts inch model values to sheet millimeters exactly',()=>{
  const{e}=paperFixture(),view=e.state.layouts[0].viewports[0],a=core.viewportModelToPaper({x:0,y:0},view,e.state.settings),b=core.viewportModelToPaper({x:1200,y:0},view,e.state.settings);assert.ok(Math.abs(b.x-a.x-304.8)<1e-10);assert.equal(a.y,b.y);const world=core.viewportPaperToModel(b,view,e.state.settings);assert.ok(Math.abs(world.x-1200)<1e-10);assert.equal(world.y,0);assert.equal(world.z,0);assert.throws(()=>core.modelUnitMillimeters({units:'constructor'}));
});
test('orthographic front/iso viewports project real XYZ while perspective snapshots reject atomically',()=>{
  const{e,layoutId,viewportId}=paperFixture();assert.equal(e.updateViewport(layoutId,viewportId,{workspace:'3d',camera3d:{yaw:-90,pitch:0,roll:0},modelCenter:{x:0,y:0,z:0}}).ok,true);const view=e.state.layouts[0].viewports[0],a=core.viewportModelToPaper({x:0,y:0,z:0},view,e.state.settings),b=core.viewportModelToPaper({x:0,y:0,z:100},view,e.state.settings);assert.equal(b.x,a.x);assert.ok(Math.abs(b.y-a.y-25.4)<1e-10);const before=e.serialize();assert.equal(e.updateViewport(layoutId,viewportId,{camera3d:{projection:'perspective'}}).ok,false);assert.equal(e.serialize(),before);
});
test('viewport lock blocks view navigation without blocking an explicit scale property or model editing',()=>{
  const{e,layoutId,viewportId}=paperFixture();assert.equal(e.updateViewport(layoutId,viewportId,{locked:true}).ok,true);const before=e.serialize();assert.equal(e.updateViewport(layoutId,viewportId,{scaleDenominator:20},{navigation:true}).ok,false);assert.equal(e.serialize(),before);assert.equal(e.updateViewport(layoutId,viewportId,{scaleDenominator:50}).ok,true);e.setSpace('model',layoutId,viewportId);accepted(e,['LINE','0,20','10,20','']);assert.equal(e.getModelEntities().length,2);const modelView=structuredClone(e.getActiveViewport());assert.equal(e.fitView().ok,true);assert.deepEqual(e.getActiveViewport(),modelView);assert.equal(e.state.activeSpace,'model');assert.deepEqual(e.state.paperViewport.center,{x:210,y:148.5});
});
test('viewport freeze is local to one viewport and layers retain independent model/paper visibility',()=>{
  const{e,layoutId,viewportId}=paperFixture(),source=e.getModelEntities()[0],second=e.addViewport(layoutId,{x:220,y:10,width:180,height:120});assert.equal(second.ok,true);assert.equal(e.freezeViewportLayer(layoutId,viewportId,'0',true).ok,true);assert.equal(core.isEntityVisible(source,e.state,{space:'paper',layoutId,viewportId}),false);assert.equal(core.isEntityVisible(source,e.state,{space:'paper',layoutId,viewportId:second.viewportId}),true);assert.equal(core.isEntityVisible(source,e.state,{space:'model',layoutId:null,viewportId:null}),true);e.updateLayer('0',{modelVisible:false,paperVisible:true});assert.equal(core.isEntityVisible(source,e.state,{space:'model',layoutId:null,viewportId:null}),false);assert.equal(core.isEntityVisible(source,e.state,{space:'paper',layoutId,viewportId:second.viewportId}),true);e.updateLayer('0',{visible:false});assert.equal(core.isEntityVisible(source,e.state,{space:'paper',layoutId,viewportId:second.viewportId}),false);
});
test('layer rename and deletion account for viewport borders, freeze references and paper-owned objects',()=>{
  const{e,layoutId,viewportId}=paperFixture();e.addLayer('Drawing',{linetype:'dashed'});e.updateViewport(layoutId,viewportId,{layer:'Drawing',frozenLayers:['Drawing']});const before=e.serialize();assert.equal(e.deleteLayer('Drawing').ok,false);assert.equal(e.serialize(),before);assert.equal(e.renameLayer('Drawing','Walls').ok,true);assert.equal(e.state.layouts[0].viewports[0].layer,'Walls');assert.deepEqual(e.state.layouts[0].viewports[0].frozenLayers,['Walls']);accepted(e,['U']);assert.equal(e.state.layouts[0].viewports[0].layer,'Drawing');
});
test('deleting an active layout removes only its paper geometry and Undo restores all owned definitions',()=>{
  const{e,layoutId}=paperFixture();e.setSpace('paper',layoutId);accepted(e,['LINE','0,0','10,0','']);const source=structuredClone(e.state.entities);assert.equal(e.deleteLayout(layoutId).ok,true);assert.equal(e.state.activeLayoutId,null);assert.equal(e.getModelEntities().length,1);accepted(e,['U']);assert.equal(e.state.layouts.length,1);assert.deepEqual(e.state.entities,source);e.setSpace('paper',layoutId);assert.equal(e.getPaperEntities().length,1);
});
test('paper clipboard is portable geometry without stale layout ownership and paste adopts destination scope',()=>{
  const{e,layoutId}=paperFixture();e.setSpace('paper',layoutId);accepted(e,['LINE','0,0','10,0','']);e.select([e.getPaperEntities()[0].id]);assert.equal(e.copySelection({x:0,y:0}).ok,true);const clip=e.getClipboard();assert.equal(clip.entities[0].layoutId,undefined);e.setSpace('model',null);accepted(e,['PASTECLIP','0,20']);assert.equal(e.getModelEntities().length,2);assert.equal(e.getPaperEntities(layoutId).length,1);assert.equal(e.getModelEntities().at(-1).layoutId,undefined);
});
test('malformed nested paper metadata and globally duplicate model/paper IDs reject without changing any history',()=>{
  const{e}=paperFixture(),saved=e.serialize();for(const mutate of [d=>d.layouts[0].paper.orientation=null,d=>d.layouts[0].viewports[0].scaleDenominator=0,d=>d.layouts[0].viewports[0].camera3d=null,d=>d.layouts[0].viewports[0].frozenLayers=['missing'],d=>d.layouts[0].entities=[{...d.entities[0]}],d=>d.layouts[0].viewports=null,d=>d.ucs.origin.z=null]){const data=JSON.parse(saved);mutate(data);assert.equal(e.importJSON(data).ok,false);assert.equal(e.serialize(),saved);}
});
test('UCS three-point command is orthonormal, rejects collinear recovery and groups one preference Undo',()=>{
  const e=core.createEditor();accepted(e,['UCS','3POINT','10,20,30','20,20,30']);const before=e.serialize();assert.equal(e.execute('30,20,30').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'ucs-y-axis');accepted(e,['10,20,40']);assert.equal(e.state.settings.constructionPlane,'custom');assert.deepEqual(e.state.ucs.xAxis,{x:1,y:0,z:0});assert.deepEqual(e.state.ucs.yAxis,{x:0,y:0,z:1});accepted(e,['U']);assert.equal(e.state.settings.constructionPlane,'XY');accepted(e,['REDO']);assert.equal(e.state.ucs.origin.z,30);
});
test('UCS XZ and YZ coordinate input creates exact WCS paths with local Undo and grouped global history',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','LINE','0,0','0,10','@10,0','U','@5,0','']);assert.deepEqual(e.state.entities[0].points,[{x:0,y:0,z:0},{x:0,y:0,z:10}]);assert.deepEqual(e.state.entities[1].points,[{x:0,y:0,z:10},{x:5,y:0,z:10}]);accepted(e,['U']);assert.equal(e.state.entities.length,0);accepted(e,['REDO','UCS','YZ','PLINE','0,0','10,0','10,20','C']);assert.equal(e.state.entities.at(-1).closed,true);assert.deepEqual(e.state.entities.at(-1).points,[{x:0,y:0,z:0},{x:0,y:10,z:0},{x:0,y:10,z:20}]);
});
test('oriented RECTANG preview matches its actual spatial path and closed extrusion follows its normal',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','REC','0,0']);const preview=e.previewCommand({x:10,y:0,z:20})[0];accepted(e,['10,20']);assert.deepEqual(preview.points,e.state.entities[0].points);const profile=structuredClone(e.state.entities[0]);accepted(e,['EXTRUDE','L','','5']);const mesh=e.state.entities[1];closedOrientedMesh(mesh);assert.deepEqual(e.state.entities[0],profile);assert.equal(Math.min(...mesh.vertices.map(p=>p.y)),-5);assert.equal(Math.max(...mesh.vertices.map(p=>p.z)),20);assert.ok(Math.abs(signedMeshVolume(mesh)-1000)<1e-8);accepted(e,['U']);assert.equal(e.state.entities.length,1);
});
test('oriented BOX/CYLINDER scalar preview and commit agree while wrong-plane base points recover',()=>{
  const e=core.createEditor();accepted(e,['UCS','YZ','BOX','0,0']);const before=e.serialize();assert.equal(e.execute('10,20,5').ok,false);assert.equal(e.serialize(),before);accepted(e,['10,20']);const preview=e.previewScalar(5)[0];accepted(e,['5']);assert.deepEqual(e.state.entities[0].vertices,preview.vertices);assert.ok(Math.abs(signedMeshVolume(e.state.entities[0])-1000)<1e-8);accepted(e,['CYLINDER','20,20','3']);const circle=e.previewScalar(4)[0];accepted(e,['4']);assert.deepEqual(e.state.entities[1].vertices,circle.vertices);closedOrientedMesh(e.state.entities[1]);assert.equal(Math.min(...circle.vertices.map(p=>p.x)),0);assert.equal(Math.max(...circle.vertices.map(p=>p.x)),4);
});
test('spatial path direct distance preserves actual WCS direction and current plane elevation',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ']);assert.equal(e.updateDraftingSettings({constructionElevation:3}).ok,true);accepted(e,['LINE','0,0']);assert.equal(e.execute('10',{direction:{x:0,y:0,z:1}}).ok,true);accepted(e,['5','']);assert.deepEqual(e.state.entities[0].points,[{x:0,y:-3,z:0},{x:0,y:-3,z:10}]);assert.deepEqual(e.state.entities[1].points,[{x:0,y:-3,z:10},{x:0,y:-3,z:15}]);
});
test('PLAN Current points normal to a saved custom UCS while PLAN World leaves geometry intact',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','BOX','0,0','10,20','5']);const geometry=structuredClone(e.state.entities);accepted(e,['PLAN','']);assert.equal(e.state.camera3d.yaw,-90);assert.equal(e.state.camera3d.pitch,0);assert.ok(Math.abs(e.state.camera3d.roll)<1e-9);accepted(e,['PLAN','W']);assert.equal(e.state.camera3d.mode,'top');assert.deepEqual(e.state.entities,geometry);
});
test('mesh face UCS alignment and multi-vertex edge edits preserve exact source data and one Undo entry',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0','10,20','30']);const source=structuredClone(e.state.entities[0]);assert.equal(e.setUCSFromFace(source.id,2).ok,true);assert.deepEqual(e.state.entities[0],source);const before=e.serialize();assert.equal(e.setUCSFromFace(source.id,999).ok,false);assert.equal(e.serialize(),before);assert.equal(e.moveMeshVertices(source.id,[0,1],{x:0,y:0,z:2}).ok,true);assert.equal(e.state.entities[0].vertices[0].z,2);assert.equal(e.state.entities[0].vertices[1].z,2);assert.equal(e.state.entities[0].vertices[2].z,0);accepted(e,['U']);assert.deepEqual(e.state.entities[0],source);
});
test('construction-plane schema rejects reflection/nonunit axes and changing the plane cannot corrupt an active primitive',()=>{
  const e=core.createEditor(),before=e.serialize();for(const ucs of [{...core.presetUCS(),zAxis:{x:0,y:0,z:-1}},{...core.presetUCS(),xAxis:{x:2,y:0,z:0}},{...core.presetUCS(),origin:{x:0,y:0,z:null}}]){assert.equal(e.setUCS(ucs).ok,false);assert.equal(e.serialize(),before);}accepted(e,['BOX','0,0']);const active=e.serialize();assert.equal(e.updateDraftingSettings({constructionPlane:'XZ'}).ok,false);assert.equal(e.serialize(),active);accepted(e,['ESC']);assert.equal(e.updateDraftingSettings({constructionPlane:'XZ'}).ok,true);
});
test('CIRCLE and ARC on XZ store true analytic spatial definitions with exact canonical grips and snaps',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','CIRCLE','10,20','5','ARC','0,0','5,5','10,0']);const circle=e.state.entities[0],arc=e.state.entities[1];assert.equal(circle.type,'CIRCLE3D');assert.equal(circle.radius,5);assert.deepEqual(circle.center,{x:10,y:0,z:20});assert.deepEqual(core.spatialCurvePoint(circle,.25),{x:10,y:0,z:25});assert.equal(arc.type,'ARC3D');assert.equal(arc.radius,5);assert.deepEqual(arc.center,{x:5,y:0,z:0});assert.equal(arc.sweepAngle,-180);assert.deepEqual(core.entityGripPoints(arc)[1],{x:5,y:0,z:5});assert.deepEqual(core.snapCandidates(circle).map(p=>p.type),['center','quadrant','quadrant','quadrant','quadrant']);assert.deepEqual(core.snapCandidates(arc).map(p=>p.type),['center','endpoint','midpoint','endpoint']);
});
test('spatial circle radius recovery, Diameter, exact scalar property and preview retain analytic bases',()=>{
  const e=core.createEditor();accepted(e,['UCS','YZ','CIRCLE','10,20']);const before=e.serialize();assert.equal(e.execute('-1').ok,false);assert.equal(e.serialize(),before);accepted(e,['D']);const preview=e.previewScalar(8)[0];accepted(e,['8']);const circle=e.state.entities[0];assert.equal(circle.radius,4);assert.deepEqual(circle.center,preview.center);assert.deepEqual(circle.xAxis,preview.xAxis);assert.equal(e.setCircleRadius(circle.id,.1).ok,true);assert.equal(circle.radius,.1);accepted(e,['U']);assert.equal(e.state.entities[0].radius,4);
});
test('spatial curve radius points and ARC third points reject off-plane data without losing recovery',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','CIRCLE','0,0']);const before=e.serialize();assert.equal(e.execute('5,0,1').ok,false);assert.equal(e.serialize(),before);accepted(e,['5,0','ARC','0,0','5,5']);const current=e.serialize();assert.equal(e.execute('10,0,2').ok,false);assert.equal(e.serialize(),current);accepted(e,['10,0']);assert.equal(e.state.entities.length,2);
});
test('spatial curve transforms and clipboard preserve the exact XYZ circle rather than tessellated proxies',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','CIRCLE','10,20','5']);const c=e.state.entities[0],rotated=core.rotateEntity3D(c,{x:0,y:0,z:0},'X',90);assert.deepEqual(rotated.center,{x:10,y:-20,z:0});assert.deepEqual(rotated.yAxis,{x:0,y:-1,z:0});assert.equal(rotated.radius,5);const scaled=core.scaleEntity(rotated,{x:0,y:0,z:0},2);assert.equal(scaled.radius,10);e.select([c.id]);assert.equal(e.copySelection({x:0,y:0,z:0}).ok,true);const target=core.createEditor();assert.equal(target.setClipboard(e.getClipboard()).ok,true);accepted(target,['PASTECLIP','0,0,10']);const pasted=target.state.entities[0];assert.equal(pasted.type,'CIRCLE3D');assert.deepEqual(pasted.center,{x:10,y:0,z:30});assert.deepEqual(pasted.xAxis,c.xAxis);assert.equal(core.createEditor(JSON.parse(target.serialize())).state.entities[0].radius,5);
});
test('spatial circle and arc grips match preview/commit and reject out-of-plane or collapsed curves atomically',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','CIRCLE','0,0','5','ARC','0,0','5,5','10,0']);const source=e.state.entities[0],preview=core.previewGrip(source,2,{x:0,y:0,z:7});assert.equal(e.moveGrip(source.id,2,{x:0,y:0,z:7}).ok,true);assert.equal(e.state.entities[0].radius,preview.radius);const before=e.serialize();assert.equal(e.moveGrip(source.id,1,{x:0,y:1,z:0}).ok,false);assert.equal(e.serialize(),before);const arc=e.state.entities[1];assert.equal(e.moveGrip(arc.id,3,{x:5,y:4,z:0}).ok,true);assert.equal(e.state.entities[1].center.y,4);assert.equal(e.state.entities[1].sweepAngle,arc.sweepAngle);
});
test('both World XY and spatial analytic circles extrude to closed 32-sided meshes without replacing source geometry',()=>{
  for(const plane of ['XY','XZ']){const e=core.createEditor();accepted(e,['UCS',plane,'CIRCLE','0,0','5']);const source=structuredClone(e.state.entities[0]);accepted(e,['EXTRUDE','L','','7']);const mesh=e.state.entities[1];closedOrientedMesh(mesh);assert.equal(mesh.vertices.length,66);assert.equal(mesh.faces.length,96);assert.deepEqual(e.state.entities[0],source);const expected=32/2*Math.sin(2*Math.PI/32)*25*7;assert.ok(Math.abs(signedMeshVolume(mesh)-expected)<1e-8);assert.ok(signedMeshVolume(mesh)/(Math.PI*25*7)>.99);accepted(e,['U']);assert.deepEqual(e.state.entities,[source]);}
});
test('spatial curve import rejects malformed orthonormal bases, null numeric fields and paper ownership atomically',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','CIRCLE','0,0','5']);const saved=e.serialize();for(const mutate of [d=>d.entities[0].radius=null,d=>d.entities[0].yAxis={x:1,y:0,z:0},d=>d.entities[0].center.z=null,d=>d.entities[0].xAxis.x=2]){const d=JSON.parse(saved);mutate(d);assert.equal(e.importJSON(d).ok,false);assert.equal(e.serialize(),saved);}const fixture=paperFixture();fixture.e.setSpace('paper',fixture.layoutId);assert.equal(fixture.e.setClipboard({format:'LinecraftClipboard/1',base:{x:0,y:0,z:0},entities:[{...e.state.entities[0],id:undefined}]}).ok,true);const before=fixture.e.serialize();assert.equal(fixture.e.execute('PASTECLIP').ok,true);assert.equal(fixture.e.execute('0,0,0').ok,false);assert.equal(fixture.e.serialize(),before);
});
test('paper DXF stores inactive-sheet geometry inside its owned block and retains all dimensions/scales/frozen pointers',()=>{
  const e=core.createEditor({settings:{units:'mm'}});line(e,'0,0','1000,0');const a=e.addLayout('A4',{size:'A4',orientation:'portrait'}),b=e.addLayout('A3',{size:'A3',orientation:'landscape'});e.addLayer('Hidden',{linetype:'hidden',plot:false});e.addViewport(a.layoutId,{x:10,y:10,width:190,height:250},{scaleDenominator:50,locked:true,frozenLayers:['Hidden']});e.addViewport(b.layoutId,{x:10,y:10,width:400,height:270},{scaleDenominator:100});e.setSpace('paper',b.layoutId);accepted(e,['TEXT','20,20','4','0','Paper text']);const dxf=e.exportDXF(),blockSection=dxf.slice(dxf.indexOf('2\r\nBLOCKS\r\n'),dxf.indexOf('2\r\nENTITIES\r\n')),entitiesSection=dxf.slice(dxf.indexOf('2\r\nENTITIES\r\n'),dxf.indexOf('2\r\nOBJECTS\r\n'));assert.ok(blockSection.includes('Paper text'));assert.equal(entitiesSection.includes('Paper text'),false);assert.ok(dxf.includes('44\r\n210\r\n45\r\n297\r\n'));assert.ok(dxf.includes('44\r\n420\r\n45\r\n297\r\n'));assert.ok(dxf.includes('45\r\n12500\r\n'));assert.ok(dxf.includes('90\r\n49152\r\n'));assert.ok(dxf.includes('331\r\n'));assert.ok(dxf.includes('6\r\nHIDDEN\r\n'));assert.ok(dxf.includes('290\r\n0\r\n'));assert.ok(blockSection.includes('410\r\nA3\r\n'));assert.ok(entitiesSection.includes('410\r\nA4\r\n'));
});
test('spatial curve DXF emits original analytic CIRCLE/ARC extrusion normals rather than fake3Dfaces',()=>{
  const e=core.createEditor();accepted(e,['UCS','XZ','CIRCLE','10,20','5','ARC','0,0','5,5','10,0']);const dxf=e.exportDXF(),entities=dxf.slice(dxf.indexOf('2\r\nENTITIES\r\n'),dxf.indexOf('2\r\nOBJECTS\r\n'));assert.ok(entities.includes('0\r\nCIRCLE\r\n'));assert.ok(entities.includes('0\r\nARC\r\n'));assert.ok(entities.includes('210\r\n0\r\n220\r\n-1\r\n230\r\n0\r\n'));assert.equal(entities.includes('3DFACE'),false);assert.equal(entities.includes('POLYLINE'),false);assert.ok(entities.includes('40\r\n5\r\n'));
});
test('model navigation is preserved separately from sheet viewport cameras through switches and Save/Open',()=>{
  const{e,layoutId,viewportId}=paperFixture();e.setWorkspace('3d');e.set3DView({yaw:123,pitch:22,target:{x:1,y:2,z:3}});const model=e.getModelView();e.updateViewport(layoutId,viewportId,{workspace:'3d',camera3d:{yaw:-90,pitch:0,roll:0},modelCenter:{x:10,y:20,z:30}});e.setSpace('model',layoutId,viewportId);assert.equal(e.state.camera3d.yaw,-90);assert.deepEqual(e.getModelView(),model);const saved=e.serialize(),reopened=core.createEditor(JSON.parse(saved));assert.equal(reopened.state.camera3d.yaw,-90);assert.deepEqual(reopened.getModelView(),model);reopened.setSpace('model',null);assert.deepEqual(reopened.state.camera3d,model.camera3d);assert.equal(reopened.state.workspace,'3d');e.setSpace('paper',layoutId);assert.equal(e.state.workspace,'2d');e.setSpace('model',null);assert.deepEqual(e.state.camera3d,model.camera3d);
});
test('UCS Face typed and exact picked-face API each align a real planar mesh face in one recoverable transaction',()=>{
  const e=core.createEditor();accepted(e,['BOX','0,0','10,20','30','UCS','FACE','e1']);const before=e.serialize();assert.equal(e.execute('999').ok,false);assert.equal(e.serialize(),before);assert.equal(e.state.commandPhase,'ucs-face-index');accepted(e,['2']);assert.equal(e.state.settings.constructionPlane,'custom');assert.deepEqual(e.state.ucs.origin,e.state.entities[0].vertices[e.state.entities[0].faces[2][0]]);accepted(e,['U']);assert.deepEqual(e.state.ucs,core.presetUCS());accepted(e,['UCS','F']);assert.equal(e.submitFace('e1',0).ok,true);assert.equal(e.state.command,null);assert.equal(e.state.settings.constructionPlane,'custom');accepted(e,['U']);assert.deepEqual(e.state.ucs,core.presetUCS());
});
test('paper dimension definition labels and exported native style stay decimal millimeters under model architectural inches',()=>{
  const{e,layoutId}=paperFixture();e.updateDrawingSettings(core.UNIT_PRESETS.architectural);e.setSpace('paper',layoutId);accepted(e,['DIMLINEAR','0,0','100,0','50,10']);const dim=e.getPaperEntities()[0];assert.equal(core.formatDimension(dim,e.state).label,'100.00');const rows=e.exportDXF().trimEnd().split(/\r?\n/),styles=[];let record=null;for(let i=0;i<rows.length;i+=2){const code=Number(rows[i]),value=rows[i+1];if(code===0){record=value==='DIMSTYLE'?{}:null;if(record)styles.push(record);}else if(record&&[2,144,277].includes(code))record[code]=value;}const modelStyle=styles.find(style=>style[2]==='Standard'),paperStyle=styles.find(style=>style[2].startsWith('LinecraftPaperDimension'));assert.equal(modelStyle[277],'4');assert.equal(paperStyle[277],'2');assert.equal(paperStyle[144],'1');assert.equal(dim.p2.x,100);assert.equal(e.state.settings.units,'in');assert.equal(e.state.dimStyles.length,1);
});
test('paper BLOCK definitions are owner-neutral while inserted children inherit sheet millimeter labels and scope',()=>{
  const{e,layoutId}=paperFixture();e.updateDrawingSettings(core.UNIT_PRESETS.architectural);e.setSpace('paper',layoutId);accepted(e,['DIMLINEAR','0,0','100,0','50,10']);const sourceId=e.getPaperEntities()[0].id;accepted(e,['BLOCK','PaperTitle','0,0',sourceId,'']);assert.equal(e.state.blocks[0].entities[0].layoutId,undefined);assert.equal(e.getPaperEntities()[0].type,'INSERT');const children=core.expandedInsertEntities(e.getPaperEntities()[0],e.state);assert.equal(children[0].layoutId,layoutId);assert.equal(core.formatDimension(children[0],e.state).label,'100.00');const reopened=core.createEditor(JSON.parse(e.serialize()));assert.equal(reopened.getPaperEntities()[0].type,'INSERT');assert.equal(reopened.state.blocks[0].entities[0].layoutId,undefined);accepted(e,['U']);assert.equal(e.getPaperEntities()[0].type,'DIMENSION');assert.equal(core.formatDimension(e.getPaperEntities()[0],e.state).label,'100.00');
});

const xyzArray=p=>[p.x,p.y,p.z??0];


test('conditional DXF UCS and elevation headers preserve WCS basis and independent local elevation without mutating geometry',()=>{
  const e=core.createEditor();accepted(e,['UCS','3POINT','100,200,300','200,200,300','100,200,400']);e.updateDraftingSettings({constructionElevation:12});accepted(e,['CIRCLE','50,50','10']);
  const saved=e.serialize(),rows=e.exportDXF().split(/\r?\n/),headers={};let name=null;
  for(let i=0;i<rows.length;i+=2){const code=Number(rows[i]),value=rows[i+1];if(code===0&&value==='ENDSEC')break;if(code===9){name=value;headers[name]=[];}else if(name)headers[name].push([code,value]);}
  assert.deepEqual(headers.$UCSORG,[[10,'100'],[20,'200'],[30,'300']]);assert.deepEqual(headers.$UCSXDIR,[[10,'1'],[20,'0'],[30,'0']]);assert.deepEqual(headers.$UCSYDIR,[[10,'0'],[20,'0'],[30,'1']]);assert.deepEqual(headers.$ELEVATION,[[40,'12']]);assert.equal(e.serialize(),saved);
  assert.deepEqual(e.state.entities[0].center,{x:150,y:188,z:350});
  const elevationOnly=core.createEditor();elevationOnly.updateDraftingSettings({constructionElevation:-2});const dxf=elevationOnly.exportDXF();assert.ok(dxf.includes('9\r\n$ELEVATION\r\n40\r\n-2\r\n'));assert.equal(dxf.includes('$UCSORG'),false);
});

