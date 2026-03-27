/**
 * Analytics computation utilities for the Token Management Dashboard.
 * Requirements: 1.2, 6.2, 6.4, 6.5
 */

import { Balance, CachedTransaction } from '../services/storage/types';

const STROOPS = 10_000_000;

/** Converts a stroops string or number to a float display value. */
export function toFloat(value: string | number): number {
  return Number(value) / STROOPS;
}

/**
 * Computes the total portfolio value in a given fiat currency.
 * For each balance: toFloat(amount) * (fiatRates?.[currency] ?? 0)
 *
 * Validates: Requirement 1.2
 */
export function computeTotalFiat(balances: Balance[], currency: string): number {
  return balances.reduce((sum, b) => {
    const rate = b.fiatRates?.[currency] ?? 0;
    return sum + toFloat(b.amount) * rate;
  }, 0);
}

/**
 * Computes the P&L for a single token balance in a given fiat currency.
 * Formula: (toFloat(amount) - toFloat(previousAmount)) * fiatRates[currency]
 * If previousAmount is not set, P&L is 0.
 *
 * Validates: Requirement 6.2
 */
export function computePnL(balance: Balance, currency: string): number {
  const current = toFloat(balance.amount);
  const previous = balance.previousAmount !== undefined ? toFloat(balance.previousAmount) : current;
  const rate = balance.fiatRates?.[currency] ?? 0;
  return (current - previous) * rate;
}

/**
 * Computes a diversification score in [0, 100] using the Herfindahl-Hirschman Index.
 * score = Math.round((1 - hhi) * 100)
 * where hhi = sum((balance / total)^2)
 *
 * Returns 0 for an empty or zero-total list (fully concentrated / no data).
 *
 * Validates: Requirement 6.4
 */
export function computeDiversificationScore(balances: Balance[]): number {
  if (balances.length === 0) return 0;

  const values = balances.map(b => toFloat(b.amount));
  const total = values.reduce((s, v) => s + v, 0);

  if (total <= 0) return 0;

  const hhi = values.reduce((s, v) => s + Math.pow(v / total, 2), 0);
  return Math.round((1 - hhi) * 100);
}

/** Time range options for analytics filtering. */
export type TimeRange = '7d' | '30d' | 'all';

/**
 * Filters a list of items with a `createdAt` timestamp to those within the given time range.
 * '7d'  → items with createdAt >= now - 7 days
 * '30d' → items with createdAt >= now - 30 days
 * 'all' → all items
 *
 * Validates: Requirement 6.5
 */
export function filterByTimeRange<T extends { createdAt: number }>(
  items: T[],
  range: TimeRange
): T[] {
  if (range === 'all') return items;

  const now = Date.now();
  const cutoff = range === '7d' ? now - 7 * 86_400_000 : now - 30 * 86_400_000;
  return items.filter(item => item.createdAt >= cutoff);
}
