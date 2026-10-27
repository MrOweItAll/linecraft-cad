# Registered Times rich-MTEXT calibration

LC-QA-010 closes the finite rich-text formatting child of LC-FNT-LAYOUT. Three
single-run paragraphs exercise Times New Roman regular, bold and italic through
actual hidden source and existing unpacked1.36.1-beta.6 persistence/PDF services.
Both first-attempt runs pass4 app checks,12 independent PDF measurements and26
rejected reader controls. Four new pure references and two QA control tests pass.
No product runtime, schema, manifest, font asset, installer or installed app changes.

The4,944-byte synthetic native input and actual saved file match exactly in both
variants. Complete Open/Save As/New/Open, raw formatting source, plain text,
registered styles and postplot live/saved state remain exact. All12 measurement
objects and both rendered-image pairs match across source/unpacked. PDF byte
hashes differ and are retained separately. One fresh full page and one enlarged
typography render were visually inspected; the corresponding unpacked hashes match.

## Frozen native and independent font reference

The original regular-font fixture stays unchanged. Its new child retains the
synthetic A4 landscape297 by210mm paper border, divider,100mm ruler and styles,
replacing only its three calibration TEXT samples with one MTEXT entity. Position
is(20,170)mm, height5, width150, rotation0 and style Measured Times, using registered
Times New Roman metrics. Plain text is three lines: HHHH, BBBB, IIII.

The exact rich source is:

```text
HHHH\P{\fTimes New Roman|b1|i0;BBBB}\P{\fTimes New Roman|b0|i1;IIII}
```

Native richText retains version1,attachment1,lineSpacingStyle2,lineSpacingFactor1.
Scoped flags are regular(false,false),bold(true,false),italic(false,true).
Each paragraph fits without wrapping. The independently declared model baselines
are165,156.666666667,148.333333333mm; PDF baselines are45,53.333333333,61.666666667mm,
with left origin20 and exact baseline advance25/3mm.

Before application output, a separate reader verified the three local font
registrations and parsed SFNT cmap,hmtx,loca,glyf,OS/2 and name tables directly.
The production parser is not imported by the PDF auditor. Required face flags and
binary hashes agree with both renderer cache and production PDF-service inventory.
No standalone font binaries or extracted outline assets are added to the repository.
Generated PDFs retain the production engine's normal embedded font subsets.

| Sample | Exact PDF PostScript face | A-apex units | Advance per glyph, mm | Font em size, mm |
|---|---|---:|---:|---:|
| HHHH | TimesNewRomanPSMT | 1387 | 5.331651045 | 7.382840663 |
| BBBB | TimesNewRomanPS-BoldMT | 1384 | 4.934971098 | 7.398843931 |
| IIII | TimesNewRomanPS-ItalicMT | 1387 | 2.458543619 | 7.382840663 |

Each font uses2048 units per em. This MTEXT contract uses the A-glyph apex as its
nominal height basis; the OS/2 cap height1356 is a different value. Glyph-origin
positions follow20+n*advance for n0..3. The font em size is5*2048/A-apex. No kerning
is requested. The nominal5mm height must not be asserted as actual H/B/I ink height.
This calibration does not approve Jon's font sizes, drafting conventions or general
font/client parity.

## Actual output and audit validity

Measured first glyph origins are approximately(20.001613426,44.999242422),
(20.001613426,53.332435862) and(20.001613426,61.665631994)mm. Actual em sizes are
7.381303464,7.397432836 and7.381086800mm. The actual100mm paper ruler measures
99.998318587mm. MediaBox/CropBox are297.010660638 by209.888652886mm with origin0
and rotation0. These pass the frozen tolerances:0.04mm glyph positions/combined
segment endpoints,0.02mm glyph advances/font sizes/paragraph spacing/segment
lengths,0.005mm strokes and0.3mm page boxes. None was relaxed after output.

The independent reader requires one page, six literal paper segments, exactly12
Unicode glyphs in the expected order/faces and exact semantic paragraphs. It checks
each glyph origin, per-glyph advance, em size, horizontal baseline direction,
opaque black visible text paint and all three independently parsed font identities.
It also rejects late white overpaint and raster-image surrogates.

Twelve576dpi clips use expected glyph bounds from direct SFNT glyph coordinates
and independently frozen origins/em sizes, not observed PDF boxes. Each must have
at least2% black pixels; actual fractions range0.237 to0.548. Three declared clear
sites are white. This proves positive ink presence and rejects blank or fully hidden
glyphs. It does not qualify a complete outline, arbitrary partial clipping, actual
ink height or an independent-consumer typography match.

The26 controls mutate copies of observations only: missing/extra pages, page boxes,
rotation, image surrogates, missing/wrong glyphs, regular-face substitution for
bold/italic, origins/advances/sizes/paragraph order, unknown/transparent/invisible/
nonblack paint, late white overpaint, ruler omissions/scale/width, blank glyph ink,
unexpected clear-site ink and OS/2 cap substituted for the MTEXT A-apex basis.
Original PDF/native/font bytes and historical receipts remain unchanged.

## Reproduction and remaining limits

node --test tests/richtext-reference.test.mjs runs4 native/source/parser/nominal
baseline/persistence checks. Pure Node checks do not pretend that unavailable
registered font profiles provide measured glyph widths. The dedicated
richtext-workflow.cjs accepts executable, source-entry-or-empty, unique ordinary-grip-
prefix and reviewed candidate-manifest arguments. The auditor requires matching
richtext identity. Each actual run binds81 source inputs,four actual content files,
three direct-SFNT font references and two fresh renders.

The workflow uses hidden isolated source/QA-unpacked profiles, forbids clipboard
access, verifies no observed HTTP requests and normal-quit descriptor cleanup.
It uses the real production PDF bridge; the Plot form and native human dialogs
are not exercised. All earlier fixtures/workflows remain unchanged. New pure
selection and four auxiliary fingerprints are recorded; the unchanged complete
beta6 candidate40/40 gate with655 selected portable checks retains its original
closure. Extended full gates/build were not rerun.

Installed binaries/normal profile,client drawings,original fonts,earlier candidates,
installer and immutable baselines remain preserved. No source product fix was
attempted. This is only three single-run no-wrap paragraphs; general rich-text
wrapping/fields/attachments/mixed runs,actual ink-height and template/client fidelity
remain unqualified. Native beta6 headline/warning acceptance,installed/upgrade
acceptance,independent editable DWG qualification and production relay integration
remain separate. Daily-use readiness is false. The finite safe queue is reconciled
privately; pending coordinated/environment/domain work is not reported complete.
