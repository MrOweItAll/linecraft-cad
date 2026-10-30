# Linecraft CAD

**A light, offline, MIT-licensed Windows CAD app with an AutoCAD-style command line that humans — and AI agents — can type.**

[**Download for Windows (x64)**](https://github.com/MrOweItAll/linecraft-cad/releases/latest) · [Quick use](QUICK-USE.md) · [Contributing](CONTRIBUTING.md) · [License (MIT)](LICENSE)

<!-- TODO(Jon): add a short demo GIF here, e.g. docs/media/demo.gif (LINE / RECTANGLE / PLOT typed at the command line). No media is committed yet. -->

Linecraft is an independent offline CAD application for 2D drafting, paper layouts and polygonal 3D modeling: command line, ribbon, layers, properties, snaps, grips, grouped Undo/Redo, native `.linecraft` files, model-space DWG/DXF import, DXF export and vector PDF output. No account, no subscription, no internet connection needed.

## Quick start

1. Download the installer from [Releases → latest](https://github.com/MrOweItAll/linecraft-cad/releases/latest) and run it. It bundles its own Electron runtime — no browser, Node.js or Autodesk install needed.
   - The installer is currently **unsigned**, so Windows SmartScreen may warn. Choose *More info → Run anyway* if you trust the source, and compare the published SHA-256 checksum on the release page.
2. Open one of the [sample drawings](samples/) or start a new drawing.
3. Click the command line and type, for example:

```text
LINE
0,0
100,0
100,50
Enter to finish
```

See [QUICK-USE.md](QUICK-USE.md) for controls and shortcuts.

## Scriptable by typing — for humans and AI agents

Everything is driven by typed commands (`LINE`, `RECTANGLE`, `CIRCLE`, `MOVE`, `UNITS`, `PLOT` …) and plain coordinate input. That means a person, or an AI agent that can type into the command line, can draft by entering the same command sequences. Linecraft does **not** include a built-in AI or text-prompt-to-part generator; "AI-friendly" here means only that the interface is typed commands.

## Honest limits (read before you try it)

- **Windows x64 only** today. A Linux build is planned but not available yet — see [CONTRIBUTING.md](CONTRIBUTING.md) if you want to help.
- **3D is polygonal meshes, not solids.** BOX/CYLINDER/SPHERE/extrude produce meshes, not ACIS/NURBS solids; advanced booleans are not supported.
- **DWG is import-only** (model space), via a separate unmodified GNU LibreDWG process. Paper layouts and unsupported objects are not imported with full fidelity. **DWG writing is not supported.** DXF import/export and PDF output are supported.
- Not the complete AutoCAD command catalogue: no nested/dynamic blocks, attributes, associative hatches/dimensions or external references.
- Unsigned installer (see Quick start).
- Independent project; not affiliated with or endorsed by Autodesk. "AutoCAD-style" describes the command-line workflow only.

Found a gap? [Open an issue](https://github.com/MrOweItAll/linecraft-cad/issues/new).

---

# Details

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
npm run unpacked
npm run build
```

The public gate has 25 pure synthetic stages, including the immutable scale catalog, independent physical arithmetic, XP notation and native-file validation. The desktop gate adds reader identity, five hidden unit/layout/viewport/navigation/scale GUI suites and three actual PDF producers: 34 stages. Unpacked adds one build, five hidden executable suites and resource identities: 41 stages. Build adds NSIS compilation from the tested application: 42 stages. These are required stages, not an automatic passing claim. Read completed reports under `work/`.

Automated application windows stay hidden and offscreen, with visibility/show-event assertions. Native choices use owned-file stubs; no unrelated OS clipboard data is read. Synthetic events, visible UI and physical gestures are distinct evidence. Optional external Python PDF/DXF readers are not application or build dependencies. See [tests](tests/README.md) for those independently measured audits.

## Automated releases

A version tag matching `package.json`, such as `v1.8.0`, triggers Windows CI. The workflow can also be dispatched manually for an existing immutable version tag. It installs locked dependencies and the pinned Electron binary, runs the public gate, tests the unpacked executable, builds NSIS and publishes the installer plus SHA-256 checksum using the repository's `GITHUB_TOKEN`. No stored user credentials or manual browser upload are required. Failed checks prevent publication. The workflow must complete before a release outcome is claimed. See [GitHub tag triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) and [CLI release creation](https://cli.github.com/manual/gh_release_create).

## Tests, privacy and licenses

This repository contains original runtime code and synthetic mathematical/IPC/GUI fixtures. Native drawings, observations, screenshots, private workspace paths, internal results and command corpora are excluded. `PUBLIC-SOURCE.json` identifies runtime hashes and test adaptations. The broader internal native-reference gate is separate.

Original Linecraft code and interface assets are MIT licensed; see [LICENSE](LICENSE). Linecraft is independently written and unaffiliated with Autodesk. No Autodesk code, artwork, fonts or other application assets are included.

Unmodified GNU LibreDWG 0.13.4 is GPL-3.0-or-later; GNU libiconv 1.18 is LGPL-2.1-or-later. Their licenses, matching source archives, origin links and hashes accompany the application under [third-party/libredwg](third-party/libredwg). These components retain separate licenses.
