/**
 * Conflict Resolution Manager
 * Handles state conflicts and resolution strategies
 */

import { NormalizedState } from './stateManager';
import { CachedTransaction, ConflictData } from './storage/types';

export type ConflictResolutionStrategy = 'local' | 'server' | 'merged' | 'manual';

export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  resolvedState: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

class ConflictResolver {
  private resolutionHistory: Map<string, ConflictResolution> = new Map();
  private maxHistorySize = 50;

  /**
   * Detect conflicts between local and server state
   */
  detectConflict(localState: any, serverState: any): boolean {
    if (!localState || !serverState) return false;

    const localKeys = Object.keys(localState);
    const serverKeys = Object.keys(serverState);

    if (localKeys.length !== serverKeys.length) return true;

    return localKeys.some(key => {
      const localVal = JSON.stringify(localState[key]);
      const serverVal = JSON.stringify(serverState[key]);
      return localVal !== serverVal;
    });
  }

  /**
   * Resolve conflict using specified strategy
   */
  resolve(
    id: string,
    localState: any,
    serverState: any,
    strategy: ConflictResolutionStrategy = 'merged'
  ): ConflictResolution {
    let resolvedState: any;

    switch (strategy) {
      case 'local':
        resolvedState = localState;
        break;
      case 'server':
        resolvedState = serverState;
        break;
      case 'merged':
        resolvedState = this.mergeStates(localState, serverState);
        break;
      case 'manual':
        throw new Error('Manual resolution required');
      default:
        resolvedState = serverState;
    }

    const resolution: ConflictResolution = {
      strategy,
      resolvedState,
      timestamp: Date.now(),
    };

    this.recordResolution(id, resolution);
    return resolution;
  }

  /**
   * Merge local and server states intelligently
   */
  private mergeStates(localState: any, serverState: any): any {
    const merged = { ...serverState };

    Object.keys(localState).forEach(key => {
      const localVal = localState[key];
      const serverVal = serverState[key];

      if (typeof localVal === 'object' && typeof serverVal === 'object') {
        // Recursively merge objects
        merged[key] = this.mergeStates(localVal, serverVal);
      } else if (localVal && !serverVal) {
        // Keep local value if server doesn't have it
        merged[key] = localVal;
      } else if (serverVal && !localVal) {
        // Keep server value if local doesn't have it
        merged[key] = serverVal;
      } else if (localVal && serverVal) {
        // Prefer server value for conflicts
        merged[key] = serverVal;
      }
    });

    return merged;
  }

  /**
   * Record resolution for audit trail
   */
  private recordResolution(id: string, resolution: ConflictResolution): void {
    this.resolutionHistory.set(id, resolution);

    if (this.resolutionHistory.size > this.maxHistorySize) {
      const firstKey = this.resolutionHistory.keys().next().value;
      this.resolutionHistory.delete(firstKey);
    }
  }

  /**
   * Get resolution history
   */
  getResolutionHistory(): Map<string, ConflictResolution> {
    return new Map(this.resolutionHistory);
  }

  /**
   * Clear resolution history
   */
  clearHistory(): void {
    this.resolutionHistory.clear();
  }

  /**
   * Validate state consistency
   */
  validateState(state: NormalizedState): { valid: boolean; errors: Array<{ type: string; message: string }> } {
    const errors: Array<{ type: string; message: string }> = [];

    // Check metadata consistency
    const balanceIds = Object.keys(state.balances);
    const metaBalanceIds = state.metadata.balanceIds;

    balanceIds.forEach(id => {
      if (!metaBalanceIds.includes(id)) {
        errors.push({ type: 'missing_metadata', message: `Balance ${id} not in metadata` });
      }
    });

    metaBalanceIds.forEach(id => {
      if (!balanceIds.includes(id)) {
        errors.push({ type: 'orphaned_item', message: `Metadata references non-existent balance ${id}` });
      }
    });

    const escrowIds = Object.keys(state.escrows);
    const metaEscrowIds = state.metadata.escrowIds;

    escrowIds.forEach(id => {
      if (!metaEscrowIds.includes(id)) {
        errors.push({ type: 'missing_metadata', message: `Escrow ${id} not in metadata` });
      }
    });

    metaEscrowIds.forEach(id => {
      if (!escrowIds.includes(id)) {
        errors.push({ type: 'orphaned_item', message: `Metadata references non-existent escrow ${id}` });
      }
    });

    const txIds = Object.keys(state.transactions);
    const metaTxIds = state.metadata.transactionIds;

    txIds.forEach(id => {
      if (!metaTxIds.includes(id)) {
        errors.push({ type: 'missing_metadata', message: `Transaction ${id} not in metadata` });
      }
    });

    metaTxIds.forEach(id => {
      if (!txIds.includes(id)) {
        errors.push({ type: 'orphaned_item', message: `Metadata references non-existent transaction ${id}` });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recover state from conflicts
   */
  recoverState(state: NormalizedState): NormalizedState {
    const recovered = JSON.parse(JSON.stringify(state));

    // Remove orphaned metadata references
    recovered.metadata.balanceIds = recovered.metadata.balanceIds.filter(
      (id: string) => id in recovered.balances
    );
    recovered.metadata.escrowIds = recovered.metadata.escrowIds.filter(
      (id: string) => id in recovered.escrows
    );
    recovered.metadata.transactionIds = recovered.metadata.transactionIds.filter(
      (id: string) => id in recovered.transactions
    );

    return recovered;
  }
}

export const conflictResolver = new ConflictResolver();
export default conflictResolver;
