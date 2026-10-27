# Synthetic plan/detail output coverage

LC-QA-008 extends the existing ordered-sheet milestone with the preserved original
qualityFixture('detail') model. This is bounded synthetic source and existing
unpacked 1.36.1-beta.6 acceptance. There is no product runtime, schema, candidate
manifest or installer change, installation or release.

Both final hidden application runs passed 4 app checks, 50 independent PDF
measurements and 28 rejected reader controls each. Complete Open/Save As/New/Open,
temporary requested A,B output order and postplot live/saved preservation passed.
All input/saved native bytes match; all 50 measurement objects and four rendered
image pairs match across source/unpacked. PDF byte hashes differ and are retained
separately. Fresh two full pages and two detail clips were visually inspected.

## Frozen independent reference

The child adds two A3 landscape 420 by 297 mm sheets with stored B,A order,
requested A,B order, and locked viewports at 1:48 then 1:24. Both use paper frame
x40,y60,width340,height200 and model center120,150. The original model entities,
blocks, settings, layer color and annotation styles stay complete and unchanged.
Monochrome plotting emits black ink. The prior regular and mixed-paper fixtures,
readers and workflows remain unchanged.

Projection in PDF millimeters is x=210+(modelX-120)*25.4/d,
y=137-(modelY-150)*25.4/d. Independently frozen literals define the five wall
segments/opening, three dimension segments, INSERT segment, solid HATCH and two
filled arrow triangles. Literal native styles and semantic annotation regions are
checked separately from actual text ink height or typographic convention approval.

| Reference | 1:48 | 1:24 |
|---|---:|---:|
| 240-inch wall and dimension line, mm | 127 | 254 |
| 10-inch block segment, mm | 5.291666667 | 10.583333333 |
| 120-inch dashed centerline, mm | 63.5 | 127 |
| Solid 50-square-inch hatch, square mm | 14.000868056 | 56.003472222 |
| Physical dash on/off, mm | 4 / 2 | 4 / 2 |
| Rounded dash components | 11 | 22 |
| Physical dash width, mm | 0.7 | 0.7 |
| Other model strokes, mm | 0.25 | 0.25 |

The native note remains SYNTHETIC QA ORIGINAL, height6 inches, Standard Arial.
The linear dimension retains ORIGINAL <> and resolves to ORIGINAL 20'-0" for
240 inches. Its original textHeight2.5, arrowSize2.5, gap1, extensionOffset1 and
extensionOvershoot1.25 remain unchanged. Both actual PDFs paint the exact note,
formatted dimension and unique sheet marker in predeclared broad semantic cells.
Those checks do not establish exact glyph origins, ink heights or accepted
production drafting sizes. The small 1:48 dimension label follows the original
geometric definition; visual review is not approval of that convention.

## Actual output and reader validity

Actual PDF pages have MediaBox/CropBox 420.200664944 by 297.010660638 mm, origin0,
rotation0, within the predeclared 0.3 mm page tolerance. Measured south walls are
126.999117194 and 253.998223623 mm. Length tolerance remains0.02 mm, combined
endpoint distance0.04 mm and stroke tolerance0.005 mm. Fill area tolerance is
independently declared0.02 square mm. No tolerance was relaxed after observing
output.

Chromium expands each rounded dashed stroke into a composite black filled cubic
path. The first reader rejected this unsupported representation; that failed
receipt is preserved. Independent re-extraction verified the frozen 4-on/2-off
physical intervals before the reader was corrected. The final reader requires
16 ordinary segments, three polygon fills and exactly11/22 rounded components,
closed connected paths, literal component bounds, areas, 0.35 mm radius and sampled
cubic perimeter. It imports no product or fixture code.

Actual 432 dpi raster samples check37/59 fixed ink, gap and cap/interior points
per page, including walls, extensions, INSERT, hatch and arrows. These reject
clipped paths which can still appear in vector metadata. Vector/text opacity,
paint types, white background order, missing/extra pages, reordered sheets,
physical scales/widths, fill areas, capsule spacing/roundness and semantic text
have 28 copy-only rejection controls. Raw PDF/native bytes are never mutated by
those controls. Raster samples qualify only the declared points.

Initial authoring syntax/name failures and the first restricted-shell Electron
launch failure are preserved privately. Corrected checks passed before acceptance.
The first approved source app passed all four persistence/plot checks while its
old reader failed; re-auditing that preserved PDF passed after the representation
correction. Final source and unpacked receipts bind the final reviewed bytes.
No product fix was attempted.

## Commands and boundaries

Run node --test tests/plan-detail-reference.test.mjs for the four new references.
The combined new and preserved regular/mixed suites passed11/11. QA control tests
passed2/2; gate syntax and whitespace checks passed. Candidate pure selection adds
the four new tests and fingerprints all four new files. Default application
selection retains the original regular two-sheet stage.

For explicit local application acceptance, plan-detail-workflow.cjs accepts the
existing executable, source-entry-or-empty, unique ordinary-grip- prefix and
reviewed candidate-manifest arguments. It launches only hidden source or isolated
QA-unpacked executables, uses separate profiles and synthetic chooser replies,
forbids clipboard access and checks offline/normal-quit cleanup. Every final run
binds82 source inputs, four actual content files and four rendered images.

The existing full beta6 candidate gate remains40/40 with655 selected portable
checks under its original closure. The extended complete gates/build were not
rerun. Native beta6 headline/warning acceptance, installed/upgrade acceptance,
general text/font/rich-text/template/client fidelity, independent editable DWG
acceptance and production relay integration remain pending or unqualified.
Installed binaries/normal profile, client drawings, prior fixtures/results,
candidate/installer artifacts and native desktop input remain preserved.
Daily-use readiness is false. Next existing font/annotation child: independently
freeze rotated aligned-dimension and leader geometry before implementation.
