## 1.36.0 — Measured mouse and grip interaction — 2026-10-24

- Keep ordinary grips provisional after click-release or a held stroke; confirm once with a separate press or validated typed point.
- Preview through the existing geometry API, preserving source, drawing planes, exact snaps and one normal Undo record for an accepted content change.
- Cancel previews on Escape, pointer cancellation or invalid context; guard scripts and file actions while acquiring a point.
- Test measured LINE/RECTANG point-press behavior and shared PLINE/CIRCLE/ARC acquisition, paper/3D grips, native persistence and physical viewport-scale PDFs.
- Preserve semantic roof/subobject gesture owners and the existing engine. Record idle two-click window selection and extra AutoCAD grip modes as remaining work.

## 1.35.0 — Command entry and precision editing — 2026-10-24

- Complete supported command names, aliases and actual prompt options while preserving coordinates and literal annotation content.
- Add anchored Perpendicular running and temporary snaps with analytic finite 2D/3D line and circular feet.
- Acquire visible editable handles with exact crosshair/drag anchors, hover state and a stable screen aperture.
- Extend TRIM/EXTEND with Quick and Standard workflows, path/curve targets, Fence/Crossing/freehand gestures, temporary Shift reversal, projection/implied edges, local Undo and grouped history.
- Keep geometry helpers in the checkpointed source reload and native validator dependency guards. Document unsupported target classes and historical Standard-mode reference adapters explicitly.

## 1.34.0 — Contextual drafting controls — 2026-10-23

- Add contextual Modify/navigation submenus and separate geometric COPY from clipboard commands.
- Guard complete selections, including hidden/frozen objects and mixed paper viewport selections.
- Expose viewport lock and existing standard scales through the normal viewport editing path.
- Add supported temporary one-point snap overrides and Shift+right-click access at command point prompts.
- Retain keyboard/hover descriptions, stale-context validation, existing coordinate entry and grouped history. Include menu policy edits in the development watcher.

## 1.33.1 — Large-sheet PDF output — 2026-10-23

- Replace the percent-encoded PDF renderer document URL with a bounded, ephemeral, session-local in-memory document response.
- Retain exact request matching, restrictive content policy, permissions, renderer isolation, timeouts and atomic final PDF writes.
- Preserve drawing geometry, layout visibility, scales, native schema and grouped history. No dependency updates.

## 1.9.0 — Roof + Space R0-R2 preview — 2026-10-15

- Versioned architectural source, backward loading of existing native drawings, generated owner selection and grouped history.
- Orthogonal reference-face walls, hosted openings, topology-derived rooms, independent ceiling intent and bounded driving spans.
- Original finite-front hip wavefront, 23 pitches, mitered overhangs, rectangle/L/T/H analytic tests, runtime coverage/overlap/runoff validation.
- Zero truss design/manufacturing complexity surcharges, real geometric quantities, explicit unknown framing/clearance status.
- New modules are offline packaged dependencies and participate in development restart guards and release tests.

# Changes

## 1.5.0

- Added a per-drawing unit option tree with separate Linear/Angular sections and Architectural, Surveyor and Engineering presets. All three requested presets assign inches; Apply is one Undo group and changing units preserves coordinates.
- Added physical feet/inch/metric command input, straight/curly/prime marks, mixed fractions, DMS, degrees, minutes, seconds and radians. Bare values use the selected model or angular input unit; dimensionless factors stay dimensionless.
- Added unit-aware coordinates, measurements, properties and dimension labels, saved preferences, standard DXF unit metadata and physical-scale PDF checks. Unsupported native display combinations have documented fallbacks.

## 1.4.0

- Implemented all 13 former unavailable command cards with documented bounds: HATCH, DIMANGULAR, BLOCK, INSERT, ARRAYRECT, FILLET, CHAMFER, ELLIPSE, SPLINE, STRETCH, PEDIT, PLOT and PUBLISH.
- Added original curve/conic/corner math, captured hatch fills/patterns, persistent flat blocks, atomic history, geometry properties, clipboard resources and bounded exchange output.
- Added polygonal BOX, CYLINDER, SPHERE, EXTRUDE and 3DPOLY, exact XYZ, ROTATE3D, orthographic/perspective projection, constrained/free orbit, selection isolation, original ViewCube and construction-plane acquisition.
- Added read-only DWG/DXF input through fixed, separately distributed GNU LibreDWG 0.13.4 and an original bounded decoder. Matching third-party sources, licenses and import reports are included. DWG writing and proprietary-solid fidelity are unsupported.
- Restored source DWG layer visibility/locking from validated reader JSON metadata, correcting the fixed reader's DXF color-sign defect without unhiding ordinary DXF layers. Protected block child layers against deletion and updated their names atomically.
- Added vector PDF preview/output and ordered batch publication with physical scale/lineweights, native choices, isolated hidden rendering, network denial and atomic writes. PDF scale was independently measured.
- Extended the source-test-recode loop and hidden source/packaged tests. Ordinary launches remain a visible Windows application; routine edits need no installer.

## 1.3.0

- Added editable TEXT, MTEXT and TEXTEDIT, with height, rotation, wrapping width, named font styles and original annotation rendering.
- Added horizontal/vertical DIMLINEAR, DIMALIGNED, DIMRADIUS and DIMDIAMETER; definition-point grips, properties, named dimension styles, scales, precision and prefixes/suffixes. Dimensions currently retain independent definitions rather than following source-object edits.
- Added per-drawing units/decimal precision, individual endpoint/midpoint/center/quadrant snaps, adaptive/fixed grid, and DIST, ID and AREA queries.
- Extended save/open, transforms, selection, clipboard, history and original DXF export to annotations and their style resources. Native AutoCAD Open/AUDIT/re-export verified the synthetic annotation sample and stable style fields.
- Fixed text-editor Undo routing and deferred source reload/file operations while editor/settings drafts are open. Daily code-test-recode still needs no installation.
- Added explicit DXF export rejection for ambiguous literal TEXT/control-label tokens and native-tested MTEXT literal escaping; source text stays editable and saved unchanged.

## 1.2.0

- Added practical COPYBASE/COPYCLIP/CUTCLIP/PASTECLIP workflows, ERASE, Standard-style TRIM/EXTEND, OFFSET, SCALE, MIRROR, BREAK, ARC, straight PLINE, JOIN and EXPLODE.
- Added independently parsed native editing and clipboard/curve corpora, guarded OS clipboard transport, geometry previews and grouped history.
- Researched 535 published AutoCAD LT2027 command names and recorded bounded implementation coverage separately from unsupported commands and UI equivalents.

## 1.1.0

- Added center/radius or diameter CIRCLE, MOVE, repeated COPY, and signed ROTATE commands, with selection prompts, previews, and undo transactions.
- Added circle rendering, five grips, center/quadrant pointer snaps, and exact editable radius. Rotated rectangles retain their orientation and dimensions.
- Corrected repeated relative COPY destinations to use the original base, based on measured actual AutoCAD behavior. COPY local Undo removes the latest copied batch.
- Added measured native DXF geometry fixtures for circles, transformed rectangles, LINE Undo/Close, and COPY Undo. Tests independently parse and verify native reference hashes before comparing geometry.
- Added a native source development host, automatic renderer reload with draft recovery, controlled main/preload restart, isolated profiles, focused tests, and a source release gate. Daily iteration needs no installer.
- Added numerical regression coverage for scalar radius precision, small angles, large-origin rectangles, and small-geometry view fitting. These are Linecraft correctness tests, separate from observed AutoCAD behavior.
- Extended the original DXF writer and its interoperability validation. The release test report records the actual native reader outcome.

## 1.0.0

Initial Windows desktop installer with LINE, RECTANG, coordinates, selection, pan/zoom, grips, endpoint/midpoint snaps, layers, properties, undo/redo, local drawing files, and DXF export. The current test report distinguishes historical 1.0 checks from executed 1.1 release checks.
