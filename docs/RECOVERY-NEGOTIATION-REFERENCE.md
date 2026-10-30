# Renderer recovery negotiation prerequisite reference

The explicit reference `tests/recovery-negotiation-reference.test.cjs` has
23 checks: three controls plus inventory pass, and 19 contract expectations fail.
All 22 named cases execute without harness errors after preserved fixture import
and missing visibility-adapter corrections. Earlier failed fixtures/logs remain
private. No production repair or additional semantic approach is used.

The current failure stages are four absent-negotiation expectations, six plain
Save requests where explicit chooser routing is required, two early Save requests
before a modeled negotiation deadline, six version1 checkpoint observations, and
one returned reset failure ignored by the renderer. Version2 `developmentBinding`
is an explicit ADR prerequisite choice; a version1 observation is not a newly
proved product defect or an executed overwrite. The healthy v2 content assertions,
successful deadline and late-reply branches remain blocked by missing negotiation.

The Node-only fixture extracts verbatim fingerprint, recovery, persistence, Save,
Open, New, queued Open and replacement bodies from `app.mjs`. It uses real core
editors and 2D zoomExtents, literal drawing entities, fixed opaque bridge replies,
Map storage and explicit UI adapters. The first actual replacement/update boundary
calls actual synchronization and checkpoint persistence immediately. This tests
the required binding-before-update ordering through a persistence projection; it
does not run the full DOM/debounce/transport path. Native/import/reset clearing
and reset-failure preservation start after a successful canned Save As reply
carrying a UUID and an actual nonempty checkpoint. The current renderer still
writes version1 there; consumption of that UUID remains unqualified. UUIDs must
stay outside drawing bytes, editor state,
fingerprints and projected UI messages. No main/preload or native write runs.

The manual clock never fires timers automatically. Frozen hung-challenge and
hung-confirmation cases require finite scheduled fallback, prevent early native
dispatch, permit unrelated timers, and forbid duplicate Save or late protocol/
checkpoint side effects. No numeric product timeout or real latency is inferred.
The current source dispatches immediately and fails before deadline expiry; this
checkpoint therefore does not qualify a working negotiation timer.

This file is auxiliary-only and excluded from the selected passing fast profile.
The unchanged protocol37, identity14 and paired10 references are also excluded and
were not rerun. Runtime, main/app/preload, package, candidate manifest, version and
CI remain unchanged beta10. LC-REL-02 remains partial: one earlier repair approach
is used and at most one remains. LC-REL-01 has zero remaining approaches.

The fresh selected fast gate passes 49/49 stages and 1,288 portable checks with
225 bound inputs. It fingerprints all four pending references as auxiliary inputs;
it does not execute them or turn their expected failures into passing acceptance.

Before that remaining repair, freeze main live-generation probes after queued
rejection/compensation and duplicate/conflicting confirmation, verify actual
ordinary-Save reply and disk-generation stability, and add the integrated renderer
file-action ownership recheck after awaited negotiation. Review those controls
independently. Real frame ordering, IPC, storage/restart/crash durability, full
renderer/paper/3D/watch behavior, application/native/installed/upgrade/daily-use
qualification and the unknown beta7 startup cause remain open. No unchanged
application or converter retry is authorized by this reference.

Rollback is a focused revert of this test/auxiliary-binding/ADR/docs checkpoint;
retain the unchanged beta10 runtime and all earlier evidence.
