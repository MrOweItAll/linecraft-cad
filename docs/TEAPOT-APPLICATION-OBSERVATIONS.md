# Beta15 surface and teapot observations

The single authorized hidden source-application session completed on October 31,
2026. All four preserved surface raster checks pass at the unchanged RGB tolerance
of 8. A faint flat diagonal remains visible; passing these sampled criteria does
not mean the diagonal disappeared. The user accepted the appearance of the
presented shaded teapot views. No lighting, geometry, comparison threshold,
renderer dependency or product code changed in this observation milestone.

## What actually ran

The source was documentation checkpoint `2676d0d5517e75a49f0be9691e52adde81d9c0a7`,
with beta15 runtime `dc9aa4f3e666e3fc10614e9ec538f15ee4625e69`. One isolated hidden
session opened six synthetic fixtures: quad, stored triangles, fold, acute,
sliver and teapot. It captured nine 640 by 480 canvas images at DPR1, with nine
separately hash-bound 1280 by 900 window images. Five startup and five workflow
groups passed. The supervisor completed in 11.283 seconds; the driver and owned
application exited successfully without forced cleanup or a retry.

The installed application was not launched. The fresh owned profile was verified;
no save, message dialog or clipboard call was observed. No page error or HTTP(S)
request was observed after the listeners attached. This is not a complete traffic
audit or whole-normal-profile byte comparison. All 346 pinned launch inputs,
85 sealed preparation files and both installed executable/archive hashes remain
exact. Earlier numerical trials and beta14 failure evidence stay preserved.

## Surface and appearance results

The frozen quad, stored-triangle, fold and wireframe reader passed all four roles.
The two flat images are byte-identical. Each of the nine sampled diagonal patches
contains a residual `(114,114,115)` pixel beside the `(121,121,121)` fill: maximum
channel deviation 7, within the existing tolerance 8. The exact sampled centers
are the fill color. The fold and intentional wireframe remain distinct.

Acute/sliver and teapot readers passed their role, camera, dimensions, image
binding and sparse ink/outside checks. Those checks do not certify all corner,
sliver, silhouette, normal, shading or occlusion pixels. The shaded teapot retains
a prominent facet grid and dark regions. The user answered "Appearance looks
acceptable" for the presented shaded views. This specific human judgment is
recorded separately from the unchanged automated `appearanceAccepted=false`
markers; it does not grant general surface or native-display qualification.

The original parametric teapot has 3,600 vertices, 3,704 faces and 7,096 fan
triangles in five separate components. Open rims and overlapping components are
intentional. It is neither the Utah reference dataset nor a watertight solid.

## Observed response and CPU samples

Each operation has five recorded observations after one excluded recorded warmup.

| Operation | Median control round trip | Median including two frame callbacks |
| --- | ---: | ---: |
| Same-view shaded redraw | 108.61 ms | 120.38 ms |
| Camera preset and redraw | 114.68 ms | 133.32 ms |

A separate twelve-action pass produced one JavaScript CPU profile with 1,172
samples over a reported 2.034-second span. Raw frame URLs identify application
drawing/shading and `3d-view.mjs` camera/surface preparation among sampled work.
Named inclusive groups overlap; their times must not be added. Control/frame-wait
overhead, idle time and garbage collection are included. No speedup, FPS, physical
input latency, GPU completion, VRAM or peak-memory claim follows from this run.

The post-workload V8 heap sample reported 38,058,104 used bytes out of 89,419,776
total bytes. Its four raw fields are finite and nonnegative, with used no greater
than total. This is one sample, not a peak or a full process-memory measurement.

## Continuing limits

The one-session launch approval is consumed. No retry or third mesh-edge repair
is authorized. The current full-precision coordinates, comparison threshold and
lighting remain unchanged. The earlier no-gain numerical findings remain in
[the numerical and lighting review](TEAPOT-NUMERICAL-LIGHTING-REVIEW.md).

This bounded synthetic result does not qualify the full application/PDF gate,
build, installed/upgrade/native workflows, client drawings or daily use. The hourly
loop remains active and quiet when there is no new actionable work. Actual PNGs,
raw observations, audit outputs and independent review stay in the private run
evidence; private machine paths and client material are excluded from this report.
