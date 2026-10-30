# Transform differential recovery references

This is an explicit pending LC-REL-01 recovery contract on unchanged beta8
runtime code. It adds synthetic references, not a runtime repair. Ordinary-input
reachability, drawing-file loss, renderer dirty state, crash recovery and native
behavior are unproven. The earlier rejected-fence repair remains intact.

Run only the named reference when qualifying a changed recovery implementation:

    node --test --test-concurrency=1 tests/transform-differential-reference.test.mjs

The reviewed run has **44 tests: 17 passes and 27 expected failures**, using 49
cached scenario traces and zero harness errors. The earlier 42-test execution
(17 passes, 25 failures) is retained privately; independent review added two
missing failed-COPY history branches and strengthened complete entity/viewport
success comparisons. No failing expectation was removed or weakened. A failed
assertion is a pending recovery requirement, not a passing acceptance check.

## Independent values and observations

The model fixture has LINE a from (0,0) to (10,0), LINE b from (0,5) to (0,15),
and an unrelated CIRCLE marker. Prior Undo/Redo is created with two real marker
radius changes, then Undo, without consuming new entity IDs. The literal expected
translations, reflection about x=20, and 90-degree rotation are authored in the
reference rather than computed through product geometry helpers. Rotation alone
uses a 1e-12 arithmetic tolerance; entity order, IDs and structural fields remain
exact. The untouched marker is compared in every relevant success route.

| Slice | Checks | Pass / fail | Observed boundary |
| --- | ---: | ---: | --- |
| Repeated COPY, local/global history, Exit, reservations | 11 | 6 / 5 | Failed second destination leaves unregistered e3/e4; retry adds e5/e6; local Undo removes e5/e6 but leaves rejected copies. Failed Exit clears selection; retry Exit still forms one ordinary history group. |
| COPY single, retry and default mode | 6 | 2 / 4 | Commit/history faults leave rejected copies; successful single mode and next-command multiple default are retained controls. |
| MIRROR keep/delete, typed/point ROTATE | 16 | 5 / 11 | Rejected operations retain changed document contents. MIRROR adds deleteOriginal before completion; point ROTATE updates lastPoint before completion. Typed ROTATE context alone stays unchanged. |
| Mixed paper LINE/viewport MOVE and COPY | 4 | 2 / 2 | Rejected operations retain transformed paper contents. Success controls preserve full viewport metadata, model contents, tokens/order and Undo/Redo. |
| Post-publication MOVE | 3 | 0 / 3 | Fault after record/idle leaves the move published, a new Undo group and prior Redo cleared. |
| Pre-assignment preparation fault and trace inventory | 2 | 2 / 0 | Existing preparation rejection preserves observed state/history; every injected fault fires once and retains the failed-input log. |
| Rejected COPY without successful retry | 2 | 0 / 2 | Failed single then Cancel, and accepted-first/failed-second then local Undo/Exit, fail preexisting-history recovery. |
| Total | 44 | 17 / 27 | LC-REL-01 remains incomplete. |

The paper fixture uses model LINE (0,0)-(1000,0), paper LINE (5,10)-(45,10), and
viewport vp1 with frame (20,30,100,60), model center (500,250,0) and scale 1:50.
MOVE by (10,15) expects paper LINE (15,25)-(55,25) and frame (30,45,100,60).
COPY by (150,0) expects e1 at (155,10)-(195,10), vp2 frame (170,30,100,60), and
order paper, vp1 token, e1, vp2 token. Complete view metadata is compared against
the fixture with only those explicit frame/ID changes. Undo/Redo preserve it;
a new copy after Undo reserves e2/vp3 instead of reusing undone IDs.

## Fault envelope

A temporary getter on one editor's entities field throws once. The predicate
requires literal expected geometry, the unchanged pre-input revision and a
selected core stack/selection/command boundary. Each trace records that proof,
the unsuccessful response and the retained failed-input command log. The original
descriptor is restored in finally. There is no global hook or product seam.

The declared boundaries are:

- Preparation: a planObjects read before assignment, with original geometry.
- Commit: commitObjects follow-up after both geometry/layout assignments.
- History: record's snapshot after selection clearing and before Undo insertion.
- Publication: result's stampScopes read after record and idle, while the changed
  result has not yet incremented revision. This proves recovery after the history
  branch has already changed; it does not inject inside push, eviction or clearing.

Tests compare full serialized drawing/resources/layouts, selection, revision,
content-derived dirty status, command/phase/data/points/selection, prompt,
lastPoint, active spaces/views and paper order. Actual Undo/Redo operations verify
specific prior documents, not only stack lengths or flags. Internal transaction
bookkeeping is exercised by retry, local Undo, Exit and Cancel. It is not directly
introspected. Input-log history is diagnostic history and deliberately retained.

Faults are artificial, synchronous and transient. Persistent/rollback faults,
OOM, exceptions inside private history storage operations, stack-eviction
qualification, arbitrary reentrant callbacks, crashes and power loss are outside
this pack. Preparation failure is a current-code control; a future checkpoint's
own preparation needs its own nonmutation check. No normal file-loss route is
established, and this evidence does not justify interrupting stable work.

## Narrow guard contract for the remaining repair

A checkpoint must precede terminal caller updates, then span the synchronous
operation through result publication. Guarding completeTransform alone misses
MIRROR's deleteOriginal and point ROTATE's lastPoint; COPY Exit calls finish
directly. Guard only the qualified terminal routes, including typed/point inputs,
not every execute/submitPoint call or every document mutation.

For repeated COPY the recovery boundary is the immediate pre-input batch state.
Preserve earlier accepted destinations, transaction bookkeeping, copyBatches,
transformSources, editingSteps and pending state. Restoring transactionBefore
alone would erase accepted work and does not satisfy this contract. Capture
selection, revision, complete continuation and affected spaces/views as well as
drawing/resources/layouts. Preserve actual Undo/Redo entry arrays, including a
cleared Redo branch; lengths cannot reconstruct lost entries. A shallow array
checkpoint is adequate only if code review establishes entries are not mutated
within this synchronous transform envelope. Other APIs can update saved history
entries; no universal immutability claim is made.

Retain monotonic entity/viewport reservations and stable existing IDs. Tentative
failed IDs may remain reserved; retry must not reuse them. Preserve ordinary
successful geometry, caller conventions and grouped Undo/Redo, including Cancel
retaining accepted multiple COPY destinations and local Undo removing one batch.
Retain the normal failed-input diagnostic outside the restored editor checkpoint.

Before applying the remaining semantic repair, review each qualified terminal
branch and the exact snapshot/restore mechanism. Record added document-copy cost;
avoid deep-copying the bounded history store on every destination. A passing
small synthetic suite cannot establish acceptable heavy-drawing overhead.
Qualify checkpoint-preparation rejection and the full failure/control pack after
that implementation. Do not broaden this into a global command rewrite.

## Qualification and rollback

The reference remains outside the selected passing fast profile. All prior 211
fast inputs and the earlier pending MOVE reference are unchanged, so neither an
unchanged passing gate nor the earlier unchanged failing reference was rerun.
The runtime, cumulative candidate manifests, dependencies and CI routing are
unchanged. No application/PDF/build/unpacked/native/installed/converter or remote
operation ran. Historical beta6 built/native evidence and the unexplained beta7
startup failure retain their original scope. Beta8 daily-use readiness is open.

Revert only this reference/documentation checkpoint if needed, preserving the
prior fence repair, earlier MOVE contract and later independent changes. No
runtime or installed-app rollback is needed. Optional LINECRAFT_REFERENCE_REPORT
writes complete synthetic traces once to an absolute caller-selected private
path; stack traces include local paths and must not be published as diagnostics.

Next: review the terminal-branch guard against these frozen references, then
apply at most the remaining bounded semantic repair with preparation-failure and
checkpoint-cost evidence. Keep every unresolved acceptance limit explicit.
