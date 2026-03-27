/**
 * TokenManagementDashboard — root component composing all sub-panels.
 * Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 4.1, 5.1-5.6, 7.4
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { useTransactionQueue } from '../../context/TransactionQueueContext';
import { useWallet } from '../../context/WalletContext';
import { useBalancePoller } from '../../hooks/useBalancePoller';
import { useToastNotifications } from '../../hooks/useToastNotifications';
import { notificationManager } from '../../services/notifications';
import { TokenConfig } from '../../types/tokenManagement';
import { TokenSidebar } from './TokenSidebar';
import { TokenDetailPanel } from './TokenDetailPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { StakingPanel } from './StakingPanel';
import { ApproveForm } from './ApproveForm';
import { PortfolioDashboard } from '../PortfolioDashboard';
import { TransactionHistory } from '../TransactionHistory';
import { TokenTransferWizard } from '../TokenTransferWizard';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'history' | 'operations' | 'analytics' | 'staking';

const DEFAULT_RPC_URL = import.meta.env?.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const TOKEN_CONFIGS_KEY = 'tmd_token_configs';
const CURRENCIES = ['USD', 'EUR', 'GBP'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadTokenConfigs(): TokenConfig[] {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_CONFIGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function fmtTimestamp(ts: number | null): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleTimeString();
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TokenManagementDashboardProps {
  /** Soroban RPC endpoint, defaults to VITE_SOROBAN_RPC_URL env var */
  rpcUrl?: string;
  /** Polling interval in ms, default 30_000 */
  pollIntervalMs?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TokenManagementDashboard({
  rpcUrl = DEFAULT_RPC_URL,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: TokenManagementDashboardProps): JSX.Element {
  const { balances } = useStorage();
  const { pendingTransactions, syncedTransactions } = useTransactionQueue();
  const wallet = useWallet();

  const allTransactions = useMemo(
    () => [...pendingTransactions, ...syncedTransactions],
    [pendingTransactions, syncedTransactions],
  );

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [currency, setCurrency] = useState('USD');
  const [tokenConfigs] = useState<TokenConfig[]>(loadTokenConfigs);

  // Auto-select first token when balances load
  useEffect(() => {
    if (!selectedTokenId && balances.length > 0) {
      setSelectedTokenId(balances[0].contractId);
    }
  }, [balances, selectedTokenId]);

  // Wallet address from context (handles both WalletState shapes)
  const walletAddress: string | null =
    (wallet as any).activeConnection?.account?.publicKey ??
    (wallet as any).account?.publicKey ??
    null;

  // Balance change handler — fires notification
  const handleBalanceChange = useCallback(
    (contractId: string, newAmount: string, oldAmount: string) => {
      const balance = balances.find((b) => b.contractId === contractId);
      const symbol = balance?.tokenSymbol ?? contractId.slice(0, 8);
      notificationManager.addNotification({
        id: `balance-change-${contractId}-${Date.now()}`,
        title: 'Balance updated',
        message: `${symbol} balance changed`,
        priority: 'medium',
        channels: ['in-app'],
        category: 'transaction',
        timestamp: Date.now(),
        read: false,
      });
    },
    [balances],
  );

  // Balance poller
  const contractIds = useMemo(() => balances.map((b) => b.contractId), [balances]);
  const { lastUpdated, error: pollerError } = useBalancePoller({
    walletAddress,
    contractIds,
    rpcUrl,
    intervalMs: pollIntervalMs,
    onBalanceChange: handleBalanceChange,
  });

  // Toast notifications for transaction status changes
  useToastNotifications(allTransactions);

  // Selected token's config (for staking)
  const selectedConfig = tokenConfigs.find((c) => c.contractId === selectedTokenId);
  const hasStaking = !!selectedConfig?.stakingContractAddress;

  // Transactions scoped to selected token (Requirement 3.1)
  const scopedTransactions = useMemo(
    () =>
      selectedTokenId
        ? allTransactions.filter((t) => t.contractId === selectedTokenId)
        : allTransactions,
    [allTransactions, selectedTokenId],
  );

  // Selected balance
  const selectedBalance = balances.find((b) => b.contractId === selectedTokenId);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'operations', label: 'Operations' },
    { id: 'analytics', label: 'Analytics' },
    ...(hasStaking ? [{ id: 'staking' as Tab, label: 'Staking' }] : []),
  ];

  return (
    <div className="tmd-root">
      {/* Toolbar */}
      <div className="tmd-toolbar">
        <h2 className="tmd-title">Token Management</h2>
        <div className="tmd-toolbar-right">
          <select
            className="form-input"
            style={{ width: 'auto', padding: '4px 8px' }}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="tmd-last-updated text-muted">
            Last updated: {fmtTimestamp(lastUpdated)}
          </span>
          {pollerError && (
            <span className="text-error tmd-poller-error" title={pollerError}>
              ⚠ Sync error
            </span>
          )}
        </div>
      </div>

      {/* Master-detail layout */}
      <div className="tmd-layout">
        {/* Sidebar */}
        <TokenSidebar
          balances={balances}
          selectedId={selectedTokenId}
          onSelect={setSelectedTokenId}
          currency={currency}
        />

        {/* Detail area */}
        <div className="tmd-detail">
          {/* Tab bar */}
          <nav className="tmd-tabs" role="tablist" aria-label="Dashboard tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`tmd-tab${activeTab === tab.id ? ' tmd-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab panels */}
          <div className="tmd-tab-content" role="tabpanel">
            {activeTab === 'overview' && <PortfolioDashboard />}

            {activeTab === 'history' && (
              <TransactionHistory transactions={scopedTransactions} />
            )}

            {activeTab === 'operations' && (
              <div className="tmd-operations">
                <TokenTransferWizard />
                {selectedTokenId && (
                  <ApproveForm
                    contractId={selectedTokenId}
                    onSuccess={(txId) => {
                      // Optionally switch to history tab to see the queued tx
                    }}
                  />
                )}
                {selectedTokenId && walletAddress && (
                  <TokenDetailPanel
                    contractId={selectedTokenId}
                    walletAddress={walletAddress}
                    rpcUrl={rpcUrl}
                  />
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel
                balances={balances}
                transactions={allTransactions}
                currency={currency}
              />
            )}

            {activeTab === 'staking' && hasStaking && selectedTokenId && walletAddress && (
              <StakingPanel
                tokenContractId={selectedTokenId}
                stakingContractAddress={selectedConfig!.stakingContractAddress!}
                walletAddress={walletAddress}
                rpcUrl={rpcUrl}
                availableBalance={selectedBalance?.amount ?? '0'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TokenManagementDashboard;
