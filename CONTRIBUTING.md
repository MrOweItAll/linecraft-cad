# Contributing to Linecraft CAD

Thanks for your interest! Linecraft is a small, independent, MIT-licensed project, so focused contributions and clear bug reports help a lot.

## Ways to help

- **Try it and report bugs.** Use [Issues](https://github.com/MrOweItAll/linecraft-cad/issues/new) with: Linecraft version, Windows version, the exact commands you typed, what you expected and what happened. Synthetic sample drawings are welcome; please don't attach confidential or proprietary drawings.
- **Docs and examples.** Command-sequence examples, clearer QUICK-USE steps and typo fixes are great first contributions.
- **Code.** Bug fixes, small command options and tests.

## Good first issues

Look for issues labeled [`good first issue`](https://github.com/MrOweItAll/linecraft-cad/labels/good%20first%20issue). These are scoped so you can finish them without knowing the whole codebase. Comment on the issue before starting so work isn't duplicated. If none are open, docs/example improvements are always welcome.

## Linux port — interest wanted

Linecraft is Windows-only today; a Linux build is planned. The app is Electron-based, but the build, installer, tests and the bundled LibreDWG helper currently target Windows x64. If you'd like a Linux build (or can help test or package one — AppImage/deb), add a 👍 or comment on the Linux tracking issue, or open one describing your distro and use case. Please don't claim Linux support in docs until it ships.

## Development setup (Windows x64)

Requires Node.js 24+.

```powershell
npm ci --no-audit --no-fund
node node_modules/electron/install.js
npm test
npm run dev
```

See the README "Build and iterate on Windows" section and [tests/README.md](tests/README.md) for the full gate.

## Pull requests

1. Fork and branch from `main`.
2. Keep PRs focused; describe what changed and how you tested it (`npm test` at minimum).
3. Add or update tests for behavior changes.
4. Don't add Autodesk code, artwork, fonts or other assets, and don't include private/proprietary drawings or screenshots.
5. By contributing you agree your contribution is licensed under the project's [MIT License](LICENSE). Bundled third-party components (GNU LibreDWG, libiconv) keep their own licenses.

## Conduct

Be kind and constructive. Harassment or personal attacks aren't welcome.
