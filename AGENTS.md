# Codex instructions for Linecraft

## Start here

Read [Linecraft development recommendations](docs/LINECRAFT_DEVELOPMENT_RECOMMENDATIONS_2026-11-23.md) before continuing application development. It carries forward the authorized DXF development objective and the November 23, 2026 recommendations. Apply it with the user's current request, applicable parent/directory instructions, and the verified current project handoff.

Read `CONTRIBUTING.md` and `DEVELOPER-GUIDE.md` for the checkout's development and verification workflow. Historical release instructions and test counts describe their named versions; verify their applicability to the actual checkout.

## Recover, preserve, then implement

- Identify the actual source checkout, branch, HEAD, package version, dirty changes, relevant untracked files, active writer, and latest acceptance/next-action record before editing.
- A public branch may lag a newer local checkout. Do not replace newer local source or unfinished work with this branch. When adopting these instructions into an existing checkout, merge the relevant guidance with its existing `AGENTS.md` and handoff; never overwrite local instructions blindly.
- Preserve all existing work. Do not reset, clean, overwrite, or blindly stash it. If using a worktree, explicitly carry and verify the required uncommitted state; a worktree created from HEAD alone is insufficient.
- Report the recovered state and next concrete capability briefly, then continue implementation in the same session. Use one application-code writer, one active implementation packet, and no more than three next candidates. Respect actual current ownership and repository gates.
- If the current checkout is inaccessible, identify that limitation. Work on another snapshot must be labeled accurately; do not represent it as continuation of the inaccessible checkout.

## Development order and contracts

1. Continue the next verified unfinished semantic DXF/editing dependency. `arch-opening-station` is a historical lead to verify, not an assumed current assignment.
2. Keep one authoritative semantic drawing database and the shared validated command/transaction path for UI, scripting, persistence, rendering, and DXF interchange. Preserve identities, owners/references, ordered/repeated group codes, units, unsupported data, and undo/redo/rollback.
3. Add the applicable dimension, hatch, or text regressions in the linked recommendations when the affected feature is touched. Upstream defects are useful fixtures, not proof of a Linecraft defect. Keep any independent reader a development dependency unless a separate runtime need is established.
4. Evaluate tools when an actual requirement benefits. Keep roof geometry and structural computation grounded in deterministic algorithms and validated numerical methods. AI may interpret requests or explain results; its output must pass the existing typed validation and command path.
5. Prepare scoped application memory and opt-in model trials only when those milestones become active. ChatGPT memory is not automatically available to an application's API. Do not introduce paid services, change default models, or migrate dependencies solely because they are mentioned in recommendations.

## Verification and handoff

Use focused meaningful checks and required project gates. Where applicable, exercise import, a real edit, undo/redo, native save/reopen, DXF export/reopen, and independent inspection. Keep preservation, rendering, editing, internal roundtrip, independent-reader, and native AutoCAD verification separate. Record exact commands, fixtures, results, limitations, and the next first action in the existing handoff.

Use synthetic or explicitly cleared public fixtures. Keep client drawings, credentials, personal profiles, machine-specific paths, and private evidence out of public commits. Preserve existing license and release requirements. Documentation edits alone do not establish application tests, installation, release readiness, or successful dispatch to another Codex session.
