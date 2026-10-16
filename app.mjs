import * as geometry from './core.mjs';
import {createScriptingAPI} from './linecraft-scripting.mjs';
import * as view3d from './3d-view.mjs';
const {createEditor,worldToScreen,screenToWorld,zoomAt,pan,zoomExtents,hitTest,entitiesInBox,findSnap}=geometry;

const $ = id => document.getElementById(id);
const canvas = $('drawing-canvas');
const ctx = canvas.getContext('2d');
const input = $('command-input');
let editor = createEditor();
let width = 1, height = 1, dpr = 1;
let pointer = null, rawPointer = null, snap = null, drag = null;
let gridEnabled = true, snapEnabled = true, orthoEnabled = false, panTool = false;
let documentName = 'Untitled drawing';
const desktop = window.linecraftDesktop || null;
const developmentMode = Boolean(desktop&&window.linecraftDevelopment===true);
let savedFingerprint = null, documentActionBusy = false, pendingDevelopmentReload = false, closingApplication = false;
let importedAwaitingSave=false;
let commandRecall = [], recallIndex = 0;
let lastMiddleClick = null;
let toastTimer;
let localGeometryClipboard=null, clipboardCutPending=false, clipboardWritePromise=null, completionItems=[], completionIndex=-1, referenceCategory='All';
let annotationEditor=null, settingsDraft=null;
let plotMode='plot',plotModule=null,plotPreviewRevision=0,plotSubmitting=false,lastPlotOptions=null;
let orbitMode=null, orbitPivot=null, pointerScalar=null, pointerUnavailable=null, gripPropertyIndices=new Map(),cubeDrag=null,cubeClickSuppressed=false;
let selectedViewportId=null,pageSetupLayoutId=null,renderContext=null,subobjectMode='whole',selectedSubobject=null,overlapCycle=null,viewportNavigationDraft=null;
let viewportNavigationTimer=null,viewportFrameRequest=null,viewportPointerScreen=null,viewportScaleTarget=null;
let architectureTab='walls',architectureBoundaryEntityId=null,architectureInputEditor=null,architectureInputUnits=null,architectureSpaceContext='',architectureTrayContext='';
const commandCatalog=[
  {name:'ARCHITECTURE',aliases:[],group:'Architecture',icon:'box',summary:'Edit semantic walls, rooms, hip roofs and fixed-roof ceiling studies.',options:'Walls & openings · Rooms · Hip roof · Space study · Report & status',limits:'Orthogonal buildings and equal-eave HIP roofs without enclosed holes. Declared clearance envelopes do not certify engineered framing.',example:'ARCHITECTURE → Walls & openings'},
  {name:'WALL',aliases:[],group:'Architecture',icon:'line',summary:'Add an architectural wall with exact local coordinates.',options:'Building-local start/end XY · Thickness · Center/left/right reference · Base and bearing elevations · Support role',limits:'Opens the Architecture wall tool. Uses existing drawing length input. Structural bearing is a user declaration, not engineering approval.',example:'WALL → Start 0,0 → End 20\',0 → Add straight wall'},
  {name:'WALLFROM',aliases:[],group:'Architecture',icon:'polyline',summary:'Create architectural walls from a confirmed vector path.',options:'Select one horizontal model LINE, polyline or rectangle · Choose reference face and thickness',limits:'Captures the selected geometry as semantic source and retains the original drafting path. Later drafting-path edits do not edit the walls. Unsupported geometry is rejected rather than approximated.',example:'Select a closed PLINE → WALLFROM → Convert selected path to walls'},
  {name:'WALLHEIGHT',aliases:[],group:'Architecture',icon:'line',summary:'Edit an architectural wall bearing/top elevation.',options:'Select existing wall in Architecture · Base and bearing/top elevations · Support role',limits:'Room ceiling elevation remains a separate control. Variable roof bearing solutions are a later milestone.',example:'WALLHEIGHT → choose wall → edit bearing elevation → Apply'},
  {name:'ROOM',aliases:[],group:'Architecture',icon:'rectangle',summary:'Recognize wall-enclosed rooms and store ceiling intent.',options:'Recognize rooms · Label · Current/target ceiling elevation',limits:'Ceiling intent is separate from bearing. Use ROOFSPACE for a mathematical fixed-roof study with optional thickness and reservation envelopes.',example:'ROOM → Recognize rooms → choose room → Apply room intent'},
  {name:'ROOFSPACE',aliases:[],group:'Architecture',icon:'measure',summary:'Calculate usable finished ceiling space beneath a fixed roof.',options:'Room · Zero thickness by default · Optional roof and ceiling thickness · Reservation boxes · Headroom · Flat ceiling or rectangular tray proposal',limits:'One flat ceiling or one rectangular tray under a single validated roof. Roof geometry remains fixed. Thickness offsets can be added anytime.',example:'ROOFSPACE → choose room → save study intent'},
  {name:'ROOFSECTION',aliases:[],group:'Architecture',icon:'measure',summary:'Add a dimensioned snapshot section through a fixed-roof room study.',options:'Space study · Along building X/Y · Crossing coordinate · Model-space drawing origin',limits:'Ordinary geometry and measured labels are a snapshot, not an associative structural detail. Requires a supported clearance study.',example:'ROOFSECTION → section axis and crossing coordinate → Add section to model space'},
  {name:'ROOF',aliases:[],group:'Architecture',icon:'box',summary:'Generate an equal-eave HIP roof from an orthogonal footprint.',options:'Selected closed PLINE/rectangle or wall perimeter · 23 pitches · Mitered overhang · Bearing and heel offset',limits:'One simple orthogonal coverage loop without enclosed holes. Gable ends, variable bearings and framing design are unavailable.',example:'Select a closed footprint → ROOF → 4:12 → Generate hip roof'},
  {name:'ROOFPITCH',aliases:[],group:'Architecture',icon:'box',summary:'Set an existing roof pitch in half-rise increments.',options:'1:12 through 12:12 in 0.5-rise increments',limits:'Opens the roof parameters; source changes regenerate derived geometry as a grouped edit.',example:'ROOFPITCH → choose 4.5:12 → Apply roof parameters'},
  {name:'ROOFUPDATE',aliases:[],group:'Architecture',icon:'box',summary:'Regenerate architectural geometry from accepted source.',options:'Current walls, rooms and roof groups',limits:'Validation diagnostics remain visible; unsuccessful geometry is not reported current.',example:'ROOFUPDATE'},
  {name:'ROOFREPORT',aliases:[],group:'Architecture',icon:'measure',summary:'Inspect architectural quantities, status and assumptions.',options:'Source revision · Geometry/drainage status · Quantities and unverified framing',limits:'No complete material cost, supplier approval or ceiling-space certification. Truss design/manufacturing complexity surcharge is zero.',example:'ROOFREPORT'},
  {name:'ROOFDETACH',aliases:[],group:'Architecture',icon:'copy',summary:'Copy selected generated architecture to ordinary editable geometry.',options:'Select generated walls, room boundaries or roof surfaces · ROOFDETACH · Undo restores the previous drawing',limits:'The copies lose architectural association. The original architectural source and its generated geometry remain authoritative; copied geometry is outside architectural quantity reports.',example:'Select a generated roof → ROOFDETACH'},
  {name:'LINE',aliases:['L'],group:'Draw',icon:'line',summary:'Draw connected individual line segments.',options:'Successive points or direct lengths after the first point · Undo (U) · Close (C) · Enter to finish',limits:'Straight planar or spatial paths on the active UCS plane. A direct length follows the eligible pointer direction; without one it follows the previous segment or the UCS X axis.',example:'L → 0,0 → @100,0 → @0,60 → Enter'},
  {name:'PLINE',aliases:['PL'],group:'Draw',icon:'polyline',summary:'Draw one polyline with straight segments.',options:'Successive vertices or direct lengths after the first point · Undo (U) · Close (C) · Enter to finish',limits:'Arc segments, width and bulges are unavailable. Direct lengths use the pointer direction, previous segment, or +X.',example:'PL → 0,0 → 80,0 → 80,40 → C'},
  {name:'ARC',aliases:['A'],group:'Draw',icon:'arc',summary:'Draw a circular arc through three points.',options:'Start point · Point on the arc · End point',limits:'Three-point construction only. Center, angle, direction, length and tangent construction modes are unavailable.',example:'A → 0,0 → 50,50 → 100,0'},
  {name:'RECTANG',aliases:['REC'],group:'Draw',icon:'rectangle',summary:'Draw a rectangle from opposite corners.',options:'Two opposite corners',limits:'Opposite corners define a rectangle in the active UCS plane. Non-world planes are stored as exact spatial paths. Chamfer, fillet and thickness construction options are unavailable.',example:'REC → 0,0 → 100,60'},
  {name:'CIRCLE',aliases:['C'],group:'Draw',icon:'circle',summary:'Draw a circle from a center and size.',options:'Center + radius · Diameter (D)',limits:'2P, 3P and tangent constructions are unavailable.',example:'C → 50,30 → D → 20'},
  ...[
    {name:'ELLIPSE',aliases:['EL'],group:'Draw',icon:'ellipse',summary:'Draw a full analytic ellipse from two axes.',options:'Two first-axis endpoints, or Center (C) + first-axis endpoint · Other-axis distance or point',limits:'Full planar ellipse only. Elliptical arcs, isocircles and rotation-based axis construction are unavailable. Either axis may be the longer one.',example:'EL → 0,0 → 40,0 → 10'},
    {name:'SPLINE',aliases:['SPL'],group:'Draw',icon:'spline',summary:'Construct an open cubic B-spline with control vertices.',options:'4–1024 control vertices · Method: CV · Local Undo (U) · Enter to finish',limits:'Stored degree-three clamped B-spline geometry. Fit-point interpolation, periodic closing, other degrees and rational weights are unavailable; intermediate control vertices need not lie on the curve.',example:'SPL → 0,0 → 0,40 → 40,40 → 40,0 → Enter'},
    {name:'HATCH',aliases:['H'],group:'Draw',icon:'hatch',summary:'Fill one closed boundary with a solid or parallel-line pattern.',options:'Solid or Parallel · Parallel angle and positive spacing · Pick a closed boundary edge',limits:'One rectangle, closed straight polyline, circle or ellipse; the boundary is captured without association. Islands, multiple loops and native pattern libraries are unavailable. Pattern and aggregate geometry limits prevent excessive fills.',example:'H → Parallel → 45 → 5 → pick a rectangle edge'},
    {name:'DIMANGULAR',aliases:['DAN'],group:'Annotate',icon:'arc',summary:'Measure an angle between two independently defined rays.',options:'Vertex · First ray point · Second ray point · Placement chooses minor or reflex sector',limits:'Three-point planar angular dimension with drawing style and editable definitions. Source-object association and direct line/arc/circle selection modes are unavailable.',example:'DAN → 0,0 → 40,0 → 0,40 → 20,20'},
    {name:'BLOCK',aliases:['B'],group:'Blocks',icon:'block',summary:'Define named reusable planar geometry and replace sources with one reference.',options:'Name · Base point · Select source objects · Enter',limits:'Flat 2D definitions saved with the drawing. Sources become an INSERT reference; nested references, 3D blocks, redefinition and external references are unavailable.',example:'B → Panel → 0,0 → select objects → Enter'},
    {name:'INSERT',aliases:['I'],group:'Blocks',icon:'insert',summary:'Place a reference to a named definition in this drawing.',options:'Existing block name · Insertion point · Positive uniform scale · Rotation',limits:'Internal flat planar blocks only; nonuniform scales, external drawings and attribute prompts are unavailable. Definitions travel with geometry clipboard content.',example:'I → Panel → 100,0 → 2 → 30'},
    {name:'ARRAYRECT',aliases:['AR'],group:'Modify',icon:'array',summary:'Create a rectangular grid of ordinary copies.',options:'Select sources · Rows · Columns · Signed row and column spacing',limits:'Nonassociative copies, with 1–100 rows/columns, at most 1000 cells and 10000 new objects. Array editing handles, levels and associative array resources are unavailable.',example:'AR → select objects → Enter → 2 → 3 → 20 → 30'},
    {name:'FILLET',aliases:['F'],group:'Modify',icon:'fillet',summary:'Trim or extend two line sides and connect them with a real circular arc.',options:'Nonnegative radius · Pick first and second LINE near each retained side · Radius (R) may be changed',limits:'Two editable nonparallel LINEs; zero radius creates a sharp meeting corner. Polyline, circle, ellipse, spline and 3D edge filleting are unavailable.',example:'F → 10 → pick first line side → pick second line side'},
    {name:'CHAMFER',aliases:['CHA'],group:'Modify',icon:'chamfer',summary:'Trim or extend two line sides and add a beveled connector.',options:'Two nonnegative setback distances · Pick each LINE near the side to retain',limits:'Two editable nonparallel LINEs. Angle, polyline and 3D edge modes are unavailable. Setbacks cannot consume the retained line.',example:'CHA → 10 → 20 → pick first line side → pick second line side'},
    {name:'STRETCH',aliases:['S'],group:'Modify',icon:'stretch',summary:'Move enclosed vertices while keeping outside vertices in place.',options:'Two crossing-window corners · Base point · Destination',limits:'Partial LINE, straight PLINE, RECTANG and SPLINE control vertices stretch; fully enclosed planar objects move whole. A stretched rectangle becomes PLINE. Partial circles, ellipses and block references stay unchanged; partial other types or crossed 3D geometry reject the edit.',example:'S → 30,-5 → 50,25 → 0,0 → @10,5'},
    {name:'PEDIT',aliases:['PE'],group:'Modify',icon:'pedit',summary:'Convert and edit one straight polyline path.',options:'Select LINE / PLINE / RECTANG · Convert LINE · Open / Close / Join / Reverse / local Undo · Enter to finish',limits:'Straight segments only. Join requires exact connected endpoints; widths, bulges, fit/spline conversion and tolerance joining are unavailable. Rectangle edits convert it to PLINE.',example:'PE → select line → Enter → Yes → Join → select connected paths → Enter → Enter'},
  ].filter(command=>geometry.ADVANCED_COMMANDS?.includes(command.name)),
  {name:'BOX',aliases:[],group:'Model',icon:'box',summary:'Create a faceted box with exact XYZ vertices.',options:'First corner X,Y,Z · Opposite XY corner · Signed nonzero height',limits:'Polygon mesh geometry; native ACIS solid options and Boolean operations are unavailable.',example:'BOX → 0,0,0 → 40,30,0 → 20'},
  {name:'CYLINDER',aliases:[],group:'Model',icon:'cylinder',summary:'Create a faceted cylinder along the active plane normal.',options:'Center X,Y,Z · Positive radius · Signed nonzero height',limits:'A 32-sided polygon mesh along the UCS plane normal. Elliptical cylinders and native solid construction options are unavailable.',example:'CYLINDER → 60,0,0 → 10 → 30'},
  {name:'SPHERE',aliases:[],group:'Model',icon:'sphere',summary:'Create a faceted sphere around an exact center.',options:'Center X,Y,Z · Positive radius',limits:'A polygon mesh with 16 latitude and 32 longitude divisions. Native analytic solid/B-rep geometry is unavailable.',example:'SPHERE → 100,0,20 → 15'},
  {name:'EXTRUDE',aliases:[],group:'Model',icon:'extrude',summary:'Extrude a closed planar profile into a mesh.',options:'Select closed RECTANG / PLINE / planar POLY3D / circle · Enter · Signed height',limits:'Extrusion follows the profile normal and retains source profiles. Circle extrusion is a 32-sided mesh. Taper, path and native solid association are unavailable.',example:'Select rectangle → EXTRUDE → 25'},
  {name:'3DPOLY',aliases:[],group:'Model',icon:'polyline',summary:'Draw connected vertices in full XYZ space.',options:'X,Y,Z or @offset · Successive points · U · C · Enter',limits:'Straight 3D segments only. Pointer points lie on the labeled active plane or a snapped feature; typed UCS XYZ is authoritative.',example:'3DPOLY → 0,0,0 → 40,0,20 → 40,40,40 → Enter'},
  {name:'ROTATE3D',aliases:[],group:'Model',icon:'rotate',summary:'Rotate selected meshes or 3D paths around a world axis.',options:'Selection · X / Y / Z axis · Base X,Y,Z · Signed angle',limits:'World-axis rotation only. Arbitrary two-point axes and native gizmos are unavailable.',example:'Select box → ROTATE3D → Z → 0,0,0 → 45'},
  {name:'3DORBIT',aliases:[],group:'Model',icon:'orbit',summary:'Orbit the camera while retaining world Z as up.',options:'Left drag in Orbit mode · Shift + middle drag transient orbit · Enter / Esc exits',limits:'Auto Target uses selected or visible geometry; disabling it acquires a click target. Navigation changes view only.',example:'3DORBIT → drag left/right or up/down → Esc'},
  {name:'3DFORBIT',aliases:[],group:'Model',icon:'orbit',summary:'Orbit freely with an original arcball, including roll.',options:'Drag inside arcball for free rotation · Outside for roll · Ctrl + Shift + middle drag',limits:'Changes the camera rather than object coordinates. Object editing resumes after leaving orbit mode.',example:'3DFORBIT → drag around the arcball → Esc'},
  {name:'3DORBITCTR',aliases:[],group:'Model',icon:'orbit',summary:'Specify the center used for orbiting.',options:'Center X,Y,Z · Constrained orbit around that stationary point',limits:'The rotation pivot is separate from the camera look-at point. An off-screen center retains the default orbit center.',example:'3DORBITCTR → 20,15,10 → drag → Esc'},
  {name:'VPOINT',aliases:[],group:'Model',icon:'orbit',summary:'Set a 3D view from an exact direction vector.',options:'Nonzero X,Y,Z viewing vector',limits:'World direction vectors only; native compass dialogs and spherical entry are unavailable.',example:'VPOINT → 1,-1,1'},
  {name:'PLAN',aliases:[],group:'Model',icon:'fit',summary:'Align the view to the current UCS or World XY plane.',options:'Current UCS (Enter) / World (W)',limits:'Changes view direction only; the UCS origin and axes remain unchanged.',example:'PLAN → Enter'},
  {name:'LAYOUT',aliases:[],group:'Settings',icon:'rectangle',summary:'Create and manage named paper layouts.',options:'New / Set / Delete / Rename · Paper layout tabs',limits:'Page size is assigned separately in Page setup. Paper objects use millimeters and model geometry remains in its model units.',example:'LAYOUT → New → Sheet 1'},
  {name:'PAGESETUP',aliases:[],group:'Settings',icon:'settings',summary:'Assign paper size and orientation to a layout.',options:'Preset paper sizes · Portrait / Landscape · Layout name',limits:'One validated edit with Undo. Existing viewport frames retain their paper coordinates when page size changes. Frames may extend beyond the paper and are clipped when plotted.',example:'PAGESETUP → A3 landscape → Apply'},
  {name:'LAYER',aliases:['LA'],group:'Settings',icon:'settings',summary:'Manage drawing layers and per-viewport visibility.',options:'On / Lock / Color / Lineweight / Linetype / Model / Paper / Plot / VP Freeze',limits:'Paper visibility governs both paper annotations and model content projected through sheet viewports. VP Freeze applies to the selected viewport.',example:'LA → edit a layer cell'},
  {name:'MVIEW',aliases:['MV'],group:'Navigate',icon:'rectangle',summary:'Create a rectangular or closed polygon model viewport on paper.',options:'Two opposite paper corners · Polygonal (P) vertices + Close · Object (O) closed polyline / rectangle · Frame grips / scale / view / lock',limits:'Simple straight boundaries, up to 64 polygon vertices. Source boundaries remain separate. Frame edits and ratios do not rescale model objects; new viewports are unlocked.',example:'MVIEW → 10,10 → 200,140'},
  {name:'MSPACE',aliases:['MS'],group:'Navigate',icon:'select',summary:'Edit model geometry through a paper viewport.',options:'Double-click inside a viewport or enter MSPACE',limits:'A locked viewport keeps its view and ratio; wheel and middle drag navigate the sheet while model space stays active.',example:'Double-click inside a viewport'},
  {name:'PSPACE',aliases:['PS'],group:'Navigate',icon:'select',summary:'Return to editing paper annotations and viewport frames.',options:'Double-click outside an active viewport or enter PSPACE',limits:'Paper coordinates use millimeters independently of the model units.',example:'PSPACE'},
  {name:'MODEL',aliases:[],group:'Navigate',icon:'select',summary:'Return to the standalone model drawing.',options:'Model tab or MODEL',limits:'Preserves paper layouts and saved viewport views.',example:'MODEL'},
  {name:'UCS',aliases:[],group:'Model',icon:'orbit',summary:'Choose the coordinate system used for construction.',options:'World / XY / XZ / YZ · 3point in world coordinates · Planar mesh face',limits:'Typed spatial coordinates use this UCS; pointer acquisition stays in the labeled construction plane. View presets and PLAN do not change the UCS.',example:'UCS → 3 → 0,0,0 → 1,0,0 → 0,0,1'},
  {name:'TEXT',aliases:['DT'],group:'Annotate',icon:'text',summary:'Place one line of drawing text.',options:'Insertion point · Height · Rotation · Text content',limits:'One line per object, up to 2048 encoded exchange bytes. Height follows the installed font’s capital height; widths use an original metric approximation. Native justification and fields are unavailable.',example:'TEXT → 0,0 → 5 → 0 → Entrance'},
  {name:'MTEXT',aliases:['T','MT'],group:'Annotate',icon:'mtext',summary:'Place wrapped multiline drawing text.',options:'Two opposite text-box corners · Height (H) · Multiline content editor',limits:'Top-left insertion and a positive width; up to 65536 plain-text characters with original word wrapping. Overlong words wrap by character. Rich formatting and native inline codes are unavailable.',example:'MTEXT → 0,50 → 80,10 → enter multiline text'},
  {name:'TEXTEDIT',aliases:['ED'],group:'Annotate',icon:'text',summary:'Edit the content of one text object.',options:'Select TEXT or MTEXT · Enter · Edit and apply',limits:'One text object at a time. Properties controls also edit height, rotation, style and multiline width.',example:'TEXTEDIT → select text → Enter → apply edited content'},
  {name:'DIMLINEAR',aliases:['DLI'],group:'Annotate',icon:'dimension',summary:'Measure a horizontal or vertical span.',options:'First origin · Second origin · Dimension placement · H / V axis choice',limits:'Definition points are independent of source objects. Measurements update from those points; automatic source-object association is unavailable.',example:'DIMLINEAR → 0,0 → 100,50 → 50,70'},
  {name:'DIMALIGNED',aliases:['DAL'],group:'Annotate',icon:'aligned',summary:'Measure the distance along two definition points.',options:'First origin · Second origin · Dimension placement',limits:'Straight aligned measurement with the chosen dimension style; definition points are independently editable.',example:'DIMALIGNED → 0,0 → 80,60 → 40,50'},
  {name:'DIMRADIUS',aliases:['DRA'],group:'Annotate',icon:'radius',summary:'Label the radius of a selected circle.',options:'Select circle · Label placement',limits:'A snapshot of the selected center/radius is stored; changing the source circle does not automatically change this dimension.',example:'DIMRADIUS → pick circle → place label'},
  {name:'DIMDIAMETER',aliases:['DDI'],group:'Annotate',icon:'diameter',summary:'Label the diameter of a selected circle.',options:'Select circle · Label placement',limits:'Circle sources only. The stored center and radius are independent of the source; automatic association is unavailable.',example:'DIMDIAMETER → pick circle → place label'},
  {name:'STYLE',aliases:['ST'],group:'Settings',icon:'settings',summary:'Choose and edit named drawing text styles.',options:'Font · Default height/rotation · Width factor · Create named style',limits:'Opens the original settings dialog. Arial, Segoe UI and Consolas are supported; font files and SHX assets are not included.',example:'STYLE → edit the text style → Apply settings'},
  {name:'DIMSTYLE',aliases:['D'],group:'Settings',icon:'dimension',summary:'Choose and edit named dimension styles.',options:'Text style/height · Arrow size · Gap · Measurement precision',limits:'Opens the original settings dialog. Each setting has a bounded validated value; full native dimension variable grammar is unavailable.',example:'DIMSTYLE → edit dimension style → Apply settings'},
  {name:'UNITS',aliases:['UN'],group:'Settings',icon:'settings',summary:'Choose drawing-specific linear and angular units.',options:'Architectural / Surveyor / Engineering / Custom presets · Model unit · Linear format and precision · Angular input unit, format and precision',limits:'Changes formatting and document metadata without rescaling existing coordinates. Explicit length and angle suffixes override bare-input units. Surveyor uses feet + decimal inches and DMS; bearings are unavailable.',example:'UNITS → Drawing units → choose a preset or edit Linear / Angular → Apply settings'},
  {name:'DIST',aliases:['DI'],group:'Measure',icon:'dimension',summary:'Inspect the distance between two points.',options:'First point · Second point',limits:'Reports a 2D measurement without creating drawing geometry.',example:'DIST → 0,0 → 100,50'},
  {name:'ID',aliases:[],group:'Measure',icon:'select',summary:'Inspect an exact drawing coordinate.',options:'Point input or pointer acquisition',limits:'Reports XY coordinates; Z remains zero.',example:'ID → 25.5,40'},
  {name:'AREA',aliases:['AA'],group:'Measure',icon:'rectangle',summary:'Inspect the area and perimeter of a point polygon.',options:'Successive polygon points · Close or Enter to finish · Local Undo',limits:'Straight point polygons only; object, Add and Subtract options are unavailable.',example:'AREA → 0,0 → 100,0 → 100,50 → 0,50 → Enter'},
  {name:'MOVE',aliases:['M'],group:'Modify',icon:'move',summary:'Translate selected geometry without changing its size.',options:'Select objects · Base point · Destination',limits:'The displacement shortcut is unavailable.',example:'M → select objects → Enter → 0,0 → @20,10'},
  {name:'COPY',aliases:['CO','CP'],group:'Modify',icon:'copy',summary:'Copy geometry to one or several destinations.',options:'Base + destinations · Mode: Single / Multiple · Undo (U) · Enter / Exit to finish',limits:'Every @destination is relative to the original base. Array is unavailable; mode applies to this command.',example:'CO → select objects → Enter → 0,0 → @20,0 → @40,0 → Enter'},
  {name:'ROTATE',aliases:['RO'],group:'Modify',icon:'rotate',summary:'Rotate geometry about a base point.',options:'Base point · Signed angle in the drawing input unit, explicit angle suffix, or picked direction',limits:'Reference and Copy options are unavailable.',example:'RO → select objects → Enter → 0,0 → 30deg'},
  {name:'SCALE',aliases:['SC'],group:'Modify',icon:'scale',summary:'Scale selected geometry uniformly about a base.',options:'Base point · Positive scale factor',limits:'Reference and Copy options are unavailable.',example:'SC → select objects → Enter → 0,0 → 2'},
  {name:'MIRROR',aliases:['MI'],group:'Modify',icon:'mirror',summary:'Reflect geometry across a two-point mirror line.',options:'Two mirror-line points · Delete source: Yes / No',limits:'MESH, POLY3D and INSERT selections are rejected. Mirror-line points must be distinct; the default retains source objects.',example:'MI → select objects → Enter → 0,0 → 0,100 → N'},
  {name:'OFFSET',aliases:['O'],group:'Modify',icon:'offset',summary:'Create parallel or concentric geometry at a distance.',options:'Positive distance · Source object · Side point · Repeat with same distance · Undo (U) · Enter to finish',limits:'Line, circle and rectangle sources only. Through, erase-source and layer options are unavailable.',example:'O → 10 → pick source → pick side → Enter'},
  {name:'TRIM',aliases:['TR'],group:'Modify',icon:'trim',summary:'Trim a line to selected cutting boundaries.',options:'Select boundaries · Enter · Pick the line portion · Undo (U) · Enter to finish',limits:'Line targets; line, circle, finite arc, rectangle and polyline boundaries. Explicit boundary selection; quick-trim, projection and fence options are unavailable.',example:'TR → select boundaries → Enter → click unwanted line portion → Enter'},
  {name:'EXTEND',aliases:['EX'],group:'Modify',icon:'extend',summary:'Extend a line endpoint to selected boundaries.',options:'Select boundaries · Enter · Pick near the endpoint · Undo (U) · Enter to finish',limits:'Line targets; line, circle, finite arc, rectangle and polyline boundaries. Edge, quick-mode and projection options are unavailable.',example:'EX → select boundaries → Enter → click near endpoint → Enter'},
  {name:'BREAK',aliases:['BR'],group:'Modify',icon:'break',summary:'Remove a portion between two points on a line.',options:'Select a line · First break point · Second break point',limits:'Straight LINE targets only. Input points are projected onto the selected line; both projected positions must lie within its segment.',example:'BR → select a line → first point → second point'},
  {name:'JOIN',aliases:['J'],group:'Modify',icon:'join',summary:'Join connected lines and open polylines into one polyline.',options:'Select connected lines / open polylines · Enter · Connected loops become closed polylines',limits:'Shared endpoints must coincide exactly; the chain cannot branch or be disconnected. Arcs, circles and already closed polylines cannot be joined.',example:'J → select connected lines → Enter'},
  {name:'EXPLODE',aliases:['X'],group:'Modify',icon:'explode',summary:'Convert rectangles or polylines into separate line segments.',options:'Select rectangles / polylines · Enter',limits:'Select only rectangles and polylines. Other selected types reject the edit; each resulting segment inherits the source properties.',example:'X → select a rectangle or polyline → Enter'},
  {name:'ERASE',aliases:['E'],group:'Modify',icon:'delete',summary:'Erase selected unlocked objects.',options:'Preselect objects, or select then Enter',limits:'Hidden and locked geometry cannot be erased.',example:'E → select objects → Enter'},
  {name:'COPYCLIP',aliases:[],group:'Clipboard',icon:'copy',shortcut:'Ctrl+C',summary:'Copy selected geometry to the drawing clipboard.',options:'Select objects · Enter',limits:'Native clipboard contains Linecraft geometry. Text fields use their normal copy behavior.',example:'Select objects → COPYCLIP'},
  {name:'CUTCLIP',aliases:[],group:'Clipboard',icon:'delete',shortcut:'Ctrl+X',summary:'Copy geometry, then remove it after a successful clipboard write.',options:'Select objects · Enter',limits:'A failed clipboard write retains the source geometry. Undo restores a completed cut.',example:'Select objects → CUTCLIP'},
  {name:'COPYBASE',aliases:[],group:'Clipboard',icon:'clipboard',shortcut:'Ctrl+Shift+C',summary:'Copy geometry with a specific placement base.',options:'Base point · Select objects · Enter; preselected objects are retained',limits:'The clipboard base is fixed for subsequent paste placement.',example:'COPYBASE → 0,0 → select objects → Enter'},
  {name:'PASTECLIP',aliases:[],group:'Clipboard',icon:'clipboard',shortcut:'Ctrl+V',summary:'Place geometry from the drawing clipboard.',options:'Destination point · Placement preview',limits:'Native paste reads recognized Linecraft geometry only. Browser mode keeps an internal drawing clipboard.',example:'PASTECLIP → 100,40'},
  {name:'PLOT',aliases:[],group:'Output',icon:'plot',summary:'Produce a vector PDF sheet from the current drawing.',options:'A4 / A3 / Letter / Tabloid · Portrait / landscape · Extents fit or exact 1:n · Margins · Color / grayscale / monochrome · Lineweights',limits:'Desktop vector PDF output of model extents or physical paper layouts with saved viewport scales. 3D views use projected wireframe. Physical printer jobs and native plot-style tables are unavailable.',example:'PLOT → choose paper and scale → Save PDF'},
  {name:'PUBLISH',aliases:[],group:'Output',icon:'publish',summary:'Publish saved Linecraft drawings as one PDF with separate sheets.',options:'Same sheet setup as PLOT · Native picker for up to 20 saved Linecraft drawings · One combined PDF',limits:'The current drawing preview illustrates the setup; chosen files provide the published sheets. Source files and the current drawing remain unchanged. Sheet-set databases and batch DWG/DXF publishing are unavailable.',example:'PUBLISH → choose sheet settings → choose saved drawings → save PDF'},
  {name:'UNDO',aliases:['U'],group:'Navigate',icon:'undo',shortcut:'Ctrl+Z',summary:'Undo the previous completed edit.',options:'Undo the latest edit or the active command’s supported local step',limits:'A finished multi-destination COPY is one undo group.',example:'U'},
  {name:'REDO',aliases:[],group:'Navigate',icon:'redo',shortcut:'Ctrl+Y',summary:'Restore the last undone completed edit.',options:'Redo latest undone edit',limits:'A new edit clears redo history.',example:'REDO'},
  {name:'ZOOM',aliases:['Z'],group:'Navigate',icon:'fit',summary:'Fit visible geometry or set an unlocked viewport scale.',options:'Extents (E) · Positive factorXP in an unlocked model viewport · Wheel zoom anchored at cursor',limits:'XP means paper millimeters per model coordinate unit. For an inch model, 25.4/96XP sets 1/8 inch per foot. General X zoom and a scale-list editor are unavailable. View scale is bounded; tiny or extreme geometry may remain below screen resolution.',example:'Z → E; inch-model viewport: Z → 25.4/96XP'},
  {name:'HELP',aliases:['?'],group:'Navigate',icon:'help',summary:'Search this command reference.',options:'Search by name, alias or task',limits:'The reference describes this application’s implemented scope.',example:'HELP'},
];
const unavailableCatalog=[
  ['ROOFGABLE','Assign terminal gable ends.','Planned R4: explicit gable constraints are unavailable. R2 generates HIP roofs only.'],
  ['ROOFOPTIMIZE','Compare bounded material and room-space alternatives.','Planned R6 after clearance, gable and variable-bearing validation. No ranking or complete cost claim is currently available.'],
  ['HATCH','Fill closed regions with a hatch pattern.','Regions remain outlines; patterned and solid fills are unavailable.'],
  ['DIMANGULAR','Measure an angle between drawing directions.','Angular dimension entities are unavailable.'],
  ['BLOCK','Define reusable grouped geometry.','Block definitions and named block libraries are unavailable.'],
  ['INSERT','Insert a block definition or external reference.','Use drawing clipboard placement for implemented geometry; block insertion is unavailable.'],
  ['ARRAYRECT','Create a rectangular pattern of repeated objects.','COPY supports individual repeated destinations; rectangular array objects are unavailable.'],
  ['FILLET','Connect edges with a rounding arc.','Automatic fillet construction and edge trimming are unavailable.'],
  ['CHAMFER','Create a beveled corner between edges.','Automatic chamfer construction is unavailable.'],
  ['ELLIPSE','Draw an ellipse or elliptical arc.','Circular circles and arcs are supported; elliptical geometry is unavailable.'],
  ['SPLINE','Draw a smooth curve through control points.','Spline geometry and curve fitting are unavailable.'],
  ['STRETCH','Stretch parts of selected geometry.','Edit individual blue grips or move complete objects; crossing-window stretch is unavailable.'],
  ['PEDIT','Edit polyline segments and options.','Polyline vertex grips, JOIN and EXPLODE are available; the PEDIT command is unavailable.'],
  ['PLOT','Produce a plotted sheet with print settings.','Plot layouts, paper sizes, print scales and plot styles are unavailable.'],
  ['PUBLISH','Publish a set of drawings or sheets.','Batch publishing and sheet sets are unavailable.'],
].map(([name,summary,limits])=>({name,aliases:[],group:'Unavailable',available:false,summary,limits})).filter(item=>!commandCatalog.some(command=>command.name===item.name));
const format = (n, places=4) => {
  const value=Number(n);
  if(!Number.isFinite(value))return 'Out of range';
  if(value!==0&&Math.abs(value)<10**-places)return value.toExponential(places).replace(/\.0+(?=e)/,'');
  return value.toFixed(places).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};
const state = () => editor.state;
const activeEntities=()=>editor.getActiveEntities?editor.getActiveEntities():state().entities;
const activeObjects=()=>editor.getActiveObjects?editor.getActiveObjects():activeEntities();
const selectionObjects=()=>editor.getSelectionObjects?editor.getSelectionObjects():activeObjects().filter(object=>state().selectionIds.includes(object.id));
const modelEntities=()=>editor.getModelEntities?editor.getModelEntities():state().entities;
const currentLayout=()=>state().layouts?.find(layout=>layout.id===state().activeLayoutId)||null;
const currentViewport=()=>viewportNavigationDraft?.id===state().activeViewportId?viewportNavigationDraft:currentLayout()?.viewports.find(viewport=>viewport.id===state().activeViewportId)||null;
const selectedViewport=()=>{const selected=selectionObjects().filter(object=>object.type==='VIEWPORT'),id=selected.length===1?selected[0].viewportId:state().activeViewportId||(!editor.getActiveObjects?selectedViewportId:null);const viewport=currentLayout()?.viewports.find(viewport=>viewport.id===id)||null;return viewportNavigationDraft?.id===viewport?.id?viewportNavigationDraft:viewport;};
const paperSpace=()=>state().activeSpace==='paper';
const drawingContext=()=>{const context=renderContext?{...state(),activeSpace:renderContext.space,activeLayoutId:renderContext.layoutId,activeViewportId:renderContext.viewportId}:state();return context.activeSpace==='paper'?{...context,settings:{...context.settings,units:'mm',linearFormat:'decimal'}}:context;};
const displaySettings=()=>paperSpace()?{...state().settings,units:'mm',linearFormat:'decimal'}:state().settings;
const lengthFormat=(value,prefs=displaySettings())=>Number.isFinite(value)?geometry.formatLength?geometry.formatLength(value,prefs):format(value):'Out of range';
const angleFormat=(value,prefs=displaySettings())=>Number.isFinite(value)?geometry.formatAngle?geometry.formatAngle(value,prefs):`${format(value,2)}°`:'Out of range';
const areaFormat=(value,prefs=displaySettings())=>Number.isFinite(value)?geometry.formatArea?geometry.formatArea(value,prefs):format(value):'Out of range';
const layerFor = entity => state().layers.find(layer => layer.name === entity.layer) || state().layers[0];
const visibleEntities = () => (renderContext?.entities||activeEntities()).filter(entity => geometry.isEntityVisible?geometry.isEntityVisible(entity,drawingContext()):layerFor(entity)?.visible !== false);
const selectableEntities = () => visibleEntities().filter(entity => !layerFor(entity)?.locked);
const visibleObjects = () => activeObjects().filter(object=>geometry.isEntityVisible?geometry.isEntityVisible(object,drawingContext()):layerFor(object)?.visible!==false);
const selectableObjects = () => visibleObjects().filter(object=>!layerFor(object)?.locked);
const pointsOf = entity => {
  if(geometry.entityGripPoints)return geometry.entityGripPoints(entity,drawingContext());
  if(entity.type==='LINE')return [entity.start,entity.end];
  if(entity.type==='CIRCLE'){const {center:c,radius:r}=entity;return[c,{x:c.x+r,y:c.y},{x:c.x,y:c.y+r},{x:c.x-r,y:c.y},{x:c.x,y:c.y-r}];}
  return entity.points || [];
};
const paperView=()=>state().paperViewport||{center:{x:210,y:148.5},scale:2};
const paperToScreen=point=>worldToScreen(point,paperView(),width,height);
const screenToPaper=point=>screenToWorld(point,paperView(),width,height);
const renderingViewport=()=>renderContext?renderContext.viewport||null:currentViewport();
const modelWorkspace=()=>renderContext?renderContext.viewport?.workspace==='3d':currentViewport()?currentViewport().workspace==='3d':!paperSpace()&&state().workspace==='3d';
const activePlane=()=>editor.getConstructionPlane?editor.getConstructionPlane():{origin:{x:0,y:0,z:state().settings?.constructionElevation??0},xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:1,z:0},normal:{x:0,y:0,z:1}};
function camera3D(){const viewport=renderingViewport();if(!viewport)return state().camera3d||view3d.defaultCamera();const camera={...viewport.camera3d,target:{...viewport.modelCenter},scale:paperView().scale*geometry.modelUnitMillimeters(state().settings)/viewport.scaleDenominator,projection:'orthographic'},center=paperToScreen({x:viewport.frame.x+viewport.frame.width/2,y:viewport.frame.y+viewport.frame.height/2}),axes=view3d.cameraBasis(camera),dx=(width/2-center.x)/camera.scale,dy=(center.y-height/2)/camera.scale;camera.target={x:camera.target.x+axes.right.x*dx+axes.up.x*dy,y:camera.target.y+axes.right.y*dx+axes.up.y*dy,z:(camera.target.z||0)+axes.right.z*dx+axes.up.z*dy};return camera;}
const toScreen = point => {const viewport=renderingViewport();if(viewport&&geometry.viewportModelToPaper){try{const projected=geometry.viewportModelToPaper(point,viewport,state().settings);return{...paperToScreen(projected),depth:projected.depth,clipped:false};}catch{return{x:NaN,y:NaN,depth:NaN,clipped:true};}}return paperSpace()&&!renderContext?paperToScreen(point):modelWorkspace()?view3d.projectPoint(point,camera3D(),width,height):worldToScreen(point,renderContext?.space==='paper'?paperView():state().viewport,width,height);};
const toWorld = point => {if(paperSpace())return screenToPaper(point);if(modelWorkspace()){const ray=view3d.screenRay(point,camera3D(),width,height);return geometry.intersectPlaneRay?geometry.intersectPlaneRay(ray,activePlane()):view3d.intersectConstructionPlane(ray,state().settings?.constructionElevation??0);}const viewport=currentViewport();return viewport&&geometry.viewportPaperToModel?geometry.viewportPaperToModel(screenToPaper(point),viewport,state().settings):screenToWorld(point,state().viewport,width,height);};
const viewScale=()=>renderingViewport()?paperView().scale*geometry.modelUnitMillimeters(state().settings)/renderingViewport().scaleDenominator:paperSpace()||renderContext?.space==='paper'?paperView().scale:state().viewport.scale;
function inkFor(entity,color){const ink=color||entity.color||layerFor(entity)?.color||'#dce5e9';if(!currentLayout()||color)return ink;const rgb=/^#[a-f\d]{6}$/i.test(ink)?[1,3,5].map(index=>parseInt(ink.slice(index,index+2),16)):null;return rgb&&rgb.every(value=>value>190)?'#263742':ink;}
const is3DEntity=entity=>['MESH','POLY3D'].includes(entity.type);
const spatialCurve=entity=>['CIRCLE3D','ARC3D'].includes(entity.type);
const modalIds=['annotation-dialog','settings-dialog','plot-dialog','page-setup-dialog','viewport-scale-dialog','layer-manager-dialog','architecture-dialog'];
const editorDialogOpen=()=>modalIds.some(id=>$(id).open);
const selectingObjects=()=>['selection','join-selection'].includes(state().commandPhase);
const displayInsertChildren=entity=>geometry.visibleInsertEntities?geometry.visibleInsertEntities(entity,drawingContext()):geometry.expandedInsertEntities(entity,drawingContext()).filter(child=>layerFor(child)?.visible!==false);
function curveDisplayPoints(entity){
  const center=entity.center||entity.controlPoints?.[0]||{x:0,y:0},screen=toScreen(center),scale=modelWorkspace()?(camera3D().projection==='perspective'?view3d.focalPixels(camera3D(),height)/screen.viewDistance:camera3D().scale):viewScale();
  const size=entity.type==='ELLIPSE'?Math.hypot(entity.major.x,entity.major.y):entity.type==='SPLINE'?Math.max(...entity.controlPoints.map(point=>Math.hypot(point.x-center.x,point.y-center.y))):entity.radius;
  const fullCount=Math.max(32,Math.min(4096,Math.ceil(Math.sqrt(Math.abs(size*scale)*20))||32));
  if(spatialCurve(entity))return geometry.sampleSpatialCurve(entity,Math.max(8,Math.ceil((entity.type==='ARC3D'?Math.abs(entity.sweepAngle)/360:1)*fullCount)));
  if(['ELLIPSE','SPLINE'].includes(entity.type))return geometry.sampleCurve(entity,Math.max(entity.type==='SPLINE'?128:32,fullCount));
  const sweep=entity.type==='CIRCLE'?360:entity.sweepAngle,start=entity.type==='CIRCLE'?0:entity.startAngle,count=Math.max(8,Math.ceil(Math.abs(sweep)/360*fullCount));return Array.from({length:count+1},(_,index)=>{const angle=(start+sweep*index/count)*Math.PI/180;return{x:entity.center.x+entity.radius*Math.cos(angle),y:entity.center.y+entity.radius*Math.sin(angle),z:0};});
}
function projectionEdges(entity){
  if(['CIRCLE','ARC','CIRCLE3D','ARC3D','ELLIPSE','SPLINE'].includes(entity.type)){
    const points=curveDisplayPoints(entity);return points.slice(1).map((p,index)=>[points[index],p]);
  }
  if(entity.type==='INSERT'&&geometry.expandedInsertEntities)return displayInsertChildren(entity).flatMap(projectionEdges);
  if(entity.type==='HATCH'&&geometry.entityDisplayPrimitives){const primitive=geometry.entityDisplayPrimitives(entity,drawingContext()),edges=[...(primitive.segments||[])];for(const path of primitive.paths||[]){const points=Array.isArray(path)?path:path.points;if(!points?.length)continue;for(let i=1;i<points.length;i++)edges.push([points[i-1],points[i]]);if(path.closed)edges.push([points.at(-1),points[0]]);}if(entity.pattern==='solid'&&['CIRCLE','ELLIPSE'].includes(entity.boundary.type))edges.push(...projectionEdges(entity.boundary));return edges;}
  return geometry.entityEdges?geometry.entityEdges(entity,state()):entity.type==='LINE'?[[entity.start,entity.end]]:[];
}
function projectionFills(entity){if(entity.type==='MESH'||!geometry.entityDisplayPrimitives)return[];if(entity.type==='INSERT')return displayInsertChildren(entity).flatMap(projectionFills);if(entity.type==='HATCH'&&entity.pattern==='solid'&&['CIRCLE','ELLIPSE'].includes(entity.boundary.type))return[curveDisplayPoints(entity.boundary)];const primitive=geometry.entityDisplayPrimitives(entity,drawingContext());return(primitive.fills||[]).map(fill=>Array.isArray(fill)?fill:fill.points).filter(points=>points?.length>=3);}
function modelPoints(entities=visibleEntities()){return entities.flatMap(entity=>{if(entity.type==='INSERT')return modelPoints(displayInsertChildren(entity));const points=[...geometry.entityPoints(entity,drawingContext())];if(entity.type==='HATCH')points.push(...modelPoints([entity.boundary]));else if(['CIRCLE','ELLIPSE'].includes(entity.type)){const major=entity.type==='CIRCLE'?{x:entity.radius,y:0}:entity.major,ratio=entity.type==='CIRCLE'?1:entity.ratio;points.push(...view3d.planarCurveExtrema(entity.center,major,ratio,camera3D()));if(camera3D().projection==='perspective')points.push(...curveDisplayPoints(entity));}else if(entity.type==='SPLINE'){points.push(...geometry.splineBezierSegments(entity).flat(),...geometry.sampleCurve(entity,Math.min(4096,Math.max(256,entity.controlPoints.length*8))));}else if(entity.type==='ARC'||spatialCurve(entity))points.push(...curveDisplayPoints(entity));return points;});}
function projectedPick(screen,entities=selectableEntities()){if(!insideActiveViewport(screen))return null;return view3d.pickProjected(entities,screen,camera3D(),width,height,8,currentViewport()?viewportWorldEdges:projectionEdges,projectionFills);}
function insideScreenPolygon(point,polygon){if(!finiteScreenPoint(point)||polygon.length<3)return false;let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[j],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y,cross=(point.x-a.x)*dy-(point.y-a.y)*dx;if(Math.abs(cross)<=1e-7*Math.max(1,Math.abs(dx),Math.abs(dy))&&point.x>=Math.min(a.x,b.x)-1e-7&&point.x<=Math.max(a.x,b.x)+1e-7&&point.y>=Math.min(a.y,b.y)-1e-7&&point.y<=Math.max(a.y,b.y)+1e-7)return true;if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function activeViewportMask(){const viewport=currentViewport();return viewport?viewportBoundary(viewport).map(paperToScreen):null;}
function insideActiveViewport(screen){const mask=activeViewportMask();return!mask||insideScreenPolygon(screen,mask);}
function clippedSegment(a,b,polygon){
  if(!finiteScreenPoint(a)||!finiteScreenPoint(b))return[];const dx=b.x-a.x,dy=b.y-a.y;
  if(dx===0&&dy===0)return insideScreenPolygon(a,polygon)?[{a,b,t0:0,t1:1}]:[];
  const cuts=[0,1];
  for(let i=0;i<polygon.length;i++){const c=polygon[i],d=polygon[(i+1)%polygon.length],sx=d.x-c.x,sy=d.y-c.y,den=dx*sy-dy*sx,cx=c.x-a.x,cy=c.y-a.y;if(!Number.isFinite(den))continue;if(Math.abs(den)>Number.EPSILON*32*Math.max(Number.MIN_VALUE,Math.abs(dx*sy),Math.abs(dy*sx))){const t=(cx*sy-cy*sx)/den,u=(cx*dy-cy*dx)/den;if(t>=-1e-10&&t<=1+1e-10&&u>=-1e-10&&u<=1+1e-10)cuts.push(Math.max(0,Math.min(1,t)));}else if(Math.abs(cx*dy-cy*dx)<=1e-7*Math.max(1,Math.abs(dx),Math.abs(dy))){const axis=Math.abs(dx)>=Math.abs(dy)?'x':'y',delta=axis==='x'?dx:dy;for(const point of[c,d]){const t=(point[axis]-a[axis])/delta;if(t>=0&&t<=1)cuts.push(t);}}}
  cuts.sort((x,y)=>x-y);const unique=cuts.filter((t,i)=>!i||Math.abs(t-cuts[i-1])>1e-12),pointAt=t=>({x:a.x+dx*t,y:a.y+dy*t}),fragments=[];
  for(let i=1;i<unique.length;i++){const t0=unique[i-1],t1=unique[i];if(insideScreenPolygon(pointAt(t0/2+t1/2),polygon))fragments.push({a:pointAt(t0),b:pointAt(t1),t0,t1});}
  for(const t of unique)if(insideScreenPolygon(pointAt(t),polygon)&&!fragments.some(fragment=>t>=fragment.t0&&t<=fragment.t1))fragments.push({a:pointAt(t),b:pointAt(t),t0:t,t1:t});
  return fragments;
}
function segmentInScreenBox(a,b,box){let low=0,high=1;for(const axis of['x','y']){const delta=b[axis]-a[axis],min=box[axis+'0'],max=box[axis+'1'];if(delta===0){if(a[axis]<min||a[axis]>max)return false;continue;}const p=(min-a[axis])/delta,q=(max-a[axis])/delta;low=Math.max(low,Math.min(p,q));high=Math.min(high,Math.max(p,q));if(low>high)return false;}return true;}
function screenBox(start,end){return{x0:Math.min(start.x,end.x),x1:Math.max(start.x,end.x),y0:Math.min(start.y,end.y),y1:Math.max(start.y,end.y)};}
function screenBoxPoints(box){return[{x:box.x0,y:box.y0},{x:box.x1,y:box.y0},{x:box.x1,y:box.y1},{x:box.x0,y:box.y1}];}
function viewportSegmentFragments(entity,mask=activeViewportMask()){return projectionEdges(entity).flatMap(([rawA,rawB])=>{const a=toScreen(rawA),b=toScreen(rawB);return mask?clippedSegment(a,b,mask).map(fragment=>({...fragment,rawA,rawB})):finiteScreenPoint(a)&&finiteScreenPoint(b)?[{a,b,rawA,rawB,t0:0,t1:1}]:[];});}
function viewportWorldEdges(entity){return viewportSegmentFragments(entity).map(({rawA:a,rawB:b,t0,t1})=>[t0,t1].map(t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:(a.z||0)+((b.z||0)-(a.z||0))*t})));}
function viewportFillPolygons(entity){
  if(entity.type==='INSERT')return displayInsertChildren(entity).flatMap(viewportFillPolygons);
  const fills=entity.type==='MESH'?modelWorkspace()&&camera3D().renderMode==='shaded'?view3d.meshTriangles(entity).map(triangle=>triangle.points):[]:projectionFills(entity);
  if(geometry.entityDisplayPrimitives)for(const line of geometry.entityDisplayPrimitives(entity,drawingContext()).texts||[]){const left=line.align==='center'?-line.width/2:0,angle=line.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);fills.push([[left,-line.height*.35],[left+line.width,-line.height*.35],[left+line.width,line.height],[left,line.height]].map(([x,y])=>({x:line.position.x+c*x-s*y,y:line.position.y+s*x+c*y,z:line.position.z||0})));}
  return fills.map(points=>points.map(toScreen)).filter(points=>points.length>=3&&points.every(finiteScreenPoint));
}
function fillIntersectsMaskedBox(fill,mask,box){const inBox=point=>point.x>=box.x0&&point.x<=box.x1&&point.y>=box.y0&&point.y<=box.y1;if(fill.some(point=>inBox(point)&&insideScreenPolygon(point,mask))||mask.some(point=>inBox(point)&&insideScreenPolygon(point,fill))||screenBoxPoints(box).some(point=>insideScreenPolygon(point,fill)&&insideScreenPolygon(point,mask)))return true;for(const[polygon,other]of[[fill,mask],[mask,fill]])for(let i=0;i<polygon.length;i++)if(clippedSegment(polygon[i],polygon[(i+1)%polygon.length],other).some(fragment=>segmentInScreenBox(fragment.a,fragment.b,box)))return true;return false;}
function visibleViewportGeometry(entity,box){const mask=activeViewportMask(),query=box||screenBoxPointsToBounds(mask);return viewportSegmentFragments(entity,mask).some(fragment=>segmentInScreenBox(fragment.a,fragment.b,query))||viewportFillPolygons(entity).some(fill=>fillIntersectsMaskedBox(fill,mask,query));}
function screenBoxPointsToBounds(points){return{x0:Math.min(...points.map(p=>p.x)),x1:Math.max(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),y1:Math.max(...points.map(p=>p.y))};}
function objectsInViewportBox(start,end,crossing){const box=screenBox(start,end),objects=selectableObjects();if(crossing)return objects.filter(entity=>visibleViewportGeometry(entity,box)).map(entity=>entity.id);const contained=modelWorkspace()?view3d.entitiesInProjectedBox(objects,start,end,false,camera3D(),width,height,e=>geometry.entityPoints(e,state()),projectionEdges,projectionFills):entitiesInBox(objects,toWorld(start),toWorld(end),false,state());return objects.filter(entity=>contained.includes(entity.id)&&visibleViewportGeometry(entity,box)).map(entity=>entity.id);}
function viewportHitCandidates(screen,entities=selectableObjects()){if(!insideActiveViewport(screen))return[];const p=toWorld(screen);return entities.filter(entity=>p&&hitTest([entity],p,8/viewScale(),drawingContext())!==null&&(viewportSegmentFragments(entity).some(fragment=>view3d.projectedSegmentDistance(screen,fragment.a,fragment.b).distance<=8)||viewportFillPolygons(entity).some(fill=>insideScreenPolygon(screen,fill))));}
function objectAtScreen(screen,entities=selectableObjects()){if(modelWorkspace())return projectedPick(screen,entities)?.entityId||null;const p=toWorld(screen);return p?hitTest(currentViewport()?viewportHitCandidates(screen,entities):entities,p,8/viewScale(),drawingContext()):null;}
function setCamera(camera,{rawViewport=false}={}){flushViewportNavigation();const viewport=currentViewport();if(viewport&&!rawViewport){const center=paperToScreen({x:viewport.frame.x+viewport.frame.width/2,y:viewport.frame.y+viewport.frame.height/2}),axes=view3d.cameraBasis(camera),scale=viewScale(),dx=(width/2-center.x)/scale,dy=(center.y-height/2)/scale;camera={...camera,target:{x:camera.target.x-axes.right.x*dx-axes.up.x*dy,y:camera.target.y-axes.right.y*dx-axes.up.y*dy,z:(camera.target.z||0)-axes.right.z*dx-axes.up.z*dy}};}const result=editor.set3DView(camera);if(result.ok===false)addLog(result.message,'error');return result;}
function setWorkspace(mode){flushViewportNavigation();editor.setWorkspace(mode);orbitMode=null;orbitPivot=null;panTool=false;drag=null;pointer=null;snap=null;pointerScalar=null;pointerUnavailable=null;update();resized();}
function sceneForOrbit(){const entities=visibleEntities();return (orbitMode||drag?.mode==='orbit')&&camera3D().autoTarget&&state().selectionIds.length?entities.filter(entity=>state().selectionIds.includes(entity.id)):entities;}
function visibleInView(entity){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const point of geometry.entityPoints(entity,drawingContext())){const p=view3d.projectPoint(point,camera3D(),width,height);if(p.clipped||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}return maxX>=0&&minX<=width&&maxY>=0&&minY<=height;}
function startOrbit(mode,screen=null,{explicit=false}={}){
  if(!modelWorkspace())editor.setWorkspace('3d');orbitMode=mode;panTool=false;closePalettes();hideCompletion();
  if(explicit&&camera3D().orbitCenter)orbitPivot={...camera3D().orbitCenter};
  else if(camera3D().autoTarget){const selected=visibleEntities().filter(e=>state().selectionIds.includes(e.id)),shown=selected.length?selected:visibleEntities().filter(visibleInView);orbitPivot=view3d.bounds3D(modelPoints(shown))?.center||{...camera3D().target};}
  else orbitPivot=screen?(projectedPick(screen,visibleEntities())?.point||toWorld(screen)||{...camera3D().target}):(camera3D().orbitCenter||{...camera3D().target});
  update();
}
function projectedSnap(screen){
  if(!insideActiveViewport(screen))return null;
  const modes=state().settings?.snapModes||[],meshes=visibleEntities().filter(e=>e.type==='MESH');let winner=null;
  for(const entity of visibleEntities().filter(e=>e.id!==drag?.entityId)){
    const candidates=geometry.snapCandidates?geometry.snapCandidates(entity,state()):entity.type==='CIRCLE'||entity.type==='ARC'?[{point:entity.center,type:'center'},...(entity.type==='CIRCLE'?geometry.entityPoints(entity,drawingContext()).map(point=>({point,type:'quadrant'})):[{point:geometry.arcPoint(entity,0),type:'endpoint'},{point:geometry.arcPoint(entity,1),type:'endpoint'},{point:geometry.arcPoint(entity,.5),type:'midpoint'}])]:pointsOf(entity).map(point=>({point,type:'endpoint'}));
    if(!geometry.snapCandidates&&!['TEXT','MTEXT','DIMENSION','CIRCLE','ARC'].includes(entity.type))for(const[a,b]of projectionEdges(entity))candidates.push({point:{x:a.x+(b.x-a.x)/2,y:a.y+(b.y-a.y)/2,z:(a.z??0)+((b.z??0)-(a.z??0))/2},type:'midpoint'});
    for(const candidate of candidates){if(!modes.includes(candidate.type))continue;const p=toScreen(candidate.point),distance=Math.hypot(p.x-screen.x,p.y-screen.y);if(p.clipped||!insideActiveViewport(p)||distance>10||modelWorkspace()&&camera3D().renderMode==='shaded'&&view3d.pointOccluded(candidate.point,meshes,camera3D(),width,height))continue;if(!winner||distance<winner.distance-1e-6||Math.abs(distance-winner.distance)<1e-6&&candidate.type==='endpoint')winner={...candidate,point:{...candidate.point,z:candidate.point.z??0},distance,entityId:entity.id};}
  }return winner;
}

// Document content, rather than an edit counter or camera state, determines unsaved work.
function canonicalContent(value) {
  if(Array.isArray(value))return value.map(canonicalContent);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalContent(value[key])]));
  return value;
}
function documentFingerprint() {
  return contentFingerprint(editorDocument());
}
function editorDocument(source=editor){const value=source.serialize();return typeof value==='string'?JSON.parse(value):value;}
function contentFingerprint(value){return JSON.stringify(canonicalContent({entities:value.entities,layers:value.layers,currentLayer:value.currentLayer,settings:value.settings,textStyles:value.textStyles,dimStyles:value.dimStyles,currentTextStyle:value.currentTextStyle,currentDimStyle:value.currentDimStyle,blocks:value.blocks||[],layouts:value.layouts||[],ucs:value.ucs}));}
function isDirty() {return importedAwaitingSave||documentFingerprint() !== savedFingerprint;}
function serializedDrawing() {
  const value=editor.serialize();return typeof value==='string'?value:JSON.stringify(value,null,2);
}
function documentInfo() {return {dirty:isDirty(),name:documentName,text:serializedDrawing()};}
function syncDesktop() {if(desktop)desktop.setDocumentState(documentInfo());}
function displayName(name) {return String(name||'Untitled drawing').replace(/\.linecraft\.json$/i,'').replace(/\.json$/i,'');}
savedFingerprint=documentFingerprint();
const developmentState={restored:false,restoreError:null,historyReset:false,activeCommandCanceled:false};
const developmentCheckpointKey='linecraft-development-reload';
let developmentCheckpointTimer;
if(developmentMode){
  try {
    const raw=sessionStorage.getItem(developmentCheckpointKey)||localStorage.getItem(developmentCheckpointKey);
    if(raw){
      const checkpoint=JSON.parse(raw);
      if(checkpoint.version!==1||typeof checkpoint.text!=='string'||typeof checkpoint.savedFingerprint!=='string')throw new Error('Invalid drawing checkpoint.');
      const recovered=JSON.parse(checkpoint.text),baseline=JSON.parse(checkpoint.savedFingerprint);
      const legacyDrafting={gridEnabled:checkpoint.gridEnabled!==false,snapEnabled:checkpoint.snapEnabled!==false,orthoEnabled:checkpoint.orthoEnabled===true};
      if(!recovered.settings)recovered.settings=legacyDrafting;if(!baseline.settings)baseline.settings=legacyDrafting;
      editor=createEditor(recovered);documentName=checkpoint.name||'Untitled drawing';savedFingerprint=contentFingerprint(editorDocument(createEditor(baseline)));
      importedAwaitingSave=checkpoint.importedAwaitingSave===true;
      gridEnabled=editor.state.settings?.gridEnabled??checkpoint.gridEnabled!==false;snapEnabled=editor.state.settings?.snapEnabled??checkpoint.snapEnabled!==false;orthoEnabled=editor.state.settings?.orthoEnabled??checkpoint.orthoEnabled===true;
      developmentState.restored=true;developmentState.checkpointTime=checkpoint.time;
      developmentState.historyReset=true;developmentState.activeCommandCanceled=checkpoint.activeCommandCanceled===true;
      sessionStorage.removeItem(developmentCheckpointKey);
    }
  }catch(error){developmentState.restoreError=error.message;console.warn('Linecraft development checkpoint could not be restored:',error.message);}
}

function persistDevelopmentCheckpoint(activeCommandCanceled=Boolean(state().command)) {
  if(!developmentMode||closingApplication||developmentState.restoreError)return false;
  try{
    const time=Date.now();
    const checkpoint=JSON.stringify({version:1,text:serializedDrawing(),name:documentName,savedFingerprint,importedAwaitingSave,gridEnabled,snapEnabled,orthoEnabled,time,activeCommandCanceled});
    localStorage.setItem(developmentCheckpointKey,checkpoint);
    if(localStorage.getItem(developmentCheckpointKey)!==checkpoint)throw new Error('Drawing checkpoint verification failed.');
    developmentState.lastCheckpointTime=time;developmentState.checkpointError=null;return checkpoint;
  }catch(error){developmentState.checkpointError=error.message;console.warn('Linecraft drawing checkpoint remains pending:',error.message);return false;}
}
function scheduleDevelopmentCheckpoint() {
  if(!developmentMode||closingApplication||developmentState.restoreError)return;
  clearTimeout(developmentCheckpointTimer);
  developmentCheckpointTimer=setTimeout(()=>persistDevelopmentCheckpoint(),150);
}
function clearDevelopmentCheckpoint() {
  if(!developmentMode)return;
  clearTimeout(developmentCheckpointTimer);
  sessionStorage.removeItem(developmentCheckpointKey);localStorage.removeItem(developmentCheckpointKey);
}

function reloadDevelopmentDrawing() {
  if(!developmentMode)return false;
  if(developmentState.restoreError){console.warn('Linecraft reload canceled to preserve the earlier checkpoint.');return false;}
  try {
    const activeCommandCanceled=Boolean(state().command);
    if(activeCommandCanceled){editor.cancel();update();}
    const checkpoint=persistDevelopmentCheckpoint(activeCommandCanceled);
    if(!checkpoint)return false;
    sessionStorage.setItem(developmentCheckpointKey,checkpoint);
    if(sessionStorage.getItem(developmentCheckpointKey)!==checkpoint)throw new Error('Drawing checkpoint verification failed.');
    location.reload();return true;
  }catch(error){console.warn('Linecraft reload canceled; drawing remains open:',error.message);return false;}
}

function addLog(message, kind='notice') {
  if (!message) return;
  const line = document.createElement('div');
  line.className = `log-line ${kind}`;
  line.textContent = message;
  $('command-log').append(line);
  while ($('command-log').childElementCount > 300) $('command-log').firstElementChild.remove();
  $('command-log').scrollTop = $('command-log').scrollHeight;
}
function toast(message) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message;
  document.body.append(item);
  toastTimer = setTimeout(() => item.remove(), 3000);
}
function commandName(raw) {
  const token=String(raw||'').trim().toUpperCase().replace(/^[_\.]+/,'');
  return commandCatalog.find(item=>item.name===token||item.aliases.includes(token))?.name||token;
}
function textEditing(element=document.activeElement) {
  return element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement||element?.isContentEditable;
}
function hideCompletion() {
  $('command-suggestions').hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');completionItems=[];completionIndex=-1;
}
function renderCompletion() {
  const term=input.value.trim().toUpperCase().replace(/^[_\.]+/,'');
  if(state().command||!term||/\s|,|@|</.test(term)){hideCompletion();return;}
  completionItems=commandCatalog.filter(item=>item.name.startsWith(term)||item.aliases.some(alias=>alias.startsWith(term))).slice(0,7);
  if(!completionItems.length){hideCompletion();return;}
  completionIndex=-1;const list=$('command-suggestions');list.replaceChildren();
  completionItems.forEach((item,index)=>{
    const button=document.createElement('button');button.type='button';button.id=`command-option-${index}`;button.className='command-option';button.setAttribute('role','option');button.setAttribute('aria-selected','false');
    const name=document.createElement('strong');name.textContent=item.name;
    const alias=document.createElement('span');alias.className='completion-alias';alias.textContent=item.aliases.join(' / ')||item.group;
    const summary=document.createElement('small');summary.textContent=item.summary;button.append(name,alias,summary);
    button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>acceptCompletion(index));list.append(button);
  });
  list.hidden=false;input.setAttribute('aria-expanded','true');
}
function selectCompletion(index) {
  completionIndex=(index+completionItems.length)%completionItems.length;
  [...$('command-suggestions').children].forEach((item,i)=>{item.classList.toggle('selected',i===completionIndex);item.setAttribute('aria-selected',String(i===completionIndex));});
  input.setAttribute('aria-activedescendant',`command-option-${completionIndex}`);
}
function acceptCompletion(index=completionIndex<0?0:completionIndex) {
  const item=completionItems[index];if(!item)return false;input.value=item.name;hideCompletion();input.focus();return true;
}
function closePalettes() {
  for(const id of ['draw','modify','clipboard','annotation','model','blocks','output']){$(`${id}-palette`).hidden=true;$(`${id}-tools`).setAttribute('aria-expanded','false');$(`${id}-tools`).classList.remove('active');}
}
function chooseTool(command) {
  closePalettes();hideCompletion();if(state().command)editor.cancel();runCommand(command);input.focus();
}
function buildPalette(group,container) {
  container.replaceChildren();
  for(const item of commandCatalog.filter(item=>item.group===group)){
    const button=document.createElement('button');button.className='palette-command';button.dataset.command=item.name;button.title=item.summary;
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',`#i-${item.icon}`);icon.append(use);
    const name=document.createElement('span');name.textContent=item.name==='COPYCLIP'?'Copy':item.name==='CUTCLIP'?'Cut':item.name==='COPYBASE'?'Copy with base':item.name==='PASTECLIP'?'Paste':item.name[0]+item.name.slice(1).toLowerCase();
    const shortcut=document.createElement('small');shortcut.textContent=item.shortcut||item.aliases[0]||item.name;button.append(icon,name,shortcut);button.addEventListener('click',()=>chooseTool(item.name));container.append(button);
  }
}
function renderBlockLibrary(){const box=$('block-library');box.replaceChildren();if(!state().blocks?.length){const empty=document.createElement('p');empty.textContent='Use BLOCK to define reusable geometry in this drawing.';box.append(empty);return;}for(const block of state().blocks){const button=document.createElement('button');button.dataset.block=block.name;const label=document.createElement('strong');label.textContent=block.name;const count=document.createElement('small');count.textContent=`${block.entities.length} objects`;button.append(label,count);button.title=`Insert ${block.name}`;button.addEventListener('click',()=>{chooseTool('INSERT');input.value=block.name;input.focus();});box.append(button);}}
function renderReference() {
  const term=$('reference-search-input').value.trim().toLowerCase();
  const items=[...commandCatalog,...unavailableCatalog].filter(item=>(referenceCategory==='All'||item.group===referenceCategory)&&[item.name,...item.aliases,item.summary,item.options||''].join(' ').toLowerCase().includes(term));
  $('reference-count').textContent=`${items.length} command${items.length===1?'':'s'}`;
  const box=$('reference-results');box.replaceChildren();
  for(const item of items){
    const card=document.createElement('article');card.className='reference-card';card.dataset.command=item.name;card.dataset.available=String(item.available!==false);
    const heading=document.createElement('div');heading.className='reference-card-heading';
    const name=document.createElement('h3');name.textContent=item.name;const tag=document.createElement('span');tag.className='reference-tag';tag.textContent=item.group;
    const run=document.createElement(item.available===false?'span':'button');run.className=item.available===false?'reference-unavailable':'reference-run';run.textContent=item.available===false?'Unavailable':'Run';if(item.available!==false){run.setAttribute('aria-label',`Run ${item.name}`);run.addEventListener('click',()=>{$('reference-dialog').close();chooseTool(item.name);});}heading.append(name,tag,run);
    const alias=document.createElement('p');alias.className='reference-alias';alias.textContent=item.available===false?'Not implemented in this release':[item.aliases.length?`Aliases: ${item.aliases.join(', ')}`:'Full command name',item.shortcut].filter(Boolean).join(' · ');
    const summary=document.createElement('p');summary.className='reference-summary';summary.textContent=item.summary;
    const details=document.createElement('dl');for(const [label,value] of (item.available===false?[['Scope',item.limits]]:[['Supported',item.options],['Scope',item.limits]])){const title=document.createElement('dt');title.textContent=label;const text=document.createElement('dd');text.textContent=value;details.append(title,text);}
    card.append(heading,alias,summary,details);if(item.example){const example=document.createElement('div');example.className='reference-example';example.textContent=item.example;card.append(example);}box.append(card);
  }
  if(!items.length){const empty=document.createElement('p');empty.className='reference-empty';empty.textContent='No commands in this reference match the search.';box.append(empty);}
  [...$('reference-filters').children].forEach(button=>{const active=button.textContent===referenceCategory;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function showReference(category='All') {
  closePalettes();hideCompletion();referenceCategory=category;$('reference-search-input').value='';renderReference();
  if(!$('reference-dialog').open)$('reference-dialog').showModal();$('reference-dialog').scrollTop=0;$('reference-search-input').focus();
}
function plotOptionsFromFields(){return{space:$('plot-space').value,layoutId:$('plot-space').value==='layout'?$('plot-layout-id').value||null:null,paper:$('plot-paper').value,orientation:$('plot-orientation').value,scaleMode:$('plot-mode').value,ratio:$('plot-scale').valueAsNumber,margin:$('plot-margin').valueAsNumber,colorMode:$('plot-color').value,lineweights:$('plot-lineweights').checked};}
function refreshPlotSpace(){const space=$('plot-space').value,layout=space==='layout'?state().layouts?.find(item=>item.id===$('plot-layout-id').value):space==='current'?currentLayout():null;$('plot-layout-choice').hidden=space!=='layout';for(const id of ['plot-paper','plot-orientation','plot-mode','plot-scale','plot-margin'])$(id).disabled=Boolean(layout);$('plot-space-hint').textContent=layout?`${layout.name}: ${layout.paper.size}, ${layout.paper.widthMm} × ${layout.paper.heightMm} mm. Page setup and each saved viewport scale define this sheet.`:space==='layout'?'Choose a paper layout to plot.':'Model extents use the paper, fit or exact scale, and margin settings below.';}
async function refreshPlotPreview(){
  const revision=++plotPreviewRevision;$('plot-scale').disabled=$('plot-mode').value!=='scale';$('plot-error').textContent='';$('plot-submit').disabled=true;
  try{
    plotModule??=await import('./plot-document.mjs');
    const options=plotModule.normalizePlotOptions(plotOptionsFromFields()),result=plotModule.buildPlotHTML([{title:documentName,text:serializedDrawing()}],{options});
    if(revision!==plotPreviewRevision||!$('plot-dialog').open)return;
    const svg=new DOMParser().parseFromString(result.previewSVG,'image/svg+xml').documentElement;
    if(svg.localName!=='svg'||svg.querySelector('parsererror,script,foreignObject'))throw Error('The sheet preview could not be generated.');
    for(const text of svg.querySelectorAll('text[data-cap-height]'))text.setAttribute('font-size',String(fontSizeForHeight(1,text.getAttribute('font-family'))));
    $('plot-preview').replaceChildren(document.importNode(svg,true));
    const report=result.report,scale=report.space==='layout'?`Paper layout at 1:1 · ${report.sheets?.[0]?.viewports?.map(viewport=>`1:${viewport.scaleDenominator}`).join(' / ')||'no viewports'}`:report.scaleMode==='scale'?`Exact scale 1:${report.ratio}`:'Drawing extents fitted to sheet';
    $('plot-summary').textContent=`${report.paper} · ${report.orientation}\n${scale}${plotMode==='publish'?'\nPreview shows the current drawing; chosen files become separate sheets.':''}${report.clipped?'\nGeometry extends beyond the printable sheet.':''}${report.warnings?.length?'\n'+report.warnings.join('\n'):''}`;
    $('plot-submit').disabled=plotSubmitting||!(plotMode==='publish'?desktop?.publishPDF:desktop?.plotPDF);
    if(!desktop)$('plot-error').textContent='PDF output requires the Linecraft desktop application. The sheet preview is available here.';
  }catch(error){if(revision===plotPreviewRevision){$('plot-preview').replaceChildren();$('plot-summary').textContent='';$('plot-error').textContent=error.message||'Check the sheet settings.';if(plotMode==='publish'&&desktop?.publishPDF)$('plot-submit').disabled=plotSubmitting;}}
}
async function showPlot(mode='plot'){
  if(documentActionBusy||$('annotation-dialog').open||$('settings-dialog').open)return false;
  closePalettes();hideCompletion();if(state().command)editor.cancel();orbitMode=null;orbitPivot=null;plotMode=mode;
  try{plotModule??=await import('./plot-document.mjs');}catch(error){addLog(error.message||'The PDF output module could not be loaded.','error');return false;}
  const options=lastPlotOptions||plotModule.DEFAULT_PLOT_OPTIONS;
  $('plot-space').value=options.space||'current';fillOptions('plot-layout-id',(state().layouts||[]).map(layout=>layout.id),options.layoutId||currentLayout()?.id||state().layouts?.[0]?.id||'');for(const option of $('plot-layout-id').options)option.textContent=state().layouts.find(layout=>layout.id===option.value).name;refreshPlotSpace();
  $('plot-paper').value=options.paper;$('plot-orientation').value=options.orientation;$('plot-mode').value=options.scaleMode;$('plot-scale').value=options.ratio;$('plot-margin').value=options.margin;$('plot-color').value=options.colorMode;$('plot-lineweights').checked=options.lineweights;
  $('plot-title').textContent=mode==='publish'?'Publish drawings':'Plot drawing';$('plot-submit').textContent=mode==='publish'?'Choose drawings & save PDF':'Save PDF';$('plot-intro').textContent=mode==='publish'?'Choose up to 20 saved Linecraft drawings and publish one PDF with a sheet for each. The preview illustrates the current drawing; chosen files provide the published sheets. Source drawings remain unchanged.':'Set up a sheet and preview the current drawing. The source drawing remains unchanged.';
  $('plot-dialog').showModal();update();await refreshPlotPreview();return true;
}
function closePlot(){if(plotSubmitting)return;plotPreviewRevision++;$('plot-dialog').close();finishDialogReload();input.focus();}
async function submitPlot(event){
  event.preventDefault();if(plotSubmitting||documentActionBusy)return;
  let options;try{options=plotModule.normalizePlotOptions(plotOptionsFromFields());}catch(error){$('plot-error').textContent=error.message;return;}
  const action=plotMode==='publish'?desktop?.publishPDF:desktop?.plotPDF;if(!action){$('plot-error').textContent='PDF output requires the Linecraft desktop application.';return;}
  lastPlotOptions=options;plotSubmitting=true;setDocumentBusy(true);$('plot-submit').disabled=true;$('plot-error').textContent='';
  try{
    const result=plotMode==='publish'?await desktop.publishPDF({options}):await desktop.plotPDF({text:serializedDrawing(),options});
    if(result?.canceled)return;if(!result?.ok)throw Error(result?.error||'PDF output failed.');
    const pages=result.pages??result.report?.pages??1;addLog(`${plotMode==='publish'?'Published':'Plotted'} ${pages} sheet${pages===1?'':'s'}${result.name?` to ${result.name}`:''}.`,'notice');if(result.warnings?.length)addLog(result.warnings.join('\n'),'notice');toast('PDF saved.');
  }catch(error){$('plot-error').textContent=error.message||'PDF output failed.';}
  finally{plotSubmitting=false;setDocumentBusy(false);$('plot-submit').disabled=false;finishDialogReload();}
}
function fillOptions(id,names,value){const select=$(id);select.replaceChildren();for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}select.value=value;}
function draftingSettings(){return state().settings||{units:'unitless',precision:4,gridEnabled,snapEnabled,orthoEnabled,snapModes:['endpoint','midpoint','center','quadrant'],gridAdaptive:true,gridSpacing:10};}
function unitFields(){return{units:$('setting-units').value,precision:$('setting-precision').valueAsNumber,linearFormat:$('setting-linear-format').value,fractionPrecision:Number($('setting-fraction-precision').value),angularInputUnit:$('setting-angular-input').value,angularFormat:$('setting-angular-format').value,angularPrecision:$('setting-angular-precision').valueAsNumber};}
function displayUnitFields(prefs){
  $('setting-units').value=prefs.units;$('setting-precision').value=prefs.precision;
  $('setting-linear-format').value=prefs.linearFormat||'decimal';$('setting-fraction-precision').value=prefs.fractionPrecision??4;
  $('setting-angular-input').value=prefs.angularInputUnit||'degrees';$('setting-angular-format').value=prefs.angularFormat||'decimal-degrees';$('setting-angular-precision').value=prefs.angularPrecision??4;
  const preset=Object.entries(geometry.UNIT_PRESETS||{}).find(([,patch])=>Object.entries(patch).every(([key,value])=>prefs[key]===value));$('setting-unit-preset').value=preset?.[0]||'custom';refreshUnitPreview();
}
function refreshUnitPreview(){
  const prefs=unitFields(),labels={unitless:'Unitless',mm:'Millimeters',cm:'Centimeters',m:'Meters',in:'Inches',ft:'Feet'};
  $('setting-precision').disabled=prefs.linearFormat==='architectural';$('setting-fraction-precision').disabled=prefs.linearFormat!=='architectural';
  $('units-model-summary').textContent=`Model unit: ${labels[prefs.units]}. Coordinates retain their exact numeric values when formatting changes.`;
  try{
    const normalized={...prefs,...(geometry.normalizeUnitSettings?geometry.normalizeUnitSettings(prefs):{})};
    $('units-linear-preview').textContent=`12 model units → ${lengthFormat(12,normalized)}\n100.5 model units → ${lengthFormat(100.5,normalized)}`;
    $('units-angular-preview').textContent=`90 degrees → ${angleFormat(90,normalized)}\n30.5 degrees → ${angleFormat(30.5,normalized)}`;
  }catch(error){$('units-linear-preview').textContent='Enter valid unit precision.';$('units-angular-preview').textContent=error.message||'Check angular precision.';}
}
function changeUnitPreset(){const preset=geometry.UNIT_PRESETS?.[$('setting-unit-preset').value];if(preset)displayUnitFields({...unitFields(),...preset});else refreshUnitPreview();}
function displayQuantityField(id,value,kind,prefs=state().settings){const field=$(id);field.type='text';field.value=kind==='angle'&&geometry.parseAngle?angleFormat(value,prefs):kind==='length'&&geometry.parseLength?lengthFormat(value,prefs):String(value);field.dataset.exactValue=String(value);field.dataset.originalDisplay=field.value;field.title=`Exact stored value: ${value}${kind==='angle'?' degrees':' model units'}`;}
function readQuantityField(id,kind,prefs=state().settings){const field=$(id);if(field.value===field.dataset.originalDisplay)return Number(field.dataset.exactValue);if(!field.value.trim())throw Error('Enter a length or angle before applying settings.');const value=kind==='angle'&&geometry.parseAngle?geometry.parseAngle(field.value,prefs):kind==='length'&&geometry.parseLength?geometry.parseLength(field.value,prefs):Number(field.value);if(!Number.isFinite(value))throw Error('Enter a finite length or angle.');return value;}
function setDrafting(patch){return resultLog(editor.updateDraftingSettings(patch));}
function applyTextStyleFields(){
  const style=settingsDraft?.textStyles.find(item=>item.name===settingsDraft.textName);if(!style)return;
  Object.assign(style,{fontFamily:$('setting-text-font').value,defaultHeight:readQuantityField('setting-text-height','length',unitFields()),defaultRotation:readQuantityField('setting-text-rotation','angle',unitFields()),widthFactor:$('setting-text-width-factor').valueAsNumber});
}
function applyDimStyleFields(){
  const style=settingsDraft?.dimStyles.find(item=>item.name===settingsDraft.dimName);if(!style)return;
  Object.assign(style,{textStyle:$('setting-dim-text-style').value,textHeight:readQuantityField('setting-dim-text-height','length',unitFields()),arrowSize:readQuantityField('setting-dim-arrow-size','length',unitFields()),gap:readQuantityField('setting-dim-gap','length',unitFields()),precision:$('setting-dim-precision').valueAsNumber,scale:$('setting-dim-scale').valueAsNumber,extensionOffset:readQuantityField('setting-dim-extension-offset','length',unitFields()),extensionOvershoot:readQuantityField('setting-dim-extension-overshoot','length',unitFields()),prefix:$('setting-dim-prefix').value,suffix:$('setting-dim-suffix').value});
}
function captureStyleFields(){try{applyTextStyleFields();applyDimStyleFields();return true;}catch(error){$('settings-error').textContent=error.message||'Check the style values.';return false;}}
function displayTextStyleFields(){const style=settingsDraft.textStyles.find(item=>item.name===settingsDraft.textName);$('setting-text-font').value=style.fontFamily;displayQuantityField('setting-text-height',style.defaultHeight,'length',unitFields());displayQuantityField('setting-text-rotation',style.defaultRotation,'angle',unitFields());$('setting-text-width-factor').value=style.widthFactor;}
function displayDimStyleFields(){const style=settingsDraft.dimStyles.find(item=>item.name===settingsDraft.dimName);fillOptions('setting-dim-text-style',settingsDraft.textStyles.map(item=>item.name),style.textStyle);for(const [id,key]of [['text-height','textHeight'],['arrow-size','arrowSize'],['gap','gap'],['extension-offset','extensionOffset'],['extension-overshoot','extensionOvershoot']])displayQuantityField(`setting-dim-${id}`,style[key],'length',unitFields());$('setting-dim-precision').value=style.precision;for(const [id,key]of [['scale','scale'],['prefix','prefix'],['suffix','suffix']])$(`setting-dim-${id}`).value=style[key];}
function showSettings(){flushViewportNavigation();
  closePalettes();hideCompletion();if(state().command){editor.cancel();update();}
  settingsDraft={textStyles:JSON.parse(JSON.stringify(state().textStyles||[{name:'Standard',fontFamily:'Arial',defaultHeight:2.5,defaultRotation:0,widthFactor:1}])),dimStyles:JSON.parse(JSON.stringify(state().dimStyles||[{name:'Standard',textStyle:'Standard',textHeight:2.5,arrowSize:2.5,gap:1,precision:2,scale:1,extensionOffset:1,extensionOvershoot:1.25,prefix:'',suffix:''}])),textName:state().currentTextStyle||'Standard',dimName:state().currentDimStyle||'Standard'};
  const prefs=draftingSettings();displayUnitFields(prefs);
  $('setting-grid').checked=prefs.gridEnabled;$('setting-snap').checked=prefs.snapEnabled;$('setting-ortho').checked=prefs.orthoEnabled;
  $('setting-grid-adaptive').checked=prefs.gridAdaptive;$('setting-grid-spacing').value=prefs.gridSpacing;$('setting-grid-spacing').disabled=prefs.gridAdaptive;
  document.querySelectorAll('[data-setting-snap]').forEach(box=>box.checked=prefs.snapModes.includes(box.dataset.settingSnap));
  fillOptions('setting-text-style',settingsDraft.textStyles.map(item=>item.name),settingsDraft.textName);fillOptions('setting-dim-style',settingsDraft.dimStyles.map(item=>item.name),settingsDraft.dimName);
  displayTextStyleFields();displayDimStyleFields();$('settings-error').textContent='';$('new-text-style-name').value='';$('new-dim-style-name').value='';
  for(const id of ['units-tree','units-presets','units-linear','units-angular'])$(id).open=true;if(!$('settings-dialog').open)$('settings-dialog').showModal();$('settings-dialog').scrollTop=0;
}
function finishDialogReload(){if(pendingDevelopmentReload&&!documentActionBusy&&!closingApplication){pendingDevelopmentReload=false;setTimeout(()=>runAction('dev-reload'),0);}}
function closeSettings(){$('settings-dialog').close();settingsDraft=null;finishDialogReload();}
function createDraftStyle(kind){
  if(!captureStyleFields())return;const name=$(`new-${kind}-style-name`).value.trim(),list=settingsDraft[kind==='text'?'textStyles':'dimStyles'];
  if(!name||/[<>/\\";:?*|,=\x00-\x1f]/.test(name)||list.some(style=>style.name===name)){$('settings-error').textContent='Enter a new, valid style name.';return;}
  const source=list.find(style=>style.name===settingsDraft[kind==='text'?'textName':'dimName']);list.push({...source,name});settingsDraft[kind==='text'?'textName':'dimName']=name;
  fillOptions(`setting-${kind}-style`,list.map(style=>style.name),name);displayTextStyleFields();displayDimStyleFields();$(`new-${kind}-style-name`).value='';$('settings-error').textContent='';
}
function openAnnotationEditor(entityId=null){
  const entity=entityId?activeEntities().find(item=>item.id===entityId):null;
  if(entityId&&!entity)return;
  const type=entity?.type||(state().command==='MTEXT'?'MTEXT':state().commandData?.textEntity?.type||'TEXT');
  annotationEditor={entityId,type,command:state().command};$('annotation-error').textContent='';$('annotation-dialog-title').textContent=type==='MTEXT'?'Edit multiline text':'Edit drawing text';$('annotation-content').value=entity?.text||state().commandData?.textEntity?.text||'';
  $('annotation-content').rows=type==='MTEXT'?6:3;$('annotation-editor-hint').textContent=type==='MTEXT'?'Line breaks are preserved; long lines wrap to the text box width. Apply creates or updates one multiline object.':'One line per object. Apply commits the text; Cancel retains the original drawing.';
  if(!$('annotation-dialog').open)$('annotation-dialog').showModal();$('annotation-content').focus();if(entity)$('annotation-content').select();
}
function closeAnnotationEditor(cancelCommand=false){
  if(cancelCommand&&annotationEditor?.command&&state().command===annotationEditor.command)editor.cancel();$('annotation-dialog').close();annotationEditor=null;update();finishDialogReload();
}
function maybeAnnotationEditor(){
  if(state().commandPhase==='text'&&['TEXT','MTEXT','TEXTEDIT'].includes(state().command)&&!$('annotation-dialog').open){
    const selected=state().command==='TEXTEDIT'?state().selectionIds[0]:null;openAnnotationEditor(selected);
  }
}
async function publishClipboard(data) {
  if(!data)return {ok:false,error:'No geometry was copied.'};
  const snapshot=JSON.parse(JSON.stringify(data));localGeometryClipboard=snapshot;
  const previous=clipboardWritePromise;
  const operation=(previous?previous.catch(()=>null):Promise.resolve()).then(()=>desktop?.writeGeometryClipboard?desktop.writeGeometryClipboard(snapshot):{ok:true}).finally(()=>{if(clipboardWritePromise===operation)clipboardWritePromise=null;});
  clipboardWritePromise=operation;return await operation;
}
async function finishPreparedCut() {
  if(clipboardCutPending||state().commandPhase!=='clipboard-ready'||!editor.finishClipboardCut)return;
  clipboardCutPending=true;const owner=editor;
  try{
    const result=await publishClipboard(owner.getClipboard());
    if(owner!==editor){owner.finishClipboardCut(false);return;}
    resultLog(owner.finishClipboardCut(result?.ok===true));
    if(!result?.ok)addLog(result?.error||'Clipboard write failed; source geometry was retained.','error');
  }catch(error){if(owner===editor)resultLog(owner.finishClipboardCut(false));addLog(`Clipboard write failed; source geometry was retained. ${error.message}`,'error');}
  finally{clipboardCutPending=false;}
}
function trackClipboard(command,result) {
  if(result?.ok===false)return;
  if(state().commandPhase==='clipboard-ready'){void finishPreparedCut();return;}
  if(['COPYCLIP','COPYBASE'].includes(command)&&!state().command&&editor.getClipboard){
    void publishClipboard(editor.getClipboard()).then(value=>{if(!value?.ok)addLog(value?.error||'Native clipboard write failed; geometry is available in this drawing clipboard.','error');}).catch(error=>addLog(error.message,'error'));
  }
}
async function preparePaste() {
  const owner=editor;
  try{
    if(clipboardWritePromise){const written=await clipboardWritePromise;if(!written?.ok){addLog(written?.error||'Paste canceled because the clipboard write failed.','error');return {ok:false};}}
    let data=localGeometryClipboard;
    if(desktop?.readGeometryClipboard){const result=await desktop.readGeometryClipboard();if(!result?.ok){addLog(result?.error||'The drawing clipboard could not be read.','error');return {ok:false};}data=result.data;}
    if(owner!==editor||state().command){addLog('Paste canceled because the drawing or active command changed.','notice');return {ok:false};}
    if(data){const result=editor.setClipboard(data);if(result?.ok===false)return resultLog(result);localGeometryClipboard=JSON.parse(JSON.stringify(data));}
    else if(desktop){addLog('The clipboard does not contain Linecraft geometry.','notice');return {ok:false};}
    if(editor.getClipboard()?.entities?.some(entity=>['MESH','POLY3D'].includes(entity.type)))editor.setWorkspace('3d');
    return resultLog(editor.execute('PASTECLIP'));
  }catch(error){addLog(error.message||'Paste failed.','error');return {ok:false};}
}
function architectureOwner(entity){return entity&&editor.getArchitectureOwner?editor.getArchitectureOwner(entity.id):null;}
function architectureSource(){return state().architecture||{wallNodes:[],walls:[],rooms:[],openings:[],roofGroups:[]};}
function architectureFrame(){return architectureSource().buildingFrame||{origin:{x:0,y:0,z:0},rotationDegrees:0};}
function architectureLength(id){const field=$(id),value=field.value.trim();if(!value)throw Error('Enter a length for every required field.');const parsed=geometry.parseLength(value,state().settings);if(!Number.isFinite(parsed))throw Error('Enter a finite drawing length.');return parsed;}
function architectureSetLength(id,value){$(id).value=geometry.formatLength(value,state().settings);}
function architecturePoint(xId,yId){return{x:architectureLength(xId),y:architectureLength(yId)};}
function resetArchitectureInputs(){
  if(architectureInputEditor===editor&&architectureInputUnits===state().settings.units)return;
  architectureInputEditor=editor;architectureInputUnits=state().settings.units;architectureSpaceContext='';architectureTrayContext='';
  const defaults={'arch-wall-thickness':'6"','arch-wall-base':'0','arch-wall-bearing':"10'",'arch-wall-x1':'0','arch-wall-y1':'0','arch-wall-x2':"20'",'arch-wall-y2':'0','arch-node-x':'0','arch-node-y':'0','arch-opening-station':"2'",'arch-opening-width':"3'",'arch-opening-sill':'0','arch-opening-head':"7'",'arch-span-value':"40'",'arch-room-ceiling':"8'",'arch-room-target':"8'",'arch-roof-overhang':"2'",'arch-roof-bearing':"10'",'arch-roof-heel':'0','arch-space-target':"9'",'arch-space-minimum':"7'",'arch-space-headroom':"7'",'arch-space-finish':'0','arch-space-thickness':'0','arch-space-section-coordinate':'0','arch-space-section-x':'0','arch-space-section-y':'0','arch-space-reservation-min-x':'0','arch-space-reservation-max-x':"1'",'arch-space-reservation-min-y':'0','arch-space-reservation-max-y':"1'",'arch-space-reservation-min-z':"9'",'arch-space-reservation-max-z':"10'",'arch-tray-min-x':"4'",'arch-tray-max-x':"16'",'arch-tray-min-y':"3'",'arch-tray-max-y':"9'",'arch-tray-base':"8'",'arch-tray-raised':"9'"};
  for(const[id,value]of Object.entries(defaults))$(id).value=value;
  $('arch-wall-role').value='exterior';$('arch-wall-reference').value='center';$('arch-roof-pitch').value='8';$('arch-roof-source').value='selection';$('arch-roof-name').value='Hip roof';$('arch-room-allow').checked=true;
}
function architecturePhysicalLength(value){return geometry.parseLength(value,state().settings);}
function architectureChoice(id,items,placeholder='Choose an existing object'){
  const select=$(id),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=placeholder;select.append(empty);
  for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.label||item.name||item.id;select.append(option);}select.value=items.some(item=>item.id===previous)?previous:'';
}
function architectureTabTo(tab){architectureTab=['walls','rooms','roof','space','report'].includes(tab)?tab:'walls';for(const button of document.querySelectorAll('[data-architecture-tab]'))button.setAttribute('aria-pressed',String(button.dataset.architectureTab===architectureTab));for(const pane of document.querySelectorAll('[data-architecture-pane]'))pane.hidden=pane.dataset.architecturePane!==architectureTab;if(architectureTab==='report')refreshArchitectureReport();if(architectureTab==='space')loadArchitectureSpace();}
function architectureReadWall(){return{thickness:architectureLength('arch-wall-thickness'),referenceFace:$('arch-wall-reference').value,baseElevation:architectureLength('arch-wall-base'),bearingElevation:architectureLength('arch-wall-bearing'),role:$('arch-wall-role').value};}
function architectureReport(){return editor.getArchitectureReport?editor.getArchitectureReport():{status:'unavailable',message:'Architecture integration is not available in this build.'};}
function refreshArchitectureReport(){try{$('architecture-report').textContent=JSON.stringify(architectureReport(),null,2);}catch(error){$('architecture-report').textContent=error.message;}}
function refreshArchitectureSummary(){const source=state().architecture,count=source?.walls?.length||0,roofCount=source?.roofGroups?.length||0;$('architecture-summary').textContent=count||roofCount?`${count} walls · ${source?.rooms?.length||0} rooms · ${roofCount} roof groups\n${state().architectureDerived?.validation?.geometry||'Source model'} · surcharge 0`:'No architectural source';}
function refreshArchitectureLists(){
  const source=architectureSource();architectureChoice('arch-wall-id',(source.walls||[]).map(wall=>({...wall,label:`${wall.id} · ${wall.role}`})));
  architectureChoice('arch-node-id',source.wallNodes||[]);architectureChoice('arch-span-start',source.wallNodes||[]);architectureChoice('arch-span-end',source.wallNodes||[]);architectureChoice('arch-room-id',(source.rooms||[]).map(room=>({...room,label:room.label||room.id})));architectureChoice('arch-roof-id',(source.roofGroups||[]).map(group=>({...group,label:group.name||group.id})));
  const entity=modelEntities().find(item=>item.id===architectureBoundaryEntityId),selected=entity?`${entity.type} ${entity.id}`:'none';
  $('architecture-context').textContent=`Drawing units: ${state().settings.units} · Building-local coordinates · Source path: ${selected}\n${source.walls?.length||0} walls · ${source.rooms?.length||0} rooms · ${source.roofGroups?.length||0} roof groups${state().settings.units==='unitless'?' · Assign physical units in Drawing settings before architectural analysis.':''}`;
  $('arch-wall-apply').disabled=!$('arch-wall-id').value;$('arch-opening-add').disabled=!$('arch-wall-id').value;$('arch-node-apply').disabled=!$('arch-node-id').value;$('arch-room-apply').disabled=!$('arch-room-id').value;$('arch-roof-apply').disabled=!$('arch-roof-id').value;
  architectureChoice('arch-space-room',(source.rooms||[]).map(room=>({...room,label:room.label||room.id})));architectureChoice('arch-space-roof',source.roofGroups||[]);
  updateArchitectureRoofPreview();updateArchitectureRoofDetail();refreshArchitectureSummary();if(architectureTab==='report')refreshArchitectureReport();if(architectureTab==='space')loadArchitectureSpace();
}
function showArchitecture(tab='walls',owner=null){
  if(documentActionBusy)return;flushViewportNavigation();closePalettes();hideCompletion();if(state().command)editor.cancel();selectedSubobject=null;
  resetArchitectureInputs();
  const selected=selectionObjects().filter(entity=>!architectureOwner(entity)&&['LINE','PLINE','POLY3D','RECTANG'].includes(entity.type));architectureBoundaryEntityId=selected.length===1?selected[0].id:null;
  const firstOpen=!$('architecture-dialog').open;refreshArchitectureLists();
  if(owner?.kind==='wall'){$('arch-wall-id').value=owner.id;loadArchitectureWall();}
  if(owner?.kind==='room'){$('arch-room-id').value=owner.id;loadArchitectureRoom();}
  if(owner?.kind==='roofGroup'){$('arch-roof-id').value=owner.id;loadArchitectureRoof();}
  architectureTabTo(tab);$('architecture-error').textContent='';$('architecture-result').textContent='';if(firstOpen)$('architecture-dialog').showModal();
}
function closeArchitecture(){$('architecture-dialog').close();finishDialogReload();input.focus();}
function applyArchitecture(operation){
  $('architecture-error').textContent='';$('architecture-result').textContent='';
  try{if(!editor.applyArchitecture)throw Error('Architecture integration is unavailable in this build.');if(state().command)throw Error('Finish or cancel the active drafting command first.');const result=editor.applyArchitecture(operation);resultLog(result);if(result?.ok===false)throw Error(result.message||'Architectural edit rejected.');refreshArchitectureLists();if(operation.type==='addWalls'){$('arch-wall-id').value=architectureSource().walls?.at(-1)?.id||'';loadArchitectureWall();}if(operation.type==='addRoof'){$('arch-roof-id').value=architectureSource().roofGroups?.at(-1)?.id||'';loadArchitectureRoof();}if(operation.type==='recognizeRooms'){$('arch-room-id').value=architectureSource().rooms?.[0]?.id||'';loadArchitectureRoom();}if(operation.type==='setRoom')loadArchitectureRoom();if(architectureTab==='space')loadArchitectureSpace();$('architecture-result').textContent=result?.message||'Architectural source updated.';return result;}catch(error){$('architecture-error').textContent=error.message||'Architectural edit failed.';return{ok:false,message:error.message};}
}
function architectureAction(action){$('architecture-error').textContent='';try{return action();}catch(error){$('architecture-error').textContent=error.message||'Check the architectural input.';return{ok:false,message:error.message};}}
function architectureSelectedPath({closed=false}={}){
  const entity=modelEntities().find(item=>item.id===architectureBoundaryEntityId);if(!entity||architectureOwner(entity))throw Error('Close Architecture, select one ordinary model-space path, then reopen this tool.');
  const isClosed=entity.type==='RECTANG'||['PLINE','POLY3D'].includes(entity.type)&&entity.closed;if(closed&&!isClosed)throw Error('Roof coverage requires one closed polyline or rectangle.');
  const points=entity.type==='LINE'?[entity.start,entity.end]:entity.points;if(!points?.length)throw Error('Select a LINE, polyline or rectangle.');
  const frame=architectureFrame();
  const localPoints=points.map(point=>{if(geometry.architectureWorldToLocal){const local=geometry.architectureWorldToLocal(point,frame);if(Math.abs(local.z||0)>1e-8)throw Error('Architectural source paths must lie in the horizontal building plane.');return{x:local.x,y:local.y};}if(frame&&JSON.stringify(frame)!==JSON.stringify({origin:{x:0,y:0,z:0},rotation:0})){
      const rotated=Number(frame.rotation||frame.rotationDegrees||frame.angle||0),origin=frame.origin||{};if(rotated||origin.x||origin.y||origin.z)throw Error('This build cannot convert this transformed building frame. Use local wall input.');}
    if(Math.abs(point.z||0)>1e-8)throw Error('Architectural source paths must lie in the horizontal building plane.');return{x:point.x,y:point.y};});
  return{points:localPoints,closed:isClosed};
}
function loadArchitectureWall(){const wall=architectureSource().walls?.find(item=>item.id===$('arch-wall-id').value);$('arch-wall-apply').disabled=!wall;$('arch-opening-add').disabled=!wall;if(!wall)return;for(const[key,id]of[['thickness','arch-wall-thickness'],['baseElevation','arch-wall-base'],['bearingElevation','arch-wall-bearing']])architectureSetLength(id,wall[key]);$('arch-wall-reference').value=wall.referenceFace;$('arch-wall-role').value=wall.role;const node=architectureSource().wallNodes?.find(item=>item.id===wall.startNodeId);if(node){$('arch-node-id').value=node.id;loadArchitectureNode();}}
function loadArchitectureNode(){const node=architectureSource().wallNodes?.find(item=>item.id===$('arch-node-id').value);$('arch-node-apply').disabled=!node;if(node){architectureSetLength('arch-node-x',node.x);architectureSetLength('arch-node-y',node.y);}}
function loadArchitectureRoom(){
  const room=architectureSource().rooms?.find(item=>item.id===$('arch-room-id').value);$('arch-room-apply').disabled=!room;$('arch-room-ceiling').disabled=room?.ceilingType==='tray';
  if(!room){$('arch-room-detail').textContent='Recognize rooms, then select one to inspect its ceiling intent.';return;}
  $('arch-room-label').value=room.label||room.id;architectureSetLength('arch-room-ceiling',room.ceilingElevation);architectureSetLength('arch-room-target',room.targetCeilingElevation??room.ceilingElevation);$('arch-room-allow').checked=room.allowCeilingChange!==false;
  const derived=state().architectureDerived?.rooms?.find(item=>item.id===room.id),profile=room.trayCeiling;
  $('arch-room-detail').textContent=`${room.label||room.id}\nFloor datum: ${geometry.formatLength(room.floorElevation??derived?.floorElevation??0,state().settings)}\nAccepted ceiling: ${room.ceilingType==='tray'?'tray':'flat'}\n${room.ceilingType==='tray'?`Lower band: ${architectureSpaceLength(profile?.baseElevation??room.ceilingElevation)} · raised plateau: ${architectureSpaceLength(profile?.raisedElevation)}\nThe scalar ceiling field is locked. Edit or explicitly replace the tray in Space study.`:`Ceiling: ${architectureSpaceLength(room.ceilingElevation)}`}${derived?.area!==undefined?`\nInterior area: ${geometry.formatArea(derived.area,state().settings)}`:''}\n${architectureRoomClearanceText(room.id)}`;
}
function architectureRoomClearanceText(roomId){const analysis=(architectureReport().spaces||[]).find(item=>item.roomId===roomId);return analysis?`Mathematical clearance: ${analysis.status}`:'Clearance: no supported room study.';}
function architectureSpaceSelection(){const source=architectureSource(),room=source.rooms?.find(item=>item.id===$('arch-space-room').value),roof=source.roofGroups?.find(item=>item.id===$('arch-space-roof').value),assembly=source.assemblies?.find(item=>item.id===roof?.assemblyId),analysis=(architectureReport().spaces||[]).find(item=>item.roomId===room?.id);return{source,room,roof,assembly,analysis};}
function architectureSpaceStamp(){const{source,room,roof}=architectureSpaceSelection();return`${source.revision}:${room?.id||''}:${roof?.id||''}`;}
function architectureSpaceLength(value){return Number.isFinite(value)?geometry.formatLength(value,state().settings):'not established';}
function architectureSpaceVolume(value){if(!Number.isFinite(value))return'not established';const units=state().settings.units,divisor=units==='in'?1728:1,suffix=units==='in'?'ft³':`${units}³`;return`${(value/divisor).toFixed(4)} ${suffix}`;}
function architectureSpacePoint(point){return point&&['x','y','z'].every(key=>Number.isFinite(point[key]))?`X ${architectureSpaceLength(point.x)}, Y ${architectureSpaceLength(point.y)}, Z ${architectureSpaceLength(point.z)}`:'not established';}
function loadArchitectureTray(){
  const{room}=architectureSpaceSelection();if(!room)return;
  let candidate=room.trayCandidate||room.trayCeiling;
  if(!candidate){const region=state().architectureDerived?.rooms?.find(item=>item.id===room.id),points=region?.boundary||[];if(points.length){const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));candidate={min:{x:minX+(maxX-minX)*.2,y:minY+(maxY-minY)*.25},max:{x:maxX-(maxX-minX)*.2,y:maxY-(maxY-minY)*.25},baseElevation:room.ceilingElevation,raisedElevation:room.targetCeilingElevation};}}
  if(!candidate)return;for(const bound of ['min','max'])for(const axis of ['x','y'])architectureSetLength(`arch-tray-${bound}-${axis}`,candidate[bound][axis]);architectureSetLength('arch-tray-base',candidate.baseElevation);architectureSetLength('arch-tray-raised',candidate.raisedElevation);
}
function updateArchitectureTrayDetail(){
  const{room,roof,analysis}=architectureSpaceSelection(),tray=analysis?.tray,matching=room&&roof&&analysis?.roofId===roof.id,accepted=architectureSpaceContext===architectureSpaceStamp(),saved=architectureTrayContext===architectureSpaceStamp();
  $('arch-tray-save').disabled=!matching;$('arch-tray-remove').disabled=!matching||!room?.trayCandidate;$('arch-tray-apply').disabled=!(matching&&accepted&&saved&&room?.allowCeilingChange!==false&&room?.trayCandidate&&tray?.feasible===true);
  if(!matching){$('arch-tray-detail').textContent='Choose a room and its fixed roof before calculating a tray proposal.';return;}
  const actual=room.ceilingType==='tray'?room.trayCeiling:null,lines=[`Accepted ceiling: ${actual?'tray':'flat'}`];
  if(actual)lines.push(`Accepted lower / raised elevations: ${architectureSpaceLength(actual.baseElevation)} / ${architectureSpaceLength(actual.raisedElevation)}`);
  if(!room.trayCandidate){lines.push('No saved tray proposal. Enter a bounded rectangle and save it to calculate clearance. Accepted ceiling remains unchanged.');$('arch-tray-detail').textContent=lines.join('\n');return;}
  lines.push('Saved proposal · accepted ceiling remains unchanged until Apply',`Proposal status: ${tray?.status||'not established'} · ${tray?.feasible===true?'feasible within modeled envelope':tray?.feasible===false?'infeasible within modeled envelope':'not established'}`);
  const metrics=tray?.candidate||{},current=tray?.current||analysis.current;
  lines.push(`Lower / raised proposed elevations: ${architectureSpaceLength(room.trayCandidate.baseElevation)} / ${architectureSpaceLength(room.trayCandidate.raisedElevation)}`,`Plateau area: ${Number.isFinite(tray?.plateauArea)?geometry.formatArea(tray.plateauArea,state().settings):'not established'}`,`Accepted-profile feasible volume: ${architectureSpaceVolume(current?.usableVolume)}`,`Proposed tray feasible volume: ${architectureSpaceVolume(metrics.usableVolume)}`,`Change from accepted volume: ${architectureSpaceVolume(tray?.volumeDifference)}`,`Proposed headroom area: ${Number.isFinite(metrics.headroomArea)?geometry.formatArea(metrics.headroomArea,state().settings):'not established'}`,`Maximum raised elevation for saved lower band: ${architectureSpaceLength(tray?.maximumRaisedElevation)}`,`Horizontal finish area: ${Number.isFinite(metrics.horizontalFinishArea)?geometry.formatArea(metrics.horizontalFinishArea,state().settings):'not established'}`,`Vertical return area: ${Number.isFinite(metrics.verticalReturnArea)?geometry.formatArea(metrics.verticalReturnArea,state().settings):'not established'}`);
  if(tray?.limiting)lines.push(`Limiting point: ${architectureSpacePoint(tray.limiting.point)}`,`Limiting region / obstruction: ${tray.limiting.region||'unknown'} · ${tray.limiting.obstacle?.description||tray.limiting.obstacle?.kind||tray.limiting.obstacle?.id||'not established'}`);
  for(const diagnostic of tray?.diagnostics||[])lines.push(diagnostic.message||String(diagnostic));lines.push('Mathematical surfaces · vertical return thickness: 0 · return material volume: 0. Roof and bearings fixed.');
  if(!saved)lines.push('Unsaved tray fields: save / calculate this proposal or reload accepted source before Apply.');$('arch-tray-detail').textContent=lines.join('\n');
}
function architectureTrayValues(){return{min:architecturePoint('arch-tray-min-x','arch-tray-min-y'),max:architecturePoint('arch-tray-max-x','arch-tray-max-y'),baseElevation:architectureLength('arch-tray-base'),raisedElevation:architectureLength('arch-tray-raised')};}
function architectureTrayDirty(){architectureTrayContext='';$('arch-space-zero').disabled=true;updateArchitectureTrayDetail();}
function saveArchitectureTray(remove=false){const{room,analysis,roof}=architectureRequireSpace();if(architectureSpaceContext!==architectureSpaceStamp()||analysis?.roofId!==roof.id)throw Error('Save or reload the room, assembly and reservation fields before calculating a tray.');return applyArchitecture({type:'setTrayCandidate',roomId:room.id,candidate:remove?null:architectureTrayValues()});}
function applyArchitectureTray(){const{room,analysis,roof}=architectureRequireSpace();if(architectureSpaceContext!==architectureSpaceStamp()||architectureTrayContext!==architectureSpaceStamp()||analysis?.roofId!==roof.id)throw Error('Save or reload the tray proposal before applying its accepted result.');return applyArchitecture({type:'applyTrayCandidate',roomId:room.id,sourceRevision:architectureSource().revision});}
function updateArchitectureSpaceDetail(){
  const{room,roof,assembly,analysis}=architectureSpaceSelection(),matching=room&&roof&&analysis?.roofId===roof.id,current=analysis?.current,target=analysis?.target,maximum=analysis?.maximumFlat;
  for(const id of ['arch-space-apply-target','arch-space-apply-maximum','arch-space-section','arch-space-zero'])$(id).disabled=true;
  $('arch-space-intent').disabled=!room;$('arch-space-assembly').disabled=!roof;$('arch-space-reservation-save').disabled=!assembly;$('arch-space-reservation-remove').disabled=!assembly||!$('arch-space-reservation').value;
  updateArchitectureTrayDetail();
  if(!room||!roof){$('arch-space-detail').textContent='Choose an enclosed room and an accepted roof. Thickness defaults to zero in this mathematical model.';return;}
  if(!matching){$('arch-space-detail').textContent=`No supported analysis associates ${room.label||room.id} with ${roof.name||roof.id}. Choose its covering roof, or resolve missing, overlapping or partial coverage. Ceiling actions are disabled.`;return;}
  const feasible=item=>item?.feasible===true?'feasible within modeled envelope':item?.feasible===false?'infeasible within modeled envelope':'not established',limiting=analysis.limiting||{},obstacle=typeof limiting.obstacle==='string'?limiting.obstacle:limiting.obstacle?.description||limiting.obstacle?.id||JSON.stringify(limiting.obstacle||null);
  const lines=[`Accepted ceiling profile: ${room.ceilingType==='tray'?'tray · lower band and raised plateau':'flat'}`,`Accepted source revision ${architectureSource().revision} · roof exterior fixed`,`Study: ${analysis.status}`,`Model: mathematical surfaces with optional thickness and reservations`,`Roof thickness: ${architectureSpaceLength((assembly?.layers||[]).reduce((sum,layer)=>sum+layer.normalThickness,0))} · ceiling finish thickness: ${architectureSpaceLength(room.ceilingFinishThickness??0)}`,`Floor elevation: ${architectureSpaceLength(room.floorElevation)}`,`Required minimum ceiling elevation: ${architectureSpaceLength(analysis.requiredMinimumCeilingElevation)}`,`${room.ceilingType==='tray'?'Current lower band':'Current ceiling'}: ${architectureSpaceLength(current?.elevation??room.ceilingElevation)} · ${feasible(current)}`,`${room.ceilingType==='tray'?'Current lower-band clear height':'Current finished clear height'}: ${architectureSpaceLength(current?.clearHeight)}`,`Current accepted-profile volume: ${architectureSpaceVolume(analysis.tray?.current?.usableVolume??current?.usableVolume)}`,`Flat target ceiling: ${architectureSpaceLength(target?.elevation??room.targetCeilingElevation)} · ${feasible(target)}`,`Target feasible flat volume: ${architectureSpaceVolume(target?.usableVolume)}`,`Maximum flat ceiling elevation: ${architectureSpaceLength(maximum?.elevation??analysis.maxFlatCeilingElevation)}`,`Maximum finished clear height: ${architectureSpaceLength(maximum?.clearHeight)}`,`Maximum feasible flat volume: ${architectureSpaceVolume(maximum?.volume)}`,`Roof-surface-only maximum flat elevation: ${architectureSpaceLength(analysis.roofPotential?.maxFlatCeilingElevation)}`,`Roof-surface-only volume above floor: ${architectureSpaceVolume(analysis.roofPotential?.volumeAboveFloor)}`,`Recoverable flat-ceiling volume: ${architectureSpaceVolume(analysis.recoverableFlatVolume??analysis.recoveryVolume)}`,`Volume below modeled roof envelope: ${architectureSpaceVolume(analysis.declared?.volumeAboveFloor)}`,`Envelope headroom area at ${architectureSpaceLength(analysis.headroom?.threshold)}: ${Number.isFinite(analysis.headroom?.area)?geometry.formatArea(analysis.headroom.area,state().settings):'not established'}`,`Limiting building-local point: ${architectureSpacePoint(limiting.point)}`,`Limiting obstruction: ${obstacle||'not established'}`,`Truss design / manufacturing complexity surcharge: 0 / 0`];
  if(analysis.declared?.limitingPointWorld)lines.push(`Limiting world point: ${architectureSpacePoint(analysis.declared.limitingPointWorld)}`);if(analysis.openingHeadConstraints?.length)lines.push(`Hosted opening head constraints: ${analysis.openingHeadConstraints.length}`);
  for(const diagnostic of analysis.diagnostics||[])lines.push(diagnostic.message||String(diagnostic));
  $('arch-space-detail').textContent=lines.join('\n');
  const accepted=architectureSpaceContext===architectureSpaceStamp(),unlocked=room.allowCeilingChange!==false;
  $('arch-space-zero').disabled=!(accepted&&architectureTrayContext===architectureSpaceStamp());
  $('arch-space-apply-target').disabled=!(accepted&&unlocked&&target?.feasible===true);$('arch-space-apply-target').textContent=room.ceilingType==='tray'?'Replace tray with feasible flat target':'Apply feasible target';$('arch-space-apply-maximum').textContent=room.ceilingType==='tray'?'Replace tray with maximum flat ceiling':'Apply maximum flat ceiling';
  $('arch-space-apply-maximum').disabled=!(accepted&&unlocked&&maximum?.feasible===true);
  $('arch-space-section').disabled=!(accepted&&analysis.declared&&['ok','infeasible'].includes(analysis.status));
  updateArchitectureTrayDetail();
}
function loadArchitectureSpace({matchRoof=false}={}){
  const source=architectureSource();if(!$('arch-space-room').value&&source.rooms?.length)$('arch-space-room').value=source.rooms[0].id;
  const analysis=(architectureReport().spaces||[]).find(item=>item.roomId===$('arch-space-room').value);
  if(matchRoof||!$('arch-space-roof').value)$('arch-space-roof').value=analysis?.roofId||source.roofGroups?.[0]?.id||'';
  const{room,roof,assembly}=architectureSpaceSelection();
  if(room){architectureSetLength('arch-space-target',room.targetCeilingElevation??room.ceilingElevation);architectureSetLength('arch-space-minimum',room.minimumClearHeight??0);architectureSetLength('arch-space-headroom',room.headroomThreshold??0);architectureSetLength('arch-space-finish',room.ceilingFinishThickness??0);$('arch-space-allow').checked=room.allowCeilingChange!==false;const derived=state().architectureDerived?.rooms?.find(item=>item.id===room.id),axis=$('arch-space-section-axis').value,cross=axis==='x'?'y':'x',boundary=derived?.boundary||[];if(boundary.length)architectureSetLength('arch-space-section-coordinate',(Math.min(...boundary.map(p=>p[cross]))+Math.max(...boundary.map(p=>p[cross])))/2);}
  loadArchitectureTray();
  $('arch-space-assembly-name').value=assembly?.name||'Declared roof clearance';architectureSetLength('arch-space-thickness',(assembly?.layers||[]).reduce((sum,layer)=>sum+layer.normalThickness,0));
  $('arch-space-assembly-note').textContent=assembly?`${assembly.id} · ${assembly.layers?.length||0} optional layer(s) · ${(assembly.reservations||[]).length} reservation(s). Saving thickness replaces the layer list; reservations are retained. Use zero thickness resets roof layers and this room\'s ceiling finish together.`:'Zero thickness is active by default. Add optional roof thickness here anytime. Save an envelope to hold reservation boxes, or use zero thickness to create an empty one.';
  architectureChoice('arch-space-reservation',(assembly?.reservations||[]).map(item=>({...item,label:`${item.id} · ${item.description||item.kind}`})),'New reservation');loadArchitectureReservation();architectureSpaceContext=architectureSpaceStamp();architectureTrayContext=architectureSpaceStamp();updateArchitectureSpaceDetail();
}
function loadArchitectureReservation(){const{assembly}=architectureSpaceSelection(),reservation=assembly?.reservations?.find(item=>item.id===$('arch-space-reservation').value);$('arch-space-reservation-save').textContent=reservation?'Save selected reservation':'Add reservation';$('arch-space-reservation-remove').disabled=!reservation;if(!reservation)return;$('arch-space-reservation-kind').value=reservation.kind;$('arch-space-reservation-description').value=reservation.description||'';for(const bound of ['min','max'])for(const axis of ['x','y','z'])architectureSetLength(`arch-space-reservation-${bound}-${axis}`,reservation[bound][axis]);}
function architectureSpaceDirty(){architectureSpaceContext='';architectureTrayContext='';updateArchitectureSpaceDetail();$('arch-space-detail').textContent+='\nUnsaved study fields: save the relevant intent, assembly or reservation, or reload accepted source before applying a ceiling or exporting a section.';}
function architectureRequireSpace({requireAssembly=false}={}){const selection=architectureSpaceSelection();if(!selection.room||!selection.roof)throw Error('Choose a room and roof.');if(requireAssembly&&!selection.assembly)throw Error('Declare and save the roof assembly before adding reservation boxes.');return selection;}
function saveArchitectureAssembly(reservations=null){const{roof,assembly}=architectureRequireSpace();return applyArchitecture({type:'declareRoofAssembly',roofGroupId:roof.id,assembly:{name:$('arch-space-assembly-name').value.trim()||'Declared roof clearance',layers:[{name:'Declared combined normal layer',material:'user-declared',normalThickness:architectureLength('arch-space-thickness')}],reservations:reservations??assembly?.reservations??[],framingVerification:'unverified'}});}
function useArchitectureZeroThickness(){const{room,roof,analysis}=architectureRequireSpace();if(architectureSpaceContext!==architectureSpaceStamp()||architectureTrayContext!==architectureSpaceStamp()||analysis?.roofId!==roof.id)throw Error('Save or reload the study and tray fields before using zero thickness.');return applyArchitecture({type:'useZeroThickness',roomId:room.id,roofGroupId:roof.id,sourceRevision:architectureSource().revision});}
function saveArchitectureReservation(remove=false){const{assembly}=architectureRequireSpace({requireAssembly:true}),id=$('arch-space-reservation').value,reservations=structuredClone(assembly.reservations||[]),index=reservations.findIndex(item=>item.id===id);if(remove){if(index<0)throw Error('Choose an existing reservation to remove.');reservations.splice(index,1);}else{let reservationId=id;if(!reservationId){let next=1;while(reservations.some(item=>item.id===`reservation-${next}`))next++;reservationId=`reservation-${next}`;}const reservation={id:reservationId,kind:$('arch-space-reservation-kind').value,description:$('arch-space-reservation-description').value.trim(),min:{},max:{}};for(const bound of ['min','max'])for(const axis of ['x','y','z'])reservation[bound][axis]=architectureLength(`arch-space-reservation-${bound}-${axis}`);if(index<0)reservations.push(reservation);else reservations[index]=reservation;}return applyArchitecture({type:'declareRoofAssembly',roofGroupId:$('arch-space-roof').value,assembly:{...structuredClone(assembly),reservations}});}
function applyArchitectureCeiling(elevation){const{room,analysis,roof}=architectureRequireSpace();if(architectureSpaceContext!==architectureSpaceStamp())throw Error('Save or reload the study fields before applying an accepted result.');if(analysis?.roofId!==roof.id)throw Error('The selected roof does not match this room study.');return applyArchitecture({type:'applyFlatCeiling',roomId:room.id,elevation});}
function architectureRoofValues(){const riseTwice=Number($('arch-roof-pitch').value),overhang=architectureLength('arch-roof-overhang'),bearingElevation=architectureLength('arch-roof-bearing'),heelOffset=architectureLength('arch-roof-heel');return{riseTwice,overhang,bearingElevation,heelOffset,eaveElevation:null};}
function updateArchitectureRoofPreview(){try{const values=architectureRoofValues(),eaveElevation=values.bearingElevation+values.heelOffset-values.overhang*values.riseTwice/24;$('arch-roof-eave-preview').textContent=`Geometric eave surface: ${geometry.formatLength(eaveElevation,state().settings)}\nBearing + declared heel offset − pitch × overhang. Room ceilings remain independent.`;}catch{$('arch-roof-eave-preview').textContent='Enter valid bearing, heel offset and overhang lengths.';}}
function updateArchitectureRoofDetail(){
  const id=$('arch-roof-id').value,derived=state().architectureDerived,group=architectureSource().roofGroups?.find(item=>item.id===id),roof=derived?.roofs?.find(item=>item.id===id),diagnostics=(derived?.diagnostics||[]).filter(item=>!id||!item.ownerId||item.ownerId===id),lines=[];
  if(roof){lines.push(`Roof: ${roof.status||'unsolved'}`,`Geometry: ${roof.validation?.geometry||'unverified'}`,`Runoff: ${roof.validation?.drainage||'unverified'}`,`Coverage: ${group?.boundarySource==='walls'?'linked to perimeter walls':'captured source boundary'}`);if(roof.faces?.length){const quantities=roof.quantities||{},highest=Math.max(...roof.faces.flatMap(face=>face.vertices.map(point=>point.z)));lines.push(`Roof facets: ${roof.faces.length}`);if(Number.isFinite(quantities.projectedArea))lines.push(`Projected coverage: ${geometry.formatArea(quantities.projectedArea,state().settings)}`);const surface=quantities.surfaceArea??quantities.roofSurfaceArea;if(Number.isFinite(surface))lines.push(`Roof surface: ${geometry.formatArea(surface,state().settings)}`);lines.push(`Highest surface: ${geometry.formatLength(highest,state().settings)}`);}lines.push(`Clearance: ${(architectureReport().spaces||[]).filter(item=>item.roofId===id).map(item=>`${item.roomId}: ${item.status}`).join(', ')||'no supported room study'}`,'Framing / supplier review: unverified');}
  else lines.push(`${architectureSource().roofGroups?.length||0} accepted roof group(s).`,'Select a roof group to inspect its status.');
  if(diagnostics.length)lines.push('',...diagnostics.map(item=>item.message||String(item)));$('arch-roof-detail').textContent=lines.join('\n');
}
function loadArchitectureRoof(){const group=architectureSource().roofGroups?.find(item=>item.id===$('arch-roof-id').value);$('arch-roof-apply').disabled=!group;if(!group){updateArchitectureRoofDetail();return;}$('arch-roof-name').value=group.name||'Hip roof';$('arch-roof-pitch').value=String(group.riseTwice);architectureSetLength('arch-roof-overhang',group.overhang);architectureSetLength('arch-roof-bearing',group.bearingElevation);architectureSetLength('arch-roof-heel',group.heelOffset??0);updateArchitectureRoofPreview();updateArchitectureRoofDetail();}
function architectureCreateRoof(){const operation={type:'addRoof',roofType:'HIP',name:$('arch-roof-name').value.trim()||'Hip roof',...architectureRoofValues()};if($('arch-roof-source').value==='walls'){const wallIds=(architectureSource().walls||[]).filter(wall=>['exterior','bearing'].includes(wall.role)).map(wall=>wall.id);if(!wallIds.length)throw Error('Declare exterior or bearing walls before creating a linked perimeter roof.');operation.wallIds=wallIds;}else operation.boundary=architectureSelectedPath({closed:true}).points;return applyArchitecture(operation);}
function addArchitectureFootprint(){
  if(state().settings.units==='unitless')throw Error('Assign physical drawing units in Drawing settings before adding a physical footprint.');if(state().activeSpace==='paper'||currentViewport())throw Error('Return to standalone Model before adding a drafting footprint.');
  const presets={rectangle:[[0,0],[40,0],[40,24],[0,24]],L:[[0,0],[40,0],[40,20],[20,20],[20,40],[0,40]],T:[[0,0],[60,0],[60,20],[40,20],[40,50],[20,50],[20,20],[0,20]],H:[[0,0],[20,0],[20,16],[44,16],[44,0],[64,0],[64,60],[44,60],[44,44],[20,44],[20,60],[0,60]]};
  const frame=architectureFrame(),points=presets[$('arch-footprint-preset').value].map(([x,y])=>{const point={x:architecturePhysicalLength(`${x}'`),y:architecturePhysicalLength(`${y}'`)};return geometry.architectureLocalToWorld?geometry.architectureLocalToWorld(point,frame):point;});
  if(frame&&!geometry.architectureLocalToWorld&&(frame.origin?.x||frame.origin?.y||frame.origin?.z||frame.rotation||frame.rotationDegrees))throw Error('Transformed-frame footprint starters require a supported frame adapter.');
  const ucs=activePlane();if(Math.abs(ucs.normal.x)>1e-8||Math.abs(ucs.normal.y)>1e-8||Math.abs((ucs.normal.z??1)-1)>1e-8||Math.hypot(ucs.origin.x,ucs.origin.y,ucs.origin.z)>1e-8||Math.abs(ucs.xAxis.x-1)>1e-8)throw Error('Set World XY UCS at the origin before adding a drafting starter.');
  let result=editor.execute(points.some(point=>Math.abs(point.z||0)>1e-8)?'3DPOLY':'PLINE');for(const point of points){if(!result.ok)break;result=editor.submitPoint(point);}if(result.ok)result=editor.execute('C');if(!result.ok){editor.cancel();throw Error(result.message||'Footprint creation failed.');}const entity=modelEntities().at(-1);architectureBoundaryEntityId=entity?.id;editor.select(entity?[entity.id]:[]);resultLog(result);refreshArchitectureLists();$('architecture-result').textContent='Closed drafting footprint added and selected. Convert it to walls or generate a hip roof.';return result;
}
function renderArchitectureOwnerProperties(selected){
  const owners=selected.map(architectureOwner).filter(Boolean);if(!owners.length)return false;const box=$('properties-content');box.replaceChildren();$('selection-count').textContent='Architectural source';const unique=[...new Map(owners.map(owner=>[`${owner.kind}:${owner.id}`,owner])).values()];box.append(propertyRow('Object','Generated architecture'),propertyRow('Owner',unique.length===1?`${unique[0].kind} · ${unique[0].id}`:`${unique.length} source owners`));const note=document.createElement('p');note.className='architecture-owner-note';note.textContent='Generated geometry follows architectural source. Edit the source properties; mesh vertices and ordinary transform commands are protected.';box.append(note);const button=document.createElement('button');button.className='architecture-owner-button';button.textContent='Edit architectural source';button.setAttribute('aria-label','Edit architectural source');button.addEventListener('click',()=>{const owner=unique[0];showArchitecture(owner.kind==='roofGroup'?'roof':owner.kind==='room'?'rooms':'walls',owner);});box.append(button);return true;
}
function resultLog(result) {
  if (result?.message) addLog(result.message, result.ok === false ? 'error' : 'notice');
  update();
  if(state().commandPhase==='clipboard-ready')void finishPreparedCut();
  return result;
}
function runCommand(raw, {recall=true}={}) {
  if(documentActionBusy)return {ok:false,message:'Wait for the drawing file operation to finish.'};
  flushViewportNavigation();
  const text = String(raw ?? '').trim();
  addLog(`${currentPrompt()} ${text || '↵'}`, 'input');
  if (text && recall) { commandRecall.push(text); recallIndex = commandRecall.length; }
  panTool = false;
  hideCompletion();closePalettes();
  const command=state().command||commandName(text);
  if(!state().command&&selectedSubobject&&['ERASE','E','MOVE','M','COPY','CO','CP','SCALE','SC','ROTATE','RO','ROTATE3D','COPYCLIP','CUTCLIP','COPYBASE','MIRROR','MI'].includes(command)){const result={ok:false,message:'Choose Whole object for this command. Mesh subobjects are edited with their highlighted grip or Properties.'};resultLog(result);return result;}
  if(!state().command&&['UCS','BOX','CYLINDER','SPHERE','EXTRUDE','3DPOLY','ROTATE3D','3DORBIT','3DFORBIT','3DORBITCTR','VPOINT','PLAN'].includes(command))editor.setWorkspace('3d');
  if(!state().command&&['3DORBIT','3DFORBIT'].includes(command)){startOrbit(command==='3DFORBIT'?'free':'constrained');return {ok:true,message:'Orbit view active.'};}
  if(orbitMode){orbitMode=null;orbitPivot=null;if(!text){update();return {ok:true,message:'Orbit view ended.'};}}
  if(!state().command&&command==='HELP'){showReference();return {ok:true};}
  if(!state().command&&['ARCHITECTURE','WALL','WALLFROM','WALLHEIGHT','ROOM','ROOF','ROOFPITCH','ROOFREPORT','ROOFSPACE','ROOFSECTION'].includes(command)){showArchitecture(['ROOFSPACE','ROOFSECTION'].includes(command)?'space':command==='ROOM'?'rooms':command==='ROOFREPORT'?'report':['ROOF','ROOFPITCH'].includes(command)?'roof':'walls');return{ok:true,message:'Architecture tools opened.'};}
  if(!state().command&&command==='ROOFUPDATE')return applyArchitecture({type:'regenerate'});
  if(!state().command&&['STYLE','DIMSTYLE','UNITS'].includes(command)){showSettings();return {ok:true};}
  if(!state().command&&['PLOT','PUBLISH'].includes(command))return showPlot(command==='PUBLISH'?'publish':'plot');
  if(!state().command&&['LAYER','LA'].includes(command)){showLayerManager();return{ok:true};}
  if(!state().command&&command==='PAGESETUP'){showPageSetup(!currentLayout());return{ok:true};}
  if(!state().command&&command==='PASTECLIP')return preparePaste();
  const anchor=state().commandPoints?.at(-1),direction=pointer&&anchor&&['LINE','PLINE'].includes(state().command)?{x:pointer.x-anchor.x,y:pointer.y-anchor.y,z:(pointer.z||0)-(anchor.z||0)}:null;
  const inputOptions=direction&&Object.values(direction).every(Number.isFinite)&&Object.values(direction).some(value=>value!==0)?{direction}:{};
  const previousCamera=camera3D(),result=resultLog(state().commandPhase==='text'&&editor.submitText?editor.submitText(String(raw??'')):editor.execute(text,inputOptions));trackClipboard(command,result);
  if(command==='MVIEW'&&result.ok&&!state().command){selectCreatedViewport(result.viewportId);update();}
  if(command==='3DORBITCTR'&&result.ok&&!state().command){const p=toScreen(camera3D().orbitCenter);if(!finiteScreenPoint(p)||p.x<0||p.x>width||p.y<0||p.y>height){setCamera({...camera3D(),orbitCenter:previousCamera.orbitCenter,autoTarget:previousCamera.autoTarget});addLog('Center outside the view; the previous orbit center was retained.');startOrbit('constrained');}else startOrbit('constrained',null,{explicit:true});}
  if(modelWorkspace()&&result.ok&&!state().command&&(command==='ZOOM'||/^Z(?:OOM)?\s+E(?:XTENTS)?$/i.test(text)))fit();return result;
}
function currentPrompt() { return state().prompt || 'Command:'; }
function cancel() {
  flushViewportNavigation();
  const wasOrbit=Boolean(orbitMode);
  panTool = false; orbitMode=null;orbitPivot=null;drag = null; snap = null;pointerScalar=null;hideCompletion();closePalettes();
  const active = state().command;
  editor.cancel();
  if (!active&&!wasOrbit){editor.clearSelection();selectedViewportId=null;selectedSubobject=null;overlapCycle=null;subobjectMode='whole';}viewportNavigationDraft=null;
  input.value = '';
  addLog(active ? '*Cancel*' : 'Command:', 'notice');
  update();
}
function fit() {
  flushViewportNavigation();
  if(documentActionBusy)return;
  if(currentLayout()){if(currentViewport()){fitModelViewport(currentViewport());}else fitPaper();update();return;}
  if(modelWorkspace())setCamera(view3d.fitCamera(modelPoints(sceneForOrbit()),camera3D(),width,height,64));else state().viewport = zoomExtents(visibleEntities(), state().viewport, width, height, 64,state());
  addLog('View fitted to visible drawing geometry.');
  updateModelControls();draw(); updateStatus();scheduleDevelopmentCheckpoint();
}
function download(content, name, mime) {
  const url = URL.createObjectURL(new Blob([content], {type:mime}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function safeName() { return documentName.replace(/\.(json|linecraft)$/i, '').replace(/[<>:"/\\|?*]/g, '_') || 'Drawing'; }
async function save(saveAs=false) {
  const text=serializedDrawing(), fingerprint=documentFingerprint();
  if(desktop){
    const result=await desktop.saveDrawing(text,saveAs);
    if(result?.canceled)return false;
    if(!result?.ok){addLog(result?.error||'The drawing could not be saved.','error');toast(result?.error||'The drawing could not be saved.');return false;}
    documentName=displayName(result.name||documentName);
    savedFingerprint=fingerprint;importedAwaitingSave=false;update();toast('Drawing saved.');return true;
  }
  download(text,`${safeName()}.linecraft.json`,'application/json');
  savedFingerprint=fingerprint;importedAwaitingSave=false;update();toast('Drawing saved to your downloads.');return true;
}
async function canDiscard() {
  if(!isDirty())return true;
  if(!desktop)return window.confirm('Discard changes to the current drawing? Save it first if you want to keep it.');
  const choice=await desktop.confirmDiscard(documentName);
  if(choice==='discard')return true;
  if(choice!=='save')return false;
  if(!await save())return false;
  // An edit made while the save was in flight must not be silently discarded.
  if(isDirty()){addLog('The drawing changed while saving. Save the new changes before continuing.','error');return false;}
  return true;
}
function replaceDrawing(fresh,name,{imported=false}={}) {
  editor=fresh;editor.setViewSize(width,height);documentName=displayName(name);
  if(localGeometryClipboard&&editor.setClipboard)editor.setClipboard(localGeometryClipboard);
  savedFingerprint=documentFingerprint();importedAwaitingSave=imported;panTool=false;orbitMode=null;orbitPivot=null;drag=null;pointer=null;rawPointer=null;snap=null;pointerUnavailable=null;pointerScalar=null;input.value='';
  if(imported){if(modelWorkspace())setCamera(view3d.fitCamera(modelPoints(),camera3D(),width,height,64));else state().viewport=zoomExtents(visibleEntities(),state().viewport,width,height,64,state());}
  selectedViewportId=null;selectedSubobject=null;subobjectMode='whole';overlapCycle=null;viewportNavigationDraft=null;for(const id of ['page-setup-dialog','viewport-scale-dialog','layer-manager-dialog'])if($(id).open)$(id).close();
  if($('layer-dialog').open)$('layer-dialog').close();
  if($('help-dialog').open)$('help-dialog').close();
  if($('reference-dialog').open)$('reference-dialog').close();hideCompletion();closePalettes();
  if($('annotation-dialog').open)$('annotation-dialog').close();annotationEditor=null;if($('settings-dialog').open)$('settings-dialog').close();settingsDraft=null;
  update();input.focus({preventScroll:true});
}
function showImportReport(info){
  const box=$('import-report-content');box.replaceChildren();const headline=document.createElement('p');headline.textContent=`${info.sourceFormat||'Drawing'} import: ${info.importedEntities??0} supported objects from ${info.modelSourceEntities??0} model-space source records.`;box.append(headline);addLog(headline.textContent);
  const skipped=Object.entries(info.unsupportedByType||{}).filter(([,count])=>count>0),warnings=Array.isArray(info.warnings)?info.warnings:[];
  if(skipped.length){const label=document.createElement('p');label.textContent='Unsupported records were skipped:';const list=document.createElement('ul');for(const[type,count]of skipped){const row=document.createElement('li');row.textContent=`${type}: ${count}`;list.append(row);addLog(`Skipped ${count} ${type} records.`);}box.append(label,list);}
  if(warnings.length){const list=document.createElement('ul');for(const warning of warnings){const message=typeof warning==='string'?warning:typeof warning?.message==='string'?warning.message+(Number.isFinite(warning.count)&&warning.count>0?` (${warning.count} occurrence${warning.count===1?'':'s'})`:''):'An import warning was reported.';const row=document.createElement('li');row.textContent=message;list.append(row);addLog(message);}box.append(list);}
  if(skipped.length||warnings.length)$('import-dialog').showModal();else toast('Drawing imported. Save it as a Linecraft file.');
}
function setDocumentBusy(busy){documentActionBusy=busy;$('application').classList.toggle('application-busy',busy);for(const element of document.querySelectorAll('.workspace,.command-panel,.statusbar,.document-bar,.layout-tabbar'))element.inert=busy;$('settings-button').disabled=busy;}
async function newDrawing() {
  if(!await canDiscard())return false;
  if(desktop)await desktop.resetDocumentPath();
  replaceDrawing(createEditor(),'Untitled drawing');
  $('command-log').replaceChildren();addLog('New drawing. Enter a command, or open Commands to explore drawing and editing tools.');return true;
}
async function openDrawing() {
  if(!desktop){$('file-input').click();return true;}
  if(!await canDiscard())return false;
  const result=await desktop.openDrawing();
  if(result?.canceled)return false;
  if(!result?.ok){addLog(result?.error||'The drawing could not be opened.','error');toast(result?.error||'The drawing could not be opened.');return false;}
  // A newly constructed editor starts with no import transaction in its undo stack.
  replaceDrawing(createEditor(JSON.parse(result.text)),result.name,{imported:result.imported===true});
  addLog(`Opened ${result.name}.`);if(result.importInfo)showImportReport(result.importInfo);return true;
}
async function exportDrawing() {
  const text=editor.exportDXF();
  for(const warning of editor.getExportWarnings?.()||[])addLog(`DXF output: ${warning}`,'notice');
  if(desktop){const result=await desktop.exportDXF(text);if(result?.canceled)return false;if(!result?.ok){addLog(result?.error||'DXF export failed.','error');toast(result?.error||'DXF export failed.');return false;}toast('DXF exported.');return true;}
  download(text,`${safeName()}.dxf`,'application/dxf');toast('DXF exported to your downloads.');return true;
}
async function runAction(action) {
  flushViewportNavigation();
  if(documentActionBusy){if(action==='dev-reload')pendingDevelopmentReload=true;return false;}
  if(orbitMode&&['undo','redo','cut','paste','copy-base'].includes(action)){toast('Leave Orbit before editing objects.');return false;}
  if(['undo','redo'].includes(action)&&editorDialogOpen()&&!textEditing())return false;
  if(['undo','redo'].includes(action)&&textEditing()&&!(document.activeElement===input&&!input.value))return desktop?.editText?desktop.editText(action):document.execCommand(action);
  if(action==='dev-reload'&&editorDialogOpen()){pendingDevelopmentReload=true;return false;}
  if(['new','open','close','save','save-as','export-dxf','plot','publish'].includes(action)&&editorDialogOpen()){toast('Apply or cancel the open editor before using drawing file actions.');return false;}
  if(action==='plot'||action==='publish')return showPlot(action);
  const documentAction=['new','open','save','save-as','export-dxf','close','dev-reload'].includes(action);
  if(documentAction&&documentActionBusy){if(action==='dev-reload')pendingDevelopmentReload=true;return false;}
  if(documentAction)setDocumentBusy(true);
  try {
    if(['copy','cut','paste','copy-base'].includes(action)){
      if(selectedSubobject&&!textEditing()&&action!=='paste'){toast('Choose Whole object before copying or cutting a mesh.');return false;}
      if(textEditing()&&action!=='copy-base'){
        if(desktop?.editText)return await desktop.editText(action);
        return document.execCommand(action);
      }
      return await runCommand({copy:'COPYCLIP',cut:'CUTCLIP',paste:'PASTECLIP','copy-base':'COPYBASE'}[action]);
    }
    if(action==='new')return await newDrawing();
    if(action==='open')return await openDrawing();
    if(action==='save'||action==='save-as')return await save(action==='save-as');
    if(action==='export-dxf')return await exportDrawing();
    if(action==='undo'){selectedSubobject=null;return resultLog(editor.undo());}
    if(action==='redo'){selectedSubobject=null;return resultLog(editor.redo());}
    if(action==='fit'){fit();syncDesktop();return true;}
    if(action==='about'){showHelp();return true;}
    if(action==='dev-reload')return reloadDevelopmentDrawing();
    if(action==='close'&&desktop){if(!await canDiscard())return false;if(developmentMode)await desktop.resetDocumentPath();clearDevelopmentCheckpoint();closingApplication=true;await desktop.allowClose();return true;}
    return false;
  }catch(error){addLog(error.message||String(error),'error');toast(error.message||'The action could not be completed.');return false;}
  finally{if(documentAction){setDocumentBusy(false);if(pendingDevelopmentReload&&!closingApplication){pendingDevelopmentReload=false;setTimeout(()=>runAction('dev-reload'),0);}}}
}

function resized() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width); height = Math.max(1, rect.height); dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
  editor.setViewSize(width,height);
  ctx.setTransform(dpr,0,0,dpr,0,0); draw();
}
function drawGrid() {
  if(modelWorkspace()){drawGrid3D();return;}
  if (!gridEnabled) return;
  const scale = state().viewport.scale;
  if(!Number.isFinite(scale)||scale<=0)return;
  const ideal = 38 / scale;
  const power = 10 ** Math.floor(Math.log10(ideal));
  const step = state().settings?.gridAdaptive===false?state().settings.gridSpacing:[1,2,5,10].map(n=>n*power).find(n=>n>=ideal);
  if(!Number.isFinite(step)||step<=0)return;
  ctx.lineWidth=1;
  const modulo=(value,divisor)=>((value%divisor)+divisor)%divisor;
  // Iterate in screen space: enormous world origins cannot stall the increment or overflow a grid index.
  for(const [interval,color] of [[step,'#162733'],[step*5,'#1b303d']]){
    const spacing=interval*scale;
    if(!Number.isFinite(spacing)||spacing<1)continue;
    const firstX=modulo(width/2-modulo(state().viewport.center.x,interval)*scale,spacing);
    const firstY=modulo(height/2+modulo(state().viewport.center.y,interval)*scale,spacing);
    ctx.strokeStyle=color;
    for(let x=firstX,i=0;Number.isFinite(x)&&x<=width&&i<300;x+=spacing,i++){
      ctx.beginPath();ctx.moveTo(Math.round(x)+.5,0);ctx.lineTo(Math.round(x)+.5,height);ctx.stroke();
    }
    for(let y=firstY,i=0;Number.isFinite(y)&&y<=height&&i<300;y+=spacing,i++){
      ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(width,Math.round(y)+.5);ctx.stroke();
    }
  }
}
function drawGrid3D(){
  if(!gridEnabled)return;const camera=camera3D(),plane=activePlane(),scale=view3d.pixelScale(camera,height),ideal=38/scale,power=10**Math.floor(Math.log10(ideal));let step=state().settings.gridAdaptive===false?state().settings.gridSpacing:[1,2,5,10].map(v=>v*power).find(v=>v>=ideal);
  if(!Number.isFinite(step)||step<=0)return;const corners=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(point=>geometry.intersectPlaneRay(view3d.screenRay(point,camera,width,height),plane)).filter(Boolean).map(point=>geometry.worldToPlane(point,plane));if(corners.length<2)return;
  const bounds=view3d.bounds3D(corners),range=Math.max(bounds.max.x-bounds.min.x,bounds.max.y-bounds.min.y);while(Number.isFinite(range)&&range/step>150)step*=10;if(!Number.isFinite(step)||!Number.isFinite(range))return;
  const line=(a,b,color)=>{const p=toScreen(geometry.planeToWorld({...a,z:0},plane)),q=toScreen(geometry.planeToWorld({...b,z:0},plane));if(!finiteScreenPoint(p)||!finiteScreenPoint(q)||p.clipped||q.clipped)return;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();};
  const startX=Math.floor(bounds.min.x/step)*step,startY=Math.floor(bounds.min.y/step)*step;
  for(let i=0;i<160;i++){const x=startX+i*step;if(x>bounds.max.x)break;line({x,y:bounds.min.y},{x,y:bounds.max.y},i%5===0?'#1b303d':'#162733');}
  for(let i=0;i<160;i++){const y=startY+i*step;if(y>bounds.max.y)break;line({x:bounds.min.x,y},{x:bounds.max.x,y},i%5===0?'#1b303d':'#162733');}
}
function renderViewCube(){
  const svg=$('view-cube');svg.toggleAttribute('hidden',!modelWorkspace());if(!modelWorkspace())return;const ns='http://www.w3.org/2000/svg',camera={...camera3D(),target:{x:0,y:0,z:0},scale:23,projection:'orthographic'},vertices=[{x:-1,y:-1,z:-1},{x:1,y:-1,z:-1},{x:1,y:1,z:-1},{x:-1,y:1,z:-1},{x:-1,y:-1,z:1},{x:1,y:-1,z:1},{x:1,y:1,z:1},{x:-1,y:1,z:1}],faces=[['top',[4,5,6,7],{x:0,y:0,z:1}],['bottom',[0,3,2,1],{x:0,y:0,z:-1}],['front',[0,1,5,4],{x:0,y:-1,z:0}],['back',[3,7,6,2],{x:0,y:1,z:0}],['right',[1,2,6,5],{x:1,y:0,z:0}],['left',[0,4,7,3],{x:-1,y:0,z:0}]],normal=view3d.cameraBasis(camera).normal;svg.replaceChildren();
  const shown=faces.filter(([,indices,n])=>view3d.dot3(n,normal)>1e-9).map(([name,indices])=>({name,indices,points:indices.map(i=>view3d.projectPoint(vertices[i],camera,90,90))})).sort((a,b)=>a.points.reduce((s,p)=>s+p.depth,0)-b.points.reduce((s,p)=>s+p.depth,0));
  for(const face of shown){const group=document.createElementNS(ns,'g');group.dataset.cubeView=face.name;group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',`View ${face.name}`);const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('points',face.points.map(p=>`${p.x},${p.y}`).join(' '));const label=document.createElementNS(ns,'text');label.setAttribute('x',face.points.reduce((s,p)=>s+p.x,0)/4);label.setAttribute('y',face.points.reduce((s,p)=>s+p.y,0)/4);label.textContent=face.name.toUpperCase();group.append(polygon,label);svg.append(group);}
  const indexes=new Set(shown.flatMap(f=>f.indices));for(const index of indexes){const vertex=vertices[index],p=view3d.projectPoint(vertex,camera,90,90),button=document.createElementNS(ns,'circle');button.setAttribute('cx',p.x);button.setAttribute('cy',p.y);button.setAttribute('r','2.5');button.dataset.cubeYaw=Math.atan2(vertex.y,vertex.x)*180/Math.PI;button.dataset.cubePitch=Math.atan2(vertex.z,Math.hypot(vertex.x,vertex.y))*180/Math.PI;button.setAttribute('role','button');button.setAttribute('tabindex','0');button.setAttribute('aria-label',`Isometric corner ${index+1}`);svg.append(button);}
}
function planeLabel(){const name=state().settings?.constructionPlane||'XY',plane=activePlane(),normal=plane.normal;return `${name==='custom'?'Custom UCS':`World ${name}`} · offset ${lengthFormat(state().settings?.constructionElevation??0)} · normal ${format(normal.x,3)}, ${format(normal.y,3)}, ${format(normal.z,3)}`;}
function updateModelControls(){
  const enabled=modelWorkspace(),camera=camera3D(),viewport=currentViewport();$('model-controls').hidden=!enabled;$('workspace-mode').value=enabled?'3d':'2d';$('workspace-mode').disabled=paperSpace();canvas.closest('.drawing-area').classList.toggle('model-workspace',enabled);$('view3d-preset').value=camera.mode==='neiso'?'iso':camera.mode;$('view3d-projection').value=camera.projection;$('view3d-projection').disabled=Boolean(viewport);$('render3d-mode').value=camera.renderMode;$('orbit-auto-target').checked=camera.autoTarget;displayQuantityField('construction-elevation',state().settings?.constructionElevation??0,'length');$('orbit-tool').classList.toggle('active',Boolean(orbitMode));$('construction-plane').value=state().settings?.constructionPlane==='custom'?'CUSTOM':state().settings?.constructionPlane||'XY';$('selection-mode').value=subobjectMode;$('ucs-badge').textContent=`UCS: ${state().settings?.constructionPlane==='custom'?'Custom':state().settings?.constructionPlane||'XY'}`;$('ucs-badge').title=planeLabel();
  canvas.setAttribute('aria-label',paperSpace()?'Paper drawing canvas. Coordinates and annotations use millimeters. Double-click a viewport to edit its model.':enabled?'3D drawing canvas. Pointer points use the labeled active UCS plane; typed UCS XYZ gives exact spatial coordinates.':'2D drawing canvas. Use the command line for exact coordinates.');document.querySelector('.document-caption').textContent=paperSpace()?'Paper layout':viewport?'Model through viewport':enabled?'3D model':'2D drafting';
  $('view-name').textContent=enabled?camera.mode.toUpperCase():paperSpace()?'PAPER':'TOP';$('view-style').textContent=enabled?`${camera.projection==='perspective'?'PERSPECTIVE':'ORTHOGRAPHIC'} ${camera.renderMode==='shaded'?'SHADED':'WIREFRAME'}`:'2D WIREFRAME';$('construction-plane-label').textContent=pointerUnavailable||`Pointer: ${planeLabel()}`;renderViewCube();
}
function shadeInk(color,factor){const value=/^#[\da-f]{6}$/i.test(color)?color:'#dce5e9';return `rgb(${[1,3,5].map(index=>Math.round(parseInt(value.slice(index,index+2),16)*factor)).join(',')})`;}
function commandPreviewEntities(){if(renderContext&&!renderContext.includeEdits||orbitMode||drag?.mode==='orbit')return[];if(pointerScalar!==null&&state().commandPhase==='height')return editor.previewScalar(pointerScalar);if(modelWorkspace()&&rawPointer&&state().commandData?.targetKind==='object'&&editor.previewObject){const picked=projectedPick(rawPointer,visibleEntities());return picked?editor.previewObject(picked.entityId,picked.point):[];}return pointer?editor.previewCommand(pointer):[];}
function drawModel(){
  const entities=sceneForOrbit(),preview=renderContext&&!renderContext.includeEdits?null:gripPreview(),items=[],camera=camera3D(),light={x:.3,y:-.4,z:.8660254037844386};
  const addEntity=(entity,ghost=false)=>{const selected=state().selectionIds.includes(entity.id),ink=ghost?'#eab47b':selected?'#79b9ff':inkFor(entity),opacity=ghost ? .55 : preview?.id===entity.id ? .3 : 1;
    if(entity.type==='MESH'&&camera.renderMode==='shaded'){for(const triangle of view3d.meshTriangles(entity)){const points=triangle.points.map(toScreen);if(points.some(p=>p.clipped||!finiteScreenPoint(p)))continue;const normal=view3d.triangleNormal(...triangle.points),intensity=normal?Math.abs(view3d.dot3(normal,light)):.5;items.push({depth:points.reduce((s,p)=>s+p.depth,0)/3,draw:()=>{ctx.save();ctx.globalAlpha=opacity;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle=shadeInk(ink,.18+intensity*.34);ctx.fill();ctx.strokeStyle=shadeInk(ink,.36+intensity*.3);ctx.lineWidth=ghost?1.5:.7;ctx.setLineDash(ghost?[4,3]:[]);ctx.stroke();ctx.restore();}});}}
    else if(entity.type==='MESH'){const points=entity.vertices.map(toScreen).filter(finiteScreenPoint);items.push({depth:points.reduce((s,p)=>s+p.depth,0)/Math.max(1,points.length),draw:()=>{for(const[a,b]of projectionEdges(entity))strokeEntity({type:'LINE',start:a,end:b,layer:entity.layer,lineweight:entity.lineweight,linetype:entity.linetype},{color:ink,opacity,dash:ghost?[4,3]:[]});}});}
    else{const points=geometry.entityPoints(entity,drawingContext()).map(toScreen).filter(finiteScreenPoint);items.push({depth:points.reduce((s,p)=>s+p.depth,0)/Math.max(1,points.length),draw:()=>strokeEntity(entity,{color:ink,opacity,dash:ghost?[4,3]:[]})});}
  };
  entities.forEach(e=>addEntity(e));if(preview)addEntity(preview,true);
  let commandPreview=[];try{commandPreview=commandPreviewEntities();}catch{}commandPreview.forEach(e=>addEntity(e,true));
  if((!renderContext||renderContext.includeEdits)&&!orbitMode&&drag?.mode!=='orbit'){
    if(pointer&&state().command==='3DPOLY'&&state().commandPoints?.length)addEntity({type:'POLY3D',points:[...state().commandPoints,pointer],closed:false,layer:state().currentLayer},true);
    if(pointer&&state().command==='LINE'&&state().commandPoints?.length)addEntity({type:'LINE',start:state().commandPoints.at(-1),end:pointer,layer:state().currentLayer},true);
    if(pointer&&state().command==='RECTANG'&&!state().commandData?.spatial&&state().commandPoints?.length){const a=state().commandPoints[0];addEntity({type:'RECTANG',points:[a,{x:pointer.x,y:a.y},pointer,{x:a.x,y:pointer.y}],layer:state().currentLayer},true);}
  }
  items.sort((a,b)=>a.depth-b.depth).forEach(item=>item.draw());
  const meshes=entities.filter(e=>e.type==='MESH');if((!renderContext||renderContext.includeEdits)&&!orbitMode&&drag?.mode!=='orbit')for(const entity of entities.filter(e=>!architectureOwner(e)&&state().selectionIds.includes(e.id)&&(!selectedSubobject||e.id!==selectedSubobject.entityId||selectedSubobject.kind==='vertex'))){for(const[index,point]of pointsOf(entity).entries()){if(selectedSubobject?.entityId===entity.id&&index!==selectedSubobject.index)continue;const p=toScreen(point);if(p.clipped||!finiteScreenPoint(p)||p.x< -8||p.x>width+8||p.y< -8||p.y>height+8||camera.renderMode==='shaded'&&view3d.pointOccluded(point,meshes,camera,width,height))continue;ctx.fillStyle=gripPropertyIndices.get(entity.id)===index?'#eab47b':'#5d9be6';ctx.strokeStyle='#a9d2ff';ctx.lineWidth=1;ctx.fillRect(p.x-3.5,p.y-3.5,7,7);ctx.strokeRect(p.x-3.5,p.y-3.5,7,7);}}
  const basis=view3d.cameraBasis(camera),origin={x:32,y:height-49};for(const[name,axis,color]of [['X',{x:1,y:0,z:0},'#b98262'],['Y',{x:0,y:1,z:0},'#80b088'],['Z',{x:0,y:0,z:1},'#6f9fd0']]){const end={x:origin.x+view3d.dot3(axis,basis.right)*29,y:origin.y-view3d.dot3(axis,basis.up)*29};ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.fillStyle=color;ctx.font='10px Segoe UI';ctx.fillText(name,end.x+3,end.y-3);}
  if((orbitMode||drag?.mode==='orbit')&&orbitPivot){const p=toScreen(orbitPivot);if(finiteScreenPoint(p)){ctx.fillStyle='#141f26';ctx.strokeStyle='#90b7ba';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}}
  if(orbitMode==='free'||drag?.mode==='orbit'&&drag.free){const radius=Math.min(width,height)*.35;ctx.strokeStyle='#80b19b80';ctx.lineWidth=1;ctx.beginPath();ctx.arc(width/2,height/2,radius,0,Math.PI*2);ctx.stroke();for(const[x,y]of [[width/2-radius,height/2],[width/2+radius,height/2],[width/2,height/2-radius],[width/2,height/2+radius]]){ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.stroke();}}
}
const finiteScreenPoint=point=>Number.isFinite(point.x)&&Number.isFinite(point.y);
const fontCapRatios=new Map();
function fontSizeForHeight(height,fontFamily){
  let ratio=fontCapRatios.get(fontFamily);
  if(ratio===undefined){ctx.save();ctx.font=`100px "${fontFamily}"`;const measured=ctx.measureText('H');ratio=(measured.actualBoundingBoxAscent+measured.actualBoundingBoxDescent)/100;ctx.restore();if(!Number.isFinite(ratio)||ratio<=0)ratio=.72;fontCapRatios.set(fontFamily,ratio);}
  return height/ratio;
}
function drawAnnotation(entity,{color,opacity=1,grips=false,dash=[]}={}){
  if(!geometry.annotationPrimitives)return;
  let primitive;try{primitive=geometry.annotationPrimitives(entity,drawingContext());}catch{return;}
  const ink=inkFor(entity,color);
  ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1.2;ctx.setLineDash(entityDash(entity,dash));
  if(entity.type==='DIMENSION'){
    for(const [a,b]of primitive.segments){const start=toScreen(a),end=toScreen(b);if(!finiteScreenPoint(start)||!finiteScreenPoint(end))continue;ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();}
    ctx.setLineDash([]);for(const triangle of primitive.arrows){const screen=triangle.map(toScreen);if(!screen.every(finiteScreenPoint))continue;ctx.beginPath();ctx.moveTo(screen[0].x,screen[0].y);screen.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));ctx.closePath();ctx.fill();}
  }
  for(const line of primitive.texts){
    const origin=toScreen(line.position),scale=modelWorkspace()?(camera3D().projection==='perspective'?view3d.focalPixels(camera3D(),height)/origin.viewDistance:camera3D().scale):viewScale(),fontSize=fontSizeForHeight(line.height*scale,line.fontFamily),targetWidth=line.width*scale;
    if(!finiteScreenPoint(origin)||!Number.isFinite(fontSize)||fontSize<.5||fontSize>100000||!Number.isFinite(targetWidth)||targetWidth<=0)continue;
    const bounds=primitive.boundsPoints.map(toScreen).filter(finiteScreenPoint);if(bounds.length&&(bounds.every(point=>point.x<0)||bounds.every(point=>point.x>width)||bounds.every(point=>point.y<0)||bounds.every(point=>point.y>height)))continue;
    ctx.save();ctx.translate(origin.x,origin.y);
    if(modelWorkspace()){const angle=(line.rotation%360)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),basis=view3d.cameraBasis(camera3D()),along={x:c,y:s,z:0},down={x:s,y:-c,z:0};ctx.transform(view3d.dot3(along,basis.right),-view3d.dot3(along,basis.up),view3d.dot3(down,basis.right),-view3d.dot3(down,basis.up),0,0);}else ctx.rotate(-(line.rotation%360)*Math.PI/180);
    ctx.font=`${fontSize}px "${line.fontFamily}"`;ctx.textBaseline='alphabetic';ctx.textAlign=line.align==='center'?'center':'left';
    const measured=ctx.measureText(line.text).width;if(measured>0&&Number.isFinite(measured)){ctx.scale(targetWidth/measured,1);ctx.fillText(line.text,0,0);}ctx.restore();
  }
  if(grips){ctx.globalAlpha=1;const corners=primitive.boundsPoints.map(toScreen).filter(finiteScreenPoint);if(entity.type!=='DIMENSION'&&corners.length===4){ctx.strokeStyle='#6a9aba';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);}for(const point of pointsOf(entity).map(toScreen).filter(point=>finiteScreenPoint(point)&&point.x>=-8&&point.x<=width+8&&point.y>=-8&&point.y<=height+8)){ctx.fillStyle='#5d9be6';ctx.strokeStyle='#a9d2ff';ctx.fillRect(point.x-3.5,point.y-3.5,7,7);ctx.strokeRect(point.x-3.5,point.y-3.5,7,7);}}
  ctx.restore();
}
function drawShapePrimitives(entity,primitive,{color,dash=[],opacity=1,grips=false}={}){
  const ink=inkFor(entity,color);ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=Math.max(1.25,Math.min(8,(entity.lineweight||layerFor(entity)?.lineweight||.25)*4));ctx.setLineDash(entityDash(entity,dash));
  const path=(raw,closed=false)=>{const points=raw.map(toScreen);if(points.length<2||points.some(point=>point.clipped||!finiteScreenPoint(point)))return false;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));if(closed)ctx.closePath();return true;};
  let analyticFill=false;
  if(entity.type==='HATCH'&&entity.pattern==='solid'&&['CIRCLE','ELLIPSE'].includes(entity.boundary.type)){
    const boundary=entity.boundary,center=toScreen(boundary.center),major=(boundary.type==='CIRCLE'?boundary.radius:Math.hypot(boundary.major.x,boundary.major.y))*viewScale(),minor=major*(boundary.type==='CIRCLE'?1:boundary.ratio);
    if(!modelWorkspace()&&finiteScreenPoint(center)&&Number.isFinite(major)&&Number.isFinite(minor)&&major>0&&minor>0&&major<1e7){ctx.beginPath();ctx.ellipse(center.x,center.y,major,minor,boundary.type==='CIRCLE'?0:-Math.atan2(boundary.major.y,boundary.major.x),0,Math.PI*2);ctx.globalAlpha=opacity*.3;ctx.fill();ctx.globalAlpha=opacity;analyticFill=true;}
    else primitive={...primitive,fills:[{points:curveDisplayPoints(boundary),closed:true}]};
  }
  if(!analyticFill)for(const fill of primitive.fills||[]){const points=Array.isArray(fill)?fill:fill.points;if(points?.length>=3&&path(points,true)){ctx.globalAlpha=opacity*.3;ctx.fill();ctx.globalAlpha=opacity;}}
  for(const[a,b]of primitive.segments||[])if(path([a,b]))ctx.stroke();
  let exactCurve=false;
  if(!modelWorkspace()&&entity.type==='ELLIPSE'){const center=toScreen(entity.center),major=Math.hypot(entity.major.x,entity.major.y)*viewScale(),minor=major*entity.ratio;if(finiteScreenPoint(center)&&Number.isFinite(major)&&Number.isFinite(minor)&&major>0&&minor>0&&major<1e7){ctx.beginPath();ctx.ellipse(center.x,center.y,major,minor,-Math.atan2(entity.major.y,entity.major.x),0,Math.PI*2);ctx.stroke();exactCurve=true;}}
  if(!modelWorkspace()&&entity.type==='SPLINE'&&primitive.beziers?.length){const spans=primitive.beziers.map(span=>span.map(toScreen));if(spans.every(span=>span.every(finiteScreenPoint))){ctx.beginPath();ctx.moveTo(spans[0][0].x,spans[0][0].y);for(const[,a,b,end]of spans)ctx.bezierCurveTo(a.x,a.y,b.x,b.y,end.x,end.y);ctx.stroke();exactCurve=true;}}
  if(!exactCurve)for(const item of primitive.paths||[]){const points=Array.isArray(item)?item:item.points;if(points?.length&&path(points,Boolean(item.closed)))ctx.stroke();}
  ctx.restore();if(grips){ctx.save();ctx.fillStyle='#5d9be6';ctx.strokeStyle='#a9d2ff';ctx.lineWidth=1;for(const point of pointsOf(entity).map(toScreen).filter(p=>!p.clipped&&finiteScreenPoint(p)&&p.x>=-8&&p.x<=width+8&&p.y>=-8&&p.y<=height+8)){ctx.fillRect(point.x-3.5,point.y-3.5,7,7);ctx.strokeRect(point.x-3.5,point.y-3.5,7,7);}ctx.restore();}
}
function strokeEntity(entity, {color, dash=[], opacity=1, grips=false}={}) {
  if(architectureOwner(entity))grips=false;
  if(entity.type==='VIEWPORT'){drawViewportBorder(entity,{color,dash,opacity,grips});return;}
  if(entity.type==='INSERT'&&geometry.expandedInsertEntities){for(const child of displayInsertChildren(entity))strokeEntity(child,{color:color||entity.color,dash,opacity});if(grips)drawShapePrimitives(entity,{},{color,dash,opacity,grips});return;}
  if(['ELLIPSE','SPLINE','HATCH'].includes(entity.type)&&geometry.entityDisplayPrimitives){drawShapePrimitives(entity,geometry.entityDisplayPrimitives(entity,drawingContext()),{color,dash,opacity,grips});return;}
  if(['TEXT','MTEXT','DIMENSION'].includes(entity.type)){drawAnnotation(entity,{color,dash,opacity,grips});return;}
  if(entity.type==='MESH'||spatialCurve(entity)||modelWorkspace()&&['CIRCLE','ARC'].includes(entity.type)){for(const[a,b]of projectionEdges(entity))strokeEntity({type:'LINE',start:a,end:b,layer:entity.layer,color:entity.color,lineweight:entity.lineweight,linetype:entity.linetype},{color,dash,opacity});if(grips)for(const point of pointsOf(entity).map(toScreen).filter(finiteScreenPoint)){ctx.fillStyle='#5d9be6';ctx.fillRect(point.x-3.5,point.y-3.5,7,7);}return;}
  const points = pointsOf(entity).map(toScreen);
  if (!points.length) return;
  const curved=entity.type==='CIRCLE'||entity.type==='ARC';
  if(!curved&&!points.every(finiteScreenPoint))return;
  let circleCenter,circleRadius,drawCircleOutline=true;
  if(curved){
    circleCenter=toScreen(entity.center);circleRadius=entity.radius*viewScale();
    if(!finiteScreenPoint(circleCenter))return;
    drawCircleOutline=Number.isFinite(circleRadius)&&circleRadius>0;
    if(drawCircleOutline){
      const nearest=Math.hypot(Math.max(-circleCenter.x,0,circleCenter.x-width),Math.max(-circleCenter.y,0,circleCenter.y-height));
      const farthest=Math.hypot(Math.max(Math.abs(circleCenter.x),Math.abs(circleCenter.x-width)),Math.max(Math.abs(circleCenter.y),Math.abs(circleCenter.y-height)));
      drawCircleOutline=nearest<=circleRadius+8&&farthest>=circleRadius-8;
    }
    if(!drawCircleOutline&&!grips)return;
  }
  ctx.globalAlpha=opacity;
  ctx.strokeStyle=inkFor(entity,color);
  ctx.lineWidth=Math.max(1.25,Math.min(8,(entity.lineweight||layerFor(entity)?.lineweight||.25)*4));ctx.setLineDash(entityDash(entity,dash));ctx.beginPath();
  if(curved){
    if(drawCircleOutline){
      if(entity.type==='ARC')ctx.arc(circleCenter.x,circleCenter.y,circleRadius,-entity.startAngle*Math.PI/180,-(entity.startAngle+entity.sweepAngle)*Math.PI/180,entity.sweepAngle>0);
      else ctx.arc(circleCenter.x,circleCenter.y,circleRadius,0,Math.PI*2);
    }
  }else{
    ctx.moveTo(points[0].x,points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x,point.y);
    if (entity.type === 'RECTANG'||['PLINE','POLY3D'].includes(entity.type)&&entity.closed) ctx.closePath();
  }
  ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  if (grips) {
    for(const point of points.filter(point=>finiteScreenPoint(point)&&point.x>=-8&&point.x<=width+8&&point.y>=-8&&point.y<=height+8)) { ctx.fillStyle='#5d9be6';ctx.strokeStyle='#a9d2ff';ctx.lineWidth=1;ctx.fillRect(point.x-3.5,point.y-3.5,7,7);ctx.strokeRect(point.x-3.5,point.y-3.5,7,7); }
  }
}
function gripPreview() {
  if(drag?.mode==='subobject-grip'&&pointer){const entity=activeEntities().find(item=>item.id===drag.entityId);if(!entity)return null;const delta={x:pointer.x-drag.startPoint.x,y:pointer.y-drag.startPoint.y,z:pointer.z-drag.startPoint.z},preview=structuredClone(entity);preview.vertices=preview.vertices.map((point,index)=>drag.indices.includes(index)?{x:point.x+delta.x,y:point.y+delta.y,z:point.z+delta.z}:point);preview.faces=preview.faces.flatMap(face=>face.length===4?[[face[0],face[1],face[2]],[face[0],face[2],face[3]]]:[face]);try{geometry.validateMesh(preview);return preview;}catch{return null;}}
  if (drag?.mode !== 'grip' || !pointer) return null;
  const entity = activeObjects().find(e=>e.id===drag.entityId);
  if (!entity) return null;
  if(geometry.previewGrip){try{return geometry.previewGrip(entity,drag.index,pointer,state());}catch{return null;}}
  if (entity.type === 'LINE') return {...entity,[drag.index === 0 ? 'start':'end']:pointer};
  if(entity.type==='CIRCLE')return drag.index===0?{...entity,center:{...pointer}}:{...entity,radius:Math.hypot(pointer.x-entity.center.x,pointer.y-entity.center.y)};
  const opposite=entity.points[(drag.index+2)%4];
  return {...entity,points:[{x:pointer.x,y:pointer.y},{x:opposite.x,y:pointer.y},{x:opposite.x,y:opposite.y},{x:pointer.x,y:opposite.y}]};
}
function moveSelectionPreview(){if(drag?.mode!=='move-selection'||!pointer)return[];const delta={x:pointer.x-drag.startPaper.x,y:pointer.y-drag.startPaper.y};return selectionObjects().map(object=>{try{return geometry.translateEntity(object,delta);}catch{return null;}}).filter(Boolean);}
function drawViewportBorder(viewport,{color,dash=[],opacity=1,grips=false}={}){ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=color||inkFor(viewport);ctx.lineWidth=Math.max(state().activeViewportId===(viewport.viewportId||viewport.id)?2.5:1.25,Math.min(8,(viewport.lineweight??layerFor(viewport)?.lineweight??.25)*4));ctx.setLineDash(entityDash(viewport,dash));tracePaperBoundary(viewportBoundary(viewport));ctx.stroke();if(grips){ctx.setLineDash([]);for(const point of pointsOf(viewport).map(paperToScreen).filter(finiteScreenPoint)){ctx.fillStyle='#528fca';ctx.strokeStyle='#bfdfff';ctx.lineWidth=1;ctx.fillRect(point.x-3.5,point.y-3.5,7,7);ctx.strokeRect(point.x-3.5,point.y-3.5,7,7);}}ctx.restore();}
function drawActiveGeometry(includeEdits=true){const preview=includeEdits?gripPreview():null;for(const entity of visibleEntities()){const selected=includeEdits&&state().selectionIds.includes(entity.id);strokeEntity(entity,{color:selected?'#79b9ff':undefined,opacity:preview?.id===entity.id ? .35 : 1,grips:selected&&preview?.id!==entity.id});}if(preview&&preview.type!=='VIEWPORT')strokeEntity(preview,{color:'#79b9ff',dash:[5,4],grips:true});if(!includeEdits)return;for(const object of moveSelectionPreview().filter(object=>object.type!=='VIEWPORT'))strokeEntity(object,{color:'#79b9ff',dash:[5,4]});const anchor=state().commandPoints?.at(-1);if(pointer&&anchor&&state().command==='LINE')strokeEntity({type:'LINE',start:anchor,end:pointer,layer:state().currentLayer},{color:'#c28d4f',dash:[5,4]});if(pointer&&anchor&&state().command==='RECTANG'&&!state().commandData?.spatial)strokeEntity({type:'RECTANG',points:[anchor,{x:pointer.x,y:anchor.y},pointer,{x:anchor.x,y:pointer.y}],layer:state().currentLayer},{color:'#c28d4f',dash:[5,4]});if(pointer&&(!['LINE','RECTANG'].includes(state().command)||state().commandData?.spatial))for(const entity of editor.previewCommand(pointer)||[])if(entity.type!=='VIEWPORT')strokeEntity(entity,{color:'#c28d4f',dash:[5,4]});}
function drawPaper(){
  const layout=currentLayout(),paper=layout.paper,a=paperToScreen({x:0,y:paper.heightMm}),b=paperToScreen({x:paper.widthMm,y:0});ctx.save();ctx.shadowColor='#0008';ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle='#fafbf9';ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();ctx.save();ctx.strokeStyle='#abb8b9';ctx.lineWidth=1;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeStyle='#d4dddd';ctx.setLineDash([4,4]);const inset=10*paperView().scale;ctx.strokeRect(a.x+inset,a.y+inset,b.x-a.x-2*inset,b.y-a.y-2*inset);ctx.restore();
  const previews=paperSpace()?[gripPreview(),...moveSelectionPreview(),...(pointer?editor.previewCommand(pointer)||[]:[])].filter(object=>object?.type==='VIEWPORT'):[],previewIDs=new Set(previews.map(object=>object.viewportId));
  const drawModelInViewport=(viewport,opacity=1)=>{ctx.save();ctx.globalAlpha=opacity;tracePaperBoundary(viewportBoundary(viewport));ctx.clip();renderContext={space:'model',layoutId:layout.id,viewportId:viewport.viewportId||viewport.id,viewport,entities:modelEntities(),includeEdits:state().activeViewportId===(viewport.viewportId||viewport.id)};try{if(modelWorkspace())drawModel();else drawActiveGeometry(renderContext.includeEdits);}finally{renderContext=null;ctx.restore();}};
  for(const originalViewport of layout.viewports){const viewport=viewportNavigationDraft?.id===originalViewport.id?viewportNavigationDraft:originalViewport;drawModelInViewport(viewport,previewIDs.has(viewport.id)? .35 : 1);}for(const preview of previews)drawModelInViewport(preview,.65);
  renderContext={space:'paper',layoutId:layout.id,viewportId:null,entities:editor.getPaperEntities(layout.id),includeEdits:paperSpace()};try{drawActiveGeometry(paperSpace());}finally{renderContext=null;}
  for(const viewport of layout.viewports){if(!geometry.isEntityVisible({layer:viewport.layer||'0',layoutId:layout.id},state(),{space:'paper',layoutId:layout.id,viewportId:null}))continue;const object=viewportObject(viewport)||viewport,selected=paperSpace()&&state().selectionIds.includes(object.id),active=state().activeViewportId===viewport.id;drawViewportBorder(object,{color:active?'#388569':selected?'#377abb':undefined,opacity:previewIDs.has(viewport.id)? .35 : 1,grips:selected&&!previewIDs.has(viewport.id)});}for(const preview of previews)drawViewportBorder(preview,{color:'#417d9b',dash:[5,3],grips:drag?.mode==='grip'});
  if(state().command==='MVIEW'&&state().commandPoints?.[0]&&pointer&&!previews.length){const anchors=state().commandPoints,points=state().commandPhase==='viewport-polygon'?[...anchors,pointer]:framePoints({x:Math.min(anchors[0].x,pointer.x),y:Math.min(anchors[0].y,pointer.y),width:Math.abs(anchors[0].x-pointer.x),height:Math.abs(anchors[0].y-pointer.y)});ctx.save();ctx.strokeStyle='#417d9b';ctx.setLineDash([5,3]);tracePaperBoundary(points);ctx.stroke();ctx.restore();}
}
function draw() {
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#0d171e';ctx.fillRect(0,0,width,height);
  if(currentLayout())drawPaper();else{
  drawGrid();
  if(modelWorkspace())drawModel();else{
  const origin=toScreen({x:0,y:0});
  if (origin.x>-40&&origin.x<width+40&&origin.y>-40&&origin.y<height+40) {
    ctx.lineWidth=1.4;ctx.strokeStyle='#ad7458';ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(origin.x+36,origin.y);ctx.stroke();
    ctx.strokeStyle='#638f74';ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(origin.x,origin.y-36);ctx.stroke();
    ctx.font='10px Segoe UI';ctx.fillStyle='#9b715b';ctx.fillText('X',origin.x+41,origin.y+4);ctx.fillStyle='#689078';ctx.fillText('Y',origin.x-3,origin.y-42);
    ctx.strokeStyle='#7294a3';ctx.strokeRect(origin.x-2.5,origin.y-2.5,5,5);
  }
  const preview=gripPreview();
  for (const entity of visibleEntities()) {
    const selected=state().selectionIds.includes(entity.id);
    strokeEntity(entity,{color:selected?'#79b9ff':undefined,opacity:preview?.id===entity.id ? .35 : 1,grips:selected&&preview?.id!==entity.id});
  }
  if (preview) strokeEntity(preview,{color:'#79b9ff',dash:[5,4],grips:true});
  const commandPoints=state().commandPoints || [];
  const anchor=commandPoints.at(-1);
  if (pointer&&anchor&&state().command==='LINE') strokeEntity({type:'LINE',start:anchor,end:pointer,layer:state().currentLayer},{color:'#eab47b',dash:[5,4]});
  if(pointer&&anchor&&state().command==='ARC'&&state().commandPhase==='arc-second')strokeEntity({type:'LINE',start:anchor,end:pointer,layer:state().currentLayer},{color:'#688f9e',dash:[3,4]});
  if (pointer&&anchor&&state().command==='RECTANG') strokeEntity({type:'RECTANG',points:[anchor,{x:pointer.x,y:anchor.y},pointer,{x:anchor.x,y:pointer.y}],layer:state().currentLayer},{color:'#eab47b',dash:[5,4]});
  if(pointer&&editor.previewCommand&&!['LINE','RECTANG'].includes(state().command)){let entities=[];try{entities=editor.previewCommand(pointer)||[];}catch{}for(const entity of entities)strokeEntity(entity,{color:'#eab47b',dash:[5,4]});}
  else if(pointer&&anchor&&state().command==='CIRCLE')strokeEntity({type:'CIRCLE',center:anchor,radius:Math.hypot(pointer.x-anchor.x,pointer.y-anchor.y),layer:state().currentLayer},{color:'#eab47b',dash:[5,4]});
  if(pointer&&anchor&&['CIRCLE','MOVE','COPY','ROTATE','SCALE','MIRROR','PASTECLIP','DIST','AREA'].includes(state().command)&&!['selection','delete-choice'].includes(state().commandPhase))strokeEntity({type:'LINE',start:anchor,end:pointer,layer:state().currentLayer},{color:'#688f9e',dash:[3,4]});
  if(state().command==='AREA'&&commandPoints.length>1)strokeEntity({type:'PLINE',points:commandPoints,closed:false,layer:state().currentLayer},{color:'#eab47b',dash:[5,4]});
  if(pointer&&anchor&&state().command==='MTEXT'&&state().commandPhase==='second-corner')strokeEntity({type:'RECTANG',points:[anchor,{x:pointer.x,y:anchor.y},pointer,{x:anchor.x,y:pointer.y}],layer:state().currentLayer},{color:'#eab47b',dash:[5,4]});
  }
  }
  if(state().command==='STRETCH'&&state().commandPhase==='window-second'&&state().commandPoints?.[0]&&pointer){const a=state().commandPoints[0],b=pointer,points=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}].map(toScreen);if(points.every(finiteScreenPoint)){ctx.save();ctx.fillStyle='#48a67f1b';ctx.strokeStyle='#6daf8d';ctx.lineWidth=1;ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}
  if (drag?.mode==='box' && drag.moved) {
    const a=drag.start, b=drag.screen;
    const crossing=b.x<a.x;
    ctx.fillStyle=crossing?'#48a67f1b':'#418cd224';ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
    ctx.strokeStyle=crossing?'#6daf8d':'#7bb5e7';ctx.lineWidth=1;ctx.setLineDash(crossing?[5,3]:[]);ctx.strokeRect(a.x+.5,a.y+.5,b.x-a.x,b.y-a.y);ctx.setLineDash([]);
  }
  if (rawPointer && drag?.mode !== 'pan') {
    const p=pointer ? toScreen(pointer) : rawPointer;
    ctx.strokeStyle=state().command?'#a9c0ca':'#6f94a6';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(p.x-18,p.y+.5);ctx.lineTo(p.x-5,p.y+.5);ctx.moveTo(p.x+5,p.y+.5);ctx.lineTo(p.x+18,p.y+.5);ctx.moveTo(p.x+.5,p.y-18);ctx.lineTo(p.x+.5,p.y-5);ctx.moveTo(p.x+.5,p.y+5);ctx.lineTo(p.x+.5,p.y+18);ctx.stroke();
    if (!state().command) ctx.strokeRect(p.x-3.5,p.y-3.5,7,7);
  }
  if (snap&&snapEnabled) {
    const p=toScreen(snap.point);ctx.strokeStyle='#8ce4ab';ctx.lineWidth=1.5;
    if(snap.type.toLowerCase().includes('mid')) {ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y+5);ctx.lineTo(p.x-6,p.y+5);ctx.closePath();ctx.stroke();}
    else if(snap.type.toLowerCase().includes('center')){ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();}
    else if(snap.type.toLowerCase().includes('quad')){ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y);ctx.lineTo(p.x,p.y+6);ctx.lineTo(p.x-6,p.y);ctx.closePath();ctx.stroke();}
    else ctx.strokeRect(p.x-5,p.y-5,10,10);
  }
  drawSubobjectSelection();
}

function propertyRow(label,value) {
  const row=document.createElement('div');row.className='property-row';
  const name=document.createElement('span');name.textContent=label;
  const val=document.createElement('span');val.textContent=value;
  row.append(name,val);return row;
}
function subheading(text) {const item=document.createElement('div');item.className='property-subheading';item.textContent=text;return item;}
function numberProperty(label,value,aria,apply,{min,step='any',kind='number',prefs=displaySettings()}={}){
  const row=propertyRow(label,''),field=document.createElement('input');field.type=kind==='number'?'number':'text';field.step=step;if(min!==undefined&&kind==='number')field.min=min;
  field.value=kind==='length'?lengthFormat(value,prefs):kind==='angle'?angleFormat(value,prefs):value;field.setAttribute('aria-label',aria);if(kind!=='number')field.title=`Exact stored value: ${value}${kind==='angle'?' degrees':' coordinate units'}. Explicit unit suffixes are accepted.`;
  const initial=field.value;
  field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();field.blur();}});
  field.addEventListener('change',()=>{if(field.value===initial)return;let parsed;try{parsed=kind==='length'&&geometry.parseLength?geometry.parseLength(field.value,prefs):kind==='angle'&&geometry.parseAngle?geometry.parseAngle(field.value,prefs):Number(field.value);if(!field.value.trim()||!Number.isFinite(parsed))throw Error('Enter a finite numeric value.');if(min!==undefined&&parsed<min)throw Error(`Enter a value of at least ${min}.`);}catch(error){addLog(error.message||'Check the entered value.','error');update();return;}resultLog(apply(parsed));});row.lastElementChild.replaceWith(field);return row;
}
function styleProperty(label,names,current,aria,apply){const row=propertyRow(label,''),select=document.createElement('select');select.setAttribute('aria-label',aria);for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}select.value=current;select.addEventListener('change',()=>resultLog(apply(select.value)));row.lastElementChild.replaceWith(select);return row;}
function pointProperties(box,label,point,apply){for(const axis of ['x','y'])box.append(numberProperty(`${label} ${axis.toUpperCase()}`,point[axis],`${label} ${axis.toUpperCase()}`,value=>apply({...point,[axis]:value}),{kind:'length'}));}
function pointProperties3D(box,label,point,apply){for(const axis of ['x','y','z'])box.append(numberProperty(`${label} ${axis.toUpperCase()}`,point[axis]??0,`${label} ${axis.toUpperCase()}`,value=>apply({...point,[axis]:value}),{kind:'length'}));}
function renderSubobjectProperties(entity){
  const selection=selectedSubobject,box=$('properties-content');box.replaceChildren();$('selection-count').textContent=`${selection.kind} ${selection.index+1}`;box.append(propertyRow('Object','Mesh subobject'),propertyRow('Selection',`${selection.kind} ${selection.index+1}`),propertyRow('Affected vertices',selection.indices.length));
  const center=subobjectCenter(entity,selection.indices),move=delta=>{if(!Object.values(delta).some(value=>value!==0))return{ok:true};const result=editor.moveMeshVertices(entity.id,selection.indices,delta);if(result.ok)selectedSubobject=null;return result;};
  if(selection.kind==='vertex')pointProperties3D(box,'Vertex',entity.vertices[selection.index],point=>{const result=editor.moveGrip(entity.id,selection.index,point);if(result.ok)selectedSubobject=null;return result;});
  else pointProperties3D(box,'Subobject center',center,point=>move({x:point.x-center.x,y:point.y-center.y,z:point.z-center.z}));
  if(selection.kind==='face'){
    const points=selection.indices.map(index=>entity.vertices[index]),normal=view3d.triangleNormal(...points.slice(0,3));if(normal){box.append(propertyRow('Face normal XYZ',`${format(normal.x,5)}, ${format(normal.y,5)}, ${format(normal.z,5)}`),numberProperty('Move along normal',0,'Face normal distance',distance=>move({x:normal.x*distance,y:normal.y*distance,z:normal.z*distance}),{kind:'length'}));}
    const button=document.createElement('button');button.textContent='Use face as UCS';button.className='property-button';button.setAttribute('aria-label','Use selected face as UCS');button.addEventListener('click',()=>{const result=editor.setUCSFromFace(entity.id,selection.index);if(result.ok){pointer=null;pointerUnavailable=null;}resultLog(result);});box.append(button);
  }
  const note=document.createElement('p');note.className='empty-property';note.textContent='Drag the orange grip in a parallel plane or enter exact world coordinates. Editing triangulates mesh faces; it does not create a solid. Whole-object commands require Whole object mode.';box.append(note);
  const whole=document.createElement('button');whole.textContent='Whole object properties';whole.className='property-button';whole.addEventListener('click',()=>setSubobjectMode('whole'));box.append(whole);
}
function renderProperties() {
  if(renderArchitectureOwnerProperties(selectionObjects())){selectedSubobject=null;return;}
  if(selectedSubobject){const entity=activeEntities().find(item=>item.id===selectedSubobject.entityId);if(entity?.type==='MESH'&&selectedSubobject.indices.every(index=>entity.vertices[index])){renderSubobjectProperties(entity);return;}selectedSubobject=null;}
  const selected=selectionObjects();
  if(paperSpace()&&selected.length===1&&selected[0].type==='VIEWPORT'){renderViewportProperties();return;}
  const box=$('properties-content');box.replaceChildren();
  $('selection-count').textContent=selected.length?`${selected.length} selected`:'No selection';
  if(!selected.length){const p=document.createElement('p');p.className='empty-property';p.textContent='Select an object to inspect its geometry.';box.append(p);return;}
  box.append(propertyRow('Object',selected.length===1?({RECTANG:'Rectangle',CIRCLE:'Circle',ARC:'Arc',LINE:'Line',PLINE:'Polyline',TEXT:'Text',MTEXT:'Multiline text',DIMENSION:'Dimension',MESH:'3D mesh',POLY3D:'3D polyline'}[selected[0].type]||selected[0].type):'Multiple objects'));
  const layerRow=propertyRow('Layer','');const choose=document.createElement('select');choose.setAttribute('aria-label','Selection layer');
  for(const layer of state().layers){const option=document.createElement('option');option.value=layer.name;option.textContent=layer.name;choose.append(option);}
  choose.value=selected[0].layer;
  choose.addEventListener('change',()=>resultLog(editor.setSelectionProperties({layer:choose.value})));
  layerRow.lastElementChild.replaceWith(choose);box.append(layerRow);
  const colorRow=propertyRow('Color','By layer');const color=document.createElement('input');color.type='color';color.title='Selection color';color.setAttribute('aria-label','Selection color');color.value=selected[0].color || layerFor(selected[0])?.color || '#e5e7eb';
  color.addEventListener('change',()=>resultLog(editor.setSelectionProperties({color:color.value})));
  const colorGroup=document.createElement('span');colorGroup.style.display='flex';colorGroup.style.alignItems='center';colorGroup.style.gap='6px';
  const byLayer=document.createElement('button');byLayer.textContent='By layer';byLayer.title='Use the layer color';byLayer.style.fontSize='10px';byLayer.style.padding='3px';byLayer.style.color='#8da7b2';byLayer.addEventListener('click',()=>resultLog(editor.setSelectionProperties({color:'BYLAYER'})));
  colorGroup.append(byLayer,color);colorRow.lastElementChild.replaceWith(colorGroup);box.append(colorRow);
  const lwRow=propertyRow('Lineweight','');const lw=document.createElement('select');lw.setAttribute('aria-label','Selection lineweight');
  for(const value of ['BYLAYER',0,0.13,0.18,0.25,0.35,0.5,0.7,1]){const option=document.createElement('option');option.value=value;option.textContent=value==='BYLAYER'?'By layer':`${value} mm`;lw.append(option);}
  lw.value=selected[0].lineweight ?? 'BYLAYER';
  lw.addEventListener('change',()=>resultLog(editor.setSelectionProperties({lineweight:lw.value==='BYLAYER'?'BYLAYER':Number(lw.value)})));lwRow.lastElementChild.replaceWith(lw);box.append(lwRow);
  if(geometry.LINETYPES)box.append(styleProperty('Linetype',['BYLAYER',...geometry.LINETYPES],selected[0].linetype||'BYLAYER','Selection linetype',linetype=>editor.setSelectionProperties({linetype})));
  if(selected.length===1){const entity=selected[0];box.append(subheading('GEOMETRY'));
    if(is3DEntity(entity)){
      const vertices=entity.type==='MESH'?entity.vertices:entity.points,selectedIndex=Math.min(gripPropertyIndices.get(entity.id)||0,vertices.length-1),bounds=view3d.bounds3D(vertices);gripPropertyIndices.set(entity.id,selectedIndex);
      box.append(propertyRow('Vertices',vertices.length));if(entity.type==='MESH')box.append(propertyRow('Primitive',entity.primitive||'Edited mesh'),propertyRow('Faces',entity.faces.length));else{const path=projectionEdges(entity),length=path.reduce((total,[a,b])=>total+Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),0);box.append(propertyRow('Closed',entity.closed?'Yes':'No'),propertyRow('3D length',lengthFormat(length)));}
      box.append(propertyRow('Minimum XYZ',`${lengthFormat(bounds.min.x)}, ${lengthFormat(bounds.min.y)}, ${lengthFormat(bounds.min.z)}`),propertyRow('Maximum XYZ',`${lengthFormat(bounds.max.x)}, ${lengthFormat(bounds.max.y)}, ${lengthFormat(bounds.max.z)}`));
      const row=propertyRow('Edit vertex',''),select=document.createElement('select');select.className='property-vertex-picker';select.setAttribute('aria-label','3D vertex');for(let i=0;i<vertices.length;i++){const option=document.createElement('option');option.value=i;option.textContent=`Vertex ${i+1}`;select.append(option);}select.value=selectedIndex;select.addEventListener('change',()=>{gripPropertyIndices.set(entity.id,Number(select.value));renderProperties();draw();});row.lastElementChild.replaceWith(select);box.append(row);
      pointProperties3D(box,'Vertex',vertices[selectedIndex],point=>editor.moveGrip(entity.id,selectedIndex,point));
    }else if(['TEXT','MTEXT'].includes(entity.type)){
      const textRow=propertyRow('Content',entity.text);textRow.lastElementChild.className='text-content-preview';textRow.lastElementChild.title=entity.text;box.append(textRow);
      const edit=document.createElement('button');edit.className='property-button';edit.textContent='Edit content';edit.setAttribute('aria-label','Edit annotation content');edit.addEventListener('click',()=>{if(state().command){editor.cancel();update();}openAnnotationEditor(entity.id);});const editRow=propertyRow('Text editor','');editRow.lastElementChild.replaceWith(edit);box.append(editRow);
      box.append(styleProperty('Text style',(state().textStyles||[]).map(style=>style.name),entity.style,'Text style',style=>editor.setTextProperties(entity.id,{style})),numberProperty('Height',entity.height,'Text height',height=>editor.setTextProperties(entity.id,{height}),{min:0,kind:'length'}),numberProperty('Rotation',entity.rotation,'Text rotation',rotation=>editor.setTextProperties(entity.id,{rotation}),{kind:'angle'}));
      if(entity.type==='MTEXT')box.append(numberProperty('Box width',entity.width,'Multiline text width',width=>editor.setTextProperties(entity.id,{width}),{min:0,kind:'length'}));
      pointProperties(box,'Text insertion',entity.position,position=>editor.setTextProperties(entity.id,{position}));
      if(geometry.textLayout){const layout=geometry.textLayout(entity,drawingContext());box.append(propertyRow('Lines',layout.lines.length),propertyRow('Layout width',lengthFormat(layout.width)),propertyRow('Layout height',lengthFormat(layout.height)));}
    }else if(entity.type==='DIMENSION'){
      box.append(propertyRow('Dimension kind',entity.kind),styleProperty('Dimension style',(state().dimStyles||[]).map(style=>style.name),entity.style,'Dimension style',style=>editor.setDimensionProperties(entity.id,{style})),numberProperty('Annotation scale',entity.scale,'Dimension annotation scale',scale=>editor.setDimensionProperties(entity.id,{scale}),{min:0}));
      if(geometry.formatDimension){const measured=geometry.formatDimension(entity,drawingContext());box.append(propertyRow('Measurement',entity.kind==='angular'?angleFormat(measured.measurement):lengthFormat(measured.measurement)),propertyRow('Label',measured.label));}
      const overrideRow=propertyRow('Label override',''),override=document.createElement('input');override.type='text';override.value=entity.textOverride||'';override.placeholder='<> = measurement';override.setAttribute('aria-label','Dimension text override');override.addEventListener('change',()=>resultLog(editor.setDimensionProperties(entity.id,{textOverride:override.value})));overrideRow.lastElementChild.replaceWith(override);box.append(overrideRow);
      if(entity.vertex)pointProperties(box,'Angle vertex',entity.vertex,vertex=>editor.setDimensionProperties(entity.id,{vertex}));
      if(entity.p1){pointProperties(box,'Definition 1',entity.p1,p1=>editor.setDimensionProperties(entity.id,{p1}));pointProperties(box,'Definition 2',entity.p2,p2=>editor.setDimensionProperties(entity.id,{p2}));if(entity.kind==='linear')box.append(numberProperty('Axis angle',entity.axisAngle,'Dimension axis angle',axisAngle=>editor.setDimensionProperties(entity.id,{axisAngle}),{kind:'angle'}));}
      else{pointProperties(box,'Dimension center',entity.center,center=>editor.setDimensionProperties(entity.id,{center}));box.append(numberProperty('Radius',entity.radius,'Dimension radius',radius=>editor.setDimensionProperties(entity.id,{radius}),{min:0,kind:'length'}));}
      pointProperties(box,'Dimension placement',entity.placement,placement=>editor.setDimensionProperties(entity.id,{placement}));
    }else if(entity.type==='ELLIPSE'){
      const major=Math.hypot(entity.major.x,entity.major.y);box.append(propertyRow('Center X / Y',`${lengthFormat(entity.center.x)} / ${lengthFormat(entity.center.y)}`),propertyRow('Major radius',lengthFormat(major)),propertyRow('Minor radius',lengthFormat(major*entity.ratio)),propertyRow('Axis rotation',angleFormat(Math.atan2(entity.major.y,entity.major.x)*180/Math.PI)));
      if(editor.setAdvancedProperties){box.append(numberProperty('Axis ratio',entity.ratio,'Ellipse axis ratio',ratio=>editor.setAdvancedProperties(entity.id,{ratio}),{min:0}));pointProperties(box,'Ellipse center',entity.center,center=>editor.setAdvancedProperties(entity.id,{center}));}
    }else if(entity.type==='SPLINE'){
      box.append(propertyRow('Degree',entity.degree),propertyRow('Control vertices',entity.controlPoints.length),propertyRow('Knots',entity.knots.length),propertyRow('Closed',entity.closed?'Yes':'No'));const note=document.createElement('p');note.className='empty-property';note.textContent='Drag a blue control-vertex grip to reshape the cubic curve.';box.append(note);
    }else if(entity.type==='HATCH'){
      box.append(propertyRow('Boundary',entity.boundary.type),propertyRow('Association','Stored boundary snapshot'));
      if(editor.setAdvancedProperties){box.append(styleProperty('Pattern',['solid','parallel'],entity.pattern,'Hatch pattern',pattern=>editor.setAdvancedProperties(entity.id,{pattern})),numberProperty('Pattern angle',entity.angle,'Hatch angle',angle=>editor.setAdvancedProperties(entity.id,{angle}),{kind:'angle'}),numberProperty('Spacing',entity.spacing,'Hatch spacing',spacing=>editor.setAdvancedProperties(entity.id,{spacing}),{min:0,kind:'length'}));if(entity.origin)pointProperties(box,'Hatch origin',entity.origin,origin=>editor.setAdvancedProperties(entity.id,{origin}));}else box.append(propertyRow('Pattern',entity.pattern),propertyRow('Angle',angleFormat(entity.angle)),propertyRow('Spacing',lengthFormat(entity.spacing)));
    }else if(entity.type==='INSERT'){
      box.append(propertyRow('Block name',entity.blockName),propertyRow('Definition objects',state().blocks?.find(block=>block.name===entity.blockName)?.entities.length||0));if(editor.setAdvancedProperties){box.append(numberProperty('Uniform scale',entity.scale,'Block insertion scale',scale=>editor.setAdvancedProperties(entity.id,{scale}),{min:0}),numberProperty('Rotation',entity.rotation,'Block insertion rotation',rotation=>editor.setAdvancedProperties(entity.id,{rotation}),{kind:'angle'}));pointProperties(box,'Block insertion',entity.position,position=>editor.setAdvancedProperties(entity.id,{position}));}else box.append(propertyRow('Scale',format(entity.scale)),propertyRow('Rotation',angleFormat(entity.rotation)));
    }else if(entity.type==='LINE'){
      box.append(propertyRow('Start X / Y',`${lengthFormat(entity.start.x)} / ${lengthFormat(entity.start.y)}`),propertyRow('End X / Y',`${lengthFormat(entity.end.x)} / ${lengthFormat(entity.end.y)}`),propertyRow('Length',lengthFormat(Math.hypot(entity.end.x-entity.start.x,entity.end.y-entity.start.y))),propertyRow('Angle',angleFormat((Math.atan2(entity.end.y-entity.start.y,entity.end.x-entity.start.x)*180/Math.PI+360)%360)));
    } else if(entity.type==='CIRCLE'||entity.type==='CIRCLE3D'){
      if(spatialCurve(entity)){pointProperties3D(box,'Circle center',entity.center,point=>editor.moveGrip(entity.id,0,point));box.append(propertyRow('Plane X axis',Object.values(entity.xAxis).map(value=>format(value,5)).join(', ')),propertyRow('Plane Y axis',Object.values(entity.yAxis).map(value=>format(value,5)).join(', ')));}
      const radiusRow=numberProperty('Radius',entity.radius,'Circle radius',radius=>editor.setCircleRadius(entity.id,radius),{min:0,kind:'length'});
      box.append(propertyRow('Center X / Y',`${lengthFormat(entity.center.x)} / ${lengthFormat(entity.center.y)}`),radiusRow,propertyRow('Diameter',lengthFormat(entity.radius*2)),propertyRow('Circumference',lengthFormat(2*Math.PI*entity.radius)),propertyRow('Area',areaFormat(Math.PI*entity.radius*entity.radius)));
    } else if(entity.type==='ARC'||entity.type==='ARC3D'){
      if(spatialCurve(entity)){pointProperties3D(box,'Arc center',entity.center,point=>editor.moveGrip(entity.id,3,point));box.append(propertyRow('Plane X axis',Object.values(entity.xAxis).map(value=>format(value,5)).join(', ')),propertyRow('Plane Y axis',Object.values(entity.yAxis).map(value=>format(value,5)).join(', ')));}
      box.append(propertyRow('Center X / Y',`${lengthFormat(entity.center.x)} / ${lengthFormat(entity.center.y)}`),propertyRow('Radius',lengthFormat(entity.radius)),propertyRow('Start angle',angleFormat(entity.startAngle)),propertyRow('Sweep angle',angleFormat(entity.sweepAngle)),propertyRow('Arc length',lengthFormat(entity.radius*Math.abs(entity.sweepAngle)*Math.PI/180)));
      if(entity.type==='ARC'&&geometry.arcPoint){for(const [label,fraction] of [['Start X / Y',0],['End X / Y',1]]){const point=geometry.arcPoint(entity,fraction);box.append(propertyRow(label,`${lengthFormat(point.x)} / ${lengthFormat(point.y)}`));}}
    } else if(entity.type==='PLINE'){
      const vertices=entity.points,edges=vertices.slice(1).map((point,index)=>[vertices[index],point]);if(entity.closed)edges.push([vertices.at(-1),vertices[0]]);
      const length=edges.reduce((total,[a,b])=>total+Math.hypot(b.x-a.x,b.y-a.y),0);
      box.append(propertyRow('Vertices',vertices.length),propertyRow('Closed',entity.closed?'Yes':'No'),propertyRow('Length',lengthFormat(length)),propertyRow('First vertex X / Y',`${lengthFormat(vertices[0].x)} / ${lengthFormat(vertices[0].y)}`));
      if(entity.closed){const origin=vertices[0],area=Math.abs(edges.reduce((total,[a,b])=>total+(a.x-origin.x)*(b.y-origin.y)-(b.x-origin.x)*(a.y-origin.y),0))/2;box.append(propertyRow('Area',areaFormat(area)));}
    } else if(entity.type==='RECTANG'&&entity.points?.length===4){
      const [a,b,,d]=entity.points;const w=Math.hypot(b.x-a.x,b.y-a.y),h=Math.hypot(d.x-a.x,d.y-a.y);
      const angle=(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360;
      box.append(propertyRow('First vertex X / Y',`${lengthFormat(a.x)} / ${lengthFormat(a.y)}`),propertyRow('Width',lengthFormat(w)),propertyRow('Height',lengthFormat(h)),propertyRow('Rotation',angleFormat(angle)),propertyRow('Area',areaFormat(w*h)));
    }
  }
}
function renderLayers() {
  const container=$('layers-list');container.replaceChildren();
  for(const layer of state().layers){
    const row=document.createElement('div');row.className=`layer-row${layer.name===state().currentLayer?' current':''}`;
    const color=document.createElement('input');color.type='color';color.className='layer-color';color.value=layer.color;color.title=`Color: ${layer.name}`;color.setAttribute('aria-label',`Layer ${layer.name} color`);
    color.addEventListener('change',()=>resultLog(editor.updateLayer(layer.name,{color:color.value})));
    const name=document.createElement('button');name.className='layer-name';name.textContent=layer.name;name.title=`Set current layer to ${layer.name}`;
    name.addEventListener('click',()=>resultLog(editor.setCurrentLayer(layer.name)));
    const eye=document.createElement('button');eye.className=`layer-switch${layer.visible===false?' off':''}`;eye.textContent=layer.visible===false?'○':'●';eye.title=layer.visible===false?'Show layer':'Hide layer';eye.setAttribute('aria-label',`${eye.title} ${layer.name}`);eye.addEventListener('click',()=>resultLog(editor.updateLayer(layer.name,{visible:layer.visible===false})));
    const lock=document.createElement('button');lock.className=`layer-switch${!layer.locked?' off':''}`;lock.textContent=layer.locked?'▣':'□';lock.title=layer.locked?'Unlock layer':'Lock layer';lock.setAttribute('aria-label',`${lock.title} ${layer.name}`);lock.addEventListener('click',()=>resultLog(editor.updateLayer(layer.name,{locked:!layer.locked})));
    row.append(color,name,eye,lock);container.append(row);
  }
}
function layerManagerApply(action){const result=resultLog(action());$('layer-manager-error').textContent=result?.ok===false?result.message:'';renderLayerManager();return result;}
function renderLayerManager(){
  if(!$('layer-manager-dialog').open)return;const body=$('layer-manager-rows');body.replaceChildren();const layout=currentLayout(),viewport=selectedViewport();$('manager-viewport-context').textContent=viewport?`VP Freeze: ${layout.name} · selected viewport`:'Select a viewport frame to edit VP Freeze.';
  for(const layer of state().layers){
    const row=document.createElement('tr');row.dataset.layer=layer.name;
    const cell=element=>{const td=document.createElement('td');td.append(element);row.append(td);};
    const nameGroup=document.createElement('div');nameGroup.className='manager-layer-name';const current=document.createElement('button');current.textContent=layer.name===state().currentLayer?'◆':'◇';current.setAttribute('aria-label',`Make layer ${layer.name} current`);current.addEventListener('click',()=>layerManagerApply(()=>editor.setCurrentLayer(layer.name)));const name=document.createElement('input');name.value=layer.name;name.setAttribute('aria-label',`Layer ${layer.name} name`);name.disabled=layer.name==='0';name.addEventListener('change',()=>layerManagerApply(()=>editor.updateLayer(layer.name,{name:name.value})));nameGroup.append(current,name);cell(nameGroup);
    const check=(label,value,apply,disabled=false)=>{const input=document.createElement('input');input.type='checkbox';input.checked=value;input.disabled=disabled;input.setAttribute('aria-label',`${label} ${layer.name}`);input.addEventListener('change',()=>layerManagerApply(()=>apply(input.checked)));cell(input);};
    check('Layer on',layer.visible!==false,value=>editor.updateLayer(layer.name,{visible:value}));check('Layer locked',Boolean(layer.locked),value=>editor.updateLayer(layer.name,{locked:value}));
    const color=document.createElement('input');color.type='color';color.value=layer.color;color.setAttribute('aria-label',`Layer manager color ${layer.name}`);color.addEventListener('change',()=>layerManagerApply(()=>editor.updateLayer(layer.name,{color:color.value})));cell(color);
    const select=(label,values,value,apply)=>{const field=document.createElement('select');field.setAttribute('aria-label',`${label} ${layer.name}`);for(const entry of values){const option=document.createElement('option');option.value=entry;option.textContent=label==='Layer lineweight'?`${entry} mm`:entry;field.append(option);}field.value=value;field.addEventListener('change',()=>layerManagerApply(()=>apply(field.value)));cell(field);};
    select('Layer lineweight',[0,.13,.18,.25,.35,.5,.7,1],layer.lineweight,value=>editor.updateLayer(layer.name,{lineweight:Number(value)}));select('Layer linetype',geometry.LINETYPES||['continuous','dashed','hidden','center'],layer.linetype||'continuous',linetype=>editor.updateLayer(layer.name,{linetype}));
    check('Layer visible in model',layer.modelVisible!==false,value=>editor.updateLayer(layer.name,{modelVisible:value}));check('Layer visible on paper',layer.paperVisible!==false,value=>editor.updateLayer(layer.name,{paperVisible:value}));
    check('Layer plot',layer.plot!==false,value=>editor.updateLayer(layer.name,{plot:value}));
    check('Viewport freeze',Boolean(viewport?.frozenLayers?.includes(layer.name)),value=>editor.freezeViewportLayer(layout.id,viewport.id,layer.name,value),!viewport||!editor.freezeViewportLayer);
    const remove=document.createElement('button');remove.textContent='Delete';remove.disabled=layer.name==='0';remove.setAttribute('aria-label',`Delete layer ${layer.name}`);remove.addEventListener('click',()=>layerManagerApply(()=>editor.deleteLayer(layer.name)));cell(remove);body.append(row);
  }
}
function showLayerManager(){if(documentActionBusy)return;flushViewportNavigation();closePalettes();hideCompletion();if(state().command)editor.cancel();$('layer-manager-error').textContent='';$('layer-manager-dialog').showModal();renderLayerManager();}
function closeLayerManager(){$('layer-manager-dialog').close();finishDialogReload();canvas.focus();}
function entityDash(entity,dash=[]){if(dash.length)return dash;const type=String(entity.linetype&&entity.linetype!=='BYLAYER'?entity.linetype:layerFor(entity)?.linetype).toUpperCase();return currentLayout()?(({DASHED:[4,2],CENTER:[8,2,1,2],HIDDEN:[2,1]})[type]||[]).map(value=>value*paperView().scale):({DASHED:[10,6],CENTER:[16,5,3,5],HIDDEN:[6,4]})[type]||[];}
function setPaperView(view){const result=editor.setPaperView?editor.setPaperView(view):{ok:true};if(!editor.setPaperView)state().paperViewport=view;return result;}
function fitPaper(){const layout=currentLayout();if(!layout)return;setPaperView({center:{x:layout.paper.widthMm/2,y:layout.paper.heightMm/2},scale:Math.max(1e-6,Math.min(1e6,Math.min(Math.max(10,width-100)/layout.paper.widthMm,Math.max(10,height-80)/layout.paper.heightMm)))});}
function enterSpace(space,layoutId=null,viewportId=null){if(documentActionBusy||!editor.setSpace)return;flushViewportNavigation();editor.cancel();orbitMode=null;orbitPivot=null;drag=null;pointer=null;rawPointer=null;snap=null;selectedSubobject=null;overlapCycle=null;selectedViewportId=viewportId;viewportNavigationDraft=null;const result=editor.setSpace(space,layoutId,viewportId);if(result?.ok===false){resultLog(result);return;}update();canvas.focus();}
function viewportBounds(viewport){const frame=viewport.frame,a=paperToScreen({x:frame.x,y:frame.y+frame.height}),b=paperToScreen({x:frame.x+frame.width,y:frame.y});return{left:a.x,top:a.y,width:b.x-a.x,height:b.y-a.y};}
function viewportBoundary(viewport){return geometry.viewportBoundaryPoints?geometry.viewportBoundaryPoints(viewport):viewport.boundary||framePoints(viewport.frame);}
function tracePaperBoundary(points){if(!points.length)return;const screen=points.map(paperToScreen);ctx.beginPath();ctx.moveTo(screen[0].x,screen[0].y);for(const point of screen.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();}
function viewportAt(screen,edgeOnly=false){const layout=currentLayout();if(!layout)return null;const point=screenToPaper(screen),tolerance=8/paperView().scale;return[...layout.viewports].reverse().find(viewport=>{if(!geometry.isEntityVisible({layoutId:layout.id,layer:viewport.layer||'0'},state(),{space:'paper',layoutId:layout.id,viewportId:null}))return false;const boundary=viewportBoundary(viewport),nearEdge=boundary.some((a,index)=>{const b=boundary[(index+1)%boundary.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)<=tolerance;});return edgeOnly?nearEdge:geometry.pointInViewport?geometry.pointInViewport(point,viewport):nearEdge||point.x>=viewport.frame.x&&point.x<=viewport.frame.x+viewport.frame.width&&point.y>=viewport.frame.y&&point.y<=viewport.frame.y+viewport.frame.height;})||null;}
function viewportObject(viewport){return editor.getPaperObjects?.(currentLayout()?.id).find(object=>object.type==='VIEWPORT'&&object.viewportId===viewport?.id)||null;}
function selectCreatedViewport(viewportId){selectedViewportId=viewportId||currentLayout()?.viewports.at(-1)?.id||null;const object=viewportObject(currentLayout()?.viewports.find(viewport=>viewport.id===selectedViewportId));if(object)editor.select([object.id]);}
function framePoints(frame){return[{x:frame.x,y:frame.y},{x:frame.x+frame.width,y:frame.y},{x:frame.x+frame.width,y:frame.y+frame.height},{x:frame.x,y:frame.y+frame.height}];}
function renderSpaceTabs(){
  const bar=$('layout-tabs');bar.replaceChildren();const add=(name,id)=>{const button=document.createElement('button');button.className='layout-tab';button.textContent=name;button.setAttribute('role','tab');button.setAttribute('aria-selected',String((state().activeLayoutId||null)===id));button.dataset.layout=id||'model';button.addEventListener('click',()=>enterSpace(id?'paper':'model',id));button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const tabs=[...bar.children],next=tabs[(tabs.indexOf(button)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next.click();next.focus();}});bar.append(button);};add('Model',null);for(const layout of state().layouts||[])add(layout.name,layout.id);
  const layout=currentLayout(),viewport=selectedViewport();$('page-setup-button').textContent=layout?'Page setup':'New layout';$('new-viewport-button').hidden=!layout;$('viewport-shape-control').hidden=!layout;$('viewport-lock-button').hidden=!viewport;$('viewport-scale-control').hidden=!viewport;$('viewport-view-control').hidden=!viewport;$('viewport-lock-button').textContent=viewport?.locked?'Viewport locked':'Viewport unlocked';$('viewport-lock-button').setAttribute('aria-pressed',String(Boolean(viewport?.locked)));$('viewport-lock-button').title=viewport?.locked?'Unlock to change viewport scale. Wheel and middle drag navigate the sheet while locked.':'Unlocked: wheel and middle drag change this model view. Lock after setting the scale.';if(viewport){populateViewportScalePicker($('viewport-scale'),viewport);$('viewport-view').value=viewport.workspace==='2d'?'top':['top','front','right','left','back','bottom','iso'].includes(viewport.camera3d.mode)?viewport.camera3d.mode:'iso';}
  $('space-mode-button').textContent=currentViewport()?'VIEWPORT MODEL':paperSpace()?'PAPER · mm':'MODEL';$('space-mode-button').title=currentViewport()?'Return to paper space':layout?'Enter selected viewport model space':'Standalone model space';
}
function showPageSetup(create=false){if(documentActionBusy||!editor.addLayout)return;flushViewportNavigation();closePalettes();hideCompletion();editor.cancel();const layout=create?null:currentLayout();pageSetupLayoutId=layout?.id||null;const sizes=geometry.PAPER_SIZES||{};fillOptions('layout-paper-size',Object.keys(sizes),layout?.paper.size||'A3');for(const option of $('layout-paper-size').options){const p=sizes[option.value];option.textContent=`${option.value} · ${p.widthMm} × ${p.heightMm} mm`;}$('layout-name-input').value=layout?.name||`Layout ${(state().layouts?.length||0)+1}`;$('layout-orientation').value=layout?.paper.orientation||'landscape';$('page-setup-title').textContent=layout?'Page setup':'Create paper layout';$('page-setup-error').textContent='';refreshPageSetup();$('page-setup-dialog').showModal();}
function refreshPageSetup(){const paper=geometry.PAPER_SIZES?.[$('layout-paper-size').value];if(!paper)return;const[w,h]=$('layout-orientation').value==='portrait'?[paper.widthMm,paper.heightMm]:[paper.heightMm,paper.widthMm];$('layout-paper-preview').textContent=`${w} × ${h} millimeters · paper coordinates stay independent of the model`;} 
function closePageSetup(){$('page-setup-dialog').close();finishDialogReload();canvas.focus();}
function updateSelectedViewport(patch){flushViewportNavigation();const layout=currentLayout(),viewport=selectedViewport();return layout&&viewport?editor.updateViewport(layout.id,viewport.id,patch):{ok:false,message:'Select a viewport frame first.'};}
function viewportScalePreference(){return ['in','ft'].includes(state().settings.units)?'architectural':'ratios';}
function viewportScaleMatch(value){return geometry.matchViewportScale(value,{preferredGroup:viewportScalePreference()});}
function viewportScaleLabel(value){return geometry.formatViewportScale(value,{preferredGroup:viewportScalePreference()});}
function viewportScaleOptionValue(scale){return scale.groupId==='ratios'&&scale.label.startsWith('1:')?String(scale.scaleDenominator):scale.id;}
function viewportScaleDescription(value){const unit=state().settings.units,unitLabel=unit==='unitless'?'unitless; treated as mm':unit;return `1 model unit (${unitLabel}) = ${format(geometry.modelUnitMillimeters(state().settings)/value,6)} mm on paper.`;}
function populateViewportScalePicker(select,viewport){
  if(!select.dataset.scaleCatalog){
    select.replaceChildren();const current=document.createElement('option');current.value='current-custom';current.disabled=true;current.hidden=true;select.append(current);
    for(const group of geometry.VIEWPORT_SCALE_GROUPS){const section=document.createElement('optgroup');section.label=group.label;for(const scale of group.scales){const option=document.createElement('option');option.value=viewportScaleOptionValue(scale);option.textContent=scale.label;option.dataset.scaleId=scale.id;option.title=`Physical denominator: ${String(scale.scaleDenominator)}`;section.append(option);}select.append(section);}
    const custom=document.createElement('option');custom.value='custom';custom.textContent='Custom scale…';select.append(custom);select.dataset.scaleCatalog='ready';
  }
  const current=select.querySelector('option[value="current-custom"]'),match=viewportScaleMatch(viewport.scaleDenominator);current.hidden=Boolean(match);current.textContent=`Custom · 1:${String(viewport.scaleDenominator)}`;select.value=match?viewportScaleOptionValue(match):'current-custom';select.disabled=Boolean(viewport.locked);select.title=`${viewport.locked?'Unlock to change viewport scale. ':''}Viewport scale: ${viewportScaleLabel(viewport.scaleDenominator)}. Exact denominator: ${String(viewport.scaleDenominator)}. ${viewportScaleDescription(viewport.scaleDenominator)}`;
}
function viewportScaleChoice(select){
  const value=select.value;flushViewportNavigation();if(value==='custom'){showViewportScaleDialog();return;}
  const item=geometry.getViewportScale(value);setViewportScale(item?.scaleDenominator??value);
}
function setViewportScale(value,{target=null}={}){
  const viewport=target?state().layouts.find(layout=>layout.id===target.layoutId)?.viewports.find(viewport=>viewport.id===target.viewportId):selectedViewport();if(viewport?.locked){const result={ok:false,message:'Unlock the viewport before changing its scale.'};$('viewport-scale-error').textContent=result.message;return resultLog(result);}
  let scaleDenominator;try{scaleDenominator=geometry.parseViewportScale(value);}catch(error){const result={ok:false,message:error.message||'Enter a valid viewport scale.'};$('viewport-scale-error').textContent=result.message;return resultLog(result);}
  const result=resultLog(target?editor.updateViewport(target.layoutId,target.viewportId,{scaleDenominator}):updateSelectedViewport({scaleDenominator}));if(result?.ok===false)$('viewport-scale-error').textContent=result.message;return result;
}
function showViewportScaleDialog(){
  flushViewportNavigation();const viewport=selectedViewport(),layout=currentLayout();if(!viewport||!layout)return;if(viewport.locked){toast('Unlock the viewport before changing its scale.');renderSpaceTabs();return;}viewportScaleTarget={layoutId:layout.id,viewportId:viewport.id};$('viewport-custom-scale').value=String(viewport.scaleDenominator);$('viewport-scale-context').textContent=`${layout.name} · ${currentViewport()?.id===viewport.id?'active model viewport':'selected viewport frame'} · unlocked`;$('viewport-scale-error').textContent='';refreshViewportScalePreview();renderSpaceTabs();$('viewport-scale-dialog').showModal();$('viewport-custom-scale').focus();$('viewport-custom-scale').select();
}
function refreshViewportScalePreview(){
  try{const value=geometry.parseViewportScale($('viewport-custom-scale').value),label=viewportScaleLabel(value);$('viewport-scale-preview').textContent=`${label}${label===`1:${String(value)}`?'':` · 1:${String(value)}`}\n${viewportScaleDescription(value)}`;$('viewport-scale-preview').dataset.valid='true';$('viewport-scale-error').textContent='';}
  catch(error){$('viewport-scale-preview').textContent=error.message||'Enter a viewport scale.';$('viewport-scale-preview').dataset.valid='false';}
}
function closeViewportScaleDialog(){$('viewport-scale-dialog').close();viewportScaleTarget=null;update();finishDialogReload();canvas.focus();}
function viewportScaleProperty(viewport){const row=propertyRow('Standard scale',''),select=document.createElement('select');select.id='viewport-properties-scale';select.setAttribute('aria-label','Viewport standard scale');populateViewportScalePicker(select,viewport);select.addEventListener('change',()=>viewportScaleChoice(select));row.classList.add('viewport-scale-property');row.lastElementChild.replaceWith(select);return row;}
function setViewportView(name){flushViewportNavigation();const viewport=selectedViewport();if(!viewport)return{ok:false,message:'Select a viewport frame first.'};const camera=view3d.cameraPreset({...viewport.camera3d,target:{...viewport.modelCenter},projection:'orthographic'},name);return updateSelectedViewport({workspace:'3d',camera3d:camera});}
function panSheetOrViewport(dx,dy){const viewport=currentViewport();if(!viewport||viewport.locked){setPaperView(pan(paperView(),dx,dy));return;}const camera=viewport.workspace==='3d'?viewport.camera3d:view3d.cameraPreset(viewport.camera3d,'top'),axes=view3d.cameraBasis(camera),scale=viewScale(),center=viewport.modelCenter;const modelCenter={x:center.x-axes.right.x*dx/scale+axes.up.x*dy/scale,y:center.y-axes.right.y*dx/scale+axes.up.y*dy/scale,z:(center.z||0)-axes.right.z*dx/scale+axes.up.z*dy/scale};viewportNavigationDraft={...viewport,modelCenter,camera3d:{...viewport.camera3d,target:{...modelCenter}}};}
function zoomSheetOrViewport(factor,screen){const viewport=currentViewport();if(!viewport||viewport.locked){setPaperView(zoomAt(paperView(),factor,screen,width,height));return;}const paper=screenToPaper(screen),before=geometry.viewportPaperToModel(paper,viewport,state().settings),scaleDenominator=Math.max(1e-6,Math.min(1e9,viewport.scaleDenominator/factor)),changed={...viewport,scaleDenominator},after=geometry.viewportPaperToModel(paper,changed,state().settings),modelCenter={x:viewport.modelCenter.x+before.x-after.x,y:viewport.modelCenter.y+before.y-after.y,z:(viewport.modelCenter.z||0)+before.z-after.z};viewportNavigationDraft={...viewport,scaleDenominator,modelCenter,camera3d:{...viewport.camera3d,target:{...modelCenter}}};clearTimeout(viewportNavigationTimer);viewportNavigationTimer=setTimeout(()=>{flushViewportNavigation();update();},150);}
function flushViewportNavigation(){
  clearTimeout(viewportNavigationTimer);viewportNavigationTimer=null;
  if(viewportFrameRequest!==null){cancelAnimationFrame(viewportFrameRequest);viewportFrameRequest=null;const screen=viewportPointerScreen;viewportPointerScreen=null;if(screen){const rect=canvas.getBoundingClientRect();pointerPosition({clientX:rect.left+screen.x,clientY:rect.top+screen.y});}}
  const draft=viewportNavigationDraft;if(!draft)return{ok:true};viewportNavigationDraft=null;
  const result=editor.updateViewport(currentLayout()?.id,draft.id,{modelCenter:draft.modelCenter,scaleDenominator:draft.scaleDenominator},{navigation:true});if(result?.ok===false)toast(result.message);syncDesktop();scheduleDevelopmentCheckpoint();return result;
}
function scheduleViewportFrame(screen){viewportPointerScreen={...screen};if(viewportFrameRequest!==null)return;viewportFrameRequest=requestAnimationFrame(()=>{viewportFrameRequest=null;const point=viewportPointerScreen;viewportPointerScreen=null;updateModelControls();renderSpaceTabs();if(point){const rect=canvas.getBoundingClientRect();pointerPosition({clientX:rect.left+point.x,clientY:rect.top+point.y});}draw();});}
function renderViewportProperties(){
  const viewport=selectedViewport(),layout=currentLayout(),object=viewportObject(viewport),box=$('properties-content');box.replaceChildren();$('selection-count').textContent='Viewport frame selected';
  box.append(propertyRow('Object','Model viewport'),propertyRow('Layout',layout.name),propertyRow('Boundary',viewport.boundary?'Closed polygon':'Rectangle'),propertyRow('Paper units','mm'));
  box.append(styleProperty('Frame layer',state().layers.map(layer=>layer.name),viewport.layer||'0','Viewport frame layer',layer=>updateSelectedViewport({layer})));
  const colorRow=propertyRow('Frame color',''),color=document.createElement('input');color.type='color';color.value=viewport.color||layerFor(viewport)?.color||'#e5e7eb';color.setAttribute('aria-label','Viewport frame color');color.addEventListener('change',()=>resultLog(editor.setSelectionProperties({color:color.value})));const colorGroup=document.createElement('span'),byLayer=document.createElement('button');byLayer.textContent='By layer';byLayer.className='property-button';byLayer.setAttribute('aria-label','Viewport frame color by layer');byLayer.addEventListener('click',()=>resultLog(editor.setSelectionProperties({color:'BYLAYER'})));colorGroup.className='viewport-color-field';colorGroup.append(color,byLayer);colorRow.lastElementChild.replaceWith(colorGroup);box.append(colorRow);
  box.append(styleProperty('Lineweight',['BYLAYER',0,.13,.18,.25,.35,.5,.7,1],String(viewport.lineweight??'BYLAYER'),'Viewport frame lineweight',value=>editor.setSelectionProperties({lineweight:value==='BYLAYER'?'BYLAYER':Number(value)})),styleProperty('Linetype',['BYLAYER',...(geometry.LINETYPES||[])],viewport.linetype||'BYLAYER','Viewport frame linetype',linetype=>editor.setSelectionProperties({linetype})));
  for(const[key,label]of [['x','X'],['y','Y'],['width','Width'],['height','Height']])box.append(numberProperty(label,viewport.frame[key],`Viewport frame ${label}`,value=>updateSelectedViewport({frame:{...viewport.frame,[key]:value}}),{kind:'length',...(['width','height'].includes(key)?{min:0}:{})}));
  if(viewport.boundary&&object){const index=Math.min(gripPropertyIndices.get(object.id)||0,viewport.boundary.length-1);gripPropertyIndices.set(object.id,index);const row=propertyRow('Edit boundary',''),choose=document.createElement('select');choose.setAttribute('aria-label','Viewport boundary vertex');viewport.boundary.forEach((point,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Vertex ${i+1}`;choose.append(option);});choose.value=index;choose.addEventListener('change',()=>{gripPropertyIndices.set(object.id,Number(choose.value));renderProperties();draw();});row.lastElementChild.replaceWith(choose);box.append(row);pointProperties(box,'Viewport vertex',viewport.boundary[index],point=>editor.moveGrip(object.id,index,point));}
  const scaleField=numberProperty('Scale 1:',viewport.scaleDenominator,'Viewport scale denominator',scaleDenominator=>updateSelectedViewport({scaleDenominator}),{min:.000001});scaleField.querySelector('input').disabled=Boolean(viewport.locked);scaleField.querySelector('input').title=viewport.locked?'Unlock to change viewport scale.':`Exact physical scale denominator: ${String(viewport.scaleDenominator)}`;box.append(subheading('MODEL VIEW ON PAPER'),viewportScaleProperty(viewport),scaleField);
  const scaleNote=document.createElement('p');scaleNote.className='viewport-scale-note';scaleNote.textContent=`${viewport.locked?'Unlock the viewport to change its scale. ':''}${viewportScaleDescription(viewport.scaleDenominator)} Annotation styles are set separately.`;box.append(scaleNote);
  box.append(styleProperty('View',['top','front','right','left','back','bottom','iso'],viewport.workspace==='2d'?'top':viewport.camera3d.mode,'Viewport orientation',setViewportView),styleProperty('Navigation',['Locked','Unlocked'],viewport.locked?'Locked':'Unlocked','Viewport navigation lock',value=>updateSelectedViewport({locked:value==='Locked'})),styleProperty('Print border',['No','Yes'],viewport.plotBorder?'Yes':'No','Plot viewport border',value=>updateSelectedViewport({plotBorder:value==='Yes'})));
  for(const axis of ['x','y','z'])box.append(numberProperty(`Model center ${axis.toUpperCase()}`,viewport.modelCenter[axis]||0,`Viewport model center ${axis.toUpperCase()}`,value=>updateSelectedViewport({modelCenter:{...viewport.modelCenter,[axis]:value}}),{kind:'length',prefs:state().settings}));
  const deleteRow=propertyRow('Frame',''),remove=document.createElement('button');remove.className='property-button';remove.textContent='Delete viewport';remove.setAttribute('aria-label','Delete selected viewport');remove.addEventListener('click',()=>resultLog(editor.deleteSelected()));deleteRow.lastElementChild.replaceWith(remove);box.append(deleteRow);
}
function fitModelViewport(viewport){if(viewport.locked){fitPaper();return;}const points=modelPoints(modelEntities());if(!points.length)return;const camera=viewport.workspace==='2d'?view3d.cameraPreset({...viewport.camera3d,target:{...viewport.modelCenter}},'top'):{...viewport.camera3d,target:{...viewport.modelCenter}},axes=view3d.cameraBasis(camera),bounds=view3d.bounds3D(points),center={x:bounds.min.x/2+bounds.max.x/2,y:bounds.min.y/2+bounds.max.y/2,z:bounds.min.z/2+bounds.max.z/2};let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const p of points){const delta={x:p.x-center.x,y:p.y-center.y,z:(p.z||0)-center.z},x=view3d.dot3(delta,axes.right),y=view3d.dot3(delta,axes.up);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}const factor=geometry.modelUnitMillimeters(state().settings),scaleDenominator=Math.max(1e-6,Math.min(1e9,Math.max((maxX-minX)*factor/viewport.frame.width,(maxY-minY)*factor/viewport.frame.height)*1.1));resultLog(editor.updateViewport(currentLayout().id,viewport.id,{modelCenter:center,scaleDenominator},{navigation:true}));}
function updateStatus() {
  const readoutPoint=modelWorkspace()&&pointer?geometry.worldToPlane(pointer,activePlane()):pointer;
  $('coordinate-readout').textContent=modelWorkspace()&&pointerUnavailable&&!pointer?'Pointer unavailable · type UCS XYZ':`${modelWorkspace()?'UCS ':''}X ${lengthFormat(readoutPoint?.x||0)}   Y ${lengthFormat(readoutPoint?.y||0)}${modelWorkspace()||readoutPoint?.z!==undefined?`   Z ${lengthFormat(readoutPoint?.z??0)}`:''}`;
  const prefs=draftingSettings(),unitLabel={unitless:'Unitless',mm:'mm',cm:'cm',m:'m',in:'in',ft:'ft'}[prefs.units]||'Units',formatLabel={decimal:'Decimal',architectural:'Architectural',engineering:'Engineering'}[prefs.linearFormat]||'Decimal';$('units-button').textContent=`${unitLabel} · ${formatLabel}`;$('units-button').title=`Drawing units: ${unitLabel}, ${formatLabel}; angles ${prefs.angularFormat||'decimal-degrees'}. Open UNITS to change this drawing.`;
  $('zoom-readout').textContent=currentLayout()?`${format(paperView().scale,3)} px/mm${currentViewport()?` · ${viewportScaleLabel(currentViewport().scaleDenominator)}`:''}`:modelWorkspace()?`${format(view3d.pixelScale(camera3D(),height),3)} px/unit at target`:`${format(state().viewport.scale,3)} px/unit`;
  $('zoom-readout').title=currentViewport()?`Actual viewport scale: ${viewportScaleLabel(currentViewport().scaleDenominator)} · exact denominator ${String(currentViewport().scaleDenominator)}. ${viewportScaleDescription(currentViewport().scaleDenominator)}`:modelWorkspace()?`${camera3D().projection}; yaw ${format(camera3D().yaw,2)}°, pitch ${format(camera3D().pitch,2)}°, roll ${format(camera3D().roll,2)}°; eye distance ${format(camera3D().distance)}`:'';
  for(const [id,enabled] of [['grid-toggle',gridEnabled],['snap-toggle',snapEnabled],['ortho-toggle',orthoEnabled]]){const button=$(id);button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled));}
  const tip=$('snap-indicator');tip.hidden=!snap||!state().command;
  if(snap&&state().command){const p=toScreen(snap.point);tip.style.left=`${Math.min(p.x+15,width-100)}px`;tip.style.top=`${Math.min(p.y+15,height-25)}px`;tip.textContent=snap.type;}
}
function update() {
  if(state().settings){gridEnabled=state().settings.gridEnabled;snapEnabled=state().settings.snapEnabled;orthoEnabled=state().settings.orthoEnabled;}
  $('command-prompt').textContent=currentPrompt();
  const phase=state().commandPhase;
  const placeholders={selection:'Select objects, then Enter…',mode:'Single or Multiple…',angle:'Angle in drawing input units or point…',rotation:'Rotation in drawing angle input units…',height:'Positive text height…',text:'Text content…',position:'Text insertion point…','first-corner':'First text-box corner…','second-corner':'Opposite text-box corner…','mtext-height':'Positive text height…','origin-first':'First dimension origin…','origin-second':'Second dimension origin…',placement:'Dimension placement…',distance:'Positive offset distance…',factor:'Positive scale factor…',object:'Pick a source object…','delete-choice':'Yes / No; Enter keeps sources…','clipboard-ready':'Writing drawing clipboard…','first-break':'First break point…','second-break':'Second break point…','arc-first':'Arc start point…','arc-second':'Point on the arc…','arc-third':'Arc end point…'};
  Object.assign(placeholders,{'viewport-polygon':'Next paper vertex · C closes · U undoes…','viewport-object':'Pick a closed paper polyline or rectangle…','join-selection':'Select additional paths, then Enter…','axis-first':'First axis endpoint or Center (C)…','axis-second':'Other endpoint of first axis…','ellipse-center':'Ellipse center…','major-endpoint':'First-axis endpoint…','minor-distance':'Other-axis distance or point…','control-point':'Next cubic control vertex or Enter…',vertex:'Angle vertex…','ray-first':'Point on first angle ray…','ray-second':'Point on second angle ray…','window-first':'First crossing-window corner…','window-second':'Opposite crossing-window corner…','block-base':'Block base point…',boundary:'Pick one closed boundary edge…','first-line':'Pick first retained line side…','second-line':'Pick second retained line side…'});
  input.placeholder=placeholders[phase]||(phase==='radius'?(state().commandData?.diameter?'Diameter or point…':'Radius or point…'):state().commandData?.targetKind==='object'?'Pick a line near the part to edit…':state().command?'X,Y or @offset…':'Type a command or coordinate…');
  if(state().commandData?.targetKind==='none'&&!['view-vector','plan-choice'].includes(phase))input.placeholder='Enter the requested value or option…';
  if(phase==='zoom-option')input.placeholder='Extents (E) or paper-mm/model-unit factorXP…';
  if(modelWorkspace()&&(state().commandData?.threeD||state().commandData?.spatial))input.placeholder=phase==='height'?'Signed nonzero height…':phase==='axis'?'World axis X / Y / Z…':'X,Y,Z or @offset…';
  if(phase==='view-vector')input.placeholder='Viewing vector X,Y,Z…';if(phase==='plan-choice')input.placeholder='Current UCS (Enter) or World (W)…';
  $('command-state').textContent=state().command || (orbitMode?orbitMode==='free'?'3DFORBIT':'3DORBIT':panTool?'PAN':'Ready');
  $('document-name').textContent=documentName;$('dirty-mark').textContent=isDirty()?'•':'';
  $('undo-button').disabled=Boolean(orbitMode)||!editor.canUndo;$('redo-button').disabled=Boolean(orbitMode)||!editor.canRedo;$('delete-button').disabled=Boolean(orbitMode)||!state().selectionIds.length;
  $('entity-count').textContent=`${activeObjects().length} object${activeObjects().length===1?'':'s'}`;
  document.querySelectorAll('[data-tool]').forEach(button=>button.classList.toggle('active',button.dataset.tool===(state().command || (panTool?'PAN':'SELECT'))));
  canvas.style.cursor=panTool||orbitMode||['pan','orbit'].includes(drag?.mode)?'grabbing':'none';
  const notes={selection:'Select objects • Enter to continue',mode:'Enter Single or Multiple',angle:`Enter an angle (${state().settings?.angularInputUnit||'degrees'}) or click a direction`,distance:'Enter a positive offset distance',factor:'Enter a positive scale factor or pick a distance',object:state().command?.startsWith('DIM')?'Pick the circle to dimension':'Pick a source object • Enter to finish',position:'Pick or enter a text insertion point',height:'Enter text height • Enter uses the style default',rotation:'Enter text rotation • Enter uses the style default','first-corner':'Pick or enter the first text-box corner','second-corner':'Pick opposite corner • H to change text height','mtext-height':'Enter the multiline text height','origin-first':'Pick or enter the first dimension origin','origin-second':'Pick or enter the second dimension origin',placement:state().command==='DIMLINEAR'?'Place dimension • H / V chooses its axis':'Pick or enter the dimension placement','delete-choice':'Delete sources? Yes / No • Enter keeps them','clipboard-ready':'Writing drawing clipboard…','first-break':'Pick or enter the first break point','second-break':'Pick or enter the second break point','arc-first':'Pick or enter the arc start point','arc-second':'Pick or enter a point on the arc','arc-third':'Pick or enter the arc end point'};
  Object.assign(notes,{'join-selection':'Select connected additional paths • Enter joins them','axis-first':'Pick first axis endpoint • C chooses center construction','axis-second':'Pick the other first-axis endpoint','ellipse-center':'Pick the ellipse center','major-endpoint':'Pick the first-axis endpoint','minor-distance':'Enter a positive other-axis distance or pick a point','control-point':'Place control vertices • at least four • U removes the latest • Enter finishes',vertex:'Pick the angle vertex','ray-first':'Pick a point on the first angle ray','ray-second':'Pick a point on the second angle ray','window-first':'Pick the first corner of a planar crossing window','window-second':'Pick its opposite corner • enclosed vertices will stretch','block-base':'Pick the base used for block insertion',boundary:'Pick one closed boundary edge to capture the hatch region','first-line':'Pick the first LINE on the side to retain','second-line':'Pick the second LINE on the side to retain'});
  $('canvas-note').textContent=notes[phase]||(state().commandData?.targetKind==='object'?'Pick the line portion to edit • U to undo • Enter to finish':state().command?'Click a point or enter exact coordinates':state().selectionIds.length?'Drag a blue grip to edit • Delete to erase':'Type a command or choose a drawing tool');
  if(phase==='viewport-polygon')$('canvas-note').textContent='Pick paper vertices • C closes the polygon • U removes a vertex';else if(phase==='viewport-object')$('canvas-note').textContent='Pick an edge of a closed paper polyline or rectangle';else if(!state().command&&paperSpace()&&selectionObjects().length===1&&selectedViewport())$('canvas-note').textContent=selectedViewport().boundary?'Drag a vertex or edge grip • Double-click inside to edit model space':'Corner grips resize both sides • Edge grips resize one side • Double-click inside to edit model space';else if(!state().command&&currentViewport())$('canvas-note').textContent=currentViewport().locked?'Locked view: wheel and middle drag navigate the sheet • Double-click outside returns to paper':'Wheel zooms at the cursor • Middle drag pans this view • Double-click outside returns to paper';
  if(state().commandData?.targetKind==='none'&&phase!=='selection')$('canvas-note').textContent='Enter the requested value or option in the command line';
  if(phase==='zoom-option')$('canvas-note').textContent='E fits the view • factorXP sets an unlocked viewport • XP uses paper mm per model unit';
  if(modelWorkspace()){if(orbitMode)$('canvas-note').textContent=orbitMode==='free'?'Drag inside the arcball to orbit • outside to roll • Enter or Esc exits':'Drag horizontally / vertically to orbit • Shift allows free orbit • Enter or Esc exits';else if(phase==='height'&&['BOX','CYLINDER','EXTRUDE'].includes(state().command))$('canvas-note').textContent='Type a signed height or place it along the active plane normal';else if(phase==='first-corner'&&state().command==='BOX')$('canvas-note').textContent='Pick the first corner on the active UCS plane or type UCS XYZ';else if(phase==='opposite-corner')$('canvas-note').textContent='Pick the opposite corner in the active plane or type UCS XYZ';else if(phase==='axis')$('canvas-note').textContent='Enter world rotation axis X, Y or Z';else if(phase==='view-vector')$('canvas-note').textContent='Enter a nonzero viewing vector X,Y,Z';else if(phase==='plan-choice')$('canvas-note').textContent='Enter for Current UCS plan • W chooses World';else if(!state().command&&!state().selectionIds.length)$('canvas-note').textContent='Shift + middle drag orbits • Ctrl + Shift + middle drag rotates freely';}
  if(selectedSubobject&&!state().command)$('canvas-note').textContent=`${selectedSubobject.kind} selected • drag orange grip / edit world coordinates • Shift+F1 Whole object`;else if(modelWorkspace()&&subobjectMode!=='whole'&&!state().command)$('canvas-note').textContent=`Pick mesh ${subobjectMode}s • Ctrl+Space cycles obscured candidates • Shift+F1–F4 filters • Esc clears`;
  if(!state().command&&!orbitMode&&selectionObjects().some(architectureOwner))$('canvas-note').textContent='Generated architecture selected • Edit architectural source in Properties';
  if(state().command)hideCompletion();
  renderSpaceTabs();renderLayerManager();renderProperties();refreshArchitectureSummary();if(orbitMode)$('properties-content').querySelectorAll('input,select,button').forEach(field=>field.disabled=true);renderLayers();if(orbitMode)$('layers-list').querySelectorAll('input,select,button').forEach(field=>field.disabled=true);renderBlockLibrary();updateModelControls();updateStatus();draw();syncDesktop();scheduleDevelopmentCheckpoint();maybeAnnotationEditor();
}

function canvasPosition(event) {const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
function pointerPosition(event) {
  rawPointer=canvasPosition(event);pointer=toWorld(rawPointer);snap=null;pointerScalar=null;pointerUnavailable=null;
  if(modelWorkspace()){
    if(drag?.mode==='grip'||drag?.mode==='subobject-grip'){const entity=activeEntities().find(e=>e.id===drag.entityId),point=drag.mode==='subobject-grip'?drag.startPoint:pointsOf(entity)[drag.index],curvePlane=spatialCurve(entity)?{xAxis:entity.xAxis,yAxis:entity.yAxis,normal:view3d.cross3(entity.xAxis,entity.yAxis)}:null,plane={...(curvePlane||activePlane()),origin:point};pointer=geometry.intersectPlaneRay(view3d.screenRay(rawPointer,camera3D(),width,height),plane);}
    else if(state().commandPhase==='height'&&['BOX','CYLINDER','EXTRUDE'].includes(state().command)){const base=state().commandData.heightBase,direction=state().commandData.heightDirection||{x:0,y:0,z:1};pointerScalar=view3d.heightAlongAxis(rawPointer,base,direction,camera3D(),width,height);pointer=pointerScalar===null?null:{x:base.x+direction.x*pointerScalar,y:base.y+direction.y*pointerScalar,z:base.z+direction.z*pointerScalar};if(pointerScalar===null)pointerUnavailable='Height normal is aligned with the view; type a height.';}
    else if(state().commandData?.targetKind==='object'||selectingObjects())pointer=projectedPick(rawPointer,state().commandData?.targetKind==='object'&&!selectingObjects()?visibleEntities():selectableEntities())?.point||pointer;
    if(!pointer&&!pointerUnavailable)pointerUnavailable='Active plane is edge-on; choose Plan or type UCS coordinates.';
  }else if(drag?.mode==='grip'){const entity=activeObjects().find(e=>e.id===drag.entityId);if(entity&&is3DEntity(entity))pointer.z=pointsOf(entity)[drag.index].z;}
  const anchor=state().commandPoints?.at(-1);
  if(pointer&&orthoEnabled&&anchor&&['LINE','PLINE','3DPOLY','MOVE','COPY','MIRROR','STRETCH'].includes(state().command)&&!['selection','window-first','window-second'].includes(state().commandPhase)) {
    if(state().command==='3DPOLY'||state().commandData?.threeD){const plane=state().commandData?.plane||activePlane(),local=geometry.worldToPlane(pointer,plane),base=geometry.worldToPlane(anchor,plane),axes=['x','y','z'].sort((a,b)=>Math.abs(local[b]-base[b])-Math.abs(local[a]-base[a]));pointer=geometry.planeToWorld({...base,[axes[0]]:local[axes[0]]},plane);}
    else if(Math.abs(pointer.x-anchor.x)>=Math.abs(pointer.y-anchor.y))pointer={...pointer,y:anchor.y};
    else pointer={...pointer,x:anchor.x};
  }
  if(snapEnabled&&drag?.mode!=='orbit'&&!orbitMode&&pointerScalar===null&&((state().command&&state().commandData?.targetKind!=='object'&&state().commandData?.targetKind!=='none'&&!['selection','join-selection','window-first','window-second','mode','object','axis','view-vector','plan-choice','height','angle','distance','delete-choice','clipboard-ready'].includes(state().commandPhase))||drag?.mode==='grip')){
    snap=modelWorkspace()||currentViewport()?projectedSnap(rawPointer):pointer?findSnap(visibleObjects().filter(e=>e.id!==drag?.entityId),pointer,10/viewScale(),state()):null;
    if(snap)pointer={...snap.point};
  }
  updateStatus();if(modelWorkspace())$('construction-plane-label').textContent=pointerUnavailable||`Pointer: ${planeLabel()}`;
}
function gripAt(screen) {
  let best=null;const meshes=visibleEntities().filter(e=>e.type==='MESH');for(const entity of selectableObjects().filter(e=>!architectureOwner(e)&&state().selectionIds.includes(e.id))){const points=pointsOf(entity);for(let index=0;index<points.length;index++){const p=toScreen(points[index]),distance=Math.hypot(p.x-screen.x,p.y-screen.y),depth=modelWorkspace()?p.depth:points[index].z??0;if(distance>8||p.clipped||!insideActiveViewport(p)||modelWorkspace()&&camera3D().renderMode==='shaded'&&view3d.pointOccluded(points[index],meshes,camera3D(),width,height))continue;if(!best||distance<best.distance-1e-6||Math.abs(distance-best.distance)<1e-6&&depth>best.depth)best={entityId:entity.id,index,distance,depth};}}return best;
}
function meshIndexEdges(entity){const edges=new Map();for(const face of entity.faces)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=a<b?`${a}:${b}`:`${b}:${a}`;if(!edges.has(key))edges.set(key,[a,b]);}return[...edges.values()];}
function subobjectCenter(entity,indices){return indices.reduce((point,index)=>({x:point.x+entity.vertices[index].x/indices.length,y:point.y+entity.vertices[index].y/indices.length,z:point.z+entity.vertices[index].z/indices.length}),{x:0,y:0,z:0});}
function setSubobjectMode(mode){subobjectMode=mode;selectedSubobject=null;gripPropertyIndices.clear();$('selection-mode').value=mode;update();}
function subobjectCandidates(screen,{includeOccluded=false}={}){
  if(!insideActiveViewport(screen))return[];
  const meshes=selectableEntities().filter(entity=>entity.type==='MESH'&&!architectureOwner(entity)),camera=camera3D(),candidates=new Map(),ray=subobjectMode==='face'?view3d.screenRay(screen,camera,width,height):null;
  const add=pick=>{if(!Number.isFinite(pick.depth)||!Number.isFinite(pick.distance)||!insideActiveViewport(toScreen(pick.point))||!includeOccluded&&view3d.pointOccluded(pick.point,meshes,camera,width,height))return;const key=`${pick.entityId}:${pick.kind}:${pick.index}`,previous=candidates.get(key);if(!previous||pick.depth>previous.depth)candidates.set(key,pick);};
  for(const entity of meshes){
    if(subobjectMode==='face')for(const triangle of view3d.meshTriangles(entity)){const hit=view3d.intersectTriangle(ray,...triangle.points);if(!hit)continue;const p=toScreen(hit.point);if(p.clipped||!finiteScreenPoint(p))continue;add({entityId:entity.id,index:triangle.faceIndex,indices:[...entity.faces[triangle.faceIndex]],kind:'face',distance:0,depth:p.depth,point:hit.point});}
    else if(subobjectMode==='vertex')entity.vertices.forEach((point,index)=>{const p=toScreen(point),distance=Math.hypot(p.x-screen.x,p.y-screen.y);if(p.clipped||!finiteScreenPoint(p)||distance>10)return;add({entityId:entity.id,index,indices:[index],kind:'vertex',distance,depth:p.depth,point});});
    else if(subobjectMode==='edge')meshIndexEdges(entity).forEach((indices,index)=>{const[a,b]=indices.map(i=>entity.vertices[i]),pa=toScreen(a),pb=toScreen(b);if(!finiteScreenPoint(pa)||!finiteScreenPoint(pb)||pa.clipped||pb.clipped)return;const mask=activeViewportMask(),fragments=mask?clippedSegment(pa,pb,mask):[{a:pa,b:pb,t0:0,t1:1}];let best=null;for(const fragment of fragments){const projected=view3d.projectedSegmentDistance(screen,fragment.a,fragment.b);if(projected.distance>8)continue;const t=camera.projection==='perspective'?projected.t*pa.viewDistance/((1-projected.t)*pb.viewDistance+projected.t*pa.viewDistance):fragment.t0+(fragment.t1-fragment.t0)*projected.t,point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},pick={entityId:entity.id,index,indices,kind:'edge',distance:projected.distance,depth:toScreen(point).depth,point};if(!best||pick.distance<best.distance)best=pick;}if(best)add(best);});
  }
  return[...candidates.values()].sort((a,b)=>b.depth-a.depth||a.distance-b.distance);
}
function subobjectPick(screen){return subobjectCandidates(screen)[0]||null;}
function cycleSubobject(){
  if(subobjectMode==='whole'){cycleOverlap();return;}
  const screen=rawPointer||overlapCycle?.screen;if(!screen)return;const candidates=subobjectCandidates(screen,{includeOccluded:true});if(!candidates.length){toast(`No overlapping mesh ${subobjectMode}s at the cursor.`);return;}
  const previous=selectedSubobject,index=(candidates.findIndex(pick=>pick.entityId===previous?.entityId&&pick.kind===previous.kind&&pick.index===previous.index)+1)%candidates.length;selectSubobject(candidates[index]);addLog(`${subobjectMode} selection ${index+1} of ${candidates.length} at cursor, including obscured subobjects.`,'notice');
}
function selectSubobject(pick){selectedSubobject=pick;selectedViewportId=null;editor.select([pick.entityId]);if(pick.kind==='vertex')gripPropertyIndices.set(pick.entityId,pick.index);update();}
function subobjectGrip(screen){if(!selectedSubobject||selectedSubobject.kind==='vertex')return null;const entity=activeEntities().find(item=>item.id===selectedSubobject.entityId);if(!entity||selectedSubobject.indices.some(index=>!entity.vertices[index]))return null;const point=subobjectCenter(entity,selectedSubobject.indices),p=toScreen(point);return insideActiveViewport(p)&&Math.hypot(p.x-screen.x,p.y-screen.y)<10?{...selectedSubobject,startPoint:point}:null;}
function drawSubobjectSelection(){if(!selectedSubobject||!modelWorkspace())return;const entity=activeEntities().find(item=>item.id===selectedSubobject.entityId);if(!entity?.vertices||selectedSubobject.indices.some(index=>!entity.vertices[index]))return;const points=selectedSubobject.indices.map(index=>toScreen(entity.vertices[index]));if(!points.every(finiteScreenPoint))return;ctx.save();if(currentViewport()){tracePaperBoundary(viewportBoundary(currentViewport()));ctx.clip();}ctx.lineWidth=3;ctx.strokeStyle='#dc965a';ctx.fillStyle='#de98572a';ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));if(selectedSubobject.kind==='face'){ctx.closePath();ctx.fill();}ctx.stroke();const center=toScreen(subobjectCenter(entity,selectedSubobject.indices));ctx.fillStyle='#e4a163';ctx.fillRect(center.x-4,center.y-4,8,8);ctx.restore();}
function overlapPicks(screen){if(!insideActiveViewport(screen))return[];const entities=selectableObjects();if(modelWorkspace())return entities.map(entity=>projectedPick(screen,[entity])).filter(Boolean).sort((a,b)=>b.depth-a.depth).map(pick=>pick.entityId);if(currentViewport())return viewportHitCandidates(screen,entities).reverse().map(entity=>entity.id);const world=toWorld(screen);return world?[...entities].reverse().filter(entity=>hitTest([entity],world,8/viewScale(),drawingContext())).map(entity=>entity.id):[];}
function cycleOverlap(){const screen=rawPointer||overlapCycle?.screen;if(!screen)return;const ids=overlapPicks(screen);if(!ids.length)return;const previous=state().selectionIds[0],index=(ids.indexOf(previous)+1)%ids.length;editor.select([ids[index]]);selectedSubobject=null;subobjectMode='whole';selectedViewportId=null;overlapCycle={screen:{...screen},ids,index};addLog(`Selection ${index+1} of ${ids.length} at cursor.`,'notice');update();}
function eraseCurrentSelection(){if(selectedSubobject){toast('Subobject deletion is unavailable. Choose Whole object to erase the mesh.');return false;}return resultLog(editor.deleteSelected());}
canvas.addEventListener('pointerdown',event=>{
  if(documentActionBusy||event.button!==0&&event.button!==1)return;
  flushViewportNavigation();
  event.preventDefault();canvas.focus({preventScroll:true});pointerPosition(event);canvas.setPointerCapture(event.pointerId);
  if(modelWorkspace()&&(event.button===1&&event.shiftKey||event.button===0&&orbitMode)){
    const previousMode=orbitMode,free=event.ctrlKey&&event.shiftKey||orbitMode==='free'||event.button===0&&event.shiftKey;startOrbit(free?'free':'constrained',rawPointer,{explicit:!camera3D().autoTarget&&Boolean(camera3D().orbitCenter)});drag={mode:'orbit',start:{...rawPointer},last:{...rawPointer},startCamera:structuredClone(camera3D()),free,transient:event.button===1,previousMode,baseMode:previousMode||'constrained'};draw();return;
  }
  if(event.button===1&&!event.shiftKey&&lastMiddleClick&&event.timeStamp-lastMiddleClick.time<350&&Math.hypot(rawPointer.x-lastMiddleClick.screen.x,rawPointer.y-lastMiddleClick.screen.y)<6){lastMiddleClick=null;drag=null;fit();return;}
  if(event.button===1||panTool){drag={mode:'pan',last:{...rawPointer},start:{...rawPointer},middle:event.button===1,moved:false};canvas.style.cursor='grabbing';return;}
  closePalettes();hideCompletion();
  if(currentViewport()&&!geometry.pointInViewport(screenToPaper(rawPointer),currentViewport())){toast('Double-click outside the viewport to return to paper space.');return;}
  if(state().command==='UCS'&&state().commandPhase==='ucs-face'){const pick=projectedPick(rawPointer,visibleEntities()),entity=activeEntities().find(item=>item.id===pick?.entityId),face=entity?.type==='MESH'?view3d.pickMesh(entity,rawPointer,camera3D(),width,height):null;resultLog(face?editor.submitFace(entity.id,face.faceIndex):{ok:false,message:'Pick a visible planar mesh face.'});return;}
  if(!state().command&&modelWorkspace()&&subobjectMode!=='whole'){const picked=projectedPick(rawPointer,selectableEntities()),entity=activeEntities().find(item=>item.id===picked?.entityId);if(architectureOwner(entity)){selectedSubobject=null;editor.select([entity.id]);update();return;}}
  if(!state().command&&modelWorkspace()&&subobjectMode!=='whole'){const grip=subobjectGrip(rawPointer);if(grip){drag={mode:'subobject-grip',...grip,start:{...rawPointer},moved:false};draw();return;}if(subobjectMode==='vertex'&&selectedSubobject?.kind==='vertex'){const point=activeEntities().find(entity=>entity.id===selectedSubobject.entityId)?.vertices[selectedSubobject.index],p=point&&toScreen(point);if(p&&Math.hypot(p.x-rawPointer.x,p.y-rawPointer.y)<9){drag={mode:'grip',entityId:selectedSubobject.entityId,index:selectedSubobject.index};return;}}const pick=subobjectPick(rawPointer);if(pick)selectSubobject(pick);else{selectedSubobject=null;editor.clearSelection();update();}return;}
  if(state().command&&state().commandData?.targetKind!=='none'&&!['selection','join-selection','mode','axis','view-vector','plan-choice','distance','delete-choice','clipboard-ready'].includes(state().commandPhase)&&state().command!=='ZOOM'){if(!pointer){toast(pointerUnavailable||'Type a coordinate or choose a different view.');return;}const command=state().command;if(pointerScalar!==null){runCommand(String(pointerScalar));input.focus({preventScroll:true});return;}addLog(`${currentPrompt()} ${format(pointer.x,6)},${format(pointer.y,6)}${pointer.z!==undefined?`,${format(pointer.z,6)}`:''}`,'input');let result;if((modelWorkspace()||currentViewport())&&state().commandData?.targetKind==='object'&&editor.submitObject){const picked=modelWorkspace()?projectedPick(rawPointer,visibleEntities()):null,id=picked?.entityId||(!modelWorkspace()?objectAtScreen(rawPointer,visibleEntities()):null);result=id?editor.submitObject(id,picked?.point||pointer):{ok:false,message:'No visible object was picked at that screen location.'};}else result=editor.submitPoint({...pointer});resultLog(result);trackClipboard(command,result);if(command==='MVIEW'&&result.ok&&!state().command){selectCreatedViewport(result.viewportId);update();}input.focus({preventScroll:true});return;}
  if(state().command&&!selectingObjects()){input.focus({preventScroll:true});return;}
  const grip=selectingObjects()?null:gripAt(rawPointer);
  if(grip){drag={mode:'grip',...grip};draw();return;}
  if(paperSpace()&&!state().command&&!event.shiftKey&&pointer){const id=hitTest(selectableObjects(),pointer,8/viewScale(),state()),object=activeObjects().find(item=>item.id===id);if(object?.type==='VIEWPORT'){if(!state().selectionIds.includes(id))editor.select([id]);drag={mode:'move-selection',startPaper:screenToPaper(rawPointer),start:{...rawPointer},moved:false};update();return;}}
  drag={mode:'box',start:{...rawPointer},world:{...pointer},screen:{...rawPointer},moved:false,shift:event.shiftKey};
  draw();
});
canvas.addEventListener('pointermove',event=>{
  if(documentActionBusy)return;
  const position=canvasPosition(event);
  if(drag?.mode==='orbit'){const free=drag.transient?event.ctrlKey&&event.shiftKey:drag.baseMode==='free'||event.shiftKey;if(Boolean(free)!==drag.free){drag.free=Boolean(free);drag.start={...position};drag.last={...position};drag.startCamera=structuredClone(camera3D());orbitMode=drag.free?'free':'constrained';}const before=drag.free?drag.startCamera:camera3D(),next=drag.free?view3d.orbitFree(before,drag.start,position,width,height):view3d.orbitConstrained(before,position.x-drag.last.x,position.y-drag.last.y);setCamera(view3d.orbitAroundPivot(before,next,orbitPivot));drag.last=position;pointerPosition(event);updateModelControls();draw();return;}
  if(drag?.mode==='pan'){if(currentLayout())panSheetOrViewport(position.x-drag.last.x,position.y-drag.last.y);else if(modelWorkspace())setCamera(view3d.panCamera(camera3D(),position.x-drag.last.x,position.y-drag.last.y,height));else state().viewport=pan(state().viewport,position.x-drag.last.x,position.y-drag.last.y);drag.last=position;drag.moved=drag.moved||Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>4;pointerPosition(event);draw();return;}
  pointerPosition(event);
  if(drag?.mode==='move-selection')drag.moved=Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>3;
  if(drag?.mode==='subobject-grip')drag.moved=Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>3;
  if(drag?.mode==='box'){drag.screen={...position};drag.moved=Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>4;}
  draw();
});
canvas.addEventListener('pointerup',event=>{
  if(documentActionBusy||!drag)return;
  pointerPosition(event);const operation=drag;drag=null;
  if(operation.mode==='orbit'){if(operation.transient)orbitMode=operation.previousMode;if(!orbitMode)orbitPivot=null;}
  else if(operation.mode==='grip'){if(pointer)resultLog(editor.moveGrip(operation.entityId,operation.index,{...pointer}));else toast(pointerUnavailable||'The grip could not be placed from this view.');}
  else if(operation.mode==='subobject-grip'){if(operation.moved&&pointer){const delta={x:pointer.x-operation.startPoint.x,y:pointer.y-operation.startPoint.y,z:pointer.z-operation.startPoint.z};const result=editor.moveMeshVertices(operation.entityId,operation.indices,delta);if(result.ok)selectedSubobject=null;resultLog(result);}}
  else if(operation.mode==='pan'){if(viewportNavigationDraft)resultLog(flushViewportNavigation());lastMiddleClick=operation.middle&&!operation.moved?{time:event.timeStamp,screen:{...rawPointer}}:null;}
  else if(operation.mode==='move-selection'){if(operation.moved&&pointer){let result=editor.execute('MOVE');if(result.ok)result=editor.submitPoint(operation.startPaper);if(result.ok)result=editor.submitPoint(pointer);resultLog(result);}}
  else if(operation.mode==='box'){
    const selectingCommand=selectingObjects();
    if(operation.moved){const ids=currentViewport()?objectsInViewportBox(operation.start,operation.screen,operation.screen.x<operation.start.x):modelWorkspace()?view3d.entitiesInProjectedBox(selectableObjects(),operation.start,operation.screen,operation.screen.x<operation.start.x,camera3D(),width,height,e=>geometry.entityPoints(e,state()),projectionEdges,projectionFills):entitiesInBox(selectableObjects(),operation.world,toWorld(operation.screen),operation.screen.x<operation.start.x,state());editor.select(ids,{add:operation.shift||selectingCommand});addLog(`${ids.length} object${ids.length===1?'':'s'} found.`);}
    else {const id=objectAtScreen(operation.screen);if(id)editor.select([id],{toggle:operation.shift,add:selectingCommand&&!operation.shift});else if(!operation.shift&&!selectingCommand)editor.clearSelection();}
  }
  update();if(state().command)input.focus({preventScroll:true});else canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointercancel',()=>{if(drag?.mode==='orbit'&&drag.transient)orbitMode=drag.previousMode;if(!orbitMode)orbitPivot=null;drag=null;viewportNavigationDraft=null;update();});
canvas.addEventListener('dblclick',event=>{
  if(documentActionBusy||orbitMode||event.button!==0||state().command||panTool)return;
  if(currentLayout()){const viewport=viewportAt(canvasPosition(event));if(viewport&&state().activeViewportId!==viewport.id){enterSpace('model',currentLayout().id,viewport.id);return;}if(!viewport&&currentViewport()){enterSpace('paper',currentLayout().id);return;}}
  const screen=canvasPosition(event),id=objectAtScreen(screen),entity=activeEntities().find(item=>item.id===id);
  if(entity&&['TEXT','MTEXT'].includes(entity.type)){editor.select([id]);update();openAnnotationEditor(id);}
});
canvas.addEventListener('pointerleave',()=>{if(!drag){rawPointer=null;pointer=null;snap=null;updateStatus();draw();}});
canvas.addEventListener('contextmenu',event=>{event.preventDefault();if(state().command)runCommand('');else input.focus();});
canvas.addEventListener('wheel',event=>{event.preventDefault();if(documentActionBusy||!Number.isFinite(event.deltaY))return;const factor=Math.exp(Math.max(-40,Math.min(40,-event.deltaY*.0015)));if(currentLayout()){const screen=canvasPosition(event);zoomSheetOrViewport(factor,screen);scheduleViewportFrame(screen);if(!viewportNavigationDraft)scheduleDevelopmentCheckpoint();return;}if(modelWorkspace()){const screen=canvasPosition(event),anchor=projectedPick(screen,visibleEntities())?.point||toWorld(screen)||view3d.pointOnTargetPlane(screen,camera3D(),width,height);setCamera(view3d.zoomCameraAt(camera3D(),factor,screen,width,height,anchor));updateModelControls();}else state().viewport=zoomAt(state().viewport,factor,canvasPosition(event),width,height);pointerPosition(event);draw();scheduleDevelopmentCheckpoint();},{passive:false});

$('command-form').addEventListener('submit',event=>{event.preventDefault();if(completionIndex>=0)acceptCompletion();const value=input.value;input.value='';runCommand(value);input.focus();});
input.addEventListener('input',renderCompletion);
input.addEventListener('blur',()=>setTimeout(hideCompletion,120));
input.addEventListener('keydown',event=>{
  if(!$('command-suggestions').hidden&&['ArrowUp','ArrowDown','Tab'].includes(event.key)){event.preventDefault();if(event.key==='Tab')acceptCompletion();else selectCompletion(completionIndex<0?(event.key==='ArrowDown'?0:completionItems.length-1):completionIndex+(event.key==='ArrowDown'?1:-1));return;}
  if(event.key==='ArrowUp'){event.preventDefault();if(commandRecall.length){recallIndex=Math.max(0,recallIndex-1);input.value=commandRecall[recallIndex]||'';}}
  if(event.key==='ArrowDown'){event.preventDefault();recallIndex=Math.min(commandRecall.length,recallIndex+1);input.value=commandRecall[recallIndex]||'';}
});
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{
  const tool=button.dataset.tool;if(tool==='SELECT')cancel();else if(tool==='PAN'){editor.cancel();orbitMode=null;orbitPivot=null;panTool=!panTool;update();}else {if(state().command)editor.cancel();runCommand(tool);}input.focus();
}));
$('fit-button').addEventListener('click',fit);
$('undo-button').addEventListener('click',()=>{if(!documentActionBusy&&!orbitMode)resultLog(editor.undo());});
$('redo-button').addEventListener('click',()=>{if(!documentActionBusy&&!orbitMode)resultLog(editor.redo());});
$('delete-button').addEventListener('click',()=>{if(!documentActionBusy&&!orbitMode)eraseCurrentSelection();});
$('clear-history').addEventListener('click',()=>{$('command-log').replaceChildren();input.focus();});
$('grid-toggle').addEventListener('click',()=>setDrafting({gridEnabled:!gridEnabled}));
$('snap-toggle').addEventListener('click',()=>{snap=null;setDrafting({snapEnabled:!snapEnabled});});
$('ortho-toggle').addEventListener('click',()=>setDrafting({orthoEnabled:!orthoEnabled}));
$('save-document').addEventListener('click',()=>runAction('save'));
$('export-dxf').addEventListener('click',()=>runAction('export-dxf'));
$('new-document').addEventListener('click',()=>runAction('new'));
$('open-document').addEventListener('click',()=>runAction('open'));
$('file-input').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  if(!await canDiscard()){event.target.value='';return;}
  try {const text=await file.text();replaceDrawing(createEditor(JSON.parse(text)),file.name);addLog(`Opened ${file.name}.`);}
  catch(error){addLog(`Could not open drawing: ${error.message}`,'error');toast('The drawing could not be opened.');}
  event.target.value='';
});
// Apply the small native-safe layer form through CSSOM so the desktop CSP needs no inline styles.
Object.assign($('layer-dialog').style,{maxWidth:'360px'});
$('layer-dialog').querySelector('h2').style.fontSize='21px';
Object.assign($('layer-form').querySelector('label').style,{display:'block',margin:'20px 0 8px'});
Object.assign($('layer-name-input').style,{width:'100%',padding:'9px',border:'1px solid #3d606b',borderRadius:'4px',background:'#20343e',color:'#e6f2f5'});
Object.assign($('layer-dialog-actions').style,{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'22px'});
Object.assign($('layer-cancel').style,{padding:'8px 14px',border:'1px solid #3d606b',borderRadius:'4px'});
Object.assign($('layer-confirm').style,{padding:'8px 14px',background:'#284c46',color:'#aff0df',borderRadius:'4px'});
$('add-layer').addEventListener('click',()=>{
  if(desktop){$('layer-name-input').value='Geometry';$('layer-dialog').showModal();$('layer-name-input').focus();$('layer-name-input').select();return;}
  const name=window.prompt('Name for the new layer:','Geometry');if(!name?.trim())return;
  const result=editor.addLayer(name.trim(),{color:'#f5b36c'});resultLog(result);if(result?.ok!==false){editor.setCurrentLayer(name.trim());update();}
});
$('layer-form').addEventListener('submit',event=>{
  event.preventDefault();const name=$('layer-name-input').value.trim();if(!name)return;
  const result=editor.addLayer(name,{color:'#f5b36c'});resultLog(result);
  if(result?.ok!==false){editor.setCurrentLayer(name);$('layer-dialog').close();update();input.focus();}
});
$('layer-cancel').addEventListener('click',()=>$('layer-dialog').close());
buildPalette('Draw',$('draw-command-list'));buildPalette('Modify',$('modify-command-list'));buildPalette('Clipboard',$('clipboard-command-list'));buildPalette('Annotate',$('annotation-command-list'));buildPalette('Measure',$('measurement-command-list'));buildPalette('Model',$('model-command-list'));buildPalette('Blocks',$('blocks-command-list'));buildPalette('Output',$('output-command-list'));
$('blocks-tools').hidden=!commandCatalog.some(command=>command.group==='Blocks');$('output-tools').hidden=!commandCatalog.some(command=>command.group==='Output');
for(const id of ['draw','modify','clipboard','annotation','model','blocks','output']){
  $(`${id}-tools`).addEventListener('click',()=>{const opening=$(`${id}-palette`).hidden;closePalettes();if(opening){$(`${id}-palette`).hidden=false;$(`${id}-tools`).setAttribute('aria-expanded','true');$(`${id}-tools`).classList.add('active');}});
  $(`${id}-palette`).querySelector('.palette-close').addEventListener('click',closePalettes);
}
document.querySelectorAll('[data-reference]').forEach(button=>button.addEventListener('click',()=>showReference(button.dataset.reference)));
for(const category of ['All','Draw','Model','Architecture','Annotate','Measure','Modify','Blocks','Clipboard','Settings','Output','Navigate','Unavailable'].filter(category=>category==='All'||category==='Unavailable'&&unavailableCatalog.length||commandCatalog.some(command=>command.group===category))){const button=document.createElement('button');button.textContent=category;button.setAttribute('aria-pressed',String(category==='All'));button.addEventListener('click',()=>{referenceCategory=category;renderReference();});$('reference-filters').append(button);}
$('reference-tools').addEventListener('click',()=>showReference());$('close-reference').addEventListener('click',()=>$('reference-dialog').close());$('reference-search-input').addEventListener('input',renderReference);
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.tool-palette,#draw-tools,#modify-tools,#clipboard-tools,#annotation-tools,#model-tools,#blocks-tools,#output-tools'))closePalettes();});
$('workspace-mode').addEventListener('change',()=>setWorkspace($('workspace-mode').value));
$('view3d-preset').addEventListener('change',()=>{if($('view3d-preset').value!=='custom'){setCamera(view3d.cameraPreset(camera3D(),$('view3d-preset').value));pointer=null;pointerUnavailable=null;update();}});
$('render3d-mode').addEventListener('change',()=>{setCamera({...camera3D(),renderMode:$('render3d-mode').value});update();});
$('view3d-projection').addEventListener('change',()=>{const projection=$('view3d-projection').value,old=camera3D(),scale=view3d.pixelScale(old,height),distance=projection==='perspective'?Math.max(1e-6,Math.min(1e12,view3d.focalPixels(old,height)/scale)):old.distance;setCamera({...old,projection,distance,scale:Math.max(1e-6,Math.min(1e6,scale))});update();});
$('construction-plane').addEventListener('change',()=>{if($('construction-plane').value==='CUSTOM'){runCommand('UCS');runCommand('3');}else{resultLog(editor.setUCS($('construction-plane').value));pointer=null;pointerUnavailable=null;}});
$('ucs-three-point').addEventListener('click',()=>{if(state().command)editor.cancel();runCommand('UCS');runCommand('3');input.focus();});
$('plan-ucs').addEventListener('click',()=>{if(state().command)editor.cancel();runCommand('PLAN');runCommand('');});
$('selection-mode').addEventListener('change',()=>setSubobjectMode($('selection-mode').value));
$('construction-elevation').addEventListener('change',()=>{try{const value=readQuantityField('construction-elevation','length');resultLog(editor.updateDraftingSettings({constructionElevation:value}));}catch(error){toast(error.message||'Enter a finite elevation.');updateModelControls();}});
$('construction-elevation').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('construction-elevation').blur();canvas.focus();}});
$('orbit-tool').addEventListener('click',()=>{if(orbitMode){orbitMode=null;orbitPivot=null;update();}else{if(state().command)editor.cancel();startOrbit('constrained');}canvas.focus();});
$('orbit-auto-target').addEventListener('change',()=>{setCamera({...camera3D(),autoTarget:$('orbit-auto-target').checked,orbitCenter:null});if(orbitMode)startOrbit(orbitMode);else update();});
function activateCubeTarget(target){if(target.dataset.cubeView)setCamera(view3d.cameraPreset(camera3D(),target.dataset.cubeView));else if(target.dataset.cubeYaw!==undefined)setCamera({...camera3D(),yaw:Number(target.dataset.cubeYaw),pitch:Number(target.dataset.cubePitch),roll:0,mode:'custom'});else return;pointer=null;pointerUnavailable=null;update();}
$('view-cube').addEventListener('click',event=>{if(cubeClickSuppressed){cubeClickSuppressed=false;return;}if(!documentActionBusy)activateCubeTarget(event.target.closest('[role=button]')||event.target);});
$('view-cube').addEventListener('pointerdown',event=>{if(documentActionBusy||event.button!==0)return;event.preventDefault();cubeClickSuppressed=false;const target=event.target.closest('[role=button]')||event.target;$('view-cube').setPointerCapture(event.pointerId);cubeDrag={start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY},previousMode:orbitMode,moved:false,target:{dataset:{...target.dataset}}};});
$('view-cube').addEventListener('pointermove',event=>{if(!cubeDrag||documentActionBusy)return;const position={x:event.clientX,y:event.clientY};if(!cubeDrag.moved&&Math.hypot(position.x-cubeDrag.start.x,position.y-cubeDrag.start.y)<4)return;if(!cubeDrag.moved){cubeDrag.moved=true;startOrbit('constrained');}const before=camera3D(),next=view3d.orbitConstrained(before,position.x-cubeDrag.last.x,position.y-cubeDrag.last.y);setCamera(view3d.orbitAroundPivot(before,next,orbitPivot));cubeDrag.last=position;updateModelControls();draw();});
function finishCubeDrag(event){if(!cubeDrag)return;const operation=cubeDrag;cubeDrag=null;cubeClickSuppressed=true;if(operation.moved){orbitMode=operation.previousMode;if(!orbitMode)orbitPivot=null;update();}else if(event.type==='pointerup')activateCubeTarget(operation.target);}
$('view-cube').addEventListener('pointerup',finishCubeDrag);$('view-cube').addEventListener('pointercancel',finishCubeDrag);
$('view-cube').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();activateCubeTarget(event.target.closest('[role=button]')||event.target);}});
$('import-close').addEventListener('click',()=>$('import-dialog').close());
$('plot-close').addEventListener('click',closePlot);$('plot-cancel').addEventListener('click',closePlot);$('plot-dialog').addEventListener('cancel',event=>{event.preventDefault();closePlot();});$('plot-form').addEventListener('submit',submitPlot);
for(const id of ['plot-paper','plot-orientation','plot-mode','plot-scale','plot-margin','plot-color','plot-lineweights'])$(id).addEventListener('change',refreshPlotPreview);
for(const id of ['plot-space','plot-layout-id'])$(id).addEventListener('change',()=>{refreshPlotSpace();refreshPlotPreview();});
$('settings-button').addEventListener('click',showSettings);$('settings-close').addEventListener('click',closeSettings);$('settings-cancel').addEventListener('click',closeSettings);$('settings-dialog').addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
for(let riseTwice=2;riseTwice<=24;riseTwice++){const option=document.createElement('option');option.value=String(riseTwice);option.textContent=`${riseTwice/2}:12`;if(riseTwice===8)option.selected=true;$('arch-roof-pitch').append(option);}
$('architecture-button').addEventListener('click',()=>showArchitecture());$('architecture-inspect').addEventListener('click',()=>showArchitecture());$('architecture-close').addEventListener('click',closeArchitecture);$('architecture-dialog').addEventListener('cancel',event=>{event.preventDefault();closeArchitecture();});
for(const button of document.querySelectorAll('[data-architecture-tab]'))button.addEventListener('click',()=>architectureTabTo(button.dataset.architectureTab));
$('arch-wall-id').addEventListener('change',loadArchitectureWall);$('arch-node-id').addEventListener('change',loadArchitectureNode);$('arch-room-id').addEventListener('change',loadArchitectureRoom);$('arch-roof-id').addEventListener('change',loadArchitectureRoof);
$('arch-wall-convert').addEventListener('click',()=>architectureAction(()=>{const path=architectureSelectedPath();return applyArchitecture({type:'addWalls',...path,...architectureReadWall()});}));
$('arch-wall-add').addEventListener('click',()=>architectureAction(()=>applyArchitecture({type:'addWalls',points:[architecturePoint('arch-wall-x1','arch-wall-y1'),architecturePoint('arch-wall-x2','arch-wall-y2')],closed:false,...architectureReadWall()})));
$('arch-wall-apply').addEventListener('click',()=>architectureAction(()=>{const wallId=$('arch-wall-id').value;if(!wallId)throw Error('Choose an existing architectural wall.');return applyArchitecture({type:'setWall',wallId,values:architectureReadWall()});}));
$('arch-node-apply').addEventListener('click',()=>architectureAction(()=>{const nodeId=$('arch-node-id').value;if(!nodeId)throw Error('Choose a shared wall junction.');return applyArchitecture({type:'moveNode',nodeId,point:architecturePoint('arch-node-x','arch-node-y')});}));
$('arch-span-apply').addEventListener('click',()=>architectureAction(()=>{const startNodeId=$('arch-span-start').value,endNodeId=$('arch-span-end').value;if(!startNodeId||!endNodeId||startNodeId===endNodeId)throw Error('Choose distinct start and end wall junctions.');return applyArchitecture({type:'driveSpan',startNodeId,endNodeId,axis:$('arch-span-axis').value,value:architectureLength('arch-span-value')});}));
$('arch-opening-add').addEventListener('click',()=>architectureAction(()=>{const wallId=$('arch-wall-id').value;if(!wallId)throw Error('Choose the host wall.');return applyArchitecture({type:'addOpening',wallId,openingType:$('arch-opening-type').value,station:architectureLength('arch-opening-station'),width:architectureLength('arch-opening-width'),sillElevation:architectureLength('arch-opening-sill'),headElevation:architectureLength('arch-opening-head')});}));
$('arch-footprint-add').addEventListener('click',()=>architectureAction(addArchitectureFootprint));
$('arch-rooms-recognize').addEventListener('click',()=>applyArchitecture({type:'recognizeRooms'}));
$('arch-room-apply').addEventListener('click',()=>architectureAction(()=>{const roomId=$('arch-room-id').value;if(!roomId)throw Error('Choose an architectural room.');return applyArchitecture({type:'setRoom',roomId,values:{label:$('arch-room-label').value.trim(),...(architectureSource().rooms.find(item=>item.id===roomId)?.ceilingType==='tray'?{}:{ceilingElevation:architectureLength('arch-room-ceiling')}),targetCeilingElevation:architectureLength('arch-room-target'),allowCeilingChange:$('arch-room-allow').checked}});}));
for(const id of ['arch-roof-pitch','arch-roof-overhang','arch-roof-bearing','arch-roof-heel'])$(id).addEventListener('input',updateArchitectureRoofPreview);
$('arch-roof-add').addEventListener('click',()=>architectureAction(architectureCreateRoof));
$('arch-roof-apply').addEventListener('click',()=>architectureAction(()=>{const roofGroupId=$('arch-roof-id').value;if(!roofGroupId)throw Error('Choose an existing roof group.');return applyArchitecture({type:'setRoof',roofGroupId,values:{name:$('arch-roof-name').value.trim()||'Hip roof',...architectureRoofValues()}});}));
$('arch-roof-update').addEventListener('click',()=>applyArchitecture({type:'regenerate'}));$('arch-report-refresh').addEventListener('click',refreshArchitectureReport);
$('arch-space-room').addEventListener('change',()=>loadArchitectureSpace({matchRoof:true}));$('arch-space-roof').addEventListener('change',()=>loadArchitectureSpace());$('arch-space-refresh').addEventListener('click',()=>loadArchitectureSpace());
$('arch-space-intent').addEventListener('click',()=>architectureAction(()=>{const{room}=architectureRequireSpace();return applyArchitecture({type:'setRoom',roomId:room.id,values:{targetCeilingElevation:architectureLength('arch-space-target'),minimumClearHeight:architectureLength('arch-space-minimum'),headroomThreshold:architectureLength('arch-space-headroom'),ceilingFinishThickness:architectureLength('arch-space-finish'),allowCeilingChange:$('arch-space-allow').checked}});}));
$('arch-space-assembly').addEventListener('click',()=>architectureAction(()=>saveArchitectureAssembly()));$('arch-space-reservation-save').addEventListener('click',()=>architectureAction(()=>saveArchitectureReservation()));$('arch-space-reservation-remove').addEventListener('click',()=>architectureAction(()=>saveArchitectureReservation(true)));$('arch-space-reservation').addEventListener('change',loadArchitectureReservation);
$('arch-space-zero').addEventListener('click',()=>architectureAction(useArchitectureZeroThickness));
$('arch-space-apply-target').addEventListener('click',()=>architectureAction(()=>applyArchitectureCeiling('target')));$('arch-space-apply-maximum').addEventListener('click',()=>architectureAction(()=>applyArchitectureCeiling('maximum')));
$('arch-tray-save').addEventListener('click',()=>architectureAction(()=>saveArchitectureTray()));$('arch-tray-remove').addEventListener('click',()=>architectureAction(()=>saveArchitectureTray(true)));$('arch-tray-apply').addEventListener('click',()=>architectureAction(applyArchitectureTray));
for(const id of ['arch-tray-min-x','arch-tray-max-x','arch-tray-min-y','arch-tray-max-y','arch-tray-base','arch-tray-raised'])$(id).addEventListener('input',architectureTrayDirty);
$('arch-space-section-axis').addEventListener('change',()=>{const{room}=architectureSpaceSelection(),derived=state().architectureDerived?.rooms?.find(item=>item.id===room?.id),axis=$('arch-space-section-axis').value==='x'?'y':'x';if(derived?.boundary?.length)architectureSetLength('arch-space-section-coordinate',(Math.min(...derived.boundary.map(point=>point[axis]))+Math.max(...derived.boundary.map(point=>point[axis])))/2);});
$('arch-space-section').addEventListener('click',()=>architectureAction(()=>{const{room,analysis,roof}=architectureRequireSpace();if(architectureSpaceContext!==architectureSpaceStamp()||analysis?.roofId!==roof.id)throw Error('Save or reload the accepted study before exporting a section.');return applyArchitecture({type:'exportSection',roomId:room.id,axis:$('arch-space-section-axis').value,coordinate:architectureLength('arch-space-section-coordinate'),origin:architecturePoint('arch-space-section-x','arch-space-section-y')});}));
for(const id of ['arch-space-target','arch-space-minimum','arch-space-headroom','arch-space-finish','arch-space-allow','arch-space-assembly-name','arch-space-thickness','arch-space-reservation-kind','arch-space-reservation-description',...['min','max'].flatMap(bound=>['x','y','z'].map(axis=>`arch-space-reservation-${bound}-${axis}`))])$(id).addEventListener('input',architectureSpaceDirty);
$('arch-view-plan').addEventListener('click',()=>{closeArchitecture();setWorkspace('2d');fit();});$('arch-view-3d').addEventListener('click',()=>{closeArchitecture();setWorkspace('3d');fit();});
$('add-layout-button').addEventListener('click',()=>showPageSetup(true));$('page-setup-button').addEventListener('click',()=>showPageSetup(!currentLayout()));$('page-setup-close').addEventListener('click',closePageSetup);$('page-setup-cancel').addEventListener('click',closePageSetup);$('page-setup-dialog').addEventListener('cancel',event=>{event.preventDefault();closePageSetup();});for(const id of ['layout-paper-size','layout-orientation'])$(id).addEventListener('change',refreshPageSetup);
$('page-setup-form').addEventListener('submit',event=>{event.preventDefault();const patch={name:$('layout-name-input').value,paper:{size:$('layout-paper-size').value,orientation:$('layout-orientation').value}},result=pageSetupLayoutId?editor.updateLayout(pageSetupLayoutId,patch):editor.addLayout(patch.name,patch.paper);if(result?.ok===false){$('page-setup-error').textContent=result.message;return;}const created=!pageSetupLayoutId,id=pageSetupLayoutId||result.layoutId;closePageSetup();selectedViewportId=null;enterSpace('paper',id);if(created)fitPaper();resultLog(result);});
$('new-viewport-button').addEventListener('click',()=>{const layout=currentLayout();if(!layout)return;if(!paperSpace())enterSpace('paper',layout.id);runCommand('MVIEW');const shape=$('viewport-shape').value;if(shape==='polygon')runCommand('P');else if(shape==='object')runCommand('O');});
$('space-mode-button').addEventListener('click',()=>{const layout=currentLayout();if(!layout)return;if(currentViewport())enterSpace('paper',layout.id);else{const viewport=selectedViewport()||layout.viewports[0];if(viewport)enterSpace('model',layout.id,viewport.id);else toast('Create a viewport before entering model space on this sheet.');}});
$('viewport-lock-button').addEventListener('click',()=>{const viewport=selectedViewport();if(viewport)resultLog(updateSelectedViewport({locked:!viewport.locked}));});$('viewport-view').addEventListener('change',()=>resultLog(setViewportView($('viewport-view').value)));
$('viewport-scale').addEventListener('change',()=>viewportScaleChoice($('viewport-scale')));$('viewport-custom-scale').addEventListener('input',refreshViewportScalePreview);$('viewport-scale-cancel').addEventListener('click',closeViewportScaleDialog);$('viewport-scale-dialog').addEventListener('cancel',event=>{event.preventDefault();closeViewportScaleDialog();});$('viewport-scale-form').addEventListener('submit',event=>{event.preventDefault();const result=setViewportScale($('viewport-custom-scale').value,{target:viewportScaleTarget});if(result?.ok!==false)closeViewportScaleDialog();});
$('layer-manager-button').addEventListener('click',showLayerManager);$('layer-manager-close').addEventListener('click',closeLayerManager);$('layer-manager-dialog').addEventListener('cancel',event=>{event.preventDefault();closeLayerManager();});$('manager-add-layer').addEventListener('click',()=>$('add-layer').click());
$('units-button').addEventListener('click',()=>runCommand('UNITS'));
$('setting-unit-preset').addEventListener('change',changeUnitPreset);
for(const id of ['setting-units','setting-precision','setting-linear-format','setting-fraction-precision','setting-angular-input','setting-angular-format','setting-angular-precision'])$(id).addEventListener('input',()=>{$('setting-unit-preset').value='custom';refreshUnitPreview();});
$('setting-grid-adaptive').addEventListener('change',()=>$('setting-grid-spacing').disabled=$('setting-grid-adaptive').checked);
$('setting-text-style').addEventListener('change',()=>{if(!captureStyleFields()){$('setting-text-style').value=settingsDraft.textName;return;}settingsDraft.textName=$('setting-text-style').value;displayTextStyleFields();});
$('setting-dim-style').addEventListener('change',()=>{if(!captureStyleFields()){$('setting-dim-style').value=settingsDraft.dimName;return;}settingsDraft.dimName=$('setting-dim-style').value;displayDimStyleFields();});
$('add-text-style').addEventListener('click',()=>createDraftStyle('text'));$('add-dim-style').addEventListener('click',()=>createDraftStyle('dim'));
$('settings-form').addEventListener('submit',event=>{
  event.preventDefault();if(!captureStyleFields())return;
  const patch={...unitFields(),gridEnabled:$('setting-grid').checked,snapEnabled:$('setting-snap').checked,orthoEnabled:$('setting-ortho').checked,gridAdaptive:$('setting-grid-adaptive').checked,gridSpacing:$('setting-grid-spacing').valueAsNumber,snapModes:[...document.querySelectorAll('[data-setting-snap]:checked')].map(box=>box.dataset.settingSnap),textStyles:settingsDraft.textStyles,dimStyles:settingsDraft.dimStyles,currentTextStyle:settingsDraft.textName,currentDimStyle:settingsDraft.dimName};
  const result=resultLog(editor.updateDrawingSettings(patch));if(result?.ok===false){$('settings-error').textContent=result.message;return;}closeSettings();canvas.focus();
});
$('annotation-form').addEventListener('submit',event=>{
  event.preventDefault();const raw=$('annotation-content').value;
  const result=resultLog(annotationEditor?.command&&state().command===annotationEditor.command?editor.submitText(raw):editor.setTextProperties(annotationEditor.entityId,{text:raw}));
  if(result?.ok===false){$('annotation-error').textContent=result.message;return;}closeAnnotationEditor();canvas.focus();
});
$('annotation-close').addEventListener('click',()=>closeAnnotationEditor(true));$('annotation-cancel').addEventListener('click',()=>closeAnnotationEditor(true));$('annotation-dialog').addEventListener('cancel',event=>{event.preventDefault();closeAnnotationEditor(true);});
const referenceLink=document.createElement('button');referenceLink.className='guide-reference';referenceLink.textContent='Search commands, options and examples ↗';referenceLink.addEventListener('click',()=>{$('help-dialog').close();showReference();});$('help-dialog').querySelector('.dialog-heading').after(referenceLink);
$('help-dialog').querySelector('.help-footer').textContent='Clipboard shortcuts copy geometry when the canvas has focus. In text fields they copy or paste text. Use COPYCLIP, CUTCLIP, COPYBASE and PASTECLIP for drawing geometry from the command line. Save a Linecraft drawing to preserve layers, or export DXF for exchange.';
function showHelp(){$('help-dialog').showModal();}
$('help-button').addEventListener('click',showHelp);$('show-guide').addEventListener('click',showHelp);$('close-help').addEventListener('click',()=>$('help-dialog').close());
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||documentActionBusy)return;
  if($('architecture-dialog').open||$('help-dialog').open||$('layer-dialog').open||$('reference-dialog').open||$('annotation-dialog').open||$('settings-dialog').open||$('import-dialog').open||$('plot-dialog').open||$('page-setup-dialog').open||$('viewport-scale-dialog').open||$('layer-manager-dialog').open)return;
  const editing=textEditing(event.target);
  if(event.key==='Escape'){event.preventDefault();cancel();input.focus();return;}
  if(!editing&&modelWorkspace()&&!state().command){
    if(event.shiftKey&&/^F[1-4]$/.test(event.key)){event.preventDefault();setSubobjectMode(['whole','vertex','edge','face'][Number(event.key.slice(1))-1]);return;}
    if(event.code==='Space'&&event.ctrlKey){event.preventDefault();cycleSubobject();return;}
  }
  if(!editing&&!state().command&&event.code==='Space'&&event.shiftKey){event.preventDefault();cycleOverlap();return;}
  if(event.ctrlKey||event.metaKey){
    const clipboardAction={c:event.shiftKey?'copy-base':'copy',x:'cut',v:'paste'}[event.key.toLowerCase()];
    if(clipboardAction){if(!editing){event.preventDefault();runAction(clipboardAction);}return;}
    if(desktop){
      // Main consumes physical accelerators; handle keys that are delivered directly to the DOM.
      const key=event.key.toLowerCase();
      const action=key==='n'?'new':key==='o'?'open':key==='s'?(event.shiftKey?'save-as':'save'):key==='z'?(event.shiftKey?'redo':'undo'):key==='y'?'redo':key==='p'?'plot':key==='0'?'fit':null;
      if(action){event.preventDefault();runAction(action);}
      return;
    }
    if(event.key.toLowerCase()==='s'){event.preventDefault();runAction(event.shiftKey?'save-as':'save');}
    else if(event.key.toLowerCase()==='n'){event.preventDefault();runAction('new');}
    else if(event.key.toLowerCase()==='o'){event.preventDefault();runAction('open');}
    else if(event.key.toLowerCase()==='z'){event.preventDefault();runAction(event.shiftKey?'redo':'undo');}
    else if(event.key.toLowerCase()==='y'){event.preventDefault();runAction('redo');}
    else if(event.key.toLowerCase()==='p'){event.preventDefault();runAction('plot');}
    else if(event.key==='0'){event.preventDefault();runAction('fit');}
    return;
  }
  if(event.key==='F1'){event.preventDefault();showReference();return;}
  if(event.key==='F3'){event.preventDefault();$('snap-toggle').click();return;}
  if(event.key==='F7'){event.preventDefault();$('grid-toggle').click();return;}
  if(event.key==='F8'){event.preventDefault();$('ortho-toggle').click();return;}
  if(event.key==='Delete'&&!editing){event.preventDefault();if(!orbitMode)eraseCurrentSelection();return;}
  if(!editing&&!event.altKey&&event.key.length===1){event.preventDefault();input.focus();input.value+=event.key;renderCompletion();}
  if(!editing&&event.key==='Enter'){event.preventDefault();input.focus();runCommand(input.value);input.value='';}
});
window.addEventListener('beforeunload',event=>{if(!desktop&&isDirty()){event.preventDefault();event.returnValue='';}});
new ResizeObserver(resized).observe(canvas);
const scripting=createScriptingAPI({getEditor:()=>editor,getName:()=>documentName,canEdit:()=>!documentActionBusy&&!drag&&!orbitMode&&!panTool&&!editorDialogOpen()&&!viewportNavigationDraft,onChange:response=>{addLog(response.message,'notice');update();}});
window.linecraft={scripting,get editor(){return editor;},execute:runCommand,fit,getSnapshot:()=>JSON.parse(JSON.stringify(state())),getDocumentState:documentInfo,getDevelopmentState:()=>({...developmentState}),getCommandReference:()=>JSON.parse(JSON.stringify([...commandCatalog,...unavailableCatalog])),getSpaceState:()=>({activeSpace:state().activeSpace,activeLayoutId:state().activeLayoutId,activeViewportId:state().activeViewportId,selectedViewportId:selectedViewport()?.id||null,paperViewport:structuredClone(paperView()),subobjectMode,selectedSubobject:selectedSubobject?structuredClone(selectedSubobject):null,plane:structuredClone(activePlane())}),getViewportNavigationState:()=>({pending:Boolean(viewportNavigationDraft),draft:viewportNavigationDraft?structuredClone(viewportNavigationDraft):null}),getModelEntities:()=>structuredClone(modelEntities()),getPaperEntities:id=>structuredClone(editor.getPaperEntities(id)),projectPaper:point=>paperToScreen(point),get3DState:()=>({camera:structuredClone(camera3D()),workspace:state().workspace,orbitMode,pivot:orbitPivot?{...orbitPivot}:null,constructionElevation:state().settings?.constructionElevation,documentActionBusy,importedAwaitingSave}),project:point=>toScreen(point),acquire:screen=>toWorld(screen),runAction,canvas};
if(desktop){desktop.onAction(action=>runAction(action));document.querySelector('.local-badge').lastChild.textContent=' Desktop workspace';}
addLog('Linecraft CAD · New drawing ready.');
addLog('Draw, modify and place geometry. Open Commands to search supported tools, options and examples.');
update();resized();input.focus();
