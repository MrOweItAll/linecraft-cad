# Preserved DWG readback attribution

## Scope and result

This 2026-10-27 milestone audits the pinned LibreDWG source and two preserved
synthetic R2000 DWGs from [the writer feasibility experiment](DWG-WRITE-FEASIBILITY.md).
It makes no new writer/converter attempt and changes no application runtime.
One fresh JSON readback per preserved DWG returned exit 0 and SUCCESS. Those
readbacks expose duplicate object handles, so the pipeline remains unqualified.

The earlier decoded-DXF floating-viewport failure remains a valid observation of
that DXF artifact. However, its group 69 value of 1 alone does not prove that the
encoded R2000 DWG lost the floating role: pinned source synthesizes that output
value. No ID-repair adapter or DWG export integration follows from this audit.

## Pinned source mechanism

Archive: third-party-source/libredwg-0.13.4-upstream.tar.gz, SHA-256
26a03e30d0f88fedf64be8ceb797193cbfcda7efdabba5eb9694af864e41b4d2.
Member root: libredwg-e3774bd4020fcfebb68150361db74b8b34d170fe.

| Pinned location | Observation |
| --- | --- |
| src/dwg.spec:2438-2457 | VIEWPORT id is a binary field only before R13b1; the DXF block assigns on_off and id to 1 before groups 68/69. |
| src/out_dxf.c:35,169,1851 | IS_DXF, the FIELD_VALUE object mapping and inclusion of dwg.spec make those assignments part of DXF output. |
| src/spec.h:30,512-530 | DXF defaults false; IS_DXF enables it, while IS_JSON enables JSON without enabling DXF. |
| src/out_json.c:29,316,1273 | JSON has its own field mapping and includes the same spec. R2000 JSON therefore omits those viewport fields. |
| src/dwg.spec:2555-2557,5860-5873 | R2000-R2002 viewports reference a VX entity header; LAYOUT viewport vectors are gated to R2004 and later. |

This is a source-path explanation consistent with observed projections. A
matching-source rebuild proving exact compiled-binary lineage was not performed.
The bundled reader and previously used reader are byte-identical, SHA-256
88f3c398bc1ff5a83c365fe8180018ef26947a63fff21fad8a032dd056a47c94.
JSON and DXF projections use the same reader/library; they are not independent
binary consumers. Version labels alone do not strengthen that evidence.

## Fresh observations

The preserved DWGs start with AC1015. Their SHA-256 values are
3cf00a8b2c604ca2770944ed749bd48f085c681e3cd07668098f0c4b57e54b4a
(model) and 46eb452a149028e117b9f2f1d57d0635b8b0eebb749ae18de99877373f38e73b
(multi-sheet). Fresh JSON output hashes are
0c60f91bdaf48c254c3a4567dd76a21927039160e5d87689138b7827b6f99c56 and
d959e078c97fbac19baa2a2f5e10a21bf151eeaff79951bf1c0e104e87393ec2,
respectively. Private receipts bind the commands, artifacts, libraries and source.

| Evidence class | Model | Multi-sheet |
| --- | --- | --- |
| Original and diagnostic DXF handle declarations | Unique | Unique |
| Prior decoded DXF handle declarations | Unique | Duplicate ENDBLK 0x24 |
| Fresh JSON object/unique-handle counts | 36 / 34 | 56 / 55 |
| Fresh JSON duplicate handles | 0xB: LTYPE BYBLOCK and VX_CONTROL; 0x1F: BLOCK_HEADER * and LAYOUT Layout1 | 0x1F: BLOCK_HEADER * and LAYOUT SYNTHETIC B |
| Fresh JSON VIEWPORT count | 0 | 4 |
| Fresh JSON viewport id/on_off | Outside fixture | Both absent in all four, as the R2000 source guards predict |
| Fresh JSON LAYOUT num_viewports/viewports | Both absent | Both absent, as the R2004 source guard predicts |

Duplicate declarations above are properties of decoded object lists. This audit
does not isolate whether each arose during DXF ingestion, encoding, decoding or
projection. The different duplicate sets in DXF and JSON must not be collapsed
into a clean graph claim or treated as independent binary confirmation.

For the multi-sheet fixture, intended floating handles 0x21 and 0x27 retain
center (210,150,0), width 220, height 100, target (120,0,0), view direction (0,0,1)
and status flag 49152. Their view heights are 377.9527559055118 and
188.9763779527559, respectively; inch-model arithmetic implies the original
1:96 and 1:48 scales. Overall handles 0x20/0x26 retain center (210,148.5,0),
420 by 297 frames, zero target, view height 297 and status flag 32768.
These numerical observations do not establish functioning visible model windows.

All four VIEWPORT-to-VX_TABLE_RECORD links are reciprocal. VX_CONTROL 0x33
references records 0x34-0x37, which refer to viewports 0x26,0x27,0x20,0x21.
All four VX names are empty and is_on is 0; every LAYOUT active_viewport is null.
Those states and native viewport activation remain unqualified. Absence of an
explicit owner for the entmode=1 viewports is context-dependent and is not
classified here as corruption.

Handle interpretation matters: own handles use the third array value; non-null
references use the fourth, resolved absolute value. For example, [12,1,2,51]
resolves to 0x33, not 0x2. Null references occur in multiple zero forms. The audit
selects documented handle fields rather than treating all numeric arrays alike.

The retained encode-process logs contain duplicate-handle/missing-object
diagnostics; the retained DXF decode logs and fresh JSON reader logs say SUCCESS.
This refines the earlier report's loose attribution of errors to the reader.
Process diagnostics and decoded-object observations remain separate evidence.

## Verification and limits

Independent expectations and source excerpts were frozen before fresh readback.
A private standard-library auditor imports no application or CAD parser and
checks archive/member hashes, 52 preserved files, command/input/output bindings,
version guards, literal frames/targets/scales/status and reciprocal typed links.
Fifteen copy-only negative observation controls are rejected. They cover those
specific observations, not every graph edge, binary correctness or editability.
A private raw-DXF reader correction accepts leading group 999 comments only;
the original failure and corrected auditor are retained without changing inputs.
Separate read-only review corroborates source macros, raw artifacts, handle
semantics, privacy, compatibility and the stated qualification limits.

The local change is documentation/backlog only. No application build or unchanged
passing gate was repeated. Beta.6 runtime and installer receipts retain their
original scope. No native input, installation, installed/upgrade acceptance,
client drawing, font/plot acceptance or independent consumer edit/save/reopen
was performed. Application DWG writing remains unavailable; daily-use readiness
and all attachment requirements remain open.

The next bounded source-only question is whether placeholder BLOCK_HEADER 0x1F
allocation and the pre-R2004 fallback VX_CONTROL 0xB allocation can explain the
specific collision classes. Trace those branches against the preserved unique
input declarations and process diagnostics without a third converter attempt,
reader rerun, rebuild or automatic viewport-ID repair. Exact compiled lineage,
independent binary decoding and native acceptance remain separate prerequisites.
