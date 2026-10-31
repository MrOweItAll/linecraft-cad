import * as geometry from './core.mjs';
import {createScriptingAPI} from './linecraft-scripting.mjs';
import * as view3d from './3d-view.mjs';
import {inferGableCandidates} from './architecture/roof-gable.mjs';
import {reviseRoofComponentBounds} from './architecture/roof-component-edit.mjs';
import {roofDisplayEdges,roofDrainageWitnesses} from './architecture/view-adapter.mjs';
import {roofComponentTriangles,roofComponentFootprint,boundsFromRoofComponentGrip} from './architecture/roof-interaction.mjs';
import {createRoofPreviewClient} from './architecture/roof-preview-client.mjs';
import {buildCanvasContextMenu,buildObjectSnapMenu,menuContextSignature} from './context-menu-policy.mjs';
import {commandCompletions,commandPointSnapToken,completionPointerMoved,commandInputSubmission,nextRepeatableCommand} from './command-completion.mjs';
import {ordinaryGripPlane,ordinaryGripPointOnPlane,parseOrdinaryGripPoint} from './ordinary-grip-input.mjs';
import {parseRoofGripCoordinate,projectRoofGripSnap} from './architecture/roof-grip-input.mjs';
import {listStructuralRoofRegions,createStructuralRoofExport,validateStructuralRoofExport,validateStructuralRoofResult} from './architecture/structural-bridge.mjs';
import {createStructuralRoofAssignmentExport,validateStructuralRoofAssignmentExport,validateStructuralRoofAssignmentResult} from './architecture/structural-assignments.mjs';
import {createStructuralRoofBoundaryExport,validateStructuralRoofBoundaryExport,validateStructuralRoofBoundaryResult,inspectStructuralTributaryBoundaries,getStructuralTributaryFaceMaximum} from './architecture/structural-boundaries.mjs';
import {previewRoofGroup,createArchitectureAlternativeSearch,architectureInputHash,buildArchitectureAlternativeReport} from './architecture/editor-adapter.mjs';
const {createEditor,worldToScreen,screenToWorld,zoomAt,pan,zoomExtents,hitTest,entitiesInBox,findSnap}=geometry;

const $ = id => document.getElementById(id);
const canvas = $('drawing-canvas');
const ctx = canvas.getContext('2d');
const input = $('command-input');
let editor = createEditor();
let width = 1, height = 1, dpr = 1;
let pointer = null, rawPointer = null, snap = null, drag = null, acquiredGrip=null;
let ordinaryGripStage=null,ordinaryGripConsumedUp=null;
let gridEnabled = true, snapEnabled = true, orthoEnabled = false, panTool = false;
let documentName = 'Untitled drawing';
const desktop = window.linecraftDesktop || null;
const developmentMode = Boolean(desktop&&window.linecraftDevelopment===true);
let savedFingerprint = null, documentActionBusy = false, pendingDevelopmentReload = false, closingApplication = false;
const fileOpenState={ready:false,status:'idle',pending:null,deferredReason:null,lastResult:null};
let fileOpenTimer=null,fileOpenChecking=false,fileOpenNotified=false,fileOpenDeferredId=null;
let importedAwaitingSave=false;
let commandRecall = [], recallIndex = 0;
let lastMiddleClick = null;
let toastTimer;
let localGeometryClipboard=null, clipboardCutPending=false, clipboardWritePromise=null, completionItems=[], completionIndex=-1, referenceCategory='All';
let completionSession=null;
let completionPointerPosition=null,completionPointerMovedEvent=null;
const GRIP_ACQUIRE_PIXELS=10,GRIP_RELEASE_PIXELS=15;
let annotationEditor=null, settingsDraft=null;
let plotMode='plot',plotModule=null,plotPreviewRevision=0,plotSubmitting=false,lastPlotOptions=null;
let plotLayoutDraft=null,plotPublishSource='saved',plotPreviewSheets=[],plotPreviewIndex=0;
let orbitMode=null, orbitPivot=null, pointerScalar=null, pointerUnavailable=null, gripPropertyIndices=new Map(),cubeDrag=null,cubeClickSuppressed=false;
let selectedViewportId=null,pageSetupLayoutId=null,renderContext=null,subobjectMode='whole',selectedSubobject=null,overlapCycle=null,viewportNavigationDraft=null;
let viewportNavigationTimer=null,viewportFrameRequest=null,viewportPointerScreen=null,viewportScaleTarget=null;
let architectureGableCandidates=null,architectureGableBoundary='',architectureGableConfirmed='';
let architectureBearingBoundary='',architectureBearingConfirmed='',architectureBearingDraftEdited=false,architectureBearingUnresolved=[];
let architecturePitchBoundary='',architecturePitchConfirmed='',architecturePitchDraftEdited=false,architecturePitchUnresolved=[];
let architectureRoofPreviewTimer=null,architectureRoofPreviewRevision=0,architectureRoofPreviewCache=null;
let architectureFootprintConfirmed='',architectureReviewHighlight=null;
let selectedRoofComponent=null;
let roofDragPreviewGeneration=0,roofDragPreviewRequest=0;
const roofPreviewClient=createRoofPreviewClient({onEvent:receiveRoofPreviewEvent});
let canvasMenu=null,lastRepeatableCommand=null,toolHelpTarget=null,canvasMenuDismissPointerId=null;
let onePointSnap=null;
let trimPointerExtend=false,trimFenceExtend=false;
const pointObservedEditors=new WeakSet();
let architectureTab='walls',architectureBoundaryEntityId=null,architectureInputEditor=null,architectureInputUnits=null,architectureSpaceContext='',architectureTrayContext='';
let architectureAlternativeStudy={status:'idle',report:null,selectedId:'',reviewedId:'',editor:null,document:'',fields:'',runId:0,search:null,controller:null,message:''};
let architectureAlternativeDefaults='';
let structuralBridge={editor:null,snapshot:null,catalog:null,exportRecord:null,result:null,status:'idle',message:'',busy:false,focus:null,assignments:[],assignmentOwner:null,assignmentPreview:null,nextAssignmentId:1,loadedSelection:null,assignmentProtocol:2,boundaryInspection:null};
let structuralBoundaryDraft=null;
const commandCatalog=[
  {name:'STRUCTURALBRIDGE',aliases:[],group:'Architecture',icon:'box',summary:'Export a selected roof region for an optional external roof-live comparison.',options:'Accepted roof group/component/face · Explicit member tributary area in SF · Native JSON export · Import a matching external result',limits:'Read-only exchange. Each face retains its own pitch; the same explicitly entered member area is compared at every selected pitch. No member sizing, capacity, load-path allocation or code-compliance approval.',example:'STRUCTURALBRIDGE → choose accepted roof faces → enter member tributary SF → Export request'},
  {name:'ARCHITECTURE',aliases:[],group:'Architecture',icon:'box',summary:'Edit semantic walls, rooms, hip/gable roofs and bounded ceiling-space alternatives.',options:'Walls & openings · Rooms · Roof · Space study · Alternatives · Report & status',limits:'Bounded orthogonal HIP/GABLE roofs without enclosed holes. Unsupported delayed-height contacts and consumed supports are rejected. Declared clearance envelopes do not certify engineered framing.',example:'ARCHITECTURE → Walls & openings'},
  {name:'WALL',aliases:[],group:'Architecture',icon:'line',summary:'Add an architectural wall with exact local coordinates.',options:'Building-local start/end XY · Thickness · Center/left/right reference · Base and bearing elevations · Support role',limits:'Opens the Architecture wall tool. Uses existing drawing length input. Structural bearing is a user declaration, not engineering approval.',example:'WALL → Start 0,0 → End 20\',0 → Add straight wall'},
  {name:'WALLFROM',aliases:[],group:'Architecture',icon:'polyline',summary:'Create architectural walls from a confirmed vector path.',options:'Select one horizontal model LINE, polyline or rectangle · Choose reference face and thickness',limits:'Captures the selected geometry as semantic source and retains the original drafting path. Later drafting-path edits do not edit the walls. Unsupported geometry is rejected rather than approximated.',example:'Select a closed PLINE → WALLFROM → Convert selected path to walls'},
  {name:'WALLHEIGHT',aliases:[],group:'Architecture',icon:'line',summary:'Edit an architectural wall bearing/top elevation.',options:'Select existing wall in Architecture · Base and bearing/top elevations · Support role',limits:'Room ceiling elevation remains a separate control. Linked roof support conflicts and unsupported height contacts reject the source edit.',example:'WALLHEIGHT → choose wall → edit bearing elevation → Apply'},
  {name:'ROOM',aliases:[],group:'Architecture',icon:'rectangle',summary:'Recognize wall-enclosed rooms and store ceiling intent.',options:'Recognize rooms · Label · Current/target ceiling elevation',limits:'Ceiling intent is separate from bearing. Use ROOFSPACE for a mathematical fixed-roof study with optional thickness and reservation envelopes.',example:'ROOM → Recognize rooms → choose room → Apply room intent'},
  {name:'ROOFSPACE',aliases:[],group:'Architecture',icon:'measure',summary:'Calculate usable finished ceiling space beneath a fixed roof.',options:'Room · Zero thickness by default · Optional roof and ceiling thickness · Reservation boxes · Headroom · Flat ceiling or rectangular tray proposal',limits:'One flat ceiling or one rectangular tray under a single validated roof. Roof geometry remains fixed. Thickness offsets can be added anytime.',example:'ROOFSPACE → choose room → save study intent'},
  {name:'ROOFOPTIMIZE',aliases:[],group:'Architecture',icon:'measure',summary:'Compare a bounded grid of ceiling and optional roof alternatives.',options:'Fixed roof by default · Explicit co-design · Unit-aware ceiling elevations and tray insets · Permitted pitches and uniform bearing offsets · Bounded search · Review one row before Apply',limits:'Partial physical quantity comparison and capped target-space benefit. No global optimum, complete cost, framing verification or supplier approval is claimed. Incomplete searches cannot be applied.',example:'ROOFOPTIMIZE → choose a room and roof → Search → inspect a row → confirm review → Apply'},
  {name:'ROOFSECTION',aliases:[],group:'Architecture',icon:'measure',summary:'Add a dimensioned snapshot section through a fixed-roof room study.',options:'Space study · Along building X/Y · Crossing coordinate · Model-space drawing origin',limits:'Ordinary geometry and measured labels are a snapshot, not an associative structural detail. Requires a supported clearance study.',example:'ROOFSECTION → section axis and crossing coordinate → Add section to model space'},
  {name:'ROOF',aliases:[],group:'Architecture',icon:'box',summary:'Generate a HIP or GABLE roof from an orthogonal footprint and declared bearing elevations.',options:'Selected closed path or wall perimeter · 23 group-default pitches · Per-edge pitch overrides · Eave/rake overhang · Explicit terminal gable ends · Per-edge bearing overrides',limits:'One simple orthogonal coverage loop. Pitch, bearing and gable drafts require confirmation. Mixed pitches are bounded to supported rectangular roofs. Unsupported height contacts and consumed supports reject the edit; framing remains unverified.',example:'ROOF → inspect bearing edges → enter and confirm elevations → confirm gable ends → Apply'},
  {name:'ROOFGABLE',aliases:[],group:'Architecture',icon:'box',summary:'Assign and confirm terminal gable ends on an orthogonal roof.',options:'HIP/GABLE selector · Explicit/All gable policy · Geometric edge keys · Bounded assignment suggestions',limits:'Unsupported or unresolved assignments produce diagnostics. Vertical gable closures are separate zero-thickness surfaces.',example:'ROOFGABLE → choose roof → inspect ends → confirm selected gable ends'},
  {name:'ROOFPITCH',aliases:[],group:'Architecture',icon:'box',summary:'Set group-default and per-edge roof pitches in half-rise increments.',options:'1:12 through 12:12 in 0.5-rise increments · Inspect named coordinate edges · Enable overrides such as rear 6:12 and front 8:12',limits:'Mixed pitches are bounded to supported rectangular HIP/GABLE roofs. Confirm pitch, bearing and gable drafts before Apply; accepted source and generated geometry change as one Undo group.',example:'ROOFPITCH → choose 4.5:12 → Apply roof parameters'},
  {name:'ROOFUPDATE',aliases:[],group:'Architecture',icon:'box',summary:'Regenerate architectural geometry from accepted source.',options:'Current walls, rooms and roof groups',limits:'Validation diagnostics remain visible; unsuccessful geometry is not reported current.',example:'ROOFUPDATE'},
  {name:'ROOFREPORT',aliases:[],group:'Architecture',icon:'measure',summary:'Inspect architectural quantities, status and assumptions.',options:'Source revision · Accepted alternative ID · Geometry/drainage status · Quantities and unverified framing',limits:'No complete material cost, supplier approval or ceiling-space certification. Truss design/manufacturing complexity surcharge is zero.',example:'ROOFREPORT'},
  {name:'ROOFDETACH',aliases:[],group:'Architecture',icon:'copy',summary:'Copy selected generated architecture to ordinary editable geometry.',options:'Select generated walls, room boundaries or roof surfaces · ROOFDETACH · Undo restores the previous drawing',limits:'The copies lose architectural association. The original architectural source and its generated geometry remain authoritative; copied geometry is outside architectural quantity reports.',example:'Select a generated roof → ROOFDETACH'},
  {name:'LINE',aliases:['L'],group:'Draw',icon:'line',summary:'Draw connected individual line segments.',options:'Successive points or direct lengths after the first point · Undo (U) · Close (C) · Enter to finish',limits:'Straight planar or spatial paths on the active UCS plane. A direct length follows the eligible pointer direction; without one it follows the previous segment or the UCS X axis.',example:'L → 0,0 → @100,0 → @0,60 → Enter'},
  {name:'PLINE',aliases:['PL'],group:'Draw',icon:'polyline',summary:'Draw one polyline with straight segments.',options:'Successive vertices or direct lengths after the first point · Undo (U) · Close (C) · Enter to finish',limits:'Arc segments, width and bulges are unavailable. Direct lengths use the pointer direction, previous segment, or +X.',example:'PL → 0,0 → 80,0 → 80,40 → C'},
  {name:'ARC',aliases:['A'],group:'Draw',icon:'arc',summary:'Draw a circular arc through three points.',options:'Start point · Point on the arc · End point',limits:'Three-point construction only. Center, angle, direction, length and tangent construction modes are unavailable.',example:'A → 0,0 → 50,50 → 100,0'},
  {name:'RECTANG',aliases:['REC'],group:'Draw',icon:'rectangle',summary:'Draw a rectangle from opposite corners.',options:'Two opposite corners',limits:'Opposite corners define a rectangle in the active UCS plane. Non-world planes are stored as exact spatial paths. Chamfer, fillet and thickness construction options are unavailable.',example:'REC → 0,0 → 100,60'},
  {name:'CIRCLE',aliases:['C'],group:'Draw',icon:'circle',summary:'Draw a circle from a center and size.',options:'Center + radius · Diameter (D)',limits:'2P, 3P and tangent constructions are unavailable.',example:'C → 50,30 → D → 20'},
  ...[
    {name:'ELLIPSE',aliases:['EL'],group:'Draw',icon:'ellipse',summary:'Draw a full analytic ellipse from two axes.',options:'Two first-axis endpoints, or Center (C) + first-axis endpoint · Other-axis distance or point',limits:'Full planar ellipse only. Elliptical arcs, isocircles and rotation-based axis construction are unavailable. Either axis may be the longer one.',example:'EL → 0,0 → 40,0 → 10'},
    {name:'SPLINE',aliases:['SPL'],group:'Draw',icon:'spline',summary:'Construct an open cubic B-spline with control vertices.',options:'4–1024 control vertices · Method: CV · Local Undo (U) · Enter to finish',limits:'Stored degree-three clamped B-spline geometry. Fit-point interpolation, periodic closing, other degrees and rational weights are unavailable; intermediate control vertices need not lie on the curve.',example:'SPL → 0,0 → 0,40 → 40,40 → 40,0 → Enter'},
    {name:'HATCH',aliases:['H','BH'],group:'Draw',icon:'hatch',summary:'Fill one closed boundary with a solid or parallel-line pattern.',options:'Solid or Parallel · Parallel angle and positive spacing · Pick a closed boundary edge',limits:'One rectangle, closed straight polyline, circle or ellipse; the boundary is captured without association. Islands, multiple loops and native pattern libraries are unavailable. Pattern and aggregate geometry limits prevent excessive fills.',example:'H → Parallel → 45 → 5 → pick a rectangle edge'},
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
  {name:'CYLINDER',aliases:['CYL'],group:'Model',icon:'cylinder',summary:'Create a faceted cylinder along the active plane normal.',options:'Center X,Y,Z · Positive radius · Signed nonzero height',limits:'A 32-sided polygon mesh along the UCS plane normal. Elliptical cylinders and native solid construction options are unavailable.',example:'CYLINDER → 60,0,0 → 10 → 30'},
  {name:'SPHERE',aliases:[],group:'Model',icon:'sphere',summary:'Create a faceted sphere around an exact center.',options:'Center X,Y,Z · Positive radius',limits:'A polygon mesh with 16 latitude and 32 longitude divisions. Native analytic solid/B-rep geometry is unavailable.',example:'SPHERE → 100,0,20 → 15'},
  {name:'EXTRUDE',aliases:['EXT'],group:'Model',icon:'extrude',summary:'Extrude a planar surface or closed profile into a mesh.',options:'Select planar MESH / closed RECTANG / PLINE / POLY3D / circle · Enter · Signed height',limits:'Extrusion follows the surface or profile normal and retains the source. Mesh surfaces require one simple boundary without holes or overlaps. Circle extrusion is a 32-sided mesh. Taper, path and native solid association are unavailable.',example:'Select rectangle → EXTRUDE → 25'},
  {name:'3DPOLY',aliases:[],group:'Model',icon:'polyline',summary:'Draw a 3D outline; Close creates a surface when it is planar.',options:'X,Y,Z or @offset · Successive points · U · C · Enter',limits:'Close creates one editable mesh from a simple planar outline of up to 4096 vertices, preserving XYZ. Open, nonplanar or unsupported outlines stay paths. Existing saved paths remain paths. Pointer points use the labeled active plane or a snapped feature.',example:'3DPOLY → 0,0,0 → 40,0,0 → 40,40,0 → C → EXTRUDE'},
  {name:'ROTATE3D',aliases:[],group:'Model',icon:'rotate',summary:'Rotate selected meshes or 3D paths around a world axis.',options:'Selection · X / Y / Z axis · Base X,Y,Z · Signed angle',limits:'World-axis rotation only. Arbitrary two-point axes and native gizmos are unavailable.',example:'Select box → ROTATE3D → Z → 0,0,0 → 45'},
  {name:'3DORBIT',aliases:['ORBIT'],group:'Model',icon:'orbit',summary:'Orbit the camera while retaining world Z as up.',options:'Left drag in Orbit mode · Shift + middle drag transient orbit · Enter / Esc exits',limits:'Auto Target uses selected or visible geometry; disabling it acquires a click target. Navigation changes view only.',example:'3DORBIT → drag left/right or up/down → Esc'},
  {name:'3DFORBIT',aliases:[],group:'Model',icon:'orbit',summary:'Orbit freely with an original arcball, including roll.',options:'Drag inside arcball for free rotation · Outside for roll · Ctrl + Shift + middle drag',limits:'Changes the camera rather than object coordinates. Object editing resumes after leaving orbit mode.',example:'3DFORBIT → drag around the arcball → Esc'},
  {name:'3DORBITCTR',aliases:[],group:'Model',icon:'orbit',summary:'Specify the center used for orbiting.',options:'Center X,Y,Z · Constrained orbit around that stationary point',limits:'The rotation pivot is separate from the camera look-at point. An off-screen center retains the default orbit center.',example:'3DORBITCTR → 20,15,10 → drag → Esc'},
  {name:'VPOINT',aliases:[],group:'Model',icon:'orbit',summary:'Set a 3D view from an exact direction vector.',options:'Nonzero X,Y,Z viewing vector',limits:'World direction vectors only; native compass dialogs and spherical entry are unavailable.',example:'VPOINT → 1,-1,1'},
  {name:'PLAN',aliases:[],group:'Model',icon:'fit',summary:'Align the view to the current UCS or World XY plane.',options:'Current UCS (Enter) / World (W)',limits:'Changes view direction only; the UCS origin and axes remain unchanged.',example:'PLAN → Enter'},
  {name:'LAYOUT',aliases:['LO'],group:'Settings',icon:'rectangle',summary:'Create and manage named paper layouts.',options:'New / Set / Delete / Rename · Paper layout tabs',limits:'Page size is assigned separately in Page setup. Paper objects use millimeters and model geometry remains in its model units.',example:'LAYOUT → New → Sheet 1'},
  {name:'PAGESETUP',aliases:[],group:'Settings',icon:'settings',summary:'Assign paper size and orientation to a layout.',options:'Preset paper sizes · Portrait / Landscape · Layout name',limits:'One validated edit with Undo. Existing viewport frames retain their paper coordinates when page size changes. Frames may extend beyond the paper and are clipped when plotted.',example:'PAGESETUP → A3 landscape → Apply'},
  {name:'LAYER',aliases:['LA'],group:'Settings',icon:'settings',summary:'Manage drawing layers and per-viewport visibility.',options:'On / Lock / Color / Lineweight / Linetype / Model / Paper / Plot / VP Freeze',limits:'Paper visibility governs both paper annotations and model content projected through sheet viewports. VP Freeze applies to the selected viewport.',example:'LA → edit a layer cell'},
  {name:'PAN',aliases:['P'],group:'Navigate',icon:'pan',summary:'Move the current drawing view without changing object coordinates.',options:'Left drag in Pan mode · Middle drag without starting a command · Enter / Esc exits',limits:'Uses the existing model, sheet or viewport navigation controls. Locked viewport behavior and viewport scale rules remain unchanged.',example:'P → drag the view → Enter'},
  {name:'MVIEW',aliases:['MV'],group:'Navigate',icon:'rectangle',summary:'Create a rectangular or closed polygon model viewport on paper.',options:'Two opposite paper corners · Polygonal (P) vertices + Close · Object (O) closed polyline / rectangle · Frame grips / scale / view / lock',limits:'Simple straight boundaries, up to 64 polygon vertices. Source boundaries remain separate. Frame edits and ratios do not rescale model objects; new viewports are unlocked.',example:'MVIEW → 10,10 → 200,140'},
  {name:'MSPACE',aliases:['MS'],group:'Navigate',icon:'select',summary:'Edit model geometry through a paper viewport.',options:'Double-click inside a viewport or enter MSPACE',limits:'A locked viewport keeps its view and ratio; wheel and middle drag navigate the sheet while model space stays active.',example:'Double-click inside a viewport'},
  {name:'PSPACE',aliases:['PS'],group:'Navigate',icon:'select',summary:'Return to editing paper annotations and viewport frames.',options:'Double-click outside an active viewport or enter PSPACE',limits:'Paper coordinates use millimeters independently of the model units.',example:'PSPACE'},
  {name:'MODEL',aliases:[],group:'Navigate',icon:'select',summary:'Return to the standalone model drawing.',options:'Model tab or MODEL',limits:'Preserves paper layouts and saved viewport views.',example:'MODEL'},
  {name:'UCS',aliases:[],group:'Model',icon:'orbit',summary:'Choose the coordinate system used for construction.',options:'World / XY / XZ / YZ · 3point in world coordinates · Planar mesh face',limits:'Typed spatial coordinates use this UCS; pointer acquisition stays in the labeled construction plane. View presets and PLAN do not change the UCS.',example:'UCS → 3 → 0,0,0 → 1,0,0 → 0,0,1'},
  {name:'TEXT',aliases:['DT'],group:'Annotate',icon:'text',summary:'Place one line of drawing text.',options:'Insertion point · Height · Rotation · Text content · Named text style',limits:'One line per object, up to 2048 encoded exchange bytes. Supported registered font profiles provide measured text metrics when available; legacy styles retain their original metrics. Inspect font availability in STYLE. Native justification and fields are unavailable.',example:'TEXT → 0,0 → 5 → 0 → Entrance'},
  {name:'MTEXT',aliases:['T','MT'],group:'Annotate',icon:'mtext',summary:'Place multiline text or edit retained formatted source.',options:'Two opposite text-box corners · Height (H) · Multiline editor · Imported source fonts, heights, widths, tracking, paragraphs and decorations',limits:'New objects use plain text, top-left insertion and a positive width. Imported rich MTEXT retains editable formatting source and attachment; supported controls use shared layout and measured profiles. Unsupported controls produce diagnostics. Fields, columns and full native MTEXT compatibility are unavailable.',example:'MTEXT → 0,50 → 80,10 → enter multiline text'},
  {name:'LEADER',aliases:['LE'],group:'Annotate',icon:'leader',summary:'Place an editable leader with a text landing.',options:'Arrow point · Additional vertices · Enter · Text',limits:'Bounded straight XY leader with one text label. Use Properties for text, style, arrow and exact vertices; unsupported MLEADER options are not implied.',example:'LEADER → 0,0 → 10,10 → 25,10 → Enter → Note'},
  {name:'IMAGEFRAME',aliases:[],group:'Settings',icon:'settings',summary:'Set drawing-wide raster image frame display and plotting.',options:'0 Hidden · 1 Display and plot · 2 Display only',limits:'Applies to every raster image in this drawing. Image pixels and physical placement remain unchanged. Older drawings without a frame setting retain hidden frames.',example:'IMAGEFRAME → 1'},
  {name:'TEXTEDIT',aliases:['ED'],group:'Annotate',icon:'text',summary:'Edit the content of one text object.',options:'Select TEXT or MTEXT · Enter · Edit and apply',limits:'One text object at a time. Properties controls also edit height, rotation, style and multiline width.',example:'TEXTEDIT → select text → Enter → apply edited content'},
  {name:'DIMLINEAR',aliases:['DLI'],group:'Annotate',icon:'dimension',summary:'Measure a horizontal or vertical span.',options:'First origin · Second origin · Dimension placement · H / V axis choice',limits:'Definition points are independent of source objects. Measurements update from those points; automatic source-object association is unavailable.',example:'DIMLINEAR → 0,0 → 100,50 → 50,70'},
  {name:'DIMALIGNED',aliases:['DAL'],group:'Annotate',icon:'aligned',summary:'Measure the distance along two definition points.',options:'First origin · Second origin · Dimension placement',limits:'Straight aligned measurement with the chosen dimension style; definition points are independently editable.',example:'DIMALIGNED → 0,0 → 80,60 → 40,50'},
  {name:'DIMRADIUS',aliases:['DRA'],group:'Annotate',icon:'radius',summary:'Label the radius of a selected circle.',options:'Select circle · Label placement',limits:'A snapshot of the selected center/radius is stored; changing the source circle does not automatically change this dimension.',example:'DIMRADIUS → pick circle → place label'},
  {name:'DIMDIAMETER',aliases:['DDI'],group:'Annotate',icon:'diameter',summary:'Label the diameter of a selected circle.',options:'Select circle · Label placement',limits:'Circle sources only. The stored center and radius are independent of the source; automatic association is unavailable.',example:'DIMDIAMETER → pick circle → place label'},
  {name:'STYLE',aliases:['ST'],group:'Settings',icon:'settings',summary:'Choose and edit named drawing text styles.',options:'Font · Default height/rotation · Width factor · Create named style',limits:'Opens the original settings dialog. Choose the supported installed families and inspect availability. Font files and SHX assets are not included.',example:'STYLE → edit the text style → Apply settings'},
  {name:'DIMSTYLE',aliases:['D'],group:'Settings',icon:'dimension',summary:'Choose and edit named dimension styles.',options:'Text style/height · Closed filled arrow or architectural tick · Arrow/tick size · Gap · Measurement precision',limits:'Opens the original settings dialog. Each setting has a bounded validated value; full native dimension variable grammar is unavailable.',example:'DIMSTYLE → edit dimension style → Apply settings'},
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
  {name:'TRIM',aliases:['TR'],group:'Modify',icon:'trim',summary:'Trim unwanted portions to cutting boundaries; Quick uses all eligible edges.',options:'Quick / Standard · cuTting edges · Fence / Crossing / Quick freehand · Shift extends · Project · Edge (Standard) · eRase · Undo · Enter to finish',limits:'Quick is the default and erases an ordinary supported target when it cannot be trimmed. Use Mode → Standard to select boundaries explicitly. Analytic LINE, ARC, CIRCLE, straight PLINE/RECTANG/POLY3D targets; unsupported curves, hatch targets and generated architecture reject. View projection and bulk fences require orthographic views.',example:'TR → pick unwanted portion → Shift+pick to extend → U to undo locally → Enter'},
  {name:'EXTEND',aliases:['EX'],group:'Modify',icon:'extend',summary:'Extend an ordinary open path to a boundary; Shift trims instead.',options:'Quick / Standard · cuTting edges · Fence / Crossing · Shift trims · Project · Edge (Standard) · Undo · Enter to finish',limits:'Open LINE, ARC and straight polyline targets. Closed paths cannot be extended. Generated architecture, unsupported curves and perspective bulk selections reject without approximation.',example:'EX → pick near the endpoint to extend → Shift+pick to trim → Enter'},
  {name:'TRIMEXTENDMODE',aliases:[],group:'Settings',icon:'settings',summary:'Set this drawing to Standard (0) or Quick (1) trim/extend behavior.',options:'0 Standard · 1 Quick',limits:'Saved per drawing. Quick trimming can erase an untrimmable supported target; Standard first selects cutting boundaries.',example:'TRIMEXTENDMODE → 0'},
  {name:'EDGEMODE',aliases:[],group:'Settings',icon:'settings',summary:'Choose actual (0) or implied extended (1) cutting edges.',options:'0 No extend · 1 Extend',limits:'The implied edge setting applies to Standard trim/extend; unsupported natural-path extrapolation is rejected.',example:'EDGEMODE → 1'},
  {name:'PROJMODE',aliases:[],group:'Settings',icon:'settings',summary:'Choose trim/extend intersection projection for this drawing.',options:'0 None / true 3D · 1 UCS XY · 2 View',limits:'View uses an orthographic basis. Perspective View and perspective bulk selections are explicitly unsupported.',example:'PROJMODE → 1'},
  {name:'BREAK',aliases:['BR'],group:'Modify',icon:'break',summary:'Remove a portion between two points on a line.',options:'Select a line · First break point · Second break point',limits:'Straight LINE targets only. Input points are projected onto the selected line; both projected positions must lie within its segment.',example:'BR → select a line → first point → second point'},
  {name:'JOIN',aliases:['J'],group:'Modify',icon:'join',summary:'Join connected lines and open polylines into one polyline.',options:'Select connected lines / open polylines · Enter · Connected loops become closed polylines',limits:'Shared endpoints must coincide exactly; the chain cannot branch or be disconnected. Arcs, circles and already closed polylines cannot be joined.',example:'J → select connected lines → Enter'},
  {name:'EXPLODE',aliases:['X'],group:'Modify',icon:'explode',summary:'Convert rectangles or polylines into separate line segments.',options:'Select rectangles / polylines · Enter',limits:'Select only rectangles and polylines. Other selected types reject the edit; each resulting segment inherits the source properties.',example:'X → select a rectangle or polyline → Enter'},
  {name:'ERASE',aliases:['E'],group:'Modify',icon:'delete',summary:'Erase selected unlocked objects.',options:'Preselect objects, or select then Enter',limits:'Hidden and locked geometry cannot be erased.',example:'E → select objects → Enter'},
  {name:'COPYCLIP',aliases:[],group:'Clipboard',icon:'copy',shortcut:'Ctrl+C',summary:'Copy selected geometry to the drawing clipboard.',options:'Select objects · Enter',limits:'Native clipboard contains Linecraft geometry. Text fields use their normal copy behavior.',example:'Select objects → COPYCLIP'},
  {name:'CUTCLIP',aliases:[],group:'Clipboard',icon:'delete',shortcut:'Ctrl+X',summary:'Copy geometry, then remove it after a successful clipboard write.',options:'Select objects · Enter',limits:'A failed clipboard write retains the source geometry. Undo restores a completed cut.',example:'Select objects → CUTCLIP'},
  {name:'COPYBASE',aliases:[],group:'Clipboard',icon:'clipboard',shortcut:'Ctrl+Shift+C',summary:'Copy geometry with a specific placement base.',options:'Base point · Select objects · Enter; preselected objects are retained',limits:'The clipboard base is fixed for subsequent paste placement.',example:'COPYBASE → 0,0 → select objects → Enter'},
  {name:'PASTECLIP',aliases:[],group:'Clipboard',icon:'clipboard',shortcut:'Ctrl+V',summary:'Place geometry from the drawing clipboard.',options:'Destination point · Placement preview',limits:'Native paste reads recognized Linecraft geometry only. Browser mode keeps an internal drawing clipboard.',example:'PASTECLIP → 100,40'},
  {name:'PLOT',aliases:['PRINT'],group:'Output',icon:'plot',summary:'Produce a vector PDF from the current drawing.',options:'Current space / Model extents / One paper layout / Ordered paper layouts · Per-page preview · Color / grayscale / monochrome · Lineweights',limits:'Paper layouts retain their physical page sizes and saved viewport scales. Model extents support fit or exact scale. 3D views use projected wireframe. Physical printer jobs and native plot-style tables are unavailable.',example:'PLOT → Selected paper layouts → select and order sheets → Save ordered PDF'},
  {name:'PUBLISH',aliases:[],group:'Output',icon:'publish',summary:'Publish reusable sheet sets, temporary layout selections or saved drawings as one PDF.',options:'Current drawing: select and order up to 32 paper layouts; save up to 32 named sets · Per-page preview · Saved drawings: native picker for up to 20 files',limits:'Saved sets belong to this drawing and use exact layout IDs. Missing layouts and unsaved named selections block output until explicitly repaired or used as temporary. Set edits are drawing changes with Undo; publishing is read-only. Cross-document sets and batch DWG/DXF publishing are unavailable.',example:'PUBLISH → Current drawing layouts → choose saved set → review pages → Save ordered PDF'},
  {name:'UNDO',aliases:['U'],group:'Navigate',icon:'undo',shortcut:'Ctrl+Z',summary:'Undo the previous completed edit.',options:'Undo the latest edit or the active command’s supported local step',limits:'A finished multi-destination COPY is one undo group.',example:'U'},
  {name:'REDO',aliases:[],group:'Navigate',icon:'redo',shortcut:'Ctrl+Y',summary:'Restore the last undone completed edit.',options:'Redo latest undone edit',limits:'A new edit clears redo history.',example:'REDO'},
  {name:'ZOOM',aliases:['Z'],group:'Navigate',icon:'fit',summary:'Fit visible geometry or set an unlocked viewport scale.',options:'Extents (E) · Positive factorXP in an unlocked model viewport · Wheel zoom anchored at cursor',limits:'XP means paper millimeters per model coordinate unit. For an inch model, 25.4/96XP sets 1/8 inch per foot. General X zoom and a scale-list editor are unavailable. View scale is bounded; tiny or extreme geometry may remain below screen resolution.',example:'Z → E; inch-model viewport: Z → 25.4/96XP'},
  {name:'HELP',aliases:['?'],group:'Navigate',icon:'help',summary:'Search this command reference.',options:'Search by name, alias or task',limits:'The reference describes this application’s implemented scope.',example:'HELP'},
];
const unavailableCatalog=[
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
  ['PUBLISH','Publish current-drawing saved sheet sets, ordered layout selections or saved drawings.','Cross-document sheet sets and batch DWG/DXF publishing are unavailable.'],
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
const paperRenderOffset=()=>currentLayout()?.plotSettings?.renderOffsetMm||{x:0,y:0};
const physicalPaperToScreen=point=>worldToScreen(point,paperView(),width,height);
const paperToScreen=point=>{const offset=paperRenderOffset();return physicalPaperToScreen({...point,x:point.x+offset.x,y:point.y+offset.y});};
const screenToPaper=point=>{const physical=screenToWorld(point,paperView(),width,height),offset=paperRenderOffset();return{...physical,x:physical.x-offset.x,y:physical.y-offset.y};};
const renderingViewport=()=>renderContext?renderContext.viewport||null:currentViewport();
const modelWorkspace=()=>renderContext?renderContext.viewport?.workspace==='3d':currentViewport()?currentViewport().workspace==='3d':!paperSpace()&&state().workspace==='3d';
const activePlane=()=>editor.getConstructionPlane?editor.getConstructionPlane():{origin:{x:0,y:0,z:state().settings?.constructionElevation??0},xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:1,z:0},normal:{x:0,y:0,z:1}};
function camera3D(){const viewport=renderingViewport();if(!viewport)return state().camera3d||view3d.defaultCamera();const camera={...viewport.camera3d,target:{...viewport.modelCenter},scale:paperView().scale*geometry.modelUnitMillimeters(state().settings)/viewport.scaleDenominator,projection:'orthographic'},center=paperToScreen({x:viewport.frame.x+viewport.frame.width/2,y:viewport.frame.y+viewport.frame.height/2}),axes=view3d.cameraBasis(camera),dx=(width/2-center.x)/camera.scale,dy=(center.y-height/2)/camera.scale;camera.target={x:camera.target.x+axes.right.x*dx+axes.up.x*dy,y:camera.target.y+axes.right.y*dx+axes.up.y*dy,z:(camera.target.z||0)+axes.right.z*dx+axes.up.z*dy};return camera;}
const toScreen = point => {const viewport=renderingViewport();if(viewport&&geometry.viewportModelToPaper){try{const projected=geometry.viewportModelToPaper(point,viewport,state().settings);return{...paperToScreen(projected),depth:projected.depth,clipped:false};}catch{return{x:NaN,y:NaN,depth:NaN,clipped:true};}}return paperSpace()&&!renderContext||renderContext?.space==='paper'?paperToScreen(point):modelWorkspace()?view3d.projectPoint(point,camera3D(),width,height):worldToScreen(point,state().viewport,width,height);};
const toWorld = point => {if(paperSpace())return screenToPaper(point);if(modelWorkspace()){const ray=view3d.screenRay(point,camera3D(),width,height);return geometry.intersectPlaneRay?geometry.intersectPlaneRay(ray,activePlane()):view3d.intersectConstructionPlane(ray,state().settings?.constructionElevation??0);}const viewport=currentViewport();return viewport&&geometry.viewportPaperToModel?geometry.viewportPaperToModel(screenToPaper(point),viewport,state().settings):screenToWorld(point,state().viewport,width,height);};
const viewScale=()=>renderingViewport()?paperView().scale*geometry.modelUnitMillimeters(state().settings)/renderingViewport().scaleDenominator:paperSpace()||renderContext?.space==='paper'?paperView().scale:state().viewport.scale;
function inkFor(entity,color){const layer=layerFor(entity),ink=color||entity.color||layer?.color||'#dce5e9',source=entity.color!==undefined?entity.colorSource:layer?.colorSource;if(color)return color;if(source==='aci-7')return currentLayout()?'#000000':'#ffffff';if(source==='true-color'||!currentLayout())return ink;const rgb=/^#[a-f\d]{6}$/i.test(ink)?[1,3,5].map(index=>parseInt(ink.slice(index,index+2),16)):null;return rgb&&rgb.every(value=>value>190)?'#263742':ink;}
const is3DEntity=entity=>['MESH','POLY3D'].includes(entity.type);
const spatialCurve=entity=>['CIRCLE3D','ARC3D'].includes(entity.type);
const modalIds=['annotation-dialog','settings-dialog','plot-dialog','page-setup-dialog','viewport-scale-dialog','layer-manager-dialog','architecture-dialog','structural-bridge-dialog','structural-boundary-dialog'];
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
  const roofEdges=roofDisplayEdges(entity,state().architecture,state().architectureDerived);if(roofEdges!==null)return roofEdges.map(edge=>[edge.a,edge.b]);
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
function setCamera(camera,{rawViewport=false}={}){discardRoofGripDraft();flushViewportNavigation();const viewport=currentViewport();if(viewport&&!rawViewport){const center=paperToScreen({x:viewport.frame.x+viewport.frame.width/2,y:viewport.frame.y+viewport.frame.height/2}),axes=view3d.cameraBasis(camera),scale=viewScale(),dx=(width/2-center.x)/scale,dy=(center.y-height/2)/scale;camera={...camera,target:{x:camera.target.x-axes.right.x*dx-axes.up.x*dy,y:camera.target.y-axes.right.y*dx-axes.up.y*dy,z:(camera.target.z||0)-axes.right.z*dx-axes.up.z*dy}};}const result=editor.set3DView(camera);if(result.ok===false)addLog(result.message,'error');return result;}
function setWorkspace(mode){discardRoofGripDraft();flushViewportNavigation();editor.setWorkspace(mode);orbitMode=null;orbitPivot=null;panTool=false;drag=null;pointer=null;snap=null;pointerScalar=null;pointerUnavailable=null;update();resized();}
function sceneForOrbit(){const entities=visibleEntities();return (orbitMode||drag?.mode==='orbit')&&camera3D().autoTarget&&state().selectionIds.length?entities.filter(entity=>state().selectionIds.includes(entity.id)):entities;}
function visibleInView(entity){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const point of geometry.entityPoints(entity,drawingContext())){const p=view3d.projectPoint(point,camera3D(),width,height);if(p.clipped||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}return maxX>=0&&minX<=width&&maxY>=0&&minY<=height;}
function startOrbit(mode,screen=null,{explicit=false}={}){
  discardRoofGripDraft();
  if(!modelWorkspace())editor.setWorkspace('3d');orbitMode=mode;panTool=false;closePalettes();hideCompletion();
  if(explicit&&camera3D().orbitCenter)orbitPivot={...camera3D().orbitCenter};
  else if(camera3D().autoTarget){const selected=visibleEntities().filter(e=>state().selectionIds.includes(e.id)),shown=selected.length?selected:visibleEntities().filter(visibleInView);orbitPivot=view3d.bounds3D(modelPoints(shown))?.center||{...camera3D().target};}
  else orbitPivot=screen?(projectedPick(screen,visibleEntities())?.point||toWorld(screen)||{...camera3D().target}):(camera3D().orbitCenter||{...camera3D().target});
  update();
}
function projectedSnap(screen,{excludeRoofGroupId=null,modes=state().settings?.snapModes||[],anchor=pointSnapAnchor()}={}){
  if(!insideActiveViewport(screen))return null;
  const entities=visibleEntities().filter(entity=>!excludeRoofGroupId||architectureOwner(entity)?.kind!=='roofGroup'||architectureOwner(entity)?.id!==excludeRoofGroupId),meshes=entities.filter(e=>e.type==='MESH');let winner=null;
  for(const entity of entities.filter(e=>e.id!==drag?.entityId&&e.id!==ordinaryGripStage?.entityId)){
    const candidates=geometry.snapCandidates?geometry.snapCandidates(entity,drawingContext(),{anchor:modes.includes('perpendicular')?anchor:null}):entity.type==='CIRCLE'||entity.type==='ARC'?[{point:entity.center,type:'center'},...(entity.type==='CIRCLE'?geometry.entityPoints(entity,drawingContext()).map(point=>({point,type:'quadrant'})):[{point:geometry.arcPoint(entity,0),type:'endpoint'},{point:geometry.arcPoint(entity,1),type:'endpoint'},{point:geometry.arcPoint(entity,.5),type:'midpoint'}])]:pointsOf(entity).map(point=>({point,type:'endpoint'}));
    if(!geometry.snapCandidates&&!['TEXT','MTEXT','DIMENSION','CIRCLE','ARC'].includes(entity.type))for(const[a,b]of projectionEdges(entity))candidates.push({point:{x:a.x+(b.x-a.x)/2,y:a.y+(b.y-a.y)/2,z:(a.z??0)+((b.z??0)-(a.z??0))/2},type:'midpoint'});
    for(const candidate of candidates){if(!modes.includes(candidate.type)||ordinaryGripStage&&!ordinaryGripPointOnPlane(candidate.point,ordinaryGripStage.plane))continue;const p=toScreen(candidate.point),distance=Math.hypot(p.x-screen.x,p.y-screen.y);if(p.clipped||!insideActiveViewport(p)||distance>10||modelWorkspace()&&camera3D().renderMode==='shaded'&&view3d.pointOccluded(candidate.point,meshes,camera3D(),width,height))continue;if(!winner||distance<winner.distance-1e-6||Math.abs(distance-winner.distance)<1e-6&&candidate.type==='endpoint')winner={...candidate,point:{...candidate.point,z:candidate.point.z??0},distance,entityId:entity.id};}
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
function contentFingerprint(value){return JSON.stringify(canonicalContent({entities:value.entities,layers:value.layers,currentLayer:value.currentLayer,settings:value.settings,textStyles:value.textStyles,dimStyles:value.dimStyles,currentTextStyle:value.currentTextStyle,currentDimStyle:value.currentDimStyle,blocks:value.blocks||[],layouts:value.layouts||[],sheetSets:value.sheetSets||[],imageResources:value.imageResources||[],rasterSettings:value.rasterSettings,ucs:value.ucs,architecture:value.architecture||null}));}
function isDirty() {return importedAwaitingSave||documentFingerprint() !== savedFingerprint;}
function serializedDrawing() {
  const value=editor.serialize();return typeof value==='string'?value:JSON.stringify(value,null,2);
}
function documentInfo() {return {dirty:isDirty(),name:documentName,text:serializedDrawing()};}
function syncDesktop() {if(desktop)desktop.setDocumentState(documentInfo());}
function displayName(name) {return String(name||'Untitled drawing').replace(/\.linecraft\.json$/i,'').replace(/\.json$/i,'');}
savedFingerprint=documentFingerprint();
const developmentState={restored:false,restoreError:null,historyReset:false,activeCommandCanceled:false};
let developmentBinding=null,developmentTargetVerified=false,developmentNegotiationEpoch=0;
let developmentNegotiationPromise=null,developmentNegotiationCancel=null;
const validDevelopmentBinding=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function consumeDevelopmentBinding(reply){
  if(!developmentMode)return;
  developmentNegotiationEpoch++;developmentNegotiationCancel?.();developmentNegotiationCancel=null;developmentNegotiationPromise=null;
  developmentBinding=validDevelopmentBinding(reply?.developmentBinding)?reply.developmentBinding:null;
  developmentTargetVerified=developmentBinding!==null;
}
function negotiateDevelopmentRecovery(){
  if(!developmentMode||developmentTargetVerified)return Promise.resolve(true);
  if(developmentNegotiationPromise)return developmentNegotiationPromise;
  let recover;
  try{recover=desktop?.developmentRecovery;}catch{return Promise.resolve(false);}
  if(typeof recover!=='function')return Promise.resolve(false);
  const epoch=developmentNegotiationEpoch,binding=developmentBinding;
  let active=true,finish;
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys;
  developmentNegotiationPromise=new Promise(resolve=>{
    const timer=setTimeout(()=>finish(false),1000);
    finish=value=>{if(!active)return;active=false;clearTimeout(timer);resolve(value);};
    developmentNegotiationCancel=()=>finish(false);
  });
  Promise.resolve().then(async()=>{
    try{
      if(!active||epoch!==developmentNegotiationEpoch)return;
      const challenge=await recover.call(desktop,{version:1,action:'challenge'});
      if(!active||epoch!==developmentNegotiationEpoch)return;
      if(!exact(challenge,'challenge,ok')||challenge.ok!==true||!validDevelopmentBinding(challenge.challenge))return finish(false);
      const confirmation=await recover.call(desktop,{version:1,action:'confirm',challenge:challenge.challenge,binding});
      if(!active||epoch!==developmentNegotiationEpoch)return;
      if(!exact(confirmation,'matched,ok')||confirmation.ok!==true||typeof confirmation.matched!=='boolean')return finish(false);
      const matched=binding!==null&&confirmation.matched===true;
      developmentTargetVerified=matched;finish(matched);
    }catch{finish(false);}
  });
  return developmentNegotiationPromise;
}
const developmentCheckpointKey='linecraft-development-reload';
let developmentCheckpointTimer;
if(developmentMode){
  try {
    const raw=sessionStorage.getItem(developmentCheckpointKey)||localStorage.getItem(developmentCheckpointKey);
    if(raw){
      const checkpoint=JSON.parse(raw);
      if(![1,2].includes(checkpoint.version)||typeof checkpoint.text!=='string'||typeof checkpoint.savedFingerprint!=='string')throw new Error('Invalid drawing checkpoint.');
      const recovered=JSON.parse(checkpoint.text),baseline=JSON.parse(checkpoint.savedFingerprint);
      const legacyDrafting={gridEnabled:checkpoint.gridEnabled!==false,snapEnabled:checkpoint.snapEnabled!==false,orthoEnabled:checkpoint.orthoEnabled===true};
      if(!recovered.settings)recovered.settings=legacyDrafting;if(!baseline.settings)baseline.settings=legacyDrafting;
      editor=createEditor(recovered);documentName=checkpoint.name||'Untitled drawing';savedFingerprint=contentFingerprint(editorDocument(createEditor(baseline)));
      importedAwaitingSave=checkpoint.importedAwaitingSave===true;
      developmentBinding=checkpoint.version===2&&!importedAwaitingSave&&validDevelopmentBinding(checkpoint.developmentBinding)?checkpoint.developmentBinding:null;
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
    const checkpoint=JSON.stringify({version:2,developmentBinding,text:serializedDrawing(),name:documentName,savedFingerprint,importedAwaitingSave,gridEnabled,snapEnabled,orthoEnabled,time,activeCommandCanceled});
    localStorage.setItem(developmentCheckpointKey,checkpoint);
    if(localStorage.getItem(developmentCheckpointKey)!==checkpoint)throw new Error('Drawing checkpoint verification failed.');
    developmentState.lastCheckpointTime=time;developmentState.checkpointError=null;return checkpoint;
  }catch(error){developmentState.checkpointError=error.message;console.warn('Linecraft drawing checkpoint remains pending:',error.message);return false;}
}
if(developmentMode)void negotiateDevelopmentRecovery();
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
  $('command-suggestions').hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');completionItems=[];completionIndex=-1;completionSession=null;
}
function completionContext(){return{editor,command:state().command||null,phase:state().commandPhase||null,prompt:state().prompt||'',input:input.value};}
function completionCurrent(session=completionSession){if(!session)return false;const current=completionContext();return Object.keys(current).every(key=>current[key]===session[key]);}
document.addEventListener('pointermove',event=>{
  const position={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  completionPointerMovedEvent=completionPointerMoved(completionPointerPosition,position)?event:null;
  completionPointerPosition=position;
},{capture:true});
function renderCompletion({force=false}={}) {
  if(ordinaryGripStage||drag?.mode==='roof-component-grip'||documentActionBusy||editorDialogOpen()){hideCompletion();return;}
  completionItems=commandCompletions(commandCatalog,{input:input.value,command:state().command,prompt:state().prompt,phase:state().commandPhase,pointPrompt:commandPointPrompt(),perpendicularAvailable:Boolean(pointSnapAnchor()),force});
  if(!completionItems.length){hideCompletion();return;}
  completionSession=completionContext();const owner=completionSession;completionIndex=-1;const list=$('command-suggestions');list.replaceChildren();
  list.setAttribute('aria-label',state().command?`${state().command} prompt options`:'Command suggestions');
  completionItems.forEach((item,index)=>{
    const button=document.createElement('button');button.type='button';button.id=`command-option-${index}`;button.className='command-option';button.setAttribute('role','option');button.setAttribute('aria-selected','false');
    button.dataset.completionKind=item.kind;button.dataset.completionToken=item.token;button.tabIndex=-1;
    const name=document.createElement('strong');name.textContent=item.name;
    const alias=document.createElement('span');alias.className='completion-alias';alias.textContent=item.aliases.join(' / ')||item.group;
    const summary=document.createElement('small');summary.textContent=item.summary;button.append(name,alias,summary);
    button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('pointermove',event=>{if(completionPointerMovedEvent===event&&completionSession===owner&&completionCurrent(owner))selectCompletion(index,{scroll:false});});button.addEventListener('click',()=>{if(completionSession===owner&&acceptCompletion(index))submitCommandInput({key:'Enter',useCompletion:false});});list.append(button);
  });
  list.hidden=false;input.setAttribute('aria-expanded','true');selectCompletion(0,{scroll:false});
}
function selectCompletion(index,{scroll=true}={}) {
  if(!completionItems.length||!completionCurrent()){hideCompletion();return;}
  completionIndex=(index+completionItems.length)%completionItems.length;
  [...$('command-suggestions').children].forEach((item,i)=>{item.classList.toggle('selected',i===completionIndex);item.setAttribute('aria-selected',String(i===completionIndex));});
  input.setAttribute('aria-activedescendant',`command-option-${completionIndex}`);
  if(scroll)$('command-suggestions').children[completionIndex]?.scrollIntoView({block:'nearest'});
}
function acceptCompletion(index=completionIndex<0?0:completionIndex) {
  if(!completionCurrent()){hideCompletion();return false;}const item=completionItems[index];if(!item)return false;input.value=item.token;hideCompletion();input.focus({preventScroll:true});return true;
}
function commandCompletionState(){return{open:!$('command-suggestions').hidden,index:completionIndex,command:state().command||null,phase:state().commandPhase||null,items:completionItems.map(({name,token,kind,aliases,summary})=>({name,token,kind,aliases:[...aliases],summary}))};}
function closePalettes() {
  for(const id of ['draw','modify','clipboard','annotation','model','blocks','output']){$(`${id}-palette`).hidden=true;$(`${id}-tools`).setAttribute('aria-expanded','false');$(`${id}-tools`).classList.remove('active');}
}
function chooseTool(command) {
  if(commandName(command)==='STRUCTURALBRIDGE'){closePalettes();hideCompletion();showStructuralBridge();return;}
  discardRoofGripDraft();closePalettes();hideCompletion();if(state().command)editor.cancel();runCommand(command);input.focus();
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
  discardRoofGripDraft();
  closePalettes();hideCompletion();referenceCategory=category;$('reference-search-input').value='';renderReference();
  if(!$('reference-dialog').open)$('reference-dialog').showModal();$('reference-dialog').scrollTop=0;$('reference-search-input').focus();
}
const plotSavedDrawings=()=>plotMode==='publish'&&$('plot-publish-source').value==='saved';
const plotLayoutSet=()=>plotMode==='publish'?!plotSavedDrawings():$('plot-space').value==='layouts';
function ensurePlotLayoutDraft(){
  const layouts=state().layouts||[];
  if(plotLayoutDraft?.editor!==editor){const temporary={entries:layouts.map(layout=>({id:layout.id,selected:true})),name:''};plotLayoutDraft={editor,entries:temporary.entries,selectedSheetSetId:'',temporary,savedDrafts:new Map()};}
  for(const layout of layouts)if(!plotLayoutDraft.entries.some(row=>row.id===layout.id))plotLayoutDraft.entries.push({id:layout.id,selected:false});
  if(plotLayoutDraft.selectedSheetSetId){const info=editor.inspectSheetSet?.(plotLayoutDraft.selectedSheetSetId);if(info?.ok)for(const row of plotLayoutDraft.entries){const source=info.entries.find(entry=>entry.layoutId===row.id);if(source)row.lastKnownName=source.lastKnownName;}}
  return plotLayoutDraft;
}
function plotOrderedLayoutIds(){return ensurePlotLayoutDraft().entries.filter(row=>row.selected).map(row=>row.id);}
function plotSheetSets(){return editor.listSheetSets?.()||[];}
function plotSheetSetInspection(){const id=ensurePlotLayoutDraft().selectedSheetSetId;return id?(editor.inspectSheetSet?.(id)||{ok:false,error:'Saved sheet sets are unavailable.'}):null;}
function activePlotSheetDraft(){const draft=ensurePlotLayoutDraft();return draft.selectedSheetSetId?draft.savedDrafts.get(draft.selectedSheetSetId):draft.temporary;}
function plotSheetSetModified(info=plotSheetSetInspection()){return Boolean(info?.ok&&JSON.stringify(plotOrderedLayoutIds())!==JSON.stringify(info.layoutIds));}
function plotResolvedLayoutIds(){
  const draft=ensurePlotLayoutDraft(),ids=plotOrderedLayoutIds();if(!draft.selectedSheetSetId)return ids;
  const resolved=editor.resolveSheetSet?.(draft.selectedSheetSetId);if(!resolved?.ok)throw Error(`${resolved?.error||'The saved sheet set is unavailable.'} Repair the checklist and Update selection, or Use as temporary.`);
  if(JSON.stringify(ids)!==JSON.stringify(resolved.layoutIds))throw Error('The saved sheet set has an unsaved selection or order. Choose Update selection, Reload saved, or Use as temporary before output.');
  return [...resolved.layoutIds];
}
function renderPlotSheetSets(){
  const draft=ensurePlotLayoutDraft(),sets=plotSheetSets(),select=$('plot-sheet-set'),active=activePlotSheetDraft(),info=plotSheetSetInspection();
  fillOptions('plot-sheet-set',['',...sets.map(set=>set.id)],draft.selectedSheetSetId);select.options[0].textContent='Temporary selection';for(const option of [...select.options].slice(1)){const item=sets.find(set=>set.id===option.value);option.textContent=`${item.name}${item.valid?'':' · missing layouts'}`;}
  if(draft.selectedSheetSetId&&!sets.some(set=>set.id===draft.selectedSheetSetId)){const option=document.createElement('option');option.value=draft.selectedSheetSetId;option.textContent=`Missing saved set · ${active.name||draft.selectedSheetSetId}`;select.append(option);select.value=draft.selectedSheetSetId;}
  $('plot-sheet-set-name').value=active.name;refreshPlotSheetSetStatus(info);
}
function refreshPlotLayoutControls(){
  const draft=ensurePlotLayoutDraft(),selected=draft.entries.filter(row=>row.selected),busy=plotSubmitting||documentActionBusy;
  $('plot-layout-all').disabled=busy;$('plot-layout-none').disabled=busy;
  for(const row of $('plot-layout-order').children){const item=draft.entries.find(item=>item.id===row.dataset.layoutId);if(!item)continue;const index=selected.indexOf(item),check=row.querySelector('[data-plot-layout-selected]');if(check)check.disabled=busy;for(const button of row.querySelectorAll('[data-plot-layout-action]'))button.disabled=busy||(button.dataset.plotLayoutAction==='up'?index<=0:index<0||index===selected.length-1);}
}
function refreshPlotSheetSetStatus(info=plotSheetSetInspection()){
  const draft=ensurePlotLayoutDraft(),sets=plotSheetSets(),ids=plotOrderedLayoutIds(),named=Boolean(draft.selectedSheetSetId),modified=plotSheetSetModified(info),name=activePlotSheetDraft().name;
  const valid=ids.length>=1&&ids.length<=32&&ids.every(id=>state().layouts?.some(layout=>layout.id===id)),busy=plotSubmitting||documentActionBusy;
  $('plot-sheet-set-status').textContent=!named?`Temporary selection · ${sets.length} of 32 saved sets. Saving a definition changes this drawing; publishing does not.`:!info?.ok?'The saved definition no longer exists. Its working selection is retained. Use as temporary, or save it with a new name.':info.missingLayoutIds.length?`${info.missingLayoutIds.length} missing layout${info.missingLayoutIds.length===1?'':'s'} in the saved definition. Repair the checklist and Update selection before output, or Use as temporary.`:modified?'Unsaved selection or order. Update selection to change the saved definition, Reload saved to restore it, or Use as temporary.':'Saved selection is current. Set changes are saved with the drawing and have grouped Undo/Redo.';
  $('plot-sheet-set').disabled=busy;$('plot-sheet-set-name').disabled=busy;
  $('plot-sheet-set-new').disabled=busy;$('plot-sheet-set-save').disabled=busy||!valid||!name.trim()||sets.length>=32;
  $('plot-sheet-set-update').disabled=busy||!info?.ok||!valid||(!modified&&!info.missingLayoutIds.length);
  $('plot-sheet-set-rename').disabled=busy||!info?.ok||!name.trim()||name===info.name;
  $('plot-sheet-set-delete').disabled=busy||!info?.ok;$('plot-sheet-set-reload').disabled=busy||!info?.ok;$('plot-sheet-set-temporary').disabled=busy||!named;
  refreshPlotLayoutControls();
}
function choosePlotSheetSet(id,{reload=false}={}){
  if(plotSubmitting||documentActionBusy)return false;const draft=ensurePlotLayoutDraft();
  if(id&&(!draft.savedDrafts.has(id)||reload)){const info=editor.inspectSheetSet?.(id);if(!info?.ok){$('plot-sheet-set-error').textContent=info?.error||'The saved sheet set no longer exists.';renderPlotSheetSets();return false;}draft.savedDrafts.set(id,{name:info.name,entries:info.entries.map(entry=>({id:entry.layoutId,selected:true,lastKnownName:entry.lastKnownName}))});}
  draft.selectedSheetSetId=id;draft.entries=(id?draft.savedDrafts.get(id):draft.temporary).entries;ensurePlotLayoutDraft();$('plot-sheet-set-error').textContent='';renderPlotSheetSets();renderPlotLayoutOrder();void refreshPlotPreview();return true;
}
function usePlotSelectionAsTemporary({newName=false}={}){
  if(plotSubmitting||documentActionBusy)return;const draft=ensurePlotLayoutDraft(),name=newName?'':activePlotSheetDraft().name;draft.temporary={entries:draft.entries.map(row=>({...row})),name};choosePlotSheetSet('');if(newName)$('plot-sheet-set-name').focus();
}
function editPlotSheetSet(action){
  if(plotSubmitting||documentActionBusy)return;const draft=ensurePlotLayoutDraft(),id=draft.selectedSheetSetId,name=activePlotSheetDraft().name,layoutIds=plotOrderedLayoutIds();let result;
  if(action==='save')result=editor.createSheetSet({name,layoutIds});else if(action==='update')result=editor.updateSheetSet(id,{layoutIds});else if(action==='rename')result=editor.updateSheetSet(id,{name});else if(action==='delete')result=editor.deleteSheetSet(id);else return;
  resultLog(result);$('plot-sheet-set-error').textContent=result?.ok===false?(result.error||result.message||'The sheet set could not be changed.'):'';
  if(result?.ok===false){renderPlotSheetSets();return;}
  if(action==='save'||action==='update'){if(choosePlotSheetSet(result.sheetSetId||id,{reload:true})&&action==='update'){activePlotSheetDraft().name=name;renderPlotSheetSets();}return;}
  if(action==='delete'){choosePlotSheetSet('');return;}
  renderPlotSheetSets();renderPlotLayoutOrder();void refreshPlotPreview();
}
function renderPlotLayoutOrder(focus=null){
  const list=$('plot-layout-order'),draft=ensurePlotLayoutDraft(),layouts=state().layouts||[],selected=draft.entries.filter(item=>item.selected);list.replaceChildren();
  for(const [index,item]of draft.entries.entries()){
    const layout=layouts.find(layout=>layout.id===item.id),row=document.createElement('li');row.dataset.layoutId=item.id;
    const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=item.selected;check.dataset.plotLayoutSelected='';check.setAttribute('aria-label',`Include layout ${layout?.name||item.id}`);
    const text=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=layout?.name||`Missing layout${item.lastKnownName?`: ${item.lastKnownName}`:''}`;detail.textContent=layout?`${layout.id} · ${layout.paper.widthMm} × ${layout.paper.heightMm} mm · ${layout.viewports.length} viewport${layout.viewports.length===1?'':'s'}`:`${item.id} · missing from this drawing. Uncheck it, select any replacements, then Update selection if editing a saved set.`;text.append(name,detail);label.append(check,text);row.append(label);
    const selectedIndex=selected.indexOf(item);for(const [action,caption,disabled]of[['up','Up',selectedIndex<=0],['down','Down',selectedIndex<0||selectedIndex===selected.length-1]]){const button=document.createElement('button');button.type='button';button.dataset.plotLayoutAction=action;button.textContent=caption;button.disabled=disabled;button.setAttribute('aria-label',`Move ${layout?.name||item.id} ${action} in PDF order`);if(!item.selected)button.title='Select this layout before changing its PDF order.';row.append(button);}
    list.append(row);
  }
  if(!draft.entries.length){const empty=document.createElement('li');empty.className='plot-layout-empty';empty.textContent='No paper layouts. Create a layout before selecting sheets.';list.append(empty);}
  updatePlotLayoutCount();
  if(focus){const row=[...list.children].find(row=>row.dataset.layoutId===focus.id),requested=row?.querySelector(`[data-plot-layout-action="${focus.action}"]`);(requested&&!requested.disabled?requested:row?.querySelector('button:not(:disabled),input'))?.focus();}
}
function updatePlotLayoutCount(){const ids=plotOrderedLayoutIds();$('plot-layout-count').textContent=`${ids.length} selected · PDF order follows the checked layouts from top to bottom. Drawing tabs are unchanged.`;refreshPlotSheetSetStatus();}
function plotOptionsFromFields(){const multiple=plotLayoutSet(),space=multiple?'layouts':$('plot-space').value;return{space,layoutId:space==='layout'?$('plot-layout-id').value||null:null,...(multiple?{layoutIds:plotResolvedLayoutIds()}:{}),paper:$('plot-paper').value,orientation:$('plot-orientation').value,scaleMode:$('plot-mode').value,ratio:$('plot-scale').valueAsNumber,margin:$('plot-margin').valueAsNumber,colorMode:$('plot-color').value,lineweights:$('plot-lineweights').checked};}
function refreshPlotSpace(){
  const saved=plotSavedDrawings();if(saved&&$('plot-space').value==='layouts')$('plot-space').value='current';
  const multiple=plotLayoutSet(),space=$('plot-space').value,layout=space==='layout'?state().layouts?.find(item=>item.id===$('plot-layout-id').value):space==='current'?currentLayout():null;
  $('plot-publish-source-choice').hidden=plotMode!=='publish';$('plot-space-choice').hidden=plotMode==='publish'&&!saved;
  const setOption=$('plot-space').querySelector('option[value="layouts"]');setOption.disabled=saved;setOption.hidden=saved;
  $('plot-layout-choice').hidden=multiple||$('plot-space').value!=='layout';$('plot-layout-selection').hidden=!multiple;
  for(const id of ['plot-paper','plot-orientation','plot-mode','plot-scale','plot-margin'])$(id).disabled=multiple||Boolean(layout);
  $('plot-space-hint').textContent=multiple?'Select paper layouts and arrange their PDF page order. Each retains its own physical paper size and saved viewport scales.':layout?`${layout.name}: ${layout.paper.size}, ${layout.paper.widthMm} × ${layout.paper.heightMm} mm. Page setup and each saved viewport scale define this sheet.`:space==='layout'?'Choose a paper layout to plot.':'Model extents use the paper, fit or exact scale, and margin settings below.';
  $('plot-submit').textContent=saved?'Choose drawings & save PDF':multiple?'Save ordered PDF':'Save PDF';
  refreshPlotSheetSetStatus();
}
function renderPlotPreviewPage(index=0){
  plotPreviewIndex=Math.max(0,Math.min(index,plotPreviewSheets.length-1));const page=plotPreviewSheets[plotPreviewIndex];if(!page)return;
  const svg=new DOMParser().parseFromString(page.svg,'image/svg+xml').documentElement;
  if(svg.localName!=='svg'||svg.querySelector('parsererror,script,foreignObject'))throw Error('The sheet preview could not be generated.');
  for(const text of svg.querySelectorAll('text[data-cap-height]'))text.setAttribute('font-size',String(fontSizeForHeight(1,text.getAttribute('font-family'))));
  $('plot-preview').replaceChildren(document.importNode(svg,true));$('plot-preview-sheet').value=String(plotPreviewIndex);
  $('plot-preview-previous').disabled=plotPreviewIndex===0;$('plot-preview-next').disabled=plotPreviewIndex===plotPreviewSheets.length-1;
  $('plot-preview-navigation').hidden=plotPreviewSheets.length<2;
  const report=page.report,scale=report.space==='layout'?`Paper layout at 1:1 · ${report.viewports?.map(viewport=>`1:${viewport.scaleDenominator}`).join(' / ')||'no viewports'}`:page.whole.scaleMode==='scale'?`Exact scale 1:${page.whole.ratio}`:'Drawing extents fitted to sheet';
  $('plot-summary').textContent=`${plotPreviewSheets.length>1?`Page ${plotPreviewIndex+1} of ${plotPreviewSheets.length} · `:''}${report.layoutName?`${report.layoutName} · ID ${report.layoutId}\n`:''}${report.paper} · ${report.orientation}${report.widthMm?` · ${report.widthMm} × ${report.heightMm} mm`:''}\n${scale}${plotSavedDrawings()?'\nPreview shows the current drawing; chosen files become separate sheets.':''}${report.clipped?'\nGeometry extends beyond the printable sheet.':''}${report.warnings?.length?'\n'+report.warnings.join('\n'):''}`;
}
async function refreshPlotPreview(){
  const revision=++plotPreviewRevision,previousId=plotPreviewSheets[plotPreviewIndex]?.report.layoutId;refreshPlotSpace();$('plot-scale').disabled=plotLayoutSet()||Boolean(($('plot-space').value==='current'?currentLayout():$('plot-space').value==='layout'?state().layouts?.find(l=>l.id===$('plot-layout-id').value):null))||$('plot-mode').value!=='scale';$('plot-error').textContent='';$('plot-submit').disabled=true;
  try{
    plotModule??=await import('./plot-document.mjs');
    const options=plotModule.normalizePlotOptions(plotOptionsFromFields()),result=plotModule.buildPlotHTML([{title:documentName,text:serializedDrawing()}],{options});
    if(revision!==plotPreviewRevision||!$('plot-dialog').open)return;
    const previews=result.previewSVGs||[result.previewSVG];plotPreviewSheets=previews.map((svg,index)=>({svg,report:result.report.sheets[index],whole:result.report}));
    fillOptions('plot-preview-sheet',plotPreviewSheets.map((_,index)=>String(index)),String(0));for(const [index,option]of [...$('plot-preview-sheet').options].entries()){const sheet=plotPreviewSheets[index].report;option.textContent=`${index+1}. ${sheet.layoutName||documentName} · ${sheet.layoutId||'Model'} · ${sheet.paper} ${sheet.widthMm} × ${sheet.heightMm} mm`;}
    renderPlotPreviewPage(Math.max(0,plotPreviewSheets.findIndex(sheet=>sheet.report.layoutId===previousId)));
    $('plot-submit').disabled=plotSubmitting||!(plotSavedDrawings()?desktop?.publishPDF:desktop?.plotPDF);
    if(!desktop)$('plot-error').textContent='PDF output requires the Linecraft desktop application. The sheet preview is available here.';
  }catch(error){if(revision===plotPreviewRevision){plotPreviewSheets=[];$('plot-preview').replaceChildren();$('plot-summary').textContent='';$('plot-preview-navigation').hidden=true;$('plot-error').textContent=error.message||'Check the sheet settings.';if(plotSavedDrawings()&&desktop?.publishPDF)$('plot-submit').disabled=plotSubmitting;}}
}
async function showPlot(mode='plot'){
  discardRoofGripDraft();
  if(documentActionBusy||$('annotation-dialog').open||$('settings-dialog').open)return false;
  closePalettes();hideCompletion();if(state().command)editor.cancel();orbitMode=null;orbitPivot=null;plotMode=mode;
  try{plotModule??=await import('./plot-document.mjs');}catch(error){addLog(error.message||'The PDF output module could not be loaded.','error');return false;}
  ensurePlotLayoutDraft();renderPlotSheetSets();renderPlotLayoutOrder();$('plot-sheet-set-error').textContent='';$('plot-publish-source').value=plotPublishSource;
  const options=lastPlotOptions||plotModule.DEFAULT_PLOT_OPTIONS;
  $('plot-space').value=options.space||'current';fillOptions('plot-layout-id',(state().layouts||[]).map(layout=>layout.id),options.layoutId||currentLayout()?.id||state().layouts?.[0]?.id||'');for(const option of $('plot-layout-id').options)option.textContent=state().layouts.find(layout=>layout.id===option.value).name;refreshPlotSpace();
  $('plot-paper').value=options.paper;$('plot-orientation').value=options.orientation;$('plot-mode').value=options.scaleMode;$('plot-scale').value=options.ratio;$('plot-margin').value=options.margin;$('plot-color').value=options.colorMode;$('plot-lineweights').checked=options.lineweights;
  $('plot-title').textContent=mode==='publish'?'Publish drawings':'Plot drawing';$('plot-intro').textContent=mode==='publish'?'Publish an ordered selection of paper layouts from this drawing, or choose up to 20 saved drawings through the existing file picker. Source drawings and their tab order remain unchanged.':'Preview the current view, one paper layout, or an ordered selection of paper layouts. The source drawing remains unchanged.';refreshPlotSpace();
  $('plot-dialog').showModal();update();await refreshPlotPreview();return true;
}
function closePlot(){if(plotSubmitting)return;plotPreviewRevision++;$('plot-dialog').close();finishDialogReload();input.focus();}
async function submitPlot(event){
  event.preventDefault();if(plotSubmitting||documentActionBusy)return;
  let options;try{options=plotModule.normalizePlotOptions(plotOptionsFromFields());}catch(error){$('plot-error').textContent=error.message;$('plot-submit').disabled=true;return;}
  const saved=plotSavedDrawings(),action=saved?desktop?.publishPDF:desktop?.plotPDF;if(!action){$('plot-error').textContent='PDF output requires the Linecraft desktop application.';return;}
  lastPlotOptions=options;plotSubmitting=true;setDocumentBusy(true);$('plot-submit').disabled=true;$('plot-error').textContent='';refreshPlotSheetSetStatus();
  try{
    const result=saved?await desktop.publishPDF({options}):await desktop.plotPDF({text:serializedDrawing(),options});
    if(result?.canceled)return;if(!result?.ok)throw Error(result?.error||'PDF output failed.');
    const pages=result.pages??result.report?.pages??1;addLog(`${plotMode==='publish'?'Published':'Plotted'} ${pages} sheet${pages===1?'':'s'}${result.name?` to ${result.name}`:''}.`,'notice');if(result.warnings?.length)addLog(result.warnings.join('\n'),'notice');toast('PDF saved.');
  }catch(error){$('plot-error').textContent=error.message||'PDF output failed.';}
  finally{plotSubmitting=false;setDocumentBusy(false);$('plot-submit').disabled=false;refreshPlotSheetSetStatus();finishDialogReload();}
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
function setDrafting(patch){const result=resultLog(editor.updateDraftingSettings(patch));if(result.ok&&drag?.mode==='roof-component-grip'){if(drag.typedActive)previewRoofGripText(input.value);else refreshRoofGripPointer();}return result;}
const annotationFontState={status:'pending',fonts:[],diagnostics:[],checkedAt:null};
let annotationFontRefresh=null;
const annotationFontFamilies=()=>geometry.FONT_FAMILIES||['Arial','Segoe UI','Consolas','ARCHITXT','Times New Roman','Technic'];
function displayAnnotationFontStatus(family=$('setting-text-font').value){
  const row=annotationFontState.fonts.find(item=>item.fontFamily===family&&!item.bold&&!item.italic),status=$('setting-font-status');
  $('setting-font-sample').style.fontFamily=`"${family}", Arial, sans-serif`;
  status.classList.toggle('unavailable',Boolean(row&&(!row.available||!row.localFaceLoaded||row.metricError)));
  if(annotationFontState.status==='loading')status.textContent='Checking local font faces and measured profiles…';
  else if(row?.available&&row.localFaceLoaded&&!row.metricError)status.textContent=`${family} · local face resolved · measured profile registered. PDF font and glyph use is verified separately.`;
  else if(row)status.textContent=`${family} · ${row.diagnostic||row.metricError||(!row.localFaceLoaded?'local face did not resolve':'measured profile unavailable')}. The requested name stays stored; system fallback may render until the local font is resolved.`;
  else status.textContent=annotationFontState.diagnostics.join(' ')||'Local font metrics have not been verified. No font files are included with Linecraft.';
}
async function refreshAnnotationFonts(){
  if(annotationFontRefresh)return annotationFontRefresh;
  annotationFontState.status='loading';displayAnnotationFontStatus();
  annotationFontRefresh=(async()=>{
    const result=desktop?.getFontMetrics?await desktop.getFontMetrics({families:[...annotationFontFamilies()]}):{ok:false,error:'The local font metric service is unavailable.'};
    if(!result?.ok)throw Error(result?.error||'Local font metrics could not be read.');
    geometry.clearFontMetrics?.();
    const fonts=[];
    for(const row of result.fonts||[]){
      let localFaceLoaded=false,metricError=null;
      if(row.available){
        try{if(!geometry.registerFontMetrics)throw Error('Restart to load the font metric helper.');geometry.registerFontMetrics(row.fontFamily,row.metrics,{bold:row.bold,italic:row.italic,sha256:row.sha256});}catch(error){metricError=error.message;}
        try{await new FontFace('LinecraftAvailabilityProbe',`local("${row.fontFamily}${row.bold?' Bold':''}${row.italic?' Italic':''}")`).load();localFaceLoaded=true;}catch{if(row.bold||row.italic){try{await new FontFace('LinecraftAvailabilityProbe',`local("${row.fontFamily}")`,{weight:row.bold?'700':'400',style:row.italic?'italic':'normal'}).load();localFaceLoaded=true;}catch{}}}
      }
      fonts.push({fontFamily:row.fontFamily,bold:row.bold===true,italic:row.italic===true,available:row.available===true,localFaceLoaded,sha256:row.sha256||null,metricError,diagnostic:row.diagnostic||null});
    }
    annotationFontState.fonts=fonts;annotationFontState.diagnostics=[...(result.diagnostics||[])];annotationFontState.status='checked';annotationFontState.checkedAt=new Date().toISOString();fontCapRatios.clear();draw();renderProperties();
  })().catch(error=>{annotationFontState.status='unavailable';annotationFontState.diagnostics=[error.message||'Local font check failed.'];}).finally(()=>{annotationFontRefresh=null;displayAnnotationFontStatus();});
  return annotationFontRefresh;
}
function applyTextStyleFields(){
  const style=settingsDraft?.textStyles.find(item=>item.name===settingsDraft.textName);if(!style)return;
  Object.assign(style,{fontFamily:$('setting-text-font').value,defaultHeight:readQuantityField('setting-text-height','length',unitFields()),defaultRotation:readQuantityField('setting-text-rotation','angle',unitFields()),widthFactor:$('setting-text-width-factor').valueAsNumber});
}
function applyDimStyleFields(){
  const style=settingsDraft?.dimStyles.find(item=>item.name===settingsDraft.dimName);if(!style)return;
  Object.assign(style,{textStyle:$('setting-dim-text-style').value,textHeight:readQuantityField('setting-dim-text-height','length',unitFields()),arrowSize:readQuantityField('setting-dim-arrow-size','length',unitFields()),gap:readQuantityField('setting-dim-gap','length',unitFields()),precision:$('setting-dim-precision').valueAsNumber,scale:$('setting-dim-scale').valueAsNumber,extensionOffset:readQuantityField('setting-dim-extension-offset','length',unitFields()),extensionOvershoot:readQuantityField('setting-dim-extension-overshoot','length',unitFields()),prefix:$('setting-dim-prefix').value,suffix:$('setting-dim-suffix').value});
  const tickWidth=$('setting-dim-tick-width').value.trim();if(tickWidth)style.tickWidth=readQuantityField('setting-dim-tick-width','length',unitFields());else delete style.tickWidth;
  const arrowType=$('setting-dim-arrow-type').value;if(arrowType!=='closed-filled'||Object.hasOwn(style,'arrowType'))style.arrowType=arrowType;
}
function captureStyleFields(){try{applyTextStyleFields();applyDimStyleFields();return true;}catch(error){$('settings-error').textContent=error.message||'Check the style values.';return false;}}
function displayTextStyleFields(){const style=settingsDraft.textStyles.find(item=>item.name===settingsDraft.textName);$('setting-text-font').value=style.fontFamily;displayQuantityField('setting-text-height',style.defaultHeight,'length',unitFields());displayQuantityField('setting-text-rotation',style.defaultRotation,'angle',unitFields());$('setting-text-width-factor').value=style.widthFactor;displayAnnotationFontStatus(style.fontFamily);}
function displayDimStyleFields(){const style=settingsDraft.dimStyles.find(item=>item.name===settingsDraft.dimName);fillOptions('setting-dim-text-style',settingsDraft.textStyles.map(item=>item.name),style.textStyle);for(const [id,key]of [['text-height','textHeight'],['arrow-size','arrowSize'],['gap','gap'],['extension-offset','extensionOffset'],['extension-overshoot','extensionOvershoot']])displayQuantityField(`setting-dim-${id}`,style[key],'length',unitFields());const tickField=$('setting-dim-tick-width');tickField.type='text';if(style.tickWidth===undefined){tickField.value='';tickField.title='Optional geometric tick width in drawing units; style, object and viewport scales apply. Blank inherits lineweight.';delete tickField.dataset.exactValue;delete tickField.dataset.originalDisplay;}else displayQuantityField('setting-dim-tick-width',style.tickWidth,'length',unitFields());$('setting-dim-arrow-type').value=style.arrowType||'closed-filled';$('setting-dim-precision').value=style.precision;for(const [id,key]of [['scale','scale'],['prefix','prefix'],['suffix','suffix']])$(`setting-dim-${id}`).value=style[key];}
function showSettings(){discardRoofGripDraft();flushViewportNavigation();
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
  const type=entity?.type||(state().command==='LEADER'?'LEADER':state().command==='MTEXT'?'MTEXT':state().commandData?.textEntity?.type||'TEXT');
  annotationEditor={entityId,type,command:state().command,richText:entity?.richText?structuredClone(entity.richText):null};$('annotation-error').textContent='';$('annotation-dialog-title').textContent=entity?.richText?'Edit formatted multiline source':type==='LEADER'?'Edit leader text':type==='MTEXT'?'Edit multiline text':'Edit drawing text';$('annotation-content').value=entity?.richText?.source??entity?.text??state().commandData?.textEntity?.text??'';
  $('annotation-content').rows=type==='MTEXT'?6:3;$('annotation-editor-hint').textContent=entity?.richText?'Native MTEXT formatting source remains editable. Keep font, height, paragraph and underline controls to preserve the existing formatting. Invalid source is retained for correction.':type==='LEADER'?'One label for this leader. Apply commits one grouped edit; Cancel retains the original leader.':type==='MTEXT'?'Line breaks are preserved; long lines wrap to the text box width. Apply creates or updates one multiline object.':'One line per object. Apply commits the text; Cancel retains the original drawing.';
  if(!$('annotation-dialog').open)$('annotation-dialog').showModal();$('annotation-content').focus();if(entity)$('annotation-content').select();
}
function closeAnnotationEditor(cancelCommand=false){
  if(cancelCommand&&annotationEditor?.command&&state().command===annotationEditor.command)editor.cancel();$('annotation-dialog').close();annotationEditor=null;update();finishDialogReload();
}
function maybeAnnotationEditor(){
  if(state().commandPhase==='text'&&['TEXT','MTEXT','TEXTEDIT','LEADER'].includes(state().command)&&!$('annotation-dialog').open){
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
function roofSelectionContext(){return`${state().activeSpace}|${state().activeLayoutId||''}|${state().activeViewportId||''}`;}
function roofSourceStamp(){return state().architectureDerived?.inputHash||architectureInputHash(architectureSource());}
function currentRoofComponent(){
  const selected=selectedRoofComponent;if(!selected||selected.editor!==editor||selected.source!==roofSourceStamp()||selected.context!==roofSelectionContext()||!modelWorkspace()||state().command||state().selectionIds.length!==1||state().selectionIds[0]!==selected.entityId||!visibleEntities().some(entity=>entity.id===selected.entityId))return null;
  return selected;
}
function syncRoofComponentSelection(){if(selectedRoofComponent&&!currentRoofComponent()){selectedRoofComponent=null;discardRoofGripDraft();}}
function roofComponentData(){
  const selected=currentRoofComponent();if(!selected)return null;const footprint=structuredClone(selected.footprint);
  if(modelEntities().some(entity=>architectureOwner(entity)?.kind==='roofGroup'&&architectureOwner(entity)?.id===selected.roofGroupId&&layerFor(entity)?.locked)){footprint.editable=false;footprint.reason='A generated part of this roof is on a locked layer.';}
  return{selected,footprint};
}
function selectRoofComponent(pick){
  const footprint=roofComponentFootprint(architectureSource(),pick.roofGroupId,pick.componentId);if(!footprint)return false;
  selectedSubobject=null;selectedViewportId=null;editor.select([pick.entityId]);selectedRoofComponent={roofGroupId:pick.roofGroupId,componentId:pick.componentId,entityId:pick.entityId,editor,source:roofSourceStamp(),context:roofSelectionContext(),footprint};return true;
}
function roofComponentPick(screen){
  if(!modelWorkspace()||!insideActiveViewport(screen))return null;
  const front=projectedPick(screen,visibleEntities()),entity=activeEntities().find(item=>item.id===front?.entityId);if(architectureOwner(entity)?.kind!=='roofGroup'||layerFor(entity)?.locked)return null;
  const ray=view3d.screenRay(screen,camera3D(),width,height);let best=null;
  for(const triangle of roofComponentTriangles(entity,architectureSource(),state().architectureDerived)){const hit=view3d.intersectTriangle(ray,...triangle.points);if(!hit)continue;const p=toScreen(hit.point);if(p.clipped||!finiteScreenPoint(p))continue;if(!best||p.depth>best.depth+1e-8)best={...triangle,point:hit.point,depth:p.depth,entityId:entity.id};}
  return best;
}
function roofComponentGrips(){const data=roofComponentData();return !data||!data.footprint.editable||state().command||orbitMode?[]:data.footprint.grips.map(grip=>({...grip,screen:toScreen(grip.point)})).filter(grip=>finiteScreenPoint(grip.screen)&&!grip.screen.clipped&&insideActiveViewport(grip.screen)&&grip.screen.x>=0&&grip.screen.x<=width&&grip.screen.y>=0&&grip.screen.y<=height);}
function roofComponentGripAt(screen){let best=null;for(const grip of roofComponentGrips()){const distance=Math.hypot(grip.screen.x-screen.x,grip.screen.y-screen.y);if(distance<=9&&(!best||distance<best.distance))best={...grip,distance};}return best;}
function discardRoofGripDraft(){
  if(drag?.mode!=='roof-component-grip')return false;
  clearRoofDragPreview();drag=null;snap=null;input.value='';hideCompletion();$('command-prompt').textContent=state().prompt||'Command:';$('command-state').textContent=state().command||'Ready';input.placeholder='Type a command or coordinate…';$('canvas-note').textContent='Roof component selected · amber corner / edge grips resize its footprint · Esc clears selection';return true;
}
function roofGripTarget(operation,target,{kind='pointer',text='',mode='absolute'}={}){
  operation.input={kind,text,mode};operation.targetLocal={x:target.x,y:target.y,z:operation.planeElevation};operation.valid=false;operation.error='';
  if(!currentRoofComponent())operation.error='Source or selection changed; cancel this draft.';
  else if(!roofComponentData()?.footprint.editable)operation.error=roofComponentData()?.footprint.reason||'This footprint is protected.';
  else try{operation.bounds=boundsFromRoofComponentGrip(operation.originalBounds,operation.gripId,target);reviseRoofComponentBounds(architectureSource(),operation.roofGroupId,operation.componentId,operation.bounds);operation.valid=true;}catch(error){operation.error=error.message;}
  operation.moved=Object.keys(operation.originalBounds).some(key=>operation.bounds[key]!==operation.originalBounds[key]);
  requestRoofDragPreview(operation);
}
function previewRoofGripText(raw){
  const operation=drag?.mode==='roof-component-grip'?drag:null;if(!operation)return false;
  operation.acquisition='latched';operation.typedActive=Boolean(String(raw).trim());operation.snap=null;snap=null;
  if(!operation.typedActive){operation.input={kind:'pointer',text:'',mode:'absolute'};refreshRoofGripPointer();return true;}
  try{const parsed=parseRoofGripCoordinate(String(raw),operation.gripLocal,state().settings);roofGripTarget(operation,parsed.point,{kind:'typed',text:String(raw),mode:parsed.mode});pointer=geometry.architectureLocalToWorld(operation.targetLocal,architectureFrame());pointerUnavailable=null;}
  catch(error){operation.input={kind:'typed',text:String(raw),mode:'invalid'};operation.valid=false;operation.error=error.message;operation.moved=true;requestRoofDragPreview(operation);}
  updateStatus();draw();return true;
}
function refreshRoofGripPointer(){
  if(drag?.mode!=='roof-component-grip')return;
  if(rawPointer){const rect=canvas.getBoundingClientRect();pointerPosition({clientX:rect.left+rawPointer.x,clientY:rect.top+rawPointer.y});}
  else{drag.valid=false;drag.error='Move inside the active model viewport or enter building-local X,Y.';requestRoofDragPreview(drag);}
  updateStatus();draw();
}
function finishRoofGripAcquisition(){
  const operation=drag?.mode==='roof-component-grip'?drag:null;if(!operation)return{ok:false,message:'No footprint grip is active.'};
  if(!operation.valid){const result={ok:false,message:operation.error||'Enter a valid building-local X,Y point.'};resultLog(result);return result;}
  if(Object.keys(operation.originalBounds).every(key=>operation.bounds[key]===operation.originalBounds[key])){discardRoofGripDraft();const result={ok:true,changed:false,message:'Footprint unchanged.'};resultLog(result);return result;}
  clearRoofDragPreview();drag=null;snap=null;
  const result=commitRoofComponentBounds(operation.selection,operation.bounds);
  if(result.ok===false){drag=operation;operation.valid=false;operation.error=result.message;operation.moved=true;requestRoofDragPreview(operation);}
  else input.value='';
  resultLog(result);return result;
}
function submitRoofGripInput(raw){
  const text=String(raw??'');addLog(`${currentPrompt()} ${text.trim()||'↵'}`,'input');
  if(text.trim()){input.value=text;previewRoofGripText(text);}
  return finishRoofGripAcquisition();
}
function updateRoofGripPrompt(){
  if(drag?.mode!=='roof-component-grip')return;
  const operation=drag,typed=operation.typedActive;
  $('command-prompt').textContent='Footprint XY:';$('command-state').textContent='ROOF GRIP';
  input.placeholder='Building-local X,Y / #X,Y / @dX,dY · feet/inches accepted';
  $('canvas-note').textContent=typed?'Typed building XY controls the preview · Enter places it · clear the field to use the pointer · Esc cancels':operation.acquisition==='latched'?'Pick the new grip point or type building-local X,Y / @dX,dY · Enter places it · Esc cancels':'Drag to place · click/release to type building-local X,Y · Esc cancels';
  $('construction-plane-label').textContent=`Footprint bearing plane · building Z ${lengthFormat(operation.planeElevation)} · world Z ${lengthFormat(operation.plane.origin.z)} · UCS unchanged`;
}
function roofPreviewBoundsHash(operation){const b=operation.bounds;return architectureInputHash({roofGroupId:operation.roofGroupId,componentId:operation.componentId,bounds:{minX:b.minX,minY:b.minY,maxX:b.maxX,maxY:b.maxY}});}
function clearRoofDragPreview(){roofPreviewClient.cancel('draft-cleared');roofDragPreviewGeneration++;if(drag?.mode==='roof-component-grip'){drag.preview=null;drag.displayedPreview=null;}}
function roofPreviewIdentityCurrent(operation,preview){return drag===operation&&operation.preview===preview&&currentRoofComponent()===operation.selection&&!documentActionBusy&&!editorDialogOpen()&&roofComponentData()?.footprint.editable&&preview.sourceHash===roofSourceStamp()&&preview.boundsHash===roofPreviewBoundsHash(operation)&&preview.settingsHash===architectureInputHash(state().settings);}
function roofPreviewStillCurrent(operation,preview){return roofPreviewIdentityCurrent(operation,preview)&&operation.valid&&roofComponentData()?.footprint.editable;}
function receiveRoofPreviewEvent(event){
  const operation=drag?.mode==='roof-component-grip'?drag:null,latest=operation?.preview,id=event.identity;
  if(!operation||!latest||!roofPreviewStillCurrent(operation,latest)||id.sourceHash!==latest.sourceHash||id.settingsHash!==latest.settingsHash||id.roofGroupId!==operation.roofGroupId||id.componentId!==operation.componentId)return;
  const current=id.requestId===latest.requestId&&id.generation===latest.generation&&id.boundsHash===latest.boundsHash;
  if(event.type==='started'){operation.previewStats.started++;if(current){latest.status='solving';latest.startedAt=event.startedAt;}draw();return;}
  if(event.type==='error'){if(current){Object.assign(latest,{status:'error',roofStatus:'not-run',completedAt:event.completedAt,diagnostics:[event.message],data:{entities:[],triangles:[],edges:[]}});operation.displayedPreview=null;}draw();return;}
  if(event.type!=='result')return;operation.previewStats.completed++;
  const result=event.result,preview=current?latest:{...id,bounds:{...result.bounds},request:{roofGroupId:id.roofGroupId,componentId:id.componentId,bounds:{...result.bounds}},requestedAt:event.requestedAt};
  Object.assign(preview,{status:result.status,roofStatus:result.roofStatus,generationHash:result.generationHash,startedAt:event.startedAt,completedAt:event.completedAt,elapsedMs:event.elapsedMs,solveElapsedMs:event.solveElapsedMs,counts:{...result.counts},diagnostics:[...result.diagnostics],data:{entities:result.entities,triangles:result.triangles,edges:result.edges}});
  if(current)operation.displayedPreview=['valid','review'].includes(result.status)?preview:null;
  else if(event.isCurrent===false&&['valid','review'].includes(result.status)&&['waiting','solving'].includes(latest.status))operation.displayedPreview=preview;
  draw();
}
function requestRoofDragPreview(operation){
  if(!operation.moved){clearRoofDragPreview();return;}
  const sourceHash=roofSourceStamp(),boundsHash=roofPreviewBoundsHash(operation),settingsHash=architectureInputHash(state().settings),key=`${sourceHash}:${boundsHash}:${settingsHash}:${operation.valid}:${operation.error}`;
  if(operation.preview?.key===key)return;
  const stats=operation.previewStats||(operation.previewStats={requested:0,started:0,completed:0});stats.requested++;
  operation.preview={backend:'module-worker',key,status:operation.valid?'waiting':'invalid',requestId:`roof-drag-${++roofDragPreviewRequest}`,generation:++roofDragPreviewGeneration,sourceHash,boundsHash,settingsHash,bounds:{...operation.bounds},request:{roofGroupId:operation.roofGroupId,componentId:operation.componentId,bounds:{...operation.bounds}},generationHash:null,requestedAt:performance.now(),startedAt:null,completedAt:null,elapsedMs:0,roofStatus:'not-run',counts:{faces:0,triangles:0,edges:0,closures:0},diagnostics:operation.valid?[]:[operation.error],data:{entities:[],triangles:[],edges:[]}};
  if(!operation.valid){operation.displayedPreview=null;roofPreviewClient.cancel('invalid-footprint');return;}
  // The detached worker owns cadence and coalescing. Enter/release still validates
  // the latest source operation synchronously; worker geometry is display only.
  const preview=operation.preview;
  try{roofPreviewClient.request({...preview.request,requestId:preview.requestId,generation:preview.generation,sourceHash,settingsHash,boundsHash,architecture:architectureSource(),settings:state().settings});}
  catch(error){preview.status='error';preview.diagnostics=[error.message];operation.displayedPreview=null;}
}
function currentRoofDragPreview(){
  const operation=drag?.mode==='roof-component-grip'?drag:null,latest=operation?.preview;if(!operation||!latest||!roofPreviewStillCurrent(operation,latest)||renderContext&&(!renderContext.includeEdits||renderContext.space!=='model'))return null;
  if(['valid','review'].includes(latest.status))return{...latest,isCurrent:true};
  const previous=operation.displayedPreview;return['waiting','solving'].includes(latest.status)&&previous&&['valid','review'].includes(previous.status)&&previous.sourceHash===latest.sourceHash&&previous.settingsHash===latest.settingsHash?{...previous,isCurrent:false}:null;
}
function roofDragPreviewEntities(preview){return(preview?.data?.entities??[]).map(entity=>{const accepted=modelEntities().find(item=>item.id===entity.id)||modelEntities().find(item=>item.id===`@architecture/roofGroup/${drag.roofGroupId}/surface`);return{...entity,layer:accepted?.layer||entity.layer,...(accepted?.lineweight!==undefined?{lineweight:accepted.lineweight}:{}),...(accepted?.linetype!==undefined?{linetype:accepted.linetype}:{})};}).filter(entity=>geometry.isEntityVisible(entity,drawingContext()));}
function updateRoofComponentDrag(){
  if(drag?.mode!=='roof-component-grip')return;
  const operation=drag;if(operation.typedActive)return;operation.input={kind:'pointer',text:'',mode:'absolute'};
  const shifted=Math.hypot(rawPointer.x-operation.start.x,rawPointer.y-operation.start.y)>3;
  operation.valid=false;operation.error='';
  if(!currentRoofComponent())operation.error='Source or selection changed; cancel this draft.';
  else if(!insideActiveViewport(rawPointer))operation.error='Place the grip inside the active model viewport.';
  else if(!pointer)operation.error='The footprint plane is edge-on; enter building-local X,Y or choose another view.';
  else{
    if(operation.acquisition==='pressed'&&!shifted){operation.bounds={...operation.originalBounds};operation.targetLocal={...operation.gripLocal};operation.valid=Boolean(roofComponentData()?.footprint.editable);operation.moved=false;operation.snap=null;snap=null;clearRoofDragPreview();return;}
    const local=operation.snap?.localPoint||geometry.architectureWorldToLocal(pointer,architectureFrame()),absolute=operation.acquisition==='latched'||Boolean(operation.snap),target=absolute?{x:local.x,y:local.y}:{x:operation.gripLocal.x+local.x-operation.startLocal.x,y:operation.gripLocal.y+local.y-operation.startLocal.y};
    roofGripTarget(operation,target,{kind:operation.snap?'snap':'pointer'});
    return;
  }
  operation.moved=shifted||operation.acquisition==='latched';requestRoofDragPreview(operation);
}
function commitRoofComponentBounds(selection,bounds){
  if(!currentRoofComponent()||selection!==selectedRoofComponent)return{ok:false,message:'The component selection changed. Pick it again before resizing.'};
  if(!roofComponentData()?.footprint.editable)return{ok:false,message:roofComponentData()?.footprint.reason||'The component footprint is protected.'};
  const ids={roofGroupId:selection.roofGroupId,componentId:selection.componentId,entityId:`@architecture/roofGroup/${selection.roofGroupId}/surface`},result=editor.applyArchitecture({type:'setRoofComponentFootprint',roofGroupId:ids.roofGroupId,componentId:ids.componentId,bounds});
  if(result.ok)selectRoofComponent(ids);return result;
}
function roofInteractionState(){
  const data=roofComponentData(),operation=drag?.mode==='roof-component-grip'?drag:null,preview=operation?.preview&&roofPreviewIdentityCurrent(operation,operation.preview)?structuredClone({...operation.preview,stats:operation.previewStats,worker:roofPreviewClient.getState(),solvesStarted:operation.previewStats?.started||0,solvesCompleted:operation.previewStats?.completed||0,requestsReceived:operation.previewStats?.requested||0}):null,displayed=currentRoofDragPreview();
  return{selection:data?{roofGroupId:data.selected.roofGroupId,componentId:data.selected.componentId,entityId:data.selected.entityId}:null,footprint:data?structuredClone(data.footprint):null,grips:structuredClone(roofComponentGrips()),drag:data&&operation?{gripId:operation.gripId,acquisition:operation.acquisition,coordinateFrame:'building-local-xy',baseLocal:structuredClone(operation.gripLocal),targetLocal:structuredClone(operation.targetLocal),grabOffset:{x:operation.gripLocal.x-operation.startLocal.x,y:operation.gripLocal.y-operation.startLocal.y},typedActive:Boolean(operation.typedActive),input:structuredClone(operation.input),snap:structuredClone(operation.snap),bounds:structuredClone(operation.bounds),valid:operation.valid,error:operation.error,moved:operation.moved,preview,displayedPreview:displayed?structuredClone({isCurrent:displayed.isCurrent,status:displayed.status,bounds:displayed.bounds,boundsHash:displayed.boundsHash,sourceHash:displayed.sourceHash,requestId:displayed.requestId,generation:displayed.generation,generationHash:displayed.generationHash,counts:displayed.counts,data:displayed.data}):null}:null};
}
function drawRoofComponentSelection(){
  const data=roofComponentData(),output=$('roof-component-draft');output.hidden=true;if(!data||orbitMode||drag?.mode==='orbit')return;
  const operation=drag?.mode==='roof-component-grip'?drag:null,footprint=data.footprint,frame=architectureFrame(),bounds=operation?.bounds||footprint.bounds,corners=[[bounds.minX,bounds.minY],[bounds.maxX,bounds.minY],[bounds.maxX,bounds.maxY],[bounds.minX,bounds.maxY]].map(([x,y])=>toScreen(geometry.architectureLocalToWorld({x,y,z:footprint.elevation},frame)));
  ctx.save();if(currentViewport()){tracePaperBoundary(viewportBoundary(currentViewport()));ctx.clip();}
  if(!operation)for(const entity of visibleEntities().filter(entity=>architectureOwner(entity)?.id===data.selected.roofGroupId))for(const triangle of roofComponentTriangles(entity,architectureSource(),state().architectureDerived).filter(triangle=>triangle.componentId===data.selected.componentId)){const points=triangle.points.map(toScreen);if(points.some(p=>p.clipped||!finiteScreenPoint(p)))continue;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#eea45626';ctx.fill();}
  if(corners.every(p=>finiteScreenPoint(p)&&!p.clipped)){ctx.lineWidth=2;ctx.strokeStyle=operation&&(!operation.valid||operation.preview?.status==='invalid')?'#f08e7a':'#edb36c';ctx.setLineDash(operation?[7,4]:[3,3]);ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);}
  if(!operation)for(const grip of roofComponentGrips()){const p=grip.screen;ctx.fillStyle=grip.kind==='corner'?'#e9ad63':'#172a35';ctx.strokeStyle='#ffd09b';ctx.lineWidth=1.5;if(grip.kind==='corner'){ctx.fillRect(p.x-4,p.y-4,8,8);ctx.strokeRect(p.x-4,p.y-4,8,8);}else{ctx.beginPath();ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x+5,p.y);ctx.lineTo(p.x,p.y+5);ctx.lineTo(p.x-5,p.y);ctx.closePath();ctx.fill();ctx.stroke();}}
  ctx.restore();
  if(operation){const preview=operation.preview,status=preview?.status||'idle',displayed=currentRoofDragPreview(),invalid=!operation.valid||['invalid','error'].includes(status),placement=operation.acquisition==='latched'?operation.typedActive?'Enter to validate and place typed XY':'Click or Enter to validate and place':'Release to validate and place';output.hidden=false;output.dataset.previewStatus=status;output.dataset.acquisition=operation.acquisition;output.dataset.displayedCurrent=String(Boolean(displayed?.isCurrent));output.classList.toggle('invalid',invalid);output.classList.toggle('solved',status==='valid');output.classList.toggle('review',status==='review'||displayed?.status==='review');const detail=status==='error'?`Background roof preview failed · ${preview?.diagnostics?.join(' ')||'Worker unavailable.'}\nAccepted roof shown · current XY can still be validated and placed`:invalid?`Preview unavailable · ${preview?.diagnostics?.join(' ')||operation.error}\nAccepted roof shown · correct the input or cancel` : status==='valid'||status==='review'?`${status==='review'?'Review-only':'Live'} roof preview · ${preview.counts.faces} faces · ${preview.counts.closures} closures · ${preview.counts.edges} physical edges\n${status==='review'?'Drainage review remains required · ':''}${placement} · one Undo step` : status==='waiting'||status==='solving'?displayed?`Updating latest footprint; showing previous solved preview\nPrevious size ${lengthFormat(displayed.bounds.maxX-displayed.bounds.minX)} × ${lengthFormat(displayed.bounds.maxY-displayed.bounds.minY)}${displayed.status==='review'?' · drainage review remains required':''}`:'Solving latest footprint · accepted roof shown':operation.acquisition==='latched'?'Building-local X,Y / @dX,dY · bearing Z stays fixed':'Move the grip to preview the full roof';output.textContent=`Footprint draft · ${lengthFormat(bounds.maxX-bounds.minX)} × ${lengthFormat(bounds.maxY-bounds.minY)}\n${detail} · Esc cancels`;}
}
function architectureLength(id){const field=$(id),value=field.value.trim();if(!value)throw Error('Enter a length for every required field.');const parsed=geometry.parseLength(value,state().settings);if(!Number.isFinite(parsed))throw Error('Enter a finite drawing length.');return parsed;}
function architectureSetLength(id,value){$(id).value=geometry.formatLength(value,state().settings);}
function architecturePoint(xId,yId){return{x:architectureLength(xId),y:architectureLength(yId)};}
function resetArchitectureInputs(){
  if(architectureInputEditor===editor&&architectureInputUnits===state().settings.units)return;
  architectureInputEditor=editor;architectureInputUnits=state().settings.units;architectureSpaceContext='';architectureTrayContext='';architectureAlternativeDefaults='';invalidateArchitectureAlternatives('The drawing or its unit assignment changed.');
  architectureFootprintConfirmed='';architectureReviewHighlight=null;
  $('arch-alternatives-mode').value='fixed-roof';$('arch-alternatives-maximum-fit').checked=true;$('arch-alternatives-max-candidates').value='64';$('arch-alternatives-time-budget').value='10';$('arch-alternatives-max-work').value='4000000';
  const defaults={'arch-wall-thickness':'6"','arch-wall-base':'0','arch-wall-bearing':"10'",'arch-wall-x1':'0','arch-wall-y1':'0','arch-wall-x2':"20'",'arch-wall-y2':'0','arch-node-x':'0','arch-node-y':'0','arch-opening-station':"2'",'arch-opening-width':"3'",'arch-opening-sill':'0','arch-opening-head':"7'",'arch-span-value':"40'",'arch-room-ceiling':"8'",'arch-room-target':"8'",'arch-roof-overhang':"2'",'arch-roof-rake':'0','arch-roof-bearing':"10'",'arch-roof-heel':'0','arch-space-target':"9'",'arch-space-minimum':"7'",'arch-space-headroom':"7'",'arch-space-finish':'0','arch-space-thickness':'0','arch-space-section-coordinate':'0','arch-space-section-x':'0','arch-space-section-y':'0','arch-space-reservation-min-x':'0','arch-space-reservation-max-x':"1'",'arch-space-reservation-min-y':'0','arch-space-reservation-max-y':"1'",'arch-space-reservation-min-z':"9'",'arch-space-reservation-max-z':"10'",'arch-tray-min-x':"4'",'arch-tray-max-x':"16'",'arch-tray-min-y':"3'",'arch-tray-max-y':"9'",'arch-tray-base':"8'",'arch-tray-raised':"9'"};
  for(const[id,value]of Object.entries(defaults))$(id).value=value;
  $('arch-wall-role').value='exterior';$('arch-wall-reference').value='center';$('arch-roof-pitch').value='8';$('arch-roof-source').value='selection';$('arch-roof-name').value='Hip roof';$('arch-roof-type').value='HIP';$('arch-gable-policy').value='EXPLICIT';architectureGableCandidates=null;architectureGableConfirmed='';$('arch-gable-edges').replaceChildren();resetArchitectureBearingDraft();resetArchitecturePitchDraft();$('arch-room-allow').checked=true;
}
function architecturePhysicalLength(value){return geometry.parseLength(value,state().settings);}
function architectureChoice(id,items,placeholder='Choose an existing object'){
  const select=$(id),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=placeholder;select.append(empty);
  for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.label||item.name||item.id;select.append(option);}select.value=items.some(item=>item.id===previous)?previous:'';
}
function architectureTabTo(tab){architectureTab=['walls','rooms','roof','space','alternatives','report'].includes(tab)?tab:'walls';for(const button of document.querySelectorAll('[data-architecture-tab]'))button.setAttribute('aria-pressed',String(button.dataset.architectureTab===architectureTab));for(const pane of document.querySelectorAll('[data-architecture-pane]'))pane.hidden=pane.dataset.architecturePane!==architectureTab;if(architectureTab==='report')refreshArchitectureReport();if(architectureTab==='space')loadArchitectureSpace();if(architectureTab==='alternatives')loadArchitectureAlternatives();}
function architectureReadWall(){return{thickness:architectureLength('arch-wall-thickness'),referenceFace:$('arch-wall-reference').value,baseElevation:architectureLength('arch-wall-base'),bearingElevation:architectureLength('arch-wall-bearing'),role:$('arch-wall-role').value};}
function architectureReport(){return editor.getArchitectureReport?editor.getArchitectureReport():{status:'unavailable',message:'Architecture integration is not available in this build.'};}
function refreshArchitectureReport(){try{$('architecture-report').textContent=JSON.stringify(architectureReport(),null,2);}catch(error){$('architecture-report').textContent=error.message;}}
function refreshArchitectureSummary(){const source=state().architecture,count=source?.walls?.length||0,roofCount=source?.roofGroups?.length||0,review=state().architectureDerived?.roofs?.some(roof=>roof.status==='needs-review');$('architecture-summary').textContent=count||roofCount?`${count} walls · ${source?.rooms?.length||0} rooms · ${roofCount} roof groups\n${review?'Drainage review required':state().architectureDerived?.validation?.geometry||'Source model'} · surcharge 0`:'No architectural source';}
function refreshArchitectureLists(){
  const source=architectureSource();architectureChoice('arch-wall-id',(source.walls||[]).map(wall=>({...wall,label:`${wall.id} · ${wall.role}`})));
  architectureChoice('arch-node-id',source.wallNodes||[]);architectureChoice('arch-span-start',source.wallNodes||[]);architectureChoice('arch-span-end',source.wallNodes||[]);architectureChoice('arch-room-id',(source.rooms||[]).map(room=>({...room,label:room.label||room.id})));architectureChoice('arch-roof-id',(source.roofGroups||[]).map(group=>({...group,label:group.name||group.id})));
  const entity=modelEntities().find(item=>item.id===architectureBoundaryEntityId),selected=entity?`${entity.type} ${entity.id}`:'none';
  $('architecture-context').textContent=`Drawing units: ${state().settings.units} · Building-local coordinates · Source path: ${selected}\n${source.walls?.length||0} walls · ${source.rooms?.length||0} rooms · ${source.roofGroups?.length||0} roof groups${state().settings.units==='unitless'?' · Assign physical units in Drawing settings before architectural analysis.':''}`;
  $('arch-wall-apply').disabled=!$('arch-wall-id').value;$('arch-opening-add').disabled=!$('arch-wall-id').value;$('arch-node-apply').disabled=!$('arch-node-id').value;$('arch-room-apply').disabled=!$('arch-room-id').value;$('arch-roof-apply').disabled=!$('arch-roof-id').value;
  architectureChoice('arch-space-room',(source.rooms||[]).map(room=>({...room,label:room.label||room.id})));architectureChoice('arch-space-roof',source.roofGroups||[]);
  refreshArchitectureAlternativeChoices();
  updateArchitectureRoofPreview();updateArchitectureRoofDetail();refreshArchitectureSummary();if(architectureTab==='report')refreshArchitectureReport();if(architectureTab==='space')loadArchitectureSpace();
}
function showArchitecture(tab='walls',owner=null){
  discardRoofGripDraft();
  if(documentActionBusy)return;flushViewportNavigation();closePalettes();hideCompletion();if(state().command)editor.cancel();selectedSubobject=null;
  resetArchitectureInputs();
  const selected=selectionObjects().filter(entity=>!architectureOwner(entity)&&['LINE','PLINE','POLY3D','RECTANG'].includes(entity.type));architectureBoundaryEntityId=selected.length===1?selected[0].id:null;
  const firstOpen=!$('architecture-dialog').open;refreshArchitectureLists();
  if(owner?.kind==='wall'){$('arch-wall-id').value=owner.id;loadArchitectureWall();}
  if(owner?.kind==='room'){$('arch-room-id').value=owner.id;loadArchitectureRoom();}
  if(owner?.kind==='roofGroup'){$('arch-roof-id').value=owner.id;loadArchitectureRoof();if(owner.componentId){$('arch-roof-component-id').value=owner.componentId;loadArchitectureRoof();}}
  architectureTabTo(tab);$('architecture-error').textContent='';$('architecture-result').textContent='';if(firstOpen)$('architecture-dialog').showModal();
}
function closeArchitecture(){if(architectureAlternativeStudy.status==='running')invalidateArchitectureAlternatives('The dialog closed before the search was accepted.');$('architecture-dialog').close();finishDialogReload();input.focus();}
function structuralSourceCurrent(){return structuralBridge.editor===editor&&structuralBridge.snapshot===serializedDrawing();}
function structuralRegions(){return structuralBridge.catalog?.regions||[];}
function structuralGroupRegion(id=$('structural-roof-group').value){return structuralRegions().filter(region=>region.roofGroupId===id&&region.componentId===null).sort((a,b)=>b.faceIds.length-a.faceIds.length)[0]||null;}
function structuralMode(){return $('structural-mode').value;}
function structuralOwner(){return{roofGroupId:$('structural-roof-group').value,componentId:$('structural-component').value||null};}
function structuralAssignmentOwnerCurrent(){const a=structuralBridge.assignmentOwner,b=structuralOwner();return Boolean(a&&a.roofGroupId===b.roofGroupId&&a.componentId===b.componentId);}
function structuralChosenRegion(){const group=$('structural-roof-group').value,component=$('structural-component').value||null,face=structuralMode()==='assignments'?'':$('structural-face').value;if(face==='@loaded-selection')return structuralBridge.loadedSelection?.region||null;return structuralRegions().filter(region=>region.roofGroupId===group&&region.componentId===component&&(!face||region.faceIds.length===1&&region.faceIds[0]===face)).sort((a,b)=>b.faceIds.length-a.faceIds.length)[0]||null;}
function structuralOptions(){return{...structuralOwner(),faceIds:structuralMode()==='assignments'?null:$('structural-face').value==='@loaded-selection'?structuralBridge.loadedSelection?.faceIds||null:$('structural-face').value?[$('structural-face').value]:null,memberTributaryAreaSF:Number($('structural-member-area').value),...($('structural-member-label').value.trim()?{memberLabel:$('structural-member-label').value.trim()}:{})};}
function structuralUsesBoundaries(){return structuralBridge.assignmentProtocol===3||structuralBridge.assignments.some(row=>row.areaMode==='drawn-boundary');}
function structuralAssignmentOptions({inspection=false,forceBoundary=false}={}){
  if(!structuralAssignmentOwnerCurrent())throw Error('Start an empty schedule for this source region or select the region that owns the current schedule.');
  const explicitNumber=(value,label)=>{if(!String(value).trim()){if(inspection)return null;throw Error(`Enter ${label} explicitly; an empty field does not mean zero.`);}const number=Number(value);if(!Number.isFinite(number)){if(inspection)return null;throw Error(`${label} must be a finite number.`);}return number;},v3=forceBoundary||structuralUsesBoundaries();
  return{...structuralOwner(),assignments:structuralBridge.assignments.map((row,index)=>{if(!inspection&&row.areaMode==='drawn-boundary'&&row.boundaryStale)throw Error(`Boundary ${row.id} belongs to its previous face. Redraw or clear it explicitly.`);const area=v3?{areaDefinition:row.areaMode==='drawn-boundary'?{kind:'drawn-boundary',coordinateSystem:'world-xy-feet',vertices:structuredClone(row.boundaryVertices||[])}:{kind:'explicit-area',projectedAreaSF:explicitNumber(row.projectedTributaryAreaSF,`projected tributary SF for check ${index+1}`)}}:{projectedTributaryAreaSF:explicitNumber(row.projectedTributaryAreaSF,`projected tributary SF for check ${index+1}`)};return{id:row.id,memberLabel:row.memberLabel,faceId:row.faceId,...area,deadLoadItems:row.deadLoadItems.map((item,i)=>({label:item.label,psf:explicitNumber(item.psf,`dead-load PSF for check ${index+1}, item ${i+1}`),basis:item.basis}))};})};
}
function validateStructuralRequest(snapshot,record){return record?.version===3?validateStructuralRoofBoundaryExport(snapshot,record):record?.version===2?validateStructuralRoofAssignmentExport(snapshot,record):validateStructuralRoofExport(snapshot,record);}
function validateStructuralResult(snapshot,request,record){return request?.version===3?validateStructuralRoofBoundaryResult(snapshot,request,record):request?.version===2?validateStructuralRoofAssignmentResult(snapshot,request,record):validateStructuralRoofResult(snapshot,request,record);}
function invalidateStructuralDraft(){structuralBridge.exportRecord=null;structuralBridge.result=null;structuralBridge.assignmentPreview=null;structuralBridge.boundaryInspection=null;structuralBridge.status='ready';structuralBridge.message='';}
function structuralDraftChanged(){if(!structuralSourceCurrent()){markStructuralStale();return;}invalidateStructuralDraft();renderStructuralBridge();}
function structuralResetAssignments(){structuralBridge.assignments=[];structuralBridge.assignmentOwner=structuralOwner();structuralBridge.assignmentPreview=null;structuralBridge.assignmentProtocol=2;structuralBridge.nextAssignmentId=1;invalidateStructuralDraft();renderStructuralAssignments();renderStructuralBridge();}
function structuralAddAssignment(){
  if(!structuralSourceCurrent()){markStructuralStale();return;}if(!structuralOwner().roofGroupId){structuralBridge.message='Choose an accepted source roof region first.';renderStructuralBridge();return;}
  if(!structuralBridge.assignments.length)structuralBridge.assignmentOwner=structuralOwner();
  if(!structuralAssignmentOwnerCurrent()){structuralBridge.message='The current schedule belongs to another region. Select its region or start an empty schedule here.';renderStructuralBridge();return;}
  if(structuralBridge.assignments.length>=128){structuralBridge.message='A request supports at most 128 independent checks.';renderStructuralBridge();return;}
  let id;do{id='assignment-'+structuralBridge.nextAssignmentId++;}while(structuralBridge.assignments.some(row=>row.id===id));structuralBridge.assignments.push({id,memberLabel:'',faceId:'',projectedTributaryAreaSF:'',areaMode:'explicit-area',boundaryVertices:[],boundaryStale:false,boundaryAreaSF:null,deadLoadItems:[{label:'',psf:'',basis:''}]});invalidateStructuralDraft();renderStructuralAssignments();renderStructuralBridge();
}
function structuralAssignmentPreview(){try{if(!structuralSourceCurrent())throw Error('Reload the changed drawing before reviewing assignments.');structuralBridge.assignmentPreview=(structuralUsesBoundaries()?createStructuralRoofBoundaryExport:createStructuralRoofAssignmentExport)(structuralBridge.snapshot,structuralAssignmentOptions());structuralBridge.status='ready';structuralBridge.message='Declared quantities reviewed. Export a request JSON before importing an external result.';}catch(error){structuralBridge.assignmentPreview=null;structuralBridge.status='error';structuralBridge.message=error.message;}renderStructuralBridge();}
function structuralInspectBoundaries(){
  if(!structuralSourceCurrent()||!structuralAssignmentOwnerCurrent()||!structuralUsesBoundaries())return null;if(structuralBridge.boundaryInspection)return structuralBridge.boundaryInspection;
  try{const result=inspectStructuralTributaryBoundaries(structuralBridge.snapshot,structuralAssignmentOptions({inspection:true,forceBoundary:true}));for(const row of structuralBridge.assignments.filter(row=>row.areaMode==='drawn-boundary'&&row.boundaryStale)){const diagnostic={code:'BOUNDARY_FACE_CHANGED',assignmentId:row.id,message:`${row.id}: face changed. Redraw or clear the previous boundary explicitly.`};result.diagnostics.push(diagnostic);result.canExport=false;result.status='invalid';const item=result.assignments.find(item=>item.id===row.id);if(item){item.status='invalid';item.geometryStatus='invalid';item.diagnostics.push(diagnostic);}}structuralBridge.boundaryInspection=result;return result;}catch(error){return structuralBridge.boundaryInspection={status:'invalid',canExport:false,assignments:[],overlapPairs:[],manualAreaIds:[],diagnostics:[{code:'DRAFT_INVALID',message:error.message}]};}
}
function structuralBoundaryMaximum(row){return getStructuralTributaryFaceMaximum(structuralBridge.snapshot,{...structuralOwner(),faceId:row.faceId});}
function structuralBoundaryInspectionForDraft(){
  const draft=structuralBoundaryDraft;if(!draft)return null;try{const options=structuralAssignmentOptions({inspection:true,forceBoundary:true}),row=options.assignments.find(row=>row.id===draft.assignmentId);if(!row)throw Error('The assignment no longer exists.');row.faceId=draft.faceId;row.areaDefinition={kind:'drawn-boundary',coordinateSystem:'world-xy-feet',vertices:structuredClone(draft.vertices)};return inspectStructuralTributaryBoundaries(draft.snapshot,options);}catch(error){return{status:'invalid',assignments:[],overlapPairs:[],diagnostics:[{code:'BOUNDARY_INVALID',message:error.message}]};}
}
function structuralBoundaryState(){const draft=structuralBoundaryDraft,svg=$('structural-boundary-svg'),matrix=draft&&svg.getScreenCTM();return draft?structuredClone({open:$('structural-boundary-dialog').open,assignmentId:draft.assignmentId,faceId:draft.faceId,coordinateSystem:'world-xy-feet',vertices:draft.vertices,faceVertices:draft.faceVertices,viewBox:draft.viewBox,screenMatrix:matrix?{a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f}:null,sourceCurrent:structuralSourceCurrent()&&draft.snapshot===structuralBridge.snapshot,message:draft.message||'',inspection:draft.inspection}):{open:false,vertices:[]};}
function showStructuralBoundary(row){
  try{if(!structuralSourceCurrent()||!structuralAssignmentOwnerCurrent())throw Error('Reload the current source and select this schedule’s region.');const maximum=structuralBoundaryMaximum(row),faceVertices=maximum.verticesWorldXYFeet,values=faceVertices.flatMap(p=>[p.x,p.y]);if(!faceVertices.length||!values.every(Number.isFinite))throw Error('Current source face has no finite XY boundary.');const minX=Math.min(...faceVertices.map(p=>p.x)),maxX=Math.max(...faceVertices.map(p=>p.x)),minY=Math.min(...faceVertices.map(p=>p.y)),maxY=Math.max(...faceVertices.map(p=>p.y)),margin=Math.max(maxX-minX,maxY-minY,1)*.1;structuralBoundaryDraft={assignmentId:row.id,faceId:row.faceId,owner:structuralOwner(),snapshot:structuralBridge.snapshot,editor,faceVertices:structuredClone(faceVertices),vertices:row.boundaryStale?[]:structuredClone(row.boundaryVertices||[]),viewBox:{x:minX-margin,y:-maxY-margin,width:maxX-minX+2*margin,height:maxY-minY+2*margin},message:row.boundaryStale?'The face changed. Draw a new boundary; the previous polygon is not remapped.':'',focus:document.activeElement};$('structural-boundary-x').value='';$('structural-boundary-y').value='';$('structural-boundary-owner').textContent=`${row.memberLabel||row.id} · ${row.faceId}\nWorld XY coordinates in feet · exact selected-face maximum ${maximum.projectedAreaSFText} SF`;renderStructuralBoundary();$('structural-boundary-dialog').showModal();$('structural-boundary-svg').focus();}catch(error){structuralBridge.message=error.message;renderStructuralBridge();}
}
function closeStructuralBoundary(){const focus=structuralBoundaryDraft?.focus;$('structural-boundary-dialog').close();structuralBoundaryDraft=null;if(focus?.isConnected)focus.focus({preventScroll:true});finishDialogReload();}
function structuralBoundaryAddPoint(point){const draft=structuralBoundaryDraft;if(!draft)return;if(draft.vertices.length>=64){draft.message='A boundary supports at most 64 vertices.';renderStructuralBoundary();return;}if(!point||![point.x,point.y].every(Number.isFinite)){draft.message='Enter finite world XY coordinates.';renderStructuralBoundary();return;}draft.vertices.push({x:point.x,y:point.y});draft.message='';renderStructuralBoundary();}
function structuralBoundaryAddExact(){try{const x=$('structural-boundary-x').value.trim(),y=$('structural-boundary-y').value.trim();if(!x||!y)throw Error('Enter both world X and Y. Bare values are feet; length suffixes are supported.');const prefs={...state().settings,units:'ft'};structuralBoundaryAddPoint({x:geometry.parseLength(x,prefs),y:geometry.parseLength(y,prefs)});}catch(error){if(structuralBoundaryDraft){structuralBoundaryDraft.message=error.message;renderStructuralBoundary();}}}
function commitStructuralBoundary(){
  const draft=structuralBoundaryDraft;if(!draft)return;const row=structuralBridge.assignments.find(row=>row.id===draft.assignmentId);if(!structuralSourceCurrent()||draft.editor!==editor||draft.snapshot!==structuralBridge.snapshot||!row||row.faceId!==draft.faceId||!structuralAssignmentOwnerCurrent()){draft.message='The source or selected face changed. Cancel and reopen this boundary editor.';renderStructuralBoundary();return;}
  const inspection=structuralBoundaryInspectionForDraft(),item=inspection?.assignments?.find(item=>item.id===draft.assignmentId);if(item?.geometryStatus!=='ok'){draft.message=item?.diagnostics?.map(item=>item.message).join('\n')||inspection?.diagnostics?.map(item=>item.message).join('\n')||'Draw a valid simple polygon with 3 to 64 vertices inside the selected face.';renderStructuralBoundary();return;}
  row.areaMode='drawn-boundary';row.boundaryVertices=structuredClone(draft.vertices);row.boundaryFaceId=draft.faceId;row.boundaryStale=false;row.boundaryAreaSF=item.projectedTributaryAreaSF;invalidateStructuralDraft();closeStructuralBoundary();renderStructuralAssignments();renderStructuralBridge();
}
function renderStructuralBoundary(){
  const draft=structuralBoundaryDraft;if(!draft)return;const svg=$('structural-boundary-svg'),ns='http://www.w3.org/2000/svg',make=(tag,attributes,title)=>{const node=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attributes))node.setAttribute(k,String(v));if(title){const text=document.createElementNS(ns,'title');text.textContent=title;node.append(text);}svg.append(node);return node;},points=vertices=>vertices.map(p=>`${p.x},${-p.y}`).join(' ');svg.replaceChildren();svg.setAttribute('viewBox',Object.values(draft.viewBox).join(' '));
  for(const face of structuralChosenRegion()?.faces||[])make('polygon',{points:points(face.verticesWorldFt),fill:face.id===draft.faceId?'#346f5c':'#17313b',stroke:face.id===draft.faceId?'#8ecab0':'#3c5c69','stroke-width':1.5,'vector-effect':'non-scaling-stroke','data-source-face-id':face.id},`${face.id} · ${face.risePer12}:12 · projected ${String(face.projectedAreaSF)} SF`);
  for(const row of structuralBridge.assignments)if(row.id!==draft.assignmentId&&row.areaMode==='drawn-boundary'&&row.boundaryVertices?.length>=3)make('polygon',{points:points(row.boundaryVertices),fill:'#dcac6940',stroke:row.boundaryStale?'#ef9b7b':'#dfba83','stroke-width':2,'vector-effect':'non-scaling-stroke','data-boundary-assignment-id':row.id},`${row.memberLabel||row.id} · ${row.faceId}${row.boundaryStale?' · face changed':''}`);
  draft.inspection=structuralBoundaryInspectionForDraft();const item=draft.inspection?.assignments?.find(item=>item.id===draft.assignmentId),valid=item?.geometryStatus==='ok',span=Math.max(draft.viewBox.width,draft.viewBox.height);if(draft.vertices.length>=2)make(draft.vertices.length>=3?'polygon':'polyline',{points:points(draft.vertices),fill:draft.vertices.length>=3?'#85d4be33':'none',stroke:valid?'#b6f0d3':'#f2bd91','stroke-width':2.5,'vector-effect':'non-scaling-stroke'},'Current editor vertices; kept only by Close boundary');
  draft.vertices.forEach((p,index)=>{make('circle',{cx:p.x,cy:-p.y,r:span*.009,fill:index===0?'#f5df9b':'#b6e7d9','data-boundary-vertex-index':index},`Vertex ${index+1}: ${String(p.x)}, ${String(p.y)} ft${index===0?' · click to close':''}`);const text=make('text',{x:p.x+span*.012,y:-p.y-span*.012,fill:'#eff8ee','font-size':span*.028,'pointer-events':'none'});text.textContent=String(index+1);});
  const overlaps=draft.inspection?.overlapPairs?.filter(pair=>pair.assignmentIds.includes(draft.assignmentId))||[],detail=item?.diagnostics?.map(item=>item.message)||[];$('structural-boundary-message').dataset.status=valid?'ok':'invalid';$('structural-boundary-message').textContent=draft.message||`${draft.vertices.length} vertices · ${valid?`polygon area ${String(item.projectedTributaryAreaSF)} SF`:'polygon is incomplete or invalid'}${overlaps.length?'\nPositive overlap with another drawn assignment. You can keep this draft for repair; export stays blocked.':''}${detail.length?'\n'+detail.join('\n'):''}`;structuralTable('structural-boundary-vertices',['Vertex','World X ft','World Y ft'],draft.vertices.map((p,i)=>[i+1,String(p.x),String(p.y)]));$('structural-boundary-undo').disabled=!draft.vertices.length;$('structural-boundary-clear').disabled=!draft.vertices.length;$('structural-boundary-commit').disabled=!structuralSourceCurrent();
}
function renderStructuralAssignments(){
  const box=$('structural-assignment-list');box.replaceChildren();const region=structuralChosenRegion(),faces=structuralAssignmentOwnerCurrent()?region?.faces||[]:[];
  const field=(parent,label,value,dataset,{options=null,number=false,title=''}={})=>{const wrap=document.createElement('label');wrap.append(document.createTextNode(label));const input=document.createElement(options?'select':'input');Object.assign(input.dataset,dataset);if(options){for(const [id,text]of options){const option=document.createElement('option');option.value=id;option.textContent=text;input.append(option);}if(value&&!options.some(([id])=>id===value)){const option=document.createElement('option');option.value=value;option.textContent='Unmatched source value: '+value;input.append(option);}}else{input.type=number?'number':'text';if(number){input.step='any';input.min='0';}else input.maxLength=160;}input.value=value;input.title=title;input.required=true;wrap.append(input);parent.append(wrap);return input;};
  const button=(parent,label,action)=>{const node=document.createElement('button');node.type='button';node.dataset.assignmentAction=action;node.textContent=label;parent.append(node);return node;};
  for(const [index,row]of structuralBridge.assignments.entries()){
    const card=document.createElement('article');card.className='structural-assignment';card.dataset.assignmentId=row.id;const heading=document.createElement('div');heading.className='structural-assignment-heading';const title=document.createElement('h4');title.textContent=`Independent check ${index+1} · ${row.id}`;heading.append(title);button(heading,'Remove check','remove');card.append(heading);
    field(card,'Member / check name',row.memberLabel,{assignmentField:'memberLabel'},{title:'A label for this independent member-region check. Repeated labels are not combined.'});
    field(card,'Exact source face',row.faceId,{assignmentField:'faceId'},{options:[['','Choose a current generated face'],...faces.map(face=>[face.id,`${face.id}${face.componentId?' · '+face.componentId:''} · ${face.risePer12}:12`])],title:'Select an exposed face derived from this exact source roof region.'});
    field(card,'Area definition',row.areaMode||'explicit-area',{assignmentField:'areaMode'},{options:[['explicit-area','Explicit projected area · unlocated'],['drawn-boundary','Drawn world XY boundary']],title:'An explicit area has no spatial location. A drawn boundary is measured in world XY feet and checked against its exact current face.'});
    const drawn=row.areaMode==='drawn-boundary';field(card,drawn?'Drawn projected area (SF)':'Projected tributary area (SF)',drawn?row.boundaryAreaSF??'':row.projectedTributaryAreaSF,{assignmentField:'projectedTributaryAreaSF'},{number:true,title:drawn?'Derived polygon area. Edit the boundary to change it.':'Explicit horizontal projected square feet for this check, greater than zero and no larger than this face. No area is inferred or allocated.'});
    const face=faces.find(face=>face.id===row.faceId),hint=document.createElement('output');hint.className='structural-face-hint';hint.dataset.assignmentFaceSummary='';hint.textContent=face?`Face ${face.id}: ${face.risePer12}:12 · exact projected maximum ${String(face.projectedAreaSF)} SF · sloping area ${structuralText(face.surfaceAreaSF,'SF')}`:'Choose the exact face before declaring its tributary area.';card.append(hint);
    const actions=document.createElement('div');actions.className='structural-area-actions';const maximum=button(actions,'Use exact maximum','exact-maximum');maximum.title='Explicitly fill this face’s exact projected maximum as an unlocated manual area. This does not draw a boundary or infer a load path.';maximum.hidden=drawn;button(actions,row.boundaryVertices?.length&&!row.boundaryStale?'Edit / redraw boundary':'Draw XY boundary','draw-boundary');button(actions,'Clear boundary','clear-boundary');card.append(actions);const boundaryNote=document.createElement('output');boundaryNote.className='structural-boundary-area';boundaryNote.dataset.assignmentBoundarySummary='';boundaryNote.textContent=drawn?row.boundaryStale?'Face changed: previous polygon is invalid until explicitly redrawn or cleared.':`${row.boundaryVertices?.length||0} boundary vertices · world XY feet${Number.isFinite(row.boundaryAreaSF)?' · '+String(row.boundaryAreaSF)+' SF':''}`:'Explicit area is unlocated; spatial overlap checks cannot establish its coverage.';card.append(boundaryNote);
    const note=document.createElement('p');note.className='structural-note';note.textContent='Declared dead-load items — enter your own values and area basis. No material weights are supplied.';card.append(note);
    for(const [i,item]of row.deadLoadItems.entries()){const line=document.createElement('div');line.className='structural-dead-load';line.dataset.deadLoadIndex=String(i);field(line,'Item label',item.label,{deadLoadField:'label'});field(line,'Dead load (PSF)',item.psf,{deadLoadField:'psf'},{number:true,title:'Your declared pounds per square foot. Zero is valid only when explicitly entered.'});field(line,'PSF area basis',item.basis,{deadLoadField:'basis'},{options:[['','Choose the declared basis'],['projected-horizontal','Horizontal projected area'],['sloping-surface','Sloping roof surface']],title:'Sloping-surface PSF is converted using this face’s actual slope; horizontal projected PSF is used directly.'});button(line,'Remove item','remove-dead-load');card.append(line);}
    button(card,'Add dead-load item','add-dead-load');box.append(card);
  }
  if(!structuralBridge.assignments.length){const note=document.createElement('p');note.className='structural-note';note.textContent='No assignment checks yet. Add a check and enter its face, projected area and dead-load items explicitly.';box.append(note);}
}
function structuralAssignmentInput(event){
  const control=event.target;if(event.type==='input'&&control.tagName==='SELECT'||event.type==='change'&&control.tagName!=='SELECT')return;
  const card=control.closest('[data-assignment-id]'),row=structuralBridge.assignments.find(row=>row.id===card?.dataset.assignmentId);if(!row)return;
  if(control.dataset.assignmentField){if(control.dataset.assignmentField==='faceId'&&control.value!==row.faceId&&row.boundaryVertices?.length)row.boundaryStale=true;row[control.dataset.assignmentField]=control.value;}else if(control.dataset.deadLoadField){const item=row.deadLoadItems[Number(control.closest('[data-dead-load-index]')?.dataset.deadLoadIndex)];if(item)item[control.dataset.deadLoadField]=control.value;}else return;
  structuralDraftChanged();if(['faceId','areaMode'].includes(control.dataset.assignmentField)){renderStructuralAssignments();renderStructuralBridge();}
}
function structuralAssignmentAction(event){
  const button=event.target.closest('[data-assignment-action]');if(!button||structuralBridge.busy||!structuralSourceCurrent())return;const row=structuralBridge.assignments.find(row=>row.id===button.closest('[data-assignment-id]')?.dataset.assignmentId);if(!row)return;
  if(button.dataset.assignmentAction==='draw-boundary'){showStructuralBoundary(row);return;}
  if(button.dataset.assignmentAction==='exact-maximum'){try{const maximum=structuralBoundaryMaximum(row);row.areaMode='explicit-area';row.projectedTributaryAreaSF=maximum.projectedAreaSFText;}catch(error){structuralBridge.message=error.message;renderStructuralBridge();return;}}
  if(button.dataset.assignmentAction==='clear-boundary'){row.boundaryVertices=[];row.boundaryAreaSF=null;row.boundaryStale=false;row.boundaryFaceId=null;}
  const action=button.dataset.assignmentAction;if(action==='remove')structuralBridge.assignments=structuralBridge.assignments.filter(item=>item!==row);if(action==='add-dead-load'){if(row.deadLoadItems.length>=32){structuralBridge.message='Each check supports at most 32 declared dead-load items.';renderStructuralBridge();return;}row.deadLoadItems.push({label:'',psf:'',basis:''});}if(action==='remove-dead-load')row.deadLoadItems.splice(Number(button.closest('[data-dead-load-index]').dataset.deadLoadIndex),1);invalidateStructuralDraft();renderStructuralAssignments();renderStructuralBridge();
}
function structuralText(value,unit=''){return Number.isFinite(value)?`${format(value,6)}${unit?' '+unit:''}`:'—';}
function structuralSelectionChanged({components=false,faces=false}={}){
  if(!structuralSourceCurrent()){markStructuralStale();return;}
  invalidateStructuralDraft();if(components||faces)structuralBridge.loadedSelection=null;
  if(components){const group=$('structural-roof-group').value,byId=new Map();for(const region of structuralRegions().filter(region=>region.roofGroupId===group&&region.componentId))if(!byId.has(region.componentId)||region.faceIds.length>byId.get(region.componentId).faceIds.length)byId.set(region.componentId,region);architectureChoice('structural-component',[...byId.values()].map(region=>({id:region.componentId,label:region.name})),'Entire roof group');}
  if(components||faces){const group=structuralGroupRegion(),component=$('structural-component').value;architectureChoice('structural-face',(group?.faces||[]).filter(face=>!component||face.componentId===component).map(face=>({id:face.id,label:`${face.id}${face.componentId?' · '+face.componentId:''} · ${face.risePer12}:12`})),'All faces in this region');}
  if(components||faces)renderStructuralAssignments();renderStructuralBridge();
}
function structuralTable(id,headings,rows){const box=$(id);box.replaceChildren();if(!rows.length){const note=document.createElement('p');note.textContent='No source records in this category.';box.append(note);return;}const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr');for(const heading of headings){const cell=document.createElement('th');cell.scope='col';cell.textContent=heading;header.append(cell);}head.append(header);const body=document.createElement('tbody');for(const values of rows){const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}body.append(row);}table.append(head,body);box.append(table);}
function renderStructuralBridge(){
  const region=structuralChosenRegion(),current=structuralSourceCurrent(),available=Boolean(desktop?.exportStructuralRoofRequest&&desktop?.importStructuralRoofResult),busy=structuralBridge.busy,assigned=structuralMode()==='assignments',ownerCurrent=structuralAssignmentOwnerCurrent();
  $('structural-comparison').hidden=assigned;$('structural-assignments').hidden=!assigned;$('structural-face-label').hidden=assigned;
  $('structural-source').textContent=structuralBridge.catalog?`Model units: ${structuralBridge.catalog.source.modelUnits} · accepted source revision ${structuralBridge.catalog.source.architectureRevision}\nDocument SHA-256: ${structuralBridge.catalog.source.documentHash}`:'No accepted roof source is available.';
  $('structural-region-summary').textContent=region?`${region.name}\n${region.faces.length} exposed source face${region.faces.length===1?'':'s'} · pitches ${region.pitches.map(p=>p.risePer12+':12').join(', ')}\nProjected area ${structuralText(region.projectedAreaSF,'SF')} · sloping surface ${structuralText(region.surfaceAreaSF,'SF')}\nRoof elevations ${structuralText(region.minElevationFt,'ft')} to ${structuralText(region.maxElevationFt,'ft')} · building-local datum\n${region.reviewRequired?'Review-only roof: drainage review remains required.':'Accepted roof geometry: '+region.status}`:'Choose an existing roof group, component or face.';
  structuralTable('structural-face-table',['Source face','Pitch','Projected SF','Surface SF'],(region?.faces||[]).map(face=>[face.id,face.risePer12+':12',structuralText(face.projectedAreaSF),structuralText(face.surfaceAreaSF)]));
  const elevations=region?.elevations;structuralTable('structural-level-table',['Level','Floor ft','Bearing ft','Ceiling ft'],(elevations?.levels||[]).map(level=>[level.id,structuralText(level.floorElevationFt),structuralText(level.defaultBearingElevationFt),structuralText(level.defaultCeilingElevationFt)]));structuralTable('structural-bearing-table',['Face','Bearing ft','Heel ft','Eave ft'],(elevations?.bearingFaces||[]).map(face=>[face.faceId,structuralText(face.bearingElevationFt),structuralText(face.heelOffsetFt),structuralText(face.eaveElevationFt)]));
  structuralTable('structural-room-table',['Room / level','Floor ft','Ceiling ft','Target ft'],(elevations?.rooms||[]).map(room=>[room.id+' / '+room.levelId,structuralText(room.floorElevationFt),structuralText(room.ceilingElevationFt),structuralText(room.targetCeilingElevationFt)]));
  const owner=structuralBridge.assignmentOwner;$('structural-assignment-owner').dataset.current=String(!structuralBridge.assignments.length||ownerCurrent);$('structural-assignment-owner').textContent=structuralBridge.assignments.length?`Schedule source: ${owner?.roofGroupId||'—'}${owner?.componentId?' / '+owner.componentId:' / entire group'}\n${ownerCurrent?'Every row remains an independent check on an exact generated face.':'This schedule belongs to another source region. Return to it or start an empty schedule for the selected region.'}`:'Choose the accepted source region above, then add independent checks. No tributary areas or dead-load items are filled automatically.';
  $('structural-message').textContent=structuralBridge.message||(!available?'JSON exchange requires the Windows desktop application.':structuralBridge.catalog?.diagnostics?.map(item=>item.message).join('\n')||(assigned?'Enter every projected tributary area, dead-load value and area basis explicitly. No member totals or capacities are inferred.':'Enter the member tributary area explicitly. Roof area is not used as a member area.'));$('structural-message').dataset.status=structuralBridge.status;
  for(const control of $('structural-bridge-dialog').querySelectorAll('input,select,button'))control.disabled=busy;
  for(const control of $('structural-comparison').querySelectorAll('input'))control.disabled=busy||assigned;
  for(const control of $('structural-assignments').querySelectorAll('input,select,button'))control.disabled=busy||!current||!assigned||Boolean(structuralBridge.assignments.length&&!ownerCurrent);
  for(const card of $('structural-assignment-list').querySelectorAll('[data-assignment-id]')){const row=structuralBridge.assignments.find(row=>row.id===card.dataset.assignmentId),drawn=row?.areaMode==='drawn-boundary',base=busy||!current||!assigned||!ownerCurrent,face=region?.faces.find(face=>face.id===row?.faceId);card.querySelector('[data-assignment-field="projectedTributaryAreaSF"]').disabled=base||drawn;card.querySelector('[data-assignment-action="exact-maximum"]').disabled=base||drawn||!face;card.querySelector('[data-assignment-action="draw-boundary"]').disabled=base||!face;card.querySelector('[data-assignment-action="clear-boundary"]').disabled=base||!row?.boundaryVertices?.length&&!row?.boundaryStale;}
  $('structural-face').disabled=busy||assigned;$('structural-assignment-add').disabled=busy||!current||!region||Boolean(structuralBridge.assignments.length&&!ownerCurrent);$('structural-assignment-clear').disabled=busy||!current||!region;$('structural-assignment-review').disabled=busy||!current||!region||!ownerCurrent||!structuralBridge.assignments.length;
  const spatial=assigned?structuralInspectBoundaries():null,spatialDiagnostics=spatial?.diagnostics||[],pairs=spatial?.overlapPairs||[];$('structural-boundary-summary').dataset.status=spatial&&!spatial.canExport?'invalid':'ok';$('structural-boundary-summary').textContent=spatial?`${spatial.assignments?.filter(row=>row.areaDefinition?.kind==='drawn-boundary').length||0} drawn boundaries · ${spatial.manualAreaIds?.length||0} unlocated explicit areas\n${spatial.manualAreaIds?.length?'Spatial checks are incomplete for unlocated manual areas.\n':''}${pairs.length?'Positive drawn overlap blocks export. Drafts are retained for repair.\n':'Shared edges are allowed; no positive drawn overlap reported.\n'}${spatialDiagnostics.map(item=>(item.assignmentId?item.assignmentId+': ':'')+item.message).join('\n')}`:'Explicit areas have no location. Use Draw XY boundary for spatial containment and overlap checks.';structuralTable('structural-boundary-overlaps',['Assignment pair','Positive overlap SF'],pairs.map(pair=>[pair.assignmentIds.join(' / '),String(pair.projectedIntersectionAreaSF)]));
  $('structural-export').disabled=busy||!available||!current||!region||Boolean(assigned&&(!ownerCurrent||!structuralBridge.assignments.length||structuralUsesBoundaries()&&!spatial?.canExport));$('structural-import').disabled=busy||!available||!current||!structuralBridge.exportRecord;$('structural-reload').disabled=busy;$('structural-request-open').disabled=busy||!current||!desktop?.loadStructuralRoofRequest;
  const preview=structuralBridge.assignmentPreview;$('structural-assignment-preview').hidden=!assigned||!preview;structuralTable('structural-assignment-preview-table',['Check','Face / pitch','Projected SF','Declared items / basis','Projected D PSF','D pounds'],(preview?.assignments||[]).map(row=>[row.memberLabel,row.faceId+' / '+preview.region.faces.find(face=>face.id===row.faceId)?.risePer12+':12',structuralText(row.projectedTributaryAreaSF),row.deadLoadItems.map(item=>`${item.label}: ${item.psf} PSF (${item.basis})`).join('; '),structuralText(row.deadLoad?.projectedPSF),structuralText(row.deadLoad?.pounds)]));
  const result=structuralBridge.result,v2=result?.version>=2;$('structural-result').hidden=!result;$('structural-result-title').textContent=v2?'Preliminary independent member-region results':'Preliminary external roof-live comparison';$('structural-result-note').textContent=v2?'Each check is independent. Dead-load pounds and roof-live pounds are separate; there is no combined D + L, grouped-member total, inferred load path or capacity check.':'';
  structuralTable('structural-result-table',v2?['Check','Member','Face','Pitch','Projected SF','F','R1','R2','L0 PSF','Lr PSF','D projected PSF','D pounds','Roof-live pounds']:['Face','Pitch','Member SF','F','R1','R2','L0 PSF','Lr PSF'],(result?.calculations||[]).map(row=>v2?[row.assignmentId,row.memberLabel,row.faceId,row.pitchRisePer12+':12',structuralText(row.projectedTributaryAreaSF),structuralText(row.F),structuralText(row.R1),structuralText(row.R2),structuralText(row.L0PSF),structuralText(row.LrPSF),structuralText(row.deadLoadProjectedPSF),structuralText(row.deadLoadPounds),structuralText(row.roofLivePounds)]:[row.faceId,row.pitchRisePer12+':12',structuralText(row.memberTributaryAreaSF),structuralText(row.F),structuralText(row.R1),structuralText(row.R2),structuralText(row.L0PSF),structuralText(row.LrPSF)]));
  $('structural-engine').textContent=result?`External declaration: ${result.engine.id} ${result.engine.version}\nSource commit ${result.engine.sourceCommit}\nRoof-live SHA-256 ${result.engine.roofLiveSHA256}\nFactor arithmetic and source binding checked. Engine execution, code compliance and member capacity are not verified.`:'';
  $('structural-result-warnings').textContent=result?.warnings?.join('\n')||'';$('structural-export-hash').textContent=structuralBridge.exportRecord?`Actually exported request SHA-256: ${structuralBridge.exportRecord.exportHash}`:'No request has been exported from this dialog.';
}
function markStructuralStale(){structuralBridge.status='stale';structuralBridge.message='The drawing changed. Reload accepted source before exporting or importing another result. A source reload clears assignment drafts from the previous drawing.';structuralBridge.result=null;structuralBridge.assignmentPreview=null;structuralBridge.boundaryInspection=null;renderStructuralBridge();if(structuralBoundaryDraft){structuralBoundaryDraft.message='The drawing changed. Cancel this boundary editor and reload the accepted source.';renderStructuralBoundary();}}
function syncStructuralBridge(){if($('structural-bridge-dialog').open&&!structuralBridge.busy&&!structuralSourceCurrent()&&structuralBridge.status!=='stale')markStructuralStale();}
function loadStructuralSource({preserveArea=false,owner=null}={}){
  const previousGroup=$('structural-roof-group').value,previousComponent=$('structural-component').value,selected=currentRoofComponent(),selectedOwners=activeObjects().filter(object=>state().selectionIds.includes(object.id)).map(architectureOwner).filter(owner=>owner?.kind==='roofGroup'),unique=[...new Set(selectedOwners.map(owner=>owner.id))];
  const changed=structuralBridge.editor!==editor||structuralBridge.snapshot!==serializedDrawing(),discarded=changed&&structuralBridge.assignments.length;if(changed){if(structuralBridge.editor!==editor)$('structural-mode').value='comparison';structuralBridge.assignments=[];structuralBridge.assignmentOwner=null;structuralBridge.assignmentPreview=null;structuralBridge.assignmentProtocol=2;structuralBridge.boundaryInspection=null;structuralBridge.loadedSelection=null;structuralBridge.nextAssignmentId=1;}
  structuralBridge.editor=editor;structuralBridge.snapshot=serializedDrawing();structuralBridge.exportRecord=null;structuralBridge.result=null;structuralBridge.status='ready';structuralBridge.message='';
  if(!preserveArea){$('structural-member-area').value='';$('structural-member-label').value='';}
  try{structuralBridge.catalog=listStructuralRoofRegions(structuralBridge.snapshot);}catch(error){structuralBridge.catalog=null;structuralBridge.status='error';structuralBridge.message=error.message;}
  const byId=new Map();for(const region of structuralRegions())if(!byId.has(region.roofGroupId)||region.faceIds.length>byId.get(region.roofGroupId).faceIds.length)byId.set(region.roofGroupId,region);architectureChoice('structural-roof-group',[...byId.values()].map(region=>({id:region.roofGroupId,label:region.name})),'Choose an accepted roof group');
  const group=preserveArea?previousGroup:owner?.id||selected?.roofGroupId||($('architecture-dialog').open?$('arch-roof-id').value:'')||(unique.length===1?unique[0]:'');$('structural-roof-group').value=group;structuralSelectionChanged({components:true});
  const component=preserveArea?previousComponent:owner?.componentId||selected?.componentId||($('architecture-dialog').open?$('arch-roof-component-id').value:'');if(component){$('structural-component').value=component;structuralSelectionChanged({faces:true});}
  if(!structuralBridge.catalog){structuralBridge.status='error';structuralBridge.message='A physical-unit drawing with accepted source-owned roof geometry is required.';}
  else if(discarded)structuralBridge.message='Accepted source reloaded. The previous drawing’s assignment draft was discarded; saved request JSON files remain separate.';
  renderStructuralAssignments();
  renderStructuralBridge();
}
function showStructuralBridge(owner=null){
  if(documentActionBusy||structuralBridge.busy||state().command||ordinaryGripStage||drag||orbitMode||panTool||viewportNavigationDraft){toast('Finish or cancel the current drawing operation before opening Structural bridge.');return{ok:false,message:'Structural bridge requires an idle drawing.'};}
  if(modalIds.some(id=>!['architecture-dialog','structural-bridge-dialog'].includes(id)&&$(id).open)){toast('Close the current editor before opening Structural bridge.');return{ok:false,message:'Another editor is open.'};}
  closeCanvasMenu(false);hideToolHelp();structuralBridge.focus=document.activeElement;const selected=currentRoofComponent(),target=owner||(selected?{id:selected.roofGroupId,componentId:selected.componentId}:null);if(!structuralSourceCurrent()||!structuralBridge.catalog)loadStructuralSource({owner:target});else if(target&&(target.id!==$('structural-roof-group').value||(target.componentId||'')!==$('structural-component').value)){$('structural-roof-group').value=target.id;structuralSelectionChanged({components:true});$('structural-component').value=target.componentId||'';structuralSelectionChanged({faces:true});}else renderStructuralBridge();if(!$('structural-bridge-dialog').open)$('structural-bridge-dialog').showModal();$('structural-roof-group').focus();return{ok:true,message:'Read-only structural exchange opened.'};
}
function closeStructuralBridge(){if(structuralBridge.busy)return;$('structural-bridge-dialog').close();const focus=structuralBridge.focus;if(focus?.isConnected)focus.focus({preventScroll:true});finishDialogReload();}
function appendStructuralBridgeLaunch(box,owner){const button=document.createElement('button');button.id='roof-structural-bridge';button.type='button';button.className='architecture-owner-button';button.dataset.structuralBridge='';button.textContent='Structural bridge · read-only exchange';button.addEventListener('click',()=>showStructuralBridge(owner));box.append(button);}
function populateStructuralRequest(record){
  const assigned=record.version>=2;$('structural-mode').value=assigned?'assignments':'comparison';$('structural-roof-group').value=record.selection.roofGroupId;structuralSelectionChanged({components:true});$('structural-component').value=record.selection.componentId||'';structuralSelectionChanged({faces:true});
  if(assigned){structuralBridge.assignmentOwner=structuralOwner();structuralBridge.assignmentProtocol=record.version;structuralBridge.assignments=record.assignments.map(row=>({id:row.id,memberLabel:row.memberLabel,faceId:row.faceId,projectedTributaryAreaSF:row.areaDefinition?.kind==='drawn-boundary'?'':String(row.projectedTributaryAreaSF),areaMode:row.areaDefinition?.kind||'explicit-area',boundaryVertices:structuredClone(row.areaDefinition?.vertices||[]),boundaryFaceId:row.areaDefinition?.kind==='drawn-boundary'?row.faceId:null,boundaryAreaSF:row.areaDefinition?.kind==='drawn-boundary'?row.projectedTributaryAreaSF:null,boundaryStale:false,deadLoadItems:row.deadLoadItems.map(item=>({label:item.label,psf:String(item.psf),basis:item.basis}))}));structuralBridge.assignmentPreview=record;structuralBridge.nextAssignmentId=1;}
  else{$('structural-member-area').value=String(record.member.tributaryAreaSF);$('structural-member-label').value=record.member.label;const selected=record.selection.faceIds,exact=structuralRegions().some(region=>region.roofGroupId===record.selection.roofGroupId&&region.componentId===record.selection.componentId&&region.faceIds.length===selected.length&&selected.every(id=>region.faceIds.includes(id)));if(exact){if(selected.length===1)$('structural-face').value=selected[0];}else{const option=document.createElement('option');option.value='@loaded-selection';option.textContent=`Saved selection · ${selected.length} exact face${selected.length===1?'':'s'}`;$('structural-face').append(option);$('structural-face').value=option.value;structuralBridge.loadedSelection={faceIds:structuredClone(selected),region:structuredClone(record.region)};}}
  structuralBridge.exportRecord=record;structuralBridge.result=null;structuralBridge.status='exported';renderStructuralAssignments();
}
async function structuralExchange(kind){
  if(structuralBridge.busy)return;if(!structuralSourceCurrent()){markStructuralStale();return;}
  if(documentActionBusy||state().command||ordinaryGripStage||drag||orbitMode||panTool||viewportNavigationDraft){structuralBridge.status='error';structuralBridge.message='Finish the current drawing operation before exchanging structural data.';renderStructuralBridge();return;}
  const snapshot=structuralBridge.snapshot,sessionEditor=editor,previousResult=structuralBridge.result;
  try{
    let request;if(kind==='export'){const assigned=structuralMode()==='assignments',options=assigned?structuralAssignmentOptions():structuralOptions();if(!assigned&&!$('structural-member-area').value.trim())throw Error('Enter the member tributary area in square feet.');request={text:snapshot,options};if(assigned)(structuralUsesBoundaries()?createStructuralRoofBoundaryExport:createStructuralRoofAssignmentExport)(snapshot,options);else createStructuralRoofExport(snapshot,options);}
    else if(kind==='load'){if(!desktop?.loadStructuralRoofRequest)throw Error('Request JSON loading requires the updated Windows desktop host.');request={text:snapshot};}
    else{if(!structuralBridge.exportRecord)throw Error('Export or open this source-bound request before importing its external result.');validateStructuralRequest(snapshot,structuralBridge.exportRecord);request={text:snapshot,exportRecord:structuredClone(structuralBridge.exportRecord)};structuralBridge.result=null;}
    structuralBridge.busy=true;structuralBridge.status='busy';structuralBridge.message=kind==='export'?'Choose a separate JSON file for the roof request.':kind==='load'?'Choose an existing request JSON from this exact current drawing.':'Choose the external calculation result JSON.';renderStructuralBridge();
    const response=kind==='export'?await desktop.exportStructuralRoofRequest(request):kind==='load'?await desktop.loadStructuralRoofRequest(request):await desktop.importStructuralRoofResult(request);
    if(editor!==sessionEditor||!structuralSourceCurrent()){markStructuralStale();return;}
    if(response?.canceled){structuralBridge.result=previousResult;structuralBridge.status=structuralBridge.exportRecord?'exported':'ready';structuralBridge.message='Exchange canceled; the drawing is unchanged.';return;}
    if(!response?.ok)throw Error(response?.error||'The structural JSON exchange failed.');
    if(kind==='export'){const record=validateStructuralRequest(serializedDrawing(),response.record);structuralBridge.exportRecord=record;structuralBridge.assignmentPreview=record.version>=2?record:null;structuralBridge.result=null;structuralBridge.status='exported';structuralBridge.message=`Exported ${response.name}. Run the optional external adapter manually, then import its result. The drawing and its file association are unchanged.`;}
    else if(kind==='load'){const record=validateStructuralRequest(serializedDrawing(),response.record);populateStructuralRequest(record);structuralBridge.message=`Opened ${response.name}. The request matches the current drawing; its declared inputs are restored for editing or result import. The native file and history are unchanged.`;}
    else{const{verification:_computed,...externalRecord}=response.record;structuralBridge.result=validateStructuralResult(serializedDrawing(),structuralBridge.exportRecord,externalRecord);structuralBridge.status='imported';structuralBridge.message=`Imported ${response.name}. Source and declared arithmetic match; this is a preliminary external calculation only.`;}
  }catch(error){structuralBridge.result=null;structuralBridge.status=structuralSourceCurrent()?'error':'stale';structuralBridge.message=error.message;}
  finally{structuralBridge.busy=false;renderStructuralBridge();}
}
function structuralBridgeState(){const current=structuralSourceCurrent(),options=structuralOptions();return structuredClone({open:$('structural-bridge-dialog').open,status:!structuralBridge.editor?'idle':current?structuralBridge.status:'stale',busy:structuralBridge.busy,sourceCurrent:current,source:structuralBridge.catalog?.source||null,mode:structuralMode(),assignmentOwner:structuralBridge.assignmentOwner,boundaryProtocol:structuralUsesBoundaries()?3:2,boundaryInspection:current?structuralInspectBoundaries():null,boundaryEditor:structuralBoundaryState(),assignmentSourceCurrent:current&&structuralAssignmentOwnerCurrent(),assignments:structuralBridge.assignments,assignmentPreview:current?structuralBridge.assignmentPreview:null,reviewRecord:current?structuralBridge.assignmentPreview:null,selection:{roofGroupId:options.roofGroupId,componentId:options.componentId,faceIds:options.faceIds},memberTributaryAreaSF:structuralMode()==='comparison'&&$('structural-member-area').value.trim()&&Number.isFinite(options.memberTributaryAreaSF)?options.memberTributaryAreaSF:null,region:structuralChosenRegion(),exportRecord:current?structuralBridge.exportRecord:null,result:current?structuralBridge.result:null,message:structuralBridge.message});}
function applyArchitecture(operation){
  $('architecture-error').textContent='';$('architecture-result').textContent='';
  try{if(!editor.applyArchitecture)throw Error('Architecture integration is unavailable in this build.');if(state().command)throw Error('Finish or cancel the active drafting command first.');const result=editor.applyArchitecture(operation);resultLog(result);if(result?.ok===false)throw Error(result.message||'Architectural edit rejected.');refreshArchitectureLists();if(operation.type==='addWalls'){$('arch-wall-id').value=architectureSource().walls?.at(-1)?.id||'';loadArchitectureWall();}if(['setRoof','setRoofComponentFootprint'].includes(operation.type))loadArchitectureRoof();if(operation.type==='addRoof'){$('arch-roof-id').value=architectureSource().roofGroups?.at(-1)?.id||'';loadArchitectureRoof();}if(operation.type==='recognizeRooms'){$('arch-room-id').value=architectureSource().rooms?.[0]?.id||'';loadArchitectureRoom();}if(operation.type==='setRoom')loadArchitectureRoom();if(architectureTab==='space')loadArchitectureSpace();$('architecture-result').textContent=result?.message||'Architectural source updated.';return result;}catch(error){$('architecture-error').textContent=error.message||'Architectural edit failed.';return{ok:false,message:error.message};}
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
const architectureAlternativeFieldIds=['arch-alternatives-room','arch-alternatives-roof','arch-alternatives-mode','arch-alternatives-flat-elevations','arch-alternatives-tray-insets','arch-alternatives-tray-raised-elevations','arch-alternatives-maximum-fit','arch-alternatives-pitches','arch-alternatives-bearing-offsets','arch-alternatives-max-candidates','arch-alternatives-time-budget','arch-alternatives-max-work'];
function architectureAlternativeFieldStamp(){return JSON.stringify(architectureAlternativeFieldIds.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));}
function architectureAlternativeCurrent(){const study=architectureAlternativeStudy;return study.editor===editor&&study.document===serializedDrawing()&&study.fields===architectureAlternativeFieldStamp();}
function invalidateArchitectureAlternatives(message='Study inputs changed. Run a new search before applying a configuration.'){
  const study=architectureAlternativeStudy;study.search?.cancel();study.controller?.abort();study.runId++;study.search=null;study.controller=null;study.reviewedId='';
  if(study.report||study.status==='running'){study.status='stale';study.message=message;$('arch-alternatives-progress').textContent=`Stale study · ${message}\nRetained rows are historical evidence and cannot be applied.`;renderArchitectureAlternatives();}
  $('arch-alternatives-review').checked=false;updateArchitectureAlternativeButtons();
}
function syncArchitectureAlternatives(){const study=architectureAlternativeStudy;if((study.status==='running'||study.status==='complete')&&!architectureAlternativeCurrent())invalidateArchitectureAlternatives('The source, drawing, editor session or study fields changed.');}
function refreshArchitectureAlternativeChoices(){
  const source=architectureSource(),previousRoom=$('arch-alternatives-room').value,previousRoof=$('arch-alternatives-roof').value;
  architectureChoice('arch-alternatives-room',(source.rooms||[]).map(room=>({...room,label:room.label||room.id})),'Choose an accepted room');architectureChoice('arch-alternatives-roof',source.roofGroups||[],'Choose its covering roof');
  architectureChoice('arch-alternatives-report-layout',state().layouts||[],'Choose an existing paper layout');
  if(!previousRoom&&source.rooms?.length)$('arch-alternatives-room').value=source.rooms[0].id;
  if(!previousRoof){const covering=state().architectureDerived?.spaces?.find(item=>item.roomId===$('arch-alternatives-room').value)?.roofId;if(source.roofGroups?.some(group=>group.id===covering))$('arch-alternatives-roof').value=covering;else if(source.roofGroups?.length)$('arch-alternatives-roof').value=source.roofGroups[0].id;}
  syncArchitectureAlternatives();
}
function loadArchitectureAlternatives({matchRoof=false}={}){
  refreshArchitectureAlternativeChoices();const source=architectureSource(),room=source.rooms?.find(item=>item.id===$('arch-alternatives-room').value);
  if(matchRoof){const covering=state().architectureDerived?.spaces?.find(item=>item.roomId===room?.id)?.roofId;if(source.roofGroups?.some(group=>group.id===covering))$('arch-alternatives-roof').value=covering;}
  const group=source.roofGroups?.find(item=>item.id===$('arch-alternatives-roof').value),key=JSON.stringify([room?.id,group?.id,state().settings.units]);
  if(architectureAlternativeDefaults!==key){architectureAlternativeDefaults=key;if(room)$('arch-alternatives-flat-elevations').value=[...new Set([room.ceilingElevation,room.targetCeilingElevation])].map(value=>architectureSpaceLength(value)).join('; ');$('arch-alternatives-tray-insets').value=[architecturePhysicalLength("1'"),architecturePhysicalLength("2'")].map(value=>architectureSpaceLength(value)).join('; ');if(room)$('arch-alternatives-tray-raised-elevations').value=architectureSpaceLength(room.targetCeilingElevation);if(group)$('arch-alternatives-pitches').value=String(group.riseTwice/2);$('arch-alternatives-bearing-offsets').value='0';}
  $('arch-alternatives-roof-options').disabled=$('arch-alternatives-mode').value!=='co-design';
  $('arch-alternatives-context').textContent=room&&group?`${room.label||room.id} · ${group.name||group.id}\nCurrent ceiling: ${room.ceilingType==='tray'?'tray':architectureSpaceLength(room.ceilingElevation)} · target: ${architectureSpaceLength(room.targetCeilingElevation)}\nAccepted pitch: ${group.riseTwice/2}:12 · bearing default: ${architectureSpaceLength(group.bearingElevation)}\nSource revision ${source.revision} · ${$('arch-alternatives-mode').value==='fixed-roof'?'accepted roof geometry stays fixed':'only explicitly permitted pitch and uniform bearing changes'}\nEvery accepted room must remain feasible.`:'Recognize a room, declare its roof assembly and establish a feasible accepted ceiling in Space study before searching.';
  syncArchitectureAlternatives();updateArchitectureAlternativeButtons();
}
function architectureAlternativeList(id,{pitch=false}={}){
  const parts=$(id).value.split(';').map(part=>part.trim());if(parts.some(part=>!part)||parts.length>16)throw Error('Enter 1–16 nonempty choices separated by semicolons.');
  const values=parts.map(part=>{if(pitch){const match=part.match(/^(\d+(?:\.\d+)?)\s*(?::\s*12)?$/);if(!match)throw Error('Pitch choices must be rise per 12, for example 4; 4.5; 6.');const riseTwice=Number(match[1])*2;if(!Number.isInteger(riseTwice)||riseTwice<2||riseTwice>24)throw Error('Pitch choices must run from 1:12 to 12:12 in half-rise increments.');return riseTwice;}const value=geometry.parseLength(part,state().settings);if(!Number.isFinite(value))throw Error('Each alternative choice must be a finite drawing length.');return value;});
  if(new Set(values).size!==values.length)throw Error('Remove duplicate choices, including equivalent lengths written in different units.');return values;
}
function architectureAlternativeOptions(){
  const roomId=$('arch-alternatives-room').value,roofGroupId=$('arch-alternatives-roof').value,group=architectureSource().roofGroups?.find(item=>item.id===roofGroupId),mode=$('arch-alternatives-mode').value;if(!roomId||!group)throw Error('Choose an accepted room and roof group.');
  const integer=(id,max,label,multiplier=1)=>{const value=Number($(id).value)*multiplier;if(!$(id).value.trim()||!Number.isSafeInteger(value)||value<1||value>max)throw Error(`${label} must be an integer from 1 to ${max}${multiplier===1000?' milliseconds':''}.`);return value;};
  return{roomId,roofGroupId,mode,includeMaximumFit:$('arch-alternatives-maximum-fit').checked,flatElevations:architectureAlternativeList('arch-alternatives-flat-elevations'),trayInsets:architectureAlternativeList('arch-alternatives-tray-insets'),trayRaisedElevations:architectureAlternativeList('arch-alternatives-tray-raised-elevations'),pitchChoices:mode==='co-design'?architectureAlternativeList('arch-alternatives-pitches',{pitch:true}):[group.riseTwice],bearingOffsets:mode==='co-design'?architectureAlternativeList('arch-alternatives-bearing-offsets'):[0],maxCandidates:integer('arch-alternatives-max-candidates',128,'Configuration limit'),maxElapsedMs:integer('arch-alternatives-time-budget',30000,'Time budget',1000),maxWork:integer('arch-alternatives-max-work',8000000,'Geometry work limit')};
}
function architectureAlternativeProgress(progress){$('arch-alternatives-progress-bar').max=Math.max(1,progress.candidateCount||1);$('arch-alternatives-progress-bar').value=progress.evaluatedCount||0;$('arch-alternatives-progress').textContent=`${progress.status==='running'?'Searching snapshot':progress.status} · ${progress.evaluatedCount||0} / ${progress.candidateCount||0} configurations\n${progress.validCount||0} feasible · ${progress.rejectedCount||0} rejected · ${((progress.elapsedMs||0)/1000).toFixed(2)} s · ${progress.work||0} geometry work` ;}
async function searchArchitectureAlternatives(){
  $('architecture-error').textContent='';let options;try{options=architectureAlternativeOptions();}catch(error){$('architecture-error').textContent=error.message;return;}
  const previousSelection=architectureAlternativeStudy.selectedId;invalidateArchitectureAlternatives('A new search replaces the previous comparison.');const study=architectureAlternativeStudy,runId=++study.runId;
  Object.assign(study,{status:'running',report:null,selectedId:previousSelection,reviewedId:'',editor,document:serializedDrawing(),fields:architectureAlternativeFieldStamp(),message:'',controller:new AbortController()});
  $('arch-alternatives-review').checked=false;$('arch-alternatives-report').hidden=true;renderArchitectureAlternatives();architectureAlternativeProgress({status:'running'});updateArchitectureAlternativeButtons();
  try{
    study.search=createArchitectureAlternativeSearch(structuredClone(architectureSource()),structuredClone(state().settings),options);
    const report=await study.search.run({signal:study.controller.signal,yieldControl:()=>new Promise(resolve=>setTimeout(()=>{if(runId===study.runId&&!architectureAlternativeCurrent())invalidateArchitectureAlternatives('The drawing or inputs changed during the search.');resolve();},0)),onProgress:progress=>{if(runId!==study.runId)return;if(!architectureAlternativeCurrent()){invalidateArchitectureAlternatives('The drawing or inputs changed during the search.');return;}architectureAlternativeProgress(progress);}});
    if(runId!==study.runId)return;if(!architectureAlternativeCurrent()){invalidateArchitectureAlternatives('The drawing or inputs changed before the search completed.');return;}
    study.report=structuredClone(report);study.status=report.complete&&report.status==='complete'?'complete':report.status;study.search=null;study.controller=null;study.selectedId=report.rows?.some(row=>row.id===previousSelection)?previousSelection:report.baselineId||report.rows?.[0]?.id||'';
    architectureAlternativeProgress({...report,work:report.budget?.work});$('arch-alternatives-progress').textContent+=`\n${report.complete?'Complete stated grid · Pareto comparisons available.':'Incomplete study · no rankings or Apply.'}\n${report.stoppingReason||''}${report.diagnostics?.length?'\n'+report.diagnostics.map(item=>item.message||String(item)).join('\n'):''}`;renderArchitectureAlternatives();
  }catch(error){if(runId!==study.runId)return;study.status='unsupported';study.message=error.message;study.search=null;study.controller=null;$('arch-alternatives-progress').textContent=`Study rejected · ${error.message}\nNo rankings or Apply.`;renderArchitectureAlternatives();}
  updateArchitectureAlternativeButtons();
}
function selectedArchitectureAlternative(){return architectureAlternativeStudy.report?.rows?.find(row=>row.id===architectureAlternativeStudy.selectedId)||null;}
function architectureAlternativeApplicable(){const study=architectureAlternativeStudy,row=selectedArchitectureAlternative();return study.status==='complete'&&study.report?.complete===true&&study.report.status==='complete'&&row?.status==='ok'&&study.report.ranked?.some(candidate=>candidate.id===row.id)&&architectureAlternativeCurrent();}
function updateArchitectureAlternativeButtons(){const running=architectureAlternativeStudy.status==='running',applicable=architectureAlternativeApplicable(),reviewed=applicable&&architectureAlternativeStudy.reviewedId===architectureAlternativeStudy.selectedId&&$('arch-alternatives-review').checked;$('arch-alternatives-run').disabled=running||!$('arch-alternatives-room').value||!$('arch-alternatives-roof').value;$('arch-alternatives-cancel').disabled=!running;$('arch-alternatives-review').disabled=!applicable;$('arch-alternatives-apply').disabled=!reviewed;$('arch-alternatives-show-report').disabled=!architectureAlternativeStudy.report;$('arch-alternatives-insert-report').disabled=!reviewed||!$('arch-alternatives-report-layout').value;}
function architectureAlternativeConfigurationText(configuration){if(!configuration)return'Configuration unavailable';const c=configuration.ceiling,r=configuration.roof;return`${c.type==='tray'?`Tray: ${architectureSpaceLength(c.baseElevation)} → ${architectureSpaceLength(c.raisedElevation)}; local (${architectureSpaceLength(c.min.x)}, ${architectureSpaceLength(c.min.y)}) to (${architectureSpaceLength(c.max.x)}, ${architectureSpaceLength(c.max.y)})`:`Flat: ${architectureSpaceLength(c.elevation)}`}\nPitch ${r.riseTwice/2}:12 · uniform bearing offset ${architectureSpaceLength(r.bearingOffset)}`;}
function renderArchitectureAlternatives(){
  const study=architectureAlternativeStudy,report=study.report,container=$('arch-alternatives-results');container.replaceChildren();
  if(!$('arch-alternatives-report').hidden)$('arch-alternatives-report').textContent=JSON.stringify(architectureAlternativeReport(),null,2);
  if(!report?.rows?.length){const note=document.createElement('p');note.className='setting-hint';note.textContent=study.status==='running'?'Configurations are being evaluated in an isolated snapshot.':'No configuration evidence yet.';container.append(note);renderArchitectureAlternativeDetail();return;}
  const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const title of ['Configuration / evidence','Raw usable / target-capped benefit','Roof skin / gable / step area','Ceiling horizontal / return area','Gross room boundary / nominal wall']){const th=document.createElement('th');th.scope='col';th.textContent=title;tr.append(th);}head.append(tr);table.append(head);const body=document.createElement('tbody');
  for(const row of report.rows){const tr=document.createElement('tr');tr.dataset.candidateId=row.id;tr.setAttribute('aria-selected',String(row.id===study.selectedId));const ranked=study.status==='complete'&&report.complete?report.ranked?.find(item=>item.id===row.id):null,cell=text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);return td;},first=cell(''),button=document.createElement('button');button.type='button';button.className='architecture-alternative-row';button.setAttribute('aria-label',`Review ${row.id}`);button.textContent=`${row.id}${row.id===report.baselineId?' · baseline':''}\n${architectureAlternativeConfigurationText(row.configuration)}`;button.addEventListener('click',()=>{study.selectedId=row.id;study.reviewedId='';$('arch-alternatives-review').checked=false;renderArchitectureAlternatives();});first.append(button);const badge=document.createElement('span');badge.className='architecture-alternative-badge';badge.textContent=study.status==='stale'?'Stale evidence':row.status!=='ok'?`Rejected · ${row.status}`:ranked?.pareto?'Pareto · stated grid':ranked?'Feasible · dominated':'Unranked evidence';first.append(badge);const q=row.quantities?.totals,m=row.metrics;cell(m?`${architectureSpaceVolume(m.usableVolume)} raw\n${architectureSpaceVolume(m.targetBenefitVolume)} capped\n${architectureSpaceVolume(m.weightedTargetBenefitVolume)} priority-weighted`:'not qualified');cell(q?`${geometry.formatArea(q.roofSurfaceArea,state().settings)} skin\n${geometry.formatArea(q.gableClosureArea,state().settings)} gable\n${geometry.formatArea(q.stepClosureArea,state().settings)} step`:'not qualified');cell(q?`${geometry.formatArea(q.ceilingHorizontalFinishArea,state().settings)} horizontal\n${geometry.formatArea(q.ceilingVerticalReturnArea,state().settings)} returns`:'not qualified');cell(q?`${geometry.formatArea(q.grossRoomBoundaryFinishArea,state().settings)} gross finish\n${architectureSpaceVolume(q.wallMaterialVolumeNominal)} nominal wall volume\nOpenings / finish assembly not deducted`:'not qualified');body.append(tr);}
  table.append(body);container.append(table);renderArchitectureAlternativeDetail();
}
function renderArchitectureAlternativeDetail(){
  const study=architectureAlternativeStudy,row=selectedArchitectureAlternative(),report=study.report;if(!row){$('arch-alternatives-detail').textContent='Select a row after a search to review its exact configuration and quantity ledger.';updateArchitectureAlternativeButtons();return;}
  const lines=[`${row.id}${row.id===report.baselineId?' · accepted baseline':''}`,architectureAlternativeConfigurationText(row.configuration),`Evidence: ${study.status==='stale'?'stale':row.status} · ${study.status==='complete'?'complete stated grid':'no complete ranking'}`],ranked=study.status==='complete'?report.ranked?.find(item=>item.id===row.id):null;
  if(ranked)lines.push(ranked.pareto?'Pareto within the stated grid; no complete cost optimum claimed.':`Dominated by: ${ranked.dominatedBy.join(', ')}`);
  if(row.metrics){lines.push(`Raw usable volume: ${architectureSpaceVolume(row.metrics.usableVolume)}`,`Target-capped benefit: ${architectureSpaceVolume(row.metrics.targetBenefitVolume)}`,`Priority-weighted capped benefit: ${architectureSpaceVolume(row.metrics.weightedTargetBenefitVolume)}`,`Area meeting headroom: ${geometry.formatArea(row.metrics.headroomArea,state().settings)}`);for(const room of row.metrics.rooms||[])lines.push(`${room.roomId}: ceiling ${architectureSpaceLength(room.minimumCeilingElevation)} to ${architectureSpaceLength(room.maximumCeilingElevation)} · target ${architectureSpaceLength(room.targetCeilingElevation)} · capped benefit ${architectureSpaceVolume(room.targetBenefitVolume)}`);}
  if(row.quantities){const q=row.quantities.totals;lines.push(`Roof projected coverage: ${geometry.formatArea(q.roofProjectedArea,state().settings)} · sloped skin: ${geometry.formatArea(q.roofSurfaceArea,state().settings)}`,`Separate gable / step closure areas: ${geometry.formatArea(q.gableClosureArea,state().settings)} / ${geometry.formatArea(q.stepClosureArea,state().settings)}`,`Ceiling horizontal / vertical return finish areas: ${geometry.formatArea(q.ceilingHorizontalFinishArea,state().settings)} / ${geometry.formatArea(q.ceilingVerticalReturnArea,state().settings)}`,`Gross room-boundary finish area: ${geometry.formatArea(q.grossRoomBoundaryFinishArea,state().settings)} · openings, reveals and finish layers not deducted.`,`Wall reference length: ${architectureSpaceLength(q.wallReferenceLength)} · nominal volume: ${architectureSpaceVolume(q.wallMaterialVolumeNominal)}`,`Physical roof edges: ${Object.entries(q.roofEdgeLengths).filter(([kind])=>kind!=='step').map(([kind,value])=>`${kind} ${architectureSpaceLength(value)}`).join(' · ')}`,'Step/interface edge length: unquantified; separate closure area is reported.');for(const group of row.quantities.roofGroups||[])lines.push(`${group.roofGroupId} same-pitch area identity: ${group.areaInvariant?.status||'not verified'}; vertical closures excluded.`);for(const layer of row.quantities.roofLayerMaterials||[])lines.push(`${layer.material} / ${layer.layerName}: declared normal thickness ${architectureSpaceLength(layer.normalThickness)} · nominal volume ${architectureSpaceVolume(layer.nominalVolume)}`);for(const finish of row.quantities.ceilingFinishes||[])lines.push(`${finish.roomId} horizontal finish: ${architectureSpaceLength(finish.declaredVerticalFinishThickness)} thick · nominal volume ${architectureSpaceVolume(finish.horizontalFinishVolumeNominal)}; vertical-return thickness 0.`);}
  lines.push(...(row.diagnostics||[]).map(item=>item.message||String(item)),'Material ledger partial · wall finish, framing members, connectors, waste, purchasing and total cost unknown.','Framing and supplier verification: unverified · truss design surcharge 0 · manufacturing complexity surcharge 0.');$('arch-alternatives-detail').textContent=lines.join('\n');updateArchitectureAlternativeButtons();
}
function architectureAlternativeReport(){const study=architectureAlternativeStudy;return{uiStatus:study.status,selectedId:study.selectedId,reviewedId:study.reviewedId,sourceCurrent:study.editor===editor&&Boolean(study.document)&&architectureAlternativeCurrent(),message:study.message,report:study.report?structuredClone(study.report):null};}
function applyArchitectureAlternative(){
  syncArchitectureAlternatives();if(!architectureAlternativeApplicable()||architectureAlternativeStudy.reviewedId!==architectureAlternativeStudy.selectedId||!$('arch-alternatives-review').checked)throw Error('Complete the stated search and review a current feasible row before applying.');
  const study=architectureAlternativeStudy,row=selectedArchitectureAlternative(),operation={type:'applyAlternative',configuration:structuredClone(row.configuration),candidateId:row.id,sourceRevision:study.report.inputRevision,sourceHash:study.report.inputHash};
  if(operation.sourceHash!==architectureInputHash(architectureSource()))throw Error('Alternative source hash changed; run the comparison again.');const result=applyArchitecture(operation);if(result?.ok!==false){invalidateArchitectureAlternatives('The reviewed configuration was accepted. Its previous comparison is now historical.');$('architecture-result').textContent=`Accepted ${row.id} as one grouped edit. Undo restores the previous architectural source. Framing remains unverified.`;}return result;
}
function insertArchitectureAlternativeReport(){
  syncArchitectureAlternatives();if(!architectureAlternativeApplicable()||architectureAlternativeStudy.reviewedId!==architectureAlternativeStudy.selectedId||!$('arch-alternatives-review').checked)throw Error('Complete the stated search and review a current feasible row before inserting its report.');
  const row=selectedArchitectureAlternative(),layout=state().layouts?.find(item=>item.id===$('arch-alternatives-report-layout').value);if(!layout)throw Error('Choose an existing paper layout for the static report.');
  const layer=state().layers.find(item=>item.name===state().currentLayer);if(!layer||layer.visible===false||layer.locked||layer.paperVisible===false||layer.plot===false)throw Error('Choose an unlocked, visible, plotting current layer before inserting the report.');
  const printable=buildArchitectureAlternativeReport(structuredClone(architectureSource()),structuredClone(state().settings),structuredClone(row.configuration));if(printable?.status!=='ok'||printable.candidateId!==row.id||!Array.isArray(printable.lines)||!printable.lines.length||printable.lines.length>200)throw Error('The selected configuration has no valid bounded report.');
  const height=3,gap=4.5,left=12,top=layout.paper.heightMm-15,availableWidth=layout.paper.widthMm-24,lines=[],measure=text=>geometry.textLayout({type:'TEXT',position:{x:0,y:0},text,height,rotation:0,style:state().currentTextStyle},{textStyles:state().textStyles}).width;
  if(!Number.isFinite(availableWidth)||availableWidth<20)throw Error('The selected paper is too narrow for the report.');
  for(const line of printable.lines){if(typeof line!=='string'||line.length>10000||/[\x00-\x1f]/.test(line))throw Error('A report line contains unsupported text.');let remaining=line;while(measure(remaining)>availableWidth){let cut=remaining.length;while(cut>0&&measure(remaining.slice(0,cut))>availableWidth)cut--;if(!cut)throw Error('The current text style cannot fit the report on this paper.');const space=remaining.lastIndexOf(' ',cut);if(space>cut/2)cut=space;lines.push(remaining.slice(0,cut));remaining=remaining.slice(cut).trimStart();if(lines.length>200)throw Error('The report exceeds the bounded paper-text limit.');}lines.push(remaining);}
  if(top-(lines.length-1)*gap-height*.35<12)throw Error('The report does not fit this paper at 3 mm text height. Choose a larger paper layout.');
  const steps=[{op:'space',space:'paper',layoutId:layout.id}];for(const[lineIndex,line]of lines.entries())if(line.trim())steps.push({op:'commands',tokens:['TEXT',`${left},${top-lineIndex*gap}`,String(height),'0deg',line]});
  const result=editor.applyRevision({label:`R6 static report ${row.id}`,steps});if(result?.ok===false)throw Error(result.message||'The report insertion was rejected.');resultLog(result);invalidateArchitectureAlternatives('Static report text was inserted. The drawing changed; this comparison is historical.');$('architecture-result').textContent=`Inserted ${lines.filter(line=>line.trim()).length} ordinary text lines on ${layout.name} as one grouped edit. Save and Plot that layout to PDF.`;return result;
}
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
function architectureRoofSelection(){
  const group=architectureSource().roofGroups?.find(item=>item.id===$('arch-roof-id').value),composed=Boolean(group?.components?.length),component=composed?group.components.find(item=>item.id===$('arch-roof-component-id').value):null;
  return{group,composed,component,model:composed?component:group};
}
function architectureRoofContext(){const{group,component}=architectureRoofSelection();return{roofGroupId:group?.id||'',componentId:component?.id||'',bounds:component?architectureReadFootprintBounds():null};}
function architectureComponentBounds(component){const points=component.boundary;return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
function architectureReadFootprintBounds(){return{minX:readQuantityField('arch-roof-min-x','length'),maxX:readQuantityField('arch-roof-max-x','length'),minY:readQuantityField('arch-roof-min-y','length'),maxY:readQuantityField('arch-roof-max-y','length')};}
function architectureFootprintChanged(){const{component}=architectureRoofSelection();if(!component)return false;const accepted=architectureComponentBounds(component),draft=architectureReadFootprintBounds();return Object.keys(accepted).some(key=>accepted[key]!==draft[key]);}
function architectureFootprintStamp(){try{const{group,component}=architectureRoofSelection();return JSON.stringify({revision:architectureSource().revision,roofGroupId:group?.id,componentId:component?.id,units:state().settings.units,bounds:architectureReadFootprintBounds()});}catch{return '';}}
function architectureFootprintSide(bounds,side){const{minX,maxX,minY,maxY}=bounds,pair=side==='south'?[[minX,minY],[maxX,minY]]:side==='east'?[[maxX,minY],[maxX,maxY]]:side==='north'?[[maxX,maxY],[minX,maxY]]:[[minX,maxY],[minX,minY]];return pair.map(point=>`(${point.map(value=>architectureSpaceLength(value)).join(', ')})`).join(' → ');}
function updateArchitectureFootprintDetail(){
  const{group,component,composed}=architectureRoofSelection();$('arch-roof-footprint-controls').hidden=!composed||!component;if(!component)return;
  try{const bounds=architectureReadFootprintBounds(),result=reviseRoofComponentBounds(architectureSource(),group.id,component.id,bounds),changed=architectureFootprintChanged(),confirmed=architectureFootprintConfirmed===architectureFootprintStamp(),accepted=architectureComponentBounds(component),lines=[changed?(confirmed?'Confirmed footprint draft · Apply to accept':'Footprint draft · inspect and confirm before Apply'):'Accepted rectangular source footprint',`Building-local width ${architectureSpaceLength(bounds.maxX-bounds.minX)} · depth ${architectureSpaceLength(bounds.maxY-bounds.minY)}`];
    if(changed){lines.push('Existing edge controls below use accepted source coordinates. Apply remaps their pitch, bearing and gable assignments by the exact side identities shown here.');for(const item of result.mapping)lines.push(`${item.side}: ${architectureFootprintSide(accepted,item.side)} becomes ${architectureFootprintSide(bounds,item.side)}`);}
    lines.push('The parent union is regenerated from its component rectangles. Ordinary footing references and drafting paths remain independent. A confirmed draft is not approval of an inferred house join.');$('arch-roof-footprint-detail').textContent=lines.join('\n');$('arch-roof-footprint-confirm').disabled=!changed;
  }catch(error){$('arch-roof-footprint-detail').textContent=`Footprint draft cannot be accepted\n${error.message}`;$('arch-roof-footprint-confirm').disabled=true;}
}
function architectureFootprintDirty(){architectureFootprintConfirmed='';architectureBearingConfirmed='';architectureGableDirty();updateArchitectureFootprintDetail();}
function confirmArchitectureFootprint(){
  const{group,component}=architectureRoofSelection();if(!component)throw Error('Choose a source component.');const draft=architectureDraftRoofGroup(),preview=previewRoofGroup(architectureSource(),draft,state().settings),review=draft.reviewDrainage===true&&preview.status==='needs-review'&&preview.validation?.geometry==='valid';if(preview.status!=='ok'&&!review)throw Error((preview.diagnostics||[]).map(item=>item.message||String(item)).join('\n')||'The proposed footprint has no valid joined geometry.');architectureFootprintConfirmed=architectureFootprintStamp();if(!architectureFootprintConfirmed)throw Error('Enter valid footprint lengths.');updateArchitectureFootprintDetail();updateArchitectureRoofPreview();
}
function architectureRoofBoundary(){
  const source=architectureSource(),{group,composed,component}=architectureRoofSelection();
  if(composed){if(!component)throw Error('Choose a source component before editing this coordinated roof.');return component.boundary;}
  if(group)return group.boundarySource==='walls'?geometry.roofBoundaryFromWalls(source,{wallIds:group.boundaryWallIds}):group.boundary;
  if($('arch-roof-source').value==='walls'){const wallIds=(source.walls||[]).filter(wall=>['exterior','bearing'].includes(wall.role)).map(wall=>wall.id);if(!wallIds.length)throw Error('Declare exterior or bearing walls first.');return geometry.roofBoundaryFromWalls(source,{wallIds});}
  return architectureSelectedPath({closed:true}).points;
}
function architectureGableKeys(){return [...$('arch-gable-edges').querySelectorAll('input:checked')].map(field=>field.value).sort();}
function resetArchitectureBearingDraft(){
  architectureBearingBoundary='';architectureBearingConfirmed='';architectureBearingDraftEdited=false;architectureBearingUnresolved=[];$('arch-bearing-edges').replaceChildren();architectureRoofPreviewCache=null;
}
function resetArchitecturePitchDraft(){
  architecturePitchBoundary='';architecturePitchConfirmed='';architecturePitchDraftEdited=false;architecturePitchUnresolved=[];$('arch-pitch-edges').replaceChildren();architectureRoofPreviewCache=null;
}
function architecturePitchAssignments(){
  if(architecturePitchUnresolved.length)throw Error('A pitch override no longer matches a source edge. Inspect the source edges and resolve the assignment, or use the group default.');
  const assignments=[],gables=new Set($('arch-roof-type').value==='GABLE'?architectureGableKeys():[]);
  for(const row of $('arch-pitch-edges').querySelectorAll('[data-pitch-edge]')){
    if(!row.querySelector('[data-pitch-override]').checked)continue;
    if(gables.has(row.dataset.edgeKey))throw Error(`Boundary edge ${Number(row.dataset.edgeIndex)+1} is a stationary gable end. Remove its pitch override; gable closures do not have a roof pitch.`);
    const riseTwice=Number(row.querySelector('[data-pitch-rise]').value);
    if(!Number.isInteger(riseTwice)||riseTwice<2||riseTwice>24)throw Error('Every enabled edge pitch must be 1:12 through 12:12 in half-rise increments.');
    assignments.push({edgeKey:row.dataset.edgeKey,riseTwice});
  }
  if((assignments.length||architecturePitchDraftEdited)&&architecturePitchBoundary!==JSON.stringify(architectureRoofBoundary()))throw Error('The pitch source boundary changed. Inspect its edges again before applying.');
  return assignments.sort((a,b)=>a.edgeKey.localeCompare(b.edgeKey));
}
function architecturePitchStamp(){try{return JSON.stringify({context:architectureRoofContext(),boundary:architectureRoofBoundary(),values:architectureRoofValues({requireConfirmation:false})});}catch{return '';}}
function updateArchitecturePitchRoles(){
  const gables=new Set($('arch-roof-type').value==='GABLE'?architectureGableKeys():[]);
  for(const row of $('arch-pitch-edges').querySelectorAll('[data-pitch-edge]')){
    const toggle=row.querySelector('[data-pitch-override]'),field=row.querySelector('[data-pitch-rise]'),gable=gables.has(row.dataset.edgeKey);
    toggle.disabled=gable&&!toggle.checked;field.disabled=gable||!toggle.checked;
    if(!toggle.checked)field.value=$('arch-roof-pitch').value;
    row.querySelector('[data-pitch-role]').textContent=gable?(toggle.checked?'Gable end · remove pitch override':'Gable end · stationary'):'Sloping roof edge';row.dataset.gable=String(gable);
  }
}
function updateArchitecturePitchDetail(){
  updateArchitecturePitchRoles();const rows=[...$('arch-pitch-edges').querySelectorAll('[data-pitch-edge]')],count=rows.filter(row=>row.querySelector('[data-pitch-override]').checked).length,stamp=architecturePitchStamp(),confirmed=stamp!==''&&architecturePitchConfirmed===stamp,lines=[];
  if(!rows.length)lines.push('Inspect the source boundary to assign roof pitches by edge.');
  else lines.push(confirmed?'Confirmed pitch draft · Apply to accept':'Pitch draft · accepted roof remains unchanged',`${architectureRoofSelection().composed?'Component':'Group'} default: ${Number($('arch-roof-pitch').value)/2}:12 · ${count} explicit edge override(s)`);
  if(architecturePitchUnresolved.length)lines.push('Source edges changed. Unmatched pitch assignments must be resolved before Apply.');
  lines.push('Mixed pitches are bounded to supported rectangular HIP/GABLE roofs. The draft geometry check reports unsupported combinations.');
  $('arch-pitch-detail').textContent=lines.join('\n');$('arch-pitch-confirm').disabled=!rows.length||architecturePitchUnresolved.length>0;
}
function architecturePitchDirty(){architecturePitchDraftEdited=true;architecturePitchConfirmed='';architectureBearingConfirmed='';architectureGableDirty();}
function inspectArchitecturePitchEdges({accepted=false}={}){
  const {model:group}=architectureRoofSelection(),previous=accepted?(group?.pitchAssignments||[]):[...architecturePitchUnresolved,...[...$('arch-pitch-edges').querySelectorAll('[data-pitch-edge]')].filter(row=>row.querySelector('[data-pitch-override]').checked).map(row=>({edgeKey:row.dataset.edgeKey,riseTwice:Number(row.querySelector('[data-pitch-rise]').value)}))],boundary=architectureRoofBoundary(),result=inferGableCandidates(boundary);
  if(result.status!=='ok'||!result.edges?.length)throw Error((result.diagnostics||[]).map(item=>item.message||String(item)).join('\n')||'The source boundary cannot supply pitch edges.');
  architecturePitchUnresolved=previous.filter(item=>!result.edges.some(edge=>edge.key===item.edgeKey));architecturePitchBoundary=JSON.stringify(boundary);architecturePitchConfirmed='';$('arch-pitch-edges').replaceChildren();
  const minX=Math.min(...boundary.map(point=>point.x)),maxX=Math.max(...boundary.map(point=>point.x)),minY=Math.min(...boundary.map(point=>point.y)),maxY=Math.max(...boundary.map(point=>point.y));
  for(const edge of result.edges){
    const previousValue=previous.find(item=>item.edgeKey===edge.key),row=document.createElement('tr');row.dataset.pitchEdge='';row.dataset.edgeKey=edge.key;row.dataset.edgeIndex=String(edge.index);
    const name=document.createElement('td'),label=document.createElement('strong'),coordinates=document.createElement('span'),role=document.createElement('span');let side='Recess / intermediate edge';
    if(edge.a.y===edge.b.y)side=edge.a.y===minY?'Lower Y side':edge.a.y===maxY?'Upper Y side':'Intermediate Y side';else if(edge.a.x===edge.b.x)side=edge.a.x===minX?'Lower X side':edge.a.x===maxX?'Upper X side':'Intermediate X side';
    label.textContent=`${edge.index+1}. ${side}`;coordinates.textContent=`(${architectureSpaceLength(edge.a.x)}, ${architectureSpaceLength(edge.a.y)}) → (${architectureSpaceLength(edge.b.x)}, ${architectureSpaceLength(edge.b.y)})`;role.dataset.pitchRole='';name.append(label,coordinates,role);
    const enable=document.createElement('td'),toggle=document.createElement('input');toggle.type='checkbox';toggle.dataset.pitchOverride='';toggle.dataset.edgeKey=edge.key;toggle.checked=Boolean(previousValue);toggle.setAttribute('aria-label',`Override pitch for boundary edge ${edge.index+1}`);enable.append(toggle);
    const value=document.createElement('td'),field=document.createElement('select');field.dataset.pitchRise='';field.dataset.edgeKey=edge.key;field.id=`arch-pitch-rise-${edge.index+1}`;field.setAttribute('aria-label',`Pitch for boundary edge ${edge.index+1}`);
    for(let riseTwice=2;riseTwice<=24;riseTwice++){const option=document.createElement('option');option.value=String(riseTwice);option.textContent=`${riseTwice/2}:12`;field.append(option);}field.value=String(previousValue?.riseTwice??Number($('arch-roof-pitch').value));field.disabled=!toggle.checked;value.append(field);
    toggle.addEventListener('change',()=>{if(toggle.checked)field.value=$('arch-roof-pitch').value;architecturePitchDirty();});field.addEventListener('change',architecturePitchDirty);row.append(name,enable,value);$('arch-pitch-edges').append(row);
  }
  if(accepted){architecturePitchDraftEdited=false;architecturePitchConfirmed=architecturePitchStamp();}updateArchitecturePitchDetail();updateArchitectureRoofPreview();return result;
}
function confirmArchitecturePitchEdges(){
  if(!$('arch-pitch-edges').children.length)throw Error('Inspect the source boundary before confirming edge pitches.');architecturePitchAssignments();architecturePitchConfirmed=architecturePitchStamp();if(!architecturePitchConfirmed)throw Error('Enter valid roof parameters before confirming edge pitches.');updateArchitecturePitchDetail();updateArchitectureRoofPreview();
}
function resetArchitecturePitchOverrides(){architecturePitchUnresolved=[];for(const row of $('arch-pitch-edges').querySelectorAll('[data-pitch-edge]'))row.querySelector('[data-pitch-override]').checked=false;inspectArchitecturePitchEdges();architecturePitchDirty();}
function architectureBearingAssignments(){
  if(architectureBearingUnresolved.length)throw Error('A bearing assignment no longer matches a source edge. Use default / wall bearings or restore the source boundary before applying.');
  const assignments=[];
  for(const row of $('arch-bearing-edges').querySelectorAll('[data-bearing-edge]')){
    if(!row.querySelector('[data-bearing-override]').checked)continue;
    const field=row.querySelector('[data-bearing-elevation]'),value=field.value.trim(),elevation=value?geometry.parseLength(value,state().settings):NaN;
    if(!Number.isFinite(elevation))throw Error('Enter a finite drawing length for every enabled bearing override.');
    assignments.push({edgeKey:row.dataset.edgeKey,elevation});
  }
  if((assignments.length||architectureBearingDraftEdited)&&architectureBearingBoundary!==JSON.stringify(architectureRoofBoundary()))throw Error('The bearing source boundary changed. Inspect its bearing edges again before applying.');
  return assignments.sort((a,b)=>a.edgeKey.localeCompare(b.edgeKey));
}
function architectureBearingStamp(){try{return JSON.stringify({context:architectureRoofContext(),boundary:architectureRoofBoundary(),values:architectureRoofValues({requireConfirmation:false})});}catch{return '';}}
function updateArchitectureBearingDetail(){
  const rows=[...$('arch-bearing-edges').querySelectorAll('[data-bearing-edge]')],count=rows.filter(row=>row.querySelector('[data-bearing-override]').checked).length,stamp=architectureBearingStamp(),confirmed=stamp!==''&&architectureBearingConfirmed===stamp,lines=[];
  if(!rows.length)lines.push('Inspect the source boundary to edit its bearing elevations.');
  else lines.push(confirmed?'Confirmed bearing draft · Apply to accept':'Bearing draft · accepted roof remains unchanged',`${count} explicit edge override(s) · other edges use the default or linked wall bearing`);
  if(architectureBearingUnresolved.length)lines.push('Source edges changed. Unmatched bearing assignments must be resolved before Apply.');
  lines.push('Ceiling elevations remain independent. Linked wall support conflicts are rejected.');
  $('arch-bearing-detail').textContent=lines.join('\n');$('arch-bearing-confirm').disabled=!rows.length||architectureBearingUnresolved.length>0;
}
function architectureBearingDirty(){architectureBearingDraftEdited=true;architectureBearingConfirmed='';architectureGableDirty();}
function inspectArchitectureBearingEdges({accepted=false}={}){
  const {model:group}=architectureRoofSelection(),previous=accepted?(group?.bearingAssignments||[]).map(item=>({...item,value:geometry.formatLength(item.elevation,state().settings)})):[...architectureBearingUnresolved,...[...$('arch-bearing-edges').querySelectorAll('[data-bearing-edge]')].filter(row=>row.querySelector('[data-bearing-override]').checked).map(row=>({edgeKey:row.dataset.edgeKey,value:row.querySelector('[data-bearing-elevation]').value}))],boundary=architectureRoofBoundary(),result=inferGableCandidates(boundary);
  if(result.status!=='ok'||!result.edges?.length)throw Error((result.diagnostics||[]).map(item=>item.message||String(item)).join('\n')||'The source boundary cannot supply bearing edges.');
  architectureBearingUnresolved=previous.filter(item=>!result.edges.some(edge=>edge.key===item.edgeKey));architectureBearingBoundary=JSON.stringify(boundary);architectureBearingConfirmed='';$('arch-bearing-edges').replaceChildren();
  for(const edge of result.edges){
    const previousValue=previous.find(item=>item.edgeKey===edge.key),row=document.createElement('div');row.className='architecture-bearing-edge';row.dataset.bearingEdge='';row.dataset.edgeKey=edge.key;
    const heading=document.createElement('div');heading.className='architecture-bearing-edge-name';heading.textContent=`${edge.index+1}. (${architectureSpaceLength(edge.a.x)}, ${architectureSpaceLength(edge.a.y)}) → (${architectureSpaceLength(edge.b.x)}, ${architectureSpaceLength(edge.b.y)})`;
    const toggleLabel=document.createElement('label');toggleLabel.className='architecture-check';const toggle=document.createElement('input');toggle.type='checkbox';toggle.dataset.bearingOverride='';toggle.dataset.edgeKey=edge.key;toggle.checked=Boolean(previousValue);toggle.setAttribute('aria-label',`Override bearing for boundary edge ${edge.index+1}`);toggleLabel.append(toggle,document.createTextNode('Override bearing elevation'));
    const elevationLabel=document.createElement('label');elevationLabel.append(document.createTextNode('Elevation'));const field=document.createElement('input');field.type='text';field.dataset.bearingElevation='';field.dataset.edgeKey=edge.key;field.id=`arch-bearing-elevation-${edge.index+1}`;field.value=previousValue?.value??'';field.placeholder='Default / wall';field.disabled=!toggle.checked;field.setAttribute('aria-label',`Bearing elevation for boundary edge ${edge.index+1}`);elevationLabel.append(field);
    toggle.addEventListener('change',()=>{field.disabled=!toggle.checked;if(toggle.checked&&!field.value.trim())field.value=$('arch-roof-bearing').value;architectureBearingDirty();});field.addEventListener('input',architectureBearingDirty);row.append(heading,toggleLabel,elevationLabel);$('arch-bearing-edges').append(row);
  }
  if(accepted){architectureBearingDraftEdited=false;architectureBearingConfirmed=architectureBearingStamp();}else architectureBearingConfirmed='';
  updateArchitectureBearingDetail();updateArchitectureRoofPreview();return result;
}
function confirmArchitectureBearingEdges(){
  if(!$('arch-bearing-edges').children.length)throw Error('Inspect the source boundary before confirming bearing elevations.');
  architectureBearingAssignments();architectureBearingConfirmed=architectureBearingStamp();if(!architectureBearingConfirmed)throw Error('Enter valid roof parameters before confirming bearing elevations.');updateArchitectureBearingDetail();updateArchitectureRoofPreview();
}
function resetArchitectureBearingOverrides(){
  architectureBearingUnresolved=[];for(const row of $('arch-bearing-edges').querySelectorAll('[data-bearing-edge]')){row.querySelector('[data-bearing-override]').checked=false;row.querySelector('[data-bearing-elevation]').disabled=true;}
  inspectArchitectureBearingEdges();architectureBearingDirty();
}
function architectureRoofValues({requireConfirmation=true}={}){
  const selection=architectureRoofSelection();if(selection.composed&&!selection.component)throw Error('Choose a source component. Parent defaults do not edit coordinated component slopes or bearings.');
  if(requireConfirmation&&selection.component&&architectureFootprintChanged()&&architectureFootprintConfirmed!==architectureFootprintStamp())throw Error('Inspect and confirm the draft footprint before applying this roof.');
  const riseTwice=Number($('arch-roof-pitch').value),overhang=architectureLength('arch-roof-overhang'),bearingElevation=architectureLength('arch-roof-bearing'),heelOffset=architectureLength('arch-roof-heel'),roofType=$('arch-roof-type').value,unchangedHip=roofType==='HIP'&&selection.model?.roofType==='HIP';
  // Inactive HIP controls must not overwrite saved source during a pitch-only edit.
  const rakeOverhang=roofType==='GABLE'?architectureLength('arch-roof-rake'):(selection.model?.rakeOverhang??0),gablePolicy=roofType==='GABLE'?$('arch-gable-policy').value:unchangedHip?(selection.model.gablePolicy||'EXPLICIT'):'EXPLICIT',gableAssignments=roofType==='GABLE'?architectureGableKeys():unchangedHip?[...(selection.model.gableAssignments||[])]:[],bearingAssignments=architectureBearingAssignments(),pitchAssignments=architecturePitchAssignments();
  if(requireConfirmation&&(pitchAssignments.length||architecturePitchDraftEdited)&&architecturePitchConfirmed!==architecturePitchStamp())throw Error('Inspect and confirm the draft edge pitches before applying this roof.');
  if(requireConfirmation&&(bearingAssignments.length||architectureBearingDraftEdited)&&architectureBearingConfirmed!==architectureBearingStamp())throw Error('Inspect and confirm the draft bearing elevations before applying this roof.');
  if(roofType==='GABLE'&&requireConfirmation&&architectureGableConfirmed!==architectureGableStamp())throw Error('Inspect and confirm the draft terminal gable assignments before applying this roof.');
  return{riseTwice,pitchAssignments,overhang,bearingElevation,bearingAssignments,heelOffset,eaveElevation:null,roofType,rakeOverhang,gablePolicy,gableAssignments};
}
function architectureGableStamp(){try{return JSON.stringify({context:architectureRoofContext(),boundary:architectureRoofBoundary(),values:architectureRoofValues({requireConfirmation:false})});}catch{return '';}}
function updateArchitectureGableDetail(){
  const isGable=$('arch-roof-type').value==='GABLE';$('arch-gable-controls').hidden=!isGable;$('arch-roof-rake').disabled=!isGable;$('arch-roof-add').textContent=isGable?'Generate assigned gable roof':'Generate hip roof';
  if(!isGable)return;
  const keys=architectureGableKeys(),alternative=architectureGableCandidates?.alternatives?.find(item=>item.edgeKeys.length===keys.length&&item.edgeKeys.every(key=>keys.includes(key))),confirmed=architectureGableConfirmed!==''&&architectureGableConfirmed===architectureGableStamp(),lines=[confirmed?'Confirmed draft assignments · Apply to accept':'Unconfirmed draft · accepted roof remains unchanged',`Selected terminal edges: ${keys.length}`,`Ridge orientation: ${alternative?.ridgeDirection||'mixed / requires solver review'}`];
  if(!architectureGableCandidates)lines.push('Inspect the source boundary to list eligible terminal ends.');
  for(const item of architectureGableCandidates?.diagnostics||[])lines.push(item.message||String(item));
  $('arch-gable-detail').textContent=lines.join('\n');$('arch-gable-confirm').disabled=!architectureGableCandidates||!keys.length;$('arch-gable-suggest').disabled=!$('arch-gable-alternative').value;
}
function architectureGableDirty(){architectureGableConfirmed='';architecturePitchConfirmed='';updateArchitectureGableDetail();updateArchitectureBearingDetail();updateArchitecturePitchDetail();updateArchitectureRoofPreview();}
function inspectArchitectureGableEnds({accepted=false}={}){
  const {model:group}=architectureRoofSelection(),previous=accepted?(group?.gableAssignments||[]):architectureGableKeys(),boundary=architectureRoofBoundary(),result=inferGableCandidates(boundary);architectureGableCandidates=result;architectureGableBoundary=JSON.stringify(boundary);architectureGableConfirmed='';
  $('arch-gable-edges').replaceChildren();for(const edge of result.edges||[]){const label=document.createElement('label');label.className='architecture-gable-edge';const input=document.createElement('input');input.type='checkbox';input.value=edge.key;input.dataset.edgeKey=edge.key;input.disabled=!edge.terminal;input.checked=previous.includes(edge.key);input.addEventListener('change',architectureGableDirty);const text=document.createElement('span');text.textContent=`${edge.index+1}. (${architectureSpaceLength(edge.a.x)}, ${architectureSpaceLength(edge.a.y)}) → (${architectureSpaceLength(edge.b.x)}, ${architectureSpaceLength(edge.b.y)}) · ${edge.terminal?'terminal candidate':'eave / recess edge'}`;label.append(input,text);$('arch-gable-edges').append(label);}
  const alternative=$('arch-gable-alternative');alternative.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a suggestion to review';alternative.append(placeholder);for(const item of result.alternatives||[]){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.label} · ridge ${item.ridgeDirection}`;alternative.append(option);}if(accepted&&group?.roofType==='GABLE')architectureGableConfirmed=architectureGableStamp();updateArchitectureGableDetail();return result;
}
function suggestArchitectureGableEnds(){const alternative=architectureGableCandidates?.alternatives?.find(item=>item.id===$('arch-gable-alternative').value);if(!alternative)throw Error('Choose an available bounded suggestion.');for(const input of $('arch-gable-edges').querySelectorAll('input'))input.checked=alternative.edgeKeys.includes(input.value);architectureGableDirty();}
function confirmArchitectureGableEnds(){if(!architectureGableKeys().length)throw Error('Select at least one eligible terminal gable edge.');if(architectureGableBoundary!==JSON.stringify(architectureRoofBoundary()))throw Error('The source boundary changed. Inspect its terminal ends again.');architectureGableConfirmed=architectureGableStamp();if(!architectureGableConfirmed)throw Error('Enter valid roof parameters before confirming.');updateArchitectureGableDetail();}
function architectureDraftRoofGroup(){
  const source=architectureSource(),{group,composed,component}=architectureRoofSelection(),values=architectureRoofValues({requireConfirmation:false}),name=$('arch-roof-name').value.trim()||'Roof';
  if(composed){delete values.eaveElevation;if(architectureFootprintChanged())return reviseRoofComponentBounds(source,group.id,component.id,architectureReadFootprintBounds(),{values:{...values,name}}).group;return{...structuredClone(group),components:group.components.map(item=>item.id===component.id?{...structuredClone(item),...values,name}:structuredClone(item))};}
  if(group)return{...structuredClone(group),...values,name};
  const linked=$('arch-roof-source').value==='walls';return{id:'roof-draft',name,boundary:architectureRoofBoundary(),boundarySource:linked?'walls':'explicit',boundaryWallIds:linked?(source.walls||[]).filter(wall=>['exterior','bearing'].includes(wall.role)).map(wall=>wall.id):[],supportWallIds:[],...values};
}
function architectureDrainageReviewLines(roof){
  if(roof?.status!=='needs-review'&&!roof?.reviewOnly)return[];
  const lines=['Drainage review required','Visible design comparison only. Geometry checks passed; drainage checks failed. This roof is not an approved or feasible design. Space analysis and approved quantity totals exclude this review-only roof.'],point=p=>p&&['x','y','z'].every(axis=>Number.isFinite(p[axis]))?`(${['x','y','z'].map(axis=>geometry.formatLength(p[axis],state().settings)).join(', ')})`:null;
  const failures=roofDrainageWitnesses(architectureSource(),roof),unresolved=roof.validation?.unresolvedDrainage||[];
  for(const failure of failures){const a=point(failure.a??failure.start),b=point(failure.b??failure.end),id=failure.edgeId??failure.id??'Unresolved drainage seam';lines.push(`${id}${failure.kind?` · ${failure.kind}`:''}${a&&b?` · world XYZ ${a} → ${b}`:''}${failure.message?` · ${failure.message}`:''}`);}
  if(!failures.length)for(const id of unresolved)lines.push(`${id} · unresolved runoff band; inspect the generation diagnostics.`);
  lines.push('The explicit review flag stays in the native source. Editing and saving do not waive drainage validation.');return lines;
}
function architectureDrainageHighlight(){
  if(!architectureReviewHighlight)return null;const derived=state().architectureDerived;
  if(architectureReviewHighlight.editor!==editor||architectureReviewHighlight.inputHash!==derived?.inputHash){architectureReviewHighlight=null;return null;}
  const roof=derived.roofs?.find(item=>item.id===architectureReviewHighlight.roofId),witness=roof&&roofDrainageWitnesses(architectureSource(),roof).find(item=>item.id===architectureReviewHighlight.witnessId);if(!witness){architectureReviewHighlight=null;return null;}return witness;
}
function updateArchitectureDrainageDetail(){
  const roof=state().architectureDerived?.roofs?.find(item=>item.id===$('arch-roof-id').value),witness=roof&&roofDrainageWitnesses(architectureSource(),roof).find(item=>item.id===$('arch-roof-drainage-witness').value);
  $('arch-roof-drainage-show').disabled=!witness;$('arch-roof-drainage-clear').disabled=!architectureDrainageHighlight();if(!witness){$('arch-roof-drainage-detail').textContent='No bounded drainage witness is available for this roof.';return;}
  const point=p=>`(${['x','y','z'].map(axis=>geometry.formatLength(p[axis],state().settings)).join(', ')})`;
  $('arch-roof-drainage-detail').textContent=`${witness.id} · ${witness.kind}\nWorld XYZ ${point(witness.a)} → ${point(witness.b)}\nComponent sources: ${witness.componentIds.join(', ')||'see incident faces'}\n${witness.flat?'Level seam within the drawing tolerance.':`Endpoint elevation difference: ${architectureSpaceLength(witness.drop)}. A descending edge is not a verified drainage route.`}\nHighlight uses the current drawing view without changing its camera, source or approval status. It is temporary and is not plotted.`;
}
function updateArchitectureDrainageControls(roof){
  const witnesses=roof?roofDrainageWitnesses(architectureSource(),roof):[],previous=$('arch-roof-drainage-witness').value;$('arch-roof-drainage-controls').hidden=!witnesses.length;$('arch-roof-drainage-witness').replaceChildren();
  for(const witness of witnesses){const option=document.createElement('option');option.value=witness.id;option.textContent=`${witness.id} · ${witness.kind}${witness.flat?' · level':''}`;$('arch-roof-drainage-witness').append(option);}$('arch-roof-drainage-witness').value=witnesses.some(item=>item.id===previous)?previous:(witnesses[0]?.id||'');updateArchitectureDrainageDetail();
}
function highlightArchitectureDrainage(){
  const roofId=$('arch-roof-id').value,roof=state().architectureDerived?.roofs?.find(item=>item.id===roofId),witness=roof&&roofDrainageWitnesses(architectureSource(),roof).find(item=>item.id===$('arch-roof-drainage-witness').value);if(!witness)throw Error('Choose an available drainage witness.');architectureReviewHighlight={editor,inputHash:state().architectureDerived.inputHash,roofId,witnessId:witness.id};closeArchitecture();draw();canvas.focus();
}
function drawArchitectureDrainageHighlight(){
  const witness=architectureDrainageHighlight();if(!witness||paperSpace()&&!currentViewport())return;if(!visibleEntities().some(entity=>architectureOwner(entity)?.id===witness.roofId&&entity.id.endsWith('/surface')))return;
  const a=toScreen(witness.a),b=toScreen(witness.b);if(![a,b].every(finiteScreenPoint)||a.clipped||b.clipped)return;ctx.save();if(currentViewport()){tracePaperBoundary(viewportBoundary(currentViewport()));ctx.clip();}ctx.strokeStyle='#ff6a56';ctx.fillStyle='#ff9c87';ctx.lineWidth=4;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();for(const point of[a,b]){ctx.beginPath();ctx.arc(point.x,point.y,4,0,Math.PI*2);ctx.fill();}ctx.font='11px Segoe UI';const label=`${witness.id} · drainage review`,x=Math.max(4,Math.min(width-ctx.measureText(label).width-12,(a.x+b.x)/2+8)),y=Math.max(18,Math.min(height-8,(a.y+b.y)/2-8));ctx.fillStyle='#18242b';ctx.fillRect(x-4,y-13,ctx.measureText(label).width+8,18);ctx.fillStyle='#ffb8a8';ctx.fillText(label,x,y);ctx.restore();
}
function updateArchitectureRoofPreview(){
  clearTimeout(architectureRoofPreviewTimer);const revision=++architectureRoofPreviewRevision;
  try{const values=architectureRoofValues({requireConfirmation:false}),eaveElevation=values.bearingElevation+values.heelOffset-values.overhang*values.riseTwice/24;$('arch-roof-eave-preview').textContent=`Default geometric eave surface: ${geometry.formatLength(eaveElevation,state().settings)}\nBearing + declared heel offset − pitch × eave overhang. Edge overrides and linked wall heights are resolved in the draft check. Room ceilings remain independent.`;}catch(error){$('arch-roof-eave-preview').textContent=error.message||'Enter valid bearing, heel offset and overhang lengths.';}
  architectureRoofPreviewTimer=setTimeout(()=>{
    if(revision!==architectureRoofPreviewRevision)return;
    try{const group=architectureDraftRoofGroup(),source=state().architecture,key=JSON.stringify({source,group,settings:state().settings}),preview=architectureRoofPreviewCache?.key===key?architectureRoofPreviewCache.preview:previewRoofGroup(source,group,state().settings);architectureRoofPreviewCache={key,preview};
      const pitchDraft=architectureRoofValues({requireConfirmation:false}),selection=architectureRoofSelection(),lines=[`Draft geometry: ${preview.status||'not established'} · accepted roof remains unchanged`,`Default pitch: ${pitchDraft.riseTwice/2}:12 · explicit edge pitches: ${pitchDraft.pitchAssignments.length?pitchDraft.pitchAssignments.map(item=>`${item.riseTwice/2}:12`).join(', '):'none'}`];
      if(selection.composed)lines.push(`Editing component: ${selection.component.name||selection.component.id} · full ${group.components.length}-component join checked together. Other component sources remain unchanged.`);
      if(preview.bearingElevations?.length)lines.push(`Resolved bearing range: ${architectureSpaceLength(Math.min(...preview.bearingElevations))} to ${architectureSpaceLength(Math.max(...preview.bearingElevations))}`);
      if(preview.status==='ok'&&preview.variableBearings)lines.push(`Delayed-height activations: ${(preview.events||[]).filter(event=>event.types?.includes('activation')||event.type==='activation').map(event=>architectureSpaceLength(event.elevation)).join(', ')||'see accepted report'}`,`Roof-to-support step closures: ${preview.stepClosures?.length||0} · thickness 0`);
      for(const item of preview.diagnostics||[])lines.push(item.message||String(item));
      if(preview.status==='ok')lines.push('Bounded support, coverage and runoff checks passed. Apply commits one normal Undo record.');
      if(preview.status==='needs-review'){lines.push(...architectureDrainageReviewLines(preview));if(group.reviewDrainage===true)lines.push('Apply may save this explicitly flagged review-only source in one Undo group; it does not approve drainage.');}
      lines.push('Zero-thickness mathematical surfaces · framing remains unverified.');$('arch-roof-draft-preview').textContent=lines.join('\n');$('arch-roof-draft-preview').dataset.status=preview.status||'unknown';
    }catch(error){$('arch-roof-draft-preview').textContent=`Draft not ready · accepted roof remains unchanged\n${error.message||'Inspect the source boundary and enter valid roof parameters.'}`;$('arch-roof-draft-preview').dataset.status='needs-input';}
  },120);
}
function updateArchitectureRoofDetail(){
  const id=$('arch-roof-id').value,derived=state().architectureDerived,group=architectureSource().roofGroups?.find(item=>item.id===id),roof=derived?.roofs?.find(item=>item.id===id),diagnostics=(derived?.diagnostics||[]).filter(item=>!id||!item.ownerId||item.ownerId===id),lines=[];
  const reviewLines=architectureDrainageReviewLines(roof),review=reviewLines.length>0;$('arch-roof-review-status').hidden=!review;$('arch-roof-review-status').textContent=reviewLines.join('\n');
  if(roof){
    const activationEvents=(roof.events||[]).filter(event=>event.types?.includes('activation')||event.type==='activation'),topologyEvents=(roof.events||[]).filter(event=>event.types?.includes('coordinate-contact')||event.type==='topology');
    if(group?.components?.length){
      lines.push(`Accepted type: coordinated roof · ${group.components.length} source components`,`Roof: ${roof.status||'unsolved'}`,`Geometry: ${roof.validation?.geometry||'unverified'}`,`Runoff: ${roof.validation?.drainage||'unverified'}`,'Coverage: joined source component union · hidden overlapping skins removed');
      for(const component of group.components)lines.push(`${component.name||component.id}: ${component.roofType} · default ${component.riseTwice/2}:12 · ${component.pitchAssignments?.length||0} pitch override(s) · bearing ${architectureSpaceLength(component.bearingElevation)} · ${component.bearingAssignments?.length||0} bearing override(s)`);
      lines.push('Each component uses its own source controls. Room clearance and material/space ranking for coordinated roofs remain unsupported.');
    }else{
      lines.push(`Accepted type: ${group?.roofType||'HIP'} · ${group?.gablePolicy||'EXPLICIT'}`,`Roof: ${roof.status||'unsolved'}`,`Geometry: ${roof.validation?.geometry||'unverified'}`,`Runoff: ${roof.validation?.drainage||'unverified'}`,`Coverage: ${group?.boundarySource==='walls'?'linked to perimeter walls':'captured source boundary'}`,`Default bearing: ${architectureSpaceLength(group?.bearingElevation)} · explicit edge overrides: ${group?.bearingAssignments?.length||0}`);
      lines.push(`Default pitch: ${group?.riseTwice/2}:12 · edge pitch overrides: ${group?.pitchAssignments?.length||0}`);
    }
    if(roof.bearingElevations?.length)lines.push(`Resolved bearing range: ${architectureSpaceLength(Math.min(...roof.bearingElevations))} to ${architectureSpaceLength(Math.max(...roof.bearingElevations))}`);
    lines.push(`Height activation events: ${activationEvents.length} · topology events: ${topologyEvents.length}`);
    if(activationEvents.length)lines.push(`Activation elevations: ${activationEvents.map(event=>architectureSpaceLength(event.elevation)).join(', ')}`);
    lines.push(`Roof-to-support step closures: ${roof.stepClosures?.length||0} · thickness 0`,`Advancing source support: ${roof.validation?.sourceSupport||'equal-height baseline'}`,`Source edge checks: ${roof.supportChecks?.length||0} · matched wall checks: ${roof.sourceSupportChecks?.length||0}`);
    for(const check of roof.supportChecks||[])if(check.message||check.meaning)lines.push(check.message||check.meaning);
    for(const check of roof.sourceSupportChecks||[])lines.push(`${check.wallId}: ${check.status} · bearing ${architectureSpaceLength(check.bearingElevation)} · framing unverified`);
    if(group?.components?.length)lines.push(`Trimmed gable closure surfaces: ${roof.gableClosures?.length||0}`);
    else if(group?.roofType==='GABLE')lines.push(`Accepted gable edges: ${group.gableAssignments?.length||0}`,`Gable closure surfaces: ${roof.gableClosures?.length||0}`,`Eave / rake overhang: ${architectureSpaceLength(group.overhang)} / ${architectureSpaceLength(group.rakeOverhang)}`);
    if(roof.faces?.length){const quantities=roof.quantities||{},highest=Math.max(...roof.faces.flatMap(face=>face.vertices.map(point=>point.z)));lines.push(`Roof facets: ${roof.faces.length}`);if(!review){if(Number.isFinite(quantities.projectedArea))lines.push(`Projected coverage: ${geometry.formatArea(quantities.projectedArea,state().settings)}`);const surface=quantities.surfaceArea??quantities.roofSurfaceArea;if(Number.isFinite(surface))lines.push(`Roof surface: ${geometry.formatArea(surface,state().settings)}`);if(Number.isFinite(quantities.stepClosureArea))lines.push(`Step closure surface: ${geometry.formatArea(quantities.stepClosureArea,state().settings)}`);}else lines.push('Roof quantity approval withheld · geometric measurements remain review-only.');lines.push(`Highest surface: ${geometry.formatLength(highest,state().settings)}`);}
    lines.push(`Clearance: ${(architectureReport().spaces||[]).filter(item=>item.roofId===id).map(item=>`${item.roomId}: ${item.status}`).join(', ')||'no supported room study'}`,'Zero-thickness mathematical surfaces · ceiling elevations independent · framing / supplier review unverified');
  }
  else lines.push(`${architectureSource().roofGroups?.length||0} accepted roof group(s).`,'Select a roof group to inspect its status.');
  if(diagnostics.length)lines.push('',...diagnostics.map(item=>item.message||String(item)));$('arch-roof-detail').textContent=lines.join('\n');updateArchitectureGableDetail();updateArchitectureBearingDetail();updateArchitecturePitchDetail();updateArchitectureFootprintDetail();updateArchitectureDrainageControls(roof);
}
function loadArchitectureRoof(){
  const parent=architectureSource().roofGroups?.find(item=>item.id===$('arch-roof-id').value),components=parent?.components||[],previous=$('arch-roof-component-id').value;
  $('arch-roof-component-id').replaceChildren();for(const component of components){const option=document.createElement('option');option.value=component.id;option.textContent=`${component.name||component.id} · ${component.id}`;$('arch-roof-component-id').append(option);}
  $('arch-roof-component-id').value=components.some(item=>item.id===previous)?previous:(components[0]?.id||'');$('arch-roof-component-controls').hidden=!components.length;
  const {model:group,composed}=architectureRoofSelection();$('arch-roof-apply').disabled=!group;$('arch-roof-source').disabled=composed;$('arch-roof-add').disabled=composed;$('arch-roof-name-label').textContent=composed?'Component name':'Roof name';$('arch-roof-pitch-label').textContent=composed?'Component default pitch · rise per 12':'Group default pitch · rise per 12';$('arch-roof-apply').textContent=composed?'Apply component to joined roof':'Apply roof parameters';
  $('arch-roof-component-detail').textContent=composed?`${parent.name||parent.id} · ${components.length} joined source components. Edit this component's pitch, bearings and terminal ends below. Apply validates the entire joined roof in one Undo group. Coverage source and Generate are disabled here; component boundary changes require source editing. No parent default is substituted for component values.`:'';
  $('arch-pitch-reset').textContent=composed?'Use component default on all edges':'Use group default on all edges';$('arch-pitch-hint').textContent=$('arch-pitch-hint').textContent.replace(/(?:group|selected component) default pitch/,`${composed?'selected component':'group'} default pitch`);
  architectureGableCandidates=null;architectureGableConfirmed='';resetArchitectureBearingDraft();resetArchitecturePitchDraft();$('arch-gable-edges').replaceChildren();
  architectureFootprintConfirmed='';if(composed&&group){const bounds=architectureComponentBounds(group);for(const[key,id]of [['minX','arch-roof-min-x'],['maxX','arch-roof-max-x'],['minY','arch-roof-min-y'],['maxY','arch-roof-max-y']])displayQuantityField(id,bounds[key],'length');architectureFootprintConfirmed=architectureFootprintStamp();}
  if(!group){updateArchitectureRoofPreview();updateArchitectureRoofDetail();return;}
  $('arch-roof-name').value=group.name||'Roof';$('arch-roof-type').value=group.roofType||'HIP';$('arch-roof-source').value=!composed&&group.boundarySource==='walls'?'walls':'selection';$('arch-gable-policy').value=group.gablePolicy||'EXPLICIT';$('arch-roof-pitch').value=String(group.riseTwice);architectureSetLength('arch-roof-overhang',group.overhang??0);architectureSetLength('arch-roof-rake',group.rakeOverhang??0);architectureSetLength('arch-roof-bearing',group.bearingElevation);architectureSetLength('arch-roof-heel',group.heelOffset??0);
  try{inspectArchitectureBearingEdges({accepted:true});}catch(error){architectureBearingUnresolved=group.bearingAssignments||[];$('arch-bearing-detail').textContent=error.message;}
  try{inspectArchitectureGableEnds({accepted:true});}catch{}
  try{inspectArchitecturePitchEdges({accepted:true});}catch(error){architecturePitchUnresolved=group.pitchAssignments||[];$('arch-pitch-detail').textContent=error.message;}
  architectureBearingConfirmed=architectureBearingStamp();architectureGableConfirmed=group.roofType==='GABLE'?architectureGableStamp():'';architecturePitchConfirmed=architecturePitchStamp();updateArchitectureRoofPreview();updateArchitectureRoofDetail();
}
function architectureCreateRoof(){if(architectureRoofSelection().composed)throw Error('Choose a regular roof or a new source before generating. Use Apply component to edit this joined roof.');const operation={type:'addRoof',name:$('arch-roof-name').value.trim()||'Roof',...architectureRoofValues()};if($('arch-roof-source').value==='walls'){const wallIds=(architectureSource().walls||[]).filter(wall=>['exterior','bearing'].includes(wall.role)).map(wall=>wall.id);if(!wallIds.length)throw Error('Declare exterior or bearing walls before creating a linked perimeter roof.');operation.wallIds=wallIds;}else operation.boundary=architectureSelectedPath({closed:true}).points;return applyArchitecture(operation);}
function applyArchitectureRoof(){
  const {group,composed,component}=architectureRoofSelection();if(!group)throw Error('Choose an existing roof group.');const values={name:$('arch-roof-name').value.trim()||'Roof',...architectureRoofValues()};
  if(!composed)return applyArchitecture({type:'setRoof',roofGroupId:group.id,values});
  if(!component||!group.components.length)throw Error('Choose an existing component. Empty components cannot replace this coordinated roof.');
  delete values.eaveElevation;
  if(architectureFootprintChanged())return applyArchitecture({type:'setRoofComponentFootprint',roofGroupId:group.id,componentId:component.id,bounds:architectureReadFootprintBounds(),values});
  return applyArchitecture({type:'setRoof',roofGroupId:group.id,values:{components:group.components.map(item=>item.id===component.id?{...structuredClone(item),...values}:structuredClone(item))}});
}
function addArchitectureFootprint(){
  if(state().settings.units==='unitless')throw Error('Assign physical drawing units in Drawing settings before adding a physical footprint.');if(state().activeSpace==='paper'||currentViewport())throw Error('Return to standalone Model before adding a drafting footprint.');
  const presets={rectangle:[[0,0],[40,0],[40,24],[0,24]],L:[[0,0],[40,0],[40,20],[20,20],[20,40],[0,40]],T:[[0,0],[60,0],[60,20],[40,20],[40,50],[20,50],[20,20],[0,20]],H:[[0,0],[20,0],[20,16],[44,16],[44,0],[64,0],[64,60],[44,60],[44,44],[20,44],[20,60],[0,60]],cross:[[0,20],[20,20],[20,0],[40,0],[40,20],[60,20],[60,40],[40,40],[40,60],[20,60],[20,40],[0,40]]};
  const frame=architectureFrame(),points=presets[$('arch-footprint-preset').value].map(([x,y])=>{const point={x:architecturePhysicalLength(`${x}'`),y:architecturePhysicalLength(`${y}'`)};return geometry.architectureLocalToWorld?geometry.architectureLocalToWorld(point,frame):point;});
  if(frame&&!geometry.architectureLocalToWorld&&(frame.origin?.x||frame.origin?.y||frame.origin?.z||frame.rotation||frame.rotationDegrees))throw Error('Transformed-frame footprint starters require a supported frame adapter.');
  const ucs=activePlane();if(Math.abs(ucs.normal.x)>1e-8||Math.abs(ucs.normal.y)>1e-8||Math.abs((ucs.normal.z??1)-1)>1e-8||Math.hypot(ucs.origin.x,ucs.origin.y,ucs.origin.z)>1e-8||Math.abs(ucs.xAxis.x-1)>1e-8)throw Error('Set World XY UCS at the origin before adding a drafting starter.');
  let result=editor.execute(points.some(point=>Math.abs(point.z||0)>1e-8)?'3DPOLY':'PLINE');for(const point of points){if(!result.ok)break;result=editor.submitPoint(point);}if(result.ok)result=editor.execute('C',{createSurface:false});if(!result.ok){editor.cancel();throw Error(result.message||'Footprint creation failed.');}const entity=modelEntities().at(-1);architectureBoundaryEntityId=entity?.id;editor.select(entity?[entity.id]:[]);resultLog(result);refreshArchitectureLists();$('architecture-result').textContent='Closed drafting footprint added and selected. Convert it to walls or generate a roof.';return result;
}
function renderArchitectureOwnerProperties(selected){
  const componentData=roofComponentData();
  if(componentData){
    const{selected:selection,footprint}=componentData,group=architectureSource().roofGroups.find(item=>item.id===selection.roofGroupId),component=group.components.find(item=>item.id===selection.componentId),box=$('properties-content');box.replaceChildren();$('selection-count').textContent='Roof component';
    const name=propertyRow('Component',component.name||component.id);name.lastElementChild.id='roof-component-name';box.append(propertyRow('Object','Architectural roof component'),name,propertyRow('Component ID',component.id),propertyRow('Roof group',group.name||group.id),propertyRow('Footprint plane',`Bearing ${lengthFormat(footprint.elevation)}`));
    const values=new Map();box.append(subheading('BUILDING-LOCAL FOOTPRINT'));
    for(const[key,label,id]of [['minX','Min X','roof-component-min-x'],['maxX','Max X','roof-component-max-x'],['minY','Min Y','roof-component-min-y'],['maxY','Max Y','roof-component-max-y']]){const row=propertyRow(label,''),field=document.createElement('input');field.id=id;field.type='text';field.value=lengthFormat(footprint.bounds[key]);field.setAttribute('aria-label',`Component footprint ${label}`);field.title=`Exact stored value: ${footprint.bounds[key]}. Explicit feet/inch suffixes accepted.`;field.disabled=!footprint.editable;row.lastElementChild.replaceWith(field);box.append(row);values.set(key,{field,initial:field.value,stored:footprint.bounds[key]});}
    const apply=document.createElement('button');apply.id='roof-component-apply';apply.className='architecture-owner-button roof-component-apply';apply.textContent='Apply footprint';apply.disabled=!footprint.editable;apply.addEventListener('click',()=>{try{const bounds={};for(const[key,{field,initial,stored}]of values){if(field.value===initial){bounds[key]=stored;continue;}if(!field.value.trim())throw Error('Enter all four footprint bounds.');bounds[key]=geometry.parseLength(field.value,state().settings);if(!Number.isFinite(bounds[key]))throw Error('Enter finite footprint bounds.');}resultLog(commitRoofComponentBounds(selection,bounds));}catch(error){addLog(error.message,'error');toast(error.message);}});box.append(apply);
    const note=document.createElement('p');note.className='roof-component-bounds-note';note.textContent=footprint.editable?'Amber squares resize corners; diamonds resize one side. The cage is the source footprint at bearing height. The full roof validates on release or Apply. One Undo restores the accepted edit.':footprint.reason;box.append(note);
    const button=document.createElement('button');button.className='architecture-owner-button';button.textContent='Edit component parameters';button.setAttribute('aria-label','Edit selected roof component');button.addEventListener('click',()=>showArchitecture('roof',{kind:'roofGroup',id:selection.roofGroupId,componentId:selection.componentId}));box.append(button);appendStructuralBridgeLaunch(box,{kind:'roofGroup',id:selection.roofGroupId,componentId:selection.componentId});return true;
  }
  const owners=selected.map(architectureOwner).filter(Boolean);if(!owners.length)return false;const box=$('properties-content');box.replaceChildren();$('selection-count').textContent='Architectural source';const unique=[...new Map(owners.map(owner=>[`${owner.kind}:${owner.id}`,owner])).values()];box.append(propertyRow('Object','Generated architecture'),propertyRow('Owner',unique.length===1?`${unique[0].kind} · ${unique[0].id}`:`${unique.length} source owners`));const note=document.createElement('p');note.className='architecture-owner-note';note.textContent='Generated geometry follows architectural source. Edit the source properties; mesh vertices and ordinary transform commands are protected.';box.append(note);const button=document.createElement('button');button.className='architecture-owner-button';button.textContent='Edit architectural source';button.setAttribute('aria-label','Edit architectural source');button.addEventListener('click',()=>{const owner=unique[0];showArchitecture(owner.kind==='roofGroup'?'roof':owner.kind==='room'?'rooms':'walls',owner);});box.append(button);if(unique.length===1&&unique[0].kind==='roofGroup')appendStructuralBridgeLaunch(box,unique[0]);return true;
}
function resultLog(result) {
  if (result?.message) addLog(result.message, result.ok === false ? 'error' : 'notice');
  update();
  if(state().commandPhase==='clipboard-ready')void finishPreparedCut();
  return result;
}
function trimInteraction(){const value=editor.getTrimState?.();return value?.active?value:null;}
function trimPerspectiveUnsupported(){return Boolean(trimInteraction()?.project==='view'&&(modelWorkspace()||currentViewport())&&camera3D().projection==='perspective');}
function syncTrimProjectionView(){
  if(!editor.setTrimProjectionView)return false;
  const basis=modelWorkspace()||currentViewport()?view3d.cameraBasis(camera3D()):{right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},normal:{x:0,y:0,z:1}};
  editor.setTrimProjectionView({right:basis.right,up:basis.up,normal:basis.normal});return true;
}
function trimScreenPoint(screen){return modelWorkspace()?projectedPick(screen,visibleEntities())?.point||toWorld(screen)||view3d.pointOnTargetPlane(screen,camera3D(),width,height):toWorld(screen);}
function trimViewStamp(){return JSON.stringify({space:state().activeSpace,layout:state().activeLayoutId,viewport:state().activeViewportId,workspace:state().workspace,camera:modelWorkspace()||currentViewport()?camera3D():null,view:state().viewport,paper:paperView()});}
function trimPathVisible(screens,{crossing=false}={}){
  if(!screens.every(point=>point&&finiteScreenPoint(point)))return false;
  let path=screens;
  if(crossing){const a=screens[0],b=screens.at(-1);path=[a,{x:a.x,y:b.y},b,{x:b.x,y:a.y},a];}
  const mask=activeViewportMask()||[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
  if(path.some(point=>!insideScreenPolygon(point,mask)))return false;
  for(let i=1;i<path.length;i++)if(clippedSegment(path[i-1],path[i],mask).reduce((length,part)=>length+part.t1-part.t0,0)<1-1e-7)return false;
  return true;
}
function submitTrimPick(screen,{extend=false}={}){
  if(trimPerspectiveUnsupported())return{ok:false,message:'Project View is unavailable in perspective. Choose Project UCS/None or an orthographic view.'};
  const interaction=trimInteraction();
  if(interaction?.automaticFence&&!trimPathVisible([toScreen(interaction.automaticFence),screen]))return{ok:false,message:'Keep the entire fence inside the visible canvas or active viewport.'};
  const point=trimScreenPoint(screen);if(!point)return{ok:false,message:'The point could not be acquired from this view.'};
  syncTrimProjectionView();const entityId=interaction?.automaticFence?null:objectAtScreen(screen,visibleEntities());
  return editor.trimPick(point,{extend,...(entityId?{entityId}:{})});
}
function submitTrimFence(screens,{extend=false,crossing=false}={}){
  if(trimPerspectiveUnsupported())return{ok:false,message:'Project View is unavailable in perspective. Choose Project UCS/None or an orthographic view.'};
  if(!trimPathVisible(screens,{crossing}))return{ok:false,message:'Keep the entire fence or crossing rectangle inside the visible canvas or active viewport.'};
  const points=screens.map(trimScreenPoint);if(points.some(point=>!point))return{ok:false,message:'A fence point could not be acquired from this view.'};
  syncTrimProjectionView();return editor.trimFence(points,{extend,crossing});
}
function runCommand(raw, {recall=true}={}) {
  closeCanvasMenu(false);hideToolHelp();
  if(documentActionBusy)return {ok:false,message:'Wait for the drawing file operation to finish.'};
  if(ordinaryGripStage)return submitOrdinaryGripInput(raw);
  if(syncPointOverride()&&rawPointer){const rect=canvas.getBoundingClientRect();pointerPosition({clientX:rect.left+rawPointer.x,clientY:rect.top+rawPointer.y});}
  if(!state().command&&commandName(raw)==='STRUCTURALBRIDGE')return showStructuralBridge();
  if(drag?.mode==='roof-component-grip')return submitRoofGripInput(raw);
  flushViewportNavigation();
  const text = String(raw ?? '').trim();
  addLog(`${currentPrompt()} ${text || '↵'}`, 'input');
  if(trimInteraction()&&['F','FENCE','C','CROSSING'].includes(text.toUpperCase()))trimFenceExtend=false;
  if(trimInteraction()&&state().commandPhase==='trim-project'&&['V','VIEW'].includes(text.toUpperCase())&&(modelWorkspace()||currentViewport())&&camera3D().projection==='perspective')return resultLog({ok:false,message:'Project View is unavailable in perspective. Choose UCS/None or an orthographic view.'});
  if(trimInteraction()&&state().commandPhase==='trim-fence'&&!text&&state().commandPoints?.length>=2){const points=state().commandPoints;if(!trimPathVisible(points.map(toScreen)))return resultLog({ok:false,message:'Keep the entire fence inside the visible canvas or active viewport.'});syncTrimProjectionView();const result=editor.trimFence(points,{extend:trimFenceExtend});trimFenceExtend=false;return resultLog(result);}
  const snapToken=commandPointSnapToken(text,{command:state().command,prompt:state().prompt,pointPrompt:commandPointPrompt()});
  if(snapToken){hideCompletion();const ok=setPointSnapOverride(snapToken);update();return{ok,message:ok?'Temporary object snap selected.':'Specify a base point first; deferred perpendicular is not available.'};}
  if (text && recall) { commandRecall.push(text); recallIndex = commandRecall.length; }
  panTool = false;
  hideCompletion();closePalettes();
  const command=state().command||commandName(text);
  if(!state().command&&['TRIM','EXTEND'].includes(command)){trimFenceExtend=false;trimPointerExtend=false;}
  if(['TRIM','EXTEND'].includes(command))syncTrimProjectionView();
  if(!state().command&&selectedSubobject&&['ERASE','E','MOVE','M','COPY','CO','CP','SCALE','SC','ROTATE','RO','ROTATE3D','COPYCLIP','CUTCLIP','COPYBASE','MIRROR','MI'].includes(command)){const result={ok:false,message:'Choose Whole object for this command. Mesh subobjects are edited with their highlighted grip or Properties.'};resultLog(result);return result;}
  if(!state().command&&['UCS','BOX','CYLINDER','SPHERE','EXTRUDE','3DPOLY','ROTATE3D','3DORBIT','3DFORBIT','3DORBITCTR','VPOINT','PLAN'].includes(command))editor.setWorkspace('3d');
  if(!state().command&&['3DORBIT','3DFORBIT'].includes(command)){startOrbit(command==='3DFORBIT'?'free':'constrained');return {ok:true,message:'Orbit view active.'};}
  if(orbitMode){orbitMode=null;orbitPivot=null;if(!text){update();return {ok:true,message:'Orbit view ended.'};}}
  if(!state().command&&command==='PAN'){panTool=true;update();return{ok:true,message:'Pan view active. Drag to move the view; Enter or Escape exits.'};}
  if(!state().command&&command==='HELP'){showReference();return {ok:true};}
  if(!state().command&&['ARCHITECTURE','WALL','WALLFROM','WALLHEIGHT','ROOM','ROOF','ROOFGABLE','ROOFPITCH','ROOFREPORT','ROOFSPACE','ROOFSECTION','ROOFOPTIMIZE'].includes(command)){showArchitecture(command==='ROOFOPTIMIZE'?'alternatives':['ROOFSPACE','ROOFSECTION'].includes(command)?'space':command==='ROOM'?'rooms':command==='ROOFREPORT'?'report':['ROOF','ROOFGABLE','ROOFPITCH'].includes(command)?'roof':'walls');return{ok:true,message:'Architecture tools opened.'};}
  if(!state().command&&command==='ROOFUPDATE')return applyArchitecture({type:'regenerate'});
  if(!state().command&&['STYLE','DIMSTYLE','UNITS'].includes(command)){showSettings();return {ok:true};}
  if(!state().command&&['PLOT','PUBLISH'].includes(command))return showPlot(command==='PUBLISH'?'publish':'plot');
  if(!state().command&&['LAYER','LA'].includes(command)){showLayerManager();return{ok:true};}
  if(!state().command&&command==='PAGESETUP'){showPageSetup(!currentLayout());return{ok:true};}
  if(!state().command&&command==='PASTECLIP')return preparePaste();
  const anchor=state().commandPoints?.at(-1),direction=pointer&&anchor&&['LINE','PLINE'].includes(state().command)?{x:pointer.x-anchor.x,y:pointer.y-anchor.y,z:(pointer.z||0)-(anchor.z||0)}:null;
  const inputOptions=direction&&Object.values(direction).every(Number.isFinite)&&Object.values(direction).some(value=>value!==0)?{direction}:{};
  const starting=!state().command,previousCamera=camera3D(),pendingSnap=onePointSnap,result=state().commandPhase==='text'&&editor.submitText?editor.submitText(String(raw??'')):editor.execute(text,inputOptions);
  // The engine consumed every accepted point through submitPoint. A successful
  // same-command option (including local Undo) may legitimately change content;
  // retain the pending next-point choice across that explicit option only.
  if(pendingSnap&&onePointSnap===pendingSnap&&result.ok&&state().command===pendingSnap.context.command)onePointSnap.context=pointOverrideContext();
  resultLog(result);trackClipboard(command,result);
  lastRepeatableCommand=nextRepeatableCommand(commandCatalog,{previous:lastRepeatableCommand,command,activeCommand:state().command,starting,accepted:result.ok===true});
  if(command==='MVIEW'&&result.ok&&!state().command){selectCreatedViewport(result.viewportId);update();}
  if(command==='3DORBITCTR'&&result.ok&&!state().command){const p=toScreen(camera3D().orbitCenter);if(!finiteScreenPoint(p)||p.x<0||p.x>width||p.y<0||p.y>height){setCamera({...camera3D(),orbitCenter:previousCamera.orbitCenter,autoTarget:previousCamera.autoTarget});addLog('Center outside the view; the previous orbit center was retained.');startOrbit('constrained');}else startOrbit('constrained',null,{explicit:true});}
  if(modelWorkspace()&&result.ok&&!state().command&&(command==='ZOOM'||/^Z(?:OOM)?\s+E(?:XTENTS)?$/i.test(text)))fit();return result;
}
function currentPrompt() { return ordinaryGripStage?`Grip stretch Specify ${paperSpace()?'paper':'UCS'} destination:`:drag?.mode==='roof-component-grip'?'Footprint XY:':state().prompt || 'Command:'; }
// A point override belongs to the current command and document, not drawing settings.
// Observe the engine's actual point entry rather than guessing from typed tokens:
// option words, rejected input and scalar-only entries do not consume an override.
function commandPointPrompt(){
  if(ordinaryGripStage)return true;
  const value=state(),kind=value.commandData?.targetKind,phase=value.commandPhase;
  if(!value.command||drag?.mode==='roof-component-grip'||kind==='none'||kind==='object'||value.command==='ZOOM')return false;
  if(['selection','join-selection','window-first','window-second','mode','object','axis','view-vector','plan-choice','height','mtext-height','text','rotation','distance','delete-choice','clipboard-ready'].includes(phase))return false;
  return kind==='point'||['LINE','PLINE','RECTANG','CIRCLE','ARC'].includes(value.command);
}
function pointOverrideDocument(){
  const value=editorDocument(),viewport=value.layouts?.find(layout=>layout.id===state().activeLayoutId)?.viewports.find(view=>view.id===state().activeViewportId);
  // Panning, zooming and orbiting the active viewport retain point acquisition.
  // Other drawing, layer, unit, UCS, layout and viewport-boundary edits invalidate it.
  if(viewport)for(const key of ['modelCenter','camera3d','scaleDenominator','workspace'])delete viewport[key];
  return contentFingerprint(value);
}
function pointOverrideContext({full=true}={}){return{editor,command:ordinaryGripStage?'GRIPSTRETCH':state().command,gripOwner:ordinaryGripStage,space:state().activeSpace,layoutId:state().activeLayoutId,viewportId:state().activeViewportId,ucs:JSON.stringify(state().ucs),...(full?{document:pointOverrideDocument()}:{})};}
function syncPointOverride({full=true}={}){
  if(!onePointSnap)return false;
  const current=pointOverrideContext({full}),previous=onePointSnap.context;
  if(Object.keys(current).some(key=>current[key]!==previous[key])){onePointSnap=null;snap=null;return true;}return false;
}
function observePointSubmissions(){
  if(pointObservedEditors.has(editor))return;const observed=editor,submit=observed.submitPoint;
  observed.submitPoint=function(...args){
    syncPointOverride();const consume=observed===editor&&commandPointPrompt()&&Boolean(onePointSnap),result=submit.apply(observed,args);
    if(consume&&result?.ok){onePointSnap=null;snap=null;}return result;
  };
  pointObservedEditors.add(observed);
}
function pointSnapAnchor(){const point=ordinaryGripStage?.sourcePoint||(drag?.mode==='grip'?drag.sourcePoint:state().commandPoints?.at(-1));return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&(point.z===undefined||Number.isFinite(point.z))?point:null;}
function objectSnapState(){syncPointOverride();return{available:commandPointPrompt(),pointPrompt:commandPointPrompt(),perpendicularAvailable:Boolean(pointSnapAnchor()),override:onePointSnap?.mode||null,runningEnabled:Boolean(state().settings?.snapEnabled),runningModes:[...(state().settings?.snapModes||[])]};}
function setPointSnapOverride(mode){
  if(!commandPointPrompt())return false;
  if(mode==='perpendicular'&&!pointSnapAnchor()){toast('Specify a base point first; deferred perpendicular is not available.');return false;}
  onePointSnap=mode==='running'?null:{mode,context:pointOverrideContext()};snap=null;
  if(rawPointer){const rect=canvas.getBoundingClientRect();pointerPosition({clientX:rect.left+rawPointer.x,clientY:rect.top+rawPointer.y});}draw();updateStatus();
  addLog(mode==='running'?'Using running object snaps.':`${mode==='none'?'No object snap':mode[0].toUpperCase()+mode.slice(1)+' snap'} for the next accepted point.`,'notice');return true;
}
function canvasMenuContext(){
  syncOrdinaryGripStage();
  // getSelectionObjects validates and can prune selections. Menus must be read-only.
  const ids=[...state().selectionIds],objects=activeObjects().filter(object=>ids.includes(object.id)),visibleIDs=new Set(visibleObjects().map(object=>object.id)),owners=objects.map(architectureOwner).filter(Boolean),unique=[...new Map(owners.map(owner=>[`${owner.kind}:${owner.id}`,owner])).values()],component=currentRoofComponent(),hasViewport=objects.some(object=>object.type==='VIEWPORT'),singleViewport=ids.length===1&&objects.length===1&&objects[0].type==='VIEWPORT',locked=objects.some(object=>layerFor(object)?.locked),generated=owners.length>0,subobject=Boolean(selectedSubobject),complete=objects.length===ids.length,visible=objects.every(object=>visibleIDs.has(object.id));
  const ordinary=ids.length>0&&complete&&visible&&!locked&&!generated&&!subobject,reason=!complete?'The selection is no longer complete.':!visible?'The selection contains objects hidden in the current model, paper or viewport layer context.':locked?'The selection contains a locked layer.':generated?'Generated geometry is edited through its architectural source.':subobject?'Choose Whole object before using this operation.':'';
  const selectedFrame=singleViewport?currentLayout()?.viewports.find(view=>view.id===objects[0].viewportId):null,targetViewport=selectedFrame||currentViewport(),border=targetViewport?{layer:targetViewport.layer||'0',layoutId:state().activeLayoutId}:null,borderLayer=border?layerFor(border):null,borderVisible=border?geometry.isEntityVisible(border,state(),{space:'paper',layoutId:state().activeLayoutId,viewportId:null}):false,canEditViewport=Boolean(targetViewport&&borderVisible&&!borderLayer?.locked&&!subobject&&!state().command&&!drag&&!orbitMode&&!panTool),preferred=viewportScalePreference(),scaleGroups=[...geometry.VIEWPORT_SCALE_GROUPS].sort((a,b)=>(b.id===preferred?1:0)-(a.id===preferred?1:0)),viewport=targetViewport?{id:targetViewport.id,locked:Boolean(targetViewport.locked),canEdit:canEditViewport,scaleDenominator:targetViewport.scaleDenominator,scales:scaleGroups.flatMap(group=>group.scales.map(scale=>({id:scale.id,label:scale.label,denominator:scale.scaleDenominator}))),reason:!borderVisible?'The viewport border layer is hidden in paper space.':borderLayer?.locked?'The viewport border layer is locked.':'Finish the current operation before editing this viewport.'}:null;
  const snaps=objectSnapState();
  return{operation:ordinaryGripStage?{kind:'ordinary-grip',title:'Grip stretch',canFinish:ordinaryGripStage.phase==='latched'&&ordinaryGripStage.valid,reason:ordinaryGripStage.error}:drag?.mode==='roof-component-grip'?{kind:'roof-grip',title:'Roof footprint acquisition',typed:Boolean(drag.typedActive),canFinish:drag.valid,reason:drag.error}:orbitMode||panTool?{kind:'navigation',title:orbitMode?'Orbit navigation':'Pan navigation'}:null,command:state().command||null,prompt:state().prompt||'',pointPrompt:snaps.available,perpendicularAvailable:snaps.perpendicularAvailable,snapOverride:snaps.override,selection:{count:ids.length,component:Boolean(component),generated,singleOwner:unique.length===1,viewport:Boolean(singleViewport),hasViewport,complete,visible,canCopy:ordinary&&!hasViewport,canCut:ordinary&&!hasViewport,canDelete:ordinary,canModify:ordinary,canMirror:ordinary&&!objects.some(object=>['MESH','POLY3D','CIRCLE3D','ARC3D','INSERT'].includes(object.type)),reason,mirrorReason:reason||'Mirror does not support meshes, 3D paths or block references.'},space:{paper:paperSpace(),layoutId:state().activeLayoutId||null,viewportId:state().activeViewportId||null,workspace:modelWorkspace()?'3d':'2d'},viewport,canUndo:!orbitMode&&editor.canUndo,canRedo:!orbitMode&&editor.canRedo,repeat:lastRepeatableCommand,
    stamp:{document:documentFingerprint(),ids,workspace:state().workspace,view:state().viewport,camera:camera3D(),paperView:paperView(),commandPhase:state().commandPhase,commandPoints:state().commandPoints,input:input.value,subobject:selectedSubobject,component:component?{roofGroupId:component.roofGroupId,componentId:component.componentId}:null,grip:ordinaryGripStage?{entityId:ordinaryGripStage.entityId,index:ordinaryGripStage.index,phase:ordinaryGripStage.phase,target:ordinaryGripStage.targetPoint,valid:ordinaryGripStage.valid}:drag?.mode==='roof-component-grip'?{id:drag.gripId,bounds:drag.bounds,typed:drag.typedActive}:null},owner:unique.length===1?unique[0]:null,component:component?{kind:'roofGroup',id:component.roofGroupId,componentId:component.componentId}:null,viewportId:singleViewport?objects[0].viewportId:null};
}
function canvasMenuAvailable(){return!documentActionBusy&&!editorDialogOpen()&&!viewportNavigationDraft&&ordinaryGripStage?.phase!=='pressed'&&(!drag||drag.mode==='roof-component-grip'&&drag.acquisition==='latched');}
function canvasMenuCurrent(){return Boolean(canvasMenu&&canvasMenu.editor===editor&&canvasMenuAvailable()&&canvasMenu.signature===menuContextSignature(canvasMenuContext()));}
function closeCanvasMenu(restore=true){
  if(!canvasMenu)return false;const previous=canvasMenu.focus;canvasMenu=null;const menu=$('canvas-context-menu');menu.hidden=true;menu.querySelectorAll('.canvas-context-submenu').forEach(panel=>panel.remove());
  if(restore&&previous?.isConnected&&!editorDialogOpen()&&!documentActionBusy)previous.focus({preventScroll:true});return true;
}
function canvasMenuItem(id,items=canvasMenu?.model.items||[]){for(const item of items){if(item.id===id)return item;const nested=item.children&&canvasMenuItem(id,item.children);if(nested)return nested;}return null;}
function menuPanelButtons(level=0){return[...$('canvas-context-menu').querySelectorAll(`[data-menu-action][data-menu-level="${level}"]`)];}
function focusCanvasMenuItem(index,level=0){const buttons=menuPanelButtons(level);if(!buttons.length)return;const target=buttons[(index+buttons.length)%buttons.length];$('canvas-context-menu').querySelectorAll('[data-menu-action]').forEach(button=>button.tabIndex=button===target?0:-1);target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});describeCanvasMenuItem(target);}
function describeCanvasMenuItem(button){const item=canvasMenuItem(button.dataset.menuAction);if(item)$('canvas-context-description').textContent=item.enabled?item.description:`${item.description} ${item.reason}`;}
function closeCanvasSubmenus(level=0){
  const menu=$('canvas-context-menu');for(const panel of menu.querySelectorAll('.canvas-context-submenu'))if(Number(panel.dataset.menuLevel)>level)panel.remove();
  for(const button of menu.querySelectorAll('[aria-haspopup="menu"]'))if(Number(button.dataset.menuLevel)>=level)button.setAttribute('aria-expanded','false');
  if(canvasMenu)canvasMenu.openPath=canvasMenu.openPath.slice(0,level);
}
function clampCanvasMenuPanel(panel,x,y){
  panel.style.left='0px';panel.style.top='0px';const box=panel.getBoundingClientRect(),left=Math.max(6,Math.min(x,innerWidth-box.width-6)),top=Math.max(6,Math.min(y,innerHeight-box.height-6));panel.style.left=`${left}px`;panel.style.top=`${top}px`;return{x:left,y:top};
}
function renderCanvasMenuItems(items,parent,level){
  const owner=canvasMenu;
  for(const item of items){const button=document.createElement('button');button.type='button';button.className='canvas-context-item';button.dataset.menuAction=item.id;button.dataset.menuLevel=String(level);button.dataset.menuLabel=item.label;button.setAttribute('role',item.type==='radio'?'menuitemradio':item.type==='checkbox'?'menuitemcheckbox':'menuitem');button.setAttribute('aria-disabled',String(!item.enabled));button.setAttribute('aria-describedby','canvas-context-description');button.tabIndex=-1;
    if(item.type==='radio'||item.type==='checkbox')button.setAttribute('aria-checked',String(Boolean(item.checked)));
    const label=document.createElement('span');label.className='canvas-context-label';label.textContent=item.label;button.append(label);
    if(item.children?.length){button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');const arrow=document.createElement('span');arrow.className='canvas-context-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';button.append(arrow);}
    button.addEventListener('pointerenter',()=>{
      if(canvasMenu!==owner)return;if(!canvasMenuCurrent()){closeCanvasMenu(false);return;}
      // Hover and keyboard share one active item. Do not scroll an already
      // visible hovered row, which would otherwise disturb its open flyout.
      $('canvas-context-menu').querySelectorAll('[data-menu-action]').forEach(other=>other.tabIndex=other===button?0:-1);button.focus({preventScroll:true});describeCanvasMenuItem(button);
      if(item.children?.length&&item.enabled)openCanvasSubmenu(button);else closeCanvasSubmenus(level);
    });
    button.addEventListener('focus',()=>{if(canvasMenu===owner)describeCanvasMenuItem(button);});button.addEventListener('click',()=>{if(canvasMenu===owner)invokeCanvasMenuItem(item.id);});parent.append(button);
  }
}
function openCanvasSubmenu(button,{focus=false}={}){
  if(!canvasMenuCurrent()){closeCanvasMenu();toast('The drawing context changed. Open the menu again.');return false;}
  const item=canvasMenuItem(button.dataset.menuAction),level=Number(button.dataset.menuLevel);if(!item?.enabled||!item.children?.length)return false;
  if(canvasMenu.openPath[level]!==item.id){closeCanvasSubmenus(level);const panel=document.createElement('div');panel.className='canvas-context-submenu';panel.dataset.menuLevel=String(level+1);panel.setAttribute('role','menu');panel.setAttribute('aria-label',item.label);panel.id=`canvas-context-submenu-${level+1}`;renderCanvasMenuItems(item.children,panel,level+1);$('canvas-context-menu').append(panel);button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','true');canvasMenu.openPath[level]=item.id;
    const box=button.getBoundingClientRect(),parent=button.closest('.canvas-context-submenu')||$('canvas-context-menu'),parentBox=parent.getBoundingClientRect(),panelBox=panel.getBoundingClientRect(),x=parentBox.right+panelBox.width+4>innerWidth?parentBox.left-panelBox.width+2:parentBox.right-2;clampCanvasMenuPanel(panel,x,box.top-4);
  }
  if(focus)focusCanvasMenuItem(0,level+1);return true;
}
function openCanvasMenu(clientX,clientY,{keyboard=false,snapOnly=false}={}){
  if(!canvasMenuAvailable())return false;closeCanvasMenu(false);hideToolHelp();
  const context=canvasMenuContext();if(snapOnly&&!context.pointPrompt)return false;
  const model=snapOnly?buildObjectSnapMenu(context):buildCanvasContextMenu(context),menu=$('canvas-context-menu'),items=$('canvas-context-items');
  canvasMenu={editor,signature:menuContextSignature(context),context,model,focus:document.activeElement,anchor:{x:clientX,y:clientY},keyboard,openPath:[],typeahead:'',typeaheadAt:0};items.replaceChildren();$('canvas-context-title').textContent=model.title;menu.setAttribute('aria-label',`${model.title} actions`);renderCanvasMenuItems(model.items,items,0);
  menu.hidden=false;canvasMenu.position=clampCanvasMenuPanel(menu,clientX,clientY);focusCanvasMenuItem(0);return true;
}
function invokeCanvasMenuItem(id){
  if(!canvasMenuCurrent()){closeCanvasMenu();toast('The drawing context changed. Open the menu again.');return false;}
  const saved=canvasMenu,item=canvasMenuItem(id);if(!item?.enabled)return false;
  if(item.children?.length){const button=[...$('canvas-context-menu').querySelectorAll('[data-menu-action]')].find(button=>button.dataset.menuAction===id);return button?openCanvasSubmenu(button,{focus:true}):false;}
  closeCanvasMenu(false);
  if(id==='grip:accept')return finishOrdinaryGripStage();
  if(id.startsWith('snap:')){const result=setPointSnapOverride(item.mode);canvas.focus({preventScroll:true});return result;}
  if(id==='viewport-lock'||id.startsWith('scale:')){const viewport=saved.context.viewport;if(!viewport?.canEdit)return false;const patch=id==='viewport-lock'?{locked:!viewport.locked}:{scaleDenominator:item.denominator};if(id.startsWith('scale:')&&viewport.locked)return false;const result=resultLog(editor.updateViewport(saved.context.space.layoutId,viewport.id,patch));canvas.focus({preventScroll:true});return result;}
  if(id.startsWith('command:')){const result=runCommand(item.command||id.slice(8));input.focus({preventScroll:true});return result;}
  if(id==='properties'){$('properties-content').focus({preventScroll:true});return true;}
  if(id==='edit-component'){showArchitecture('roof',saved.context.component);return true;}
  if(id==='structural-bridge'){showStructuralBridge(saved.context.component);return true;}
  if(id==='edit-source'){const owner=saved.context.owner;showArchitecture(owner.kind==='roofGroup'?'roof':owner.kind==='room'?'rooms':'walls',owner);return true;}
  if(id==='viewport-model'){enterSpace('model',saved.context.space.layoutId,saved.context.viewportId);return true;}
  if(id==='paper'){enterSpace('paper',saved.context.space.layoutId);return true;}
  if(id==='page-setup'){showPageSetup();return true;}
  if(id==='layers'){showLayerManager();return true;}
  if(id==='pointer'){input.value='';previewRoofGripText('');input.focus({preventScroll:true});return true;}
  if(id==='cancel'){cancel();input.focus({preventScroll:true});return true;}
  if(id==='finish'){if(drag?.mode==='roof-component-grip')finishRoofGripAcquisition();else if(orbitMode||panTool)runCommand('');input.focus({preventScroll:true});return true;}
  if(id==='enter'||id.startsWith('option:')){const value=id==='enter'?input.value:item.token;input.value='';runCommand(value);input.focus({preventScroll:true});return true;}
  canvas.focus({preventScroll:true});
  if(id==='repeat'){runCommand(saved.context.repeat);input.focus({preventScroll:true});return true;}
  if(id==='delete')return eraseCurrentSelection();
  return runAction(id);
}
function contextMenuState(){return canvasMenu?structuredClone({open:true,context:canvasMenu.model.context,title:canvasMenu.model.title,items:canvasMenu.model.items,anchor:canvasMenu.anchor,position:canvasMenu.position,openPath:canvasMenu.openPath,focused:document.activeElement?.dataset.menuAction||null}):{open:false,context:null,items:[]};}
function hideToolHelp(){if(toolHelpTarget?.getAttribute('aria-describedby')==='tool-help')toolHelpTarget.removeAttribute('aria-describedby');toolHelpTarget=null;const help=$('tool-help');if(help)help.hidden=true;}
function showToolHelp(control){
  if(!control||canvasMenu||control.closest('#canvas-context-menu'))return;const name=control.getAttribute('aria-label')||control.getAttribute('title')||control.textContent.trim(),command=commandCatalog.find(item=>item.name===(control.dataset.command||control.dataset.tool)),descriptions={'new-document':'Create a drawing after the existing save/discard check.','open-document':'Open a drawing through the established native file controls.','save-document':'Save the accepted drawing, layouts and architectural source.','export-dxf':'Export drafting geometry and current derivatives to DXF.','settings-button':'Set drawing units, object snaps, text and dimension styles.','architecture-button':'Edit semantic walls, rooms, roofs and ceiling-space studies.','help-button':'Read the drafting guide.','undo-button':'Undo the previous accepted edit.','redo-button':'Redo the next accepted edit.','fit-button':'Fit visible geometry in the active drawing space.','delete-button':'Erase the current editable selection.','snap-toggle':'Toggle endpoint, midpoint, center and quadrant acquisition using enabled modes.','grid-toggle':'Show or hide the drafting grid.','ortho-toggle':'Constrain eligible pointer segments to the active plane axes.','reference-tools':'Search supported command names, options, examples and limits.'},description=control.dataset.help||command?.summary||descriptions[control.id]||control.getAttribute('title')||'Activate this control.';if(!name)return;
  hideToolHelp();const help=$('tool-help');toolHelpTarget=control;$('tool-help-name').textContent=name;$('tool-help-description').textContent=control.disabled?`${description} Unavailable in the current drawing state.`:description;if(!control.hasAttribute('aria-describedby'))control.setAttribute('aria-describedby','tool-help');help.hidden=false;const box=help.getBoundingClientRect(),anchor=control.getBoundingClientRect();help.style.left=`${Math.max(6,Math.min(anchor.right+8,innerWidth-box.width-6))}px`;help.style.top=`${Math.max(6,Math.min(anchor.top,innerHeight-box.height-6))}px`;
}
function cancel() {
  if(discardOrdinaryGripStage('*Cancel* grip preview')){ordinaryGripConsumedUp=null;drag=null;update();return;}
  onePointSnap=null;
  acquiredGrip=null;trimFenceExtend=false;trimPointerExtend=false;
  closeCanvasMenu(false);
  if(discardRoofGripDraft()){addLog('*Cancel* footprint grip','notice');update();return;}
  clearRoofDragPreview();
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
  const nativeSaveAs=developmentMode&&!saveAs?!await negotiateDevelopmentRecovery():saveAs;
  const text=serializedDrawing(), fingerprint=documentFingerprint();
  if(desktop){
    const result=await desktop.saveDrawing(text,nativeSaveAs);
    if(result?.canceled)return false;
    if(!result?.ok){addLog(result?.error||'The drawing could not be saved.','error');toast(result?.error||'The drawing could not be saved.');return false;}
    documentName=displayName(result.name||documentName);
    if(developmentMode)consumeDevelopmentBinding(result);
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
  discardOrdinaryGripStage();ordinaryGripConsumedUp=null;
  clearRoofDragPreview();
  editor=fresh;editor.setViewSize(width,height);documentName=displayName(name);
  plotLayoutDraft=null;plotPreviewSheets=[];plotPreviewIndex=0;if(lastPlotOptions?.space==='layouts')lastPlotOptions={...lastPlotOptions,space:'current',layoutId:null,layoutIds:null};
  if(localGeometryClipboard&&editor.setClipboard)editor.setClipboard(localGeometryClipboard);
  savedFingerprint=documentFingerprint();importedAwaitingSave=imported;panTool=false;orbitMode=null;orbitPivot=null;drag=null;pointer=null;rawPointer=null;snap=null;pointerUnavailable=null;pointerScalar=null;input.value='';
  if(imported){if(currentLayout())fitPaper();else if(modelWorkspace())setCamera(view3d.fitCamera(modelPoints(),camera3D(),width,height,64));else state().viewport=zoomExtents(visibleEntities(),state().viewport,width,height,64,state());}
  selectedViewportId=null;selectedSubobject=null;subobjectMode='whole';overlapCycle=null;viewportNavigationDraft=null;for(const id of ['page-setup-dialog','viewport-scale-dialog','layer-manager-dialog'])if($(id).open)$(id).close();
  if($('layer-dialog').open)$('layer-dialog').close();
  if($('help-dialog').open)$('help-dialog').close();
  if($('reference-dialog').open)$('reference-dialog').close();hideCompletion();closePalettes();
  if($('annotation-dialog').open)$('annotation-dialog').close();annotationEditor=null;if($('settings-dialog').open)$('settings-dialog').close();settingsDraft=null;
  update();input.focus({preventScroll:true});
}
function showImportReport(info){
  const box=$('import-report-content');box.replaceChildren();const headline=document.createElement('p'),paperLayouts=Array.isArray(info.paperLayouts)?info.paperLayouts:[];
  const total=info.importedEntities??0,paper=paperLayouts.reduce((sum,layout)=>sum+(layout.entities??0),0),model=total-paper,sourceRecords=info.modelSourceEntities??0;
  headline.textContent=`${info.sourceFormat||'Drawing'} import: ${total} supported object${total===1?'':'s'} total (${model} model-space, ${paper} paper-space); ${paperLayouts.length?`${paperLayouts.length} paper layout${paperLayouts.length===1?'':'s'}; `:''}${sourceRecords} model-space source record${sourceRecords===1?'':'s'}.`;box.append(headline);addLog(headline.textContent);
  if(paperLayouts.length){const list=document.createElement('ul');for(const layout of paperLayouts){const item=document.createElement('li'),paper=layout.paper,offset=layout.plotSettings?.renderOffsetMm;item.textContent=`${layout.name} · ${layout.entities??0} paper objects${paper?` · ${paper.widthMm} × ${paper.heightMm} mm`:''}${offset?` · source origin offset ${offset.x}, ${offset.y} mm`:''}`;list.append(item);}box.append(list);}
  const skipped=Object.entries(info.unsupportedByType||{}).filter(([,count])=>count>0),warnings=Array.isArray(info.warnings)?info.warnings:[];
  if(skipped.length){const label=document.createElement('p');label.textContent='Unsupported records were skipped:';const list=document.createElement('ul');for(const[type,count]of skipped){const row=document.createElement('li');row.textContent=`${type}: ${count}`;list.append(row);addLog(`Skipped ${count} ${type} records.`);}box.append(label,list);}
  if(warnings.length){const list=document.createElement('ul');for(const warning of warnings){const message=typeof warning==='string'?warning:typeof warning?.message==='string'?warning.message+(Number.isFinite(warning.count)&&warning.count>0?` (${warning.count} occurrence${warning.count===1?'':'s'})`:''):'An import warning was reported.';const row=document.createElement('li');row.textContent=message;list.append(row);addLog(message);}box.append(list);}
  if(skipped.length||warnings.length)$('import-dialog').showModal();else toast('Drawing imported. Save it as a Linecraft file.');
}
function setDocumentBusy(busy){documentActionBusy=busy;$('application').classList.toggle('application-busy',busy);for(const element of document.querySelectorAll('.workspace,.command-panel,.statusbar,.document-bar,.layout-tabbar'))element.inert=busy;$('settings-button').disabled=busy;}
async function newDrawing() {
  if(!await canDiscard())return false;
  if(desktop){const result=await desktop.resetDocumentPath();if(!result?.ok){addLog(result?.error||'The drawing could not be reset.','error');toast(result?.error||'The drawing could not be reset.');return false;}if(developmentMode)consumeDevelopmentBinding(result);}
  replaceDrawing(createEditor(),'Untitled drawing');
  $('command-log').replaceChildren();addLog('New drawing. Enter a command, or open Commands to explore drawing and editing tools.');return true;
}
async function openDrawing() {
  if(annotationFontRefresh)await annotationFontRefresh;
  if(!desktop){$('file-input').click();return true;}
  if(!await canDiscard())return false;
  const result=await desktop.openDrawing();
  if(result?.canceled)return false;
  if(!result?.ok){addLog(result?.error||'The drawing could not be opened.','error');toast(result?.error||'The drawing could not be opened.');return false;}
  // A newly constructed editor starts with no import transaction in its undo stack.
  const fresh=createEditor(JSON.parse(result.text));
  if(developmentMode)consumeDevelopmentBinding(result);
  replaceDrawing(fresh,result.name,{imported:result.imported===true});
  addLog(`Opened ${result.name}.`);if(result.importInfo)showImportReport(result.importInfo);return true;
}
function fileOpenDeferralReason(){
  if(closingApplication)return 'closing';
  if(annotationFontRefresh)return 'font-metrics';
  if(documentActionBusy||structuralBridge.busy||plotSubmitting||clipboardWritePromise)return 'document-operation';
  if(document.querySelector('dialog[open]'))return 'dialog';
  if(state().command)return 'command';
  if(ordinaryGripStage||drag||cubeDrag||orbitMode||panTool)return 'gesture';
  if(viewportNavigationDraft)return 'viewport-navigation';
  if(canvasMenu)return 'context-menu';
  if(input.value.trim())return 'command-input';
  if(textEditing()&&document.activeElement!==input)return 'field-input';
  return null;
}
function getFileOpenState(){return structuredClone(fileOpenState);}
function scheduleFileOpen(delay=0){
  if(!desktop?.openRequest||!desktop?.onOpenRequest||closingApplication)return;
  fileOpenNotified=true;
  if(fileOpenChecking||fileOpenTimer!==null)return;
  fileOpenTimer=setTimeout(()=>{fileOpenTimer=null;pumpFileOpen();},delay);
}
async function openRequestedDrawing(request){
  try{
    const prepared=await desktop.openRequest({action:'prepare',id:request.id});
    if(prepared?.busy)return{...request,status:'deferred'};
    if(!prepared?.ok||prepared.id!==request.id||typeof prepared.text!=='string')throw Error(prepared?.error||'The requested drawing could not be opened.');
    // Validate and construct in isolation before asking to discard the current drawing.
    const fresh=createEditor(JSON.parse(prepared.text));fresh.setViewSize(width,height);
    if(!await canDiscard()){
      const canceled=await desktop.openRequest({action:'cancel',id:request.id});
      if(!canceled?.ok)throw Error(canceled?.error||'The drawing-open request could not be canceled.');
      return{...request,status:'cancelled'};
    }
    const committed=await desktop.openRequest({action:'commit',id:request.id});
    if(committed?.busy)return{...request,status:'deferred'};
    if(!committed?.ok)throw Error(committed?.error||'The requested drawing could not be accepted.');
    if(developmentMode)consumeDevelopmentBinding(committed);
    replaceDrawing(fresh,prepared.name||request.name);
    addLog(`Opened ${prepared.name||request.name}.`);
    return{...request,status:'opened'};
  }catch(error){
    // Cancellation consumes only this queued request, never the current document path.
    try{await desktop.openRequest({action:'cancel',id:request.id});}catch{}
    const message=error.message||'The requested drawing could not be opened.';
    addLog(message,'error');toast(message);return{...request,status:'error',message};
  }
}
async function pumpFileOpen(){
  if(fileOpenChecking||closingApplication)return;
  fileOpenChecking=true;fileOpenNotified=false;let retry=false,retryDelay=0;
  try{
    const response=await desktop.openRequest({action:'peek'});
    if(!response?.ok)throw Error(response?.error||'The drawing-open request could not be read.');
    fileOpenState.ready=true;fileOpenState.pending=response.request?{id:response.request.id,name:response.request.name}:null;
    if(!fileOpenState.pending){fileOpenState.status='idle';fileOpenState.deferredReason=null;fileOpenDeferredId=null;return;}
    const reason=fileOpenDeferralReason();
    if(reason){
      fileOpenState.status='deferred';fileOpenState.deferredReason=reason;retry=true;retryDelay=250;
      if(fileOpenDeferredId!==fileOpenState.pending.id){fileOpenDeferredId=fileOpenState.pending.id;addLog(`Opening ${fileOpenState.pending.name} is waiting. Finish or cancel the active command, editor or navigation first.`,'notice');}
      return;
    }
    fileOpenState.status='opening';fileOpenState.deferredReason=null;setDocumentBusy(true);
    let result;
    try{result=await openRequestedDrawing(fileOpenState.pending);}
    finally{setDocumentBusy(false);}
    if(result.status==='deferred'){fileOpenState.status='deferred';fileOpenState.deferredReason='document-operation';retry=true;retryDelay=250;return;}
    fileOpenState.lastResult=result;
    fileOpenState.pending=null;fileOpenState.status='idle';fileOpenDeferredId=null;retry=true;
  }catch(error){
    const message=error.message||'The drawing-open request could not be read.';
    fileOpenState.status='error';addLog(message,'error');toast(message);
  }finally{
    fileOpenChecking=false;
    if(retry||fileOpenNotified)scheduleFileOpen(retryDelay);
    if(pendingDevelopmentReload&&!documentActionBusy&&!closingApplication){pendingDevelopmentReload=false;setTimeout(()=>runAction('dev-reload'),0);}
  }
}
async function exportDrawing() {
  const text=editor.exportDXF();
  for(const warning of editor.getExportWarnings?.()||[])addLog(`DXF output: ${warning}`,'notice');
  if(desktop){const images=editor.getDXFImageAssets?.()||[],result=images.length?await desktop.exportDXF(text,{images}):await desktop.exportDXF(text);if(result?.canceled)return false;if(!result?.ok){addLog(result?.error||'DXF export failed.','error');toast(result?.error||'DXF export failed.');return false;}toast(images.length?'DXF and image sidecars exported.':'DXF exported.');return true;}
  download(text,`${safeName()}.dxf`,'application/dxf');toast('DXF exported to your downloads.');return true;
}
async function runAction(action) {
  closeCanvasMenu(false);hideToolHelp();
  flushViewportNavigation();
  if(documentActionBusy){if(action==='dev-reload')pendingDevelopmentReload=true;return false;}
  if(ordinaryGripStage&&!(document.activeElement===input&&input.value&&['copy','cut','paste','undo','redo'].includes(action)))discardOrdinaryGripStage('Grip preview canceled before the drawing action.');
  const roofTextAction=drag?.mode==='roof-component-grip'&&document.activeElement===input&&input.value&&['copy','cut','paste','undo','redo'].includes(action);
  if(!roofTextAction&&discardRoofGripDraft())draw();
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
    if(action==='close'&&desktop){if(!await canDiscard())return false;if(developmentMode){const result=await desktop.resetDocumentPath();if(!result?.ok){addLog(result?.error||'The drawing could not be reset.','error');toast(result?.error||'The drawing could not be reset.');return false;}consumeDevelopmentBinding(result);}clearDevelopmentCheckpoint();closingApplication=true;await desktop.allowClose();return true;}
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
function commandPreviewEntities(){
  if(renderContext&&!renderContext.includeEdits||orbitMode||drag?.mode==='orbit'||drag?.mode==='trim-gesture')return[];
  if(trimInteraction()?.target&&rawPointer&&editor.previewObject){if(trimPerspectiveUnsupported())return[];syncTrimProjectionView();const id=objectAtScreen(rawPointer,visibleEntities()),point=trimScreenPoint(rawPointer);return id&&point?editor.previewObject(id,point,{extend:trimPointerExtend}):[];}
  if(pointerScalar!==null&&state().commandPhase==='height')return editor.previewScalar(pointerScalar);
  if(modelWorkspace()&&rawPointer&&state().commandData?.targetKind==='object'&&editor.previewObject){const picked=projectedPick(rawPointer,visibleEntities());return picked?editor.previewObject(picked.entityId,picked.point):[];}
  return pointer?editor.previewCommand(pointer):[];
}
function drawModel(){
  const entities=sceneForOrbit(),preview=renderContext&&!renderContext.includeEdits?null:gripPreview(),roofDraft=currentRoofDragPreview(),items=[],roofLines=[],camera=camera3D(),light={x:.3,y:-.4,z:.8660254037844386};
  const addEntity=(entity,ghost=false,draftRoof=false)=>{const selected=state().selectionIds.includes(entity.id),ink=ghost?'#eab47b':selected?'#79b9ff':inkFor(entity),opacity=ghost ? draftRoof ? roofDraft.isCurrent ? .75 : .5 : .55 : roofDraft&&architectureOwner(entity)?.kind==='roofGroup'&&architectureOwner(entity)?.id===roofDraft.request.roofGroupId ? .16 : preview?.id===entity.id ? .3 : 1,roofEdges=draftRoof?roofDraft.data.edges.filter(edge=>edge.entityId===entity.id):roofDisplayEdges(entity,state().architecture,state().architectureDerived);
    if(entity.type==='MESH'&&camera.renderMode==='shaded'){for(const triangle of roofEdges===null?view3d.meshShadedTriangles(entity):view3d.meshTriangles(entity)){const points=triangle.points.map(toScreen);if(points.some(p=>p.clipped||!finiteScreenPoint(p)))continue;const normal=roofEdges===null?triangle.normal:view3d.triangleNormal(...triangle.points),intensity=normal?Math.abs(view3d.dot3(normal,light)):.5;items.push({depth:points.reduce((s,p)=>s+p.depth,0)/3,draw:()=>{ctx.save();ctx.globalAlpha=opacity;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle=shadeInk(ink,.18+intensity*.34);ctx.fill();
      // Match internal coplanar edges to their surface; keep real outlines separate.
      if(roofEdges===null&&opacity===1&&triangle.outlineEdges.some(edge=>!edge)){
        ctx.save();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.7;ctx.lineCap='butt';ctx.setLineDash([]);ctx.beginPath();
        for(let i=0;i<3;i++)if(!triangle.outlineEdges[i]){const a=points[i],b=points[(i+1)%3];ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
        ctx.stroke();ctx.restore();
      }
      if(roofEdges===null&&triangle.outlineEdges.some(Boolean)){ctx.strokeStyle=shadeInk(ink,.36+intensity*.3);ctx.lineWidth=ghost?1.5:.7;ctx.setLineDash(ghost?[4,3]:[]);ctx.beginPath();for(let i=0;i<3;i++)if(triangle.outlineEdges[i]){const a=points[i],b=points[(i+1)%3];ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();}ctx.restore();}});}if(roofEdges!==null)for(const edge of roofEdges)roofLines.push({edge,entity,ink,opacity,ghost});}
    else if(entity.type==='MESH'){const points=entity.vertices.map(toScreen).filter(finiteScreenPoint),edges=draftRoof?roofEdges.map(edge=>[edge.a,edge.b]):projectionEdges(entity);items.push({depth:points.reduce((s,p)=>s+p.depth,0)/Math.max(1,points.length),draw:()=>{for(const[a,b]of edges)strokeEntity({type:'LINE',start:a,end:b,layer:entity.layer,lineweight:entity.lineweight,linetype:entity.linetype},{color:ink,opacity,dash:ghost?[4,3]:[]});}});}
    else{const points=geometry.entityPoints(entity,drawingContext()).map(toScreen).filter(finiteScreenPoint);items.push({depth:points.reduce((s,p)=>s+p.depth,0)/Math.max(1,points.length),draw:()=>strokeEntity(entity,{color:ink,opacity,dash:ghost?[4,3]:[]})});}
  };
  entities.forEach(e=>addEntity(e));if(preview)addEntity(preview,true);
  if(roofDraft)roofDragPreviewEntities(roofDraft).forEach(entity=>addEntity(entity,true,true));
  let commandPreview=[];try{commandPreview=commandPreviewEntities();}catch{}commandPreview.forEach(e=>addEntity(e,true));
  if((!renderContext||renderContext.includeEdits)&&!orbitMode&&drag?.mode!=='orbit'){
    if(pointer&&state().command==='3DPOLY'&&state().commandPoints?.length)addEntity({type:'POLY3D',points:[...state().commandPoints,pointer],closed:false,layer:state().currentLayer},true);
    if(pointer&&state().command==='LINE'&&state().commandPoints?.length)addEntity({type:'LINE',start:state().commandPoints.at(-1),end:pointer,layer:state().currentLayer},true);
    if(pointer&&state().command==='RECTANG'&&!state().commandData?.spatial&&state().commandPoints?.length){const a=state().commandPoints[0];addEntity({type:'RECTANG',points:[a,{x:pointer.x,y:a.y},pointer,{x:a.x,y:pointer.y}],layer:state().currentLayer},true);}
  }
  items.sort((a,b)=>a.depth-b.depth).forEach(item=>item.draw());
  for(const{edge,entity,ink,opacity,ghost}of roofLines)strokeEntity({type:'LINE',start:edge.a,end:edge.b,layer:entity.layer,lineweight:entity.lineweight,linetype:entity.linetype},{color:ink,opacity,dash:ghost?[4,3]:[]});
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
  const segments=['DIMENSION','LEADER'].includes(entity.type)?primitive.segments||[]:primitive.decorationSegments||[];
  for(const [index,[a,b]]of segments.entries()){if(primitive.tickSegmentIndices?.includes(index))continue;const start=toScreen(a),end=toScreen(b);if(!finiteScreenPoint(start)||!finiteScreenPoint(end))continue;ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();}
  ctx.setLineDash([]);for(const triangle of primitive.arrows||[]){const screen=triangle.map(toScreen);if(!screen.every(finiteScreenPoint))continue;ctx.beginPath();ctx.moveTo(screen[0].x,screen[0].y);screen.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));ctx.closePath();ctx.fill();}
  for(const line of primitive.texts){
    const origin=toScreen(line.position),scale=modelWorkspace()?(camera3D().projection==='perspective'?view3d.focalPixels(camera3D(),height)/origin.viewDistance:camera3D().scale):viewScale(),fontSize=Number.isFinite(line.fontCapRatio)&&line.fontCapRatio>0?line.height*scale/line.fontCapRatio:fontSizeForHeight(line.height*scale,line.fontFamily),targetWidth=line.width*scale;
    if(!finiteScreenPoint(origin)||!Number.isFinite(fontSize)||fontSize<.5||fontSize>100000||!Number.isFinite(targetWidth)||targetWidth<=0)continue;
    const bounds=primitive.boundsPoints.map(toScreen).filter(finiteScreenPoint);if(bounds.length&&(bounds.every(point=>point.x<0)||bounds.every(point=>point.x>width)||bounds.every(point=>point.y<0)||bounds.every(point=>point.y>height)))continue;
    ctx.save();ctx.translate(origin.x,origin.y);
    if(modelWorkspace()){const angle=(line.rotation%360)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),basis=view3d.cameraBasis(camera3D()),along={x:c,y:s,z:0},down={x:s,y:-c,z:0};ctx.transform(view3d.dot3(along,basis.right),-view3d.dot3(along,basis.up),view3d.dot3(down,basis.right),-view3d.dot3(down,basis.up),0,0);}else ctx.rotate(-(line.rotation%360)*Math.PI/180);
    if(line.metricStatus==='registered')ctx.fontKerning='none';ctx.font=`${line.fontStyle==='italic'?'italic ':''}${line.fontWeight==='bold'||Number(line.fontWeight)>=600?'bold ':''}${fontSize}px "${line.fontFamily}"`;ctx.textBaseline='alphabetic';ctx.textAlign=line.align==='center'?'center':'left';
    const rendered=line.renderText??line.text,measured=ctx.measureText(rendered).width;if(measured>0&&Number.isFinite(measured)){ctx.scale(targetWidth/measured,1);ctx.fillText(rendered,0,0);}ctx.restore();
  }
  if(grips){ctx.globalAlpha=1;const corners=primitive.boundsPoints.map(toScreen).filter(finiteScreenPoint);if(['TEXT','MTEXT'].includes(entity.type)&&corners.length===4){ctx.strokeStyle='#6a9aba';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);corners.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);}for(const point of pointsOf(entity).map(toScreen).filter(point=>finiteScreenPoint(point)&&point.x>=-8&&point.x<=width+8&&point.y>=-8&&point.y<=height+8)){ctx.fillStyle='#5d9be6';ctx.strokeStyle='#a9d2ff';ctx.fillRect(point.x-3.5,point.y-3.5,7,7);ctx.strokeRect(point.x-3.5,point.y-3.5,7,7);}}
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
const rasterImages=new Map();
async function resolveDrawingImage(resourceId){
  if(documentActionBusy||state().command||!desktop?.chooseImageResource)return;
  const owner=editor,before=owner.serialize();syncDesktop();setDocumentBusy(true);
  try{const result=await desktop.chooseImageResource({resourceId});if(result?.canceled)return;if(!result?.ok)throw Error(result?.error||'The image could not be resolved.');if(editor!==owner||owner.serialize()!==before)throw Error('The drawing changed while choosing an image. Resolve it again against the current drawing.');const{id,name,...patch}=result.resource;if(id!==resourceId)throw Error('The selected image resource no longer matches.');resultLog(owner.updateImageResource(resourceId,patch));}
  catch(error){addLog(error.message||'Image resolution failed.','error');toast(error.message||'Image resolution failed.');}
  finally{setDocumentBusy(false);update();finishDialogReload();}
}
function drawRasterImage(entity,{color,dash=[],opacity=1,grips=false}={}){
  const resource=state().imageResources?.find(row=>row.id===entity.resourceId),p=entity.position,u=entity.uVector,v=entity.vVector;
  if(!p||!u||!v)return;
  const origin=toScreen(p),along=toScreen({x:p.x+u.x,y:p.y+u.y}),up=toScreen({x:p.x+v.x,y:p.y+v.y}),corner=toScreen({x:p.x+u.x+v.x,y:p.y+u.y+v.y});
  if(![origin,along,up,corner].every(point=>finiteScreenPoint(point)&&!point.clipped))return;
  let image=resource?.dataURL&&rasterImages.get(resource.dataURL);
  if(resource?.dataURL&&/^data:image\/(?:png|jpeg);base64,/i.test(resource.dataURL)&&!image){image=new Image();rasterImages.set(resource.dataURL,image);image.onload=()=>draw();image.onerror=()=>{image.linecraftError=true;draw();};image.src=resource.dataURL;while(rasterImages.size>32)rasterImages.delete(rasterImages.keys().next().value);}
  ctx.save();ctx.globalAlpha=opacity;
  if(image?.complete&&image.naturalWidth>0){ctx.transform((along.x-origin.x)/resource.width,(along.y-origin.y)/resource.width,(origin.x-up.x)/resource.height,(origin.y-up.y)/resource.height,up.x,up.y);ctx.drawImage(image,0,0,resource.width,resource.height);}
  else{ctx.strokeStyle='#d8a26d';ctx.lineWidth=1.2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(along.x,along.y);ctx.lineTo(corner.x,corner.y);ctx.lineTo(up.x,up.y);ctx.closePath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(corner.x,corner.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d8a26d';ctx.font='11px sans-serif';ctx.fillText(resource?.dataURL&&!image?.linecraftError?'Loading image…':'Unresolved image · '+(resource?.name||entity.resourceId),Math.min(origin.x,up.x)+4,Math.min(origin.y,up.y)+14);}
  ctx.restore();if([1,2].includes(state().rasterSettings?.frame)){ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=inkFor(entity,color);ctx.lineWidth=Math.max(1.25,Math.min(8,(entity.lineweight??layerFor(entity)?.lineweight??.25)*4));ctx.setLineDash(entityDash(entity,dash));ctx.beginPath();ctx.moveTo(origin.x,origin.y);for(const point of[along,corner,up])ctx.lineTo(point.x,point.y);ctx.closePath();ctx.stroke();ctx.restore();}if(grips){ctx.save();ctx.fillStyle='#5d9be6';ctx.strokeStyle='#a9d2ff';for(const point of[origin,along,corner,up]){ctx.fillRect(point.x-3.5,point.y-3.5,7,7);ctx.strokeRect(point.x-3.5,point.y-3.5,7,7);}ctx.restore();}
}
function strokeEntity(entity, {color, dash=[], opacity=1, grips=false}={}) {
  if(architectureOwner(entity))grips=false;
  if(entity.type==='VIEWPORT'){drawViewportBorder(entity,{color,dash,opacity,grips});return;}
  if(entity.type==='IMAGE'){drawRasterImage(entity,{color,dash,opacity,grips});return;}
  if(entity.type==='INSERT'&&geometry.expandedInsertEntities){for(const child of displayInsertChildren(entity))strokeEntity(child,{color:color||(!entity.colorSource&&!child.colorSource?entity.color:undefined),dash,opacity});if(grips)drawShapePrimitives(entity,{},{color,dash,opacity,grips});return;}
  if(['ELLIPSE','SPLINE','HATCH'].includes(entity.type)&&geometry.entityDisplayPrimitives){drawShapePrimitives(entity,geometry.entityDisplayPrimitives(entity,drawingContext()),{color,dash,opacity,grips});return;}
  if(['TEXT','MTEXT','DIMENSION','LEADER'].includes(entity.type)){drawAnnotation(entity,{color,dash,opacity,grips});return;}
  if(entity.type==='MESH'||spatialCurve(entity)||modelWorkspace()&&['CIRCLE','ARC'].includes(entity.type)){for(const[a,b]of projectionEdges(entity))strokeEntity({type:'LINE',start:a,end:b,layer:entity.layer,color:entity.color,...(entity.colorSource?{colorSource:entity.colorSource}:{}),lineweight:entity.lineweight,linetype:entity.linetype},{color,dash,opacity});if(grips)for(const point of pointsOf(entity).map(toScreen).filter(finiteScreenPoint)){ctx.fillStyle='#5d9be6';ctx.fillRect(point.x-3.5,point.y-3.5,7,7);}return;}
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
  if(ordinaryGripStage)return ordinaryGripStage.preview;
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
function drawActiveGeometry(includeEdits=true){const preview=includeEdits?gripPreview():null;for(const entity of visibleEntities()){const selected=includeEdits&&state().selectionIds.includes(entity.id);strokeEntity(entity,{color:selected?'#79b9ff':undefined,opacity:preview?.id===entity.id ? .35 : 1,grips:selected&&preview?.id!==entity.id});}if(preview&&preview.type!=='VIEWPORT')strokeEntity(preview,{color:'#79b9ff',dash:[5,4],grips:true});if(!includeEdits)return;for(const object of moveSelectionPreview().filter(object=>object.type!=='VIEWPORT'))strokeEntity(object,{color:'#79b9ff',dash:[5,4]});const anchor=state().commandPoints?.at(-1);if(pointer&&anchor&&state().command==='LINE')strokeEntity({type:'LINE',start:anchor,end:pointer,layer:state().currentLayer},{color:'#c28d4f',dash:[5,4]});if(pointer&&anchor&&state().command==='RECTANG'&&!state().commandData?.spatial)strokeEntity({type:'RECTANG',points:[anchor,{x:pointer.x,y:anchor.y},pointer,{x:anchor.x,y:pointer.y}],layer:state().currentLayer},{color:'#c28d4f',dash:[5,4]});if(pointer&&(!['LINE','RECTANG'].includes(state().command)||state().commandData?.spatial))for(const entity of commandPreviewEntities()||[])if(entity.type!=='VIEWPORT')strokeEntity(entity,{color:'#c28d4f',dash:[5,4]});}
function drawPaper(){
  const layout=currentLayout(),paper=layout.paper,a=physicalPaperToScreen({x:0,y:paper.heightMm}),b=physicalPaperToScreen({x:paper.widthMm,y:0});ctx.save();ctx.shadowColor='#0008';ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle='#fafbf9';ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();ctx.save();ctx.strokeStyle='#abb8b9';ctx.lineWidth=1;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeStyle='#d4dddd';ctx.setLineDash([4,4]);const margins=layout.plotSettings?.marginsMm||{left:10,bottom:10,right:10,top:10},s=paperView().scale;ctx.strokeRect(a.x+margins.left*s,a.y+margins.top*s,b.x-a.x-(margins.left+margins.right)*s,b.y-a.y-(margins.top+margins.bottom)*s);ctx.restore();
  const previews=paperSpace()?[gripPreview(),...moveSelectionPreview(),...(pointer?commandPreviewEntities()||[]:[])].filter(object=>object?.type==='VIEWPORT'):[],previewIDs=new Set(previews.map(object=>object.viewportId));
  const drawModelInViewport=(viewport,opacity=1)=>{ctx.save();ctx.globalAlpha=opacity;tracePaperBoundary(viewportBoundary(viewport));ctx.clip();renderContext={space:'model',layoutId:layout.id,viewportId:viewport.viewportId||viewport.id,viewport,entities:modelEntities(),includeEdits:state().activeViewportId===(viewport.viewportId||viewport.id)};try{if(modelWorkspace())drawModel();else drawActiveGeometry(renderContext.includeEdits);}finally{renderContext=null;ctx.restore();}};
  for(const originalViewport of layout.viewports){const viewport=viewportNavigationDraft?.id===originalViewport.id?viewportNavigationDraft:originalViewport;drawModelInViewport(viewport,previewIDs.has(viewport.id)? .35 : 1);}for(const preview of previews)drawModelInViewport(preview,.65);
  renderContext={space:'paper',layoutId:layout.id,viewportId:null,entities:editor.getPaperEntities(layout.id),includeEdits:paperSpace()};try{drawActiveGeometry(paperSpace());}finally{renderContext=null;}
  for(const viewport of layout.viewports){if(!geometry.isEntityVisible({layer:viewport.layer||'0',layoutId:layout.id},state(),{space:'paper',layoutId:layout.id,viewportId:null}))continue;const object=viewportObject(viewport)||viewport,selected=paperSpace()&&state().selectionIds.includes(object.id),active=state().activeViewportId===viewport.id;drawViewportBorder(object,{color:active?'#388569':selected?'#377abb':undefined,opacity:previewIDs.has(viewport.id)? .35 : 1,grips:selected&&!previewIDs.has(viewport.id)});}for(const preview of previews)drawViewportBorder(preview,{color:'#417d9b',dash:[5,3],grips:drag?.mode==='grip'});
  if(state().command==='MVIEW'&&state().commandPoints?.[0]&&pointer&&!previews.length){const anchors=state().commandPoints,points=state().commandPhase==='viewport-polygon'?[...anchors,pointer]:framePoints({x:Math.min(anchors[0].x,pointer.x),y:Math.min(anchors[0].y,pointer.y),width:Math.abs(anchors[0].x-pointer.x),height:Math.abs(anchors[0].y-pointer.y)});ctx.save();ctx.strokeStyle='#417d9b';ctx.setLineDash([5,3]);tracePaperBoundary(points);ctx.stroke();ctx.restore();}
}
function draw() {
  syncStructuralBridge();
  if(canvasMenu&&!canvasMenuCurrent())closeCanvasMenu(false);
  if(drag?.mode==='roof-component-grip'&&drag.preview&&!roofPreviewIdentityCurrent(drag,drag.preview))clearRoofDragPreview();
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
  if(pointer&&editor.previewCommand&&!['LINE','RECTANG'].includes(state().command)){let entities=[];try{entities=commandPreviewEntities()||[];}catch{}for(const entity of entities)strokeEntity(entity,{color:'#eab47b',dash:[5,4]});}
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
  if(drag?.mode==='trim-gesture'&&drag.moved){ctx.save();ctx.strokeStyle=drag.extend?'#e6b77f':'#8bdbb3';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.beginPath();drag.points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.stroke();ctx.restore();}
  if (rawPointer && drag?.mode !== 'pan') {
    const p=pointer ? toScreen(pointer) : rawPointer;
    ctx.strokeStyle=state().command?'#a9c0ca':'#6f94a6';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(p.x-18,p.y+.5);ctx.lineTo(p.x-5,p.y+.5);ctx.moveTo(p.x+5,p.y+.5);ctx.lineTo(p.x+18,p.y+.5);ctx.moveTo(p.x+.5,p.y-18);ctx.lineTo(p.x+.5,p.y-5);ctx.moveTo(p.x+.5,p.y+5);ctx.lineTo(p.x+.5,p.y+18);ctx.stroke();
    if (!state().command) ctx.strokeRect(p.x-3.5,p.y-3.5,7,7);
  }
  if (snap&&(snapEnabled||commandPointPrompt()&&onePointSnap?.mode&&onePointSnap.mode!=='none')) {
    ctx.save();if(drag?.mode==='roof-component-grip'&&currentViewport()){tracePaperBoundary(viewportBoundary(currentViewport()));ctx.clip();}
    const p=toScreen(snap.point);ctx.strokeStyle='#8ce4ab';ctx.lineWidth=1.5;
    if(drag?.mode==='roof-component-grip'&&snap.projected&&snap.sourcePoint){const source=toScreen(snap.sourcePoint);if(finiteScreenPoint(source)&&!source.clipped){ctx.save();ctx.strokeStyle='#8ce4ab99';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(source.x,source.y,4,0,Math.PI*2);ctx.stroke();ctx.restore();}}
    if(snap.type.toLowerCase().includes('mid')) {ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y+5);ctx.lineTo(p.x-6,p.y+5);ctx.closePath();ctx.stroke();}
    else if(snap.type.toLowerCase().includes('center')){ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();}
    else if(snap.type.toLowerCase().includes('quad')){ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y);ctx.lineTo(p.x,p.y+6);ctx.lineTo(p.x-6,p.y);ctx.closePath();ctx.stroke();}
    else if(snap.type==='perpendicular'){ctx.beginPath();ctx.moveTo(p.x-6,p.y-7);ctx.lineTo(p.x-6,p.y+6);ctx.lineTo(p.x+7,p.y+6);ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x,p.y+6);ctx.stroke();}
    else ctx.strokeRect(p.x-5,p.y-5,10,10);
    ctx.restore();
  }
  drawSubobjectSelection();
  drawRoofComponentSelection();
  drawAcquiredGrip();
  drawArchitectureDrainageHighlight();
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
  box.append(propertyRow('Object',selected.length===1?({RECTANG:'Rectangle',CIRCLE:'Circle',ARC:'Arc',LINE:'Line',PLINE:'Polyline',TEXT:'Text',MTEXT:'Multiline text',DIMENSION:'Dimension',LEADER:'Leader',IMAGE:'Raster image',MESH:'3D mesh',POLY3D:'3D polyline'}[selected[0].type]||selected[0].type):'Multiple objects'));
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
  const selectedColorSource=selected[0].color!==undefined?selected[0].colorSource:layerFor(selected[0])?.colorSource;if(selectedColorSource)box.append(propertyRow('Color behavior',selectedColorSource==='aci-7'?'ACI 7 · black on paper, white on dark model':'Explicit RGB · literal color'));
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
      if(geometry.textLayout){const layout=geometry.textLayout(entity,drawingContext());box.append(propertyRow('Lines / text runs',layout.lines.length),propertyRow('Layout width',lengthFormat(layout.width)),propertyRow('Layout height',lengthFormat(layout.height)));if(entity.richText)box.append(propertyRow('Formatting source','Native MTEXT controls retained'),propertyRow('Attachment',String(entity.richText.attachment)),propertyRow('Line spacing',`${entity.richText.lineSpacingStyle} / ${entity.richText.lineSpacingFactor}`));const fonts=[...new Set(layout.lines.map(line=>line.fontFamily))];box.append(propertyRow('Rendered font families',fonts.join(', ')));if(layout.warnings?.length)box.append(propertyRow('Layout diagnostics',layout.warnings.join('; ')));}
    }else if(entity.type==='IMAGE'){
      const resource=state().imageResources?.find(item=>item.id===entity.resourceId),uLength=Math.hypot(entity.uVector.x,entity.uVector.y),vLength=Math.hypot(entity.vVector.x,entity.vVector.y),rotation=Math.atan2(entity.uVector.y,entity.uVector.x)*180/Math.PI;
      box.append(propertyRow('Image resource',resource?.name||entity.resourceId),propertyRow('Image pixels',resource?`${resource.width} × ${resource.height}`:'Unresolved'),propertyRow('Image data',resource?.dataURL?'Embedded in drawing':'Unresolved — resolve source image before plotting'),propertyRow('Resource SHA-256',resource?.sha256||'Not recorded'));
      if(editor.updateRasterSettings){const row=propertyRow('Image frame · drawing-wide',''),frame=document.createElement('select');frame.setAttribute('aria-label','Drawing image frame');frame.title='Drawing-wide IMAGEFRAME setting. 0 hides frames; 1 displays and plots frames; 2 displays frames without plotting. Image pixels and placement are preserved.';for(const[value,label]of [[0,'0 · Hidden'],[1,'1 · Display and plot'],[2,'2 · Display only']]){const option=document.createElement('option');option.value=String(value);option.textContent=label;frame.append(option);}frame.value=String(state().rasterSettings?.frame??0);frame.addEventListener('change',()=>resultLog(editor.updateRasterSettings({frame:Number(frame.value)})));row.lastElementChild.replaceWith(frame);box.append(row);}
      if(desktop?.chooseImageResource){const resolve=document.createElement('button');resolve.type='button';resolve.className='property-button';resolve.textContent=resource?.dataURL?'Replace image…':'Resolve image…';resolve.setAttribute('aria-label','Resolve drawing image');resolve.title='Choose a local PNG or JPEG for this resource. Physical placement is retained; accepting the image is one drawing edit with Undo.';resolve.addEventListener('click',()=>void resolveDrawingImage(entity.resourceId));box.append(resolve);}
      pointProperties(box,'Image insertion',entity.position,position=>editor.setImageProperties(entity.id,{position}));
      box.append(numberProperty('Image width',uLength,'Image physical width',value=>editor.setImageProperties(entity.id,{uVector:{x:entity.uVector.x*value/uLength,y:entity.uVector.y*value/uLength}}),{min:0,kind:'length'}),numberProperty('Image height',vLength,'Image physical height',value=>editor.setImageProperties(entity.id,{vVector:{x:entity.vVector.x*value/vLength,y:entity.vVector.y*value/vLength}}),{min:0,kind:'length'}),numberProperty('Image rotation',rotation,'Image rotation',value=>{const radians=(value-rotation)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),rotate=p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c});return editor.setImageProperties(entity.id,{uVector:rotate(entity.uVector),vVector:rotate(entity.vVector)});},{kind:'angle'}));
      box.append(propertyRow('Affine U vector',`${lengthFormat(entity.uVector.x)}, ${lengthFormat(entity.uVector.y)}`),propertyRow('Affine V vector',`${lengthFormat(entity.vVector.x)}, ${lengthFormat(entity.vVector.y)}`));
    }else if(entity.type==='LEADER'){
      const edit=document.createElement('button');edit.className='property-button';edit.textContent='Edit leader text';edit.setAttribute('aria-label','Edit leader content');edit.addEventListener('click',()=>openAnnotationEditor(entity.id));box.append(propertyRow('Content',entity.text),edit);
      box.append(styleProperty('Text style',(state().textStyles||[]).map(style=>style.name),entity.style,'Leader text style',style=>editor.setLeaderProperties(entity.id,{style})),numberProperty('Text height',entity.height,'Leader text height',height=>editor.setLeaderProperties(entity.id,{height}),{min:0,kind:'length'}),numberProperty('Arrow / tick size',entity.arrowSize,'Leader arrow size',arrowSize=>editor.setLeaderProperties(entity.id,{arrowSize}),{min:0,kind:'length'}),styleProperty('Arrow / tick',['closed-filled','architectural-tick'],entity.arrowType||'closed-filled','Leader arrow type',arrowType=>editor.setLeaderProperties(entity.id,{arrowType})));
      const row=propertyRow('Edit vertex',''),choose=document.createElement('select');choose.id='leader-vertex';choose.setAttribute('aria-label','Leader vertex');entity.points.forEach((point,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=index===0?'Arrow tip':index===entity.points.length-1?'Text landing':'Vertex '+(index+1);choose.append(option);});const selectedIndex=Math.min(gripPropertyIndices.get(entity.id)||0,entity.points.length-1);choose.value=String(selectedIndex);choose.addEventListener('change',()=>{gripPropertyIndices.set(entity.id,Number(choose.value));renderProperties();draw();});row.lastElementChild.replaceWith(choose);box.append(row);pointProperties(box,'Leader vertex',entity.points[selectedIndex],point=>editor.moveGrip(entity.id,selectedIndex,point));
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
    const select=(label,values,value,apply)=>{const field=document.createElement('select');field.setAttribute('aria-label',`${label} ${layer.name}`);for(const entry of values){const option=document.createElement('option');option.value=entry;option.textContent=label==='Layer lineweight'?`${entry} mm`:entry;field.append(option);}if(label==='Layer lineweight'&&!values.includes(value)){const current=document.createElement('option');current.value=String(value);current.textContent=`${String(value)} mm (current)`;current.disabled=true;field.prepend(current);}field.value=value;field.addEventListener('change',()=>layerManagerApply(()=>apply(field.value)));cell(field);};
    select('Layer lineweight',[0,.13,.18,.25,.35,.5,.7,1],layer.lineweight,value=>editor.updateLayer(layer.name,{lineweight:Number(value)}));select('Layer linetype',geometry.LINETYPES||['continuous','dashed','hidden','center'],layer.linetype||'continuous',linetype=>editor.updateLayer(layer.name,{linetype}));
    check('Layer visible in model',layer.modelVisible!==false,value=>editor.updateLayer(layer.name,{modelVisible:value}));check('Layer visible on paper',layer.paperVisible!==false,value=>editor.updateLayer(layer.name,{paperVisible:value}));
    check('Layer plot',layer.plot!==false,value=>editor.updateLayer(layer.name,{plot:value}));
    check('Viewport freeze',Boolean(viewport?.frozenLayers?.includes(layer.name)),value=>editor.freezeViewportLayer(layout.id,viewport.id,layer.name,value),!viewport||!editor.freezeViewportLayer);
    const remove=document.createElement('button');remove.textContent='Delete';remove.disabled=layer.name==='0';remove.setAttribute('aria-label',`Delete layer ${layer.name}`);remove.addEventListener('click',()=>layerManagerApply(()=>editor.deleteLayer(layer.name)));cell(remove);body.append(row);
  }
}
function showLayerManager(){if(documentActionBusy)return;discardRoofGripDraft();flushViewportNavigation();closePalettes();hideCompletion();if(state().command)editor.cancel();$('layer-manager-error').textContent='';$('layer-manager-dialog').showModal();renderLayerManager();}
function closeLayerManager(){$('layer-manager-dialog').close();finishDialogReload();canvas.focus();}
function entityDash(entity,dash=[]){if(dash.length)return dash;const type=String(entity.linetype&&entity.linetype!=='BYLAYER'?entity.linetype:layerFor(entity)?.linetype).toUpperCase();return currentLayout()?(({DASHED:[4,2],CENTER:[8,2,1,2],HIDDEN:[2,1]})[type]||[]).map(value=>value*paperView().scale):({DASHED:[10,6],CENTER:[16,5,3,5],HIDDEN:[6,4]})[type]||[];}
function setPaperView(view){const result=editor.setPaperView?editor.setPaperView(view):{ok:true};if(!editor.setPaperView)state().paperViewport=view;return result;}
function fitPaper(){const layout=currentLayout();if(!layout)return;setPaperView({center:{x:layout.paper.widthMm/2,y:layout.paper.heightMm/2},scale:Math.max(1e-6,Math.min(1e6,Math.min(Math.max(10,width-100)/layout.paper.widthMm,Math.max(10,height-80)/layout.paper.heightMm)))});}
function enterSpace(space,layoutId=null,viewportId=null){if(documentActionBusy||!editor.setSpace)return;discardRoofGripDraft();clearRoofDragPreview();flushViewportNavigation();editor.cancel();orbitMode=null;orbitPivot=null;drag=null;pointer=null;rawPointer=null;snap=null;selectedSubobject=null;overlapCycle=null;selectedViewportId=viewportId;viewportNavigationDraft=null;const result=editor.setSpace(space,layoutId,viewportId);if(result?.ok===false){resultLog(result);return;}update();canvas.focus();}
function viewportBounds(viewport){const frame=viewport.frame,a=paperToScreen({x:frame.x,y:frame.y+frame.height}),b=paperToScreen({x:frame.x+frame.width,y:frame.y});return{left:a.x,top:a.y,width:b.x-a.x,height:b.y-a.y};}
function viewportBoundary(viewport){return geometry.viewportBoundaryPoints?geometry.viewportBoundaryPoints(viewport):viewport.boundary||framePoints(viewport.frame);}
function tracePaperBoundary(points){if(!points.length)return;const screen=points.map(paperToScreen);ctx.beginPath();ctx.moveTo(screen[0].x,screen[0].y);for(const point of screen.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();}
function viewportAt(screen,edgeOnly=false){const layout=currentLayout();if(!layout)return null;const point=screenToPaper(screen),tolerance=8/paperView().scale;return[...layout.viewports].reverse().find(viewport=>{if(!geometry.isEntityVisible({layoutId:layout.id,layer:viewport.layer||'0'},state(),{space:'paper',layoutId:layout.id,viewportId:null}))return false;const boundary=viewportBoundary(viewport),nearEdge=boundary.some((a,index)=>{const b=boundary[(index+1)%boundary.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)<=tolerance;});return edgeOnly?nearEdge:geometry.pointInViewport?geometry.pointInViewport(point,viewport):nearEdge||point.x>=viewport.frame.x&&point.x<=viewport.frame.x+viewport.frame.width&&point.y>=viewport.frame.y&&point.y<=viewport.frame.y+viewport.frame.height;})||null;}
function viewportObject(viewport){return editor.getPaperObjects?.(currentLayout()?.id).find(object=>object.type==='VIEWPORT'&&object.viewportId===viewport?.id)||null;}
function selectCreatedViewport(viewportId){selectedViewportId=viewportId||currentLayout()?.viewports.at(-1)?.id||null;const object=viewportObject(currentLayout()?.viewports.find(viewport=>viewport.id===selectedViewportId));if(object)editor.select([object.id]);}
function framePoints(frame){return[{x:frame.x,y:frame.y},{x:frame.x+frame.width,y:frame.y},{x:frame.x+frame.width,y:frame.y+frame.height},{x:frame.x,y:frame.y+frame.height}];}
function renderSpaceTabs(){
  const bar=$('layout-tabs');bar.replaceChildren();const add=(name,id)=>{const button=document.createElement('button');button.className='layout-tab';button.textContent=name;button.setAttribute('role','tab');button.setAttribute('aria-selected',String((state().activeLayoutId||null)===id));button.dataset.layout=id||'model';button.addEventListener('click',()=>enterSpace(id?'paper':'model',id));button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const tabs=[...bar.children],next=tabs[(tabs.indexOf(button)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next.click();next.focus();}});bar.append(button);};add('Model',null);for(const layout of state().layouts||[])add(layout.name,layout.id);
  const layout=currentLayout(),viewport=selectedViewport();$('page-setup-button').textContent=layout?'Page setup':'New layout';$('new-viewport-button').hidden=!layout;$('viewport-shape-control').hidden=!layout;$('viewport-lock-button').hidden=!viewport;$('viewport-scale-control').hidden=!viewport;$('viewport-view-control').hidden=!viewport;$('viewport-lock-button').textContent=viewport?.locked?'Viewport locked':'Viewport unlocked';$('viewport-lock-button').setAttribute('aria-pressed',String(Boolean(viewport?.locked)));$('viewport-lock-button').title=viewport?.locked?'Unlock to change viewport scale. Wheel and middle drag navigate the sheet while locked.':'Unlocked: wheel and middle drag change this model view. Lock after setting the scale.';if(viewport){populateViewportScalePicker($('viewport-scale'),viewport);populateViewportViewPicker($('viewport-view'),viewport);}
  $('space-mode-button').textContent=currentViewport()?'VIEWPORT MODEL':paperSpace()?'PAPER · mm':'MODEL';$('space-mode-button').title=currentViewport()?'Return to paper space':layout?'Enter selected viewport model space':'Standalone model space';
}
function showPageSetup(create=false){
  if(documentActionBusy||!editor.addLayout)return;
  discardRoofGripDraft();flushViewportNavigation();closePalettes();hideCompletion();editor.cancel();
  const layout=create?null:currentLayout(),paper=layout?.paper||{size:'A3',orientation:'landscape',widthMm:420,heightMm:297};pageSetupLayoutId=layout?.id||null;
  const sizes=geometry.PAPER_SIZES||{};fillOptions('layout-paper-size',[...Object.keys(sizes),'Custom'],paper.size);
  for(const option of $('layout-paper-size').options){const preset=sizes[option.value];option.textContent=preset?`${option.value} · ${preset.widthMm} × ${preset.heightMm} mm`:'Custom';}
  $('layout-name-input').value=layout?.name||`Layout ${(state().layouts?.length||0)+1}`;$('layout-orientation').value=paper.orientation;
  $('layout-paper-width').value=String(paper.widthMm);$('layout-paper-height').value=String(paper.heightMm);
  $('page-setup-title').textContent=layout?'Page setup':'Create paper layout';$('page-setup-error').textContent='';refreshPageSetup();$('page-setup-dialog').showModal();
}
function pageSetupPaper(){
  const paper={size:$('layout-paper-size').value,orientation:$('layout-orientation').value};
  if(paper.size==='Custom'){paper.widthMm=$('layout-paper-width').valueAsNumber;paper.heightMm=$('layout-paper-height').valueAsNumber;}
  return paper;
}
function refreshPageSetup(){
  const paper=pageSetupPaper(),custom=paper.size==='Custom';
  for(const id of ['layout-paper-width','layout-paper-height']){$(id).disabled=!custom;$(id).required=custom;}
  $('page-setup-error').textContent='';
  if(custom){
    const valid=[paper.widthMm,paper.heightMm].every(value=>Number.isFinite(value)&&value>=10&&value<=5000);
    $('layout-paper-preview').textContent=valid?`${String(paper.widthMm)} × ${String(paper.heightMm)} millimeters · Custom dimensions are literal; changing the orientation label does not swap them.`:'Enter finite Custom width and height between 10 and 5000 millimeters.';
    return;
  }
  const preset=geometry.PAPER_SIZES?.[paper.size];if(!preset){$('layout-paper-preview').textContent='Choose a supported paper size.';return;}
  const[w,h]=paper.orientation==='portrait'?[preset.widthMm,preset.heightMm]:[preset.heightMm,preset.widthMm];
  $('layout-paper-width').value=String(w);$('layout-paper-height').value=String(h);$('layout-paper-preview').textContent=`${w} × ${h} millimeters · paper coordinates stay independent of the model`;
}
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
  discardRoofGripDraft();
  flushViewportNavigation();const viewport=selectedViewport(),layout=currentLayout();if(!viewport||!layout)return;if(viewport.locked){toast('Unlock the viewport before changing its scale.');renderSpaceTabs();return;}viewportScaleTarget={layoutId:layout.id,viewportId:viewport.id};$('viewport-custom-scale').value=String(viewport.scaleDenominator);$('viewport-scale-context').textContent=`${layout.name} · ${currentViewport()?.id===viewport.id?'active model viewport':'selected viewport frame'} · unlocked`;$('viewport-scale-error').textContent='';refreshViewportScalePreview();renderSpaceTabs();$('viewport-scale-dialog').showModal();$('viewport-custom-scale').focus();$('viewport-custom-scale').select();
}
function refreshViewportScalePreview(){
  try{const value=geometry.parseViewportScale($('viewport-custom-scale').value),label=viewportScaleLabel(value);$('viewport-scale-preview').textContent=`${label}${label===`1:${String(value)}`?'':` · 1:${String(value)}`}\n${viewportScaleDescription(value)}`;$('viewport-scale-preview').dataset.valid='true';$('viewport-scale-error').textContent='';}
  catch(error){$('viewport-scale-preview').textContent=error.message||'Enter a viewport scale.';$('viewport-scale-preview').dataset.valid='false';}
}
function closeViewportScaleDialog(){$('viewport-scale-dialog').close();viewportScaleTarget=null;update();finishDialogReload();canvas.focus();}
function viewportScaleProperty(viewport){const row=propertyRow('Standard scale',''),select=document.createElement('select');select.id='viewport-properties-scale';select.setAttribute('aria-label','Viewport standard scale');populateViewportScalePicker(select,viewport);select.addEventListener('change',()=>viewportScaleChoice(select));row.classList.add('viewport-scale-property');row.lastElementChild.replaceWith(select);return row;}
const viewportViewPresets=['top','front','right','left','back','bottom','iso'];
function populateViewportViewPicker(select,viewport){
  const mode=viewport.workspace==='2d'?'top':viewport.camera3d.mode,preset=viewportViewPresets.includes(mode);let current=select.querySelector('[data-current-camera]');
  if(!current){current=document.createElement('option');current.disabled=true;current.dataset.currentCamera='true';select.prepend(current);}
  current.hidden=preset;current.value=preset?'current-camera':mode;current.textContent=({neiso:'NE isometric',seiso:'SE isometric',swiso:'SW isometric',nwiso:'NW isometric'})[mode]||'Custom view';
  select.value=mode;const camera=viewport.camera3d;select.title=viewport.workspace==='2d'?'Top view in 2D.':`${current.hidden?select.selectedOptions[0]?.textContent:current.textContent} · yaw ${String(camera.yaw)}°, pitch ${String(camera.pitch)}°, roll ${String(camera.roll)}°. Choose a preset to replace the current orientation.`;
}
function viewportViewProperty(viewport){const row=styleProperty('View',viewportViewPresets,'','Viewport orientation',setViewportView);populateViewportViewPicker(row.querySelector('select'),viewport);return row;}
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
  const identity=propertyRow('Viewport ID',viewport.id);identity.lastElementChild.id='viewport-properties-id';box.append(identity);
  box.append(styleProperty('Frame layer',state().layers.map(layer=>layer.name),viewport.layer||'0','Viewport frame layer',layer=>updateSelectedViewport({layer})));
  const colorRow=propertyRow('Frame color',''),color=document.createElement('input');color.type='color';color.value=viewport.color||layerFor(viewport)?.color||'#e5e7eb';color.setAttribute('aria-label','Viewport frame color');color.addEventListener('change',()=>resultLog(editor.setSelectionProperties({color:color.value})));const colorGroup=document.createElement('span'),byLayer=document.createElement('button');byLayer.textContent='By layer';byLayer.className='property-button';byLayer.setAttribute('aria-label','Viewport frame color by layer');byLayer.addEventListener('click',()=>resultLog(editor.setSelectionProperties({color:'BYLAYER'})));colorGroup.className='viewport-color-field';colorGroup.append(color,byLayer);colorRow.lastElementChild.replaceWith(colorGroup);box.append(colorRow);
  const lineweights=['BYLAYER',0,.13,.18,.25,.35,.5,.7,1],weight=styleProperty('Lineweight',lineweights,String(viewport.lineweight??'BYLAYER'),'Viewport frame lineweight',value=>editor.setSelectionProperties({lineweight:value==='BYLAYER'?'BYLAYER':Number(value)})),weightPicker=weight.querySelector('select');
  if(viewport.lineweight!==undefined&&!lineweights.includes(viewport.lineweight)){const current=document.createElement('option');current.value=String(viewport.lineweight);current.textContent=`${String(viewport.lineweight)} mm (current)`;current.disabled=true;weightPicker.prepend(current);weightPicker.value=String(viewport.lineweight);}
  weightPicker.title='Viewport frame lineweight in paper millimeters; By layer uses the frame layer.';box.append(weight,styleProperty('Linetype',['BYLAYER',...(geometry.LINETYPES||[])],viewport.linetype||'BYLAYER','Viewport frame linetype',linetype=>editor.setSelectionProperties({linetype})));
  for(const[key,label]of [['x','X'],['y','Y'],['width','Width'],['height','Height']])box.append(numberProperty(label,viewport.frame[key],`Viewport frame ${label}`,value=>updateSelectedViewport({frame:{...viewport.frame,[key]:value}}),{kind:'length',...(['width','height'].includes(key)?{min:0}:{})}));
  if(viewport.boundary&&object){const index=Math.min(gripPropertyIndices.get(object.id)||0,viewport.boundary.length-1);gripPropertyIndices.set(object.id,index);const row=propertyRow('Edit boundary',''),choose=document.createElement('select');choose.setAttribute('aria-label','Viewport boundary vertex');viewport.boundary.forEach((point,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Vertex ${i+1}`;choose.append(option);});choose.value=index;choose.addEventListener('change',()=>{gripPropertyIndices.set(object.id,Number(choose.value));renderProperties();draw();});row.lastElementChild.replaceWith(choose);box.append(row);pointProperties(box,'Viewport vertex',viewport.boundary[index],point=>editor.moveGrip(object.id,index,point));}
  const scaleField=numberProperty('Scale 1:',viewport.scaleDenominator,'Viewport scale denominator',scaleDenominator=>updateSelectedViewport({scaleDenominator}),{min:.000001});scaleField.querySelector('input').disabled=Boolean(viewport.locked);scaleField.querySelector('input').title=viewport.locked?'Unlock to change viewport scale.':`Exact physical scale denominator: ${String(viewport.scaleDenominator)}`;box.append(subheading('MODEL VIEW ON PAPER'),viewportScaleProperty(viewport),scaleField);
  const scaleNote=document.createElement('p');scaleNote.className='viewport-scale-note';scaleNote.textContent=`${viewport.locked?'Unlock the viewport to change its scale. ':''}${viewportScaleDescription(viewport.scaleDenominator)} Annotation styles are set separately.`;box.append(scaleNote);
  box.append(viewportViewProperty(viewport),styleProperty('Navigation',['Locked','Unlocked'],viewport.locked?'Locked':'Unlocked','Viewport navigation lock',value=>updateSelectedViewport({locked:value==='Locked'})),styleProperty('Print border',['No','Yes'],viewport.plotBorder?'Yes':'No','Plot viewport border',value=>updateSelectedViewport({plotBorder:value==='Yes'})));
  for(const axis of ['x','y','z'])box.append(numberProperty(`Model center ${axis.toUpperCase()}`,viewport.modelCenter[axis]||0,`Viewport model center ${axis.toUpperCase()}`,value=>updateSelectedViewport({modelCenter:{...viewport.modelCenter,[axis]:value}}),{kind:'length',prefs:state().settings}));
  const deleteRow=propertyRow('Frame',''),remove=document.createElement('button');remove.className='property-button';remove.textContent='Delete viewport';remove.setAttribute('aria-label','Delete selected viewport');remove.addEventListener('click',()=>resultLog(editor.deleteSelected()));deleteRow.lastElementChild.replaceWith(remove);box.append(deleteRow);
}
function fitModelViewport(viewport){if(viewport.locked){fitPaper();return;}const points=modelPoints(modelEntities());if(!points.length)return;const camera=viewport.workspace==='2d'?view3d.cameraPreset({...viewport.camera3d,target:{...viewport.modelCenter}},'top'):{...viewport.camera3d,target:{...viewport.modelCenter}},axes=view3d.cameraBasis(camera),bounds=view3d.bounds3D(points),center={x:bounds.min.x/2+bounds.max.x/2,y:bounds.min.y/2+bounds.max.y/2,z:bounds.min.z/2+bounds.max.z/2};let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const p of points){const delta={x:p.x-center.x,y:p.y-center.y,z:(p.z||0)-center.z},x=view3d.dot3(delta,axes.right),y=view3d.dot3(delta,axes.up);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}const factor=geometry.modelUnitMillimeters(state().settings),scaleDenominator=Math.max(1e-6,Math.min(1e9,Math.max((maxX-minX)*factor/viewport.frame.width,(maxY-minY)*factor/viewport.frame.height)*1.1));resultLog(editor.updateViewport(currentLayout().id,viewport.id,{modelCenter:center,scaleDenominator},{navigation:true}));}
function updateStatus() {
  const roofOperation=drag?.mode==='roof-component-grip'?drag:null,readoutPoint=roofOperation?roofOperation.targetLocal:ordinaryGripStage&&pointer&&!paperSpace()?geometry.worldToPlane({...pointer,z:pointer.z??0},ordinaryGripStage.inputPlane):modelWorkspace()&&pointer?geometry.worldToPlane(pointer,activePlane()):pointer;
  $('coordinate-readout').textContent=roofOperation?roofOperation.typedActive&&!roofOperation.valid?'Invalid building-local XY · bearing Z fixed':`Building X ${lengthFormat(readoutPoint?.x||0)}   Y ${lengthFormat(readoutPoint?.y||0)}   bearing Z ${lengthFormat(roofOperation.planeElevation)}`:modelWorkspace()&&pointerUnavailable&&!pointer?'Pointer unavailable · type UCS XYZ':`${modelWorkspace()||ordinaryGripStage&&!paperSpace()?'UCS ':''}X ${lengthFormat(readoutPoint?.x||0)}   Y ${lengthFormat(readoutPoint?.y||0)}${modelWorkspace()||readoutPoint?.z!==undefined?`   Z ${lengthFormat(readoutPoint?.z??0)}`:''}`;
  const prefs=draftingSettings(),unitLabel={unitless:'Unitless',mm:'mm',cm:'cm',m:'m',in:'in',ft:'ft'}[prefs.units]||'Units',formatLabel={decimal:'Decimal',architectural:'Architectural',engineering:'Engineering'}[prefs.linearFormat]||'Decimal';$('units-button').textContent=`${unitLabel} · ${formatLabel}`;$('units-button').title=`Drawing units: ${unitLabel}, ${formatLabel}; angles ${prefs.angularFormat||'decimal-degrees'}. Open UNITS to change this drawing.`;
  $('zoom-readout').textContent=currentLayout()?`${format(paperView().scale,3)} px/mm${currentViewport()?` · ${viewportScaleLabel(currentViewport().scaleDenominator)}`:''}`:modelWorkspace()?`${format(view3d.pixelScale(camera3D(),height),3)} px/unit at target`:`${format(state().viewport.scale,3)} px/unit`;
  $('zoom-readout').title=currentViewport()?`Actual viewport scale: ${viewportScaleLabel(currentViewport().scaleDenominator)} · exact denominator ${String(currentViewport().scaleDenominator)}. ${viewportScaleDescription(currentViewport().scaleDenominator)}`:modelWorkspace()?`${camera3D().projection}; yaw ${format(camera3D().yaw,2)}°, pitch ${format(camera3D().pitch,2)}°, roll ${format(camera3D().roll,2)}°; eye distance ${format(camera3D().distance)}`:'';
  for(const [id,enabled] of [['grid-toggle',gridEnabled],['snap-toggle',snapEnabled],['ortho-toggle',orthoEnabled]]){const button=$(id);button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled));}
  const tip=$('snap-indicator');tip.hidden=!snap||!state().command&&!roofOperation&&!ordinaryGripStage;
  if(snap&&(state().command||roofOperation||ordinaryGripStage)){const p=toScreen(snap.point);tip.style.left=`${Math.max(0,Math.min(p.x+15,width-220))}px`;tip.style.top=`${Math.max(0,Math.min(p.y+15,height-25))}px`;tip.textContent=roofOperation?`${snap.type}${snap.projected?' → footprint bearing plane (Z fixed)':' · footprint bearing plane'}`:snap.type;}
  else if(acquiredGrip&&gripAcquisitionEligible()){const p=toScreen(acquiredGrip.point);tip.hidden=false;tip.style.left=`${Math.max(0,Math.min(p.x+15,width-220))}px`;tip.style.top=`${Math.max(0,Math.min(p.y+15,height-25))}px`;tip.textContent='Grip · click to stretch';}
  updateRoofGripPrompt();
  if(ordinaryGripStage){$('command-prompt').textContent=currentPrompt();$('command-state').textContent='Grip stretch';input.placeholder='Destination X,Y / @offset · Escape cancels';$('canvas-note').textContent=ordinaryGripStage.error||'Grip preview only · release, then click a destination or enter coordinates · Escape cancels';}
}
function update() {
  syncOrdinaryGripStage();
  observePointSubmissions();syncPointOverride();
  syncGripAcquisition();
  syncRoofComponentSelection();
  syncArchitectureAlternatives();
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
  $('document-name').textContent=documentName;
  const dirtyMark=$('dirty-mark'),documentDirty=isDirty();
  dirtyMark.textContent=documentDirty?'•':'';dirtyMark.hidden=!documentDirty;
  if(documentDirty)dirtyMark.setAttribute('aria-label','Unsaved changes');else dirtyMark.removeAttribute('aria-label');
  $('undo-button').disabled=Boolean(orbitMode)||!editor.canUndo;$('redo-button').disabled=Boolean(orbitMode)||!editor.canRedo;$('delete-button').disabled=Boolean(orbitMode)||!state().selectionIds.length;
  $('entity-count').textContent=`${activeObjects().length} object${activeObjects().length===1?'':'s'}`;
  document.querySelectorAll('[data-tool]').forEach(button=>button.classList.toggle('active',button.dataset.tool===(state().command || (panTool?'PAN':'SELECT'))));
  canvas.style.cursor=panTool||orbitMode||['pan','orbit'].includes(drag?.mode)?'grabbing':'none';
  const notes={selection:'Select objects • Enter to continue',mode:'Enter Single or Multiple',angle:`Enter an angle (${state().settings?.angularInputUnit||'degrees'}) or click a direction`,distance:'Enter a positive offset distance',factor:'Enter a positive scale factor or pick a distance',object:state().command?.startsWith('DIM')?'Pick the circle to dimension':'Pick a source object • Enter to finish',position:'Pick or enter a text insertion point',height:'Enter text height • Enter uses the style default',rotation:'Enter text rotation • Enter uses the style default','first-corner':'Pick or enter the first text-box corner','second-corner':'Pick opposite corner • H to change text height','mtext-height':'Enter the multiline text height','origin-first':'Pick or enter the first dimension origin','origin-second':'Pick or enter the second dimension origin',placement:state().command==='DIMLINEAR'?'Place dimension • H / V chooses its axis':'Pick or enter the dimension placement','delete-choice':'Delete sources? Yes / No • Enter keeps them','clipboard-ready':'Writing drawing clipboard…','first-break':'Pick or enter the first break point','second-break':'Pick or enter the second break point','arc-first':'Pick or enter the arc start point','arc-second':'Pick or enter a point on the arc','arc-third':'Pick or enter the arc end point'};
  Object.assign(notes,{'join-selection':'Select connected additional paths • Enter joins them','axis-first':'Pick first axis endpoint • C chooses center construction','axis-second':'Pick the other first-axis endpoint','ellipse-center':'Pick the ellipse center','major-endpoint':'Pick the first-axis endpoint','minor-distance':'Enter a positive other-axis distance or pick a point','control-point':'Place control vertices • at least four • U removes the latest • Enter finishes',vertex:'Pick the angle vertex','ray-first':'Pick a point on the first angle ray','ray-second':'Pick a point on the second angle ray','window-first':'Pick the first corner of a planar crossing window','window-second':'Pick its opposite corner • enclosed vertices will stretch','block-base':'Pick the base used for block insertion',boundary:'Pick one closed boundary edge to capture the hatch region','first-line':'Pick the first LINE on the side to retain','second-line':'Pick the second LINE on the side to retain'});
  $('canvas-note').textContent=notes[phase]||(state().commandData?.targetKind==='object'?'Pick the line portion to edit • U to undo • Enter to finish':state().command?'Click a point or enter exact coordinates':state().selectionIds.length?'Click a blue grip, then choose its destination • Delete to erase':'Type a command or choose a drawing tool');
  if(phase==='viewport-polygon')$('canvas-note').textContent='Pick paper vertices • C closes the polygon • U removes a vertex';else if(phase==='viewport-object')$('canvas-note').textContent='Pick an edge of a closed paper polyline or rectangle';else if(!state().command&&paperSpace()&&selectionObjects().length===1&&selectedViewport())$('canvas-note').textContent=selectedViewport().boundary?'Click a vertex or edge grip, then place it • Double-click inside to edit model space':'Click a corner or edge grip, then place it • Double-click inside to edit model space';else if(!state().command&&currentViewport())$('canvas-note').textContent=currentViewport().locked?'Locked view: wheel and middle drag navigate the sheet • Double-click outside returns to paper':'Wheel zooms at the cursor • Middle drag pans this view • Double-click outside returns to paper';
  if(state().commandData?.targetKind==='none'&&phase!=='selection')$('canvas-note').textContent='Enter the requested value or option in the command line';
  if(phase==='zoom-option')$('canvas-note').textContent='E fits the view • factorXP sets an unlocked viewport • XP uses paper mm per model unit';
  if(modelWorkspace()){if(orbitMode)$('canvas-note').textContent=orbitMode==='free'?'Drag inside the arcball to orbit • outside to roll • Enter or Esc exits':'Drag horizontally / vertically to orbit • Shift allows free orbit • Enter or Esc exits';else if(phase==='height'&&['BOX','CYLINDER','EXTRUDE'].includes(state().command))$('canvas-note').textContent='Type a signed height or place it along the active plane normal';else if(phase==='first-corner'&&state().command==='BOX')$('canvas-note').textContent='Pick the first corner on the active UCS plane or type UCS XYZ';else if(phase==='opposite-corner')$('canvas-note').textContent='Pick the opposite corner in the active plane or type UCS XYZ';else if(phase==='axis')$('canvas-note').textContent='Enter world rotation axis X, Y or Z';else if(phase==='view-vector')$('canvas-note').textContent='Enter a nonzero viewing vector X,Y,Z';else if(phase==='plan-choice')$('canvas-note').textContent='Enter for Current UCS plan • W chooses World';else if(!state().command&&!state().selectionIds.length)$('canvas-note').textContent='Shift + middle drag orbits • Ctrl + Shift + middle drag rotates freely';}
  if(selectedSubobject&&!state().command)$('canvas-note').textContent=`${selectedSubobject.kind} selected • drag orange grip / edit world coordinates • Shift+F1 Whole object`;else if(modelWorkspace()&&subobjectMode!=='whole'&&!state().command)$('canvas-note').textContent=`Pick mesh ${subobjectMode}s • Ctrl+Space cycles obscured candidates • Shift+F1–F4 filters • Esc clears`;
  if(!state().command&&!orbitMode&&selectionObjects().some(architectureOwner))$('canvas-note').textContent='Generated architecture selected • Edit architectural source in Properties';
  if(currentRoofComponent()&&!orbitMode)$('canvas-note').textContent='Roof component selected · amber corner / edge grips resize its footprint · Esc cancels';
  if(!$('command-suggestions').hidden){if(document.activeElement===input)renderCompletion();else hideCompletion();}
  renderSpaceTabs();renderLayerManager();renderProperties();refreshArchitectureSummary();if(orbitMode)$('properties-content').querySelectorAll('input,select,button').forEach(field=>field.disabled=true);renderLayers();if(orbitMode)$('layers-list').querySelectorAll('input,select,button').forEach(field=>field.disabled=true);renderBlockLibrary();updateModelControls();updateStatus();draw();syncDesktop();scheduleDevelopmentCheckpoint();maybeAnnotationEditor();
}

function canvasPosition(event) {const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
function pointerPosition(event) {
  syncOrdinaryGripStage();
  syncPointOverride({full:false});
  if(typeof event.shiftKey==='boolean')trimPointerExtend=event.shiftKey;
  rawPointer=canvasPosition(event);pointer=toWorld(rawPointer);snap=null;pointerScalar=null;pointerUnavailable=null;
  if(drag?.mode==='grip'&&drag.start&&drag.sourcePoint)drag.moved=drag.moved||Math.hypot(rawPointer.x-drag.start.x,rawPointer.y-drag.start.y)>2;
  if(modelWorkspace()){
    if(ordinaryGripStage){pointer=ordinaryGripStage.inputKind==='typed'?ordinaryGripStage.targetPoint:ordinaryGripScreenPoint(rawPointer);if(!pointer)pointerUnavailable='The object plane is edge-on; type a valid destination or choose another view.';}
    else if(drag?.mode==='roof-component-grip'){pointer=drag.typedActive?drag.valid?geometry.architectureLocalToWorld(drag.targetLocal,architectureFrame()):null:geometry.intersectPlaneRay(view3d.screenRay(rawPointer,camera3D(),width,height),drag.plane);if(!pointer)pointerUnavailable=drag.typedActive?'Correct the typed building-local XY point.':'Footprint plane is edge-on; type building-local X,Y or choose another view.';}
    else if(drag?.mode==='grip'||drag?.mode==='subobject-grip'){const entity=activeEntities().find(e=>e.id===drag.entityId),point=drag.mode==='subobject-grip'?drag.startPoint:pointsOf(entity)[drag.index],curvePlane=spatialCurve(entity)?{xAxis:entity.xAxis,yAxis:entity.yAxis,normal:view3d.cross3(entity.xAxis,entity.yAxis)}:null,plane={...(curvePlane||activePlane()),origin:point};pointer=geometry.intersectPlaneRay(view3d.screenRay(rawPointer,camera3D(),width,height),plane);}
    else if(state().commandPhase==='height'&&['BOX','CYLINDER','EXTRUDE'].includes(state().command)){const base=state().commandData.heightBase,direction=state().commandData.heightDirection||{x:0,y:0,z:1};pointerScalar=view3d.heightAlongAxis(rawPointer,base,direction,camera3D(),width,height);pointer=pointerScalar===null?null:{x:base.x+direction.x*pointerScalar,y:base.y+direction.y*pointerScalar,z:base.z+direction.z*pointerScalar};if(pointerScalar===null)pointerUnavailable='Height normal is aligned with the view; type a height.';}
    else if(state().commandData?.targetKind==='object'||selectingObjects())pointer=projectedPick(rawPointer,state().commandData?.targetKind==='object'&&!selectingObjects()?visibleEntities():selectableEntities())?.point||pointer;
    if(!pointer&&!pointerUnavailable)pointerUnavailable='Active plane is edge-on; choose Plan or type UCS coordinates.';
  }else if(drag?.mode==='grip'){const entity=activeObjects().find(e=>e.id===drag.entityId);if(entity&&is3DEntity(entity))pointer.z=pointsOf(entity)[drag.index].z;}
  if(ordinaryGripStage&&!modelWorkspace())pointer=ordinaryGripStage.inputKind==='typed'?ordinaryGripStage.targetPoint:ordinaryGripScreenPoint(rawPointer);
  if(drag?.mode==='grip'&&drag.sourcePoint&&!drag.moved)pointer={...drag.sourcePoint};
  const anchor=pointSnapAnchor();
  if(pointer&&ordinaryGripStage&&ordinaryGripStage.inputKind!=='typed'&&orthoEnabled){const plane=ordinaryGripStage.plane,local=geometry.worldToPlane({...pointer,z:pointer.z??0},plane),base=geometry.worldToPlane({...anchor,z:anchor.z??0},plane);pointer=geometry.planeToWorld(Math.abs(local.x-base.x)>=Math.abs(local.y-base.y)?{...base,x:local.x}:{...base,y:local.y},plane);}
  else if(pointer&&orthoEnabled&&anchor&&['LINE','PLINE','3DPOLY','MOVE','COPY','MIRROR','STRETCH'].includes(state().command)&&!['selection','window-first','window-second'].includes(state().commandPhase)) {
    if(state().command==='3DPOLY'||state().commandData?.threeD){const plane=state().commandData?.plane||activePlane(),local=geometry.worldToPlane(pointer,plane),base=geometry.worldToPlane(anchor,plane),axes=['x','y','z'].sort((a,b)=>Math.abs(local[b]-base[b])-Math.abs(local[a]-base[a]));pointer=geometry.planeToWorld({...base,[axes[0]]:local[axes[0]]},plane);}
    else if(Math.abs(pointer.x-anchor.x)>=Math.abs(pointer.y-anchor.y))pointer={...pointer,y:anchor.y};
    else pointer={...pointer,x:anchor.x};
  }
  const override=commandPointPrompt()?onePointSnap?.mode:null,snapModes=override?(override==='none'?[]:[override]):state().settings?.snapModes||[],acquireSnaps=override?override!=='none':snapEnabled;
  if(acquireSnaps&&ordinaryGripStage?.inputKind!=='typed'&&drag?.mode!=='orbit'&&!orbitMode&&pointerScalar===null&&(commandPointPrompt()||drag?.mode==='grip'&&(!drag.sourcePoint||drag.moved))){
    const snapDocument={...drawingContext(),snapAnchor:snapModes.includes('perpendicular')?pointSnapAnchor():null,...(override?{settings:{...drawingContext().settings,snapEnabled:true,snapModes}}:{})};
    snap=modelWorkspace()||currentViewport()?projectedSnap(rawPointer,{modes:snapModes,anchor:pointSnapAnchor()}):pointer?findSnap(visibleObjects().filter(e=>e.id!==drag?.entityId&&e.id!==ordinaryGripStage?.entityId),pointer,10/viewScale(),snapDocument):null;
    if(snap&&ordinaryGripStage&&!ordinaryGripPointOnPlane(snap.point,ordinaryGripStage.plane))snap=null;
    if(snap)pointer={...snap.point};
  }
  if(drag?.mode==='roof-component-grip'&&!drag.typedActive){
    drag.snap=null;
    if(snapEnabled&&(drag.acquisition==='latched'||Math.hypot(rawPointer.x-drag.start.x,rawPointer.y-drag.start.y)>3)){
      const candidate=projectedSnap(rawPointer,{excludeRoofGroupId:drag.roofGroupId});
      if(candidate)try{const projected=projectRoofGripSnap(candidate.point,architectureFrame(),drag.planeElevation),screen=toScreen(projected.point);if(finiteScreenPoint(screen)&&!screen.clipped&&insideActiveViewport(screen)){snap={...candidate,...projected};drag.snap=structuredClone(snap);pointer={...snap.point};pointerUnavailable=null;}}catch{}
    }
  }
  if(drag?.mode==='roof-component-grip')updateRoofComponentDrag();
  if(ordinaryGripStage&&ordinaryGripStage.inputKind!=='typed')updateOrdinaryGripTarget(pointer);
  syncGripAcquisition();
  updateStatus();if(modelWorkspace()&&drag?.mode!=='roof-component-grip')$('construction-plane-label').textContent=pointerUnavailable||`Pointer: ${planeLabel()}`;
}
function gripCandidates(screen,aperture=GRIP_ACQUIRE_PIXELS) {
  if(!screen||!insideActiveViewport(screen))return[];
  const candidates=[],meshes=visibleEntities().filter(e=>e.type==='MESH');
  const append=(point,data,{occlusion=true}={})=>{
    const p=toScreen(point),distance=Math.hypot(p.x-screen.x,p.y-screen.y),depth=modelWorkspace()?p.depth:point.z??0;
    if(!finiteScreenPoint(p)||distance>aperture||p.clipped||!insideActiveViewport(p)||occlusion&&modelWorkspace()&&camera3D().renderMode==='shaded'&&view3d.pointOccluded(point,meshes,camera3D(),width,height))return;
    candidates.push({...data,point:{...point},screen:{x:p.x,y:p.y},distance,depth});
  };
  if(modelWorkspace()&&selectedSubobject){
    const selected=selectedSubobject,entity=selectableObjects().find(entity=>entity.id===selected.entityId&&!architectureOwner(entity));
    if(entity?.vertices&&!selected.indices.some(index=>!entity.vertices[index])){
      if(selected.kind==='vertex')append(entity.vertices[selected.index],{kind:'ordinary',entityId:entity.id,index:selected.index});
      else {const point=subobjectCenter(entity,selected.indices);append(point,{kind:'subobject',entityId:entity.id,index:selected.index,subobject:{...selected,startPoint:{...point}}});}
    }
    return candidates;
  }
  for(const entity of selectableObjects().filter(e=>!architectureOwner(e)&&state().selectionIds.includes(e.id))){
    for(const[index,point]of pointsOf(entity).entries()){
      append(point,{kind:'ordinary',entityId:entity.id,index});
    }
  }
  // These are the existing semantic cage handles at the fixed bearing plane,
  // never editable vertices of the generated roof mesh.
  const roof=currentRoofComponent();if(roof)for(const[index,grip]of roofComponentGrips().entries())append(grip.point,{kind:'roof-component',entityId:roof.entityId,index,gripId:grip.id,grip},{occlusion:false});
  return candidates.sort((a,b)=>a.distance-b.distance||b.depth-a.depth||a.entityId.localeCompare(b.entityId)||a.index-b.index);
}
function gripAt(screen){return gripCandidates(screen)[0]||null;}
function gripAcquisitionEligible(){return Boolean(rawPointer&&!state().command&&!ordinaryGripStage&&!drag&&!panTool&&!orbitMode&&!documentActionBusy&&!canvasMenu&&!editorDialogOpen()&&(subobjectMode==='whole'&&!selectedSubobject||modelWorkspace()&&selectedSubobject));}
function syncGripAcquisition(){
  const previous=acquiredGrip;
  if(!gripAcquisitionEligible()){acquiredGrip=null;return;}
  const candidates=gripCandidates(rawPointer,GRIP_RELEASE_PIXELS),retained=previous&&candidates.find(candidate=>candidate.kind===previous.kind&&candidate.entityId===previous.entityId&&candidate.index===previous.index&&candidate.gripId===previous.gripId);
  acquiredGrip=retained||candidates.find(candidate=>candidate.distance<=GRIP_ACQUIRE_PIXELS)||null;
  if(acquiredGrip){pointer={...acquiredGrip.point};pointerUnavailable=null;snap=null;}
  else if(previous)pointer=toWorld(rawPointer);
}
function gripAcquisitionState(){
  const visible=gripAcquisitionEligible()&&acquiredGrip&&gripCandidates(rawPointer,GRIP_RELEASE_PIXELS).some(candidate=>candidate.kind===acquiredGrip.kind&&candidate.entityId===acquiredGrip.entityId&&candidate.index===acquiredGrip.index&&candidate.gripId===acquiredGrip.gripId);
  return{active:Boolean(visible),kind:visible?acquiredGrip.kind:null,entityId:visible?acquiredGrip.entityId:null,index:visible?acquiredGrip.index:null,gripId:visible?acquiredGrip.gripId||null:null,point:visible?{...acquiredGrip.point}:null,screen:visible?{...acquiredGrip.screen}:null,rawScreen:rawPointer?{...rawPointer}:null,aperturePixels:GRIP_ACQUIRE_PIXELS,releasePixels:GRIP_RELEASE_PIXELS,editing:Boolean(ordinaryGripStage),phase:ordinaryGripStage?.phase||null,dragging:ordinaryGripStage?.phase==='pressed'||drag?.mode==='grip',dragSource:ordinaryGripStage?{...ordinaryGripStage.sourcePoint}:drag?.mode==='grip'&&drag.sourcePoint?{...drag.sourcePoint}:null};
}
function drawAcquiredGrip(){
  if(ordinaryGripStage){const point=toScreen(ordinaryGripStage.sourcePoint);if(finiteScreenPoint(point)&&!point.clipped&&insideActiveViewport(point)){ctx.save();ctx.fillStyle='#ef926e';ctx.strokeStyle='#ffe4d2';ctx.lineWidth=1.5;ctx.fillRect(point.x-5,point.y-5,10,10);ctx.strokeRect(point.x-5,point.y-5,10,10);ctx.restore();}return;}
  if(!acquiredGrip||!gripAcquisitionEligible())return;
  const p=toScreen(acquiredGrip.point);if(!finiteScreenPoint(p)||p.clipped||!insideActiveViewport(p))return;
  ctx.save();ctx.fillStyle='#eab47b';ctx.strokeStyle='#ffe0b8';ctx.lineWidth=1.5;ctx.fillRect(p.x-5,p.y-5,10,10);ctx.strokeRect(p.x-5,p.y-5,10,10);ctx.restore();
}
function ordinaryGripContext(){return JSON.stringify({space:state().activeSpace,layout:state().activeLayoutId,viewport:state().activeViewportId,workspace:state().workspace,viewportWorkspace:currentViewport()?.workspace,ucs:state().ucs,units:state().settings?.units,format:state().settings?.linearFormat,angles:state().settings?.angularInputUnit,elevation:state().settings?.constructionElevation,plane:state().settings?.constructionPlane});}
function discardOrdinaryGripStage(message=''){
  if(!ordinaryGripStage)return false;
  ordinaryGripStage=null;onePointSnap=null;snap=null;input.value='';hideCompletion();
  if(message)addLog(message,'notice');return true;
}
function syncOrdinaryGripStage({force=false}={}){
  const stage=ordinaryGripStage;if(!stage)return false;
  const source=selectableObjects().find(entity=>entity.id===stage.entityId);
  if(stage.editor!==editor||state().command||editorDialogOpen()||stage.context!==ordinaryGripContext()||selectedSubobject||subobjectMode!=='whole'||!state().selectionIds.includes(stage.entityId)||!source||architectureOwner(source)||
    (force||stage.revision!==state().revision)&&JSON.stringify(source)!==stage.sourceHash){discardOrdinaryGripStage('Grip preview canceled because its source or drawing context changed.');return false;}
  stage.revision=state().revision;return true;
}
function ordinaryGripState(){
  syncOrdinaryGripStage();const stage=ordinaryGripStage;
  return stage?{active:true,phase:stage.phase,entityId:stage.entityId,index:stage.index,sourcePoint:{...stage.sourcePoint},targetPoint:stage.targetPoint?{...stage.targetPoint}:null,plane:structuredClone(stage.plane),inputKind:stage.inputKind,valid:stage.valid,error:stage.error,preview:stage.preview?structuredClone(stage.preview):null}:{active:false,phase:null};
}
function updateOrdinaryGripTarget(point,{kind='pointer',text=''}={}){
  if(!syncOrdinaryGripStage())return false;const stage=ordinaryGripStage;
  stage.inputKind=kind;stage.text=text;stage.targetPoint=point?{...point}:null;stage.valid=false;stage.error='';stage.preview=null;
  try{
    if(!point||kind==='pointer'&&(!ordinaryGripPointOnPlane(point,stage.plane)||!rawPointer||!insideActiveViewport(rawPointer)))throw Error(pointerUnavailable||'The destination cannot be acquired on the object plane. Type coordinates or choose another view.');
    stage.preview=geometry.previewGrip(stage.source,stage.index,point,state());stage.valid=true;
  }catch(error){stage.error=error.message||'The destination is invalid.';}
  return stage.valid;
}
function ordinaryGripScreenPoint(screen){
  if(!ordinaryGripStage)return null;
  if(paperSpace())return screenToPaper(screen);
  return modelWorkspace()?geometry.intersectPlaneRay(view3d.screenRay(screen,camera3D(),width,height),ordinaryGripStage.plane):toWorld(screen);
}
function startOrdinaryGripStage(grip,event){
  const source=selectableObjects().find(entity=>entity.id===grip.entityId),sourcePoint=grip.point||source&&pointsOf(source)[grip.index];
  if(!source||!sourcePoint||architectureOwner(source)||selectedSubobject||subobjectMode!=='whole')return false;
  try{
    const plane=ordinaryGripPlane(source,sourcePoint,activePlane(),state().activeSpace);
    ordinaryGripStage={editor,entityId:source.id,index:grip.index,source:structuredClone(source),sourceHash:JSON.stringify(source),sourcePoint:{...sourcePoint},plane,inputPlane:structuredClone(activePlane()),context:ordinaryGripContext(),revision:state().revision,phase:'pressed',pointerId:event.pointerId,inputKind:'pointer',text:'',targetPoint:{...sourcePoint},valid:true,error:'',preview:structuredClone(source)};
    acquiredGrip=null;onePointSnap=null;input.value='';pointer={...sourcePoint};hideCompletion();updateStatus();draw();return true;
  }catch(error){toast(error.message);addLog(error.message,'error');return false;}
}
function finishOrdinaryGripStage({pointerId=null}={}){
  if(!syncOrdinaryGripStage({force:true}))return{ok:false,message:'The grip source changed. Select its handle again.'};
  const stage=ordinaryGripStage;
  if(stage.phase!=='latched')return{ok:false,message:'Release the handle before confirming its destination.'};
  if(!stage.valid||!stage.targetPoint){toast(stage.error||'Specify a valid destination.');return{ok:false,message:stage.error||'Specify a valid destination.'};}
  const result=editor.moveGrip(stage.entityId,stage.index,stage.targetPoint);
  if(result.ok){discardOrdinaryGripStage();if(pointerId!==null)ordinaryGripConsumedUp=pointerId;}
  else{stage.valid=false;stage.preview=null;stage.error=result.message;toast(result.message);}
  resultLog(result);return result;
}
function previewOrdinaryGripText(raw){
  if(!syncOrdinaryGripStage())return;
  const stage=ordinaryGripStage;
  if(!String(raw).trim()){stage.inputKind='pointer';stage.text='';if(rawPointer){const rect=canvas.getBoundingClientRect();pointerPosition({clientX:rect.left+rawPointer.x,clientY:rect.top+rawPointer.y});}draw();return;}
  snap=null;
  try{const point=parseOrdinaryGripPoint(String(raw),{entity:stage.source,sourcePoint:stage.sourcePoint,inputPlane:stage.inputPlane,settings:state().settings,space:state().activeSpace});updateOrdinaryGripTarget(point,{kind:'typed',text:String(raw)});pointer={...point};}
  catch(error){stage.inputKind='typed';stage.text=String(raw);stage.valid=false;stage.error=error.message;stage.preview=null;}
  updateStatus();draw();
}
function submitOrdinaryGripInput(raw){
  if(!syncOrdinaryGripStage())return{ok:false,message:'The grip source is unavailable.'};
  const text=String(raw??'').trim(),mode=commandPointSnapToken(text,{command:'GRIPSTRETCH',pointPrompt:true});
  if(mode){input.value='';ordinaryGripStage.inputKind='pointer';const ok=setPointSnapOverride(mode);return{ok,message:ok?'Temporary grip snap selected.':'The snap is unavailable.'};}
  if(!text){const message='Specify a destination point, or press Escape to cancel. Grip mode cycling is not available.';ordinaryGripStage.error=message;toast(message);updateStatus();return{ok:false,message};}
  previewOrdinaryGripText(String(raw));return finishOrdinaryGripStage();
}
function startGripDrag(grip){
  const point=grip.point||pointsOf(activeObjects().find(entity=>entity.id===grip.entityId)||{})[grip.index];if(!point)return false;
  drag={mode:'grip',...grip,start:{...rawPointer},sourcePoint:{...point},moved:false};acquiredGrip=null;pointer={...point};updateStatus();draw();return true;
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
  if(event.button===0)ordinaryGripConsumedUp=null;
  syncOrdinaryGripStage();
  syncPointOverride();
  if(drag?.mode==='roof-component-grip'){
    if(drag.acquisition==='latched'&&event.button===0&&!event.shiftKey&&!panTool&&!orbitMode){
      event.preventDefault();
      if(drag.typedActive){input.focus({preventScroll:true});toast('Press Enter to place typed XY, or clear the command field to use the pointer.');return;}
      pointerPosition(event);finishRoofGripAcquisition();if(!drag)canvas.focus({preventScroll:true});return;
    }
    discardRoofGripDraft();
  }
  flushViewportNavigation();
  event.preventDefault();canvas.focus({preventScroll:true});pointerPosition(event);canvas.setPointerCapture(event.pointerId);
  if(modelWorkspace()&&(event.button===1&&event.shiftKey||event.button===0&&orbitMode)){
    const previousMode=orbitMode,free=event.ctrlKey&&event.shiftKey||orbitMode==='free'||event.button===0&&event.shiftKey;startOrbit(free?'free':'constrained',rawPointer,{explicit:!camera3D().autoTarget&&Boolean(camera3D().orbitCenter)});drag={mode:'orbit',start:{...rawPointer},last:{...rawPointer},startCamera:structuredClone(camera3D()),free,transient:event.button===1,previousMode,baseMode:previousMode||'constrained'};draw();return;
  }
  if(event.button===1&&!event.shiftKey&&lastMiddleClick&&event.timeStamp-lastMiddleClick.time<350&&Math.hypot(rawPointer.x-lastMiddleClick.screen.x,rawPointer.y-lastMiddleClick.screen.y)<6){lastMiddleClick=null;drag=null;fit();return;}
  if(event.button===1||panTool){drag={mode:'pan',last:{...rawPointer},start:{...rawPointer},middle:event.button===1,moved:false};canvas.style.cursor='grabbing';return;}
  if(ordinaryGripStage){
    if(event.button!==0)return;
    if(ordinaryGripStage.phase==='latched'){if(ordinaryGripStage.inputKind==='typed'){input.focus({preventScroll:true});toast('Press Enter to place the typed destination, or clear it to use the pointer.');return;}updateOrdinaryGripTarget(pointer);finishOrdinaryGripStage({pointerId:event.pointerId});}
    return;
  }
  closePalettes();hideCompletion();
  if(currentViewport()&&!geometry.pointInViewport(screenToPaper(rawPointer),currentViewport())){toast('Double-click outside the viewport to return to paper space.');return;}
  if(!state().command&&modelWorkspace()&&!event.shiftKey){
    const grip=acquiredGrip?.kind==='roof-component'?acquiredGrip.grip:roofComponentGripAt(rawPointer),data=roofComponentData();
    if(grip&&data){const hit=geometry.intersectPlaneRay(view3d.screenRay(rawPointer,camera3D(),width,height),data.footprint.plane),b=data.footprint.bounds,gripLocal={x:grip.sides.includes('minX')?b.minX:grip.sides.includes('maxX')?b.maxX:(b.minX+b.maxX)/2,y:grip.sides.includes('minY')?b.minY:grip.sides.includes('maxY')?b.maxY:(b.minY+b.maxY)/2,z:data.footprint.elevation};
      drag={mode:'roof-component-grip',acquisition:'pressed',typedActive:false,input:{kind:'pointer',text:'',mode:'absolute'},snap:null,selection:data.selected,roofGroupId:data.selected.roofGroupId,componentId:data.selected.componentId,gripId:grip.id,plane:structuredClone(data.footprint.plane),planeElevation:data.footprint.elevation,originalBounds:{...data.footprint.bounds},bounds:{...data.footprint.bounds},start:{...rawPointer},startLocal:hit?geometry.architectureWorldToLocal(hit,architectureFrame()):{...gripLocal},gripLocal,targetLocal:{...gripLocal},moved:false,valid:true,error:''};
      acquiredGrip=null;input.value='';pointerPosition(event);draw();return;
    }
  }
  if(state().command==='UCS'&&state().commandPhase==='ucs-face'){const pick=projectedPick(rawPointer,visibleEntities()),entity=activeEntities().find(item=>item.id===pick?.entityId),face=entity?.type==='MESH'?view3d.pickMesh(entity,rawPointer,camera3D(),width,height):null;resultLog(face?editor.submitFace(entity.id,face.faceIndex):{ok:false,message:'Pick a visible planar mesh face.'});return;}
  if(!state().command&&modelWorkspace()&&subobjectMode!=='whole'){const picked=projectedPick(rawPointer,selectableEntities()),entity=activeEntities().find(item=>item.id===picked?.entityId);if(architectureOwner(entity)){const component=!event.shiftKey&&roofComponentPick(rawPointer);if(!component||!selectRoofComponent(component)){selectedRoofComponent=null;selectedSubobject=null;editor.select([entity.id]);}update();return;}}
  if(!state().command&&modelWorkspace()&&subobjectMode!=='whole'){
    const grip=acquiredGrip?.kind==='subobject'?acquiredGrip.subobject:subobjectGrip(rawPointer);
    if(grip){drag={mode:'subobject-grip',...grip,start:{...rawPointer},moved:false};acquiredGrip=null;draw();return;}
    if(subobjectMode==='vertex'&&selectedSubobject?.kind==='vertex'){
      const point=activeEntities().find(entity=>entity.id===selectedSubobject.entityId)?.vertices[selectedSubobject.index],p=point&&toScreen(point);
      if(acquiredGrip?.kind==='ordinary'&&acquiredGrip.entityId===selectedSubobject.entityId&&acquiredGrip.index===selectedSubobject.index){startGripDrag(acquiredGrip);return;}
      if(p&&Math.hypot(p.x-rawPointer.x,p.y-rawPointer.y)<9){startGripDrag({entityId:selectedSubobject.entityId,index:selectedSubobject.index,point});return;}
    }
    const pick=subobjectPick(rawPointer);if(pick)selectSubobject(pick);else{selectedSubobject=null;editor.clearSelection();update();}return;
  }
  const trim=trimInteraction();
  if(trim?.target&&editor.trimPick){
    if(trim.quick){drag={mode:'trim-gesture',editor,command:state().command,source:documentFingerprint(),view:trimViewStamp(),start:{...rawPointer},points:[{...rawPointer}],extend:event.shiftKey,moved:false};draw();}
    else {resultLog(submitTrimPick(rawPointer,{extend:event.shiftKey}));input.focus({preventScroll:true});}
    return;
  }
  if(trim&&['trim-fence','trim-crossing-first','trim-crossing-second'].includes(state().commandPhase)){
    if(trimPerspectiveUnsupported()){toast('Project View is unavailable in perspective. Choose UCS/None or an orthographic view.');return;}
    if(!state().commandPoints?.length)trimFenceExtend=event.shiftKey;
    if(state().commandPhase==='trim-crossing-second'){
      const screens=[toScreen(state().commandPoints[0]),rawPointer];resultLog(submitTrimFence(screens,{extend:event.shiftKey||trimFenceExtend,crossing:true}));trimFenceExtend=false;input.focus({preventScroll:true});return;
    }
    syncTrimProjectionView();
  }
  if(state().command&&state().commandData?.targetKind!=='none'&&!['selection','join-selection','mode','axis','view-vector','plan-choice','distance','delete-choice','clipboard-ready'].includes(state().commandPhase)&&state().command!=='ZOOM'){if(!pointer){toast(pointerUnavailable||'Type a coordinate or choose a different view.');return;}const command=state().command;if(pointerScalar!==null){runCommand(String(pointerScalar));input.focus({preventScroll:true});return;}addLog(`${currentPrompt()} ${format(pointer.x,6)},${format(pointer.y,6)}${pointer.z!==undefined?`,${format(pointer.z,6)}`:''}`,'input');let result;if((modelWorkspace()||currentViewport())&&state().commandData?.targetKind==='object'&&editor.submitObject){const picked=modelWorkspace()?projectedPick(rawPointer,visibleEntities()):null,id=picked?.entityId||(!modelWorkspace()?objectAtScreen(rawPointer,visibleEntities()):null);result=id?editor.submitObject(id,picked?.point||pointer):{ok:false,message:'No visible object was picked at that screen location.'};}else result=editor.submitPoint({...pointer});resultLog(result);trackClipboard(command,result);if(command==='MVIEW'&&result.ok&&!state().command){selectCreatedViewport(result.viewportId);update();}input.focus({preventScroll:true});return;}
  if(state().command&&!selectingObjects()){input.focus({preventScroll:true});return;}
  const grip=selectingObjects()?null:acquiredGrip||gripAt(rawPointer);
  if(grip&&grip.kind==='ordinary'){startOrdinaryGripStage(grip,event);return;}
  if(paperSpace()&&!state().command&&!event.shiftKey&&pointer){const id=hitTest(selectableObjects(),pointer,8/viewScale(),state()),object=activeObjects().find(item=>item.id===id);if(object?.type==='VIEWPORT'){if(!state().selectionIds.includes(id))editor.select([id]);drag={mode:'move-selection',startPaper:screenToPaper(rawPointer),start:{...rawPointer},moved:false};update();return;}}
  drag={mode:'box',start:{...rawPointer},world:{...pointer},screen:{...rawPointer},moved:false,shift:event.shiftKey};
  draw();
});
canvas.addEventListener('pointermove',event=>{
  if(documentActionBusy||canvasMenu)return;
  const position=canvasPosition(event);
  if(drag?.mode==='orbit'){const free=drag.transient?event.ctrlKey&&event.shiftKey:drag.baseMode==='free'||event.shiftKey;if(Boolean(free)!==drag.free){drag.free=Boolean(free);drag.start={...position};drag.last={...position};drag.startCamera=structuredClone(camera3D());orbitMode=drag.free?'free':'constrained';}const before=drag.free?drag.startCamera:camera3D(),next=drag.free?view3d.orbitFree(before,drag.start,position,width,height):view3d.orbitConstrained(before,position.x-drag.last.x,position.y-drag.last.y);setCamera(view3d.orbitAroundPivot(before,next,orbitPivot));drag.last=position;pointerPosition(event);updateModelControls();draw();return;}
  if(drag?.mode==='pan'){if(currentLayout())panSheetOrViewport(position.x-drag.last.x,position.y-drag.last.y);else if(modelWorkspace())setCamera(view3d.panCamera(camera3D(),position.x-drag.last.x,position.y-drag.last.y,height));else state().viewport=pan(state().viewport,position.x-drag.last.x,position.y-drag.last.y);drag.last=position;drag.moved=drag.moved||Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>4;pointerPosition(event);draw();return;}
  pointerPosition(event);
  if(drag?.mode==='trim-gesture'){
    drag.moved=drag.moved||Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>3;
    const previous=drag.points.at(-1);if(Math.hypot(position.x-previous.x,position.y-previous.y)>=2){if(drag.points.length<2048)drag.points.push({...position});else drag.points[drag.points.length-1]={...position};}
  }
  if(drag?.mode==='move-selection')drag.moved=Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>3;
  if(drag?.mode==='subobject-grip')drag.moved=Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>3;
  if(drag?.mode==='box'){drag.screen={...position};drag.moved=Math.hypot(position.x-drag.start.x,position.y-drag.start.y)>4;}
  draw();
});
canvas.addEventListener('pointerup',event=>{
  if(event.pointerId===ordinaryGripConsumedUp){ordinaryGripConsumedUp=null;return;}
  if(ordinaryGripStage?.phase==='pressed'&&event.button===0&&event.pointerId===ordinaryGripStage.pointerId){
    if(syncOrdinaryGripStage()){pointerPosition(event);ordinaryGripStage.phase='latched';input.focus({preventScroll:true});update();}return;
  }
  if(event.pointerId===canvasMenuDismissPointerId){canvasMenuDismissPointerId=null;return;}
  if(documentActionBusy||canvasMenu||event.button===2||!drag)return;
  pointerPosition(event);const operation=drag;
  if(operation.mode==='roof-component-grip'&&(operation.acquisition==='latched'||!operation.moved)){
    operation.acquisition='latched';hideCompletion();input.focus({preventScroll:true});update();return;
  }
  if(operation.mode==='roof-component-grip')clearRoofDragPreview();drag=null;
  if(operation.mode==='trim-gesture'){
    if(operation.editor!==editor||operation.command!==state().command||operation.source!==documentFingerprint()||operation.view!==trimViewStamp()||!trimInteraction()?.target)toast('The drawing or view changed. Start this trim selection again.');
    else {const screen={...rawPointer};if(operation.moved){if(Math.hypot(screen.x-operation.points.at(-1).x,screen.y-operation.points.at(-1).y)>0)operation.points.push(screen);resultLog(submitTrimFence(operation.points,{extend:operation.extend}));}else resultLog(submitTrimPick(screen,{extend:operation.extend}));}
  }
  else if(operation.mode==='orbit'){if(operation.transient)orbitMode=operation.previousMode;if(!orbitMode)orbitPivot=null;}
  else if(operation.mode==='roof-component-grip'){if(operation.moved){if(operation.valid){const result=commitRoofComponentBounds(operation.selection,operation.bounds);resultLog(result);if(result.ok===false)toast(result.message);}else{addLog(`Footprint unchanged: ${operation.error}`,'error');toast(operation.error);}}}
  else if(operation.mode==='grip'){if(operation.sourcePoint&&!operation.moved){}else if(pointer)resultLog(editor.moveGrip(operation.entityId,operation.index,{...pointer}));else toast(pointerUnavailable||'The grip could not be placed from this view.');}
  else if(operation.mode==='subobject-grip'){if(operation.moved&&pointer){const delta={x:pointer.x-operation.startPoint.x,y:pointer.y-operation.startPoint.y,z:pointer.z-operation.startPoint.z};const result=editor.moveMeshVertices(operation.entityId,operation.indices,delta);if(result.ok)selectedSubobject=null;resultLog(result);}}
  else if(operation.mode==='pan'){if(viewportNavigationDraft)resultLog(flushViewportNavigation());lastMiddleClick=operation.middle&&!operation.moved?{time:event.timeStamp,screen:{...rawPointer}}:null;}
  else if(operation.mode==='move-selection'){if(operation.moved&&pointer){let result=editor.execute('MOVE');if(result.ok)result=editor.submitPoint(operation.startPaper);if(result.ok)result=editor.submitPoint(pointer);resultLog(result);}}
  else if(operation.mode==='box'){
    const selectingCommand=selectingObjects();
    if(operation.moved){const ids=currentViewport()?objectsInViewportBox(operation.start,operation.screen,operation.screen.x<operation.start.x):modelWorkspace()?view3d.entitiesInProjectedBox(selectableObjects(),operation.start,operation.screen,operation.screen.x<operation.start.x,camera3D(),width,height,e=>geometry.entityPoints(e,state()),projectionEdges,projectionFills):entitiesInBox(selectableObjects(),operation.world,toWorld(operation.screen),operation.screen.x<operation.start.x,state());editor.select(ids,{add:operation.shift||selectingCommand});addLog(`${ids.length} object${ids.length===1?'':'s'} found.`);}
    else {const component=!operation.shift&&!selectingCommand&&roofComponentPick(operation.screen);if(component&&selectRoofComponent(component)){}else{selectedRoofComponent=null;const id=objectAtScreen(operation.screen);if(id)editor.select([id],{toggle:operation.shift,add:selectingCommand&&!operation.shift});else if(!operation.shift&&!selectingCommand)editor.clearSelection();}}
  }
  update();if(state().command)input.focus({preventScroll:true});else canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointercancel',()=>{discardOrdinaryGripStage('Grip preview canceled.');ordinaryGripConsumedUp=null;discardRoofGripDraft();clearRoofDragPreview();if(drag?.mode==='orbit'&&drag.transient)orbitMode=drag.previousMode;if(!orbitMode)orbitPivot=null;drag=null;viewportNavigationDraft=null;update();});
canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===ordinaryGripConsumedUp)ordinaryGripConsumedUp=null;if(ordinaryGripStage?.phase==='pressed'&&event.pointerId===ordinaryGripStage.pointerId){discardOrdinaryGripStage('Grip preview canceled after pointer capture was lost.');update();}});
canvas.addEventListener('dblclick',event=>{
  if(documentActionBusy||ordinaryGripStage||orbitMode||event.button!==0||state().command||panTool)return;
  if(currentLayout()){const viewport=viewportAt(canvasPosition(event));if(viewport&&state().activeViewportId!==viewport.id){enterSpace('model',currentLayout().id,viewport.id);return;}if(!viewport&&currentViewport()){enterSpace('paper',currentLayout().id);return;}}
  const screen=canvasPosition(event),id=objectAtScreen(screen),entity=activeEntities().find(item=>item.id===id);
  if(entity&&['TEXT','MTEXT','LEADER'].includes(entity.type)){editor.select([id]);update();openAnnotationEditor(id);}
});
canvas.addEventListener('pointerleave',()=>{if(!drag){rawPointer=null;pointer=null;snap=null;acquiredGrip=null;updateStatus();draw();}});
canvas.addEventListener('contextmenu',event=>{event.preventDefault();openCanvasMenu(event.clientX,event.clientY,{snapOnly:event.shiftKey&&commandPointPrompt()});});
canvas.addEventListener('wheel',event=>{event.preventDefault();if(documentActionBusy||!Number.isFinite(event.deltaY))return;if(discardRoofGripDraft())update();const factor=Math.exp(Math.max(-40,Math.min(40,-event.deltaY*.0015)));if(currentLayout()){const screen=canvasPosition(event);zoomSheetOrViewport(factor,screen);scheduleViewportFrame(screen);if(!viewportNavigationDraft)scheduleDevelopmentCheckpoint();return;}if(modelWorkspace()){const screen=canvasPosition(event),anchor=projectedPick(screen,visibleEntities())?.point||toWorld(screen)||view3d.pointOnTargetPlane(screen,camera3D(),width,height);setCamera(view3d.zoomCameraAt(camera3D(),factor,screen,width,height,anchor));updateModelControls();}else state().viewport=zoomAt(state().viewport,factor,canvasPosition(event),width,height);pointerPosition(event);draw();scheduleDevelopmentCheckpoint();},{passive:false});
document.addEventListener('keydown',event=>{if(event.key==='Shift'&&trimInteraction()?.target&&!documentActionBusy&&!editorDialogOpen()){trimPointerExtend=true;draw();}});
document.addEventListener('keyup',event=>{if(event.key==='Shift'){const active=trimPointerExtend;trimPointerExtend=false;if(active&&trimInteraction()?.target)draw();}});

function commandInputChanged(){if(ordinaryGripStage){hideCompletion();previewOrdinaryGripText(input.value);}else if(drag?.mode==='roof-component-grip'){hideCompletion();previewRoofGripText(input.value);}else renderCompletion();}
function submitCommandInput({key='Enter',useCompletion=true}={}){
  if(documentActionBusy||editorDialogOpen())return{ok:false,message:'Finish the open drawing operation or dialog first.'};
  if(ordinaryGripStage){const result=submitOrdinaryGripInput(input.value);input.focus({preventScroll:true});return result;}
  let selectedToken=null;
  if(useCompletion&&input.value.trim()&&drag?.mode!=='roof-component-grip'){
    if(completionCurrent()&&completionIndex>=0)selectedToken=completionItems[completionIndex]?.token||null;
    else if(!state().command&&!/\s/.test(input.value.trim()))selectedToken=commandCompletions(commandCatalog,{input:input.value})[0]?.token||null;
  }
  const decision=commandInputSubmission({key,input:input.value,command:state().command,phase:state().commandPhase,selectedToken,lastRepeatable:lastRepeatableCommand,navigation:Boolean(orbitMode||panTool),dragMode:drag?.mode||null});
  if(decision.kind==='literal')return{ok:true,literal:true};
  if(decision.kind==='blocked'){toast('Finish the pointer operation before submitting a command.');return{ok:false,message:'A pointer operation is still active.'};}
  if(drag?.mode!=='roof-component-grip')input.value='';
  hideCompletion();const result=runCommand(decision.value);input.focus({preventScroll:true});return result;
}
$('command-form').addEventListener('submit',event=>{event.preventDefault();submitCommandInput({key:'Enter'});});
input.addEventListener('input',commandInputChanged);
input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input)hideCompletion();},120));
input.addEventListener('keydown',event=>{
  if(event.key===' '&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&state().commandPhase!=='text'){event.preventDefault();submitCommandInput({key:'Space'});return;}
  if(event.ctrlKey&&!event.altKey&&event.code==='Space'){event.preventDefault();renderCompletion({force:true});return;}
  if(!$('command-suggestions').hidden&&event.key==='Escape'){event.preventDefault();event.stopPropagation();hideCompletion();return;}
  if(!$('command-suggestions').hidden&&['ArrowUp','ArrowDown','Tab'].includes(event.key)){event.preventDefault();if(event.key==='Tab'&&!event.shiftKey)acceptCompletion();else selectCompletion(completionIndex<0?(event.key==='ArrowDown'?0:completionItems.length-1):completionIndex+(event.key==='ArrowDown'?1:-1));return;}
  if(event.key==='ArrowUp'){event.preventDefault();if(commandRecall.length){recallIndex=Math.max(0,recallIndex-1);input.value=commandRecall[recallIndex]||'';if(drag?.mode==='roof-component-grip')commandInputChanged();}}
  if(event.key==='ArrowDown'){event.preventDefault();recallIndex=Math.min(commandRecall.length,recallIndex+1);input.value=commandRecall[recallIndex]||'';if(drag?.mode==='roof-component-grip')commandInputChanged();}
});
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{
  discardRoofGripDraft();
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
document.addEventListener('pointerdown',event=>{
  hideToolHelp();if(!canvasMenu||event.target.closest('#canvas-context-menu'))return;
  if(event.target===canvas){closeCanvasMenu();canvasMenuDismissPointerId=event.pointerId;event.preventDefault();event.stopImmediatePropagation();return;}
  closeCanvasMenu(false);
},{capture:true});
document.addEventListener('keydown',event=>{
  if(canvasMenu){
    const active=document.activeElement,level=Number(active?.dataset.menuLevel||0),buttons=menuPanelButtons(level),index=buttons.indexOf(active);
    if(['Escape','ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End','Enter',' ','Tab'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Tab'){closeCanvasMenu();return;}
      if(event.key==='Escape'||event.key==='ArrowLeft'){
        if(level>0){const parentId=canvasMenu.openPath[level-1];closeCanvasSubmenus(level-1);const parent=menuPanelButtons(level-1).find(button=>button.dataset.menuAction===parentId);parent?.focus({preventScroll:true});}
        else if(event.key==='Escape')closeCanvasMenu();return;
      }
      if(event.key==='ArrowRight'){if(index>=0)openCanvasSubmenu(buttons[index],{focus:true});return;}
      if(event.key==='Enter'||event.key===' '){if(index>=0)invokeCanvasMenuItem(buttons[index].dataset.menuAction);return;}
      focusCanvasMenuItem(event.key==='Home'?0:event.key==='End'?buttons.length-1:index+(event.key==='ArrowDown'?1:-1),level);return;
    }
    if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.length===1){
      event.preventDefault();event.stopImmediatePropagation();const now=performance.now(),letter=event.key.toLocaleLowerCase();canvasMenu.typeahead=now-canvasMenu.typeaheadAt>800?letter:canvasMenu.typeahead+letter;canvasMenu.typeaheadAt=now;const prefix=[...canvasMenu.typeahead].every(char=>char===letter)?letter:canvasMenu.typeahead;
      const order=[...buttons.slice(index+1),...buttons.slice(0,index+1)],target=order.find(button=>button.dataset.menuLabel.toLocaleLowerCase().startsWith(prefix));if(target)focusCanvasMenuItem(buttons.indexOf(target),level);return;
    }
    closeCanvasMenu(false);
  }
  if((event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)&&!textEditing(event.target)&&(event.target===canvas||event.target===document.body)){
    event.preventDefault();event.stopImmediatePropagation();const rect=canvas.getBoundingClientRect(),point=rawPointer||{x:width/2,y:height/2};openCanvasMenu(rect.left+point.x,rect.top+point.y,{keyboard:true});
  }
},{capture:true});
const helpControlSelector='button[title],button[aria-label],button[data-command],button[data-tool]';
document.addEventListener('pointerover',event=>{const control=event.target.closest(helpControlSelector);if(control&&control!==toolHelpTarget)showToolHelp(control);});
document.addEventListener('pointerout',event=>{if(toolHelpTarget&&event.target.closest(helpControlSelector)===toolHelpTarget&&!toolHelpTarget.contains(event.relatedTarget))hideToolHelp();});
document.addEventListener('focusin',event=>{const control=event.target.closest(helpControlSelector);if(control)showToolHelp(control);});
document.addEventListener('focusout',event=>{if(event.target===toolHelpTarget)hideToolHelp();});
window.addEventListener('blur',()=>{closeCanvasMenu(false);hideToolHelp();ordinaryGripConsumedUp=null;if(discardOrdinaryGripStage('Grip preview canceled after the drawing lost focus.'))update();});
window.addEventListener('resize',()=>{closeCanvasMenu(false);hideToolHelp();});
document.addEventListener('scroll',event=>{if(!event.target.closest?.('#canvas-context-menu'))closeCanvasMenu(false);else if(canvasMenu){const level=Number(event.target.closest('.canvas-context-submenu')?.dataset.menuLevel||0);closeCanvasSubmenus(level);}hideToolHelp();},{capture:true});
new MutationObserver(()=>{if(canvasMenu&&!canvasMenuAvailable())closeCanvasMenu(false);}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','inert']});
function dismissRoofGripForControl(event){if(ordinaryGripStage&&event.target!==canvas&&!event.target.closest('#command-form,#snap-toggle,#grid-toggle,#ortho-toggle,#canvas-context-menu')){discardOrdinaryGripStage('Grip preview canceled before changing controls.');updateStatus();draw();}if(drag?.mode==='roof-component-grip'&&event.target!==canvas&&!event.target.closest('#command-form,#snap-toggle,#grid-toggle,#ortho-toggle,#canvas-context-menu,[data-structural-bridge],[data-command="STRUCTURALBRIDGE"]')){discardRoofGripDraft();updateStatus();draw();}}
document.addEventListener('pointerdown',dismissRoofGripForControl,{capture:true});
document.addEventListener('click',dismissRoofGripForControl,{capture:true});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.tool-palette,#draw-tools,#modify-tools,#clipboard-tools,#annotation-tools,#model-tools,#blocks-tools,#output-tools'))closePalettes();});
$('workspace-mode').addEventListener('change',()=>setWorkspace($('workspace-mode').value));
$('view3d-preset').addEventListener('change',()=>{if($('view3d-preset').value!=='custom'){setCamera(view3d.cameraPreset(camera3D(),$('view3d-preset').value));pointer=null;pointerUnavailable=null;update();}});
$('render3d-mode').addEventListener('change',()=>{setCamera({...camera3D(),renderMode:$('render3d-mode').value});update();});
$('view3d-projection').addEventListener('change',()=>{const projection=$('view3d-projection').value,old=camera3D(),scale=view3d.pixelScale(old,height),distance=projection==='perspective'?Math.max(1e-6,Math.min(1e12,view3d.focalPixels(old,height)/scale)):old.distance;setCamera({...old,projection,distance,scale:Math.max(1e-6,Math.min(1e6,scale))});update();});
$('construction-plane').addEventListener('change',()=>{discardRoofGripDraft();if($('construction-plane').value==='CUSTOM'){runCommand('UCS');runCommand('3');}else{resultLog(editor.setUCS($('construction-plane').value));pointer=null;pointerUnavailable=null;}});
$('ucs-three-point').addEventListener('click',()=>{discardRoofGripDraft();if(state().command)editor.cancel();runCommand('UCS');runCommand('3');input.focus();});
$('plan-ucs').addEventListener('click',()=>{discardRoofGripDraft();if(state().command)editor.cancel();runCommand('PLAN');runCommand('');});
$('selection-mode').addEventListener('change',()=>setSubobjectMode($('selection-mode').value));
$('construction-elevation').addEventListener('change',()=>{discardRoofGripDraft();try{const value=readQuantityField('construction-elevation','length');resultLog(editor.updateDraftingSettings({constructionElevation:value}));}catch(error){toast(error.message||'Enter a finite elevation.');updateModelControls();}});
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
$('plot-publish-source').addEventListener('change',()=>{plotPublishSource=$('plot-publish-source').value;refreshPlotSpace();refreshPlotPreview();});
$('plot-sheet-set').addEventListener('change',()=>choosePlotSheetSet($('plot-sheet-set').value));
$('plot-sheet-set-name').addEventListener('input',()=>{if(plotSubmitting||documentActionBusy)return;activePlotSheetDraft().name=$('plot-sheet-set-name').value;$('plot-sheet-set-error').textContent='';refreshPlotSheetSetStatus();});
$('plot-sheet-set-new').addEventListener('click',()=>usePlotSelectionAsTemporary({newName:true}));$('plot-sheet-set-temporary').addEventListener('click',()=>usePlotSelectionAsTemporary());$('plot-sheet-set-reload').addEventListener('click',()=>choosePlotSheetSet(ensurePlotLayoutDraft().selectedSheetSetId,{reload:true}));
for(const action of ['save','update','rename','delete'])$('plot-sheet-set-'+action).addEventListener('click',()=>editPlotSheetSet(action));
$('plot-layout-order').addEventListener('change',event=>{if(!event.target.matches('[data-plot-layout-selected]'))return;if(plotSubmitting||documentActionBusy){renderPlotLayoutOrder();return;}const id=event.target.closest('[data-layout-id]')?.dataset.layoutId,item=ensurePlotLayoutDraft().entries.find(row=>row.id===id);if(!item)return;item.selected=event.target.checked;renderPlotLayoutOrder();[...$('plot-layout-order').children].find(row=>row.dataset.layoutId===id)?.querySelector('input')?.focus();refreshPlotPreview();});
$('plot-layout-order').addEventListener('click',event=>{const button=event.target.closest('[data-plot-layout-action]');if(!button||button.disabled||plotSubmitting||documentActionBusy)return;const id=button.closest('[data-layout-id]')?.dataset.layoutId,action=button.dataset.plotLayoutAction,entries=ensurePlotLayoutDraft().entries,selected=entries.filter(row=>row.selected),position=selected.findIndex(row=>row.id===id),target=selected[position+(action==='up'?-1:1)];if(position<0||!target)return;const index=entries.findIndex(row=>row.id===id),next=entries.indexOf(target);[entries[index],entries[next]]=[entries[next],entries[index]];renderPlotLayoutOrder({id,action});refreshPlotPreview();});
for(const [id,select]of[['plot-layout-all',true],['plot-layout-none',false]])$(id).addEventListener('click',()=>{if(plotSubmitting||documentActionBusy)return;for(const item of ensurePlotLayoutDraft().entries)item.selected=select&&Boolean(state().layouts?.some(layout=>layout.id===item.id));renderPlotLayoutOrder();refreshPlotPreview();});
$('plot-preview-sheet').addEventListener('change',()=>renderPlotPreviewPage(Number($('plot-preview-sheet').value)));$('plot-preview-previous').addEventListener('click',()=>renderPlotPreviewPage(plotPreviewIndex-1));$('plot-preview-next').addEventListener('click',()=>renderPlotPreviewPage(plotPreviewIndex+1));
$('settings-button').addEventListener('click',showSettings);$('settings-close').addEventListener('click',closeSettings);$('settings-cancel').addEventListener('click',closeSettings);$('settings-dialog').addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
for(let riseTwice=2;riseTwice<=24;riseTwice++){const option=document.createElement('option');option.value=String(riseTwice);option.textContent=`${riseTwice/2}:12`;if(riseTwice===8)option.selected=true;$('arch-roof-pitch').append(option);}
$('architecture-button').addEventListener('click',()=>showArchitecture());$('architecture-inspect').addEventListener('click',()=>showArchitecture());$('architecture-close').addEventListener('click',closeArchitecture);$('architecture-dialog').addEventListener('cancel',event=>{event.preventDefault();closeArchitecture();});
$('structural-button').addEventListener('click',()=>showStructuralBridge());$('architecture-structural-open').addEventListener('click',()=>showStructuralBridge());$('structural-close').addEventListener('click',closeStructuralBridge);$('structural-done').addEventListener('click',closeStructuralBridge);$('structural-bridge-dialog').addEventListener('cancel',event=>{event.preventDefault();closeStructuralBridge();});$('structural-form').addEventListener('submit',event=>event.preventDefault());
$('structural-roof-group').addEventListener('change',()=>structuralSelectionChanged({components:true}));$('structural-component').addEventListener('change',()=>structuralSelectionChanged({faces:true}));$('structural-face').addEventListener('change',()=>{const face=structuralGroupRegion()?.faces.find(face=>face.id===$('structural-face').value);if(face?.componentId&&$('structural-component').value!==face.componentId){const id=face.id;$('structural-component').value=face.componentId;structuralSelectionChanged({faces:true});$('structural-face').value=id;}structuralSelectionChanged();});
for(const id of ['structural-member-area','structural-member-label'])$(id).addEventListener('input',()=>structuralSelectionChanged());$('structural-reload').addEventListener('click',()=>loadStructuralSource({preserveArea:true}));$('structural-export').addEventListener('click',()=>structuralExchange('export'));$('structural-import').addEventListener('click',()=>structuralExchange('import'));
$('structural-mode').addEventListener('change',()=>{if(!structuralSourceCurrent()){markStructuralStale();return;}invalidateStructuralDraft();if(!structuralBridge.assignments.length)structuralBridge.assignmentOwner=structuralOwner();renderStructuralAssignments();renderStructuralBridge();});$('structural-assignment-add').addEventListener('click',structuralAddAssignment);$('structural-assignment-clear').addEventListener('click',structuralResetAssignments);$('structural-assignment-review').addEventListener('click',structuralAssignmentPreview);$('structural-assignment-list').addEventListener('input',structuralAssignmentInput);$('structural-assignment-list').addEventListener('change',structuralAssignmentInput);$('structural-assignment-list').addEventListener('click',structuralAssignmentAction);$('structural-request-open').addEventListener('click',()=>structuralExchange('load'));
for(const id of ['structural-boundary-close','structural-boundary-cancel'])$(id).addEventListener('click',closeStructuralBoundary);
$('structural-boundary-dialog').addEventListener('cancel',event=>{event.preventDefault();closeStructuralBoundary();});
$('structural-boundary-add-point').addEventListener('click',structuralBoundaryAddExact);
for(const id of ['structural-boundary-x','structural-boundary-y'])$(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();structuralBoundaryAddExact();}});
function undoStructuralBoundaryVertex(){if(!structuralBoundaryDraft)return;structuralBoundaryDraft.vertices.pop();structuralBoundaryDraft.message='';renderStructuralBoundary();}
$('structural-boundary-undo').addEventListener('click',undoStructuralBoundaryVertex);
$('structural-boundary-clear').addEventListener('click',()=>{if(!structuralBoundaryDraft)return;structuralBoundaryDraft.vertices=[];structuralBoundaryDraft.message='';renderStructuralBoundary();});
$('structural-boundary-outline').addEventListener('click',()=>{const draft=structuralBoundaryDraft;if(!draft)return;if(draft.faceVertices.length>64){draft.message='The current source face has more than 64 vertices. Draw a smaller valid boundary instead.';}else{draft.vertices=structuredClone(draft.faceVertices);draft.message='Exact selected-face outline copied into this editor. Close boundary keeps it in the assignment draft.';}renderStructuralBoundary();});
$('structural-boundary-commit').addEventListener('click',commitStructuralBoundary);
function structuralBoundaryPointer(event){const matrix=$('structural-boundary-svg').getScreenCTM();if(!matrix)return null;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return{x:point.x,y:-point.y};}
$('structural-boundary-svg').addEventListener('click',event=>{if(event.button!==0||!structuralBoundaryDraft)return;if(event.target.getAttribute?.('data-boundary-vertex-index')==='0'&&structuralBoundaryDraft.vertices.length>=3){commitStructuralBoundary();return;}structuralBoundaryAddPoint(structuralBoundaryPointer(event));$('structural-boundary-svg').focus({preventScroll:true});});
$('structural-boundary-svg').addEventListener('pointermove',event=>{const point=structuralBoundaryPointer(event);$('structural-boundary-pointer').textContent=point?`World X ${String(point.x)} ft · Y ${String(point.y)} ft`:'';});
$('structural-boundary-svg').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();undoStructuralBoundaryVertex();}else if(event.key==='Enter'){event.preventDefault();commitStructuralBoundary();}});
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
for(const [id,action]of [['arch-bearing-refresh',()=>inspectArchitectureBearingEdges()],['arch-bearing-confirm',confirmArchitectureBearingEdges],['arch-bearing-reset',resetArchitectureBearingOverrides]])$(id).addEventListener('click',()=>architectureAction(action));
for(const [id,action]of [['arch-pitch-refresh',()=>inspectArchitecturePitchEdges()],['arch-pitch-confirm',confirmArchitecturePitchEdges],['arch-pitch-reset',resetArchitecturePitchOverrides]])$(id).addEventListener('click',()=>architectureAction(action));
for(const id of ['arch-roof-pitch','arch-roof-overhang','arch-roof-rake','arch-roof-bearing','arch-roof-heel'])$(id).addEventListener('input',()=>{architectureBearingConfirmed='';architectureGableDirty();});
$('arch-roof-type').addEventListener('change',architectureGableDirty);$('arch-gable-policy').addEventListener('change',architectureGableDirty);$('arch-roof-source').addEventListener('change',()=>{architectureGableCandidates=null;$('arch-gable-edges').replaceChildren();resetArchitectureBearingDraft();resetArchitecturePitchDraft();architectureGableDirty();});$('arch-gable-refresh').addEventListener('click',()=>architectureAction(()=>inspectArchitectureGableEnds()));$('arch-gable-alternative').addEventListener('change',updateArchitectureGableDetail);$('arch-gable-suggest').addEventListener('click',()=>architectureAction(suggestArchitectureGableEnds));$('arch-gable-confirm').addEventListener('click',()=>architectureAction(confirmArchitectureGableEnds));
$('arch-roof-add').addEventListener('click',()=>architectureAction(architectureCreateRoof));
$('arch-roof-apply').addEventListener('click',()=>architectureAction(applyArchitectureRoof));
$('arch-roof-component-id').addEventListener('change',loadArchitectureRoof);
for(const id of ['arch-roof-min-x','arch-roof-max-x','arch-roof-min-y','arch-roof-max-y'])$(id).addEventListener('input',architectureFootprintDirty);
$('arch-roof-footprint-confirm').addEventListener('click',()=>architectureAction(confirmArchitectureFootprint));
$('arch-roof-drainage-witness').addEventListener('change',updateArchitectureDrainageDetail);$('arch-roof-drainage-show').addEventListener('click',()=>architectureAction(highlightArchitectureDrainage));$('arch-roof-drainage-clear').addEventListener('click',()=>{architectureReviewHighlight=null;updateArchitectureDrainageDetail();draw();});
$('arch-roof-update').addEventListener('click',()=>applyArchitecture({type:'regenerate'}));$('arch-report-refresh').addEventListener('click',refreshArchitectureReport);
$('arch-alternatives-room').addEventListener('change',()=>{invalidateArchitectureAlternatives();loadArchitectureAlternatives({matchRoof:true});});$('arch-alternatives-roof').addEventListener('change',()=>{invalidateArchitectureAlternatives();loadArchitectureAlternatives();});
$('arch-alternatives-mode').addEventListener('change',()=>{invalidateArchitectureAlternatives();loadArchitectureAlternatives();});
for(const id of architectureAlternativeFieldIds.filter(id=>!['arch-alternatives-room','arch-alternatives-roof','arch-alternatives-mode'].includes(id)))$(id).addEventListener('input',()=>invalidateArchitectureAlternatives());
$('arch-alternatives-run').addEventListener('click',searchArchitectureAlternatives);$('arch-alternatives-cancel').addEventListener('click',()=>{architectureAlternativeStudy.search?.cancel();architectureAlternativeStudy.controller?.abort();$('arch-alternatives-progress').textContent+='\nCancellation requested; no drawing edit was made.';});
$('arch-alternatives-review').addEventListener('change',()=>{syncArchitectureAlternatives();architectureAlternativeStudy.reviewedId=$('arch-alternatives-review').checked&&architectureAlternativeApplicable()?architectureAlternativeStudy.selectedId:'';updateArchitectureAlternativeButtons();});
$('arch-alternatives-apply').addEventListener('click',()=>architectureAction(applyArchitectureAlternative));$('arch-alternatives-show-report').addEventListener('click',()=>{$('arch-alternatives-report').hidden=false;$('arch-alternatives-report').textContent=JSON.stringify(architectureAlternativeReport(),null,2);});
$('arch-alternatives-report-layout').addEventListener('change',updateArchitectureAlternativeButtons);$('arch-alternatives-insert-report').addEventListener('click',()=>architectureAction(insertArchitectureAlternativeReport));
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
$('add-layout-button').addEventListener('click',()=>showPageSetup(true));$('page-setup-button').addEventListener('click',()=>showPageSetup(!currentLayout()));$('page-setup-close').addEventListener('click',closePageSetup);$('page-setup-cancel').addEventListener('click',closePageSetup);$('page-setup-dialog').addEventListener('cancel',event=>{event.preventDefault();closePageSetup();});for(const id of ['layout-paper-size','layout-orientation'])$(id).addEventListener('change',refreshPageSetup);for(const id of ['layout-paper-width','layout-paper-height'])$(id).addEventListener('input',refreshPageSetup);
$('page-setup-form').addEventListener('submit',event=>{event.preventDefault();const patch={name:$('layout-name-input').value,paper:pageSetupPaper()},result=pageSetupLayoutId?editor.updateLayout(pageSetupLayoutId,patch):editor.addLayout(patch.name,patch.paper);if(result?.ok===false){$('page-setup-error').textContent=result.message;return;}const created=!pageSetupLayoutId,id=pageSetupLayoutId||result.layoutId;closePageSetup();selectedViewportId=null;enterSpace('paper',id);if(created)fitPaper();resultLog(result);});
$('new-viewport-button').addEventListener('click',()=>{const layout=currentLayout();if(!layout)return;if(!paperSpace())enterSpace('paper',layout.id);runCommand('MVIEW');const shape=$('viewport-shape').value;if(shape==='polygon')runCommand('P');else if(shape==='object')runCommand('O');});
$('space-mode-button').addEventListener('click',()=>{const layout=currentLayout();if(!layout)return;if(currentViewport())enterSpace('paper',layout.id);else{const viewport=selectedViewport()||layout.viewports[0];if(viewport)enterSpace('model',layout.id,viewport.id);else toast('Create a viewport before entering model space on this sheet.');}});
$('viewport-lock-button').addEventListener('click',()=>{const viewport=selectedViewport();if(viewport)resultLog(updateSelectedViewport({locked:!viewport.locked}));});$('viewport-view').addEventListener('change',()=>resultLog(setViewportView($('viewport-view').value)));
$('viewport-scale').addEventListener('change',()=>viewportScaleChoice($('viewport-scale')));$('viewport-custom-scale').addEventListener('input',refreshViewportScalePreview);$('viewport-scale-cancel').addEventListener('click',closeViewportScaleDialog);$('viewport-scale-dialog').addEventListener('cancel',event=>{event.preventDefault();closeViewportScaleDialog();});$('viewport-scale-form').addEventListener('submit',event=>{event.preventDefault();const result=setViewportScale($('viewport-custom-scale').value,{target:viewportScaleTarget});if(result?.ok!==false)closeViewportScaleDialog();});
$('layer-manager-button').addEventListener('click',showLayerManager);$('layer-manager-close').addEventListener('click',closeLayerManager);$('layer-manager-dialog').addEventListener('cancel',event=>{event.preventDefault();closeLayerManager();});$('manager-add-layer').addEventListener('click',()=>$('add-layer').click());
$('units-button').addEventListener('click',()=>{discardRoofGripDraft();runCommand('UNITS');});
$('setting-unit-preset').addEventListener('change',changeUnitPreset);
for(const id of ['setting-units','setting-precision','setting-linear-format','setting-fraction-precision','setting-angular-input','setting-angular-format','setting-angular-precision'])$(id).addEventListener('input',()=>{$('setting-unit-preset').value='custom';refreshUnitPreview();});
$('setting-grid-adaptive').addEventListener('change',()=>$('setting-grid-spacing').disabled=$('setting-grid-adaptive').checked);
$('setting-text-style').addEventListener('change',()=>{if(!captureStyleFields()){$('setting-text-style').value=settingsDraft.textName;return;}settingsDraft.textName=$('setting-text-style').value;displayTextStyleFields();});
$('setting-dim-style').addEventListener('change',()=>{if(!captureStyleFields()){$('setting-dim-style').value=settingsDraft.dimName;return;}settingsDraft.dimName=$('setting-dim-style').value;displayDimStyleFields();});
$('setting-text-font').addEventListener('change',()=>displayAnnotationFontStatus());$('setting-font-refresh').addEventListener('click',()=>void refreshAnnotationFonts());
$('add-text-style').addEventListener('click',()=>createDraftStyle('text'));$('add-dim-style').addEventListener('click',()=>createDraftStyle('dim'));
$('settings-form').addEventListener('submit',event=>{
  event.preventDefault();if(!captureStyleFields())return;
  const patch={...unitFields(),gridEnabled:$('setting-grid').checked,snapEnabled:$('setting-snap').checked,orthoEnabled:$('setting-ortho').checked,gridAdaptive:$('setting-grid-adaptive').checked,gridSpacing:$('setting-grid-spacing').valueAsNumber,snapModes:[...document.querySelectorAll('[data-setting-snap]:checked')].map(box=>box.dataset.settingSnap),textStyles:settingsDraft.textStyles,dimStyles:settingsDraft.dimStyles,currentTextStyle:settingsDraft.textName,currentDimStyle:settingsDraft.dimName};
  const result=resultLog(editor.updateDrawingSettings(patch));if(result?.ok===false){$('settings-error').textContent=result.message;return;}closeSettings();canvas.focus();
});
$('annotation-form').addEventListener('submit',event=>{
  event.preventDefault();const raw=$('annotation-content').value;
  const result=resultLog(annotationEditor?.command&&state().command===annotationEditor.command?editor.submitText(raw):annotationEditor?.type==='LEADER'?editor.setLeaderProperties(annotationEditor.entityId,{text:raw}):editor.setTextProperties(annotationEditor.entityId,annotationEditor?.richText?{richText:{...annotationEditor.richText,source:raw}}:{text:raw}));
  if(result?.ok===false){$('annotation-error').textContent=result.message;return;}closeAnnotationEditor();canvas.focus();
});
$('annotation-close').addEventListener('click',()=>closeAnnotationEditor(true));$('annotation-cancel').addEventListener('click',()=>closeAnnotationEditor(true));$('annotation-dialog').addEventListener('cancel',event=>{event.preventDefault();closeAnnotationEditor(true);});
const referenceLink=document.createElement('button');referenceLink.className='guide-reference';referenceLink.textContent='Search commands, options and examples ↗';referenceLink.addEventListener('click',()=>{$('help-dialog').close();showReference();});$('help-dialog').querySelector('.dialog-heading').after(referenceLink);
$('help-dialog').querySelector('.help-footer').textContent='Clipboard shortcuts copy geometry when the canvas has focus. In text fields they copy or paste text. Use COPYCLIP, CUTCLIP, COPYBASE and PASTECLIP for drawing geometry from the command line. Save a Linecraft drawing to preserve layers, or export DXF for exchange.';
function showHelp(){discardRoofGripDraft();$('help-dialog').showModal();}
$('help-button').addEventListener('click',showHelp);$('show-guide').addEventListener('click',showHelp);$('close-help').addEventListener('click',()=>$('help-dialog').close());
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||documentActionBusy)return;
  if($('structural-bridge-dialog').open||$('architecture-dialog').open||$('help-dialog').open||$('layer-dialog').open||$('reference-dialog').open||$('annotation-dialog').open||$('settings-dialog').open||$('import-dialog').open||$('plot-dialog').open||$('page-setup-dialog').open||$('viewport-scale-dialog').open||$('layer-manager-dialog').open)return;
  const editing=textEditing(event.target);
  if(event.key==='Escape'){event.preventDefault();cancel();input.focus();return;}
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&['Enter',' '].includes(event.key)&&event.target.closest('button,[role="button"],a[href],input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"]')){dismissRoofGripForControl(event);return;}
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
  const commandSurface=event.target===canvas||event.target===document.body||event.target===document.documentElement;
  if(!editing&&commandSurface&&!event.altKey&&['Enter',' '].includes(event.key)){
    event.preventDefault();input.focus({preventScroll:true});
    if(event.key===' '&&state().commandPhase==='text'){input.value+=' ';commandInputChanged();return;}
    submitCommandInput({key:event.key===' '?'Space':'Enter'});return;
  }
  if(!editing&&!event.altKey&&event.key.length===1&&event.key!==' '){event.preventDefault();input.focus();input.value+=event.key;commandInputChanged();}
});
window.addEventListener('beforeunload',event=>{if(!desktop&&isDirty()){event.preventDefault();event.returnValue='';}});
new ResizeObserver(resized).observe(canvas);
const scripting=createScriptingAPI({getEditor:()=>editor,getName:()=>documentName,canEdit:()=>!documentActionBusy&&!ordinaryGripStage&&!drag&&!orbitMode&&!panTool&&!editorDialogOpen()&&!viewportNavigationDraft,onChange:response=>{addLog(response.message,'notice');update();}});
window.linecraft={scripting,getOrdinaryGripState:ordinaryGripState,getObjectSnapState:objectSnapState,getPointAcquisitionState:()=>{const value=objectSnapState();return{eligible:value.available,override:value.override,snap:snap?structuredClone(snap):null};},getStructuralBridgeState:structuralBridgeState,getContextMenuState:contextMenuState,getRoofInteractionState:roofInteractionState,getAlternativeStudy:()=>structuredClone(architectureAlternativeReport()),getRoofReviewState:()=>({highlight:structuredClone(architectureDrainageHighlight())}),get editor(){return editor;},execute:runCommand,fit,getSnapshot:()=>JSON.parse(JSON.stringify(state())),getDocumentState:documentInfo,getDevelopmentState:()=>({...developmentState}),getCommandReference:()=>JSON.parse(JSON.stringify([...commandCatalog,...unavailableCatalog])),getSpaceState:()=>({activeSpace:state().activeSpace,activeLayoutId:state().activeLayoutId,activeViewportId:state().activeViewportId,selectedViewportId:selectedViewport()?.id||null,paperViewport:structuredClone(paperView()),subobjectMode,selectedSubobject:selectedSubobject?structuredClone(selectedSubobject):null,plane:structuredClone(activePlane())}),getViewportNavigationState:()=>({pending:Boolean(viewportNavigationDraft),draft:viewportNavigationDraft?structuredClone(viewportNavigationDraft):null}),getModelEntities:()=>structuredClone(modelEntities()),getPaperEntities:id=>structuredClone(editor.getPaperEntities(id)),projectPaper:point=>paperToScreen(point),get3DState:()=>({camera:structuredClone(camera3D()),workspace:state().workspace,orbitMode,pivot:orbitPivot?{...orbitPivot}:null,constructionElevation:state().settings?.constructionElevation,documentActionBusy,importedAwaitingSave}),project:point=>toScreen(point),acquire:screen=>toWorld(screen),runAction,canvas};
window.linecraft.getAnnotationFontState=()=>structuredClone(annotationFontState);
window.linecraft.getCommandCompletionState=commandCompletionState;
window.linecraft.getGripAcquisitionState=gripAcquisitionState;
window.linecraft.getTrimInteractionState=()=>({engine:editor.getTrimState?.()||null,extend:trimPointerExtend,gesture:drag?.mode==='trim-gesture'?{points:drag.points.map(point=>({...point})),extend:drag.extend,moved:drag.moved}:null});
window.linecraft.getRasterImageState=()=>state().imageResources?.map(resource=>{const image=rasterImages.get(resource.dataURL);return{id:resource.id,name:resource.name,width:resource.width,height:resource.height,embedded:Boolean(resource.dataURL),decoded:Boolean(image?.complete&&image.naturalWidth>0),decodeError:image?.linecraftError===true};})||[];
window.linecraft.getFileOpenState=getFileOpenState;
window.linecraft.getPlotState=()=>({open:$('plot-dialog').open,mode:plotMode,source:plotSavedDrawings()?'saved':'current',space:plotLayoutSet()?'layouts':$('plot-space').value,orderedLayoutIds:plotLayoutDraft?.editor===editor?plotLayoutDraft.entries.filter(row=>row.selected).map(row=>row.id):[],layoutOrder:plotLayoutDraft?.editor===editor?plotLayoutDraft.entries.map(row=>({...row})):[],previewIndex:plotPreviewIndex,previewSheets:plotPreviewSheets.map(sheet=>structuredClone(sheet.report)),submitting:plotSubmitting,sheetSetId:plotLayoutDraft?.editor===editor?plotLayoutDraft.selectedSheetSetId||null:null,sheetSetNameDraft:plotLayoutDraft?.editor===editor?activePlotSheetDraft().name:'',sheetSetModified:plotLayoutDraft?.editor===editor?plotSheetSetModified():false,sheetSetMissingLayoutIds:plotLayoutDraft?.editor===editor?[...(plotSheetSetInspection()?.missingLayoutIds||[])]:[],sheetSets:structuredClone(plotSheetSets()),sheetSetError:$('plot-sheet-set-error').textContent});
if(desktop){desktop.onAction(action=>runAction(action));if(desktop.onOpenRequest&&desktop.openRequest)desktop.onOpenRequest(()=>scheduleFileOpen());document.querySelector('.local-badge').lastChild.textContent=' Desktop workspace';}
addLog('Linecraft CAD · New drawing ready.');
addLog('Draw, modify and place geometry. Open Commands to search supported tools, options and examples.');
update();resized();input.focus();void refreshAnnotationFonts().finally(()=>scheduleFileOpen());
