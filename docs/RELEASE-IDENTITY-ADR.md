# ADR-REL-001: frozen release identity contract

**Status:** Frozen source-preparation integration implemented; publisher and candidate policy unchanged.
**Date:** 2026-10-29
**Deciders:** Maintainers and independent qualification/security reviewers.
Release execution and any publication-policy expansion require separate review.

## Context and constraints

The current release path is historical1.36.0-only. A valid QA candidate does not
become releasable through that path. The
[receipt admission guard](RELEASE-RECEIPT-IDENTITY.md) has171 synthetic prefix
cases, which stop at the first archive boundary. It does not qualify complete
prepared assets, the publisher, installation or daily use.

The initial inventory changed documentation only. The standalone follow-up adds a
pure metadata model and portable tests. Preparation, publication, runtime, immutable
baseline, candidate selection, triggers, token permissions and assets are unchanged.

## Observed boundaries

| Boundary | Current source evidence | Consequence |
| --- | --- | --- |
| Source identity | `tools/prepare-beta-assets.cjs:4-21` | Reads HEAD, requires exact tag or named preflight ref, compares tag commit with HEAD, checks tracked cleanliness and package/selected-manifest version equality. |
| Manifest selection | `tools/source-manifest.cjs:6-30`; preparation calls `loadManifest()` without a selector | Preparation selects immutable `PUBLIC-SOURCE.json`, version1.36.0. Explicit QA candidate support does not change this default. |
| Candidate creation | `tools/create-candidate-manifest.cjs:7-12` | The old generator copies the baseline and records one changed file. Do not use it to regenerate a cumulative candidate as a release-policy shortcut. |
| Installer naming | `package.json:74-79` | NSIS artifact template is `Linecraft-CAD-${version}-Setup.${ext}`. |
| Prepared metadata/assets | `tools/prepare-beta-assets.cjs:52,86-111` | Package version drives source/installer names and source prefix; summary tag/class depend on tag versus preflight mode. |
| Workflow intake | `.github/workflows/windows-beta.yml:3-8,60-83` | Fixed `v1.36.0` tag and named branch; fixed uploaded artifact paths. Dispatch does not itself make the publisher eligible. |
| Publisher isolation | `.github/workflows/windows-beta.yml:90-107` | Separate write-token job downloads evidence; no checkout, npm install or project helper execution there. |
| Publisher checks | `.github/workflows/windows-beta.yml:112-127` | Checks commit/tag/class, six checksum-listed assets, hashes/completeness, and observed remote commit before calling the release CLI. |

The baseline manifest digest is
`c7cb2c46702e7e88b7ddd84aa83b038bf52aa0a5901d3154bf3fb60bba41b5c7`.
The current beta7 QA manifest digest is
`a17516f6005ba8cb4a9c65b7c27751454a12b93508962c1354c584533bf595d5`.
Current package version1.36.1-beta.7 differs from the default release baseline;
inspection therefore predicts rejection at the package/manifest guard. No actual
preparation attempt was made for this inventory.

## Independent literal policy references

Use `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` as the synthetic HEAD/tag commit.
These are expected data values for future tests, not executed release receipts.

| Input mode | Package / selected manifest | Exact ref | Manifest candidate | Output tag / class |
| --- | --- | --- | --- | --- |
| Tag | `1.36.0` / `1.36.0`, baseline file/digest above | `refs/tags/v1.36.0` | `false` | `v1.36.0` / `prerelease` |
| Preflight | Same baseline tuple | `refs/heads/codex/public-beta-1.36` | `false` | `null` / `candidate` |
| QA beta7 | `1.36.1-beta.7` / same QA candidate version | Any | `true` | Unsupported by the frozen release policy |

Preflight release class `candidate` is distinct from the manifest's `candidate`
boolean, which is false for both supported historical modes.

The exact six checksummed payload names are:

```
Linecraft-CAD-1.36.0-Setup.exe
Linecraft-CAD-1.36.0-Source.zip
Installed-Acceptance.linecraft
Installed-Acceptance.pdf
Public-Beta-Verification.json
libredwg-0.13.4-upstream.tar.gz
```

The source archive prefix is `Linecraft-CAD-1.36.0-Source/`. The upload set adds
`SHA256SUMS.txt` separately. `release-notes.md` is a notes input outside the six
checksummed payloads; it is not a seventh payload or an uploaded release asset.

## Publisher compatibility observations

The current identity clause does not explicitly check verification `version` or
`format`. Its PowerShell `-notmatch`, `-in` and `-ne` operations are case-insensitive
by default. Do not describe the digest regex as strictly lowercase or silently
replace that behavior with case-sensitive JavaScript comparisons.

A bounded local PowerShell7.6.9 expression probe confirmed that an uppercase digest
matches the current regex, case aliases match the allowlist/duplicate comparisons,
and changing only version or format leaves the current identity clause satisfied.
Wrong commit, tag or class fails that clause. The probe executed only synthetic
expressions: no file hashing, artifact validation, remote lookup or publisher ran.
It does not demonstrate a complete publisher acceptance, attack or CI result.

Notes are not covered by the payload checksum set. The remote-commit lookup is an
observation before publication, not an atomic tag pin. Any future version/format,
notes-integrity, case-policy or remote-ref change needs its own explicit contract
and failing reference; this inventory implements none of them.

## Decision proposed

Start with a pure frozen source-identity planner in the read-token qualification
side. It accepts explicit package/selected-manifest/ref/HEAD/tag-commit metadata
and returns canonical tag, release class, source prefix and the asset-name tuple.
It has no filesystem, environment, Git, process, network or publication access.

The first extraction preserves the two historical tuples above and rejects a
coherent beta7 tuple. It does not add a generic version grammar, candidate selector
or new release channel. The wrapper still loads/verifies manifest bytes, reads Git
state, checks receipts and performs side effects. Planning output grants no
publication authority and must not contain a `publicationAllowed` switch.

Do not import this project helper into the write-token publisher or execute helper
code downloaded with artifacts. The publisher's independent inline policy remains
fixed. A later offline data-only publisher reference validator may run under read
permissions, but its format/version/checksum/case/notes policy must first be stated
explicitly; it is a separate milestone from the source planner.

## Options considered and trade-offs

| Option | Benefit | Cost / constraint | Disposition |
| --- | --- | --- | --- |
| Retain all inline source identity logic | Smallest immediate change; existing171 prefix references remain authoritative | Identity/name derivation stays coupled to side effects | Preserve as the baseline oracle. |
| Extract a pure frozen source planner | Independently testable literal metadata/name contract without changing release scope | Wrapper and publisher still need separate qualification | Proposed first implementation. |
| Reuse one executable validator in both jobs | Reduces duplicated logic | Project/artifact code under the write token conflicts with the current isolation boundary | Not part of this design. |
| Generalize candidate versions and workflow/publisher together | Could eventually support a versioned release path | Requires exact-candidate build/install evidence, trigger/token review and release authority | Deferred; no incidental generalization. |

## Consequences and staged work

1. Establish literal tag/preflight/beta7-rejection expectations against current
   behavior. Alter package/manifest version, selected file/hash/candidate flag,
   ref and tag commit independently. Keep all171 prefix cases.
2. Extract only the frozen planner, then compare before/after behavior and exact
   output names. This is a behavior-preserving extraction; do not invent a failing
   product regression to describe it as a fix.
3. Integrate on the read-token source side only after independent code/test/privacy
   review. Preserve default baseline selection and all existing receipt guards.
4. Separately inventory/test publisher data policy. Missing version/format and
   strict-case expectations are proposed future requirements, not current passing
   protections. Any product fix needs a genuine failing reference first.
5. Consider candidate release support only through a separately reviewed policy
   and exact-candidate qualification. No workflow, trigger, permission, publication,
   build, installation or converter action follows from this ADR.

This design does not resolve receipt authenticity/inventory completeness, auditor
identity, OS file identity/races, native/installed acceptance or client/domain
requirements. The existing pipeline remains historical1.36.0-only.

## Standalone model milestone

`tools/frozen-release-identity.cjs` implements the frozen metadata API without
imports, filesystem, environment, Git, process or publication access. It is not
called by `prepare-beta-assets.cjs` or the publisher. The API takes explicit
package/manifest/mode/ref/HEAD/tag-commit fields and returns fresh immutable name
and metadata values. `canonicalTag` remains `v1.36.0`; preflight's
`verificationTag` is null. HEAD is a nonempty opaque string; Git object validity
and authenticity remain caller responsibilities. Preflight needs no tag commit.

The actual unchanged wrapper passed171 prefix cases, retaining the original169
and adding two literal archive-argument, installer-read and tag-lookup controls.
Its selected manifest remains the real default baseline. The new API separately
passed21 pure-context tests with independent literal expected outputs, frozen
inputs, alternate matching commits and coherent-beta7 rejection. Explicit
candidate/file/hash/flag API negatives are not claimed as accessible routes of
the selectorless wrapper. No fabricated red-to-green product fix is reported.

Both baseline and candidate profiles select the new unit suite and fingerprint
the actual helper/reference inputs. The original receipt fixture is unchanged.
These checks do not establish complete prepared-output equivalence. Integration
remains deferred until a bounded virtual characterization covers downstream
verification metadata, asset names/checksum text and final log semantics, without
running real archive/copy/build/publisher operations. Preserve the existing early
Git/manifest guard order and all171 prefix cases when that integration is reviewed.

## Virtual downstream characterization

The unchanged preparer now runs to completion in an opt-in in-memory harness for
both frozen tag and preflight modes. The original171 prefix cases retain their
first-archive sentinel. Seventeen additional controls cover two complete virtual
outputs, two post-archive copy-adjacent hash rejections, seven denied adapter
operations and six in-memory output mutations detected by the independent oracle.
The suite totals188 cases; these are synthetic checks, not fresh application or
installed acceptance. Both profiles fingerprint the new literal reference.

`tests/fixtures/release-serialization.json` freezes full verification objects and
SHA256 values, ordered six-record checksum text and final console text. Its
expected values were authored independently of the planner and preparer. Python
SHA256 establishes the synthetic-byte reference; Node checks actual serialized
bytes. The reference includes selected nested omission/projection controls. It
preserves preflight verification tag null/class candidate and canonical final-log
tag v1.36.0. Notes and the checksum file remain outside the six checksum records.

Only exact Git calls, four copy pairs and two write paths are modeled. The fake
archive contains declared placeholder bytes, with no ZIP validity claim. Unknown
modules, filesystem operations/paths and child commands fail closed without host
fallback. The VM adapter is a test boundary for trusted source, not a security
sandbox for untrusted code. No real archive/copy/write, app, PDF, installer,
publisher or network operation is executed by these cases. Filesystem permissions,
races and authenticity, broad privacy/redaction and actual assets remain separate.

The standalone planner is still unwired. This characterization is a reference for
a future narrowly reviewed integration, preserving the early ref/tag-commit,
tracked-clean/time and default-manifest guard order. Neither candidate selection
nor the publisher/write-token boundary changes. A future integration must compare
the same complete virtual outputs and retain all prefix/API/adapter controls.

## Frozen source-side integration

The planner is now lazily loaded and called after the original package/manifest
identity guard. CLI/ref/tag-commit, tracked diff, CI time and real default-manifest
admission retain their original order and failures. The already observed tag
commit is retained; preflight performs no tag lookup. Planned installer/source
names, archive prefix, verification tag/class, checksum/notes names, immutable
payload/upload arrays and canonical final tag supply the existing wrapper. Receipt
admission, output hashes and side effects stay in that wrapper.

The original188 case declarations and reference fixtures are retained; four
source-expression mutation needles are retargeted to their corresponding planned
output suppliers. Full tag/preflight verification bytes, hashes, checksum text,
copy/write names and final logs match the unchanged independent literals. Ten
new controls check real-helper calls with literal inputs, seven early-failure
orders and propagation of a deliberate helper-body exception before receipts.
The preparation suite totals198; the separate planner API suite retains21.
Before integration,197 checks passed195/failed2 because the two new invocation
contracts required a not-yet-wired helper. That is integration evidence, not a
previous product defect. The final combined219 cases pass.

The real default loader fixes the baseline file/hash/flag/version. The planner's
nonempty HEAD requirement is stricter for malformed external/mock Git responses;
no universal equivalence or Git authenticity claim is made. Earlier standalone
milestone descriptions retain their historical scope. Candidate release support,
write-token publisher behavior, actual assets/ZIP/PDF/installer, OS races, native
or installed acceptance and publication remain separate and unqualified here.
No workflow, trigger, permission, runtime, package or manifest change is included.
The next distinct design slice is read-only reference characterization of remaining
publisher data validation beyond the already completed three-term local expression
probe; project/artifact helper execution under the write token remains prohibited.

## Offline checksum reference milestone

The separate [publisher checksum reference](PUBLISHER-CHECKSUM-REFERENCE.md)
executes only a pinned current checksum block against synthetic adapters, with32
literal outcomes and access counts. It preserves case-insensitive comparisons
and unordered membership. Neither the publisher nor the completed three-term
metadata expression probe runs. Whole-workflow and executed-block identities,
AST restrictions and known-only adapters bind the bounded execution. This does
not implement a new publisher validator or stricter version/format/case policy;
actual artifacts, OS semantics, remote refs and publication remain separate.
