'use strict';
// One bounded application + independent PDF workflow, for source or unpacked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),[executable,entry,prefix,manifest]=process.argv.slice(2);
assert.ok(executable&&/^ordinary-grip-[a-z0-9-]+$/.test(prefix)&&manifest);
const run=path.join(root,'work/tick-width',prefix+'-'+Date.now()+'-'+randomUUID().slice(0,8));
const report={format:'LinecraftTickWidthWorkflow/1',status:'running',startedAt:new Date().toISOString(),run,application:null,pdfAudits:[],scope:'Actual hidden source/unpacked app and independent production-PDF measurements; no installed/native human acceptance'};
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
try{
  const app=spawnSync(process.execPath,[path.join(__dirname,'tick-width-desktop.cjs'),root,path.resolve(executable),entry,run,manifest],{cwd:root,encoding:'utf8',windowsHide:true,timeout:150000,maxBuffer:4*1024*1024});
  if(fs.existsSync(run))fs.writeFileSync(path.join(run,'app.log'),(app.stdout||'')+(app.stderr||''),{flag:'wx'});
  assert.equal(app.status,0,app.error?.message||app.stderr||app.stdout);
  const producer=path.join(run,'tick-app-results.json');report.application=JSON.parse(fs.readFileSync(producer));
  assert.equal(report.application.status,'passed');assert.equal(report.application.total,10);assert.equal(report.application.passed,10);assert.equal(report.application.sourceUnchanged,true);
  const python=process.env.CAD_PYTHON||path.join(root,'.venv/Scripts/python.exe');
  for(const mode of ['legacy','explicit','cleared']){
    const receipt=path.join(run,mode+'-audit.json'),render=path.join(run,mode+'.png');
    const result=spawnSync(python,[path.join(__dirname,'audit-tick-width-pdf.py'),'--mode',mode,'--producer',producer,'--receipt',receipt,'--render',render],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:2*1024*1024});
    fs.writeFileSync(path.join(run,mode+'-audit.log'),(result.stdout||'')+(result.stderr||''),{flag:'wx'});
    assert.equal(result.status,0,result.error?.message||result.stderr||result.stdout);
    const audit=JSON.parse(fs.readFileSync(receipt));assert.equal(audit.status,'passed');assert.equal(audit.measurements.length,10);
    report.pdfAudits.push({mode,receipt,sha256:sha(receipt),render,measurements:audit.measurements,negativeControls:audit.negativeControls});
  }
  report.status='passed';
}catch(error){report.status='failed';report.error=error.stack||String(error);process.exitCode=1;}
finally{
  report.completedAt=new Date().toISOString();
  if(fs.existsSync(run))fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  const receipt=path.join(__dirname,prefix+'-tick-results.json');fs.writeFileSync(receipt,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,appChecks:report.application?.passed||0,pdfAudits:report.pdfAudits.length,receipt}));if(report.error)console.error(report.error);
}
