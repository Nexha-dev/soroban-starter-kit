import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../utils/renderWithProviders';
import { server } from '../mocks/server';
import * as ConnectivityContext from '../../context/ConnectivityContext';
import * as TxQueueContext from '../../context/TransactionQueueContext';
import * as StorageContext from '../../context/StorageContext';
import * as TutorialContext from '../../context/TutorialContext';
import App from '../../App';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.spyOn(ConnectivityContext, 'useConnectivity').mockReturnValue({
  status: 'online', isOnline: true, wasOffline: false, retryConnection: vi.fn(),
});

vi.spyOn(TxQueueContext, 'useTransactionQueue').mockReturnValue({
  syncStatus: { lastSyncTime: null, pendingCount: 0, isSyncing: false, lastError: null },
  pendingTransactions: [], syncedTransactions: [], syncNow: vi.fn(),
  createTransaction: vi.fn(), retryTransaction: vi.fn(), deleteTransaction: vi.fn(), resolveConflict: vi.fn(),
} as any);

vi.spyOn(StorageContext, 'useStorage').mockReturnValue({
  isInitialized: true, balances: [], escrows: [], storageUsed: 0, storageQuota: 0,
  refreshData: vi.fn(), saveBalance: vi.fn(), saveEscrow: vi.fn(),
  getBalance: vi.fn(), getEscrow: vi.fn(), clearCache: vi.fn(),
} as any);

vi.spyOn(TutorialContext, 'useTutorial').mockReturnValue({
  isActive: false, currentStep: 0, steps: [], analytics: null,
  start: vi.fn(), next: vi.fn(), skip: vi.fn(), end: vi.fn(),
  submitFeedback: vi.fn(), isCompleted: vi.fn().mockReturnValue(false),
} as any);

describe('App integration', () => {
  it('renders header and main tabs', () => {
    renderWithProviders(<App />);
    expect(screen.getByText(/Fidelis/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cached balances/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /synced history/i })).toBeInTheDocument();
  });

  it('switches to pending tab on click', () => {
    renderWithProviders(<App />);
    screen.getByRole('button', { name: /pending/i }).click();
    expect(screen.getByText(/pending transactions/i)).toBeInTheDocument();
  });
});
