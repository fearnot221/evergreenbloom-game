// Retire only the previous festival worker and its offline caches on this origin.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('songying-core-') || key.startsWith('songying-shell-')) {
        await caches.delete(key);
      }
    }
    await self.registration.unregister();
  })());
});
