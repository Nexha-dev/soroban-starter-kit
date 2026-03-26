import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchSuggestion } from '../services/search/types';
import { searchManager, searchEngine } from '../services/search';
import type { CachedTransaction, Balance, EscrowData } from '../services/storage/types';

type SearchableItem = CachedTransaction | Balance | EscrowData;

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  /** Live data items for data-driven autocomplete */
  items?: SearchableItem[];
}

export function SearchBar({ onSearch, placeholder = 'Search transactions, tokens, escrows…', items = [] }: SearchBarProps): JSX.Element {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<{ text: string; kind: 'history' | 'data' | 'saved' }[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const buildSuggestions = useCallback(async (value: string) => {
    if (!value.trim()) { setSuggestions([]); setOpen(false); return; }

    // 1. Past queries from analytics
    const historySuggestions = await searchManager.getSuggestions(value, 4);
    // 2. Live data candidates
    const dataCandidates = searchEngine.getDataSuggestions(items, value, 5);

    const combined: { text: string; kind: 'history' | 'data' | 'saved' }[] = [
      ...historySuggestions.map(s => ({ text: s.text, kind: (s.type === 'saved' ? 'saved' : 'history') as 'history' | 'saved' })),
      ...dataCandidates
        .filter(c => !historySuggestions.some(h => h.text === c))
        .map(c => ({ text: c, kind: 'data' as const })),
    ];

    setSuggestions(combined.slice(0, 8));
    setOpen(combined.length > 0);
    setActiveIdx(-1);
  }, [items]);

  useEffect(() => {
    const timer = setTimeout(() => buildSuggestions(input), 150);
    return () => clearTimeout(timer);
  }, [input, buildSuggestions]);

  const commit = (text: string) => {
    onSearch(text);
    setInput(text);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter') commit(input);
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); activeIdx >= 0 ? commit(suggestions[activeIdx].text) : commit(input); }
    else if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); }
  };

  const kindIcon = (kind: string) => kind === 'history' ? '🕐' : kind === 'saved' ? '💾' : '🔤';

  return (
    <div style={{ position: 'relative' }} role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setOpen(suggestions.length > 0)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          aria-label="Search"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 14 }}
        />
        <button
          className="btn btn-primary"
          onClick={() => commit(input)}
          style={{ padding: '8px 16px', fontSize: 14 }}
        >
          Search
        </button>
        {input && (
          <button
            className="btn btn-secondary"
            onClick={() => { setInput(''); onSearch(''); setOpen(false); }}
            aria-label="Clear search"
            style={{ padding: '8px 10px' }}
          >✕</button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          id="search-suggestions"
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--color-bg, #fff)', border: '1px solid var(--color-border)',
            borderTop: 'none', borderRadius: '0 0 6px 6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 240, overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.text}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => commit(s.text)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
                background: i === activeIdx ? 'var(--color-highlight, #ede9fe)' : 'transparent',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <span>{kindIcon(s.kind)}</span>
              <span style={{ flex: 1 }}>{s.text}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #9ca3af)', textTransform: 'uppercase' }}>{s.kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
