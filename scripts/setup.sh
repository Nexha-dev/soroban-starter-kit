#!/usr/bin/env bash
# setup.sh — one-shot dev environment bootstrap
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log()  { echo -e "\033[1;34m[setup]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ok]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
die()  { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

# ── 1. .env ───────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  log "Creating .env from .env.example"
  cp .env.example .env
  ok ".env created — edit it to customise endpoints"
else
  warn ".env already exists, skipping"
fi

# ── 2. Node dependencies ──────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  die "Node.js not found. Install from https://nodejs.org (v20+)"
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[[ "$NODE_VER" -ge 20 ]] || die "Node.js 20+ required (found $NODE_VER)"

log "Installing Node dependencies"
npm ci
ok "Node dependencies installed"

# ── 3. Rust / Soroban CLI (optional) ─────────────────────────────────────────
if command -v cargo &>/dev/null; then
  if ! command -v stellar &>/dev/null; then
    log "Installing Soroban CLI (stellar-cli)"
    cargo install --locked stellar-cli --features opt
    ok "stellar-cli installed"
  else
    ok "stellar-cli already installed: $(stellar --version 2>&1 | head -1)"
  fi
else
  warn "Rust/Cargo not found — skipping Soroban CLI install (not needed for frontend-only dev)"
fi

# ── 4. Git hooks ──────────────────────────────────────────────────────────────
if [[ -d .git ]]; then
  log "Installing pre-commit lint hook"
  cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
npm run lint --silent || { echo "Lint failed — commit aborted"; exit 1; }
HOOK
  chmod +x .git/hooks/pre-commit
  ok "pre-commit hook installed"
fi

echo ""
ok "Setup complete! Next steps:"
echo "  npm run dev          — start frontend dev server"
echo "  ./scripts/local-net.sh start  — start local Stellar node"
echo "  ./scripts/deploy.sh testnet   — deploy contracts to testnet"
