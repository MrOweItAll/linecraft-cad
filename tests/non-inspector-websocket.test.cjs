'use strict';
// Explicit loopback integration control; excluded from portable default selection.
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {CDPConnection}=require('./non-inspector-contract.cjs');
const route='/devtools/browser/01234567-89ab-cdef-0123-456789abcdef';
test('actual host WebSocket refuses redirects before reaching a second loopback listener',{timeout:10000},async()=>{
 let destinationRequests=0;const destination=http.createServer((_request,response)=>{destinationRequests++;response.writeHead(400);response.end();}),redirect=http.createServer();destination.on('upgrade',(_request,socket)=>{destinationRequests++;socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');});const sockets=new Set();for(const server of [destination,redirect])server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));await listen(destination);await listen(redirect);
 redirect.on('upgrade',(_request,socket)=>socket.end('HTTP/1.1 302 Found\r\nLocation: ws://127.0.0.1:'+destination.address().port+route+'\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'));
 let client,direct;try{direct=new CDPConnection('ws://127.0.0.1:'+destination.address().port+route,2000);await assert.rejects(direct.ready,/rejected/);assert.equal(destinationRequests,1);direct.close();destinationRequests=0;client=new CDPConnection('ws://127.0.0.1:'+redirect.address().port+route,2000);await assert.rejects(client.ready,/rejected/);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(destinationRequests,0);}finally{if(client)client.close();if(direct)direct.close();for(const socket of sockets)socket.destroy();await Promise.all([destination,redirect].map(server=>new Promise(resolve=>server.close(resolve))));}
});
