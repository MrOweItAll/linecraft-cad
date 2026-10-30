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
