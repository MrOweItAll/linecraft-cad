# Quality baseline

Baseline commit: f37aba5ebe19f27088847cd8f983ecf5facf8eac, version1.36.0,
origin https://github.com/MrOweItAll/linecraft-cad.git. Local ownership branch:
codex/quality-loop-1.36.1. First candidate version1.36.1-beta.1; current candidate1.36.1-beta.15. Exact local paths and
checkpoint/installer hashes are in the private session report, outside this tree.

The opening baseline observations and dated sections below retain their historical
scope. Focused beta4 native acceptance is retained in
[NATIVE-BETA4-ACCEPTANCE.md](NATIVE-BETA4-ACCEPTANCE.md); the later bounded beta6
headline/glyph-warning result is in [NATIVE-BETA6-ACCEPTANCE.md](NATIVE-BETA6-ACCEPTANCE.md). Local scheduling state and
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

## Scheduled registered-font milestone - October 26, 2026

The first controlled LC-FNT-LAYOUT milestone closes LC-QA-004: regular registered
Arial/Times and width-factor typography now have actual hidden source and existing
unpacked persistence/PDF coverage. Both targeted runs passed four app checks,
nine independent measurements and seventeen rejected reader controls. Source and
unpacked native bytes, measurements and both render pairs match exactly; fresh
source full/detail renders were inspected. The paper ruler measures 99.9983185874 mm.
All nine fixed font-face records were available locally, but seven are inventory-only.
See [the coverage record](FONT-LAYOUT-QUALITY.md) for independent font bindings,
initial sandbox launch failure, temporary-profile warning and remaining limits.

The candidate app profile selects the new workflow and fingerprints its three
files. Two gate-control tests passed. No runtime, manifest or font asset changed,
and no unchanged full gate or candidate rebuild occurred. Installed/profile/client
state and previous artifacts remain protected. Native input, broader glyphs,
ARCHITXT/Technic appearance, DWT/templates, client/AutoCAD and installed/upgrade
acceptance remain unqualified. Continue with a focused synthetic architectural-font
glyph milestone; all attachment requirements and daily-use readiness are not complete.

## Scheduled architectural-font milestone - October 26, 2026

LC-QA-005 adds a separately identified ARCHITXT/Technic repeated-H profile plus
five injected/pure font-resource fallback controls. A fresh fast gate passed
22/22 stages and 639 selected portable checks. Targeted actual hidden source and
existing-unpacked runs each passed 4 app checks, 9 independent PDF measurements
and 17 rejected reader controls. Both actual PDFs retain twelve Unicode H characters
with the requested ARchitxt/Technic faces. Independent mapped-glyph SFNT metrics
avoid the Technic ASCII-H fallback trap. Native bytes, measurements and both render
pairs match exactly; fresh source full/detail images were inspected.

The regular fixture bytes remain identical to the earlier input, and the current
reader passes 9/17 on the preserved regular PDF with unchanged expectations. That
is compatibility evidence, not a new regular app run. See the appended
[coverage record](FONT-LAYOUT-QUALITY.md). No runtime, schema, manifest, fonts,
installed/profile/client state or prior artifacts changed. Full application/
candidate gates and rebuild were not rerun. Only the declared H samples are
qualified; ink height, general glyphs, annotations and template/native/installed
fidelity remain open. Next: independently reproduce any missing-glyph diagnostic
gap in an available fixed font before proposing a product fix.

## Beta5 missing-glyph diagnostics - October 26, 2026

LC-FNT-001 was reproduced with independent full-cmap evidence, five expected
regression failures and an actual beta4 PDF response reporting only 1/5 affected
annotations. One core-only repair preserves missing-glyph warnings for plain
TEXT/MTEXT and forwards leader/dimension layout diagnostics. All 9 regressions
pass. The new beta5 exact-candidate gate passed 37/37 stages and 648 selected
portable checks, built/tested the unpacked application and compiled its installer.
Both explicit local source/newunpacked cases passed 4 app/8 PDF/18 rejected controls.
Native bytes, geometry, SVG/HTML and before/after rendered images remain exact;
only diagnostics improve from 1 to 5. Source/unpacked measurements and render pairs match.

See [the diagnostic record](MISSING-GLYPH-DIAGNOSTICS.md). Beta4 manifests/artifacts
and installed/profile/client state remain protected. The beta5 manifest reviews
all 59 runtime/12 resources; only core.mjs differs from beta4. Native beta5 input/dialog
acceptance and installed/upgrade/promotion are not performed. Import/DXF diagnostic
coverage, unsupported glyph appearance/spacing and broader font/template/client
fidelity remain unqualified. Daily-use readiness remains false. Next safe automated
queue item: deterministic larger-drawing performance measurement.

## Deterministic drawing measurements - October 26, 2026

LC-QA-006 freezes a 2,000-line inch drawing and an explicit navigation profile.
Actual hidden source and existing beta5 unpacked operations each yield42 timing
rows: one warm-up and five measured seven-operation rounds. Independent audits
pass exact geometry/content and six state-transition rounds, hash-bound files,
seven recomputed summaries and15 rejected observation controls. Raw CSV and
min/median/max values are recorded in [the baseline](PERFORMANCE-BASELINE.md).
These are CDP/IPC operation round trips plus a separate renderer-frame-drain
boundary, not physical latency or approved usability. No runtime change or
optimization occurred. Full unchanged beta5 gates/builds were not repeated.
Installed/profile/client/native state and prior artifacts remain protected;
native beta5 and installed acceptance remain pending, daily-use readiness false.
Next safe queue item: isolated development reload/restart preservation.

## Development recovery milestone - October26,2026

LC-DEV-001 passed4/4 actual source stages across3 hidden launches and2/2 existing
unpacked beta5 stages across2 launches. Independent source12/unpacked8 measurements
and12 rejected controls each verify literal geometry and complete native states.
Two real stylesheet watcher reloads preserve dirty/clean accepted content/view and
settings, cancel prompts and clear real history/selection. Controlled dirty host
restart preserves the saved target and allows Save without a chooser. Intentional
clean close clears recovery. Packaged restart begins blank and requires explicit
Open; development reload is a verified no-op. See [the record](DEVELOPMENT-RECOVERY-QUALITY.md).
No runtime/schema/manifest, installation/profile/client/native input or original
fixture/result changed. Existing complete candidate gates/builds were not repeated.
Crash durability, broader/draft/error recovery, native beta5 and installed/upgrade
acceptance remain open; daily-use readiness is false. Next: local relay protocol.

## Local synthetic relay milestone - October26,2026

LC-DEV-002 passed15/15 focused checks, including actual two-process claim race and
fresh-process replay/recovery. A separate18-CLI scenario commits8 events, with4
replays and4 expected rejections preserving committed bytes. Independent11measurements/
12controls verify the literal request/reference, state/owner/decision/outcome and
hash bindings. The initial sandbox2pass/13EPERM hardlink result is retained;
unchanged code passed with approved filesystem access. See [the record](LOCAL-DEVELOPMENT-RELAY.md).
This tools-only synthetic ledger performs no CAD, app or outbound actions. Real
intake/automatic pickup/file transfer/chat relay/authentication and crash/powerloss
remain unqualified. No runtime/schema/manifest/install/profile/client/native input
change, full gate rerun or rebuild occurred. Native beta5 and installed acceptance
remain pending; daily-use readiness is false. Next safe item: LC-MON-008 headline.

## Beta6 import headline fix - October26,2026 local session

LC-MON-008 now labels accepted3total/1model/2paper geometry correctly. Seven actual
renderer-function checks pass after six retained expected failures. Actual beta5
headline acceptance fails while preserving geometry/persistence; fresh source and
new beta6 unpacked pass3checks each. All9imported/native/reopened streams are byte
identical, as are nonheadline report rows. The fresh exact-candidate gate passes
40/40 with655selected portable and compiles the uninstalled installer. See
[the record](IMPORT-HEADLINE-COUNTS.md). Runtime delta from beta5 is app.mjs only;
all59runtime/12resources and cumulative manifest changes are reviewed. Native beta6,
inherited missing-glyph warning and installed/upgrade acceptance remain pending;
daily-use readiness false. Mixed A4/A3 output is a useful existing synthetic
follow-up, so the authorized safe queue is not exhausted.

## Mixed A4/A3 coverage - October26,2026 local session

LC-QA-007 freezes a new child fixture without altering the original2A3 reference.
Both actual source and existingbeta6unpacked cases pass4app/20PDF/23controls.
Complete native bytes, measurements and4renderpairs match; fresh full/detail images
were inspected. MediaBox/CropBox widths209.888653/420.200665mm and height297.010661mm
are within unchanged0.3mmpage tolerance;127/63.5mmmodel and100mmpaper rulers pass
unchanged physical tolerances. Regular18/13 re-audit arrays match exactly, and wrong
profile rejects. New4+original3 pure references pass7/7. See [the record](MIXED-PAPER-QUALITY.md).
No runtime/schema/manifest/build/installed/client/native input change or extended
fullgate rerun occurred. Nativebeta6/installed acceptance and general font/client/
DWG/template fidelity remain pending. Existing synthetic plan/detail coverage has
a deliberate next child; daily-use readiness remains false.

## Synthetic plan/detail coverage - October26,2026 local session

LC-QA-008 completes the bounded original-detail child at locked1:48/1:24. Both
final source/existingbeta6unpacked runs pass4app/50PDF/28rejectedcontrols; complete
native bytes, measurements and4renderpairs match. Fresh full/detail renders were
inspected. The reader now verifies Chromium filled-cubic rounded dashes against
independent4on2off/.7mm expectations plus37/59 actualraster points. The initial
unsupported-curve failure and authoring/environment failures remain preserved.
Combined pure11/11 and QAcontrols2/2 pass. See [the record](PLAN-DETAIL-QUALITY.md).
No runtime, schema, manifest, installer, installed/client/native-input change or
extendedfullgate/build occurred. Nativebeta6/installed acceptance and broader
font/DWG/template/client fidelity remain pending; daily-use readiness false.
The next concrete existing font/annotation gap is rotated aligned-dimension and
leader geometry, with independent defaults/calibration references first.

## Rotated annotation coverage - October26,2026 local session

LC-QA-009 adds independent default aligned-dimension and45degree leader geometry
through two locked A3 scales. Both first source/existingbeta6unpacked runs pass
4app/42PDF/28rejectedcontrols;4newpure and2QA controls pass. Complete native bytes,
42measurementobjects and4renderpairs match. Actual baseline directions and14local
1728dpi raster sites perpage include filled-arrow interiors away from stroke.
Fresh full/annotation renders were reviewed. See [the record](ROTATED-ANNOTATION-QUALITY.md).
No runtime/schema/manifest/installer/installed/client/native-input change occurred.
Fullunchanged gates/build were not repeated. Nativebeta6/installed acceptance,
broad font/template/client/DWG fidelity and production relay remain separate;
daily-use readiness false. Rich-MTEXT formatting remains an existing focused gap.

## Registered rich-MTEXT coverage - October26,2026 local session

LC-QA-010 completes the finite three-paragraph Times formatting child. Both first
source/existingbeta6unpacked runs pass4app/12PDF/26rejectedcontrols;4newpure and
2QA tests pass. Complete native bytes,12measurementobjects and2renderpairs match.
IndependentSFNT/registration references precede application output; A-apex basis,
bold/italic actualfaces,origins/advances/emsize/exactspacing and positiveglyphink
checks pass. Fresh full/typography renders inspected. See [the record](RICHTEXT-QUALITY.md).
No runtime/schema/manifest/fontasset/installed/client/native-input change occurred.
Unchanged fullgate/build not rerun. Nativebeta6/installed/upgrade,broader client/
template/DWG fidelity and production relay remain pending;daily-use readiness false.
Remaining coordinated/environment/domain prerequisites are recorded privately.

## DWG readback attribution, 2026-10-27

The [source/readback audit](DWG-READBACK-ATTRIBUTION.md) binds preserved synthetic
R2000 artifacts and two fresh JSON projections. Pinned output macros explain why
DXF group69=1 alone cannot attribute encoded floating-role corruption. Model JSON
has36objects/34uniquehandles; multi-sheet has56/55. Duplicate handle classes and
null/off/empty VX/layout observations keep the pipeline unqualified. Fifteen
private copy-only controls validate bounded observations. No runtime change,
third converter attempt, gate/build rerun or native/installed acceptance occurred.
Beta.6 candidate receipts retain their original closure and readiness limits.

## Pinned DWG allocation trace, 2026-10-27

[DWG-ALLOCATION-ATTRIBUTION.md](DWG-ALLOCATION-ATTRIBUTION.md) records source paths
consistent with placeholder 0x1F, fallback VX_CONTROL 0xB and the asterisk name.
Independent raw input counts are 34/34 and 50/50 unique declarations. The private
worksheet binds 91 preserved files and rejects seven tampered copies; these are
source/observation checks, not executed C or independent binary tests. No new
writer, reader, rebuild, product/runtime/manifest change or unchanged app gate
occurred. Editable DWG, native/installed acceptance and daily-use readiness remain
unqualified. Further converter work requires a fresh bounded regression/build/
attempt scope; no further current unattended source-only item is ready.

## Focused beta6 native acceptance - October 27, 2026

The existing isolated unpacked beta6 candidate passed fresh synthetic DXF
headline/dialog and complete Save As/New/Open checks. Native plot preview and
the settled completion log each show five distinct inherited Technic missing-glyph
diagnostics. The actual PDF passed three measurement groups and thirteen rejected
observation controls; complete native state and fresh full/detail visual reviews
passed. These counts describe this session, separately from earlier hidden gates.
See [the native record](NATIVE-BETA6-ACCEPTANCE.md).

The subsequent reconciliation is documentation/backlog only: runtime, manifests,
candidate/installer, original evidence and installed/profile/client state remain
unchanged. No test/build/native/converter work is repeated. Historical beta5 native
execution remains unrun; its inherited warning behavior was accepted on beta6.
Unsupported glyph appearance/spacing, installed/upgrade, general client/template/
DWG fidelity, production relay and daily-use readiness remain unqualified. The
finite ready reconciliation item is complete; the remaining scopes require their
separate prerequisites or authorization.

## 2026-10-29: viewport navigation source extraction

Candidate1.36.1-beta.7 moves worldToScreen, screenToWorld, zoomAt and pan into the
existing paper-space module and retains the core public functions and signatures.
No runtime file or dependency was added. Its cumulative manifest retains all beta6
changes and declares only core/paper-space as the new runtime delta.

Thirteen independent contracts pass. The explicit beta7 fast gate passed39/39
stages with834 selected portable checks. Hidden source navigation passed11/11
before and after; synthetic paper workflow passed6/6 with2 measured PDF groups and
7 rejected negative controls each. Geometry/history/JSON/DXF/plotHTML comparison
and actual native file bytes match; measured PDF geometry and raster match exactly.
PDF file hashes differ. Independent code/test and cumulative candidate/CI reviews
passed. These are source checks: beta7 has no new build, unpacked, visible native,
installed or daily-use qualification. Historical beta6 evidence retains its scope.

## First beta7 unpacked attempt - October 30, 2026 UTC

A fresh isolated unpacked command passed 41 portable stages/1053 checks and failed
at its first hidden source Electron launch before any application acceptance or
independent PDF check. Its generic Playwright launch error leaves the startup
cause unknown. No build output or installer was produced. All 395 tracked source
files and 209 bound inputs were unchanged through the attempt; eight synthetic
inputs were generated before launch. Failed receipts and prior reports are retained.
No unchanged retry, bypass, runtime fix or tolerance change followed. Historical
beta6 built/native evidence remains separate. Beta7 automated build/unpacked,
visible native, installed/upgrade and daily-use readiness remain unqualified.


## Beta8 rejected-fence recovery - October 30, 2026 UTC

LC-REL-01 has a bounded synthetic fence recovery repair. A one-shot artificial
state-read fault after the first accepted trim/erase restored drawing contents
but lost an erased target's selection and advanced revision. The existing catch
now restores pre-batch selection and revision after document restoration. Earlier
accepted edits and successful local/grouped Undo/Redo behavior are preserved.

The corrected eight-case regression produced five pre-fix failures and passes
8/8 after one repair. The exact beta8 fast profile passes 42/42 stages with 1061
selected portable checks and 211 fingerprinted inputs. Its cumulative manifest
retains all 59 runtime files and 12 resources; only core changes relative to beta7.
See [the fault model and limits](ATOMIC-BATCH-FAILURE-RECOVERY.md).

This qualifies the executed pure synthetic slice, not all multi-object commands,
renderer dirty-state behavior, naturally triggered corruption or crash recovery.
No new app/PDF/build/unpacked/native/installed/remote-CI gate ran. The prior beta7
startup cause remains unknown; beta6 remains the historical built/native candidate.
The broader LC-REL-01 item stays incomplete; next characterize one transform's
commit/history failure boundary before considering another repair.


## Pending MOVE failure-recovery contract - October 30, 2026 UTC

A separate LC-REL-01 [transform boundary reference](TRANSFORM-FAILURE-BOUNDARIES.md)
exposes five expected failures in nine explicit pure checks: artificial
post-assignment MOVE exceptions leave moved geometry; subsequent normal Cancel
records that move and clears prior Redo. Four success/prevalidation controls pass.
This is not a naturally triggered file-loss finding or renderer dirty test.
The pending reference is outside the selected passing candidate profile.

No runtime repair or unchanged gate/app retry was made. Beta8's prior fence repair
and historical fast qualification retain their scope; all 211 bound inputs are
unchanged. Broader atomicity remains incomplete. Next freeze reviewed differential
references for repeated COPY, terminal-input and history publication before the
remaining narrow semantic repair. A generic command-start rollback is not a fix.


## Differential transform recovery reference - October 30, 2026 UTC

The [differential reference pack](TRANSFORM-DIFFERENTIAL-REFERENCES.md) freezes
repeated/single COPY, MIRROR, typed/point ROTATE, mixed paper geometry/viewport,
preparation and post-publication history contracts. The reviewed explicit run
has 44 checks: 17 pass and 27 expected failures, with 49 scenario traces and no
harness errors. Independent review added missing failed-COPY history branches
and complete metadata comparisons. These remain artificial transient fault
findings, with no normal drawing-file loss or renderer/native claim.

No runtime repair or unchanged gate rerun occurred. All 211 historical fast
inputs and the prior pending MOVE reference remain unchanged. Both pending
references stay outside the selected passing profile. LC-REL-01 remains open;
next review the narrow terminal-branch checkpoint and its preparation/cost
before the remaining semantic repair. Earlier beta8 fence, beta6 built/native
and beta7 blocked-startup evidence retain their scope.


## Beta9 terminal transform recovery - October 30, 2026 UTC

The [bounded checkpoint repair](TRANSFORM-CHECKPOINT-RECOVERY.md) restores the
immediate pre-attempt live document, continuation, selection/revision and actual
Undo/Redo entries after qualified transient terminal-transform faults. It keeps
earlier accepted COPY batches and monotonic identity/order reservations. The
unchanged MOVE9/differential44 plus eight new preparation/control checks pass
61/61; the fresh beta9 fast gate passes45/45 stages,1,122portable checks and215
bound inputs. The cumulative identity retains59runtime/12resources and six prior
change entries; only core differs from beta8. No dependency/public API/schema change.

Full pure terminal probes record added checkpoint cost: for2,000LINEs, laterCOPY
warm medians rise from0.760-0.848ms to4.450-4.745ms. This is not an optimization,
app performance baseline or heavy-drawing qualification. Overall LC-REL-01 stays
partially implemented, with its two-attempt budget consumed. Next perform the
independent P0 LC-REL-02 save/import isolation evidence matrix. No new app/PDF/
build/unpacked/native/installed/converter acceptance ran; beta7 startup remains
unexplained and beta6 historical built/native evidence remains separate.


## Save/native import isolation reference - October30,2026UTC

The [36-check reference](SAVE-IMPORT-ISOLATION.md) passes against unchanged beta9
runtime:31actual-main/fake-Electron/owned-file checks and5real-core import/history
checks. Existing valid native bytes survive injected open/partial-write/flush/
close/rename failures; collision and denied-cleanup leftovers are distinguished.
Immediate host association/dirty/text/title and actual core Undo/Redo are checked.
The fresh expanded candidate profile passes46/46stages,1,158checks and216inputs.
No runtime, manifest, package/version, dependency or CI change occurred.

LC-REL-02 stays partially implemented. Renderer saved fingerprints/selection/
history, DXF/DWG/converter branches, development persistence/discard authorization,
operation/next-step diagnostics and broad crash/platform durability remain open.
Next define renderer Save/Open/discard failure/cancel references before any fix.
No application/native/installed acceptance or unchanged startup retry ran; earlier
beta9 and historical beta6 receipts retain their original scope.


## Renderer document-state source references - October 30, 2026 UTC

The [renderer source-function reference](RENDERER-ISOLATION-REFERENCES.md) passes
65 checks: 64 named scenarios plus inventory. Real editors and actual fingerprint,
Save/discard/replacement/Open functions verify identity/history, saved/imported
state, controlled late edits, accepted Save before canceled Open and native versus
fresh imported adoption. UI/transport adapters remain explicit. Runtime is unchanged.
The expanded profile passes 47/47 stages, 1,223 portable checks and 217 inputs.
No version, manifest, dependency or CI change occurred.

LC-REL-02 stays partial. Next freeze a failing operation/next-step diagnostic
contract before any product fix. Full renderer/preload/queued-open, host integration,
paper/3D, development/clipboard/native/crash and daily-use qualification remain open.
No Electron/application/PDF/build/converter acceptance or unchanged startup retry
ran. The first fixture-API failure is retained separately from production behavior.


## Beta10 ordinary file diagnostics - October 30, 2026 UTC

The [focused diagnostic repair](FILE-OPERATION-DIAGNOSTICS.md) adds controlled
operation/category/next-step errors for ordinary Save/Open/import, retaining exact
success/cancel/busy/trust responses and unchanged file replacement semantics.
The frozen baseline has 3/20 passing controls and 17 diagnostic-contract failures;
the final suite passes 22/22. Independent review caught and reproduced a development
restart wording regression before correction. Both fast runs and failures remain.
The final fast profile passes 48/48 stages, 1,245 portable checks and 219 inputs.
Beta10 changes only main from beta9, retaining 59 runtime/12 resources and seven
cumulative changes. No dependency/schema/geometry or installed state changed.

LC-REL-02 remains partial; next investigate development checkpoint/discard state
boundaries. Real renderer/transport/converter, crash, application/PDF/build/native/
installed/daily-use qualification remains open. Beta7 startup is still unexplained;
no unchanged application retry occurred. Historical beta6 acceptance keeps its scope.


## Development association/discard references - October 30, 2026 UTC

The [source/fake-host reference](DEVELOPMENT-STATE-REFERENCES.md) passes43checks:
42namedcases plusinventory. Actual main/queue/core validation and owned profiles
separate best-effort ordinary persistence from strict queued adoption; exact
Discard authorization, late notifications, compensation, retry, association-only
restore, packaged bypass and accepted Save/canceled Open are explicit. Independent
review strengthened restore byte checks, pending/retry and cancellation controls.
The expanded fast profile passes49/49stages,1,288portablechecks and221inputs.
Runtime/manifest/package/version/CI remain unchanged beta10; no product repair.

LC-REL-02 remains partial. Failed best-effort persistence or compensation can
leave live and disk associations different; no paired renderer restart or drawing
loss is established. Next investigate exact host/renderer recovery coherence and
Save routing before repair. Renderer history/gating/storage, warning privacy,
OS watching/transport, converter/crash/native/installed/daily-use remain open.
No Electron/application/PDF/build/converter or unchanged startup retry ran.


## Pending paired recovery target safety - October 30, 2026 UTC

The [frozen paired reference](PAIRED-RECOVERY-REFERENCES.md) has10checks:
6pass/4pending safety failures,9scenario traces and no harness errors. After an
accepted Save As and failed auxiliary checkpoint, fresh actual-main modules and
verbatim renderer recovery/Save source attempt unrelated A. A precreation barrier
preserves A and accepted B. Equal names and equal baselines plus a new recovered
edit also fail; they cannot establish identity. This is a source-model finding,
not an executed overwrite or real application-restart/drawing-loss result.

The pending reference is outside the selected passing fast profile, but its bytes
are bound as an auxiliary input. The fresh selected fast result is49/49stages,
1,288checks and222inputs; it does not claim the pending contract passes. Two earlier
9-check receipts and the initial fast profile remain preserved; independent review
strengthened safe outcomes, identity ambiguity and history before final binding.
Runtime/app/manifest/package/version/CI are unchanged beta10. No productfix or
additional repair approach was attempted. LC-REL-02 remains partial; review durable
paired identity/legacy migration and compatibility before its one remaining attempt.
LC-REL-01 retains zero remaining attempts. All application/storage/transport/native/
installed/crash/ordinary-loss limits and beta7's unknown startup cause remain.


## Recovery identity/legacy contract - October 30, 2026 UTC

[ADR-001](ADR-001-DEVELOPMENT-RECOVERY-IDENTITY.md) freezes paired opaque generation
and explicit legacy fallback, with implementation prerequisites still open. The
[new boundary reference](DEVELOPMENT-IDENTITY-REFERENCE.md) has14checks:3pass and
11expectedfailures across13scenarios. Nine are protected routing probes and two
are absent-binding prerequisites, not11overwrites. Positive-generation branches,
full frame ordering and the remaining lifecycle controls are unqualified.

The reviewed selected fast profile passes49/49stages,1,288checks and223boundinputs.
It fingerprints but excludes identity14 and the unchanged paired10 references;
it does not claim either pending contract passes. Paired10 was not rerun unchanged.
Independent review added literal content/name/dirty preservation and explicit null
import/reset metadata. Runtime/app/manifest/package/version/CI pins remain beta10.
No product repair or additional semantic approach was used. LC-REL-02 remains
partial with one earlier approach used and at most one remaining; LC-REL-01 has0.
Next complete the ADR prerequisites, then use only the remaining reviewed approach.
All application/realtransport/storage/native/installed limits and the unknown
beta7 startup cause remain; no unchanged application retry or promotion occurred.


## Recovery protocol prerequisites - October 30, 2026 UTC

[The protocol reference](RECOVERY-PROTOCOL-REFERENCE.md) freezes 37 checks:
6 passing controls, 31 expected failures and 36 scenario records. Missing protocol
and binding prerequisites block most positive branches; this is not 31 overwrites.
A returned busy reset also exposes a source-function New replacement deficiency.
No runtime repair or additional semantic approach occurred. The reference is
auxiliary-only, outside the selected passing profile alongside paired10/identity14.
Healthy renderer negotiation, dirty/imported recovery, live-generation retention
and deadline assertions remain prerequisites before the final LC-REL-02 approach.
LC-REL-01 has zero approaches remaining. All application/native/installed and
unknown beta7 startup limits remain. Prior receipts and failures are preserved.

The fresh selected fast gate passes 49/49 stages and 1,288 portable checks,
with 224 bound inputs. It excludes all three pending recovery references.


## Renderer negotiation prerequisites - October 30, 2026 UTC

[The separate renderer reference](RECOVERY-NEGOTIATION-REFERENCE.md) freezes23checks:
three controls plus inventory pass;19expected failures cover absent negotiation,
chooser routing, source deadline ordering, returned binding before actual update/
checkpoint, and returned reset failure. All22namedcases execute without harness
errors after preserved fixture corrections. Current positive negotiation/deadline
branches remain blocked. Fixed bridge replies and a manual clock qualify only
the stated source projection; main/preload/IPC are not executed.

The reference is auxiliary-only, alongside unchanged protocol37,identity14 and
paired10; none is selected by the passing fast profile and old packs were not
rerun. Runtime/main/app/preload/manifest/package/version/CI remain beta10. No
repair approach is consumed. Main live-generation/queue/replay probes, actual
ordinary-Save disk binding and integrated post-negotiation busy ownership remain
prerequisites before the last LC-REL-02 approach. LC-REL-01 remains exhausted;
application/native/installed/real-storage limits and unknown beta7 cause persist.

The fresh selected fast gate passes49/49stages,1,288portablechecks and225bound
inputs. All four pending recovery packs are auxiliary-only and excluded from
passing acceptance; input identity and focused results are recorded separately.


## Recovery live-generation and file-action ownership - October 30, 2026 UTC

[The new ownership reference](RECOVERY-OWNERSHIP-REFERENCE.md) freezes 18 checks:
seven controls plus inventory pass; ten expected failures stop at seven missing
actual-main UUID replies, one missing main recovery channel and two absent
renderer negotiation requests. All 17 named cases execute without unexpected
harness errors. Existing native-await/post-peek busy and cleanup controls pass;
positive generation and recovery-await races remain unqualified.

Actual reply/disk/confirmation probes freeze live-generation retention after
queue rejection/compensation and replay/conflict, while verbatim runAction and
queue bodies observe owned busy UI and retries. No guessed binding observer or
rewritten busy proxy is used. This is auxiliary-only, alongside unchanged
renderer23/protocol37/identity14/paired10; old pending packs were not rerun.
Runtime/helper/manifest/package/version/CI remain unchanged beta10; no repair
approach is consumed. Next review the focused main/app/preload plan against all
frozen contracts, then use at most the one remaining LC-REL-02 repair approach.
LC-REL-01 remains exhausted; application/native/installed/storage/crash and the
unknown beta7 startup cause remain unqualified.

The fresh selected fast gate passes49/49stages,1,288portablechecks and226bound
inputs. All five pending recovery references are fingerprinted auxiliaries,
excluded from passing acceptance. Exact final source input binding is separate.


## Beta11 paired recovery identity repair - October 30, 2026 UTC

[The bounded repair](DEVELOPMENT-RECOVERY-BINDING.md) implements main UUID/path
association, guarded frame/epoch/nonce reconciliation, captured chooser routing,
strict queued compensation and renderer binding-before-update with bounded safe
fallback. New/Close honor returned reset failures. Accepted native Save and
packaged replies remain intact; no content/name identity or generic rollback.

All five formerly pending packs now pass102/102 and are selected. Fresh fast
qualification passes54/54stages,1,390portablechecks and227boundinputs on beta11.
The cumulative manifest preserves59runtime/12resources; app/main/preload are the
three beta10 deltas. Real app/PDF/build/unpacked/native/installed/upgrade/daily-use,
transport/storage/crash and beta7 startup cause remain unqualified. LC-REL-02
parent remains partial; two repair approaches are consumed. Continue independent
LC-REL-03 fake-process diagnostics next; no actual converter retry is authorized.


## Pending converter lifecycle reference - October 30, 2026 UTC

[The explicit source reference](CONVERTER-LIFECYCLE-REFERENCE.md) has 28 checks:
21 pass and seven expected failures, with 27 named cases and no final harness
errors. Three failures remain pending at the prospective close-confirmation grace,
two request cleanup before confirmed close, and two return synthetic private path
markers in successful warnings. The unchanged main import error boundary already
passes its exact structured/sanitized contract; no raw-error IPC leak is claimed.

Fake children, real owned synthetic files and a manual clock qualify this source
slice only. Completed deletion before close and real orphan/process termination
are not established. Teardown closes cannot qualify product settlement, and
positive deferred cleanup after bounded rejection remains blocked. Runtime stays
beta11; no product repair or actual converter attempt occurred. The fresh selected
fast gate passes54/54stages,1,390checks,228inputs; this pending reference is auxiliary
only. LC-REL-03 remains partial with zero approaches used. Next review the bounded
lifecycle/warning repair plan; all application/native/installed and prior limits
remain. Preserve the initial cross-realm fixture failure and historical receipts.


## Beta12 bounded converter custody - October 30, 2026 UTC

[The source repair](CONVERTER-SETTLEMENT-CUSTODY.md) adds one DWG admission/custody
record, a close-confirmation grace, one-shot abort/settlement, guarded late cleanup
and successful-warning path projection. No-close/failed cleanup retains ownership;
direct DXF stays available. Repeated events and old-child data cannot resettle or
poison metadata budgets. Main/preload and drawing formats remain unchanged.

The final converter pack passes48/48 and is selected; the fresh fast gate passes
55/55stages,1,438portablechecks,229inputs. The cumulative manifest retains59runtime/
12resources and9baselinechanges, with onlyimporter differing frombeta11. Independent
privacy review reproduced an escaped-quote token leak before its correction; all
prior failures, the earlier47pass and legacy21pass receipts remain preserved.

This qualifies scheduled unconfirmed-child settlement and source custody only,
not real FS-stall deadlines, process termination/orphan absence, IPC/renderer,
broad privacy/reason custody or application/native/installed readiness. LC-REL-03
parent remains partial with1approachused/atmost1remaining; LC-REL-01/02 remain
exhausted. Next freeze the existing LC-REL-04 synthetic resource/cancellation
reference, preserving current bounds; no real converter or application retry ran.


## Import work and group-boundary reference - October 30, 2026 UTC

[The LC-REL-04 source reference](IMPORT-BUDGET-REFERENCE.md) has26checks:19pass and
7expectedfail,25namedcases and zero unexpected errors. Literal geometry and
observed20/14/15record-plus-cell units preserve ordinary/nested/empty/sibling
controls. Three failures concern a proposed work cap and two a proposed pre-abort
interface, neither currently supported. Two checks expose one actual readDXF
transport inconsistency:1,000,001complete comment/EOF pairs are accepted without a
final newline but rejected with it. No active drawing loss or overwrite is shown.

Bounded worker settings contain only the tests; no product cancellation or whole
memory guarantee follows. Existing input/output/entity/depth/cycle/array/geometry
bounds remain. Runtime/manifest/version/CI are unchangedbeta12; no product approach
is used. The selected fast profile passes55/55stages,1,438checks,230inputs and
excludes the pending26reference. Next review work-option/default/fatal-error
propagation and awaited importer cancellation/cleanup/adoption controls. All
application/native/installed and prior limits remain; no actual converter ran.


## Reviewed import cancellation contract - October 30, 2026 UTC

[ADR-002](ADR-002-IMPORT-WORK-CANCELLATION.md) freezes a prospective1,000,000-unit
shared decoder/cell default, tightening-only overrides, owned fatal identity and
acquisition-safe trusted cancellation with first-error preservation. Runtime stays
beta12; this is prerequisite work and consumes zero LC-REL-04 repair approaches.
The expanded work pack is36checks:20pass/16expectedfail; the new awaited-importer
and bounded main-Open projection is21checks:6pass/15expectedfail. Both have zero
final unexpected errors; fixture failures and earlier26-check evidence are retained.
Canned parser/metadata candidates, real core/file I/O, fake children/manual timers
and explicit main helper adapters limit these claims. No real IPC, renderer,
filesystem-stall deadline, mid-parse responsiveness or drawing-loss claim follows.
Both packs remain auxiliary-only. The fresh selected fast gate is55/55stages,
1,438checks,231exactinputs; converter48/recovery102 remain selected. Next implement
the first reviewed ADR-002 approach and qualify both pending packs. Broader
application/native/installed/daily-use limits persist; no actual converter ran.


## Beta13 bounded import work and cancellation - October 30, 2026 UTC

[The reviewed repair](IMPORT-WORK-CANCELLATION.md) at runtime9fa9b5bc implements
shared inclusive1,000,000record/cell work, tightening-only overrides, private fatal
identity, consistent logical-pair admission and acquisition-safe trusted signal
checks through final report return. Cleanup preserves prior timeout/validation
against later abort; beta12 custody, first cause, shared budgets and grace remain.
No renderer cancellation UI or event-loop responsiveness is implied.

Final work36/cancellation22/compatibility9 pass67/67, zero unexpected errors. The
fresh selected gate passes58/58stages,1,505checks,233exactinputs; all three packs,
converter48 and recovery102 are selected. Separate legacy importer21 and actual
DXF24 pass. Preserve initial fixture errors, valid pre-guard callback failure and
retained-beta12 comparison chronology. Runtime delta frombeta12 is two files;
cumulative manifest59runtime/12resources/9baselinechanges remains reviewed.

LC-REL-04 parent remains partial:one coherent approach used,atmostone remaining.
Actual IPC/renderer, real FS-stall/process/native-memory/crash and all beta13
application/PDF/build/unpacked/native/installed/upgrade/daily-use qualification
remain unperformed. Beta7 cause unknown; beta6 receipts and exhaustedLC-REL-01/02
remain intact. Next registered work is LC-PERF-01/LC-QA-006 workload/protocol
definitions, with no unchanged application retry, actual converter or optimization.


## Four workload definitions - October 31, 2026 UTC

[LC-PERF-01/LC-QA-006 definitions](PERFORMANCE-WORKLOAD-CONTRACT.md) now pin four
entirely synthetic survey-like,residential-like,several-viewport and10000-LINE
workloads. Independent literals, actual headless core roundtrip/selection and
negative controls pass33/33; a separate stdlib reader passes25/25 with15semantic
corruptions. Exactly582 planned rows per variant include570actions+12startup,
with zero observed timings. Multi-sheet storage is409entities/18views; initial
paper selection is3layer0entities; the visible/locked Viewports layer excludes
six proxies while its six active views remain eligible for rendering.
No rendering or application benchmark ran.

The expanded selected fast gate passes59/59stages,1538checks,237exactinputs.
Runtime/manifest/package/CI remain beta13 at9fa9b5bc; all five original beta5
benchmark artifacts remain exact. Node runner durations are not CAD latencies.
Next build a separate non-launching workload/plan loader and metadata rejection
controls; actual measurements remain dependent on a justified runnable path.
No unchanged application/converter/native retry, threshold or optimization is
implied; prior qualification limits and LC-REL attempt caps persist.


## Workload metadata loader - October 31, 2026 UTC

[The separate loader](PERFORMANCE-PLAN-LOADER.md) binds four generation inputs,
nine fixed payload hashes/roles and the full typed582-key plan using independent
caller trust. It imports no product code and always denies application-launch,
geometry and environment qualification. Read caps1MiBproducer/4MiBfile/16MiBtotal
allow only one overflow-detection byte. Final60/60checks cover semantic corrupt
copies, source/hash/owner/matrix rejection, authored diagnostics and416instrumented
handles closed once. Both first-draft failures and reviewed type/aggregate-read
challenges are preserved; these are QA findings, not product drawing-loss claims.
The retained sealed fixture set separately loads as582planned/0observed.

The selected source gate passes60/60stages,1598checks,239exactinputs. Runtime,
manifest/package/CI, five historical benchmark artifacts and prior four workload
code/oracle inputs are unchanged beta13; no benchmark/app/native/real converter ran.
A queue review found no next concrete ready milestone under current prerequisites.
Keep hourly ACTIVE; reassess changed intake/evidence/prerequisites, stay quiet when
unchanged, and do not invent a metadata sequel or rerun passing checks. Actual
measurements, startup cause and all broader qualification limits remain open.


## Instrumented Electron startup diagnostics - October 31, 2026 UTC

Two user-resumed isolated launch approaches characterized the blocked application
route at source55fbe051, with beta13 runtime9fa9b5bc unchanged. Pinned Playwright
with current source and a direct minimal bootstrap without Playwright, debugger
flags or Linecraft code emitted identical600-byte native EXCEPTION_BREAKPOINT
output. The direct process exited0x80000003 before its first bootstrap entry
marker. No installed application was running at either attempt. This reproduces
an early runtime/environment startup failure independently of Linecraft code;
the specific cause, including any Windows-update effect, remains unresolved.

All73distribution files match the retained cached release archive byte for byte;
this is not a new independent vendor-checksum verification. Read-only fuse
inspection permits Node inspection and leaves browser-specific snapshot selection
disabled; the nearest snapshot-symbol stack frame does not prove a fuse/snapshot
cause. No fuse, dependency, runtime, manifest, security setting or drawing changed.

The first Playwright driver ended on an internal unhandled rejection before its
structured final report; bounded raw logs and execution evidence are preserved.
Its owned-tree cleanup reported an authentication error; permitted process checks
after both attempts found no relevant process. This is not global orphan proof.
No hidden-window/application/PDF/build/native/installed acceptance or performance
measurement follows. Preserve the historical failed gate and beta6 receipts.
Next review an explicitly authorized normal-desktop minimal control or precise
native crash evidence; do not repeat unchanged managed launches or repair a
merely suspected cause. Broader qualification remains incomplete.


## Outside-context minimal Electron control - October 31, 2026 UTC

One explicitly authorized additional control ran outside the managed tool
execution context using the same Electron executable and minimal bootstrap bytes
as the previous direct control. It reached the first entry marker, Electron
readiness, its exact owned profile and a hidden synthetic data-URL renderer, then
quit cleanly with exit0. No forced cleanup was needed; no relevant owned process
was found afterward. Earlier managed exit0x80000003 and native logs are retained.

This is an observed execution-context difference, not identification of a specific
sandbox policy, token, environment value or OS cause, nor proof of manual
interactive login. No administrator elevation was requested; actual token
elevation was not measured. The renderer sandbox remained enabled. No Linecraft
code, Playwright, drawing operation, PDF/build/native/installed acceptance or
performance workload ran. Runtime/version/manifest/dependencies remain unchanged.
The one-control authorization is consumed; next evaluate a separately authorized
isolated source/application run in the working context. No further launch or
broader qualification is implied by this minimal control.


## Isolated source-app startup smoke - October 31, 2026 UTC

One explicitly authorized hidden source-app launch outside the managed tool
context reached Node/Chromium debugger attachment and actual renderer/preload
APIs. Four groups passed: source mode/pinned package-Electron identity, exact owned
userData/sessionData, initial hidden window, and source index/editor-canvas APIs.
The app closed normally with exit0; no forced cleanup or further launch occurred.
Installed EXE/ASAR bytes match before/after; whole-profile byte preservation was
not measured. Runtime/version/manifest/dependencies remain unchanged beta13.

The smoke driver returned1: its private oracle incorrectly required serialized
empty sheetSets=[] even though the serializer intentionally omits that optional
empty field. The raw4passed/1failed/5notrun result and original assertion remain.
A separate headless serializer check confirms the contract, not remaining app
checks. The document/snapshot was not persisted before the failed assertion;
final visibility and later clean/idle/history/restore checks are not qualified.
Two GPU ERROR-level messages occurred during shutdown after debugger disconnect;
their significance remains unresolved. No GPU/security setting was changed.

This demonstrates source startup to renderer APIs, not a complete smoke, drawing,
Open/Save/PDF/build/native/installed/daily-use or performance qualification. Next
use the actual serialization contract or existing application/PDF workflows in a
separately authorized scope. The single source-app authorization is consumed;
do not automatically rerun or convert a harness failure into an app defect.


## Focused source drawing/save/reopen/PDF workflow - October 31, 2026 UTC

One separately authorized hidden source-app session at c5a6676a completed five
startup and six workflow groups. Actual Open imported a copied synthetic mm DXF;
the production renderer command API added a literal20mm model LINE. Actual Save
As/New/Open preserved the complete serialized semantic drawing in the same
process. Production plot-dialog/preload output retained the reopened document.
Test-owned chooser replies restricted all opens/saves to the isolated test files.

An independent reader measured three opaque black rulers at declared paper
positions:40mm,20mm and10mm, within0.02mm coordinate/length tolerance. The single
page measured420.200665x297.010661mm, within the declared0.3mm A3 tolerance.
A PDF-hash-bound Poppler144dpi raster was visually inspected and sampled for
visible ink. Seven deliberately incorrect observation controls were rejected;
these were not seven actual malformed PDF files. Driver and application exited0
without forced cleanup. Installed EXE/ASAR hashes remain exact before/after.

Runtime/version/manifest/dependencies remain beta13 at9fa9b5bc. The earlier
4pass/1incorrect-oracle-fail/5notrun smoke remains separate historical evidence.
This focused same-process command-API/owned-chooser test does not establish
native input, process restart, installed/upgrade/daily-use, full application/PDF
gate or performance acceptance. Whole-profile byte preservation was not measured.
The one-workflow launch authorization is consumed; no further application run is
implied. Preserve prior qualification limits and repair/converter attempt caps.


## Indexed shaded mesh outlines - October 31, 2026 UTC

Beta14 source removes internal coplanar triangle outline segments from ordinary
indexed shaded meshes while retaining boundaries and sharp corners. Geometry,
entity boundaries, roof-owned rendering, picking and wireframe paths remain
unchanged. [The source regression and limits](MESH-SURFACE-EDGES.md) describe
the literal quad failure, conservative adjacency rules and painter-order checks.

The new13checks pass in a61/61-stage selected fast gate:1611portable checks and
241exact working inputs. The59-runtime/12-resource cumulative manifest retains
all prior changes plus the two-file visual correction. Historical beta13
application/PDF evidence remains bound to its earlier runtime. No beta14 app,
browser raster, build, native, installed/upgrade/daily-use or performance run
occurred. Added per-redraw adjacency work is not a demonstrated speedup; GPU
load/VRAM cause remains unknown. Profile a bounded synthetic3Dworkload before
performance changes. Separate-entity/duplicate-index boundaries are not welded;
the user's other drawing was not read or qualified.


## Prepared synthetic 3D visual/profile session - October 31, 2026 UTC

A bounded six-fixture application/raster/CPU harness is prepared without any
application launch. [The plan and limits](MESH-3D-VALIDATION-PLAN.md) distinguish
independent analytic reader controls from future actual canvas observations.
The proposed single hidden run uses fresh owned profile/output paths and needs
separate authorization. Runtime and all241 retained fast-gate input hashes remain
unchanged; no unchanged passing gate was rerun. Performance, beta14 application,
PDF/build/native/installed/upgrade and daily-use qualification remain open.

## Actual synthetic 3D observations - October 31, 2026 UTC

The approved one-shot beta14 session completed five startup and five observation
groups, but its independent flat-raster acceptance failed. The unchanged reader
reports two flat-seam failures and two fold/wireframe passes; all three profiles
and 35 unprofiled observations were collected and audited. See
[the actual result and limits](MESH-3D-OBSERVATIONS.md). Installed binaries and
all 336 pinned inputs remain unchanged. No repair, tolerance relaxation or
application retry occurred. Diagnose the residual seam using preserved evidence;
the hourly loop stays active and the one-shot launch approval is consumed.

## Residual seam reference - October 31, 2026 UTC

The source-only [coverage reference](MESH-SURFACE-COVERAGE-REFERENCE.md) models
actual production fill polygons against independent opaque-surface expectations.
Final result: 11 tests, 9 pass, 2 expected uniformity failures, exit 1. Calculated
dark pixels agree closely with the preserved actual images; this supports a
fill-coverage explanation without claiming an exact browser model. The new
pending test is outside the selected passing gate. Runtime and all 336 prepared
inputs remain unchanged; no unchanged passing gate, application or performance
test was rerun. One repair approach remains at most. Next compare bounded repair
options and ordering/occlusion/transparency counterexamples before implementation.


## Surface-colored internal mesh edges - October 31, 2026 UTC

Beta15 follows the user's direction to match internal edge colors to their
surface. Ordinary opaque shaded meshes paint classified internal coplanar edges
with their exact shaded fill color, at the existing 0.7-pixel outline width.
Each stroke stays with its depth-sorted triangle; real outlines/creases retain
their paths. Roof-owned, translucent-preview and wireframe paths are unchanged.
Saved geometry and dependencies do not change.

The first regression had 30 tests, 26 passes and 4 genuine failures. The final
focused suites pass 32/32; the new selected fast gate passes 62/62 stages,
1,630 portable checks and 243 exact inputs. The prior beta14 manifest and failure
evidence remain preserved. See [the paint model and limits](MESH-SURFACE-COVERAGE-REFERENCE.md).
The runtime delta from beta14 is only app.mjs; the beta15 cumulative manifest
still covers 59 runtime files, 12 resources and ten cumulative changed files.

This consumes the second repair approach for LC-3D-SURFACE-EDGES, leaving none
under the current budget. Actual beta15 application/raster/PDF/build/native,
installed/upgrade/daily-use and performance qualification has not run. Analytic
seam colors pass the unchanged RGB tolerance 8; they are not captured pixels.
Corner/sliver controls expose bounded lateral overdraw, not boundary-color or
corner-pixel acceptance. Existing app launch approvals remain consumed. Next
prepare a bounded visual confirmation using the preserved fixture/probe contract
plus explicit corner/sliver observations; no automatic launch or new repair.


## User-requested planarity tolerance comparison - October 31, 2026 UTC

The finite [synthetic tolerance experiment](MESH-PLANARITY-EXPERIMENT.md) compared
six angular thresholds and six known-plane projection distances. It passed
429 counted control groups and recorded 168 helper/copy timing observations.
Looser classification and the preflattened copy did not improve measured helper
speed; all 3,200 triangles remained. The same distance threshold can erase an
intended shallow crease, so no universal auto-snap tolerance was adopted.
Production files, the beta15 manifest and all 243 prior gate inputs remain
unchanged; no unchanged gate or application run was repeated. User visual
confirmation and any geometry-changing cleanup decision remain separate.


## Prepared beta15 visual confirmation - October 31, 2026 UTC

The [visual-only proposal](MESH-BETA15-VISUAL-PLAN.md) refreshes the existing
synthetic harness for beta15 without a launch. It preserves the original four
raster checks/tolerance and adds acute-corner and half-pixel sliver observations
for human review. Five synthetic Opens would produce six canvas and six bound
hidden-window images at DPR1. No performance workload is included. New fixture,
reader, syntax and refusal controls pass; original fixtures/auditor and all 243
source-gate inputs remain exact without an unchanged gate rerun. The proposed
one-run scope needs new approval; prior authorizations are consumed, and no
product repair attempt remains under the current mesh-edge budget.


## Full-precision comparison and teapot preparation - October 31, 2026 UTC

The user-requested [follow-up](TEAPOT-NUMERICAL-LIGHTING-REVIEW.md) separates
1 mm projection from numerical comparison with unchanged coordinates. Three
processes showed a slower complete projection pipeline; no tested numerical
threshold met both the predeclared speed and surface criteria. A synthetic
7,096-triangle teapot and combined nine-view-pair application proposal are
prepared without launching. Source inspection explains the dark shading range;
open-source renderer options were researched without adding a dependency.
Runtime beta15, production tolerance and source-gate inputs are unchanged.
Actual teapot images, lighting judgment and application performance await the
new concrete run approval. Broader qualification and repair limits remain open.


## Actual beta15 surface and teapot observations - October 31, 2026 UTC

The [single combined source-app session](TEAPOT-APPLICATION-OBSERVATIONS.md)
completed with five startup and five workflow groups passing, nine actual
canvas/window pairs and four preserved raster roles passing unchanged tolerance8.
The flat diagonal still has sampled patch contrast7; numerical acceptance does
not imply complete visual disappearance. The user accepted the presented shaded
teapot appearance. Ten control-response observations and one separate JavaScript
profile provide a bounded baseline, not a speedup/FPS/GPU claim. All346 launch pins
and85 preparation files remain exact; no runtime change, unchanged gate rerun or
second application launch occurred. The one-run approval is consumed, the mesh-edge
repair budget remains0, and broader/native/installed/daily-use limits remain open.


## Beta15 candidate build and local trial installation - October 31, 2026 UTC

The separately authorized personal-trial update completed at tested source
`ac7e08b9addd7f571832f71a6ed47c943b23d0c5`, runtime
`dc9aa4f3e666e3fc10614e9ec538f15ee4625e69`, version1.36.1-beta.15.
The complete local candidate gate passed78/78 stages: selected portable checks,
seven source and seven unpacked application/PDF workflows, unpacked packaging and
NSIS compilation. This advances the current candidate record; it does not rerun
or retroactively pass the historical beta7/managed-context failures, whose exact
cause remains unresolved.

The verified per-user installer completed once with exit0. All87 final packaged
payload files match the installed copy, including 59 runtime files in app.asar
and 12 external resources. Registry version and desktop/Start-menu shortcut targets
match. The prior89-file installation and74-file profile were backed up and hash
verified; all74 profile files remained unchanged, with no added profile files.
DWG/DXF associations were preserved. No normal-profile startup or installed native
input test was performed. Installation and exact-file verification are not broad
upgrade compatibility, native/client or daily-use acceptance. The installer is
unsigned, and nothing was published or uploaded.

The resume request prompted this evidence reconciliation only: no application,
test, build, installation, product repair or source-runtime change was repeated.
The hourly loop remains active. Historical beta6 native evidence stays separate;
new launches, reinstallations and exhausted mesh-edge repairs are not authorized
by resuming the loop. Future work must have a concrete authorized scope.
