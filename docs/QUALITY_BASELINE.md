# Quality baseline

Baseline commit: f37aba5ebe19f27088847cd8f983ecf5facf8eac, version1.36.0,
origin https://github.com/MrOweItAll/linecraft-cad.git. Local ownership branch:
codex/quality-loop-1.36.1. Candidate version1.36.1-beta.1. Exact local paths and
checkpoint/installer hashes are in the private session report, outside this tree.

Verified on2026-10-24: Windows x64, host Node24.13.0/npm11.6.2, local Electron44.9.3,
Playwright1.62.1/electron-builder26.15.3, Python3.14.6/PyMuPDF1.28.0. Installed app
metadata reports1.36.0; no upgrade is performed. The preserved published installer
hash was rechecked, and the complete source bundle and checkpoint hashes verified.
The starting tree contained only an uncommitted local handoff document, preserved
and excluded from candidate commits because it contains private machine details.

Fresh baseline: existing public pure profile passed306 core plus222 focused checks;
twelve private-reference cases remain explicitly excluded. Source actual hidden
app passed32 checks and independent actual PDF9. The restricted shell's initial
Electron launch failed; an authorized isolated launch outside that shell passed.
That environmental failure and historical receipts are retained separately.

The initial HATCH regression failed on the unchanged importer: only the sentinel
LINE imported; the redundant-closing rectangle fill was omitted. New public tests
derive from the reviewed synthetic packet, replace its self-comparison with literal
vertices/properties/area, and add literal transformed block coordinates. Private
client controls are preserved outside the repository and are not published.

| Format | Read/write | Supported current scope | Test/reference | Limits |
|---|---|---|---|---|
| Native Linecraft/1 and/2 | Both | Ordinary entities, units/styles/layers/layouts/resources; validated architecture | Existing core/persistence; quality smoke Save/reopen | /2 requires authoritative architecture; no general backward-version guarantee |
| DXF | Both, bounded | Selected ordinary geometry, annotations, blocks, supported HATCH and paper views | Existing importer; synthetic HATCH; actual two-ruler export reader | Not complete fidelity; holes/bulges/multiple HATCH loops unsupported; images may need sidecars |
| DWG | Read through bundled converter | Bounded importer subset | Existing converter/resource verification; new direct DWG test not run | No writer; no full proxy/xref/layout/font fidelity claim |
| PDF | Write | Actual vector plotting, physical layouts/scales | Existing independent PDF9 plus new rulers/fill audit | Raster appearance/fonts/platform need visual review; not editable native exchange |
| Structural JSON | Optional exchange | Declared supported inputs | Existing project checks | No engineering approval or certification implied |

The proposed loop adds no new format/schema or general AutoCAD compatibility.
Visible candidate/native dialogs, installed acceptance, Windows/DPI/font soak and
fresh AutoCAD reference observations remain separate checks. LC-MON-003 viewport
center repair, independent tick stroke, extra grip modes and idle two-click window
selection are unfinished. Historical monitoring records remain untouched.


## First milestone outcome

Tested code commit3de665ab06f7a48eabc4a5331100786a01fb969a produced local candidate
1.36.1-beta.1. Its full automated gate passed22/22 stages:559 selected portable
checks, source and unpacked32/PDF9 each, and the new real-loopback9-check drafting
smoke for each. These are overlapping evidence classes, not an independent feature
total. The private original HATCH27-check control was separately rerun against
current source and a preserved1.36 baseline; only module/fixture location bindings
were adapted, without changing assertions. It overlaps the26 public HATCH tests.

Both actual packaged PDFs were visually inspected. The actual127mm/50.8mm ruler
measurements and20x12mm solid fill passed independent reading. An earlier stricter
reader attempt failed by counting an antialiased partial boundary row; independent
vector/device-coordinate inspection justified restricting sampling to fully
contained pixels. The99.5% threshold and missing/partial-ink negative controls were
preserved. Failed evidence remains available privately.

Candidate-saved native drawing copies reopen semantically unchanged with all59
runtime files extracted and hash-verified from the preserved1.36 checkpoint.
This is source-reader compatibility, not installed downgrade/upgrade acceptance.
The installer was compiled without installing. Native dialogs/physical input,
installed candidate acceptance, dev-host reload/restart refresh, larger-drawing app
timing, broad font/DPI/Windows soak and the original large client-sheet case on the
refreshed vendor runtime remain unverified. The selected new sheet is a reduced
calibration fixture; existing title-block references remain separate coverage.

The local CI configuration has not been pushed or run remotely. Report/log artifact
uploads were rejected by automatic approval review because of potential path or
metadata disclosure; evidence remains local. No remote publication, merge, tag,
installation, scheduler or outbound message occurred. Manual invocation ready;
unattended execution not enabled. Next ready repair: separately review LC-MON-003.
