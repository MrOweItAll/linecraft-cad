# Bounded import work and trusted cancellation

Beta13 runtime commit `9fa9b5bc6c7a02fae5d38c1dd437df57ae29838d` implements the
bounded [ADR-002](ADR-002-IMPORT-WORK-CANCELLATION.md) source contract. LC-REL-04
remains partial outside this envelope. One coherent repair approach is used and
at most one remains; do not spend another without new independently failing evidence.

## Enforced work and transport bounds

`importDXF` shares an inclusive default of1,000,000 decoded-record-plus-INSERT-cell
units across recursive siblings, model and paper. Skipped entries and empty cells
cost units. `workBudget.maxUnits` may tighten the bound using a positive safe
integer at most the default. Invalid overrides produce IMPORT_BUDGET_INVALID;
exhaustion produces IMPORT_WORK_LIMIT and returns no partial anchor document.
Module-private error identity passes fatal work/cancellation errors through nested
per-record catches; a foreign helper error with the same public code remains a
soft skip. Existing byte/output/entity/depth/cycle/array/aggregate geometry limits
remain separate and unchanged.

Logical complete group pairs now have the same one-million admission decision
with or without a final transport newline. LF, CR, CRLF, CRCRLF and BOM controls
preserve ordinary literal geometry; large LF and CRLF boundaries are pinned.
This reader correction does not establish a historical active-drawing loss.

The default fixture independently costs `1+999+999*1000`:999 LINEs from (1,2) to
(3,2),998,001 skipped POINTs. One extra record rejects the whole import. A separate
model/paper fixture costs exactly two entries: model LINE(1,2) to(11,2), paper
LINE(20,30) to(40,30) on Work sheet,420x297mm. Limit2 accepts both persisted owners;
limit1 rejects before returning even the valid model. Counts do not include every
preprocessing, table/header/group/vertex operation or block lookup.

## Trusted signal and cleanup ownership

The optional trusted AbortSignal is checked before parsing/editor work, at decoder
and cell dispatch, validation and final report return. Authored AbortError messages
do not echo the opaque reason. A synchronous sourceName conversion challenge
proved that report construction could abort after serialization; the final-return
guard now suppresses that candidate. This is a controlled callback race.

`importDrawing(filename,{signal})` checks relevant await boundaries and forwards
the signal to parser context. A newly acquired handle enters its close-owning
try/finally before cancellation escapes. New scratch custody retains directory
and realpath identity before an abort check. Owned cleanup runs despite abort.
Only a successful operation reaches the post-cleanup cancellation check, preserving
a prior timeout or validation error against a later abort during cleanup.

Converter close/error handlers precede signal registration and recheck. First abort
cause precedes one kill request; synchronous close cannot rearm the deadline.
Settlement removes its signal listener, including grace rejection. Successful
natural completion followed by late abort/error/data/close cannot kill, resettle
or duplicate cleanup. Beta12 one-importer admission, shared process/output budgets,
1,000ms unconfirmed-close grace and deferred guarded cleanup remain intact.
The reservation is per importer instance, not global main-process admission.

These are trusted actual AbortSignal interfaces with ordinary functioning signal
methods. Arbitrary objects or throwing/replaced add/removeEventListener methods
are not qualified. No renderer/preload cancellation channel or UI is added; the
ordinary main caller continues using its existing adapters. Polling synchronous
source does not establish later event-loop-responsive cancellation.

## Executed qualification and chronology

The preserved pre-product f660dfa checkpoint has work36=20pass/16expectedfail and
cancellation21=6pass/15expectedfail, zero unexpected errors. The first implementation
passes those36+21 and converter48. Supplemental compatibility controls were then
added. Initial model/paper assertions compared persisted paper entities to top-level
entities; the corrected oracle asserts the same independent paper literal inside
layout.entities. This fixture error and both initial receipts remain preserved.

The corrected retained-beta12 compatibility comparison is9checks:7pass/2fail.
It ran after initial implementation against the immutable source copy; it is not
chronological pre-mutation execution. The corrected first-approach challenge is
9checks:8pass/1fail, isolating report-time cancellation before the final guard.
The guard is a defensive correction within the same coherent approach.

Final exact-source packs pass **67/67**:work36,cancellation22,compatibility9, all
with zero unexpected errors. The importer VM uses real owned files/handles and
core validation, canned parser/metadata candidates, fake children/manual timers
and actual AbortSignals. Main Open/fileOperation/fileFailure bodies are verbatim
with explicit helper/binding/persistence/title adapters. The foreign-helper test
changes only one dependency binding deliberately; it is not the observation-only
work-counter projection. Worker limits256MiB old-generation/4MiB stack/15s parent
watchdog contain tests only.

The fresh selected fast gate passes **58/58stages,1,505portablechecks,233inputs**.
All three new packs are selected; converter48 and recovery102 remain selected.
Legacy importer21 also passes in an owned copy changing only fixed dependency/
fixture roots to preserve the original conventional report. The original actual
DXF suite passes24/24. Those45 legacy checks are separate from the1,505 selected
count. No unchanged application or real converter attempt ran.

The reviewed cumulative beta13 manifest retains59runtime files,12resources and
9baseline changes. Only dwg-import.mjs and desktop/import-files.cjs differ from
immutable beta12; original before-hash origins, other reviewed entries and all
resources remain exact. Core/main/preload/app and Windows-beta workflow are unchanged.
Package/lock version and the two quality-loop manifest pins identify beta13.

## Remaining limits and next work

Full main exchange/renderer/IPC, later UI cancellation, process-tree termination,
orphan absence, global admission, real filesystem-stall deadlines, whole-process/
native memory and restart/crash/checkpoint durability remain unproved. Existing
broad privacy/reason custody and beta7 startup cause remain open. Application/PDF/
build/unpacked/native/installed/upgrade/client/daily-use beta13 qualification is
not run. Retain beta6 built/native evidence. LC-REL-01/02 remain exhausted;
LC-REL-03 remains partial with one approach used and at most one remaining.

Next follow registered LC-PERF-01/LC-QA-006 under LC-QA-PERFORMANCE: prepare the four
literal workload/protocol definitions while preserving the completed baseline.
Do not launch the unchanged blocked application route or invent timing thresholds
or optimizations. Streaming remains deferred. A focused local revert of the beta13
runtime commit restores owned source/metadata/tests; immutable beta12 and every
receipt remain preserved. This is not an installed rollback or promotion.
