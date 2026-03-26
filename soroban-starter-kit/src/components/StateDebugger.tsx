import React, { useState, useEffect } from 'react';
import { useOptimizedState } from '../context/OptimizedStateContext';
import { devTools } from '../services/devTools';
import { performanceMonitor } from '../services/performanceMonitor';
import { stateValidator } from '../services/stateValidator';
import { useSyncEvents, usePerformanceMetrics } from '../hooks/useStateOptimization';

/**
 * State Debugger Component
 * Displays state metrics, history, performance data, validation, and sync events
 */
export function StateDebugger(): JSX.Element {
  const { metrics, state, validateState, getSyncEvents } = useOptimizedState();
  const [tab, setTab] = useState<'metrics' | 'history' | 'performance' | 'validation' | 'sync'>('metrics');
  const [history, setHistory] = useState<any[]>([]);
  const [perfSummary, setPerfSummary] = useState<Record<string, any>>({});
  const [validation, setValidation] = useState<any>(null);
  const syncEvents = useSyncEvents();
  const perfMetrics = usePerformanceMetrics();

  useEffect(() => {
    setHistory(devTools.getHistory());
    setPerfSummary(devTools.getPerformanceSummary());
    setValidation(validateState());
  }, [metrics, validateState]);

  const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0
    ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(2)
    : '0';

  return (
    <div style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>🔍 State Debugger</h3>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTab('metrics')}
            style={{
              padding: '6px 12px',
              backgroundColor: tab === 'metrics' ? '#007bff' : '#ddd',
              color: tab === 'metrics' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Metrics
          </button>
          <button
            onClick={() => setTab('history')}
            style={{
              padding: '6px 12px',
              backgroundColor: tab === 'history' ? '#007bff' : '#ddd',
              color: tab === 'history' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            History ({history.length})
          </button>
          <button
            onClick={() => setTab('performance')}
            style={{
              padding: '6px 12px',
              backgroundColor: tab === 'performance' ? '#007bff' : '#ddd',
              color: tab === 'performance' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Performance
          </button>
          <button
            onClick={() => setTab('validation')}
            style={{
              padding: '6px 12px',
              backgroundColor: tab === 'validation' ? '#007bff' : '#ddd',
              color: tab === 'validation' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Validation
          </button>
          <button
            onClick={() => setTab('sync')}
            style={{
              padding: '6px 12px',
              backgroundColor: tab === 'sync' ? '#007bff' : '#ddd',
              color: tab === 'sync' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Sync ({syncEvents.length})
          </button>
        </div>
      </div>

      {tab === 'metrics' && (
        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '4px' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Updates:</strong> {metrics.updateCount}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Last Update:</strong> {metrics.lastUpdateTime.toFixed(2)}ms
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Avg Update:</strong> {metrics.averageUpdateTime.toFixed(2)}ms
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Cache Hit Rate:</strong> {cacheHitRate}% ({metrics.cacheHits} hits, {metrics.cacheMisses} misses)
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Memory:</strong> {(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>State Size:</strong>
            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
              <li>Balances: {Object.keys(state.balances).length}</li>
              <li>Escrows: {Object.keys(state.escrows).length}</li>
              <li>Transactions: {Object.keys(state.transactions).length}</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <p style={{ margin: 0, color: '#999' }}>No history recorded</p>
          ) : (
            history.map((snapshot, idx) => (
              <div key={idx} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                <div style={{ color: '#666' }}>
                  {new Date(snapshot.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  Updates: {snapshot.metrics.updateCount} | Cache: {snapshot.metrics.cacheHits}/{snapshot.metrics.cacheMisses}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'performance' && (
        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
          {Object.keys(perfSummary).length === 0 ? (
            <p style={{ margin: 0, color: '#999' }}>No performance data</p>
          ) : (
            Object.entries(perfSummary).map(([label, stats]: [string, any]) => (
              <div key={label} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold' }}>{label}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Avg: {stats.avg.toFixed(2)}ms | Min: {stats.min.toFixed(2)}ms | Max: {stats.max.toFixed(2)}ms | Count: {stats.count}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'validation' && (
        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
          {!validation ? (
            <p style={{ margin: 0, color: '#999' }}>No validation data</p>
          ) : (
            <>
              <div style={{ marginBottom: '8px' }}>
                <strong>Status:</strong> {validation.valid ? '✅ Valid' : '❌ Invalid'}
              </div>
              {validation.errors.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Errors ({validation.errors.length}):</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '11px' }}>
                    {validation.errors.map((err: any, idx: number) => (
                      <li key={idx}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div>
                  <strong>Warnings ({validation.warnings.length}):</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '11px' }}>
                    {validation.warnings.map((warn: string, idx: number) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'sync' && (
        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
          {syncEvents.length === 0 ? (
            <p style={{ margin: 0, color: '#999' }}>No sync events</p>
          ) : (
            syncEvents.slice(-20).map((event: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold', color: '#007bff' }}>{event.type}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {new Date(event.timestamp).toLocaleTimeString()} | Source: {event.source}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default StateDebugger;
