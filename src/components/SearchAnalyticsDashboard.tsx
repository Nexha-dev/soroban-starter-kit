import React, { useEffect, useState } from 'react';
import { searchManager } from '../services/search';
import type { SearchAnalytics } from '../services/search/types';

interface TopQuery { query: string; count: number; avgTime: number; }

export function SearchAnalyticsDashboard(): JSX.Element {
  const [recent, setRecent] = useState<SearchAnalytics[]>([]);
  const [top, setTop] = useState<TopQuery[]>([]);

  useEffect(() => {
    searchManager.getRecentHistory(8).then(setRecent);
    searchManager.getTopQueries(5).then(setTop);
  }, []);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span className="card-title">🔍 Search Analytics</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top queries */}
        <section>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Top Queries
          </h4>
          {top.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {top.map(({ query, count, avgTime }) => (
                <div key={query} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{query}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{count}×</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{avgTime.toFixed(1)}ms</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent history */}
        <section>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent Searches
          </h4>
          {recent.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>No history yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.query}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{a.resultCount} results</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{a.executionTime.toFixed(1)}ms</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
