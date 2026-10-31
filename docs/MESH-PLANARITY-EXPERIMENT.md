# Synthetic planarity tolerance experiment

The requested tolerance comparison did not demonstrate a speed improvement in
the measured geometry helper. Looser display classification and flattening a
synthetic copy both suppressed more internal edges, while all 3,200 triangles
remained. No production tolerance, saved geometry or client drawing changed.

## Separate operations

The current `meshShadedTriangles` threshold is `1e-12` on the magnitude of the
cross product of unit normals. This is an angular criterion, not a distance in
millimeters. It decides which edges receive outlines and never moves vertices.
Private copies of the exact helper tested six thresholds, changing only that
comparison: `1e-12`, `1e-8`, `1e-6`, `1e-4`, `1e-3`, and `1e-2`.

A separate operation copied synthetic vertices to an explicitly known `z=0`
reference plane when `abs(z) <= tolerance`. Tested distances were 0, 0.0001,
0.001, 0.01, 0.1 and 1 mm. This was a controlled projection experiment, not an
automatic best-fit plane algorithm. Indices and face ordering were preserved.

## Independent geometric checks

Literal squares had sides of 10 and 1,000 mm and one lifted corner at heights
0, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1 and 5 mm. For side `L` and height `h`,
the independently calculated normal-cross magnitude is
`sqrt(2) * abs(h) / sqrt(L*L + 2*h*h)`. It determines whether the two triangle
outlines retain their shared diagonal without using production vector helpers
to calculate the expected result.

The run passed 429 counted control groups, some containing multiple assertions:
192 angular/unit cases, 96 distance-projection cases with separate millimeter
and inch checks, plus signed/reversed-winding, threshold-margin, intent,
boundary, invalid-input and grid controls. The threshold-margin cases are 1%
below and above each threshold; exact floating-point equality is not claimed.
Original input data was checked unchanged, including topology. Distinct vertex
indices remained distinct even at coincident positions.

The same 0.01 mm corner deviation crosses different angular thresholds on a
10 mm versus a 1,000 mm square. A fixed angle is therefore not a fixed allowable
vertex displacement. Millimeter-to-inch conversion preserved the tested
classification and distance rules.

Two geometrically identical fixtures labeled "noise" and "intentional shallow
crease" always received identical classifications. A 0.01 mm projection
tolerance flattened both. Geometry alone cannot tell those intentions apart.
On the grid with alternating +/-0.01 mm offsets, a 0.001 mm tolerance moved no
vertices; 0.01 mm moved all 1,681 vertices by 0.01 mm onto the selected plane.
Neither operation reduced the vertex or triangle count.

## Measured helper cost

One Node 24 process evaluated a fixed 40 by 40 grid: 3,200 triangles, 1,681
vertices, 25 mm spacing and alternating +/-0.01 mm height noise. Each case had
seven warmups and 21 timed observations, with the first case rotated each round.
Module loading, fixture creation and output validation were outside timed helper
calls; JIT compilation/optimization could still occur during them.
Copy/projection cost was measured separately. Quartiles use linear
interpolation at `(n-1)*q`; the raw 168 observations are preserved privately.
Warmup durations were not saved; one additional untimed result-inventory call
per case followed the measured rounds.

| Operation | Median ms | Middle 50% ms | Outline incidences |
| --- | ---: | ---: | ---: |
| Original helper, threshold 1e-12 | 9.029 | 8.965-9.364 | 3,360 |
| Threshold 1e-8 | 9.297 | 9.065-9.722 | 3,360 |
| Threshold 1e-6 | 9.611 | 9.008-10.385 | 3,360 |
| Threshold 1e-4 | 9.045 | 8.804-9.958 | 3,360 |
| Threshold 1e-3 | 9.310 | 8.852-10.030 | 3,360 |
| Threshold 1e-2 | 10.611 | 10.213-11.493 | 160 |
| Original helper on preflattened copy | 10.104 | 9.877-10.726 | 160 |
| Copy and project to known plane only | 0.104 | 0.098-0.111 | Not measured |

An incidence is one triangle's outline flag, not a unique edge or rendered
pixel. All helper cases still returned 3,200 triangles. The original helper
already suppresses some shared edges in this particular checkerboard fixture.
Outline incidences are not total paint work: beta15 still paints matching-color
internal edges, and this experiment did not run that renderer.
These results do not show that a tolerance increase makes the helper faster.
The source performs additional adjacency-side checks when more normals pass
the angular test, which is consistent with the observed result; this is not an
isolated causal timing experiment.

These are helper wall times in one process, including its allocation work.
JIT, garbage collection and operating-system scheduling were not controlled.
They are not application frame times, orbit responsiveness, FPS, GPU/VRAM
measurements, or a before/after rendering benchmark. No application or renderer
was launched, and the experimental variants were not adopted in production.

## Decision and visual confirmation

Keep production classification unchanged for now. A useful future cleanup
option should require a chosen surface/reference plane, an explicit distance
limit in the drawing's units, displacement preview, preserved originals and
the user's approval. Intended shallow creases, connected surfaces and model
alignment need that judgment; there is no supported universal tolerance here.

The separately completed beta15 surface-colored-edge change remains source
qualified, with actual repaired browser pixels still untested. The user offered
final visual approval and feedback. Prepare that bounded visual confirmation
with the preserved raster tolerances and additional corner/sliver observations;
do not reuse a consumed launch authorization. Geometry-changing cleanup needs
an agreed selection and tolerance before implementation on real drawings.


## Follow-up: full precision and teapot workload

The user subsequently chose comparison-tolerance experiments with full-precision
coordinates. The separate requested 1 mm projection pipeline was slower in three
processes. A five-threshold teapot comparison found no alternative meeting both
its fixed speed and surface criteria. See [the results, teapot preparation and
lighting assessment](TEAPOT-NUMERICAL-LIGHTING-REVIEW.md). No production setting
was changed; actual application rendering remains pending.
