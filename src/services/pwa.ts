/**
 * PWA Service
 * Handles install prompt, push notifications, and engagement tracking
 */

// --- Install Prompt ---

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function initInstallPrompt(onAvailable: () => void): () => void {
  const handler = (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    onAvailable();
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  await deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  trackEvent('pwa_install', { outcome });
  return outcome;
}

export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// --- Push Notifications ---

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  const permission = await Notification.requestPermission();
  trackEvent('push_permission', { permission });
  return permission;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !VAPID_PUBLIC_KEY) return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });
    trackEvent('push_subscribed');
    return subscription;
  } catch {
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  const result = await subscription.unsubscribe();
  if (result) trackEvent('push_unsubscribed');
  return result;
}

export async function showLocalNotification(title: string, body: string): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  });
}

// --- Engagement & Performance Tracking ---

interface EngagementEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

const SESSION_KEY = 'pwa_session';

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  const event: EngagementEvent = { name, properties, timestamp: Date.now() };
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as EngagementEvent[];
    stored.push(event);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored.slice(-100))); // keep last 100
  } catch {
    // storage unavailable, ignore
  }
  if (import.meta.env.DEV) {
    console.debug('[PWA]', name, properties ?? '');
  }
}

export function getSessionEvents(): EngagementEvent[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function trackWebVitals(): void {
  if (!('PerformanceObserver' in window)) return;

  // LCP
  new PerformanceObserver(list => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    trackEvent('web_vital_lcp', { value: Math.round(last.startTime) });
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // FID / INP
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const e = entry as PerformanceEventTiming;
      trackEvent('web_vital_fid', { value: Math.round(e.processingStart - e.startTime) });
    }
  }).observe({ type: 'first-input', buffered: true });

  // CLS
  let clsValue = 0;
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const e = entry as unknown as { hadRecentInput: boolean; value: number };
      if (!e.hadRecentInput) clsValue += e.value;
    }
    trackEvent('web_vital_cls', { value: clsValue.toFixed(4) });
  }).observe({ type: 'layout-shift', buffered: true });
}

// --- Periodic Background Sync ---

export async function registerPeriodicSync(tag: string, minIntervalMs: number): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  const ps = (reg as ServiceWorkerRegistration & { periodicSync?: { register(tag: string, opts: { minInterval: number }): Promise<void>; getTags(): Promise<string[]> } }).periodicSync;
  if (!ps) return false;
  try {
    const tags = await ps.getTags();
    if (!tags.includes(tag)) await ps.register(tag, { minInterval: minIntervalMs });
    return true;
  } catch {
    return false;
  }
}

// --- Cache Info ---

export async function getCacheInfo(): Promise<{ name: string; entries: number }[]> {
  if (!('caches' in window)) return [];
  const names = await caches.keys();
  return Promise.all(
    names.map(async name => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return { name, entries: keys.length };
    })
  );
}
