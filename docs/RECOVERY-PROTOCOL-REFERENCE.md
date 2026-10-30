# Recovery protocol prerequisite reference

The new explicit reference has 37 checks: 6 passes (five controls plus inventory) and 31 expected
failures, with 36 semantic records and no harness errors after a preserved fixture
parse correction. Thirteen stop at the missing protocol interface, eleven at
missing binding metadata, one at missing explicit null import metadata, one at
missing development preload API, four at unsafe plain-Save fallback requests,
and one at renderer New ignoring a returned busy reset failure. These are not
31 overwrites, privacy leaks or exercised positive-generation branches.

Actual main/queue/core functions use owned synthetic profiles and A/B files, fake
Electron and distinct fake renderer-frame objects. Strict VM slices exercise
production New, Save and recovery functions with explicit storage/UI/timer
adapters. Import dispatch is canned; no parser, converter, application or native
restart runs. Captured stale ordinary Save is rejected by the existing trust
check. Packaged main permits absence or a controlled unusable channel; only the
preload check requires method absence. Successful New keeps fresh editor history.

ADR-001 now freezes a separate two-step nonce challenge/confirmation channel.
The new reference is auxiliary-only, outside the selected passing fast profile,
as are the unchanged paired10 and identity14 references. Neither old reference
was rerun. Selected-profile and exact-input results are recorded independently;
no pending reference becomes passing merely because the selected gate passes.
Runtime, candidate manifest, package, version and CI pins remain unchanged beta10.
No product repair approach is used; LC-REL-02 remains partial with one remaining.

Independent reviews found remaining prerequisites: healthy renderer negotiation,
actual returned binding consumed before update/checkpoint, dirty/imported recovery,
live generation after queued failure/compensation and duplicate/conflicting
confirmation, stable ordinary-Save checkpoint binding, and a finite deadline
assertion. The current projected microtask timers do not qualify a deadline or
latency. Positive branches blocked by missing metadata remain unexecuted. Real
frame ordering, transport/storage/restart and full renderer/native/installed
qualification remain unperformed. Beta7 startup cause remains unknown.

Rollback is a focused revert of this test/helper/profile/docs checkpoint, leaving
beta10 runtime and all previous fixtures, failures, manifests and receipts intact.
