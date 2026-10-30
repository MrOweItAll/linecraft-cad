# Paired development recovery identity: beta11 source repair

Beta10's protected two-session reference showed accepted Save As B followed by
failed auxiliary persistence could leave host target A paired with renderer work
B. Beta11 correlates these records with a main-issued opaque UUID. A recovered
match may reuse the association; legacy or mismatched records preserve recovered
content/baseline/imported state and require an explicit chooser. Names and content
never establish file identity, and accepted native Save is not rolled back.

## Implemented boundary

Main writes a captured path/import-name/binding tuple as
`LinecraftDevelopmentPath/2`, reads v1/v2 safely, and starts restored targets
unverified. A dedicated development-only challenge/confirmation channel validates
exact request shapes, current trusted frame and nonce. Confirmation is synchronous
in main source; identical replay is idempotent and conflict/stale requests cannot
change verification. No path or drawing content is carried by this channel.

A load epoch handles reloads even when a frame object is reused. Save captures its
entry destination, chooser requirement and caller epoch before awaited validation.
Later confirmation cannot upgrade that in-flight operation. Ordinary verified
Save keeps its UUID. Explicit association issues a fresh UUID after native write/
validation and installs it before best-effort persistence, returning it even if
that persistence fails. An old-frame completion preserves accepted native work
without verifying the newer frame. Routine state messages never alter identity.

Strict queued adoption persists a proposed UUID while old live identity is held.
It publishes only after success and compensates with the captured old UUID/path/
import name after a concurrent state change. Failed compensation can leave a disk
candidate while live identity remains old; source tests confirm the old generation
and Save only the expected old file afterward. Generic queue code and id/name
notifications stay unchanged. Reset now retains the file-operation lock through
persistence. Packaged success/cancel/busy shapes remain exact and expose no usable
recovery bridge.

Renderer CPv2 keeps `developmentBinding` outside editor/native serialization,
fingerprints and exposed development debug state. Successful Save/Open/queued
commit/import/reset metadata is consumed before update/checkpoint; failed reset
cannot replace New or clear/close the current drawing. Existing early runAction
ownership and the queue's post-peek check remain in place.

Eager shared negotiation has a scheduled 1,000 ms fallback, catches missing,
rejected or malformed interfaces/replies, and ignores canceled/late epochs. This
is source scheduling behavior, not measured real IPC latency or a hard real-time
guarantee. Accepted reassociation cancels older negotiation.

## Executed source evidence

| Frozen reference | Historical beta10 pass / expected fail | Beta11 pass |
|---|---:|---:|
| Paired recovery | 6 / 4 | 10 / 10 |
| Identity/legacy | 3 / 11 | 14 / 14 |
| Challenge/lifecycle | 6 / 31 | 37 / 37 |
| Renderer negotiation | 4 / 19 | 23 / 23 |
| Live generation/ownership | 8 / 10 | 18 / 18 |

All 102 recovery checks now pass and are selected by the candidate fast profile.
The complete selected result is 54/54 stages, 1,390 portable checks and 227 bound
inputs. Two additional review-driven private controls pass for a throwing bridge
method getter and exotic direct-callback schema inspection. The latter is not a
real IPC-cloning exploit claim. Main/renderer/preload and the cumulative manifest
are reviewed separately for correctness, test validity, privacy and compatibility.

The older 43-check host reference (42 named cases plus inventory) keeps legacy startup data and its observer shape;
assertions now expect exact development replies with validated UUIDs and literal
v2 metadata. Paired fixtures use the actual dedicated callback bridge and retain
all target/content/history assertions. The non-recovery renderer fixture declares
packaged mode explicitly. Historical failed fixtures/receipts remain preserved.

Beta11 changes app/main/preload relative to the immutable beta10 parent. Its
reviewed cumulative manifest retains 59 runtime files, 12 resources and all eight
changes from the original release baseline. Package/lock edits are version-only;
CI edits only select the new manifest, with publication triggers unchanged.
No application, PDF, build, unpacked, native, installed/upgrade or daily-use
acceptance is established. No converter, remote CI, publish or client action ran.
Real transport/frame ordering, storage/crash durability, watcher/privacy breadth
and the unknown beta7 startup cause remain unqualified.

LC-REL-02 remains partial outside this bounded source repair. Both semantic repair
approaches are consumed; no further approach in this scope is available. Next
independent registered work is LC-REL-03's existing fake-process diagnostic/
termination matrix, including kill-false and missing-close behavior, with no real
converter retry.

## Recovery

A focused revert of 66aa22454a90b8c9906ac04d0d0ffbd790b843d5 restores beta10 runtime/version/profile/CI
selection. Preserve all evidence and profile/checkpoint copies before any older
source launch; no installed downgrade, live profile migration or drawing-format
change was performed.
