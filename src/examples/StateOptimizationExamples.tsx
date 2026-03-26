/**
 * Example: Integrating Optimized State Management
 * 
 * This file demonstrates how to integrate the optimized state management
 * system with your existing application.
 */

import React from 'react';
import { OptimizedStateProvider } from '../context/OptimizedStateContext';
import { ConnectivityProvider } from '../context/ConnectivityContext';
import { StorageProvider } from '../context/StorageContext';
import { TransactionQueueProvider } from '../context/TransactionQueueContext';
import { StateDebugger } from '../components/StateDebugger';
import App from '../App';

/**
 * Example 1: Basic Setup
 */
export function AppWithOptimizedState(): JSX.Element {
  return (
    <OptimizedStateProvider persistenceEnabled={true} devToolsEnabled={true}>
      <ConnectivityProvider>
        <StorageProvider>
          <TransactionQueueProvider>
            <App />
          </TransactionQueueProvider>
        </StorageProvider>
      </ConnectivityProvider>
    </OptimizedStateProvider>
  );
}

/**
 * Example 2: With State Debugger
 */
export function AppWithDebugger(): JSX.Element {
  return (
    <OptimizedStateProvider persistenceEnabled={true} devToolsEnabled={true}>
      <ConnectivityProvider>
        <StorageProvider>
          <TransactionQueueProvider>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
              <App />
              {import.meta.env.DEV && <StateDebugger />}
            </div>
          </TransactionQueueProvider>
        </StorageProvider>
      </ConnectivityProvider>
    </OptimizedStateProvider>
  );
}

/**
 * Example 3: Using Optimized State in Components
 */
import { useOptimizedState } from '../context/OptimizedStateContext';
import { useBalances, useTransaction, useStateMetrics } from '../hooks/useStateOptimization';

export function BalanceComponent(): JSX.Element {
  // Get all balances with memoization
  const balances = useBalances();

  return (
    <div>
      <h2>Balances</h2>
      {balances.map(balance => (
        <div key={balance.id}>
          {balance.tokenSymbol}: {balance.amount}
        </div>
      ))}
    </div>
  );
}

export function TransactionComponent({ txId }: { txId: string }): JSX.Element {
  // Get specific transaction with memoization
  const tx = useTransaction(txId);
  const metrics = useStateMetrics();

  if (!tx) return <div>Transaction not found</div>;

  return (
    <div>
      <h3>{tx.type}</h3>
      <p>Status: {tx.status}</p>
      <p>Created: {new Date(tx.createdAt).toLocaleString()}</p>
      <small>Cache hit rate: {((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(2)}%</small>
    </div>
  );
}

/**
 * Example 4: Batch Updates
 */
export function BatchUpdateExample(): JSX.Element {
  const { batchUpdate } = useOptimizedState();

  const handleSync = async () => {
    // Fetch data from server
    const response = await fetch('/api/sync');
    const data = await response.json();

    // Update all state slices at once
    batchUpdate({
      balances: data.balances.reduce((acc: any, b: any) => ({
        ...acc,
        [b.id]: b
      }), {}),
      escrows: data.escrows.reduce((acc: any, e: any) => ({
        ...acc,
        [e.id]: e
      }), {}),
      transactions: data.transactions.reduce((acc: any, t: any) => ({
        ...acc,
        [t.id]: t
      }), {}),
    });
  };

  return (
    <button onClick={handleSync}>Sync All Data</button>
  );
}

/**
 * Example 5: Performance Monitoring
 */
import { usePerformanceMonitor } from '../hooks/useStateOptimization';

export function PerformanceMonitoringExample(): JSX.Element {
  const monitor = usePerformanceMonitor('expensive-calculation');

  const handleExpensiveOperation = () => {
    monitor(() => {
      // Simulate expensive operation
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(i);
      }
      console.log('Calculation complete:', sum);
    });
  };

  return (
    <button onClick={handleExpensiveOperation}>
      Run Expensive Operation (check console for timing)
    </button>
  );
}

/**
 * Example 6: Custom Selectors
 */
import { useStateSelector } from '../hooks/useStateOptimization';

export function CustomSelectorExample(): JSX.Element {
  // Get total balance across all tokens
  const totalBalance = useStateSelector(state => {
    return Object.values(state.balances).reduce((sum, balance) => {
      return sum + parseFloat(balance.amount || '0');
    }, 0);
  });

  // Get pending transactions count
  const pendingCount = useStateSelector(state => {
    return Object.values(state.transactions).filter(tx => tx.status === 'pending').length;
  });

  return (
    <div>
      <p>Total Balance: {totalBalance}</p>
      <p>Pending Transactions: {pendingCount}</p>
    </div>
  );
}

/**
 * Example 7: Developer Tools Usage
 */
export function DevToolsExample(): JSX.Element {
  const handleExportState = () => {
    const history = (window as any).__SOROBAN_DEVTOOLS__.getHistory();
    const json = JSON.stringify(history, null, 2);
    console.log('State history:', json);
    
    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'state-history.json';
    a.click();
  };

  const handleShowPerformance = () => {
    const summary = (window as any).__SOROBAN_DEVTOOLS__.getPerformanceSummary();
    console.table(summary);
  };

  return (
    <div>
      <button onClick={handleExportState}>Export State History</button>
      <button onClick={handleShowPerformance}>Show Performance Summary</button>
    </div>
  );
}

export default AppWithOptimizedState;
