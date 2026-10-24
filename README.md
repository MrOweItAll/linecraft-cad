# Linecraft CAD

**Windows beta / prerelease — v1.36.0**

Linecraft is an independent, open-source CAD application for residential, commercial and industrial design and drafting, tuned especially to residential workflows. It combines familiar command entry with editable native drawings, paper layouts, polygonal 3D modeling, architectural roof tools and structured scripting.

[Download the Windows beta](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Linecraft-CAD-1.36.0-Setup.exe) · [Release notes](https://github.com/MrOweItAll/linecraft-cad/releases/tag/v1.36.0) · [Install / update / rollback](docs/INSTALL-UPDATE-ROLLBACK.md) · [Known limits](docs/KNOWN-LIMITATIONS.md)

## Install and draw

The **Windows x64 installer includes the desktop runtime**. Normal CAD use needs **no Node.js, Python, Visual Studio, browser, account or separate CAD application**. Internet access is needed to download the release; drawing and native saving work offline.

1. Download the installer from the beta release above and compare its SHA-256 with [SHA256SUMS.txt](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/SHA256SUMS.txt) on that release.
2. The installer is **unsigned**. Windows may show an unknown-publisher or reputation warning. Verify the origin/checksum and follow your Windows or organization software policy before approving it.
3. Run the installer for your Windows user and launch **Linecraft CAD** from its shortcut. Trial the beta with copies of drawings.
4. In a new drawing, enter `LINE`, `0,0`, `120,0`, then a blank Enter. Select the line, click and release an endpoint grip, then click its destination or enter coordinates. Escape discards a provisional grip preview.
5. Save an editable `.linecraft` file in your project folder.

Use the named prerelease assets. GitHub's **Latest** release and the default branch may still represent an older stable version. There is no automatic updater; [manual update instructions](docs/INSTALL-UPDATE-ROLLBACK.md) keep the release, installer and drawing backups identifiable.

## Included workflows

- 2D drafting with command names/aliases, command completion, coordinates, architectural/SI units, selection, snaps including anchored Perpendicular, layers, properties and grouped Undo/Redo.
- Text, dimensions, leaders, title-block resources, paper layouts, rectangular/polygonal viewports, common architectural scales, saved sheet sets and PDF publication.
- Polygonal 3D primitives, camera/navigation/picking and bounded architectural walls, rooms, roofs and ceiling-space studies.
- Opt-in local scripting that previews and applies structured edits to existing objects by ID through the normal engine. Ordinary launches leave scripting disabled.
- Bounded DWG/DXF import. **DWG writing and complete AutoCAD compatibility are unavailable.** Save editable Linecraft files or use the supported DXF/PDF output paths.

Version 1.36 focuses on [provisional ordinary grips](docs/POINTER-1.36.md): release keeps the preview; a separate destination press confirms. Drawing-point timing and the separate semantic roof/subobject controls retain their own contracts. Read [feature and compatibility limits](docs/KNOWN-LIMITATIONS.md) before choosing a workflow.

The repository also preserves [historical milestone documents and versioned samples](docs/HISTORICAL-REFERENCE.md). Their original plans, status statements and test counts describe the named earlier versions; their presence does not establish current v1.36 verification.

## Structural assistance is optional

CAD and structural JSON export work without Python. The optional external calculation adapter separately needs Python and a compatible, separately obtained structural calculator. See [optional structural setup and scope](docs/OPTIONAL-STRUCTURAL.md).

Linecraft and optional structural tools assist design and evaluation. They do not replace professional engineers or architects, provide a professional stamp, determine when one is required, or establish code compliance. Verify project assumptions and applicable review requirements independently.

## Beta verification and participation

The original qualified release pipeline recorded 177 stages, comprising **128 inherited successful unchanged stages and 49 newly executed stages**. Visible installed checks passed the 14-check native/file audit, 11 additional gesture checks and nine actual PDF checks. The exercised upgrade was an existing per-user installation; a clean-VM install/uninstall was not part of that cycle. These results describe the tested desktop build, not every machine or drawing. The distributable public-checkout gate is generated separately; the 177-stage total is not a claim that the public checkout reran those stages. Read [Public-Beta-Verification.json](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Public-Beta-Verification.json) for that gate's actual executed scope and results. Clean CI install/uninstall requires its own completed verification record.

[Report a bug or request a feature](https://github.com/MrOweItAll/linecraft-cad/issues/new/choose) · [Contribute](CONTRIBUTING.md) · [Report a security concern](SECURITY.md)

Original Linecraft code and assets use the [MIT license](LICENSE). Bundled components retain their separate licenses and notices, including the [GNU LibreDWG reader](third-party/libredwg/NOTICE.md). See the [third-party source guide](docs/THIRD-PARTY-SOURCE.md) for source archives, the supplementary upstream source and the original notice correction. Linecraft is independently written and is not affiliated with or endorsed by Autodesk.
