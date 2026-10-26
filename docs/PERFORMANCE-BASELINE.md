# Synthetic drawing measurement baseline

LC-QA-006 records actual source and existing unpacked beta5 operations on October
26, 2026. Correctness and observation validity passed. These timings establish a
bounded repeatability reference; no usability threshold or speed improvement was
approved. There is no product runtime change.

## Frozen input and independent expectations

The original qualityFixture('large') is preserved. performance-fixture.mjs derives
only a fixed model-space 2D navigation profile: viewport center (599,114), scale
0.5. The frozen Linecraft/1 file has 399,519 bytes and SHA-256
61bad1077620444b5ddde1bb85e67c3b7e6572806ec7a243116bd0b2fa179b21.

There are exactly 2,000 ordered LINE entities with unique IDs large-0 through
large-1999, in inches. For index i, start is (12*(i%100),12*floor(i/100)); end is
(start.x+10,start.y). Independent literal expectations are 100 columns,20 rows,
length10 each, total20,000 inches, bounds (0,0)-(1198,228), start coordinate sums
(1,188,000,228,000) and end sums (1,208,000,228,000). There are no layouts.
The serialized fixture and independent geometry check were frozen before the
first measurement. Expected geometry is never inferred from production output.

## Protocol and timing boundaries

Source ran first, then the existing beta5 unpacked candidate on the same Windows
x64 host. Both used pinned Electron44.9.3, hidden offscreen painting, fresh
isolated profiles, content1280x900, canvas948x591 CSS pixels and DPR1. Each process
ran one warm-up round followed by five measured rounds. All raw observations,
including warm-up, are retained in the [CSV](../tests/fixtures/performance-baseline-beta5.csv).
The warm-up is excluded from the exact min/median/max summaries below.

Every round calls the actual renderer Open action through a test-owned chooser,
executes SELECT ALL then ESC, sends a middle-button drag24x12 CSS pixels and wheel
deltaY=-80 to the hidden renderer, calls Save As to a new file, then opens that
saved file into the current session. This final operation measures file reread
and reload, not process restart or a separate New/close acceptance case. Native
desktop mouse, keyboard, real choosers and clipboard are not used.

actionRoundTripMs uses Node hrtime.bigint from invocation to the operation's
resolved response. It includes Playwright/CDP/IPC, owned chooser replies and
parsing/writing/update work. The Open/Save success-flag assertion is also inside
this boundary; complete semantic, selection and file validators run outside it.
throughFrameDrainMs extends the same start through two renderer animation-frame
callbacks. It does not measure physical input or compositor/display presentation.
Times are not isolated core execution, cold disk access, durable write completion
or a human responsiveness score. JIT/file-cache/process conditions are repeated,
with no cold boot, system-load control or statistical significance claim.

Pan must produce center(551,138), scale0.5. Zoom must use scale0.5*exp(0.12) and
the independently recomputed world anchor from the actual canvas-relative wheel
coordinates. Full nonviewport content stays exact. Selection must contain all
2,000 IDs in order and leave serialization unchanged; ESC clears it. Saved and
reloaded files must equal the complete zoomed state, including navigation.

App watchdog180s, finite operation/frame waits and outer budget240s bound each
variant. Any failure invalidates that observation set; there is no elapsed-time
pass threshold. The workflow checks source/candidate identity and preservation,
zero visible-window events, no observed external requests or page errors, owned
chooser counts and descriptor removal after quit.

## Observed results

The following values are rounded to0.001ms for display; CSV values are unrounded.
Each cell contains the exact five-observation minimum, median and maximum before
rounding. Variation is reported rather than filtered or retried.

| Variant | Operation | Action min / median / max (ms) | Through frame drain min / median / max (ms) |
| --- | --- | --- | --- |
| source | open | 52.686 / 56.957 / 62.142 | 61.794 / 74.995 / 79.335 |
| source | selectAll | 27.939 / 32.454 / 34.187 | 39.820 / 42.398 / 44.524 |
| source | clearSelection | 21.194 / 23.827 / 27.627 | 28.102 / 38.107 / 44.651 |
| source | pan | 55.694 / 57.666 / 60.845 | 81.824 / 83.690 / 84.615 |
| source | zoom | 35.340 / 36.125 / 36.859 | 65.254 / 66.971 / 67.519 |
| source | saveAs | 47.598 / 51.786 / 56.968 | 52.987 / 69.492 / 81.012 |
| source | reopen | 50.989 / 55.648 / 59.111 | 61.313 / 61.724 / 78.895 |
| unpacked | open | 42.410 / 47.093 / 54.349 | 57.171 / 60.896 / 74.058 |
| unpacked | selectAll | 28.577 / 31.867 / 36.526 | 39.661 / 42.484 / 46.469 |
| unpacked | clearSelection | 21.600 / 24.174 / 29.022 | 26.996 / 34.201 / 41.023 |
| unpacked | pan | 57.238 / 60.019 / 62.938 | 81.918 / 83.778 / 85.120 |
| unpacked | zoom | 35.081 / 35.872 / 37.981 | 64.680 / 66.559 / 66.941 |
| unpacked | saveAs | 41.159 / 46.362 / 53.475 | 55.623 / 64.329 / 67.316 |
| unpacked | reopen | 45.163 / 49.025 / 56.220 | 59.742 / 61.063 / 76.235 |

Each variant produced42 timing rows (7 warm-up,35 measured). The standalone
stdlib-only audit-performance.py imports no product code. It validates literal
geometry,43 input/checkpoint files via hashes,6 complete transition rounds,42
timing rows,7 independently recomputed operation summaries and15 rejected corrupt
observation controls. Producer JSON is frozen before this separate audit. Only
navigation arithmetic permits a declared1e-9 tolerance; other semantics are exact.
Source/unpacked input, selection and all saved/navigation checkpoint hashes match.

Controls cover missing entities, bad length, duplicate IDs, units, selection,
pan content/arithmetic, zoom arithmetic, negative timing, positive-but-reversed
frame duration, missing rounds, wrong median/order, saved corruption and warm-up
flags. They corrupt copies of observations, never original files. These validate
the reader; they are not a pre-fix product regression or evidence of optimization.

## Reproduction and limits

With the existing approved Windows prerequisites, use a unique prefix per run:

    node tests/performance-workflow.cjs EXE SOURCE_ENTRY_OR_EMPTY UNIQUE_PREFIX qa/CANDIDATE-SOURCE-1.36.1-beta.5.json

The prefix must begin ordinary-grip-. Source requires the local pinned Electron
and desktop/main.cjs; unpacked must resolve inside an existing QA run. The script
uses the existing local Python venv or CAD_PYTHON for its independent stdlib audit.
Runtime59/resources12, manifest and benchmark inputs are fingerprinted before and
after each run. The three new benchmark scripts are also gate auxiliaries; timing
is deliberately outside default CI/application gate stages.

This is only a 2,000-simple-line drawing. Rich annotations, hatches, blocks, images,
3D, multi-sheet content, other sizes/hardware/DPI, concurrent workloads and actual
client drawings need separate references. Native beta5 warning/dialog acceptance
and installed/upgrade acceptance remain pending. The previously passed37-stage,
648-portable beta5 candidate gate was preserved; no unchanged full gate or build
was repeated. Candidate manifests/installers, installed app, normal profile,
client drawings and native input remain unchanged. Daily-use readiness is false.
Next safe ordered milestone: isolated development reload/restart preservation.
