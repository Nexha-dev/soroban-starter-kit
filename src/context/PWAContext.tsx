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
} from '../services/pwa';

interface PWAContextValue {
  canInstall: boolean;
  isAppInstalled: boolean;
  pushPermission: NotificationPermission;
  pushSubscription: PushSubscription | null;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export function PWAProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [canInstall, setCanInstall] = useState(false);
  const [isAppInstalled] = useState(isInstalled);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    trackWebVitals();
    trackEvent('app_open', { installed: isInstalled() });

    const cleanup = initInstallPrompt(() => setCanInstall(true));

    // Check existing push subscription
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(setPushSubscription)
      );
    }

    return cleanup;
  }, []);

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
    <PWAContext.Provider value={{ canInstall, isAppInstalled, pushPermission, pushSubscription, install, enablePush, disablePush }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA(): PWAContextValue {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA must be used within PWAProvider');
  return ctx;
}
