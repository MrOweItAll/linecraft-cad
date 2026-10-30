# Save and native-import isolation references

Current follow-up: renderer source-function logic now has a separate passing
[VM reference](RENDERER-ISOLATION-REFERENCES.md). The historical host/core result
below keeps its scope; full application/native integration remains unqualified.

LC-REL-02 remains **partially implemented**. A new 36-check reference qualifies
existing host file-preservation and real-core malformed-import behavior. All36
checks pass on unchanged beta9 runtime. No runtime repair, destructive-save defect
or naturally triggered drawing-file loss was established. The tested preservation
behavior is already satisfied within the bounded matrix below.

    node --test --test-concurrency=1 tests/save-isolation-reference.test.cjs

The candidate fast profile now selects this reference. Its fresh run passes
46/46 stages with1,158portable checks and216bound inputs. A new test/profile is
the reason for that gate; unchanged application or build qualification was not
repeated. Beta9's runtime,59-file/12-resource cumulative manifest, package/version,
dependency pins and CI configuration remain unchanged. The earlier45/1,122/215
qualification remains historical.

## Literal fixtures and actual code

Literal valid native drawing A has LINE old from(1,2) to(11,2). Different valid
native drawing B has CIRCLE new centered at(20,40), radius8. The real owned file
starts with exact A bytes. Clean host state and Save payload use A; dirty host
state and payload use B. An unrelated temporary-file sentinel is retained.
Successful dirty Save must replace A with exact B and clear the host dirty flag.
Failure must retain exact A bytes/hash and the immediate pre-operation host state.

The harness compiles the actual main-process source under a fake Electron object,
with a per-instance require facade for its filesystem calls. Other dependencies
and core validation are real. An appended read-only association getter exists only
in the in-memory test compilation; no production export or test hook is added.
No global Module loader patch, Electron binary or real window is used. App identity
is mocked packaged to exclude development-profile persistence/watch behavior.
Files are unique synthetic work fixtures; original drawings are not involved.

The association observation includes native path, imported-save name, dirty flag,
name and text, plus the file-operation busy flag. The title and complete observed
state are compared immediately after rejection, before any subsequent Save probe.
That later successful probe verifies destination routing and intentionally clears
its dirty state. It must not mask an earlier failed-state comparison.

## Executed matrix

Ten Save cases each run with clean and dirty host state,20checks total:

| Case | Required observation |
| --- | --- |
| Temporary open denied | Old bytes/state retained; no created sibling to remove. |
| Partial write/ENOSPC | Only the owned sibling receives a17-byte prefix; close/cleanup occur, old destination remains exact. |
| Flush rejection | Rename is never attempted; old bytes/state retained. |
| First close rejection | Finally closes the actual handle on the second call; no rename. |
| Permanent rename rejection | Failure occurs before replacement; owned sibling removed. |
| Exhausted busy rename | On Windows six attempts reuse the same flushed sibling, then cleanup; old bytes/state retained. |
| Actual exclusive-open collision | A real competing sentinel causes wx rejection; that file is never unlinked. |
| Cleanup denied | Primary write error remains; old bytes/state retained; owned17-byte leftover is explicitly observed. |
| Ordinary overwrite | Exact payload, clean host state, no owned sibling, unrelated sentinel preserved. |
| Transient rename | On Windows two injected busy rejections followed by real replacement; no rewrite/reflush. |

The trace asserts an exclusive unique sibling, requested wx/0600 arguments,
write/flush/close/rename ordering and counts, and owned-only unlink. The requested
mode is not a Windows ACL qualification. Retry policy follows the actual host
platform: the tested Windows run has three transient and six exhausted rename
calls; a non-Windows host follows the current immediate-rejection branch rather
than claiming Windows retry execution. No rename fault is injected after a
successful replacement. Close rejection is transient, not a persistent-handle
release claim. Cleanup failure is preserved as a leftover, not called cleanup
success. Cleanup warnings and original syscall messages remain private evidence.

Two further cases preserve both host states on canceled Save As. Eight cases
cover canceled native Open, read rejection, invalid JSON and unsupported schema,
with clean/dirty state; a valid native Open control adopts exact text/path/name
and the clean host baseline. These are31host checks.

Five more checks execute the real core. Four malformed inputs (JSON, format,
duplicate IDs and invalid geometry) preserve full serialized content, selection,
revision and real prior Undo/Redo branches. Independent marker radius edits
4to5to6, then Undo, establish the history; after rejection, actual Redo/Undo recover
those exact old documents. A successful import control remains an Undoable
replacement. Renderer Open instead creates a fresh editor with empty history;
those success conventions must not be confused.

Independent review strengthened the clean fixture and exact operation ordering.
The original passing run/source remain retained privately; no assertion was
weakened and no product repair was made. Review covered code/harness behavior,
test validity, privacy and compatibility separately.

## Unqualified acceptance and next action

This executes actual host logic and core validation under mocks. It does not run
the renderer, native chooser, installed application, DXF/DWG import branch,
converter, development-profile association persistence or discard-authorization
flow. Host dirty booleans are mirrored inputs; they do not qualify renderer saved
fingerprints. Renderer editor identity/selection/history/dirty state on failed or
canceled Open still needs a separately reviewed source-function reference or
coordinated application acceptance. Existing import adapter coverage keeps its
original scope and was not rerun as a converter attempt.

Errors currently forward raw syscall/simulated messages; collision errors can
contain an owned absolute path. These tests establish that observation and
primary-error retention, not the requested operation/next-step guidance. Define
an independent failing diagnostic acceptance before any future production fix;
do not claim the diagnostics criterion passed.

Persistent close/rollback failures, real Windows sharing locks, crashes/power loss,
network filesystems, malicious reparse attacks and broad platform durability are
unqualified. There is no new application/PDF/build/unpacked/native/installed/
upgrade/client/remote-CI or daily-use acceptance. The beta7 startup cause remains
unknown and unchanged startup was not retried. Historical beta6 built/native
evidence and all old immutable manifests, fixtures and receipts are retained.

Next: complete renderer Save/Open/discard failure/cancel state references using
the existing source-function VM pattern, starting from idle synthetic editors
with real history. Preserve intentional successful Save changes when canDiscard
saves before a later canceled chooser. Then isolate any remaining diagnostic gap
with an independently stated failing contract. No corruption repair is justified
by this passing matrix.

Rollback is a focused revert of this test/documentation/profile checkpoint,
preserving beta9 runtime and earlier independent work. No runtime or installed-app
rollback is needed. Optional LINECRAFT_SAVE_ISOLATION_REPORT contains full paths,
raw errors and synthetic state; retain it privately. Default unique fixture work
folders are synthetic artifacts, not a native application profile.


## Recorded Windows retry oracle - October 30, 2026 UTC

A later selected gate observed an ordinary successful synthetic Save using two
native rename calls. The prior exact-one trace assertion failed after destination
bytes, state, baseline and cleanup assertions passed. Existing runtime already
permits at most six Windows attempts for EPERM/EACCES/EBUSY. The first receipt did
not record the actual error code; no specific sharing or filesystem cause is
established.

The 36-case reference now records each rename outcome/code and whether its error
was injected or returned by the filesystem. Successful attempts require a bounded
contiguous rename group, allowlisted preterminal errors and exactly one final
success. Literal permanent/exhausted/transient injected error counts and all file,
state, routing and operation-order assertions remain. Observations are preserved
before assertions, with later routing traces captured separately. This corrects a
fixture expectation against an existing contract; no runtime repair or LC-REL-02
semantic approach was used. The initial failed gate is preserved privately.
