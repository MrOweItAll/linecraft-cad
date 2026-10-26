# Quality loop

Use Node24, the pinned local dependencies, Windows x64 for application/build checks,
and the pinned Python PDF reader described in tests/README.md. No installation of
the daily-use app is part of these commands.

These commands do not install a scheduler. See
[unattended development](UNATTENDED-DEVELOPMENT.md) for the bounded local scheduling
contract; exact local state belongs in the private quality pointer. Earlier dated
manual/unattended statements below retain their historical scope.

```
npm run qa:fast -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.4.json
npm run qa:application -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.4.json
npm run qa:candidate -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.4.json
```

These reuse desktop/dev-tools.cjs. Fast selects the existing bounded public core
and eleven pure suites, plus explicit importer, reference and QA-control checks.
Application runs the established hidden32/PDF9 and real-loopback drafting/import
smoke. Candidate runs these checks, builds an isolated unpacked executable, repeats
both application flows against it and compiles an installer without installing or
publishing. Each failed required check or unavailable prerequisite returns nonzero.
The candidate command verifies automated build readiness; daily-use readiness is
always separate and remains false without native acceptance and release approval.

Every invocation writes immutable results.json, SUMMARY.txt and gate.log below
work/qa-runs. Reports include commit, dirty state, manifest identity, exact commands,
versions, elapsed wall time and evidence. Do not publish these private local paths.
Source inputs are fingerprinted before and after the gate; application reports must
be fresh. Existing public reports and earlier failed stage directories are retained.

The QA lock is created exclusively at work/quality-gate.lock.json. An overlapping
invocation fails without touching the holder. After interruption, inspect the PID,
run directory and process state. Archive a proven stale lock with its evidence;
never delete a live lock. A session also maintains a private development ownership
record outside this checkout. One code writer owns this checkout; reviewers read.

Budgets: at most3 completed backlog items or60 minutes of active repair, at most2
distinct fixes per issue. Test/build time is accounted separately. Individual pure
and app stages have3-minute limits; build/bootstrap stages10 minutes. Wrapper limits
are5 minutes fast,10 application,30 candidate. Timeout stops only the owned child
process tree. Preserve failed evidence rather than retrying until green.

## Identity and references

PUBLIC-SOURCE.json remains the immutable1.36 baseline. The default old verification
commands still enforce that baseline and intentionally reject changed candidate
runtime/version. Candidate commands require an explicit separate manifest. Create
a new manifest only after reviewing one named runtime change:

```
node tools/create-candidate-manifest.cjs qa/NEW-CANDIDATE.json dwg-import.mjs LC-MON-002 "Reviewed reason"
```

The command refuses overwrites. Candidate identity binds the original baseline hash,
baseline commit, distinct version, complete runtime/resource closure and exact
before/after hashes plus issue/reason. A changed file absent from that reviewed
list fails. A future runtime change requires another deliberate reviewed manifest;
updating identity never substitutes for behavioral tests or approved reference data.

Synthetic floor/site/detail/larger fixtures live in tests/quality-fixtures.mjs;
the sheet is created through the real controller. Literal geometry expectations
and the independent PyMuPDF reader establish numerical answers. PDF ruler tolerance
is0.02mm; point matching allows0.04mm combined endpoint distance for Chromium PDF
coordinate quantization. Model direct coordinates compare exactly; transformed
block coordinates allow1e-10 model units for trigonometric arithmetic. Do not
increase tolerances to conceal a failure. Visual render review is separately recorded.

The smoke covers controller commands, translation preserving length, annotation
edits, grouped Undo/Redo, locked1:48/1:360 viewports, Save As/new/reopen, actual DXF
export, actual PDF127mm/50.8mm rulers, and repaired HATCH import/save/reopen/PDF.
Its independent DXF group reader checks the two ruler segments only. Hidden app
tests use owned native chooser replies, forbid OS clipboard access and stay offline.
They do not establish physical input, normal Windows choosers, DPI or installed
human acceptance. Native AutoCAD comparison is not performed by this loop.

The active beta2 manifest is separate from the preserved beta1 CANDIDATE-SOURCE.json.
Beta2 also selects viewport-center-import.test.mjs and imports an untouched synthetic
World Top layout through the real app. Save/reopen and actual PDF measurements check
its40mm model ruler at paper midpoint150,197mm and unchanged10mm paper sentinel.
No scripted viewport replacement or center correction is used in that exercise.
Nine frozen beta1 non-Top output digests establish change isolation only; general
twisted/oblique/Bottom correctness and new native coordinate-system parity remain
unqualified. Original private controls remain private and are recorded separately.

## Release and recovery

Keep the published1.36 installer/checksums and source checkpoint intact. Candidate
builds go under their unique QA run directory. Native files keep the existing
schema; no migration is introduced by the HATCH importer repair. Recovered new
imports may allocate additional IDs; existing saved documents retain their IDs.
Use original pre-import drawings for rollback, and test candidate native copies
with the baseline reader. Never downgrade over a newer drawing without a copy.

Daily-use promotion requires exact-candidate native changed-workflow acceptance,
normal dialog checks, output review and separate release authorization. No tag,
push, merge, install, scheduler or messages are side effects of QA. Two15-minute
practice sessions per week can focus feedback on changed drafting behavior.

Manual invocation ready; unattended execution not enabled. The separate QA workflow
configuration runs tests on proposed changes when committed/pushed; drafting it
does not install a worker or prove a remote CI run. Existing publication triggers
are preserved and must be reviewed before any future tag or release push.

## Recorded native beta2 acceptance

The exact unpacked 1.36.1-beta.2 has completed focused visible Windows importer
acceptance with native input, normal dialogs, exact persistence and independent
PDF measurement/render review. See [the acceptance record](NATIVE-BETA2-ACCEPTANCE.md).
This does not waive the separate installed/upgrade checks, broader platform
qualification or release authorization. No app code changed during this session.

## Active beta3 tick-width coverage

Beta3 preserves the beta2 importer and adds optional geometric dimension tick
width. Its explicit cumulative manifest names all five changed baseline runtime
files; four are new tick-width changes. Baseline/beta1/beta2 identities stay intact.
Candidate gates also select tick-width-reference.test.mjs and tick-width.test.mjs,
and run tick-width-workflow.cjs against source and unpacked applications. This
adds native-service persistence/UI checks and independent legacy/explicit/cleared
PDF audits with opacity, paint-order and geometric-width negative controls.
The one-file manifest creation example above remains a bounded single-file tool;
multi-file changes require deliberate review of every cumulative manifest entry.

## Recorded native beta3 tick-width acceptance

The exact unpacked 1.36.1-beta.3 has passed focused visible Windows tick-width
acceptance with native settings input, normal dialogs, complete persistence and
independent actual PDF measurement/render review. See [the acceptance record](NATIVE-BETA3-ACCEPTANCE.md).
The recorded passing automated gate and runtime remain unchanged. Installed/upgrade
checks, broader human/DPI/client fidelity and separate release authorization remain
pending. This session does not replace historical beta2 importer coverage with a
fresh beta3 native import claim. Manual invocation ready; unattended execution not
enabled.

## Active beta4 paper SOLID coverage

Beta4 adds the selected 36-check paper-solid-import.test.mjs suite and an actual
paper-solid-workflow.cjs stage for source and unpacked applications. The four new
fixture/test/auditor files are bound by the gate input fingerprint. The imported
layout is plotted unchanged, with literal fill position and 40 by 20 mm area geometry,
opaque paint/order checks, actual raster coverage and negative controls.

The cumulative manifest still lists five changes against the immutable 1.36
baseline; only dwg-import.mjs changes relative to beta3. Older identities remain
immutable. Fresh automated candidate acceptance does not replace exact beta4
visible native input/dialog checks, installed upgrade acceptance or release
authorization. Manual invocation ready; unattended execution not enabled.

## Recorded native beta4 paper SOLID acceptance

The exact unpacked 1.36.1-beta.4 passed focused visible native paper-SOLID Open,
edit/history, real Save As/New/Open and PDF dialogs, and atomic rejected nonplanar
Open. Six actual native checkpoint receipts are counted separately from the
unchanged independent PDF auditor's two measurements and seven negative controls.
Complete-state comparisons, actual-file hashes, fresh PDF render review, four
exact older-reader comparisons and normal-quit preservation are recorded in
[the acceptance record](NATIVE-BETA4-ACCEPTANCE.md). No runtime or tolerance change,
rebuild or repeat of the unchanged automated gate occurred. LC-MON-008 separately
tracks pre-existing import-report wording. Installed/upgrade and broader human/DPI/
client fidelity remain pending. Manual invocation ready; unattended execution not
enabled. Separate installation/promotion/release authorization remains required.
