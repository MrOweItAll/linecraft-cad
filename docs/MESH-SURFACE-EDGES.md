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
