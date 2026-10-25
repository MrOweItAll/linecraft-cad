# Viewport-scaled architectural tick width

The selected policy is geometric width that scales with the viewport. Dimension
styles can optionally store `tickWidth`, a positive finite length in drawing units.
Like arrow/tick size, it uses the existing style and per-object annotation scales:

```
effective model width = tickWidth * style.scale * dimension.scale
paper width in mm = effective model width * model-unit millimetres / viewport denominator
```

For a 12 mm width with both annotation scales at 1, the reference ticks plot
0.24 mm at 1:50 and 0.12 mm at 1:100. Their ordinary dimension/extension lineweight
remains 0.1 mm. Paper-space dimensions use millimetres and their annotation scales.
There is no new global width default. Unset styles retain the complete previous
serialization and rendering behavior.

In Settings, Dimension style, **Tick width (drawing units)** accepts an optional
length using the drawing's unit format. Blank inherits the old lineweight. Native
files retain an explicit width; structured `dimStyle` operations accept `tickWidth`
and can clear it with `null`. The operation uses existing atomic validation and
Undo/Redo. Invalid or nonfinite supplied/effective widths are rejected.

Explicit ticks use two filled triangles per tick. Their existing centerline
endpoints stay unchanged; filled vertices participate in bounds, picking and
projection. Canvas and PDF project every vertex, so width is geometric rather
than a fixed page or pixel lineweight. Closed arrows, angular dimensions and
leader ticks retain their existing behavior. Leader width is outside this change.

## Compatibility and qualification

This change retains the existing native schema with an optional style property.
Older readers can discard that property and lose its declared appearance. Keep
the original native file and a PDF; schema compatibility does not mean the new
width survives an older reader.

DXF does not retain the new width setting. Export emits a specific warning for
affected dimensions and uses its prior dimension geometry, including legacy tick
lineweight. No independent-width DXF roundtrip or DWG writer is claimed.

The beta3 candidate has its own cumulative manifest. It preserves the beta2
HATCH/viewport importer and names the four additional runtime changes explicitly:
core, canvas controls/rendering, settings markup and PDF plotting. Baseline and
beta1/beta2 manifests and artifacts remain immutable. Candidate checks, visible
native acceptance and installed upgrade acceptance remain distinct evidence.

Focused tests cover independent geometry, geometric scale, complete native state,
Undo/Redo, invalid widths/overflow, filled-ink picking, unchanged closed/angular
arrows, atomic scripting and the DXF warning/fallback. The independent actual-PDF
reader must reject missing/partial fill, inherited/fixed width, changed body
lineweight or altered tick length; it measures both 1:50 and 1:100 views.

No installation, release publication or client drawing change is part of this
implementation. See the private candidate report for the executed gate and limits.
