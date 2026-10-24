# Install, update and roll back the Windows beta

The Windows x64 installer includes Linecraft's desktop runtime. **Normal CAD use does not require Node.js, Python, Visual Studio, a browser or another CAD package.** Python applies only to an optional external structural calculator or developer test tools.

## Install

1. Download `Linecraft-CAD-1.36.0-Setup.exe` from [v1.36.0](https://github.com/MrOweItAll/linecraft-cad/releases/tag/v1.36.0).
2. Compare its SHA-256 with the value in that release's [SHA256SUMS.txt](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/SHA256SUMS.txt). PowerShell can read it without running the installer:

   ```powershell
   Get-FileHash .\Linecraft-CAD-1.36.0-Setup.exe -Algorithm SHA256
   ```

3. This installer is **unsigned**. An unknown-publisher or SmartScreen warning may appear. Verify the release origin/checksum and use your Windows or organization approval process for unrecognized software.
4. Close Linecraft after saving your work. Run the installer and follow the per-user setup wizard, then launch **Linecraft CAD** from its shortcut.
5. Check the reported version and try a copied drawing. Save editable `.linecraft` files in your project folders, separately from the application installation.

If Windows asks which application opens a `.linecraft` file, choose Linecraft CAD through the normal chooser. Do not change DWG/DXF associations merely to trial the beta. The application itself works offline; GitHub and an account are not needed to draw or save.

## Manual updates

There is **no automatic updater** in this release.

1. Read the intended release's notes and compatibility limits. Beta assets may be newer than GitHub's **Latest** stable release.
2. Keep the current installer and separate backup copies of your drawings. Save a copy before allowing a newer version to edit a project.
3. Download and verify the new installer, close Linecraft cleanly and install for the same Windows user.
4. Confirm the version. Open a drawing copy and check important geometry, units, layers, text/fonts, layouts, viewport scales and a plotted PDF before adopting it for the project.

The historical 1.36 qualification with Electron 44.7.0 exercised an existing per-user **1.34→1.36** upgrade and actual installed Save/reopen/PDF output. It did not qualify every older-version upgrade, clean-VM installation, downgrade or uninstall scenario. The vendor security refresh targets Electron 44.9.3; consult [Public-Beta-Verification.json](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Public-Beta-Verification.json) for fresh installed checks actually completed on the released runtime.

## Rollback

Older Linecraft versions may reject or misinterpret newer entities/settings. **Backward compatibility of newly saved files is not guaranteed.** Preserve a drawing copy from before the upgrade, together with the matching older installer.

Close the beta, retain the current files, and use the older version's installer through its normal Windows flow. If it requires removing the beta first, use **Windows Settings → Apps** and retain project files/backups. Avoid deleting application profiles or project folders as a troubleshooting shortcut. Use the pre-upgrade drawing copy with the older version; keep newer revisions separate for recovery or conversion review.

Rollback/uninstall was not part of the historical desktop qualification. Report a failed downgrade with the versions and sanitized error through the [bug template](https://github.com/MrOweItAll/linecraft-cad/issues/new/choose).

## Optional tools and source development

The [structural adapter](OPTIONAL-STRUCTURAL.md) is separate and optional. Developers who build/run source need the prerequisites in [DEVELOPER-GUIDE.md](../DEVELOPER-GUIDE.md); those prerequisites are not requirements for installing the normal Windows application.
