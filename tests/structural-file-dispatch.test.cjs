'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createStructuralFileService}=require('../desktop/structural-files.cjs');
// Callback contract only: opaque literal sentinels are deliberately not roof schemas.
function harness(version,{rejectRequest=false,resultVersion=version}={}){
 const trace=[],native='synthetic-native-text',request=Object.freeze({version,marker:'request-'+version}),raw=Object.freeze({version:resultVersion,marker:'result-'+resultVersion}),validated=Object.freeze({validatedResult:version}),loaded=Object.freeze({validatedRequest:version});
 const options=version===1?{memberTributaryAreaSF:100}:version===2?{assignments:[]}:{assignments:[{areaDefinition:{kind:'drawn-boundary'}}]},file=path.join(__dirname,'never-accessed.json');
 let readValue=raw;
 const config={dialog:{showSaveDialog:async()=>{trace.push('save');return{canceled:true};},showOpenDialog:async()=>{trace.push('open');return{canceled:false,filePaths:[file]};}},getMainWindow:()=>null,getDrawingPath:()=>null,validateDrawing:async text=>{trace.push('drawing');assert.equal(text,native);},readSource:async selected=>{trace.push('read');assert.equal(selected,file);return readValue;},atomicWrite:async()=>assert.fail('Canceled chooser must not write'),structuralBridgeHash:()=>assert.fail('Canceled chooser must not inspect existing file')};
 for(const v of [1,2,3]){
  const suffix=v===1?'':v===2?'Assignment':'Boundary';
  config['createStructuralRoof'+suffix+'Export']=async(text,opts)=>{trace.push('createV'+v);assert.equal(text,native);assert.equal(opts,options);return request;};
  config['validateStructuralRoof'+suffix+'Export']=async(text,record)=>{trace.push('requestV'+v);assert.equal(text,native);assert.equal(record,request);assert.equal(record.version,v);if(rejectRequest)throw Error('Rejected request V'+v);return loaded;};
  config['validateStructuralRoof'+suffix+'Result']=async(text,record,result)=>{trace.push('resultV'+v);assert.equal(text,native);assert.equal(record,request);assert.equal(result,raw);if(result.version!==v)throw Error('Wrong result version for V'+v);return validated;};
 }
 return{service:createStructuralFileService(config),trace,native,request,raw,validated,loaded,options,readRequest:()=>{readValue=request;}};
}
test('literal mode table dispatches canceled exports through one creator and request validator',async()=>{
 for(const v of [1,2,3]){const h=harness(v),before=JSON.stringify([h.request,h.options]);assert.deepEqual(await h.service.exportRequest({text:h.native,options:h.options}),{ok:false,canceled:true});assert.deepEqual(h.trace,['drawing','createV'+v,'requestV'+v,'save']);assert.equal(JSON.stringify([h.request,h.options]),before);}
});
test('literal load table returns the selected request validator object without a result validator',async()=>{
 for(const v of [1,2,3]){const h=harness(v);h.readRequest();const result=await h.service.loadRequest({text:h.native});assert.equal(result.record,h.loaded);assert.equal(result.name,'never-accessed.json');assert.deepEqual(h.trace,['drawing','open','read','requestV'+v]);}
});
test('literal import matrix routes by validated request version and rejects mismatched result versions',async()=>{
 for(const v of [1,2,3])for(const resultVersion of [1,2,3]){const h=harness(v,{resultVersion}),before=JSON.stringify([h.request,h.raw]);const operation=h.service.importResult({text:h.native,exportRecord:h.request});if(v===resultVersion){assert.equal((await operation).record,h.validated);}else await assert.rejects(operation,new RegExp('Wrong result version for V'+v));assert.deepEqual(h.trace,['drawing','requestV'+v,'open','read','resultV'+v]);assert.equal(JSON.stringify([h.request,h.raw]),before);}
});
test('request and payload rejection stops import or load at the independent declared boundary',async()=>{
 for(const v of [1,2,3]){const h=harness(v,{rejectRequest:true});await assert.rejects(h.service.importResult({text:h.native,exportRecord:h.request}),/Rejected request/);assert.deepEqual(h.trace,['drawing','requestV'+v]);const loaded=harness(v,{rejectRequest:true});loaded.readRequest();await assert.rejects(loaded.service.loadRequest({text:loaded.native}),/Rejected request/);assert.deepEqual(loaded.trace,['drawing','open','read','requestV'+v]);const malformed=harness(v);await assert.rejects(malformed.service.loadRequest({text:malformed.native,path:'untrusted'}),/Invalid structural exchange request/);assert.deepEqual(malformed.trace,[]);}
});
