# Linecraft CAD

Linecraft is an independent offline Windows CAD application for 2D drafting, paper layouts and polygonal 3D modeling. It includes an original command line, drawing canvas, ribbon, layers, properties, snaps, grips, grouped Undo/Redo, native drawing files, bounded model-space DWG/DXF import, DXF export and vector PDF output.

Download the Windows x64 installer from [GitHub Releases](https://github.com/MrOweItAll/linecraft-cad/releases/latest). The unsigned installer includes its own Electron runtime; a browser, Node.js and Autodesk installation are unnecessary for using the application.

## Roof + Space preview (R0–R3)

Version 1.11.1 extends this same application with semantic walls, hosted openings, rooms, roof groups, assemblies and bounded source constraints. Open Architecture in the existing interface. Convert a selected orthogonal closed path into face-referenced walls, recognize rooms, edit an axis span, and generate an equal-eave hip roof from the exterior wall loop or a captured footprint. Rectangle, L, T and H starters provide footprint vertices only; the original kernel generates the roof vertices. Existing camera, picking, drafting units, layouts and grouped Undo/Redo remain in use.

The [original H example](samples/roof-space-H-v19.linecraft) includes walls, a hosted door, room ceiling intent, a generated 4:12 hip roof and two scaled A3 review viewports. The analytical fixture is an independently supplied expected graph; regression tests run the actual generator and independently check face coverage, topology, area, shared edges and runoff. The handoff's earlier self-consistency check is not a runtime test.

Architectural drawings save authoritative source as `Linecraft/2`, with `architecture.schemaVersion=3`; schema 1 and 2 migrate explicitly without changing prior physical values, and new tray profiles default to absent; generated meshes are rebuilt on Open and Undo/Redo. Version 1.11.1 also reads ordinary `Linecraft/1` files. Earlier architectural releases reject unsupported newer schema versions instead of discarding their fields. Older releases reject the new format instead of silently dropping semantic source. Keep an original copy when using this preview. Generated meshes select their semantic owner and reject ordinary direct edits. `ROOFDETACH` explicitly copies selected generated geometry into ordinary editable objects while retaining authoritative source; the copies are excluded from architectural quantities.

R0–R2 is bounded to simple orthogonal plans with open recesses and no enclosed holes, equal eave and common pitch. The kernel permits at most 48 roof edges plus explicit event/patch/validation budgets. Closing recesses through overhangs and overlapping unresolved roof groups require a coverage decision. Wall quantities are nominal at butt-overlapping T junctions. Semantic building-frame rotation is supported; converting already rotated drafting paths can reject tiny floating-point departures from exact local orthogonality. Accepted coordinates are not silently snapped. The existing shaded painter renderer can show internal or behind-surface mesh edges; hidden-line display has not been added.

Ceiling elevation, bearing elevation and declared heel offsets are distinct. Open **Architecture → Space study**, or type **ROOFSPACE**, to evaluate current and target flat ceilings beneath the existing roof. The default mathematical model uses zero-thickness roof and ceiling surfaces. Optional normal roof offsets, vertical ceiling offsets, minimum height, headroom threshold and local-axis reservation boxes determine its bounded envelope. The calculation integrates clipped room/facet cells, reports limiting coordinates, maximum flat elevation, usable flat volume and headroom area, and rejects infeasible targets. A missing assembly uses the explicit zero-thickness mathematical surface model and supports flat/tray calculation and Apply. Physical framing verification is reported separately and does not block mathematical feasibility. Applying a feasible ceiling is one grouped Undo operation and leaves roof geometry, bearing elevations, camera and layouts unchanged. **ROOFSECTION** creates dimensioned X/Y section snapshots as ordinary editable objects. See the [R3 guide](docs/roof-space/R3-SPACE-STUDY.md), [clearance decision](docs/roof-space/ADR-002-clearance.md) and [original 240 ft² room example](samples/ceiling-space-v110.linecraft). Geometric surface/wall quantities remain physical; prefabricated-truss design and manufacturing-complexity surcharges are exactly zero. Framing lumber, connectors, load paths and physical feasibility remain unverified or unknown, and clearance reservations are retained. This preview does not certify framing or code compliance.

R3 supports flat ceilings and one bounded rectangular stepped tray under one covering roof skin per room, at most 256 room vertices, 1,024 roof triangles, 128 reservations and 4,096 clipped cells, with an explicit intersection-work budget. Results are mathematical space beneath the fixed surfaces, modified by optional entered offsets and preserved reservation boxes. Unmodeled truss webs/chords, connectors, services, stairs and access remain outside physical verification. General tray polygons, multiple plateaus, sloped or vaulted ceilings, gable assignments, variable bearing heights and bounded material/space alternatives remain subsequent milestones. Section snapshots require regeneration after edits. No unimplemented analysis is presented as a result. See the [implementation handoff](docs/roof-space/IMPLEMENTATION_HANDOFF.md) and [integration decision](docs/roof-space/ADR-001-integration.md).

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

## Structured scripting (development branch)

The existing open drawing can be read and revised through a versioned JSON API and an opt-in authenticated local CLI. Object-ID edits stage privately and commit as one Undo operation, with preview, stale-document checks and before/after entity reports. See [scripting setup and Windows acceptance](docs/SCRIPTING.md). Portable tests pass; this extension still requires Windows source/unpacked/installed verification and integration before release. No remote ChatGPT connection is enabled automatically.

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

The public gate has 33 pure synthetic stages, including Roof + Space geometry, exact flat/tray ceiling analysis and sections, production native-file contracts and regenerated source-only H/space/tray examples. The desktop gate adds fixed reader identity, eight hidden GUI suites, three real PDF producers and two live development reload/validator checks: 47 stages. Unpacked adds a build, eight hidden executable suites and resource identities: 57 stages. Build adds NSIS compilation from the tested application: 58 stages. These are required stages, not an automatic passing claim. Read completed reports under `work/`.

Automated application windows stay hidden and offscreen, with visibility/show-event assertions. Native choices use owned-file stubs; no unrelated OS clipboard data is read. Synthetic events, visible UI and physical gestures are distinct evidence. Optional external Python PDF/DXF readers are not application or build dependencies. See [tests](tests/README.md) for those independently measured audits.

## Automated releases

A version tag matching `package.json`, such as `v1.11.1`, triggers Windows CI. The workflow can also be dispatched manually for an existing immutable version tag. It installs locked dependencies and the pinned Electron binary, runs the public gate, tests the unpacked executable, builds NSIS and publishes the installer plus SHA-256 checksum using the repository's `GITHUB_TOKEN`. No stored user credentials or manual browser upload are required. Failed checks prevent publication. The workflow must complete before a release outcome is claimed. See [GitHub tag triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) and [CLI release creation](https://cli.github.com/manual/gh_release_create).

## Tests, privacy and licenses

This repository contains original runtime code and synthetic mathematical/IPC/GUI fixtures. Native drawings, observations, screenshots, private workspace paths, internal results and command corpora are excluded. `PUBLIC-SOURCE.json` identifies runtime hashes and test adaptations. The broader internal native-reference gate is separate.

Original Linecraft code and interface assets are MIT licensed; see [LICENSE](LICENSE). Linecraft is independently written and unaffiliated with Autodesk. No Autodesk code, artwork, fonts or other application assets are included.

Unmodified GNU LibreDWG 0.13.4 is GPL-3.0-or-later; GNU libiconv 1.18 is LGPL-2.1-or-later. Their licenses, matching source archives, origin links and hashes accompany the application under [third-party/libredwg](third-party/libredwg). These components retain separate licenses.
