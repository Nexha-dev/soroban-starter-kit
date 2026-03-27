/**
 * Validation utilities for token operations in the Token Management Dashboard.
 * Requirements: 4.2, 4.3, 4.5, 7.2, 7.3
 */

/**
 * Estimated network fee in stroops for a Soroban transaction.
 * Used in transfer amount validation.
 */
export const ESTIMATED_FEE_STROOPS = 100_000; // 0.01 XLM in stroops

/**
 * Returns true if and only if the string is a valid Stellar address:
 * starts with 'G' followed by exactly 55 base-32 characters [A-Z2-7].
 *
 * Validates: Requirements 4.2, 4.5
 */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Validates a transfer amount against the available balance and estimated fee.
 * Returns an error message string if invalid, or null if valid.
 *
 * @param amount - Transfer amount in stroops
 * @param availableBalance - Available balance in stroops
 * @param estimatedFee - Estimated fee in stroops (defaults to ESTIMATED_FEE_STROOPS)
 *
 * Validates: Requirement 4.3
 */
export function validateTransferAmount(
  amount: number,
  availableBalance: number,
  estimatedFee: number = ESTIMATED_FEE_STROOPS
): string | null {
  if (amount + estimatedFee > availableBalance) {
    return 'Insufficient balance: amount plus estimated fee exceeds available balance.';
  }
  return null;
}

/**
 * Validates a stake or unstake amount against a ceiling value.
 * Returns an error message string if invalid, or null if valid.
 *
 * @param amount - Amount to stake or unstake in stroops
 * @param ceiling - Maximum allowed amount (available balance for stake, staked balance for unstake)
 *
 * Validates: Requirements 7.2, 7.3
 */
export function validateStakingAmount(amount: number, ceiling: number): string | null {
  if (amount <= 0) {
    return 'Amount must be greater than zero.';
  }
  if (amount > ceiling) {
    return 'Amount exceeds the available balance.';
  }
  return null;
}
