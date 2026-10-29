import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.mjs';
import * as paper from '../paper-space.mjs';

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const point = (actual, expected, tolerance = 1e-9) => {
  assert.deepEqual(Object.keys(actual).sort(), ['x', 'y']);
  for (const key of ['x', 'y']) assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance,
    `${key}: ${actual[key]} != ${expected[key]}`);
};

// Literal expectations use pixels, world units and a Y-up drawing independently
// of either implementation. Both public entry points must satisfy the contract.
for (const [name, api] of [['core', core], ['paper-space', paper]]) {
  test(`${name}: literal screen/world coordinates and nonmutation`, () => {
    const view = freeze({center: {x: 10, y: 20}, scale: 2});
    const world = freeze({x: 30, y: 45}), screen = freeze({x: 440, y: 250});
    assert.deepEqual(api.worldToScreen(world, view, 800, 600), screen);
    assert.deepEqual(api.screenToWorld(screen, view, 800, 600), world);
    assert.deepEqual(api.worldToScreen(view.center, view, 800, 600), {x: 400, y: 300});
  });

  test(`${name}: drag deltas move content right/down with fresh viewport objects`, () => {
    const view = freeze({center: {x: 10, y: 20}, scale: 2, ignored: 'metadata'});
    const moved = api.pan(view, 35, -23);
    assert.deepEqual(moved, {center: {x: -7.5, y: 8.5}, scale: 2});
    assert.notEqual(moved, view); assert.notEqual(moved.center, view.center);
    assert.deepEqual(api.worldToScreen({x: 17, y: -6}, moved, 800, 600), {x: 449, y: 329});
  });

  test(`${name}: off-center zoom retains the literal world anchor`, () => {
    const view = freeze({center: {x: -10, y: 30}, scale: 2});
    const cursor = freeze({x: 620, y: 130});
    const zoomed = api.zoomAt(view, 2.5, cursor, 800, 600);
    assert.deepEqual(zoomed, {center: {x: 56, y: 81}, scale: 5});
    assert.notEqual(zoomed, view); assert.notEqual(zoomed.center, view.center);
    assert.deepEqual(api.screenToWorld(cursor, zoomed, 800, 600), {x: 100, y: 115});
  });

  test(`${name}: scale limits preserve the off-center anchor`, () => {
    const view = freeze({center: {x: -10, y: 30}, scale: 2});
    const cursor = freeze({x: 620, y: 130});
    const upper = api.zoomAt(view, 1e9, cursor, 800, 600);
    const lower = api.zoomAt(view, 1e-12, cursor, 800, 600);
    assert.equal(upper.scale, 1e6); assert.equal(lower.scale, 1e-6);
    point(upper.center, {x: 99.99978, y: 114.99983});
    assert.deepEqual(lower.center, {x: -219999900, y: -169999885});
    point(api.screenToWorld(cursor, upper, 800, 600), {x: 100, y: 115});
    point(api.screenToWorld(cursor, lower, 800, 600), {x: 100, y: 115}, 1e-7);
  });

  test(`${name}: invalid zoom factors retain the exact diagnostic`, () => {
    const view = freeze({center: {x: 10, y: 20}, scale: 2});
    for (const factor of [0, -1, NaN, Infinity, -Infinity, '2', null, undefined]) {
      assert.throws(() => api.zoomAt(view, factor, {x: 400, y: 300}, 800, 600),
        {name: 'Error', message: 'Zoom factor must be positive and finite.'});
    }
  });

  test(`${name}: extraction preserves permissive conversion and pan semantics`, () => {
    // These helpers historically perform arithmetic without validating inputs.
    // Preserve that boundary; unrelated validation changes need their own review.
    assert.deepEqual(api.worldToScreen({x: 3, y: 4}, {center: {x: 1, y: 2}, scale: 0}, 0, 0), {x: 0, y: 0});
    const invalid = api.screenToWorld({x: 0, y: 0}, {center: {x: 1, y: 2}, scale: 0}, 0, 0);
    assert.ok(Number.isNaN(invalid.x) && Number.isNaN(invalid.y));
    assert.deepEqual(api.pan({center: {x: 10, y: 20}, scale: 2}, '4', '6'), {center: {x: 8, y: 23}, scale: 2});
  });
}

test('core retains the same public functions and signatures as paper-space', () => {
  for (const [name, arity] of [['worldToScreen', 4], ['screenToWorld', 4], ['zoomAt', 5], ['pan', 3]]) {
    assert.equal(typeof paper[name], 'function', name);
    assert.equal(core[name], paper[name], name);
    assert.equal(core[name].length, arity, name);
  }
});
