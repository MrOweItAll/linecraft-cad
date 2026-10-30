# Import work and group-boundary source reference

The explicit LC-REL-04 reference has **26 checks: 19 pass and seven expected
failures**, across 25 named cases with zero unexpected errors. Runtime remains
unchanged beta12; no product repair approach or actual converter attempt occurred.

## Literal geometry and observed work

An ordinary 3-column by 2-row INSERT of LINE(1,2) to (3,2), positioned at (10,20)
with spacing (4,5), produces these independently calculated endpoints:

| Column,row | Start | End |
|---|---|---|
| 0,0 | (11,22) | (13,22) |
| 1,0 | (15,22) | (17,22) |
| 2,0 | (19,22) | (21,22) |
| 0,1 | (11,27) | (13,27) |
| 1,1 | (15,27) | (17,27) |
| 2,1 | (19,27) | (21,27) |

Work observations count one unit per decoded record-list entry and one per INSERT
cell dispatch, including empty block cells. A source copy adds only nonthrowing
local counters/reset exports and absolute helper URLs. It installs no guard,
exception, cancellation or expected output. Complete returned text/report equality
with the direct unmodified module is checked on observed controls. No product
file is rewritten for this instrumentation.

| Small fixture, with one unchanged anchor LINE | Record entries | INSERT cells | Units | Skipped POINTs |
|---|---:|---:|---:|---:|
| Nested 3-cell then 2-cell POINT arrays | 11 | 9 | 20 | 6 |
| Same arrays with an empty leaf | 5 | 9 | 14 | 0 |
| Two sibling 3-cell POINT arrays | 9 | 6 | 15 | 6 |

The anchor remains exactly (0,0) to (10,0). Early-skipped ATTRIB records are counted
as entries too. Existing depth16/17, cycles, per-array10,000/10,001 and xref-flag
controls pass. A 10,001-cell INSERT is currently skipped with its anchor retained;
it is not redefined as a whole-import failure. The 100,000-object and existing
aggregate planar/HATCH/3D/core budgets remain separate existing safeguards.

These counters cover the tested decoder entries and cell dispatches. They do not
measure all table/header scans, group/vertex consumption, elapsed time, native
memory or the complete pipeline. Existing input, output, nesting and array limits
remain in force; they do not provide a separately enforced cumulative work cap.

## Seven pending outcomes

Three failures freeze the prospective trusted option
`workBudget: {maxUnits: n}`. Inclusive limits20/14/15 preserve the exact fixture
geometry; limits19/13/14 should reject the whole import with IMPORT_WORK_LIMIT,
without returning even the valid anchor. Positive results alone cannot establish
that an option is enforced. This option is not currently supported, and no
production default is selected. Future fatal work/cancellation errors must escape
all recursive per-record catches, rather than becoming skipped warnings and a
partial returned document.

Two failures freeze a prospective optional actual AbortSignal. An already-aborted
signal should produce an AbortError before parsing/editor construction, without
reflecting the opaque reason. Current importDXF exposes no signal handling. The
validation factory wraps the real core; it is not active drawing adoption. These
are interface prerequisites, not evidence of responsive mid-parse UI cancellation.

Two assertions expose **one actual group-budget admission inconsistency** in
readDXF. The four workers use valid comment/EOF streams with exactly1,000,000 or
1,000,001 complete pairs. At1,000,000, both final-newline forms are accepted with
zero records. At1,000,001, no final newline is accepted while the same complete
pair sequence with a final newline rejects. The inclusive one-million boundary
and transport-equivalence assertions therefore fail on the unterminated form.
Streaming independent fixture validation checks every comment/EOF pair and hash.
This is a low-level reader boundary result, not an accepted active drawing, an
executed overwrite or proof of ordinary drawing loss.

## Containment and qualification

Each large boundary runs in an owned Node worker with a 256 MiB old-generation
limit, 4 MiB stack limit and a 15-second parent watchdog. Worker termination is
awaited. Those settings contain the test; they are not a whole-process/native
memory guarantee or product cancellation. All workers completed without watchdog
expiry. The raw streams are about6 MB each and their exact bytes/hashes are kept
privately alongside small synthetic fixtures.

The initial and final26-check receipts are retained. Independent review narrowed
the xref title to flag-based skipping; no assertion was weakened. Runtime,
converter resources, original fixtures and immutable beta12 manifests are unchanged.
The new reference is fingerprinted as an auxiliary only, outside selected passing
acceptance. The fresh selected gate passes55/55stages,1,438portablechecks and230
bound inputs; it does not claim this pending contract passes. Converter48 and
recovery102 remain selected.

LC-REL-04 remains partial with zero repair approaches used. Next review the new
option/default/error-propagation contract and freeze awaited importer cancellation/
cleanup and validation/adoption expectations before a product fix. Streaming stays
deferred. No mid-parse event-loop/IPC cancellation, converter/cleanup integration,
real resource-exhaustion acceptance, application/PDF/build/unpacked/native/installed/
upgrade/client or daily-use qualification ran. Beta7 startup cause remains unknown.
LC-REL-01/02 stay exhausted; LC-REL-03 keeps its one remaining approach and existing
beta12 source qualification. All prior restrictions and receipts remain in force.
