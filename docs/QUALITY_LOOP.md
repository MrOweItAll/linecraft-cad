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
npm run qa:fast -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.13.json
npm run qa:application -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.13.json
npm run qa:candidate -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.13.json
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

Budgets: at most3 completed backlog items and50 minutes of active work per wake,
including qualification, with at most2 distinct repair approaches per issue. Individual pure
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

## Frozen preparation planner integration - October 29, 2026

The pure frozen metadata planner now supplies source-preparation identity/names
only after the original early guards and real default-manifest admission. Its
original188 reference cases retain their meaning and gain10 invocation/order
controls,198 total; the separate21 API cases remain. Complete virtual tag/preflight
outputs match unchanged literal references. See the
[integration record](RELEASE-IDENTITY-ADR.md#frozen-source-side-integration).
This is bounded refactoring of historical1.36.0 preparation. Candidate publication,
publisher/write-token behavior, real assets and beta7 build/native/installed or
daily-use qualification remain open. Earlier standalone sections are historical.

## Explicit offline publisher checksum reference - October 29, 2026

The [checksum reference](PUBLISHER-CHECKSUM-REFERENCE.md) adds a separate explicit
PowerShell7 command with32 literal synthetic cases, including actual current
case-insensitive behavior and short-circuit hash counts. It evaluates a pinned
checksum block with known-only adapters; no publisher/gh/remote/native/installed
operation runs. Its script and fixture are fingerprinted auxiliaries, not a new
portable gate stage. Current publication policy and original assets are unchanged.

## Fixed publisher metadata admission - October 29, 2026

The [fixed format/version clause](RELEASE-IDENTITY-ADR.md#fixed-publisher-formatversion-admission)
rejects22 newly frozen invalid metadata cases after their pre-fix failures;
all40 final actual-clause cases pass after six additional Unicode failures prompted
one ordinal-equality repair. The first34 expectations and original commit/tag/class
behavior are retained.
A separately pinned current checksum fixture keeps the original fixture intact,
with all32 cases and the unchanged checksum-block digest passing. Both PowerShell
references are explicit auxiliaries; no actual publisher, remote, native or
installed action runs. This is a bounded two-field policy fix, not full-schema,
artifact-authenticity or general candidate-release qualification.

## First beta7 unpacked qualification attempt - October 30, 2026 UTC

The existing isolated unpacked route passed 41 portable stages with 1053 checks,
then failed at the first hidden source Electron launch. The generic
Playwright launch error does not identify an application, dependency, permission,
sandbox or GPU cause. No application acceptance/PDF audit completed; packaging,
unpacked execution and installer compilation were not reached. Synthetic input
files were prepared before launch. Source and all 209 gate inputs stayed unchanged.

Failure evidence is retained privately. No unchanged retry, visibility/permission
workaround or product fix was attempted. This is a blocked beta7 attempt, not a
passing candidate gate. Beta6 remains the historical built/native candidate;
beta7 build/native/installed and daily-use qualification remain open. Continue
fresh evidence/intake review with the hourly task active while startup is unresolved.


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
