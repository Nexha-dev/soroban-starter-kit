import React, { useEffect, useState, lazy, Suspense } from 'react';
import { ConnectivityStatus, OfflineBanner } from './components/ConnectivityStatus';
import { TransactionList } from './components/TransactionItem';
import { AdvancedBalanceDisplay } from './components/AdvancedBalanceDisplay';
import { SyncStatus, OfflineIndicator } from './components/SyncStatus';
import { SearchPage } from './components/SearchPage';
import { ResponsiveNav, Breadcrumb, ContextualNav, Dashboard, LiveDataFeed, NotificationCenter, NotificationPreferences, AlertRules } from './components';
import { PreferenceManagement, PreferenceAnalytics } from './components';
import { NavItem } from './services/navigation/types';
import { DataPoint } from './services/visualization/types';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { TutorialOverlay, TutorialLauncher } from './components/TutorialOverlay';
import { InstallBanner, PushToggle } from './components/PWAControls';
import { useConnectivity } from './context/ConnectivityContext';
import { useStorage } from './context/StorageContext';
import { useTransactionQueue } from './context/TransactionQueueContext';
import { DataTable } from './table';
import type { ColumnDef } from './table';
import type { CachedTransaction } from './services/storage/types';
import type { ComponentType } from './builder/types';

// Lazy-loaded heavy components for code splitting
const TransactionFormBuilder = lazy(() => import('./components/TransactionFormBuilder').then(m => ({ default: m.TransactionFormBuilder })));
const TokenTransferWizard = lazy(() => import('./components/TokenTransferWizard').then(m => ({ default: m.TokenTransferWizard })));
const PortfolioDashboard = lazy(() => import('./components/PortfolioDashboard').then(m => ({ default: m.PortfolioDashboard })));
const DashboardBuilder = lazy(() => import('./builder/DashboardBuilder').then(m => ({ default: m.DashboardBuilder })));
const WorkflowLauncher = lazy(() => import('./workflow').then(m => ({ default: m.WorkflowLauncher })));
const PerformanceDashboard = lazy(() => import('./components/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard })));
const AccessibilityDashboard = lazy(() => import('./components/AccessibilityDashboard').then(m => ({ default: m.AccessibilityDashboard })));
const ComponentDocs = lazy(() => import('./components/ComponentDocs').then(m => ({ default: m.ComponentDocs })));

const LazyFallback = () => <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading…</div>;

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

  const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'workflows' | 'table'>('balances');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [builderMode, setBuilderMode] = useState(false);

  const txColumns: ColumnDef<CachedTransaction>[] = [
    { key: 'id',        header: 'ID',       accessor: (r) => r.id,        sortable: true  },
    { key: 'type',      header: 'Type',     accessor: (r) => r.type,      sortable: true  },
    { key: 'status',    header: 'Status',   accessor: (r) => r.status,    sortable: true  },
    { key: 'contract',  header: 'Contract', accessor: (r) => r.contractId, sortable: false },
    { key: 'createdAt', header: 'Created',  accessor: (r) => new Date(r.createdAt).toLocaleString(), sortable: true },
    { key: 'retries',   header: 'Retries',  accessor: (r) => r.retryCount, sortable: true  },
  ];

  // Demo function to simulate transaction submission
  const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'search' | 'dashboard' | 'settings'>('balances');
  const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'search' | 'dashboard'>('balances');
  const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'workflows'>('balances');
  const [activeTab, setActiveTab] = useState<'balances' | 'pending' | 'history' | 'search'>('balances');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Home' }]);
  const [chartData, setChartData] = useState<DataPoint[]>([]);

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
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      onClick: () => {
        setActiveTab('dashboard');
        setBreadcrumbs([{ label: 'Home' }, { label: 'Dashboard' }]);
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      onClick: () => {
        setActiveTab('settings');
        setBreadcrumbs([{ label: 'Home' }, { label: 'Settings' }]);
      },
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: '⚡',
      onClick: () => {
        setActiveTab('performance' as any);
        setBreadcrumbs([{ label: 'Home' }, { label: 'Performance' }]);
      },
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      icon: '♿',
      onClick: () => {
        setActiveTab('accessibility' as any);
        setBreadcrumbs([{ label: 'Home' }, { label: 'Accessibility' }]);
      },
    },
    {
      id: 'docs',
      label: 'Component Docs',
      icon: '📚',
      onClick: () => {
        setActiveTab('docs' as any);
        setBreadcrumbs([{ label: 'Home' }, { label: 'Component Docs' }]);
      },
    },
  ];
  const [activeTab, setActiveTab] = useState<'balances' | 'analytics' | 'transfer' | 'build' | 'pending' | 'history'>('balances');
  const [activeTab, setActiveTab] = useState<'balances' | 'transfer' | 'build' | 'pending' | 'history'>('balances');
  const [activeTab, setActiveTab] = useState<'balances' | 'build' | 'pending' | 'history'>('balances');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [builderMode, setBuilderMode] = useState(false);

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

  const renderComponent = (type: ComponentType) => {
    switch (type) {
      case 'balances':    return <BalanceList balances={balances} emptyMessage="No cached balances." />;
      case 'transactions': return <TransactionList transactions={[...pendingTransactions, ...syncedTransactions]} onRetry={retryTransaction} onDelete={deleteTransaction} onResolveConflict={resolveConflict} emptyMessage="No transactions." />;
      case 'sync':        return <SyncStatus />;
      case 'actions':     return (
        <div className="flex gap-md items-center">
          <button onClick={handleSubmitTransaction} disabled={isDemoLoading} className="btn btn-primary">
            {isDemoLoading ? 'Creating...' : '＋ Queue Transfer (Demo)'}
          </button>
          <button onClick={syncNow} disabled={!isOnline || syncStatus.isSyncing} className="btn btn-secondary">
            {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      );
      case 'storage':     return (
        <div className="flex flex-col gap-sm">
          <div className="flex justify-between"><span className="text-muted">Cached Items</span><span>{balances.length + escrows.length}</span></div>
          <div className="flex justify-between"><span className="text-muted">Transactions</span><span>{pendingTransactions.length + syncedTransactions.length}</span></div>
        </div>
      );
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

      {/* Install Banner */}
      <div className="container">
        <InstallBanner />
      </div>

      {/* Header */}
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
          <LanguageSwitcher />
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
      {/* Main Content */}
      <main className="main-content container">
        {builderMode ? (
          <Suspense fallback={<LazyFallback />}>
            <DashboardBuilder renderComponent={renderComponent} />
          </Suspense>
        ) : (
        <>
        {/* Demo Section - Create Transaction */}
        <section className="card mb-lg">
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
                '＋ Queue Transfer (Demo)'
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

        {/* Tab Navigation */}
        <div className="flex gap-md mb-lg" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-md)' }}>
          <button
            onClick={() => setActiveTab('balances')}
            className={activeTab === 'balances' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'balances' ? 'var(--color-highlight)' : 'transparent' }}
          >
            📊 Cached Balances
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={activeTab === 'analytics' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'analytics' ? 'var(--color-highlight)' : 'transparent' }}
          >
            📈 Analytics
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={activeTab === 'transfer' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'transfer' ? 'var(--color-highlight)' : 'transparent' }}
          >
            💸 Transfer
          </button>
          <button
            onClick={() => setActiveTab('build')}
            className={activeTab === 'build' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'build' ? 'var(--color-highlight)' : 'transparent' }}
          >
            🔨 Build Transaction
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={activeTab === 'pending' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'pending' ? 'var(--color-highlight)' : 'transparent' }}
          >
            ⏳ Pending ({pendingTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={activeTab === 'history' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'history' ? 'var(--color-highlight)' : 'transparent' }}
          >
            ✓ Synced History ({syncedTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={activeTab === 'workflows' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'workflows' ? 'var(--color-highlight)' : 'transparent' }}
          >
            🔀 Workflows
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={activeTab === 'table' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ backgroundColor: activeTab === 'table' ? 'var(--color-highlight)' : 'transparent' }}
          >
            📋 Table View
          </button>
        </div>

        {/* Content Area */}
        <div className="grid" style={{ gridTemplateColumns: '1fr 300px' }}>
          {/* Main Panel */}
          <div>
            {activeTab === 'balances' && (
              <>
                {!isOnline && (
                  <p className="text-warning mb-md">
                    You're offline. Showing cached balances from your last online session.
                  </p>
                )}
                <AdvancedBalanceDisplay
                  balances={balances}
                  emptyMessage="No cached balances. Connect to the network to fetch your balances."
                />
                {balances.length === 0 && (
                  <div className="card mt-lg" style={{ textAlign: 'center' }}>
                    <p className="text-muted">
                      💡 In a real app, your token balances will be cached automatically when you go offline.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'analytics' && (
              <Suspense fallback={<LazyFallback />}>
                <PortfolioDashboard />
              </Suspense>
            )}

            {activeTab === 'transfer' && (
              <Suspense fallback={<LazyFallback />}>
                <TokenTransferWizard />
              </Suspense>
            )}

            {activeTab === 'build' && (
              <Suspense fallback={<LazyFallback />}>
                <TransactionFormBuilder />
              </Suspense>
            )}

            {activeTab === 'pending' && (
              <>
                <h2 className="mb-md">Pending Transactions</h2>
                {!isOnline && (
                  <p className="text-warning mb-md">
                    You're offline. Transactions will be queued and submitted when connection is restored.
                  </p>
                )}
                <TransactionList
                  transactions={pendingTransactions}
                  onRetry={retryTransaction}
                  onDelete={deleteTransaction}
                  onResolveConflict={resolveConflict}
                  emptyMessage="No pending transactions. Your transactions will appear here when queued."
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

            {activeTab === 'workflows' && (
              <Suspense fallback={<LazyFallback />}>
                <WorkflowLauncher
                  onComplete={(templateId, values) =>
                    console.info('Workflow completed:', templateId, values)
                  }
                />
              </Suspense>
            )}

            {activeTab === 'table' && (
              <DataTable
                caption="All Transactions"
                data={[...pendingTransactions, ...syncedTransactions]}
                columns={txColumns}
                getRowId={(r) => r.id}
                bulkActions={[{ label: 'Delete selected', icon: '🗑', action: (rows) => rows.forEach((r) => deleteTransaction(r.id)) }]}
                exportFormats={['csv', 'json']}
                renderExpanded={(r) => (
                  <pre style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(r.params, null, 2)}
                  </pre>
                )}
              />
            )}
          </div>

          {/* Sidebar */}
          <div>
            <SyncStatus />
            
            {/* Storage Info */}
            <div className="card mt-lg">
              <div className="card-header">
                <span className="card-title">Storage</span>
              </div>
              
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

          {activeTab === 'dashboard' && (
            <>
              <h2 className="mb-md">Real-Time Dashboard</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '16px' }}>
                <Dashboard />
                <LiveDataFeed onDataUpdate={(data) => setChartData([...chartData, data])} />
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <h2 className="mb-md">Settings & Preferences</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <NotificationPreferences userId="user-1" />
                </div>
                <div>
                  <AlertRules />
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <PreferenceManagement />
              </div>
            </>
          )}

          {(activeTab as string) === 'performance' && (
            <Suspense fallback={<LazyFallback />}>
              <PerformanceDashboard />
            </Suspense>
          )}

          {(activeTab as string) === 'accessibility' && (
            <Suspense fallback={<LazyFallback />}>
              <AccessibilityDashboard />
            </Suspense>
          )}

          {(activeTab as string) === 'docs' && (
            <Suspense fallback={<LazyFallback />}>
              <ComponentDocs />
            </Suspense>
          )}
        </main>
      </div>
          </div>
        </div>
        </>
        )}
      </main>

      <TutorialOverlay />
    </div>
  );
}

export default App;
