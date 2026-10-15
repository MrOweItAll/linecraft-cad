# Public synthetic tests

Run npm ci --no-audit --no-fund, then npm test from the repository root. The 28-stage pure gate covers synthetic engine regression, independent physical unit/mesh/conic/cubic/paper/plane/camera mathematics, viewport objects and anchored resize, immutable common scale presets, physical scale/XP parsing, raw DXF ownership, bounded decoding, Roof + Space source and geometry, and mocked native trust/clipboard/PDF/file contracts using production validation and temporary files.

npm run test:desktop adds twelve stages: fixed reader resource identity; six actual hidden unit, layout/UCS, rectangle/polygon viewport, active-command navigation, common-scale and Roof + Space GUI suites; three real production Chromium PDF producers; and two live development reload/validator checks. Native choices use deterministic owned paths. GUI suites reject visible windows/show events, use deterministic hidden dimensions and guard pointer hit targets. PDF producers preserve physical scales, polygon clips, page edges and Publish order. The scale producer tests original 24-foot rulers at 1/8, 1/4, 1/16 and 3/32 inch per foot in inch/foot/mm/m models, with real PDF files and unchanged input files.

npm run unpacked runs all 40 source stages, builds the application, runs six suites against that executable and verifies packaged converter/license/source identities (48 stages). npm run build adds NSIS compilation from the tested application (49 stages). Both builder invocations explicitly use --publish never. Only the later successful CI release step receives publication credentials. Development checks do not install or upgrade the user's application.

Focused commands include test:core, test:units-math, test:layouts-math, test:viewport-math, test:viewport-security, test:units-desktop, test:layouts-desktop, test:viewports-desktop, test:viewport-navigation, test:paper-pdf, test:viewport-pdf, test:viewport-export, test:scale-catalog, test:scale-math, test:scale-security, test:scales and test:scale-pdf.

Optional independent readers can inspect the real generated PDFs/DXF after the relevant producers. A separate Python test environment with PyMuPDF 1.28.0 and ezdxf 1.4.3 can run:

    python tests/audit-viewport-pdf-v17.py
    python tests/audit-viewport-dxf-v17.py samples/viewport-v17-reference.dxf --drawing samples/viewport-v17-reference.linecraft --output work/viewport-dxf-external-audit-results.json
    python tests/audit-viewport-scales-pdf-v18.py

The scale audit independently checks four physical ruler lengths and labels per page, including all four Publish pages, at 0.01 mm geometry and 0.3 mm page-quantization tolerances. The older polygon PDF audit also checks painted clipping at 0.16 mm. The DXF audit uses a separate semantic decoder and raw group codes. These readers are test-only, not application or mandatory Windows build dependencies; a mandatory gate pass does not imply their execution.

Results, screenshots, generated PDFs/drawings, isolated profiles and logs remain outside committed source. Original synthetic examples are deliberately included. Version-named drivers remain regressions. Counts overlap and are not independent feature totals. Synthetic DOM wheel bursts, actual hidden application behavior, physical OS gestures and native CAD observations are separate evidence.

Native drawing fixtures, private corpora, observations and internal release results are absent. Mathematical fixtures and synthetic DXF records are original code/data. PUBLIC-SOURCE.json discloses public adaptations and exact runtime identity; public tests do not claim to reproduce excluded native observations.

# Roof + Space additions

Version 1.9 requires 28 pure stages, 40 source desktop stages, 48 unpacked stages or 49 complete build stages. The Roof + Space runner executes actual source model, editor integration, independent preservation and roof geometry tests. The supplied H fixture specifies expected analytical graph values rather than hand-authored runtime vertices. The generator must solve rectangle/L/T/H footprints; tests independently certify coverage, overlaps, shared edges, pitch, area, topology and every reported runoff catchment.

The new native-file suite uses real production main handlers and temporary files with a mocked Electron chooser/transport. The hidden desktop suite uses the actual application renderer, 3D owner picking, camera navigation, room edits, regeneration, native Save/Open and grouped Undo/Redo; only file chooser destinations/discard responses are deterministic stubs. It rejects visible windows, uses owned profiles, and verifies that no network or OS clipboard was accessed. The development tests also execute watched reload with a pending Architecture draft and source recovery, then exercise stale architecture-helper validation on an isolated copy. Physical desktop gestures are separate evidence.

Focused commands are `npm run test:architecture`, `npm run test:architecture-ipc` and `npm run test:architecture-desktop`. Generated reports and screenshots are ignored. R0–R2 geometry passes do not validate framing design, supplier cost, code compliance, ceiling-space recovery, gables or variable bearing topology.
