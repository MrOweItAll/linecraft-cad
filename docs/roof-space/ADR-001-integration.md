# ADR-001: Extend Linecraft with semantic architectural source

Status: Accepted for bounded R0-R2 preview, October 15, 2026.
Baseline: public commit 40c45886f1e2b81efb10523d8c8690ec1af3ac0b, version 1.8.0. Local public checkout was clean before creating codex/roof-space-r0-r2. The existing private delivery source was inspected before editing.

## Decision
Keep the existing ES-module engine, Canvas renderer, 3D camera/picking, units, layouts, and Electron desktop host. Add a schema-versioned architecture section inside Linecraft/2 (architectural drawings only). Source is authoritative. Generated meshes have a reserved namespace, select semantic owners, and cannot be edited by ordinary drafting commands. Native Save stores no derived cache; Open and grouped Undo/Redo regenerate deterministically. Failed roof solutions retain source and omit invalid roof output and quantities.

Ceiling elevation, wall/bearing elevation, geometric eave elevation and declared heel offsets remain distinct. The owner-specified prefabricated truss design/manufacturing complexity surcharge is exactly zero. Framing lumber, connectors, physical clearances and engineered feasibility are not inferred from a geometric roof.

## Kernel alternatives and decision gate
1. Original bounded orthogonal wavefront: selected. Axis-aligned equal-speed finite fronts permit a square-erosion arrangement with event-time batches and finite swept patches. It is offline, independently authored, and testable against the supplied analytical graph. Restricted to simple orthogonal loops, equal eave and pitch; explicit budgets and unsupported results bound work. Floating point residual checks are not exact predicates. This is a justified scoped original-kernel decision, not a claim of two executed backend benchmarks.
2. CGAL skeleton/extrusion: evaluated through its primary manual and license documentation, not installed or executed. It supports a wider geometry scope, but adds a native/WASM packaging dependency and license obligations requiring a separate distribution decision. No CGAL code or binary is included.

CGAL references checked October 15, 2026:
- https://doc.cgal.org/latest/Straight_skeleton_2/index.html
- https://doc.cgal.org/latest/Straight_skeleton_2/group__PkgStraightSkeleton2Ref.html
- https://www.cgal.org/license.html
- https://arxiv.org/abs/1604.03362

Variable bearing heights require an additive activation/generalized topology milestone. No multiplicative-weight shortcut is asserted. R3 fixed-roof ceiling analysis, R4 gables, R5 variable bearings, and R6 alternatives remain separate gates.

## Consequences
Old drawings load without architectural source. Ordinary drawings remain Linecraft/1. Architectural drawings save as Linecraft/2 with architecture.schemaVersion=1, so older Linecraft versions reject them rather than silently dropping semantics. Both formats load in 1.9; unsupported future architectural schemas reject rather than silently disappear. Physical units must be assigned for analysis; display changes never scale geometry. Architecture modules participate in desktop validation restart guards, source watching, packaging allowlists and test fingerprints.

The handoff reference verification describes analytical self-consistency only. New runtime test reports must identify actual generator and application results separately. Existing drafting dimensions remain nonassociative; architectural source constraints use separate bounded typed records.
