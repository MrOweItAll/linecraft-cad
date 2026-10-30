# Bounded converter settlement and cleanup custody: beta12

Beta11's source reference exposed pending no-close conversions, removal requests
before confirmed close and private paths in successful warning payloads. Beta12
repairs that bounded source slice in `desktop/import-files.cjs`. Main/preload,
drawing serialization, converter resources and dependencies are unchanged.

## Lifecycle ownership

The importer reserves one DWG admission before its first await and strongly owns
that import's child/cleanup record. Direct DXF import remains available. Failure
before private scratch exists releases admission. One record covers both DXF and
metadata conversions; a successful first close cannot delete files still needed
by the second conversion or parser.

Timeout, output overflow or child error sets one abort cause before requesting
termination once. False/throwing kill and a true request without close wait for
at most a scheduled 1,000 ms close-confirmation grace, then reject once. This is a
source scheduling bound for unconfirmed child settlement, not a real-time or OS
termination guarantee. Real filesystem reads, lstat/realpath and rm stalls are
not deadline-bounded by this repair.

A close releases its child lease before the settlement guard. Cleanup starts once
only when the import is finalizing and no child lacks close. Thus a late close
after caller rejection may finish guarded cleanup without parsing, resettling or
spawning again. Repeated errors remain safely observed by an owned listener;
late/closed-child output cannot poison metadata budgets. Synchronous close during
kill cannot rearm grace. No process-global error handler is added.

No-close and failed/refused cleanup retain one owned reservation and block another
DWG through that importer. Successful late cleanup releases admission for a new
DWG. Cleanup failure is caught with a fixed warning and no automatic retry loop.
Pending files are not claimed removed. This prevents accumulating unconfirmed
converters within one importer; actual process-tree/orphan absence remains
unqualified. Restart/crash custody persistence is not established.

## Successful warning projection

ERROR/FATAL rejection and warning counts use the original bounded stderr lines.
Returned pathless benign warnings remain exact, including numeric ratios/times.
Path-looking warnings return an authored generic message or an anchored leading
ACDB object class strictly before the first ORIGINAL path indicator and any quote.
No quoted filename parser supplies fragments to that class. Entire selected lines
are examined before character truncation; the 20-warning and 2,048-character caps
and total count remain intact.

Tests cover drive/UNC/extended drive, POSIX, quoted/spaced/multiple/relative path
forms, a truncation edge and escaped quoting. Ambiguous quoted path-before-object
text falls back to the useful generic message. This is a reviewed path projection,
not universal secret/PII filtering or proof of real renderer delivery. Parser-owned
warnings and broader diagnostic-reason custody remain outside this narrow claim.
The exact existing FILE_IMPORT_FAILED main response remains intact.

## Evidence and chronology

| Executed source slice | Pass | Fail | Scope |
|---|---:|---:|---|
| Expanded pre-product reference | 24 | 22 | 46 checks; stronger lifecycle/privacy prerequisites before product mutation |
| Hardened immutable-before comparison | 23 | 24 | 47 checks against unchanged saved beta11 importer; run after the first patch with only fixture-root/module-source paths pinned |
| First implementation | 47 | 0 | Earlier 47-check source pack |
| Independent escaped-quote challenge | 0 | 1 | Reproduces a private class-token leak in that first implementation before correction |
| Final exact-source converter pack | 48 | 0 | 47 named cases plus inventory, selected by beta12 fast profile |
| Legacy import adapter controls | 21 | 0 | Real core/filesystem with fake children after the first implementation; later correction only narrows path-bearing warning projection |

All assertion oracles remain independent of product output. Review corrected an
unconfirmed-error fixture to suppress fake close on kill, made snapshots and
settlement observations await actual promise/filesystem progress, recorded
removal completion, strengthened partial-path checks and added admission-release
and guard-refusal controls. Initial and intermediate receipts remain preserved.
A private immutable-before runner differs from the public test only in fixture
root and importer-source/report hash paths; its assertions are unchanged. It is
not backdated as an execution before product mutation.

The final selected gate passes 55/55 stages, 1,438 portable checks and 229 bound
inputs. Converter48 and the five recovery packs (102 checks) are all selected.
The reviewed cumulative beta12 manifest retains 59 runtime files, 12 resources
and nine original-baseline changes; only the importer differs from beta11.
Package/lock edits change versions only, and two local CI manifest paths change.
The publication workflow is unchanged; no remote CI, build or publish ran.

LC-REL-03 remains partial: one coherent approach used, at most one remains. No new
LC-REL-01/02 approach occurred. Real converter/version/OS termination, IPC/renderer
adoption, filesystem-stall deadlines, restart/crash, broad privacy/reason custody,
application/PDF/build/unpacked/native/installed/upgrade/client/daily-use acceptance
remain unqualified. Beta7 startup cause is unknown; beta6 built/native receipts
retain their historical scope.

Next take the independent registered LC-REL-04 synthetic resource/cancellation
reference. Preserve all existing bounds and ordinary-import controls; streaming
stays deferred and no real converter retry is authorized.

## Recovery

A focused revert of b03e89a2a06bde77ad408f7be7c9bc812cdf31df restores beta11 importer/version/profile/CI
selection. Preserve all receipts and pending cleanup ownership; this is not an
installed downgrade or authorization to remove any unconfirmed child's files.
