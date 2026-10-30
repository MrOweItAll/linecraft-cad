# Pending paired recovery target safety

LC-REL-02 has a confirmed conditional wrong-target Save attempt in this source
model. The explicit reference has10checks:6pass and4pending safety failures,
with9scenario traces and no harness errors. It is outside the selected passing
fast profile. No runtime repair, wrong-target overwrite, actual application restart
or ordinary drawing-loss finding is claimed.

## Independently expected safety contract

After accepted Save As to B, recovery must retain the accepted content/baseline
and must not silently route it to unrelated A. A verified intended target or an
explicit chooser fallback with cancellation/state preservation is acceptable.
A silent refusal is insufficient. File identity cannot be inferred from display
name or content equality alone. Legacy matching-A instrumentation is observational
and permits a safe chooser fallback; it does not require unsafe legacy trust.

The literal draft is an old LINE (1,2)-(11,2) and marker CIRCLE (100,100), radius5.
Its real first-session history is4 ->5 ->6 ->Undo5; Save preserves the editor,
selection and actual Redo6/Undo5/Undo4/Redo5 entries. The captured pre-Save fingerprint
must become the saved baseline and survive recovery exactly. Recovered history
intentionally starts fresh; a new edit and Undo are tested. Original native A is
the separate literal LINE; accepted native B and A are independently compared.

## Executed source model

Actual main modules are compiled under fake Electron. A private fixture token
allows fresh main instances over the exact same owned files/profile, without
re-seeding or rewriting the checkpoint. The old host is idle before reconstruction.
The renderer executes verbatim fingerprint, Save, development recovery/persistence
and syncDesktop source with real core editors. Session one generates the retained
record through actual persistDevelopmentCheckpoint. Map-backed localStorage is
carried to a fresh VM; sessionStorage starts empty. Startup synchronization is an
explicit projection of update ->syncDesktop into the new host, not full DOM/preload
execution. All sources are hashed. No normal profile, watcher, converter or real
Electron instance is used.

Accepted Save As B followed by a failed auxiliary association checkpoint leaves
on-disk association A. A fresh main restores A while the renderer restores B's
content/name/saved fingerprint. Its ordinary Save then reaches main's A-target
atomic-write path. The fixture rejects that attempt before fs.open creates the
temporary sibling. A and accepted B remain intact; this records target selection,
not a completed overwrite.

Four pending failures cover checkpoint partial-write, rename failure, matching
basenames in different directories, and matching basename plus identical baseline
content followed by a new recovered edit and explicit syncDesktop notification
of its dirty/content state before Save. The last case prevents a name/content
heuristic from being treated as identity. Controls cover healthy accepted-B
reconstruction, intentional matching-A barrier instrumentation, renderer-only reload
with the still-live B association, missing/invalid association chooser cancellation,
and scenario inventory. Five final barrier records include four unrelated-A cases
and one intentional matching-A instrumentation control; do not count all five as
unsafe cases.

## Evidence and qualification

The initial9-check pack passed6 and failed3 at its expected safety oracles. Review
added explicit safe-outcome requirements, actual history checks, count-only failure
diagnostics and the identical-baseline edit case. The final10-check pack passes6
and fails4, with all9scenarios complete. Both earlier9-check executions, source
snapshots and final failures are retained privately.

The changed shared fixture's existing43checks retain their passing scope. The
fresh passing fast profile still excludes this pending reference; it fingerprints
it as an auxiliary input. The final selected gate passes49/49stages,1,288portable checks and222bound
inputs. This does not mean the pending10-check contract passes. Runtime, application,
manifest, package/version/dependencies and CI pins remain unchanged beta10. No new
LC-REL-02 product repair approach was used; one earlier diagnostic approach is used
and at most one remains. LC-REL-01's bounded budget remains exhausted.

## Limits, next action and rollback

This is injected filesystem failure plus modeled storage carryover/fresh modules,
not real Chromium persistence, OS restart, abrupt-exit durability, native transport,
full renderer startup/input gating, application/PDF/build/unpacked/native/installed/
upgrade/daily-use acceptance or measured real-world frequency. Intentional Close
clears development recovery separately and is not this scenario. Paired ordinary
Open and failed queued compensation are not covered. Raw development-warning
privacy remains unresolved. Beta7 startup cause is unknown; no retry ran.

Before the final bounded repair, review a paired identity and legacy migration
contract preserving accepted Save As, legitimate reload, dirty/imported state and
intentional fresh history. Require independently failing extensions for justified
missing boundaries. Do not select a name/content-only fix or generic command rollback.

Rollback is a focused revert of this test/helper/profile/documentation checkpoint;
beta10 runtime and prior manifests/fixtures/receipts remain intact. No installed
rollback is implied. The pending failures must not be presented as passing or as
a daily-use readiness result.
