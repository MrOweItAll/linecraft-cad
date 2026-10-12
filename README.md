# Linecraft CAD

Linecraft is an independent offline Windows CAD application for 2D drafting, paper layouts and polygonal 3D modeling. It includes an original command line, drawing canvas, ribbon, layers, properties, snaps, grips, grouped Undo/Redo, native drawing files, bounded model-space DWG/DXF import, DXF export and vector PDF output.

Download the Windows x64 installer from [GitHub Releases](https://github.com/MrOweItAll/linecraft-cad/releases/latest). The unsigned installer includes its own Electron runtime; a browser, Node.js and Autodesk installation are unnecessary for using the application.

## Paper layouts and physical scales

Version 1.6 adds named sheets, A0–A5/Letter/Tabloid and bounded custom paper, independently scaled model viewports, clipping/locking and per-viewport layer freezing. Model units and paper units are separate: paper geometry is in millimeters. A 100-foot segment measures 30.48 mm at 1:1000 whether its model coordinates use inches or meters.

The Model tab keeps its own view. Double-click a sheet viewport to edit its model; return to paper space to edit the sheet. Locking protects the viewport's model camera while sheet navigation remains available. Page setup, frames/scales, model/paper visibility, colors, lineweights, continuous/dashed/hidden/center linetypes and Plot flags are stored with the drawing.

Start with the original [inch/A4 example](samples/layouts-inch-v16.linecraft) or [meter/A3 example](samples/layouts-meter-v16.linecraft). Both show one 100-foot model segment at 1:1000 and 1:500, plus independent 100 mm paper geometry. [Quick use](QUICK-USE.md) covers the controls.

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

The development profile is separate. Renderer edits reload with an accepted-drawing checkpoint. Host/preload and static geometry/unit/paper/plane helper changes require restart. Routine iteration does not reinstall the application. Tooling requires local pinned dependencies; it does not search personal caches.

```powershell
npm run test:desktop
npm run test:layouts-desktop
npm run test:paper-pdf
npm run unpacked
npm run build
```

The public gate has 19 pure synthetic stages. The desktop gate adds reader identity, hidden unit/layout GUI suites and actual PDF output: 23 stages. Unpacked adds one build, two actual hidden executable suites and resource identities: 27 stages. Build adds NSIS compilation from the tested application: 28 stages. These are required stages, not an automatic passing claim. Read completed reports under `work/`.

Automated application windows stay hidden and offscreen, with visibility/show-event assertions. Native choices use owned-file stubs; no unrelated OS clipboard data is read. Synthetic events, visible UI and physical gestures are distinct evidence. Optional external Python PDF/DXF readers are not application or build dependencies.

## Automated releases

A version tag matching `package.json`, such as `v1.6.0`, triggers Windows CI. The workflow can also be dispatched manually for an existing immutable version tag. It installs locked dependencies and the pinned Electron binary, runs the public gate, tests the unpacked executable, builds NSIS and publishes the installer plus SHA-256 checksum using the repository's `GITHUB_TOKEN`. No stored user credentials or manual browser upload are required. Failed checks prevent publication. The workflow must complete before a release outcome is claimed. See [GitHub tag triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) and [CLI release creation](https://cli.github.com/manual/gh_release_create).

## Tests, privacy and licenses

This repository contains original runtime code and synthetic mathematical/IPC/GUI fixtures. Native drawings, observations, screenshots, private workspace paths, internal results and command corpora are excluded. `PUBLIC-SOURCE.json` identifies runtime hashes and test adaptations. The broader internal native-reference gate is separate.

Original Linecraft code and interface assets are MIT licensed; see [LICENSE](LICENSE). Linecraft is independently written and unaffiliated with Autodesk. No Autodesk code, artwork, fonts or other application assets are included.

Unmodified GNU LibreDWG 0.13.4 is GPL-3.0-or-later; GNU libiconv 1.18 is LGPL-2.1-or-later. Their licenses, matching source archives, origin links and hashes accompany the application under [third-party/libredwg](third-party/libredwg). These components retain separate licenses.
