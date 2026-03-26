/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Soroban RPC – network-first, 24h cache
registerRoute(
  ({ url }) => url.hostname === 'soroban-testnet.stellar.org',
  new NetworkFirst({
    cacheName: 'soroban-api',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Horizon API – stale-while-revalidate
registerRoute(
  ({ url }) => url.hostname.includes('horizon'),
  new StaleWhileRevalidate({
    cacheName: 'horizon-api',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 3600 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Background sync for queued transactions
const bgSyncPlugin = new BackgroundSyncPlugin('tx-queue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
});

registerRoute(
  ({ url }) => url.pathname.includes('/submit-transaction'),
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'POST'
);

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? { title: 'Fidelis', body: 'You have a new notification' };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Fidelis', {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

// Open app on notification click
self.addEventListener('notificationclick', (event: Event) => {
  const e = event as NotificationEvent;
  e.notification.close();
  const url = (e.notification.data as { url?: string })?.url ?? '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c);
      return existing ? existing.focus() : self.clients.openWindow(url);
    })
  );
});

// Periodic background sync
self.addEventListener('periodicsync', (event: ExtendableEvent & { tag: string }) => {
  if (event.tag === 'data-refresh') {
    event.waitUntil(
      // Revalidate horizon cache on periodic sync
      caches.open('horizon-api').then(cache =>
        cache.keys().then(keys =>
          Promise.all(keys.map(req => fetch(req).then(res => { if (res.ok) cache.put(req, res); }).catch(() => {})))
        )
      )
    );
  }
});
