import React, { useState, useEffect, useCallback } from 'react';
import { loggingService } from '../services/logging';
import type { ParsedLog, LogQuery, AnomalyAlert, LogStats, LogLevel, LogSource } from '../services/logging';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
const SOURCES: LogSource[] = ['app', 'contract', 'infrastructure', 'security', 'performance'];

const levelColor: Record<LogLevel, string> = {
  debug: '#6b7280',
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  critical: '#7c3aed',
};

export const LogDashboard: React.FC = () => {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [query, setQuery] = useState<LogQuery>({ levels: [], sources: [] });
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'logs' | 'alerts' | 'stats'>('logs');

  const refresh = useCallback(() => {
    const result = loggingService.search({ ...query, text: searchText || undefined });
    setLogs(result.entries);
    setStats(loggingService.getStats());
    setAlerts(loggingService.getAlerts());
  }, [query, searchText]);

  useEffect(() => {
    refresh();
    const unsub = loggingService.onAnomaly(() => refresh());
    const interval = setInterval(refresh, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [refresh]);

  const toggleLevel = (level: LogLevel) => {
    setQuery(q => ({
      ...q,
      levels: q.levels?.includes(level)
        ? q.levels.filter(l => l !== level)
        : [...(q.levels ?? []), level],
    }));
  };

  const toggleSource = (source: LogSource) => {
    setQuery(q => ({
      ...q,
      sources: q.sources?.includes(source)
        ? q.sources.filter(s => s !== source)
        : [...(q.sources ?? []), source],
    }));
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: '1rem', maxWidth: '1200px' }}>
      <h2 style={{ marginBottom: '1rem' }}>Log Management</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['logs', 'alerts', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.4rem 1rem',
              background: activeTab === tab ? '#3b82f6' : '#e5e7eb',
              color: activeTab === tab ? '#fff' : '#111',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'alerts' && alerts.length > 0 && (
              <span style={{ marginLeft: '0.4rem', background: '#ef4444', color: '#fff', borderRadius: '9999px', padding: '0 0.4rem', fontSize: '0.75rem' }}>
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'logs' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Search logs…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', flex: '1', minWidth: '200px' }}
              aria-label="Search logs"
            />
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    border: `2px solid ${levelColor[level]}`,
                    background: query.levels?.includes(level) ? levelColor[level] : 'transparent',
                    color: query.levels?.includes(level) ? '#fff' : levelColor[level],
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                  aria-pressed={query.levels?.includes(level)}
                >
                  {level}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {SOURCES.map(source => (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    border: '2px solid #6b7280',
                    background: query.sources?.includes(source) ? '#6b7280' : 'transparent',
                    color: query.sources?.includes(source) ? '#fff' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                  aria-pressed={query.sources?.includes(source)}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>

          {/* Log list */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#f9fafb', padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#6b7280' }}>
              {logs.length} entries
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {logs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No logs match the current filters.</div>
              ) : (
                logs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.5rem 1rem',
                      borderBottom: '1px solid #f3f4f6',
                      display: 'grid',
                      gridTemplateColumns: '160px 70px 110px 1fr',
                      gap: '0.5rem',
                      alignItems: 'start',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: '#9ca3af' }}>{new Date(log.timestamp).toISOString()}</span>
                    <span style={{ color: levelColor[log.level], fontWeight: 600 }}>{log.level.toUpperCase()}</span>
                    <span style={{ color: '#6b7280' }}>[{log.source}]</span>
                    <span>
                      {log.message}
                      {log.correlationId && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                          corr:{log.correlationId.slice(0, 8)}
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {alerts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No active anomaly alerts.</div>
          ) : (
            alerts.map(alert => (
              <div
                key={alert.id}
                style={{
                  padding: '0.75rem 1rem',
                  border: `1px solid ${levelColor[alert.severity]}`,
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div>
                  <span style={{ color: levelColor[alert.severity], fontWeight: 600, marginRight: '0.5rem' }}>
                    [{alert.type.toUpperCase()}]
                  </span>
                  <span style={{ fontSize: '0.85rem' }}>{alert.message}</span>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    {new Date(alert.timestamp).toLocaleString()} · {alert.affectedLogs.length} log(s)
                  </div>
                </div>
                <button
                  onClick={() => { loggingService.acknowledgeAlert(alert.id); refresh(); }}
                  style={{ padding: '0.3rem 0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Acknowledge
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <StatCard title="Total Logs" value={stats.total} />
          <StatCard title="Error Rate" value={`${(stats.errorRate * 100).toFixed(1)}%`} />
          <StatCard title="Active Anomalies" value={stats.anomalies} />
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>By Level</div>
            {LEVELS.map(level => (
              <div key={level} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span style={{ color: levelColor[level] }}>{level}</span>
                <span>{stats.byLevel[level]}</span>
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>By Source</div>
            {SOURCES.map(source => (
              <div key={source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>{source}</span>
                <span>{stats.bySource[source]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{title}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
  </div>
);
