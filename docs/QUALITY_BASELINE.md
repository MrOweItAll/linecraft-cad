# Quality baseline

Baseline commit: f37aba5ebe19f27088847cd8f983ecf5facf8eac, version1.36.0,
origin https://github.com/MrOweItAll/linecraft-cad.git. Local ownership branch:
codex/quality-loop-1.36.1. First candidate version1.36.1-beta.1; active candidate1.36.1-beta.4. Exact local paths and
checkpoint/installer hashes are in the private session report, outside this tree.

The opening baseline observations and dated sections below retain their historical
scope. Current beta4 focused native acceptance is recorded in
[NATIVE-BETA4-ACCEPTANCE.md](NATIVE-BETA4-ACCEPTANCE.md). Local scheduling state and
its first policy trial are recorded separately; a completed wake does not complete
all drafting requirements or establish installed/daily-use readiness.

Verified on2026-10-24: Windows x64, host Node24.13.0/npm11.6.2, local Electron44.9.3,
Playwright1.62.1/electron-builder26.15.3, Python3.14.6/PyMuPDF1.28.0. Installed app
metadata reports1.36.0; no upgrade is performed. The preserved published installer
hash was rechecked, and the complete source bundle and checkpoint hashes verified.
The starting tree contained only an uncommitted local handoff document, preserved
and excluded from candidate commits because it contains private machine details.

Fresh baseline: existing public pure profile passed306 core plus222 focused checks;
twelve private-reference cases remain explicitly excluded. Source actual hidden
app passed32 checks and independent actual PDF9. The restricted shell's initial
Electron launch failed; an authorized isolated launch outside that shell passed.
That environmental failure and historical receipts are retained separately.

The initial HATCH regression failed on the unchanged importer: only the sentinel
LINE imported; the redundant-closing rectangle fill was omitted. New public tests
derive from the reviewed synthetic packet, replace its self-comparison with literal
vertices/properties/area, and add literal transformed block coordinates. Private
client controls are preserved outside the repository and are not published.

| Format | Read/write | Supported current scope | Test/reference | Limits |
|---|---|---|---|---|
| Native Linecraft/1 and/2 | Both | Ordinary entities, units/styles/layers/layouts/resources; validated architecture | Existing core/persistence; quality smoke Save/reopen | /2 requires authoritative architecture; no general backward-version guarantee |
| DXF | Both, bounded | Selected ordinary geometry, annotations, blocks, supported HATCH and paper views | Existing importer; synthetic HATCH; actual two-ruler export reader | Not complete fidelity; holes/bulges/multiple HATCH loops unsupported; images may need sidecars |
| DWG | Read through bundled converter | Bounded importer subset | Existing converter/resource verification; new direct DWG test not run | No writer; no full proxy/xref/layout/font fidelity claim |
| PDF | Write | Actual vector plotting, physical layouts/scales | Existing independent PDF9 plus new rulers/fill audit | Raster appearance/fonts/platform need visual review; not editable native exchange |
| Structural JSON | Optional exchange | Declared supported inputs | Existing project checks | No engineering approval or certification implied |

The proposed loop adds no new format/schema or general AutoCAD compatibility.
Visible candidate/native dialogs, installed acceptance, Windows/DPI/font soak and
fresh AutoCAD reference observations remain separate checks. The LC-MON-003 viewport
center repair is verified in beta2; independent tick stroke, extra grip modes and
idle two-click window selection remain unfinished. Historical monitoring records remain untouched.


## First milestone outcome

Tested code commit3de665ab06f7a48eabc4a5331100786a01fb969a produced local candidate
1.36.1-beta.1. Its full automated gate passed22/22 stages:559 selected portable
checks, source and unpacked32/PDF9 each, and the new real-loopback9-check drafting
smoke for each. These are overlapping evidence classes, not an independent feature
total. The private original HATCH27-check control was separately rerun against
current source and a preserved1.36 baseline; only module/fixture location bindings
were adapted, without changing assertions. It overlaps the26 public HATCH tests.

Both actual packaged PDFs were visually inspected. The actual127mm/50.8mm ruler
measurements and20x12mm solid fill passed independent reading. An earlier stricter
reader attempt failed by counting an antialiased partial boundary row; independent
vector/device-coordinate inspection justified restricting sampling to fully
contained pixels. The99.5% threshold and missing/partial-ink negative controls were
preserved. Failed evidence remains available privately.

Candidate-saved native drawing copies reopen semantically unchanged with all59
runtime files extracted and hash-verified from the preserved1.36 checkpoint.
This is source-reader compatibility, not installed downgrade/upgrade acceptance.
The installer was compiled without installing. Native dialogs/physical input,
installed candidate acceptance, dev-host reload/restart refresh, larger-drawing app
timing, broad font/DPI/Windows soak and the original large client-sheet case on the
refreshed vendor runtime remain unverified. The selected new sheet is a reduced
calibration fixture; existing title-block references remain separate coverage.

The local CI configuration has not been pushed or run remotely. Report/log artifact
uploads were rejected by automatic approval review because of potential path or
metadata disclosure; evidence remains local. No remote publication, merge, tag,
installation, scheduler or outbound message occurred. Manual invocation ready;
unattended execution not enabled. Next ready repair: separately review LC-MON-003.


## Viewport-center cycle - October 24, 2026

Tested code fdc37327e174516dda10bcab7045ed991fdda8c4 produces local candidate
1.36.1-beta.2. All 23 automated stages passed: 582 selected portable checks,
source and unpacked 32/PDF9 each, and the extended 10-check real-loopback smoke
for each. Twelve private core references remain excluded, not passed.

LC-MON-003 was reproduced on verified beta1: raw center (23,-41) imported as
(41,23). The product change alters one importer line: only the existing normalized,
untwisted World Top classification uses target + raw DCS XY. Target Z is retained.
No general transform, paper frame, scale, lock, layer/freeze policy or schema change
was introduced. The existing LC-MON-002 HATCH fix remains integrated.

The actual app imports the synthetic layout and plots it without scripted repair.
Complete Save/reopen state and IDs are checked. Its actual packaged PDF ruler is
39.99972254 mm long at midpoint (149.99895685,196.99912957) mm against literal
40 mm and (150,197) mm; the unchanged paper sentinel measures 9.99993064 mm.
Existing 0.02 mm length/midpoint and 0.04 mm endpoint matching tolerances remain.
Missing-ruler, wrong-scale and shifted-center negative controls must fail.
The fresh viewport render was visually inspected; this is not native UI acceptance.

Nine frozen synthetic beta1 non-Top output digests establish change isolation only.
The original private viewport 18-check suite passed against HATCH-only beta1;
the original private HATCH 27-check suite passed against an independently prepared
viewport-only control. Only module/fixture-location adapters changed; assertions
and fixtures stayed intact. Counts overlap the public suites and are not additive
independent feature coverage. Raw private fixtures and logs remain outside source.

A new import Undo/Redo assertion initially assumed the active paper tab would be
restored. Preserved beta1 and unchanged core source independently confirmed that
history restores content while retaining reconciled Model navigation. The test now
checks the complete expected Redo document with that exact pre-existing context;
constructor and app Save/reopen still require complete serialized equality.
This did not change application navigation or weaken geometry/persistence checks.

Actual packaged drafting/HATCH/viewport native copies reopen unchanged with both
hash-verified 1.36 and beta1 source readers: six exact semantic comparisons. No
installed upgrade/downgrade test is claimed. Beta1 manifest, installers, source
archive and immutable1.36 baseline remain preserved. Beta2 uses its own explicit
manifest and unique QA output directory. Native installed acceptance remains pending.

Supplemental attachments were reviewed: the old scripting-foundation patch is
already superseded by integrated current APIs, and the development handoff is a
duplicate. DWG writing and a durable drafting/development relay remain gaps; broader
font/layout/native transform fidelity is not established by this importer fix.
No patch wholesale integration, installation, release, push, outbound message or
scheduler change occurred. Manual invocation ready; unattended execution not enabled.

## Native beta2 acceptance - October 24, 2026

The exact unpacked beta2 from the recorded passing gate now has focused visible
Windows acceptance for LC-MON-002 and LC-MON-003. Native input and real Windows
dialogs completed import, MOVE/Undo/Redo/Undo, Save As/New/Open and PDF output.
Complete document equality and independent PDF ruler/center/fill checks passed;
both actual output renders were inspected. See [the native acceptance record](NATIVE-BETA2-ACCEPTANCE.md)
for identity, fixture preparation, measurements, preservation and limits.

Installed binaries, recorded normal-profile configuration and all recorded source
inputs stayed unchanged. Only owned synthetic drawings were opened. The candidate
quit normally. Earlier native-pending statements describe previous checkpoints;
installed/upgrade acceptance, broader desktop usability and separate release
authorization remain pending. No runtime change or rerun of the unchanged passing
automated gate was required.

## Viewport-scaled tick width - October 25, 2026

The user selected geometric width that scales with the viewport. Candidate
1.36.1-beta.3 implements optional dimension-style tickWidth, using existing
style/object annotation scales. Unset widths retain complete legacy behavior.
See [the implementation record](TICK-WIDTH-IMPLEMENTATION.md) for semantics,
native compatibility and explicit DXF limitations.

The fresh full gate passed27/27 stages and595 selected portable checks. Existing
source/unpacked32/PDF9 and10-check loopback workflows passed. New source and
unpacked tick workflows passed10 checks each, plus three actual PDFs/30independent
measurements each: legacy, explicit and cleared widths. Explicit ticks measure
about0.24mm at1:50 and0.12mm at1:100 while ordinary strokes remain0.1mm.
Cancel, one-field Apply, complete Undo/Redo, Save As/New/Open and clearing passed.

A first27-stage run is retained but superseded: review exposed a PDF-reader gap
for transparent ink and late white overpaint. The independent reader was corrected
with opaque black solid-ink checks, ordered backgrounds and negative controls;
the entire gate was then rerun. Runtime code and tolerances did not change for
that audit correction. Earlier fixture/reader failures remain private evidence.

Older1.36/beta1/beta2 readers discard the new width property and its appearance;
this is not full backward persistence. Cleared and unchanged legacy drawings
remain exact. The installed application, original inputs and earlier candidate
artifacts remain unchanged. Beta2 visible acceptance is historical; beta3 visible
native and installed/upgrade acceptance remain pending. No release, installation,
push, remote CI execution or scheduler change occurred.

## Native beta3 tick-width acceptance - October 25, 2026

The exact unpacked beta3 from the recorded 27-stage gate passed focused visible
Windows acceptance for LC-MON-001. Native input and real dialogs completed Cancel,
settings submission with Enter, full Undo/Redo, Save As/New/Open and actual PDF
output for legacy, explicit and cleared widths. Independent audits passed ten
measurements and eleven paint negative controls per PDF. Explicit ticks measure
about 0.24 mm at 1:50 and 0.12 mm at 1:100; ordinary lines remain 0.1 mm. All three
actual PDF renders and six detail clips were visually inspected.

Current and preserved older source readers made twelve comparisons of the actual
native-saved files: nine exact full-state results and three expected explicit-width
presentation losses. Cleared and legacy native bytes and PDF renders match exactly.
See [the acceptance record](NATIVE-BETA3-ACCEPTANCE.md) for exact identity and limits.

The candidate quit normally. Installed binaries, recorded normal-profile settings,
source inputs and original fixtures stayed unchanged; only owned synthetic drawings
were opened. Earlier beta3 native-pending statements record historical checkpoints.
Installed/upgrade acceptance and broader human/DPI/client fidelity remain pending;
daily-use readiness remains false. Importer native coverage remains the historical
beta2 session, not a fresh beta3 native import test. No runtime change, rebuild or
repeat of the unchanged automated gate was required.

## Paper SOLID import blocker - October 25, 2026

LC-MON-007/P1 is reproduced and unfixed. A literal all-Z=0 40 by 20 mm
paper-space SOLID rejects the whole import in both hash-verified 1.36 and beta3
source readers. Model-space SOLID, ordinary planar paper LINE and independently
authored filled planar native geometry controls succeed; nonplanar paper SOLID
remains rejected. Ten defined source checks completed. Read-only installed ASAR
members match the preserved 1.36 importer/core bytes. No app was launched here.

See [the triage record](PAPER-SOLID-IMPORT-TRIAGE.md). The installed native error
is the authorized source-chat report, not a fresh native test in this session.
Existing focused beta3 tick-width acceptance retains its scope, while this new
open/import blocker remains unresolved. No runtime change, rebuild, installation,
client drawing access or rerun of the prior unchanged gate occurred.

## Paper SOLID candidate - October 25, 2026

Candidate 1.36.1-beta.4 fixes LC-MON-007 with one importer runtime change relative
to beta3. Zero-thickness final-XY paper SOLIDs become existing editable solid
HATCH geometry. Core validation remains strict; unsupported paper faces reject
the complete import, and model/TRACE/3DFACE paths remain unchanged.

The fresh exact-candidate gate passed 30/30 stages and 631 selected portable
checks. The new 36-check correctness suite passes after 13 expected failures on frozen
beta3. Both actual source and unpacked workflows passed 6 app checks, 2 independent
PDF measurements and 7 negative controls, in addition to all prior selected checks.
The PDF fill measures 39.99972254 by 19.99987742 mm at the declared paper position;
its 10 mm sentinel measures 9.99993064 mm. Interior raster dark fraction is 1.0 against
a predeclared 0.995 minimum. Both actual renders were visually inspected.

The actual packaged native file reopens with exact complete state and serialized
bytes in hash-verified 1.36/beta1/beta2/beta3 source readers: 4 comparisons. Installed
app/binaries and client drawings stayed unchanged; no installed downgrade claim
is made. See [the implementation record](PAPER-SOLID-IMPLEMENTATION.md). Exact
beta4 visible native acceptance and separate release/promotion remain pending.

## Recorded native beta4 paper SOLID acceptance - October 26, 2026

The exact unpacked beta4 from the recorded 30-stage gate passed focused visible
Windows acceptance of LC-MON-007 using disposable synthetic ASCII DXF. Six actual
native checkpoints cover identity/Open, MOVE of only the fill by (5,7), complete
Undo/Redo/Undo, Save As/New/Open, actual PDF output and atomic rejected nonplanar
Open against the accepted nonempty drawing. No runtime change or rebuild occurred.

The unchanged independent PDF auditor passed two measurements and seven negative
controls. The fill measures 39.99972254 by 19.99987742 mm; the sentinel measures
9.99993064 mm. Interior dark fraction is 1.0 against the predeclared 0.995 minimum.
Fresh full-page and detail PDF renders were visually inspected. All four preserved
source readers retain the actual native-saved file as exact state and serialized
bytes, with each 59-file reader closure unchanged before and after.

The candidate quit normally. Installed binaries, recorded normal-profile files,
128 recorded source inputs and original fixtures stayed unchanged through native
closure. No client drawing was accessed. See [the acceptance record](NATIVE-BETA4-ACCEPTANCE.md)
for the explicit navigation-fit comparison and pre-existing import-report wording
defect, now separately recorded as LC-MON-008. Earlier native-pending statements
are historical. Installed/upgrade, broad human/DPI and actual DWG/client fidelity
remain pending; daily-use readiness remains false. No unchanged full-gate rerun,
installation, release, push, outbound message or scheduler change occurred.

## Local recurring development authorization - October 26, 2026

The owner authorized a bounded local recurring development task in the existing
chat. The exact ACTIVE task, four-hour cadence, private runbook/ordered queue and
disable procedure are recorded in the private quality pointer. The old drafting
report monitor remains paused. This changes local scheduling authorization;
earlier statements that unattended work was disabled remain historical.

The first manual policy trial repaired LC-QA-002: both CI jobs selected beta2
against current beta4 source. The pre-change fast command failed with the expected
version mismatch before any suite ran. The corrected beta4 command passed 20/20
fast stages, and source application checks passed 4/4 stages, with fresh actual
application/PDF receipts and unchanged bound inputs. No runtime or manifest change,
candidate rebuild, installation, publication or remote CI execution occurred.

The recurring trigger is enabled; its first actual scheduled execution has not yet
been observed. That is distinct from this successful manual policy trial. See
[the run contract](UNATTENDED-DEVELOPMENT.md). Installed application, normal
profile and client drawings remain protected; daily-use readiness remains false.

## Scheduled multi-sheet milestone - October 26, 2026

An actual scheduled wake completed the bounded two-sheet/title-block coverage
milestone, after the initial wake had been interrupted before source ownership.
The normal four-hour schedule was restored. No application runtime or manifest
changed. Fast21/21(634 selected portable) and source application5/5 passed; the new
targeted exact existing-unpacked workflow passed four checks plus actual PDF18 and
13 rejected reader probes. Stored B,A tab order plots A,B with127/63.5mm model
rulers and complete synthetic title blocks. Source/unpacked native bytes and all
four rendered-image pairs match exactly; fresh source renders were inspected.
See [the detailed record](MULTISHEET-QUALITY.md). Earlier scheduler-pending statements
are historical. Installed application/settings, client CAD, existing artifacts and
prior evidence remain protected. The extended full candidate gate, remote CI and
broader font/client/installed acceptance remain not run or unqualified.

## Scheduled DWG feasibility - October 26, 2026

An hourly scheduled wake inventoried existing official LibreDWG 0.13.4 writers
and ran two bounded synthetic converter attempts. Both unchanged current DXFs
failed on common layout group 410. A narrowly validated diagnostic derivative
encoded R2000, but readback logged errors; independent corrected audits passed
model 6/6 and multi-sheet 7/10. Inch units survive. The multi-sheet decoded graph
has duplicate ENDBLK 24 and both floating viewport IDs become 1, despite retained
frames/targets/lock flags. The writer/readback source of those changes is unisolated.
See [the feasibility record](DWG-WRITE-FEASIBILITY.md). Application DWG export remains
unavailable; native editability and independent binary consumer checks were not run.

Only synthetic fixtures, this documentation and the sanitized backlog changed.
No runtime/manifest change or unchanged gate rerun occurred. Installed app/profile,
existing candidate/installer and original drawing files remain protected. Earlier
four-hour cadence statements are historical: the owner now requests hourly wakes.
Broader native/client/font/installed acceptance and daily-use readiness remain
unqualified. The next ordered safe item is synthetic font/template/layout inventory.
