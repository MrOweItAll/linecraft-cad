# Changes

## 1.9.0 — Roof + Space R0–R2 preview

- Extend the existing editor with schema-versioned architectural source, native Save/Open and grouped regeneration Undo/Redo.
- Add orthogonal face-referenced walls, hosted openings, room recognition, labels, ceiling intent and axis-span constraints.
- Generate bounded equal-eave hip roofs directly from rectangle/L/T/H footprints, with independent topology, physical area and runoff tests.
- Reuse existing units, renderer, camera, picking and layouts; generated geometry selects semantic owners.
- Preserve the owner assumption of zero prefabricated-truss design and manufacturing-complexity surcharges, while keeping physical quantities and explicitly unknown framing assumptions.

Architectural drawings use Linecraft/2 and cannot be opened in older releases. Ordinary Linecraft/1 drawings remain supported. Ceiling-space recovery, gables, variable bearings, sections, optimization and engineered framing validation are not implemented in this preview.
