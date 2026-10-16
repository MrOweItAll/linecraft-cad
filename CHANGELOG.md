# Changes

## 1.11.1 — Explicit zero-thickness mathematical space model

- Default missing-assembly studies to zero-thickness roof/ceiling surfaces so flat/tray calculation and Apply do not require physical-framing declarations.
- Set ideal return thickness and material volume to exactly zero while retaining return area and all geometric constraints.
- Retain optional normal roof and vertical ceiling offsets; never clear stored values on Open. Add explicit **Use zero thickness** as one grouped transaction that preserves reservation boxes, fixed roof geometry, bearings, floor and accepted ceiling intent.
- Keep physical framing verification as a separate report status. Keep both requested truss surcharges zero, schema 3 unchanged and all archived examples byte-for-byte preserved.


## 1.11.0 — R3 bounded tray-ceiling preview

- Add one raised building-local rectangular plateau, lower band and ideal vertical returns beneath the same fixed roof.
- Clip existing affine clearance cells analytically; reject concave recess bridges, boundary contact, incomplete coverage and closed return conflicts, including point contacts.
- Keep proposals separate from accepted source profiles. Compare signed volume change against the actual accepted flat or tray ceiling; report conditional headroom, finish areas and limiting coordinates.
- Apply accepted profiles through grouped Undo/Redo and source-only schema 3 persistence without changing roof vertices/faces, wall bearings, room floor, camera or layouts. Keep archived schema 1 and 2 examples unchanged.
- Add actual accepted-profile stepped section snapshots and a synthetic tray example. Return construction thickness, material volume and framing remain unverified; both requested truss surcharges remain zero.

The first tray supports one strictly interior building-local axis rectangle. General polygons, multiple plateaus, slopes, gables, variable bearings and certified framing remain outside this preview. Section snapshots require regeneration after source changes.

## 1.10.0 — R3 fixed-roof ceiling-space preview

- Calculate exact clipped flat-ceiling envelopes beneath accepted roof facets, including normal roof layers, vertical ceiling finish and bounded local reservation boxes.
- Report current/target feasibility, maximum flat elevation, limiting coordinates, integrated headroom area and conditional usable/recoverable flat volume. Reject infeasible or incomplete studies instead of inventing buildable space.
- Apply feasible ceilings through existing grouped Undo/Redo while preserving roof geometry, wall bearings, camera, native files and layouts.
- Add dimensioned X/Y section snapshots as ordinary objects and ROOFSPACE/ROOFSECTION controls in the existing Architecture workspace.
- Store source-only architecture schema 2; explicitly migrate schema 1 without changing its prior physical values. Keep the original H sample at schema 1.
- Keep both requested truss surcharges at zero. Material/envelope quantities remain physical and actual framing/clearance verification remains unverified.

R3 supports flat ceilings under one covering roof, declared layers and local-axis box reservations. Vaults, gables, variable bearings, access/stairs and bounded alternatives remain future work. Section snapshots require regeneration after source changes.

## 1.9.0 — Roof + Space R0–R2 preview

- Extend the existing editor with schema-versioned architectural source, native Save/Open and grouped regeneration Undo/Redo.
- Add orthogonal face-referenced walls, hosted openings, room recognition, labels, ceiling intent and axis-span constraints.
- Generate bounded equal-eave hip roofs directly from rectangle/L/T/H footprints, with independent topology, physical area and runoff tests.
- Reuse existing units, renderer, camera, picking and layouts; generated geometry selects semantic owners.
- Preserve the owner assumption of zero prefabricated-truss design and manufacturing-complexity surcharges, while keeping physical quantities and explicitly unknown framing assumptions.

Architectural drawings use Linecraft/2 and cannot be opened in older releases. Ordinary Linecraft/1 drawings remain supported. Ceiling-space recovery, gables, variable bearings, sections, optimization and engineered framing validation are not implemented in this preview.
