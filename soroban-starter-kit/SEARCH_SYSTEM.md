# Advanced Search and Filter System

## Overview

The advanced search and filter system provides sophisticated querying capabilities for transactions, tokens, and contracts with full-text search, faceted filtering, saved searches, and search analytics.

## Features

### 1. Full-Text Search
- Tokenized text search with relevance scoring
- Intelligent query matching across all searchable fields
- Support for partial matches and word boundaries

### 2. Advanced Filtering
- **Type Filtering**: Filter by transaction type (transfer, mint, burn, approve, escrow_fund, escrow_release, escrow_refund)
- **Status Filtering**: Filter by status (pending, syncing, synced, failed, conflict)
- **Date Range**: Filter transactions by creation date
- **Amount Range**: Filter by transaction/balance amounts
- **Contract ID**: Filter by specific contract addresses
- **Custom Filters**: Extensible filter system for additional criteria

### 3. Faceted Search
- Dynamic facet generation based on data
- Multi-select facet options with result counts
- Collapsible facet categories
- Real-time facet updates

### 4. Saved Searches
- Save frequently used search queries
- Track search usage and frequency
- Quick access to saved searches
- Delete saved searches

### 5. Search Analytics
- Track search queries and filters
- Record execution time and result counts
- Analyze user search behavior
- Automatic cleanup of old analytics data

### 6. Intelligent Suggestions
- Query suggestions based on search history
- Filter suggestions
- Saved search suggestions
- Frequency-based ranking

### 7. Performance Optimization
- Efficient search algorithm with O(n) complexity
- Relevance-based sorting
- Execution time tracking
- Minimal memory footprint

## Architecture

### Core Services

#### SearchEngine (`src/services/search/searchEngine.ts`)
Handles full-text search and filtering logic:
- `search()`: Execute search queries with filters
- `getFacets()`: Generate facet options for UI
- `tokenizeText()`: Parse search queries
- `calculateRelevance()`: Score search results

#### SearchManager (`src/services/search/searchManager.ts`)
Manages persistent search data:
- `saveSearch()`: Save search queries
- `getSavedSearches()`: Retrieve saved searches
- `recordAnalytics()`: Log search analytics
- `getSuggestions()`: Get search suggestions
- `clearOldAnalytics()`: Cleanup old data

### React Components

#### SearchBar (`src/components/SearchBar.tsx`)
- Text input with autocomplete
- Real-time suggestion display
- Search submission

#### FilterPanel (`src/components/FilterPanel.tsx`)
- Type and status checkboxes
- Date range picker
- Amount range inputs
- Advanced filter toggle
- Reset button

#### FacetedSearch (`src/components/FacetedSearch.tsx`)
- Collapsible facet categories
- Multi-select options
- Result count display
- Dynamic facet updates

#### SavedSearches (`src/components/SavedSearches.tsx`)
- List of saved searches
- Save new search form
- Usage tracking display
- Delete functionality

#### SearchPage (`src/components/SearchPage.tsx`)
- Integrated search interface
- Results display
- Sorting options
- Performance metrics

## Usage

### Basic Search

```typescript
import { searchEngine } from '@/services/search';

const results = searchEngine.search(items, {
  text: 'transfer',
  filters: {},
  sortBy: 'date',
  sortOrder: 'desc'
});
```

### Advanced Filtering

```typescript
const results = searchEngine.search(items, {
  text: 'token',
  filters: {
    type: ['transfer', 'mint'],
    status: ['synced'],
    dateRange: {
      start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      end: Date.now()
    },
    amountRange: {
      min: 100,
      max: 10000
    }
  },
  sortBy: 'amount',
  sortOrder: 'asc'
});
```

### Faceted Search

```typescript
const facets = searchEngine.getFacets(items, filters);
// Returns: [
//   {
//     name: 'type',
//     options: [
//       { value: 'transfer', label: 'Transfer', count: 42 },
//       { value: 'mint', label: 'Mint', count: 15 }
//     ]
//   },
//   ...
// ]
```

### Saving Searches

```typescript
import { searchManager } from '@/services/search';

const saved = await searchManager.saveSearch('My Transfers', {
  text: 'transfer',
  filters: { type: ['transfer'] }
});
```

### Search Analytics

```typescript
await searchManager.recordAnalytics(
  'transfer',
  { type: ['transfer'] },
  42,
  12.5
);

const analytics = await searchManager.getAnalytics(100);
```

### Getting Suggestions

```typescript
const suggestions = await searchManager.getSuggestions('trans', 5);
// Returns recent searches starting with 'trans'
```

## Integration with App

The search system is integrated into the main app via the `SearchPage` component:

```tsx
<SearchPage
  transactions={allTransactions}
  balances={allBalances}
  escrows={allEscrows}
/>
```

Access via the "🔍 Search & Filter" tab in the app.

## Performance Characteristics

- **Search Time**: O(n) where n = number of items
- **Facet Generation**: O(n) with single pass
- **Memory**: Minimal overhead, no data duplication
- **Suggestions**: O(m) where m = suggestion count

## Data Storage

Search data is stored in IndexedDB with the following stores:
- `savedSearches`: Saved search queries
- `analytics`: Search analytics records
- `suggestions`: Search suggestions

## Extending the System

### Adding Custom Filters

Modify `FilterCriteria` in `src/services/search/types.ts`:

```typescript
export interface FilterCriteria {
  // ... existing filters
  customField?: string[];
}
```

Update `matchesFilters()` in `searchEngine.ts`:

```typescript
if (filters.customField && filters.customField.length > 0) {
  const itemField = (item as any).customField;
  if (!filters.customField.includes(itemField)) return false;
}
```

### Adding New Facets

Update `getFacets()` in `searchEngine.ts` to include new facet logic.

### Custom Sorting

Extend `sortResults()` to support additional sort options.

## Best Practices

1. **Debounce Search Input**: Wrap search calls in debounce for better performance
2. **Limit Suggestions**: Keep suggestion count low (5-10) for UX
3. **Clean Analytics**: Regularly call `clearOldAnalytics()` to manage storage
4. **Index Large Datasets**: For very large datasets, consider pre-indexing
5. **Cache Results**: Store frequently accessed search results

## Troubleshooting

### No Results Found
- Check filter criteria are not too restrictive
- Verify search text matches item fields
- Review facet selections

### Slow Search Performance
- Reduce dataset size with filters
- Check browser DevTools for bottlenecks
- Consider pagination for large result sets

### Storage Issues
- Clear old analytics: `searchManager.clearOldAnalytics(30)`
- Check IndexedDB quota
- Monitor browser storage usage

## Future Enhancements

- [ ] Full-text search indexing for large datasets
- [ ] Fuzzy matching for typo tolerance
- [ ] Search result pagination
- [ ] Advanced query syntax (AND, OR, NOT)
- [ ] Search result export (CSV, JSON)
- [ ] Personalized search ranking
- [ ] Search result caching
- [ ] Batch search operations
