# ADR 006: Bounded material and ceiling-space alternatives

> **Historical milestone reference.** This document records its original R0–R6 implementation scope and evidence. It is retained for design history; its status, next-step and test statements are not current v1.36 qualification claims. See [the historical-reference index](../HISTORICAL-REFERENCE.md) and [current release notes](../RELEASE-1.36-BETA.md).

Status: accepted for R6 implementation. Windows and PDF verification are separate evidence.

## Decision

Keep the existing editor and architectural generator as the geometry and transaction authority. Add pure comparison and quantity modules; they receive normalized source and call the same generator used by the drawing. Search does not edit the drawing, its view or Undo history. Apply sends only a configuration and current source identity through the existing semantic transaction and re-evaluates the whole model. Save retains source and a nullable accepted configuration identity, never cached meshes or a search report.

The default study varies flat and rectangular tray ceilings below the fixed roof. Explicit co-design mode adds finite pitch choices and uniform bearing offsets to the selected roof and its linked supports. Footprint, roof-end assignments, room targets, assemblies and clearance reservations remain fixed. Locked/shared supports, explicit common eave overrides, ridge limits and infeasible current room profiles reject unsupported proposals. Unassigned enclosed rooms prevent a qualified whole-model study.

Each room's benefit integrates its actual profile, capped at its target height before applying its dimensionless priority. Excess ceiling height therefore adds no target benefit. Display usable volume and headroom separately. Compare these benefits against separate physical quantities using Pareto dominance; do not add unlike dimensions into an invented cost. Roof skin, closures, wall nominal volume, finish surfaces and edge lengths remain separate. Same-pitch roof area is checked against projected coverage times sqrt(1 + pitch squared), excluding vertical closures.

The finite search has explicit candidate, time, work and probe budgets with cooperative yields and cancellation. Maximum-fit probes add target-limited flat and tray options and consume work. Incomplete studies show their stopping reason and cannot be ranked or applied through the review UI. Cache is limited to one controller's run and exact configuration deduplication. No global private-geometry cache is retained. Results mean best found within the stated finite choices, not a continuous global optimum.

## Alternatives considered

- Replacing the editor or regenerating a drawing would break stable IDs, layouts, scripting and grouped Undo. The existing transaction path preserves these.
- A continuous or unrestricted optimization would obscure termination, feasibility and the reviewed candidate set. A bounded discrete study gives explicit, repeatable scope.
- A scalar material or dollar score would require supplied prices, actual assemblies and purchasing rules. R6 keeps a partial physical ledger and leaves these values unknown.

## Consequences

Roof, closures and ceiling returns retain zero modeled thickness; declared optional roof and horizontal ceiling thicknesses and reservations are respected. Surface quantities still matter at zero thickness. Gross room-boundary finish does not deduct openings, intersections or waste. Wall nominal volume retains junction overlap limitations. Step interface/flashing length is not quantified. Framing lumber, connectors, sheet purchases, waste, prices, total cost, supplier fit and structural approval remain unverified. Both requested truss design and manufacturing-complexity surcharges remain zero.

The review UI checks the full drawing and input fields for staleness. A printed static configuration report is re-evaluated, then inserted as ordinary paper TEXT through one staged revision; it does not embed executable code or expose arbitrary filesystem actions. Adding report text changes the drawing and invalidates the current review. Full search bounds, confidence and Pareto data remain in its JSON report. A semantic edit clears the accepted configuration receipt; ordinary annotation edits preserve it. The receipt identifies a configuration, not an engineering approval or complete search audit.

R7 qualification must test a dimension-confirmed private drawing and separately document unsupported geometry and framing assumptions. R6 does not infer those dimensions from an image.
