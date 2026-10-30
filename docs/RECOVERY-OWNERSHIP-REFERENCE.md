# Recovery live-generation and file-action ownership reference

The separate explicit pack `tests/recovery-ownership-reference.test.cjs` has
18 checks: seven source controls plus inventory pass, and ten contract
expectations fail. All 17 named cases execute without unexpected harness errors.
Seven failures stop at absent UUID metadata in successful actual-main replies,
one at the missing main recovery channel, and two at missing renderer negotiation
requests. These failures do not establish exercised positive-generation behavior,
an executed overwrite, or a failed existing busy gate.

The main half uses actual main/queue/core functions with fake Electron and owned
synthetic A/B files. UUIDs must come from actual accepted replies. Checkpoint
format/path/import-name/binding and synchronous trusted confirmation then probe
live identity, followed by an ordinary Save that returns the same UUID and writes
only the expected file. A barrier protects the other file before temporary
creation. No guessed internal binding variable is added to the helper observer.

The frozen lifecycle expectations cover ordinary generation stability, rejected
validation/prepare/changed-candidate commit, first persistence failure and retry,
successful compensation, failed compensation and confirmation replay/conflict.
Failed compensation deliberately distinguishes candidate B's on-disk generation
from old A's live generation; the latter must still confirm and Save A correctly
after the fault clears. Historical conflicting UUIDs come from two earlier actual
accepted replies. These branches currently stop at missing prerequisites.

Three executable main controls preserve legacy association/files/queue head on a
wrong ID and a deliberately fixture-modified candidate, and retain exact packaged
peek/prepare/commit wire shapes. Peek observation is not notification delivery.

The renderer half extracts verbatim full `runAction`, `setDocumentBusy`, queued
pump, deferral, replacement and file-action bodies. It uses real core editors,
owned DOM nodes with observed inert/disabled/busy state, and explicit bridge,
storage, synchronization/persistence and manual-timer adapters. It never sets the
production busy flag or substitutes rewritten ownership logic. Four passing
controls cover native-Save exclusion, the actual post-peek ownership check,
cancel/reject cleanup and a later independent action; queued retries adopt the
literal B drawing with fresh history. These are existing source behaviors.

Two additional races hold recovery challenge or confirmation, overlap actual
Save/Open/pump calls, then release negotiation while the first native Save remains
held. Early exclusive reservation and a valid ownership recheck are both allowed.
Queue peek is inert; prepare/commit must wait for ownership. The present source
never requests recovery negotiation and fails the explicit prerequisite, so those
downstream recovery races remain unqualified. Held promises are released in
finally blocks; no real scheduler, DOM app, preload transport or timer runs.

The pack is auxiliary-only, excluded from selected passing acceptance alongside
unchanged renderer23, protocol37, identity14 and paired10. Those older pending packs
were not rerun. Shared helper, runtime/main/app/preload, manifest, package/version
and CI remain unchanged beta10. No repair approach is consumed: LC-REL-02 remains
partial with one earlier approach used and at most one remaining; LC-REL-01 has0.

With the independently reviewed expectations frozen, the next bounded action is
to review a focused main/app/preload implementation plan and use at most the one
remaining LC-REL-02 repair approach. Preserve accepted Save As, legacy chooser
fallback, exact packaged replies, fresh recovery history and all failed evidence.
Any runtime change needs a reviewed cumulative manifest preserving59runtime and
12resources; the one-file creator cannot represent the planned change. Do not
weaken assertions or use content/name identity or generic rollback. Real IPC,
frame ordering, storage/crash durability, application/native/installed/upgrade/
daily-use and the unknown beta7 startup cause remain separately unqualified.

Rollback is a focused revert of this test/auxiliary-binding/ADR/docs checkpoint,
leaving beta10 runtime and all prior receipts intact.

The fresh selected fast gate passes49/49stages,1,288portablechecks and226bound
inputs. All five pending recovery references are fingerprinted auxiliaries,
excluded from passing acceptance. Exact final source input binding is separate.
