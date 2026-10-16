# Different bearing heights

Open Architecture → Roof and choose a roof. The existing default bearing remains a drawing-length input. Inspect the source edges, enable overrides for the desired edges and enter their bearing elevations using the drawing's feet/inches or other assigned units. These controls change support elevations, independently of the room ceiling.

Review the draft geometry/status and activation diagnostics. Confirm the bearing draft and, for a gable roof, confirm its end assignment. Apply makes one ordinary Undo record. Preview does not change the drawing. Invalid constraints keep the accepted roof intact. Editing an edge, height, overhang or pitch invalidates the confirmation; stale geometric edge assignments require explicit review/reset.

For wall-derived boundaries the matched wall heights govern their source edges. Edit the actual wall bearing in the Walls pane when changing that support. An explicit roof-edge override which disagrees with a matched source wall is rejected. Height locks remain in force. Interior supports and conflicting collinear bearing segments require separate framing/coverage decisions.

For a 20 ft span at 4:12, changing one eave bearing from 10 ft to 12 ft moves the ridge 3 ft toward the higher side, to 13 ft from the lower side; its elevation becomes 14 ft 4 in. It does not change an independent 8 ft ceiling. See samples/bearing-v113.linecraft for the source-only 40 by 20 ft gable study and locked A3 1:96 / 1:48 layouts.

The bounded solver uses additive activation, same pitch for every sloping front and validated finite topology. Impossible ridge/support consumption, unresolved endpoint provenance or failed coverage/runoff is reported rather than returning distorted faces. Supported HIP cases can add separately owned vertical step/interface meshes; these are mathematical surfaces and do not assert structural walls or flashing specifications.

Roof and closure thickness remains zero. Ceiling/bearing/eave datums remain separate, modeled clearance reservations remain in force, and both truss surcharges remain zero. Lumber, webs, connectors, loads, supplier feasibility and structural design remain unverified. Variable pitches, arbitrary composed roof steps, courtyard holes and unsupported corner arrangements are outside this milestone. PDF remains vector wireframe, including mesh triangulation edges.

Focused checks: npm run test:bearing; npm run test:bearing-desktop. The complete Windows release gate also runs source and unpacked bearing/PDF checks. Actual installed interaction, native Save/reopen and independently measured PDFs are recorded separately in the milestone results; passing a source test alone does not establish installation behavior.
