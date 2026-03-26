# Search and Filter System Implementation Guide

## Issue #5: Advanced Search and Filter System

This document describes the complete implementation of the advanced search and filter system for the Soroban DApp.

## Acceptance Criteria - Implementation Status

### ✅ Full-text search with intelligent suggestions
- **Location**: `src/services/search/searchEngine.ts`
- **Features**:
  - Tokenized text search with relevance scoring
  - Intelligent query matching across all searchable fields
  - Suggestions based on search history via `src/components/SearchBar.tsx`
  - Frequency-based ranking of suggestions

### ✅ Advanced faceted filtering options
- **Location**: `src/components/FacetedSearch.tsx`
- **Features**:
  - Dynamic facet generation based on data
  - Multi-select facet options with result counts
  - Collapsible facet categories
  - Real-time facet updates

### ✅ Saved searches and search history
- **Location**: `src/services/search/searchManager.ts` and `src/components/SavedSearches.tsx`
- **Features**:
  - Save frequently used search queries
  - Track search usage and frequency
  - Quick access to saved searches
  - Delete saved searches
  - Persistent storage via IndexedDB

### ✅ Complex query building interface
- **Location**: `src/components/FilterPanel.tsx` and `src/components/SearchPage.tsx`
- **Features**:
  - Type and status checkboxes
  - Date range picker
  - Amount range inputs
  - Advanced filter toggle
  - Reset button
  - Combined filter and search interface

### ✅ Search performance optimization
- **Location**: `src/services/search/searchEngine.ts`
- **Features**:
  - O(n) search complexity
  - Efficient relevance scoring
  - Execution time tracking
  - Minimal memory footprint
  - No data duplication

### ✅ Personalized results and analytics
- **Location**: `src/services/search/searchManager.ts`
- **Features**:
  - Search analytics recording
  - Query and filter tracking
  - Result count and execution time logging
  - Automatic cleanup of old analytics data
  - User search behavior tracking

## File Structure

```
src/
├── services/
│   └── search/
│       ├── index.ts                 # Public API exports
│       ├── types.ts                 # TypeScript interfaces
│       ├── searchEngine.ts          # Core search logic
│       ├── searchManager.ts         # Persistent data management
│       └── __tests__/
│           └── searchEngine.test.ts # Unit tests
├── components/
│   ├── SearchBar.tsx                # Search input with suggestions
│   ├── FilterPanel.tsx              # Advanced filter controls
│   ├── FacetedSearch.tsx            # Faceted search UI
│   ├── SavedSearches.tsx            # Saved search management
│   ├── SearchPage.tsx               # Integrated search interface
│   └── index.ts                     # Component exports
└── App.tsx                          # Updated with search tab
```

## Core Components

### 1. SearchEngine (`src/services/search/searchEngine.ts`)

The core search and filtering engine with O(n) complexity.

**Key Methods**:
- `search<T>(items, query)`: Execute search with filters and sorting
- `getFacets<T>(items, filters)`: Generate facet options
- `tokenizeText(text)`: Parse search queries
- `calculateRelevance(item, tokens)`: Score search results

**Example**:
```typescript
import { searchEngine } from '@/services/search';

const results = searchEngine.search(transactions, {
  text: 'transfer',
  filters: {
    type: ['transfer'],
    status: ['synced'],
    dateRange: { start: Date.now() - 7*24*60*60*1000, end: Date.now() }
  },
  sortBy: 'date',
  sortOrder: 'desc'
});

console.log(`Found ${results.items.length} results in ${results.executionTime}ms`);
```

### 2. SearchManager (`src/services/search/searchManager.ts`)

Manages persistent search data using IndexedDB.

**Key Methods**:
- `saveSearch(name, query)`: Save a search query
- `getSavedSearches()`: Retrieve all saved searches
- `recordAnalytics(query, filters, resultCount, executionTime)`: Log search analytics
- `getSuggestions(prefix, limit)`: Get search suggestions
- `clearOldAnalytics(daysOld)`: Clean up old analytics

**Example**:
```typescript
import { searchManager } from '@/services/search';

// Save a search
const saved = await searchManager.saveSearch('My Transfers', {
  text: 'transfer',
  filters: { type: ['transfer'] }
});

// Record analytics
await searchManager.recordAnalytics('transfer', { type: ['transfer'] }, 42, 12.5);

// Get suggestions
const suggestions = await searchManager.getSuggestions('trans', 5);
```

### 3. SearchBar Component (`src/components/SearchBar.tsx`)

Text input with real-time autocomplete suggestions.

**Props**:
- `onSearch: (query: string) => void`: Callback when search is submitted
- `placeholder?: string`: Input placeholder text

**Features**:
- Real-time suggestion display
- Keyboard navigation support
- Suggestion frequency display

### 4. FilterPanel Component (`src/components/FilterPanel.tsx`)

Advanced filter controls with multiple filter types.

**Props**:
- `onFilterChange: (filters: FilterCriteria) => void`: Callback when filters change
- `typeOptions?: string[]`: Available transaction types
- `statusOptions?: string[]`: Available statuses

**Features**:
- Type and status checkboxes
- Date range picker
- Amount range inputs
- Advanced filter toggle
- Reset button

### 5. FacetedSearch Component (`src/components/FacetedSearch.tsx`)

Dynamic faceted search interface.

**Props**:
- `facets: Facet[]`: Facet data
- `onFacetSelect: (facetName, value) => void`: Callback when facet is selected
- `selectedFacets?: Record<string, string[]>`: Currently selected facets

**Features**:
- Collapsible facet categories
- Multi-select options
- Result count display
- Dynamic updates

### 6. SavedSearches Component (`src/components/SavedSearches.tsx`)

Manage saved searches with usage tracking.

**Props**:
- `onLoadSearch: (search: SavedSearch) => void`: Callback when search is loaded
- `onSaveSearch: (name, query) => void`: Callback when search is saved

**Features**:
- List saved searches
- Save new search form
- Usage tracking display
- Delete functionality

### 7. SearchPage Component (`src/components/SearchPage.tsx`)

Integrated search interface combining all components.

**Props**:
- `transactions: CachedTransaction[]`: Transactions to search
- `balances: Balance[]`: Balances to search
- `escrows: EscrowData[]`: Escrows to search

**Features**:
- Full search interface
- Results display with formatting
- Sorting options
- Performance metrics
- Responsive layout

## Data Types

### SearchQuery
```typescript
interface SearchQuery {
  text?: string;                    // Full-text search query
  filters: FilterCriteria;          // Filter criteria
  sortBy?: 'date' | 'amount' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}
```

### FilterCriteria
```typescript
interface FilterCriteria {
  type?: string[];                  // Transaction types
  status?: string[];                // Transaction statuses
  dateRange?: { start: number; end: number };
  amountRange?: { min: number; max: number };
  contractId?: string[];            // Contract addresses
  customFilters?: Record<string, unknown>;
}
```

### SearchResult
```typescript
interface SearchResult<T> {
  items: T[];                       // Search results
  total: number;                    // Total result count
  query: SearchQuery;               // Original query
  executionTime: number;            // Search execution time in ms
}
```

### SavedSearch
```typescript
interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  createdAt: number;
  lastUsed?: number;
  useCount: number;
}
```

### SearchAnalytics
```typescript
interface SearchAnalytics {
  id: string;
  query: string;
  filters: FilterCriteria;
  resultCount: number;
  executionTime: number;
  timestamp: number;
  userId?: string;
}
```

## Integration with App

The search system is integrated into the main app via a new "Search & Filter" tab:

```tsx
// In App.tsx
const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'search'>('balances');

// Tab button
<button onClick={() => setActiveTab('search')}>
  🔍 Search & Filter
</button>

// Content
{activeTab === 'search' && (
  <SearchPage
    transactions={[...pendingTransactions, ...syncedTransactions]}
    balances={balances}
    escrows={escrows}
  />
)}
```

## Usage Examples

### Basic Full-Text Search
```typescript
const results = searchEngine.search(items, {
  text: 'transfer',
  filters: {}
});
```

### Advanced Filtering
```typescript
const results = searchEngine.search(items, {
  text: '',
  filters: {
    type: ['transfer', 'mint'],
    status: ['synced'],
    dateRange: {
      start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      end: Date.now()
    },
    amountRange: { min: 100, max: 10000 }
  },
  sortBy: 'amount',
  sortOrder: 'asc'
});
```

### Faceted Search
```typescript
const facets = searchEngine.getFacets(items, filters);
// Returns facets with options and counts
```

### Saving and Loading Searches
```typescript
// Save
const saved = await searchManager.saveSearch('My Query', query);

// Load
const searches = await searchManager.getSavedSearches();
await searchManager.updateSearchUsage(searches[0].id);
```

### Analytics
```typescript
// Record
await searchManager.recordAnalytics('transfer', filters, 42, 12.5);

// Retrieve
const analytics = await searchManager.getAnalytics(100);

// Cleanup
await searchManager.clearOldAnalytics(30); // Remove older than 30 days
```

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Search | O(n) | Single pass through items |
| Facet Generation | O(n) | Single pass with aggregation |
| Sorting | O(n log n) | Standard sort algorithm |
| Suggestions | O(m) | m = suggestion count |
| Save Search | O(1) | IndexedDB write |
| Get Suggestions | O(m) | m = total suggestions |

## Storage

Search data is stored in IndexedDB with the following stores:

- **savedSearches**: Saved search queries with metadata
- **analytics**: Search analytics records
- **suggestions**: Search suggestions with frequency

## Testing

Unit tests are provided in `src/services/search/__tests__/searchEngine.test.ts`:

```bash
npm test -- searchEngine.test.ts
```

Tests cover:
- Full-text search
- Type filtering
- Status filtering
- Date range filtering
- Amount range filtering
- Sorting
- Facet generation
- Execution time tracking

## Future Enhancements

1. **Fuzzy Matching**: Support typo tolerance
2. **Advanced Query Syntax**: Support AND, OR, NOT operators
3. **Result Pagination**: Handle large result sets
4. **Search Result Export**: Export to CSV/JSON
5. **Personalized Ranking**: ML-based result ranking
6. **Result Caching**: Cache frequently accessed results
7. **Batch Operations**: Search multiple queries at once
8. **Full-Text Index**: Pre-indexed search for large datasets

## Troubleshooting

### No Results Found
- Check filter criteria are not too restrictive
- Verify search text matches item fields
- Review facet selections

### Slow Performance
- Reduce dataset size with filters
- Check browser DevTools for bottlenecks
- Consider pagination for large result sets

### Storage Issues
- Clear old analytics: `searchManager.clearOldAnalytics(30)`
- Check IndexedDB quota
- Monitor browser storage usage

## API Reference

### searchEngine

```typescript
search<T>(items: T[], query: SearchQuery): SearchResult<T>
getFacets<T>(items: T[], filters: FilterCriteria): Facet[]
```

### searchManager

```typescript
init(): Promise<void>
saveSearch(name: string, query: SearchQuery): Promise<SavedSearch>
getSavedSearches(): Promise<SavedSearch[]>
deleteSavedSearch(id: string): Promise<void>
updateSearchUsage(id: string): Promise<void>
recordAnalytics(query: string, filters: FilterCriteria, resultCount: number, executionTime: number): Promise<void>
getSuggestions(prefix: string, limit?: number): Promise<SearchSuggestion[]>
getAnalytics(limit?: number): Promise<SearchAnalytics[]>
clearOldAnalytics(daysOld?: number): Promise<void>
```

## Conclusion

The advanced search and filter system provides a complete solution for sophisticated querying of transactions, tokens, and contracts with full-text search, faceted filtering, saved searches, and analytics. The implementation is performant, extensible, and user-friendly.
