self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : { title: 'Senkronize', body: 'Yeni bildirim' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo192.png',
      badge: '/badge72.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
