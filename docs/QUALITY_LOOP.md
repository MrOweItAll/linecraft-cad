# Quality loop

Use Node24, the pinned local dependencies, Windows x64 for application/build checks,
and the pinned Python PDF reader described in tests/README.md. No installation of
the daily-use app is part of these commands.

These commands do not install a scheduler. See
[unattended development](UNATTENDED-DEVELOPMENT.md) for the bounded local scheduling
contract; exact local state belongs in the private quality pointer. Earlier dated
manual/unattended statements below retain their historical scope.

The latest focused native result is the existing unpacked beta6
[headline and inherited glyph-warning acceptance](NATIVE-BETA6-ACCEPTANCE.md).
It does not establish installed/upgrade or broader native qualification. Earlier
automated checkpoint descriptions below do not include this later native session.

```
npm run qa:fast -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.7.json
npm run qa:application -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.7.json
npm run qa:candidate -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.7.json
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

## Ordered multi-sheet coverage

Candidate fast selection now includes multisheet-reference.test.mjs. Source and
unpacked application selection includes multisheet-workflow.cjs and its independent
actual two-page PDF audit. The four new files are explicitly fingerprinted.
See [the coverage record](MULTISHEET-QUALITY.md) for literals, output bindings,
reader controls and limits. This milestone executed fast21/21, source application5/5
and the new targeted existing-unpacked workflow; the extended33-stage candidate
build was not rerun. Public fixture coverage does not establish client/font parity.

## Registered font and layout coverage

Candidate application selection now includes font-layout-workflow.cjs for source
and unpacked execution; its fixture, workflow and independent auditor are bound by
the gate fingerprint. The synthetic A4 reference checks regular registered Arial
and Times New Roman plus condensed Arial, actual complete persistence and the
production PDF bridge. Each new targeted source/unpacked run passed four app
checks, nine independent measurements and seventeen rejected reader controls.
See [the coverage record](FONT-LAYOUT-QUALITY.md) for the independent installed-font
reference, exact scope, initial environment failure and unqualified features.
The extended full gates were not rerun. Font availability, measured output,
native desktop input and general client/template fidelity remain distinct claims.

The optional `--architectural-fonts` workflow profile adds independently verified
ARCHITXT/Technic repeated-H output and keeps the regular profile as the default.
Use a distinct result prefix and require architectural profile identity for this
explicit local acceptance command. Default candidate application/CI selection
retains the regular profile and adds no architectural-font prerequisite.
The new font-resources pure suite covers five injected/pure fallback boundaries;
the fresh extended fast gate passed 22/22 with 639 selected portable checks. Targeted
architectural source/unpacked flows each passed 4 app checks, 9 measurements and 17
rejected reader controls. See the appended [coverage record](FONT-LAYOUT-QUALITY.md)
for symbol-cmap handling, regular compatibility and the limited glyph scope.

## Active beta5 missing-glyph diagnostics

Beta5 changes only core.mjs relative to beta4, preserving existing missing-glyph
diagnostics across plain TEXT/MTEXT, leaders and dimensions. The new nine-check
portable suite is selected; its synthetic fixture, actual workflow and independent
PDF auditor are fingerprinted. A fresh exact-candidate gate passed 37/37 with648
selected portable checks, including all current source/unpacked default workflows.
The separate local Technic case passed 4 app/8 PDF/18 rejected controls against
source and the new unpacked build. See [the diagnostic record](MISSING-GLYPH-DIAGNOSTICS.md).
Actual glyph replacement/appearance, import/DXF diagnostics and native beta5
acceptance are distinct and remain outside this verification claim.

## Optional deterministic drawing measurements

The explicit performance-workflow.cjs records fixed synthetic open/select/clear/
pan/zoom/save/file-reload observations, with one warm-up and five measured rounds
in source and an existing unpacked candidate. Its independent stdlib auditor checks
exact geometry/content, navigation arithmetic, timing/statistic validity and15
rejected controls. New scripts are fingerprinted auxiliaries, not default timing
gate stages. See [the measurement baseline](PERFORMANCE-BASELINE.md) for actual
boundaries, raw data, variation and limits. No arbitrary usability threshold,
physical-input or product speed improvement claim is made.

## Explicit development recovery coverage

The separate reload-workflow.cjs checks actual watched-file source reload and
controlled dirty source-host restart, preserving complete accepted drawing/view
and dirty/name while clearing active prompt/selection/Undo/Redo. Its unpacked
profile separately checks dev-reload disabled and explicit saved-file Open after
normal clean process restart. See [the qualification record](DEVELOPMENT-RECOVERY-QUALITY.md).
The three files are fingerprinted auxiliaries, not default CI/application stages.
Acquire shared source ownership before the metadata-only watcher trigger. Native
input, crash durability and installed/upgrade acceptance remain separate.

## Local synthetic relay protocol

The explicit tools/local-development-relay.cjs ledger and actual workflow add
durable synthetic request/progress state, revision/owner fencing, replay and
decision-needed gates without app execution or outbound integration. The15 focused
checks and separate18-CLI/8-event scenario are local-only; an independent stdlib
reader verifies11 measurements and12 rejected controls. See [the protocol](LOCAL-DEVELOPMENT-RELAY.md).
Five files are fingerprinted auxiliaries; no default gate stage or transport is
enabled. Real intake/pickup/files/messages and domain authorization remain separate.

## Active beta6 import headline coverage

Beta6 changes only app.mjs from beta5 to distinguish accepted total/model/paper
geometry and source records in the existing headline. The selected7-check renderer
suite retains1pass/6expected pre-fix failures; both source/newunpacked actual
headline/persistence workflows pass3checks. A fresh candidate gate passed40/40 and
655selected portable, with exact before/after native bytes and unchanged nonheadline
report text. See [the fix record](IMPORT-HEADLINE-COUNTS.md). No importer/core/schema
change, installed use or native human acceptance is implied. Next safe existing
follow-up: synthetic mixed-paper output coverage; keep the hourly loop active.

## Explicit mixed-paper child profile

Append --mixed-paper to multisheet-workflow.cjs to exercise the separately identified
A4portrait/A3landscape fixture. The reader requires matching profile identity and
checks20 measurements plus23 rejected controls, including rawMediaBox/CropBox and
rotation. Default regular behavior retains18/13; a preserved actual regular PDF
re-audit matches prior arrays exactly. Four new pure references are selected and
fingerprinted. Targeted source/existingunpacked4/20/23 and7combined pure references
passed; extended full gates/build were not rerun. See [the record](MIXED-PAPER-QUALITY.md).

## Explicit synthetic plan/detail child

The dedicated plan-detail-workflow.cjs preserves the existing regular/mixed flows.
Its new child retains the original detail model and adds locked1:48/1:24 A3 sheets.
Four new pure references are selected; all four files are fingerprinted auxiliaries.
Actual targeted source/existingunpacked4app/50PDF/28controls passed, including
literal wall/block/dimension/fill geometry, rounded4on2off physical dashes and
37/59 actual432dpi ink/gap samples. Combined pure11/11 and QAcontrols2/2 passed.
See [the record](PLAN-DETAIL-QUALITY.md) for the preserved reader failure/correction,
unchanged tolerances and scope. Default application stages, runtime/manifest and
existing40-stage gate remain unchanged; extended fullgates/build were not rerun.

## Explicit rotated annotation calibration

The dedicated rotated-annotation-workflow.cjs checks default aligned dimensions
and45degree leaders at locked1:48/1:96. Four new pure references and all four new
files are selected/fingerprinted without changing default application stages.
Targeted source/existingbeta6unpacked cases each pass4app/42PDF/28controls;14actual
local1728dpi sites perpage include off-stroke arrowinteriors. Native bytes,
measurement objects and4renderpairs match; full/annotation renders inspected.
See [the record](ROTATED-ANNOTATION-QUALITY.md) for independent60-80-100 geometry,
semanticbaselines,tolerances and unqualified typography/native/client claims.
Existing40/40/655candidate closure remains unchanged; extended fullgates/build
were not rerun.

## Explicit registered rich-MTEXT calibration

The dedicated richtext-workflow.cjs and independent audit-richtext-pdf.py qualify
three single-run/no-wrap Times regular/bold/italic paragraphs. Both targeted
source/existingbeta6unpacked cases pass4app/12PDF/26controls;4newpure and2QA tests
pass. Native source/plain/settings,12measurementobjects and2renderpairs match.
DirectSFNT A-apex/hmtx/name/cmap references bind3requiredfaces and each glyph's
position/advance/emsize; positiveinkclips do not establish fulloutline/inkheight.
See [the record](RICHTEXT-QUALITY.md). Default application stages and runtime/
manifest remain unchanged; extendedfullgates/build were not rerun. Current private
queue/automation state and pending coordinated checks live in the quality pointer.

## Preserved DWG attribution follow-up

[DWG-READBACK-ATTRIBUTION.md](DWG-READBACK-ATTRIBUTION.md) separates source-version
projection rules, process diagnostics and decoded handle observations. Preserve
the original two writer attempts and failures. The next finite source-only
allocation audit may trace placeholder0x1F and fallbackVX_CONTROL0xB branches;
it must not rerun conversion, rebuild, repair viewport IDs or infer native
editability. Existing application gates need no repeat for this docs-only audit.
Independent binary consumer, exact build lineage, client/domain/native and
installed/upgrade acceptance remain explicit open requirements.

## Completed finite DWG source allocation audit

The [allocation record](DWG-ALLOCATION-ATTRIBUTION.md) distinguishes source-path
consistency from exact compiled lineage and native/consumer acceptance. Preserve
all original attempts, files, diagnostics and the two-attempt writer cap. No new
writer/readback/rebuild or app gate is needed for this docs-only checkpoint.
Reconcile the private queue and pause when no authorized safe item is ready. A
future converter repair needs independent failing regression, build prerequisites
and explicit new attempt accounting; it must not reuse old passing observations
as proof of a repaired binary. Native/client/installed checks remain separate.

## Focused beta6 native acceptance reconciliation

The completed one-off native session passed fresh DXF headline/dialog checks,
complete synthetic native Save As/New/Open persistence, and five distinct glyph
warnings in both plot preview and the settled completion log. The actual PDF
passed three independent measurement groups and thirteen rejected observation
controls; full-page and annotation renders were reviewed. See
[the bounded native record](NATIVE-BETA6-ACCEPTANCE.md) for identity, exact scope,
preserved checker/environment failures and unsupported glyph limits.

This reconciliation changes documentation and backlog only. No runtime, manifest,
build, application gate, native session or converter attempt is repeated. After
reconciliation, no further currently authorized unattended item is ready; local
automation state belongs in the private pointer. Preserve the installed/client,
independent DWG-consumer, domain, relay and release authorization boundaries.

## Immutable workflow action references - October 28, 2026

LC-SEC-ACTIONS-SHA pins all eleven existing external action references across the
quality and beta workflows to full commit SHAs verified against the upstream
`actions/*` repositories. Version comments retain the existing v4/v5 choices;
triggers, permissions, job commands and the isolated publication job are unchanged.

Two permanent checks in `tests/qa-controls.test.cjs` enforce the current block-style
reference policy and reject mutable tags/branches, short or malformed SHAs, quoted
mutable values and unsupported reference layouts. This is a conservative policy
check for the repository's workflow style, not a general YAML parser or an audit of
the actions' implementation. Both workflow files are now fingerprinted gate inputs.

The retained pre-pin run has one expected policy failure and one passing control
test. Independent review then found a mapping-style bypass in the new checker;
additional negative controls reproduced it before the checker repair. Both failure
receipts and the initial fast result are preserved. The final beta6 fast gate
passes 28/28 stages and 673 selected portable checks,
including all four QA controls; twelve unavailable private references remain
explicitly excluded. Runtime/version, candidate manifests and installer bytes are
unchanged. Application/build/native/installed checks and remote CI were not rerun
for this workflow-only change. Signing, fuse hardening, versioned release preparation
and merge/tag/publication authorization remain separate requirements.

## Pending descriptor privacy references - October 28, 2026

The [descriptor privacy contract](SCRIPT-DESCRIPTOR-PRIVACY.md) records the intended
Windows account/path boundary before a runtime repair. The explicit VM-only
reference currently fails four unsupported-path expectations while eight existing
lifecycle/cleanup controls pass. This is a retained failing regression, not a
privacy fix or OS access-control proof. Owner/DACL/reparse and cross-account
qualification are explicitly not run. The two reference files are fingerprinted
auxiliaries, outside the selected passing suites while enforcement is pending.
No runtime/version/manifest or installer change is part of this milestone.

## Standalone directory observations - October 29, 2026

The [metadata observer](SCRIPT-DESCRIPTOR-PRIVACY.md#standalone-windows-metadata-observer)
adds a read-only PowerShell 7 collector and a strict portable reference classifier.
Twenty-three portable cases join the candidate fast profile; nineteen separate
Windows checks normalize in-memory synthetic security descriptors without applying
them. Windows PowerShell 5.1 execution is blocked by host policy and is not passed.
The owned inherited-ACL fixture is unsupported by the narrow allowlist, with no
permission change. Every classification keeps privacy unproven. Managed descriptor
provenance, the declared root boundary and unqualified identity/race/group/child-file
and cross-account semantics are explicit. The runtime and earlier red path reference
remain unchanged; existing general gates do not establish scripting privacy.

## Recovered synthetic structural contracts - October 29, 2026

The three original reviewed V1/V2/V3 pure suites and joined-roof helper are restored
with only CRLF-to-LF normalization in two public copies. Three new literal tests independently establish opposing-plane
vertices/areas, declared load arithmetic and located containment/overlap values.
All four suites join candidate fast selection; the imported helper is fingerprinted
and its native-file generator CLI is not executed. See
[the reference and evidence scope](STRUCTURAL-CONTRACT-COVERAGE.md). No runtime,
manifest, installer, external engine or native workflow is changed or qualified.

## Synthetic structural file service - October 29, 2026

The candidate fast profile adds37 recovered mocked-host/file-service checks, one
literal V1 host result and four independent callback dispatch cases. The original
mixed-pitch sample is restored byte-for-byte; output reports and all synthetic
writes stay in exclusive owned run folders. See
[the scope and retained checker failure](STRUCTURAL-FILE-COVERAGE.md). No runtime,
manifest, installer, native UI, installed app or external engine is changed.

## Electron fuse compatibility inventory - October 29, 2026

Read-only inspection of the preserved beta6 QA executable and local source runtime
found the unchanged nine-slot default wire. The
[compatibility inventory](ELECTRON-FUSE-COMPATIBILITY.md) bounds a proposed packaged
policy and records the installed eight-option toolchain limit. Existing Playwright
Electron qualification requires Node inspection, so a non-inspector approach is
needed before applying the proposed policy. No fuse, dependency, runtime, manifest,
installer or installed state changes, launches or repeated gates are part of this
inventory. Hardening and exact-artifact acceptance remain unimplemented.

## Non-inspector diagnostic probe - October 29, 2026

Eight portable ownership/endpoint/visibility guards join candidate fast selection;
a separate actual loopback redirect control passed after standard execution review.
The [explicit renderer probe](NON-INSPECTOR-PROBE.md) binds approved existing targets
and creates isolated hidden profiles without Node inspection or scripting descriptors.
Its first source attempt failed closed0/5 at listener ownership; no renderer commands
ran. The failed run and forced owned-child cleanup are retained. Unpacked/native/
hardened-fuse acceptance is not inferred. No runtime, fuse, build, manifest or installer
change is included; continue unrelated assessment until listener evidence is available.

## Asset-preparation receipt identity

The [receipt identity guard](RELEASE-RECEIPT-IDENTITY.md) binds the historical
baseline and gate metadata before asset mutations. Its171 synthetic prefix checks
run in both baseline and candidate suites. This does not generalize the1.36.0-only
publisher or establish candidate release readiness; no release action is a side
effect of the reference tests.

## Frozen release identity design - October 29, 2026

The [release identity ADR](RELEASE-IDENTITY-ADR.md) inventories source/preflight,
manifest, asset/checksum and isolated-publisher boundaries. It proposes a pure
frozen source planner without changing candidate selection, triggers or write
permissions. A local synthetic PowerShell expression probe is separately bounded
from unexecuted publisher/CI behavior. This documentation milestone reruns no
unchanged gate or build; existing169 prefix cases and their qualification limits
remain unchanged. Versioned candidate publication is not implemented or authorized.

## Standalone frozen release metadata model - October 29, 2026

The [release identity ADR](RELEASE-IDENTITY-ADR.md) now records a standalone pure
model and21 literal API checks. Two additional current-wrapper characterizations
bring its prefix suite to171, preserving the original169. Selected candidate
metadata is tested only at the new API; preparation still uses the default
baseline. The model is not integrated with preparation or the write-token
publisher. No candidate release support, runtime/manifest/workflow change or
prepared-output/build/install/publication qualification follows from this step.

## Virtual release serialization contract - October 29, 2026

The unchanged preparation wrapper now has171 preserved prefix plus17 virtual
completion/adapter/oracle cases,188 total. Full tag/preflight verification bytes,
synthetic checksum lines, exact copy/write names and final log are frozen in an
independent reference. See [the ADR](RELEASE-IDENTITY-ADR.md#virtual-downstream-characterization).
The default sentinel remains first-archive; only opt-in cases complete using fake
in-memory assets. No real output, ZIP/PDF/installer, publisher, CI or security
sandbox qualification follows. Standalone planner integration remains deferred;
production/runtime/manifests/workflows are unchanged.
