# Beta6 import headline counts

Current focused native headline/dialog and persistence acceptance passed on the
existing unpacked beta6 candidate. See [the native record](NATIVE-BETA6-ACCEPTANCE.md).
The automated checkpoint and its originally pending checks below retain their
historical scope; installed/upgrade and broader qualification remain separate.

LC-MON-008 fixes the existing renderer headline that labeled all accepted model
and paper objects as model-space geometry. The mixed synthetic DXF previously
displayed:

    DXF import: 3 supported objects in model space and 1 paper layout; 1 model-space source records.

Beta6 displays:

    DXF import: 3 supported objects total (1 model-space, 2 paper-space); 1 paper layout; 1 model-space source record.

The change is confined to three lines in showImportReport in app.mjs. Total uses
the existing importedEntities count; paper sums the existing accepted per-layout
entity counts; model is total minus paper. Layout viewports are separate metadata,
not supported primitives. modelSourceEntities remains explicitly source records,
which may differ from accepted model output after expansion or skipped records.
Object/layout/source-record singular and plural forms are consistent. No importer,
core, schema, geometry, settings, warning transport or file association changes.

## Regression and actual evidence

Seven focused checks execute the actual production renderer function in a small
text DOM. Independent literal expectations cover model-only output with different
source count, mixed model/paper, paper-only, two layouts, empty-paper viewport
metadata and format fallback/singulars. A compatibility case retains paper detail,
skipped counts, warning wording, modal behavior and input-object nonmutation.
The preserved beta5 result is1 pass/6 expected failures. All7 pass after one repair.
The DWG-label and other count cases are manufactured report metadata, not fresh
DWG conversion or actual import acceptance.

An actual pre-fix hidden beta5 session imports the untouched original paper-SOLID
DXF. Independent literal geometry is one model LINE(-100,-100)-(-90,-100), paper
LINE(10,10)-(20,10), and a solid HATCH rectangle(20,30)-(60,50), area800mm2, on one
420x297mm sheet. Actual fresh headline/log is incorrect, while complete native
Save As/New/Open and geometry succeed. The overall pre-fix result is failed; its
two passing prerequisite rows are not passing headline acceptance.

The fresh exact beta6 candidate gate passed40/40 stages and655 selected portable
checks. It runs the7 new renderer regressions and the new actual3-check headline
workflow against source and the newly built unpacked app. Each actual case checks
literal geometry, full persistence, fresh headline plus log, and source/input
preservation. The report box is read whether or not its warning-dependent dialog
opens. Opening the saved native file checks persistence, not a fresh import report.

All nine imported/native/reopened byte streams across before/source/new-unpacked
match SHA-2567d567b9c243f2868da2464c196ba286a203e8a569367ba485ad267dc0aed5daa.
Full parsed state, source DXF bytes, dialog state and every nonheadline report row
also match. Only the headline/log wording changes. Existing independent default
PDF workflows pass in the fresh gate; the headline workflow adds no separate PDF
or broad visual/native fidelity claim.

All three explicit before/source/unpacked sessions stayed hidden, with zero show
events, observed external requests, page errors or clipboard calls. Owned choosers
record2Open/1Save calls per session. No native desktop input, installed profile,
client drawing, original fixture or prior candidate/receipt was modified. Workflows
have finite120s watchdogs/180s wrappers; the candidate wrapper remains30minutes.
Independent read-only reviews recomputed counts, hashes, state, manifest and outputs.

## Candidate identity and remaining acceptance at the automated checkpoint

The explicit beta6 manifest is qa/CANDIDATE-SOURCE-1.36.1-beta.6.json, SHA-256
0256237cea5efcda2691069eb1db1e73eb01628297c7e744d995332653483340.
Its parent beta5 manifest is preserved at82406c7476a219ec0bd304e1202a74f2bcd84541acb5ce5c499e8814abfcb0cb.
All59runtime/12resource entries and the cumulative five baseline changes are
reviewed. Only app.mjs changes from beta5, SHA-256
f7649f4ffe6cb255726f32c5966ec437797e33cd428b4e1abae444d020d915a0.
Metadata/CI pins advance tobeta6; older manifests and artifacts remain immutable.

The new unpacked app was tested; its installer was compiled but not run. Installer
size132,963,710 bytes, SHA-2568aceaf30f46cd169742563fbe09df0bdff9ae5b1988dea1f40e0ba44b89834b1.
The gate originally recorded the parent commit with owned working changes. The
local final commit binds those exact tested runtime, manifest and test bytes; the
original gate source receipt is retained. No push, tag, merge or publication occurred.

Native beta6 headline/warning-dialog acceptance, inherited missing-glyph warning
acceptance and installed/upgrade qualification remain pending. Editable DWG output,
general font/template/client fidelity and production relay integration remain
unqualified. Daily-use readiness is false; all attachment requirements are not
complete. A safe existing follow-up remains: independently specify synthetic mixed
A4/A3 paper ordering and physical PDF rulers under LC-QA-MULTISHEET, without client,
domain-font or native input decisions. The hourly loop remains useful and active.
