'use strict';
// Metadata reference classifier only. Never admits a live scripting connection.
const roles=['current-user','system','administrators','other','unknown'];
function invalid(){throw Object.assign(Error('Unsupported directory observation schema.'),{code:'ERR_LINECRAFT_OBSERVATION'});}
function object(value,keys){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))invalid();
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))invalid();
 for(const k of keys)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'))invalid();
}
function array(value,max){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)invalid();
 const keys=Reflect.ownKeys(value);if(keys.length!==value.length+1||keys.some(k=>typeof k!=='string'||(k!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=value.length))))invalid();
 for(let i=0;i<value.length;i++)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,String(i))||{},'value'))invalid();
}
const bool=v=>{if(typeof v!=='boolean')invalid();},integer=(v,max)=>{if(!Number.isSafeInteger(v)||v<0||v>max)invalid();};
function validateObservation(value){
 object(value,['format','scope','provenance','boundary','volume','directories']);
 if(value.format!=='LinecraftDirectoryObservation/1'||value.scope!=='metadata-only'||value.provenance!=='managed-roundtrip')invalid();
 object(value.boundary,['kind','complete','outsideRootChecked','handleBound']);
 if(value.boundary.kind!=='declared-root'||value.boundary.outsideRootChecked!==false||value.boundary.handleBound!==false)invalid();bool(value.boundary.complete);
 object(value.volume,['driveType','fileSystem']);
 if(!['fixed','removable','network','unknown','cdrom','ram'].includes(value.volume.driveType)||!['NTFS','REFS','FAT32','EXFAT','UNKNOWN'].includes(value.volume.fileSystem))invalid();
 array(value.directories,32);if(!value.directories.length)invalid();
 for(const [index,d] of value.directories.entries()){
  object(d,['ordinal','isDirectory','reparse','security']);if(d.ordinal!==index)invalid();bool(d.isDirectory);bool(d.reparse);
  const s=d.security;object(s,['ownerRole','daclState','protected','canonical','aces']);
  if(!roles.includes(s.ownerRole)||!['unrestricted-or-absent','empty','populated','unknown'].includes(s.daclState))invalid();bool(s.protected);bool(s.canonical);array(s.aces,128);
  if((s.daclState==='populated')!==(s.aces.length>0))invalid();
  for(const a of s.aces){object(a,['type','role','mask','flags','callback']);if(!['allow','deny','unsupported'].includes(a.type)||!roles.includes(a.role))invalid();integer(a.mask,0xffffffff);integer(a.flags,255);bool(a.callback);}
 }
 return value;
}
function classifyReferencePattern(value){
 validateObservation(value);const reasons=new Set();
 if(!value.boundary.complete)reasons.add('incomplete-boundary');
 if(value.volume.driveType!=='fixed'||!['NTFS','REFS'].includes(value.volume.fileSystem))reasons.add('unsupported-volume');
 for(const d of value.directories){
  if(!d.isDirectory||d.reparse)reasons.add('unsupported-path-object');
  const s=d.security;if(s.ownerRole!=='current-user')reasons.add('unsupported-owner');
  if(s.daclState!=='populated'||!s.canonical)reasons.add('unsupported-dacl');
  let ownerAccess=false;
  for(const a of s.aces){
   if(a.type!=='allow'||a.callback||!['current-user','system','administrators'].includes(a.role)||a.mask!==0x001f01ff||(a.flags&~0x1b)!==0)reasons.add('unsupported-ace');
   if(a.type==='allow'&&!a.callback&&a.role==='current-user'&&a.mask===0x001f01ff&&(a.flags&0x08)===0)ownerAccess=true;
  }
  if(!ownerAccess)reasons.add('no-applicable-owner-full-control');
 }
 return {supportedReferencePattern:reasons.size===0,privacyEstablished:false,reasons:[...reasons].sort()};
}
module.exports={validateObservation,classifyReferencePattern};
