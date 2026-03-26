import React, { useState } from 'react';
import { ConnectivityStatus, OfflineBanner } from './components/ConnectivityStatus';
import { TransactionList } from './components/TransactionItem';
import { AdvancedBalanceDisplay } from './components/AdvancedBalanceDisplay';
import { TransactionFormBuilder } from './components/TransactionFormBuilder';
import { TokenTransferWizard } from './components/TokenTransferWizard';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { SyncStatus, OfflineIndicator } from './components/SyncStatus';
import { SearchPage } from './components/SearchPage';
import {
  ResponsiveNav,
  Breadcrumb,
  ContextualNav,
  Dashboard,
  LiveDataFeed,
  NotificationCenter,
  NotificationPreferences,
  AlertRules,
} from './components';
import { NavItem } from './services/navigation/types';
import { DataPoint } from './services/visualization/types';
import { ThemeToggle } from './components/ThemeToggle';
import { TutorialOverlay, TutorialLauncher } from './components/TutorialOverlay';
import { InstallBanner, PushToggle } from './components/PWAControls';
import { useConnectivity } from './context/ConnectivityContext';
import { useStorage } from './context/StorageContext';
import { useTransactionQueue } from './context/TransactionQueueContext';
import { DashboardBuilder } from './builder/DashboardBuilder';
import { WorkflowLauncher } from './workflow';
import { DataTable } from './table';
import type { ColumnDef } from './table';
import type { CachedTransaction } from './services/storage/types';
import type { ComponentType } from './builder/types';

type Tab =
  | 'balances'
  | 'analytics'
  | 'transfer'
  | 'build'
  | 'pending'
  | 'history'
  | 'workflows'
  | 'table'
  | 'search'
  | 'dashboard'
  | 'settings';

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

  const [activeTab, setActiveTab] = useState<Tab>('balances');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [builderMode, setBuilderMode] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Home' }]);
  const [chartData, setChartData] = useState<DataPoint[]>([]);

  const txColumns: ColumnDef<CachedTransaction>[] = [
    { key: 'id',        header: 'ID',       accessor: (r) => r.id,        sortable: true  },
    { key: 'type',      header: 'Type',     accessor: (r) => r.type,      sortable: true  },
    { key: 'status',    header: 'Status',   accessor: (r) => r.status,    sortable: true  },
    { key: 'contract',  header: 'Contract', accessor: (r) => r.contractId, sortable: false },
    { key: 'createdAt', header: 'Created',  accessor: (r) => new Date(r.createdAt).toLocaleString(), sortable: true },
    { key: 'retries',   header: 'Retries',  accessor: (r) => r.retryCount, sortable: true  },
  ];

  const handleSubmitTransaction = async (): Promise<void> => {
    setIsDemoLoading(true);
    try {
      await createTransaction('transfer', 'CONTRACT_ID_HERE', 'transfer', {
        to: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount: '10000000',
      });
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const navigate = (tab: Tab, crumbs: { label: string }[]): void => {
    setActiveTab(tab);
    setBreadcrumbs(crumbs);
  };

  const renderComponent = (type: ComponentType) => {
    switch (type) {
      case 'balances':
        return <AdvancedBalanceDisplay balances={balances} emptyMessage="No cached balances." />;
      case 'transactions':
        return (
          <TransactionList
            transactions={[...pendingTransactions, ...syncedTransactions]}
            onRetry={retryTransaction}
            onDelete={deleteTransaction}
            onResolveConflict={resolveConflict}
            emptyMessage="No transactions."
          />
        );
      case 'sync':
        return <SyncStatus />;
      case 'actions':
        return (
          <div className="flex gap-md items-center">
            <button onClick={handleSubmitTransaction} disabled={isDemoLoading} className="btn btn-primary">
              {isDemoLoading ? 'Creating...' : '＋ Queue Transfer (Demo)'}
            </button>
            <button onClick={syncNow} disabled={!isOnline || syncStatus.isSyncing} className="btn btn-secondary">
              {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        );
      case 'storage':
        return (
          <div className="flex flex-col gap-sm">
            <div className="flex justify-between">
              <span className="text-muted">Cached Items</span>
              <span>{balances.length + escrows.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Transactions</span>
              <span>{pendingTransactions.length + syncedTransactions.length}</span>
            </div>
          </div>
        );
    }
  };

  const navItems: NavItem[] = [
    {
      id: 'balances',
      label: 'Balances',
      icon: '📊',
      onClick: () => navigate('balances', [{ label: 'Home' }, { label: 'Balances' }]),
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
          onClick: () => navigate('pending', [{ label: 'Home' }, { label: 'Transactions' }, { label: 'Pending' }]),
        },
        {
          id: 'history',
          label: 'History',
          icon: '✓',
          badge: syncedTransactions.length,
          onClick: () => navigate('history', [{ label: 'Home' }, { label: 'Transactions' }, { label: 'History' }]),
        },
      ],
    },
    {
      id: 'analytics',
      label: 'Portfolio',
      icon: '📈',
      onClick: () => navigate('analytics', [{ label: 'Home' }, { label: 'Portfolio' }]),
    },
    {
      id: 'transfer',
      label: 'Transfer',
      icon: '💸',
      onClick: () => navigate('transfer', [{ label: 'Home' }, { label: 'Transfer' }]),
    },
    {
      id: 'build',
      label: 'Build Tx',
      icon: '🔨',
      onClick: () => navigate('build', [{ label: 'Home' }, { label: 'Build Transaction' }]),
    },
    {
      id: 'workflows',
      label: 'Workflows',
      icon: '🔀',
      onClick: () => navigate('workflows', [{ label: 'Home' }, { label: 'Workflows' }]),
    },
    {
      id: 'table',
      label: 'Table View',
      icon: '📋',
      onClick: () => navigate('table', [{ label: 'Home' }, { label: 'Table View' }]),
    },
    {
      id: 'search',
      label: 'Search',
      icon: '🔍',
      onClick: () => navigate('search', [{ label: 'Home' }, { label: 'Search' }]),
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      onClick: () => navigate('dashboard', [{ label: 'Home' }, { label: 'Dashboard' }]),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      onClick: () => navigate('settings', [{ label: 'Home' }, { label: 'Settings' }]),
    },
  ];

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

      <div className="container">
        <InstallBanner />
      </div>

      <header className="header container">
        <div className="flex items-center gap-md">
          <h1>🔐 Fidelis</h1>
          <span className="text-muted">Soroban DApp</span>
        </div>
        <div className="flex items-center gap-md">
          <OfflineIndicator />
          <ConnectivityStatus />
          <NotificationCenter />
          <PushToggle />
          <TutorialLauncher />
          <ThemeToggle />
          <button
            className={builderMode ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setBuilderMode((v) => !v)}
            title="Toggle layout builder"
          >
            🧩 {builderMode ? 'Exit Builder' : 'Edit Layout'}
          </button>
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
          {builderMode ? (
            <DashboardBuilder renderComponent={renderComponent} />
          ) : (
            <>
              <section className="card mb-lg">
                <div className="card-header">
                  <span className="card-title">Quick Actions</span>
                </div>
                <div className="flex gap-md items-center">
                  <button onClick={handleSubmitTransaction} disabled={isDemoLoading} className="btn btn-primary">
                    {isDemoLoading ? (
                      <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating...</>
                    ) : '＋ Queue Transfer (Demo)'}
                  </button>
                  <button onClick={syncNow} disabled={!isOnline || syncStatus.isSyncing} className="btn btn-secondary">
                    {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <span className="text-muted" style={{ marginLeft: 'auto' }}>
                    {pendingTransactions.length} pending • {syncedTransactions.length} synced
                  </span>
                </div>
              </section>

              {activeTab === 'balances' && (
                <ContextualNav
                  context="Quick Actions"
                  items={[
                    { id: 'sync', label: 'Sync Now', icon: '🔄', onClick: syncNow },
                    { id: 'add', label: 'Add Balance', icon: '➕', onClick: () => {} },
                  ]}
                />
              )}

              <div className="grid" style={{ gridTemplateColumns: '1fr 300px', gap: 'var(--spacing-lg)' }}>
                <div>
                  {activeTab === 'balances' && (
                    <>
                      {!isOnline && <p className="text-warning mb-md">You're offline. Showing cached balances.</p>}
                      <AdvancedBalanceDisplay balances={balances} emptyMessage="No cached balances." />
                    </>
                  )}
                  {activeTab === 'analytics' && <PortfolioDashboard />}
                  {activeTab === 'transfer' && <TokenTransferWizard />}
                  {activeTab === 'build' && <TransactionFormBuilder />}
                  {activeTab === 'pending' && (
                    <>
                      <h2 className="mb-md">Pending Transactions</h2>
                      {!isOnline && <p className="text-warning mb-md">You're offline. Transactions will sync when connection restores.</p>}
                      <TransactionList transactions={pendingTransactions} onRetry={retryTransaction} onDelete={deleteTransaction} onResolveConflict={resolveConflict} emptyMessage="No pending transactions." />
                    </>
                  )}
                  {activeTab === 'history' && (
                    <>
                      <h2 className="mb-md">Synced Transactions</h2>
                      <TransactionList transactions={syncedTransactions} emptyMessage="No synced transactions yet." />
                    </>
                  )}
                  {activeTab === 'workflows' && (
                    <WorkflowLauncher onComplete={(id, v) => console.info('Workflow completed:', id, v)} />
                  )}
                  {activeTab === 'table' && (
                    <DataTable
                      caption="All Transactions"
                      data={[...pendingTransactions, ...syncedTransactions]}
                      columns={txColumns}
                      getRowId={(r) => r.id}
                      bulkActions={[{ label: 'Delete selected', icon: '🗑', action: (rows) => rows.forEach(r => deleteTransaction(r.id)) }]}
                      exportFormats={['csv', 'json']}
                      renderExpanded={(r) => (
                        <pre style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(r.params, null, 2)}
                        </pre>
                      )}
                    />
                  )}
                  {activeTab === 'search' && (
                    <SearchPage
                      transactions={[...pendingTransactions, ...syncedTransactions]}
                      balances={balances}
                      escrows={escrows}
                    />
                  )}
                  {activeTab === 'dashboard' && (
                    <>
                      <h2 className="mb-md">Real-Time Dashboard</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>
                        <Dashboard />
                        <LiveDataFeed onDataUpdate={(data) => setChartData([...chartData, data])} />
                      </div>
                    </>
                  )}
                  {activeTab === 'settings' && (
                    <>
                      <h2 className="mb-md">Settings</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <NotificationPreferences userId="user-1" />
                        <AlertRules />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <SyncStatus />
                  <div className="card mt-lg">
                    <div className="card-header"><span className="card-title">Storage</span></div>
                    <div className="flex flex-col gap-sm">
                      <div className="flex justify-between"><span className="text-muted">Cached Items</span><span>{balances.length + escrows.length}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Transactions</span><span>{pendingTransactions.length + syncedTransactions.length}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <TutorialOverlay />
    </div>
  );
}

export default App;
