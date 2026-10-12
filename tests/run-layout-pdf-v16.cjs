'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),workspace=path.basename(path.dirname(root))==='outputs'?path.dirname(path.dirname(root)):root;
const executable=process.argv[2]||path.join(root,'node_modules/electron/dist/electron.exe');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const started=Date.now(),reportPath=path.join(__dirname,'layout-pdf-v16-render-results.json');
const child=spawn(executable,[path.join(__dirname,'layout-pdf-v16.cjs'),'--linecraft-test-hidden'],{cwd:root,env,windowsHide:true,stdio:'inherit'});
child.once('error',error=>{console.error(error);process.exitCode=1;});child.once('exit',(code,signal)=>{if(signal)console.error(signal);try{if(code!==0)throw Error(`Hidden PDF process failed (${code??signal}).`);const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));if(Date.parse(report.completedAt)<started||report.failed||report.sourceChangedDuringRun)throw Error('A fresh passing PDF report was not produced.');console.log(`${report.passed}/${report.total} actual layout PDF checks passed; show events ${report.showEvents}.`);process.exitCode=0;}catch(error){console.error(error.message);process.exitCode=1;}});
