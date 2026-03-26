import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  initInstallPrompt,
  promptInstall,
  isInstalled,
  requestPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  trackEvent,
  trackWebVitals,
  registerPeriodicSync,
  getCacheInfo,
  getSessionEvents,
} from '../services/pwa';

interface CacheEntry { name: string; entries: number }

interface PWAContextValue {
  canInstall: boolean;
  isAppInstalled: boolean;
  pushPermission: NotificationPermission;
  pushSubscription: PushSubscription | null;
  swState: 'pending' | 'active' | 'unsupported';
  cacheInfo: CacheEntry[];
  sessionEvents: ReturnType<typeof getSessionEvents>;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
  refreshCacheInfo: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export function PWAProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [canInstall, setCanInstall] = useState(false);
  const [isAppInstalled] = useState(isInstalled);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [swState, setSwState] = useState<'pending' | 'active' | 'unsupported'>(
    'serviceWorker' in navigator ? 'pending' : 'unsupported'
  );
  const [cacheInfo, setCacheInfo] = useState<CacheEntry[]>([]);
  const [sessionEvents, setSessionEvents] = useState<ReturnType<typeof getSessionEvents>>([]);

  const refreshCacheInfo = useCallback(async () => {
    setCacheInfo(await getCacheInfo());
    setSessionEvents(getSessionEvents());
  }, []);

  useEffect(() => {
    trackWebVitals();
    trackEvent('app_open', { installed: isInstalled() });

    const cleanup = initInstallPrompt(() => setCanInstall(true));

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        setSwState('active');
        reg.pushManager.getSubscription().then(setPushSubscription);
        // Register periodic background sync for data refresh (every 12h)
        registerPeriodicSync('data-refresh', 12 * 60 * 60 * 1000);
      });
    }

    refreshCacheInfo();
    return cleanup;
  }, [refreshCacheInfo]);

  const install = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setCanInstall(false);
    return outcome;
  }, []);

  const enablePush = useCallback(async () => {
    const permission = await requestPushPermission();
    setPushPermission(permission);
    if (permission === 'granted') {
      const sub = await subscribeToPush();
      setPushSubscription(sub);
    }
  }, []);

  const disablePush = useCallback(async () => {
    await unsubscribeFromPush();
    setPushSubscription(null);
  }, []);

  return (
    <PWAContext.Provider value={{
      canInstall, isAppInstalled, pushPermission, pushSubscription,
      swState, cacheInfo, sessionEvents,
      install, enablePush, disablePush, refreshCacheInfo,
    }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA(): PWAContextValue {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA must be used within PWAProvider');
  return ctx;
}
