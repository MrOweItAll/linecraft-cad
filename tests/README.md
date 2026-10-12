# Public reproducible checks

Run `npm test` at the repository root. It executes the public synthetic suites sequentially, fails on a failing stage and fingerprints the source before/after execution. Generated results and temporary inputs are ignored by Git.

The copied engine suite excludes six cases that require private native application evidence. The DXF importer suite excludes three native/historical-fixture cases. All remaining case bodies are retained. The independent mesh DXF helper contains only the original group-code reader. Production runtime modules and assets are byte-identical to the installed source revision.

IPC suites mock Electron dialogs, clipboard and PDF host objects while running actual validation and owned file operations. They do not prove real desktop clipboard interoperability or native AutoCAD command equivalence. `npm run test:converter` verifies the actual bundled reader version and complete resource identities on Windows. `npm run test:units-desktop` exercises actual hidden Electron renderer controls with isolated chooser paths; it requires local pinned Electron and Playwright.

Native drawings, native reader JSON, recorded reference corpora, screenshots, installation/registry data and historical test results are excluded from the public tree.
