'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {loadManifest,sha}=require('../tools/source-manifest.cjs'),root=path.resolve(__dirname,'..'),work=path.join(root,'work');
// Conservatively require the repository's single-line, block-style action refs.
// Unsupported YAML layouts fail review rather than silently bypassing this rule.
function pinnedActionRefs(workflows){
 const refs=[];
 for(const [file,text] of Object.entries(workflows)){
  let blockIndent=null;
  for(const [index,line] of text.split(/\r?\n/).entries()){
   if(!line.trim()||line.trimStart().startsWith('#'))continue;
   const indent=line.length-line.trimStart().length;
   if(blockIndent!==null&&indent>blockIndent)continue;
   blockIndent=null;
   const message=`${file}:${index+1}: full commit SHA policy requires plain block-style mapping keys and action references`;
   const mapping=line.match(/^(\s*)(-\s+)?([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*)|\s*)$/);
   assert.ok(mapping,message);
   const value=mapping[4]||'';
   if(mapping[3]!=='uses'&&/^[|>][+-]?(?:\s+#.*)?$/.test(value)){blockIndent=mapping[1].length+(mapping[2]?.length||0);continue;}
   assert.doesNotMatch(value.replace(/\$\{\{[^\r\n]*?\}\}/g,'').replace(/\s+#.*$/,''),/[{}]/,message);
   if(mapping[3]!=='uses')continue;
   const row=value.match(/^(['"]?)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+)@([a-f0-9]{40})\1\s*(?:#.*)?$/);
   assert.ok(row,message);
   refs.push({file,action:row[2],sha:row[3]});
  }
 }
 return refs;
}
test('GitHub Actions references require immutable full commit SHAs',()=>{
 const directory=path.join(root,'.github','workflows'),files=fs.readdirSync(directory).filter(name=>/\.ya?ml$/.test(name));
 assert.ok(files.length,'Workflow inventory must not be empty');
 const refs=pinnedActionRefs(Object.fromEntries(files.map(name=>[name,fs.readFileSync(path.join(directory,name),'utf8')])));
 assert.ok(refs.length,'External action inventory must not be empty');
 for(const [file,minimum] of [['quality-loop.yml',5],['windows-beta.yml',6]])assert.ok(refs.filter(row=>row.file===file).length>=minimum,`${file}: existing action inventory must be preserved`);
});
test('GitHub Actions pin policy rejects mutable, truncated and ambiguous references',()=>{
 const full='0123456789abcdef0123456789abcdef01234567',scan=line=>pinnedActionRefs({'synthetic.yml':line});
 for(const ref of ['v4','main',full.slice(0,12),full+'0',`${full}/extra`,`${full} trailing`])assert.throws(()=>scan(`- uses: actions/checkout@${ref}`),/full commit SHA/);
 for(const line of ['- uses: "actions/checkout@v4"',"- uses: 'actions/checkout@main'",'- uses: ${{ inputs.action }}','- uses: >\n    actions/checkout@'+full,'- {uses: actions/checkout@v4}',"- 'uses': actions/checkout@v4",String.raw`- "\u0075ses": actions/checkout@v4`,'- ? uses\n  : actions/checkout@v4',String.raw`steps: [{"\u0075ses": actions/checkout@v4}]`])assert.throws(()=>scan(line),/full commit SHA/);
 for(const value of [`actions/checkout@${full}`,`'actions/checkout@${full}'`,`"actions/checkout@${full}"`])assert.deepEqual(scan(`  - uses: ${value} # reviewed version tag`),[{file:'synthetic.yml',action:'actions/checkout',sha:full}]);
 assert.deepEqual(scan('# uses: actions/checkout@v4\nrun: echo healthy'),[]);
 assert.deepEqual(scan("run: |\n  echo 'uses: actions/checkout@v4'\nbranches: ['main']"),[]);
});
test('unreviewed candidate runtime drift fails while immutable baseline remains unchanged',()=>{
 fs.mkdirSync(work,{recursive:true});const bytes=fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json')),base=JSON.parse(bytes),file=path.join(work,'invalid-candidate-'+randomUUID()+'.json');
 const bad={...base,format:'LinecraftCandidateSource/1',version:'1.36.1-test',baselineCommit:'f37aba5ebe19f27088847cd8f983ecf5facf8eac',baselineManifestSHA256:sha(bytes),reviewedChanges:[]};bad.runtimeFiles[0].sha256='0'.repeat(64);
 try{fs.writeFileSync(file,JSON.stringify(bad),{flag:'wx'});assert.throws(()=>loadManifest(file));assert.deepEqual(fs.readFileSync(path.join(root,'PUBLIC-SOURCE.json')),bytes);}finally{fs.unlinkSync(file);}
});
test('overlap is rejected nonzero without modifying the existing lock or launching the gate',()=>{
 fs.mkdirSync(work,{recursive:true});const lock=path.join(work,'quality-gate.lock.json');let owned=false;
 if(!fs.existsSync(lock)){fs.writeFileSync(lock,JSON.stringify({id:randomUUID(),pid:process.pid,purpose:'owned overlap negative control'}),{flag:'wx'});owned=true;}
 const before=fs.readFileSync(lock);
 try{
  const result=spawnSync(process.execPath,['tools/qa.cjs','fast'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(result.status,1);assert.match(result.stdout,/BLOCKED/);assert.deepEqual(fs.readFileSync(lock),before);assert.doesNotMatch(result.stdout,/\[Public/);
  const env={...process.env};delete env.LINECRAFT_QA_LOCK_ID;delete env.LINECRAFT_QA_RUN_DIRECTORY;
  const direct=spawnSync(process.execPath,['desktop/dev-tools.cjs','test','--manifest=qa/CANDIDATE-SOURCE.json'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(direct.status,1);assert.match(direct.stderr,/EEXIST/);assert.deepEqual(fs.readFileSync(lock),before);
 }finally{if(owned&&fs.readFileSync(lock).equals(before))fs.unlinkSync(lock);}
});
