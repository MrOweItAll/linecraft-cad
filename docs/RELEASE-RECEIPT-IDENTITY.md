# Release receipt identity admission

The historical asset-preparation tool now checks receipt lineage before its first
archive, copy or output write. It uses the existing default `loadManifest()`
selector, which remains the immutable1.36.0 baseline. No candidate selector,
workflow trigger or publisher permission changed.

The package version must match the selected manifest. Release and installed gate
receipts must match its exact filename, byte digest and boolean candidate flag;
each receipt's bound source inputs must include that manifest digest. A mismatch
returns `ERR_LINECRAFT_RELEASE_IDENTITY` with a fixed reason. Existing status,
version, command, timing, source-hash, ref/commit and installer checks remain.

Receipt format discriminators must match the actual producers exactly:

| Receipt | Required format | Start field | End field |
| --- | --- | --- | --- |
| Release and installed | `LinecraftPublicGate/1` | `startedAt` | `completedAt` |
| Clean install | `LinecraftCleanRunnerInstall/1` | `startedAt` | `finishedAt` |
| Pure summary | `LinecraftPublicPureSummary/1` | Absent | `completedAt` |

Raw gate and clean-install timestamps must be finite parsed strings satisfying
`CI start <= receipt start <= receipt end <= current time`. Equal boundaries and
zero durations are valid. Clean installation uses `finishedAt`; a renamed
`completedAt` cannot substitute for it. PowerShell round-trip timestamps with
seven fractional digits remain accepted at JavaScript date precision. Ordering
between different receipts is not established by these per-receipt checks.

The pure summary uses its actual producer schema: status, version and recorded
completion time are checked before asset mutation. Completion must be a finite
parsed string within the inclusive CI-start/current-time window. Pure has no
start-time field; this does not prove that the whole pure run began within that
window.

Pure must bind the selected manifest digest. Its source map must be a non-null
object, with the same sorted input names and lowercase64-character digests as both
release and installed reports. Those reports' hashes are checked against current
files by the existing guard. JSON property order may differ. This establishes
consistency of declared inputs, not independent inventory completeness: a key
jointly omitted from all three corrupted reports is not detected. Complete schema
validation and authentication of receipts remain separate requirements.

The source, unpacked and installed application reports are read once before the
first archive. Five existing requirements now run there for every mode:32 passed
application checks, zero failures,9 embedded PDF passes, the pinned Electron
version and a start at or after CI start. The admitted records are reused for the
later summary. These application reports have no top-level format/status field.
Their start-only lower bound is unchanged; this move adds no completion-time or
future-time rule.

Both installed output paths now pass the existing resolved work-root prefix and
exact byte-digest checks before archive creation. The pre-existing hash comparison
immediately before each later copy is retained. The actual PDF audit JSON is also
read, parsed and mapped to its summary rows before the first mutation; that mapped
data is reused later. This moves the existing parse/projection requirements only:
audit digest, status, counts and bindings are not validated by this preparation
step. Lexical path checks and cached names do not prove Windows file identity or
resistance to concurrent replacement. Copies remain outside the prefix test.

```
node --test --test-reporter=tap tests/release-receipt-identity.test.cjs
```

The test executes the actual preparation tool and manifest loader in a VM with
fake files/Git and real immutable baseline bytes. The first archive records a
sentinel and stops execution. Valid historical tag and preflight controls must
reach that exact boundary. Negative cases require intended errors and zero
archive/copy/write counters; unknown adapter operations fail the harness.

The first identity guard changed12 failing references/9 passing controls into
21 passes. The pure-summary follow-up reproduced16 failures alongside26 passes;
all42 passed. Those cases cover completion-time boundaries, malformed or
inconsistent input maps, property-order independence and preservation of required
release/installed start times. The chronology/format follow-up reproduced27 failures
alongside53 passes; all80 now pass. It adds reversed, stale, future, coerced and
missing end times, wrong or absent producer formats, valid interval boundaries and
PowerShell fractional timestamps. Already-rejected raw completion cases remain
controls. The suite joins both baseline and candidate qualification; the fixture
and preparation tool are fingerprinted. No real asset
preparation, archive, installation, application or publication is exercised. The
application-admission follow-up reproduced15 failures alongside83 passes; all98
now pass, retaining all80 prior cases. Five single-field negatives per mode prove
rejection before asset mutations; three CI-start equality controls stay admitted.
These synthetic report counts do not represent executed application or PDF tests.

The installed-output follow-up reproduced17 failures alongside100 passes; all117
now pass, retaining all98 prior cases. Literal native/PDF byte strings with
independently recorded digests exercise custody only; they are not valid drawing
or PDF files. Outside/sibling/traversal paths, wrong digests, changed or missing
known files and unparseable/unmappable audit data reject before mutation. Two
normalized in-work path controls stay admitted. Traversal receipts retain their
raw path spelling until production resolves them. Explicit missing-file errors and
audit-read counters distinguish these rejections from unknown harness operations.

This is source-only prefix admission. Downstream asset contents, full receipt
provenance, clean-runner install/uninstall, publisher version matching and a
versioned candidate pipeline still need separate review/qualification. The existing
workflow remains1.36.0-only; beta7 is not made releasable by this guard. Merge,
tagging, workflow dispatch and publication retain their separate authorization.
