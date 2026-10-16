# Fixed-roof ceiling study

The existing Roof + Space workspace includes exact flat-ceiling analysis, introduced in Linecraft 1.10 and subsequently extended with rectangular trays and optional thickness. Open **Architecture → Space study**, or type **ROOFSPACE**. The study reuses assigned drawing units, architectural length input, existing room topology and the accepted roof facets.

## Workflow

1. Create or load an enclosed, recognized room beneath one valid hip roof. Select the room and its covering roof in Space study. A partial roof, unresolved room, overlapping skin or unsupported composition cannot establish usable space.
2. Calculate immediately with zero-thickness mathematical surfaces; no roof assembly declaration is required. Optional combined thickness is measured normal to the roof; the source/API also supports named layers. Use **Use zero thickness** to clear entered roof layers and the selected room's ceiling finish together, retaining reservations as one Undo transaction. Existing saved thicknesses are preserved until explicitly changed.
3. Set the target finished-ceiling elevation, minimum finished clear height, headroom threshold and vertical ceiling-finish thickness. Enable ceiling changes, then save study intent. Minimum height and headroom are user inputs, not adopted code requirements.
4. Add any known structural, service or clearance reservations as positive-volume boxes in building-local XYZ. Reservation bottoms limit a ceiling connected vertically to the room floor. Boxes wholly above the roof or below the floor do not reduce its envelope. Boxes are mathematical constraints; no framing construction is inferred.
5. Inspect current and target feasibility, maximum flat elevation, clear height, recoverable flat volume, headroom area, and limiting coordinates/obstruction. Apply a feasible target or maximum as one Undo operation. Editing a study never changes the roof pitch, bearing elevations, footprint or roof vertices.
6. Add a dimensioned snapshot section along local X or Y at a chosen crossing coordinate and model-space drawing origin. It includes the roof and modeled envelope profiles, floor and current/target/maximum ceiling lines, and measured dimensions. Disjoint room intervals remain separate. Sections are ordinary snapshot geometry; regenerate after changing source.

## What is calculated

Room polygons are triangulated and intersected with actual roof-facet triangles. Optional assembly offsets and reservation lower faces form a bounded piecewise-planar arrangement. Extrema include new polygon-intersection vertices; no coarse height grid establishes the maximum flat ceiling. Linear volume and threshold-area calculations integrate clipped cells.

A roof-normal thickness `t` beneath a plane with horizontal slope components `sx, sy` reduces vertical clearance by `t * sqrt(1 + sx² + sy²)`. Ceiling finish is a separate vertical deduction. The maximum flat ceiling is the lowest permitted finish-ceiling elevation anywhere in the room. Current/target flat volumes are reported as usable only if the entire candidate satisfies the modeled envelope and minimum constraints. The report keeps any clipped-envelope diagnostic volume distinct from a rejected flat ceiling's usable volume.

Headroom area under the envelope describes geometric potential above the selected threshold. It does not create an additional floor or story. Flat-candidate headroom is reported separately. Physical roof area, edge lengths, nominal declared layer material volumes and ceiling-finish volumes remain separate quantities. Framing lumber and connectors remain unknown. Both requested prefabricated-truss surcharges remain exactly zero.

## Source and limits

Native files retain `Linecraft/2` with architecture schema 3. Schemas 1 and 2 migrate explicitly without changing prior physical values or the roof; newly introduced clearance/finish inputs and tray fields receive explicit defaults. Derived study cells, volumes and reports are recomputed rather than persisted as authority. Source revisions and roof-geometry fingerprints identify results. Older applications reject newer architecture schemas rather than silently dropping their fields.

The study supports flat ceilings and one rectangular stepped tray, one current roof skin per room, and local-axis box reservations. Sloped transitions, vaults, gables, variable bearings and automatically ranked alternatives remain later work. Existing roof limits and numerical tolerances still apply. The existing painter renderer can expose internal mesh lines. Section snapshots do not automatically update.

Results describe the mathematical surfaces and optional offsets/reservations entered in the drawing. Return thickness and return material volume are zero. Structural and stair/access calculations are outside this mathematical study; machine-readable framing verification remains unverified.
