#!/usr/bin/env bash
# deploy.sh — build and deploy Soroban contracts
# Usage: ./scripts/deploy.sh [testnet|mainnet|local] [contract]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT/soroban-starter-kit/contracts"

NETWORK="${1:-testnet}"
CONTRACT="${2:-all}"

case "$NETWORK" in
  testnet)
    RPC_URL="https://soroban-testnet.stellar.org"
    PASSPHRASE="Test SDF Network ; September 2015"
    ;;
  mainnet)
    RPC_URL="https://soroban.stellar.org"
    PASSPHRASE="Public Global Stellar Network ; September 2015"
    ;;
  local)
    RPC_URL="http://localhost:${LOCAL_RPC_PORT:-8000}"
    PASSPHRASE="Standalone Network ; February 2017"
    ;;
  *)
    echo "Unknown network: $NETWORK (use testnet|mainnet|local)" >&2
    exit 1
    ;;
esac

deploy_contract() {
  local name="$1"
  local dir="$CONTRACTS_DIR/$name"
  [[ -d "$dir" ]] || { echo "Contract not found: $name"; return 1; }

  echo "── Building $name ──"
  (cd "$dir" && stellar contract build)

  WASM=$(find "$dir/target/wasm32-unknown-unknown/release" -name "*.wasm" | head -1)
  [[ -n "$WASM" ]] || { echo "No WASM found for $name"; return 1; }

  echo "── Deploying $name to $NETWORK ──"
  stellar contract deploy \
    --wasm "$WASM" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$PASSPHRASE" \
    --source-account default \
    --network "$NETWORK"
}

if [[ "$CONTRACT" == "all" ]]; then
  for dir in "$CONTRACTS_DIR"/*/; do
    deploy_contract "$(basename "$dir")"
  done
else
  deploy_contract "$CONTRACT"
fi
