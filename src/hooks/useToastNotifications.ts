/**
 * useToastNotifications — watches CachedTransaction status transitions and fires toast notifications.
 *
 * Requirements: 5.4
 */

import { useEffect, useRef } from 'react';
import { CachedTransaction, TransactionStatus } from '../services/storage/types';
import { notificationManager } from '../services/notifications';

// Terminal statuses that trigger a toast notification
const TERMINAL_STATUSES: ReadonlySet<TransactionStatus> = new Set(['synced', 'failed']);

/**
 * Watches `transactions` for status transitions to `synced` or `failed` and fires
 * `notificationManager.addNotification(...)` exactly once per transition.
 *
 * Uses a ref to track the previous status of each transaction so that a notification
 * is only fired when the status actually changes to a terminal state.
 */
export function useToastNotifications(transactions: CachedTransaction[]): void {
  // Map of transaction id → last known status
  const prevStatusesRef = useRef<Map<string, TransactionStatus>>(new Map());

  useEffect(() => {
    const prevStatuses = prevStatusesRef.current;

    for (const tx of transactions) {
      const prevStatus = prevStatuses.get(tx.id);
      const currentStatus = tx.status;

      // Fire a notification only when transitioning INTO a terminal status
      if (
        TERMINAL_STATUSES.has(currentStatus) &&
        prevStatus !== currentStatus
      ) {
        const isSynced = currentStatus === 'synced';
        notificationManager.addNotification({
          id: `toast-${tx.id}-${currentStatus}`,
          title: isSynced ? 'Transaction confirmed' : 'Transaction failed',
          message: `${tx.type} — ${currentStatus}`,
          priority: isSynced ? 'medium' : 'high',
          channels: ['in-app'],
          category: 'transaction',
          timestamp: Date.now(),
          read: false,
        });
      }

      // Always update the tracked status
      prevStatuses.set(tx.id, currentStatus);
    }
  }, [transactions]);
}
