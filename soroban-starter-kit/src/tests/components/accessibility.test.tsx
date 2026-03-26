import React from 'react';
import { describe, it } from 'vitest';
import { ConnectivityStatus, OfflineBanner } from '../../components/ConnectivityStatus';
import { SyncStatus } from '../../components/SyncStatus';
import { InstallBanner } from '../../components/PWAControls';
import { expectNoA11yViolations } from '../utils/a11y';
import * as ConnectivityContext from '../../context/ConnectivityContext';
import * as TxQueueContext from '../../context/TransactionQueueContext';
import * as PWAContext from '../../context/PWAContext';
import { vi } from 'vitest';

vi.spyOn(ConnectivityContext, 'useConnectivity').mockReturnValue({
  status: 'online', isOnline: true, wasOffline: false, retryConnection: vi.fn(),
});
vi.spyOn(TxQueueContext, 'useTransactionQueue').mockReturnValue({
  syncStatus: { lastSyncTime: null, pendingCount: 0, isSyncing: false, lastError: null },
  syncNow: vi.fn(), pendingTransactions: [], syncedTransactions: [],
  createTransaction: vi.fn(), retryTransaction: vi.fn(), deleteTransaction: vi.fn(), resolveConflict: vi.fn(),
} as any);
vi.spyOn(PWAContext, 'usePWA').mockReturnValue({
  canInstall: true, isAppInstalled: false, pushPermission: 'default', pushSubscription: null,
  install: vi.fn(), enablePush: vi.fn(), disablePush: vi.fn(),
});

describe('Accessibility', () => {
  it('ConnectivityStatus has no violations', () => expectNoA11yViolations(<ConnectivityStatus />));
  it('OfflineBanner (offline) has no violations', async () => {
    vi.spyOn(ConnectivityContext, 'useConnectivity').mockReturnValueOnce({
      status: 'offline', isOnline: false, wasOffline: true, retryConnection: vi.fn(),
    });
    await expectNoA11yViolations(<OfflineBanner />);
  });
  it('SyncStatus has no violations', () => expectNoA11yViolations(<SyncStatus />));
  it('InstallBanner has no violations', () => expectNoA11yViolations(<InstallBanner />));
});
