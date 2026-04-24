# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `cargo audit` security scanning job in CI workflow (#238)
- Error Reference section in README documenting all `TokenError` and `EscrowError` codes (#234)
- This CHANGELOG file (#231)
- Terraform provider version pinning and `.terraform` directory caching between plan and apply jobs (#242)

## [1.0.0] - 2026-04-24

### Added
- Token contract with mint, burn, transfer, approve, and admin controls
- Escrow contract with buyer/seller/arbiter roles, deadline enforcement, and dispute resolution
- Shared `common` crate for reusable types and utilities
- Comprehensive unit tests for both contracts (8+ cases each)
- Property-based tests via `proptest`
- Test snapshots for deterministic ledger state verification
- Deployment scripts for testnet and local network
- Docker Compose setup for local Stellar node with Soroban RPC
- Dev container configuration for reproducible development environments
- Architecture Decision Records (ADRs) covering storage tiers, error handling, admin model, and escrow state machine
- CI workflow with test, build, and WASM artifact upload jobs
- Benchmark suite for escrow and token operations

[Unreleased]: https://github.com/Fidelis900/soroban-starter-kit/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Fidelis900/soroban-starter-kit/releases/tag/v1.0.0
