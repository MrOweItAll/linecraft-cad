# Pinned DWG allocation attribution

## Result and scope

This 2026-10-27 source-only milestone finds source paths consistent with both
duplicate-handle classes and the truncated placeholder name observed in
[the preserved readbacks](DWG-READBACK-ATTRIBUTION.md). It changes no product code
and performs no new writer, converter, reader, compiler, rebuild or app run.
The original two writer attempts and their failures remain intact.

The findings identify specific prerequisites for a future converter repair.
They do not prove exact compiled-binary lineage, independently decode DWG or
qualify application DWG output. Editable DWG output remains unavailable.

## Independently bound inputs

The pinned archive is third-party-source/libredwg-0.13.4-upstream.tar.gz, SHA-256
26a03e30d0f88fedf64be8ceb797193cbfcda7efdabba5eb9694af864e41b4d2,
member root libredwg-e3774bd4020fcfebb68150361db74b8b34d170fe.

Independent raw-tag inspection finds 34 unique own-handle declarations in each
model input and 50 in each multi-sheet input, including the unchanged original
and diagnostic derivative. Both declare AC1027. Both contain model BLOCK_RECORD
0x12 named *Model_Space, LAYOUT 0x1F and LTYPE BYBLOCK 0xB. Neither declares a
literal asterisk-only BLOCK_RECORD or any VX object. Model has no VIEWPORT;
multi-sheet has four. These are source declarations, not decoded DWG assertions.

Previously captured same-library R2000 JSON has the following observations:

| Case | Object/unique-handle count | Duplicate own handles | VX state |
| --- | --- | --- | --- |
| Model | 36 / 34 | 0x1F: BLOCK_HEADER and LAYOUT; 0xB: LTYPE and VX_CONTROL | Control 0xB; no VX records |
| Multi-sheet | 56 / 55 | 0x1F: BLOCK_HEADER and LAYOUT | Control 0x33; four empty-name records, each is_on=0 |

The colliding BLOCK_HEADER name is * in both captured JSON files. Retained encode
logs report duplicate 0x1F pointing to object 0. This wake reuses those captured
files; it does not generate a new DWG or readback.

## Placeholder handle and lookup

src/in_dxf.c:13981-14000 creates an initial index-0 BLOCK_HEADER for an empty
object list, names it *Model_Space, assigns own handle 0x1F and owner reference 1.
The shown BLOCK_HEADER reuse branch at 9758-9771 tests incoming handle equality
with object 0. Input model handle 0x12 cannot satisfy equality with 0x1F; the
branch does not reuse by matching the model-space name alone. LAYOUT 0x1F does
not satisfy the BLOCK_HEADER type predicate.

At src/in_dxf.c:9807-9810, parsing assigns the incoming own handle and calls
dwg_add_handle without checking its return. src/dwg.c:2070-2096 writes code/value
before checking the object map. A conflict logs and returns 1 without rolling
back that assigned value or replacing the map entry in the shown branch.
This supplies a source-consistent path for two own handles 0x1F to survive,
matching the captured object declarations and earlier process diagnostic.

src/dwg.c:890-920 resolves a handle through one object-map index. A duplicate
object list therefore does not model complete reference resolution. No claim
is made about the exact binary lookup winner, every later fixup, or which
consumer will select a colliding object. Deleting a placeholder or renumbering
one declaration without auditing all references is not a verified repair.

## Model-only VX-control collision

src/encode.c:3933-3954 handles a missing pre-R2004 VX control. If the header
reference and control object are absent, it calls dwg_add_VX(NULL), finds the
new control and directly assigns own handle 0xB. Input BYBLOCK already owns
0xB. This direct store does not call the normal allocator, perform an immediate
collision check or update the map at that assignment.

Normal API_ADD_OBJECT allocation uses dwg_set_next_objhandle
(src/dwg_api.c:25596-25604; src/dwg.c:3397-3430). That source path checks the map
while choosing a normal seed, except for its separate explicit next-handle branch.
The subsequent encoder overwrite is a distinct operation.

Later header-reference behavior must remain qualified. src/dwg.c:2141-2185 can
return an ordered cached reference before calling dwg_add_handle. If it allocates
a new reference instead, that call may perform the duplicate-map check. Absence
of a retained 0xB diagnostic does not identify which path occurred or prove a
clean map. The captured model JSON collision is an observation, not that proof.

## Empty VX records and the two fixtures

dwg_add_VX delegates to API_ADD_TABLE (src/dwg_api.c:27867-27926,28089-28092).
A NULL name creates the missing control but no record. An empty string is a
non-NULL name: the macro can warn, then creates a record, stores the empty name,
appends the control entry and assigns ownership. Object storage is zeroed with
calloc; this is not an instruction to activate a viewport.

src/in_dxf.c:9773-9788 calls dwg_add_VX with an empty string for a VIEWPORT handle
when R11 < target < R2004, and sets reciprocal viewport/VX links. Its assignment
of is_on=1 is commented out. Four input viewports can therefore create the
multi-sheet control/records before encoding, avoiding the missing-control
fallback; the model input has no such viewports. Empty/off captured records are
consistent with this path. No native activation, visibility or editability
claim follows, and later assignments are not exhaustively executed here.

## Placeholder name conversion

src/in_dxf.c:1305-1329 recognizes the AC1027 input as R2007-or-later and explicitly
replaces the placeholder name with TU storage. Import options are set at
13967-13968. src/bits.h:87-92 excludes DXF/JSON input from IS_FROM_TU and
IS_FROM_TU_DWG; include/dwg.h:11450-11452 defines those option flags.

The pinned command entry in programs/dxf2dwg.c sets the requested target and
calls dwg_write_file. src/dwg.c:451-464 copies options/version into the byte chain
and resets dat.from_version to dat.version for DXF/JSON before encoding.
The distinction between byte-chain dat.from_version and dwg.header.from_version
matters: the latter can still reflect the AC1027 input for other guards.

BLOCK_HEADER uses COMMON_TABLE_FLAGS and FIELD_T(name)
(src/dwg.spec:3607-3610; src/spec.h:735-757). src/encode.c:240-258 calls bit_write_T.
For this R2000/import path, src/bits.c:2217-2310 selects TV output, whose writer
uses strlen on bytes (2165-2168). As an illustration, UTF-16LE *Model_Space begins
2A 00 4D 00; its first NUL-terminated byte string is *. This is a computed byte
illustration, not bytes extracted from the encoded DWG. It explains the captured
asterisk consistently with the source path without inventing a literal asterisk
input declaration or proving exact binary provenance.

## Verification, boundaries and next prerequisite

An independent oracle freezes eight member hashes/ranges and independently parsed
input/JSON/log facts before the formal worksheet verification. Read-only source
exploration occurred before that freeze; no producer was run. Archive-bound
supplemental linkage ranges and separate read-only review cover the writer,
allocation, lookup/cache and string paths. Private receipts preserve exact source
excerpts, artifact bindings and the illustrative calculation.

The private standard-library worksheet verifies 91 preserved evidence files,
four input forms, captured critical JSON rows/logs and source declarations.
Seven tampered-copy controls are rejected. These are observation-integrity
checks and literal source predicates, not executed C-path tests, a regression
for a product fix, a complete graph audit or independent binary validation.

This local checkpoint changes only documentation/backlog. Existing runtime,
manifest, fixtures, installer, installed app/profile and client drawings remain
unchanged. Unchanged passing application gates/builds were not repeated. Native,
installed/upgrade, client, font/plot and independent consumer edit/save/reopen
acceptance remain open; daily-use readiness is false.

No further concrete ready item remains inside this finite source-only queue.
A converter repair needs a separately bounded issue, independent failing
regression, approved build prerequisites, exact binary identity and explicit new
attempt accounting. It must not silently become a third attempt at the old
conversion. Independent binary/native consumer acceptance is a separate route.
Keep the preserved failures and coordinate that next scope before resuming;
the current source audit does not authorize an automatic handle or string repair.
