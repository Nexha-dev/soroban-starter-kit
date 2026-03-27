/**
 * StakingPanel — displays staking info and stake/unstake forms.
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import React, { useEffect, useState } from 'react';
import { StakingState } from '../../types/tokenManagement';
import { validateStakingAmount } from '../../utils/tokenValidation';
import { useTransactionQueue } from '../../context/TransactionQueueContext';

const STROOPS = 10_000_000;

function toFloat(s: string): string {
  return (Number(s) / STROOPS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function displayToStroops(v: string): number {
  return Math.round(parseFloat(v) * STROOPS);
}

export interface StakingPanelProps {
  tokenContractId: string;
  stakingContractAddress: string;
  walletAddress: string;
  rpcUrl: string;
  /** Available (unstaked) balance in stroops */
  availableBalance?: string;
}

/**
 * Fetches staking state from the staking contract via RPC.
 * Falls back to mock data if the RPC doesn't support staking queries.
 */
async function fetchStakingState(
  rpcUrl: string,
  stakingContractAddress: string,
  walletAddress: string,
): Promise<StakingState> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'simulateTransaction',
        params: {
          transaction: {
            contract: stakingContractAddress,
            method: 'get_staking_info',
            args: [walletAddress],
          },
        },
      }),
    });

    if (!response.ok) throw new Error(`RPC HTTP error ${response.status}`);
    const json = await response.json();

    if (json.result?.stakedAmount !== undefined) {
      return {
        stakedAmount: String(json.result.stakedAmount),
        estimatedRewards: String(json.result.estimatedRewards ?? '0'),
        lockupEndsAt: Number(json.result.lockupEndsAt ?? 0),
      };
    }
  } catch {
    // Fall through to mock data
  }

  // Mock staking state when RPC doesn't support it
  return {
    stakedAmount: '0',
    estimatedRewards: '0',
    lockupEndsAt: 0,
  };
}

export function StakingPanel({
  tokenContractId,
  stakingContractAddress,
  walletAddress,
  rpcUrl,
  availableBalance = '0',
}: StakingPanelProps): JSX.Element {
  const { createTransaction } = useTransactionQueue();

  const [stakingState, setStakingState] = useState<StakingState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [stateError, setStateError] = useState<string | null>(null);

  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [stakeLoading, setStakeLoading] = useState(false);
  const [stakeConfirmation, setStakeConfirmation] = useState<string | null>(null);

  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [unstakeError, setUnstakeError] = useState<string | null>(null);
  const [unstakeLoading, setUnstakeLoading] = useState(false);
  const [unstakeConfirmation, setUnstakeConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingState(true);
    setStateError(null);

    fetchStakingState(rpcUrl, stakingContractAddress, walletAddress)
      .then((state) => {
        if (!cancelled) {
          setStakingState(state);
          setLoadingState(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStateError(err instanceof Error ? err.message : String(err));
          setLoadingState(false);
        }
      });

    return () => { cancelled = true; };
  }, [rpcUrl, stakingContractAddress, walletAddress]);

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountStroops = displayToStroops(stakeAmount);
    const availableStroops = Number(availableBalance);
    const err = validateStakingAmount(amountStroops, availableStroops);
    if (err) { setStakeError(err); return; }

    setStakeLoading(true);
    setStakeError(null);
    setStakeConfirmation(null);

    try {
      const tx = await createTransaction('approve', stakingContractAddress, 'stake', {
        tokenContractId,
        amount: String(amountStroops),
      });
      setStakeConfirmation(tx.id);
      setStakeAmount('');
      // Refresh staking state
      const updated = await fetchStakingState(rpcUrl, stakingContractAddress, walletAddress);
      setStakingState(updated);
    } catch (err) {
      setStakeError(err instanceof Error ? err.message : 'Failed to queue stake transaction.');
    } finally {
      setStakeLoading(false);
    }
  };

  const handleUnstake = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountStroops = displayToStroops(unstakeAmount);
    const stakedStroops = Number(stakingState?.stakedAmount ?? '0');
    const err = validateStakingAmount(amountStroops, stakedStroops);
    if (err) { setUnstakeError(err); return; }

    setUnstakeLoading(true);
    setUnstakeError(null);
    setUnstakeConfirmation(null);

    try {
      const tx = await createTransaction('approve', stakingContractAddress, 'unstake', {
        tokenContractId,
        amount: String(amountStroops),
      });
      setUnstakeConfirmation(tx.id);
      setUnstakeAmount('');
      // Refresh staking state
      const updated = await fetchStakingState(rpcUrl, stakingContractAddress, walletAddress);
      setStakingState(updated);
    } catch (err) {
      setUnstakeError(err instanceof Error ? err.message : 'Failed to queue unstake transaction.');
    } finally {
      setUnstakeLoading(false);
    }
  };

  if (loadingState) {
    return <div className="tmd-staking-panel"><p className="text-muted">Loading staking info…</p></div>;
  }

  if (stateError) {
    return (
      <div className="tmd-staking-panel">
        <p className="text-error" role="alert">Failed to load staking info: {stateError}</p>
      </div>
    );
  }

  const lockupDate = stakingState && stakingState.lockupEndsAt > 0
    ? new Date(stakingState.lockupEndsAt).toLocaleDateString()
    : 'None';

  return (
    <div className="tmd-staking-panel">
      <h3>Staking</h3>

      {/* Staking info */}
      <dl className="tmd-detail-list">
        <div className="tmd-detail-row">
          <dt>Staked Balance</dt>
          <dd>{stakingState ? toFloat(stakingState.stakedAmount) : '0'}</dd>
        </div>
        <div className="tmd-detail-row">
          <dt>Estimated Rewards</dt>
          <dd>{stakingState ? toFloat(stakingState.estimatedRewards) : '0'}</dd>
        </div>
        <div className="tmd-detail-row">
          <dt>Lock-up Period Ends</dt>
          <dd>{lockupDate}</dd>
        </div>
        <div className="tmd-detail-row">
          <dt>Available Balance</dt>
          <dd>{toFloat(availableBalance)}</dd>
        </div>
      </dl>

      {/* Stake form */}
      <form className="tmd-staking-form" onSubmit={handleStake} noValidate>
        <h4>Stake Tokens</h4>
        <div className="form-group">
          <label className="form-label" htmlFor="stake-amount">Amount to Stake</label>
          <input
            id="stake-amount"
            className={`form-input${stakeError ? ' txf-input-error' : ''}`}
            type="number"
            min="0"
            step="any"
            value={stakeAmount}
            placeholder="0.00"
            onChange={(e) => { setStakeAmount(e.target.value); setStakeError(null); }}
            aria-invalid={!!stakeError}
          />
          {stakeError && <p className="txf-error" role="alert">{stakeError}</p>}
        </div>
        {stakeConfirmation && (
          <p className="text-success" role="status">
            Stake queued! Transaction ID: <code>{stakeConfirmation}</code>
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={stakeLoading}>
          {stakeLoading ? 'Queuing…' : 'Stake'}
        </button>
      </form>

      {/* Unstake form */}
      <form className="tmd-staking-form" onSubmit={handleUnstake} noValidate>
        <h4>Unstake Tokens</h4>
        <div className="form-group">
          <label className="form-label" htmlFor="unstake-amount">Amount to Unstake</label>
          <input
            id="unstake-amount"
            className={`form-input${unstakeError ? ' txf-input-error' : ''}`}
            type="number"
            min="0"
            step="any"
            value={unstakeAmount}
            placeholder="0.00"
            onChange={(e) => { setUnstakeAmount(e.target.value); setUnstakeError(null); }}
            aria-invalid={!!unstakeError}
          />
          {unstakeError && <p className="txf-error" role="alert">{unstakeError}</p>}
        </div>
        {unstakeConfirmation && (
          <p className="text-success" role="status">
            Unstake queued! Transaction ID: <code>{unstakeConfirmation}</code>
          </p>
        )}
        <button className="btn btn-secondary" type="submit" disabled={unstakeLoading}>
          {unstakeLoading ? 'Queuing…' : 'Unstake'}
        </button>
      </form>
    </div>
  );
}

export default StakingPanel;
