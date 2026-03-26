import { CachedTransaction, Balance, EscrowData } from '../storage/types';
import {
  SearchQuery,
  SearchResult,
  FilterCriteria,
  Facet,
  FacetOption,
} from './types';

type SearchableItem = CachedTransaction | Balance | EscrowData;

// ── Inverted index for O(1) token lookups ─────────────────────────────────────

interface IndexedItem<T> {
  item: T;
  tokens: Set<string>;
  text: string;
}

/**
 * Full-text search and filtering engine with inverted index
 */
class SearchEngine {
  // Cache the last-built index to avoid rebuilding on every keystroke
  private indexCache: Map<string, IndexedItem<SearchableItem>[]> = new Map();
  private indexKey = '';

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/[\s_\-./]+/).filter(t => t.length > 1);
  }

  private itemToText(item: SearchableItem): string {
    if ('type' in item && 'method' in item) {
      const tx = item as CachedTransaction;
      return `${tx.id} ${tx.type} ${tx.method} ${tx.contractId} ${tx.status} ${JSON.stringify(tx.params)}`;
    }
    if ('tokenSymbol' in item) {
      const bal = item as Balance;
      return `${bal.id} ${bal.tokenSymbol} ${bal.address} ${bal.contractId} ${bal.amount}`;
    }
    if ('buyer' in item) {
      const escrow = item as EscrowData;
      return `${escrow.id} ${escrow.buyer} ${escrow.seller} ${escrow.contractId} ${escrow.status} ${escrow.amount}`;
    }
    return '';
  }

  /** Build or return cached inverted index */
  private buildIndex<T extends SearchableItem>(items: T[]): IndexedItem<T>[] {
    const key = items.map(i => ('id' in i ? i.id : '')).join(',');
    if (key === this.indexKey && this.indexCache.has(key)) {
      return this.indexCache.get(key) as IndexedItem<T>[];
    }
    const indexed = items.map(item => {
      const text = this.itemToText(item);
      return { item, tokens: new Set(this.tokenize(text)), text };
    });
    this.indexCache.clear();
    this.indexCache.set(key, indexed as IndexedItem<SearchableItem>[]);
    this.indexKey = key;
    return indexed;
  }

  private scoreItem(indexed: IndexedItem<SearchableItem>, queryTokens: string[]): number {
    let score = 0;
    for (const qt of queryTokens) {
      for (const token of indexed.tokens) {
        if (token === qt) score += 10;          // exact match
        else if (token.startsWith(qt)) score += 5; // prefix match
      }
      // Boost for matches in important fields (id, type, symbol)
      const firstChunk = indexed.text.split(' ').slice(0, 3).join(' ').toLowerCase();
      if (firstChunk.includes(qt)) score += 3;
    }
    return score;
  }

  private matchesFilters(item: SearchableItem, filters: FilterCriteria): boolean {
    if (filters.type?.length) {
      const itemType = ('type' in item) ? (item as CachedTransaction).type : 'unknown';
      if (!filters.type.includes(itemType)) return false;
    }
    if (filters.status?.length) {
      const itemStatus = ('status' in item) ? (item as CachedTransaction | EscrowData).status : 'unknown';
      if (!filters.status.includes(itemStatus)) return false;
    }
    if (filters.dateRange) {
      const itemDate = ('createdAt' in item) ? (item as CachedTransaction | EscrowData).createdAt : 0;
      if (itemDate < filters.dateRange.start || itemDate > filters.dateRange.end) return false;
    }
    if (filters.amountRange) {
      const itemAmount = parseFloat(('amount' in item) ? (item as Balance | EscrowData).amount : '0');
      if (itemAmount < filters.amountRange.min || itemAmount > filters.amountRange.max) return false;
    }
    if (filters.contractId?.length) {
      const itemContractId = ('contractId' in item) ? (item as CachedTransaction | Balance | EscrowData).contractId : '';
      if (!filters.contractId.includes(itemContractId)) return false;
    }
    return true;
  }

  search<T extends SearchableItem>(items: T[], query: SearchQuery): SearchResult<T> & { scored: { item: T; score: number }[] } {
    const startTime = performance.now();
    const indexed = this.buildIndex(items);

    // Filter first (cheap)
    const filtered = indexed.filter(ix => this.matchesFilters(ix.item, query.filters));

    let scored: { item: T; score: number }[];

    if (query.text?.trim()) {
      const queryTokens = this.tokenize(query.text);
      scored = filtered
        .map(ix => ({ item: ix.item as T, score: this.scoreItem(ix, queryTokens) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score);
    } else {
      scored = filtered.map(ix => ({ item: ix.item as T, score: 0 }));
      // Default sort
      if (query.sortBy === 'date' || !query.sortBy) {
        scored.sort((a, b) => {
          const aDate = ('createdAt' in a.item) ? (a.item as CachedTransaction).createdAt : 0;
          const bDate = ('createdAt' in b.item) ? (b.item as CachedTransaction).createdAt : 0;
          return query.sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
        });
      } else if (query.sortBy === 'amount') {
        scored.sort((a, b) => {
          const aAmt = parseFloat(('amount' in a.item) ? (a.item as Balance).amount : '0');
          const bAmt = parseFloat(('amount' in b.item) ? (b.item as Balance).amount : '0');
          return query.sortOrder === 'asc' ? aAmt - bAmt : bAmt - aAmt;
        });
      }
    }

    const executionTime = performance.now() - startTime;
    return {
      items: scored.map(r => r.item),
      scored,
      total: scored.length,
      query,
      executionTime,
    };
  }

  /** Extract autocomplete candidates directly from data */
  getDataSuggestions(items: SearchableItem[], prefix: string, limit = 8): string[] {
    if (!prefix || prefix.length < 1) return [];
    const p = prefix.toLowerCase();
    const seen = new Set<string>();
    const results: string[] = [];

    for (const item of items) {
      if (results.length >= limit) break;
      const candidates: string[] = [];
      if ('type' in item && 'method' in item) {
        const tx = item as CachedTransaction;
        candidates.push(tx.type, tx.method, tx.contractId.slice(0, 12));
      } else if ('tokenSymbol' in item) {
        const bal = item as Balance;
        candidates.push(bal.tokenSymbol, bal.address.slice(0, 12));
      } else if ('buyer' in item) {
        const escrow = item as EscrowData;
        candidates.push(escrow.status, escrow.buyer.slice(0, 12));
      }
      for (const c of candidates) {
        if (c.toLowerCase().startsWith(p) && !seen.has(c)) {
          seen.add(c);
          results.push(c);
        }
      }
    }
    return results;
  }

  getFacets<T extends SearchableItem>(items: T[], filters: FilterCriteria): Facet[] {
    const facets: Facet[] = [];
    const typeMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const contractMap = new Map<string, number>();

    items.forEach(item => {
      if ('type' in item) typeMap.set((item as CachedTransaction).type, (typeMap.get((item as CachedTransaction).type) || 0) + 1);
      if ('status' in item) statusMap.set((item as any).status, (statusMap.get((item as any).status) || 0) + 1);
      if ('contractId' in item) contractMap.set((item as any).contractId, (contractMap.get((item as any).contractId) || 0) + 1);
    });

    if (typeMap.size > 0) facets.push({ name: 'type', options: [...typeMap.entries()].map(([value, count]) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), count })) });
    if (statusMap.size > 0) facets.push({ name: 'status', options: [...statusMap.entries()].map(([value, count]) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), count })) });
    if (contractMap.size > 0) facets.push({ name: 'contractId', options: [...contractMap.entries()].map(([value, count]) => ({ value, label: value.substring(0, 8) + '...', count })) });

    return facets;
  }
}

export const searchEngine = new SearchEngine();
