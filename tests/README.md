# Public synthetic tests

Run `npm ci --no-audit --no-fund`, then `npm test` from the repository root. The 19-stage pure gate covers synthetic engine regression, independent physical unit/mesh/conic/cubic/paper/plane/camera mathematics, bounded DXF decoding, and mocked native trust/clipboard/PDF/file contracts with real validation and temporary files.

`npm run test:desktop` adds four stages: fixed reader resource identity, actual hidden unit UI, actual hidden layout/UCS UI and real production Chromium PDF output. Native choices are deterministic owned paths. GUI suites reject visible windows/show events and guard OS clipboard access. The PDF producer retains unequal sheet sizes and reports source/PDF hashes; no physical printer is used.

`npm run unpacked` runs all 23 source stages, builds the application, runs the two suites against that executable and verifies packaged converter/license/source identities (27 stages). `npm run build` adds NSIS compilation from the tested application (28 stages). It does not install or upgrade the user's application during development.

Focused commands include `npm run test:core`, `test:units-math`, `test:layouts-math`, `test:layouts-security`, `test:units-desktop`, `test:layouts-desktop` and `test:paper-pdf`.

Results, screenshots, generated PDFs/drawings, isolated profiles and logs are ignored and remain outside committed source. Version-named drivers continue as regressions. Counts overlap and are not independent feature totals.

Native drawing fixtures, private corpora, observations and internal release results are absent. Mathematical fixtures and synthetic DXF records are original code/data. Public adaptations and runtime identity are disclosed in `PUBLIC-SOURCE.json`; these tests do not claim to reproduce private native observations.
