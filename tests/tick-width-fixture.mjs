// Independently authored synthetic geometry. Width policy is deliberately separate
// from the drawing until its model-space versus paper-space semantics are chosen.
export const TICK_WIDTH_REFERENCE = Object.freeze({
  modelWidthMm: 12,
  fixedPaperWidthMm: .24,
  dimensionLineweightMm: .1,
  alternatives: Object.freeze([
    Object.freeze({ denominator: 50, modelScaledWidthMm: .24, fixedWidthMm: .24 }),
    Object.freeze({ denominator: 100, modelScaledWidthMm: .12, fixedWidthMm: .24 })
  ])
});
export const LITERAL_DIMENSION_SEGMENTS = [
  [{ x: 0, y: 10 }, { x: 0, y: 230 }],
  [{ x: 1000, y: 10 }, { x: 1000, y: 230 }],
  [{ x: 0, y: 200 }, { x: 1000, y: 200 }]
];
export const LITERAL_TICK_SEGMENTS = [
  [{ x: -25, y: 175 }, { x: 25, y: 225 }],
  [{ x: 1025, y: 225 }, { x: 975, y: 175 }]
];
export const LITERAL_PAPER_TICKS = [
  [[{ x: 89.5, y: 79.5 }, { x: 90.5, y: 80.5 }], [{ x: 110.5, y: 80.5 }, { x: 109.5, y: 79.5 }]],
  [[{ x: 294.75, y: 79.75 }, { x: 295.25, y: 80.25 }], [{ x: 305.25, y: 80.25 }, { x: 304.75, y: 79.75 }]]
];
export function syntheticTickDrawing() {
  return {
    settings: { units: 'mm', gridEnabled: false, snapEnabled: false, snapModes: [] },
    layers: [{ name: '0', color: '#000000', visible: true, locked: false, lineweight: .1 }],
    dimStyles: [{ name: 'Synthetic tick', textStyle: 'Standard', textHeight: 40, arrowSize: 25, gap: 20,
      extensionOffset: 10, extensionOvershoot: 30, precision: 2, scale: 1, prefix: '', suffix: '', arrowType: 'architectural-tick' }],
    entities: [{ id: 'tick-dimension', type: 'DIMENSION', kind: 'linear', layer: '0', lineweight: .1,
      p1: { x: 0, y: 0 }, p2: { x: 1000, y: 0 }, placement: { x: 500, y: 200 }, axisAngle: 0,
      style: 'Synthetic tick', scale: 1, textOverride: 'QA <>' }],
    layouts: [{ id: 'tick-sheet', name: 'SYNTHETIC TICK WIDTH', paper: { size: 'Custom', widthMm: 420, heightMm: 297, orientation: 'landscape' }, entities: [],
      viewports: [
        { id: 'tick-view-50', frame: { x: 20, y: 30, width: 160, height: 100 }, modelCenter: { x: 500, y: 200, z: 0 }, scaleDenominator: 50, locked: true, plotBorder: false, workspace: '2d', layer: '0', frozenLayers: [] },
        { id: 'tick-view-100', frame: { x: 220, y: 30, width: 160, height: 100 }, modelCenter: { x: 500, y: 200, z: 0 }, scaleDenominator: 100, locked: true, plotBorder: false, workspace: '2d', layer: '0', frozenLayers: [] }
      ] }],
    activeSpace: 'paper', activeLayoutId: 'tick-sheet', activeViewportId: null
  };
}
