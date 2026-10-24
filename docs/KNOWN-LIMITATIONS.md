# Beta scope and known limitations

The historical 1.36 qualification using Electron 44.7.0 left no measured reproducible critical crash blocking its tested flows. That finding does not qualify the refreshed Electron 44.9.3 vendor build or establish crash-free operation on every machine or drawing. Consult [the public verification receipt](https://github.com/MrOweItAll/linecraft-cad/releases/download/v1.36.0/Public-Beta-Verification.json) for completed checks of the released artifact. Missing functionality below is distinguished from crashes, data loss, corrupt files or silently incorrect geometry/scale, which should be reported as bugs.

## Drawing and interoperability

- `.linecraft` is the editable native format. Keep project originals and prior-version copies.
- **DWG input is bounded and read-only.** Supported entities/resources are imported with warnings for unsupported content. Full DWG layout, font, appearance, proxy/xref and proprietary solid fidelity is not supplied. **DWG writing is unavailable.**
- DXF exchange is bounded; supported image exports need their associated sidecar resources. PDF plotting is output, not a guarantee of an editable native interchange file.
- System font availability and resource resolution can affect appearance. Check actual output before issuing project documents.
- 3D tools create polygonal meshes/paths. General solid booleans, ACIS feature history and full AutoCAD 3D parity are unavailable.

## Interaction and geometry

- Ordinary grips use activation/release, preview, then independent confirmation. Idle two-click window/crossing selection observed in the native reference remains a separate gap; current selection controls retain their documented behavior.
- Additional native grip Base point/Copy/Undo and Move/Rotate/Scale/Mirror/multiple-hot-grip cycles are not implemented by this update. Blank Enter/Space explicitly rejects instead of selecting an unsupported mode.
- Legacy nonzero-Z data stored in an ordinary 2D type rejects grip acquisition where the existing engine cannot preserve elevation safely. Supported spatial paths/meshes/curves retain their own constraints. Typed planar targets outside an object's creation plane reject.
- Semantic roof footprint and mesh-subobject controls have separate gesture contracts; see [pointer controls](POINTER-1.36.md).
- Quick TRIM is the default and can erase a supported ordinary object when it has no removable intersection. Use Standard for explicit cutting edges. Supported straight/circular target scope does not include arbitrary ellipse/spline/hatch/spatial-circle splitting or general perspective projection.
- Architectural generation is a bounded semantic model, including supported orthogonal footprints and roof/ceiling studies. It does not infer a complete engineered framing system from an arbitrary imported plan.

## Structural assistance

The optional bridge uses declared inputs and a separately obtained calculator. Matching source identities and arithmetic checks do not certify engineering, establish member/connection capacity, provide a stamp or decide whether one is required. Unverified assumptions remain the user's responsibility to resolve. See [structural scope](OPTIONAL-STRUCTURAL.md).

## Qualification boundaries

The visible installed tests used one existing per-user Windows installation upgraded from 1.34 to 1.36. Clean-VM install, separate uninstall, direct upgrades from other versions and every hardware/DPI/font configuration were not qualified in that cycle. Native whole-stroke reference measurements do not establish every raw event timing or full application parity.

No automatic updater is included. The current installer is unsigned. Minor reviewed captures included an earlier invalid-input toast and latched help text mentioning release; those presentation issues are separate from data or geometry failures.

## Report failures clearly

For a crash, hang, data loss, corrupt save or unexpected geometry/output, retain the original and avoid repeatedly overwriting it. Use a minimal synthetic drawing and the [bug template](https://github.com/MrOweItAll/linecraft-cad/issues/new/choose). Include version, units, exact commands, expected/actual result and a sanitized sample. Request missing workflows through the feature template. Do not post client drawings, personal project details or scripting secrets. Reports and feature requests carry no promised response or release date.
