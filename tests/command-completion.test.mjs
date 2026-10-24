import test from 'node:test';
import assert from 'node:assert/strict';
import {commandCompletions,promptCompletionOptions,commandPointSnapToken,completionPointerMoved,commandInputSubmission,nextRepeatableCommand} from '../command-completion.mjs';
import {createEditor} from '../core.mjs';
const catalog=[{name:'LINE',aliases:['L'],summary:'Draw line.'},{name:'LAYER',aliases:['LA'],summary:'Layers.'},{name:'CIRCLE',aliases:['C']},{name:'COPY',aliases:['CO','CP']},{name:'CHAMFER',aliases:['CHA']},{name:'MTEXT',aliases:['MT']},{name:'MOVE',aliases:['M']}];
test('exact aliases and names outrank longer command-name matches',()=>{
  assert.equal(commandCompletions(catalog,{input:'m'})[0].name,'MOVE');
  assert.equal(commandCompletions(catalog,{input:'c'})[0].name,'CIRCLE');
  assert.equal(commandCompletions(catalog,{input:'co'})[0].name,'COPY');
  assert.equal(commandCompletions(catalog,{input:'line'})[0].name,'LINE');
  assert.deepEqual(commandCompletions(catalog,{input:'l'}).map(choice=>choice.name),['LINE','LAYER']);
});
test('command prefixes are accepted while coordinates and multi-token instructions stay literal',()=>{
  assert.equal(commandCompletions(catalog,{input:'_.li'})[0].token,'LINE');
  for(const input of ['12','12,6','@2,3','@12<30',"12'",'LINE 0,0','<script>',''])assert.deepEqual(commandCompletions(catalog,{input}),[]);
});
test('only actual current-prompt options are completed during a command',()=>{
  const params={command:'LINE',prompt:'LINE Specify next point or [Close/Undo]:',phase:'next-point'};
  assert.equal(commandCompletions(catalog,{...params,input:'u'})[0].token,'Undo');
  assert.equal(commandCompletions(catalog,{...params,input:'c'})[0].token,'Close');
  assert.deepEqual(commandCompletions(catalog,{...params,input:'move'}),[]);
  assert.deepEqual(commandCompletions(catalog,{...params,input:'2,4'}),[]);
  assert.equal(commandCompletions(catalog,{...params,input:'',force:true}).length,2);
});
test('freeform text contents never become command or option suggestions',()=>{
  for(const command of ['TEXT','MTEXT'])for(const input of ['LINE','Undo','Close','m'])assert.deepEqual(commandCompletions(catalog,{command,input,prompt:'[Undo/Close]',phase:'text',force:true}),[]);
});
test('AutoCAD-style internal capitals expose current option shortcuts without guessed options',()=>{
  const prompt='Select object or [cuTting edges/Crossing/Mode/Project/eRase/Undo]:';
  assert.equal(commandCompletions(catalog,{input:'t',command:'TRIM',prompt})[0].token,'cuTting edges');
  assert.equal(commandCompletions(catalog,{input:'r',command:'TRIM',prompt})[0].token,'eRase');
  assert.deepEqual(promptCompletionOptions('[Undo/Undo/12/0.5] [No Extend/Extend]').map(choice=>choice.name),['Undo','No Extend','Extend']);
});
test('suggestions are bounded copies and cannot edit command catalog records',()=>{
  const before=JSON.stringify(catalog),items=commandCompletions(catalog,{input:'',force:true,limit:3});
  assert.equal(items.length,3);items[0].name='changed';assert.equal(JSON.stringify(catalog),before);
  assert.deepEqual(commandCompletions(catalog,{input:'l',limit:0}),[]);
});
test('completion hover requires observed coordinate movement rather than layout entrance or an unknown baseline',()=>{
  const pointer={x:689.4,y:526.85,pointerId:1};
  assert.equal(completionPointerMoved(null,pointer),false);
  assert.equal(completionPointerMoved(pointer,{...pointer}),false);
  assert.equal(completionPointerMoved(pointer,{...pointer,x:pointer.x+1}),true);
  assert.equal(completionPointerMoved(pointer,{...pointer,y:pointer.y-1}),true);
  assert.equal(completionPointerMoved(pointer,{...pointer,pointerId:2,x:pointer.x+1}),false);
  assert.equal(completionPointerMoved(pointer,{...pointer,x:NaN}),false);
});
test('typed point-snap completions are contextual and Perpendicular requires an accepted base',()=>{
  const params={command:'LINE',phase:'next-point',pointPrompt:true,prompt:'Specify point or [Undo/Close]:'};
  assert.deepEqual(commandCompletions(catalog,{...params,input:'per'}),[]);
  assert.equal(commandCompletions(catalog,{...params,input:'per',perpendicularAvailable:true})[0].token,'PER');
  assert.equal(commandCompletions(catalog,{...params,input:'mid'})[0].token,'MID');
  assert.equal(commandCompletions(catalog,{...params,input:'c'})[0].kind,'option');
  assert.deepEqual(commandCompletions(catalog,{...params,input:'mid',pointPrompt:false}),[]);
});
test('current option names and shortcuts precede snap names while exact snap tokens outrank option prefixes',()=>{
  const ellipse={command:'ELLIPSE',pointPrompt:true,prompt:'ELLIPSE Specify first-axis endpoint or [Center]:'};
  for(const input of['C','Center','center']){
    const choice=commandCompletions(catalog,{...ellipse,input})[0];assert.equal(choice.kind,'option');assert.equal(choice.token,'Center');
    assert.equal(commandPointSnapToken(choice.token,ellipse),null);assert.equal(commandPointSnapToken(input,ellipse),null);
  }
  for(const input of['Center','_Center','_.Center','.Center'])assert.equal(commandPointSnapToken(input,ellipse),null);
  const snap=commandCompletions(catalog,{...ellipse,input:'CEN'})[0];assert.equal(snap.kind,'snap');assert.equal(snap.token,'CEN');assert.equal(commandPointSnapToken(snap.token,ellipse),'center');
  const line={command:'LINE',pointPrompt:true,prompt:'LINE Specify next point or [Close/Undo]:'};
  for(const context of[ellipse,line])for(const input of['CEN','_CEN','_.CEN','.CEN'])assert.equal(commandPointSnapToken(input,context),'center');
  for(const input of['CEN','CENTER'])assert.equal(commandPointSnapToken(input,line),'center');
  assert.equal(commandPointSnapToken('CEN',{...line,pointPrompt:false}),null);assert.equal(commandPointSnapToken('CEN',{...line,command:null}),null);
});
test('all exact current bracket labels and shortcuts retain command ownership without loose-prefix guesses',()=>{
  const context={command:'SYNTHETIC',pointPrompt:true,prompt:'Specify point or [Center/Endpoint/Midpoint/Quadrant/Perpendicular/None/cuTting edges/eRase]:'};
  for(const option of promptCompletionOptions(context.prompt))for(const input of[option.name,...option.aliases])assert.equal(commandPointSnapToken(input,context),null);
  assert.equal(commandPointSnapToken('CEN',context),'center');assert.equal(commandPointSnapToken('PER',context),'perpendicular');assert.equal(commandPointSnapToken('NON',context),'none');
  assert.equal(commandPointSnapToken('CENT',context),null);
});
test('real ELLIPSE Center completion reaches the engine center phase and preserves the declared center',()=>{
  for(const input of['C','Center','_Center','_.Center','.Center']){
    const editor=createEditor();assert.equal(editor.execute('EL').ok,true);
    const context={command:editor.state.command,prompt:editor.state.prompt,pointPrompt:true},token=commandCompletions(catalog,{...context,input})[0]?.token||input;
    assert.equal(commandPointSnapToken(token,context),null);assert.equal(editor.execute(token).ok,true);assert.equal(editor.state.commandPhase,'ellipse-center');
    for(const token of['80,0','90,0','20'])assert.equal(editor.execute(token).ok,true);
    const ellipse=editor.state.entities[0];assert.deepEqual(ellipse.center,{x:80,y:0});assert.equal(Math.abs(ellipse.major.x),0);assert.equal(ellipse.major.y,20);assert.equal(ellipse.ratio,.5);
  }
});
test('Enter and Space submit the same command, coordinates, options and running defaults',()=>{
  for(const params of [{input:'li',selectedToken:'LINE'},{input:'12,6',command:'LINE',phase:'next-point'},{input:"12'6\",0",command:'LINE',phase:'next-point'},{input:'u',selectedToken:'Undo',command:'LINE',phase:'next-point'},{input:'',command:'CIRCLE',phase:'radius'}])assert.deepEqual(commandInputSubmission({...params,key:'Space'}),commandInputSubmission({...params,key:'Enter'}));
});
test('empty idle Enter and Space repeat only the accepted repeatable command',()=>{
  for(const key of ['Enter','Space']){
    assert.deepEqual(commandInputSubmission({key,input:'',lastRepeatable:'LINE'}),{kind:'repeat',value:'LINE'});
    assert.deepEqual(commandInputSubmission({key,input:'   ',lastRepeatable:'LINE',selectedToken:'ERASE'}),{kind:'repeat',value:'LINE'});
    assert.deepEqual(commandInputSubmission({key,input:'',lastRepeatable:null}),{kind:'submit',value:''});
    assert.deepEqual(commandInputSubmission({key,input:'',command:'TRIM',lastRepeatable:'LINE',selectedToken:'Undo'}),{kind:'submit',value:''});
    assert.deepEqual(commandInputSubmission({key,input:'',navigation:true,lastRepeatable:'LINE'}),{kind:'submit',value:''});
  }
});
test('Space is literal in text content while Enter preserves and submits the complete raw text',()=>{
  const input='  First note line  ';
  assert.deepEqual(commandInputSubmission({key:'Space',input,command:'TEXT',phase:'text',selectedToken:'LINE'}),{kind:'literal',value:' '});
  assert.deepEqual(commandInputSubmission({key:'Enter',input,command:'TEXT',phase:'text'}),{kind:'submit',value:input});
});
test('held editing gestures cannot dispatch commands; roof typed input follows the existing Enter path',()=>{
  for(const dragMode of ['grip','subobject-grip','trim-gesture','box','pan','orbit'])assert.equal(commandInputSubmission({key:'Space',input:'',lastRepeatable:'LINE',dragMode}).kind,'blocked');
  assert.deepEqual(commandInputSubmission({key:'Space',input:"12'6\",10'",dragMode:'roof-component-grip',lastRepeatable:'LINE'}),{kind:'submit',value:"12'6\",10'"});
});

const repeatCatalog=[
  {name:'LINE',aliases:['L'],group:'Draw'},{name:'ERASE',aliases:['E'],group:'Modify'},
  {name:'EXPLODE',aliases:['X'],group:'Modify'},{name:'UNDO',aliases:['U'],group:'Modify'},
  {name:'REDO',aliases:['MREDO'],group:'Modify'},{name:'TRIMEXTENDMODE',aliases:[],group:'Settings'},
  {name:'PUBLISH',aliases:[],group:'Output'},{name:'PSPACE',aliases:['PS'],group:'Navigate'},
  {name:'ZOOM',aliases:['Z'],group:'Navigate'}
];
test('successful immediate drawing edits replace the previous repeatable tool with their canonical name',()=>{
  for(const [command,name]of[['ERASE','ERASE'],['e','ERASE'],['_.E','ERASE'],['EXPLODE','EXPLODE'],['X','EXPLODE']])
    assert.equal(nextRepeatableCommand(repeatCatalog,{previous:'LINE',command,starting:true,accepted:true}),name);
  assert.equal(nextRepeatableCommand(repeatCatalog,{previous:'ERASE',command:'L',activeCommand:'LINE',starting:true,accepted:true}),'LINE');
  assert.equal(nextRepeatableCommand(repeatCatalog,{previous:'LINE',command:'Z',activeCommand:'ZOOM',starting:true,accepted:true}),'ZOOM');
});
test('failed starts options settings history and immediate output/navigation retain the accepted drawing tool',()=>{
  for(const params of[
    {command:'ERASE',starting:true,accepted:false},
    {command:'ERASE',starting:false,accepted:true},
    {command:'Undo',activeCommand:'LINE',starting:false,accepted:true},
    ...['UNDO','U','REDO','MREDO','PUBLISH','PSPACE','missing'].map(command=>({command,starting:true,accepted:true})),
    {command:'TRIMEXTENDMODE',activeCommand:'TRIMEXTENDMODE',starting:true,accepted:true}
  ])assert.equal(nextRepeatableCommand(repeatCatalog,{previous:'LINE',...params}),'LINE');
});
test('real preselected ERASE finishes immediately and the shared blank Enter/Space path repeats ERASE',()=>{
  const editor=createEditor();for(const token of['LINE','0,0','20,0',''])assert.equal(editor.execute(token).ok,true);
  const id=editor.state.entities[0].id;assert.equal(editor.select([id]).ok,true);
  const result=editor.execute('E');assert.equal(result.ok,true);assert.equal(editor.state.command,null);assert.equal(editor.state.entities.length,0);
  const remembered=nextRepeatableCommand(repeatCatalog,{previous:'LINE',command:'E',activeCommand:editor.state.command,starting:true,accepted:result.ok});
  for(const key of['Enter','Space']){
    const decision=commandInputSubmission({key,input:'',lastRepeatable:remembered});
    assert.deepEqual(decision,{kind:'repeat',value:'ERASE'});assert.equal(editor.execute(decision.value).ok,true);assert.equal(editor.state.command,'ERASE');editor.cancel();
  }
  assert.equal(editor.undo().ok,true);assert.equal(editor.state.entities[0].id,id);
});
