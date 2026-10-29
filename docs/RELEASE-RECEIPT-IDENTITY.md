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

The pure summary uses its actual producer schema: status and version are checked
before asset mutation. It has no manifest filename/hash/candidate or start-time
fields. This change does not add complete schema validation, pure freshness/full
source bindings or authentication of receipts.

```
node --test --test-reporter=tap tests/release-receipt-identity.test.cjs
```

The test executes the actual preparation tool and manifest loader in a VM with
fake files/Git and real immutable baseline bytes. The first archive records a
sentinel and stops execution. Valid historical tag and preflight controls must
reach that exact boundary. Negative cases require intended errors and zero
archive/copy/write counters; unknown adapter operations fail the harness.

Before the guard,12 references failed while9 controls passed. After the guard,
all21 pass. The suite joins both baseline and candidate qualification; the fixture
and preparation tool are fingerprinted. No real asset preparation, archive,
installation, application or publication is exercised by these tests.

This is source-only prefix admission. Downstream asset contents, full receipt
provenance, clean-runner install/uninstall, publisher version matching and a
versioned candidate pipeline still need separate review/qualification. The existing
workflow remains1.36.0-only; beta7 is not made releasable by this guard. Merge,
tagging, workflow dispatch and publication retain their separate authorization.
