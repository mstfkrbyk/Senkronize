/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'senkronize-v1';
const OFFLINE_URL = '/offline.html';
const API_CACHE = 'senkronize-api-v1';
const IMAGE_CACHE = 'senkronize-images-v1';
const API_MAX_AGE_MS = 5 * 60 * 1000;
const IMAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/placeholder-product.svg',
];

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(request) {
  const dest = request.destination;
  if (dest === 'image') {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(request.url);
}

function cacheIsFresh(response, maxAgeMs) {
  const cachedAt = response.headers.get('X-Cached-At');
  if (!cachedAt) {
    return false;
  }
  const age = Date.now() - Number.parseInt(cachedAt, 10);
  return Number.isFinite(age) && age < maxAgeMs;
}

function withCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Cached-At', String(Date.now()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function cacheFirst(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached && cacheIsFresh(cached, maxAgeMs)) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, withCacheTimestamp(response.clone()));
    }
    return response;
  } catch (err) {
    if (cached) {
      return cached;
    }
    throw err;
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, withCacheTimestamp(response.clone()));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached && cacheIsFresh(cached, API_MAX_AGE_MS)) {
      return cached;
    }
    throw err;
  }
}

async function navigationHandler(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) {
      return offline;
    }
    return new Response('Çevrimdışı', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isImageRequest(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_MAX_AGE_MS));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAME, IMAGE_MAX_AGE_MS));
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Senkronize', body: 'Yeni bildirim' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(targetUrl));
});

async function drainOfflineQueue() {
  const raw = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of raw) {
    client.postMessage({ type: 'OFFLINE_SYNC_DRAIN' });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'senkronize-offline-sync') {
    event.waitUntil(drainOfflineQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUEUE_OFFLINE_MUTATION') {
    event.waitUntil(
      (async () => {
        if (!self.registration.sync) {
          return;
        }
        await self.registration.sync.register('senkronize-offline-sync');
      })(),
    );
  }
});
