# Development Environment Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Rust | 1.78+ | https://rustup.rs |
| Stellar CLI | latest | `cargo install --locked stellar-cli --features opt` |

---

## Quick Start (recommended)

```bash
git clone https://github.com/your-org/soroban-starter-kit.git
cd soroban-starter-kit
bash scripts/setup.sh        # installs deps, creates .env, adds git hook
npm run dev                  # http://localhost:3000
```

---

## Docker Compose

All services (frontend, contract builder, local Stellar node) are defined in `docker/docker-compose.yml`.

```bash
# Start everything
docker compose -f docker/docker-compose.yml up

# Frontend only
docker compose -f docker/docker-compose.yml up frontend

# Production build
docker build -f docker/Dockerfile --target prod -t fidelis:prod .
```

---

## Local Stellar Network

```bash
./scripts/local-net.sh start    # start node, wait for healthy
./scripts/local-net.sh status   # check status
./scripts/local-net.sh reset    # wipe chain data and restart
./scripts/local-net.sh stop     # stop node
./scripts/local-net.sh logs     # tail logs
```

Endpoints when running locally:

| Service | URL |
|---------|-----|
| Soroban RPC | http://localhost:8000 |
| Horizon API | http://localhost:8001 |

Set `VITE_STELLAR_NETWORK=local` in `.env` to point the frontend at the local node.

---

## Contract Deployment

```bash
./scripts/deploy.sh testnet          # deploy all contracts to testnet
./scripts/deploy.sh testnet token    # deploy only the token contract
./scripts/deploy.sh local            # deploy to local node
```

---

## Dev Container (VS Code / GitHub Codespaces)

Open the repo in VS Code and click **"Reopen in Container"** when prompted, or run:

```
Dev Containers: Reopen in Container
```

The container automatically runs `scripts/setup.sh` on creation and forwards ports 3000, 8000, and 8001.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_STELLAR_NETWORK` | `testnet` | `testnet`, `mainnet`, or `local` |
| `VITE_SOROBAN_RPC_URL` | testnet RPC | Soroban RPC endpoint |
| `VITE_HORIZON_URL` | testnet Horizon | Horizon REST endpoint |
| `VITE_NETWORK_PASSPHRASE` | testnet passphrase | Network passphrase |
| `VITE_VAPID_PUBLIC_KEY` | _(empty)_ | VAPID key for push notifications |
| `LOCAL_RPC_PORT` | `8000` | Local node RPC port |
| `LOCAL_HORIZON_PORT` | `8001` | Local node Horizon port |

---

## Troubleshooting

**`npm ci` fails**
- Ensure Node.js 20+: `node --version`
- Delete `node_modules/` and retry

**Docker Compose port conflict**
- Change `LOCAL_RPC_PORT` / `LOCAL_HORIZON_PORT` in `.env`

**`stellar` command not found**
- Run: `cargo install --locked stellar-cli --features opt`
- Ensure `~/.cargo/bin` is in `$PATH`

**Local node never becomes healthy**
- Check Docker has enough memory (≥4 GB recommended)
- Run `./scripts/local-net.sh logs` to inspect errors

**Contract build fails (`wasm32` target missing)**
```bash
rustup target add wasm32-unknown-unknown
```

**Freighter wallet not connecting**
- Install the [Freighter extension](https://freighter.app)
- Switch Freighter to the matching network (Testnet / Mainnet)
