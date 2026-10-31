# Closed 3D polylines and surface extrusion

In beta16, finish a `3DPOLY` outline with `C` / `Close` to create a surface when
its vertices form a simple coplanar boundary. The result is one ordinary editable
MESH with the same object ID and layer. Its stored XYZ vertices are copied exactly,
including collinear boundary vertices. One Undo removes the creation; Redo restores
the same surface. A repeated terminal start point is removed only when closing.

Select the surface, run `EXTRUDE`, and enter a signed height. The extrusion follows
the surface normal, including tilted planes. It retains the source surface, copies
the base vertices exactly, computes new offset top vertices, and adds side faces
only along the outer boundary. Preview and completion use the same validated plan.
Computed top coordinates retain normal floating-point arithmetic; they are not
snapped or rounded to a geometry grid.

Enter or Escape leaves an open path. Nonplanar, self-intersecting, degenerate or
oversized closed outlines remain paths, with a message explaining why no surface
formed. Existing saved POLY3D entities are not converted during loading. Internal
architectural footprint creation explicitly keeps its drafting boundary as a path.

Surface creation supports at most 4,096 vertices. Mesh extrusion supports a planar,
consistently oriented, connected surface with one simple boundary, at most 4,096
vertices and 8,192 triangles. Holes, overlapping faces, geometric edge crossings,
nonmanifold topology and closed solids are rejected. The existing spatial-profile
planarity comparison is retained: a perpendicular residual at most
`max(1, span) * 1e-9` drawing units, without changing any stored coordinates. This
is numerical classification, not automatic flattening or mathematical exactness.
Drawing-wide resource checks occur before mutation. Boundary/edge validation is
bounded but quadratic; it runs once when EXTRUDE accepts captured source geometry,
not on every height preview. No performance improvement is claimed.

The ordinary mesh renderer, picking, grips and native persistence are reused.
Shading and the previous mesh-edge repair are unchanged. DXF exports ordinary
3DFACE records; import does not promise preservation of mesh grouping. Existing
vector plotting depicts mesh edges, not shaded face fills.

## Verification

The initial 17 checks produced 5 passes and 12 expected feature failures: missing
surface/extrusion behavior plus one missing fallback explanation. Those five passes
alone did not validate the new surface classifier. The first implementation passed
16/17; a strict equality assertion for newly calculated oblique top coordinates
was too strong. Original/base vertices and preview/commit equality remain exact;
calculated top coordinates use the independently reviewed bound
`64 * EPSILON * max(1, abs(expected), abs(source coordinate))`. Ideal expected
coordinates were retained. An additional property control initially used an
incorrectly capitalized existing linetype enum; that harness error is preserved.

The final 23 focused checks pass. Independent literal references include areas
200, 30, 7 and 12; extrusion volumes 600, 150 and 14; the oblique normal
(-4/5, 0, 3/5); concave-notch picking; collinear vertices; positive/negative heights;
closed-shell topology; saved/clipboard/DXF coordinates; unchanged existing paths;
resource rejection; property retention; and plan reset between commands. Earlier
path-ownership DXF controls explicitly request an outline-only close; default Close
controls now require the requested surface behavior.

The selected portable gate passes 64/64 stages and 1,668 checks, binding 248 exact
inputs. Independent read-only review covered code, test validity, privacy,
compatibility and candidate identity. Beta15 manifests and receipts remain intact.
Beta16 changes only core geometry/commands and command help/footprint integration;
there is no dependency, rendering engine, saved-format or security-setting change.

These are source/portable results. Beta16 application, raster, PDF, packaging,
installed native input and daily-use qualification have not run. The separately
verified installed beta15 remains the current personal-trial copy until a new
candidate application/build/install scope is authorized and completed.
