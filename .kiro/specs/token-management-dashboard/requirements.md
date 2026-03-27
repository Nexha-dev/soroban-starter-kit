# Requirements Document

## Introduction

The Token Management Dashboard is a comprehensive frontend feature for the Soroban Starter Kit that consolidates token portfolio management, transaction history, token operations, and analytics into a unified dashboard experience. It builds on the existing `PortfolioDashboard`, `TransactionHistory`, and `TokenTransferWizard` components by introducing a dedicated dashboard shell, token detail views, allowance management, staking interfaces, real-time balance polling, transaction notifications, and portfolio performance tracking — all scoped to the Soroban (Stellar) blockchain context.

## Glossary

- **Dashboard**: The top-level `TokenManagementDashboard` React component that composes all sub-panels.
- **Token**: A Soroban-compatible fungible token identified by a contract ID on the Stellar network.
- **Balance**: A cached record of a wallet address's token holdings, stored in IndexedDB via the `StorageContext`.
- **Allowance**: An on-chain approval granting a spender the right to transfer up to a specified amount of tokens on behalf of the owner.
- **Portfolio**: The aggregate view of all token balances held by the connected wallet.
- **Transaction**: A `CachedTransaction` record representing a queued or completed on-chain operation.
- **Poller**: The `BalancePoller` service responsible for periodically refreshing token balances from the Soroban RPC.
- **Notification**: An in-app alert surfaced via the existing `NotificationCenter` component when a balance changes or a transaction status changes.
- **Staking**: A token operation that locks tokens in a staking contract for a defined period in exchange for rewards.
- **Analytics**: Computed metrics and visualisations derived from balance history and transaction data.
- **Stroops**: The smallest unit of a Stellar token (1 token = 10,000,000 stroops).
- **Freighter**: The Stellar browser wallet extension used for signing transactions, accessed via `@stellar/freighter-api`.

## Requirements

### Requirement 1: Portfolio Overview

**User Story:** As a wallet holder, I want a portfolio overview panel showing all my token balances and their aggregate value, so that I can quickly assess my holdings at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display a portfolio summary card listing each token's symbol, balance (in display units), and fiat equivalent when a fiat rate is available.
2. THE Dashboard SHALL display the total portfolio value in the user-selected fiat currency (USD, EUR, or GBP).
3. WHEN the connected wallet holds zero tokens, THE Dashboard SHALL display an empty-state message prompting the user to add a token contract.
4. THE Dashboard SHALL display a token allocation donut chart derived from the existing `PortfolioDashboard` `DonutChart` sub-component.
5. WHEN a token balance changes, THE Dashboard SHALL update the portfolio summary within 30 seconds without requiring a full page reload.

---

### Requirement 2: Token Detail View

**User Story:** As a developer or token holder, I want to view detailed metadata and on-chain information for a specific token, so that I can verify contract details and understand token properties.

#### Acceptance Criteria

1. WHEN the user selects a token from the portfolio list, THE Dashboard SHALL display a token detail panel showing the token's name, symbol, decimals, total supply, and contract ID.
2. THE Dashboard SHALL display the selected token's current balance for the connected wallet address.
3. WHEN the token contract exposes an allowance function, THE Dashboard SHALL display all active allowances for the connected wallet, including spender address and approved amount.
4. IF the Soroban RPC returns an error when fetching token metadata, THEN THE Dashboard SHALL display a descriptive error message and a retry button.
5. THE Dashboard SHALL provide a copy-to-clipboard control for the token contract ID.

---

### Requirement 3: Transaction History with Filtering and Search

**User Story:** As a user, I want to browse, filter, and search my transaction history for a specific token, so that I can audit past operations and track the status of pending transactions.

#### Acceptance Criteria

1. THE Dashboard SHALL render the existing `TransactionHistory` component scoped to the currently selected token's contract ID.
2. WHEN the user enters a search term, THE Dashboard SHALL filter the transaction list to entries whose ID, method, or error field contains the search term (case-insensitive) within 200ms of the last keystroke.
3. THE Dashboard SHALL support filtering transactions by type (`transfer`, `mint`, `burn`, `approve`) and by status (`pending`, `syncing`, `synced`, `failed`).
4. THE Dashboard SHALL support sorting transactions by date, type, and status in ascending or descending order.
5. WHEN no transactions match the active filters, THE Dashboard SHALL display a "No results" message.
6. THE Dashboard SHALL allow the user to export the filtered transaction list as a CSV file.

---

### Requirement 4: Token Operations — Transfer and Approve

**User Story:** As a token holder, I want to initiate token transfers and set spending allowances from the dashboard, so that I can manage my tokens without leaving the application.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a transfer interface using the existing `TokenTransferWizard` component, pre-populated with the selected token's contract ID.
2. WHEN the user submits a transfer, THE Dashboard SHALL validate that the recipient address matches the Stellar address format (`G` followed by 55 base-32 characters) before queuing the transaction.
3. WHEN the user submits a transfer with an amount exceeding the available balance minus the estimated network fee, THE Dashboard SHALL display an insufficient-balance error and prevent submission.
4. THE Dashboard SHALL provide an approve interface allowing the user to specify a spender address and an allowance amount for the selected token.
5. WHEN the user submits an approval, THE Dashboard SHALL validate that the spender address is a valid Stellar address and that the amount is a positive number before queuing the transaction.
6. IF a transaction fails to queue, THEN THE Dashboard SHALL display the error message returned by the `TransactionQueueContext` and allow the user to retry.

---

### Requirement 5: Real-Time Balance and Status Updates

**User Story:** As a user, I want my token balances and transaction statuses to update automatically, so that I always see current information without manually refreshing.

#### Acceptance Criteria

1. THE Poller SHALL refresh all cached token balances at a configurable interval, with a default of 30 seconds, while the Dashboard is mounted and the browser tab is visible.
2. WHILE the browser tab is hidden (document visibility = hidden), THE Poller SHALL pause balance refresh requests to avoid unnecessary network usage.
3. WHEN a balance value changes between two consecutive polls, THE Dashboard SHALL update the displayed balance and trigger a notification via the `NotificationCenter`.
4. WHEN a `CachedTransaction` status transitions to `synced` or `failed`, THE Dashboard SHALL display a toast notification with the transaction type and final status.
5. IF the Soroban RPC is unreachable during a poll, THEN THE Poller SHALL log the error and retry at the next scheduled interval without crashing the Dashboard.
6. THE Dashboard SHALL display a "Last updated" timestamp indicating when balances were most recently refreshed.

---

### Requirement 6: Analytics and Performance Visualisation

**User Story:** As a portfolio holder, I want to see analytics charts and performance metrics for my token holdings, so that I can track portfolio growth and transaction activity over time.

#### Acceptance Criteria

1. THE Dashboard SHALL display a portfolio value sparkline chart showing the estimated portfolio value trend over the last 7 data points, derived from balance history stored in the `Balance.previousAmount` field.
2. THE Dashboard SHALL display a P&L (profit and loss) summary per token, calculated as `(currentAmount − previousAmount) × fiatRate`.
3. THE Dashboard SHALL display a transaction activity bar chart showing the number of transactions per day for the last 7 days.
4. THE Dashboard SHALL display a diversification score (0–100) computed using the Herfindahl–Hirschman Index across token balances.
5. WHEN the user selects a time range (7 days, 30 days, or all time), THE Dashboard SHALL filter the analytics data to the selected range.
6. THE Dashboard SHALL allow the user to export portfolio analytics data as a CSV file containing symbol, balance, fiat value, and percentage change columns.

---

### Requirement 7: Staking Interface

**User Story:** As a token holder, I want to stake tokens through the dashboard, so that I can participate in staking rewards without using a separate tool.

#### Acceptance Criteria

1. WHERE a staking contract address is configured for a token, THE Dashboard SHALL display a staking panel showing the user's staked balance, estimated rewards, and lock-up period.
2. WHEN the user submits a stake operation, THE Dashboard SHALL validate that the stake amount is greater than zero and does not exceed the available (unstaked) balance before queuing the transaction.
3. WHEN the user submits an unstake operation, THE Dashboard SHALL validate that the unstake amount does not exceed the currently staked balance before queuing the transaction.
4. IF the staking contract address is not configured for the selected token, THEN THE Dashboard SHALL hide the staking panel and display no staking-related controls.
5. WHEN a stake or unstake transaction is queued successfully, THE Dashboard SHALL display a confirmation message with the queued transaction ID.
