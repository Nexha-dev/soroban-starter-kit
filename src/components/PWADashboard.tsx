import React, { useState } from 'react';
import { usePWA } from '../context/PWAContext';
import { showLocalNotification } from '../services/pwa';

type Tab = 'status' | 'cache' | 'events';

export function PWADashboard(): JSX.Element {
  const {
    isAppInstalled, canInstall, swState,
    pushPermission, pushSubscription,
    cacheInfo, sessionEvents,
    install, enablePush, disablePush, refreshCacheInfo,
  } = usePWA();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('status');
  const [testMsg, setTestMsg] = useState('');

  const sendTest = async (): Promise<void> => {
    await showLocalNotification('Fidelis Test', 'Push notifications are working! 🎉');
    setTestMsg('Sent!');
    setTimeout(() => setTestMsg(''), 2000);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '6px 4px', fontSize: '0.75rem', border: 'none', cursor: 'pointer',
    background: active ? 'var(--color-highlight)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    borderBottom: active ? '2px solid var(--color-highlight)' : '2px solid transparent',
  });

  const badge = (ok: boolean, yes: string, no: string): JSX.Element => (
    <span style={{
      fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)',
      background: ok ? 'var(--color-success)' : 'var(--color-text-muted)',
      color: '#fff',
    }}>{ok ? yes : no}</span>
  );

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={() => { setOpen(p => !p); refreshCacheInfo(); }}
        aria-label="PWA status"
        title="PWA status"
      >
        📱
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: '280px', zIndex: 200, boxShadow: 'var(--shadow-lg)',
          }}
          role="dialog"
          aria-label="PWA Dashboard"
        >
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--spacing-sm)' }}>
            {(['status', 'cache', 'events'] as Tab[]).map(t => (
              <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Status tab */}
          {tab === 'status' && (
            <div className="flex flex-col gap-sm">
              <div className="flex items-center" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Service Worker</span>
                {badge(swState === 'active', 'Active', swState === 'pending' ? 'Pending' : 'Unsupported')}
              </div>
              <div className="flex items-center" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Installed</span>
                {badge(isAppInstalled, 'Yes', 'No')}
              </div>
              <div className="flex items-center" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Push</span>
                {badge(!!pushSubscription, 'Enabled', 'Disabled')}
              </div>

              {canInstall && !isAppInstalled && (
                <button className="btn btn-primary" onClick={install} style={{ marginTop: 4 }}>
                  📲 Install App
                </button>
              )}

              {pushPermission !== 'denied' && (
                <button
                  className={`btn ${pushSubscription ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={pushSubscription ? disablePush : enablePush}
                >
                  {pushSubscription ? '🔕 Disable Notifications' : '🔔 Enable Notifications'}
                </button>
              )}

              {pushSubscription && (
                <button className="btn btn-secondary" onClick={sendTest}>
                  {testMsg || '🧪 Send Test Notification'}
                </button>
              )}
            </div>
          )}

          {/* Cache tab */}
          {tab === 'cache' && (
            <div className="flex flex-col gap-sm">
              <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <p className="form-label" style={{ margin: 0 }}>Caches ({cacheInfo.length})</p>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={refreshCacheInfo}>
                  ↻ Refresh
                </button>
              </div>
              {cacheInfo.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No caches found.</p>
              )}
              {cacheInfo.map(c => (
                <div key={c.name} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{c.name}</span>
                  <span style={{ color: 'var(--color-highlight)', flexShrink: 0 }}>{c.entries} entries</span>
                </div>
              ))}
            </div>
          )}

          {/* Events tab */}
          {tab === 'events' && (
            <div>
              <p className="form-label" style={{ marginBottom: 'var(--spacing-sm)' }}>
                Session Events ({sessionEvents.length})
              </p>
              {sessionEvents.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No events yet.</p>
              )}
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {[...sessionEvents].reverse().map((e, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ color: 'var(--color-highlight)' }}>{e.name}</span>
                    <span style={{ float: 'right', color: 'var(--color-text-muted)' }}>
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
