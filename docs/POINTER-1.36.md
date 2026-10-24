# Pointer controls in Linecraft 1.36

This update uses observations of the actual AutoCAD LT 2027 application and independently written Linecraft code. Whole-stroke measurements distinguish accepted press anchors from later release positions; they do not establish unobserved inside-held-frame timing or complete AutoCAD parity.

## Drawing points

For LINE and RECTANG, a left press accepts the current point. Moving while held updates the preview; releasing elsewhere does not supply a second point. The next independent press provides the next endpoint/corner. A completed rectangle's matching release does not begin another operation.

Actual native LINE, RECTANG and CIRCLE strokes supported this behavior. Linecraft already used the matching drawing-point path. PLINE/ARC held-offset tests establish Linecraft regression behavior; they are not new native reference measurements.

## Ordinary grips

1. Select an editable ordinary object.
2. Click a supported grip and release. A held activation drag followed by release also remains provisional.
3. Move to the destination and click again, or enter a complete coordinate and press Enter/Space.
4. Escape discards the current ghost and retains accepted geometry.

The original object remains accepted while a separate ghost previews the proposal. A confirmation press validates and commits once through the normal editor; its matching release cannot start another edit. An unchanged placement or canceled preview adds no content history. Previous Undo/Redo remains available.

Native AutoCAD recorded an additional empty grip-history entry in one canceled session. Linecraft intentionally retains its existing content-based history rather than reproducing that no-op record.

## Coordinates, planes and snaps

Model input uses drawing units and the input UCS captured at acquisition; paper input uses sheet millimeters. Relative coordinates such as `@10,0` start from the exact acquired grip. Architectural feet/inch syntax uses the existing unit parser.

Planar entities retain their actual creation plane, independently of an unrelated XZ/YZ UCS. Invalid/off-plane planar targets reject explicitly. Supported spatial paths/meshes retain authoritative typed XYZ through the normal engine; the pointer uses its captured acquisition plane. Spatial circle/arc center and radius handles keep their existing engine constraints.

Running and temporary snaps remain available. Perpendicular uses the acquired grip as its known anchor. The context menu offers the real confirmation, snap and cancellation controls. A preview does not modify accepted source, dirty status, history or the document saved/plotted by the application. Stale source, ownership/lock or space changes cannot retarget a previous grip edit to another object.

## Separate controls and current gaps

- Semantic roof footprint and mesh-subobject controls retain their separate prior gesture contracts.
- Idle click-release first-corner window/crossing selection remains a separate gap; this update does not add PICKDRAG/PICKAUTO settings or lasso selection.
- Additional native grip modes/cycling are not implemented here. Blank Enter/Space rejects with guidance instead of selecting a different transform or repeating an unrelated tool.
- Legacy nonzero-Z data stored in an ordinary 2D entity type rejects grip acquisition where the existing commit API cannot preserve it safely. Supported spatial types retain their own validation.
- Constrained rectangle/viewport semantics still apply; familiar acquisition does not add every native polyline-grip mode.

See [known limitations](KNOWN-LIMITATIONS.md), [release notes](RELEASE-1.36-BETA.md) and [developer verification boundaries](../DEVELOPER-GUIDE.md).
