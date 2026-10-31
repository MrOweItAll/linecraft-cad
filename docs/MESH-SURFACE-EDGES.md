# Indexed mesh surface outlines

Ordinary shaded meshes previously filled and stroked every triangulated face.
A single planar10by10 quad therefore drew its artificial fan diagonal twice.
The exact production drawModel function reproduced this in a recorded Canvas
host before the product change. The requested display keeps real outlines and
sharp corners while removing internal coplanar triangle seams.

## Source correction

`meshShadedTriangles` builds indexed triangle-edge adjacency in linear time and
space, retaining the normals used for shading. It hides an edge only when exactly
two incident nondegenerate triangles have parallel normals (cross-product length
at most1e-12) and their third vertices lie on opposite sides of that edge.
Boundaries, sharp/nonplanar folds, nonmanifold edges, degenerate geometry and
same-side overlaps retain outlines. Coordinates, vertices, faces and saved data
are never rewritten. Equal coordinates with different indices and separate mesh
entities remain distinct: no coordinate welding erases object boundaries.

The ordinary shaded renderer still fills triangles and sorts them by depth.
It strokes only the retained segments immediately with their triangle, preserving
the existing painter ordering rather than overlaying all back edges afterward.
Roof-owned mesh rendering, legacy triangulation/picking and intentional wireframe
paths remain separate and unchanged.

## Verification and limits

The first eight-check source regression passed3 and failed5: three failures
exposed the extra diagonal; two only established the new helper was absent.
The first repair passed8/8. Independent review narrowed stroke-inventory and
painter-order oracle gaps and added finite-coordinate/uncertainty challenges.
The final13 checks pass in the selected candidate gate:61/61 stages,1611portable
checks,241 exact working inputs. Boundary removal, added diagonal/outside stroke
and a back-edge overlay with misleading stale fill style are rejected controls.

Cases cover quad and stored coplanar triangles, opposite winding, folded shading,
wireframe endpoint pairs, painter ordering, nonmanifold/duplicate/degenerate
faces, subnormal coordinates, large translation, overlapping faces, duplicate
coordinate indices and separate entities. Fill area remains100 and planar fill
colors match in the recorded host. This is actual renderer-function source
coverage with a mocked Canvas host, not browser raster, interactive picking,
application/PDF, build, native, installed, upgrade or daily-use qualification.
The preceding successful drawing/save/reopen/PDF session used beta13 and does
not qualify this beta14 runtime. The user's other drawing was not accessed.

This is a visual correction, not a measured performance optimization. Additional
adjacency maps consume CPU/heap work per redraw; no caching or scheduling change
is introduced without reliable invalidation and measurements. Existing repeated
projection/sort/redraw and mesh-occlusion paths are profiling candidates. No GPU
or VRAM bottleneck, frame-rate improvement or performance threshold is claimed.
Next bound a synthetic 3D application/raster/profile run separately before
optimizing or claiming the reported real drawing is fixed.

## Subsequent actual raster result

The [single beta14 observation session](MESH-3D-OBSERVATIONS.md) retained a dark
diagonal in both flat fixtures despite the source stroke-inventory checks.
Fold and wireframe checks passed. Flat-surface acceptance remains failed; keep
the captured failure and frozen tolerance while diagnosing the residual seam.


## Surface-colored internal mesh edges - October 31, 2026 UTC

Beta15 follows the user's direction to match internal edge colors to their
surface. Ordinary opaque shaded meshes paint classified internal coplanar edges
with their exact shaded fill color, at the existing 0.7-pixel outline width.
Each stroke stays with its depth-sorted triangle; real outlines/creases retain
their paths. Roof-owned, translucent-preview and wireframe paths are unchanged.
Saved geometry and dependencies do not change.

The first regression had 30 tests, 26 passes and 4 genuine failures. The final
focused suites pass 32/32; the new selected fast gate passes 62/62 stages,
1,630 portable checks and 243 exact inputs. The prior beta14 manifest and failure
evidence remain preserved. See [the paint model and limits](MESH-SURFACE-COVERAGE-REFERENCE.md).
The runtime delta from beta14 is only app.mjs; the beta15 cumulative manifest
still covers 59 runtime files, 12 resources and ten cumulative changed files.

This consumes the second repair approach for LC-3D-SURFACE-EDGES, leaving none
under the current budget. Actual beta15 application/raster/PDF/build/native,
installed/upgrade/daily-use and performance qualification has not run. Analytic
seam colors pass the unchanged RGB tolerance 8; they are not captured pixels.
Corner/sliver controls expose bounded lateral overdraw, not boundary-color or
corner-pixel acceptance. Existing app launch approvals remain consumed. Next
prepare a bounded visual confirmation using the preserved fixture/probe contract
plus explicit corner/sliver observations; no automatic launch or new repair.

A later independent inherited-style check exposed a local line-cap side effect
(17 tests, 16 passes, 1 failure). Saving/restoring only the internal-stroke
style resolved it within the same repair approach. Both fast-gate receipts and
the intervening failure remain preserved; final source qualification follows
that correction, without a new application run.
