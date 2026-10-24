# Develop and verify the public checkout

These are **developer** prerequisites. The normal Windows installer bundles its runtime and needs no Node.js, Python or Visual Studio for CAD.

## Bootstrap locally

Use Node.js 24 or later and the tagged `v1.36.0` checkout. Open PowerShell in the directory containing `package.json`:

```powershell
npm ci --no-audit --no-fund
node node_modules/electron/install.js
npm run dev
```

The lockfile pins the dependencies. The prerelease security refresh targets Electron **44.9.3**, with related locked development-dependency fixes; use the tagged lockfile and verify the actual runtime recorded by the checks. The explicit Electron install step obtains its pinned binary when npm installation did not supply the executable. Development uses that local runtime, not a private workspace or another installed CAD product. A code editor is sufficient for normal JavaScript/Electron work; Visual Studio is not a prerequisite.

Use the source host for repeated code/test cycles. Renderer helpers and styles participate in the development reload loop. Main/preload changes require restarting the host. A recovered development checkpoint retains accepted drawing content/view but cancels active prompts and resets Undo history; it is not a substitute for saving project revisions. Installers belong to release qualification, not every edit.

## Public verification scope

The public checkout uses a **separately generated bounded verification tool**, exposed through these package scripts:

```powershell
npm test
npm run test:desktop
npm run unpacked
npm run release
```

`npm test` selects the bounded public core/pure checks. `test:desktop` exercises the actual source application and PDF path. `unpacked` creates the unpacked application; `release` creates the Windows installer under the public build tool's checks. Read each generated report for the actual executed scope and prerequisites. The source/artifact identity verifier is:

```powershell
node tools/verify-public-source.cjs
node tools/verify-public-source.cjs --packaged
```

Use only distributable fixtures and preserve reports identifying exact inputs, executed checks, omissions and outputs. Do not substitute an older private-fixture gate or infer a public result from the original desktop qualification.

The current public plan selects 306 portable core cases from the 318-case source, with twelve private-reference cases explicitly excluded, eleven self-contained pure suites, and source/unpacked ordinary-grip application checks with actual PDF auditing. The excluded cases are omitted by selection; they are not twelve executed TAP skips. Planned counts are not passing results. Public-gate execution and conditional clean CI install/uninstall are not claimed until their own completed reports exist. Read the release's [Public-Beta-Verification.json](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Public-Beta-Verification.json) for the separately recorded public-checkout scope and results.

The historical **177-stage** desktop qualification used Electron **44.7.0**: **128 successful unchanged stages were inherited and 49 were newly executed** under reviewed continuation. Its visible installed 14/11/PDF9 checks are historical evidence for that vendor build. The refreshed beta preserves application code/resources while changing vendor dependencies, so fresh public tests, actual runtime versions, dependency-audit status and visible installed review must be recorded separately. Neither the original 177-stage total nor its installed checks establish the refreshed build's result.

For a small geometry/input change, a self-contained check can run directly:

```powershell
node --test tests/ordinary-grip-input.test.mjs
```

Actual desktop tests use disposable drawings and isolated profiles. PDF inspection may require a separate Python environment with the reader dependencies documented by the verification tool. Those are developer test dependencies; ordinary CAD installation and structural JSON export do not require them.

## Build and release boundaries

Use only the public build entrypoints listed in the package scripts and their documented prerequisites. Bind generated source, unpacked runtime, installer and checksums to the same reviewed inputs. Confirm actual source/packaged behavior and native installed Save/reopen/Undo/PDF separately. A successful build, pure engine test or hidden renderer test does not establish visible installed Windows behavior.

Public releases should identify the tag/commit, source and asset checksums, dependency/license notices, actual executed checks and any inherited stages. The `v1.36.0` GitHub release is marked **prerelease** and does not replace the older stable default branch/Latest channel. The application binary reports version 1.36.0.

Keep profiles, connection descriptors, credentials, client/project drawings and private evidence outside the checkout and release assets. Only synthetic/redacted examples belong in commits or public reports. Original Linecraft code uses MIT; bundled third-party components retain separate notices and source obligations described in [the source guide](docs/THIRD-PARTY-SOURCE.md).
