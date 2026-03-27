/**
 * Transaction filter and sort utilities for the Token Management Dashboard.
 * Requirements: 3.2, 3.3, 3.4
 *
 * Note: Debounce is handled at the component level, not here.
 */

import { CachedTransaction, TransactionStatus, TransactionType } from '../services/storage/types';

export interface FilterConfig {
  /** Case-insensitive search term matched against id, method, and error fields. */
  search?: string;
  /** Set of transaction types to include. Empty/undefined means include all. */
  types?: Set<TransactionType> | TransactionType[];
  /** Set of transaction statuses to include. Empty/undefined means include all. */
  statuses?: Set<TransactionStatus> | TransactionStatus[];
}

export type SortField = 'date' | 'type' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/**
 * Filters a list of transactions by search term, type, and status.
 *
 * - search: case-insensitive match on id, method, or error fields
 * - types: if non-empty, only transactions whose type is in the set are included
 * - statuses: if non-empty, only transactions whose status is in the set are included
 *
 * Validates: Requirements 3.2, 3.3
 */
export function filterTransactions(
  txs: CachedTransaction[],
  { search, types, statuses }: FilterConfig
): CachedTransaction[] {
  const term = search?.trim().toLowerCase() ?? '';
  const typeSet = types ? new Set(types) : null;
  const statusSet = statuses ? new Set(statuses) : null;

  return txs.filter(tx => {
    // Search filter
    if (term.length > 0) {
      const haystack = [tx.id, tx.method, tx.error ?? ''].join(' ').toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    // Type filter
    if (typeSet && typeSet.size > 0 && !typeSet.has(tx.type)) return false;

    // Status filter
    if (statusSet && statusSet.size > 0 && !statusSet.has(tx.status)) return false;

    return true;
  });
}

/**
 * Sorts a list of transactions by the given field and direction.
 * Returns a new array (does not mutate the input).
 *
 * - date: sorts by createdAt timestamp
 * - type: sorts alphabetically by type string
 * - status: sorts alphabetically by status string
 *
 * Validates: Requirement 3.4
 */
export function sortTransactions(
  txs: CachedTransaction[],
  { field, direction }: SortConfig
): CachedTransaction[] {
  const sorted = [...txs];

  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === 'date') {
      cmp = a.createdAt - b.createdAt;
    } else if (field === 'type') {
      cmp = a.type.localeCompare(b.type);
    } else if (field === 'status') {
      cmp = a.status.localeCompare(b.status);
    }
    return direction === 'asc' ? cmp : -cmp;
  });

  return sorted;
}
