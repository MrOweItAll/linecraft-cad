# Non-launching performance workload plan loader

LC-PERF-01/LC-QA-006 now has a separate read-only loader for the four qualified
synthetic workload files and complete planned row matrix. It validates definition
metadata; it does not execute a benchmark, import product code, launch an app,
spawn a process, access a network or create performance observations. Beta13
runtime remains9fa9b5bc and all prior qualification limits remain.

## Explicit trust and scope

`loadPerformanceWorkloadPlan({artifactDirectory, sourceDirectory, expected, fs})`
from [the loader](../tools/performance-workload-plan.cjs) requires two caller-owned
absolute roots and independent expectations. The ordinary filesystem adapter and
expectation object are trusted caller inputs, not instructions or authorization
from an untrusted producer. Do not derive trusted pins from the producer being
checked or alter them during a read. The caller supplies authorized roots; path
checks do not grant filesystem or application authority.

The `LinecraftPerformancePlanExpectations/1` object pins exactly four generation
inputs and nine artifact byte lengths/hashes/roles. Source identity means
core.mjs,the generator,the definition reference test and the workload contract.
It is not a complete runtime/executable/environment qualification. Both the actual
source bytes and producer declarations must match the independent source pins.
Actual payload bytes and declared roles/hashes/lengths must match the independent
artifact pins. Unknown, missing, path-like or wrong-role records fail.

The known artifact set contains raw and canonical Linecraft/1 documents for survey,
residential,multiViewport and heavy, plus planned-rows.json. Native type/unit/count
metadata, persisted model/paper owners and active/stored viewport identities are
checked. Three paper entity IDs remain on each owner; the visible locked Viewports
layer excludes proxies from the expected initial selection. The loader does not
replace the independent literal geometry audit or the actual core checks.

The complete typed582-key set pins workload,process0-2,phase,round and operation:
startup/readiness and cold-first-open/open use round-1; warmup uses0; measured-warm
uses1-5, with exactly seven ordinary or ten layout operations. Extra timing fields,
duplicate/drop, missing, renamed, misassigned or wrongly typed keys fail.
Producer observations must be empty and its application-executed flag false.
Producer pass tallies are provenance only and cannot grant authority.

Every successful result has `applicationLaunchAuthorized:false`,
`geometryValidatedByLoader:false`, `environmentQualified:false` and zero observed
performance rows. A controlled coordinate-only change with deliberately refreshed
trusted test pins remains outside geometry qualification and does not change
those false flags. Success is only definition-plan-valid metadata.

## Read and diagnostic bounds

The producer is capped at1MiB, each source/document at4MiB and total actual input
at16MiB. One additional byte may be read solely to detect overflow; the remaining
aggregate budget also limits every read. The plan file has a1MiB cap. These fixed
caps cannot be widened through producer declarations or caller hash records.

Known paths are checked with lstat and realpath before opening. Each acquired
handle is checked as regular, read in bounded chunks and closed in its owned
finally path even after stat/read/hash/schema/owner/matrix failure. The tests model
symlink/nonregular/escape cases before open. These checks do not prove safety under
hostile concurrent replacement or deadline-bound a real filesystem stall. Parent
commands have finite execution budgets; no whole-process/native-memory claim follows.

Only authored PerformancePlanError message/code/stack fields are surfaced; raw
filesystem errors, private paths and input values are omitted. This is a scoped
QA diagnostic projection, not universal PII/secret removal. Returned metadata
contains fixed relative names and hashes, not roots, document text or source text.
The loader imports only fs/path/crypto. Test preparation deliberately uses the
existing fixture generator and actual core to create independent owned inputs.

## Executed qualification and preserved failures

The first uncommitted draft has59checks:57pass/2fail, zero unexpected errors.
A non-string expected hash reached comparison after I/O instead of rejecting early;
an extra __proto__-named entity escaped a plain-object inventory counter. String
hash checks, exact key cardinality, null-prototype counters and early fixed counts
corrected those failures. The intermediate59pass receipt remains historical.

Independent source review then froze a60-check challenge:58pass/2fail. A resealed
entity type array coerced to LINE, and aggregate rejection occurred after16,796,093
physical bytes. Strict string types and remaining-total-plus-one read sizes fix
both. Source, tests, deterministic corrupt inputs, logs and both refinements remain
preserved privately; these are QA tool findings, not runtime drawing-loss claims.

The exact final [suite](../tests/performance-plan-loader.test.cjs) passes60/60:
59named cases plus inventory, with zero unexpected errors. Three positive boundary
controls and56negative cases separate untrusted producer-only reseals from semantic
copies with deliberately refreshed test trust. Per-handle ledgers show416 acquired
loader handles, each with one close attempt and one delegated actual close.
The close-throws adapter closes the real handle before throwing; it does not prove
that a real failed OS close completed. Invalid expectations/relative roots show
zero lstat/realpath/open calls. Aggregate overflow stops at16,777,217 bytes.

A separate final invocation accepts byte-exact copies of the prior sealed nine
artifacts and producer against independently retained trusted pins and the actual
current four source files. It returns4workloads,8documents,582planned rows and
zero observations; launch, geometry and environment qualification remain false.
This is distinct from fresh test-owned fixture preparation and from a benchmark.

The fresh selected fast gate passes **60/60stages,1598portablechecks,239inputs**.
Only the Node60 loader suite and one loader auxiliary are added. The prior Node33
workload reference, import67, fake-child converter48 and recovery102 remain selected.
The earlier separate stdlib25 audit is retained without an unchanged rerun.
Runtime59/resources12, beta13manifest9cumulativechanges, package/CI, the original
five beta5 benchmark artifacts and all four prior definition-code/oracle files
remain byte-exact. No application/native/build/real-converter or historical benchmark
execution was repeated. Historical benchmark attempt1 and runtime repair caps
remain unchanged.

## Remaining qualification

The registered loader child is complete; the performance recommendation is partial.
A read-only queue review found no further concrete ready milestone under current
prerequisites. Reassess fresh intake, source/receipt changes, runnable prerequisites
and registered backlog on each hourly wake. Do useful authorized bounded work when
it becomes actionable; otherwise remain quiet and ACTIVE. Do not invent another
metadata framework or rerun unchanged passing checks to fill the hour.

Four-workload application timings, B/C/A switches, frame/render/font/layout,
CPU/memory, practical variability thresholds and optimizations remain unperformed.
The beta7 startup cause is unknown and unchanged application retries remain
prohibited. Beta13 application/PDF/build/unpacked/native/installed/upgrade/daily-use
and broader IPC/storage/crash/FS-stall/global admission/orphan/privacy qualifications
remain open; retain beta6 receipts and all existing boundaries. LC-REL-01/02 stay
exhausted; LC-REL-03/04 each retain at most one approach only with new independent
failure evidence. Streaming and speculative performance work stay deferred.
