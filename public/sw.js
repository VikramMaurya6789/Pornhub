/* OrangeHub service worker — KILL SWITCH (v2).
 *
 * The previous offline-first service worker (orangehub-shell-v1) was trapping
 * users on the cached /offline page: its network-first navigation fetch could
 * fail on some networks, and every reload then served the stale offline page
 * again with no way out. This worker replaces it: on install it wipes every
 * cache left by the old worker and unregisters itself, returning the site to
 * plain network loading (which is healthy).
 *
 * Kept registered via ServiceWorkerRegister so existing clients pick up this
 * update on their next page load and drop the old worker.
 */

self.addEventListener('install', () => {
  // Take over immediately, don't wait for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}
      try {
        await self.registration.unregister();
      } catch {}
      try {
        await self.clients.claim();
      } catch {}
    })()
  );
});

// No fetch handler: everything goes straight to the network.
