# Bounded tray study beneath a fixed roof

> **Historical milestone reference.** This document records its original R0–R6 implementation scope and evidence. It is retained for design history; its status, next-step and test statements are not current v1.36 qualification claims. See [the historical-reference index](../HISTORICAL-REFERENCE.md) and [current release notes](../RELEASE-1.36-BETA.md).

Open **Architecture → Space study** in the existing drawing. Assign physical model units. This is a mathematical model: roof and ceiling surfaces have zero thickness by default, and no assembly declaration is required to calculate or apply a ceiling. Add optional roof-normal layers, vertical ceiling-finish thickness, and local reservation boxes anytime.

The first tray type has one rectangular raised plateau, a lower flat band, and ideal vertical finished returns. Enter the plateau's minimum and maximum X/Y in building-local coordinates, its lower elevation, and its raised elevation. The complete rectangle must be strictly inside the resolved room. A corner-only fit across a concave notch is rejected. Ceiling elevations are independent of wall bearings and roof elevations.

Save the proposal to compare its finished volume and headroom area with the actual accepted ceiling. The proposal is persistent source intent, not an accepted ceiling. Apply it only when its complete lower band, plateau and closed return interfaces fit the modeled envelope. An obstruction touching a return or corner constrains the raised elevation. Locked ceiling intent, stale unsaved fields and infeasible proposals cannot be applied.

Applying a tray changes the room's finished ceiling profile in one Undo step. The roof's accepted exterior vertices/faces, pitch, overhang, bearing elevations and building frame stay fixed. Undo/Redo restores the complete source transaction. Applying the flat target or maximum flat option explicitly replaces the accepted tray. Editing a room label or flat target preserves the accepted tray.

The current-volume comparison uses the complete accepted stepped ceiling, including its actual lower and raised areas. Requested geometric volume and feasible usable volume are separate values. No recovered usable volume is claimed when the actual baseline is infeasible. The maximum raised elevation applies only to the entered rectangle and lower elevation; this tool does not optimize the rectangle or roof.

Export an X/Y section through the plateau to see the two vertical returns and lower/raised dimensions. Sections are ordinary editable drawing snapshots and require regeneration after source edits. The accepted ceiling is generated from source, while native files store the architectural intent only. Architecture schema 3 explicitly migrates schema 1 and 2; the historical samples remain unchanged to exercise that path.

Horizontal finished area and vertical-return area remain geometric quantities. Return thickness and return material volume are exactly zero. Optional roof-layer and ceiling-finish volumes are calculated only from entered thicknesses. Vertical ceiling finish is not reused as horizontal return thickness. Both prefabricated-truss design and manufacturing-complexity surcharges are exactly zero.

**Use zero thickness** clears the selected roof's layers and selected room's ceiling finish together, retaining local reservation boxes and the accepted flat/tray profile. The change is one Undo operation. A shared roof assembly is copied for the selected roof so other roofs keep their entered layers. Existing drawings retain their explicit thicknesses until this action is chosen; opening a file never clears them. Save/reload unsaved study and tray fields before changing thickness. Add thickness again through the same controls without regenerating or moving the roof.

This milestone supports one local-axis rectangular stepped tray per room beneath one covering roof. Sloped transitions, curved trays, vaults, gable assignments, variable-bearing roofs and automatically ranked alternatives remain subsequent work.
