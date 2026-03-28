# Deployment Guide

Step-by-step instructions for deploying Soroban contracts and the frontend across all environments.

---

## Environments

| Environment | Network | RPC URL |
|-------------|---------|---------|
| `local` | Standalone | `http://localhost:8000` |
| `testnet` | Test SDF Network | `https://soroban-testnet.stellar.org` |
| `mainnet` | Public Global Stellar | `https://soroban.stellar.org` |

---

## 1. Environment Setup

Copy and configure environment variables:

```bash
cp .env.example .env
```

### Local

```env
VITE_STELLAR_NETWORK=local
VITE_SOROBAN_RPC_URL=http://localhost:8000
VITE_HORIZON_URL=http://localhost:8001
VITE_NETWORK_PASSPHRASE="Standalone Network ; February 2017"
```

### Testnet

```env
VITE_STELLAR_NETWORK=testnet
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
```

### Mainnet

```env
VITE_STELLAR_NETWORK=mainnet
VITE_SOROBAN_RPC_URL=https://soroban.stellar.org
VITE_HORIZON_URL=https://horizon.stellar.org
VITE_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
```

---

## 2. Local Deployment

```bash
# Start local Stellar node
./scripts/local-net.sh start

# Build and deploy all contracts
./scripts/deploy.sh local

# Deploy a single contract
./scripts/deploy.sh local token

# Start frontend dev server
npm run dev
```

---

## 3. Testnet Deployment

```bash
# Fund your deployer account (testnet only)
stellar keys generate --global deployer
stellar keys fund deployer --network testnet

# Deploy all contracts
./scripts/deploy.sh testnet

# Deploy a single contract
./scripts/deploy.sh testnet escrow
```

Save the contract IDs printed to stdout — you'll need them in `.env`.

---

## 4. Mainnet Deployment

> ⚠️ Mainnet deployments are irreversible. Complete testnet validation first.

```bash
# Ensure deployer account has sufficient XLM for fees
stellar keys generate --global deployer-mainnet

# Dry-run simulation (no broadcast)
stellar contract deploy --wasm <path>.wasm \
  --rpc-url https://soroban.stellar.org \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --source-account deployer-mainnet \
  --simulate-only

# Deploy
./scripts/deploy.sh mainnet
```

---

## 5. Frontend Deployment

### Build

```bash
npm run build          # outputs to dist/
```

### Docker

```bash
docker build -f docker/Dockerfile --target prod -t soroban-kit:prod .
docker run -p 80:80 soroban-kit:prod
```

### Docker Compose (full stack)

```bash
docker compose -f docker/docker-compose.yml up --build
```

### Static Hosting (Netlify / Vercel / S3)

```bash
npm run build
# Upload dist/ to your static host
# Set environment variables in the host's dashboard (not in .env)
```

---

## 6. CI/CD Pipeline

The GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push:

1. `npm ci` — install dependencies
2. `npm run lint` — ESLint checks
3. `npm test` — Vitest unit tests
4. `cargo test` — Rust contract tests
5. `stellar contract build` — WASM compilation check

To add automated deployment, extend `.github/workflows/ci.yml`:

```yaml
- name: Deploy to testnet
  if: github.ref == 'refs/heads/main'
  run: ./scripts/deploy.sh testnet
  env:
    STELLAR_SECRET_KEY: ${{ secrets.STELLAR_SECRET_KEY }}
```

---

## 7. Automated Guide Generation

Run the docs check script to validate documentation coverage and regenerate the docs report:

```bash
node scripts/check-docs.mjs
# Outputs: docs-report.json
```

To regenerate environment-specific config snippets automatically:

```bash
node scripts/generate-guides.mjs
# Outputs: docs/integration-guide.md, docs/deployment-guide.md
```

---

## 8. Validation Checklist

### Pre-deployment

- [ ] All contract tests pass: `cargo test`
- [ ] Frontend tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] `.env` is configured for the target network
- [ ] Deployer account is funded
- [ ] Contract IDs from previous deployments are recorded

### Post-deployment

- [ ] Contract responds to `simulate` calls
- [ ] Frontend connects to the correct RPC endpoint
- [ ] Admin functions are restricted to the correct address
- [ ] Event emission verified via Stellar Laboratory
- [ ] Contract ID saved to `.env` and committed (not the secret key)

---

## 9. Security Considerations

- Store `STELLAR_SECRET_KEY` only in CI secrets, never in `.env` committed to git
- Use separate deployer accounts per environment (local / testnet / mainnet)
- Verify WASM hash after deployment: `stellar contract info --id <CONTRACT_ID>`
- Enable `set_admin` only during initialization; lock it down immediately after
- Audit contract code with `cargo audit` before mainnet deployment:
  ```bash
  cargo install cargo-audit
  cargo audit
  ```
- Use `--simulate-only` to estimate fees before broadcasting

---

## 10. Performance Optimization

- Build contracts with `--release` flag (default in `deploy.sh`)
- Minimize contract storage reads — cache values in `Env::storage().instance()`
- Use `TTL` extensions for long-lived contract data to avoid expiry
- Profile WASM size: `wasm-opt -Oz input.wasm -o output.wasm`
- Frontend: set `Cache-Control: max-age=31536000` for hashed static assets

---

## 11. Troubleshooting

| Problem | Solution |
|---------|----------|
| `wasm32` target missing | `rustup target add wasm32-unknown-unknown` |
| `stellar` not found | `cargo install --locked stellar-cli --features opt` |
| Deploy fails: insufficient fee | Increase fee in `deploy.sh` or fund account |
| Local node unhealthy | `./scripts/local-net.sh reset` then retry |
| Contract already initialized | Deploy a fresh contract; initialization is one-time |
| Frontend shows wrong network | Check `VITE_STELLAR_NETWORK` in `.env` |
| CORS errors from RPC | Use a proxy or the official RPC endpoints |

---

## Resources

- [Stellar CLI Reference](https://developers.stellar.org/docs/tools/stellar-cli)
- [Soroban Deployment Docs](https://soroban.stellar.org/docs/getting-started/deploy-to-testnet)
- [Stellar Friendbot (testnet funding)](https://friendbot.stellar.org)
- [Stellar Laboratory](https://laboratory.stellar.org/)
- [cargo-audit](https://crates.io/crates/cargo-audit)
