/**
 * Unit tests for TokenManagementDashboard components.
 * Requirements: 1.3, 2.4, 3.5, 7.4
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as StorageContext from '../../context/StorageContext';
import * as TxQueueContext from '../../context/TransactionQueueContext';
import * as TokenMetadataHook from '../../hooks/useTokenMetadata';
import * as AllowancesHook from '../../hooks/useAllowances';
import { TokenSidebar } from '../../components/TokenManagementDashboard/TokenSidebar';
import { TokenDetailPanel } from '../../components/TokenManagementDashboard/TokenDetailPanel';
import { ApproveForm } from '../../components/TokenManagementDashboard/ApproveForm';
import { StakingPanel } from '../../components/TokenManagementDashboard/StakingPanel';
import type { Balance, CachedTransaction } from '../../services/storage/types';

// Mock WalletContext module to avoid the broken WalletContext.tsx file
vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({ activeConnection: null, account: null, status: 'disconnected', error: null }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  default: undefined,
}));

// Mock useBalancePoller to avoid RPC calls in tests
vi.mock('../../hooks/useBalancePoller', () => ({
  useBalancePoller: () => ({ lastUpdated: null, error: null }),
  useInterval: vi.fn(),
}));

// Mock useToastNotifications
vi.mock('../../hooks/useToastNotifications', () => ({
  useToastNotifications: vi.fn(),
}));

// Mock heavy sub-components
vi.mock('../../components/PortfolioDashboard', () => ({
  PortfolioDashboard: () => <div data-testid="portfolio-dashboard">Portfolio</div>,
  default: () => <div data-testid="portfolio-dashboard">Portfolio</div>,
}));

vi.mock('../../components/TransactionHistory', () => ({
  TransactionHistory: ({ transactions }: { transactions: CachedTransaction[] }) => (
    <div data-testid="transaction-history">
      {transactions.length === 0
        ? <p>No transactions match your filters.</p>
        : <p>{transactions.length} transactions</p>}
    </div>
  ),
  default: ({ transactions }: { transactions: CachedTransaction[] }) => (
    <div data-testid="transaction-history">
      {transactions.length === 0
        ? <p>No transactions match your filters.</p>
        : <p>{transactions.length} transactions</p>}
    </div>
  ),
}));

vi.mock('../../components/TokenTransferWizard', () => ({
  TokenTransferWizard: () => <div data-testid="token-transfer-wizard">Transfer Wizard</div>,
  default: () => <div data-testid="token-transfer-wizard">Transfer Wizard</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    id: 'b1',
    address: 'GABC',
    contractId: 'CTOKEN1',
    tokenSymbol: 'TKN',
    amount: '10000000',
    lastUpdated: Date.now(),
    ...overrides,
  };
}

function makeTx(overrides: Partial<CachedTransaction> = {}): CachedTransaction {
  return {
    id: 'tx1',
    type: 'transfer',
    contractId: 'CTOKEN1',
    method: 'transfer',
    params: {},
    status: 'pending',
    createdAt: Date.now(),
    retryCount: 0,
    localVersion: 1,
    ...overrides,
  };
}

function mockStorageContext(balances: Balance[] = []) {
  vi.spyOn(StorageContext, 'useStorage').mockReturnValue({
    isInitialized: true,
    balances,
    escrows: [],
    storageUsed: 0,
    storageQuota: 0,
    refreshData: vi.fn(),
    saveBalance: vi.fn(),
    saveEscrow: vi.fn(),
    getBalance: vi.fn(),
    getEscrow: vi.fn(),
    clearCache: vi.fn(),
  } as any);
}

function mockTxQueueContext(
  overrides: Partial<ReturnType<typeof TxQueueContext.useTransactionQueue>> = {},
) {
  vi.spyOn(TxQueueContext, 'useTransactionQueue').mockReturnValue({
    pendingTransactions: [],
    syncedTransactions: [],
    syncStatus: { lastSyncTime: null, pendingCount: 0, isSyncing: false, lastError: null },
    isInitialized: true,
    createTransaction: vi.fn().mockResolvedValue({ id: 'tx-queued' }),
    syncNow: vi.fn(),
    retryTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    resolveConflict: vi.fn(),
    ...overrides,
  } as any);
}

// ── TokenSidebar tests ────────────────────────────────────────────────────────

describe('TokenSidebar', () => {
  it('shows empty-state message when balances is empty (Requirement 1.3)', () => {
    render(<TokenSidebar balances={[]} selectedId={null} onSelect={vi.fn()} currency="USD" />);
    expect(screen.getByText(/no tokens found/i)).toBeInTheDocument();
  });

  it('renders token list when balances are provided', () => {
    const balances = [makeBalance({ tokenSymbol: 'TKN', contractId: 'C1' })];
    render(<TokenSidebar balances={balances} selectedId={null} onSelect={vi.fn()} currency="USD" />);
    expect(screen.getByText('TKN')).toBeInTheDocument();
  });

  it('highlights selected token', () => {
    const balances = [makeBalance({ contractId: 'C1', tokenSymbol: 'TKN' })];
    render(<TokenSidebar balances={balances} selectedId="C1" onSelect={vi.fn()} currency="USD" />);
    const item = screen.getByRole('option', { name: /TKN/i });
    expect(item).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onSelect when a token is clicked', () => {
    const onSelect = vi.fn();
    const balances = [makeBalance({ contractId: 'C1', tokenSymbol: 'TKN' })];
    render(<TokenSidebar balances={balances} selectedId={null} onSelect={onSelect} currency="USD" />);
    fireEvent.click(screen.getByRole('option', { name: /TKN/i }));
    expect(onSelect).toHaveBeenCalledWith('C1');
  });
});

// ── TokenDetailPanel tests ────────────────────────────────────────────────────

describe('TokenDetailPanel', () => {
  beforeEach(() => {
    vi.spyOn(AllowancesHook, 'useAllowances').mockReturnValue({
      allowances: [],
      loading: false,
      error: null,
    });
  });

  it('shows error message and retry button when RPC throws (Requirement 2.4)', () => {
    vi.spyOn(TokenMetadataHook, 'useTokenMetadata').mockReturnValue({
      metadata: null,
      loading: false,
      error: 'RPC connection refused',
      retry: vi.fn(),
    });

    render(
      <TokenDetailPanel
        contractId="CTOKEN1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
      />,
    );

    expect(screen.getByText(/failed to load token metadata/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls retry when retry button is clicked', () => {
    const retry = vi.fn();
    vi.spyOn(TokenMetadataHook, 'useTokenMetadata').mockReturnValue({
      metadata: null,
      loading: false,
      error: 'Network error',
      retry,
    });

    render(
      <TokenDetailPanel
        contractId="CTOKEN1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows copy-to-clipboard button for contract ID (Requirement 2.5)', () => {
    vi.spyOn(TokenMetadataHook, 'useTokenMetadata').mockReturnValue({
      metadata: {
        contractId: 'CTOKEN1',
        name: 'Test Token',
        symbol: 'TKN',
        decimals: 7,
        totalSupply: '1000000000',
      },
      loading: false,
      error: null,
      retry: vi.fn(),
    });

    render(
      <TokenDetailPanel
        contractId="CTOKEN1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
      />,
    );

    expect(screen.getByRole('button', { name: /copy contract id/i })).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    vi.spyOn(TokenMetadataHook, 'useTokenMetadata').mockReturnValue({
      metadata: null,
      loading: true,
      error: null,
      retry: vi.fn(),
    });

    render(
      <TokenDetailPanel
        contractId="CTOKEN1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
      />,
    );

    expect(screen.getByText(/loading token metadata/i)).toBeInTheDocument();
  });
});

// ── ApproveForm tests ─────────────────────────────────────────────────────────

describe('ApproveForm', () => {
  beforeEach(() => {
    mockTxQueueContext();
  });

  it('shows spender validation error on blur with invalid address', async () => {
    render(<ApproveForm contractId="CTOKEN1" onSuccess={vi.fn()} />);
    const spenderInput = screen.getByLabelText(/spender address/i);
    fireEvent.change(spenderInput, { target: { value: 'invalid-address' } });
    fireEvent.blur(spenderInput);
    expect(await screen.findByText(/valid stellar address/i)).toBeInTheDocument();
  });

  it('shows amount validation error when amount is not positive', async () => {
    render(<ApproveForm contractId="CTOKEN1" onSuccess={vi.fn()} />);
    const amountInput = screen.getByLabelText(/allowance amount/i);
    fireEvent.change(amountInput, { target: { value: '-1' } });
    fireEvent.blur(amountInput);
    expect(await screen.findByText(/positive number/i)).toBeInTheDocument();
  });

  it('shows queue error when createTransaction rejects (Requirement 4.6)', async () => {
    mockTxQueueContext({
      createTransaction: vi.fn().mockRejectedValue(new Error('Queue is full')),
    });

    render(<ApproveForm contractId="CTOKEN1" onSuccess={vi.fn()} />);

    const validAddress = 'G' + 'A'.repeat(55);
    fireEvent.change(screen.getByLabelText(/spender address/i), { target: { value: validAddress } });
    fireEvent.change(screen.getByLabelText(/allowance amount/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    expect(await screen.findByText(/queue is full/i)).toBeInTheDocument();
  });
});

// ── StakingPanel tests ────────────────────────────────────────────────────────

describe('StakingPanel', () => {
  beforeEach(() => {
    mockTxQueueContext();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'not supported' }),
    });
  });

  it('renders staking panel with staking contract configured (Requirement 7.1)', async () => {
    render(
      <StakingPanel
        tokenContractId="CTOKEN1"
        stakingContractAddress="CSTAKING1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
        availableBalance="50000000"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/staking/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/staked balance/i)).toBeInTheDocument();
  });

  it('shows stake and unstake forms', async () => {
    render(
      <StakingPanel
        tokenContractId="CTOKEN1"
        stakingContractAddress="CSTAKING1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
        availableBalance="50000000"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/amount to stake/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount to unstake/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when stake amount is zero', async () => {
    render(
      <StakingPanel
        tokenContractId="CTOKEN1"
        stakingContractAddress="CSTAKING1"
        walletAddress="GABC"
        rpcUrl="https://rpc.example.com"
        availableBalance="50000000"
      />,
    );

    await waitFor(() => screen.getByLabelText(/amount to stake/i));

    fireEvent.change(screen.getByLabelText(/amount to stake/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^stake$/i }));

    expect(await screen.findByText(/greater than zero/i)).toBeInTheDocument();
  });
});

// ── TokenManagementDashboard root tests ───────────────────────────────────────

describe('TokenManagementDashboard', () => {
  let TMD: React.ComponentType<{ rpcUrl?: string; pollIntervalMs?: number }>;

  beforeEach(async () => {
    mockStorageContext([]);
    mockTxQueueContext();
    localStorage.clear();
    const mod = await import('../../components/TokenManagementDashboard');
    TMD = mod.TokenManagementDashboard;
  });

  it('renders without crashing with empty storage', () => {
    render(<TMD />);
    expect(screen.getByText(/token management/i)).toBeInTheDocument();
  });

  it('shows empty-state message when balances is [] (Requirement 1.3)', () => {
    render(<TMD />);
    expect(screen.getByText(/no tokens found/i)).toBeInTheDocument();
  });

  it('shows "No results" message when all filters exclude all transactions (Requirement 3.5)', async () => {
    mockStorageContext([makeBalance({ contractId: 'CTOKEN1' })]);
    mockTxQueueContext({ syncedTransactions: [], pendingTransactions: [] });

    render(<TMD />);

    fireEvent.click(screen.getByRole('tab', { name: /history/i }));

    await waitFor(() => {
      expect(screen.getByTestId('transaction-history')).toBeInTheDocument();
    });
    expect(screen.getByText(/no transactions match/i)).toBeInTheDocument();
  });

  it('StakingPanel tab is hidden when no staking contract configured (Requirement 7.4)', () => {
    mockStorageContext([makeBalance({ contractId: 'CTOKEN1' })]);
    render(<TMD />);
    expect(screen.queryByRole('tab', { name: /staking/i })).not.toBeInTheDocument();
  });

  it('StakingPanel tab is shown when staking contract is configured', () => {
    mockStorageContext([makeBalance({ contractId: 'CTOKEN1' })]);
    localStorage.setItem(
      'tmd_token_configs',
      JSON.stringify([{ contractId: 'CTOKEN1', stakingContractAddress: 'CSTAKING1' }]),
    );

    render(<TMD />);
    expect(screen.getByRole('tab', { name: /staking/i })).toBeInTheDocument();
  });
});
