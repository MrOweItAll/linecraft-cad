# Ordinary file-operation diagnostics

LC-REL-02 remains partially implemented. This checkpoint completes a focused
operation/next-step diagnostic improvement, not broad save durability or import
acceptance. No drawing-corruption or ordinary-input data-loss defect was found.

## Verified problem

The independent actual-main/fake-Electron reference first ran against unchanged
beta9 main source. Of 20 cases, three success/cancel/busy controls passed and 17
failed the new diagnostic contract. Sixteen failures stopped at missing structured
fields; one artificial hostile throwable escaped through String() coercion in the
legacy error helper. These are contract failures, not 17 independently exercised
privacy-leak findings. Existing owned native bytes and immediate host state survived
qualified pre-commit failures. Arbitrary backend error messages could be returned.

## Change and compatibility

Ordinary Save/Open/import routes now return additive code, operation, nextStep and
diagnostic fields alongside ok/error. Fixed messages identify the operation and
include the next step in error, which existing renderer callers display. Stages
are caller-owned request, validation, dialog, write, read, import and finalize.
The catalog uses FILE_REQUEST_INVALID, DRAWING_VALIDATION_FAILED,
FILE_DIALOG_FAILED, FILE_WRITE_FAILED, FILE_READ_FAILED, FILE_IMPORT_FAILED and
FILE_FINALIZATION_FAILED. Known exact authored development restart messages map
to DEVELOPMENT_RESTART_REQUIRED. Size guidance retains 25 MiB; the units-helper
restart wording retains its existing compatibility contract.

Only an exact allowlist of own data-descriptor system codes is copied. Arbitrary
message, path, stack, cause, unknown code and getter values are omitted. The
shared fileOperation gate and generic failure helper remain unchanged. Success,
canceled and busy/trust response shapes are unchanged. Import is a generic stage:
a DXF failure is not necessarily a converter failure. Finalization guidance never
claims that a successful replacement/adoption was rolled back.

The shared atomicWrite cleanup warning now prints controlled text and an allowed
system code; temporary-file creation, write/flush/close, retry, rename and cleanup
order are unchanged. The prior preservation test's raw-message assertion migrated
to primary FILE_WRITE_FAILED/ENOSPC/stage=write; all preservation and cleanup
precedence assertions remain. No dependency, drawing schema or geometry changed.

## Checks actually executed

The final reference passes 22/22: the original 20 plus post-save finalization and
exact development-restart wording/appended-canary controls. It uses actual main
source, real owned files, fake Electron and an instance-local process facade. The
import factory is canned and its invocation is asserted; no converter is launched.
Cleanup leftovers are preserved. A separate 11-case mocked desktop security
contract passed. The final fast gate passes 48/48 stages, 1,245 portable checks and
219 bound inputs, including the prior 36-check preservation and 65-check renderer
source references. All earlier fixtures/manifests remain intact.

The first fast run passed its then-selected 21-case suite. Independent review then
found a restart wording mismatch that this profile did not cover. A new focused
regex reference failed before the correction; the corrected final gate includes
it. Both runs and the failure are retained, with distinct input identities.

Beta10 retains 59 runtime files and 12 resources. Only desktop/main.cjs differs
from beta9. The cumulative manifest retains all six earlier reviewed changes and
adds the seventh main-process change. Local workflow pins select beta10; no
publication workflow behavior or dependency pin changed.

## Limits and rollback

Full renderer/preload/runAction transport, queued Open, real parser/converter,
development checkpoint/discard authorization, clipboard, paper/3D, sharing/crash,
application/PDF/build/unpacked/native/installed/upgrade and daily-use acceptance
remain unqualified. Development restart formatting is tested through the actual
helper, not a running Electron development session. Arbitrary cleanup-error
getters/null and dev-persistence warning privacy are outside this qualified scope.
The historical beta7 startup cause remains unknown; no application retry occurred.

Rollback is a focused revert of this source/test/profile/version checkpoint,
restoring beta9 main and the prior preservation assertion/profile selection.
Keep original receipts, fixtures and manifests. No installed application rollback
is implied. Next investigate development persistence/discard state boundaries with
owned synthetic profiles and independently failing expectations before repair.
