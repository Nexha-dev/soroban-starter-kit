import React, { useState } from 'react';
import { usePreferences } from '../context/PreferenceContext';
import { PreferenceUpdatePayload } from '../services/preferences/types';

type TabType = 'theme' | 'notifications' | 'display' | 'privacy' | 'sync' | 'backup';

export function PreferenceManagement(): JSX.Element {
  const {
    preferences,
    loading,
    error,
    updatePreferences,
    createBackup,
    restoreFromBackup,
    exportPreferences,
    importPreferences,
    getBackups,
    deleteBackup,
    linkDevice,
    unlinkDevice,
    getAnalytics,
  } = usePreferences();

  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [backups, setBackups] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  React.useEffect(() => {
    if (activeTab === 'backup') {
      loadBackups();
    }
  }, [activeTab]);

  const loadBackups = async () => {
    const backupList = await getBackups();
    setBackups(backupList);
  };

  const handleSave = async (updates: PreferenceUpdatePayload) => {
    try {
      setSaving(true);
      await updatePreferences(updates);
      setSuccessMessage('Preferences saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center' }}>Loading preferences...</div>;
  }

  if (!preferences) {
    return <div style={{ padding: '16px', color: 'var(--color-error)' }}>Failed to load preferences</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Sidebar Navigation */}
      <div style={{ width: '200px', borderRight: '1px solid var(--color-border)', overflowY: 'auto' }}>
        <div style={{ padding: '16px', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
          Preferences
        </div>
        {(['theme', 'notifications', 'display', 'privacy', 'sync', 'backup'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              width: '100%',
              padding: '12px 16px',
              textAlign: 'left',
              backgroundColor: activeTab === tab ? 'var(--color-highlight)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              borderLeft: activeTab === tab ? '3px solid var(--color-accent)' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              color: 'var(--color-error)',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 255, 0, 0.1)',
              color: 'var(--color-success)',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Theme Tab */}
        {activeTab === 'theme' && (
          <ThemeTab preferences={preferences} onSave={handleSave} saving={saving} />
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <NotificationsTab preferences={preferences} onSave={handleSave} saving={saving} />
        )}

        {/* Display Tab */}
        {activeTab === 'display' && (
          <DisplayTab preferences={preferences} onSave={handleSave} saving={saving} />
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <PrivacyTab preferences={preferences} onSave={handleSave} saving={saving} />
        )}

        {/* Sync Tab */}
        {activeTab === 'sync' && (
          <SyncTab preferences={preferences} onSave={handleSave} onLinkDevice={linkDevice} onUnlinkDevice={unlinkDevice} saving={saving} />
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <BackupTab
            preferences={preferences}
            backups={backups}
            onCreateBackup={createBackup}
            onRestoreBackup={restoreFromBackup}
            onDeleteBackup={deleteBackup}
            onExport={exportPreferences}
            onImport={importPreferences}
            onLoadBackups={loadBackups}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

// Theme Tab Component
function ThemeTab({ preferences, onSave, saving }: any) {
  const [theme, setTheme] = useState(preferences.theme);

  const handleSave = () => {
    onSave({ theme });
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '24px' }}>Theme Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Theme
        </label>
        <select
          value={theme.theme}
          onChange={(e) => setTheme({ ...theme, theme: e.target.value as any })}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Automatically switch based on system preferences with 'Auto'
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Font Size
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['small', 'normal', 'large'] as const).map(size => (
            <button
              key={size}
              onClick={() => setTheme({ ...theme, fontSize: size })}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.fontSize === size ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={theme.compactMode}
            onChange={(e) => setTheme({ ...theme, compactMode: e.target.checked })}
          />
          Compact Mode
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Reduce spacing and padding for a denser interface
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 20px',
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Notifications Tab Component
function NotificationsTab({ preferences, onSave, saving }: any) {
  const [notifications, setNotifications] = useState(preferences.notifications);

  const handleSave = () => {
    onSave({ notifications });
  };

  const toggleChannel = (channel: string) => {
    const enabled = notifications.enabledChannels.includes(channel)
      ? notifications.enabledChannels.filter((c: string) => c !== channel)
      : [...notifications.enabledChannels, channel];
    setNotifications({ ...notifications, enabledChannels: enabled });
  };

  const toggleCategory = (category: string) => {
    setNotifications({
      ...notifications,
      categories: { ...notifications.categories, [category]: !notifications.categories[category] },
    });
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '24px' }}>Notification Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Delivery Channels
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(['in-app', 'push', 'email'] as const).map(channel => (
            <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={notifications.enabledChannels.includes(channel)}
                onChange={() => toggleChannel(channel)}
              />
              {channel.charAt(0).toUpperCase() + channel.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Minimum Priority
        </label>
        <select
          value={notifications.priorityThreshold}
          onChange={(e) => setNotifications({ ...notifications, priorityThreshold: e.target.value })}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Notification Categories
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(notifications.categories).map(([category, enabled]: [string, any]) => (
            <label key={category} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleCategory(category)}
              />
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Quiet Hours
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={notifications.quietHours.enabled}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                quietHours: { ...notifications.quietHours, enabled: e.target.checked },
              })
            }
          />
          Enable Quiet Hours
        </label>
        {notifications.quietHours.enabled && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <input
              type="time"
              value={notifications.quietHours.start}
              onChange={(e) =>
                setNotifications({
                  ...notifications,
                  quietHours: { ...notifications.quietHours, start: e.target.value },
                })
              }
              style={{
                padding: '8px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
            <input
              type="time"
              value={notifications.quietHours.end}
              onChange={(e) =>
                setNotifications({
                  ...notifications,
                  quietHours: { ...notifications.quietHours, end: e.target.value },
                })
              }
              style={{
                padding: '8px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 20px',
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Display Tab Component
function DisplayTab({ preferences, onSave, saving }: any) {
  const [display, setDisplay] = useState(preferences.display);

  const handleSave = () => {
    onSave({ display });
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '24px' }}>Display Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Language
        </label>
        <select
          value={display.language}
          onChange={(e) => setDisplay({ ...display, language: e.target.value })}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Timezone
        </label>
        <input
          type="text"
          value={display.timezone}
          onChange={(e) => setDisplay({ ...display, timezone: e.target.value })}
          placeholder="e.g., UTC, America/New_York"
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Time Format
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['12h', '24h'] as const).map(format => (
            <button
              key={format}
              onClick={() => setDisplay({ ...display, timeFormat: format })}
              style={{
                padding: '8px 16px',
                backgroundColor: display.timeFormat === format ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Date Format
        </label>
        <select
          value={display.dateFormat}
          onChange={(e) => setDisplay({ ...display, dateFormat: e.target.value as any })}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Currency
        </label>
        <input
          type="text"
          value={display.currency}
          onChange={(e) => setDisplay({ ...display, currency: e.target.value })}
          placeholder="e.g., USD, EUR, GBP"
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={display.showAdvancedOptions}
            onChange={(e) => setDisplay({ ...display, showAdvancedOptions: e.target.checked })}
          />
          Show Advanced Options
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 20px',
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Privacy Tab Component
function PrivacyTab({ preferences, onSave, saving }: any) {
  const [privacy, setPrivacy] = useState(preferences.privacy);

  const handleSave = () => {
    onSave({ privacy });
  };

  const toggleSetting = (key: string) => {
    setPrivacy({ ...privacy, [key]: !privacy[key] });
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '24px' }}>Privacy Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={privacy.dataCollection}
            onChange={() => toggleSetting('dataCollection')}
          />
          Allow Data Collection
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '24px', marginBottom: '16px' }}>
          Help us improve by collecting usage statistics
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={privacy.crashReports}
            onChange={() => toggleSetting('crashReports')}
          />
          Send Crash Reports
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '24px', marginBottom: '16px' }}>
          Automatically report errors to help fix issues faster
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={privacy.analyticsTracking}
            onChange={() => toggleSetting('analyticsTracking')}
          />
          Analytics Tracking
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '24px', marginBottom: '16px' }}>
          Allow tracking of feature usage and performance
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={privacy.personalizedResults}
            onChange={() => toggleSetting('personalizedResults')}
          />
          Personalized Results
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '24px', marginBottom: '16px' }}>
          Use your behavior to personalize search and recommendations
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={privacy.shareUsageData}
            onChange={() => toggleSetting('shareUsageData')}
          />
          Share Usage Data
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '24px', marginBottom: '16px' }}>
          Share aggregated usage patterns with researchers
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={privacy.allowCrossSyncData}
            onChange={() => toggleSetting('allowCrossSyncData')}
          />
          Allow Cross-Device Synchronization
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '24px' }}>
          Sync preferences and data across your linked devices
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 20px',
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Sync Tab Component
function SyncTab({ preferences, onSave, onLinkDevice, onUnlinkDevice, saving }: any) {
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'web' | 'mobile' | 'desktop'>('web');

  const handleLinkDevice = async () => {
    if (!deviceName.trim()) return;
    try {
      await onLinkDevice({ name: deviceName, type: deviceType });
      setDeviceName('');
      setShowLinkForm(false);
    } catch (err) {
      console.error('Failed to link device:', err);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '24px' }}>Synchronization Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={preferences.sync.enableCloudSync}
            onChange={(e) => onSave({ sync: { ...preferences.sync, enableCloudSync: e.target.checked } })}
          />
          Enable Cloud Sync
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Synchronize preferences across all your devices
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={preferences.sync.autoSync}
            onChange={(e) => onSave({ sync: { ...preferences.sync, autoSync: e.target.checked } })}
            disabled={!preferences.sync.enableCloudSync}
          />
          Auto Sync
        </label>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Automatically synchronize when changes are detected
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Linked Devices</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {preferences.sync.linkedDevices.map((device: any) => (
            <div
              key={device.id}
              style={{
                padding: '12px',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{device.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {device.type} • {device.osType}
                </div>
              </div>
              {device.canRemove && (
                <button
                  onClick={() => onUnlinkDevice(device.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-error)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowLinkForm(!showLinkForm)}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          {showLinkForm ? 'Cancel' : 'Link New Device'}
        </button>

        {showLinkForm && (
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Device Name
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., My Phone"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Device Type
              </label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                <option value="web">Web</option>
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
              </select>
            </div>

            <button
              onClick={handleLinkDevice}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Link Device
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Sync Interval (seconds)
        </label>
        <input
          type="number"
          value={Math.round(preferences.sync.syncInterval / 1000)}
          onChange={(e) => onSave({ sync: { ...preferences.sync, syncInterval: e.target.valueAsNumber * 1000 } })}
          min="30"
          max="3600"
          style={{
            width: '100px',
            padding: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
      </div>
    </div>
  );
}

// Backup Tab Component
function BackupTab({
  preferences,
  backups,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
  onExport,
  onImport,
  onLoadBackups,
  saving,
}: any) {
  const [backupNotes, setBackupNotes] = useState('');
  const [importing, setImporting] = useState(false);

  const handleCreateBackup = async () => {
    try {
      await onCreateBackup(backupNotes);
      setBackupNotes('');
      await onLoadBackups();
    } catch (err) {
      console.error('Failed to create backup:', err);
    }
  };

  const handleExport = async () => {
    try {
      const json = await onExport();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preferences-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      await onImport(text);
      await onLoadBackups();
    } catch (err) {
      console.error('Failed to import:', err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: '18px', marginBottom: '24px' }}>Backup & Restore</h2>

      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, fontSize: '14px', marginBottom: '12px' }}>Create Backup</h3>
        <textarea
          value={backupNotes}
          onChange={(e) => setBackupNotes(e.target.value)}
          placeholder="Add optional notes (e.g., 'Before system update')"
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '12px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '12px',
            resize: 'vertical',
            minHeight: '60px',
          }}
        />
        <button
          onClick={handleCreateBackup}
          disabled={saving}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, fontSize: '14px', marginBottom: '12px' }}>Export/Import</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Export as JSON
          </button>
          <label style={{ flex: 1 }}>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              style={{ display: 'none' }}
            />
            <button
              as="span"
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 16px',
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? 'Importing...' : 'Import from JSON'}
            </button>
          </label>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Previous Backups ({backups.length})</h3>
        {backups.length === 0 ? (
          <div style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            No backups created yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {backups.map((backup: any) => (
              <div
                key={backup.id}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {new Date(backup.timestamp).toLocaleString()}
                  </div>
                  {backup.notes && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      {backup.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onRestoreBackup(backup.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onDeleteBackup(backup.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-error)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
