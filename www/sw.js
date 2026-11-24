/* 网络优先：有网用最新版并更新缓存；断网时用缓存（离线可用）。与 ChinaPaw 的 sw.js 相同。 */
const C='jxc-v2';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','config.js','manifest.webmanifest','icon-192.png','icon-512.png','logo.svg','offline.html','web.html']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=e.request.url;if(e.request.method!=='GET'||!u.startsWith(self.location.origin)||u.includes('version.json')||u.includes('/admin/')||u.includes('/app/'))return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))))});
