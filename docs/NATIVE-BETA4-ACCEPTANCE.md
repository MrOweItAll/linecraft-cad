# Native acceptance of 1.36.1-beta.4

On October 26, 2026, the exact unpacked beta4 from the passing 30-stage candidate
gate completed focused visible Windows acceptance of LC-MON-007, planar paper
SOLID import. Tested code: `474b97a0b202169d38a8d1e2778a15995d92b9f7`. The session
began at documentation checkpoint `3dabd9d71030a4d3225e783eb44d28f156fc0286`.
No runtime change, rebuild or rerun of the unchanged automated gate occurred
during this native session. The native About dialog displayed 1.36.1-beta.4.

Executable SHA-256: `6e3c0833afba9d807a2626553c76a96e9de734c526b26d0c36698441fb9057b5`.
ASAR SHA-256: `61fc16b92f181bd225e0b81b533ec4c00f6317f592c2d5a9a39051f255976c48`.

## Method and six checkpoints

A visible unpacked executable used a new disposable profile. Agent-driven native
input operated an untouched synthetic DXF, ordinary editing controls and real
Windows Open, Save As and PDF Save dialogs. Controller use was restricted to
describe/snapshot observations. No controller mutations, geometry/viewport
repair scripts, chooser stubs, browser automation or hidden test flags were used.

All six native checkpoint receipts passed:

| Checkpoint | Observed result |
|---|---|
| Positive Open | One model LINE and two paper objects retained; the SOLID becomes an editable solid HATCH with literal 40 by 20 mm boundary, area 800 square millimeters, declared appearance and layout ownership |
| Native MOVE | Only the paper fill and its origin move by (5,7); IDs, area and every unrelated complete-state field remain exact |
| Native Undo/Redo/Undo | Complete documents exactly match imported, moved and imported states |
| Save As / New / Open | Actual saved native file and reopened complete document match the accepted state, including navigation fields |
| Actual PDF | Native PDF Save produces the owned PDF; complete live and saved native states remain unchanged after plotting |
| Rejected Open | A separate synthetic SOLID with one final Z=2 corner is rejected; the prior nonempty document, observed name/window title and saved native/PDF bytes remain unchanged |

The rejected-Open checkpoint does not independently establish preservation of
history, dirty-state internals or an adopted filesystem path. Its recorded scope
is the complete serialized drawing, observed name/title and saved output bytes.
Other unsupported paper cases retain their separate automated-test scope.

## Explicit navigation comparison and import presentation

The first visible import matched every qualified packaged-baseline field except
`paperViewport.scale`: `1.7205387205387206` became `1.4455668131510417`. Normal
`fitPaper` computes this navigation zoom from the actual canvas size. There are
no layout viewports in the fixture; physical geometry, paper placement, styles,
ownership and all other serialized fields were exact. The actual native snapshot
was retained unchanged. This single independently justified navigation difference
was recorded explicitly, rather than discarding view fields from comparison.
Subsequent MOVE/history, persistence and plotting checks used that accepted native
baseline and compared complete documents exactly.

The visible import report disclosed the nonassociative solid-fill representation
and correctly listed two paper objects. Its pre-existing headline misleadingly
labels the total of three supported objects as being in model space. Actual
document counts are one model object plus two paper objects, verified separately.
This presentation limitation is tracked as LC-MON-008/P3; no runtime change was
made for it.

## Independent actual-PDF acceptance

The unchanged independent reader passed both measurements and rejected all seven
negative controls. The actual fill measured approximately 39.99972254 by
19.99987742 mm, area 799.98954776 square millimeters, at the declared sheet
position. The paper sentinel measured 9.99993064 mm with approximately
0.19999862 mm stroke width. Literal expectations were 40 by 20 mm, area 800,
PDF bounds (20,247)..(60,267) mm, and a 10 mm sentinel.

Opaque complete quadrilateral coverage and paint order were checked. Missing,
partial, shifted, wrong-sized, transparent/unknown-opacity fill and late white
overpaint controls rejected for their intended reasons. No tolerances or expected
geometry were changed. Raster corroboration found interior dark fraction 1.0
across 56,446 fully interior pixels, against minimum 0.995, with the established
0.1 mm inset and grayscale threshold below 32. Missing/partial raster probes
also rejected. These reader controls are not additional product features.

Fresh full-page and detail renders of the actual native-produced PDF were visually
inspected. The rectangle was complete with clean edges; the separate sentinel
and declared page placement were consistent. These durable images are PDF renders;
no local native screenshot archive is claimed.

Actual native SHA-256: `98492c5f0923a93c1fea40c4d53fea1bc1629b5234e80d7ed4506080e399b7dd`.
Actual PDF SHA-256: `704763a0db43467624a2f399ae69a60ad828a16c9090e7ddf6777e2dc5b48e18`.

## Compatibility, preservation and limits

The actual native-saved file passed four preserved pure source readers: 1.36.0,
beta1, beta2 and beta3. Complete parsed state and serialized text were exact,
without presentation-loss exceptions. Each reader's 59 runtime files and the
input remained unchanged. These comparisons do not establish older installed
UI/render/PDF behavior or installed upgrade/downgrade acceptance.

Normal quit closed the owned candidate and removed its private control descriptor.
All five original unrelated windows remained. End checks found unchanged candidate
EXE/ASAR, installed EXE/ASAR, 128 recorded source inputs, two earlier reference
inputs, the two owned run inputs and two recorded normal-profile configuration
files. No client drawing was opened, edited, saved or copied. The installed
daily-use application was neither started nor replaced.

The close input succeeded before a tool observation assignment encountered an
undeclared binding. No close input was repeated; fresh window/process checks
confirmed normal closure and preservation. Private receipts retain the original
observations, comparisons, journal and hashes without publishing machine paths,
profiles or control credentials.

This establishes focused native acceptance of the unpacked beta4 paper-SOLID
workflow. Installed/upgrade qualification, broad human drafting usability,
DPI/font/mouse coverage and client-drawing fidelity remain pending. No actual new
DWG fixture or native AutoCAD comparison is claimed. The
[implementation record](PAPER-SOLID-IMPLEMENTATION.md) retains the narrow SOLID,
planarity/thickness and TRACE/3DFACE boundaries. Earlier beta2/beta3 native records
retain their own versioned scopes.

The installer was not run. Daily-use readiness remains false pending the remaining
qualification and separate promotion/release authorization. No publication, push,
merge, tag, outbound message or scheduler change occurred. Manual invocation
ready; unattended execution not enabled.
