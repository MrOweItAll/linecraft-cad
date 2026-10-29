'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
function endpointFromOwnedReports(endpoint,activePort){
 assert.equal(typeof endpoint,'string');assert.equal(typeof activePort,'string');assert.ok(activePort.length<=256);
 const match=/^ws:\/\/127\.0\.0\.1:([1-9][0-9]{3,4})(\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(endpoint);
 assert.ok(match,'Expected a direct IPv4-loopback browser WebSocket endpoint');
 const port=Number(match[1]);assert.ok(port>=1024&&port<=65535);
 const lines=activePort.replace(/\r?\n$/,'').split(/\r?\n/);assert.equal(lines.length,2);assert.equal(lines[0],String(port));assert.equal(lines[1],match[2]);
 return{endpoint,port};
}
function ownedListener(text,port,pid){
 assert.ok(Number.isInteger(pid)&&pid>0);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);assert.ok(typeof text==='string'&&text.length<2*1024*1024);
 const rows=text.split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(row=>row[0]==='TCP'&&row[3]==='LISTENING'&&row[1]?.endsWith(':'+port));
 assert.equal(rows.length,1,'Expected exactly one listening endpoint');assert.equal(rows[0][1],'127.0.0.1:'+port);assert.equal(rows[0][4],String(pid),'Debug listener is not owned by the spawned process');
 return{listenerPID:pid,loopback:true};
}
function launchArguments(entry,profile){
 assert.ok(typeof profile==='string'&&path.isAbsolute(profile)&&!profile.includes('\0'));assert.ok(!entry||path.isAbsolute(entry));
 return[...(entry?[entry,'--linecraft-no-watch']:[]),'--user-data-dir='+profile,'--linecraft-test-hidden','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'];
}
function visibilitySnapshot(value,pid){
 assert.equal(value.processId,pid);assert.ok(Number.isInteger(value.windowCount)&&value.windowCount>=0);assert.ok(Array.isArray(value.visible));assert.equal(value.visible.length,value.windowCount);assert.ok(value.visible.every(x=>typeof x==='boolean'));assert.equal(value.visible.filter(Boolean).length,0,'An owned top-level window is visible');
 return{windowCount:value.windowCount,visibleCount:0,scope:value.windowCount?'Owned top-level windows sampled hidden':'No owned top-level HWND observed',transientShowEventsVerified:false};
}
function ownedObservation(value,{pid,executable,spawnedAt,observedAt}){
 assert.equal(typeof value.image,'string');assert.ok(path.isAbsolute(value.image));assert.equal(path.resolve(value.image).toLowerCase(),path.resolve(executable).toLowerCase(),'Unexpected process image');
 const started=Date.parse(value.startedAt),spawned=Date.parse(spawnedAt),observed=Date.parse(observedAt);assert.ok([started,spawned,observed].every(Number.isFinite));assert.ok(started>=spawned-2000&&started<=observed+2000,'Unexpected process start time');
 return visibilitySnapshot(value,pid);
}
class CDPConnection{
 constructor(endpoint,timeout=5000){
  this.socket=new WebSocket(endpoint);this.pending=new Map();this.next=0;this.timeout=timeout;
  this.ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('WebSocket startup timeout')),timeout);this.socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});this.socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('WebSocket startup rejected'));},{once:true});});
  this.socket.addEventListener('message',event=>{try{assert.equal(typeof event.data,'string');assert.ok(Buffer.byteLength(event.data)<8*1024*1024);const reply=JSON.parse(event.data);if(reply.id&&this.pending.has(reply.id)){const item=this.pending.get(reply.id);this.pending.delete(reply.id);clearTimeout(item.timer);reply.error?item.reject(Error('CDP request rejected: '+reply.error.message)):item.resolve(reply.result);}}catch(error){this.fail(error);this.socket.close();}});
  this.socket.addEventListener('close',()=>this.fail(Error('CDP transport closed')));this.socket.addEventListener('error',()=>this.fail(Error('CDP transport error')));
 }
 fail(error){for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(error);}this.pending.clear();}
 async send(method,params={},sessionId){await this.ready;const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP request timeout: '+method));},this.timeout);this.pending.set(id,{resolve,reject,timer});try{this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});}
 close(){this.fail(Error('CDP disconnected'));this.socket.close();}
}
module.exports={endpointFromOwnedReports,ownedListener,launchArguments,visibilitySnapshot,ownedObservation,CDPConnection};
