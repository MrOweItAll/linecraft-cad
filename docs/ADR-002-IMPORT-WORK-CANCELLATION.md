# ADR-002: bounded import work and cancellation

Status: accepted implementation contract; pending product implementation.
Scope: LC-REL-04 trusted source interfaces. Runtime remains beta12.

The source references establish literal geometry, cumulative decoder/cell work,
a final-newline-dependent group-admission inconsistency and missing cancellation
interfaces. They do not establish ordinary drawing loss. This decision selects a
narrow first repair; streaming and broader pipeline qualification remain deferred.

## Work and error identity

`importDXF(source, {workBudget, signal, ...existing})` will use an inclusive default
of **1,000,000 units**, shared across model/paper records and recursive siblings.
One decoded record-list entry costs one unit, including skipped records; each
INSERT cell costs one unit, including empty cells. The optional
`workBudget.maxUnits` must be a positive safe integer at most the default. It may
only tighten the bound. Invalid overrides fail with authored
`IMPORT_BUDGET_INVALID`; exhaustion fails with authored `IMPORT_WORK_LIMIT`.
Neither may return partial anchor geometry or echo input/source names.

A module-private identity (for example, a WeakSet of owned errors) will distinguish
fatal control failures. Every recursive per-record catch must rethrow those exact
errors. Message matching or a caller-forgeable code alone is insufficient. Preserve
existing cycle, depth, per-array, entity, aggregate geometry and byte limits.

The default is a selected operation bound, not a measured universal CAD capacity
or CPU/memory/time guarantee. Its small synthetic fixture contains one 999-cell
INSERT of a 1,000-record block: `1 + 999 + 999*1000 = 1000000` units, yielding
999 LINEs from (1,2) to (3,2) and 998,001 skipped POINTs. One extra top-level POINT
must reject the whole import. This uses no output-limit failure as a work oracle.
Counters do not cover all preprocessing, group/vertex scans or block lookups.

Complete group-pair admission must count logical complete pairs consistently at
the existing one-million boundary, regardless of a trailing transport newline.
Preserve existing BOM and accepted LF/CR/CRCRLF transport behavior; malformed or
truncated records remain separate validation cases.

## Trusted cancellation and resource ownership

An actual optional AbortSignal is checked before work/editor construction and at
source work/validation boundaries. Cancellation uses an authored AbortError with
an owned fatal identity and no opaque reason echo. Synchronous polling does not
promise later UI/event-loop responsiveness. No renderer/preload cancellation API
or IPC channel is added by this contract.

`importDrawing(filename, {signal} = {})` will check before and after relevant awaits
and forward the same signal to parser context. Newly acquired handles enter their
close-owning try/finally before an abort check. Newly acquired scratch directories
obtain cleanup identity before cancellation may escape. Cleanup and handle closure
must proceed despite abort. Check a successful candidate again after cleanup so
an abort during cleanup cannot return it; preserve an earlier timeout, validation
or operation error rather than replacing it with a later cancellation.

Converter cancellation reuses beta12 custody, first-cause, one-kill and scheduled
1,000 ms close-confirmation grace behavior. Install owned close/error listeners
before signal registration; register and recheck cancellation so synchronous close
or abort during spawn/registration cannot be lost or rearm a settled timer. Remove
signal listeners on settlement. Keep admission reserved until confirmed child
closure and successful cleanup; direct DXF remains available. This reservation is
per importer instance. It does not establish global main-process admission or
OS/process-tree termination. Do not spend a separate LC-REL-03 repair approach.

The actual main Open callback must await a valid importer candidate before changing
its association. Existing failure normalization remains FILE_IMPORT_FAILED. The
reference binds the real importer into a verbatim callback projection; parser and
metadata return canned synthetic candidates, while core validation and owned file
I/O are real. Helper state, binding/persistence/title counters are explicit adapters.
This proves neither full main exchange/renderer integration nor persistence/crash
atomicity, which remain outside this source slice and LC-REL-02's exhausted scope.

## Acceptance and rollback

Before repair, preserve both pending references and all fixture corrections. The
work pack has36checks (20pass/16expectedfail); cancellation has21checks
(6pass/15expectedfail). Both have zero final unexpected errors. Passing inclusive
controls alone do not prove option enforcement. The first-timeout, synchronous
kill-close and abort-during-registration controls must remain unchanged.

A future coherent two-file repair needs both packs passing, existing converter48
and recovery102 controls, an independently reviewed cumulative manifest retaining
59 runtime files/12 resources, and a fresh selected fast gate bound to exact source.
Recheck transport compatibility and fatal propagation separately. No repair approach
has been consumed by this reference/decision checkpoint. A focused local revert of
its eventual test/profile/docs commit restores prerequisites only; beta12 runtime
and immutable manifests are unchanged. Product rollback must be recorded before
the first runtime mutation.

Held awaits and cleanup release are harness schedules. No real converter, unbounded
filesystem-stall deadline, responsive mid-parse cancellation, whole-process/native
memory, IPC, restart/crash, application/PDF/build/unpacked/native/installed/upgrade/
client or daily-use acceptance is established. Preserve beta6 receipts and all
existing restrictions. LC-REL-01/02 remain exhausted; LC-REL-03 remains partial.
