/**
 * Search and filter system types
 */

export interface SearchQuery {
  text?: string;
  filters: FilterCriteria;
  sortBy?: 'date' | 'amount' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterCriteria {
  type?: string[];
  status?: string[];
  dateRange?: { start: number; end: number };
  amountRange?: { min: number; max: number };
  contractId?: string[];
  customFilters?: Record<string, unknown>;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  query: SearchQuery;
  executionTime: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  createdAt: number;
  lastUsed?: number;
  useCount: number;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  filters: FilterCriteria;
  resultCount: number;
  executionTime: number;
  timestamp: number;
  userId?: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'filter' | 'saved';
  frequency: number;
  lastUsed: number;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facet {
  name: string;
  options: FacetOption[];
}
