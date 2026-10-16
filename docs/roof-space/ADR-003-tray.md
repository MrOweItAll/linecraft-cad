# ADR-003: One bounded stepped tray beneath a fixed roof

**Status:** Accepted for the R3 tray preview
**Date:** 2026-10-15
**Deciders:** Linecraft implementation team, within the requested R3 scope

## Context

R3 already computes a complete convex arrangement of one room beneath an immutable roof. Each cell has an affine cap after declared roof-normal layers, vertical ceiling finish, and local-axis reservation boxes. A flat ceiling gives one whole-room limit, so it cannot describe extra space available in the middle of a room. Ceiling intent must remain independent of roof geometry and bearing elevations. The user explicitly defines this as a mathematical model with zero thickness; optional thickness can be added later.

## Decision

Add `architecture/ceiling-candidates.mjs` as a pure consumer of the existing clearance arrangement. The first candidate contains one building-local XY rectangular plateau, one lower flat band, and an ideal vertical return around the four plateau edges. All lengths remain in the assigned drawing units. Source objects are read-only.

The whole rectangle must be inside the room. Exact convex clipping must conserve both the rectangle area and the complete room area. The rectangle must also have positive physical separation from every room boundary edge. This rejects a rectangle bridging a concave recess even when all four corners lie inside the room. It also rejects wall contact, a zero-width band, and a rise smaller than the physical tolerance.

Clip every clearance cell into the plateau and up to four disjoint outer bands. An affine clearance function reaches its extrema at clipped polygon vertices, so these vertices give the complete positive-area ceiling tests. Separately intersect each closed plateau edge with every clearance cell and test both interval endpoints. That closed-interface test detects a reservation touching the return from outside the plateau, including a single corner contact. It is required because a positive-area test alone would omit such contacts.

Compute finished volume analytically as room area times base clear height plus plateau area times rise. Report horizontal finish area, plateau area, outer-band area, ideal vertical-return area, threshold headroom area, and the limiting point and obstacle. Compare against the actual accepted tray profile when present; otherwise compare against the actual flat ceiling. Infeasible current geometry cannot establish recovered usable space. A negative signed volume difference is reported separately from a recovered volume of zero.

The kernel returns all room-area profile cells and four exact return quads for original Linecraft rendering, plus an exact section helper. The section helper preserves disjoint room intervals across concavities. It does not connect across empty room notches.

## Options considered

| Option | Accuracy and cost | Assessment |
| --- | --- | --- |
| Sample a height grid | Fast to prototype; can miss narrow reservations, recesses and limiting coordinates | Rejected |
| Clip the existing affine arrangement | Exact piecewise-linear geometry within floating-point tolerances; bounded implementation and reusable R3 deductions | Selected |
| General polygon trays, sloped returns and multiple levels | More expressive; requires additional containment, profile topology and construction assumptions | Deferred |

## Physical assumptions and limits

- The vertical return is an ideal zero-thickness finished surface. Its area is a real geometric quantity. Its thickness and material volume are exactly zero.
- Existing R3 vertical ceiling-finish deduction remains applied at the closed return interface. It is not reinterpreted as the horizontal thickness of return construction.
- A candidate is evaluated against zero-thickness mathematical surfaces by default. Entered roof layers, ceiling finish and reservation boxes remain optional constraints; no declaration is required for usable-space metrics or ceiling adoption. Machine-readable framing status remains unverified without obstructing this mathematical workflow.
- Prefabricated-truss design and manufacturing-complexity surcharges are exactly zero. Physical areas and clearance constraints remain active.
- The roof, bearing elevations, room floor and source geometry are never modified by the kernel. Applying a profile belongs to the editor's grouped transaction.
- Limits are 4,096 source cells, 20,480 output cells, 256 room vertices, and a charged work allowance no greater than 2,000,000. Work is charged by source polygon size, not only by cell count. Unsupported complexity fails visibly; there is no grid fallback.
- Predicates use the existing physical tolerance and a nearby room-local origin. This is analytical polygon/affine clipping with floating-point arithmetic, not exact rational arithmetic.

## Validation and consequences

The focused `tests/tray-candidates.test.mjs` suite exercises independent analytical volumes, headroom, normal and vertical finish deductions, inner and outer reservations, closed return and point contacts, concave containment, strict boundary separation, current accepted tray comparison, unit scaling, large translations, immutable inputs and sections.

The first rectangle fixture is 40 by 20 feet, with a 30 by 10 foot plateau. Base elevation is 10 feet, plateau elevation is 11 feet, and floor elevation is zero. The exact volume is 8,300 cubic feet; the 9-foot accepted flat ceiling is 7,200 cubic feet, giving 1,100 cubic feet recovered. The ideal vertical-return area is 80 square feet. These are geometric checks, not a construction certification.

Adding multiple plateaus or physical return thickness requires a new profile contract, explicit material quantities, expanded collision tests, and new evidence. The current zero-thickness mathematical contract does not imply missing return volume. The atomic `useZeroThickness` editor operation clears roof layers and the selected room ceiling finish, retains reservations, and copies shared assemblies before editing. Optional thickness can be entered again later, and existing files are never cleared implicitly.

## Action items

1. Keep accepted and proposed profiles distinct in persistence, UI, sections and grouped Undo/Redo.
2. Verify fresh roof and bearing fingerprints during installed Apply, Undo and Redo tests.
3. Add a separately bounded return-construction envelope only when its thickness is explicitly declared.
