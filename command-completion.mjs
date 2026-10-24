// Original, bounded command/prompt suggestions. This module never executes input.
const normalized=value=>String(value??'').trim().toUpperCase();
const descriptions={UNDO:'Undo the last change within this command.',CLOSE:'Close this path to its first point.',EXIT:'Finish this command.',MODE:'Choose the command interaction mode.',PROJECT:'Choose the intersection projection.',EDGE:'Choose actual or implied cutting edges.',FENCE:'Pick an open fence across objects.',CROSSING:'Pick opposite corners of a crossing selection.',ERASE:'Remove selected objects without leaving this command.',DIAMETER:'Specify the circle diameter instead of its radius.',QUICK:'Use all eligible objects as cutting boundaries.',STANDARD:'Select cutting boundaries before editing targets.'};
export function promptCompletionOptions(prompt=''){
  const choices=[];
  for(const match of String(prompt).matchAll(/\[([^\]]+)\]/g))for(const part of match[1].split('/')){
    const label=part.trim();
    if(!/^[A-Za-z][A-Za-z0-9 -]{0,47}$/.test(label)||choices.some(choice=>normalized(choice.name)===normalized(label)))continue;
    const capitals=label.match(/[A-Z]/g)?.join('')||label[0].toUpperCase();
    choices.push({name:label,token:label,aliases:[capitals],kind:'option',summary:descriptions[normalized(label).replace(/\s+/g,'')]||`Use ${label} at the current command prompt.`});
  }
  return choices;
}
function rank(choice,term){
  const name=normalized(choice.name),aliases=(choice.aliases||[]).map(normalized);
  if(name===term||normalized(choice.token)===term)return 0;
  if(aliases.includes(term))return 1;
  if(name.startsWith(term))return 2;
  if(aliases.some(alias=>alias.startsWith(term)))return 3;
  return Infinity;
}
export function commandCompletions(catalog,{input='',command=null,prompt='',phase=null,pointPrompt=false,perpendicularAvailable=false,force=false,limit=9}={}){
  if(!Array.isArray(catalog)||!Number.isInteger(limit)||limit<1||limit>100)return[];
  // TEXT/MTEXT contents are literal; numbers, coordinates, polar input and a
  // complete multi-token command remain owned by the existing command parser.
  const term=normalized(input).replace(command?/^$/:/^[_\.]+/,'');
  if(['text','clipboard-ready'].includes(phase)||!term&&!force||term&&!/^[A-Z][A-Z0-9 -]*$/.test(term)||!command&&/\s/.test(term))return[];
  const choices=command?promptCompletionOptions(prompt).map(choice=>({...choice,group:`${command} option`})):
    catalog.map(choice=>({...choice,token:choice.name,kind:'command'}));
  if(command&&pointPrompt)for(const[name,token,aliases,summary]of[
    ['Endpoint','ENDP',['END','ENDPOINT'],'Acquire an existing endpoint for the next point.'],
    ['Midpoint','MID',['MIDPOINT'],'Acquire a segment midpoint for the next point.'],
    ['Center','CEN',['CENTER'],'Acquire a circular center for the next point.'],
    ['Quadrant','QUA',['QUADRANT'],'Acquire a circular quadrant for the next point.'],
    ['Perpendicular','PER',['PERP','PERPENDICULAR'],'Acquire a perpendicular foot from the accepted base point.'],
    ['None','NON',['NONE'],'Ignore object snaps for the next point.']
  ]){if(name==='Perpendicular'&&!perpendicularAvailable)continue;choices.push({name,token,aliases,summary,kind:'snap',group:'Next-point snap'});}
  return choices.map((choice,index)=>({choice,index,rank:term?rank(choice,term):4}))
    .filter(choice=>Number.isFinite(choice.rank))
    .sort((a,b)=>a.rank-b.rank||a.choice.name.localeCompare(b.choice.name)||a.index-b.index)
    .slice(0,limit).map(({choice})=>choice);
}
const pointSnapTokens=Object.freeze({END:'endpoint',ENDP:'endpoint',ENDPOINT:'endpoint',MID:'midpoint',MIDPOINT:'midpoint',CEN:'center',CENTER:'center',QUA:'quadrant',QUADRANT:'quadrant',PER:'perpendicular',PERP:'perpendicular',PERPENDICULAR:'perpendicular',NON:'none',NONE:'none'});
/** Actual current options own their exact labels/shortcuts before snap names. */
export function commandPointSnapToken(raw,{command=null,prompt='',pointPrompt=false}={}){
  if(!command||!pointPrompt)return null;
  const token=normalized(raw).replace(/^[_\.]+/,'');
  if(promptCompletionOptions(prompt).some(option=>normalized(option.name)===token||option.aliases.some(alias=>normalized(alias)===token)))return null;
  return pointSnapTokens[token]||null;
}
/** A rebuilt list entering a parked pointer is not an intentional choice. */
export function completionPointerMoved(previous,current){
  return Boolean(previous&&current&&[previous.x,previous.y,current.x,current.y].every(Number.isFinite)&&
    (previous.pointerId??null)===(current.pointerId??null)&&(previous.x!==current.x||previous.y!==current.y));
}
/** Pure command-field key policy; parsing and every edit remain in the engine. */
export function commandInputSubmission({key='Enter',input='',command=null,phase=null,selectedToken=null,lastRepeatable=null,navigation=false,dragMode=null}={}){
  const raw=String(input??''),space=key==='Space'||key===' ';
  if(space&&phase==='text')return{kind:'literal',value:' '};
  if(phase==='text')return{kind:'submit',value:raw};
  if(dragMode&&dragMode!=='roof-component-grip')return{kind:'blocked',value:null};
  // Blank accepts a running prompt's default. A merely displayed first option
  // must never replace that default or turn an empty idle key into a new tool.
  const value=raw.trim()&&typeof selectedToken==='string'&&selectedToken?selectedToken:raw;
  if(!command&&!navigation&&!dragMode&&!value.trim()&&typeof lastRepeatable==='string'&&lastRepeatable)return{kind:'repeat',value:lastRepeatable};
  return{kind:'submit',value};
}

const immediateRepeatGroups=new Set(['Draw','Model','Annotate','Measure','Modify','Blocks','Clipboard']);
const historyCommands=new Set(['UNDO','REDO','MREDO']);
/** Remember the accepted tool, including edits completed from a preselection. */
export function nextRepeatableCommand(catalog,{previous=null,command=null,activeCommand=null,starting=false,accepted=false}={}){
  if(!starting||accepted!==true||!Array.isArray(catalog))return previous;
  const token=normalized(activeCommand||command).replace(/^[_\.]+/,'');
  const item=catalog.find(candidate=>normalized(candidate.name)===token||(candidate.aliases||[]).some(alias=>normalized(alias)===token));
  if(!item||item.group==='Settings'||historyCommands.has(normalized(item.name)))return previous;
  // Preserve interactive-tool repetition. Only ordinary drawing-command groups
  // also qualify when an existing selection lets them finish immediately.
  return activeCommand||immediateRepeatGroups.has(item.group)?item.name:previous;
}
