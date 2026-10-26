# Planar paper SOLID import in 1.36.1-beta.4

LC-MON-007 blocked an entire drawing from opening when an otherwise planar paper
SOLID became a MESH that the native paper-space validator correctly rejected.
Beta4 represents the supported paper fill as an editable solid HATCH, preserving
its boundary and sheet ownership. The original DXF remains unchanged.

Code commit: `474b97a0b202169d38a8d1e2778a15995d92b9f7`.
Relative to beta3, the only application runtime change is in `dwg-import.mjs`.
The candidate has a separate cumulative manifest; prior release/candidate
identities and evidence remain intact. See [the triage record](PAPER-SOLID-IMPORT-TRIAGE.md)
for the reproduced failure and controls.

## Narrow behavior and preservation

The new branch applies only to paper-owned SOLID records. After the existing
corner-order correction, OCS/block transformations and paper-unit conversion,
every retained vertex must have Z exactly zero. Missing thickness means the
format's zero-thickness default. Every explicit group 39 occurrence must be
nonempty, finite and numerically zero; checking only the first occurrence would
incorrectly admit contradictory thickness values.

Accepted geometry becomes one nonassociative solid HATCH with a closed PLINE
boundary and the captured layer, color, lineweight and layout ownership. Import
reports the representation change. Polygon validation remains in the final
native-document check: a degenerate or invalid paper fill rejects the import
instead of disappearing through a per-record skip path.

The core's paper-space guard is unchanged. Nonplanar, elevated or off-plane
results with final nonzero Z, and nonzero/malformed-thickness paper cases,
continue to reject the whole import.
TRACE and 3DFACE retain their previous paths and are not newly supported paper
geometry. Model SOLID/TRACE/3DFACE behavior remains unchanged. No native schema
or migration is introduced; this uses the existing solid-HATCH representation.

DWG conversion feeds the shared DXF import path, so this correction is on that
path. These new fixtures exercise ASCII DXF and do not establish actual DWG
conversion/Open behavior, general DWG fidelity or client-drawing acceptance.

## Verification record

The independently authored fixture contains a 40 by 20 mm paper rectangle at
(20,30)..(60,50), area 800 square millimeters, one model LINE sentinel and one 10 mm
paper LINE sentinel. It declares an A3 sheet and no viewports. No script repairs
the imported fill or creates a viewport to obtain a passing plot.

| Evidence | Recorded outcome |
|---|---|
| Frozen beta3 regression control | 36 checks: 23 pass and 13 expected paper-import failures; red evidence retained |
| Focused beta4 paper-SOLID suite | 36/36 pass with the same geometric assertions |
| Existing importer/HATCH/viewport/tick suites | 82/82 pass; overlapping focused coverage is not added to full-gate totals |
| Actual hidden source preflight | Six application checks pass; source and input fingerprints unchanged |
| Preflight actual PDF | Two independent measurements and seven negative controls pass; full interior dark fraction 1.0 against minimum 0.995 |
| Fresh full candidate gate | Passed 30/30 stages and 631 selected portable checks on the exact beta4 manifest |
| Fresh source application workflows | Passed existing 32/PDF9, drafting/import smoke10, tick-width10 with 30 measurements, and new paper-SOLID6 with PDF2/seven controls |
| Fresh unpacked application workflows | Passed existing 32/PDF9, drafting/import smoke10, tick-width10 with 30 measurements, and new paper-SOLID6 with PDF2/seven controls |
| Four preserved source readers | 1.36.0, beta1, beta2 and beta3 preserve the actual packaged native file as exact complete state and serialized bytes; 59 files per reader verified before/after |

Each source/unpacked authenticated controller moves only the imported fill by (5,7),
then Undo/Redo/Undo restores the complete imported, moved and imported documents.
Actual Save As/New/Open preserves all IDs, geometry, appearance properties,
layouts and navigation fields. Plotting preserves both the complete live state
and saved native file. The paper/model sentinels remain unchanged.

The independent PDF reader checks the 40 by 20 mm opaque fill at literal PDF bounds
(20,247)..(60,267) mm and the 10 mm paper sentinel. It requires complete quadrilateral
coverage, verifies both sides and area, and rejects missing, partial, shifted,
wrong-sized, transparent/unknown-opacity fill and late white overpaint. The
raster corroboration uses a predeclared 0.1 mm inset, gray below 32 and minimum 0.995
fully interior dark-pixel coverage. Physical tolerances are retained in the
reader; they were not adjusted to make the candidate pass. Fresh render review
is separate from numerical acceptance.

The source and unpacked workflows use isolated hidden processes and test-owned
chooser replies. Their production file/PDF services are exercised, but these are
not visible native dialogs or installed/human acceptance. Full source and unpacked
PDF renders were inspected; their detail renders are byte-identical. The filled
rectangle, paper sentinel and page placement show no visual defect.

## Remaining acceptance boundary

The actual packaged native file passed all four preserved source readers. These
pure-reader comparisons do not establish installed upgrade/downgrade behavior.

The [beta3 native tick-width acceptance](NATIVE-BETA3-ACCEPTANCE.md) retains its
historical, focused scope. Exact beta4 visible native paper-SOLID acceptance,
installed/upgrade qualification, broad DPI/font/mouse and human drafting checks,
and separate daily-use promotion/release authorization remain pending.

Only independently authored synthetic CAD was used. No client CAD was accessed,
and the installed application was not started, installed over or otherwise
changed. Private reports and local evidence paths stay outside public source.
