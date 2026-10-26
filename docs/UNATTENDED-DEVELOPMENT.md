# Bounded local development scheduling

The owner may authorize a recurring task in the desktop app to resume the existing
development chat. A chat or this document alone does not enable background work.
The private quality pointer records the actual task, cadence, runbook, work queue
and executed evidence. Keep the computer awake and the desktop app running for
local scheduled work. Pause or delete the task from the app's Scheduled view.

## Ownership and scope

Every manual or unattended development run and future coordinated native session first
acquires the same exclusive outer development-session lock, then checks the native
and QA gate markers. Create the outer lock exclusively; never replace a holder.
The existing QA lock prevents QA overlap only and does not grant source ownership.
An ownership conflict means leave the checkout untouched. A setup helper's PID can
exit while its coordinating chat is still active, so a dead helper PID or old
timestamp alone does not prove a stale lock. Reconcile chat/run/process evidence
before preserving and archiving a stale owner.

Use one code writer and independent read-only review. Each wake handles a focused
issue or reviewable milestone, at most three completed items, at most two distinct
repair attempts per issue, and 50 minutes of active work. Give tests finite
timeouts, preserve failures and stop owned children only. Checkpoint the work,
record the next step and release owned locks before exit. Continue another safe
item when an issue needs unavailable access or a domain decision.

Read the current source identity, backlog and private pointer before every run.
Use independent expected results and meaningful regression checks. Run only the
affected gates; do not repeatedly rebuild or rerun unchanged passing suites.
Treat a changed candidate/version as a deliberate manifest review, including the
explicit CI manifest selection. Preserve historical baseline and candidate bytes.

Installed application/profile changes, client drawings, unattended native input,
installation, publication, pushes/tags/merges, outbound messages and paid service
provisioning are outside the recurring authorization. Hidden source/unpacked tests
use isolated profiles and independently authored synthetic drawings. Native input
and installed/upgrade acceptance remain separately coordinated activities.

## Evidence and notification

Keep immutable private run receipts, source identity, actual test commands/results,
hashes, compatibility limits and next tasks. Public commits contain sanitized
source, fixtures and documentation only. Do not upload logs or client content.

Report meaningful completions, new failures/blockers or required user decisions.
Stay quiet when there is no actionable change or another run owns the checkout.
Pause the recurring task when the authorized safe queue is exhausted or all useful
work needs user action. A finished wake does not mean every drafting requirement
is complete, and does not establish installed or daily-use readiness.

Record manual prompt/policy trials separately from actual scheduler-triggered
executions and from remote CI. An enabled task is configuration evidence; only an
observed scheduled run establishes that its trigger executed successfully.
