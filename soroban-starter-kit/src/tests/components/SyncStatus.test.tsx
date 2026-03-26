import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../utils/renderWithProviders';
import { SyncStatus, OfflineIndicator } from '../../components/SyncStatus';
import * as TxQueueContext from '../../context/TransactionQueueContext';
import * as ConnectivityContext from '../../context/ConnectivityContext';

const mockUseTxQueue = vi.spyOn(TxQueueContext, 'useTransactionQueue');
const mockUseConnectivity = vi.spyOn(ConnectivityContext, 'useConnectivity');

function mockDeps(txOverrides = {}, connOverrides = {}) {
  mockUseTxQueue.mockReturnValue({
    syncStatus: { lastSyncTime: null, pendingCount: 0, isSyncing: false, lastError: null },
    syncNow: vi.fn(),
    pendingTransactions: [],
    syncedTransactions: [],
    createTransaction: vi.fn(),
    retryTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    resolveConflict: vi.fn(),
    ...txOverrides,
  } as any);
  mockUseConnectivity.mockReturnValue({
    status: 'online', isOnline: true, wasOffline: false, retryConnection: vi.fn(),
    ...connOverrides,
  });
}

describe('SyncStatus', () => {
  it('shows Never when no sync has occurred', () => {
    mockDeps();
    renderWithProviders(<SyncStatus />);
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('calls syncNow when Sync Now is clicked', () => {
    const syncNow = vi.fn();
    mockDeps({ syncNow });
    renderWithProviders(<SyncStatus />);
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(syncNow).toHaveBeenCalledOnce();
  });

  it('disables Sync Now button when offline', () => {
    mockDeps({}, { status: 'offline', isOnline: false });
    renderWithProviders(<SyncStatus />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeDisabled();
  });

  it('shows error message when lastError is set', () => {
    mockDeps({ syncStatus: { lastSyncTime: null, pendingCount: 0, isSyncing: false, lastError: 'Network timeout' } });
    renderWithProviders(<SyncStatus />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });
});

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    mockDeps();
    const { container } = renderWithProviders(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows pending count when offline', () => {
    mockDeps(
      { syncStatus: { lastSyncTime: null, pendingCount: 3, isSyncing: false, lastError: null } },
      { status: 'offline', isOnline: false }
    );
    renderWithProviders(<OfflineIndicator />);
    expect(screen.getByText(/3 pending/i)).toBeInTheDocument();
  });
});
