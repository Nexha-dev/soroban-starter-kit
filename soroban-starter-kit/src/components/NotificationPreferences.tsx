import React, { useState, useEffect } from 'react';
import type { UserPreferences, NotificationChannel, NotificationPriority, NotificationCategory } from '../services/notifications/types';
import { notificationManager } from '../services/notifications';

interface PreferencesProps {
  userId: string;
  onSave?: (preferences: UserPreferences) => void;
}

export function NotificationPreferences({ userId, onSave }: PreferencesProps): JSX.Element {
  const [preferences, setPreferences] = useState<UserPreferences>({
    userId,
    enabledChannels: ['in-app'],
    priorityThreshold: 'medium',
    categories: {
      transaction: true,
      escrow: true,
      system: true,
      security: true,
      marketing: false,
      general: true,
    },
    frequency: 'instant',
    soundEnabled: true,
    vibrationEnabled: true,
    desktopNotifications: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [pushStatus, setPushStatus] = useState<{ subscribed: boolean; supported: boolean; permission: NotificationPermission }>({
    subscribed: false,
    supported: false,
    permission: 'default',
  });

  useEffect(() => {
    loadPreferences();
    loadPushStatus();
  }, [userId]);

  const loadPreferences = async () => {
    const saved = await notificationManager.getPreferences(userId);
    if (saved) {
      setPreferences({
        ...saved,
        categories: {
          transaction: true,
          escrow: true,
          system: true,
          security: true,
          marketing: false,
          general: true,
          ...saved.categories,
        },
      });
    }
  };

  const loadPushStatus = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushStatus({
          subscribed: !!subscription,
          supported: true,
          permission: 'Notification' in window ? Notification.permission : 'denied',
        });
      } catch (error) {
        console.error('Failed to load push status:', error);
      }
    }
  };

  const handleSave = async () => {
    await notificationManager.savePreferences(preferences);
    onSave?.(preferences);
  };

  const toggleChannel = (channel: NotificationChannel) => {
    const channels = preferences.enabledChannels.includes(channel)
      ? preferences.enabledChannels.filter(c => c !== channel)
      : [...preferences.enabledChannels, channel];
    setPreferences({ ...preferences, enabledChannels: channels });
  };

  const toggleCategory = (category: NotificationCategory) => {
    setPreferences({
      ...preferences,
      categories: {
        ...preferences.categories,
        [category]: !preferences.categories[category],
      },
    });
  };

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPushStatus(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        loadPushStatus();
      }
    }
  };

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: new Uint8Array([0]), // This should be your VAPID public key
      });
      
      setPushStatus(prev => ({ ...prev, subscribed: true }));
      
      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        setPushStatus(prev => ({ ...prev, subscribed: false }));
        
        // Remove subscription from server
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Notification Preferences</h3>

      {/* Channels */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Delivery Channels
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(['in-app', 'push', 'email'] as NotificationChannel[]).map(channel => (
            <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={preferences.enabledChannels.includes(channel)}
                onChange={() => toggleChannel(channel)}
                disabled={channel === 'push' && !pushStatus.supported}
              />
              {channel.charAt(0).toUpperCase() + channel.slice(1)}
              {channel === 'push' && !pushStatus.supported && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                  (Not supported)
                </span>
              )}
            </label>
          ))}
        </div>
        
        {/* Push Notification Controls */}
        {preferences.enabledChannels.includes('push') && pushStatus.supported && (
          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: '4px' }}>
            <div style={{ fontSize: '11px', marginBottom: '4px' }}>
              Status: {pushStatus.subscribed ? 'Subscribed' : 'Not subscribed'} | 
              Permission: {pushStatus.permission}
            </div>
            {pushStatus.permission === 'default' && (
              <button
                onClick={requestPushPermission}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                Request Permission
              </button>
            )}
            {pushStatus.permission === 'granted' && !pushStatus.subscribed && (
              <button
                onClick={subscribeToPush}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                Subscribe to Push
              </button>
            )}
            {pushStatus.subscribed && (
              <button
                onClick={unsubscribeFromPush}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  backgroundColor: 'var(--color-error)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                Unsubscribe
              </button>
            )}
          </div>
        )}
      </div>

      {/* Categories */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Notification Categories
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(['transaction', 'escrow', 'system', 'security', 'marketing', 'general'] as NotificationCategory[]).map(category => (
            <label key={category} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={preferences.categories[category]}
                onChange={() => toggleCategory(category)}
              />
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Priority Threshold */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Minimum Priority
        </label>
        <select
          value={preferences.priorityThreshold}
          onChange={(e) => setPreferences({ ...preferences, priorityThreshold: e.target.value as NotificationPriority })}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Frequency */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Notification Frequency
        </label>
        <select
          value={preferences.frequency}
          onChange={(e) => setPreferences({ ...preferences, frequency: e.target.value as any })}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <option value="instant">Instant</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      {/* Notification Settings */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Notification Settings
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={preferences.soundEnabled}
              onChange={(e) => setPreferences({ ...preferences, soundEnabled: e.target.checked })}
            />
            Enable Sound
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={preferences.vibrationEnabled}
              onChange={(e) => setPreferences({ ...preferences, vibrationEnabled: e.target.checked })}
            />
            Enable Vibration
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={preferences.desktopNotifications}
              onChange={(e) => setPreferences({ ...preferences, desktopNotifications: e.target.checked })}
            />
            Desktop Notifications
          </label>
        </div>
      </div>

      {/* Quiet Hours */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={!!preferences.quietHours}
            onChange={(e) => setPreferences({
              ...preferences,
              quietHours: e.target.checked ? { start: 22, end: 8 } : undefined,
            })}
          />
          Enable Quiet Hours
        </label>
        {preferences.quietHours && (
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
            <input
              type="number"
              min="0"
              max="23"
              value={preferences.quietHours.start}
              onChange={(e) => setPreferences({
                ...preferences,
                quietHours: { ...preferences.quietHours!, start: parseInt(e.target.value) },
              })}
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
            <span>to</span>
            <input
              type="number"
              min="0"
              max="23"
              value={preferences.quietHours.end}
              onChange={(e) => setPreferences({
                ...preferences,
                quietHours: { ...preferences.quietHours!, end: parseInt(e.target.value) },
              })}
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
          </div>
        )}
      </div>

      {/* Rate Limiting */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
          Max Notifications per Hour
        </label>
        <input
          type="number"
          min="1"
          max="100"
          value={preferences.maxNotificationsPerHour || 50}
          onChange={(e) => setPreferences({ 
            ...preferences, 
            maxNotificationsPerHour: parseInt(e.target.value) || undefined 
          })}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        style={{
          padding: '8px 12px',
          backgroundColor: 'var(--color-accent)',
          border: 'none',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Save Preferences
      </button>
    </div>
  );
}
