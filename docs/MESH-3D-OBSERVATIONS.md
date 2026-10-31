# Synthetic 3D application observations

The single approved October 31, 2026 beta14 source-app session reproduced a
remaining dark diagonal in both flat fixtures. The shaded quad and stored
coplanar triangles fail the frozen raster check; the folded face and intentional
wireframe pass. The requested seam-free flat display is therefore not complete.

The tested checkout was `70cd0f10340c749c406bf4b0f6d55b401b6a9b44`, with runtime
`efb833fc2098a970162b59d47e4a3d4cd63de0b9` and version `1.36.1-beta.14`.
All 336 prepared input hashes matched before and after execution. No runtime,
fixture, auditor, tolerance, dependency or installed binary changed in this run.

## Actual visual result

Five startup checks and five capture/workload/isolation groups completed. These
groups establish capture and workflow execution, not a passing raster verdict.
The initial independent raster command stopped at the first quad failure.
Applying the unchanged reader separately to all four named, hash-bound captures
gave two failures and two passes. No application was relaunched.

At the observed DPR of 1, each actual canvas bitmap is 640 by 480 pixels. Both
flat images have identical bytes and show a dark diagonal in their complete
canvas and separate hidden-window captures. At the first declared diagonal
probe, observed colors include `(94,96,98)` against the expected flat
`(121,121,121)`, outside the predeclared RGB tolerance of 8. All nine diagonal
locations remain available in private diagnostic evidence. The reader checked
flat interiors and sixteen outline sites before reaching that first failure;
the original fail-fast result does not imply later probes passed.

The folded and wireframe cases pass all declared interior, outline, diagonal
and outside probes. Full visual review confirms the real crease and intentional
wireframe diagonal remain visible. This is a small synthetic top-view result,
not universal geometry, display/DPI, client-model or native-input acceptance.
The drawing reported by the user was not opened.

## First timing observations

The run collected 35 unprofiled observations after seven warmups, followed by a
separate 42-action sampling pass. Each table value is a median of five samples,
in milliseconds. Actions use hidden browser automation and production controls.

| Stored triangles | Same-view action round trip | Camera-preset action round trip | Same-view through two frame callbacks | Camera through two frame callbacks |
| ---: | ---: | ---: | ---: | ---: |
| 200 | 9.67 | 10.94 | 32.68 | 34.15 |
| 800 | 15.58 | 16.49 | 47.16 | 48.53 |
| 3,200 | 40.07 | 43.37 | 49.58 | 50.24 |

The small-grid selected-pointer case measured 22.73 ms action round trip and
50.15 ms through the frame callbacks. The larger grids did not exercise that
selected-pointer case. All three profile files and observation inventories
passed their independent identity/structure checks; geometry remained unchanged.

Raw sampled stacks include surface preparation, projection, rendering, updates
and small-grid picking. The largest-grid profile contains 111.785 ms of inclusive
sample weight under `meshShadedTriangles`, 297.310 ms under `drawModel`, and
417.124 ms under `update`. These overlapping stacks must not be added together.
Generic-name groups are heuristic; raw module/frame context was reviewed for
these named production functions. Missing sort or larger-grid picking samples
do not establish zero cost. Sampling also includes setup, selection/cleanup and
frame waits, and introduces observer overhead.

These observations are neither physical orbit/display latency nor FPS, a GPU or
VRAM diagnosis, a before/after speedup, or a usability threshold. Post-workload
V8 heap readings are not peak memory or video memory. Raw profiles stay private
because their frames contain local paths.

## Preservation and next action

The supervisor recorded 9.708 seconds, driver exit 0 and application exit 0.
The owned application closed normally without forced cleanup; no named owned
application/driver process remained. Final checks recorded hidden windows, only
the six permitted synthetic Opens, no Save/unexpected-dialog/clipboard calls,
and no page errors or HTTP(S) requests after attachment. Normal profile storage
was not selected; whole-profile byte preservation was not measured. Installed
EXE and ASAR hashes remained exact.

The one-shot launch authorization is consumed. Preserve the failed PNGs and
frozen tolerance. The next bounded work is source-only diagnosis and an
independent regression for the residual flat seam before considering the last
remaining repair approach. No product repair was spent by this observation run;
one approach remains at most. No automatic application retry or speculative
performance optimization follows from these results.

Full beta14 application/PDF/build/package/native/installed/upgrade/daily-use
qualification remains open. Earlier beta13 PDF results remain bound to their
earlier runtime. The installed application and candidate publication state are
unchanged; the hourly review remains active.

The subsequent [source-only coverage reference](MESH-SURFACE-COVERAGE-REFERENCE.md)
now reproduces a fill-coverage mechanism consistent with the retained flat
pixels. Its 11 tests have 9 passes and 2 genuine uniformity failures. Diagnosis
and the independent pending regression are complete; no product repair or
application rerun occurred. Repair design must still preserve painter order,
occlusion, real boundaries and geometry before using the remaining approach.
