# Offline publisher checksum reference

This explicit PowerShell reference evaluates only the unchanged checksum block
from `.github/workflows/windows-beta.yml`, using synthetic logical lines and
payload bytes. It does not execute the publisher. No metadata admission, location
change, remote lookup, gh command, upload or release command enters the block.
The earlier three-term metadata expression probe is not repeated.

```
pwsh -NoLogo -NoProfile -NonInteractive -File tests/publisher-checksum-reference.ps1
```

PowerShell7 with the used .NET SHA256 API is an explicit prerequisite. The recorded
local run used7.6.9 and passed32/32 reference cases. This is a separate command;
no PowerShell stage or product dependency is added to default portable CI. The
script and literal fixture are fingerprinted by both source profiles. Missing
PowerShell is not a passing or silently skipped required reference execution.

The harness requires unique extraction anchors, the whole workflow SHA256 and
the exact normalized/dedented block SHA256 that it executes. AST checks restrict
commands to two local adapters and the existing ToLowerInvariant method; static
type use, redirection and dynamic invocation are rejected. Known-only adapters
supply checksum lines and hash synthetic UTF-8 bytes with .NET SHA256. Literal
expected digests were established independently with Python SHA256. Unknown
adapter operations cannot satisfy an expected rejection. Pinning and AST checks
are a trusted-source test boundary, not an untrusted-code security sandbox.

Five positive cases retain unordered complete membership and case-insensitive
hex/filename comparisons. Twenty-seven other cases verify exact original error
messages and short-circuit hash-attempt counts for digest shape, delimiters,
whitespace/paths, duplicates/case aliases, unknown/notes/checksum names, incomplete
sets and wrong/transposed digests. Changed synthetic bytes reject; a deliberately
missing known fake asset has a separate adapter marker. Every case reads the fake
checksum content once. Accepted/rejected refer to this checksum block only.

Filename lookup is deliberately case-insensitive in the fake map. Real Windows
filesystem identity, line/BOM decoding, file hashing/custody/permissions/races,
actual ZIP/PDF/installer/content validity, full metadata admission, remote refs,
write-token isolation in execution, publication and CI remain unqualified here.
Notes remain outside the six checksummed payloads. Strict-case/order/metadata
format/version policies would be separate changes, not existing protections.
Workflow, publisher, preparer/planner, package, runtime, manifests, original
reference fixtures and installed/client state are unchanged by this milestone.
