# Linecraft CAD

Linecraft is an independent offline Windows CAD application for 2D drafting, paper layouts and polygonal 3D modeling. It includes an original command line, drawing canvas, ribbon, layers, properties, snaps, grips, grouped Undo/Redo, native drawing files, bounded model-space DWG/DXF import, DXF export and vector PDF output.

Download the Windows x64 installer from [GitHub Releases](https://github.com/MrOweItAll/linecraft-cad/releases/latest). The unsigned installer includes its own Electron runtime; a browser, Node.js and Autodesk installation are unnecessary for using the application.

## Generated roof and closure PDF output

Version 1.12.2 plots the freshly validated architectural geometry rebuilt from native source. Generated hip/gable roof skins and separate vertical gable closures now enter model-space plots and scaled paper viewports through the existing vector pipeline. Native files continue to store authoritative source rather than cached mesh vertices. Plotting preserves the saved model view, camera, layouts, viewport scales and drawing history.

Layer plot flags, model/paper visibility, per-viewport frozen layers, clipping, color, linetype and paper lineweight still apply. Pending or infeasible roof groups are excluded with an explicit plot warning. The [original analytical fixture](samples/roof-plot-v1122.linecraft) has no ordinary model geometry: its generated 40-by-20-foot gable is shown at 1:96 and 1:48 in A3 plan/elevation sheets, with a separate frozen-layer negative sheet. The independent optional PDF reader measures actual vector positions and lengths rather than accepting preview metadata.

3D PDF output remains vector wireframe; shaded faces and hidden-line removal are unsupported. Zero-thickness mathematical surfaces, separate ceiling/bearing elevations, explicit reservations and both zero truss surcharges remain unchanged. Geometry/PDF checks do not certify framing or structural feasibility.

## Structured scripting of the open drawing

Version 1.12.1 adds opt-in local scripting to this same R4 application. Read copied object IDs and a drawing/session token, preview a bounded structured revision, then Apply once to the existing editor. Atomic validation, grouped Undo/Redo, existing units, layouts and semantic roof ownership remain in use. Rejected or unfinished steps leave the current drawing unchanged. Retries use a bounded in-memory request-ID cache; stale drawing/session tokens require a fresh review.

Ordinary launches leave local control disabled. An explicit connection-file flag starts an authenticated ephemeral endpoint on 127.0.0.1; browser-origin requests and arbitrary JavaScript/shell evaluation are rejected. Native Save/Open/PDF keep the existing application controls and file validation. See the [scripting guide](docs/SCRIPTING.md) and [original schema-4 review fixture](samples/scripting-v1121.linecraft). The guide distinguishes engine/loopback checks, hidden Windows automation and visible installed review; pipeline configuration alone is not evidence that a release was tested.

## Roof + Space preview (R0–R4)

Version 1.12 extends this same application with semantic walls, hosted openings, rooms, roof groups, assemblies and bounded source constraints. Open Architecture in the existing interface. Convert a selected orthogonal closed path into face-referenced walls, recognize rooms, edit an axis span, and generate an equal-eave hip roof from the exterior wall loop or a captured footprint. Rectangle, L, T and H starters provide footprint vertices only; the original kernel generates the roof vertices. Existing camera, picking, drafting units, layouts and grouped Undo/Redo remain in use.

The [original H example](samples/roof-space-H-v19.linecraft) includes walls, a hosted door, room ceiling intent, a generated 4:12 hip roof and two scaled A3 review viewports. The analytical fixture is an independently supplied expected graph; regression tests run the actual generator and independently check face coverage, topology, area, shared edges and runoff. The handoff's earlier self-consistency check is not a runtime test.

Architectural drawings save authoritative source as `Linecraft/2`, with `architecture.schemaVersion=4`; schemas 1, 2 and 3 migrate explicitly without changing prior physical values. Gable assignments default to absent and existing HIP roofs remain HIP; generated meshes are rebuilt on Open and Undo/Redo. Version 1.12 also reads ordinary `Linecraft/1` files. Earlier architectural releases reject unsupported newer schema versions instead of discarding their fields. Older releases reject the new format instead of silently dropping semantic source. Keep an original copy when using this preview. Generated meshes select their semantic owner and reject ordinary direct edits. `ROOFDETACH` explicitly copies selected generated geometry into ordinary editable objects while retaining authoritative source; the copies are excluded from architectural quantities.

R0–R2 is bounded to simple orthogonal plans with open recesses and no enclosed holes, equal eave and common pitch. The kernel permits at most 48 roof edges plus explicit event/patch/validation budgets. Closing recesses through overhangs and overlapping unresolved roof groups require a coverage decision. Wall quantities are nominal at butt-overlapping T junctions. Semantic building-frame rotation is supported; converting already rotated drafting paths can reject tiny floating-point departures from exact local orthogonality. Accepted coordinates are not silently snapped. The existing shaded painter renderer can show internal or behind-surface mesh edges; hidden-line display has not been added.

R4 adds confirmed terminal-end assignments for equal-bearing, equal-pitch orthogonal **GABLE** roofs. In **Architecture → Roofs**, choose a complete terminal-end alternative and explicitly confirm it before Apply; a suggestion never becomes an accepted assignment automatically. A rectangle offers two opposed-end choices. Supported cross/H terminal configurations are generated from their footprint, without manually placed roof vertices. Eave and rake overhangs are separate. Unordered-endpoint geometric edge keys survive cyclic start and reversed boundary order; changed footprint endpoints require review instead of assigning a new edge by index. Mixed gable/outer-hip caps, enclosed holes and variable bearing elevations remain unsupported in this milestone.

The solver validates roof coverage, pitch, shared-edge topology and approved-eave runoff before returning a current skin. Vertical gable closures are separate zero-thickness surfaces owned by the same roof group; they do not enter the sloping clearance envelope or roof-layer material volume. Reports separate sloping surface area, closure area and eave/rake lengths. Ceiling/tray edits preserve the accepted roof geometry and bearings, and gable conversion supports grouped Undo/Redo and source-only native Save/Open. The model remains zero thickness by default, with optional entered offsets and retained reservations. See the [R4 guide](docs/roof-space/R4-GABLE.md), [gable decision](docs/roof-space/ADR-004-gable.md) and [source-only gable example](samples/gable-v112.linecraft).

Ceiling elevation, bearing elevation and declared heel offsets are distinct. Open **Architecture → Space study**, or type **ROOFSPACE**, to evaluate current and target flat ceilings beneath the existing roof. The default mathematical model uses zero-thickness roof and ceiling surfaces. Optional normal roof offsets, vertical ceiling offsets, minimum height, headroom threshold and local-axis reservation boxes determine its bounded envelope. The calculation integrates clipped room/facet cells, reports limiting coordinates, maximum flat elevation, usable flat volume and headroom area, and rejects infeasible targets. A missing assembly uses the explicit zero-thickness mathematical surface model and supports flat/tray calculation and Apply. Physical framing verification is reported separately and does not block mathematical feasibility. Applying a feasible ceiling is one grouped Undo operation and leaves roof geometry, bearing elevations, camera and layouts unchanged. **ROOFSECTION** creates dimensioned X/Y section snapshots as ordinary editable objects. See the [R3 guide](docs/roof-space/R3-SPACE-STUDY.md), [clearance decision](docs/roof-space/ADR-002-clearance.md) and [original 240 ft² room example](samples/ceiling-space-v110.linecraft). Geometric surface/wall quantities remain physical; prefabricated-truss design and manufacturing-complexity surcharges are exactly zero. Framing lumber, connectors, load paths and physical feasibility remain unverified or unknown, and clearance reservations are retained. This preview does not certify framing or code compliance.

R3 supports flat ceilings and one bounded rectangular stepped tray under one covering roof skin per room, at most 256 room vertices, 1,024 roof triangles, 128 reservations and 4,096 clipped cells, with an explicit intersection-work budget. Results are mathematical space beneath the fixed surfaces, modified by optional entered offsets and preserved reservation boxes. Unmodeled truss webs/chords, connectors, services, stairs and access remain outside physical verification. General tray polygons, multiple plateaus, sloped or vaulted ceilings, variable bearing heights and bounded material/space alternatives remain subsequent milestones. Section snapshots require regeneration after edits. No unimplemented analysis is presented as a result. See the [implementation handoff](docs/roof-space/IMPLEMENTATION_HANDOFF.md) and [integration decision](docs/roof-space/ADR-001-integration.md).

The **Space study → Tray ceiling** controls store a proposal separately from the accepted ceiling. The first tray has one building-local XY rectangular plateau strictly inside the room, a lower flat band and ideal vertical returns. Exact cell clipping checks complete rectangle containment, every positive-area ceiling region and the closed return interface. It reports conditional volume, headroom, horizontal finish area and return finish area, limiting coordinates, maximum raised elevation and signed volume change against the actual accepted flat or tray profile. Apply is one grouped Undo operation; lowering the proposal does not silently lower the accepted ceiling. Roof vertices/faces, bearing elevations and the floor remain unchanged. Section snapshots follow the actual accepted profile; an unaccepted proposal does not alter them. See the [tray guide](docs/roof-space/TRAY-STUDY.md), [tray decision](docs/roof-space/ADR-003-tray.md) and [original tray example](samples/tray-ceiling-v111.linecraft).

Tray returns have exactly zero thickness and zero material volume in this explicit mathematical model; their surface area is retained. Optional roof-normal and vertical ceiling offsets remain supported. Opening an existing drawing preserves all entered offsets and reservation boxes. **Use zero thickness** explicitly clears only the selected roof offsets and selected room ceiling offset in one grouped Undo operation; it preserves reservations, roof geometry, bearings, floor and accepted ceiling intent. Incomplete coverage, unsupported topology or an infeasible current profile cannot establish recovered mathematical space. The first tray is bounded to 4,096 source cells, 20,480 profile cells and 2,000,000 charged work units. Mathematical feasibility is independent of physical framing verification; framing and code compliance are not certified.

## Paper layouts and physical scales


Version 1.8 adds grouped Architectural, Engineering and paper:model ratio choices to both the bottom viewport picker and Properties. For example:

| Paper inches per model foot | Physical denominator |
| --- | --- |
| 1/16 inch | 192 |
| 3/32 inch | 128 |
| 1/8 inch | 96 |
| 1/4 inch | 48 |

These are physical scales: an inch model uses 25.4 millimeters per model unit, while a meter model uses 1000. Changing the scale leaves model geometry, the paper frame and the model center unchanged. Both controls derive the same label from the saved denominator. The Engineering choices are convenient feet-per-paper-inch presets; a drawing's editable native scale list may differ.

Custom scale accepts a positive denominator, a paper:model ratio such as 1:96, or physical equality such as 1/8" = 1'-0". The preview does not edit the document; Apply makes one undoable change. Custom denominators retain their stored precision rather than snapping to a nearby preset. Select a scale, then lock the viewport. Locked scale controls stay readable and are disabled until the viewport is unlocked. Annotation styles remain separate.

In an active unlocked model viewport, ZOOM accepts a positive numeric/fraction factor with XP. That factor is paper millimeters per model coordinate unit: 25.4/96XP sets the 1/8-inch-per-foot scale in an inch drawing; 1/96XP does so in a millimeter drawing. General X zoom and editing the preset list are not implemented.

Editable rectangular and simple closed polygon viewport objects support ordinary selection and commands. Select their borders with normal picks or windows; MOVE, COPY, ERASE, SCALE, ROTATE, MIRROR and crossing-window STRETCH operate on frames, including mixed paper geometry selections. Rectangles expose four corner and four edge-midpoint grips. Polygon boundaries expose vertex and edge-midpoint grips. MVIEW Polygonal accepts a closed straight boundary; MVIEW Object retains its original closed polyline/rectangle while creating an independent viewport. Boundaries support 3–64 vertices, without holes or curved edges.

Double-click inside a viewport to edit the model through that window. Unlocked windows zoom around the cursor and pan with the middle mouse button, including while LINE is active. A burst of wheel events commits one view change after navigation settles. Returning to paper space preserves sheet navigation. New windows start unlocked; explicit locks protect the model camera and allow sheet navigation instead. Resizing a frame retains the physical internal scale and existing paper projection; moving the whole frame translates its content. Off-sheet frames are allowed and output clips at the physical page edge.

Named sheets support A0–A5/Letter/Tabloid and bounded custom paper, independent viewport scales and per-viewport layer freezing. Model units and paper units are separate: paper geometry is in millimeters. A 100-foot segment measures 30.48 mm at 1:1000 whether its model coordinates use inches or meters. The Model tab keeps its own view. Page setup, frame/scale, clipping boundary, model/paper visibility, colors, lineweights, continuous/dashed/hidden/center linetypes and Plot flags are stored with the drawing.

The original [architectural scale example](samples/viewport-scales-v18.linecraft) shows four independently sized model views at the common 1/8, 1/4, 1/16 and 3/32 choices.

Start with the original [inch/A4 example](samples/layouts-inch-v16.linecraft), [meter/A3 example](samples/layouts-meter-v16.linecraft) or [polygon/off-sheet example](samples/viewport-v17-reference.linecraft). These are independently authored synthetic drawings. [Quick use](QUICK-USE.md) covers the controls.

PLOT Current prints the selected sheet even while working inside its floating model viewport. Explicit Model output uses the standalone model. PUBLISH combines chosen native Linecraft files into one PDF and can mix page sizes. Each sheet retains its viewport scales and clips. Dash patterns and lineweights use physical paper millimeters. Orthographic 3D views plot as vector wireframes; shaded surfaces and hidden-line removal are not plotted.

## Drawing units and construction planes

UNITS or the status-bar Units control opens per-drawing options. Architectural, Surveyor and Engineering presets use inches with different displays. Custom model units include unitless, inches, feet, millimeters, centimeters and meters. Changing display units never resizes accepted geometry.

Explicit `100'`, `100’`, `12"` and `12”` lengths convert into the model's assigned unit. Compound feet/inch input such as `5'6-1/2"` is supported. Degrees, minutes, seconds and radians have independent input/display controls. For example, in an inch drawing:

```text
LINE
0,0
100’,12”
Enter to finish
```

The endpoint is X=1200, Y=12 inches. Use explicit `deg`, `°`, `rad`, `arcmin` and `arcsec` markers in angle prompts. Native DXF DMS supports up to four decimal places of seconds; higher selected precision is retained as explicit dimension text with a warning. Survey bearings, geographic coordinates and survey adjustments are not implemented.

UCS supports World, XY/XZ/YZ, three points and a picked planar mesh face. Construction elevation follows the plane normal. Coordinate prompts and pointer acquisition use that plane; tilted circles/arcs remain analytic objects. Mesh vertices and bounded vertex/edge/face edits retain real XYZ. Shift+F1–F4 choose a mesh selection filter, Ctrl+Space cycles overlapping candidates within that filter, and Shift+Space cycles whole objects.

## Bounded drafting and exchange

Command families include lines, rectangles, polylines, circles/arcs/ellipses, cubic control-vertex splines, editing/transforms, arrays, flat blocks, text, nonassociative dimensions and captured-boundary hatches. The command reference states available options. This is a bounded independent application, not the complete AutoCAD catalogue.

3D supports XYZ paths, polygonal BOX/CYLINDER/SPHERE meshes, straight extrusion, world-axis rotation and original orbit controls. These are meshes rather than ACIS/NURBS solids. Advanced booleans, nested/dynamic blocks, attributes, associative hatch/dimensions and external references are not supported.

DWG reading uses a fixed separate GNU LibreDWG process. Model-space geometry is imported; native paper layouts, unsupported objects and approximations are not promoted to complete drawing fidelity. The source file stays unchanged. Save imported work as a new `.linecraft` file. DWG writing is not supported. JSON stores original layer/viewport/UCS preferences; native DXF can normalize some visibility, border and formatting choices, with warnings.

## Build and iterate on Windows

Use Windows x64 and Node.js 24 or newer. Lockfile pins are Electron 44.7.0, electron-builder 26.15.3 and Playwright 1.62.1. From the repository root:

```powershell
npm ci --no-audit --no-fund
node node_modules/electron/install.js
npm test
npm run dev
```

Electron 44 downloads its native binary on first use rather than through an npm postinstall script. The explicit vendor installer above downloads the pinned 44.7.0 binary before Linecraft tooling checks for it. This step is needed for a fresh source checkout; an installed Linecraft application already includes its runtime. See [Electron's binary installation instructions](https://www.electronjs.org/docs/latest/tutorial/installation).

The development profile is separate. Renderer edits reload with an accepted-drawing checkpoint. Host/preload and static geometry/unit/paper/plane/viewport-scale helper changes require restart. Routine iteration does not reinstall the application. Tooling requires local pinned dependencies; it does not search personal caches.

```powershell
npm run test:desktop
npm run test:layouts-desktop
npm run test:paper-pdf
npm run test:viewports-desktop
npm run test:viewport-navigation
npm run test:viewport-pdf
npm run test:scale-math
npm run test:scales
npm run test:scale-pdf
npm run test:roof-plot
npm run test:architecture
npm run test:architecture-ipc
npm run test:architecture-desktop
npm run test:space
npm run test:space-desktop
npm run test:tray
npm run test:tray-desktop
npm run unpacked
npm run build
```

The public gate requires 37 pure synthetic stages, including Roof + Space, structured scripting, generated roof/closure plotting and source-only analytical examples. The desktop gate adds 17 stages for fixed reader identity, hidden application/native PDF workflows and live development reload/validator checks: 54 source stages. Unpacked adds one build, 11 hidden executable suites and resource identities: 67 stages. Build adds NSIS compilation from the tested application: 68 stages. These counts describe required checks; they are not a claim that a run passed. Read completed reports under `work/`.

Automated application windows stay hidden and offscreen, with visibility/show-event assertions. Native choices use owned-file stubs; no unrelated OS clipboard data is read. Synthetic events, visible UI and physical gestures are distinct evidence. Optional external Python PDF/DXF readers are not application or build dependencies. See [tests](tests/README.md) for those independently measured audits.

## Automated releases

A version tag matching `package.json`, such as `v1.12.2`, triggers Windows CI. The workflow can also be dispatched manually for an existing immutable version tag. It installs locked dependencies and the pinned Electron binary, runs the public gate, tests the unpacked executable, builds NSIS and publishes the installer plus SHA-256 checksum using the repository's `GITHUB_TOKEN`. No stored user credentials or manual browser upload are required. Failed checks prevent publication. The workflow must complete before a release outcome is claimed. See [GitHub tag triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) and [CLI release creation](https://cli.github.com/manual/gh_release_create).

## Tests, privacy and licenses

This repository contains original runtime code and synthetic mathematical/IPC/GUI fixtures. Native drawings, observations, screenshots, private workspace paths, internal results and command corpora are excluded. `PUBLIC-SOURCE.json` identifies runtime hashes and test adaptations. The broader internal native-reference gate is separate.

Original Linecraft code and interface assets are MIT licensed; see [LICENSE](LICENSE). Linecraft is independently written and unaffiliated with Autodesk. No Autodesk code, artwork, fonts or other application assets are included.

Unmodified GNU LibreDWG 0.13.4 is GPL-3.0-or-later; GNU libiconv 1.18 is LGPL-2.1-or-later. Their licenses, matching source archives, origin links and hashes accompany the application under [third-party/libredwg](third-party/libredwg). These components retain separate licenses.
