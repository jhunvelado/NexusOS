/* ============================================================
   NexusOS v4.1 — Service Worker
   Handles: offline caching, push notifications, background sync
   ============================================================ */

const CACHE_NAME = 'nexusos-v4-1';
const OFFLINE_URL = '/NexusOS/nexusos-app.html';

const PRECACHE_URLS = [
  '/NexusOS/nexusos-app.html',
  '/NexusOS/manifest.json'
];

/* ── INSTALL: precache core shell ─────────────────────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: clean up old caches ───────────────────────── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── FETCH: network-first with offline fallback ──────────── */
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // Supabase API — always network, never cache
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cache successful responses
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Offline fallback
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});

/* ── PUSH NOTIFICATIONS ───────────────────────────────────── */
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'NexusOS', body: event.data ? event.data.text() : 'You have a new notification.' };
  }

  var title = data.title || 'NexusOS';
  var options = {
    body: data.body || 'You have a new update.',
    icon: '/NexusOS/icons/icon-192.png',
    badge: '/NexusOS/icons/icon-192.png',
    tag: data.tag || 'nexusos-general',
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/NexusOS/nexusos-app.html',
      type: data.type || 'general'
    },
    actions: data.actions || []
  };

  // Notification types with tailored actions
  if (data.type === 'approval') {
    options.tag = 'nexusos-approval';
    options.requireInteraction = true;
    options.actions = [
      { action: 'approve', title: '✅ Approve' },
      { action: 'view',    title: '👁 View details' }
    ];
  }

  if (data.type === 'commitment') {
    options.tag = 'nexusos-commitment';
    options.requireInteraction = true;
    options.actions = [
      { action: 'done', title: '✓ Mark done' },
      { action: 'view', title: '👁 View' }
    ];
  }

  if (data.type === 'session_warn') {
    options.tag = 'nexusos-session';
    options.actions = [
      { action: 'extend', title: '⏱ Stay signed in' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ── NOTIFICATION CLICK ───────────────────────────────────── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/NexusOS/nexusos-app.html';

  var action = event.action;

  // Route action clicks
  if (action === 'approve' || action === 'view' || action === 'done') {
    targetUrl = '/NexusOS/nexusos-app.html';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing tab if open
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('nexusos-app') && 'focus' in client) {
          client.postMessage({ type: 'notification_click', action: action, notifType: event.notification.data.type });
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

/* ── BACKGROUND SYNC (future: offline action queue) ─────── */
self.addEventListener('sync', function(event) {
  if (event.tag === 'nexusos-sync-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  // Placeholder: when offline actions are queued, send them to Supabase on reconnect
  console.log('[NexusOS SW] Background sync triggered');
}
