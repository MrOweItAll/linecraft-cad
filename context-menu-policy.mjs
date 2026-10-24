// Original, data-only providers. Opening a menu never executes an editor request.
export function commandPromptOptions(prompt='') {
  const options=[];
  for(const group of String(prompt).matchAll(/\[([^\]]+)\]/g))for(const part of group[1].split('/')){
    const token=part.trim();if(/^[A-Za-z0-9][A-Za-z0-9 -]{0,47}$/.test(token)&&!options.includes(token))options.push(token);
  }
  return options;
}
const item=(id,label,description,enabled=true,reason='')=>({id,label,description,enabled:Boolean(enabled),reason:enabled?'':reason});
const submenu=(id,label,description,children,reason='No actions are available in this context.')=>({...item(id,label,description,children.some(child=>child.enabled),reason),type:'submenu',children});
const snapChoices=[
  ['endpoint','Endpoint','Acquire an existing object endpoint for the next point.'],
  ['midpoint','Midpoint','Acquire the midpoint of a supported segment for the next point.'],
  ['center','Center','Acquire the center of a supported circle or arc for the next point.'],
  ['quadrant','Quadrant','Acquire a supported circular quadrant for the next point.'],
  ['perpendicular','Perpendicular','Acquire the exact perpendicular foot from the accepted base point to a supported edge or curve.'],
  ['none','None','Ignore object snaps for the next point; retain the drawing running-snap settings.'],
  ['running','Use running object snaps','Clear the temporary override and use the drawing running-snap settings.']
];
function snapItems(c){
  const enabled=c.pointPrompt===true,selected=snapChoices.some(([mode])=>mode===c.snapOverride)?c.snapOverride:'running';
  return snapChoices.map(([mode,label,description])=>({...item(`snap:${mode}`,label,description,enabled&&(mode!=='perpendicular'||c.perpendicularAvailable!==false),enabled&&mode==='perpendicular'&&c.perpendicularAvailable===false?'Specify a base point first; deferred perpendicular is not available.':'Object snap overrides are available only when a command requests a point.'),type:'radio',checked:selected===mode,mode}));
}
export function buildObjectSnapMenu(context={}) {return{context:'object-snap',title:'Object snap override',items:snapItems(context)};}
function modifyItems(s){
  const enabled=Boolean(s.canModify),reason=s.reason||'Select complete editable ordinary objects to modify them.';
  return submenu('modify','Modify','Modify the selected objects through the existing drawing commands.',[
    item('command:MOVE','Move','MOVE (M): reposition the selection from a base point to a destination.',enabled,reason),
    item('command:COPY','Copy objects','COPY (CO, CP): place a duplicate of the selection from a base point.',enabled,reason),
    item('command:ROTATE','Rotate','ROTATE (RO): rotate the selection about a base point.',enabled,reason),
    item('command:SCALE','Scale','SCALE (SC): resize the selection about a base point.',enabled,reason),
    item('command:MIRROR','Mirror','MIRROR (MI): reflect the selection across a line.',enabled&&Boolean(s.canMirror),s.mirrorReason||reason)
  ],reason);
}
function navigationItems(c){return submenu('navigation','Navigate','Navigate the current drawing space without modifying geometry.',[
  item('command:PAN','Pan','PAN (P): drag to move the view; Enter or Escape leaves navigation.'),
  item('fit','Zoom extents','ZOOM Extents (Z, E): fit visible geometry in the current drawing space.'),
  ...(!c.space?.paper&&c.space?.workspace==='3d'?[item('command:3DORBIT','3D orbit','3DORBIT: rotate the model view about the current navigation target.')]:[])
]);}
function viewportItems(c){
  const v=c.viewport;if(!v?.id)return[];
  const enabled=Boolean(v.canEdit),reason=v.reason||'This viewport cannot be edited in the current drawing state.',scaleEnabled=enabled&&!v.locked,scaleReason=enabled&&v.locked?'Unlock the viewport before changing its scale.':reason,seen=new Set(),scales=[];
  let matched=false;
  for(const scale of Array.isArray(v.scales)?v.scales:[]){
    if(!scale||typeof scale.id!=='string'||!scale.id||seen.has(scale.id)||typeof scale.label!=='string'||!scale.label||!Number.isFinite(scale.denominator)||scale.denominator<=0)continue;
    seen.add(scale.id);
    const checked=!matched&&Number.isFinite(v.scaleDenominator)&&Math.abs(v.scaleDenominator-scale.denominator)<=Math.max(1,Math.abs(scale.denominator))*1e-9;
    if(checked)matched=true;
    scales.push({...item(`scale:${scale.id}`,scale.label,`Set this viewport to ${scale.label}; preserve the model geometry and sheet size.`,scaleEnabled,scaleReason),type:'radio',checked,denominator:scale.denominator});
  }
  return[
    {...item('viewport-lock',v.locked?'Unlock viewport':'Lock viewport',v.locked?'Allow navigation to change this viewport view and scale.':'Protect this viewport view and scale from accidental navigation.',enabled,reason),type:'checkbox',checked:Boolean(v.locked)},
    submenu('viewport-scale','Viewport scale','Choose a standard scale for this viewport.',scales,scales.length?scaleReason:'No standard viewport scales are available.')
  ];
}
const providers=[
  {matches:c=>c.operation?.kind==='ordinary-grip',build:c=>({context:'ordinary-grip',title:'Grip stretch',items:[
    item('grip:accept','Place preview','Validate this destination and commit one normal Undo step.',c.operation.canFinish===true,c.operation.reason||'Specify a valid destination first.'),
    submenu('snaps','Snap overrides','Choose a temporary snap from the exact source handle.',snapItems(c)),
    item('cancel','Cancel grip edit','Discard the provisional grip preview and keep the accepted drawing.')
  ]})},
  {matches:c=>Boolean(c.operation),build:c=>({context:c.operation.kind,title:c.operation.title||'Current operation',items:[
    item('finish',c.operation.kind==='roof-grip'?'Place footprint':'Finish navigation',c.operation.kind==='roof-grip'?'Validate the latest footprint and place it as one Undo step.':'Leave the current navigation tool.',c.operation.canFinish!==false,c.operation.reason||'Correct the footprint input before placing it.'),
    ...(c.operation.kind==='roof-grip'&&c.operation.typed?[item('pointer','Use pointer input','Clear typed XY and resume pointer acquisition on the fixed bearing plane.')]:[]),
    item('cancel','Cancel current operation','Discard this draft and keep the accepted drawing.')
  ]})},
  {matches:c=>Boolean(c.command),build:c=>({context:'command',title:c.command,items:[
    item('enter','Enter / Continue','Submit the command field, or send Enter to use the current prompt default.'),
    ...commandPromptOptions(c.prompt).map(token=>({...item(`option:${token}`,token,`Send ${token} to the current ${c.command} prompt.`),token})),
    ...(c.pointPrompt===true?[submenu('snaps','Snap overrides','Choose an object snap for the next point without changing running settings.',snapItems(c))]:[]),
    item('cancel','Cancel current command','Cancel this command through the existing editor path.')
  ]})},
  {matches:c=>c.selection?.count>0,build:c=>{
    const s=c.selection,hasViewport=Boolean(s.hasViewport||s.viewport),protectedReason=hasViewport?'Viewport frames cannot be transferred through the drawing clipboard.':s.reason||'This selection contains protected or locked resources.',canCopy=Boolean(s.canCopy)&&!hasViewport,canCut=Boolean(s.canCut)&&!hasViewport;
    return{context:s.component?'roof-component':s.generated?'architectural-source':s.viewport?'viewport':'selection',title:s.component?'Roof component':s.generated?'Architectural source':s.viewport?'Paper viewport':`${s.count} selected object${s.count===1?'':'s'}`,items:[
      ...(s.component?[item('edit-component','Edit selected roof component','Open the semantic component footprint and roof controls.')]:s.generated?[item('edit-source','Edit architectural source','Edit the source that owns the generated geometry.',Boolean(s.singleOwner),'Select geometry from one source owner to open its editor.')]:[]),
      ...(s.component?[item('structural-bridge','Structural roof comparison','Export this source region with an explicit member tributary area for an optional external calculation.')]:[]),
      item('properties','Properties','Focus the inspector for the current selection.'),
      modifyItems(s),
      item('copy','Copy to clipboard','COPYCLIP: copy complete ordinary objects to the drawing clipboard.',canCopy,protectedReason),
      item('command:COPYBASE','Copy with base point','COPYBASE: copy complete ordinary objects to the drawing clipboard using a specified base point.',canCopy,protectedReason),
      item('cut','Cut to clipboard','CUTCLIP: copy and remove complete ordinary objects using the existing clipboard transaction.',canCut,protectedReason),
      item('paste','Paste','Start placing drawing clipboard geometry.'),
      item('delete','Erase selection','Erase the complete editable selection as one editor operation.',Boolean(s.canDelete),protectedReason),
      ...(s.viewport?[item('viewport-model','Enter model through viewport','Activate model space through this selected paper viewport.')]:[]),
      ...spaceItems(c),navigationItems(c),...historyItems(c)
    ]};
  }},
  {matches:()=>true,build:c=>({context:c.space?.viewportId?'model-viewport':c.space?.paper?'paper':'model',title:c.space?.viewportId?'Model viewport':c.space?.paper?'Paper space':'Model space',items:[
    item('repeat',c.repeat?`Repeat ${c.repeat}`:'Repeat last drawing command','Start the most recent drawing tool again.',Boolean(c.repeat),'Start a drawing command first.'),
    item('paste','Paste','Start placing drawing clipboard geometry.'),...spaceItems(c),
    navigationItems(c),
    item('properties','Properties','Focus the drawing inspector.'),
    item('layers','Layer manager','Inspect layer visibility, colors, line types and line weights in this space.'),
    ...historyItems(c)
  ]})}
];
function historyItems(c){return[item('undo','Undo','Undo the previous accepted edit.',Boolean(c.canUndo),'There is no edit to undo.'),item('redo','Redo','Redo the next accepted edit.',Boolean(c.canRedo),'There is no edit to redo.')];}
function spaceItems(c){return[...viewportItems(c),...(c.space?.viewportId?[item('paper','Return to paper space','PSPACE: leave the model viewport and manipulate the sheet and viewport frames.')]:c.space?.paper?[item('page-setup','Page setup','PAGESETUP: edit this layout paper size and orientation.')]:[])];}
export function buildCanvasContextMenu(context={}) {return providers.find(provider=>provider.matches(context)).build(context);}
export function menuContextSignature(context={}) {return JSON.stringify(context);}
