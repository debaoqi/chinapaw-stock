import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const handlers={},notifications=[],badges=[];let state={userId:'',count:0,events:[]};
const self={addEventListener:(k,f)=>(handlers[k]||(handlers[k]=[])).push(f),navigator:{setAppBadge:async n=>badges.push(n),clearAppBadge:async()=>badges.push(0)},registration:{scope:'https://example.test/app/',showNotification:async(t,o)=>notifications.push(o),getNotifications:async()=>[]},clients:{matchAll:async()=>[],openWindow:async()=>{}},location:{origin:'https://example.test'}};
const c={self,console,Promise,caches:{},indexedDB:{}};vm.createContext(c);vm.runInContext(readFileSync(new URL('../www/sw.js',import.meta.url),'utf8'),c);c.store=s=>{state=s};c.read=()=>state;vm.runInContext('badgeState=async change=>{const s=change(read());store(s);return s}',c);
async function emit(k,data){const tasks=[];for(const f of handlers[k])f({data:k==='push'?{json:()=>data}:data,waitUntil:p=>tasks.push(p)});await Promise.all(tasks)}
await emit('message',{type:'jxc-user',userId:'u1'});await emit('push',{userId:'u1',eventId:'1'});assert.equal(state.count,1);assert.equal(notifications.length,1);
await emit('push',{userId:'u1',eventId:'1'});assert.equal(state.count,1);assert.equal(notifications.length,2);assert.equal(notifications.at(-1).renotify,false);
await emit('push',{userId:'u2',eventId:'2'});assert.equal(state.count,1);assert.equal(notifications.length,2);
await emit('message',{type:'jxc-badge',userId:'u1',count:0});assert.equal(state.count,0);assert.equal(badges.at(-1),0);
await emit('push',{userId:'u1',eventId:'3'});assert.equal(state.count,1);
await emit('message',{type:'jxc-user',userId:''});await emit('push',{userId:'u1',eventId:'4'});assert.equal(state.count,0);
console.log('Web push worker PASS: background notification, badge update/clear, duplicate suppression, account isolation, logout. IndexedDB adapter mocked.');
