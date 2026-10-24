# Linecraft 1.36 Windows beta — v1.36.0

**Prerelease.** The application reports version **1.36.0**; this GitHub release is a beta channel for the integrated Windows build. Use drawing copies while evaluating it.

## Downloads

- [Windows x64 installer](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Linecraft-CAD-1.36.0-Setup.exe) — normal desktop installation, bundled runtime, no Node.js/Python/Visual Studio required for CAD.
- [Release source archive](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Linecraft-CAD-1.36.0-Source.zip) — use the tagged beta source rather than assuming the default branch matches.
- [SHA256SUMS.txt](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/SHA256SUMS.txt) — compare the exact downloaded asset and checksum.
- [Public-Beta-Verification.json](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Public-Beta-Verification.json) — separate public-checkout scope and actual results.

The installer is **unsigned**. Compare the checksum, verify that the asset came from this repository's release, and follow your Windows/organization policy for unrecognized software. No automatic updater is included.

## Focus of this release

Ordinary object grips now remain provisional after activation and release, including a held drag. The original object remains accepted while a ghost shows the proposed destination. A later independent click or valid typed coordinate confirms one normal edit; Escape discards the ghost without adding a content edit.

This uses measurements from the actual AutoCAD LT 2027 application, with independently written code and original assets. LINE, RECTANG and CIRCLE drawing strokes already matched the observed press-anchor behavior; release-end construction was not added. Semantic roof and mesh-subobject gestures retain their separate controls.

The build also contains the existing drafting, architectural units, text/dimensions, layers, layouts/viewports, PDF, polygonal 3D and structured scripting work. It is not a claim of complete AutoCAD feature or DWG fidelity.

## Existing desktop qualification

- Qualified pipeline: **177/177 stages**, consisting of **128 successful unchanged stages inherited under reviewed provenance and 49 newly executed stages**. This is not 177 newly rerun stages.
- Source ordinary-grip application: **32/32**; existing source drafting interaction: **59/59**. Matching actual PDF checks passed.
- Actual visible installed acceptance: **14/14** native/file checks, **11/11** additional gesture snapshot checks and **9/9** actual paper PDF checks.
- Native keyboard/mouse exercised grip preview/confirmation, Escape, Undo/Redo, typed exact endpoints, Save As, reopen and Plot. Actual 1:48/1:96 PDF ruler measurements and a rendered page were reviewed.
- The tested upgrade path was **1.34→1.36** for an existing per-user installation. A direct upgrade from other versions, clean-VM installation and uninstall were not separately qualified in this cycle.

Hidden source/packaged tests, visible development tests and installed native tests are separate evidence classes. Counts overlap and are not summed as independent feature coverage. Test setup/dependency-copy repairs and reviewed stage reuse were recorded; earlier failed runs were retained.

The public checkout has a separately generated bounded verification gate. The original 177-stage qualification is not its execution count. Consult the linked public verification receipt for the actual result; clean CI install/uninstall success requires a matching completed record.

## Known scope

Idle two-click window selection, additional native grip modes/cycling and safe editing of legacy nonzero-Z data stored in ordinary 2D types remain bounded gaps. DWG reading is limited; DWG writing is unavailable. 3D geometry is polygonal mesh modeling, not a complete solid-modeling system. Optional structural results assist design and do not replace professional review or a stamp.

[Install, update and rollback](https://github.com/MrOweItAll/linecraft-cad/blob/v1.36.0/docs/INSTALL-UPDATE-ROLLBACK.md) · [Detailed limitations](https://github.com/MrOweItAll/linecraft-cad/blob/v1.36.0/docs/KNOWN-LIMITATIONS.md) · [Pointer controls](https://github.com/MrOweItAll/linecraft-cad/blob/v1.36.0/docs/POINTER-1.36.md) · [Issues](https://github.com/MrOweItAll/linecraft-cad/issues/new/choose)
