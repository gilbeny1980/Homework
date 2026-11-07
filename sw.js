const C='bny-v18',F=['/','/index.html','/style.css','/app.js','/rec.js','/icon.svg','/manifest.json','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});

self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}
  const title=d.title||'תזכורת',data={title:d.title||'',body:d.body||'',eid:d.eid||'',at:d.at||0,req:!!d.req};
  e.waitUntil((async()=>{
    const full={body:d.body||'',icon:'icons/icon-192.png',badge:'icons/icon-192.png',dir:'rtl',lang:'he',tag:d.eid?('bny-'+d.eid+'-'+d.at):('bny-'+Date.now()),renotify:true,silent:false,requireInteraction:true,vibrate:[500,200,500,200,500,200,500,200,500],
      actions:d.req?[{action:'done',title:'✔ בוצע'},{action:'snooze',title:'⏰ נודניק 10 דק׳'}]:[{action:'snooze',title:'⏰ נודניק 10 דק׳'},{action:'ack',title:'✔ הבנתי'}],data};
    try{await self.registration.showNotification(title,full)}
    catch(err){ // some browsers reject unsupported options - retry with the simplest notification so something always shows
      try{await self.registration.showNotification(title,{body:d.body||'',icon:'icons/icon-192.png',data})}catch{}}
    // if the app is open, ring the chosen tone / show the alarm screen
    for(const c of await clients.matchAll({type:'window',includeUncontrolled:true}))c.postMessage({type:'ring',r:{t:d.title||'',b:d.body||'',e:d.eid||'',a:d.at||0,q:!!d.req}});
  })())});

const post=(url,body)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const n=e.notification.data||{};
  e.waitUntil((async()=>{
    if(e.action==='done'){const sub=await self.registration.pushManager.getSubscription();await post('/api/snooze',{action:'done',endpoint:sub&&sub.endpoint,eid:n.eid,at:n.at});return}
    if(e.action==='snooze'){const sub=await self.registration.pushManager.getSubscription();await post('/api/snooze',{endpoint:sub&&sub.endpoint,minutes:10,title:n.title,body:n.body,eid:n.eid,at:n.at,req:!!n.req});return}
    if(n.eid&&!n.req)await post('/api/snooze',{action:'ack',eid:n.eid,at:n.at});
    if(e.action==='ack')return;
    const url='/?r='+encodeURIComponent(JSON.stringify({t:n.title,b:n.body,e:n.eid,a:n.at,q:n.req}));
    const cs=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(cs.length){await cs[0].focus();cs[0].postMessage({type:'remind',r:{t:n.title,b:n.body,e:n.eid,a:n.at,q:n.req}})}else await clients.openWindow(url);
  })())});
