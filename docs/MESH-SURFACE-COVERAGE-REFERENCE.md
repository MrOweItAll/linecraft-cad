# Pending flat-surface coverage reference

The beta14 source outline correction does not complete flat-surface acceptance.
The preserved application captures still contain a dark diagonal. A new
source-only reference reproduces a plausible fill-coverage mechanism without
launching the application or changing production code.

## Independent expectation and production trace

`tests/mesh-surface-coverage-reference.test.cjs` extracts the exact production
`drawModel` and `shadeInk` functions into a recorded Canvas host and uses the
actual surface helper. Literal fixtures are a white indexed quad and the same
four vertices stored as two coplanar triangles. The synthetic projection fixes
the square at `(220,140)` through `(420,340)` on a 640 by 480 canvas. Geometry is
checked unchanged. The independently declared opaque flat color is
`(121,121,121)` on background `(13,23,30)`, retaining RGB tolerance 8.

At unit pixel `(240,319)`, crossed through its center by `x+y=560`, independent
polygon clipping and area calculations give half coverage for each production
triangle. Applying the standard source-over equation twice gives
`0.75 * surface + 0.25 * background = (94,96.5,98.25)`.
The equation is documented in [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/#simplealphacompositing).
The original raster auditor's nearby probe `(240,320)` includes this pixel in
its checked patch; these are not conflicting probe definitions.

Read-only inspection of the two retained, identical flat PNGs found
`(94,96,98)` at all nine corresponding diagonal pixels per image. Each channel
differs from the model by at most 0.5. This is strong evidence consistent with
independently antialiased triangle fills leaving background contribution at
their shared edge. It is not an exact Chromium antialiasing/quantization model
or an isolated browser experiment proving the rendering cause.

## Actual checks and known failure

Run the pending reference explicitly:

```sh
node --test --test-reporter=tap tests/mesh-surface-coverage-reference.test.cjs
```

The frozen final result is **11 tests: 9 passed, 2 expected failures, exit 1**.
The two failures assert seam-free flat coverage for the actual quad and stored
triangle traces. They are real failing assertions, not skipped tests, expected
failure wrappers or passing application acceptance. The reference stays outside
the selected passing gate; no existing gate selection or fingerprint changes.

Controls independently check literal full/half/outside coverage, reverse winding,
off-diagonal coverage, opaque/transparent/half-opacity source-over arithmetic,
and a complete opaque square that passes the same uniform-color assertion.
Concave, crossing, star, duplicate-vertex and degenerate paths are rejected.
Changed compositing modes are rejected. The host checks source geometry, actual
fill opacity/color, and rejects strokes whose conservative bounds reach the
diagnostic pixel, including a closed stroke's final segment. Unsupported paths
or paint operations require an explicit oracle extension before qualification.
The acceptance assertion does not require a particular fill count.

The first retained run had 10 tests, 8 passes and the same 2 failures. Review
added shape-domain and closed-stroke guards; the intermediate and final runs
each had 11 tests, 9 passes and 2 failures. A private console encoding error
occurred after the first test logs and result were saved; it did not invalidate
that completed test run. Original bytes and failure logs remain preserved.

## Limits and next action

This is a focused analytic unit-pixel reference, not a rasterizer, browser
acceptance, general transparency/occlusion test, or performance measurement.
It does not cover compound paths, holes, curved strokes, other compositing
modes, DPI scales, camera positions, materials or client geometry. Existing
crease, outline, painter-order and wireframe checks remain historical evidence;
they were not rerun unchanged. No new application, raster, profile or GPU/VRAM
observation occurred. No production repair approach was used.

Next, compare bounded repair options against counterexamples for painter
interleaving/occlusion, disconnected or holed regions, opacity/material changes,
real boundaries and creases before spending the one remaining product repair
approach. Do not choose blanket overdraw, coordinate welding or a global
compositing change from this arithmetic result alone. Preserve roof-owned
rendering, wireframe, selection/picking and saved geometry. A repaired source
reference would still need separately authorized actual raster confirmation;
the previous one-shot application authorization is consumed.

Runtime remains `efb833fc2098a970162b59d47e4a3d4cd63de0b9`, version
`1.36.1-beta.14`. The prior 61-stage/1,611-check passing gate is retained, not
rerun or extended by this failing reference. Broader application/PDF/build,
native/installed/upgrade/daily-use qualification remains open.
