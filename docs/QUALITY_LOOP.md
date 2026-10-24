# Quality loop

Use Node24, the pinned local dependencies, Windows x64 for application/build checks,
and the pinned Python PDF reader described in tests/README.md. No installation of
the daily-use app is part of these commands.

```
npm run qa:fast -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.2.json
npm run qa:application -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.2.json
npm run qa:candidate -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.2.json
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
