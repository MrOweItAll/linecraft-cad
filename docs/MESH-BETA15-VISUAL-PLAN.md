# Beta15 visual confirmation plan

The surface-colored internal-edge source correction is ready for a bounded
visual confirmation. This preparation performs no application launch, capture,
performance run or product repair. Earlier one-shot launch approvals are used;
the proposed new run requires its own explicit approval.

The plan reuses the existing guarded driver/supervisor and keeps the original
independent four-role raster auditor unchanged. All six original synthetic native
fixtures retain their bytes. The three old grid fixtures are preserved but not
opened; timing, CPU profiles and pointer workloads have been removed from this
visual-only proposal. No new runtime, dependency or geometry behavior is added.

## One bounded proposed run

Use one hidden isolated beta15 source application with fresh owned profile,
session, artifacts and temporary directories. Exactly five synthetic Opens
produce six canvas captures and six separate hidden-window images:

| Opened fixture | Captures | Purpose |
| --- | --- | --- |
| Original planar quad | Shaded | Frozen flat-color, outline and seam checks |
| Original stored triangles | Shaded and wireframe | Frozen seam suppression and intentional-edge checks |
| Original folded quad | Shaded | Frozen real-crease check |
| New acute diamond | Shaded | Corner observations for human review |
| New half-pixel-high sliver | Shaded | Thin-face observations for human review |

The camera and 640 by 480 CSS canvas remain fixed. DPR must equal 1 to match the
preserved actual beta14 capture; a different scale stops the run without changing
display settings. Original RGB tolerance 8 and all original raster probe sites
remain unchanged. Failure is preserved without an automatic retry or tolerance
relaxation. The unchanged supervisor keeps its 120-second outer bound and shared
single cleanup attempt. No performance measurement is proposed.

## Additional observations and their limits

The acute diamond projects to `(220,240)`, `(320,250)`, `(420,240)`, `(320,230)`.
The sliver spans x=220..420 and y=239.75..240.25. It has no guaranteed fully
covered interior pixel, so a uniform surface-color assertion would be invalid.

A separate reader binds each new canvas to its name, fixture, mode, PNG hash,
camera, dimensions and DPR. It checks central ink and four literal outside
sentinel patches for gross displacement/spill. Raw corner and endpoint patches
include physical pixel bounds, row dimensions and DPR. All six hidden-window
images have separate filename/role/hash/byte-count bindings for human review.

These sparse checks do not certify corner colors or detect every subpixel stroke
extension. The beta15 matching strokes can extend laterally at thin faces and
repaint an earlier outline at a shared corner. Every stress result explicitly
keeps appearance acceptance false until human review; a valid hash or nonblank
image cannot grant visual acceptance. Jon offered the final visual check and
feedback. Full images and recorded pixels are the review material.

The new headless checks validate the two literal native fixtures, two authored
stress image roles in raw and encoded form, sixteen corrupt stress controls,
six window bindings and twenty-four corrupt window bindings. These are reader
controls, not application captures. Syntax and no-execution-argument guards
also pass. The original unchanged raster controls and passing source gate were
not rerun.

## Remaining boundary

Launch approval, actual startup/workflow, original raster verdicts, limited
stress observations and the user's visual verdict must be recorded separately.
This proposed test permits no Save, native mouse/keyboard, normal profile,
installed/client/build/converter/publication action, automatic snapping or third
mesh-edge repair. The current two-approach repair budget is exhausted.

Beta15 actual app/raster/PDF/build/native/installed/upgrade/daily-use and
performance qualification remain unperformed. Preparation does not change that
status. The hourly loop remains active while this new scope awaits approval.
