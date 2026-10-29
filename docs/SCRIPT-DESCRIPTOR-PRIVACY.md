# Pending scripting descriptor privacy

LC-SEC-SCRIPT-DESCRIPTOR is open. This record freezes a bounded reference contract
and pre-fix synthetic observations; it does not implement or qualify a security fix.
Ordinary launches still disable scripting. An enabled descriptor contains a bearer
capability for document reads and edits, so access to that file is security relevant.

## Intended boundary

The first Windows implementation should support ordinary absolute local-drive
paths on an ACL-capable local filesystem, in a verified private current-user
directory. UNC/network paths, device/extended namespaces and alternate streams are
outside this initial contract. Directory ownership, effective access controls,
path type and reparse/ancestor conditions must be established before listening or
writing token bytes. Unsupported, missing or ambiguous security evidence fails
closed. A deliberate unsupported-path rejection uses `ERR_LINECRAFT_CONTROL_PATH`;
an incidental internal/probe failure must not count as that successful rejection.

The privacy goal concerns other nonprivileged accounts. It does not isolate
processes running as the owning user, administrators or SYSTEM. Explicitly allowed
privileged access must be documented; effective inherited/group access and the
ability to replace the directory need review, not just an owner-name comparison.

Node's Windows mode bits do not implement owner/group/other distinctions.
[Node file modes](https://nodejs.org/docs/latest-v24.x/api/fs.html#file-modes).
Windows supplies file security descriptors and inherited creation ACLs; a parent
directory check alone does not establish the final child's effective access.
[Microsoft file security](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights).
A null DACL grants access broadly; it differs from an empty DACL that grants none.
[Microsoft DACL definitions](https://learn.microsoft.com/en-us/windows/win32/secauthz/null-dacls-and-empty-dacls).

Preflight rejection must leave no listener, descriptor open or credential write.
Later open/write/sync/close failures must close the endpoint and attempt cleanup
of owned artifacts. If deletion itself fails, do not promise deletion: the bearer
must be unusable, and any residual-artifact warning must omit the credential.
Exclusive creation and preservation of preexisting/replacement files remain required.

## Explicit pre-fix reference

```
node --test --test-reporter=tap tests/script-descriptor-reference.test.cjs
```

The current unmodified service fails all four namespace references: UNC, device,
extended namespace and alternate stream. Eight controls pass for local lifecycle,
relative-path validation, exclusive creation, injected open/write/sync/close
failures and replacement preservation. The command intentionally exits nonzero.
Each failing case reports whether startup was accepted and its synthetic side
effects before the harness closes it. No result is a successful privacy acceptance.

The VM executes the actual CJS source with an allowlisted fake HTTP service,
in-memory filesystem, Windows path semantics and a deterministic nonsecret byte
sequence. It creates no real socket, descriptor, drawing, account or ACL. Unknown
module adapters are failures, and negative references require a specific policy
error plus zero side effects. The ordinary-local positive control is not an ACL test.

The JSON reference also lists owner/DACL/reparse, cross-account read denial and
residual-warning requirements as **not run**. There is no OS security adapter or
independent account evidence yet. These references are deliberately outside the
selected fast/application suites while the product fix is pending; both files are
fingerprinted auxiliaries. Existing passing gates do not satisfy this open security
requirement. No existing assertion, required gate, manifest or baseline was removed
or weakened. A runtime fix needs its own reviewed candidate identity and relevant
source/unpacked verification. Native, installed, administrator-resistance and
general Windows race/reparse acceptance remain unqualified.
