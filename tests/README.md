# Public synthetic tests

Run npm ci --no-audit --no-fund, then npm test from the repository root. The 34-stage pure gate covers synthetic engine regression, independent physical unit/mesh/conic/cubic/paper/plane/camera mathematics, viewport objects and anchored resize, immutable common scale presets, physical scale/XP parsing, raw DXF ownership, bounded decoding, Roof + Space source and geometry, and mocked native trust/clipboard/PDF/file contracts using production validation and temporary files.

npm run test:desktop adds fifteen stages: fixed reader resource identity; nine actual hidden unit, layout/UCS, rectangle/polygon viewport, active-command navigation, common-scale, Roof + Space, fixed-roof flat ceiling and tray GUI suites; three real production Chromium PDF producers; and two live development reload/validator checks. Native choices use deterministic owned paths. GUI suites reject visible windows/show events, use deterministic hidden dimensions and guard pointer hit targets. PDF producers preserve physical scales, polygon clips, page edges and Publish order. The scale producer tests original 24-foot rulers at 1/8, 1/4, 1/16 and 3/32 inch per foot in inch/foot/mm/m models, with real PDF files and unchanged input files.

npm run unpacked runs all 49 source stages, builds the application, runs nine suites against that executable and verifies packaged converter/license/source identities (60 stages). npm run build adds NSIS compilation from the tested application (61 stages). Both builder invocations explicitly use --publish never. Only the later successful CI release step receives publication credentials. Development checks do not install or upgrade the user's application.

Focused commands include test:core, test:units-math, test:layouts-math, test:viewport-math, test:viewport-security, test:units-desktop, test:layouts-desktop, test:viewports-desktop, test:viewport-navigation, test:paper-pdf, test:viewport-pdf, test:viewport-export, test:scale-catalog, test:scale-math, test:scale-security, test:scales and test:scale-pdf.

Optional independent readers can inspect the real generated PDFs/DXF after the relevant producers. A separate Python test environment with PyMuPDF 1.28.0 and ezdxf 1.4.3 can run:

    python tests/audit-viewport-pdf-v17.py
    python tests/audit-viewport-dxf-v17.py samples/viewport-v17-reference.dxf --drawing samples/viewport-v17-reference.linecraft --output work/viewport-dxf-external-audit-results.json
    python tests/audit-viewport-scales-pdf-v18.py

The scale audit independently checks four physical ruler lengths and labels per page, including all four Publish pages, at 0.01 mm geometry and 0.3 mm page-quantization tolerances. The older polygon PDF audit also checks painted clipping at 0.16 mm. The DXF audit uses a separate semantic decoder and raw group codes. These readers are test-only, not application or mandatory Windows build dependencies; a mandatory gate pass does not imply their execution.

Results, screenshots, generated PDFs/drawings, isolated profiles and logs remain outside committed source. Original synthetic examples are deliberately included. Version-named drivers remain regressions. Counts overlap and are not independent feature totals. Synthetic DOM wheel bursts, actual hidden application behavior, physical OS gestures and native CAD observations are separate evidence.

Native drawing fixtures, private corpora, observations and internal release results are absent. Mathematical fixtures and synthetic DXF records are original code/data. PUBLIC-SOURCE.json discloses public adaptations and exact runtime identity; public tests do not claim to reproduce excluded native observations.

# Roof + Space additions

Version 1.12 requires 34 pure stages, 49 source desktop stages, 60 unpacked stages or 61 complete build stages. These are mandatory stage counts, not a claim that a run passed. The Roof + Space runner executes actual source model, editor integration, independent preservation and roof geometry tests. The supplied H fixture specifies expected analytical graph values rather than hand-authored runtime vertices. The generator must solve rectangle/L/T/H footprints; tests independently certify coverage, overlaps, shared edges, pitch, area, topology and every reported runoff catchment.

The new native-file suite uses real production main handlers and temporary files with a mocked Electron chooser/transport. The hidden desktop suite uses the actual application renderer, 3D owner picking, camera navigation, room edits, regeneration, native Save/Open and grouped Undo/Redo; only file chooser destinations/discard responses are deterministic stubs. It rejects visible windows, uses owned profiles, and verifies that no network or OS clipboard was accessed. The development tests also execute watched reload with a pending Architecture draft and source recovery, then exercise stale architecture-helper validation on an isolated copy. Physical desktop gestures are separate evidence.

Focused commands are `npm run test:architecture`, `npm run test:architecture-ipc` and `npm run test:architecture-desktop`. Generated reports and screenshots are ignored. R0–R3 geometry passes do not validate framing design, supplier cost, code compliance or variable bearing topology. Ceiling-space results use explicit zero-thickness mathematical surfaces by default, with optional entered offsets and preserved reservation boxes; physical framing verification is separate.

# R3 fixed-roof ceiling additions

`npm run test:space` executes the actual affine-cell solver, integration and an independently written analytical suite. It covers normal/vertical layer separation, clipped intersections, reservation lower envelopes, physical units, large coordinates, infeasible candidates, headroom/volume arithmetic, source nonmutation and disjoint section intervals. `tests/export-clearance-sample.mjs` validates the immutable source-only room with a declared service box and validates native Save/Open. The archived H example remains schema 1 byte-for-byte to exercise migration.

`npm run test:space-desktop` runs real hidden application controls, source-only schema 4 Save/Open with schema 1/2/3 migration, current/target/maximum adoption, grouped Undo/Redo, reservation updates, dimensioned section objects and 320-pixel containment. Every accepted study checks that exterior roof vertices/faces, roof parameters, wall bearings, camera and layouts stay unchanged. Chooser destinations use disposable owned-file stubs. Reports and screenshots remain ignored. Hidden tests and physical installed-application observations are separate evidence.

# R3 bounded tray additions

`npm run test:tray` runs original pure tray, editor/persistence integration and independently written analytical checks. The kernel clips affine clearance cells without a grid. Tests include concave containment, full-area coverage, closed return edges and single-point reservation contacts, actual accepted profile baselines, physical units, large translations, immutable source and exact stepped sections. `tests/export-tray-sample.mjs` validates the immutable schema 3 source-only tray example. Archived 1.9 schema 1 and 1.10 schema 2 examples remain byte-for-byte unchanged.

`npm run test:tray-desktop` exercises actual hidden application controls for distinct proposed/accepted profiles, Apply and grouped Undo/Redo, native Save/Open, conditional results, section snapshots and bounded UI layout. It verifies fixed exterior roof geometry and separate wall bearing elevations. Native chooser destinations are disposable owned-file stubs. Hidden application checks and physical installed desktop gestures remain separate evidence classes. Mathematical return thickness and material volume are exactly zero; return area, optional offsets and reservations remain tested. Physical framing remains separately unverified.

# Explicit zero-thickness mathematical model

Version 1.11.1 tests missing-assembly flat/tray calculations and Apply without a physical-framing declaration gate. Existing nonzero normal roof and vertical ceiling offsets still load unchanged. The explicit **Use zero thickness** transaction clears only selected roof layers and the selected room ceiling offset, preserves reservation boxes and source geometry, and supports grouped Undo/Redo. Return thickness and material volume are zero in the mathematical model; actual framing verification remains a separate reported status. Schema 4 migration preserves all three archived architectural examples byte-for-byte.

# R4 confirmed terminal gable additions

`npm run test:gable` runs the actual stationary-terminal kernel, schema-4/editor integration and independently written analytical checks. Confirmed geometric edge identities, winding/start invariance, stale-assignment decisions, separate eave/rake overhangs, coverage, slope, topology and approved-eave runoff are tested. Sloping skin and zero-thickness vertical gable closures are separate; only the sloping skin bounds ceiling space and roof-layer quantities. No outer hip caps are silently substituted for an unmet all-gable policy.

`npm run test:gable-desktop` exercises actual hidden controls, explicit confirmation and atomic Apply, owner picking, Undo/Redo, native Save/Open, ceiling/tray preservation and bounded layout. `tests/export-gable-sample.mjs` creates a separate schema-4 source-only gable example; the schema-1/2/3 examples remain immutable. Hidden tests, physical installed desktop interaction and native CAD observations remain separate evidence. Mandatory stage counts describe the pipeline, not a claim that it ran or passed. Framing is separately unverified, and both requested truss surcharges remain zero.
