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
residual-warning requirements as **not run** at that checkpoint. Runtime admission
and independent account evidence remain absent. These references are outside the
selected fast/application suites while the product fix is pending; both files are
fingerprinted auxiliaries. Existing passing gates do not satisfy this open security
requirement. No existing assertion, required gate, manifest or baseline was removed
or weakened. A runtime fix needs its own reviewed candidate identity and relevant
source/unpacked verification. Native, installed, administrator-resistance and
general Windows race/reparse acceptance remain unqualified.

## Standalone Windows metadata observer

`tools/observe-script-directory.ps1` is a read-only PowerShell 7 observer for a
caller-designated synthetic directory beneath a declared synthetic root. It
collects local volume type, directory/reparse attributes and managed security
descriptor data for that bounded chain. It does not enumerate contents, read a scripting connection
descriptor, change ACLs or enable scripting. Its normal output contains ordinal
positions and role labels, without paths, account names, SIDs, SDDL or raw errors.
Failures return a fixed error record and nonzero exit.

```
pwsh -NoProfile -NonInteractive -File tools/observe-script-directory.ps1 -LiteralPath $fixtureDirectory -DeclaredRoot $fixtureRoot
```

The schema labels its provenance `managed-roundtrip`. .NET can transform null
DACL representations internally; this observation combines missing/null states
as `unrestricted-or-absent` and never accepts either. It does not claim to recover
the kernel's original absent-versus-null distinction.
[.NET descriptor implementation](https://source.dot.net/System.Security.AccessControl/System/Security/AccessControl/SecurityDescriptor.cs.html).

`tools/script-directory-observation.cjs` strictly validates this redacted schema
and classifies a deliberately narrow **supported reference pattern**: current-user
ownership throughout the declared chain, fixed NTFS/ReFS, no reparse flags, a
canonical populated DACL, and basic full-control allows for current user, SYSTEM
and administrators only. An applicable current-user allow is required; inherit-only
rights cannot supply it. Deny, callback, object-specific, generic-mask, unknown-role
and complex flag cases are unsupported. The literal mask is 2032127; inheritance
flags distinguish InheritOnly=8 from Inherited=16.
[File rights](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.filesystemrights),
[ACE flags](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.aceflags).

Every classification returns `privacyEstablished: false`. This is not a general
Windows effective-access evaluator, group-membership expansion, authenticated
replay evidence or runtime admission. The root's parent is outside the boundary;
child-file inheritance, handle/path identity, replacement/race resistance and
independent cross-account denial remain unqualified. Windows access checks depend
on the requesting token and ACE semantics.
[Microsoft access checks](https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object).

The 23 portable reference tests join the candidate fast suite. Nineteen separate
Windows normalization checks construct synthetic raw descriptors without applying
them to OS objects. Those pass under PowerShell 7; the Windows PowerShell 5.1 check
is blocked by host execution policy and is not passed. A new inherited-ACL test
folder produced two real metadata observations and an unsupported reference pattern
because additional principal entries were present. No permission was changed.
That result is not proof that another account can access a live descriptor.

The application service, beta6 manifests and installer remain unchanged. The four
earlier pending path references remain unresolved; no live descriptor or endpoint
was created during this observer milestone. Production integration needs a
separately verified admission/identity design and exact-candidate qualification.

## Proposed bundled helper

The distribution choice is resolved in favor of a self-contained Windows helper.
The [implementation design and prerequisite assessment](SCRIPT-SECURITY-HELPER-ADR.md)
proposes retained handle ownership, child-file security checks, supervised live
admission and owned cleanup. Client transport identity is a separate required
review gate. This design changes no runtime behavior and establishes no Windows
privacy, cross-account, build or installed qualification. The metadata observer
remains a reference tool and cannot grant admission.

## Proposed service admission references

The explicit reference below executes the unchanged service in a VM, using fake
HTTP, identity-bearing in-memory file objects and scripted admission-lease replies:

```
node --test --test-reporter=tap tests/script-admission-reference.test.cjs
```

Current result:14 tests,5 controls passed and9 pending references failed; the command
returns nonzero. The service currently ignores the proposed `admission` option.
The references require deliberate preflight/child-preparation rejection, inert
publication, revocation before dispatch, session/sequence validation and owned
cleanup with fixed redacted diagnostics. Controls exercise the actual handler's
valid request, authentication/Origin rejection, exclusive creation and relative-path
rejection. Unknown modules or malformed fake-adapter calls cannot count as a
successful security rejection. Review tightened ordering, teardown and diagnostics;
original failed output is preserved privately.

The fixture in `tests/fixtures/script-admission-contract.json` defines a proposed
main-side adapter seam: `prepare`, lease `publish`, `checkReady` and `close`, with
session-bound revocation and fixed diagnostic callbacks. The fakes do not invoke
these operations for the service; current observed helper-call counts are zero.
This is not a production API, helper process or binary IPC protocol. The tests use
deterministic nonsecret bytes and create no real endpoint, descriptor, drawing or
Windows security object. Per-await deadlines bound tests; timeout is not cancellation.

Both new files are fingerprinted auxiliaries, outside the selected passing suites.
Their failures are never inverted into gate passes. The original namespace
references remain intact. Neither existing green gates nor future green VM
references prove Windows ACLs/native handles, cross-account denial, helper binary
integrity, transport authentication, crash/timeout behavior, full close concurrency,
normal Electron shutdown or installed acceptance. Those requirements remain open.
