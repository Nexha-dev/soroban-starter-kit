# Implementation Plan: Token Management Dashboard

## Overview

Implement the `TokenManagementDashboard` feature incrementally in TypeScript/React, building from data models and utilities up through hooks, components, and integration. Each task builds on the previous, ending with full wiring into the existing app shell.

## Tasks

- [x] 1. Define new data models and utility functions
  - Create `src/types/tokenManagement.ts` with `TokenMetadata`, `Allowance`, `StakingState`, and `TokenConfig` interfaces
  - Create `src/utils/tokenValidation.ts` with `isValidStellarAddress`, `validateTransferAmount`, and `validateStakingAmount` functions
  - Create `src/utils/analyticsCompute.ts` with `computeTotalFiat`, `computePnL`, `computeDiversificationScore`, and `filterByTimeRange` functions
  - Create `src/utils/exportCSV.ts` (or extend existing helper) with typed export functions for transactions and analytics
  - _Requirements: 1.2, 4.2, 4.3, 4.5, 6.2, 6.4, 6.5, 6.6, 7.2, 7.3_

  - [ ]* 1.1 Write property tests for `isValidStellarAddress`
    - **Property 10: Stellar address validator accepts exactly the correct format**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 1.2 Write property tests for `validateTransferAmount`
    - **Property 11: Insufficient-balance check rejects amount + fee > available balance**
    - **Validates: Requirements 4.3**

  - [ ]* 1.3 Write property tests for `validateStakingAmount`
    - **Property 12: Staking amount validator rejects out-of-range amounts**
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 1.4 Write property tests for `computeTotalFiat`
    - **Property 1: Portfolio fiat total is the sum of individual token fiat values**
    - **Validates: Requirements 1.2**

  - [ ]* 1.5 Write property tests for `computePnL`
    - **Property 13: P&L per token equals (current − previous) × fiatRate**
    - **Validates: Requirements 6.2**

  - [ ]* 1.6 Write property tests for `computeDiversificationScore`
    - **Property 14: Diversification score is in [0, 100] and reflects HHI**
    - **Validates: Requirements 6.4**

  - [ ]* 1.7 Write property tests for `filterByTimeRange`
    - **Property 15: Analytics time-range filter excludes out-of-range transactions**
    - **Validates: Requirements 6.5**

- [x] 2. Implement `useBalancePoller` hook
  - Create `src/hooks/useBalancePoller.ts`
  - Implement `useInterval` helper that pauses when `document.hidden` is true
  - Call Soroban RPC `getLedgerEntries` for each contract ID, compare with stored balance, call `onBalanceChange` on diff, call `StorageContext.saveBalance`
  - Track `lastUpdated` timestamp and `error` state; catch RPC errors and log without crashing
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [ ]* 2.1 Write property tests for poller interval behaviour
    - **Property 3: Poller calls refresh at the configured interval when tab is visible**
    - **Validates: Requirements 5.1**

  - [ ]* 2.2 Write property test for poller pause when tab hidden
    - **Property 4: Poller does not call refresh when tab is hidden**
    - **Validates: Requirements 5.2**

  - [ ]* 2.3 Write property test for balance change detection
    - **Property 5: Balance change detection triggers onBalanceChange callback**
    - **Validates: Requirements 5.3**

  - [ ]* 2.4 Write property test for lastUpdated advancement
    - **Property 17: lastUpdated timestamp advances after each successful poll**
    - **Validates: Requirements 5.6**

- [x] 3. Implement `useToastNotifications` hook
  - Create `src/hooks/useToastNotifications.ts`
  - Watch `transactions` array for status transitions to `synced` or `failed` using a ref to track previous statuses
  - Call `notificationManager.createNotification(...)` exactly once per transition
  - _Requirements: 5.4_

  - [ ]* 3.1 Write property test for toast on status transition
    - **Property 6: Transaction status transition to synced or failed fires a toast**
    - **Validates: Requirements 5.4**

- [x] 4. Implement `useTokenMetadata` and `useAllowances` hooks
  - Create `src/hooks/useTokenMetadata.ts` — fetches `TokenMetadata` from RPC, exposes `{ metadata, loading, error, retry }`
  - Create `src/hooks/useAllowances.ts` — fetches active `Allowance[]` for the connected wallet from RPC, exposes `{ allowances, loading, error }`
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 5. Checkpoint — Ensure all hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement transaction filter, sort, and CSV export utilities
  - Create `src/utils/transactionFilters.ts` with `filterTransactions(txs, { search, types, statuses })` and `sortTransactions(txs, { field, direction })` functions
  - Debounce search filtering to 200 ms
  - Extend `exportCSV` to handle transaction list export (id, type, status, contractId, method columns)
  - _Requirements: 3.2, 3.3, 3.4, 3.6_

  - [ ]* 6.1 Write property tests for transaction filter
    - **Property 7: Transaction filter returns only matching transactions**
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 6.2 Write property tests for transaction sort
    - **Property 8: Transaction sort produces a correctly ordered list**
    - **Validates: Requirements 3.4**

  - [ ]* 6.3 Write property test for CSV export round-trip
    - **Property 9: CSV export round-trip preserves transaction data**
    - **Validates: Requirements 3.6**

  - [ ]* 6.4 Write property test for analytics CSV export columns
    - **Property 18: Analytics CSV export contains required columns for all balances**
    - **Validates: Requirements 6.6**

- [x] 7. Implement `TokenSidebar` component
  - Create `src/components/TokenManagementDashboard/TokenSidebar.tsx`
  - Render list of `Balance` records showing symbol, display amount, and fiat value
  - Highlight selected token; emit `onSelect(contractId)` on click
  - Render empty-state prompt when `balances` is empty
  - _Requirements: 1.1, 1.3_

  - [ ]* 7.1 Write property test for portfolio summary completeness
    - **Property 2: Portfolio summary contains every token's symbol and balance**
    - **Validates: Requirements 1.1**

- [x] 8. Implement `TokenDetailPanel` component
  - Create `src/components/TokenManagementDashboard/TokenDetailPanel.tsx`
  - Use `useTokenMetadata` to display name, symbol, decimals, total supply, contract ID
  - Use `useAllowances` to list active allowances (spender, amount)
  - Render error message + retry button when metadata fetch fails
  - Render copy-to-clipboard button for contract ID
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 9. Implement `ApproveForm` component
  - Create `src/components/TokenManagementDashboard/ApproveForm.tsx`
  - Form fields: spender address, allowance amount
  - Validate spender with `isValidStellarAddress` on blur; validate amount is positive
  - Call `createTransaction('approve', ...)` from `TransactionQueueContext`; display inline error on failure; call `onSuccess(txId)` on success
  - _Requirements: 4.4, 4.5, 4.6_

- [x] 10. Implement `StakingPanel` component
  - Create `src/components/TokenManagementDashboard/StakingPanel.tsx`
  - Fetch `StakingState` from staking contract via RPC; display staked balance, estimated rewards, lock-up period
  - Stake form: validate amount > 0 and ≤ available balance using `validateStakingAmount`
  - Unstake form: validate amount > 0 and ≤ staked balance using `validateStakingAmount`
  - Display confirmation message with queued transaction ID on success
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 11. Checkpoint — Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement `AnalyticsPanel` component
  - Create `src/components/TokenManagementDashboard/AnalyticsPanel.tsx`
  - Render portfolio value sparkline (last 7 data points from `Balance.previousAmount`)
  - Render P&L summary per token using `computePnL`
  - Render transaction activity bar chart (transactions per day, last 7 days) using inline SVG
  - Render diversification score using `computeDiversificationScore`
  - Time-range selector (7d / 30d / all) that calls `filterByTimeRange`
  - Export analytics CSV button
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 13. Implement `TokenManagementDashboard` root component
  - Create `src/components/TokenManagementDashboard/index.tsx`
  - Master-detail layout: `TokenSidebar` on the left, tab bar + panel on the right
  - Tabs: Overview (`PortfolioDashboard`), History (`TransactionHistory` scoped to selected token), Operations (`TokenTransferWizard` + `ApproveForm`), Analytics (`AnalyticsPanel`), Staking (`StakingPanel` — hidden when no staking contract configured)
  - Wire `useBalancePoller` with `onBalanceChange` triggering a notification and updating the "Last updated" timestamp display
  - Wire `useToastNotifications` with transactions from `TransactionQueueContext`
  - Accept `rpcUrl` and `pollIntervalMs` props with documented defaults
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 4.1, 5.1–5.6, 7.4_

  - [ ]* 13.1 Write property test for transaction history scoping
    - **Property 16: Transaction history is scoped to the selected token's contract ID**
    - **Validates: Requirements 3.1**

- [x] 14. Write unit tests for `TokenManagementDashboard`
  - Create `src/tests/components/TokenManagementDashboard.test.tsx`
  - Test: renders without crashing with empty storage
  - Test: empty-state message when `balances` is `[]`
  - Test: `TokenDetailPanel` shows error + retry button when RPC throws
  - Test: copy-to-clipboard button present for any contract ID
  - Test: "No results" message when all filters exclude all transactions
  - Test: `ApproveForm` shows queue error when `createTransaction` rejects
  - Test: poller logs error and continues when RPC unreachable
  - Test: `StakingPanel` hidden when no staking contract configured
  - Test: staking confirmation message contains queued transaction ID
  - Test: `StakingPanel` rendered with correct data when staking contract configured
  - _Requirements: 1.3, 2.4, 2.5, 3.5, 4.6, 5.5, 7.1, 7.4, 7.5_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already a dev dependency) with a minimum of 100 iterations each
- Each property test file should include the comment `// Feature: token-management-dashboard, Property N: <property_text>`
- Checkpoints ensure incremental validation before moving to the next phase
