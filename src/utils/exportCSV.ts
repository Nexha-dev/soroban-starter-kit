/**
 * CSV export utilities for the Token Management Dashboard.
 * Requirements: 3.6, 6.6
 */

import { Balance, CachedTransaction } from '../services/storage/types';
import { toFloat } from './analyticsCompute';

const STROOPS = 10_000_000;

/** Triggers a browser download of the given CSV string with the specified filename. */
function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Escapes a CSV field value, wrapping in quotes if it contains commas, quotes, or newlines. */
function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCSV(fields: string[]): string {
  return fields.map(escapeField).join(',');
}

/**
 * Exports a list of transactions as a CSV file.
 * Columns: id, type, status, contractId, method
 *
 * Validates: Requirement 3.6
 */
export function exportTransactionsCSV(transactions: CachedTransaction[], filename?: string): void {
  const header = rowToCSV(['id', 'type', 'status', 'contractId', 'method']);
  const rows = transactions.map(tx =>
    rowToCSV([tx.id, tx.type, tx.status, tx.contractId, tx.method])
  );
  const csv = [header, ...rows].join('\n');
  downloadCSV(csv, filename ?? `transactions-${Date.now()}.csv`);
}

/**
 * Exports portfolio analytics data as a CSV file.
 * Columns: symbol, balance, fiatValue, percentageChange
 *
 * Validates: Requirement 6.6
 */
export function exportAnalyticsCSV(
  balances: Balance[],
  currency: string,
  filename?: string
): void {
  const header = rowToCSV(['symbol', 'balance', 'fiatValue', 'percentageChange']);
  const rows = balances.map(b => {
    const amount = toFloat(b.amount);
    const rate = b.fiatRates?.[currency] ?? 0;
    const fiatValue = (amount * rate).toFixed(2);
    const prev = b.previousAmount !== undefined ? toFloat(b.previousAmount) : amount;
    const pct = prev > 0 ? (((amount - prev) / prev) * 100).toFixed(2) : '0.00';
    return rowToCSV([b.tokenSymbol, (amount).toFixed(7), fiatValue, pct]);
  });
  const csv = [header, ...rows].join('\n');
  downloadCSV(csv, filename ?? `analytics-${Date.now()}.csv`);
}
