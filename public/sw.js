const CACHE_NAME = 'enroute-shell-v3';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_PAGE, '/', '/journey', '/focus', '/week', '/settings'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_PAGE))));
  }
  if (event.request.method === 'GET' && new URL(event.request.url).origin === self.location.origin && !new URL(event.request.url).pathname.startsWith('/api/')) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response; })));
  }
});

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'EnRoute', body: 'Your commute has an update.', url: '/' };
  event.waitUntil(self.registration.showNotification(payload.title || 'EnRoute', { body: payload.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: payload.url || '/' }, tag: payload.tag, renotify: false }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
