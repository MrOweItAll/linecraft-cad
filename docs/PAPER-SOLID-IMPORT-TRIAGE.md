# LC-MON-007: planar paper SOLID import rejection

Status: **reproduced, unresolved; P1 drawing-open blocker**. Triage completed on
October 25, 2026. No product fix, application launch, installation or client-file
access was performed for this investigation.

An incoming drafting-workflow report described an Open failure in installed
1.36 when a drawing contained a planar paper-space SOLID. That installed UI
behavior was not rerun here. Independently authored synthetic DXF controls
reproduced the whole-import rejection in both current beta3 source and preserved
1.36 source.

Current source checked: 1.36.1-beta.3, commit
`0cf9bd273b69c7cced5baf36f78027cd40e98fb9`. Each reader's 59 runtime files were
hash-verified before and after the checks. A separate read-only archive comparison
confirmed that the installed importer and core members match the preserved 1.36
members exactly. The installed EXE and archive stayed unchanged; no installed
application code was executed by that comparison.

## Minimal reproduction and observed controls

The independent reproduction contains one model LINE sentinel and one SOLID
owned by a paper layout. Its boundary is the 40 by 20 mm rectangle
`(20,30,0), (60,30,0), (60,50,0), (20,50,0)`, with area 800 square millimeters.
All transformed corner Z values are exactly zero. No client geometry, drawing
names, project metadata or diagnostic paths are required to reproduce it.

Expected behavior is to retain the filled rectangle at its declared sheet
position, with the same layout ownership and appearance, while preserving the
model sentinel. The expected semantic result does not require a particular
native entity type.

| Independent case | Current beta3 and preserved 1.36 result |
|---|---|
| Planar paper SOLID | Importer produces a layout-owned MESH with the literal zero-Z corners; final native validation rejects the entire import |
| Same SOLID in Model | Import succeeds as a MESH; this records existing model behavior and does not endorse that representation for paper geometry |
| Paper SOLID with one Z=2 corner | Source Z remains present and import rejects; no flattening observed |
| Paper LINE with the same ownership mechanism | Import succeeds, retaining one model LINE and one owned paper LINE |
| Independently authored paper solid HATCH | Pure native-document construction succeeds with the literal filled boundary and area |

The planar paper SOLID failure is:

```text
Imported geometry did not pass document validation: Import rejected: Paper entities must be planar 2D geometry.
```

Ten diagnostic/control assertions completed. A passing reproduction assertion
means the defect was observed as expected; it does not mean the drawing opened
successfully or a fix passed.

The first diagnostic harness inspected `layouts[].entities` before native
serialization, where the importer instead stores owned entities in its flattened
`entities` array using `layoutId`. A distinct second attempt corrected that
observation adapter. Fixture geometry, product code and geometric assertions
were unchanged, and the first attempt was retained. An initially blocked archive
lookup was resolved using the previously recorded installed location; no
environment or application configuration was changed.

## Cause and proposed narrow repair

In `dwg-import.mjs`, the shared SOLID/TRACE/3DFACE branch publishes MESH entities.
Paper ownership adds a `layoutId`. The final `importDXF` native-document check
then correctly rejects a spatial entity type in paper space, even when its
vertices happen to have zero Z. The same mapping and guard are present in the
preserved 1.36 source, so this failure predates the beta importer and tick-width
changes.

The proposed first repair is limited to zero-thickness paper SOLID records whose
fully transformed vertices lie exactly on the allowed paper XY plane. The
existing solid HATCH with a closed PLINE boundary is a suitable representation
to investigate because it retains fill; a plain outline PLINE would lose it.
This is a proposed importer change, not an implemented or qualified fix.

Keep the core's planar paper validation intact. Preserve existing model-space
MESH behavior. Do not flatten nonzero elevation, tilted/off-plane, nonplanar or
nonzero-thickness content into accepted paper geometry. TRACE requires separate
deliberate qualification. Leave 3DFACE behavior unchanged: its coordinate,
corner-order and invisible-edge rules require separate treatment.

## Required acceptance for a future candidate

- Add a failing synthetic regression for the planar paper SOLID, then verify
  literal coordinates, 800-square-millimeter area, filled coverage, layout
  ownership, layer/color/appearance properties and expected entity count.
  Preserve the model sentinel and unrelated document content exactly.
- Check SOLID corner ordering and a triangular SOLID with its repeated fourth
  corner. Retain malformed, degenerate and self-crossing-boundary rejection.
  Check paper-unit conversion and supported OCS/block transformations without
  moving, rounding or flattening accepted geometry.
- Keep explicit rejection or unsupported-content diagnostics for nonplanar,
  off-plane and nonzero-thickness cases. Retain model SOLID, TRACE and 3DFACE
  controls so the bounded repair cannot silently alter those paths.
- Exercise the actual source and packaged application: Open/import, grouped
  history, Save As, close/reopen and complete semantic-state comparisons. Record
  any intentional navigation-context behavior separately from drawing content.
- Produce an actual PDF through the application. Independently measure the
  rectangle's sheet position and 40 by 20 mm size, verify opaque filled coverage
  and color, and visually inspect it. Missing, partial, shifted, wrong-scale and
  nonplanar controls must fail for their intended reasons.
- Run the required exact-candidate gates and focused visible native acceptance
  using disposable synthetic drawings. Source checks alone cannot establish
  installed Open, native dialogs, PDF publication or client-drawing fidelity.

All fix, application, persistence, history, PDF and new-candidate acceptance work
above remains pending. Existing
[focused native beta3 tick-width acceptance](NATIVE-BETA3-ACCEPTANCE.md) remains
valid within its recorded scope. This newly confirmed drawing-open blocker must
be resolved and qualified before daily-use readiness; that earlier acceptance
does not cover paper SOLID import. Installed/upgrade qualification and separate
promotion/release authorization also remain outstanding.

Only sanitized issue documentation is added by this triage. Private reports,
diagnostic observations and fixture receipts remain outside the public source.
