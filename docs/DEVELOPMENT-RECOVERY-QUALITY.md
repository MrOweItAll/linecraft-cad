# Development recovery qualification

LC-DEV-001 adds bounded actual source reload/restart coverage and a separate
existing-unpacked saved-file restart case on October26,2026. Source passed4/4 app
stages across3 hidden launches; unpacked beta5 passed2/2 stages across2 launches.
Independent audits passed12 source and8 unpacked measurements, with12 rejected
corrupt-observation controls per variant. There is no runtime or schema change.

Comparisons require exact complete parsed JSON. Constructor property ordering can
change serialized bytes; per-checkpoint hashes record those actual bytes. Generated
LINE fields can change from id/type/start/end/layer to id/type/layer/start/end.
No byte-identical file claim is made across reconstruction.

## Expected contract

The development guide promises accepted drawing content/view recovery, active
prompt cancellation and Undo-history reset. These are separate assertions.
Reset history does not mean accepted geometry was discarded. Dirty state and
saved filename are checked independently: top-level model navigation in this fixture, selection and history do not
define the saved-content fingerprint. Development checkpoints supplement saved
project revisions; they do not establish crash or power-loss durability.

The frozen8,437-byte Linecraft/1 input has SHA-256
cde4af9d2902a0c3055f4f57e6c989dc1de45f691f96112333455a34b11462c0.
It reuses the original synthetic two-A3-sheet definitions without changing them,
with a model-active 240-inch ruler and viewport center(120,0),scale2. Independent
literal expectations include sheet order B/A, ten paper entities, markers and
borders, locked1:96/1:48 viewports and420x297mm paper. Actual typed additions are
(300,20)-(330,60),length50; (400,0)-(410,0),length10; and, for source restart,
(500,0)-(500,20),length20. A24x12 CSS-pixel middle drag must produce center(108,6)
at scale2. The full initial geometry oracle ran before the first app launch.

## Actual source checks

1. Open the frozen input and Save As an owned native copy. Make accepted edits,
   leave the second LINE prompt active, navigate and enable grid/snap/ortho.
   Trigger the real development filesystem watcher by changing only the source
   stylesheet timestamp. Require actual main-frame navigation and watcher output.
   Complete parsed native state, navigation, settings, paper definitions, dirty
   state and name remain exact. The accepted segment survives; command and
   selection clear; Undo/Redo both become unavailable. Actual Undo/Redo actions
   must leave accepted content unchanged.
2. Save clean, create and undo a temporary line to establish a real redo branch,
   then select all3 model entities. A second actual watched-file reload preserves
   the complete clean state while clearing selection and both history stacks.
3. Add the20-inch line. Wait until the actual development local-storage checkpoint
   text equals the complete dirty document, and verify the private profile's saved
   target. Flush storage and perform a controlled host exit. A new process on the
   same disposable profile recovers exact content/view/name and dirty state, with
   fresh history. Save writes the already associated synthetic native copy with
   zero Save chooser calls; the complete saved JSON equals accepted state.
4. Close intentionally while clean, then launch again. The next document is blank,
   clean and unrestored, and the development-profile saved target is null. This
   checks intentional clean close, not a dirty-discard or recovery-error decision.

The two stylesheet watcher events were observed. Stylesheet bytes and original
mtime are exact after cleanup. Original atime and numeric readback are retained
privately; their0.0002ms difference is filesystem timestamp quantization, so exact
atime preservation is not claimed. No other source runtime input changed.

## Separate unpacked behavior

Packaged beta5 disables development checkpoints. Its dev-reload action returned
false and left complete accepted content/view and existing history unchanged.
After Save As and a normal clean close, a new process starts blank with fresh
history. Explicit Open of the saved synthetic file restores its complete contents
and navigation. No development path record is created. This qualifies saved-file
reopen across a normal process restart, not automatic packaged unsaved recovery.

## Independent evidence and safeguards

audit-reload.py uses only the Python standard library and imports no product
geometry/normalization code. It binds producer JSON before audit, input, every
complete checkpoint and saved output by SHA-256:13 source and9 unpacked bindings.
Ten source and six unpacked state checkpoints are checked against literal initial
geometry, permitted typed additions, exact field preservation and declared runtime
contracts. Twelve copy-only negative controls per variant reject wrong ruler
length, lost accepted geometry/navigation/layouts, incorrect dirty/name state,
retained prompt/selection/Undo/Redo, saved corruption and nonboolean dirty flags.
These validate the independent reader; no failing product regression or product
repair is asserted. A separate read-only review recomputed the actual bindings,
geometry, transitions, saved/checkpoint content and isolation observations.

Every app ran hidden/offscreen on pinned Electron44.9.3 with a disposable profile,
owned chooser replies and blocked clipboard functions. Five launches recorded zero
visible/show events, observed external requests, page errors and clipboard calls.
No optional scripting control endpoint was created. The210s app watchdog and280s
outer wrapper bound each variant; operations/navigation/quit have finite waits.
Fallback termination is restricted to the owned child PID/tree. Original results,
fixtures, manifests, installer artifacts and the historical dev-reload suite remain
unchanged. Installed app, normal profile, Windows file associations, client drawings,
open/unsaved work and native desktop input were not modified.

The active59-runtime/12-resource beta5 manifest and unpacked archive were checked
before/after each variant. Existing full candidate37/37 and648 selected portable
results were preserved; no unchanged full gate, rebuild or installer run occurred.
The new three test files are fingerprinted auxiliaries for future gates. This
explicit local workflow is not added as a default CI/application stage.

## Reproduction and limits

Acquire the shared exclusive development session lock and ensure no other source
host uses the checkout before source mode, because the actual watcher test changes
and restores stylesheet mtime. Use approved local Windows prerequisites, source
Electron or an existing QA-unpacked executable, and a unique ordinary-grip- prefix:

    node tests/reload-workflow.cjs EXE SOURCE_ENTRY_OR_EMPTY UNIQUE_PREFIX qa/CANDIDATE-SOURCE-1.36.1-beta.5.json

Source mode uses desktop/main.cjs with the watcher enabled. Unpacked mode requires
an executable inside an existing QA run. Audit uses the existing local Python venv
or CAD_PYTHON. Keep the original native file untouched; only owned copies are saved.

Actual main/preload/helper code changes, cache invalidation, pending Save As/editor
draft deferral, invalid/quota-limited/stale checkpoints, dirty-discard close,
concurrent external modification, crash/forced kill/power-loss recovery and general
architecture/image/3D workloads are outside these checks. No font/PDF/appearance
claim is added. Native beta5 warning/dialog and installed/upgrade acceptance remain
pending; daily-use readiness is false. Next safe ordered milestone: durable local
drafting/development request and progress protocol, with no outbound relay enabled.
