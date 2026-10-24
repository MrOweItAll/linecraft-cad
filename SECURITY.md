# Security reporting

Do not disclose credentials, control descriptors, authentication tokens, client drawings or detailed exploit instructions in a public issue.

If this repository's **Security → Advisories → Report a vulnerability** option is available, use it for a private report. If private reporting is unavailable, open a minimal public **security contact request** asking for a private channel, without the reproduction, sensitive file or exploit detail. No unverified email address is designated here.

Include the affected release/tag, component, impact, reproduction conditions and a synthetic sample when a private channel is established. Distinguish an observed exploit from a suspected weakness. Useful areas include drawing/resource parsing, native file/output handling, script-control authentication and dependency packaging.

Local scripting is disabled on ordinary launches. Its opt-in control descriptor is temporary and contains an authentication secret; keep it outside repositories and shared output. Do not attach that descriptor to a report. A drawing content/base token is not a substitute for the transport credential. The protocol accepts structured operations, not arbitrary executable JavaScript or shell commands.

Maintainers evaluate reports according to impact and available capacity. Response, fix and release dates are not guaranteed, and this policy does not create a service-level agreement or bug-bounty commitment. Normal crashes and feature gaps without a security impact belong in the bug/feature templates.
