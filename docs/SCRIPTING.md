# Linecraft scripting foundation

This development branch adds structured scripting of the drawing already open in Linecraft. The existing engine remains responsible for drafting, property validation, architectural generation and Undo/Redo. A revision edits existing objects by ID. It does not recreate the document or replace the editor.

This extension has been integrated into the active Roof + Space R4 source without replacing its newer geometry, units, layouts or native format. Engine/API and real loopback CLI tests have run on Windows. Consult the accompanying release verification report for the exact installed version and completed visible, native-save and PDF checks; a source checkout alone does not update the installed application. The original PR was based on the earlier R3 branch.

## Local setup for Codex

From a Windows checkout containing these changes, install the repository's pinned dependencies as described in README. Launch the pinned Electron runtime directly so the scripting flag reaches the application:

```powershell
$connection = Join-Path $env:TEMP ("linecraft-control-" + [guid]::NewGuid().ToString() + ".json")
& .\node_modules\electron\dist\electron.exe .\desktop\main.cjs "--linecraft-control-file=$connection" --linecraft-no-watch
```

The normal drawing window opens. Give the same connection-file path to a second local terminal or the Codex task. Scripting is disabled on ordinary launches. The connection descriptor is created exclusively, contains a temporary authentication secret, and is removed synchronously on a normal quit. Keep it outside the repository and client deliverables. On Windows, use a private per-user temporary directory; the file's `0600` creation mode does not replace Windows folder ACLs. After a forced process termination, remove that stale file and choose a new path. A startup descriptor conflict disables scripting for that launch and leaves the drawing window available; use a new path when relaunching.

For the installed Windows application, save and close the current Linecraft window, then launch the installed executable with the same explicit flag. The default per-user installation path is shown below; use the actual installed path on this machine. Omitting `--user-data-dir` preserves the ordinary application profile. Use a disposable drawing for acceptance, keep its backup and never place the connection descriptor in a source archive or release ZIP.

```powershell
$connection = Join-Path $env:TEMP ("linecraft-control-" + [guid]::NewGuid().ToString() + ".json")
& "$env:LOCALAPPDATA\Programs\Linecraft CAD\Linecraft CAD.exe" "--linecraft-control-file=$connection"
```

```powershell
node tools/linecraft-control.cjs $connection describe
node tools/linecraft-control.cjs $connection snapshot
```

The controller uses an authenticated HTTP endpoint bound only to 127.0.0.1 and an ephemeral port. Browser-origin requests are rejected. It accepts JSON operations, not executable JavaScript, shell commands or file paths. Save/Open/PDF retain the existing application controls and native file validation; arbitrary filesystem operations are not exposed through this protocol.

Codex running locally can invoke this CLI while the user reviews the same open drawing. A cloud ChatGPT session cannot reach the Windows computer's loopback address by itself; it still needs an explicitly connected local tool/connector. This change does not create that remote connection or a cloud relay.

## Protocol and revision cycle

The in-process entry point is `window.linecraft.scripting.request(request)`. The CLI sends the same version-1 request to that entry point in the live renderer and prints its JSON response.

1. Read `describe` and a `snapshot`. Snapshots contain copies, not writable references. Optional `params.ids` limits entity output. `params.includeDocument: true` includes the complete serialized native document, including layouts and architectural source.
2. Map the client instructions to explicit object IDs and allowed operations. Retain the input file and identify the actual edit baseline.
3. Submit `preview` with the returned `baseToken`, a descriptive label and the proposed steps. Inspect all changed/deleted/added entities and changed document-field names. Preview does not edit the live document or its Undo stack.
4. Submit `apply` with the same `baseToken`, steps and a unique `requestId`. If the document changed, read it again and review the differences before retrying.
5. Review the result in the actual window. Save the report beside the project revision, then Save As and plot through the established controls. Client issue approval remains the user's decision.

The token includes an editor-session identity and a SHA-256 digest of the serialized drawing. A replaced drawing or changed document rejects an old token. Requests are serialized; mutations are rejected during active commands, gestures, navigation drafts, dialogs and file operations. While a request reads its token, a concurrent document edit also causes a rejection.

Example request file, after substituting the token and IDs read from this drawing:

```json
{
  "version": 1,
  "method": "preview",
  "params": {
    "baseToken": "COPY_FROM_SNAPSHOT",
    "label": "Client revision: correct and reposition one note",
    "steps": [
      {"op": "text", "id": "COPY_NOTE_ID", "patch": {"text": "Corrected note"}},
      {"op": "text", "id": "COPY_NOTE_ID", "patch": {"position": {"x": 12, "y": 6}}}
    ]
  }
}
```

```powershell
node tools/linecraft-control.cjs $connection preview .\revision-preview.json
```

For Apply, change `method` to `apply`, add a unique top-level `requestId` such as `revision-2026-001`, and retain the base token. The steps stage in an isolated editor. A rejected step or unfinished command discards the entire proposal. Successful content changes commit one normal Undo record; preexisting Undo history remains intact. Rendering, dirty status and development checkpoints refresh through the existing UI update path.

Successful mutation responses are retained for the latest 64 request IDs during this scripting API's lifetime. Repeating an identical retained request returns the original response without applying it again. Reusing an ID with different content is rejected. This is bounded, in-memory retry protection, not a durable exactly-once ledger. After a timeout or application restart, inspect the drawing before creating a new revision ID.

Undo/Redo requests require their own `requestId` and the latest `baseToken`, for example:

```json
{"version":1,"method":"undo","requestId":"undo-revision-001","params":{"baseToken":"COPY_LATEST_TOKEN"}}
```

## Version-1 operations

| Operation | Required fields | Existing engine behavior |
| --- | --- | --- |
| `text` | `id`, `patch` | TEXT/MTEXT position, content, height, rotation, style; MTEXT width |
| `dimension` | `id`, `patch` | Existing dimension properties and text override; dimension-kind validation |
| `grip` | `id`, `index`, `point` | Existing grip edit and resource validation |
| `radius` | `id`, `radius` | Existing circle-radius edit |
| `properties` | `ids`, `patch` | Layer/color/lineweight/linetype with explicit complete selection |
| `select` | `ids` | Select all requested IDs or reject; no silent partial selection |
| `commands` | `tokens` | Core command tokens; last command must finish before committing |
| `architecture` | `operation` | Existing semantic architectural edit API; derived geometry stays owned |
| `space` | `space`, optional `layoutId`, `viewportId` | Choose the staging edit context for model or paper objects |

Unknown operations/fields are rejected. Existing lock, visibility, ownership, unit and resource rules apply. Coordinates and numeric property values use native model units, or paper millimeters for paper entities; read the drawing first. Text/command input can use only units supported by the existing engine. Generated architectural meshes cannot be edited as ordinary objects. `space` selects the staging context without navigating the user's live view when committed.

There are at most 500 steps and one million characters of serialized steps; each command-token step has at most 1,000 tokens. Transport requests are bounded to 2 MiB. Snapshot reads should use IDs when only a few objects are needed. The report includes full before/after data for changed ordinary entities and names of changed document fields. Inspect the full document when a field such as architecture, layouts or styles changes; this first version does not produce a nested field-by-field audit for those structures. Store client instructions and revision evidence in private project files, not this public repository.

## Verification and Windows handoff

The integrated scripting suite has 14 engine/API tests and 10 transport tests. Actual Windows execution passed all 24, including a real CLI → authenticated loopback server → live editor API edit. The checks cover atomic rollback, unchanged unrelated objects and R4 gable source/derivatives, one Undo/Redo, existing history, locked objects, paper/model preservation, stale/session tokens, duplicate retries, concurrent requests, fixed dispatch with code-like text, browser-Origin rejection, descriptor ownership and synchronous shutdown, body-size limits, and CLI validation. These tests do not alone establish visible renderer behavior or successful PDF output. The original PR's portable 33-stage gate is historical evidence, not the integrated Windows release gate.

Before merging into the active Windows implementation, run this acceptance on both source and the unpacked build:

- Open a synthetic native drawing with a boundary line, note, dimension and paper viewport. Start local control with the explicit flag.
- Read object IDs and the base token through the CLI. Preview moving the note and changing the dimension's text override. Confirm no unrelated entities or fields are listed.
- Apply once through the CLI. Confirm the open canvas, Properties, dirty mark and Undo control reflect the same edits. Confirm boundary endpoints, titleblock, viewport scale and architecture are unchanged.
- Repeat the same Apply request; confirm no additional change or Undo entry. Edit the drawing manually and confirm an old-token Apply is rejected.
- Undo once, then Redo once. Save As, reopen and plot a PDF from that same saved drawing. Verify the visible placement, sheet scale and PDF agree.
- Run `npm test`, `npm run test:desktop`, `npm run unpacked` and the installed verification required by the active project. Confirm `linecraft-scripting.mjs` and `desktop/script-control.cjs` are in the packaged files.

The private Windows source may contain newer work than this public branch. Integrate the focused changes; preserve newer Roof + Space work, existing private fixtures and source provenance. No Windows installation, stable release, merge or remote ChatGPT connection is claimed by the portable tests.
