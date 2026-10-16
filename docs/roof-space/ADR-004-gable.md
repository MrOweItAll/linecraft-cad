# R4: confirmed stationary gable ends

Accepted for the bounded equal-bearing, equal-pitch orthogonal roof model.

R4 extends the existing finite-edge wavefront solver. It does not replace the
HIP kernel, fit overlapping boxes, or take unrestricted minima of infinite
eave planes. Only finite eave segments create moving exclusion bands and sweep
sloped patches. Confirmed terminal gable segments stay stationary and clip the
occupied domain. They create no sloped patch. The same bounded coordinate
contact arrangement handles simultaneous contacts, splits and collapse.

The official [CGAL extrusion documentation](https://doc.cgal.org/latest/Straight_skeleton_2/group__PkgStraightSkeleton2Extrusion.html)
describes vertical extrusion edges as distinct from sloped edges. Its parameter
convention differs from the positive weights of an ordinary weighted straight
skeleton. This is conceptual reference material only: Linecraft uses original
JavaScript and has no CGAL runtime or geometry dependency.

## Confirmed semantic identity and alternatives

`inferGableCandidates(boundary)` normalizes winding and returns every boundary
edge with an unordered exact endpoint key. Keys survive cyclic index changes
and winding changes. Changed coordinates invalidate a key and require renewed
confirmation; the solver never silently remaps a stale end to a different wall.

A terminal edge has convex corners at both ends. Complete candidates cover each
convex corner exactly once using nonadjacent terminal edges. This yields the two
opposite-end orientations of a rectangle, the four short terminal ends of a
cross, and the four wing ends of the tested H. It does not label all rectangular
perimeter edges as gables. Inference searches at most 4,096 states and returns at
most eight alternatives. Unsupported footprints have no complete alternative
and receive an explicit diagnostic.

`solveGableRoof` accepts confirmed `gableAssignments` and `ALL_GABLE` or
`EXPLICIT` policy. `ALL_GABLE` requires one complete candidate. Both policies
reject any resulting outer hip cap in R4; mixed-end roofs are outside this
milestone. Rising interior hip seams remain valid where a deeper H connector
requires them. An unsupported assignment returns no partial faces or edges.

## Geometry, overhang and quantities

Eave and rake overhangs offset their own source edges independently. The adapter
sets actual eave elevation to bearing plus heel minus pitch times eave
overhang. Rake extension never adds an elevation drop. The full extended plan
remains available as `eaveBoundary` for the existing roof/space contract; its
individual boundary edges are classified `eave` or `rake`.

`faces` contains only positive-plan-area sloped roof facets. `gableClosures`
contains separate zero-thickness vertical patches on the confirmed **source
end line**, with bottom at explicit `bearingElevation`. When omitted in the
pure solver, bearing defaults to eave elevation plus pitch times eave overhang.
An explicit heel can therefore add a rectangular vertical portion above an
actual wall bearing. Closure patches are split where their upper roof plane
changes. A rectangle normally has four closure patches representing two ends;
patch count is not end count. These wall closures do not move outward with the
rake. `gableClosureArea` sums source-wall area, not an outer-rake triangular cap.

For a 40 by 20 unit rectangle, pitch 4:12, wall bearing 10, eave overhang 2 and
rake overhang 3, the extended plan is 46 by 24, ridge elevation is 13 1/3,
and the two source gable ends total 66 2/3 square units. The outer rake triangle
would have a different area and is not reported as source-wall material.

All generated roof/closure surfaces have zero thickness. Sloped area, vertical
closure area, eave length and true 3D rake length are retained. Framing lumber,
connectors and physical framing design remain unknown. The prefabricated-truss
design/manufacturing-complexity surcharge remains exactly zero.

## Independent acceptance and limits

The runtime validator rechecks positive-area coverage, no overlap or outside
area, face pitch/XYZ residuals, manifold adjacency and the complete boundary.
Every open edge must agree with its confirmed eave/rake classification.
Constant-gradient drainage characteristics must reach an approved **eave**;
a stationary rake or gable cannot serve as an outlet, including at a valley
endpoint. Vertical closures are excluded from the sloped-area and runoff skin.

The generator retains the existing 512 event-interval, 12,000 patch and
12,000,000 estimated work limits. The gable horizon uses domain extent rather
than half the shortest bounding-box side, because opposed eaves can span the
long rectangle orientation. Incomplete collapse, unresolved finite-front
provenance or a failed runtime proof returns an explicit unsupported result.

Focused tests independently triangulate and intersect roof facets, verify both
rectangular ridge directions, cross/H assignments, shallow/equal/deep H
connectors, all 23 allowed pitches, eave/rake offsets, source-wall quantities,
scale/translation/quarter-turn invariants, stale keys and bad assignments. They
also reverse slopes to require drainage rejection and remove/duplicate facets
to require coverage rejection. Existing HIP tests remain mandatory. A separate
24-case exact full-result comparison against the public 1.11.1 HIP baseline
passed for rectangle/L/T/H, zero/two-unit overhang and 1:12, 4:12 and 12:12 pitch.

R4 does not support holes, multiple components, nonorthogonal local boundaries,
variable bearing/pitch, arbitrary terminal edge chains, mixed gable/hip end
policies or a footprint without a complete supported terminal assignment.
Structural and supplier verification remain unverified. Room/ceiling elevation
does not participate in the roof input.
