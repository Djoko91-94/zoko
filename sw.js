const CACHE_NAME = 'zoko-pwa-cache-v2';
const ASSETS = [
  './zoko.html',
  './zoko.js',
  './zoko.css',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match('./zoko.html'));
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const notificationData = event.notification.data || {};
  const taskId = notificationData.taskId ? String(notificationData.taskId) : '';
  const messageType = event.action === 'mark-task-done'
    ? 'zoko-complete-task'
    : 'zoko-open-task';

  event.notification.close();
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clientList.find((candidate) => new URL(candidate.url).origin === self.location.origin);

    if (client) {
      if (taskId) {
        client.postMessage({
          type: messageType,
          taskId,
        });
      }
      return client.focus();
    }

    const targetUrl = new URL('./zoko.html', self.location.href);
    if (taskId) {
      targetUrl.searchParams.set(event.action === 'mark-task-done' ? 'completeTaskId' : 'taskId', taskId);
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
