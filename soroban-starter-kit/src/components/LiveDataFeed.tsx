import React, { useState, useEffect } from 'react';
import { DataPoint, WebSocketMessage } from '../services/visualization/types';
import { createWebSocketManager } from '../services/visualization';

interface LiveDataFeedProps {
  wsUrl?: string;
  onDataUpdate?: (data: DataPoint) => void;
}

export function LiveDataFeed({ wsUrl, onDataUpdate }: LiveDataFeedProps): JSX.Element {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<DataPoint | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (!wsUrl) return;

    const wsManager = createWebSocketManager(wsUrl);

    const handleMessage = (message: WebSocketMessage) => {
      const dataPoint: DataPoint = {
        timestamp: message.timestamp,
        value: typeof message.data.value === 'number' ? message.data.value : 0,
        label: message.data.label as string | undefined,
      };

      setLastUpdate(dataPoint);
      setUpdateCount(c => c + 1);
      onDataUpdate?.(dataPoint);
    };

    wsManager.connect()
      .then(() => {
        setIsConnected(true);
        wsManager.subscribe('price', handleMessage);
        wsManager.subscribe('transaction', handleMessage);
        wsManager.subscribe('balance', handleMessage);
      })
      .catch(console.error);

    return () => {
      wsManager.disconnect();
      setIsConnected(false);
    };
  }, [wsUrl, onDataUpdate]);

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'var(--color-bg-secondary)',
      borderRadius: '4px',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Live Data Feed</span>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-error)',
          animation: isConnected ? 'pulse 2s infinite' : 'none',
        }} />
      </div>

      {lastUpdate && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          <div>Latest: {lastUpdate.value.toFixed(2)}</div>
          <div>Updates: {updateCount}</div>
          <div>Time: {new Date(lastUpdate.timestamp).toLocaleTimeString()}</div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
