/**
 * State Validator
 * Validates state integrity and provides recovery mechanisms
 */

import { NormalizedState } from './stateManager';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  timestamp: number;
}

export interface ValidationError {
  type: 'missing_metadata' | 'orphaned_item' | 'invalid_data' | 'type_mismatch';
  message: string;
  itemId?: string;
  itemType?: string;
}

class StateValidator {
  private validationHistory: ValidationResult[] = [];
  private maxHistorySize = 20;

  /**
   * Validate entire state
   */
  validate(state: NormalizedState): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validate balances
    this.validateBalances(state, errors, warnings);

    // Validate escrows
    this.validateEscrows(state, errors, warnings);

    // Validate transactions
    this.validateTransactions(state, errors, warnings);

    // Validate metadata consistency
    this.validateMetadata(state, errors, warnings);

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      timestamp: Date.now(),
    };

    this.recordValidation(result);
    return result;
  }

  /**
   * Validate balances
   */
  private validateBalances(
    state: NormalizedState,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    Object.entries(state.balances).forEach(([id, balance]) => {
      if (!balance.id) {
        errors.push({
          type: 'invalid_data',
          message: `Balance ${id} missing id field`,
          itemId: id,
          itemType: 'balance',
        });
      }

      if (!state.metadata.balanceIds.includes(id)) {
        errors.push({
          type: 'missing_metadata',
          message: `Balance ${id} not in metadata`,
          itemId: id,
          itemType: 'balance',
        });
      }

      if (balance.amount && isNaN(Number(balance.amount))) {
        errors.push({
          type: 'type_mismatch',
          message: `Balance ${id} has invalid amount: ${balance.amount}`,
          itemId: id,
          itemType: 'balance',
        });
      }
    });
  }

  /**
   * Validate escrows
   */
  private validateEscrows(
    state: NormalizedState,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    Object.entries(state.escrows).forEach(([id, escrow]) => {
      if (!escrow.id) {
        errors.push({
          type: 'invalid_data',
          message: `Escrow ${id} missing id field`,
          itemId: id,
          itemType: 'escrow',
        });
      }

      if (!state.metadata.escrowIds.includes(id)) {
        errors.push({
          type: 'missing_metadata',
          message: `Escrow ${id} not in metadata`,
          itemId: id,
          itemType: 'escrow',
        });
      }

      if (!['initialized', 'funded', 'delivered', 'completed', 'cancelled', 'refunded'].includes(escrow.status)) {
        warnings.push(`Escrow ${id} has unknown status: ${escrow.status}`);
      }
    });
  }

  /**
   * Validate transactions
   */
  private validateTransactions(
    state: NormalizedState,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    Object.entries(state.transactions).forEach(([id, tx]) => {
      if (!tx.id) {
        errors.push({
          type: 'invalid_data',
          message: `Transaction ${id} missing id field`,
          itemId: id,
          itemType: 'transaction',
        });
      }

      if (!state.metadata.transactionIds.includes(id)) {
        errors.push({
          type: 'missing_metadata',
          message: `Transaction ${id} not in metadata`,
          itemId: id,
          itemType: 'transaction',
        });
      }

      if (!['pending', 'syncing', 'synced', 'failed', 'conflict'].includes(tx.status)) {
        warnings.push(`Transaction ${id} has unknown status: ${tx.status}`);
      }
    });
  }

  /**
   * Validate metadata consistency
   */
  private validateMetadata(
    state: NormalizedState,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    // Check for orphaned metadata references
    state.metadata.balanceIds.forEach(id => {
      if (!(id in state.balances)) {
        errors.push({
          type: 'orphaned_item',
          message: `Metadata references non-existent balance ${id}`,
          itemId: id,
          itemType: 'balance',
        });
      }
    });

    state.metadata.escrowIds.forEach(id => {
      if (!(id in state.escrows)) {
        errors.push({
          type: 'orphaned_item',
          message: `Metadata references non-existent escrow ${id}`,
          itemId: id,
          itemType: 'escrow',
        });
      }
    });

    state.metadata.transactionIds.forEach(id => {
      if (!(id in state.transactions)) {
        errors.push({
          type: 'orphaned_item',
          message: `Metadata references non-existent transaction ${id}`,
          itemId: id,
          itemType: 'transaction',
        });
      }
    });
  }

  /**
   * Repair state by removing orphaned references
   */
  repair(state: NormalizedState): NormalizedState {
    const repaired = JSON.parse(JSON.stringify(state));

    repaired.metadata.balanceIds = repaired.metadata.balanceIds.filter(
      (id: string) => id in repaired.balances
    );
    repaired.metadata.escrowIds = repaired.metadata.escrowIds.filter(
      (id: string) => id in repaired.escrows
    );
    repaired.metadata.transactionIds = repaired.metadata.transactionIds.filter(
      (id: string) => id in repaired.transactions
    );

    return repaired;
  }

  /**
   * Get validation history
   */
  getHistory(): ValidationResult[] {
    return [...this.validationHistory];
  }

  /**
   * Record validation result
   */
  private recordValidation(result: ValidationResult): void {
    this.validationHistory.push(result);
    if (this.validationHistory.length > this.maxHistorySize) {
      this.validationHistory.shift();
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.validationHistory = [];
  }
}

export const stateValidator = new StateValidator();
export default stateValidator;
