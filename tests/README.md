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
