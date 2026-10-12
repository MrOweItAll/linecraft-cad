# Linecraft CAD 1.6 quick use

Use the command line for exact input, and the canvas for placement, selection and navigation. Enter accepts an input; Escape ends the active command or clears selection. HELP opens searchable command options and limits.

## Make a drawing

1. Open UNITS or the status-bar unit button. Choose the drawing’s model unit and separate linear/angular formats. Apply saves one undoable drawing preference edit; it does not rescale existing coordinates.
2. Enter LINE, RECTANG, CIRCLE or another Draw tool. Coordinates accept absolute `10,20`, relative `@10,20`, polar `@50<30deg`, and explicit physical values such as `12”` or `1m`.
3. Click selects a whole object; Shift+click toggles it. A left-to-right window selects enclosed objects; a right-to-left crossing window also selects touched objects. Drag blue grips or use Properties to edit exact supported values.
4. Save a `.linecraft` drawing to preserve editable objects, layouts, styles, layers and views. DWG/DXF Open imports supported model-space objects into a new drawing and reports omissions; the original exchange file is read only.

## Put model views on paper

1. Click + beside the bottom Model tab. Give the sheet a name, choose paper size/orientation, and Apply page setup. Paper coordinates and annotations use millimeters.
2. Choose New viewport, or enter MVIEW. Enter two paper corners, for example `10,10` and `190,120`. This creates a rectangular window onto the model without copying or rescaling model geometry.
3. Select the frame edge. Choose a scale such as 1:50/1:100, or Custom. Model units determine physical scale: a 1000 mm model line is 20 mm long on paper at 1:50. A unitless model uses millimeters for viewport scaling.
4. Edit model center XYZ, paper frame dimensions and orthographic orientation in Properties. Each viewport keeps its own scale and view. Drag frame edges to move it, or corner grips to resize it; Undo restores accepted frame edits.
5. Double-click inside a viewport to work in its model space. Double-click outside, click the VIEWPORT MODEL status button, or enter PSPACE to return to paper. Use the Model tab for the standalone drawing.
6. Lock the viewport after choosing its view. Wheel and middle drag then zoom/pan the whole sheet while retaining MSPACE; the viewport ratio and model center stay fixed. Unlocked navigation edits that viewport’s view and can be undone.

Paper annotations belong to the sheet. Draw TEXT, dimensions and planar geometry in PAPER; those objects stay independent of projected model objects. Page setup changes the sheet size, never geometry scale. Existing frames must fit the new page. Frame borders are visible on screen and print only when Print border is set to Yes.

## Control layers

Open Manage beside Layers, or enter LAYER. Each accepted cell edit is saved with this drawing and has Undo.

| Control | Effect |
| --- | --- |
| On | Global visibility in every drawing space. |
| Model | Visibility in standalone model views. |
| Paper | Visibility of all sheet content, including projected model geometry. |
| VP Freeze | Hides model geometry in the selected viewport only. Select a frame first. |
| Lock | Prevents object edits on that layer. |
| Color / Lineweight / Linetype | Stroke appearance; Continuous, Dashed, Hidden or Center. |
| Plot | Includes/excludes layer content from PDF independently of on-screen visibility. |

Layer 0 is permanent. Layers referenced by model/paper objects, stored blocks or viewport frames cannot be deleted. Rename updates saved references.

## Choose a construction plane and view

Choose 3D model, then World XY, XZ or YZ near the canvas. Use 3-point UCS for a custom origin and axes, entering three noncollinear **world** XYZ points. A planar selected mesh face also offers Use face as UCS. Offset moves the acquisition plane along its normal.

Typed spatial drawing coordinates use the active UCS. Pointer coordinates come from the labeled construction plane or an enabled object snap. The status readout reports UCS coordinates; mesh Properties use world XYZ. An edge-on plane has no pointer intersection: use Plan, choose another view or type a coordinate.

**UCS changes construction; PLAN and view presets change viewing direction.** PLAN with Enter looks normal to Current UCS; W chooses World. The World orientation cube changes only the view and retains the UCS. BOX/CYLINDER heights follow the active plane normal. CIRCLE/ARC on arbitrary planes remain analytic curves. EXTRUDE follows a closed profile’s normal and retains its source; meshes are polygonal rather than ACIS solids.

| Navigation or selection | Action |
| --- | --- |
| Middle drag / wheel / double middle click | Pan / anchored zoom / fit. |
| Shift + middle drag | Constrained orbit. |
| Ctrl + Shift + middle drag | Original free orbit with roll. |
| Shift + Space | Cycle overlapping whole objects at the cursor. |
| Ctrl + Space | Cycle front and obscured candidates at the cursor within the selected filter; Whole mode cycles objects. |
| Shift + F1 / F2 / F3 / F4 | Choose Whole / Vertex / Edge / Face. |
| Escape with no active prompt | Clear selection and restore Whole object mode. |

A selected vertex has editable world XYZ. Edge/face center properties translate their vertices; faces also have a normal-distance control. Orange grips move selected subobjects in a plane parallel to the acquisition plane through that grip. Editing triangulates quadrilateral faces. General whole-object commands require Whole mode; mesh subobject deletion and solid Boolean operations are unavailable.

## Export a sheet

PLOT or Ctrl+P previews Current space. An active layout prints at physical paper 1:1 with its saved viewport scales. Choose Model extents for Fit/exact-ratio output of the model instead. Layout page setup governs paper size; model paper/margin/ratio controls do not override it. Layer Plot and viewport Print border apply. Three-dimensional PDF output is vector wireframe; shaded rendering is a canvas view.

PUBLISH chooses up to 20 saved Linecraft drawings and writes one combined PDF. The preview illustrates the current drawing; chosen files provide the sheets. With Current space, each source’s saved active layout selects its physical page, allowing mixed paper sizes. No physical printer job is submitted. Source files and the current Save association remain unchanged.

DXF Export preserves implemented geometry, styles and authored paper layouts/viewports within the bounded exchange scope. It cannot write native DWG or import exchange-file paper layouts. Literal reserved TEXT exchange tokens may reject an entire DXF export before a chooser/write; the editable drawing remains intact. See [README.md](README.md) for public scope, limits and test commands.
