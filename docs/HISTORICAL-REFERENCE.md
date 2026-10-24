# Historical design records and samples

These references preserve Linecraft's development history. They are not a current release checklist or an instruction to replace the existing application. Original future-work statements, schema versions and test counts remain evidence for their named milestone. Current behavior and qualification are described in the [v1.36 beta notes](RELEASE-1.36-BETA.md), [pointer guide](POINTER-1.36.md), [known limitations](KNOWN-LIMITATIONS.md) and separately generated public verification reports.

## Roof + Space R0–R6

The [original implementation handoff](roof-space/IMPLEMENTATION_HANDOFF.md), ADR-001 through ADR-006, and R3/R4/R5/R6 and tray study guides under [roof-space](roof-space/) are archived milestone references. They retain their original constraints and rationale. For example, an R2 or R4 statement that a later capability is pending does not establish its status in v1.36. The synthetic [H analytical fixture](roof-space/H_HIP_4_12_ANALYTICAL_FIXTURE.json) remains a historical mathematical input, not a surveyed or structurally certified building.

The [scripting foundation](SCRIPTING.md) also retains its original R3/R4 integration and acceptance record. Its protocol documentation should be read alongside the actual running version's `describe` response and current public verification scope.

## Versioned drawing samples

Files under [samples](../samples/) are synthetic examples from their named versions. Preserve the originals and open working copies. They are useful for inspection or explicitly selected migration tests; no assertion is made that every restored sample was newly exercised in the v1.36 public gate.

| Sample | Original purpose |
| --- | --- |
| [layouts-inch-v16.linecraft](../samples/layouts-inch-v16.linecraft), [layouts-meter-v16.linecraft](../samples/layouts-meter-v16.linecraft) | Earlier paper/model unit examples |
| [viewport-v17-reference.linecraft](../samples/viewport-v17-reference.linecraft), [viewport-v17-reference.dxf](../samples/viewport-v17-reference.dxf) | Earlier viewport reference pair |
| [viewport-scales-v18.linecraft](../samples/viewport-scales-v18.linecraft) | Earlier viewport scale example |
| [roof-space-H-v19.linecraft](../samples/roof-space-H-v19.linecraft) | R0–R2 roof example |
| [ceiling-space-v110.linecraft](../samples/ceiling-space-v110.linecraft), [tray-ceiling-v111.linecraft](../samples/tray-ceiling-v111.linecraft) | R3 ceiling/tray examples |
| [gable-v112.linecraft](../samples/gable-v112.linecraft) | R4 gable example |
| [scripting-v1121.linecraft](../samples/scripting-v1121.linecraft) | Original scripting example |
| [roof-plot-v1122.linecraft](../samples/roof-plot-v1122.linecraft) | Earlier roof publication example |
| [bearing-v113.linecraft](../samples/bearing-v113.linecraft) | R5 bearing-height example |
| [alternatives-v114.linecraft](../samples/alternatives-v114.linecraft) | R6 bounded alternatives example |

These files do not verify framing, a load path, code compliance or suitability for construction. Structural assumptions and independent professional review remain project-specific.
