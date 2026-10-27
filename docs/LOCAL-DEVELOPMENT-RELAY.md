# Local synthetic development relay foundation

LC-DEV-002 implements a tools-only local request/progress ledger. On October26,2026,
15/15 focused tests passed on Windows x64 with Node24.13.0. A separate actual
18-process CLI scenario committed8 events, replayed4 operations without appending,
and rejected4 invalid transitions without changing committed ledger bytes. An
independent stdlib reader passed11 measurements and12 rejection controls.

This is a synthetic-only protocol milestone. It does not connect chats, enable
outbound transport, pick up production work, transfer attachment files, execute
drafting commands, or integrate with the installed application. Real intake,
automatic pickup/delivery and cross-chat workflows remain unimplemented and need
their own authorized integration. No packaged runtime, schema or version changed.

## Durable state and ownership

tools/local-development-relay.cjs accepts an explicitly selected private local
store. Each synthetic request has a stable SHA-256 ID derived from its key and a
canonical payload hash. Replaying the same key and complete normalized payload
returns the existing state; conflicting key reuse is rejected. Artifact references
contain only a logical filename, byte count and SHA-256. They are not file paths,
file copies or proof of delivery. Inputs reject non-synthetic requests, unknown
executable fields, traversal names, malformed types and bounded-size violations.

The state contract is queued -> running -> needs_decision -> queued -> running ->
completed, with explicit release, failed and canceled paths. Claim generations
increase monotonically. Progress, completion, failure and release require the
current worker capability. The ledger persists its hash and generation; raw
capabilities stay in private claim files. The CLI saves and flushes a private
capability before publishing the claim, and supports retry using that existing
claim handle. Claim handles and their contents must stay private. A rejected
claim can leave an unused private claim file; only committed ledger nonmutation
is promised on rejection.

Release or a pending decision removes the active owner. A later claim uses a new
generation, so the old owner cannot add new work. There is no lease, timestamp/PID
expiry, automatic takeover or force-unlock. A lost capability requires deliberate
operator recovery; this tool does not infer that a previous worker is dead.

Decision-needed prevents completion until a resolution is explicitly recorded and
work is claimed again. Synthetic resolution records document supplied input; the
actor label is not authenticated and confers no real domain judgment, user approval
or authorization. The tool never interprets a request or resolution as executable
code. Terminal states reject new mutations.

## Publication, replay and limits

Each immutable event is first written to a uniquely owned pending file and flushed,
then published through an exclusive hardlink to its next revision filename. There
is no overwrite. Expected-revision checks plus exclusive publication permit one
winner when writers race; the loser must inspect/retry deliberately. An operation
ID binds its normalized action and owner identity. Exact retry is checked before
stale-revision and terminal guards: it returns current state plus the originally
applied revision, without another event. expectedRevision is a precondition and
is excluded from operation identity. Conflicting operation-ID reuse is rejected.
This deduplicates ledger transitions, not external CAD effects or message delivery.

The reader reconstructs state from contiguous events and prior-byte hashes; there
is no mutable latest-state cache. Unknown files, gaps, malformed records and broken
interior hash links fail closed. Named orphan pending files are counted and ignored,
never automatically deleted. Only the writer's own pending file is cleaned up.
A link may commit before pending-file cleanup reports an error; inspect/replay the
same operation ID rather than assuming an error means nothing committed.

The supported scope is a trusted same-user local filesystem. Existing symlink or
junction path components are rejected, including an actually tested linked store
root. This is not authentication or protection against hostile same-user filesystem
races. There is no external authenticated head: valid tail truncation or wholesale
rewriting is not generally detectable. Network/synchronized stores, parent-directory
power-loss durability, store-initialization interruption, disk/permission faults,
forced writer death and hostile recovery remain unqualified. There is no destructive
cleanup or compaction; stores are bounded to256 events per request and32KiB per file.

## Executed evidence

Focused tests cover canonical submission/replay/conflicts; strict synthetic schemas,
including array-shaped SHA rejection; stale revisions and foreign capabilities;
operation replay/conflicts; decision gating and old-owner fencing; release/reclaim;
all three terminal states; actual fresh CLI process recovery; a real two-child claim
race with exactly one winner; simulated orphan pending-file recovery; altered
interior links, missing revisions and foreign files; initialization refusal; linked
root rejection; and structured errors without machine paths or stack traces.

The first sandbox run retained2 passes and13 EPERM failures at hardlink publication.
No code changed before the approved-access rerun passed15/15, with no skips. This
is an environment/prerequisite distinction, not a product regression repair. The
orphan case creates a partial pending fixture; it does not kill a writer during
publication. All tests preserve their synthetic stores and prior failure evidence.

The separate frozen scenario uses a14-byte reference containing two marker metadata
and the following independently specified timeline:

| Revision | Event | State | Owner generation |
| --- | --- | --- | --- |
| 0 | Submit | queued | 0 |
| 1 | Claim drafting | running | 1 |
| 2 | Record two markers | running | 1 |
| 3 | Ask synthetic A/B decision | needs_decision | 1 |
| 4 | Record synthetic A | queued | 1 |
| 5 | Claim developer | running | 2 |
| 6 | Record local progress | running | 2 |
| 7 | Complete | completed | 2 |

Actual request/claim/progress/completion replays add no event. Completion while a
decision is pending, an old-owner progress command, terminal mutation and conflicting
request reuse are rejected. Every fresh CLI response and committed-prefix hash is
retained privately. audit-local-relay.py imports no product code and independently
checks canonical raw JSON,8-event hashes, literal request/reference data, state
transitions, two persisted capability hash bindings and final outcome. Its12
copy-only controls reject chain/revision/operation/schema/epoch/owner/decision/
artifact/terminal/capability corruption. Replays and rejected attempts are supported
by separate actual command receipts; a ledger alone cannot prove attempted commands.

## Explicit commands

Use a new private absolute store location on an approved local filesystem. CLI
stdout gives structured state and logical claim handles; failures give codes only.
Keep private store files, claims and command receipts out of public diagnostics.

    node tools/local-development-relay.cjs init ABSOLUTE_PRIVATE_STORE
    node tools/local-development-relay.cjs submit ABSOLUTE_PRIVATE_STORE REQUEST_JSON
    node tools/local-development-relay.cjs read ABSOLUTE_PRIVATE_STORE REQUEST_ID
    node tools/local-development-relay.cjs claim ABSOLUTE_PRIVATE_STORE REQUEST_ID REV OP_ID WORKER [EXISTING_CLAIM_HANDLE]
    node tools/local-development-relay.cjs update ABSOLUTE_PRIVATE_STORE REQUEST_ID REV OP_ID CLAIM_HANDLE ACTION_JSON
    node tools/local-development-relay.cjs record-decision ABSOLUTE_PRIVATE_STORE REQUEST_ID REV OP_ID DECISION_JSON
    node tools/local-development-relay.cjs cancel ABSOLUTE_PRIVATE_STORE REQUEST_ID REV OP_ID CANCEL_JSON

Run node --test tests/local-development-relay.test.cjs for focused checks. The
explicit local-development-relay-workflow.cjs takes one unique ordinary-grip-
prefix and runs the independent actual scenario with the existing Python venv or
CAD_PYTHON. All subprocesses have finite budgets:10s per CLI call,30s reader,45s
focused suite wrapper and240s scenario wrapper. No new dependency is installed.

Five tool/test/fixture inputs are added as gate fingerprint auxiliaries. No default
CI/application stage is added; hardlink/junction availability must be qualified in
each future environment. Existing beta5 manifest59/runtime12-resource identity,
full37-stage/648-portable results and installer are preserved, not rerun or rebuilt.
No app was launched this wake. Installed app/profile, associations, client drawings,
open/unsaved work and native desktop input remain unchanged. Native beta5 warning/
dialog, installed/upgrade, DWG and broad font/template/client acceptance remain
pending; daily-use readiness is false. Next safe item: LC-MON-008 import headline.
