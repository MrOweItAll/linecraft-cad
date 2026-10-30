# ADR-002: bounded import work and cancellation

Status: accepted; bounded beta13 source implementation qualified, parent partial.
Scope: LC-REL-04 trusted source interfaces. See the beta13 implementation record below.

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

## Pre-product reference, acceptance and rollback

The original f660dfa prerequisite checkpoint preserved work36 (20pass/16expectedfail)
and cancellation21 (6pass/15expectedfail), both zero unexpected errors. Passing
inclusive controls alone could not prove enforcement. First-timeout, synchronous
kill-close and abort-during-registration controls remain unchanged.

The coherent two-file repair required both packs passing, converter48/recovery102,
a reviewed cumulative59-runtime/12-resource manifest and a fresh exact-source fast
gate. Beta13 meets this bounded source requirement, including separate transport
and private fatal-identity controls, as recorded below. The original reference-only
checkpoint consumed zero approaches; beta13 uses one coherent approach, at most
one remains. Product rollback was recorded privately before runtime mutation.
A focused local revert of runtime9fa9b5bc restores owned source/metadata/tests;
immutable beta12 and every historical receipt remain preserved. No installed
rollback or promotion is implied.

Held awaits and cleanup release are harness schedules. No real converter, unbounded
filesystem-stall deadline, responsive mid-parse cancellation, whole-process/native
memory, IPC, restart/crash, application/PDF/build/unpacked/native/installed/upgrade/
client or daily-use acceptance is established. Preserve beta6 receipts and all
existing restrictions. LC-REL-01/02 remain exhausted; LC-REL-03 remains partial.


## Beta13 source implementation

Runtime9fa9b5bc6c7a02fae5d38c1dd437df57ae29838d qualifies the bounded contract with
67/67focused checks and58/58selected stages,1505checks,233inputs. See
[implementation, chronology and remaining limits](IMPORT-WORK-CANCELLATION.md).
One approach is used; at most one remains. The earlier36/21 failing reference
numbers above are preserved pre-product evidence, not current failures.
