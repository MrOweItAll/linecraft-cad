# Fixed-roof ceiling study

Linecraft 1.10 extends the existing Roof + Space workspace with exact flat-ceiling analysis. Open **Architecture → Space study**, or type **ROOFSPACE**. The study reuses assigned drawing units, architectural length input, existing room topology and the accepted roof facets.

## Workflow

1. Create or load an enclosed, recognized room beneath one valid hip roof. Select the room and its covering roof in Space study. A partial roof, unresolved room, overlapping skin or unsupported composition cannot establish usable space.
2. Declare the roof assembly. The simple control stores one combined thickness measured normal to the roof; the source/API also supports individual named material layers. Zero is an explicit geometric assumption. Missing declarations produce roof-surface potential only.
3. Set the target finished-ceiling elevation, minimum finished clear height, headroom threshold and vertical ceiling-finish thickness. Enable ceiling changes, then save study intent. Minimum height and headroom are user inputs, not adopted code requirements.
4. Add any known structural, service or clearance reservations as positive-volume boxes in building-local XYZ. Reservation bottoms limit a ceiling connected vertically to the room floor. Boxes wholly above the roof or below the floor do not reduce its envelope. Unmodeled truss webs and chords remain unknown.
5. Inspect current and target feasibility, maximum flat elevation, clear height, recoverable flat volume, headroom area, and limiting coordinates/obstruction. Apply a feasible target or maximum as one Undo operation. Editing a study never changes the roof pitch, bearing elevations, footprint or roof vertices.
6. Add a dimensioned snapshot section along local X or Y at a chosen crossing coordinate and model-space drawing origin. It includes the roof and declared envelope profiles, floor and current/target/maximum ceiling lines, and measured dimensions. Disjoint room intervals remain separate. Sections are ordinary snapshot geometry; regenerate after changing source.

## What is calculated

Room polygons are triangulated and intersected with actual roof-facet triangles. Assembly offsets and reservation lower faces form a bounded piecewise-planar arrangement. Extrema include new polygon-intersection vertices; no coarse height grid establishes the maximum flat ceiling. Linear volume and threshold-area calculations integrate clipped cells.

A roof-normal thickness `t` beneath a plane with horizontal slope components `sx, sy` reduces vertical clearance by `t * sqrt(1 + sx² + sy²)`. Ceiling finish is a separate vertical deduction. The maximum flat ceiling is the lowest permitted finish-ceiling elevation anywhere in the room. Current/target flat volumes are reported as usable only if the entire candidate satisfies the declared envelope and modeled minimum constraints. The report keeps any clipped-envelope diagnostic volume distinct from a rejected flat ceiling's usable volume.

Headroom area under the envelope describes geometric potential above the selected threshold. It does not create an additional floor or story. Flat-candidate headroom is reported separately. Physical roof area, edge lengths, nominal declared layer material volumes and ceiling-finish volumes remain separate quantities. Framing lumber and connectors remain unknown. Both requested prefabricated-truss surcharges remain exactly zero.

## Source and limits

Native files retain `Linecraft/2` with architecture schema 2. Schema 1 migrates explicitly without changing prior physical values or the roof; new clearance/finish inputs default to zero. Derived study cells, volumes and reports are recomputed rather than persisted as authority. Source revisions and roof-geometry fingerprints identify results. Existing 1.9 applications reject schema 2 rather than silently dropping its fields.

The first study supports flat ceilings, one current roof skin per room, and local-axis box reservations. Tray/vault candidates, gables, variable bearings and bounded material/space comparisons remain later work. Existing roof limits and numerical tolerances still apply. The existing painter renderer can expose internal mesh lines. Section snapshots do not automatically update.

Every result remains conditional on declared layers and reservations. It does not certify actual framing, load paths, supplier feasibility or building-code compliance. Stair/access models and unmodeled services are absent. A conceptual reservation model must be replaced or confirmed by a justified framing/supplier model before claiming verified buildable space.
