import React, { useState } from 'react';
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { ConnectivityStatus, OfflineBanner } from './components/ConnectivityStatus';
import { TransactionList } from './components/TransactionItem';
import { AdvancedBalanceDisplay } from './components/AdvancedBalanceDisplay';
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
import { ResponsiveNav, Breadcrumb, ContextualNav, Dashboard, LiveDataFeed, NotificationCenter, NotificationPreferences, AlertRules } from './components';
import { PreferenceManagement, PreferenceAnalytics } from './components';
import { NavItem } from './services/navigation/types';
import { DataPoint } from './services/visualization/types';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { TutorialOverlay, TutorialLauncher } from './components/TutorialOverlay';
import { HelpPanel } from './components/HelpPanel';
import { InstallBanner, PushToggle } from './components/PWAControls';
import { InstallBanner } from './components/PWAControls';
import { PWADashboard } from './components/PWADashboard';
import { useConnectivity } from './context/ConnectivityContext';
import { useStorage } from './context/StorageContext';
import { useTransactionQueue } from './context/TransactionQueueContext';
import { DataTable } from './table';
import type { ColumnDef } from './table';
import type { CachedTransaction } from './services/storage/types';
import type { ComponentType } from './builder/types';

type Tab =
type ActiveTab =
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
  | 'settings'
  | 'help';
  | 'settings';
// Lazy-loaded heavy components for code splitting
const TransactionFormBuilder = lazy(() => import('./components/TransactionFormBuilder').then(m => ({ default: m.TransactionFormBuilder })));
const TokenTransferWizard = lazy(() => import('./components/TokenTransferWizard').then(m => ({ default: m.TokenTransferWizard })));
const PortfolioDashboard = lazy(() => import('./components/PortfolioDashboard').then(m => ({ default: m.PortfolioDashboard })));
const DashboardBuilder = lazy(() => import('./builder/DashboardBuilder').then(m => ({ default: m.DashboardBuilder })));
const WorkflowLauncher = lazy(() => import('./workflow').then(m => ({ default: m.WorkflowLauncher })));
const PerformanceDashboard = lazy(() => import('./components/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard })));
const AccessibilityDashboard = lazy(() => import('./components/AccessibilityDashboard').then(m => ({ default: m.AccessibilityDashboard })));
const ComponentDocs = lazy(() => import('./components/ComponentDocs').then(m => ({ default: m.ComponentDocs })));
const ErrorDashboard = lazy(() => import('./components/ErrorDashboard').then(m => ({ default: m.ErrorDashboard })));

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

  const [activeTab, setActiveTab] = useState<Tab>('balances');
  const [activeTab, setActiveTab] = useState<ActiveTab>('balances');
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
      onClick: () => { setActiveTab('balances'); setBreadcrumbs([{ label: 'Home' }, { label: 'Balances' }]); },
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
          onClick: () => { setActiveTab('pending'); setBreadcrumbs([{ label: 'Home' }, { label: 'Transactions' }, { label: 'Pending' }]); },
        },
        {
          id: 'history',
          label: 'History',
          icon: '✓',
          badge: syncedTransactions.length,
          onClick: () => navigate('history', [{ label: 'Home' }, { label: 'Transactions' }, { label: 'History' }]),
          onClick: () => { setActiveTab('history'); setBreadcrumbs([{ label: 'Home' }, { label: 'Transactions' }, { label: 'History' }]); },
        },
      ],
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📈',
      onClick: () => navigate('analytics', [{ label: 'Home' }, { label: 'Analytics' }]),
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
      onClick: () => { setActiveTab('search'); setBreadcrumbs([{ label: 'Home' }, { label: 'Search' }]); },
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      onClick: () => navigate('dashboard', [{ label: 'Home' }, { label: 'Dashboard' }]),
      icon: '📈',
      onClick: () => { setActiveTab('dashboard'); setBreadcrumbs([{ label: 'Home' }, { label: 'Dashboard' }]); },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      onClick: () => navigate('settings', [{ label: 'Home' }, { label: 'Settings' }]),
    },
    {
      id: 'help',
      label: 'Help',
      icon: '❓',
      onClick: () => navigate('help', [{ label: 'Home' }, { label: 'Help' }]),
    },
  ];
      onClick: () => { setActiveTab('settings'); setBreadcrumbs([{ label: 'Home' }, { label: 'Settings' }]); },
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
    {
      id: 'errors',
      label: 'Error Tracking',
      icon: '🐛',
      onClick: () => {
        setActiveTab('error-tracking' as any);
        setBreadcrumbs([{ label: 'Home' }, { label: 'Error Tracking' }]);
      },
    },
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
          <PWADashboard />
          <TutorialLauncher />
          <ThemeCustomizer />
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
          {builderMode ? (
            <DashboardBuilder renderComponent={renderComponent} />
          ) : (
            <>
              {activeTab === 'balances' && (
                <ContextualNav
                  context="Quick Actions"
                  items={[
                    { id: 'sync', label: 'Sync Now', icon: '🔄', onClick: syncNow },
                    { id: 'add', label: 'Add Balance', icon: '➕', onClick: () => {} },
                  ]}
                />
              )}

              <section className="card mb-lg">
                <div className="card-header">
                  <span className="card-title">Quick Actions</span>
                </div>
                <div className="flex gap-md items-center">
                  <button onClick={handleSubmitTransaction} disabled={isDemoLoading} className="btn btn-primary">
                    {isDemoLoading ? (
                      <>
                        <span className="spinner" style={{ width: '16px', height: '16px' }} />
                        Creating...
                      </>
                    ) : (
                      '＋ Queue Transfer (Demo)'
                    )}
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
                  {!isOnline && (
                    <p className="text-warning mb-md">
                      You're offline. Showing cached balances from your last online session.
                    </p>
                  )}
                  <AdvancedBalanceDisplay
                    balances={balances}
                    emptyMessage="No cached balances. Connect to the network to fetch your balances."
                  />
                </>
              )}

              {activeTab === 'analytics' && <PortfolioDashboard />}

              {activeTab === 'transfer' && <TokenTransferWizard />}

              {activeTab === 'build' && <TransactionFormBuilder />}

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

              {activeTab === 'workflows' && (
                <WorkflowLauncher
                  onComplete={(templateId, values) => console.info('Workflow completed:', templateId, values)}
                />
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
              {/* Quick Actions */}
              <section className="card mb-lg">
                <div className="card-header">
                  <span className="card-title">Quick Actions</span>
                </div>
                <div className="flex gap-md items-center">
                  <button onClick={handleSubmitTransaction} disabled={isDemoLoading} className="btn btn-primary">
                    {isDemoLoading ? (
                      <>
                        <span className="spinner" style={{ width: '16px', height: '16px' }} />
                        Creating...
                      </>
                    ) : (
                      '＋ Queue Transfer (Demo)'
                    )}
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
                      {!isOnline && (
                        <p className="text-warning mb-md">
                          You're offline. Showing cached balances from your last online session.
                        </p>
                      )}
                      <AdvancedBalanceDisplay
                        balances={balances}
                        emptyMessage="No cached balances. Connect to the network to fetch your balances."
                      />
                    </>
                  )}

                  {activeTab === 'analytics' && <PortfolioDashboard />}

                  {activeTab === 'transfer' && <TokenTransferWizard />}

                  {activeTab === 'build' && <TransactionFormBuilder />}

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

                  {activeTab === 'workflows' && (
                    <WorkflowLauncher
                      onComplete={(templateId, values) =>
                        console.info('Workflow completed:', templateId, values)
                      }
                    />
                  )}

                  {activeTab === 'table' && (
                    <DataTable
                      caption="All Transactions"
                      data={[...pendingTransactions, ...syncedTransactions]}
                      columns={txColumns}
                      getRowId={(r) => r.id}
                      bulkActions={[
                        {
                          label: 'Delete selected',
                          icon: '🗑',
                          action: (rows) => rows.forEach((r) => deleteTransaction(r.id)),
                        },
                      ]}
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '16px' }}>
                        <Dashboard />
                        <LiveDataFeed onDataUpdate={(data) => setChartData([...chartData, data])} />
                      </div>
                    </>
                  )}

                  {activeTab === 'settings' && (
                    <>
                      <h2 className="mb-md">Settings</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <NotificationPreferences userId="user-1" />
                        <AlertRules />
                      </div>
                    </>
                  )}

                  {activeTab === 'help' && (
                    <>
                      <h2 className="mb-md">Help &amp; Onboarding</h2>
                      <HelpPanel />
                    </>
                  )}
                </div>

                {/* Sidebar */}
                <div>
                  <SyncStatus />
                  <div className="card mt-lg">
                    <div className="card-header">
                      <span className="card-title">Storage</span>
                    </div>
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
                  </div>
                </div>
              </div>
            </>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
                    <Dashboard />
                    <LiveDataFeed onDataUpdate={(data) => setChartData([...chartData, data])} />
                  </div>
                </>
              )}

              {activeTab === 'settings' && (
                <>
                  <h2 className="mb-md">Settings</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <NotificationPreferences userId="user-1" />
                    <AlertRules />
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

          {(activeTab as string) === 'error-tracking' && (
            <Suspense fallback={<LazyFallback />}>
              <ErrorDashboard />
            </Suspense>
          )}
        </main>
      </div>

      <TutorialOverlay />
    </div>
  );
}

export default App;
