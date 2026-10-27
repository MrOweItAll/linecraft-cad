# Mixed A4/A3 synthetic output qualification

LC-QA-007 extends the existing multi-sheet coverage with a new child fixture.
Actual hidden source and existing beta6 unpacked runs each passed4 application
checks,20 independent PDF measurements and23 rejected reader controls. Four new
pure references and the three preserved original references passed7/7. No product
runtime change or repair was needed.

## Frozen references and actual output

The original two-A3 fixture/test remain byte-identical. The child retains the
240-inch model ruler and stored tab order B,A, but sheet A becomes portrait A4,
210x297mm, with viewport frame(25,100,160,100), center(120,0),locked1:48. Sheet B
remains landscape A3,420x297mm, with frame(100,100,220,100),same center,locked1:96.
Temporary Plot selection explicitly publishes A4 first then A3 without changing
stored tabs, accepted live state or saved bytes. Complete Open/Save As/New/Open
preserves native paper, geometry, styles and viewports exactly.

Independent model-to-paper expectations were frozen before either app ran:

| PDF page | Native paper, mm | Expected model ruler, mm | Actual ruler, mm | Actual PDF box, mm |
| --- | --- | --- | --- | --- |
| 1, A4-FIRST | 210x297 portrait | 127 | 126.997862964 | 209.888652886x297.010660638 |
| 2, A3-SECOND | 420x297 landscape | 63.5 | 63.499558597 | 420.200664944x297.010660638 |

PDF coordinates use top-left origin in mm. The first model ruler endpoints are
(41.5,147)-(168.5,147); the second are(178.25,147)-(241.75,147). Both100mm paper
sentinels are(20,237)-(120,237), observed lengths99.998318587
and99.999306361mm. Native model coordinates stay in inches.
Model strokes are0.25mm, paper sentinels0.35mm, border/dividers0.25mm.

The A4 title border is paper(10,10)-(200,40), dividersx140/180, markerA4-FIRST
at(145,15). Its PDF marker cell is[140,257,180,287]. A3 retains rightborder410,
dividers300/360 and markerA3-SECOND at(310,15), PDFcell[300,257,360,287]. Both
markers use the unchanged native Standard Arial definition,height4mm. This does
not add font-face/ink-height or client-convention qualification.

Both raw MediaBox and CropBox match each page's observed visible box, origin(0,0),
rotation0. Chromium's observed page extents are accepted within the existing
0.3mm page tolerance, not claimed exactly equal to nominal dimensions. Other
tolerances stay0.02mm ruler length,0.04mm combined endpoint distance and0.005mm
stroke width; none was widened. Native paper dimensions remain exact210/420x297.

Frozen native input:8,452 bytes, SHA-256
bb103f9517e1b77c59de0d4c450aa410ac5af2946a97dc96e1c3f38cbeb2254b.
Source and unpacked input/saved bytes match this hash. Their20 measured observations
and all four full/detail render pairs match exactly. PDFs retain separate byte
hashes; no raw PDF byte-identity claim is made. Fresh source full pages and both
title details were visually inspected: borders/dividers fit, labels are legible
and unclipped, both ruler sets appear, and A4/A3 order/orientation is clear.

## Independent reader and compatibility

The existing workflow/reader now accept an explicit mixed-paper profile; original
regular defaults and literals remain. Mixed mode requires matching producer and
reader profile IDs. The reader imports no production geometry or fixture module.
It validates input/saved native literals, actual vector segments, unique marker
text/cells, black opaque strokes/text, no raster surrogate, background paint order,
page order and raw page boxes/rotation. Twenty measurements mean one page-box
record plus eight vector records plus one marker record for each page.

The original13 copy-only reader controls remain. Ten additional mixed controls
reject forcing both pages to A3 or A4, wrong raw MediaBox with retained visible
size, crop/shifted box, rotation90, a shifted correct-length model ruler, incorrectly
scaled paper sentinel, duplicate marker bounds, invisible text with opaque metadata
and wrong physical stroke width. These23 controls mutate extracted observations,
not PDF bytes or product output. Separate wrong-profile input is rejected before
geometry measurement.

The current reader re-audited a preserved regular beta6 source PDF:18 measurements
and13 controls match its original arrays exactly. That is reader compatibility,
not a new regular app run. Original fixture and reference-test bytes are unchanged.
A pre-execution authoring anchor assumed CRLF in an LF reader; its failure is
retained privately, corrected before any app run. No product failure is inferred.

All targeted apps used hidden offscreen windows, disposable profiles, owned chooser
replies and temporary authenticated controller descriptors removed on normal quit.
Each records2Open/2Save calls,0clipboard calls,0visible/show events, no observed
external requests and no page errors. Complete source/input/candidate fingerprints
remain stable. Window/CLI/reader budgets remain finite120s/30s/30s, with240s wrappers.
No normal profile, Windows associations, installed app, client drawings, open/
unsaved work or native desktop input was used or changed.

## Selection and remaining scope

Candidate pure selection adds the four mixed-paper references; the two new files
are fingerprinted. The application profile remains regular by default. For the
explicit local mixed case, append --mixed-paper to the established four arguments:

    node tests/multisheet-workflow.cjs EXE SOURCE_ENTRY_OR_EMPTY UNIQUE_PREFIX qa/CANDIDATE-SOURCE-1.36.1-beta.6.json --mixed-paper

Use a unique ordinary-grip- prefix, existing approved source/QA-unpacked executable,
and approved local prerequisites. No new dependency, runtime/schema/manifest,
installer or app build changed. The preserved beta6 full40-stage/655-portable gate
retains its original closure; extended full gates were not rerun or relabeled.
This wake executed the new targeted coverage and default reader compatibility.

This is controlled synthetic output, not production title blocks, general paper
sizes/orientations, templates, native physical input or client/DWG/font parity.
Native beta6 headline/warning and installed/upgrade acceptance remain pending;
daily-use readiness is false. The existing plan/detail gap has a safe next child:
reuse the original synthetic detail content, freeze independent1:48/1:24 fill,
block and dashed-line output values, and preserve annotation definitions without
inventing client typography or drafting approval. The hourly loop remains active.
