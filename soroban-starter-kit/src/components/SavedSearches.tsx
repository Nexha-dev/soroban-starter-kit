import React, { useState, useEffect } from 'react';
import { SavedSearch } from '../services/search/types';
import { searchManager } from '../services/search';

interface SavedSearchesProps {
  onLoadSearch: (search: SavedSearch) => void;
  onSaveSearch: (name: string, query: any) => void;
}

export function SavedSearches({ onLoadSearch, onSaveSearch }: SavedSearchesProps): JSX.Element {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    loadSearches();
  }, []);

  const loadSearches = async () => {
    const saved = await searchManager.getSavedSearches();
    setSearches(saved.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)));
  };

  const handleSave = async () => {
    if (searchName.trim()) {
      onSaveSearch(searchName, {});
      setSearchName('');
      setShowSaveForm(false);
      await loadSearches();
    }
  };

  const handleDelete = async (id: string) => {
    await searchManager.deleteSavedSearch(id);
    await loadSearches();
  };

  const handleLoad = async (search: SavedSearch) => {
    await searchManager.updateSearchUsage(search.id);
    onLoadSearch(search);
    await loadSearches();
  };

  return (
    <div className="saved-searches" style={{ padding: '12px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Saved Searches</h3>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          {showSaveForm ? '✕' : '+ Save'}
        </button>
      </div>

      {showSaveForm && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Search name..."
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Save
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
        {searches.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>No saved searches</p>
        ) : (
          searches.map(search => (
            <div
              key={search.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: 'var(--color-bg)',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              <button
                onClick={() => handleLoad(search)}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  padding: 0,
                }}
              >
                <div style={{ fontWeight: 500 }}>{search.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                  Used {search.useCount} times
                </div>
              </button>
              <button
                onClick={() => handleDelete(search.id)}
                className="btn btn-secondary"
                style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--color-error)' }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
