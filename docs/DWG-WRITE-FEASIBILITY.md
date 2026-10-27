# DWG writer feasibility - October 26, 2026

LC-FMT-001 completes a bounded feasibility investigation. Application DWG export
remains unavailable. Existing standalone writer tools can emit an R2000 binary
from a diagnostic derivative, but the current DXF route is unqualified. No runtime,
exporter, importer, resource manifest or installer changed in this milestone.

## Available capability and provenance

The application supplies `dwgread.exe` for import and exposes DXF export only.
An existing official LibreDWG 0.13.4 Windows archive outside the application also
contains `dxf2dwg.exe` and `dwgwrite.exe`. Their help/version commands ran locally;
no download, installation or new dependency was required. The writer's supported
target stops at R2000 in the [tagged README](https://raw.githubusercontent.com/LibreDWG/libredwg/0.13.4/README)
and [tagged dxf2dwg source](https://raw.githubusercontent.com/LibreDWG/libredwg/0.13.4/programs/dxf2dwg.c).
The current core exporter produces R2013/AC1027 DXF. This experiment explicitly
requested R2000/AC1015 output; it establishes no modern DWG writing support.

| Existing input | SHA-256 |
| --- | --- |
| Official 0.13.4 Win64 ZIP | `cb46bce034296e91cb1a982cd53ec1928b11f4f7f70512dd21513a27959688b5` |
| `dxf2dwg.exe` | `820e1359fe5f14a7e614bdeefbc0c01c06b72db39a0cc1a0d31244ebd342136f` |
| `dwgwrite.exe` | `e1156a1b97baac5a21b21bf1b29cbcd0ce2e66233f6d555a382c35e08bd477e1` |
| Existing `dwgread.exe` | `88f3c398bc1ff5a83c365fe8180018ef26947a63fff21fad8a032dd056a47c94` |

The ZIP checksum agrees with the [official release](https://github.com/LibreDWG/libredwg/releases/tag/0.13.4).
The local executables and required DLLs match their ZIP members. The existing
manifest records LibreDWG GPL-3.0-or-later and libiconv LGPL-2.1-or-later; preserve
their notices and matching source. See [source provenance](THIRD-PARTY-SOURCE.md)
for the pinned source supplement and unperformed binary rebuild. This is an
inventory, without a new distribution or legal-compliance certification. No
proprietary SDK, account, licensed CAD environment or new commercial dependency
was provisioned or qualified.

## Frozen synthetic inputs and commands

The two [model](../tests/fixtures/dwg-writer-feasibility-model.dxf) and
[multi-sheet](../tests/fixtures/dwg-writer-feasibility-multisheet.dxf) fixtures are
exact fresh outputs of the unchanged pure core exporter, with no exporter warnings.
They contain synthetic geometry only. Empty export warnings do not establish
compatibility with the GNU writer. No original drawing was modified, copied or
passed to a converter or application during the experiments.

The model uses inch units: LINE `(0,0)` to `(240,0)`; CIRCLE center `(300,100)`,
radius 24; TEXT `SYNTHETIC-DWG-MODEL` at `(12,24)`, height 6, rotation 0,
Standard/Arial style. The second fixture uses the existing multi-sheet synthetic
reference: stored tabs `SYNTHETIC B`, `SYNTHETIC A`, each 420 by 297 mm; model line 240 in;
locked floating views at 1:96 and 1:48. Each paper border has corners `(10,10)`,
`(410,10)`, `(410,40)`, `(10,40)`, dividers at x 300/360, a 100 mm paper line, and
the corresponding `QA-A02-SECOND` / `QA-A01-FIRST` label at `(310,15)`, height 4.

Commands used new private output directories, hidden child processes and 30-second
timeouts; outputs never replaced originals:

```text
dxf2dwg.exe --as r2000 -o fresh-output.dwg synthetic-input.dxf
dwgread.exe -O DXF -o fresh-decoded.dxf fresh-output.dwg
```

Two distinct converter attempts were allowed. Both original DXFs failed the first
command with exit 1 and `Invalid DXF code 410 for LINE`; no DWG was produced.
Group410 is a valid common layout-tab-name field under the
[Autodesk DXF reference](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-3610039E-27D1-4E23-B6D3-7E60B22BB5BD.htm).
This failure demonstrates a converter compatibility barrier, not invalidity of
that DXF field. Both GNU writer entry points use `dxf_read_file` for DXF input;
switching to `dwgwrite -I DXF` would reuse the same parser. Its JSON input is a
different schema and is not Linecraft native JSON.

The second attempt made separate diagnostic copies. It removed only the 3 model
and 15 multi-sheet common-entity group 410 tags, after verifying each name agrees
with `entity 330 -> BLOCK_RECORD 340 -> LAYOUT.name` and paper flag 67. Every other
raw group pair and its order remained unchanged; originals stayed byte-identical.
Both derived conversions and readbacks returned 0 and produced AC1015 binaries.
Nevertheless the reader logged duplicate-handle and missing-object errors; the
multi-sheet case also warned about empty symbol names. Exit 0 and a `SUCCESS`
line are insufficient acceptance. This adapter was not added to the application.

## Independent readback and limitations

A separate standard-library raw-tag reader imports no Linecraft or CAD parser
code. Literal expected coordinates, inch units and floating viewport identity
were frozen before conversion; numeric tolerance remains 1e-6 CAD units. It audits
the decoded DXF, rather than independently decoding binary DWG. Writer and reader
use the same LibreDWG version, so agreement cannot establish independent format
correctness. Private receipts bind the exact inputs, outputs, tools and auditor.

| Requirement | Model derivative | Multi-sheet derivative |
| --- | --- | --- |
| Typed model geometry and literal placement | Passed | Passed |
| Inch `$INSUNITS=1` | Passed | Passed |
| Text value/placement and Arial style reference | Passed | Passed for both sheet markers |
| Paper names, tab order, ownership and A3 size | Outside fixture | Passed |
| Typed title blocks and paper lines | Outside fixture | Passed |
| Decoded explicit handle graph | Unique/resolved | Failed: duplicate `ENDBLK` handle 24 |
| Floating viewport identity, locked scale and role | Outside fixture | Failed for both intended views |
| Clean tool diagnostics | Failed | Failed |
| Independent binary decoder, native edit/save/reopen | Not run | Not run |
| Actual glyphs, lineweight/color/plot fidelity | Not verified | Not verified |

The corrected reader passes 6/6 model checks and 7/10 multi-sheet checks. The initial
reader incorrectly selected HEADER only if it contained no later group 2 values,
misreporting units as absent. A retained private regression corrects that section
selection without changing expected units, geometry, viewport assertions or
tolerances. Direct group 9/next-pair inspection separately confirms inch units in
both sources and readbacks. The original reader and failed receipts remain intact.

All four decoded VIEWPORT records remain. Both intended floating viewport IDs
(group 69) change from 2 to 1, the overall-paper viewport role. Frames, targets and
lock flags remain; their fields still imply 1:48/1:96 if treated as inch-based
floating views. Those supplementary fields do not pass the required floating-role
check or establish visible model windows. The current importer skips ID 1 as the
overall viewport; no native consumer behavior was tested here. The duplicate
decoded handle and changed IDs are observations across the writer/readback chain;
this experiment does not isolate which component introduced them.

## Acceptance before integration

Any future implementation needs a focused, retained failing regression for these
barriers, clean structural diagnostics and an independent consumer check. A
bounded initial subset would require LINE/CIRCLE/TEXT, explicit units/styles,
unique resolved ownership, both paper layouts/title blocks, working locked
floating views, and native edit/save/reopen without repair. Unsupported geometry
must receive explicit diagnostics before export, rather than silent flattening.
Atomic destination handling, overwrite/cancel, timeout/failure preservation,
font/plot fidelity, licensing/distribution review and an authorized consumer
environment remain separate prerequisites. Advanced entities, template fidelity,
modern DWG versions and general client/AutoCAD parity are unqualified.

No app gate was rerun for this fixture/documentation milestone; existing beta4
runtime and candidate receipts retain their previous scope. No native desktop
input, installed/upgrade acceptance, installation, publication or client drawing
test occurred. Application DWG writing remains unavailable; daily-use readiness remains
unqualified. Next safe queue item: controlled synthetic
font/template/layout gap inventory; retain the DWG barriers for a future focused
qualification milestone.

## Follow-up attribution, 2026-10-27

[The preserved-artifact audit](DWG-READBACK-ATTRIBUTION.md) refines the historical
viewport and diagnostic attribution above without rewriting its receipts or
check outcomes. Pinned DXF output synthesizes VIEWPORT id/on_off=1; that group69
value alone does not prove encoded R2000 floating-role corruption. The retained
errors are in encode-process logs. Fresh same-library JSON exposes duplicate
object handles and unqualified VX/layout state. No new writer attempt, runtime
change or native qualification occurred; DWG output remains unavailable.
