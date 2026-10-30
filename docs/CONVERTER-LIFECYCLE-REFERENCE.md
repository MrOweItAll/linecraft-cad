# Converter lifecycle and successful-warning reference

The explicit LC-REL-03 source reference has **28 checks: 21 pass and seven
expected failures**, across 27 named cases. There are no unexpected harness
errors in the corrected run. Runtime remains beta11. No product repair or real
converter attempt occurred; LC-REL-03 has used zero semantic repair approaches.

## Independent contract and executed boundary

The fixture executes the unchanged importer module text in a VM. Its documented
filesystem/spawn adapters use real owned synthetic files and fake EventEmitter
children. The synthetic converter fixture is nonexecutable; a separate guard
forbids native spawn. Explicit Date/timer adapters project a 100 ms import budget,
64-byte combined output budget and a prospective 1,000 ms close-confirmation
grace. The grace is a frozen expected source bound, not an existing production
constant, a measured wall-clock result or an OS termination guarantee. The real
importer default remains 30 seconds and 512 KiB.

A kill request, a true return from kill, and a child error are distinct from a
confirmed close. At grace expiry, the caller should receive one bounded failure
without parsing/adoption, while owned private files remain in pending custody
until close. A later close should complete guarded owned cleanup once without
another settlement, parse or spawn. Do not solve a missing-close hang by deleting
files that an unconfirmed child may still use.

The source parser/validator are canned adapters with independently authored
normalized text. Literal original/sentinel contents, fixed arguments, hidden
shell-free invocation, settlement/parse counts and removal ownership are checked.
This is not a geometry, real DXF decoder or full active-document adoption test.
Filesystem barriers use a finite real watchdog; that watchdog cannot settle the
product promise. A separately recorded teardown close releases held fake children
only after pre-teardown observations and assertions.

## Corrected result

| Source contract | Pass | Expected fail | Observation |
|---|---:|---:|---|
| Existing success/failure/deadline/budget/warning controls and main diagnostic boundary | 20 | 0 | Successful hidden invocation, DXF bypass, nonzero/signal, ERROR/FATAL, malformed/missing/nonregular output, missing binary/spawn, confirmed-close timeout/overflow, late close within grace, shared output/deadline, useful warnings and caps |
| No-close bounded settlement | 0 | 3 | Timeout with kill false or true/no-close, and overflow with kill false, remain pending at the exact prospective grace boundary |
| Unconfirmed-exit cleanup custody | 0 | 2 | Throwing kill and started-child error request private removal before any observed close |
| Successful-warning privacy | 0 | 2 | Returned importInfo retains synthetic absolute Windows/POSIX private path markers alongside useful ACDBFOO warning text |
| Inventory | 1 | 0 | All 27 named cases complete with no unexpected errors |

The two cleanup failures establish a **removal request before confirmed close**.
The captured pre-teardown observations do not prove completed deletion before
close: asynchronous filesystem removal was still in progress. Virtual timestamps
on these operations are projections, not measured cleanup latency. Deferred
late-close cleanup after a bounded rejection remains blocked by earlier failed
assertions; teardown success is not positive qualification of that branch.

The ordinary main error formatter is executed verbatim and already returns the
exact authored FILE_IMPORT_FAILED operation/next-step structure, with only an
allowlisted ENOENT system code. Raw importer-internal startup/missing-binary
messages are not mislabeled as demonstrated renderer leaks. Successful warning
payloads are a separate returned-data boundary. Their frozen expectations retain
useful object information and exact warning counts while excluding private path
markers. No renderer UI or real IPC delivery was executed.

The unsupported-version fixture is a canned converter FATAL diagnostic. It does
not prove recognition or compatibility of any actual converter version. Existing
original import tests, converter resources and manifests remain unchanged.

## Qualification and next action

The new reference is fingerprinted as an auxiliary only. It is deliberately
outside the selected passing beta11 fast profile. The fresh selected gate remains
54/54 stages and 1,390 portable checks, now with 228 bound inputs. Its success does
not claim this pending 28-check contract passes. The five recovery packs remain
selected; their previous 102-check bounded source qualification is preserved.

An initial fake-spawn assertion compared arrays across VM realms and failed
before creating children. The initial log/report is preserved privately. Only
that fixture comparison was normalized to an exact plain-value array; final source
expectations were not weakened. Independent review also pinned the exact grace
boundary, awaited real removal completion and distinguished removal requests from
completed deletion.

Next review a focused bounded lifecycle/warning repair plan against this contract,
including deferred late-close cleanup and repeated-event ownership, before a
product change. Preserve current main failure shapes, warning usefulness/counts,
shared budgets and original files. No LC-REL-03 repair approach has been consumed;
LC-REL-01/02 retain zero remaining approaches. LC-REL-03 remains partial.

Real converter/process-tree termination, orphan absence, IPC/renderer integration,
real binary compatibility, restart/crash durability, application/PDF/build/native,
installed/upgrade/client and daily-use acceptance remain unqualified. Beta7's
startup cause is still unknown; no unchanged application or converter retry ran.

The first selected gate for this new reference stopped at an older Save fixture's
single-rename success expectation. The destination/state assertions had passed;
existing Windows retries made that trace expectation incorrect. A separate
[fixture-only correction](SAVE-IMPORT-ISOLATION.md) retains all 36 cases and records
allowlisted retry outcomes before assertions. The failed gate and focused36/36
receipt are preserved, followed by one fresh selected verification. Runtime did
not change, and no LC-REL-02 semantic approach was consumed.
