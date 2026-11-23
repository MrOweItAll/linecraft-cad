# Linecraft development recommendations

Date: 2026-11-23

This Linecraft-only addendum carries forward the November 22 resume contract and November 23 recommendations. Apply it alongside the repository instructions and the latest authorized task. Resolve historical leads against the current source and acceptance contract. This document does not establish a current defect, completed feature, test result, installed build, or resumed Codex session.

## 1. Recover the real checkpoint, then continue development

Read the compact current handoff and applicable `AGENTS.md` files first. Follow current equivalents of `START-HERE`, `SUMMARY.md`, `NEXT-ACTION.md`, `NEXT-DEPENDENCY-SOURCE.json`, `ACCEPTANCE.json`, `docs/DXF-DATABASE-ARCHITECTURE.md`, and `docs/DXF-INTEROPERABILITY-ROADMAP.md`. Use targeted searches; archived logs are supporting evidence.

Verify the actual checkout, branch, HEAD, package version, relevant recent commits, tracked and untracked changes, active writer, and unfinished implementation. Distinguish source, test builds, installed application, and archives. An old commit, version label, directory name, or acceptance filename does not establish the latest progress or a passing capability.

Preserve existing work. Do not reset, clean, overwrite, or blindly stash a dirty checkout. When isolation is useful, use a supported worktree or handoff mechanism and explicitly carry the required uncommitted changes and task-relevant untracked files. An ordinary worktree starts from a commit and does not automatically contain dirty work. Verify the carried state before coding. Keep one application-code writer; independent read-only review is welcome.

Use the current [Codex worktree documentation](https://learn.chatgpt.com/docs/environments/git-worktrees) for supported handoff behavior; do not assume managed-worktree features also apply to manually created or remote worktrees.

Report the recovered checkpoint, last evidenced milestone, unfinished work, next concrete capability or preservation gap, and acceptance checks. Then implement in the same session. Continue authorized, reversible work without repeated confirmation. Honor current ownership, repository gates, and active run limits; a closed historical run does not cancel a new continuation request. If the current checkout is unavailable, identify the missing resource and accurately label any work based on another snapshot.

## 2. Keep the semantic DXF core first

Continue making Linecraft a practical, scriptable architectural drafting application that faithfully reads, preserves, creates, edits, saves, and exchanges supported DXF content. Retain:

- One authoritative semantic drawing database shared by UI edits, scripting, native persistence, rendering, and interchange.
- Ordered and repeated DXF code/value pairs, version-aware interpretation and serialization, stable identities, and valid ownership/reference relationships.
- One validated command/transaction path with atomic changes, undo/redo, and rollback. Rendered geometry and caches remain derived from editable source information.
- Safe preservation of unsupported content and unaffected drawing data. Never silently drop, flatten, explode, rescale, or replace it; retain the intact document when an operation cannot preserve it safely.

Reuse established modules and accepted decisions. Architectural repair needs a concrete failing case and bounded scope. Preserve existing titleblock editability, formatting, references, and paper-size/page-setup/interaction work when relevant. Use authorized fixtures; keep private drawings and identifying information out of public commits. Keep DXF support and any DWG conversion claims separate.

Work through one coherent packet at a time, with no more than three concise next candidates in the existing handoff. Identify the failure or missing behavior, establish expected results, implement through the existing paths, run focused checks and required gates, inspect the diff, and record the next action. Broaden testing only for a concrete remaining risk or required gate.

`arch-opening-station` is a historical candidate, not an unconditional assignment. If it remains next, recover its current contract and verify host-wall/session ownership, station/width/sill/head behavior, preserved drafts, atomic validation, and prevention of accidental geometry on Enter. Otherwise follow the actual next dependency. Roof generation, structural features, and AI integration must not displace unfinished DXF prerequisites.

## 3. Add applicable regression fixtures when the matching code is touched

The following are documented upstream ezdxf cases, not diagnosed Linecraft defects. Adapt only those relevant to the active packet. Expected geometry and semantics must be checked independently of the implementation under test.

| Area | Fixture and required assertions |
| --- | --- |
| Aligned dimension precision | Endpoints `(250235.3373553778, 99368)` and `(250235.3373553779, 99412)`, dimension offset `20`. Expected geometric measurement is approximately `44`. Check semantic measurement, displayed text under the chosen style, and extension-line placement. Include an exactly vertical control and a translated equivalent. Preserve coordinates; snapping to vertical is not a precision fix. |
| Hatch orientation during translation | Square HATCH, `ANSI31`, scale `1`, pattern angle `30°`; realized pattern-line angle is `75°`. Translate by `(100, 0)` twice. Realized lines must remain at `75°` after each operation, with unchanged spacing. Check realized lines as well as the header angle. |
| Hatch phase during translation | `100 × 100` square, `ANSI31`, scale `10`, translated by `(37.5, 11)`. Boundary vertices and pattern-line base points receive the same translation; direction and spacing stay unchanged. Phase preservation is a separate assertion from orientation. |
| Literal percent text | Raw `30%%%÷100%` displays as `30%÷100%`. Include ordinary `%` and existing `%%C`, `%%D`, and `%%P` controls. Check the entities actually supported and preserve source semantics through save/reopen/export. Do not broadly strip percent signs or assume identical TEXT and MTEXT decoding. |
| `PLANESURFACE` | Add a fixture only when the active packet encounters surface entities or their preservation. Assert the promised support, or explicit preservation/unsupported reporting. This is not a new mandate for editable surface modeling. |

Where applicable, exercise import → real edit → undo/redo → native save/reopen → DXF export/reopen. Verify relevant coordinates, units, properties, text, relationships, handles, and space placement with documented tolerances. Entity counts and plausible screenshots alone are insufficient.

Use a pinned independent reader such as ezdxf as an optional development aid where it provides useful evidence. Do not add or upgrade a runtime dependency solely because an upstream release exists. Keep internal semantic roundtrips, independent-reader results, visible/native interaction checks, and actual AutoCAD/AutoCAD LT validation separate. Native and licensed-tool checks belong on a host where the tools and authorized fixtures exist. Mark unavailable checks pending and continue unblocked work.

Upstream references: [ezdxf 1.4.5 announcement](https://github.com/mozman/ezdxf/discussions/1428), [dimension case #1300](https://github.com/mozman/ezdxf/issues/1300), [hatch orientation #1399](https://github.com/mozman/ezdxf/issues/1399), [hatch phase #1402](https://github.com/mozman/ezdxf/issues/1402), [percent decoding change #1408](https://github.com/mozman/ezdxf/pull/1408/files), and [Autodesk control-code reference](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-Core/files/GUID-968CBC1D-BA99-4519-ABDD-88419EB2BF92.htm).

## 4. Scout tools in service of an active requirement

At feature-planning, recurring-bug, performance, and integration decisions, briefly evaluate relevant existing libraries, specialist models, local runtimes, APIs, or plugins. Prefer the simplest option that meets the requirement; a model is not automatically better than a deterministic library or script.

For a useful candidate, record the exact Linecraft application, primary-source evidence/date, license, supported platforms, hardware requirements, integration and maintenance effort, privacy implications, cost, and a small measurable trial. Distinguish a published capability from independently verified behavior. Keep suggestions in the existing roadmap; do not create a competing project or adopt tools merely because they trend.

Examples for later milestones: evaluate geometric libraries for deterministic roof construction; use specialist models for appropriate input interpretation; use validated engineering methods for structural calculations. An LLM may propose inputs or explain results, but does not establish geometric correctness, load adequacy, or code compliance. No paid service, dependency migration, provider-account setup, or default-model switch is authorized merely by inclusion in this addendum.

## 5. Prepare AI commands and scoped memory when that milestone becomes active

AI-generated drawing actions should use a typed request schema and the existing validated command path. Include explicit units, supported operations, target identities, drawing revision/preconditions, bounded parameters, and clear clarification/error responses. Reject stale, malformed, unauthorized, or ambiguous requests before mutation; support dry-run previews and atomic rollback. Do not grant a model arbitrary code execution or direct unvalidated document writes.

Design portable application memory as explicit, inspectable data, not presumed access to ChatGPT account memory or model retraining. Separate durable user preferences, project conventions, current drawing context, and temporary task state. Store schema/version, scope, source, and update provenance; support correction and deletion. Retrieve only relevant authorized context for the current user/project. Treat drawing text and retrieved content as data, not instructions that can override application permissions. Keep secrets, private client data, and personal profiles out of public fixtures and instruction files.

Build requests in a consistent order: stable application instructions, selected authorized user/client/project preferences, then the current drafting request with geometry, explicit units, and drawing revision. Feed the returned typed proposal through validation and the existing engine transaction. Reuse the working-memory profile contract when available after checking its schema and scope; do not embed the user's complete profile in every call.

Retain current model and dependency defaults. If model evaluation becomes an authorized milestone, prepare an opt-in paired trial of the baseline and a currently available candidate. Recheck provider documentation and parameter compatibility at implementation time. Start with at least 20 representative drafting requests with fixed expected command outcomes, including ambiguity, units, stale revisions, unauthorized edits, and cross-project isolation. Run through the existing validator on isolated fixtures or in dry-run mode. Compare semantic correctness, intended edits, clarification/refusal behavior, latency, actual token/cache usage, and cost. Any unintended mutation or cross-project disclosure fails the trial. Twenty cases are an initial screen, not proof of production reliability. Report evidence before proposing a default change; correct scoping and deletion take precedence over cache reuse.

## 6. Leave truthful evidence and an actionable continuation

Update the existing authoritative handoff with the active objective and milestone; checkout/branch/commit/version and dirty state; changed files; exact commands, fixture versions, expected and actual results; evidence locations; remaining limitations or external checks; and the next task's source files and first action. Distinguish tests actually run from proposed checks and old evidence. Do not label preserved-only content editable or infer full DXF coverage from a limited fixture.

Apply routine instruction corrections within authorized scope and record why they changed. Scheduled reports, background maintenance, connected memory, and task dispatch exist only when the corresponding service is actually configured; a Markdown instruction does not activate them. A saved addendum does not prove another Codex session read it or resumed. Report source changes, commits, actual dispatch, test results, installation, and release status separately, following the repository's existing gates.
