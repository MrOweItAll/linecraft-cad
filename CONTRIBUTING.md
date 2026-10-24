# Contributing to Linecraft

Use a small, focused change with a reproducible problem and actual validation. Bug reports, minimal synthetic drawings, command compatibility observations, documentation fixes and code are welcome. A report or contribution does not promise a response, merge or release date.

## Run source for development

Normal installed users need no developer tools. Contributors need **Node.js 24 or later** and the tagged source. A code editor is sufficient; Visual Studio is not required for the normal JavaScript/Electron workflow.

```powershell
git clone --branch v1.36.0 https://github.com/MrOweItAll/linecraft-cad.git
cd linecraft-cad
npm ci --no-audit --no-fund
node node_modules/electron/install.js
npm run dev
```

Lockfiles pin the runtime/build/test dependencies. The explicit Electron install step obtains its pinned executable when npm installation has not supplied it. Reuse the development host for iteration; rebuild/reinstall only for release qualification. Main/preload changes may require restarting the host. See [DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md) for the full loop and optional test dependencies.

Start with relevant self-contained checks, for example:

```powershell
node --test tests/ordinary-grip-input.test.mjs
```

Use the generated public-gate entrypoint documented in DEVELOPER-GUIDE.md for the public checkout; do not assume a historical private-fixture qualification command is a supported public gate. Actual desktop/PDF and full Windows release checks have additional documented prerequisites. Python test readers are not CAD runtime requirements. Record the exact commands, actual results and checks not run; passing engine tests alone is not installed Windows qualification.

## Change boundaries

- Preserve native persistence, existing architectural ownership, layouts/physical viewport scales and grouped Undo/Redo. Explain any intentional compatibility change.
- Prefer pure previews and the existing validated engine operations over direct document replacement. Scripting should edit the open drawing through the checked protocol.
- Test in disposable synthetic drawings and isolated profiles. Preserve older reference bytes and failed-run evidence. Do not close, replace or upgrade another person's active project as a test setup shortcut.
- Implement original code and interface assets. Describe observed command behavior or link published references; do not extract Autodesk code, fonts, artwork or proprietary blocks.
- Keep client drawings, addresses, credentials, machine-specific project paths, profiles and temporary control descriptors out of commits and attachments. Review generated files before submitting.
- Keep third-party licensing/source notices with their components. Original contributions use the project's [MIT license](LICENSE); do not import incompatible or unreviewed material.

## Pull requests

Describe the concrete before/after behavior, changed scope, meaningful test results and remaining limits. Include synthetic screenshots or sample files only when they help review. Separate source, packaged, visible installed and PDF evidence; explicitly identify any inherited unchanged test stages. Security-sensitive details belong in the [security reporting flow](SECURITY.md).
