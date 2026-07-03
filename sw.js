// NexusOS v6.0 — Service Worker
// Handles background push notifications and PWA caching

const CACHE_NAME = 'nexusos-v6';
const OFFLINE_URL = '/nexusos-app.html';

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        '/',
        '/nexusos-app.html',
        '/icon-192.png',
        '/icon-512.png'
      ]).catch(function() {
        // Silently ignore missing assets during install
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH (network-first, cache fallback) ─────────────────
self.addEventListener('fetch', function(event) {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Cache successful responses
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Network failed — serve from cache
      return caches.match(event.request).then(function(cached) {
        return cached || caches.match(OFFLINE_URL);
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  var title   = data.title   || 'NexusOS';
  var body    = data.body    || 'You have a new notification.';
  var icon    = data.icon    || '/icon-192.png';
  var badge   = data.badge   || '/icon-72.png';
  var url     = data.url     || '/nexusos-app.html';
  var tag     = data.tag     || 'nexusos-notif';

  event.waitUntil(
    self.registration.showNotification(title, {
      body:  body,
      icon:  icon,
      badge: badge,
      tag:   tag,
      data:  { url: url },
      vibrate: [200, 100, 200]
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/nexusos-app.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Focus existing tab if open
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf('nexusos') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── BACKGROUND SYNC ───────────────────────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'nexusos-sync') {
    // Reserved for future background data sync
    console.log('[NexusOS SW] Background sync triggered');
  }
});
