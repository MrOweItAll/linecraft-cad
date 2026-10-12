# Public synthetic tests

Run `npm ci --no-audit --no-fund`, then `npm test` from the repository root. The 22-stage pure gate covers synthetic engine regression, independent physical unit/mesh/conic/cubic/paper/plane/camera mathematics, viewport-object transforms and anchored resize arithmetic, raw DXF owner/clip/section graphs, bounded decoding, and mocked native trust/clipboard/PDF/file contracts with production validation and temporary files.

`npm run test:desktop` adds seven stages: fixed reader resource identity; actual hidden unit, layout/UCS, rectangle/polygon viewport and active-command navigation suites; and two real production Chromium PDF producers. Native choices use deterministic owned paths. GUI suites reject visible windows/show events, set a deterministic 1280×820 hidden fixture, guard pointer hit targets and OS clipboard access. PDF producers retain physical scales, polygon clipping, off-sheet page-edge clipping and Publish page order, with source/PDF hashes; no physical printer is used.

`npm run unpacked` runs all 29 source stages, builds the application, runs four suites against that executable and verifies packaged converter/license/source identities (35 stages). `npm run build` adds NSIS compilation from the tested application (36 stages). Both builder invocations explicitly use `--publish never`; only the later successful CI release step receives publication credentials. Development checks do not install or upgrade the user's application.

Focused commands include `test:core`, `test:units-math`, `test:layouts-math`, `test:viewport-math`, `test:viewport-security`, `test:units-desktop`, `test:layouts-desktop`, `test:viewports-desktop`, `test:viewport-navigation`, `test:paper-pdf`, `test:viewport-pdf` and `test:viewport-export`.

Optional independent readers can inspect real generated output after `npm run test:viewport-pdf` and `npm run test:viewport-export`. A separate test environment using Python, PyMuPDF 1.28.0 and ezdxf 1.4.3 can run:

```powershell
python tests/audit-viewport-pdf-v17.py
python tests/audit-viewport-dxf-v17.py samples/viewport-v17-reference.dxf --drawing samples/viewport-v17-reference.linecraft --output work/viewport-dxf-external-audit-results.json
```

The optional PDF audit checks vectors and painted clipping at 0.01 mm geometry, 0.16 mm painted-edge and 0.3 mm page-quantization tolerances. The optional DXF audit uses a separate semantic decoder as well as raw group codes. These libraries are test-only, not runtime or required Windows build dependencies. Their execution is not implied by a passing mandatory public gate.

Results, screenshots, generated PDFs/drawings, isolated profiles and logs remain outside committed source. The two original versioned examples are deliberately included. Version-named drivers continue as regressions. Counts overlap and are not independent feature totals. Wheel bursts include synthetic WheelEvents through the real renderer; physical OS gestures and native CAD observations are separate evidence.

Native drawing fixtures, private corpora, observations and internal release results are absent. Mathematical fixtures and synthetic DXF records are original code/data. Public adaptations and runtime identity are disclosed in `PUBLIC-SOURCE.json`; these tests do not claim to reproduce private native observations.
