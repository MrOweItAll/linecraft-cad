# Synthetic structural contract coverage

LC-QA-STRUCTURAL-CONTRACTS restores three reviewed original pure suites and their
generic joined-roof generator. Assertions and non-line-ending content are unchanged;
CRLF lines in two public test copies are normalized to LF. The retained originals
remain unchanged. The
generator's file-writing CLI is not invoked: the suites import its in-memory
two-rectangle study. No client geometry, calculator implementation, credentials or
private reference packet is required.

The recovered suites exercise V1 roof comparisons, V2 independent assignments and
V3 located boundaries. They cover physical units, current-source identity, stale
and rehashed alterations, read-only history, bounded parsing, containment/overlap,
declared result arithmetic and explicit unverified-engine/capacity limits. They
contain 72 executed test cases. New `structural-contract-reference.test.mjs` adds
three original literal references so output-derived helper fields are not the sole
arithmetic oracle. Candidate fast selection includes all four suites and fingerprints
the imported joined-roof generator.

## Independent literals

The reference roof is a 40 by 20 foot rectangle with zero overhang/heel, bearing
elevation 10 feet, opposing declared slopes 6:12 and 8:12 and gable ends. Solving
`y/2 = (2/3)*(20-y)` gives ridge `y=80/7`, rise `40/7`, elevation `110/7` feet.

| Face | Projected SF | Surface SF |
|---|---:|---:|
| South 6:12 | 3200/7 | 1600 sqrt(5)/7 |
| North 8:12 | 2400/7 | 800 sqrt(13)/7 |

All eight expected face vertices are literal references. Independent declarations
of 10 sloping-surface PSF plus 2 projected-horizontal PSF give dead forces
`625 sqrt(5)+250` pounds for 125 SF and `1750 sqrt(13)/3+350` pounds for 175 SF.
Synthetic factors `.8*1*20` and `1*1*20` yield 2000/3500 pounds of declared live
force. These are arithmetic inputs, not a structural load standard or design.

South-face rectangles `(2,2)..(12,6)` and `(12,2)..(22,6)` each have 40 SF and
zero positive overlap. Moving the second to `(7,2)..(17,6)` gives 20 SF overlap.
The 40 SF rectangle `(2,10)..(12,14)` has `180/7` SF outside the south face.
These expectations do not call the production exporter or polygon routines.

## Evidence boundary

The first focused run had 74 passes and one new checker failure: its expected
error word did not match the existing correct outside-face rejection. The
correction requires the stable `BOUNDARY_OUTSIDE_FACE` diagnostic and the actual
domain rejection, preserving all geometry, force and tolerance assertions. The
failed receipt is retained privately. No product fix was required or applied.

These are pure source/protocol checks, not external-engine execution/authenticity,
an engineering approval, a load path/member capacity or a native dialog/PDF test.
Desktop file-service dispatch and real file workflows are a separate follow-up;
broader native/installed/client/structural qualification remains open. The 59 runtime
files, 12 resources, immutable manifests, package version and existing installer are
unchanged. Do not aggregate overlapping test classes into a feature-completeness
or daily-use claim.
