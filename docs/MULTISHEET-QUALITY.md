# Synthetic ordered multi-sheet acceptance

On October 26, 2026, a scheduled bounded coverage milestone exercised the existing
beta4 multi-sheet plotting workflow. No application runtime, schema, manifest,
installer or installed profile changed. This closes a specific automated coverage
gap; it does not add a new plotting feature or qualify client drawing sets.

The source session began at configuration checkpoint
0d89055557dce84791f24c2de90f2e97944a8cf1. The exact existing unpacked beta4 retains
tested runtime commit 474b97a0b202169d38a8d1e2778a15995d92b9f7 and its reviewed
manifest. The old candidate build and native acceptance receipts remain historical.

## Independently declared reference

The public-safe fixture stores two A3 landscape layouts in B,A tab order. The
ordinary Plot setup requests A,B, so following tab order cannot pass accidentally.
One 240-inch model LINE appears through locked viewports centered at (120,0,0),
with paper frames (100,100,220,100) mm. Their 1:48 and 1:96 scales produce literal
127 mm and 63.5 mm PDF rulers, at y=147 mm and x=146.5..273.5 and 178.25..241.75.
These answers come from 240 times 25.4 divided by 48 or 96.

Each sheet has a 100 mm paper sentinel, a title-block border at paper
(10,10)..(410,40), dividers at x=300 and x=360, and a distinct ASCII marker.
Both Arial markers have declared cap height 4 mm at (310,15), inside the same
fixed 60 by 30 mm cell. Before the first application/PDF run, independent Arial
advance/cap-height estimates identified a possible overflow at the initially
proposed 5 mm height. The fixture was deliberately corrected to 4 mm; cell bounds,
physical geometry and audit tolerances were not widened after a failure.

Initial pure-test authoring errors used the wrong existing plot options envelope
and assumed redundant layoutId fields in canonical nested serialization. Those
attempts are retained privately. Existing API/serialization source justified the
corrections; no product defect or product fix is claimed.

## Actual checks and outputs

The selected pure suite passes three checks: literal fixture/state persistence,
explicit ordering without source mutation, and invalid selection rejection.
The fast gate passes 21/21 stages and 634 selected portable checks. Twelve private
core references remain explicitly excluded, not executed or passed.

The source application gate passes 5/5 stages. In addition to the previous source
workflows, the new workflow passes four actual checks: Open of the declared native
fixture; Save As/New/Open with complete-state equality; ordinary temporary Plot
selection/reordering and actual PDF output without live or saved changes; and
hidden/offline/clipboard-free/source/input preservation. Chooser replies are owned
test stubs, not visible Windows dialogs. The same targeted workflow passes against
the previously built, hash-verified unpacked executable without rebuilding it.

Each actual PDF passes the independent reader: 18 declared segment/marker
measurements and 13 rejected reader probes. It verifies exactly two pages in A,B
order, literal page sizes, vector rulers/sentinels/title-block edges and dividers,
marker presence and cell containment, opaque solid black ink and stroke widths,
no image surrogate (including inline images), and background paint order.

Probes cover missing/extra/swapped/duplicated pages, missing marker/ruler/edge,
wrong physical scale, transparent/unknown-opacity stroke, transparent text,
late white overpaint and raster-image replacement. They reuse the same validator
on extracted data copies without changing the actual PDF. They are reader-sensitivity
checks, not separate product features. Existing tolerances remain 0.02 mm length,
0.04 mm combined endpoints, 0.005 mm stroke width and 0.3 mm page extent.

Both complete source PDF pages and both title-block details were freshly inspected.
Markers fit their cells, title blocks are complete and the second model ruler is
half the first. All four unpacked renders are byte-identical to those reviewed
source renders. The actual native files are also byte-identical across source and
unpacked runs. These are PDF renders, not native screenshot captures.

Native SHA-256: ddf8f549024865ebd9c0024134b066f7a5a5b5781cf2f729219cf526dc6536cc.
Source PDF SHA-256: b06954c8d3b3703a6143eafc5edf29b8e42b826266c96a048e2c3189ecaed087.
Unpacked PDF SHA-256: 8b6fa98b61f6d777086fdd50ba9481f6b4b8a6edacda45427c99618337ed2d40.

The four new fixture/test/workflow/auditor files are explicitly fingerprinted by
the gate. Candidate selection runs the new pure suite and source/unpacked workflow.
The extended full candidate gate would have 33 stages; it was not rebuilt/rerun
in this coverage-only milestone. The prior passing 30-stage candidate is retained
under its original test closure, not relabeled as a fresh 33-stage result.

## Remaining boundaries

This is two same-size A3 sheets, one simple synthetic title block and controlled
Arial labels. Mixed paper sizes, production plan/detail sheets, full fonts/templates,
multi-sheet client fidelity, DWG output, installed/upgrade behavior and physical
native input remain unqualified. The installed application and client drawings were
not used. No public push, installation, outbound message or paid service occurred.

The scheduler's initial wake was interrupted after restoring the normal cadence
and before source ownership. A later actual scheduled wake completed this bounded
milestone. The task remains active every four hours; completion of this milestone
does not mean all attachment requirements or daily-use qualification are complete.

## Mixed-paper child milestone - October26,2026 local session

The earlier record retains its original same-size scope and historical cadence.
The new [mixed-paper record](MIXED-PAPER-QUALITY.md) adds ordered A4portrait/A3landscape
coverage with unchanged runtime and preserved original fixture/test. Both actual
source/existing-beta6-unpacked cases pass4app/20PDF/23controls; native and four
render pairs match. Nominal page dimensions are checked against measured MediaBox/
CropBox with the original0.3mm tolerance. Regular18/13 reader observations remain
exact on the preserved PDF. Current cadence is hourly. Production plan/detail,
client/font/template/native/DWG acceptance remains distinct.

## Original detail child

The original model from qualityFixture('detail') now has an independent two-scale
child without changing this original fixture/workflow or the mixed-paper profile.
See [plan/detail coverage](PLAN-DETAIL-QUALITY.md): source/existingbeta6unpacked
4app/50PDF/28controls each, complete persistence and4renderpairs exact. Geometry,
dashcaps/fills and declared ink/gap points are qualified; broad native/client/font
or production drafting conventions remain separate. The next scoped annotation
reference is rotated aligned dimensions/leaders, not another unchanged sheet run.
