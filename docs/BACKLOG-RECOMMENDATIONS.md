# Reliability, performance and maintenance recommendation intake

Implementation inspected at `ca51931221d0aaa2485449765a28b7bf76c7c172` (beta7).
This intake records ten recommendations, not ten verified defects. Source and
existing test definitions were inspected; no new product test, benchmark,
converter or application was run. No recommendation meets its complete
acceptance criteria from this intake. Historical qualified scopes stay intact.

## Priority and continuity

Confirmed drawing-corruption or data-loss defects take precedence over
performance. LC-REL-01 and LC-REL-02 are P0 **integrity investigations**, not
confirmed P0 defects. They do not justify interrupting stable nearly completed
work. No new drawing-loss finding was demonstrated in this review.

The existing P1 beta7 startup blocker remains unexplained and blocked. The
native scripting helper/runtime and DWG writer/editability qualifications retain
their existing prerequisites and approvals. These recommendations authorize no
unchanged launch retry, new converter attempt, installed/client/native action or
publication. Completed drafting/import fixes remain completed in their recorded
scope; they are not reopened merely to renumber this list.

First investigate one representative mid-batch failure under LC-REL-01 using
synthetic pure-editor controls. Follow with the LC-REL-02 existing-file fault
matrix, then converter/resource controls and the representative performance
protocol. P2 optimization implementation waits for a measured bottleneck.
P3 error vocabulary and module separation proceed incrementally only in a
justified affected path; a small diagnostic prerequisite may accompany its
higher-priority reliability change. No repository-wide rewrite is planned.

## Existing IDs and assessments

| Requested ID | Existing/canonical backlog ID | Queue ID | Assessment | Priority |
| --- | --- | --- | --- | --- |
| LC-REL-01 | LC-REL-01 | LC-REL-01 | partially implemented | P0 |
| LC-REL-02 | LC-REL-02 | LC-REL-02 | partially implemented | P0 |
| LC-REL-03 | LC-REL-03 | LC-REL-03 | partially implemented | P1 |
| LC-REL-04 | LC-REL-04 | LC-REL-04 | partially implemented | P1 |
| LC-PERF-01 | LC-QA-006 | LC-QA-PERFORMANCE | partially implemented | P1 |
| LC-PERF-02 | LC-PERF-02 | LC-PERF-02 | deferred with reason | P2 |
| LC-PERF-03 | LC-PERF-03 | LC-PERF-03 | deferred with reason | P2 |
| LC-PERF-04 | LC-PERF-04 | LC-PERF-04 | deferred with reason | P2 |
| LC-MAINT-01 | LC-MAINT-01 | LC-MAINT-01 | partially implemented | P3 |
| LC-MAINT-02 | LC-MAINT-VIEWPORT-NAVIGATION | LC-MAINT-MODULES | partially implemented | P3 |

`LC-PERF-01` extends `LC-QA-006` / `LC-QA-PERFORMANCE`; the original bounded
2,000-line baseline and its completion remain preserved. `LC-MAINT-02` extends
`LC-MAINT-VIEWPORT-NAVIGATION` / `LC-MAINT-MODULES`; the completed four-helper
extraction remains complete, while future subsystem work is conditional.
The `LC-REL-01` through `LC-REL-04` reliability recommendations are distinct from
the existing `LC-REL-*` release-receipt pipeline items. Converter resilience and
import budgets do not replace `LC-FMT-001/002/003` writer/fidelity evidence.

## Inspected implementation and remaining acceptance

### LC-REL-01: Atomic multi-object commands

**Partially implemented.** Transforms validate proposals before commit; fence edits have document rollback; scripted revisions stage in another editor and commit once. Existing tests cover pre-mutation rejection and successful grouped history.

Evidence: `core.mjs:1642-1675`; `core.mjs:1680-1687`; `core.mjs:1893-1911`; `core.mjs:2012-2035`; `core.mjs:2069-2070`; `core.mjs:2184-2250`; `app.mjs:297-308`; `tests/core.test.mjs:735-738`; `tests/core.test.mjs:883-892`; `tests/core.test.mjs:1735-1748`; `tests/trim-comprehensive.test.mjs:22-23`; `tests/scripting.test.mjs:115-123`.

Remaining scope: Document snapshots do not encompass every selection/command/revision/history field. Inject failure after an earlier mutation and compare all required state before deciding whether a product fix is justified. Preserve previously accepted repeated COPY/TRIM edits and existing cancel conventions.

Acceptance:

- Inject a failure midway through a representative batch operation.
- A failed atomic command restores document contents/resources/entity identity, selection, dirty state, and undo/redo history to their pre-command state; a failing batch within an established repeated-edit command restores its pre-batch state while retaining earlier accepted repeated edits. No partial edit or spurious undo entry from the failed batch remains.
- A successful operation follows the established undo convention, including previously accepted repeated edits.
- Validate before mutation where practical; retain command-state/revision observations without treating a revision-only discrepancy as drawing loss.

Next action: First ready investigation: use an owned synthetic two-target batch/fence in the existing pure editor harness; inject a deterministic failure after the first accepted mutation and compare literal document/selection/dirty/history behavior plus successful-command controls. Record the result before any narrowly justified repair. No Electron or converter retry is required.

Priority basis: P0 integrity investigation, not a confirmed P0 defect. Only demonstrated corruption/data-loss risk may preempt stable nearly completed work; complete this evidence step before performance optimization.

Rollback/retention: Intake changes documentation only. A future runtime repair must record its exact commit and a focused revert/recovery method before completion.

### LC-REL-02: Safe save and failed-import isolation

**Partially implemented.** Native save writes and flushes an exclusive sibling, renames without deleting the destination, and cleans its owned temporary file. Association/clean state update after success. Open/import validates before renderer replacement. Existing tests cover malformed Open, canceled Save As and some cleanup failures.

Evidence: `desktop/main.cjs:285-312`; `desktop/main.cjs:405-459`; `app.mjs:1823-1844`; `app.mjs:1878-1887`; `core.mjs:3225-3233`; `tests/desktop-unit.test.cjs:131-175`; `tests/import-files.test.cjs:17-37`; `tests/advanced-security.test.cjs:25`.

Remaining scope: Inject write/sync/rename failures while overwriting an existing valid native drawing. Compare file bytes and complete renderer/editor state for malformed and canceled import. Generic error strings do not establish operation-specific next-step guidance. No claim of power-loss/crash durability follows from sibling rename inspection.

Acceptance:

- Simulated write failure preserves the previous valid drawing, file association and clean/dirty baseline; include write, flush and replacement failure stages.
- Malformed or canceled import leaves active drawing contents, identity, selection and undo/redo unchanged.
- Errors identify the failed Save/Open/import operation and a useful next step.
- Use the platform's supported atomic-save mechanism where available and clean up only owned temporary files safely.

Next action: After LC-REL-01's focused evidence step, extend the existing desktop IPC/filesystem harness with the existing-file failure matrix and complete import-state comparisons; preserve successful overwrite and chooser/cancel controls before considering production changes.

Priority basis: P0 integrity investigation; no reproduced data loss and no justification to interrupt stable nearly completed work.

Rollback/retention: Documentation-only intake; retain original valid files and fault receipts. Record a focused rollback method for any future repair.

### LC-REL-03: External converter resilience

**Partially implemented.** Fixed shell-free hidden invocation, 30-second shared deadline, combined 512-KiB stdout/stderr budget, error-stderr/nonzero rejection, bounded file reads, private cleanup and output validation are implemented. Tests pin existing converter identity and cover many failure classes.

Evidence: `desktop/import-files.cjs:8-76`; `desktop/main.cjs:87`; `desktop/main.cjs:277-282`; `tests/import-files.test.cjs:11-37`; `tests/converter-identity.cjs:5-10`; `dwg-import.mjs:23`.

Remaining scope: Current IPC failures are usually ok:false/error:string. Missing-binary/spawn errors and bounded stderr warnings can contain paths. Kill-false/no-close/orphan behavior is unqualified; existing fake processes emit close on kill.

Acceptance:

- Cover missing binaries, unsupported versions, nonzero exit, stderr-only failure, malformed output, hangs and excessive output.
- Each failure returns a stable structured diagnostic with useful operation/context and bounded privacy-safe technical details.
- No unhandled rejection, orphan process or partial active document remains; execution and owned cleanup are bounded.

Next action: After integrity evidence, use the existing fake-process importer harness for a focused diagnostic/termination matrix, including kill-false and missing-close behavior. No actual converter retry or new dependency is authorized by this item.

Priority basis: P1 controlled-failure investigation. DWG writer/editability fidelity records remain separate; this is not a duplicate converter-writing attempt.

Rollback/retention: Retain failure/success controls and original converter resources; future implementation must name a focused rollback commit.

### LC-REL-04: Import resource budgets and cancellation

**Partially implemented.** Input/generated-read and normalized-document byte limits, process output/time limits, DXF group/object/depth/cycle/INSERT-array controls, and native aggregate HATCH/planar/3D/entity/block budgets already exist.

Evidence: `desktop/import-files.cjs:8-20`; `desktop/import-files.cjs:49-78`; `desktop/preload.cjs:19`; `desktop/main.cjs:202`; `dwg-import.mjs:5`; `dwg-import.mjs:42-61`; `dwg-import.mjs:150-169`; `dwg-import.mjs:213`; `dwg-import.mjs:252-300`; `core.mjs:1224-1287`; `core.mjs:1349`; `advanced-geometry.mjs:25`.

Remaining scope: No import cancellation token/cooperative synchronous-parser interruption is exposed. Cumulative visited-record/expansion work and parse deadline need focused evidence; generated-file growth is checked after process exit. Existing aggregate geometry bounds must not be discarded or described as absent.

Acceptance:

- Inspect input bytes, converter output, entity/vertex counts, block expansion, nesting depth, elapsed time and memory growth throughout the pipeline.
- Oversized/pathological inputs fail predictably with useful resource diagnostics.
- Cancellation releases owned resources and preserves the current drawing.
- Ordinary supported files continue to import correctly.
- Evaluate streaming only after profiling demonstrates benefit and the complete pipeline can support it.

Next action: Freeze deterministic synthetic boundary and cumulative-expansion-work expectations, then characterize cancellation/cleanup contracts without a real converter. Propose only the missing bound or cancellation slice justified by that evidence; streaming stays deferred.

Priority basis: P1 resource/cancellation investigation after integrity checks; missing acceptance is not proof that ordinary supported input loses drawings.

Rollback/retention: Preserve existing resource limits and ordinary-import controls; record focused rollback before completing any future change.

### LC-PERF-01: Representative performance baseline

**Partially implemented.** Existing synthetic fixture, warm-up plus five measured rounds, hidden source/unpacked action/frame-drain timings, exact geometry/hash checks and independent audit are reusable historical evidence. They are not a current beta7 benchmark or human latency measurement.

Evidence: `docs/PERFORMANCE-BASELINE.md:10-59`; `docs/PERFORMANCE-BASELINE.md:84-117`; `tests/performance-fixture.mjs:1-8`; `tests/performance-workflow.cjs:16-17`; `tests/performance-workflow.cjs:45-65`; `tests/audit-performance.py`.

Remaining scope: Add independently authored survey plat, residential plan, several-viewport layout and heavy drawing references; entity/vertex counts, hardware/runtime, import/redraw/interaction/peak-memory observations, clearly defined cold/warm boundaries and baseline-derived thresholds are not all qualified. Do not manufacture timings or thresholds during intake.

Acceptance:

- Reusable authorized/sanitized fixtures cover survey plat, residential plan, several-viewport paper layout and synthetic heavy drawing.
- Record entity/vertex counts, runtime/hardware, redraw/interaction latency, import time and peak memory where measurable, including explicitly defined cold and warm runs.
- Results are reproducible enough for comparisons; derive practical regression thresholds from measured variability.
- Identify the measured bottleneck before choosing an optimization and preserve existing correctness references.

Next action: Retain the completed bounded baseline and extend its existing ID. After integrity investigations, prepare the four literal fixture/protocol definitions without launching the unchanged blocked beta7 route. Actual app measurements require a justified, runnable qualification path and exact current identity.

Priority basis: P1 measurement prerequisite, ahead of speculative P2 optimization but after integrity evidence. Existing bounded completion remains intact.

Rollback/retention: Preserve the original fixture/CSV/audit and add distinct workload/version results. No optimization or fabricated before/after measurement is part of intake.

### LC-PERF-02: Spatial indexing

**Deferred with reason.** Inspected selection/snap paths scan supplied entities and retain exact geometry/visibility behavior, including block traversal. This observation does not assert that every subsystem lacks an index.

Evidence: `core.mjs:928-941`; `core.mjs:984-1028`; `core.mjs:1029-1041`; `app.mjs:272-294`.

Remaining scope: No representative comparative measurement supports replacing or augmenting these paths yet.

Acceptance:

- Proceed only if representative benchmarks justify an index for hit testing, window/crossing selection or snapping; use it to select candidates and retain exact geometry checks.
- Handle model/paper space, transformed blocks, edits, deletion and undo/redo; indexed results match existing behavior on representative/boundary cases.
- Measure query benefit including index maintenance and memory cost.
- Document worst-case behavior and do not promise universal O(log N) queries.

Deferral: Speculative optimization without measured benefit; avoid dependency/maintenance cost and selection/snap regressions.

Next action: Defer implementation until LC-QA-006's expanded baseline identifies a relevant measured bottleneck; then propose one candidate-only index slice with differential correctness controls.

Priority basis: P2 conditional optimization after integrity and measurement.

Rollback/retention: If later justified, retain the exact scan path for comparison and define index-disable/revert behavior.

### LC-PERF-03: Bounded tessellation caches

**Deferred with reason.** Display curve sampling already adapts to scale with bounded sample counts, and hatch/block display primitives have defined geometry paths. No blanket claim about all caches is made.

Evidence: `app.mjs:225-242`; `core.mjs:1224-1231`.

Remaining scope: Repeated-work savings, invalidation keys and cache memory limits remain to be justified before adding state.

Acceptance:

- Cache expensive hatch/spline/curve display geometry only where profiling supports it.
- Track geometry, block, transform and display-tolerance dependencies; bound memory and release obsolete entries.
- Edits and undo/redo never display stale geometry; zoom-dependent accuracy remains appropriate.
- Demonstrate reduced repeated work without unacceptable memory growth, including before/after measurements.

Deferral: No measured benefit or memory budget yet; new cache state could compromise display accuracy.

Next action: Defer until the expanded baseline measures repeated tessellation cost. If justified, propose one bounded cache and independently test edit/block/transform/tolerance/undo invalidation.

Priority basis: P2 conditional optimization, after integrity/measurement.

Rollback/retention: Future cache must have a bypass/revert path while retaining direct geometry generation.

### LC-PERF-04: Viewport invalidation

**Deferred with reason.** Paper rendering establishes per-viewport clipping/context, renders model content and then paper/borders; current repaint remains the comparison oracle. The existing navigation extraction did not implement viewport render reuse.

Evidence: `app.mjs:2215-2229`; `app.mjs:2568-2604`; `paper-space.mjs:8-26`; `tests/viewport-navigation-independent.test.mjs`.

Remaining scope: A complete dependency/invalidation model and benefit over current repaint have not been established.

Acceptance:

- Reuse viewport rendering only when dependencies are unchanged, including model revisions, view transforms, layer overrides, clipping, block changes and display settings.
- Affected viewports refresh correctly and unaffected viewports avoid redundant work.
- Screen and plotted/exported output remain consistent, including edits and undo/redo.
- Demonstrate measured benefit with before/after multi-viewport results.

Deferral: No measured bottleneck or complete invalidation contract yet; preserve current screen/plot correctness.

Next action: Defer render reuse until the multi-viewport baseline identifies redundant repaint cost; then document dependencies and choose one independently reviewable invalidation slice.

Priority basis: P2 conditional optimization; navigation extraction remains a completed separate behavior-preserving milestone.

Rollback/retention: Future reuse must retain full repaint as a correctness/bypass path and record a focused rollback.

### LC-MAINT-01: Structured error categories

**Partially implemented.** Existing IPC ok/error/canceled shapes and OPEN_REQUEST_BUSY code are compatibility contracts to retain.

Evidence: `desktop/main.cjs:87-88`; `desktop/main.cjs:325-330`; `desktop/open-files.cjs:40`; `desktop/open-files.cjs:51`; `desktop/open-files.cjs:72`.

Remaining scope: Stable validation/geometry/resource/conversion/file categories and separate user/technical fields should be introduced only in touched paths with compatibility controls.

Acceptance:

- Introduce or consolidate stable validation, geometry, resource-limit, conversion and file-operation error codes incrementally.
- Separate concise user messages from technical diagnostics and preserve privacy.
- UI and tests can use stable codes rather than fragile message matching.
- Existing callers remain compatible or receive an explicit migration.

Next action: Treat this as shared vocabulary for the next justified reliability change, beginning with a small converter/file diagnostic contract; do not undertake a repository-wide error rewrite.

Priority basis: P3 cross-cutting maintenance; a minimal code contract may accompany a higher-priority justified reliability change without elevating a broad rewrite.

Rollback/retention: Preserve current ok/error/canceled/busy fields until a tested migration; future change records exact rollback.

### LC-MAINT-02: Targeted module separation

**Partially implemented.** Four pure navigation helpers live in paper-space with unchanged public exports and independent navigation contracts plus historical source workflow/PDF comparisons. Existing viewport extraction completion is preserved.

Evidence: `paper-space.mjs:8-26`; `core.mjs:1-9`; `tests/viewport-navigation-independent.test.mjs`; `docs/QUALITY_LOOP.md:viewport navigation source extraction`; `docs/QUALITY_BASELINE.md:viewport navigation source extraction`.

Remaining scope: Future extractions and behavior-based test splits require fresh purpose/contract evidence; no broad reorganization is justified by this intake.

Acceptance:

- Separate pure geometry, document mutation, rendering and UI/IPC responsibilities incrementally when working in affected code.
- Split large test files by behavior only where it improves diagnosis.
- Each extraction has a clear purpose and preserves public behavior, drawing accuracy/identity, file compatibility and undo/redo.
- Avoid repository-wide reorganization solely to reduce file length.

Deferral: Additional extraction deferred until there is a concrete affected subsystem; completed navigation extraction remains verified only in its existing scope.

Next action: Merge this recommendation into the existing navigation/module work, preserve the completed extraction, and defer another extraction until a higher-priority change exposes a concrete responsibility boundary. Reuse independent geometry/history/save/PDF and candidate-identity checks appropriate to the actual change.

Priority basis: P3 incremental maintenance, merged under existing IDs rather than duplicating a completed extraction.

Rollback/retention: Preserve public API and historical artifacts; any future extraction names the exact change and focused revert path.

## Working and completion rules

Inspect before changing code. Preserve drawing accuracy, compatibility, entity
identity, undo/redo and drafting conventions. Reuse the existing exclusive
ownership, synthetic-fixture, independent-reference, review, test and evidence
workflow. Work through one justified improvement at a time; small changes and
no new dependency are the default. Do not claim access to or message another
chat without verified capability and the required authorization.

For each completed item, record the verified problem and affected behavior,
implementation and executed relevant checks, performance before/after where
applicable, remaining limitations, and a precise rollback method. Mark complete
only when all acceptance criteria pass; label already-satisfied scope with
evidence and retain explicit reasons for deferrals. Existing tests described
above are definition/historical evidence, not fresh execution in this intake.

This change edits backlog/documentation only. Reverting this intake commit
restores the preceding public register; preserve later independent work when
performing any rollback. No runtime rollback is needed for this intake.


## Subsequent bounded LC-REL-01 result

The beta8 [rejected-fence recovery](ATOMIC-BATCH-FAILURE-RECOVERY.md) repairs one
fault-injected selection/revision rollback gap. Its eight pure cases and fast
qualification do not complete LC-REL-01 across other batch commands. The original
intake assessments above retain their scope; the persistent register records the
bounded result and next transform-boundary investigation. No natural drawing-loss,
application/native or installed acceptance follows from the injected failure.


## Subsequent MOVE boundary finding

The [explicit transform reference](TRANSFORM-FAILURE-BOUNDARIES.md) confirms an
unrepaired LC-REL-01 deficiency within artificial post-MOVE read faults. The
register now records that bounded confirmed deficiency while preserving the
original intake and fence-repair history. Overall acceptance remains incomplete;
no ordinary drawing-file loss or production repair is claimed by this follow-up.


## Differential transform follow-up

The [44-check differential reference](TRANSFORM-DIFFERENTIAL-REFERENCES.md) adds
reviewed repeated/single COPY, terminal caller-state, paper identity and history
publication expectations. Its 17 passes and 27 expected failures leave LC-REL-01
incomplete within the declared artificial fault envelope. No runtime fix or
ordinary drawing-file-loss route is established. IDs and recommendation merges
are retained; next review a narrow pre-terminal-input guard with monotonic
reservations, actual Undo/Redo entries and bounded checkpoint cost.


## Beta9 qualified terminal recovery

The [terminal checkpoint repair](TRANSFORM-CHECKPOINT-RECOVERY.md) passes the
unchanged9/44reference checks and8new preparation/control checks,61/61total.
LC-REL-01 returns to partially implemented: its demonstrated terminal slice is
repaired, while broad batch/architecture/3D/crash/renderer acceptance remains open.
The measured full-drawing checkpoint adds latency; no optimization is claimed.
Two bounded semantic attempts are consumed. Continue the independent P0 LC-REL-02
save/import isolation matrix before speculative performance work. Historical
findings/IDs and the recommendation merges remain preserved.


## LC-REL-02 bounded preservation coverage

The [save/native-import reference](SAVE-IMPORT-ISOLATION.md) passes36checks with
no runtime repair. Preservation is already satisfied within its injected owned-
file and real-core malformed-input matrix. LC-REL-02 remains partially implemented:
renderer/discard/exchange/development-state and operation/next-step diagnostics
are still unqualified. No destructive-save finding or product fix follows from
these passing cases; retain the original intake and current results separately.


## LC-REL-02 renderer source-function coverage

The [65-check VM reference](RENDERER-ISOLATION-REFERENCES.md) verifies the tested
Save/Open/discard fingerprint, identity and real-history behavior on unchanged
runtime. That bounded logic is already satisfied; LC-REL-02 remains partial.
Next define the independently failing operation/next-step diagnostic acceptance
before a small justified fix. No full renderer/native integration or destructive
save finding follows from these source-function checks.


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
