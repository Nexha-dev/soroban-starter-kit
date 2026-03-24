# Soroban Developer Tools

Comprehensive developer tools for Soroban smart contract development. Zero build step — open `index.html` directly or serve locally.

## Quick Start

```bash
cd examples/dev-tools
npx serve . -p 3001
# Open http://localhost:3001
```

Or just open `index.html` in your browser.

## Tools

### ⚙ Scaffolder
Generate production-ready Soroban contract boilerplate for 6 contract types:
- Token, Escrow, NFT, DAO, Multisig, Blank
- Configurable: contract name, author, SDK version
- Optional features: events, custom errors, test module, deploy script
- Multi-file output: `lib.rs`, `Cargo.toml`, `scripts/deploy.sh`

### 🐛 Debugger
- XDR decoder — paste base64 XDR or a transaction hash for structured output
- Error code lookup — maps Token and Escrow error codes to names, descriptions, and fixes
- Event parser — decodes raw Soroban RPC event JSON into readable structure

### 📊 Profiler
- Per-method cost estimates: CPU units, memory, ledger reads/writes, events
- Fee breakdown in stroops and XLM
- Storage cost estimator for instance/persistent/temporary entries
- Visual utilization bars

### 🔍 Analyzer
- Paste Rust contract code for static best-practice analysis
- Checks: `#![no_std]`, auth, error handling, events, storage patterns, TTL
- Severity levels: error, warning, info, pass
- Load sample Token or Escrow code to see it in action

### 📚 Docs
Inline developer documentation covering:
- Getting started, project structure, contract anatomy
- Storage types, authentication, events, error handling
- Testing, fees & metering, deployment
- Best practices, Token guide, Escrow guide

## File Structure

```
examples/dev-tools/
├── index.html          # App shell
├── styles.css          # Dark theme UI
├── app.js              # Tab routing and UI logic
├── tools/
│   ├── scaffolder.js   # Contract boilerplate generation
│   ├── debugger.js     # XDR decoder, error lookup, event parser
│   ├── profiler.js     # Fee and storage cost estimator
│   ├── analyzer.js     # Static code analysis
│   └── docs.js         # Inline documentation content
└── README.md
```

## Resources

- [Soroban Docs](https://soroban.stellar.org/docs)
- [Stellar SDK](https://stellar.github.io/js-stellar-sdk/)
- [Stellar CLI](https://github.com/stellar/stellar-cli)
- [Freighter Wallet](https://freighter.app/)

## Related

- See `examples/frontend/` for the interactive API Explorer (Issue #59)
