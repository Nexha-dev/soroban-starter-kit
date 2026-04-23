# Security Considerations

> Closes #226 – no security considerations document.

This document describes the trust model, known limitations, and threat model for
the Token and Escrow contracts in this repository.

---

## 1. Trust Model

### Token Contract

| Actor | Trusted for |
|-------|-------------|
| Admin | Minting new tokens, burning tokens, transferring admin role |
| Token holder | Approving allowances, transferring their own balance |
| Spender | Spending up to the approved allowance on behalf of a holder |

The admin key is the single most sensitive credential.  Compromise of the admin
key allows unlimited minting and therefore complete devaluation of the token.

### Escrow Contract

| Actor | Trusted for |
|-------|-------------|
| Buyer | Funding the escrow, approving delivery, requesting a refund after deadline, partial releases, cancelling before funding |
| Seller | Marking goods/services as delivered |
| Arbiter | Resolving disputes by releasing funds to either party |

No single actor can unilaterally move funds without the contract enforcing the
correct state machine transition.

---

## 2. Admin Key Management

- **Token admin** – Use a hardware wallet or multi-sig account.  Rotate the key
  via `set_admin` before the old key is considered compromised.  There is no
  time-lock on `set_admin`; consider wrapping the contract with a governance
  layer for production deployments.
- **Escrow arbiter** – The arbiter address is set at initialization and cannot
  be changed.  Choose an arbiter that is independent of both buyer and seller.
  A multi-sig arbiter is strongly recommended for high-value escrows.

---

## 3. Reentrancy

Soroban contracts execute in a single-threaded, deterministic VM.  Cross-contract
calls are synchronous and the host does not allow re-entrant invocations of the
same contract instance within a single transaction.  However, the following
pattern is still followed as a best practice:

> **Checks → Effects → Interactions**

State is updated *before* any outbound token transfer in `release_to_seller`,
`refund_to_buyer`, and `release_partial`.  This means that even if the token
contract were replaced with a malicious implementation that called back into the
escrow, the escrow state would already reflect the completed transition and the
re-entrant call would be rejected with `InvalidState`.

---

## 4. Storage Expiry Risks

Soroban uses a rent model: storage entries expire if their TTL (time-to-live)
reaches zero.

- **Instance storage** – Both contracts bump instance TTL on every write
  (`BUMP_THRESHOLD = 120 960 ledgers ≈ 7 days`, `BUMP_AMOUNT = 518 400 ≈ 30 days`).
- **Persistent storage** – Token balance and allowance entries are bumped on
  every read/write.
- **Temporary storage** – Allowance entries use temporary storage keyed by
  `expiration_ledger`.  Once the ledger advances past `expiration_ledger` the
  entry is treated as zero.

**Risk**: If an escrow is created and then ignored for more than ~30 days without
any interaction, the instance storage may expire.  The public `bump()` function
can be called by anyone to extend the TTL without changing state.  Integrators
should monitor active escrows and call `bump()` proactively.

---

## 5. Arbiter Trust Model

The arbiter is a privileged third party with the ability to unilaterally move
funds.  Key considerations:

- The arbiter can call `resolve_dispute` at any time while the escrow is in
  `Funded` or `Delivered` state, without waiting for a formal dispute to be
  raised.
- There is no on-chain mechanism to remove or replace a compromised arbiter.
- A malicious arbiter colluding with either party can steal funds.

**Mitigations**:
- Use a well-known, reputable arbiter service or a multi-sig arbiter.
- For trustless deployments, replace the arbiter with an on-chain oracle or a
  DAO governance vote.
- Consider adding a dispute-initiation step so the arbiter can only act after
  one party explicitly raises a dispute.

---

## 6. Known Limitations

| Limitation | Impact | Suggested Mitigation |
|------------|--------|----------------------|
| No arbiter replacement | Compromised arbiter cannot be removed | Deploy a new escrow; add governance layer |
| No time-lock on admin transfer | Admin key rotation is instant | Wrap with a time-locked proxy |
| Single-token escrow | Only one token type per escrow | Deploy multiple escrows for multi-token deals |
| No partial refund | Refund returns the full remaining amount | Use `release_partial` before deadline for partial settlements |
| Deadline is ledger-sequence based | Ledger close times vary (~5 s average) | Add a generous buffer when setting deadlines |
| No dispute initiation step | Arbiter can act without buyer/seller consent | Add an explicit `raise_dispute` state transition |

---

## 7. Threat Model Summary

| Threat | Likelihood | Impact | Mitigated by |
|--------|-----------|--------|--------------|
| Admin key compromise (token) | Low | Critical | Hardware wallet, multi-sig |
| Arbiter collusion | Medium | High | Reputable arbiter, multi-sig |
| Storage expiry of live escrow | Low | High | `bump()` monitoring |
| Buyer/seller front-running | Low | Medium | Soroban auth model (require_auth) |
| Integer overflow | Very Low | High | `checked_add`/`checked_sub` throughout |
| Reentrancy | Very Low | High | CEI pattern enforced |

---

## 8. Reporting Vulnerabilities

Please do **not** open a public GitHub issue for security vulnerabilities.
Instead, email the maintainers directly (see `Cargo.toml` authors field) with a
description of the issue and steps to reproduce.  We aim to respond within 48 hours.
