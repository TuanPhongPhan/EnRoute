const CACHE_NAME = 'enroute-shell-v4';
const OFFLINE_PAGE = '/offline.html';
const SHELL_ROUTES = [OFFLINE_PAGE, '/', '/journey', '/focus', '/week', '/settings'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ROUTES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Next.js needs fresh App Router payloads for client navigation. Caching these responses
  // can turn a normal Link transition into a document navigation or serve stale route state.
  if (
    isAppRouterDataRequest(request, url) ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/webpack-hmr')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) event.respondWith(cacheFirstAsset(request));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match(OFFLINE_PAGE));
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

function isAppRouterDataRequest(request, url) {
  return url.searchParams.has('_rsc') || request.headers.has('RSC') || request.headers.has('Next-Router-State-Tree');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?|webmanifest)$/i.test(url.pathname)
  );
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'EnRoute', body: 'Your commute has an update.', url: '/' };
  event.waitUntil(
    self.registration.showNotification(payload.title || 'EnRoute', {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
      tag: payload.tag,
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
