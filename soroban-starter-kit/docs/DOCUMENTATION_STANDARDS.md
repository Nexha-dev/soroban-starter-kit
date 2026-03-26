# Documentation Standards

This guide defines documentation requirements for all code in this repository.

---

## TypeScript / React (Frontend)

### Functions & Hooks
Every exported function, hook, and component **must** have a JSDoc block with:
- `@description` (or leading summary line)
- `@param` for each parameter
- `@returns` describing the return value
- `@example` showing basic usage

```ts
/**
 * Fetches the token balance for a given address.
 *
 * @param address - The Stellar account address.
 * @param contractId - The token contract ID.
 * @returns The balance as a bigint, or 0n if not found.
 *
 * @example
 * const balance = await getTokenBalance('G...', 'C...');
 */
export async function getTokenBalance(address: string, contractId: string): Promise<bigint> { ... }
```

### React Components
```tsx
/**
 * Displays the current token balance for the connected wallet.
 *
 * @param props.contractId - The token contract to query.
 * @param props.decimals - Number of decimal places for display.
 */
export function BalanceDisplay({ contractId, decimals }: BalanceDisplayProps) { ... }
```

### Types & Interfaces
```ts
/**
 * Configuration for a Soroban contract interaction.
 */
export interface ContractConfig {
  /** The contract's on-chain ID. */
  contractId: string;
  /** Network passphrase (testnet or mainnet). */
  networkPassphrase: string;
}
```

---

## Rust / Soroban Contracts

Every `pub fn` in a `#[contractimpl]` block **must** have a doc comment covering:
- What the function does
- Parameters (inline or `# Arguments` section)
- Errors it can return
- Any authorization requirements

```rust
/// Initializes the token with metadata and designates an admin.
///
/// # Arguments
/// * `admin`    - Address that will control minting and burning.
/// * `name`     - Human-readable token name.
/// * `symbol`   - Short ticker symbol (e.g. "XLM").
/// * `decimals` - Number of decimal places.
///
/// # Errors
/// Returns [`TokenError::AlreadyInitialized`] if called more than once.
///
/// # Authorization
/// Requires auth from `admin`.
pub fn initialize(env: Env, admin: Address, name: String, symbol: String, decimals: u32) -> Result<(), TokenError> { ... }
```

Public structs, enums, and their variants must also carry doc comments.

---

## Coverage Targets

| Layer | Minimum coverage |
|-------|-----------------|
| Rust contract public fns | 100 % |
| TypeScript exported symbols | 80 % |
| React components | 80 % |

Run `npm run docs:check` to validate coverage locally.

---

## Review Checklist

Before approving a PR, reviewers verify:

- [ ] All new exported symbols have JSDoc / Rust doc comments
- [ ] `@param` / `@returns` present for every function
- [ ] `@example` present for public utilities and hooks
- [ ] Rust `pub fn` in `#[contractimpl]` has `# Errors` and `# Authorization` sections
- [ ] `npm run docs:check` passes with no errors
- [ ] No `TODO` or `FIXME` left in doc comments
