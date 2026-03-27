import React, { useState, useEffect } from 'react';
import { CachedTransaction, Balance, EscrowData } from '../services/storage/types';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { FacetedSearch } from './FacetedSearch';
import { SavedSearches } from './SavedSearches';
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
  const [results, setResults] = useState<SearchableItem[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
  const [executionTime, setExecutionTime] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'relevance'>('date');

  const allItems: SearchableItem[] = [...transactions, ...balances, ...escrows];

  useEffect(() => {
    performSearch();
  }, [query, selectedFacets, sortBy]);

  const performSearch = async () => {
    const searchQuery: SearchQuery = {
      text: query.text,
      filters: { ...query.filters, ...buildFiltersFromFacets() },
      sortBy,
      sortOrder: 'desc',
    };

    const result = searchEngine.search(allItems, searchQuery);
    setResults(result.items);
    setExecutionTime(result.executionTime);

    // Update facets
    const newFacets = searchEngine.getFacets(allItems, searchQuery.filters);
    setFacets(newFacets);

    // Record analytics
    await searchManager.recordAnalytics(
      query.text || '',
      searchQuery.filters as unknown as Record<string, unknown>,
      result.items.length,
      result.executionTime
    );
  };

  const buildFiltersFromFacets = (): FilterCriteria => {
    const filters: FilterCriteria = {};
    Object.entries(selectedFacets).forEach(([facetName, values]) => {
      if (values.length > 0) {
        (filters as any)[facetName] = values;
      }
    });
    return filters;
  };

  const handleSearch = (text: string) => {
    setQuery({ ...query, text });
  };

  const handleFilterChange = (filters: FilterCriteria) => {
    setQuery({ ...query, filters });
  };

  const handleFacetSelect = (facetName: string, value: string) => {
    const updated = { ...selectedFacets };
    if (!updated[facetName]) {
      updated[facetName] = [];
    }
    if (updated[facetName].includes(value)) {
      updated[facetName] = updated[facetName].filter(v => v !== value);
    } else {
      updated[facetName].push(value);
    }
    setSelectedFacets(updated);
  };

  const handleSaveSearch = async (name: string, currentQuery: SearchQuery) => {
    await searchManager.saveSearch(name, query);
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setQuery(search.query);
    setSelectedFacets({});
  };

  const renderItem = (item: SearchableItem) => {
    if ('type' in item && 'method' in item) {
      const tx = item as CachedTransaction;
      return (
        <div key={tx.id} className="card" style={{ marginBottom: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{tx.type}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                {tx.method} • {new Date(tx.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {JSON.stringify(tx.params).substring(0, 100)}...
              </div>
            </div>
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: tx.status === 'synced' ? '#d4edda' : '#fff3cd',
              color: tx.status === 'synced' ? '#155724' : '#856404',
            }}>
              {tx.status}
            </span>
          </div>
        </div>
      );
    }
    if ('tokenSymbol' in item) {
      const bal = item as Balance;
      return (
        <div key={bal.id} className="card" style={{ marginBottom: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{bal.tokenSymbol}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                {bal.address.substring(0, 16)}...
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{bal.amount}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                {new Date(bal.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      );
    }
    if ('buyer' in item) {
      const escrow = item as EscrowData;
      return (
        <div key={escrow.id} className="card" style={{ marginBottom: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Escrow</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                {escrow.buyer.substring(0, 16)}... → {escrow.seller.substring(0, 16)}...
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>{escrow.amount}</div>
            </div>
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: '#d4edda',
              color: '#155724',
            }}>
              {escrow.status}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '16px', padding: '16px' }}>
      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FilterPanel onFilterChange={handleFilterChange} />
        <FacetedSearch facets={facets} onFacetSelect={handleFacetSelect} selectedFacets={selectedFacets} />
        <SavedSearches onLoadSearch={handleLoadSearch} onSaveSearch={handleSaveSearch} />
      </div>

      {/* Main Content */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <SearchBar onSearch={handleSearch} />
        </div>

        {/* Results Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          padding: '8px 0',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: '14px', color: 'var(--color-muted)' }}>
            {results.length} results found in {executionTime.toFixed(2)}ms
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
            }}
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="relevance">Sort by Relevance</option>
          </select>
        </div>

        {/* Results */}
        <div>
          {results.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ color: 'var(--color-muted)' }}>No results found. Try adjusting your search or filters.</p>
            </div>
          ) : (
            results.map(item => renderItem(item))
          )}
        </div>
      </div>
    </div>
  );
}
