# Renderer Save/Open/discard source-function references

A new LC-REL-02 reference passes 65 checks: 64 named scenarios plus an inventory
check. It executes exact production functions in a Node VM with real core editors
and explicit UI/IPC adapters. This qualifies the executed source logic. It is not
an application launch or full renderer/native acceptance. Runtime remains beta9
at its prior code checkpoint; no product defect or runtime repair was established.
LC-REL-02 remains partially implemented.

    node --test --test-concurrency=1 tests/renderer-isolation-reference.test.cjs

The expanded candidate fast profile passes 47/47 stages with 1,223 portable checks
and 217 fingerprinted inputs. The new selected suite/profile justifies this fresh
gate. Package/version, runtime, candidate manifest, dependencies and CI pins are
unchanged. Older 46-stage and host/core receipts retain their historical scope.

## Actual code and independent state

The reference requires unique extraction boundaries and retains three verbatim
blocks from app: canonical-content/fingerprint/dirty/serialization/name helpers;
Save, discard permission and actual replaceDrawing; and Open. It records whole-app
and snippet hashes. The initial saved baseline is controlled per fixture; the
production functions and replacement body are not copied or rewritten in tests.
Host JSON avoids cross-realm object validation artifacts.

The idle model-space fixture has LINE old from (1,2) to (11,2), plus a CIRCLE
marker whose real edits 4→5→6 then Undo leave radius 5 and real Undo/Redo entries.
ID old is selected. Clean, dirty and imported-awaiting-save contexts are distinct;
matching content can still be dirty because the imported flag is true. Assertions
cover the same editor reference, complete serialized drawing, selection, revision,
command/phase, canvas, name, saved fingerprint, import flag and actual isDirty().
History probes occur after immediate state assertions and recover literal radii
6, 5 and 4 through actual Redo/Undo entries.

The incoming fixture is a literal CIRCLE centered at (20,40), radius 8, with an
explicit starting view centered at (100,200), scale 10. Native successful Open
preserves that view; a mocked normalized-import reply uses real core zoomExtents.
At 1000×700 with production padding 64, its independent fit oracle is center
(20,40), scale 35.75. Fitting alters view, not the content fingerprint.

## Executed behavior

- Save canceled, error, missing or rejected bridge responses retain the active
  editor, drawing, selection/history, name, saved baseline and imported flag.
- Successful Save records the exact submitted bytes and pre-await fingerprint,
  updates the displayed name, clears imported-awaiting-save and becomes clean
  when no later edit occurred. It retains the editor and history.
- A controlled edit to radius 7 during awaited Save survives all success/error/
  cancellation responses. Success keeps the earlier fingerprint, so current
  content remains dirty. This intervention is not native concurrent-input proof.
- Clean discard permission bypasses confirmation. Cancel/unknown decisions reject
  continuation; explicit discard grants permission without replacing the editor.
  Failed/canceled Save prevents continuation; successful Save permits it only
  while the current content matches what was saved.
- A late edit during canDiscard's Save remains dirty and blocks replacement.
- Open canceled/error/missing/rejected replies retain the old editor and state.
  Malformed ok:true replies are explicitly contract-violating bridge fixtures:
  parsing/validation rejects before replacement, not evidence that main accepted
  a malformed drawing file.
- Successful native or normalized-import Open uses actual replaceDrawing and a
  new real editor, with literal incoming geometry, empty selection and empty
  history. Import remains dirty despite a matching content baseline; subsequent
  successful Save clears that flag. Direct core import's Undoable replacement
  convention is different and remains covered separately.
- Successful Save before a subsequently canceled Open preserves its intentionally
  new clean baseline/name/imported status. It must not be misreported as a failed
  Open mutation. A failed discard Save never reaches the Open chooser.
- A controlled font-refresh Promise delays chooser dispatch; this does not load
  or qualify fonts. A hard-coded 64-case inventory prevents vacuous coverage.

Direct save/open functions propagate rejected bridge Promises. The tests expect
those rejections; production runAction catches them at a higher boundary. No
save-local recovery or false-return behavior is invented by a test stub.

The first execution failed in fixture setup because setViewSize was mistakenly
treated as an ok response. It failed before any VM function ran. The fixture now
uses the actual void API and asserts literal canvas size; the original source,
log and receipt remain private. This was not a production finding. Independent
code, test-validity, compatibility and privacy review approved the corrected
65/65 result without weakening the behavior expectations.

## Limits, rollback and next task

UI painting/update, palette/preview operations, modal nodes and bridge transport
are explicit adapters. The real replacement body and fingerprint functions run,
but full renderer initialization, DOM input blocking, preload IPC, host filesystem,
queued-open protocol, discard authorization, development persistence, clipboard,
paper/3D fitting and native chooser integration do not. The model fixture fails
closed if a paper or 3D fitting path is unexpectedly requested. Other source
helpers present in extracted blocks are not automatically qualified by inclusion.

There is no new Electron/application/PDF/build/unpacked/native/installed/upgrade/
client/converter/remote-CI or daily-use acceptance. The beta7 startup cause stays
unknown and unchanged startup was not retried. Historical beta6 built/native
receipts, all immutable manifests, fixtures and previous failures are preserved.
LC-REL-01's consumed two-attempt bounded repair budget is unchanged.

The remaining LC-REL-02 operation/next-step diagnostic criterion is unpassed.
Next freeze an independent failing Save/Open/import error-guidance contract in
the existing synthetic host harness, preserving ok/error/canceled compatibility
and privacy. Use the existing LC-MAINT-01 vocabulary incrementally; inspect before
any small justified fix. Do not infer a corruption defect from passing references.

Rollback is a focused revert of this test/documentation/profile checkpoint,
preserving unchanged beta9 runtime and independent later work. No runtime or
installed-app rollback is needed. Optional LINECRAFT_RENDERER_ISOLATION_REPORT is
an absolute caller-selected private output with synthetic state and source hashes.
