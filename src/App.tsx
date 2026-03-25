import React, { useEffect, useState } from 'react';
import { ConnectivityStatus, OfflineBanner } from './components/ConnectivityStatus';
import { TransactionList } from './components/TransactionItem';
import { BalanceList } from './components/BalanceDisplay';
import { SyncStatus, OfflineIndicator } from './components/SyncStatus';
import { SearchPage } from './components/SearchPage';
import { ResponsiveNav, Breadcrumb, ContextualNav } from './components';
import { NavItem } from './services/navigation/types';
import { useConnectivity } from './context/ConnectivityContext';
import { useStorage } from './context/StorageContext';
import { useTransactionQueue } from './context/TransactionQueueContext';

function App(): JSX.Element {
  const { isOnline } = useConnectivity();
  const { balances, escrows, isInitialized } = useStorage();
  const { 
    pendingTransactions, 
    syncedTransactions, 
    syncStatus,
    createTransaction,
    syncNow,
    retryTransaction,
    deleteTransaction,
    resolveConflict,
  } = useTransactionQueue();

  const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'search'>('balances');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Home' }]);

  const navItems: NavItem[] = [
    {
      id: 'balances',
      label: 'Balances',
      icon: '📊',
      onClick: () => {
        setActiveTab('balances');
        setBreadcrumbs([{ label: 'Home' }, { label: 'Balances' }]);
      },
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: '💱',
      children: [
        {
          id: 'pending',
          label: 'Pending',
          icon: '⏳',
          badge: pendingTransactions.length,
          onClick: () => {
            setActiveTab('pending');
            setBreadcrumbs([{ label: 'Home' }, { label: 'Transactions' }, { label: 'Pending' }]);
          },
        },
        {
          id: 'history',
          label: 'History',
          icon: '✓',
          badge: syncedTransactions.length,
          onClick: () => {
            setActiveTab('history');
            setBreadcrumbs([{ label: 'Home' }, { label: 'Transactions' }, { label: 'History' }]);
          },
        },
      ],
    },
    {
      id: 'search',
      label: 'Search',
      icon: '🔍',
      onClick: () => {
        setActiveTab('search');
        setBreadcrumbs([{ label: 'Home' }, { label: 'Search' }]);
      },
    },
  ];

  const handleSubmitTransaction = async (): Promise<void> => {
    setIsDemoLoading(true);
    try {
      await createTransaction(
        'transfer',
        'CONTRACT_ID_HERE',
        'transfer',
        {
          to: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          amount: '10000000',
        }
      );
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsDemoLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="flex flex-col items-center gap-md">
          <span className="spinner" style={{ width: '32px', height: '32px' }} />
          <span>Initializing offline storage...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <OfflineBanner />

      <header className="header container">
        <div className="flex items-center gap-md">
          <h1>🔐 Fidelis</h1>
          <span className="text-muted">Soroban DApp</span>
        </div>
        
        <div className="flex items-center gap-md">
          <OfflineIndicator />
          <ConnectivityStatus />
        </div>
      </header>

      <div style={{ padding: '0 var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
        <Breadcrumb items={breadcrumbs} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '250px', minWidth: '250px' }}>
          <ResponsiveNav items={navItems} onItemClick={(item) => item.onClick?.()} />
        </div>

        <main className="main-content" style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
          {activeTab === 'balances' && (
            <ContextualNav
              context="Quick Actions"
              items={[
                { id: 'sync', label: 'Sync Now', icon: '🔄', onClick: syncNow },
                { id: 'add', label: 'Add Balance', icon: '➕', onClick: () => {} },
              ]}
            />
          )}

          <section className="card mb-lg" style={{ marginTop: 'var(--spacing-lg)' }}>
            <div className="card-header">
              <span className="card-title">Quick Actions</span>
            </div>
            
            <div className="flex gap-md items-center">
              <button
                onClick={handleSubmitTransaction}
                disabled={isDemoLoading}
                className="btn btn-primary"
              >
                {isDemoLoading ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px' }} />
                    Creating...
                  </>
                ) : (
                  '+ Queue Transfer (Demo)'
                )}
              </button>
              
              <button
                onClick={syncNow}
                disabled={!isOnline || syncStatus.isSyncing}
                className="btn btn-secondary"
              >
                {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              
              <span className="text-muted" style={{ marginLeft: 'auto' }}>
                {pendingTransactions.length} pending • {syncedTransactions.length} synced
              </span>
            </div>
          </section>

          {activeTab === 'balances' && (
            <>
              <h2 className="mb-md">Token Balances</h2>
              {isOnline ? (
                <p className="text-muted mb-md">You're online. Balances are fetched from the network.</p>
              ) : (
                <p className="text-warning mb-md">You're offline. Showing cached balances.</p>
              )}
              <BalanceList 
                balances={balances}
                emptyMessage="No cached balances."
              />
            </>
          )}

          {activeTab === 'pending' && (
            <>
              <h2 className="mb-md">Pending Transactions</h2>
              {!isOnline && (
                <p className="text-warning mb-md">You're offline. Transactions will sync when connection restores.</p>
              )}
              <TransactionList
                transactions={pendingTransactions}
                onRetry={retryTransaction}
                onDelete={deleteTransaction}
                onResolveConflict={resolveConflict}
                emptyMessage="No pending transactions."
              />
            </>
          )}

          {activeTab === 'history' && (
            <>
              <h2 className="mb-md">Synced Transactions</h2>
              <TransactionList
                transactions={syncedTransactions}
                emptyMessage="No synced transactions yet."
              />
            </>
          )}

          {activeTab === 'search' && (
            <SearchPage
              transactions={[...pendingTransactions, ...syncedTransactions]}
              balances={balances}
              escrows={escrows}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
