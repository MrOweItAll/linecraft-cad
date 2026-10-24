# Linecraft Roof + Space

> **Historical milestone reference.** This document records its original R0–R6 implementation scope and evidence. It is retained for design history; its status, next-step and test statements are not current v1.36 qualification claims. See [the historical-reference index](../HISTORICAL-REFERENCE.md) and [current release notes](../RELEASE-1.36-BETA.md).
## Parametric residential envelope and interior-volume extension — implementation handoff

**Date:** October 15, 2026  
**Status:** Proposed implementation specification; not implemented in Linecraft by this handoff.  
**Target repository:** `MrOweItAll/linecraft-cad`  
**Inspected public snapshot:** `main` tree/commit `40c45886f1e2b81efb10523d8c8690ec1af3ac0b`; package version `1.8.0`. Verify the actual local branch, uncommitted work, and latest architecture before editing.  
**Suggested future repository location:** `docs/roof-space/IMPLEMENTATION_HANDOFF.md`.

## 1. Product definition

Extend the existing Linecraft application so a dimensionally accurate residential floor plan becomes a coordinated, editable building model. The user draws or imports confirmed vector geometry, establishes walls and rooms, projects walls vertically, and generates a roof that responds to footprint and roof-support elevation changes. The application then reports and proposes how flat, tray, or vaulted ceilings can recover otherwise unused roof volume.

The fundamental dependency is:

```text
Measured 2D architectural source
    -> wall/room topology + roof-support constraints
    -> roof-boundary and roof-plane solution
    -> validated roof/ceiling clearance envelope
    -> room-height and usable-volume alternatives
    -> linked plan, 3D, sections, quantities, and reports
```

Geometry must be computed deterministically. An image generator or language model is not the geometric authority. Renderings, dimensions, and quantities must derive from the same accepted model.

### Required project priorities

Use materials and useful interior space to compare alternatives. Set the **prefabricated-truss design and manufacturing-complexity surcharge to zero**. Do not introduce a hidden penalty for unusual truss profiles, unique truss counts, roof-face counts, or aesthetic complexity.

This is a cost-model assumption specified by the owner, not an assertion about verified supplier prices. It does not make lumber, connectors, sheathing waste, flashing, wall materials, physical clearance, or load paths disappear. Include quantities when supported; report unknown quantities as unknown.

Preserve the floor plan unless the user edits it or explicitly authorizes an alternative. Optimize permitted ceiling and bearing-height parameters; do not casually relocate rooms to improve a score.

### Non-goals of the initial extension

The initial release is not a complete structural truss-design package, fabrication system, code-compliance certification system, generic BIM rewrite, or photogrammetric floor-plan reconstruction tool. It does not assume that a finished truss leaves its whole bounding volume empty. Do not modify existing manufactured trusses based only on this tool's ceiling study.

## 2. Actual Linecraft integration baseline

The inspected repository provides an offline Windows Electron application with original JavaScript ES modules, a Canvas 2D renderer, original polygonal 3D projection/picking, architectural-unit parsing, grouped Undo/Redo, JSON native files, and bounded exchange. It is not currently a React/Three.js application or an ACIS/NURBS solid-modeling system. [S1–S5]

| Existing file | Verified responsibility | Proposed integration |
|---|---|---|
| `core.mjs` | Geometry/command engine; exports `createEditor`; drawing settings, supported entity types, geometry limits | Register architectural commands and extend validated document persistence/transactions through a narrow adapter |
| `app.mjs` | Canvas application; calls `createEditor`; command catalog and UI state | Add an Architecture/Roof workspace, selected-room properties, candidate comparison, and regeneration status |
| `3d-view.mjs` | Original camera/projection/picking mathematics | Feed generated wall/roof/ceiling meshes through existing projection; add owner-aware picking and bounded section support |
| `units.mjs` | Existing length/angle parsing and formatting | Reuse architectural input and display; never introduce a second user-facing unit parser |
| `drawing-plane.mjs` | UCS/construction-plane math | Map the building's horizontal local XY frame to world XYZ |
| `paper-space.mjs`, `plot-document.mjs` | Paper/model mapping and vector output | Feed derived roof-plan/section entities into current plotting without changing physical scales |
| `package.json`, `desktop/package.json`, `desktop/dev-tools.cjs` | Packaging and test/build orchestration | Add packaged modules/assets and new test gates; inspect both package manifests before editing |

The current README calls dimensions nonassociative and 3D geometry mesh-based. Implement architectural dimension associations explicitly; do not assume editing dimension text already edits a wall. Existing 3D plotting is vector wireframe, not hidden-line/shaded plotting. New section or hidden-line features require their own implementation and tests. [S1]

### Integration policy

Do not replace Linecraft's UI, renderer, units, document model, or command workflow merely to add roofs. Use plain `.mjs` modules and JSDoc/type contracts consistent with the existing project. A new geometry dependency is allowed only after a bounded evaluation and license/build review.

No public-repository mutation or source implementation was performed while preparing this packet. Synthetic fixtures may be committed after review; client drawings must not be published as a fixture without explicit permission.

## 3. Authoritative architectural model

Introduce a versioned architectural section in the native document. The exact top-level schema migration must follow the existing loader's validation policy; do not append unrecognized fields and assume they survive save/load.

Proposed conceptual schema:

```text
architecture
  schemaVersion
  buildingFrame                 // horizontal local axes; world Z remains vertical
  levels[]                      // finished-floor datums
  wallNodes[]                   // shared stable junction IDs
  walls[]                       // source geometry, role, thickness, elevation constraints
  openings[]                    // linked to wall ID and station; not breaks in room topology
  rooms[]                       // room identity, interior boundary, ceiling program
  roofGroups[]                  // coverage, edge roles, pitch, overhangs, support constraints
  assemblies[]                  // roof/ceiling layers and reserved structural/service spaces
  constraints[]                 // typed and validated; no executable expressions
  acceptedAlternativeId
```

Core objects:

| Object | Required information |
|---|---|
| `Level` | Stable ID, name, finished-floor elevation, default wall/ceiling values |
| `Wall` | Stable ID, shared node references, reference-face choice, thickness, base, top/bearing elevation, support role, roof group, height locks |
| `Opening` | Host wall ID, station/width, sill/head elevations, type, conflict status |
| `Room` | Stable ID, label/anchor, bounded interior region, floor datum, current/target ceiling, ceiling type, allowed changes, priority |
| `RoofGroup` | Source boundary references, roof-end policy, selected gable edges if applicable, pitch setting, eave/rake overhang, assembly, maximum elevations |
| `RoofFace` | Derived planar polygon, plane equation, source-edge provenance, roof-group owner, surface role |
| `RoofEdge` | Derived endpoints, incident face IDs, semantic classification, drainage status |
| `CeilingEnvelope` | Derived allowable interior boundary, reservations, geometric confidence, supplier-verification status |

Distinguish structural bearing walls, exterior enclosure walls, nonbearing partitions, and unknown support roles. Unknown is not equivalent to approved support.

### Three different heights

Keep these independent:

1. **Room ceiling elevation:** the interior finish limit. Changing it should not automatically move the roof.
2. **Wall/bearing elevation:** a support condition that can require a different roof solution.
3. **Roof-surface/eave elevation:** the geometric roof datum after heel/assembly offsets and overhang slope are accounted for.

For an eave normal to a common-rafter direction:

```text
roof_surface_eave_z = bearing_z + heel_to_roof_surface_offset - pitch * horizontal_overhang
```

Here `heel_to_roof_surface_offset` is a declared assembly parameter, not a guessed universal truss heel. Gable rake overhang is different: extension along a horizontal ridge direction does not use the eave drop formula.

Raising a nonbearing partition to meet a new ceiling is not permission to turn it into a bearing wall. Shared walls and openings must update consistently when adjacent rooms differ in ceiling height.

### Source versus derived geometry

Persist architectural source objects and user decisions as the authority. Generate normal Linecraft-compatible plan entities and `MESH`/`POLY3D` representations through an adapter for display and exchange.

A picked generated object selects its owning architectural object. Editing a roof vertex directly must either create an explicit supported constraint or require deliberate detachment to ordinary meshes. Never retain a silently broken parametric link.

Derived caches are optional. They must include an input hash, schema version, kernel version, unit metadata, and validation state. A cache mismatch triggers regeneration, not acceptance as current geometry.

## 4. Dimensionally accurate plan authoring

Reuse existing LINE/PLINE, snaps, grips, ORTHO, UCS, and architectural length input. Add a wall tool and a conversion tool for selected, confirmed vector geometry.

A wall must declare whether its source path denotes centerline, exterior face, or another reference face. Thickness offsets must not move already dimensioned exterior faces unexpectedly. Preserve common junctions, T-junctions, and room identities.

Build room regions from architectural wall topology, not from painted pixels. Door/window openings belong to walls and must not accidentally destroy room enclosure. For room splits/merges, propose identity mapping and ask the user to resolve ambiguous labels/constraints.

Add a bounded architectural driving-dimension layer for horizontal/vertical spans and explicit wall moves. Preserve existing nonassociative drafting dimensions. A conflicting dimension produces a constraint diagnostic, not a hidden geometry adjustment.

Imported plan images are underlays only. A screenshot cannot establish exact dimensions. Require a reliable scale reference and user-confirmed tracing, or a dimensioned vector source. Do not infer missing dimensions from a client visualization.

### Units and tolerances

Keep saved source coordinates in the drawing's established model units. A worker adapter may convert an immutable snapshot into millimeters and translate it near a local origin; return results through the inverse transform. Never change the drawing's assigned units as a side effect.

A unitless drawing must acquire an explicit physical unit assignment before material or space analysis. Changing display format must not resize geometry.

Use physical, scale-aware tolerances. Proposed initial tolerances are 0.01 mm for geometric residuals and 0.001 degrees for orthogonality/pitch assertions, subject to benchmark review. Do not round accepted coordinates to display fractions. Do not silently snap inconsistent input to make the solver pass. Handle exact or robust predicates and simultaneous-event classification in the selected kernel.

V1 supports orthogonal footprints relative to a declared horizontal building frame. Rotating the entire building in world XY must not change the solution. Reject unsupported oblique/curved local edges explicitly until that scope is implemented.

## 5. Roof-generation kernel

### 5.1 First capability: equal-eave, equal-pitch hip roofs

Use an event-driven **straight-skeleton/wavefront** construction. Parallel offsets of the eave boundary sweep inward. Moving vertices trace hips/valleys; edge-collapse and split events determine the roof topology. Lift the skeleton into roof space using the selected pitch. This is an established computational-geometry basis for polygonal roof generation. [S6]

Do not implement roof generation as endless rays fired from original corners. That cannot by itself maintain event ordering and topology after wavefront edges disappear or a reflex vertex splits the active region.

Input sequence:

```text
Validate source -> derive declared roof coverage -> construct eave/rake boundary
-> validate offset topology -> solve roof -> classify actual faces/edges
-> triangulate for display -> validate coverage, slope, and drainage
```

A consistent overhang is a polygon-offset problem, not a bounding-box enlargement. Preserve reentrant notches and porches unless the user explicitly selects coverage that bridges them. If offsets close a narrow notch or merge separate roof groups, require a stated coverage decision; do not silently fill it.

For a common eave datum `e` and inward offset distance `d`:

```text
z = e + p*d
p = rise/12
rise = 1.0, 1.5, 2.0, ... , 12.0
```

There are 23 allowed rise choices. Store the pitch as the integer `riseTwice` from 2 through 24, so `p = riseTwice/24` and UI validation is unambiguous.

Handle edge events, reflex-vertex split events, parallel-front collapses, and simultaneous events as first-class cases. A deterministic sort is not enough: simultaneous events must be resolved geometrically as a batch. Keep provenance from original boundary segments through all changes.

Classify edges from actual incident-face geometry. Triangulation diagonals are not roof ridges. Do not force the roof graph into one final peak: valid roofs may have multiple maxima, horizontal ridges, or several connected branches.

### 5.2 Plane and angle rules

For a face generated by eave edge `i`, after activation:

```text
z_i(x,y) = e_i + p_i * dot(n_i, [x,y] - q_i)
```

`n_i` is the inward horizontal unit normal and `q_i` is a point on its eave line. Clip the plane to its legitimate swept region; the infinite plane is not globally valid over every part of a concave footprint.

For orthogonal equal-pitch adjacent faces, hip/valley segments between those sloping planes have 45-degree plan projections. Their XZ and YZ projected slope magnitudes are `p`. The slope measured along their actual horizontal diagonal is `p/sqrt(2)`, not `p`.

Do not snap intersections back to 45 degrees after solving. Validate that the computed result satisfies the rule when its assumptions apply. Do not apply it to gable rakes, unequal pitches, nonorthogonal footprints, vertical transition faces, or an arbitrary globally rotated XY basis.

### 5.3 Gable-end policy

The HIP preset gives the chosen boundary sloping hip-cap behavior. The GABLE preset requests gabled terminal ends, with selectable/confirmable end-edge chains and ridge orientations.

An irregular floor plan does not uniquely identify every gable end. Infer candidate wing ends and present a small set of alternative gable assignments. Keep the accepted assignment as stable semantic constraints. Do not label every perimeter edge a gable: that would leave no sloping roof fronts.

A gable is a vertical closure/non-advancing boundary in the relevant formulation, not a roof facet with the selected pitch. CGAL's extrusion API documents vertical-edge handling, but this differs from passing zero weights to its ordinary weighted-skeleton constructor. Backend parameter conventions must be tested explicitly. [S7]

Do not generate intersecting rectangular roof boxes and leave concealed overlaps. Any mass decomposition used to suggest ridge directions is a proposal mechanism; the accepted roof requires properly trimmed, validated surfaces.

The ALL_GABLE option must not silently become mixed-gable-and-hip merely because a selected arrangement is inconvenient. Report an unmet policy and offer another candidate. Explicit mixed roofs can be a later feature.

### 5.4 Different wall and eave heights

This is required for the full product, but it is a separate kernel milestone after equal-eave roofs pass.

Ordinary multiplicative weights generally control wavefront speed/pitch. Arbitrary starting heights require additive delays/activation heights or an equivalent validated plane/topology formulation. Additively weighted skeleton research specifically treats facets starting at different heights. Do not claim a multiplicatively weighted CGAL call alone solves this feature. [S8]

Using actual height `z` as the sweep parameter, a useful geometric specification for a sloping edge is:

```text
d_i(z) = max(0, (z - e_i) / p_i)
```

Before activation, the boundary remains stationary and can produce vertical closure portions. Explicit gable boundaries remain stationary. Maintain activation, split, collapse, and simultaneous events; do not compute unrestricted global minima or maxima of every eave plane.

Different support heights can shift ridges, change roof topology, remove a facet, or require a vertical step/roof-to-wall junction. The algorithm must revalidate coverage and source support constraints after every such event. A wall line consumed before its prescribed bearing condition is met is a conflict, not a successful support solution.

The vertical closure geometry returned by a generalized kernel is not automatically a structural wall. Overhangs place roof boundaries outside wall faces. Map closure, fascia, rake, support, and step-flashing geometry to their actual roles.

Simple independent two-slope test, with width `B`, equal pitch `p`, and left/right eave heights `eL`, `eR`:

```text
ridge_x = B/2 + (eR-eL)/(2*p)
ridge_z = (eL+eR+p*B)/2
```

At 4:12, a 2-foot height difference shifts the ridge 3 feet toward the higher eave. If `ridge_x` lies outside the permitted span, reject that topology or propose a defined stepped alternative. Never stretch the old ridge mesh to conceal the conflict.

### 5.5 Backend decision gate

Expose a stable kernel contract independent of any one library. Evaluate a scoped original orthogonal implementation versus a license-approved packaged backend using the same tests. Do not import an unfamiliar library directly into the application state layer.

CGAL supplies a useful reference implementation and documented extrusion capabilities. Its straight-skeleton package is GPL, and CGAL also offers commercial licensing. Linecraft's original application code is MIT. Review the intended distribution before embedding or shipping such a dependency; do not assume a WASM wrapper, DLL, or process boundary settles the license obligations. [S2, S9]

The selected backend must work offline in the packaged Windows application. Benchmarks must include symmetric H cases and invalid geometry, not just a rectangle screenshot. Variable-height support must be demonstrated separately from baseline hip support.

## 6. Geometry and drainage validation

Return separate status fields for geometry, drainage, clearance, and structural/supplier review. A geometrically valid conceptual roof is not an engineered framing approval.

Validation includes:

- Finite bounded coordinates, valid input loops, declared component/hole policy, no zero-area faces, and consistent winding.
- Face-planarity and pitch residuals within physical tolerances; shared edges coincide in XYZ; generated surfaces cover their declared roof domains without unintended holes or overlapping sheets.
- A manifold closed shell when a closed wall/roof assembly is requested. A roof skin alone legitimately has eave boundaries; do not reject it for not being a closed solid.
- Actual slope-direction classification: ridges shed to both sides; valleys collect into a longitudinally descending path; coplanar subdivisions carry no hip/valley semantics.
- Every nonzero-area runoff catchment reaches an approved boundary outlet. Build a drainage graph from face gradients and valley/channel transitions, not just sparse samples or illustrative arrows. Reject positive-area sinks, reverse-fall valleys, closed drainage loops, unintended internal gutters, and zero-fall water-collecting seams.
- Downstream receiving surfaces and wall interfaces must remain valid after roof-group composition. A valid independent roof can become invalid when combined with another mass.
- Approved outlets may include an explicitly designed open court; an open recess is not an indoor basin. Internal roof drains and enclosed courtyard drainage are outside V1 unless explicitly modeled.
- Roofing-system pitch compatibility is a declared assembly constraint. The geometric input range 1:12–12:12 is not permission to apply every roof product at every pitch.

Drainage validation here is geometric. Gutter/downspout hydraulic sizing, weather exposure, snow, and connection engineering are separate design checks.

## 7. Interior-space analysis

### 7.1 Separate geometric potential from verified buildable space

The visible roofing surface is not a ceiling. Deduct roof layers, required insulation/ventilation/service zones, ceiling finish, and a declared structural reservation envelope. A conceptual envelope must be labeled unverified until supported by an actual framing/truss solution.

Report at least:

```text
Roof-envelope potential
Space after declared assembly/reservation assumptions
Supplier/engineer-verified usable space, when such information exists
```

A conventional truss bounding box is not empty space. A reservation must account for the intended bottom chord, webs, heel, bearings, and clearances; otherwise the analysis is only a design brief for a supplier.

For layers of combined thickness `t` measured normal to a plane of slope `p`, the vertical separation at the same XY location is `t*sqrt(1+p*p)`, not simply `t`. Treat structural webs and service exclusions as geometric reservations, not as a universal thin offset.

### 7.2 Two user modes

**Fit ceilings inside the accepted roof.** Freeze exterior roof geometry and roof support heights. Compute safe conceptual ceiling alternatives beneath it. This should be the default and the first optimization milestone.

**Co-design roof and room heights.** Let the user select which wall/bearing groups, ceiling targets, pitch choices, or end assignments may change. Regenerate complete alternatives and compare them. Footprint remains fixed unless explicitly unlocked.

A raised ceiling must not raise the roof automatically. Conversely, a changed exterior bearing height must not leave a stale roof labeled current.

### 7.3 Room calculations

For a room interior polygon `R`, finished-floor datum `f`, and allowable finish-ceiling upper boundary `c(x,y)` after reservations:

```text
Maximum flat ceiling elevation = min c(x,y), for (x,y) in R
Maximum flat clear height = that elevation - f
```

Intersect the room with all relevant roof/clearance facets. For a piecewise-planar envelope, evaluate the resulting cell vertices, including new intersections, for exact piecewise-linear extrema. A coarse grid or average roof height is not an acceptable flat-ceiling limit.

Support ceiling candidates in stages: flat first; then tray, mono-vault, gable-vault, and bounded roof-following ceiling models. Keep the geometry simple and explicit, but do not add a cost penalty just for a complex truss. The ceiling slope need not equal the roof slope.

For a proposed valid ceiling `zC(x,y)`:

```text
V_room = integral over R of (zC(x,y) - f) dA
```

Reject ceilings below required room heights instead of hiding negative clearance in the integral. For a triangulated linear ceiling, integrate each triangle exactly as plan area multiplied by mean vertex height above the floor.

Provide room-by-room current/minimum/maximum heights, proposed ceiling type, recoverable volume, area above user-selected headroom thresholds, limiting location/obstacle, assembly assumptions, and verification status. Clip against openings, stairs, high-level windows, and reservations where modeled.

User headroom thresholds are design inputs, not a statement of adopted building-code requirements. Additional usable floor area requires its own floor, structure, access, and compliance model; ceiling volume alone is not a new habitable story.

## 8. Material and spatial optimization

### 8.1 Important roof-area invariant

For a single nonoverlapping roof skin covering the same horizontal domain `D`, with every roof facet at common pitch `p` and vertical closure surfaces excluded:

```text
A_roof = A_D * sqrt(1+p*p)
```

This follows directly by integrating `sqrt(1+|gradient z|^2)` over the roof's plan projection. Thus, merely rearranging hips and valleys does not reduce net sloped roof area when projected coverage and pitch are unchanged. At 4:12 the multiplier is about 1.054092553.

Differences can still occur in cutting waste, cap/valley/flashing lengths, wall/soffit/gable areas, framing quantities, and useful volume. Multiple overlapping roof layers, changed coverage, different pitches, or vertical surfaces fall outside that simple invariant.

Use this as an anti-bug test. A claimed large sheathing-area saving solely from subdividing the same-pitch skin differently is suspect.

### 8.2 Quantity model

Track separate quantities rather than inventing one score from unlike units:

| Quantity | Treatment |
|---|---|
| Net roofing/sheathing surface area | Compute from actual accepted facets |
| Sheet/panel purchase quantity | Exact bounded layout study when available; otherwise a declared waste assumption and confidence label |
| Hip/ridge cap, valleys, eaves/rakes, roof-to-wall flashings | Compute actual material-relevant edge lengths; no arbitrary complexity surcharge |
| Fascia, soffit, exterior walls/gables, interior wall and ceiling finish | Compare actual changed areas/lengths |
| Insulation and assembly quantities | Derive from declared assemblies, not generic guesses |
| Truss/framing lumber/connectors | Unknown or supplier-derived until a justified structural model/quote exists |
| Truss design/manufacturing complexity surcharge | **Zero** |

Do not equate triangulation count with material use. Do not claim complete cost optimization while a major material category is unavailable.

### 8.3 Bounded search and transparent alternatives

Respect locked footprint, allowed height ranges, maximum ridge/building height, minimum room clearances, chosen materials/pitches, support groups, porch policy, and immutable rooms/openings.

Use room targets or capped benefits so the optimizer does not keep making the whole building taller merely to maximize cubic feet. Score satisfying requested room heights more highly than unused excess height unless the user changes that preference.

Produce a Pareto comparison: alternatives not dominated on all considered goals. Suggested views are least quantified material for requested room targets, most useful volume under a material limit, and a user-selected compromise.

When actual prices are provided, compare itemized cost. Otherwise show quantities and normalized objective components separately. Never add square feet, cubic feet, and linear feet directly into an unexplained scalar.

Search discrete roof-end assignments, permitted pitch increments, and permitted bearing-height changes, followed by local refinement of ceiling parameters. Cache by input hash and reject invalid solutions before ranking. Expose searched ranges, candidate counts, unresolved structural assumptions, elapsed time, and stopping reason.

Call the result **best found within the stated search**, not a proven global minimum unless a particular search genuinely establishes that result.

## 9. Proposed module boundary

Add a cohesive extension folder rather than thousands of new lines in `core.mjs`:

```text
architecture/
  model.mjs                 source schema, validation, migration helpers
  units-adapter.mjs         reversible physical-unit/local-frame conversion
  plan-topology.mjs         wall junctions, room boundaries, stable identity mapping
  wall-geometry.mjs         wall/opening meshes and top profiles
  roof-boundary.mjs         roof coverage, offsets, eave/rake/support mapping
  roof-kernel.mjs           backend-neutral validated contract
  roof-hip.mjs              equal-eave straight-skeleton path
  roof-gable.mjs            candidate end policy and vertical-boundary handling
  roof-height-events.mjs    additive activation/stepped-height capability
  roof-validate.mjs         coverage, topology, slope and drainage validation
  clearance.mjs             allowable ceiling geometry and reservations
  ceiling-candidates.mjs    explicit flat/tray/vault models
  quantities.mjs            areas, lengths, declared waste/material calculations
  optimize.mjs              bounded candidate generation and Pareto selection
  dependencies.mjs          invalidation, revision/hash, recomputation policy
  editor-adapter.mjs        commands, transactions, generated entity ownership
  view-adapter.mjs          current renderer/picker integration
  sections.mjs              actual model intersections and annotations
  report.mjs                room and alternative reports
  roof-worker.mjs           bounded asynchronous solver/optimization jobs
```

The names describe proposed responsibilities, not files already found in the repository. Modules may be consolidated where that makes sense, without collapsing the source/solver/UI boundaries.

Proposed pure interface, not an existing API:

```javascript
/** @typedef {'ok'|'needs-decision'|'infeasible'|'unsupported'|'failed'} SolveStatus */

/**
 * @param {RoofInputSnapshot} input - immutable, physically normalized input
 * @param {SolveControls} controls - limits, tolerances, cancellation/progress interface
 * @returns {Promise<RoofSolveResult>}
 */
export async function solveRoof(input, controls) { /* selected backend */ }

// Result includes: status, requestId, inputRevision, inputHash,
// kernelVersion, geometry, provenance, diagnostics, and validation.
// No solver function mutates the Linecraft editor or reads DOM state.
```

For browser Workers, implement cancellation via message/worker lifecycle; do not assume an AbortSignal is transferable. Validate inbound/outbound data, cap polygon/entity counts and candidate budgets, disallow executable expressions, and use local packaged assets only.

## 10. Live editing, persistence, and commands

### Regeneration and Undo/Redo

Use immutable input snapshots and asynchronous workers for expensive work. Each result carries the input revision/hash. Discard stale results after another edit, document switch, undo, or redo.

Dragging may display a clearly labeled fast preview. Perform the validated solve after a short debounce or release. A single completed gesture must make one undoable source transaction, not hundreds of derived-mesh edits.

If a new input is infeasible, preserve the new source edit and show the last valid roof only as **stale**, with its matching revision identified. Exclude stale geometry from current quantities/export. Alternatively, offer an explicit undo/revert; never silently restore source dimensions.

Source changes mark downstream derived data dirty. Ceiling-only edits invalidate ceiling/quantity/report data but leave fixed exterior roofs unchanged. Bearing or footprint edits invalidate roof topology and every dependent analysis. A display-style change invalidates only rendering.

Generated IDs should be stable while topology is stable, using source-edge provenance and semantic identity. If a pinned ridge disappears, return an orphaned-constraint diagnostic rather than attaching the lock to an arbitrary nearest edge.

### Proposed command surface

| Command | Purpose |
|---|---|
| `WALL` | Draw architectural walls using existing coordinate input |
| `WALLFROM` | Convert selected confirmed paths to walls with explicit reference face |
| `WALLHEIGHT` | Edit chosen partition/support heights with locks and role-aware consequences |
| `ROOM` | Recognize/label a room and set floor/ceiling intent |
| `ROOF` | Create a roof group; choose HIP or GABLE and initial constraints |
| `ROOFPITCH` | Set an allowed half-rise pitch increment |
| `ROOFUPDATE` | Force validated regeneration |
| `ROOFSPACE` | Analyze usable ceiling envelope and limiting locations |
| `ROOFOPTIMIZE` | Compare bounded material/space alternatives |
| `ROOFSECTION` | Cut a dimensioned model section |
| `ROOFREPORT` | Export room and candidate assumptions/quantities |
| `ROOFDETACH` | Deliberately copy/detach generated geometry to ordinary editable entities |

Add menu/ribbon access, not just command-only functionality. Keep the command reference honest about supported options.

### Review workspace

Provide synchronized plan and 3D views, room selection, roof transparency/cutaway, section sliders or section lines, actual computed drainage arrows, and source/derived status. Use the existing camera/picking system first. New clipping and section capabilities require explicit development; do not treat them as already present.

Expose roof type, pitch, eave/rake overhang, assemblies, eave/ridge limits, fixed-roof/co-design mode, allowed changes, and zero truss-complexity surcharge in the properties/report model.

Compare a few candidates side by side and permit Apply as one undoable action. A live preview must not silently replace an accepted alternative.

### Exchange

The native file retains semantic source. Roof plans, sections, and derived 3D meshes can be exported through supported Linecraft paths after validation. DXF export does not preserve the new architectural relationships automatically; give a clear flattening warning.

Do not promise native DWG writing, fabrication exports, hidden-line PDF, or full BIM interoperability as part of the baseline. Add each separately if requested and tested.

Update build file allowlists, worker paths, hash/resource checks, and packaged app tests. Passing in `npm run dev` is not evidence that a worker or geometry backend is included in NSIS.

## 11. Implementation sequence with acceptance gates

### R0 — Integration and kernel feasibility

Inspect the current local repository/branch and changes. Run existing tests without altering scope. Record actual baseline failures rather than attributing them to the roof extension. Identify document validation/serialization/undo hooks. Establish kernel contract, units/tolerances, license path, and synthetic fixture format.

**Gate:** reproducible baseline; extension source survives native save/load and undo in a synthetic test; at least two backend feasibility results or a justified original-kernel decision; no regression in old-document loading.

### R1 — Accurate architectural walls and rooms

Implement source walls, junctions, role-aware heights, simple openings, room regions, and mesh adapters. Preserve precise architectural input and reference faces.

**Gate:** a dimensioned rectangle with interior partitions renders at correct XYZ, wall edits update shared topology, native round-trip preserves semantics, and Undo/Redo restores the model. No roof work is needed to pass this gate.

### R2 — Equal-height hip roofs: first roof-engine milestone

Implement constant-pitch hip roofs for bounded orthogonal simple polygons with no enclosed holes. Rectangle, L, T, and H fixtures must pass coverage, topology, slope, and runoff tests. Open U/H recesses are supported; enclosed courtyards are a separate feature.

**Gate:** the analytic H fixture in this packet passes without manual roof vertices. Footprint edits regenerate and stale results never overwrite new source. No photorealistic screenshot can substitute for geometry assertions.

### R3 — Fixed-roof room-space study

Implement declared assemblies/reservations, exact flat-ceiling limits, room volume, and dimensioned sections. Add tray/vault candidates after flat-ceiling tests pass.

**Gate:** a selected room can gain ceiling height under a frozen exterior roof while respecting every modeled reservation. The application reports limiting coordinates and unverified framing assumptions. Exterior roof vertices remain unchanged.

### R4 — Gable assignments

Implement terminal-end inference/selection and confirmed gable constraints. Test rectangles in both ridge directions, then cross-gable and H examples where the declared topology is supported.

**Gate:** the option does not silently create hip caps, coverage is complete, and gable closures/rake overhangs are distinguished from sloping roof surfaces.

### R5 — Different wall/bearing heights

Implement additive-height activation or an equivalent verified backend, step interfaces, source support checks, and topology-change diagnostics.

**Gate:** opposing-plane analytic tests, varying-height corner cases, and ridge migration pass. Impossible constraints report infeasible rather than producing twisted faces. Return-to-baseline elevations reproduces the baseline topology/geometry within tolerance.

### R6 — Material/space alternatives

Implement bounded search, capped room benefits, material quantities, Pareto comparisons, report confidence, and Apply/Undo.

**Gate:** no truss-complexity cost enters ranking; the same-pitch area invariant holds; a partial material model is labeled partial; recommendations identify their search bounds and actual assumptions.

### R7 — Real-plan qualification and packaged release

Use a dimensioned client source only after its dimensions, boundary interpretation, levels, covered porches, and support roles are confirmed. Keep it private unless explicitly authorized. Test workers/backend resources in the unpacked executable and Windows installer.

**Gate:** plan dimensions, measured 3D/sections, recomputation, native round-trip, exports, and undo work in the packaged app. Report actual executed tests and remaining unsupported cases. Do not publish a success claim merely because code was written.

Performance goals, not measured claims: for an agreed residential fixture up to roughly 200 roof-boundary segments and 100 rooms, aim for sub-second ordinary validated regeneration and interactive orbit on a named reference Windows machine. Candidate search may take longer and must support progress/cancel and a configurable time budget. Set numerical performance thresholds only after the baseline measurements.

## 12. Acceptance-test matrix

| Test | Required result |
|---|---|
| All 23 pitch settings | Exact input validation; facet slope agrees with selected pitch |
| Inch/foot/mm/m documents | Identical physical roof and volume after conversion |
| Display-format change | No source or derived dimensional change |
| Rotation/translation invariance | Same physical roof after transforming back to building-local coordinates |
| Rectangle/L/T/H | Valid coverage, adjacency, plane slopes, event handling, runoff |
| Symmetric simultaneous events | Deterministic valid graph; no zero-area sliver patches |
| Narrow recess / overhang closure | Explicit coverage decision, not silent filling |
| Duplicate/self-intersecting/dangling source | Actionable diagnostic; no mutation of accepted geometry |
| H connector shallower/equal/deeper than wing | Correct topology change; no assumption that one ridge pattern fits all |
| Flat-ceiling limit | Minimum over clipped room cells, not average or grid-only estimate |
| Roof/ceiling layer thickness | Correct normal-to-vertical conversion and reservation exclusion |
| Ceiling-only edit | Exterior roof remains fixed |
| Bearing-height edit | Ridge/topology regenerates and support constraints are revalidated |
| Infeasible ceiling or support target | Named limiting constraint; no geometric fabrication |
| Gable ends | No arbitrary sloped hip substituted for requested terminal gable |
| Basin/reversed valley injected into test mesh | Geometric drainage validator rejects it |
| Equal pitch and same single-skin coverage | Net roof area invariant holds across valid topologies |
| Missing framing material model | No complete-cost or verified-clearance claim |
| Source edit, undo, worker result race | Old result cannot overwrite current revision |
| Native migration / unsupported future schema | No silent loss of architectural source |
| Detach/export | Explicit loss of association; exported geometry corresponds to current valid revision |
| Installed application offline | Worker/backend included; no runtime CDN/API dependency |
| Existing drafting/layout/scale/export tests | No unacknowledged regressions |

### Analytic H reference

Building-local coordinates in feet; all vertices listed counterclockwise:

```text
Wall/reference footprint:
(0,0), (20,0), (20,16), (44,16), (44,0), (64,0),
(64,60), (44,60), (44,44), (20,44), (20,60), (0,60)
```

The side wings are 20 × 60 feet. The connector spans the 24-foot gap with 28-foot north/south depth. Use a 2-foot mitered overhang, 4:12 pitch, and a geometric eave-surface datum of 9 feet 4 inches.

Expected results:

```text
Wall/reference footprint area: 3072 sq ft
Roof/eave projected area: 3712 sq ft
Wing ridge elevation: 13 ft 4 in
Main ridge elevation: 14 ft 8 in
Main ridge endpoints in plan: (14,30) and (50,30)
Main ridge length: 36 ft
Four wing-ridge segments: 16 ft each
Eight outer hips; four valleys; four rising transition hips
Twelve roof facets before triangulation
```

The packet's JSON fixture includes every analytic node and segment. These are independent expected values, not output from an implemented Linecraft roof engine. The separate verification report checks the supplied analytic graph/planes/areas; it does not establish that Linecraft currently passes these tests.

The roof-surface datum at the wall reference line is 10 feet for this geometry fixture. Do not interpret that as a certified ceiling height, top-plate height, or real truss heel. An actual assembly must establish those independently.

## 13. Delivery discipline for the implementation thread

For each milestone, return the branch/commit, changed files, commands executed, actual automated test results, GUI actions actually verified, packaging results actually observed, unsupported cases, and the next smallest task. Keep mathematical validation, scripted UI tests, and visible/physical interaction claims separate.

Do not silently fix unrelated projects or mix an unfinished broad CAD rewrite into this extension. Do not force an unverified roof onto a plan for the sake of a successful image. Preserve a reproducible checkpoint at every gate.

### Paste-ready instruction

> Implement this as an extension of the existing Linecraft CAD repository, not a replacement application. Inspect the actual local checkout and read this complete handoff before editing. Preserve current ES-module architecture, units, drafting commands, 3D camera/picking, native persistence, layouts, and grouped Undo/Redo. Add a semantic architectural source model and deterministic roof/ceiling derivation. Start with R0, R1, and R2: exact walls/rooms, then a general equal-eave 4:12 hip-roof solution that passes the rectangle/L/T/H analytic tests without hard-coded roof vertices. Keep ceiling elevation separate from bearing elevation. Later milestones must add fixed-roof ceiling recovery, gable assignments, variable bearing heights, and bounded material/space alternatives. Set the truss-design/manufacturing-complexity surcharge to zero; keep actual material quantities and physical feasibility explicit. Do not report implemented, tested, packaged, or structurally verified capabilities without corresponding evidence.

## 14. Compact project decision record

**Subject:** Linecraft Roof + Space extension.  
**Secondary tags:** CAD; parametric roofs; wall/room topology; straight skeleton; volume optimization; material quantities.  
**Strength:** 5/5 for reusable product requirements; implementation remains proposed and numerical robustness must be demonstrated.  
**Best reusable insights:** one authoritative parametric model; ceilings and bearings are different controls; geometric roof area is invariant at fixed single-skin coverage/pitch; truss-complexity surcharge is zero; unverified roof volume is not verified framing clearance.  
**Action items:** hand the packet to the Linecraft implementation thread; inspect local baseline; complete R0/R1/R2 before broader optimization.  
**Saved-memory treatment:** durable project decisions are suitable for a later approved project memory; this packet does not claim they were saved.  
**Suggested archive:** `Linecraft / Architecture / Roof + Space`; future repository document path listed at the start.

## 15. Sources and inspected evidence

Source descriptions support existing-project and algorithm facts. Proposed file names, interfaces, objectives, milestones, and numerical test calculations are the design in this handoff, not claims that those features already exist.

- **S1 — Linecraft README:** offline application, existing capabilities, mesh/exchange/plotting limitations, units, test/release workflow. `https://github.com/MrOweItAll/linecraft-cad/blob/40c45886f1e2b81efb10523d8c8690ec1af3ac0b/README.md`
- **S2 — Linecraft package manifest:** package version, original code license, Electron entry point, scripts, build allowlist. `https://github.com/MrOweItAll/linecraft-cad/blob/40c45886f1e2b81efb10523d8c8690ec1af3ac0b/package.json`
- **S3 — Linecraft app entry:** `createEditor`, Canvas context, command catalog and UI state. `https://github.com/MrOweItAll/linecraft-cad/blob/40c45886f1e2b81efb10523d8c8690ec1af3ac0b/app.mjs`
- **S4 — Linecraft 3D module:** original projection/picking mathematics; no external rendering engine. `https://github.com/MrOweItAll/linecraft-cad/blob/40c45886f1e2b81efb10523d8c8690ec1af3ac0b/3d-view.mjs`
- **S5 — Linecraft core and native example:** current entity/unit boundaries and `Linecraft/1` file context. `https://github.com/MrOweItAll/linecraft-cad/blob/40c45886f1e2b81efb10523d8c8690ec1af3ac0b/core.mjs` and `https://github.com/MrOweItAll/linecraft-cad/blob/40c45886f1e2b81efb10523d8c8690ec1af3ac0b/samples/layouts-inch-v16.linecraft`
- **S6 — CGAL straight-skeleton user manual:** inward wavefront interpretation, events, polygon regions, and roof extrusion. `https://doc.cgal.org/latest/Straight_skeleton_2/index.html`
- **S7 — CGAL skeleton extrusion API:** mesh output and edge-weight/vertical-extrusion parameter distinctions. `https://doc.cgal.org/latest/Straight_skeleton_2/group__PkgStraightSkeleton2Extrusion.html`
- **S8 — Held and Palfrader:** *Straight Skeletons with Additive and Multiplicative Weights and Their Application to the Algorithmic Generation of Roofs and Terrains* (2016); activation delays versus speeds. `https://arxiv.org/abs/1604.03362`
- **S9 — CGAL licensing:** straight-skeleton package license and commercial-license context. `https://doc.cgal.org/latest/Straight_skeleton_2/group__PkgStraightSkeleton2Ref.html` and `https://www.cgal.org/license.html`

External sources were checked October 15, 2026. Select and pin the actual backend version during implementation; this document does not establish that a particular backend is installed or compatible with the user's Windows checkout.
