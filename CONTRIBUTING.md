# Contributing to Soroban Starter Kit

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable) with `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- [Docker](https://www.docker.com/) (for local node)

```bash
rustup target add wasm32-unknown-unknown
cargo install stellar-cli
```

## Dev Setup

```bash
git clone https://github.com/Fidelis900/soroban-starter-kit.git
cd soroban-starter-kit
```

Start a local Stellar node:

```bash
docker compose up stellar-node
```

## Test Commands

Run tests for a specific contract:

```bash
cd contracts/token   # or contracts/escrow
cargo test
```

Run all contract tests from the repo root:

```bash
cargo test --workspace
```

## Code Style

- Follow standard Rust conventions (`rustfmt`, `clippy`)
- Run before committing:

```bash
cargo fmt --all
cargo clippy --all-targets -- -D warnings
```

## PR Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes with tests covering new functionality
3. Ensure `cargo fmt`, `cargo clippy`, and `cargo test` all pass
4. Open a pull request against `main` with a clear description of the change
5. Address any review feedback before merge

## Adding a New Contract Template

- Place the contract under `contracts/<name>/`
- Include a `scripts/deploy.sh` using the `stellar` CLI
- Add at least 8 test cases in the contract's test module
- Update the template table in `README.md`
