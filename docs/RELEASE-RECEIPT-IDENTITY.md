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
data is reused later. The audit identity follow-up hashes that same raw buffer,
compares it with the embedded audit digest, and requires the actual producer's
framework label, passed status, numeric9 total/9 passed/0 failed and nine passed
rows. The installed embedded total must also be9. Native/PDF binding paths must
resolve to the already-admitted output paths and their digests must match those
outputs. Parsing/projection still precede the new checks, preserving the existing
malformed-audit errors. JSON formatting and row order may differ when the embedded
digest binds the exact bytes.

These checks establish declared metadata consistency. Auditor identity, byte-size
declarations, chronology, row-name/inventory completeness, measurement correctness
and execution authenticity remain unverified. Lexical path checks and cached names
do not prove Windows file identity or resistance to concurrent replacement. Copies
remain outside the prefix test.

The stored dependency-audit JSON is also read and parsed before the first archive.
Its existing strict numeric-zero `metadata.vulnerabilities.total` requirement is
unchanged. The later summary reuses that admitted object. The workflow separately
runs npm and checks its process exit code; no npm subprocess is added here. This
prefix guard does not establish advisory freshness, authenticity, completeness,
severity consistency or dependency inventory, and it does not fetch advisories.

Each application's existing `tests.map(t => ({name:t.name,status:t.status}))`
projection now runs before the first archive. The later summary reuses the
per-mode cached arrays; original application records remain available for output
admission. Missing/null/non-array test lists and null rows retain their existing
TypeErrors. Empty arrays and partial rows remain permitted. This move adds no
row-count, name/status-type or all-passed rule. Exact mapper/cache reuse is checked
by code review; the prefix tests do not serialize the downstream summary.

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

The audit-identity follow-up reproduced21 failures alongside120 passes; all141
pass after one implementation repair, retaining all117 prior cases. Raw-byte
hash failures are separate from coherent changed-audit cases that refresh their
embedded digest before testing status/count/binding rejection. Three controls
accept reformatted exact bytes, reordered rows and normalized binding paths. No
actual PDF auditor, application, drawing or PDF format is executed by this suite.

The dependency-admission follow-up reproduced8 failures alongside143 passes; all151
now pass, retaining all141 prior cases. Missing/malformed reports, missing nested
fields and nonzero/non-numeric totals require their existing exact errors and zero
asset mutations. Minimal and formatted numeric-zero controls remain admitted. No
npm audit, advisory request or current vulnerability qualification ran.

The application-projection follow-up reproduced12 failures alongside157 passes;
all169 now pass, retaining all151 earlier cases. Four isolated projection failures
per mode reject before mutations; six empty/partial-row controls preserve existing
permissiveness. No actual application, asset preparation or full-summary output
qualification is inferred.

This is source-only prefix admission. Downstream asset contents, full receipt
provenance, clean-runner install/uninstall, publisher version matching and a
versioned candidate pipeline still need separate review/qualification. The existing
workflow remains1.36.0-only; beta7 is not made releasable by this guard. Merge,
tagging, workflow dispatch and publication retain their separate authorization.
