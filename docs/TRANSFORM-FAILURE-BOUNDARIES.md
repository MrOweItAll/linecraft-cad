# MOVE commit and history failure boundaries

Code under characterization: `46521bcd78aa2464388c7046e99f07469ff21289` (beta8).

LC-REL-01 remains incomplete. This beta8 characterization demonstrates an
unrepaired recovery deficiency under artificial post-assignment exceptions.
It does not change production code or qualify a naturally occurring data-loss
route. The separate beta8 rejected-fence repair remains unchanged.

## Executed fixture and fault model

The literal model-space LINEs are `a: (0,0)-(10,0)` and
`b: (0,5)-(0,15)`. MOVE from base `(0,0)` to destination `(5,7)` must produce
`a: (5,7)-(15,7)` and `b: (5,12)-(5,22)` with the same IDs. Clean and prior-history
contexts are distinct. The latter has two accepted unrelated marker edits,
followed by one Undo so a genuine Redo branch exists before MOVE.

A per-editor wrapper of the public `state.entities` data property throws one
uniquely identified read exception. It arms only after **both** moved LINEs have
their literal expected geometry and revision still equals its pre-attempt value.
The selection phase and captured stack distinguish two boundaries:

| Boundary | Selection at injection | Stack location |
| --- | --- | --- |
| Commit follow-up | `a,b` retained | `commitObjects` / object enumeration |
| History snapshot | Empty | `snapshot` / `record` / `finish` |

The trap disarms before throwing and restores the ordinary data property in
`finally`. No product hook, global monkeypatch, dependency or client input is
introduced. This is an **artificial synchronous state-read fault**, not a malformed
file, memory-exhaustion simulation or proven ordinary-user failure route.

## Verified observations

All four phase/history combinations return `ok:false, changed:false`, but both
LINEs remain moved. The history-snapshot cases also retain the cleared selection.
Revision has not incremented. In clean cases, a full serialized-content dirty
oracle changes from false to true. Actual renderer/UI dirty state was not run.
These are rejected/unrecorded full transforms, not a demonstrated one-object
partial MOVE.

History consequences are measured **after normal Cancel**, not inferred from
the immediate error. Cancel records the moved document as a new Undo entry and
clears the preexisting Redo branch. A subsequent Undo recovers the pre-MOVE
document in these cases. No disk save, installed application or real drawing
was involved; irreversible drawing-file loss was not demonstrated.

The private nine-scenario producer and separate nine-check acceptance audit
retain four passing controls and five failing contract checks. An independent
inventory/facts check verifies all nine named scenarios exist, avoiding vacuous
control loops. The reusable explicit public reference independently reproduces
the same **4 passes / 5 expected failures** across nine tests:

    node --test tests/transform-atomicity-reference.test.mjs

The four per-boundary restoration checks and the post-Cancel history contract
fail. Successful MOVE in clean/prior-history contexts, invalid-input isolation
and typed ROTATE 90 controls pass. The typed rotation uses literal coordinates
with a declared 1e-12 arithmetic tolerance. Point-driven rotation and other
transform failure routes remain unexecuted.

This pending contract is explicitly outside the selected passing candidate
profile. It must not be presented as a passing gate or silently included in a
green aggregate. The prior beta8 fast result remains historical: its 211 bound
inputs are unchanged, so the unchanged passing profile was not rerun here.
No new application/PDF/build/unpacked/native/installed or remote-CI check ran.

## Why a generic rollback is not yet justified

`completeTransform` mutates through `commitObjects`, clears selection, then calls
`finish` and `record`. Generic catches currently report the error without a
checkpoint restore. A history-snapshot fault occurs before Undo insertion; an
exception later during history publication could have different effects and was
not injected by this reference.

Restoring `transactionBefore` indiscriminately would rewind to command start and
could discard earlier accepted repeated COPY batches. A checkpoint solely inside
`completeTransform` also misses caller changes: point-driven ROTATE changes
`lastPoint` before calling it, and MIRROR changes `deleteOriginal`. Document
snapshots alone omit selection, revision, continuation and history state.

The remaining repair therefore needs a reviewed terminal-input and publication
contract. No second semantic repair was attempted in this characterization.

## Proposed recovery contract — not implemented

1. Define the boundary before terminal-input mutations for each qualified route.
   Distinguish pre-command state from the immediate pre-destination state in
   repeated COPY. Preserve prior accepted copies and existing local/global Undo
   conventions.
2. Stage document/resource/layout changes and all throwing preparation before
   publication where practical. Define what happens if checkpoint preparation
   itself rejects; that path must leave state unchanged.
3. Specify document contents and stable existing IDs; selection, revision and
   content-dirty baseline; command/phase/data/points/selection, prompt and last
   point; transaction bookkeeping and active-space/view state if touched.
4. If the guard spans history publication, preserve actual Undo/Redo entries,
   including eviction and cleared Redo. Stack lengths alone cannot recover them.
   Retain the ordinary failed-input command-log entry; that log is distinct from
   Undo/Redo and should not be erased to make snapshots compare equal.
5. Preserve the existing monotonic entity/viewport reservation convention.
   Existing IDs must remain stable; do not rewind one counter or Set and permit
   ID/token reuse. Qualify any stronger allocator rollback contract separately.
6. Bound added checkpoint cost. Avoid deep-copying the bounded Undo store for
   every COPY destination; existing immutable history entries permit a narrower
   checkpoint design. Measure/record any additional document-copy cost rather
   than claiming it is free.
7. Qualify one-shot synchronous faults at stated boundaries. Persistent faults,
   arbitrary exceptions during rollback, OOM and crash/power-loss recovery remain
   separate, explicitly unsupported claims for this slice.

Before spending the remaining repair attempt, freeze independent differential
references for COPY multiple (accepted first destination, failed later one,
retry, local Undo, exit and global history), COPY single, MIRROR keep/delete,
point/scalar terminal routes, a mixed paper geometry/viewport case with stable
tokens/order, and the selected history-publication envelope. Review the narrow
proposed guard against those references before production mutation.

## State and rollback

The register records a confirmed deficiency **within this artificial fault
envelope**, not a general production corruption finding. Overall LC-REL-01
acceptance remains incomplete. The earlier fence repair is retained; runtime,
candidate manifests, dependencies and CI routing did not change here. The beta7
startup cause remains unknown, and no unchanged application retry was made.

This change adds a pending reference and evidence/backlog text only. A rollback
of this characterization commit should preserve the prior runtime repair and
later independent work; there is no runtime or installed-app rollback to perform.

Next: implement and independently review the bounded differential reference pack
for repeated COPY/terminal-input/history preservation, then choose the narrow
recovery guard before another semantic repair.
