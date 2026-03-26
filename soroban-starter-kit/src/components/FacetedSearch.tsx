import React, { useState } from 'react';
import { Facet } from '../services/search/types';

interface FacetedSearchProps {
  facets: Facet[];
  onFacetSelect: (facetName: string, value: string) => void;
  selectedFacets?: Record<string, string[]>;
}

export function FacetedSearch({
  facets,
  onFacetSelect,
  selectedFacets = {},
}: FacetedSearchProps): JSX.Element {
  const [expandedFacets, setExpandedFacets] = useState<Set<string>>(new Set(facets.map(f => f.name)));

  const toggleFacet = (facetName: string) => {
    const updated = new Set(expandedFacets);
    if (updated.has(facetName)) {
      updated.delete(facetName);
    } else {
      updated.add(facetName);
    }
    setExpandedFacets(updated);
  };

  return (
    <div className="faceted-search" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {facets.map(facet => (
        <div key={facet.name} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          <button
            onClick={() => toggleFacet(facet.name)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 0',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {facet.name.charAt(0).toUpperCase() + facet.name.slice(1)}
            <span>{expandedFacets.has(facet.name) ? '−' : '+'}</span>
          </button>

          {expandedFacets.has(facet.name) && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {facet.options.map(option => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFacets[facet.name]?.includes(option.value) || false}
                    onChange={() => onFacetSelect(facet.name, option.value)}
                  />
                  <span>{option.label}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: '12px' }}>
                    ({option.count})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
