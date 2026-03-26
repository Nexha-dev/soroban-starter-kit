import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CachedTransaction, Balance, EscrowData } from '../services/storage/types';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { FacetedSearch } from './FacetedSearch';
import { SavedSearches } from './SavedSearches';
import { SearchAnalyticsDashboard } from './SearchAnalyticsDashboard';
import { searchEngine, searchManager } from '../services/search';
import { SearchQuery, FilterCriteria, SavedSearch, Facet } from '../services/search/types';

type SearchableItem = CachedTransaction | Balance | EscrowData;

interface SearchPageProps {
  transactions: CachedTransaction[];
  balances: Balance[];
  escrows: EscrowData[];
}

export function SearchPage({ transactions, balances, escrows }: SearchPageProps): JSX.Element {
  const [query, setQuery] = useState<SearchQuery>({ filters: {} });
  const [scored, setScored] = useState<{ item: SearchableItem; score: number }[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
  const [executionTime, setExecutionTime] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'relevance'>('date');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allItems: SearchableItem[] = [...transactions, ...balances, ...escrows];

  const performSearch = useCallback((q: SearchQuery, facetOverride?: Record<string, string[]>) => {
    const facetFilters: FilterCriteria = {};
    Object.entries(facetOverride ?? selectedFacets).forEach(([k, v]) => {
      if (v.length) (facetFilters as Record<string, unknown>)[k] = v;
    });

    const searchQuery: SearchQuery = {
      text: q.text,
      filters: { ...q.filters, ...facetFilters },
      sortBy,
      sortOrder: 'desc',
    };

    const result = searchEngine.search(allItems, searchQuery);
    setScored(result.scored);
    setExecutionTime(result.executionTime);
    setFacets(searchEngine.getFacets(allItems, searchQuery.filters));

    // Update facets
    const newFacets = searchEngine.getFacets(allItems, searchQuery.filters);
    setFacets(newFacets);

    // Record analytics
    await searchManager.recordAnalytics(
      query.text || '',
      searchQuery.filters as Record<string, unknown>,
      result.items.length,
      result.executionTime
    );
  };
    // Fire-and-forget analytics
    searchManager.recordAnalytics(q.text ?? '', searchQuery.filters as Record<string, unknown>, result.total, result.executionTime);
  }, [allItems, selectedFacets, sortBy]);

  // Debounced search on query/facet/sort changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedFacets, sortBy]);

  const handleSearch = (text: string) => setQuery(q => ({ ...q, text }));
  const handleFilterChange = (filters: FilterCriteria) => setQuery(q => ({ ...q, filters }));

  const handleFacetSelect = (facetName: string, value: string) => {
    const updated = { ...selectedFacets };
    updated[facetName] = updated[facetName]?.includes(value)
      ? updated[facetName].filter(v => v !== value)
      : [...(updated[facetName] ?? []), value];
    setSelectedFacets(updated);
  };

  const handleSaveSearch = async (name: string) => {
    await searchManager.saveSearch(name, query);
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setQuery(search.query);
    setSelectedFacets({});
  };

  const renderItem = (item: SearchableItem, score: number) => {
    const scoreTag = score > 0 && (
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#ede9fe', color: '#6366f1', fontWeight: 600 }}>
        ★ {score}
      </span>
    );

    if ('type' in item && 'method' in item) {
      const tx = item as CachedTransaction;
      return (
        <div key={tx.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                {tx.type} {scoreTag}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {tx.method} · {new Date(tx.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.contractId}
              </div>
            </div>
            <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: tx.status === 'synced' ? '#d4edda' : '#fff3cd', color: tx.status === 'synced' ? '#155724' : '#856404', whiteSpace: 'nowrap' }}>
              {tx.status}
            </span>
          </div>
        </div>
      );
    }
    if ('tokenSymbol' in item) {
      const bal = item as Balance;
      return (
        <div key={bal.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                {bal.tokenSymbol} {scoreTag}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{bal.address.slice(0, 20)}…</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{bal.amount}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{new Date(bal.lastUpdated).toLocaleString()}</div>
            </div>
          </div>
        </div>
      );
    }
    if ('buyer' in item) {
      const escrow = item as EscrowData;
      return (
        <div key={escrow.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                Escrow {scoreTag}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {escrow.buyer.slice(0, 12)}… → {escrow.seller.slice(0, 12)}…
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{escrow.amount}</div>
            </div>
            <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: '#d4edda', color: '#155724' }}>{escrow.status}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Search bar + analytics toggle */}
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SearchBar onSearch={handleSearch} items={allItems} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowAnalytics(v => !v)}>
            {showAnalytics ? '▲ Hide Analytics' : '📊 Search Analytics'}
          </button>
        </div>
        {showAnalytics && <SearchAnalyticsDashboard />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FilterPanel onFilterChange={handleFilterChange} />
          <FacetedSearch facets={facets} onFacetSelect={handleFacetSelect} selectedFacets={selectedFacets} />
          <SavedSearches onLoadSearch={handleLoadSearch} onSaveSearch={handleSaveSearch} />
        </div>

        {/* Results */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {scored.length} results · {executionTime.toFixed(2)}ms
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              style={{ padding: '5px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)' }}
            >
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="relevance">Sort: Relevance</option>
            </select>
          </div>

          {scored.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--color-text-secondary)' }}>No results. Try adjusting your search or filters.</p>
            </div>
          ) : (
            scored.map(({ item, score }) => renderItem(item, score))
          )}
        </div>
      </div>
    </div>
  );
}
