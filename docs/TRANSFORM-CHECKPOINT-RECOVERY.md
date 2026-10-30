# Bounded terminal transform recovery

Beta9 repairs the qualified LC-REL-01 terminal transform slice. Artificial
one-shot synchronous failures previously left rejected in-memory geometry,
caller context or history published. A failed later COPY could leave unregistered
copies that survived retry/local Undo; Cancel could retain rejected single copies
and discard an old Redo branch. No naturally triggered file-loss route was shown.
The overall multi-object reliability item remains **partially implemented**.

## Implementation and independent expectations

A private transformAttempt helper checkpoints only normalized live document fields
and explicit continuation/selection/revision fields. A composite structuredClone
preserves own undefined properties and shared data aliases. Direct restoration
retains live architecture derivatives and views without regeneration or selection
filtering. Unrelated UI/plugin fields and diagnostic message/input history are
excluded. No new dependency, public API, native file schema or drafting convention
is introduced.

Eight terminal closures place the checkpoint before caller mutation: COPY Exit,
MIRROR deletion choice, typed scale/angle, point rotation including ROTATE3D,
point scale, and MOVE/COPY destinations including their lastPoint update. Other
command phases, local COPY Undo and ordinary Cancel are unchanged. Failures are
rethrown to the established message/failed-input-log path.

The checkpoint retains immediate pre-attempt transaction bookkeeping, earlier
accepted COPY destinations and actual Undo/Redo entry arrays. Entry references
are shallow only because these synchronous callbacks do not mutate existing
saved entries. Other APIs can update history snapshots; this is not a universal
immutability claim. Entity/viewport/layout/sheet and object-order reservations
remain monotonic. Pending entity-scope bookkeeping is restored independently.

The unchanged [MOVE reference](TRANSFORM-FAILURE-BOUNDARIES.md) retains its literal
geometry/history expectations and nine tests. The unchanged
[differential pack](TRANSFORM-DIFFERENTIAL-REFERENCES.md) retains all 44 checks and
49 traces for COPY, MIRROR, typed/point rotation, paper objects and selected
publication boundaries. Their historical 4/5 and 17/27 pass/fail results remain
preserved; both suites now pass without changing their assertions or fault sites.

Eight new preparation/control checks cover MOVE with clean/prior history, point
ROTATE before lastPoint, both MIRROR choices before deleteOriginal, later COPY
before allocation, COPY Exit, a late revision capture failure and unrelated UI
callback compatibility. Early/late prototype capture rejection was frozen before
repair. The new suite's baseline 2 passes/6 failures includes the absence of the
proposed helper; it is not six independently discovered production defects.
Own-undefined presence and actual prior history traversal are checked.

The combined focused run passes **61/61**. Independent code, test-validity,
compatibility, identity/CI and privacy reviews approved the bounded scope. The
new cumulative beta9 candidate retains 59 runtime files, 12 resources and all six
prior cumulative change entries; core is its only runtime delta from beta8.
Package/lock versions and two existing quality-CI manifest pins select beta9.
No trigger, permission, publication workflow or dependency pin changed.

The fresh fast gate passes **45/45 stages with 1,122 portable checks and 215 bound
inputs**. It now selects the three recovery suites and fingerprints the beta8
parent manifest. This is pure/source qualification; no application launch follows
from this gate. The old manifests, baseline, fixtures and failed receipts remain.

## Measured checkpoint cost

This reliability repair adds work. A clone-only prototype measured median warm
capture of 0.234 ms for 100 LINEs and 4.457 ms for 2,000 LINEs, with 25 untrimmed
warm samples. The full terminal probe used exact baseline/guarded source bytes
on the same Windows x64 / Node 24.13.0 runtime. Hardware details, all cold/warm
observations and memory endpoints are retained privately.

Two paired process rounds used opposite variant order. Each workload ran one
first terminal input, three warm-ups and 15 measured warm inputs on fresh editors.
The recorded cold sample means first per workload after module/editor setup and
possibly earlier workloads; it is not a cold-process/startup measurement.
Fixture/setup, serialization, independent literal geometry/ID/unrelated-content
and Undo/Redo checks were outside the timing boundary; all those checks passed.
The selected two LINEs were edited among exactly 100 or 2,000 LINEs (200/4,000
stored endpoints in the base fixture). COPY starts its timed destination with
N+2 active LINEs after the first accepted copy. Only the second destination is
timed; COPY Exit/history publication is outside this timing boundary.

| LINE count | Terminal operation | Baseline warm median, ms | Guarded warm median, ms |
| ---: | --- | ---: | ---: |
| 100 | MOVE | 0.341-0.394 | 0.549-0.655 |
| 100 | Later COPY destination | 0.084-0.086 | 0.310-0.340 |
| 2,000 | MOVE | 5.134-5.331 | 8.880-9.193 |
| 2,000 | Later COPY destination | 0.760-0.848 | 4.450-4.745 |

These ranges are the two process medians, not confidence intervals. Raw samples,
p95/min/max and Node memory endpoints are retained without trimming. Endpoints
are not peak memory; process high-water observations include setup and earlier
samples. This measures bounded pure terminal-input cost, not redraw/interaction,
a representative survey/house/viewport baseline or a performance improvement.
No regression threshold is invented. The full live drawing copy grows with the
drawing; larger, resource-heavy and architecture-heavy latency/memory remain
unqualified. Avoid deep-copying the 64 MiB bounded history store.

## Limits, rollback and next action

The accepted envelope is artificial, transient, synchronous and nonreentrant.
It covers declared preparation, post-assignment, pre-Undo snapshot and
post-publication/pre-revision state reads. It does not inject inside private
history insertion/eviction, arbitrary rollback exceptions, persistent accessors,
OOM, crashes or power loss. Broad architecture/3D failure recovery and every other
batch command remain unqualified. Renderer dirty state is not executed; content
comparison is an independent saved-document oracle.

There is no beta9 application/PDF/build/unpacked/native/installed/upgrade/client
or daily-use qualification. The unexplained beta7 hidden startup failure was not
retried. Historical beta6 built/native evidence retains its scope. No converter,
remote CI, install, push, tag, publication or outbound action ran.

Two semantic repair attempts have now been used for this bounded LC-REL-01 work,
including the earlier fence repair. No further repair attempt is authorized by
this checkpoint. Preserve unresolved breadth explicitly rather than marking the
parent complete. The next independent P0 evidence task is LC-REL-02's existing
valid-file save-failure and failed-import isolation matrix in the synthetic host
harness. Inspect current implementation and freeze expectations before any fix.

Rollback is a focused revert of this beta9 change, including its candidate
version/manifest, test selection and CI pin, while preserving earlier fence
recovery and independent later work. Original pending references and historical
failures remain available. No installed-app rollback is required.
