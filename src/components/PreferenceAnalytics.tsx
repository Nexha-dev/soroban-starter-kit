import React, { useEffect, useState } from 'react';
import { usePreferences } from '../context/PreferenceContext';

export function PreferenceAnalytics(): JSX.Element {
  const { getAnalytics } = usePreferences();
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await getAnalytics(100);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupByDate = (items: any[]) => {
    const groups: { [key: string]: any[] } = {};
    items.forEach(item => {
      const date = new Date(item.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  const getEventTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'pref_change': 'var(--color-accent)',
      'sync_event': 'var(--color-info)',
      'onboarding_progress': 'var(--color-success)',
      'backup_created': 'var(--color-warning)',
    };
    return colors[type] || 'var(--color-text-secondary)';
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        Loading analytics...
      </div>
    );
  }

  const grouped = groupByDate(analytics);

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginTop: 0, fontSize: '24px', marginBottom: '24px' }}>
        Preference Analytics
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Total Events
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600 }}>
            {analytics.length}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Preference Changes
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600 }}>
            {analytics.filter(a => a.type === 'pref_change').length}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Sync Events
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600 }}>
            {analytics.filter(a => a.type === 'sync_event').length}
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Last Activity
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {analytics.length > 0
              ? new Date(analytics[0].timestamp).toLocaleString()
              : 'No activity'}
          </div>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Recent Activity</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--color-bg-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                {date}
              </div>
              {events.map((event, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-bg-primary)',
                    borderLeft: `4px solid ${getEventTypeColor(event.type)}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                      {formatEventType(event.type)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {event.details}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {analytics.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            No preference events recorded yet
          </div>
        )}
      </div>

      <div style={{ marginTop: '32px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, fontSize: '14px', marginBottom: '12px' }}>Event Type Reference</h3>
        <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '4px', backgroundColor: 'var(--color-accent)', borderRadius: '2px' }} />
            <span>Preference Change - A user setting was modified</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '4px', backgroundColor: 'var(--color-info)', borderRadius: '2px' }} />
            <span>Sync Event - Preferences synchronized across devices</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '4px', backgroundColor: 'var(--color-success)', borderRadius: '2px' }} />
            <span>Onboarding Progress - User progressed through initial setup</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '4px', backgroundColor: 'var(--color-warning)', borderRadius: '2px' }} />
            <span>Backup Created - Manual preference backup was created</span>
          </div>
        </div>
      </div>

      <button
        onClick={loadAnalytics}
        style={{
          marginTop: '16px',
          padding: '10px 20px',
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        Refresh Analytics
      </button>
    </div>
  );
}

function formatEventType(type: string): string {
  const names: { [key: string]: string } = {
    'pref_change': 'Preference Changed',
    'sync_event': 'Synchronization Event',
    'onboarding_progress': 'Onboarding Progress',
    'backup_created': 'Backup Created',
  };
  return names[type] || type;
}
