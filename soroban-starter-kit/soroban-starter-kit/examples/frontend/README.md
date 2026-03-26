# Soroban API Explorer

Interactive API documentation and testing interface for the Token and Escrow contracts.
Zero build step — open `index.html` directly or serve it locally.

## Prerequisites

- Node.js 16+
- [Freighter wallet](https://freighter.app/) browser extension
- Deployed Token and/or Escrow contract IDs (see `contracts/`)

## Quick Start

```bash
cd examples/frontend
npm install
npm run dev
# → http://localhost:3000
```

Or just open `index.html` directly in your browser — no build step required.

## Wallet Integration

This example uses [Freighter](https://freighter.app/) for wallet connectivity.

```typescript
import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';

// Check if Freighter is installed
const connected = await isConnected();

// Get the user's public key
const publicKey = await getPublicKey();
```

## Contract Interaction

### Setup

```typescript
import { SorobanRpc, TransactionBuilder, Networks, Contract, nativeToScVal } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = Networks.TESTNET;
```

### Calling a Contract Function

```typescript
async function callContract(contractId: string, method: string, params: xdr.ScVal[]) {
  const publicKey = await getPublicKey();
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  const signed = await signTransaction(prepared.toXDR(), { network: 'TESTNET' });

  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signed, networkPassphrase)
  );
  return result;
}
```

## Token Contract

```typescript
const TOKEN_CONTRACT_ID = '<YOUR_TOKEN_CONTRACT_ID>';

// Check balance
await callContract(TOKEN_CONTRACT_ID, 'balance', [
  nativeToScVal(publicKey, { type: 'address' }),
]);

// Transfer tokens
await callContract(TOKEN_CONTRACT_ID, 'transfer', [
  nativeToScVal(fromAddress, { type: 'address' }),
  nativeToScVal(toAddress, { type: 'address' }),
  nativeToScVal(amount, { type: 'i128' }),
]);
```

## Escrow Contract

```typescript
const ESCROW_CONTRACT_ID = '<YOUR_ESCROW_CONTRACT_ID>';

// Fund escrow (buyer)
await callContract(ESCROW_CONTRACT_ID, 'fund', []);

// Mark as delivered (seller)
await callContract(ESCROW_CONTRACT_ID, 'mark_delivered', []);

// Approve delivery and release funds (buyer)
await callContract(ESCROW_CONTRACT_ID, 'approve_delivery', []);
```

## Resources

- [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Docs](https://soroban.stellar.org/docs)
- [Freighter API](https://docs.freighter.app/)

## API Explorer Features

### Interactive Documentation
- All Token and Escrow contract methods listed in the sidebar
- Green dot = read-only (no auth), amber dot = write (requires signature)
- Click any method to see its description, parameters, return type, and possible errors

### Parameter Validation
- Real-time validation as you type
- Checks Stellar address format (G.../C... prefix, 56 chars)
- Validates i128/u32 ranges and bool values
- Required field enforcement

### Code Generation
Switch between TypeScript, JavaScript, Python, and cURL snippets that update live as you fill in parameters.

### Simulate vs Invoke
- **Simulate** — runs a read-only preflight via `simulateTransaction`. Works without a wallet.
- **Invoke** — assembles, signs via Freighter, and submits the transaction on-chain.

### Authentication Testing
Each write method shows which role must sign (buyer / seller / arbiter / admin) and lists possible error codes.

## File Structure

```
examples/frontend/
├── index.html      # App shell
├── styles.css      # Dark theme UI
├── api-spec.js     # Contract method definitions (params, types, auth, errors)
├── codegen.js      # Multi-language code generation
├── app.js          # UI logic, wallet integration, contract invocation
└── package.json    # Optional dev server
```

## Supported Networks

| Network    | RPC Endpoint |
|------------|-------------|
| Testnet    | https://soroban-testnet.stellar.org |
| Mainnet    | https://mainnet.stellar.validationcloud.io/... |
| Futurenet  | https://rpc-futurenet.stellar.org |
| Custom     | Enter any RPC URL |
