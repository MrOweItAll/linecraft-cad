# ADR-001: Paired development recovery identity

**Status:** Implemented and source-qualified in beta11; real transport/native/installed qualification pending
**Date:** 2026-10-30 UTC
**Deciders:** Authorized local code writer with separate read-only correctness,
test-validity and privacy/compatibility review. Implemented in the beta11 source repair.

## Context

The [frozen paired reference](PAIRED-RECOVERY-REFERENCES.md) establishes conditional
wrong-target attempts in the source model. Main restores a private path while the
renderer independently restores content and saved fingerprint. An accepted Save As
can leave those records different after auxiliary persistence failure. Equal
basenames and equal content/baselines cannot recover the missing file identity.
The reference blocks writes before temporary creation; real restart/storage and
ordinary application drawing loss remain unqualified.

Both LC-REL-02 semantic repair approaches are consumed; zero remain.
LC-REL-01 also has zero remaining approaches. The qualified beta11 repair preserves
accepted native Save, exact packaged replies, drafting/identity/history conventions
and intentional fresh recovery history. It used existing source/isolated profiles,
with no dependency, installed change or unchanged application retry.

## Decision

Use a main-issued opaque UUID generation to correlate development association and
renderer recovery records. It is consistency metadata, not authentication, content
identity or permission to name a native path. Main remains the only path authority.
No token enters native drawing serialization, editor state, geometry, fingerprints,
user messages or open-request notifications.

The wire contract uses an additive development-only `developmentBinding` UUID on
successful native association replies. Successful import-without-native-path and
reset replies explicitly carry `developmentBinding: null`; omission is legacy or
unavailable metadata, never proof of a native association. Host association records use
`LinecraftDevelopmentPath/2` with path/import-name/binding written together.
Renderer recovery records version2 carry the exact additive key `developmentBinding`
(UUID or explicit null) alongside existing content, saved fingerprint and imported
state. This key is implemented in the beta11 source repair. Legacy version1 content must still recover,
but its unverified native target must require explicit Save As fallback.

Reconciliation uses a dedicated development-only channel, distinct from routine
state synchronization. A strict `{version:1, action:'challenge'}` request returns
only `{ok:true, challenge:UUID}`. The nonce is main-issued, inert and stable within
one boundary. Confirmation supplies `{version:1, action:'confirm', challenge:UUID,
binding:UUID-or-null}` and returns `{ok:true, matched:boolean}`. Reject extra keys,
invalid shapes and stale frames without echoing private payloads. Packaged main
must expose no usable channel; packaged preload retains method absence.

Confirmation is synchronous and gated to the trusted current frame and nonce.
An identical confirmation is idempotent; conflicting or stale confirmation must
not mutate verification. Rotate nonce on frame/adoption/reset boundaries. Null
cannot verify a native target. Save entering unverified captures chooser routing
before awaited validation; later confirmation cannot upgrade that operation.
Completion from an older frame preserves accepted native work but cannot unlock
the new frame. Routine state notifications cannot reconcile or invalidate identity.
Renderer negotiation must handle missing/rejected/malformed/hung replies with a
bounded safe chooser fallback. After awaiting negotiation, recheck file-action
ownership so queued actions cannot share a stale busy decision. These contracts pass source regressions; real IPC ordering remains unqualified.

### Lifecycle invariants

| Transition | Required generation and file behavior |
|---|---|
| Explicit Save As/native adoption | After native validation/write succeeds, issue a new generation and install the accepted live path/generation before auxiliary persistence. Return that generation even if checkpoint persistence fails. |
| Ordinary Save to a verified association | Keep its generation stable. Cancellation/precommit validation or write failure keeps the old generation, baseline and files. |
| Native Open | Validate before adoption; issue/return new generation. Renderer consumes it before replacement/update/checkpoint. |
| Imported drawing without native path | Clear native binding, preserve imported dirty semantics and suggestion; native Save requires a chooser. |
| New/reset/intentional Close | Clear binding only after successful reset. Failed/busy reset must not replace editor content or clear its previous binding. |
| Queued prepare/cancel | Publish no candidate generation. Existing id/name-only notifications stay unchanged. |
| Queued commit | Persist proposed candidate generation without changing live old identity. Adopt/publish it only after success; enrich only the successful dev commit reply. |
| Queued compensation | Restore the exact old path/import-name/generation. A second failed write must not make a stale candidate bind to unrelated recovered content. |
| Renderer success handling | Consume returned binding before update() synchronization and checkpoint persistence. Renderer never synthesizes a generation from a path, name, fingerprint or observer. |
| Cold restore/new renderer frame | Restored target starts unverified. Matching generation may retain routing; otherwise preserve recovered content/baseline and use explicit safe fallback. |
| Routine old notification during awaited Save/Open | Must not clear or replace the newly accepted live association. Recovery verification is not performed on every routine message. |
| Duplicate recovery announcement | Idempotent for the current boundary; cannot adopt a path, resurrect old identity or act as a later routine invalidation. |

The renderer has one current binding value outside its editor. Returning a new
binding after accepted native work is mandatory even if the disk checkpoint is
old; otherwise the existing wrong-target failure survives. Same-association edits
and ordinary Save do not rotate it. Explicit reassociation may rotate even if the
chosen basename/content is unchanged.

## Options considered

| Option | Complexity | Compatibility | Safety |
|---|---|---|---|
| Paired opaque generation (chosen) | Small lifecycle state across main/app/preload | Healthy tokenized restart/reload remains; legacy targets need explicit fallback | Detects accidental cross-channel mismatch without trusting names/content |
| Always Save As after every recovery | Lowest | Changes established healthy restart/no-chooser behavior | Safe fallback, used for unverified legacy records only |
| Name/content/fingerprint matching | Superficially small | Ambiguous copies look identical | Rejected by identical-baseline reference; cannot establish file identity |
| Generic rollback on auxiliary failure | Broad semantic change | Would undo accepted native Save and its baseline | Rejected; accepted B must remain accepted |

## Trade-off analysis

Legacy migration intentionally trades automatic target reuse for a chooser while
preserving content, imported dirty state and saved fingerprint. UUIDs do not prove
that files have not changed externally and do not defend malicious checkpoint
editing. No cryptographic, crash-durability or OS-transport guarantee follows.
A pending verification state is necessary for Save-before-sync. A frame-specific
recovery boundary is necessary to avoid stale notifications invalidating accepted
work. These are lifecycle obligations, not reasons to broaden drawing formats.

## Consequences

- Two development recovery records can be correlated without exposing paths to the renderer.
- Healthy new-format restart/reload can retain the intended association.
- Legacy/invalid binding uses explicit fallback with recovered work preserved.
- Future main/app/preload changes require a cumulative manifest binding all three files, retaining the immutable beta10 parent and full59runtime/12resource closure.
- Packaged responses and drawing compatibility must remain unchanged.
- Real storage/transport/frame-ordering and native acceptance remain separately unqualified.

## Action items

1. [x] Freeze source-level legacy/frame/reset-before-sync and generation-allocation prerequisites in the identity boundary reference.
2. [x] Preserve the historical paired10 six-pass/four-failure receipt. The beta11 bridge adaptation retains its safety assertions; current execution passes all ten checks.
3. [x] Freeze independently expected positive-generation, queued compensation, live-generation replay and integrated file-action ownership controls in the separate ownership reference. The renderer reference retains healthy/dirty/imported recovery, returned-binding update ordering and returned reset failure. The 102 recovery assertions now pass in the qualified source envelope; real transport/native acceptance remains separate.
4. [x] Qualify challenge/confirmation, scheduled bounded fallback and healthy renderer ordering in the source references. Real transport/frame timing remains unqualified (see DEVELOPMENT-RECOVERY-BINDING.md).
5. [x] Use the final LC-REL-02 repair approach; both approaches are consumed. Retain all prior failures and do not start another semantic approach in this scope.
6. [x] Qualify exact source bytes, packaged compatibility and separate code/test/privacy reviews in beta11. Application/native/installed acceptance remains outside this contract.

## Historical beta10 prerequisite notes

The following paragraphs describe the pre-repair beta10 evidence. For current
beta11 qualification, see the source repair linked below.

The separate [renderer negotiation reference](RECOVERY-NEGOTIATION-REFERENCE.md)
uses a manual virtual clock, verbatim replacement/persistence bodies and an
explicit update adapter.
It freezes source deadline and late-reply expectations; current production never
starts negotiation, so the deadline branches are not yet exercised successfully.
Healthy renderer negotiation may finish before dispatching native Save. It must
not upgrade a native Save that already entered main while unverified.

The [live-generation/ownership reference](RECOVERY-OWNERSHIP-REFERENCE.md) adds
actual reply/disk/confirmation probes and verbatim runAction/queue ownership
controls. Its existing busy controls pass; awaited-recovery races stop at the
absent negotiation prerequisite. Early ownership reservation and a valid check
across the await are both acceptable ways to preserve exclusive file actions.


Beta11 implements this contract in [the source repair](DEVELOPMENT-RECOVERY-BINDING.md).
All five reference packs pass102/102 in the selected54-stage profile. Earlier
prerequisite notes above describe their historical beta10 checkpoint. The bounded
source repair does not establish real IPC/storage/crash or installed readiness.
