# Prepared synthetic 3D visual and CPU observation session

The beta14 outline correction has source regression coverage. A separate private
application harness is now prepared and reviewed, but has not launched. The
earlier beta13 drawing/save/reopen/PDF session does not qualify beta14.

Six synthetic native fixtures preserve explicit coordinates and camera values:
a planar quad, stored coplanar triangles, a genuine fold, and connected grids
with200/800/3200 triangles and121/441/1681 vertices. An independent Python reader
checks all fixture coordinates, faces, camera and settings without importing
production code. The fixture generator uses the actual native serializer.

The proposed single hidden source-app session opens only these owned fixtures.
Four canvas bitmaps will cover shaded quad/triangles/fold and intentional
wireframe. Independent top-view projection fixes the640x480 CSS canvas square at
220,140..420,340. The raster reader binds each named artifact to its required
fixture/mode and PNG hash, checks face colors, outer boundaries, the diagonal
and outside sentinels, and preserves any residual antialias-hairline failure.
RGB tolerance8 is declared before execution. Four analytic pixel controls and
thirteen corrupt pixel/metadata controls, four encoded PNG role/hash controls
and two corrupt identity controls validate the reader only. These are authored
oracle controls, not application renders or evidence for every supported DPR.

The timing plan contains42 unprofiled actions:7 warmups and35 observations across
same-view redraw, preset changes and a small-grid-only selected pointer case.
A separate42-action repeat will collect sampled JavaScript stacks. That profile
also includes selection setup/cleanup and frame waits. Three literal attribution
checks and six corrupt-profile controls validate the profile reader without any
actual application observations. Inclusive named stack groups overlap; missing
samples do not prove zero cost. V8 heap-usage samples are neither heap snapshots,
peak memory nor video memory. Profiles and local execution details stay private.

An explicit execution argument, exact prepared-input pins, one-spawn guard,
fresh profile/output creation, bounded logs, finite supervisor and shared
single-attempt cleanup custody constrain the proposed run. They do not grant
authorization. Separate approval is required for one run in the working
outside-managed context. No repeated control or application launch follows
automatically. Installed binaries remain unchanged; no normal profile or client
drawing was selected. This preparation changes no runtime, dependency or repair
budget and does not establish a speedup, GPU/VRAM cause, native acceptance,
installed/upgrade acceptance or daily-use readiness.

## Subsequent authorized execution

The one approved session has now run. [The actual observations](MESH-3D-OBSERVATIONS.md)
record two failing flat rasters, passing fold/wireframe cases, and three audited
performance captures. The preparation record above remains historical. Its
launch approval is consumed; do not repeat the session automatically.
