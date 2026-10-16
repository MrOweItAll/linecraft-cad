'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Default test launches are hidden. A visible test requires an explicit argument
// on the test driver itself; normal application launches do not read test env vars.
const visible=process.argv.includes('--linecraft-test-visible');
function prepareLaunch(options){
  const args=[...(options.args??[])];
  if(!visible){
    const entry=args.find(value=>typeof value==='string'&&/\.cjs$/i.test(value)&&fs.existsSync(value));
    const bytes=entry?fs.readFileSync(entry):fs.readFileSync(path.join(path.dirname(options.executablePath),'resources','app.asar'));
    if(!bytes.includes(Buffer.from("process.argv.includes('--linecraft-test-hidden')")))throw Error('This executable/source does not support guaranteed hidden test startup. Use the current source or a newly packaged build; no process was launched.');
    args.push('--linecraft-test-hidden');
  }
  return{...options,args};
}
async function recordVisibility(app,report){
  const snapshot=await app.evaluate(({app,BrowserWindow})=>{
    globalThis.__linecraftTestVisibility={showEvents:0};
    app.on('browser-window-created',(_event,window)=>window.on('show',()=>globalThis.__linecraftTestVisibility.showEvents++));
    return BrowserWindow.getAllWindows().map(window=>window.isVisible());
  });
  report.hiddenWindowRequested=!visible;report.initialWindowVisibility=snapshot;
  report.windowScope=visible?'Visible desktop test launch.':'Trusted hidden-test startup with an offscreen Chromium compositor. Ordinary visible desktop startup is not exercised by this run.';
  report.hiddenRenderMode=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(window=>window.webContents?.isOffscreen?.()?'offscreen':'standard'));
  if(!visible){assert.ok(snapshot.length>0&&snapshot.every(value=>value===false),'Test application unexpectedly displayed a window.');report.hiddenWindowVerified=true;}
}
async function verifyVisibility(app,report){
  const snapshot=await app.evaluate(({BrowserWindow})=>({visible:BrowserWindow.getAllWindows().map(window=>window.isVisible()),showEvents:globalThis.__linecraftTestVisibility?.showEvents??0}));report.finalWindowVisibility=snapshot;
  if(!visible){assert.ok(snapshot.visible.every(value=>value===false));assert.equal(snapshot.showEvents,0,'A window became visible during a hidden test.');}
}
async function finalizeVisibility(app,report){
  try{await verifyVisibility(app,report);}
  catch(error){report.tests.push({name:'Hidden native-window guarantee',status:'failed',error:error.stack||String(error)});}
}
async function captureScreenshot(app,page,filename){
  if(visible)return page.screenshot({path:filename,timeout:20000});
 let outerTimer;
 try{
  const captured=await Promise.race([
   app.evaluate(async({BrowserWindow},url)=>{
    const window=BrowserWindow.getAllWindows().find(window=>window.webContents.getURL()===url);
    if(!window||window.isVisible())throw Error('Hidden screenshot requires the expected nonvisible native window.');
    const contents=window.webContents;
    if(contents.isOffscreen()&&!contents.isPainting())contents.startPainting();
    let readinessTimer;
    try{
     await Promise.race([
      contents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,30))))'),
      new Promise((_,reject)=>{readinessTimer=setTimeout(()=>reject(Error('Timed out draining fresh hidden animation frames.')),5000);})
     ]);
    }finally{clearTimeout(readinessTimer);}
    const image=contents.isOffscreen()?await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{contents.removeListener('paint',paint);reject(Error('Timed out waiting for a fresh hidden compositor frame.'));},10000);
     const paint=(_event,_dirty,image)=>{clearTimeout(timer);resolve(image);};
     contents.once('paint',paint);contents.invalidate();
    }):await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    if(image.isEmpty())throw Error('The hidden native window returned an empty screenshot.');
    return image.toPNG().toString('base64');
   },page.url()),
   new Promise((_,reject)=>{outerTimer=setTimeout(()=>reject(Error('Timed out completing hidden screenshot capture RPC.')),20000);})
  ]);
  await require('node:fs/promises').writeFile(filename,Buffer.from(captured,'base64'));
 }finally{clearTimeout(outerTimer);}
}
module.exports={prepareLaunch,recordVisibility,verifyVisibility,finalizeVisibility,captureScreenshot};
