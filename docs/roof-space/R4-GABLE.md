# R4 — terminal gable assignments

R4 extends the existing architectural source, renderer, selection, native files, layouts and grouped Undo history. It does not replace Linecraft's drafting tools. Gable roof vertices are generated from the source footprint, pitch, bearing, eave/rake overhangs and confirmed terminal assignments.

## Use the Roof pane

1. Open Architecture → Roof. Choose an existing roof or a captured closed drafting path / exterior-bearing wall perimeter.
2. Choose **GABLE**, one of the 23 pitches, eave overhang, rake overhang, bearing and heel offset. Elevations and overhangs use the drawing's existing physical-length parser, including feet and inches.
3. Click **Inspect source boundary ends**. Eligible terminal edges are listed with their building-local endpoints. Ineligible recess/eave edges remain visible and disabled.
4. Choose a bounded suggestion and click **Use selected suggestion in draft**. Rectangles offer both opposed end pairs and state the resulting X/Y ridge direction. A supported cross or H offers its terminal-wing assignment. Suggestions do not change the accepted roof.
5. Review the selected ends, then click **Confirm selected gable ends**. Finally **Apply roof parameters** (existing group) or **Generate assigned gable roof** (new group).

An overhang, bearing, pitch, assignment or policy edit invalidates draft confirmation. Reconfirm before applying. The accepted-generation panel remains distinct from the draft. ALL_GABLE requires a complete supported terminal assignment; an incomplete set is rejected without a HIP fallback. The existing roof remains accepted when a proposed edit is rejected.

The source persists building-local geometric edge keys rather than edge indices. Boundary edits can invalidate those keys and require a new explicit decision. The roof is not silently reassigned. Gable closure patches have the same semantic roof owner as the sloping skin and use existing 3D projection and picking; no vertex editing of the generated source is introduced.

## Zero-thickness mathematics and quantities

Roof and gable closure surfaces have zero thickness. Ceiling thickness defaults to zero. Roof thickness, finish thickness and reservations remain optional inputs to the existing clearance study. Ceiling intent and bearing remain independent. Calculations retain physical surface/edge areas, envelope volumes, reservations and feasibility diagnostics. Both prefabricated-truss design and manufacturing-complexity surcharges remain zero.

A gable end can contain multiple closure patches, one per intersecting roof facet. Count distinct sourceEdgeKey values for the number of terminal ends; do not confuse the patch count with the end count. Closure areas are separate from the sloping roof skin and are excluded from ceiling-envelope integration.

The source-only sample `samples/gable-v112.linecraft` is a 40 × 20 ft clear room with 4:12 pitch, 10 ft bearing, 2 ft eave overhang, 3 ft rake overhang, and confirmed X ridge. Its generated coverage is 46 × 24 ft, maximum roof elevation is 13 ft 4 in, and total closure area at source wall ends is 66 2/3 ft². Its accepted ceiling remains 8 ft. It includes an A3 layout with locked plan/3D viewports.

## Actual acceptance evidence

`tests/gable-desktop.cjs` operates the actual hidden Electron application in an owned disposable profile. It verifies 19 cases: existing UI and 23 pitches; two rectangular orientation suggestions; unconfirmed rejection; confirmed independent overhangs; grouped HIP/GABLE Undo/Redo; exact zero-thickness clearance; X/Y ridge switching; changed-field confirmation invalidation; incomplete ALL_GABLE rejection; atomic duplicate-key rejection; real mouse picking of a gable closure using the existing Right view; ceiling/section independence; native Save/Open IPC; cross and H generation; immutable source-only sample; exact 320 CSS-pixel containment; no clipboard/network/script errors; stable source fingerprints. Native picker paths and discard answers are stubbed in this automated driver. Visible installed testing is reported separately by the milestone report.

The independent 20 × 12 ft GUI fixture has 2 ft eaves / 1 ft rakes and a 10 ft bearing. X ridge peaks at 12 ft and gives 2,640 ft³ below the roof; Y ridge peaks at 13 ft 4 in and gives 2,800 ft³. Its independent 8 ft ceiling remains 1,920 ft³ in both cases. These are mathematical envelope quantities, not a framing design.

Run the source driver with the pinned Electron executable, the existing `desktop/main.cjs`, and a report prefix. Run the same driver against the unpacked or normally installed executable without a source entry. Report files are written under `tests/` and include executable identity, per-case results, hidden-window observations, errors and source hashes. `tests/export-gable-sample.mjs` validates the deterministic fixture; it will not silently overwrite an existing differing sample.

## Remaining limits and next task

One simple, exact orthogonal footprint, equal bearing and equal pitch; bounded terminal gables and finite wavefront work. Unsupported assignments, adjacent stationary ends, courtyard holes, degenerate overhangs and unresolved coverage produce diagnostics. A mixed explicit set is accepted only when the kernel validates its complete skin and drainage. No structural, supplier or manufactured-truss claim is made. Framing, member sizing, connections and load paths remain unverified mathematical assumptions.

The next milestone is R5: explicitly declared variable bearing heights, with bounded geometric constraints, independent ceilings and no silent change to an accepted roof when a constraint is infeasible.
