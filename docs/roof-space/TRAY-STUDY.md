# Bounded tray study beneath a fixed roof

Open **Architecture → Space study** in the existing drawing. Assign physical model units and declare the roof's actual normal layer envelope, vertical ceiling-finish thickness, and known service/clearance reservations. A report is conditional on these declarations; it does not verify a framing design.

The first tray type has one rectangular raised plateau, a lower flat band, and ideal vertical finished returns. Enter the plateau's minimum and maximum X/Y in building-local coordinates, its lower elevation, and its raised elevation. The complete rectangle must be strictly inside the resolved room. A corner-only fit across a concave notch is rejected. Ceiling elevations are independent of wall bearings and roof elevations.

Save the proposal to compare its finished volume and headroom area with the actual accepted ceiling. The proposal is persistent source intent, not an accepted ceiling. Apply it only when its complete lower band, plateau and closed return interfaces fit the declared envelope. An obstruction touching a return or corner constrains the raised elevation. Locked ceiling intent, stale unsaved fields and infeasible proposals cannot be applied.

Applying a tray changes the room's finished ceiling profile in one Undo step. The roof's accepted exterior vertices/faces, pitch, overhang, bearing elevations and building frame stay fixed. Undo/Redo restores the complete source transaction. Applying the flat target or maximum flat option explicitly replaces the accepted tray. Editing a room label or flat target preserves the accepted tray.

The current-volume comparison uses the complete accepted stepped ceiling, including its actual lower and raised areas. Requested geometric volume and feasible usable volume are separate values. No recovered usable volume is claimed when the actual baseline is infeasible. The maximum raised elevation applies only to the entered rectangle and lower elevation; this tool does not optimize the rectangle or roof.

Export an X/Y section through the plateau to see the two vertical returns and lower/raised dimensions. Sections are ordinary editable drawing snapshots and require regeneration after source edits. The accepted ceiling is generated from source, while native files store the architectural intent only. Architecture schema 3 explicitly migrates schema 1 and 2; the historical samples remain unchanged to exercise that path.

Horizontal finished area, ideal vertical-return finish area, ceiling-finish volume and declared roof-envelope layer quantities remain physical quantities. Vertical ceiling-finish thickness is not reused as horizontal return construction thickness. Return construction thickness/volume, member schedules, loads, connections, stair/access clearances and supplier verification remain unknown or unverified. Both prefabricated-truss design and manufacturing-complexity surcharges are exactly zero.

This milestone supports one local-axis rectangular stepped tray per room beneath one covering roof. Sloped transitions, curved trays, vaults, gable assignments, variable-bearing roofs and automatically ranked alternatives remain subsequent work.
