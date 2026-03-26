#!/usr/bin/env bash
# local-net.sh — manage the local Stellar/Soroban node via Docker Compose
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f $ROOT/docker/docker-compose.yml"

usage() {
  echo "Usage: $0 {start|stop|reset|status|logs}"
  exit 1
}

case "${1:-}" in
  start)
    echo "Starting local Stellar node..."
    $COMPOSE up -d stellar-node
    echo "Waiting for node to be healthy..."
    for i in $(seq 1 30); do
      if $COMPOSE ps stellar-node | grep -q "healthy"; then
        echo "Local node ready:"
        echo "  RPC:     http://localhost:${LOCAL_RPC_PORT:-8000}"
        echo "  Horizon: http://localhost:${LOCAL_HORIZON_PORT:-8001}"
        exit 0
      fi
      sleep 2
    done
    echo "Node did not become healthy in time — check: $0 logs"
    exit 1
    ;;
  stop)
    $COMPOSE stop stellar-node
    ;;
  reset)
    echo "Resetting local node (all chain data will be lost)..."
    $COMPOSE rm -sf stellar-node
    $COMPOSE up -d stellar-node
    ;;
  status)
    $COMPOSE ps stellar-node
    ;;
  logs)
    $COMPOSE logs -f stellar-node
    ;;
  *)
    usage
    ;;
esac
