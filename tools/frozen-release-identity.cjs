'use strict';
// Pure frozen metadata model. Used by source preparation, not publication.
const version='1.36.0',canonicalTag='v1.36.0';
const baselineSHA256='c7cb2c46702e7e88b7ddd84aa83b038bf52aa0a5901d3154bf3fb60bba41b5c7';
const payload=[
 'Linecraft-CAD-1.36.0-Setup.exe','Linecraft-CAD-1.36.0-Source.zip',
 'Installed-Acceptance.linecraft','Installed-Acceptance.pdf',
 'Public-Beta-Verification.json','libredwg-0.13.4-upstream.tar.gz'
];
function reject(reason){throw Object.assign(Error('Frozen release identity mismatch: '+reason+'.'),{code:'ERR_LINECRAFT_RELEASE_IDENTITY'});}
function same(actual,expected,reason){if(actual!==expected)reject(reason);}
function planFrozenReleaseIdentity(input){
 if(!input||typeof input!=='object'||Array.isArray(input))reject('input');
 same(input.packageVersion,version,'package version');
 same(input.manifestVersion,version,'manifest version');
 same(input.manifestFile,'PUBLIC-SOURCE.json','manifest file');
 same(input.manifestSHA256,baselineSHA256,'manifest hash');
 same(input.candidate,false,'manifest candidate');
 same(typeof input.preflight,'boolean','mode');
 same(input.ref,input.preflight?'refs/heads/codex/public-beta-1.36':'refs/tags/v1.36.0','ref');
 same(typeof input.head==='string'&&input.head.length>0,true,'head');
 if(!input.preflight)same(input.tagCommit,input.head,'tag commit');
 return Object.freeze({
  version,canonicalTag,verificationTag:input.preflight?null:canonicalTag,
  releaseClass:input.preflight?'candidate':'prerelease',commit:input.head,
  sourcePrefix:'Linecraft-CAD-1.36.0-Source/',installer:payload[0],source:payload[1],
  payloadAssets:Object.freeze([...payload]),checksumFile:'SHA256SUMS.txt',
  uploadAssets:Object.freeze([...payload,'SHA256SUMS.txt']),notesFile:'release-notes.md'
 });
}
module.exports={planFrozenReleaseIdentity};
