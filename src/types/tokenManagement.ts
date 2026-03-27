/**
 * New data models for the Token Management Dashboard.
 * These types are fetched from Soroban RPC and are not persisted locally,
 * except for TokenConfig which is stored in localStorage.
 */

/** Fetched from Soroban RPC, not persisted */
export interface TokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Total supply in stroops */
  totalSupply: string;
}

/** Fetched from Soroban RPC, not persisted */
export interface Allowance {
  owner: string;
  spender: string;
  /** Approved amount in stroops */
  amount: string;
  expirationLedger: number;
}

/** Staking state fetched from staking contract, not persisted */
export interface StakingState {
  /** Staked amount in stroops */
  stakedAmount: string;
  estimatedRewards: string;
  /** Lock-up end time as unix milliseconds */
  lockupEndsAt: number;
}

/**
 * Token configuration stored in localStorage under key `tmd_token_configs`
 * as a JSON array of TokenConfig objects, keyed by contractId.
 */
export interface TokenConfig {
  contractId: string;
  stakingContractAddress?: string;
}
