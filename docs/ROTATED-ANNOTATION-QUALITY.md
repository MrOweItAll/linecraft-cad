# Rotated dimension and leader calibration

LC-QA-009 closes a bounded LC-FNT-LAYOUT annotation gap: a default aligned
dimension and a 45-degree leader projected through two independently locked
synthetic A3 viewports. Both first-attempt source and existing unpacked
1.36.1-beta.6 runs passed4 app checks,42 independent PDF measurements and28
rejected reader controls. Four new pure references and two QA control tests pass.
There is no product runtime, schema, manifest, installer or installed-app change.

Complete Open/Save As/New/Open, temporary A,B PDF order with stored B,A tabs and
postplot state preservation pass. The9,247-byte input and actual saved native
streams match exactly in both variants. All42 measurement objects and all four
rendered-image pairs match. PDF byte hashes differ and are retained separately.
Fresh two full-page and two enlarged annotation renders were visually inspected.

## Independent definitions before application output

The new calibration reuses default settings/styles and existing synthetic paper
geometry; all earlier fixtures and workflows remain byte-identical. Its model
contains only a240-inch ruler, aligned dimension and leader. These are explicit
calibration values, not Jon's production drafting conventions.

Dimension endpoints(40,120) and(100,200) give a60-80-100 triangle and100-inch
measurement, exactly8 feet4 inches. Placement(38,184) is40 inches along normal
(-0.8,0.6), producing dimension line(8,144) to(68,224). Extensions are
(39.2,120.6) to(7,144.75) and(99.2,200.6) to(67,224.75). The label is
ALIGNED 8'-4", centered nominally at(36,185.5), rotated53.130102354 degrees.
The independent PDF baseline direction is(0.6,-0.8).

The leader runs(160,130) to(180,150) to(215,150). Its note SYNTHETIC LEADER
lands at the final point, with horizontal PDF baseline(1,0). All three filled
arrow triangles are frozen independently using default arrowSize2.5 and half
base0.875 inches; each model area is2.1875 square inches. Native Standard Arial,
dimension textHeight2.5, gap1, extensionOffset1, extensionOvershoot1.25, scale1
and leader height6 remain explicit. No actual glyph ink-height or font-metric
parity claim is made. Small plotted labels follow geometric scaling and do not
establish accepted production drafting sizes.

Both sheets are A3 landscape420 by297mm. Viewport paper frame is
x40,y60,width340,height200, model center120,150. Stored sheets are B,A; the
requested PDF is A at1:48, then B at1:96. Independent projection is
PDFx=210+(modelX-120)*25.4/d, PDFy=137-(modelY-150)*25.4/d.

| Physical reference | 1:48 | 1:96 |
|---|---:|---:|
| 240-inch ruler, mm | 127 | 63.5 |
| 100-inch aligned dimension, mm | 52.916666667 | 26.458333333 |
| Leader diagonal, mm | 14.967093646 | 7.483546823 |
| 35-inch landing, mm | 18.520833333 | 9.260416667 |
| Each filled arrow, square mm | 0.612537977 | 0.153134494 |
| Ordinary stroke width, mm | 0.25 | 0.25 |

## Actual evidence and reader controls

Measured ruler lengths are126.999117194 and63.499558597mm. Aligned dimension
lengths are52.916296319 and26.458148159mm. The dimension trace directions are
approximately(0.600000024,-0.800000012) and(0.600000024,-0.799999952); leader
and sheet-marker traces are(1,0). Exact semantic text, one opaque visible trace
per label, requested face, broad declared cells and baseline directions pass.
This does not establish exact glyph origins, cap heights or typography standards.

The independent reader imports no product/fixture code. It requires13 ordinary
segments, three filled triangle polygons and exactly three semantic text lines
per page, with no images or unexpected filled geometry. Raw MediaBox/CropBox
are420.200664944 by297.010660638mm, origin0, rotation0. Tolerances remain
0.3mm page,0.02mm length,0.04mm combined endpoint distance,0.005mm stroke and
0.02 square mm arrow area. Text-direction components allow0.0001. All were
frozen before actual output; none was relaxed after observing results.

Fourteen actual raster sites per page use small2mm patches at1728dpi. They
include each model segment midpoint, each filled arrow interior away from its
ordinary line stroke and five clear points. Off-stroke arrow sites use local
u*2.2+v*0.65 inches, chosen before output to resolve the narrow1:96 margin.
These checks distinguish actual filled paint from an overlaid line or metadata
which survives clipping. All six arrow-interior samples per variant are black.
Raster qualification remains limited to the declared sites.

The28 copy-only controls reject missing/extra/swapped/duplicate pages, bad boxes
or rotation, raster surrogates, missing/shifted/scaled/wrong-width/dashed or
nonopaque strokes, missing/transparent/misplaced/wrong-area arrows, wrong semantic
text or baseline directions, invisible/transparent text, late white overpaint,
hidden geometry/arrow interiors and unexpected ink at clear sites. Original PDF,
native and historical receipt bytes are never modified by controls.

## Reproduction and limits

node --test tests/rotated-annotation-reference.test.mjs runs4 independent native,
primitive and plot-order references. The dedicated rotated-annotation-workflow.cjs
accepts the established executable, source-entry-or-empty, unique ordinary-grip-
prefix and reviewed candidate-manifest arguments. The reader requires explicit
rotated-annotation identity. Each actual run binds82 source fingerprints, four
content files and four fresh rendered images, uses an isolated hidden profile,
forbids clipboard access, verifies no observed network requests and checks
normal-quit descriptor removal.

Candidate pure selection includes the four new tests; all four files are bound
auxiliaries. Default application stages stay unchanged. The existing beta6
candidate40/40 gate with655 selected portable checks retains its original closure;
extended complete gates/build were not rerun. All current source/ASAR runtime59
and resource12 identity records remain unchanged. Installed binaries/profile,
client drawings, previous evidence and original fixtures remain protected.

Native beta6 headline/warning acceptance, installed/upgrade acceptance and broader
font/client/template/DWG fidelity remain pending or unqualified. Production relay
integration remains separate. Daily-use readiness is false. The remaining existing
rich-MTEXT formatting gap needs a narrow independently frozen supported reference
before another application-output milestone; no broad convention approval follows
from this calibration.
