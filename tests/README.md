# Public generated test profile

The default public gate runs generated fixtures and independent numerical checks.
It does not require private client drawings or the author's desktop recordings.
Older already-public tests and samples are retained for provenance and further
development; they are historical material, not additional qualified default stages.
Do not run every test by glob and interpret that as the supported public gate.

The explicit [descriptor privacy reference](../docs/SCRIPT-DESCRIPTOR-PRIVACY.md)
is a pending security contract, not a selected passing gate. Run
`node --test --test-reporter=tap tests/script-descriptor-reference.test.cjs` to
retain the current four expected contract failures and eight lifecycle controls.
It uses fake HTTP/files only; actual Windows ACL/cross-account qualification is
not run. Runtime enforcement remains open.

The standalone directory observer has 23 portable tests in
`script-directory-observation.test.cjs`, selected by the candidate fast profile.
Its `supportedReferencePattern` result always leaves privacy unproven. The explicit
Windows command `pwsh -NoProfile -NonInteractive -File tests/script-directory-observer.test.ps1`
checks 19 synthetic descriptor-normalization references without applying ACLs.
PowerShell 7 is verified; Windows PowerShell 5.1 is blocked by host execution policy.
See the [observer scope](../docs/SCRIPT-DESCRIPTOR-PRIVACY.md#standalone-windows-metadata-observer).

Candidate fast selection also restores the three original synthetic structural
bridge/assignment/boundary suites and adds three independent literal references:
`structural-contract-reference.test.mjs`. The 72 restored plus three new cases
exercise source-bound V1/V2/V3 contracts, geometry and declared arithmetic. They do
not run the external calculator or fixture-generator CLI. See
[the reference calculations and limits](../docs/STRUCTURAL-CONTRACT-COVERAGE.md).

## Prerequisites

Use Node.js 24 LTS and `npm ci`. The lockfile pins Electron 44.9.3,
electron-builder 26.15.3 and Playwright 1.62.1. Dependencies must be installed in
this checkout; patched fast-uri and both undici major versions have exact compatible
overrides in package.json. No personal module path, global runtime or node_modules junction
is used. Ordinary application users do not need these development dependencies.

`npm test` is portable and needs no Python. Desktop tests/builds require Windows
x64. Their independent PDF reader also needs Python and PyMuPDF 1.28.0:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/requirements-dev.txt
```

The runner uses that project venv. `CAD_PYTHON` can instead identify an explicitly
owned Python environment with the pinned requirement. Electron44's npm package
downloads its binary lazily; desktop commands explicitly bootstrap its pinned
local `install.js` when needed, validating the installed version. This initial
download requires network access (or Electron's verified download cache).
No separate browser download is needed: Playwright controls that runtime.

## Commands and exact scope

```powershell
npm test
npm run test:desktop
npm run unpacked
npm run release
```

- `npm test`: regenerate the independently authored numerical advanced sample;
  run **306 generated core cases** and explicitly exclude **12 private recording
  cases**, listed by full name in `public-core-exclusions.json`. Node24 omits
  excluded selections from TAP totals:306 executed +12 declared exclusions
  accounts for all318 original test declarations. References are never counted
  as passing. Then eleven named generated suites run without skips: ordinary
  grip coordinate policy, Perpendicular, command completion, TRIM, units,
  advanced geometry, layouts, viewport objects, viewport scales, equal-eave
  roofs and fixed-roof clearance.
- `test:desktop`: **32 actual hidden Electron application checks** and **9
  independent checks of the PDF actually saved by that application**. Fixtures
  are generated, not taken from client projects. The flow includes real pointer
  events, latched grip previews, confirmed edits, grouped Undo/Redo, snap and
  paper-scale preservation, native Save/reopen and PDF generation.
- `unpacked`: rerun the generated profile and source desktop flow, build a new
  Windows x64 application, verify the original **59 runtime files and 12 bundled
  resources**, then repeat the 32/PDF9 flow against that actual unpacked build.
- `release`: the same checks, then compile NSIS from that tested unpacked build.
  This creates `Windows-Release/Linecraft-CAD-1.36.0-Setup.exe`; it does not
  install it or modify file associations.

The gate fingerprints its explicit input closure and checks that it stays
unchanged. Source identity is verified before and after every gate; packaged
identity is verified before and after actual packaged/installed checks.

`npm run dev` launches source without an installer and with an isolated drawing
profile in `work/development-profile`. Renderer changes reload through the
current development watcher; main/preload changes require a restart. This makes
the edit/test cycle independent of installing release builds.

## Reports and evidence boundaries

The portable summary is `work/public-pure-results.json`. Gate summaries are
`work/public-test-results.json`, `work/public-test-desktop-results.json`,
`work/public-unpacked-results.json` and `work/public-release-results.json`.
Every attempt also retains its own logs and immutable results in
`work/public-gate-<command>-<timestamp>`.

Actual application reports are `tests/ordinary-grip-public-source-results.json`
and `tests/ordinary-grip-public-unpacked-results.json`. Native drawings, actual
PDFs, audit results and captures are under the report's unique
`work/acceptance/<prefix>-<timestamp>` folder. Profiles can contain temporary
control secrets; do not publish the profile directory. CI should upload only
selected reports, drawing/PDF and image evidence.

Native Open/Save/discard chooser responses are fixed test-owned stubs. The real
editor, native validation, filesystem writes and isolated PDF host still run.
Tests prevent the application from showing a window or reading/writing the OS
clipboard, and verify no HTTP requests. Hidden tests do **not** establish DPI,
focus, ordinary native chooser, physical mouse or installed human acceptance.
The runner-only installer CI may invoke:

```powershell
node desktop/dev-tools.cjs test-installed "C:\path\to\Linecraft CAD.exe"
```

That is a separate32/PDF9 hidden installed-binary test, not a claim of human
review or equivalence between Windows Server runners and a client workstation.
`tests/ordinary-grip-public-installed-results.json` records that flow.

## Planar paper SOLID regression

Run `node --test --test-reporter=tap tests/paper-solid-import.test.mjs` for the
36 synthetic source checks. Frozen beta3 digests in that suite prove preservation
of five old model-face outputs only; literal coordinates/areas establish the
new planar fill expectations independently. No private CAD is needed.

`npm run qa:candidate -- --manifest=qa/CANDIDATE-SOURCE-1.36.1-beta.6.json` also
runs the actual paper-SOLID workflow against source and unpacked applications.
It uses isolated hidden processes, owned chooser replies, the real controller
and production file/PDF services. The PDF reader keeps fixed 0.04 mm endpoint and
0.02 mm dimension tolerances plus opaque paint/order and 0.995 raster coverage.
These checks are separate from native Windows dialogs and installed acceptance.

## Ordered multi-sheet candidate coverage

The explicit candidate fast profile selects multisheet-reference.test.mjs. Candidate
application profiles run multisheet-workflow.cjs against their source/unpacked
executable, using hidden isolated profiles and owned chooser replies. Its independent
audit-multisheet-pdf.py checks actual page order, literal geometry, paper title-block
markers/ink and13 negative reader probes. The gate fingerprints all four new files.
See [the coverage record](../docs/MULTISHEET-QUALITY.md) for executed results and
the distinction from native, installed and client/font qualification.

## Registered-font candidate coverage

Candidate application selection also runs font-layout-workflow.cjs against source
and unpacked executables. For a focused invocation, supply an approved isolated
executable, the source entry or an empty argument for unpacked execution, a unique
`ordinary-grip-` prefix, and the explicit candidate manifest:

```text
node tests/font-layout-workflow.cjs EXE SOURCE_ENTRY_OR_EMPTY UNIQUE_PREFIX qa/CANDIDATE-SOURCE-1.36.1-beta.6.json
```

This needs Windows, the pinned PDF reader and locally registered regular Arial
and Times New Roman. Required unavailable fonts fail the stage; fallback is not
accepted as successful face fidelity. The independent auditor reads those fixed
installed font files in place under the system root, without packaging fonts.
It checks literal repeated-H advances/faces, baseline placement and synthetic A4
geometry, with nine measurements and seventeen negative reader controls. See
[the coverage record](../docs/FONT-LAYOUT-QUALITY.md). This is production PDF bridge
coverage with test-owned choosers, not plot-form/native-input or DWT acceptance.

Append `--architectural-fonts` after the manifest to select the separate ARCHITXT/
Technic repeated-H profile; use a different unique prefix for each profile. Its
independent `architectural_font_reference.py` resolves only those fixed registered
names, reads their existing faces in place and handles the verified Technic symbol
cmap without treating MuPDF's missing-ASCII-glyph fallback as an expected advance.
The regular fixture and reader defaults retain their original expectations.

`node --test tests/font-resources.test.mjs` exercises five synthetic service/plot
boundaries without actual font or registry changes. Candidate fast selection also
includes it. Missing-font/profile controls are distinct from missing-glyph coverage.

## Missing glyphs in an available registered profile

`node --test tests/missing-glyph.test.mjs` uses a deliberately sparse synthetic
profile to verify nine warning and preservation cases. Candidate fast checks select
this suite. Five expected failures are retained from pre-fix beta4.

The explicit `missing-glyph-workflow.cjs` takes the same executable/source-entry/
unique-prefix/manifest arguments as the registered-font workflow. It needs an
existing registered Technic face and checks real native persistence and production
PDF warning transport. It does not alter fonts or add that prerequisite to generic
CI. Its independent auditor checks eight measurements and eighteen rejection
controls, using a separately established unmapped U+2205 case. See
[the diagnostic record](../docs/MISSING-GLYPH-DIAGNOSTICS.md). Native input and
unsupported fallback-glyph shape/spacing remain separate acceptance work.

## Optional synthetic performance observations

performance-workflow.cjs accepts the same four executable/source-entry/unique-prefix/
manifest arguments. It measures seven actual hidden operations across one warm-up
and five measured rounds, against a frozen2,000-line profile. The separate stdlib
audit-performance.py reads hash-bound complete states and raw measurements with15
rejection controls. Benchmark files are fingerprinted but timing is not a default
gate or usability criterion. See [the baseline](../docs/PERFORMANCE-BASELINE.md)
for exact reproduction, saved-file reread scope, raw CSV, cache/frame boundaries
and unqualified workloads. Use only disposable source/QA-unpacked profiles.

## Explicit bounded reload/restart checks

reload-workflow.cjs uses the executable/source-entry/unique-prefix/manifest argument
shape above. Source mode requires shared exclusive development ownership: it
triggers the real watcher through stylesheet mtime and restores bytes/mtime. It
checks complete content/view, dirty/name, active-command cancellation and history/
selection reset, then controlled source-host profile recovery and intentional clean
close. Packaged mode checks disabled development reload and explicit saved-file
Open after a normal clean restart. The stdlib audit-reload.py binds all complete
files and rejects12 corrupt observations per variant. Existing historical suites
and results are preserved. See [scope and commands](../docs/DEVELOPMENT-RECOVERY-QUALITY.md);
crash/power-loss, draft/error recovery and native installed acceptance are distinct.

## Local synthetic development ledger

node --test tests/local-development-relay.test.cjs runs15 focused protocol checks
using retained disposable stores, including a real two-child claim race, fresh CLI
replay and simulated orphan pending-file recovery. It needs approved hardlink and
junction/symlink access on the chosen local filesystem. The explicit
local-development-relay-workflow.cjs takes a unique ordinary-grip- prefix and checks
18 actual CLI calls/8 immutable events, followed by audit-local-relay.py (stdlib).
These files are fingerprinted but not selected as default gate stages. See
[the protocol and limits](../docs/LOCAL-DEVELOPMENT-RELAY.md). No drawing execution,
production intake, outbound messaging or automatic worker is enabled.

## Import headline counts

node --test tests/import-headline.test.cjs selects seven tests of the actual
renderer function in a small text DOM. Literal report metadata covers six count/
format cases; warning/detail/modal text and nonmutation are separate compatibility
assertions. Candidate pure selection includes this suite. Candidate application
selection adds import-headline-workflow.cjs for source/newunpacked: actual original
synthetic DXF Open, independent model1/paper2 geometry, fresh headline/log and
complete SaveAs/New/Open. The three-check stage uses the same executable/entry/
unique-prefix/manifest argument shape above. See [the record](../docs/IMPORT-HEADLINE-COUNTS.md);
VM DWG labels are not actual DWG import or native fidelity evidence.

## Mixed paper profile

node --test tests/mixed-paper-reference.test.mjs runs4 new child references. Append
--mixed-paper to the existing multisheet-workflow.cjs executable/entry/prefix/manifest
arguments for targeted source/QA-unpacked A4portraitthenA3landscape execution. The
reader receives explicit --profile mixed-paper and requires producer identity;
regular remains the default. Mixed20measurements/23controls include raw page boxes,
rotation and literal physical geometry. The four pure checks are selected; default
application stage remains regular. See [scope and actual results](../docs/MIXED-PAPER-QUALITY.md).

## Synthetic plan/detail profile

node --test tests/plan-detail-reference.test.mjs runs4 new references. The separate
plan-detail-workflow.cjs uses executable/entry/prefix/manifest arguments and the
strict plan-detail reader profile. Independent50measurements/28controls include
16solidsegments,3polygonfills,11/22filled rounded-dash components and37/59 actual
432dpi raster samples. Original regular/mixed commands stay unchanged. See
[scope, failures and actual results](../docs/PLAN-DETAIL-QUALITY.md).

## Rotated annotation calibration

node --test tests/rotated-annotation-reference.test.mjs runs4 new tests. Explicit
rotated-annotation-workflow.cjs uses executable/entry/prefix/manifest arguments;
audit-rotated-annotation-pdf.py requires the matching profile and checks42
measurements plus28controls, including13segments/3filledarrows,exact semantictext,
independent text-baseline directions and14actual local1728dpi samples perpage.
Existing application profiles stay unchanged. See [scope](../docs/ROTATED-ANNOTATION-QUALITY.md).

## Registered rich-MTEXT calibration

node --test tests/richtext-reference.test.mjs runs4 references. Explicit
richtext-workflow.cjs accepts executable/entry/prefix/manifest arguments, requires
3available fixedTimesfaces with matchingrenderer/servicehashes and uses actual
persistence/PDFbridge. The independent auditor requires --profile richtext and
passes12measurements/26controls with directSFNTglyphmetrics andpositiveinkguards.
No fontassets are copied; no native Plot form/dialog claim. See
[scope](../docs/RICHTEXT-QUALITY.md). Existing default workflows stay unchanged.

## Synthetic structural file service

Candidate fast selects structural-files.test.cjs, structural-assignments-files.test.cjs,
structural-boundaries-files.test.cjs and structural-file-dispatch.test.cjs. Run them
under ordinary Node with --test and no application arguments. The37 original host
checks plus one literal V1 case and four callback-contract cases use fake Electron
and owned synthetic files. JSON reports stay under the QA run or source work
folder. See [the scope](../docs/STRUCTURAL-FILE-COVERAGE.md); native UI and real
external-engine execution are not covered.

## Non-inspector diagnostic

Candidate fast selects the eight cases in non-inspector-contract.test.cjs. The
explicit non-inspector-websocket.test.cjs needs approved loopback access; it is
fingerprinted but not a portable gate stage. non-inspector-probe.cjs is an explicit
Windows diagnostic with Node24 and PowerShell7, never a default application stage.
Its source listener-ownership prerequisite currently fails closed; do not rerun
Electron unchanged. See [scope and actual limits](../docs/NON-INSPECTOR-PROBE.md).


## Rejected fence recovery

`node --test tests/atomic-batch-independent.test.mjs` runs eight independent
synthetic trim/erase fence cases. A per-editor one-shot state-read fault fires
only after a proven accepted first mutation; it is not a malformed-file or GUI
claim. Cases cover selection/revision/content recovery, a content-dirty oracle,
clean and existing Undo/Redo history, earlier accepted edits, successful trim and
erase grouping, and pre-mutation rejection. The candidate fast profile includes
this suite and fingerprints beta8's beta7 parent manifest. See
[the bounded result](../docs/ATOMIC-BATCH-FAILURE-RECOVERY.md).


## Pending transform atomicity reference

`node --test tests/transform-atomicity-reference.test.mjs` is an explicit pending
LC-REL-01 contract, not a selected passing gate. On beta8 it produces four passes
and five expected failures across nine tests. Artificial per-editor read faults
occur after the literal two-object MOVE assignment at commit follow-up or history
snapshot; successful MOVE/typed ROTATE and invalid-input controls remain separate.
No normal drawing-loss, renderer dirty, native or installed claim follows. See
[the observations and proposed recovery boundary](../docs/TRANSFORM-FAILURE-BOUNDARIES.md).
Do not run all retained references by glob and call that the supported passing
profile; preserve these failures until the bounded recovery contract is repaired.


## Pending differential transform recovery reference

`node --test --test-concurrency=1 tests/transform-differential-reference.test.mjs`
is an explicit pending contract, outside the selected passing candidate profile.
Its reviewed beta8 result is 44 checks: 17 passes and 27 expected failures across
49 cached scenarios, with no harness errors. It covers repeated/single COPY,
MIRROR, typed/point ROTATE, mixed paper geometry/viewport and selected history
publication boundaries with literal success controls. No runtime repair occurs.
See [the fault envelope and remaining guard contract](../docs/TRANSFORM-DIFFERENTIAL-REFERENCES.md).
Optional LINECRAFT_REFERENCE_REPORT output is private: synthetic traces include
local stack paths. Do not run all retained pending references by glob and report
a green candidate gate or ordinary-input corruption finding.


## Beta9 terminal checkpoint recovery

Beta9 now selects transform-atomicity-reference.test.mjs (9),
transform-differential-reference.test.mjs (44), and the new
transform-checkpoint-preparation.test.mjs (8): all61focused checks pass. The first
two retain their original bytes and historical pending-beta8 descriptions above.
The preparation suite includes early/late one-shot capture failures, actual prior
history traversal, no tentative allocation and unrelated UI callback compatibility.
The candidate fast profile is45stages/1,122checks/215inputs. See
[the bounded repair and measured added cost](../docs/TRANSFORM-CHECKPOINT-RECOVERY.md).
Optional synthetic stack reports remain private. No native/file-loss/installed
or broad all-command atomicity claim follows.


## Existing-file save and native-import isolation

`node --test --test-concurrency=1 tests/save-isolation-reference.test.cjs`
runs36checks:31actual-main/fake-Electron/owned-filesystem cases and5real-core
malformed/successful import/history cases. The explicit candidate profile selects
it, now46stages/1,158checks/216inputs on beta9. Production main/core bytes and
manifest remain unchanged. See [the matrix and limits](../docs/SAVE-IMPORT-ISOLATION.md).
The test-only read-only association observer is appended in memory, never exported
by production. Optional LINECRAFT_SAVE_ISOLATION_REPORT includes local paths/raw
errors and must remain private. Real renderer/native/converter/crash acceptance
is not inferred; cleanup-denied and collided fixtures are intentionally retained.


## Renderer Save/Open/discard source functions

`node --test --test-concurrency=1 tests/renderer-isolation-reference.test.cjs`
runs 64 named VM scenarios plus inventory (65/65). It extracts actual fingerprint,
Save/discard/replacement/Open bodies and uses real core editors and zoomExtents
with explicit UI/IPC adapters. Rejected bridge Promises propagate from these
functions; runAction/full renderer integration is outside this reference.
The candidate profile selects it: 47 stages / 1,223 checks / 217 inputs on unchanged
beta9 runtime. See [oracles and limits](../docs/RENDERER-ISOLATION-REFERENCES.md).
Optional LINECRAFT_RENDERER_ISOLATION_REPORT must remain private. The initial
fixture void-API failure is preserved and is not a production defect.


`file-diagnostics-reference.test.cjs` runs actual main source under fake Electron
and owned files:22 controls for ordinary Save/Open/import diagnostic/privacy and
compatibility contracts, with canned import dispatch and no application/converter.
See [the scoped record](../docs/FILE-OPERATION-DIAGNOSTICS.md).


`development-state-reference.test.cjs` uses the shared Node-only
`development-state-host.cjs`:43 source/fake-host checks for development association
and discard/queued-adoption boundaries, owned profiles and no application/watchers.
See [the bounded record](../docs/DEVELOPMENT-STATE-REFERENCES.md).


`paired-recovery-reference.test.cjs` is an explicit pending safety contract,
not selected by the passing fast profile. Its10checks currently give6pass/4fail
with9source-model scenarios. A write barrier preserves unrelated synthetic A
before temporary creation. See [the pending record](../docs/PAIRED-RECOVERY-REFERENCES.md).


`development-identity-contract.test.cjs` is a pre-implementation recovery contract,
excluded from the passing fast profile. Its14checks currently report3pass/11fail:
nine protected routing probes and two absent-binding prerequisites, with13scenario
records. See [the bounded reference](../docs/DEVELOPMENT-IDENTITY-REFERENCE.md) and
[ADR-001](../docs/ADR-001-DEVELOPMENT-RECOVERY-IDENTITY.md).


`recovery-protocol-reference.test.cjs` is an explicit pending prerequisite pack:
37 checks, 6 pass and 31 expected failures across 36 semantic records. It is
excluded from the passing profile and bound only as an auxiliary input. See
[the reference and limits](../docs/RECOVERY-PROTOCOL-REFERENCE.md). Optional
LINECRAFT_RECOVERY_PROTOCOL_REPORT contains private local evidence.


## Pending renderer recovery negotiation

`node --test --test-concurrency=1 tests/recovery-negotiation-reference.test.cjs`
is a separate pending contract:23checks,4pass(three controls plus inventory)
and19expectedfailures across22namedcases, with no final harness errors.
It is auxiliary-only, excluded from the selected passing fast profile. Optional
LINECRAFT_RECOVERY_NEGOTIATION_REPORT writes private local traces only.
See [the source adapters, manual-clock expectations and limits](../docs/RECOVERY-NEGOTIATION-REFERENCE.md).
No main/preload/realIPC/native/application execution or working deadline follows.
The unchanged protocol37,identity14 and paired10 references were not rerun.


## Pending recovery ownership reference

`node --test --test-concurrency=1 tests/recovery-ownership-reference.test.cjs`
is explicit and auxiliary-only:18checks,8pass(seven controls plus inventory),
10expectedfailures and17namedcases, with no unexpected harness errors.
Actual main generation probes and renderer runAction/queue ownership projections
are distinguished in [the scope record](../docs/RECOVERY-OWNERSHIP-REFERENCE.md).
Optional LINECRAFT_RECOVERY_OWNERSHIP_REPORT contains private local traces.
The unchanged renderer23/protocol37/identity14/paired10 packs were not rerun.


## Beta11 recovery qualification

The candidate fast profile now selects all five frozen recovery packs:102/102
checks pass. Historical pending descriptions above retain their beta10 scope.
Fresh beta11 fast qualification is54stages/1,390checks/227inputs.
See [the source repair, fixture adaptations and limits](../docs/DEVELOPMENT-RECOVERY-BINDING.md).
No application/native/installed or real-transport acceptance follows.


The explicit pending converter lifecycle/warning reference is run with
`node --test tests/converter-lifecycle-reference.test.cjs`. Its frozen result is
28 checks:21pass/7expectedfail,27namedcases and zero unexpected harness errors.
It is fingerprinted as an auxiliary, excluded from passing candidate acceptance;
the selected beta11 profile is54/54stages,1390checks,228inputs. See
[its contract and fake-process limits](../docs/CONVERTER-LIFECYCLE-REFERENCE.md).
Do not substitute teardown closure for bounded product settlement or infer real
converter/process-tree/native acceptance from these source projections.


Beta12 selects the expanded converter lifecycle pack:48/48checks(47namedplus
inventory), including deferred cleanup/admission and reviewed warning-path cases.
The fresh selected profile passes55/55stages,1438checks,229inputs. The older
pending28 result above is historical beta11 evidence. See
[the repair and precise limits](../docs/CONVERTER-SETTLEMENT-CUSTODY.md).


Run the pending import-budget reference explicitly with
`node --test tests/import-budget-reference.test.mjs`. Frozen result:26checks,
19pass/7expectedfail,25named and no unexpected errors. It is an auxiliary only;
selected55/55stages,1438checks,230inputs do not qualify pending options. See
[the literal work/geometry oracles and limits](../docs/IMPORT-BUDGET-REFERENCE.md).
No production default or mid-parse/renderer cancellation is established.


The superseding work reference has36checks (20pass/16expectedfail), and
`node --test tests/import-cancellation-reference.test.cjs` has21checks
(6pass/15expectedfail), both with zero final unexpected errors. They are pending
auxiliaries, bound among231inputs and excluded from selected55/55stages and
1438checks. See [the reviewed contract](../docs/ADR-002-IMPORT-WORK-CANCELLATION.md)
and [source projection limits](../docs/IMPORT-BUDGET-REFERENCE.md). Runtime remains
beta12, zero LC-REL-04 repair approaches used; the older26-check record is history.


Beta13 selects import-budget36, import-cancellation22 and import-budget-compatibility9:
67/67pass, zero unexpected errors. The selected fast gate is58/58stages,1505checks,
233inputs, including converter48/recovery102. Separate legacy importer21 and
actual DXF24 are outside that total. Earlier pending results above are history.
See [the repair and projection limits](../docs/IMPORT-WORK-CANCELLATION.md).


The new performance-workloads-reference.test.mjs is a selected33-check headless
fixture/protocol suite. The separate stdlib audit-performance-workloads.py passes
25checks including15semantic corrupt copies; these are outside selected1538.
Four synthetic definitions and582planned rows are not measured CAD performance.
The selected profile is59/59stages/1538checks/237inputs, with unchanged beta13
runtime and original beta5 benchmark artifacts. See
[protocol, literals and limits](../docs/PERFORMANCE-WORKLOAD-CONTRACT.md).


performance-plan-loader.test.cjs selects60metadata-only checks; the expanded
source profile is60/60stages,1598checks,239inputs. Independent trusted pins are
separate from producer claims; all returned launch/geometry/environment flags
remain false and observed performance rows remain0. The retained stdlib25 audit
was not rerun. See [loader contract, failures and limits](../docs/PERFORMANCE-PLAN-LOADER.md).

Run the explicit pending flat-surface coverage reference with
`node --test --test-reporter=tap tests/mesh-surface-coverage-reference.test.cjs`.
Its frozen result is 11 tests: 9 pass, 2 expected seam-uniformity failures, exit 1.
Exact production paint traces feed independent unit-pixel coverage arithmetic;
this is not a browser raster test. It is outside the selected passing profile,
whose existing 241 input hashes remain unchanged. See
[the mechanism, controls and limits](../docs/MESH-SURFACE-COVERAGE-REFERENCE.md).
