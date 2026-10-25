# Native acceptance of 1.36.1-beta.3

On October 25, 2026, the exact unpacked beta3 from the fresh passing 27-stage
candidate gate completed focused visible Windows acceptance of LC-MON-001,
optional viewport-scaled architectural tick width. Tested code:
`3b5df3419b091e29f097ddd946f962da7a979ab6`. The session began at documentation
checkpoint `374b0757d2a55028fe6a0206441effb1caf3a140`. No runtime change or rebuild
occurred during native acceptance. The native About dialog displayed
1.36.1-beta.3.

Executable SHA-256: `07c09cdf9e3e7b11d65e31fd7f2c155d50ff7c707385876b63204abd7a0c077c`.
ASAR SHA-256: `8c338f121acedbb0fa05336cee2560480b180f83811dee5120f0ea02adc19b1f`.

## Method and results

A visible unpacked executable used a new disposable profile and an independently
authored synthetic drawing. Agent-driven native input operated the settings
dialog, keyboard history controls and real Windows Open, Save As and PDF Save
dialogs. Settings changes were submitted with native Enter. The actual Cancel
control was exercised. Local controller use was limited to describe/snapshot
observations; no controller mutations, dialog stubs, browser automation or hidden
test flags were used.

| Workflow | Observed result |
|---|---|
| Legacy drawing | Complete accepted document retained, with optional tick width absent |
| Settings Cancel | Staged width discarded; complete legacy document unchanged |
| Settings Enter submission | Only the referenced dimension style gained `tickWidth: 12`; complete expected document matched |
| Native Ctrl+Z / Ctrl+Y | Complete legacy and width-edited states restored exactly |
| Explicit Save As / New / Open | Actual saved native file and reopened complete document matched the accepted width-edited state |
| Blank width / Enter | Optional property removed; complete legacy document restored |
| Cleared Save As / New / Open | Actual saved native file and reopened complete document matched the cleared state |
| Three native PDFs | Legacy, explicit-width and cleared documents plotted through the actual application and Windows PDF Save dialog |
| Plot persistence | All three complete documents and saved native files stayed unchanged after plotting |
| Normal quit | Candidate closed normally and removed its private control descriptor |

The declared 12 mm model width plotted at approximately 0.24 mm in the 1:50
viewport and 0.12 mm in the 1:100 viewport. Dimension and extension-line strokes
remained approximately 0.1 mm. Legacy and cleared tick strokes also retained
their approximately 0.1 mm inherited width. Definition points, tick centerlines,
IDs, units, styles, layouts, viewport centers, physical scales, locks and navigation
fields were included in complete-state comparisons.

Each actual PDF passed the unchanged independent reader: ten literal geometry
and width measurements, plus eleven paint negative controls. Explicit tick
coverage required a complete quadrilateral, including the paired triangles and
their shared diagonal. Opaque black ink, solid strokes and page-background paint
order were checked. Existing endpoint, length, width and page tolerances were
retained; no expected outputs or tolerances were changed for native acceptance.

Six fresh PDF detail renders were visually inspected. Legacy and cleared details
matched, and explicit tick thickness changed with viewport scale while ordinary
dimension strokes remained thin. These durable images are PDF renders. Native
screenshots were viewed through the computer-use tool; no local native screenshot
archive is claimed.

Native file SHA-256:

- Legacy and cleared: `5ae98264e9a842766e0b5542c2478ec06f19898f205233310eb5e83669bc85f5`
- Explicit width: `51d7102a022065e4ef33fde0430518beb2be34881edb6086a3111fb0d0812ace`

## Compatibility and preservation

The three actual saved files were checked by hash-verified 1.36.0, beta1, beta2
and beta3 source readers: twelve defined comparisons passed. Nine comparisons
preserved complete serialized state exactly. The three older-reader comparisons
of the explicit-width file lost only the new optional property, as expected.
That is presentation loss, not full backward persistence. Legacy and cleared
files remained exact in all four readers. Saved inputs and reader files remained
unchanged. These are pure source-reader checks, not installed upgrade/downgrade
or native UI/render tests of older versions.

End checks found unchanged candidate EXE/ASAR, installed EXE/ASAR, all 123 recorded
source inputs, the original synthetic input and the two recorded normal-profile
configuration files. No client drawing was opened, edited, saved or copied.
Unrelated windows remained open. The installed daily-use application was neither
started nor replaced. Private evidence retains output hashes, read-only
observations, full comparisons, independent audits and the native UI journal.

This establishes focused native acceptance of the unpacked beta3 tick-width
workflow. Installed upgrade/downgrade, broad human drafting usability, DPI/font/
mouse soak and native beta3 importer acceptance remain unqualified. The earlier
[beta2 importer acceptance](NATIVE-BETA2-ACCEPTANCE.md) retains its own versioned
scope. DXF width loss and older-reader presentation loss remain documented in
[the implementation record](TICK-WIDTH-IMPLEMENTATION.md).

The installer was not run. Daily-use promotion and release authorization remain
outstanding. No publication, push, merge, tag, outbound message or scheduler
change occurred. Manual invocation ready; unattended execution not enabled.
