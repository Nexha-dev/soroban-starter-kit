# Integration Guide

Step-by-step instructions for integrating Soroban contracts into your application.

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| Rust | 1.78+ | https://rustup.rs |
| Stellar CLI | latest | `cargo install --locked stellar-cli --features opt` |
| Freighter Wallet | latest | https://freighter.app |

---

## 2. Install the SDK

```bash
npm install @stellar/stellar-sdk
```

---

## 3. Connect to a Network

```ts
import { SorobanRpc, Networks } from '@stellar/stellar-sdk';

// Testnet
const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = Networks.TESTNET;

// Mainnet
// const server = new SorobanRpc.Server('https://soroban.stellar.org');
// const networkPassphrase = Networks.PUBLIC;
```

---

## 4. Load a Deployed Contract

```ts
import { Contract } from '@stellar/stellar-sdk';

const contract = new Contract('<CONTRACT_ID>');
```

Replace `<CONTRACT_ID>` with the address returned by `./scripts/deploy.sh`.

---

## 5. Invoke a Contract Function

```ts
import { TransactionBuilder, BASE_FEE, Keypair, xdr } from '@stellar/stellar-sdk';

const sourceKeypair = Keypair.fromSecret('<SECRET_KEY>');
const account = await server.getAccount(sourceKeypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase,
})
  .addOperation(contract.call('balance', xdr.ScVal.scvAddress(/* address */)))
  .setTimeout(30)
  .build();

const prepared = await server.prepareTransaction(tx);
prepared.sign(sourceKeypair);

const result = await server.sendTransaction(prepared);
```

---

## 6. Token Contract Integration

### Initialize

```ts
contract.call('initialize',
  adminAddress,   // xdr.ScVal address
  nameScVal,      // xdr.ScVal string
  symbolScVal,    // xdr.ScVal string
  decimalsScVal,  // xdr.ScVal u32
)
```

### Mint / Transfer / Burn

```ts
contract.call('mint', toAddress, amountScVal);
contract.call('transfer', fromAddress, toAddress, amountScVal);
contract.call('burn', fromAddress, amountScVal);
```

---

## 7. Escrow Contract Integration

```ts
// Create escrow
contract.call('create', buyerAddress, sellerAddress, tokenAddress, amountScVal, deadlineScVal);

// Release funds (seller)
contract.call('release', escrowIdScVal);

// Refund after deadline (buyer)
contract.call('refund', escrowIdScVal);
```

---

## 8. React / Frontend Integration

```tsx
import { WalletContext } from './context/WalletContext';
import { ContractInteraction } from './components/ContractInteraction';

function App() {
  return (
    <WalletContext>
      <ContractInteraction contractId="<CONTRACT_ID>" />
    </WalletContext>
  );
}
```

See `src/components/ContractInteractionUI.tsx` for a full working example.

---

## 9. Validation Checklist

- [ ] Contract ID is correct for the target network
- [ ] Network passphrase matches the RPC endpoint
- [ ] Source account has sufficient XLM for fees
- [ ] `wasm32-unknown-unknown` Rust target is installed
- [ ] Freighter is set to the matching network
- [ ] `.env` variables are set (see [dev-environment.md](dev-environment.md))

---

## 10. Troubleshooting

| Problem | Solution |
|---------|----------|
| `Transaction simulation failed` | Check contract ID and network passphrase match |
| `Account not found` | Fund the account via [Stellar Friendbot](https://friendbot.stellar.org) (testnet only) |
| `Insufficient fee` | Increase `BASE_FEE` or use `server.getFeeStats()` |
| `Contract not found` | Re-deploy with `./scripts/deploy.sh testnet` |
| Freighter not responding | Refresh page; ensure extension is unlocked |

---

## Security Considerations

- Never expose secret keys in frontend code — use Freighter or Albedo for signing
- Validate all user inputs before constructing `xdr.ScVal` arguments
- Use `server.simulateTransaction()` before submitting to catch errors cheaply
- Restrict admin operations to known addresses in contract initialization
- Rotate admin keys using the contract's `set_admin` function after deployment

---

## Performance Tips

- Cache `getAccount()` results; re-fetch only on sequence number errors
- Batch read-only calls using `simulateTransaction` (no fee)
- Use `SorobanRpc.Server` with connection pooling for high-throughput apps
- Store contract IDs in environment variables, not hardcoded strings

---

## Resources

- [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Laboratory](https://laboratory.stellar.org/)
- [Freighter Wallet](https://freighter.app/)
