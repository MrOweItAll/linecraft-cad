# Native acceptance of 1.36.1-beta.2

On October 24, 2026, the exact unpacked beta2 from the passing 23-stage gate
completed focused visible Windows acceptance of LC-MON-002 and LC-MON-003.
Tested code: `fdc37327e174516dda10bcab7045ed991fdda8c4`. The session began at
documentation checkpoint `128a1ef73774edfa25effdddbbfffba8cbb948e3`, with only the
existing private handoff untracked. No runtime change or rebuild occurred.

Executable SHA-256: `4ad4a7f643ad95ef0b415306cd96e0250a6043ded3c99748406a71c2896e26ac`.
ASAR SHA-256: `e964475227a4f8d98a9683d5dcb1a7700a088b25570809d16f43f0f074af1ede`.
The native About dialog displayed 1.36.1-beta.2.

## Method and results

A visible executable used a new disposable profile. Agent-driven native input
operated real Windows Open, Save As and PDF Save dialogs. Local controller use
was limited to describe/snapshot observations. No controller mutations, dialog
stubs, browser automation or hidden test flags were used. UI screenshots were
inspected through the computer-use tool; durable local images are independently
rendered PDFs, not a claimed native screenshot archive.

| Workflow | Observed result |
|---|---|
| Viewport DXF import | Original synthetic fixture imported unchanged; center (23,-41,0), frame, 1:1 scale, lock and paper sentinel retained |
| Native MOVE | Ruler moved exactly (5,7), retaining ID and 40-unit length; full unrelated state unchanged |
| Native Undo/Redo/Undo | Complete semantic states exactly matched baseline, moved state and baseline |
| Both Save As/New/Open flows | Actual saved files and reopened full documents exactly matched accepted pre-save states |
| Viewport PDF | Actual native ruler 39.99972254 mm at midpoint (149.99895685,196.99912957) mm; paper sentinel 9.99993064 mm |
| Redundant HATCH import | Expected duplicate-vertex diagnostic; literal four-corner boundary and solid fill retained |
| HATCH PDF | Actual native fill 19.99986666 by 11.99993507 mm; fully interior dark fraction 1.0, required minimum 0.995 |
| Plot persistence | Both complete documents and saved files stayed unchanged after plotting |
| Normal quit | Candidate closed and removed its private control descriptor |

The HATCH fixture was calibrated before launch: original synthetic model LINE
and redundant HATCH records were retained exactly; explicit millimetre units and
a literal paper sentinel/layout/locked Top viewport were added. No app scripting
repaired geometry or arranged its viewport during acceptance.

Both actual PDFs passed the unchanged independent reader and were visually
inspected. Existing physical tolerances and missing/wrong-scale/shifted-center
or missing/partial-fill negative controls were retained. Native file SHA-256:

- Viewport: `713a8c241c1d8ad81f2462a8f3610ea4048c2c1265dcb85b7ffd5b181ada629f`
- HATCH: `fe4a7ba1fe8e57354529af9ccbd472e0a473bc51ac0559eae2325a548e351e32`

Fresh compatibility checks bind these exact two saved files to the preserved
1.36 and beta1 source readers: all four complete serialized-state comparisons
passed. Each reader's 59 runtime files were hash-verified before and after.
These are pure source-reader checks, not installed downgrade/upgrade acceptance.

## Preservation and limits

End checks found unchanged candidate EXE/ASAR, installed EXE/ASAR, all 115 recorded
source inputs, two original fixtures, two disposable import inputs and the two
recorded normal-profile configuration files. No client drawing was opened,
edited, saved or copied. Unrelated windows were left open. The installed daily-use
application was neither started nor replaced.

Private evidence retains snapshots, full comparisons, PDF audits and the UI
journal. An initial restricted localhost read was denied before a successful
authorized read-only check. A comparison helper hit a cross-realm prototype
mismatch; standalone parsed-JSON comparison confirmed exact equality without
changing data or assertions. CIM enumeration was unavailable; the first
preservation receipt is superseded by successful Get-Process verification with
terminating errors enabled. These are evidence-tool limitations, not app failures.

This establishes focused native acceptance of the unpacked beta2 importer
workflows. Installed upgrade/downgrade, human drafting usability, broad DPI/font/
mouse soak, twisted/oblique parity, new DWG exchange, native AutoCAD comparison
and broad client-drawing fidelity remain unqualified. Source-reader compatibility
is separate from installed acceptance. The installer was not run; daily-use
promotion and release authorization remain outstanding.

No publication, push, merge, tag, outbound message or scheduler change occurred.
Manual invocation ready; unattended execution not enabled.
