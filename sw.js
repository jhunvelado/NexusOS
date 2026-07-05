/* NexusOS Service Worker v7.8 */
var CACHE = 'nexusos-v78';
var SHELL = ['/', '/nexusos-app.html'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).catch(function(){})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET') return;
  var url = e.request.url;
  /* Always network-first for API calls */
  if(url.includes('supabase.co')||url.includes('googleapis.com')||url.includes('anthropic.com')){
    e.respondWith(
      fetch(e.request).catch(function(){
        return new Response(JSON.stringify({error:'offline'}),{headers:{'Content-Type':'application/json'}});
      })
    );
    return;
  }
  /* Cache-first for the app shell */
  e.respondWith(
    caches.match(e.request).then(function(cached){
      var networkFetch = fetch(e.request).then(function(resp){
        if(resp.ok){
          var clone = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        }
        return resp;
      });
      return cached || networkFetch;
    }).catch(function(){
      return caches.match('/nexusos-app.html');
    })
  );
});

self.addEventListener('message', function(e){
  if(e.data==='skipWaiting') self.skipWaiting();
});
