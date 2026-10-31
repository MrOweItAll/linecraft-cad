# Full-precision tolerance, teapot and lighting review

No production tolerance was changed. The user clarified that the desired test
varies numerical comparison thresholds while retaining full-precision coordinates.
That is separate from the earlier requested 1 mm geometric cleanup. Neither
experiment establishes an application speed improvement or justifies reducing
coordinate precision.

## One-millimeter geometric experiment

Three separate Node processes compared the current core mesh validator and
surface-adjacency helper on a synthetic 40 by 40 grid with +/-0.5 mm offsets.
Projection of a copy to the explicit z=0 plane used a 1 mm limit. The complete
copy/project/validate/prepare path was compared with validate/prepare on the
original mesh. Each process used eight cases, seven warmups and 21 measurements
per case: 504 timed calls and 168 warmups overall.

| Process | Original pipeline median ms | Copy/project pipeline median ms | Change |
| --- | ---: | ---: | ---: |
| 1 | 12.0673 | 13.1646 | +9.09% |
| 2 | 11.7697 | 12.7877 | +8.65% |
| 3 | 11.7778 | 14.1222 | +19.91% |

The 90th percentile was also worse in all three processes. The validator checks
finite coordinates, indices, referenced vertices and nondegenerate triangles;
this is not a general robust-predicate benchmark. Each process checked 19 control
groups, not 19 individual assertions. Inch controls converted perpendicular
distance and its limit while leaving x/y unchanged, so they do not prove complete
physical-mesh unit invariance. Intentional shallow shape was removed by the same
projection rule as unwanted irregularity. All 1,681 vertices and 3,200 triangles
remained. These source wall times include allocation and uncontrolled JIT/GC/OS
effects; they are not CAD frame time, GPU performance or precision measurements.

## Full-precision comparison experiment

Five private copies changed only the normal-cross comparison in
`meshShadedTriangles`: 1e-16, 1e-14, current 1e-12, 1e-10 and 1e-8. Stored
coordinates and topology stayed exact. The shared workload was the synthetic
teapot described below. Three processes each used seven warmups and 21 timings
per threshold: 315 measured calls and 105 warmups.

The criterion was fixed before measurements: both median and 90th percentile
must improve in every process, with correct planar/crease classifications.
No alternative met it. The 1e-16 variant had lower medians but missed the timing
criterion in one process and produced 4,256 unexpected outline incidences across
2,128 internal diagonals of analytically planar lathe faces. The oracle covers
2,304 such quads; it does not label every changed edge in the teapot incorrect.
Stored binary64 coordinates have small rounding residuals, so analytically planar
construction does not mean their stored values are exactly coplanar.

Retain 1e-12. This result does not prove that it is universally optimal. Tightening
a comparison threshold does not add coordinate precision. No generic epsilon,
validation predicate, saved geometry or application renderer was changed.

## Prepared actual-application workload

The native synthetic teapot has five separate body/lid/spout/handle/knob meshes:
3,600 vertices, 3,704 stored faces and 7,096 fan triangles. Independent topology
checks and exact core save/load serialization pass. Body and spout have intentional
open rims; components overlap without solid union. It is an original parametric
fixture, not the standard Utah dataset or a manufacturing model.

The proposed replacement for the unexecuted visual-only session is one hidden
isolated beta15 application run. It preserves all six original visual roles and
their frozen readers/tolerances, adds three teapot views, and would produce nine
canvas/window image pairs from six synthetic Opens. A finite unprofiled pass
would record ten control-response observations after two recorded warmups; a
separate 12-action pass would collect one JavaScript CPU profile and a V8 heap
sample. Profiles include observer/frame-wait overhead. These are neither FPS nor
physical input/GPU/VRAM measurements.

New reader controls pass three authored image bindings, one authored observation
record and 29 corruption rejections. Syntax and no-execution-argument guards pass.
Readers check identity, sparse ink/border evidence and count/time consistency;
they do not certify shape, shading or lighting. Actual application launches,
teapot rasters and application performance observations are zero. Human visual
review and new approval of the concrete combined one-run scope remain required.
The earlier package stays preserved and must not be executed in addition to it.

## Dark lighting and restrained renderer options

Current `shadeInk` multiplies encoded hexadecimal channels directly. The shaded
fill factor is 0.18 plus 0.34 times the absolute normal/light dot product. For an
ideal opaque white surface this gives channels about 46..133 out of 255. This
source finding is consistent with a dark appearance; it is not a measurement of
the user's display or the unrendered teapot. The path has no explicit linear-light
conversion, physically based material model or adjustable lighting environment.

Evaluate professional rendering practices through neutral-object legibility,
linear-light calculations and explicit output color space, normal/crease quality,
and measured responsiveness. This is a practical comparison, not certification
against an unspecified professional standard. The [Three.js color-management
guide](https://threejs.org/manual/pages/color-management.html) explains the
linear-light/display distinction.

[Three.js is MIT-licensed](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
Its [Lambert material](https://threejs.org/docs/pages/MeshLambertMaterial.html)
offers simpler lighting; [Standard material](https://threejs.org/docs/pages/MeshStandardMaterial.html)
adds metallic/roughness physically based shading at additional computation cost.
It is the first library to evaluate if a renderer change becomes justified.
[Babylon.js](https://www.babylonjs.com/specifications/) offers PBR and
[modular imports](https://doc.babylonjs.com/setup/frameworkPackages/es6Support/treeShaking/)
under [Apache 2.0](https://github.com/BabylonJS/Babylon.js/blob/master/license.md).
Neither library's local bundle size, graphics compatibility or performance has
been measured here.

First inspect the actual current teapot and isolate the lighting problem. Prefer
a focused existing-renderer correction if sufficient. A WebGL engine would also
need geometry, camera, edge, selection, clipping and output integration; it is not
a replacement for one color function. No engine/dependency was installed, no
brightness or runtime setting changed, and no performance claim was made for the
reported graphics hardware. Existing mesh-edge repair limits remain unchanged.
