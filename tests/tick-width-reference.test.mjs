import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, annotationPrimitives, viewportModelToPaper } from '../core.mjs';
import { syntheticTickDrawing, TICK_WIDTH_REFERENCE, LITERAL_DIMENSION_SEGMENTS, LITERAL_TICK_SEGMENTS, LITERAL_PAPER_TICKS } from './tick-width-fixture.mjs';

test('tick fixture distinguishes two width policies without declaring a product default', () => {
  for (const expected of TICK_WIDTH_REFERENCE.alternatives) {
    assert.equal(TICK_WIDTH_REFERENCE.modelWidthMm / expected.denominator, expected.modelScaledWidthMm);
    assert.equal(TICK_WIDTH_REFERENCE.fixedPaperWidthMm, expected.fixedWidthMm);
  }
  assert.notEqual(TICK_WIDTH_REFERENCE.alternatives[1].modelScaledWidthMm, TICK_WIDTH_REFERENCE.alternatives[1].fixedWidthMm);
});

test('legacy architectural tick centerlines and ordinary dimension strokes match literal endpoints', () => {
  const editor = createEditor(syntheticTickDrawing()), document = JSON.parse(editor.serialize());
  const geometry = annotationPrimitives(document.entities[0], document);
  assert.deepEqual(geometry.segments, [...LITERAL_DIMENSION_SEGMENTS, ...LITERAL_TICK_SEGMENTS]);
  assert.deepEqual(geometry.arrows, []);
  assert.equal(geometry.measurement, 1000);
  for (const [a, b] of LITERAL_TICK_SEGMENTS) assert.equal(Math.hypot(b.x-a.x,b.y-a.y),50*Math.SQRT2);
  assert.equal(document.entities[0].lineweight, .1);
});

test('two saved viewport scales project ticks to independently specified sheet coordinates', () => {
  const document = JSON.parse(createEditor(syntheticTickDrawing()).serialize());
  for (const [index, viewport] of document.layouts[0].viewports.entries()) {
    const actual = LITERAL_TICK_SEGMENTS.map(segment => segment.map(point => {
      const projected = viewportModelToPaper(point, viewport, document.settings);
      assert.equal(projected.depth, 0);
      return { x: projected.x, y: projected.y };
    }));
    assert.deepEqual(actual, LITERAL_PAPER_TICKS[index]);
    assert.equal(viewport.locked, true);
  }
});

test('legacy synthetic dimension drawing preserves its complete native state on reopen', () => {
  const canonical = JSON.parse(createEditor(syntheticTickDrawing()).serialize());
  assert.deepEqual(JSON.parse(createEditor(canonical).serialize()), canonical);
  assert.equal(Object.hasOwn(canonical.dimStyles.find(style => style.name === 'Synthetic tick'), 'tickLineweightMm'), false);
});
