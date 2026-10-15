# Changes

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
