# Linecraft CAD

Linecraft is an independent offline Windows CAD application for 2D drafting and polygonal 3D modeling. It has a drawing canvas, command line, ribbon, layers, properties, object snaps, grips, grouped Undo/Redo, native drawing files, DXF export and bounded DWG/DXF import.

Download the Windows x64 installer from [GitHub Releases](https://github.com/MrOweItAll/linecraft-cad/releases/latest). Version 1.5.0 adds drawing-specific physical units and familiar feet/inch input. The installer is unsigned. Linecraft does not require a browser or a separately installed Node.js runtime.

## Drawing units

Open **UNITS** (alias **UN**) or click **Units** on the status bar. The drawing tree separates presets, linear units and angular units. Apply commits the preferences as one undoable change; it preserves existing coordinates. Preferences are stored with the drawing.

| Preset | Assigned model unit | Linear display | Angular display |
| --- | --- | --- | --- |
| Architectural | Inches | Feet and fractional inches | Decimal degrees |
| Surveyor | Inches | Feet and decimal inches | Degrees, minutes and seconds |
| Engineering | Inches | Feet and decimal inches | Decimal degrees |

Custom model assignments include unitless, inches, feet, millimeters, centimeters and meters. Angular input defaults can be degrees, minutes, seconds or radians. Independent angular displays include decimal degrees, DMS, radians, decimal minutes and decimal seconds. Precision controls belong to each branch.

Explicit lengths convert into the assigned model unit. In an inch drawing, `100'` or `100’` means 1200 model units; `12"` or `12”` means 12. Compound input such as `5'6-1/2"` is accepted. Apostrophes and quotation marks identify length units in a length prompt, and angular minutes/seconds in an angle prompt. Examples:

```text
UNITS
Choose Architectural and Apply
LINE
0,0
100’,12”
Enter to finish
```

The line ends at X=1200, Y=12 inches. Use explicit `deg`, `°`, `rad`, `arcmin` and `arcsec` markers where clarity helps, for example `@100'<45°` or `30°15'20"`. Changing display units never resizes existing geometry.

The Surveyor preset implements the requested inches, decimal feet/inches and DMS organization. Compass quadrant bearings, geographic coordinate systems and survey adjustments are not implemented.

## Drawing and editing

Supported command families include LINE, RECTANG, PLINE, CIRCLE, ARC, ELLIPSE, cubic control-vertex SPLINE, COPY, MOVE, ROTATE, SCALE, MIRROR, ERASE, TRIM, EXTEND, OFFSET, FILLET, CHAMFER, STRETCH, PEDIT, ARRAYRECT, BLOCK, INSERT, text, dimensions, bounded HATCH, PLOT and PUBLISH. The original interface exposes available commands and their supported options; it does not implement the complete AutoCAD command catalogue.

3D supports XYZ paths, polygonal BOX/CYLINDER/SPHERE meshes, straight profile extrusion, world-axis rotation, standard views and constrained/free orbit. These are polygonal meshes rather than ACIS/NURBS solids. Advanced booleans, nested or dynamic blocks, attributes, associative hatch/dimensions and external references are not supported.

DWG import uses a fixed, separately attributed GNU LibreDWG reader process. The source drawing stays unchanged; save imported geometry as a new `.linecraft` file. Unsupported objects and approximations are reported. DWG writing and complete native drawing fidelity are not supported. Exact model-scale PDF plotting requires a physical model-unit assignment; perspective 3D plotting uses Fit.

## Build and iterate on Windows

Use Windows x64 and Node.js 24 or newer for development. Dependencies are pinned in `package-lock.json`. From this repository's root:

```powershell
npm ci
npm test
npm run dev
```

The source application uses a separate local development profile. Renderer edits reload with a drawing checkpoint. Host/preload changes and native validation helper changes require a host restart. Routine iteration does not reinstall the application.

```powershell
npm run test:units-desktop
npm run unpacked
npm run build
```

`npm run build` runs the public synthetic gate, checks the fixed reader resources, exercises the unit workflow in the actual hidden Electron host, then builds `Windows-Release/Linecraft-CAD-1.5.0-Setup.exe`. Electron and builder must be installed locally at the pinned versions; tooling does not search personal caches. Building may download the pinned Electron/NSIS dependency tooling on first use. No hosted services are needed to run the installed application.

## Tests and evidence

`npm test` is a reproducible public synthetic gate: command/state regression, independent unit/curve/mesh/projection math, DXF decoding, mocked Electron IPC contracts and real temporary-file handling. `npm run test:units-desktop` separately executes the real renderer and host; its chooser decisions are stubbed to owned test paths and it verifies that no visible window or OS clipboard is touched.

The internal release also uses native AutoCAD observations and a broader 39-stage Windows gate. Those drawing fixtures, desktop screenshots, installation records and historical results are intentionally absent here. The public synthetic gate is distinct and does not claim to reproduce those private observations. `PUBLIC-SOURCE.json` records exact original runtime hashes and the public test adaptations.

## Licenses

Original Linecraft code and interface assets are MIT licensed; see [LICENSE](LICENSE). Linecraft is independently written and is not affiliated with Autodesk. No Autodesk application code, artwork, fonts or other assets are included.

The bundled unmodified GNU LibreDWG 0.13.4 executable/library is GPL-3.0-or-later; its GNU libiconv 1.18 dependency is LGPL-2.1-or-later. Their licenses, matching released source archives, origin links and hashes accompany the application in [third-party/libredwg](third-party/libredwg). These third-party components retain their own licenses; they are not covered by Linecraft's MIT license.
