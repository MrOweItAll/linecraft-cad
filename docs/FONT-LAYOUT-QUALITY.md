# Controlled font and layout coverage - October 26, 2026

LC-QA-004 adds actual hidden source and existing-unpacked application coverage for
registered regular Arial and Times New Roman on a synthetic A4 sheet. Both flows
passed four application checks, nine independent PDF measurements and seventeen
rejected reader controls. This is the first bounded LC-FNT-LAYOUT milestone;
broader glyph, architectural-font, annotation and template fidelity remain open.
No application runtime, file schema, font assets or candidate manifest changed.

## Coverage gap and reference

Previously selected ordered-sheet coverage used legacy Standard/Arial text. The
selected tests did not exercise registered metric styles, font inventory or
Times New Roman output. The application already implements a fixed six-family
font service, registered metric styles and a production PDF bridge. This change
tests those existing paths rather than adding a new font implementation.

The independently specified [fixture](../tests/font-layout-fixture.mjs) contains
no model entities or viewports. Its one `SYNTHETIC FONT SHEET` layout measures
297 by 210 mm. Three black, unrotated `HHHH` TEXT samples use height 5 mm:

| Style | Paper insertion point, mm | Width factor |
| --- | --- | --- |
| Registered Arial | 20,160 | 1 |
| Registered Times New Roman | 20,130 | 1 |
| Registered Arial | 20,100 | 0.75 |

A synthetic closed border has corners `(10,10)`, `(287,10)`, `(287,200)`,
`(10,200)`. A divider runs `(180,10)` to `(180,35)`; a 0.35 mm stroke ruler runs
`(20,60)` to `(120,60)`. These shapes are original test geometry, without any
client title block, DWT, proprietary asset or drawing-derived text.

## Application evidence

The [workflow](../tests/font-layout-workflow.cjs) retains the established hidden
startup guarantee, isolated profile, manifest/resource identities, authenticated
controller, owned chooser replies, clipboard denial and offline checks. Actual
Open and Save As/New/Open compare complete native state, including all styles
and layouts. The saved native bytes and live document remain unchanged by PDF
output. Both source and existing unpacked application quit normally and remove
their temporary controller descriptors. Their saved native bytes and full/detail
render pairs match exactly.

PDF output calls the exposed production desktop bridge from the real renderer,
using the current serialized document and a test-owned destination chooser.
This exercises main-process validation, fresh metric inventory, plot generation,
isolated Chromium rendering and atomic file output. It does not exercise the
plot-form UI or real native chooser/input behavior. Renderer local-face status
and main plot inventory agree on the required regular-face hashes; the PDF
auditor separately checks the faces and actual glyph origins emitted.

The local inventory reported all nine supported face records available: regular
Arial, Segoe UI, Consolas, ARCHITXT and Technic, plus four Times New Roman variants.
That is a dated environment observation. Only regular Arial and Times New Roman
are PDF-qualified for the limited samples above; other faces are inventory-only.
No font file was copied into the repository or test drawings.

The first sandboxed source launch failed before producing application acceptance
evidence. A supported approved launch of the same prepared test passed; the
unpacked test used that supported execution context. The initial failure remains
private. The diagnostic source log also contains a GPU-cache path-length warning
in its temporary profile. Rendering and required checks completed; no blanket
clean-browser-log or unrestricted-environment claim is made.

## Independent PDF reference

The [auditor](../tests/audit-font-layout-pdf.py) imports no Linecraft code. It reads
the fixed installed regular font files in place beneath the Windows system root,
binds their SHA-256 values to the actual plot inventory, reads OS/2 cap-height and
PostScript names independently from SFNT tables, and uses MuPDF for Unicode H
advances. Font assets and production metric tables are not copied into evidence.
Using repeated H avoids kerning-dependent expectations for this reference.

The expected adjacent-origin distance is
`H advance per em / (capHeight / unitsPerEm) * 5 mm * widthFactor`.
The independently established distances are 5.0408997955 mm for Arial,
5.4535398230 mm for Times and 3.7806748466 mm for condensed Arial. Actual
first-to-fourth origins measure 15.1224431144, 16.3582742267 and 11.3418330087 mm.
The 100 mm ruler measures 99.9983185874 mm with stroke 0.3499941137 mm. Source
and unpacked measurements match exactly.

Position tolerance is 0.04 mm; adjacent advances, first-to-fourth distances and
geometry lengths use 0.02 mm. Ruler stroke uses 0.005 mm and page dimensions
0.3 mm for Chromium paper rounding. These were frozen before actual application
output. Nominal font size and text bounding boxes do not establish actual ink
cap-height, particularly under horizontal scaling; that remains unqualified.

Nine measurements cover three text rows, the ruler, divider and four border
edges. Checks also require twelve correct H characters, the independently
identified regular PDF faces, opaque black fill/strokes, no raster surrogate,
unique geometry matches and safe background paint order. Seventeen mutated
observation controls reject missing/duplicate pages, incorrect dimensions,
missing/wrong glyphs or faces, shifted baselines, wrong advances/width factors,
invisible/transparent/gray text, raster substitution, missing/wrong ruler and
late white overpaint. Controls do not rewrite actual PDF bytes.

Fresh full-page and typography renders were inspected: all three rows and the
border/divider/ruler are visible, distinct and unclipped. Both unpacked render
hashes match those inspected source renders. This is separate from numerical
measurement and does not establish general visual parity.

## Selection and remaining work

The candidate application profile now selects this workflow for source and
unpacked checks and fingerprints all three new files. This milestone ran the
new targeted source/unpacked workflows and relevant gate-control checks; it did
not rebuild the unchanged candidate or rerun the full fast/application/candidate
gates. Existing beta4 full-gate receipts retain their historical scope. Required
fonts or the PDF environment being unavailable causes a nonzero required stage;
fallback is not accepted as a passing regular-face reference.

ARCHITXT/Technic glyph appearance, Times variants, MTEXT/rich text, dimensions,
leaders, rotations, other glyphs and fallback diagnostics need separate synthetic
milestones. There is no qualified DWT/template import path established here;
the word template above describes original paper geometry only. User conventions,
client/AutoCAD comparisons, installed/upgrade acceptance, native desktop input
and daily-use readiness remain unqualified. Installed app/profile, client drawings,
original fixtures, manifests and prior artifacts remain protected.

## Architectural-font follow-up - October 26, 2026

LC-QA-005 extends the same fixture/workflow/auditor with an explicit architectural
profile. Source and the exact existing unpacked beta4 each passed four application
checks, nine independent PDF measurements and seventeen rejected observation
controls. The new profile substitutes regular ARCHITXT, regular Technic and
0.75-width ARCHITXT into the original three `HHHH` positions. Complete native
styles/content, actual PDF Unicode H characters and selected faces are preserved.
No application runtime, schema, font installation or manifest changed.

The independent [architectural reference](../tests/architectural_font_reference.py)
resolves only the two fixed registered font names under supported installed-font
roots. It reads existing faces in place and binds their hashes to the actual main
plot inventory. Neither face supplies OS/2 sCapHeight: both use OS/2 version 0.
The independent SFNT reader therefore establishes the mapped H glyph's bounding
height and hmtx advance, then cross-checks the mapped glyph with MuPDF.

ARCHITXT maps Unicode H to glyph 43: 677 advance units, 1000 units/em and H bounds
y=-4..688, giving a 692-unit cap basis. Technic uses the verified Windows-symbol
alias U+F048 for glyph 42: 627 advance units and H bounds y=-9..678, giving a
687-unit basis. Asking MuPDF for unsupported ASCII H directly would silently use
a fallback advance; that is explicitly excluded from the reference. The actual
PDF must still contain the requested Unicode U+0048, rather than silently accepting
private-use text. Both actual PDFs contain twelve U+0048 characters with faces
`ARchitxt` and `Technic`.

Expected adjacent H origins at the declared 5 mm height are 4.8916184971 mm,
4.5633187773 mm and 3.6687138728 mm for normal ARCHITXT, Technic and condensed
ARCHITXT. Actual first-to-fourth origins are 14.6727935579, 13.6868664424 and
11.0045931498 mm. Existing 0.04 mm position and 0.02 mm advance/length tolerances
remain unchanged. All nine measurements and both full/detail render hashes match
across source/unpacked output. Fresh source renders were inspected; the three
distinct rows, border, divider and ruler are visible and unclipped.

Five [resource controls](../tests/font-resources.test.mjs) cover unsupported-family
rejection before I/O, missing registrations without file access, honest unreadable
inventory diagnostics without raw-error disclosure, cached-profile invalidation
after simulated registration removal, and approximate-metric warnings preserving
requested names and drawing state. These use injected synthetic services or a
pure isolated plot, without changing Windows fonts/registry. They do not establish
native unavailable-font UI behavior or missing-glyph diagnostics within an otherwise
available profile.

The new pure suite is selected by candidate fast checks. A fresh gate passed
22/22 stages and 639 selected portable checks, with unchanged inputs. The new reference helper is fingerprinted. The architectural workflow is an
explicit local acceptance profile, invoked with a distinct prefix and checked
profile identity. It requires those existing registered faces and fails if they
are unavailable. The default candidate application/CI profile retains regular
Arial/Times coverage, so this change does not add proprietary architectural-font
prerequisites to generic CI. No fonts are provisioned. The full application/
candidate gates and rebuild were not run. Hosted architectural-profile acceptance
was not run; its required font environment was not verified or provisioned.

The regular fixture's serialized bytes still match the previous immutable input.
The current reader passed nine measurements and seventeen rejection controls on
the preserved regular PDF, with unchanged regular expectations. That compatibility
read is separate from a new regular application run. Prior receipts remain intact.

Only these repeated-H samples are qualified. General glyph repertoires, actual
ink height, rich text/variants, dimensions/leaders, client conventions and DWT/
template/native/installed/AutoCAD fidelity remain open. A bounded missing-glyph
diagnostic investigation is next: distinguish an absent glyph in an available
face from an unavailable metric profile before proposing any product change.
All source font paths remain in private audit bindings; public summaries omit them.

## Default rotated annotation geometry

The synthetic rotation calibration independently verifies aligned dimension and
45degree leader segments, filled arrows and text baselines at1:48/1:96. Source
and existingbeta6unpacked each pass4app/42PDF/28controls with actual off-stroke
arrow raster evidence; all native/measurement/renderpairs match. See
[the record](ROTATED-ANNOTATION-QUALITY.md). This is default Standard Arial geometry
and semantic output, not actual glyph inkheight, Jon's styles or general native/
client fidelity. Earlier font references and all default workflows stay intact.
The existing rich-MTEXT formatting gap needs a narrow supported reference next.

## Three registered rich-MTEXT paragraphs

The new child preserves earlier fixtures and qualifies only Times regularHHHH,
boldBBBB anditalicIIII single-run paragraphs with exact25/3mm baseline spacing.
Both source/existingbeta6unpacked pass4app/12PDF/26controls and match nativebytes,
measurementobjects and2renders. DirectSFNT A-apex/hmtx/name/cmap values bindall3
faces. Glyphinkclips prove positivepresence only,notoutline/actualinkheight.
See [scope and measured output](RICHTEXT-QUALITY.md). Generalrich wrapping/mixed
runs,domain/clienttemplate/native fidelity and installed acceptance remain separate.
