# Four synthetic workload definitions and planned measurement protocol

Current status: the separate [metadata-only loader](PERFORMANCE-PLAN-LOADER.md)
now completes the next-loader step described below. This document preserves the
6152f1e definition/protocol qualification; actual four-workload observations remain
zero and no application launch is authorized.

LC-PERF-01/LC-QA-006 now has four reproducible schematic fixture definitions and
a finite protocol. This is definition and headless correctness qualification;
**zero application performance observations have been collected for these four
new workloads**. Beta13 runtime
remains unchanged at9fa9b5bc. The original beta5 benchmark fixture, workflow,
auditor, CSV and [baseline record](PERFORMANCE-BASELINE.md) remain byte-for-byte
unchanged. No optimization or timing threshold is selected.

The new fixtures are authored from literal rules, not client drawings or domain
templates. They imply no survey, legal, architectural or code-compliance approval.
They sample a few workload characteristics; they are not a claim that these four
schematics represent every professional drawing.

## Independent geometry contract

Independent literal rules and values were frozen before the generator.
[The public contract](../tests/fixtures/performance-workload-contract.json) records
those rules and values. Independent review derived counts, sums, lengths and areas.
[The generator](../tests/performance-workload-fixtures.mjs) does not import this
oracle or product code. Every call returns fresh objects.

| Workload | Native entities | Explicit point slots | Layouts / stored viewports | Literal geometry |
|---|---:|---:|---:|---|
| Survey-like |200:100PLINE+100TEXT|400|0/0|10x10 rectangles80x50ft at(100c,60r); perimeter26000ft, area400000ft2, point bounds(0,0)-(980,590)|
| Residential-like |64:40PLINE+8ARC+8HATCH+8TEXT|192|0/0|Eight16x12ft rooms plus32 furniture rectangles; PLINE perimeter768ft/area1728ft2; HATCH area32ft2; door radius3ft/sweep90degrees|
| Several viewports |409:400model+9paper|818:800model+18paper|3/18|20x20 model LINE grid, length16in each; three420x297mm sheets, six views each, scales1:24/1:48/1:96|
| Heavy synthetic |10000LINE|20000|0/0|100x100 grid, start(8c,8r), length6in; total60000in, bounds(0,0)-(798,792)|

Explicit point slots count stored LINE endpoints, PLINE points and HATCH boundary
points. They exclude analytic ARC parameters, text anchors, viewport metadata and
tessellation. Bounds exclude text ink and do not qualify rendered glyph appearance.
Residential point-coordinate sums are(6496,2560), with PLINE sums(5280,2080) and
HATCH sums(1216,480); label anchors sum(232,120), ARC centers(344,80). Analytic door
length totals12pi ft. No curve tessellation or display measurement is inferred.

The paper literals on every sheet are ruler(10,40)-(110,40)mm, border(10,10)-
(410,287)mm and label anchor(20,20)mm. Paper point sums across all sheets are
(2880,2022). View frames are3x2 at(20+130c,60+90r),110x70mm; model centers are
(80+80c,100+120r,0). All18 persist, but only the active sheet's six are eligible
for rendering. No renderer was exercised here.

A visible locked Viewports layer keeps the six viewport proxies out of SELECT ALL.
Navigation locked=true alone does not exclude proxies from selection. Actual
headless core selection is exactly paper-ruler-a,paper-border-a,paper-label-a on
the initial sheet. Ordinary workload selections contain200,64 and10000 entities.
ESC clears selection and leaves serialization exact. Persisted paper entities
remain in layouts[].entities rather than the top-level model array.

## Planned rows and measurement boundaries

A future workload/variant uses three independent fresh processes. Each has a
separate startup-to-readiness row and one first Open after readiness. Fresh
process/module/JIT state does not imply cold OS or disk caches. After that Open,
one warmup round and five measured-warm rounds are retained without filtering.

Ordinary rounds have seven actions:Open,SELECT ALL,ESC,pan,zoom,Save As,reopen.
The layout workload adds switches to sheetB,sheetC and back to sheetA before pan.
Each active layout still has six eligible views; eighteen stored views are not
eighteen simultaneously rendered views. Future switch checks must verify only the declared
active-context changes while preserving full geometry/ownership and expected
selection. The current headless checks inspect every stored layout but do not
execute the planned B/C/A switch actions.

Per ordinary workload:3*(1+6*7)=129 planned action rows. Layout:3*(1+6*10)=183.
All four per variant total570 action definitions:12 cold-first-open,93 warmup,
465 measured-warm. Twelve separate startup rows give **582 planned rows**. These
are a validated key matrix, not observed timings. A full variant needs12processes;
the per-wake cap is three processes for one workload/variant, inside the existing
50-minute task limit. It does not authorize launching any of them now.

Future conditions target content1280x900CSS/DPR1, owned pan delta24x12CSS and wheel
-80. Actual dimensions/events must be recorded and correctness checked outside
timed regions. The monotonic host action boundary includes response/transport/
owned chooser costs; a separate extension through two animation frames is not
compositor/display or physical-input latency. Startup and first Open stay distinct.
Real memory observations require separate host/renderer method, cadence, coverage
and overhead disclosure; no peak-memory result exists here. Native Open does not
substitute for a separately defined exchange-import measurement; no real converter
is part of this work.

Finite operation/frame waits are15s/5s; future process watchdog180s. Every raw
cold/warmup/measured result, failure and exact source/input/executable identity
belongs in unique private evidence. Do not publish client data, usernames,
hostnames, machine paths, credentials or control descriptors. No practical timing
threshold follows from these definitions or from Node test-runner durations.

## Executed checks and preservation

The selected headless suite passes **33/33**:four literal generators, actual core
import/serialize/reload and selection/ESC, fresh-object checks, protocol assertions
and corrupt-copy controls. The complete582-key set pins workload,process,phase,
round and exact operation. Closed room/furniture topology is enforced separately
from vertex/perimeter totals. Wrong geometry, inactive view/owner, units, IDs,
selection and operation/process keys are rejected without changing originals.

A separate stdlib-only [auditor](../tests/audit-performance-workloads.py) imports
no product code. It reads eight raw/canonical native documents, nine file hashes,
the planned matrix and four actual headless selection snapshots. **25/25 checks**
pass, including15 semantic corrupt-copy rejections after in-memory mutation.
Those25 are separate from the selected gate count. Initial33pass evidence before
validator strengthening is retained; final33pass and25pass bind exact final files.

The fresh selected fast gate passes **59/59stages,1538portablechecks,237inputs**.
Only one new Node stage is selected; the generator, contract and auditor are bound
auxiliaries. Beta13 manifest59runtime/12resources/9baselinechanges, package, CI,
all runtime files and all five historical benchmark artifacts are unchanged.
No application/native/build/real-converter acceptance gate or historical benchmark
was rerun. The retained portable fake-child converter48 and recovery102 controls
did run within the changed selected source profile.

## Remaining work

Build a separate loader that validates these workload files and planned rows
before any future measurement run. Freeze missing/mismatched source or fixture,
wrong ownership and duplicate-row rejection controls using metadata only; preserve
the original workflow and CSV. This does not authorize a launch or invent samples.
Actual application measurements still need a justified runnable path and exact
identity; the beta7 startup cause remains unknown and unchanged retries remain
prohibited. Thresholds, CPU/memory/interaction results and optimizations stay open.
Beta13 application/PDF/build/unpacked/native/installed/upgrade/daily-use and broader
font/layout/domain qualification are not run. Existing LC-REL repair caps remain.
