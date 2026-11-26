/* 网络优先：有网用最新版并更新缓存；断网时用缓存（离线可用）。与 ChinaPaw 的 sw.js 相同。 */
const C='jxc-v5';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','config.js','manifest.webmanifest','icon-192.png','icon-512.png','logo.svg','offline.html','web.html']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('jxc-v')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=e.request.url;if(e.request.method!=='GET'||!u.startsWith(self.location.origin)||u.includes('version.json')||u.includes('/admin/')||u.includes('/app/'))return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();if(r.ok)caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))))});

/* Persistent badge state survives closing the installed web app. Never cache message bodies. */
let badgeQueue=Promise.resolve();
function badgeSerial(fn){badgeQueue=badgeQueue.catch(()=>{}).then(fn);return badgeQueue}
async function badgeState(change){const db=await new Promise((ok,no)=>{const r=indexedDB.open('jxc-push-state',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});try{return await new Promise((ok,no)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('badge');let value;r.onsuccess=()=>{value=change(r.result||{userId:'',count:0,events:[]});store.put(value,'badge')};tx.oncomplete=()=>ok(value);tx.onerror=()=>no(tx.error)})}finally{db.close()}}
async function applyBadge(count){try{if(self.navigator.setAppBadge){if(count)await self.navigator.setAppBadge(count);else await self.navigator.clearAppBadge()}}catch(e){/* Badging availability must not suppress visible notifications. */}}
self.addEventListener('message',e=>{const d=e.data;if(!d||!['jxc-user','jxc-badge'].includes(d.type))return;e.waitUntil(badgeSerial(async()=>{const state=await badgeState(s=>s.userId!==d.userId?{userId:d.userId,count:d.count||0,events:[]}:({...s,count:d.type==='jxc-badge'?Math.max(0,d.count||0):s.count}));await applyBadge(state.count);if(!state.count){const notices=await self.registration.getNotifications();notices.forEach(n=>n.close())}}))});
self.addEventListener('push',e=>e.waitUntil(badgeSerial(async()=>{
 let d;try{d=e.data.json()}catch{return}
 let accept=false,duplicate=false;
 const state=await badgeState(s=>{if(!d.userId||d.userId!==s.userId)return s;if(s.events.includes(d.eventId)){duplicate=true;return s;}accept=true;return {...s,count:s.count+1,events:[...s.events,d.eventId].slice(-300)}});
 if(!accept&&!duplicate)return;
 await applyBadge(state.count);
 await self.registration.showNotification('华宝进销存 · 新消息 / 审批提醒',{body:d.body||'您有新的消息或待处理业务，请打开查看',icon:'icon-192.png',badge:'icon-192.png',tag:'jxc-unread',renotify:!duplicate,data:{url:self.registration.scope,eventId:d.eventId}});
 const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});pages.forEach(c=>c.postMessage({type:'jxc-push-arrived'}));
})));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});const page=pages.find(c=>c.url.startsWith(self.registration.scope));if(page){await page.focus();page.postMessage({type:'jxc-push-arrived'});return}await self.clients.openWindow(self.registration.scope)})())});
