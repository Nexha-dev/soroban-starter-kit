import React from 'react';
import { usePWA } from '../context/PWAContext';

/**
 * Install banner shown when the app can be added to the home screen
 */
export function InstallBanner(): JSX.Element | null {
  const { canInstall, isAppInstalled, install } = usePWA();

  if (isAppInstalled || !canInstall) return null;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        background: 'var(--color-highlight)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--spacing-md)',
      }}
    >
      <span>📲 Install Fidelis for a native app experience</span>
      <button className="btn btn-primary" onClick={install} style={{ whiteSpace: 'nowrap' }}>
        Install App
      </button>
    </div>
  );
}

/**
 * Push notification toggle button
 */
export function PushToggle(): JSX.Element {
  const { pushPermission, pushSubscription, enablePush, disablePush } = usePWA();

  if (pushPermission === 'denied') return <></>;

  const isEnabled = !!pushSubscription;

  return (
    <button
      className={`btn ${isEnabled ? 'btn-secondary' : 'btn-primary'}`}
      onClick={isEnabled ? disablePush : enablePush}
      title={isEnabled ? 'Disable notifications' : 'Enable notifications'}
    >
      {isEnabled ? '🔕' : '🔔'}
    </button>
  );
}
