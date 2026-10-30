# Rejected trim/erase fence recovery

This is one bounded LC-REL-01 repair in candidate 1.36.1-beta.8. It does not
complete atomicity acceptance for every transform, insertion or other batch.

## Reproduction and verified scope

Four independently authored lines define two targets, each from x=-20 to x=120
at y=0 and y=20, with cutting boundaries at x=0 and x=100 spanning y=-40 to y=40.
A vertical fence at x=-10 runs from y=-20 to y=40. Normal trimming must retain
both targets from x=0 to x=120; fence Erase must remove both targets.

After entering TRIM, the test selects both target IDs through the public editor
API. A per-editor getter temporarily wraps the existing entities array. It
throws exactly once only after the first target has changed or disappeared,
revision has incremented once, and the second target still has its literal
original geometry. It disarms before throwing and restores the ordinary data
property in a finally block. No product hook or global monkeypatch is added.

The fault models an **artificial synchronous engine-state read exception** after
an accepted mutation. It is not an ordinary malformed input, a GUI-selection
exercise, a memory-exhaustion simulation or evidence of a naturally triggered
user corruption route. The pure editor has no renderer dirty flag: the test's
content-dirty oracle compares complete serialized content with a declared saved
baseline. Actual renderer dirty behavior remains unexecuted.

Before repair, document contents/resources and history recovered. After an
erased target, the restored document contained its ID but selection omitted it;
revision advanced by one after both trim and erase failures. The existing
rollback restores document data and validates the already-mutated selection,
while its snapshot omits selection and revision. This isolates the missing state
restoration; it does not demonstrate serialized drawing loss.

## Implementation

The existing `applyTrimFence` boundary in `core.mjs` now captures pre-batch
selection and revision. Its catch restores them after the existing document
restore, alongside its existing local-step and cutting-boundary restoration.
The success path is unchanged. Prior accepted repeated edits remain accepted;
only the failing current batch rolls back. ID allocation, geometry, tolerances,
file formats, command conventions and dependencies are unchanged.

## Executed checks

The private observation protocol retained six scenarios and a separate
seven-check observation audit: six passed and selection restoration failed.
The permanent eight-case regression initially had an authoring error: its
earlier-accepted-edit proof expected the untouched right endpoint at x=120,
although that fixture deliberately accepted a prior right trim to x=100.
That expectation was corrected to the independent literal x=100 before changing
production code. Both original failed evidence sets are retained privately.

The corrected baseline produced three passes and five contract failures. After
one two-line production repair, all eight cases pass:

- Failed trim and erase batches restore complete document, selection, command
  context, revision and content-dirty observations in clean and prior-history
  contexts.
- Failed batches add no local/global Undo entry and preserve an existing Redo
  branch, checked by subsequent actual Undo/Redo calls.
- Successful trim and erase batches keep literal geometry, selection behavior,
  local Undo and a single global Undo/Redo group.
- A failed later fence preserves an earlier accepted trim and its local Undo.
- Invalid fence coordinates reject before mutation and add no history.

The explicit beta8 fast gate passes 42/42 stages with 1061 selected portable
checks and 211 fingerprinted inputs. Twelve unavailable historical private core
references remain explicitly excluded. The new suite is selected only in the
candidate profile; the unchanged original core test-accounting contract remains.
Independent code/compatibility, test-validity and cumulative-candidate reviews
approved the scoped change. No new application/PDF, build/unpacked, native,
installed/upgrade or remote-CI qualification ran.

## Candidate identity, limits and rollback

The beta8 manifest preserves all 59 runtime files, 12 resources and six cumulative
baseline changes. Its parent binds the exact preserved beta7 manifest. Only
`core.mjs` differs from beta7; package/lock changes are application-version-only.
CI's explicit candidate arguments select beta8, without changing action pins,
permissions or triggers. This is future routing, not an observed remote run.

The beta7 hidden-startup failure remains unexplained and was not retried. Beta6
remains the historical built/native candidate. Beta8 has only the executed pure
source scope; its application, build, native, installed and daily-use readiness
remain unqualified. Arbitrary exceptions during rollback itself, transform/block
commit boundaries and every other batch family remain separate work.

For rollback, review and revert this focused beta8 change as a unit, including
its version, candidate, runner and CI routing changes; preserve prior manifests,
failure evidence and later independent changes. Do not revert only the core hash
while leaving beta8 identity metadata inconsistent. Existing artifacts and the
daily-use installation were not changed.

Next: characterize one representative transform's commit/history failure
boundary using a new focused synthetic expectation before another repair.
