# Bounded material and ceiling-space alternatives

> **Historical milestone reference.** This document records its original R0–R6 implementation scope and evidence. It is retained for design history; its status, next-step and test statements are not current v1.36 qualification claims. See [the historical-reference index](../HISTORICAL-REFERENCE.md) and [current release notes](../RELEASE-1.36-BETA.md).

Open **Architecture → Alternatives**, or enter `ROOFOPTIMIZE`. Choose one accepted room and its sole covering roof. Establish a feasible accepted ceiling, a declared roof assembly and room target in the existing Space study first. Every accepted room and roof must remain valid for a proposal to qualify.

The default **Fixed roof** mode varies ceilings beneath the accepted roof. It retains roof coverage, pitch, bearings, gable assignments, roof geometry and all other rooms' intent. **Co-design** is a separate explicit selection: list permitted pitches and uniform bearing offsets. These offsets move the selected roof's source bearings and its linked support-wall tops equally. Existing locks, reservations, opening-head clearance, ridge limits, shared-support decisions and physical feasibility checks remain active. The search does not authorize arbitrary per-edge edits or structural framing design.

Enter drawing lengths separated by semicolons, for example `8'; 9'; 9' 6"`. Flat values and raised tray values are elevations above the building datum. Tray insets are equal offsets from the selected room's bounding rectangle; the current lower ceiling remains the default listed tray base; maximum-fit search also checks a fitted lower base. Exact clearance checks reject a rectangular tray that crosses an unsupported room boundary or obstruction. Pitch entries are rise per 12, such as `4; 4.5; 6`, with half-rise increments from 1:12 through 12:12.

**Include bounded maximum-fit flat and tray proposals** is enabled initially. The analytic probes use the declared roof envelope and are capped at the selected room's target. This adds useful fit proposals without manually placing roof vertices. User-entered proposals are still reported independently, including rejected configurations.

Set the configuration, elapsed-time and geometry-work limits before **Search bounded alternatives**. Each solve/probe yields between bounded engine operations so progress and Cancel remain available. The existing architectural engine regenerates copied source; no candidate changes the live document, camera, selection or Undo history. A cancelled, unsupported, time-limited or work-limited study retains available evidence without a Pareto ranking or enabled Apply. A complete study means its explicitly stated finite grid was exhausted; it does not establish a global optimum.

The comparison separates raw usable volume, target-capped volume benefit and priority-weighted capped benefit. Benefit is integrated for every room from the actual accepted ceiling profile, capped at that room's target height. Volume above a target does not create extra target benefit. Pareto rows have no other feasible row that improves the stated space/material objectives without worsening another. There is no generic cost score or inferred supplier price.

The partial quantity ledger reports:

- Roof projected coverage and actual sloping roof skin, with the same-pitch area identity checked.
- Separate vertical gable and roof-step closure areas.
- Physical ridge, hip, valley, eave and rake lengths. Step/interface length remains unquantified; its separate closure area is reported.
- Ceiling horizontal finish area and separate vertical tray-return area.
- Gross room-boundary finish area, retaining its explicit exclusions for openings, reveals and finish assemblies.
- Existing wall reference length and nominal wall volume, including the existing junction-overlap limitation.
- Declared roof layer nominal volumes and optional horizontal ceiling finish volumes.

Zero-thickness mathematical roofs, ceilings and closures remain the default. Optional explicitly modeled layer thicknesses and clearance reservations remain effective. Lumber, truss webs, fasteners, connectors, cutting waste, sheet purchases, finish assemblies, prices and total cost remain unknown. Prefabricated-truss design surcharge and manufacturing-complexity surcharge remain zero. All framing and supplier verification remains **unverified**.

Select a configuration row to inspect its exact elevations, roof permissions, room benefits, quantity ledger and validation. Rejected rows can be inspected but cannot be applied. Explicitly check the review acknowledgement for a feasible row of a complete, current study, then **Apply reviewed configuration**. Apply sends only the configuration, deterministic candidate ID and source token. The architecture adapter validates the token, regenerates and checks the proposal again, and commits one existing grouped Undo record. Undo/Redo restores source and its accepted-alternative receipt. The saved native document stores the accepted ID, not a writable cache of search rows or derived geometry.

Changing the source, drawing, editor session, study mode, selected room/roof or any study input invalidates prior review. Closing an active search cancels it. Historical rows remain labelled stale and have no ranking or Apply. A new search is required after an accepted edit or a changed input.

**Show comparison JSON** exposes a selectable read-only report in the pane. Its copy-only `window.linecraft.getAlternativeStudy()` counterpart supports test/evidence inspection; it returns copies and does not expose executable input, paths or file writes. `ROOFREPORT` continues to show current architectural quantities and the accepted-alternative ID. Native Save/Open/PDF continue through their established application controls.

For a printable selected-configuration report, choose an existing empty paper layout and use **Insert reviewed report on layout** after completing the same current-row review. The engine re-evaluates the configuration and adds ordinary paper-space `TEXT` using the existing staged revision API. Text is 3 mm high, wraps with Linecraft's own text metrics, and must fit within 12 mm paper margins; a smaller paper or unsuitable current text style is rejected atomically. Existing sheet content is retained. The insertion is one grouped Undo record and does not navigate the live drawing. Close Architecture, save the native drawing, then use the normal Plot controls on that report layout. The printed page explicitly labels the proposal, source revision, current acceptance receipt, partial quantities, unverified framing and zero surcharges. After Apply, run a new comparison before inserting a report so it describes the accepted current source. Search bounds and Pareto evidence remain in the comparison JSON; the printed configuration does not claim a global optimum.

Actual source, packaged and installed checks are recorded by the milestone's test reports. This guide specifies supported behavior; it does not promote an unexecuted Windows interaction or PDF check into verified evidence.
