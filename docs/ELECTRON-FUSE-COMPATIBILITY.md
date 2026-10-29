# Electron fuse compatibility inventory

Status: inventory and proposal only. No fuse was flipped, package/dependency changed,
application launched, build repeated or installer replaced. This does not qualify
a hardened release. Version1.36.1-beta.6 remains the current candidate.

## Observed baseline

Read-only inspection of the approved local Electron distribution and the preserved
beta6 QA-unpacked executable found one V1 wire per executable, length9, with
ordered states `101100011`. The installed reader and an independent raw-byte parser
agreed. Exact binary/tool hashes and paths remain in private receipts. These are
observations of those two artifacts, not the installed daily-use application.
The [pinned Electron44.9.3 schema](https://raw.githubusercontent.com/electron/electron/v44.9.3/build/fuses/fuses.json5)
independently defines the same default order and states.

| Index / option | Observed | Proposed first packaged policy | Compatibility basis / remaining work |
|---|---|---|---|
| 0 RunAsNode | on | off | No fork or Electron self-Node dependency found in the59-file production inventory. |
| 1 EnableCookieEncryption | off | preserve off | A storage transition is outside this first policy. |
| 2 EnableNodeOptionsEnvironmentVariable | on | off | No production option/extra-CA dependency found; qualify the final app. |
| 3 EnableNodeCliInspectArguments | on | off | Existing Playwright launch conflicts; see below. |
| 4 EnableEmbeddedAsarIntegrityValidation | off | on | Verify the embedded Windows header hash and disposable-copy corruption rejection. |
| 5 OnlyLoadAppFromAsar | off | on | Production package already uses ASAR; verify fallback rejection. |
| 6 LoadBrowserProcessSpecificV8Snapshot | off | preserve off | No custom snapshot requirement found. |
| 7 GrantFileProtocolExtraPrivileges | on | preserve on | File-origin modules/worker behavior needs a separate qualification before removal. |
| 8 WasmTrapHandlers | on | preserve on | Pinned schema maps this slot; installed fuse helper does not name it. |

The proposed complete wire is `000011011`, not applied. Each observed artifact
therefore has five expected differences from the proposal and four preserved
settings. This comparison is a reference for future readback, not a launch test.

## Production and QA are different callers

The production inventory found no fork/self-Node launch, Node option configuration,
Node inspector or remote-debugging switch. Production child processes are the fixed
bundled DWG reader and the fixed Windows font-registry query; the structural JSON
service does not execute the external adapter. This is a bounded static inventory,
not proof that every dynamic behavior is safe.

Main loads index.html through loadFile and the roof preview uses a relative module
Worker. File-protocol changes need focused module/worker tests. Cookie encryption
also involves a one-way migration; neither transition is selected here. Disabling
RunAsNode does not remove ordinary Node APIs from Electron main, and disabling Node
inspection does not establish rejection of Chromium remote-debugging switches.
See [Electron's fuse semantics](https://www.electronjs.org/docs/latest/tutorial/fuses).

The installed Playwright1.62.1 launcher adds --inspect=0, waits for the Node debugger
and uses it to attach. Existing hidden application flows use that launcher.
[Playwright documents this fuse dependency](https://playwright.dev/docs/api/class-electron).
Consequently those flows cannot qualify the exact proposed inspector-disabled
executable. An inspector-enabled sibling is different evidence. A non-inspector
qualification strategy must be established before applying this policy; no exemption
or silent weakening of the production proposal is selected by this inventory.

## Existing packaging support and the ninth slot

The lock and installed tree already contain builder26.15.3 and transitive
@electron/fuses1.8.0. Builder supports eight lower-camel-case electronFuses options;
it embeds Windows ASAR metadata, applies configured fuses and then signs. No new
package download is needed to configure those eight supported options. The
[builder V26 integration](https://www.electron.build/v26/docs/tutorials/adding-electron-fuses/)
describes that path. Use the packaged copy; preserve the source-development runtime.

The old helper can read all nine raw slots but names and emits only eight. Its
strictlyRequireAllFuses writer mode cannot account for this nine-slot wire, and
builder's normal option schema does not expose that mode. Do not claim it was used.
A bounded implementation with the existing toolchain could preserve slot8 and
independently require exact V1/length9/all-nine-state readback against a reviewed
policy. Unknown version/length/state, a changed preserved slot or an unmapped new
slot must reject qualification. A future toolchain/schema update is separate work.

ASAR integrity needs a matching header hash in the Windows executable resource;
a missing or mismatched hash terminates the app when enforcement is active.
[Electron's ASAR integrity guide](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
describes that requirement. Actual resource/header comparison and rejection behavior
have not been run here. Extra resources such as the converter, DLLs and external
adapter remain outside app.asar; this fuse is not their integrity boundary.

## Required next evidence

1. Define a bounded non-inspector hidden acceptance approach using isolated synthetic
   profiles and existing approved prerequisites. Preserve native/installed approval
   boundaries and keep the optional scripting security issue separate.
2. Freeze independent expectations and failing controls for the full nine-slot policy,
   metadata/header binding and exact artifact identity before a packaging change.
3. Only then prepare a reviewed new candidate identity, apply settings through the
   builder path, read back the final executable and verify normal startup, editing,
   history, Save/reopen, resources and actual PDF output on that exact artifact.
4. Test changed/missing ASAR and fallback resources only on disposable copies; retain
   the original artifact and failures. A general fast pass is not fuse acceptance.

Signing must cover the final modified executable. signAndEditExecutable requests
processing and does not prove a signing identity or valid signature. Fuses do not
replace signing, descriptor privacy, installed/upgrade or client acceptance, release
authorization or daily-use qualification. No existing passing gate is rerun for this
documentation-only inventory.
