# Missing-glyph diagnostics - LC-FNT-001

Candidate 1.36.1-beta.5 preserves missing-glyph warnings for plain TEXT and MTEXT
and forwards them through LEADER and DIMENSION. Previously, only rich MTEXT in
the five-annotation reference reported the unavailable character. The actual
source PDF response returned one warning where five were required. The fix is
one core runtime file and reuses the existing rich-text warning convention and
plot transport. It does not replace characters, select fonts or change drawing
geometry, native serialization, SVG or PDF appearance.

## Independent reproduction

The [fixture](../tests/missing-glyph-fixture.mjs) uses `H∅H`, with Unicode values
72,8709,72, in an available registered Technic style. An independent SFNT audit
accounts for every cmap record: the Unicode and Windows-symbol tables map U+2205
to glyph0, and Macintosh Roman cannot encode it. MuPDF independently reports no
mapped glyph for U+2205. The H character remains supported through the previously
verified symbol mapping. This establishes an absent encoded character; it makes
no claim about every unencoded outline in the font file.

The synthetic A4 landscape sheet contains plain TEXT, plain MTEXT, rich MTEXT,
a leader and a linear dimension with the same label/override. It has no model
objects or viewports and retains the original 100 mm ruler, border and divider.
No client content, font files or proprietary templates are copied into source.

The nine [portable regressions](../tests/missing-glyph.test.mjs) initially passed
four and failed five for the expected TEXT/MTEXT/LEADER/DIMENSION/plot warning
paths. A real hidden beta4 source Open/Save As/New/Open/PDF exercise independently
failed the required warning count, returning the rich-text warning alone. Its
native/PDF files, failed receipt and logs remain intact.

`measureFontText()` already reported the missing count. Plain `textLayout()`
dropped it; leaders and dimensions also omitted layout warnings. The fix collects
one existing `missing-glyph:<family>` diagnostic per affected plain annotation,
adds no empty warning field to supported layouts, and forwards nonempty layout
warnings through the two annotation geometries. Existing plot code returns them
without exposing character contents, font paths or raw filesystem errors. Import
and DXF warning paths are separate and are not fixed or qualified here.

## Verification

All nine regressions pass after one product repair. Supported-H output is an
explicit control; unavailable profiles retain their separate approximate-metric
warning. Existing rich diagnostics stay deduplicated. Exact before/after checks
preserve native bytes, every nonwarning primitive and report field, and SVG/HTML
digests. Only declared diagnostic fields are excluded from that comparison;
the old rich-only, new five-annotation and supported-zero warning sets are checked
separately. An initial support checker omitted nested sheet warnings and a generated
correction had a syntax error; both failures are preserved privately. The final
explicit checker excludes no geometry and changes no numerical tolerance.

The fresh beta5 candidate gate passed **37/37 stages and 648 selected portable
checks**, building and testing the actual unpacked app and compiling its installer.
The default gate fingerprints the new files and selects the portable regressions.
The explicit local Technic workflow adds four app checks, eight independent PDF
measurements and eighteen rejected observation controls against both source and
the newly built unpacked candidate. It remains separate from generic CI font
prerequisites and fails if its local prerequisites are unavailable.

The [independent PDF auditor](../tests/audit-missing-glyph-pdf.py) requires five
unique diagnostics in both production response arrays, complete native labels,
one 297 by 210 mm page, ten Unicode H plus five U+2205 characters, the supported
H face, opaque paint and the independent 100 mm ruler. The ruler measures
99.9983185874 mm with a 0.3499941137 mm stroke. Existing tolerances remain
0.04 mm for position, 0.02 mm for length, 0.005 mm for stroke and 0.3 mm for
Chromium page rounding. Negative controls reject absent/duplicated/mismatched
warnings, wrong IDs/families, missing/incorrect text or pages, wrong supported
face, invisible paint, raster substitution, ruler errors and late overpaint.

Actual unsupported ∅ glyphs use observed CambriaMath fallback. Their shape,
spacing and general font fidelity are not qualified. The fix makes this limitation
visible while preserving the requested text. Fresh full/detail source renders
were inspected. Source/new-unpacked measurements, native bytes and both render
pairs match exactly. Before/after source native bytes and both render pairs also
match exactly, including the beta4 file actually saved and reopened before repair.

## Identity and limits

The immutable beta4 manifest and artifacts remain intact. The new
[beta5 manifest](../qa/CANDIDATE-SOURCE-1.36.1-beta.5.json) binds all 59 runtime files
and 12 resources. Only `core.mjs` differs from beta4; the cumulative five baseline
changes remain explicitly reviewed. Package/lock version and both local CI pins
select beta5. No dependency or publication trigger changed. The automated gate
ran at the recorded parent HEAD with the reviewed working changes; final commit
identity binds the same exact tested runtime/resource bytes, without relabelling
the original gate's HEAD/dirty-state receipt.

The installer was compiled, not installed or published. Installed app/profile,
client drawings, file associations, open work and previous candidates are preserved.
No visible native desktop input occurred. Focused beta5 native warning acceptance,
installed/upgrade checks, general glyph/font/template/client/AutoCAD fidelity and
editable DWG output remain unqualified; daily-use readiness is false. Next safe
automated queue item is deterministic larger-drawing performance measurement.
