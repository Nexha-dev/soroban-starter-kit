/**
 * scaffolder.js
 * Generates Soroban contract boilerplate for multiple contract types.
 */

const Scaffolder = (() => {

  // ── Templates ──────────────────────────────────────────────────────────────

  const TEMPLATES = {
    token: (cfg) => ({
      'lib.rs': `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[contract]
pub struct ${toPascal(cfg.name)};

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    TotalSupply,
}
${cfg.errors ? `
#[contracttype]
pub enum ${toPascal(cfg.name)}Error {
    Unauthorized      = 1,
    InsufficientFunds = 2,
    AlreadyInitialized = 3,
    NotInitialized    = 4,
}
` : ''}
#[contractimpl]
impl ${toPascal(cfg.name)} {
    pub fn initialize(env: Env, admin: Address) ${cfg.errors ? `-> Result<(), ${toPascal(cfg.name)}Error>` : ''} {
        ${cfg.errors ? `if env.storage().instance().has(&DataKey::Admin) {
            return Err(${toPascal(cfg.name)}Error::AlreadyInitialized);
        }` : ''}
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "initialize"), admin), ());` : ''}
        ${cfg.errors ? 'Ok(())' : ''}
    }

    pub fn mint(env: Env, to: Address, amount: i128) ${cfg.errors ? `-> Result<(), ${toPascal(cfg.name)}Error>` : ''} {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            ${cfg.errors ? `.ok_or(${toPascal(cfg.name)}Error::NotInitialized)?;` : '.unwrap();'}
        admin.require_auth();

        let balance: i128 = env.storage().persistent()
            .get(&DataKey::Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(balance + amount));

        let supply: i128 = env.storage().instance()
            .get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply + amount));
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "mint"), to), amount);` : ''}
        ${cfg.errors ? 'Ok(())' : ''}
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Balance(id)).unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalSupply).unwrap_or(0)
    }
}
${cfg.tests ? `
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_initialize_and_mint() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ${toPascal(cfg.name)});
        let client = ${toPascal(cfg.name)}Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user  = Address::generate(&env);

        client.initialize(&admin);
        client.mint(&user, &1_000_000_000);

        assert_eq!(client.balance(&user), 1_000_000_000);
        assert_eq!(client.total_supply(), 1_000_000_000);
    }
}` : ''}`,

      'Cargo.toml': cargoToml(cfg),
      ...(cfg.deploy ? { 'scripts/deploy.sh': deployScript(cfg) } : {}),
    }),

    escrow: (cfg) => ({
      'lib.rs': `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[contract]
pub struct ${toPascal(cfg.name)};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum EscrowState { Created = 0, Funded = 1, Completed = 2, Refunded = 3 }

#[contracttype]
pub enum DataKey { Buyer, Seller, Token, Amount, Deadline, State }
${cfg.errors ? `
#[contracttype]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    InvalidState       = 3,
    DeadlineNotReached = 4,
    NotAuthorized      = 5,
}
` : ''}
#[contractimpl]
impl ${toPascal(cfg.name)} {
    pub fn initialize(
        env: Env, buyer: Address, seller: Address,
        token: Address, amount: i128, deadline: u32,
    ) ${cfg.errors ? `-> Result<(), EscrowError>` : ''} {
        ${cfg.errors ? `if env.storage().instance().has(&DataKey::State) {
            return Err(EscrowError::AlreadyInitialized);
        }` : ''}
        env.storage().instance().set(&DataKey::Buyer,    &buyer);
        env.storage().instance().set(&DataKey::Seller,   &seller);
        env.storage().instance().set(&DataKey::Token,    &token);
        env.storage().instance().set(&DataKey::Amount,   &amount);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::State,    &EscrowState::Created);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "created"), buyer, seller), amount);` : ''}
        ${cfg.errors ? 'Ok(())' : ''}
    }

    pub fn fund(env: Env) ${cfg.errors ? `-> Result<(), EscrowError>` : ''} {
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        buyer.require_auth();
        token::Client::new(&env, &token_addr)
            .transfer(&buyer, &env.current_contract_address(), &amount);
        env.storage().instance().set(&DataKey::State, &EscrowState::Funded);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "funded"), buyer), amount);` : ''}
        ${cfg.errors ? 'Ok(())' : ''}
    }

    pub fn release(env: Env) ${cfg.errors ? `-> Result<(), EscrowError>` : ''} {
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        let seller: Address = env.storage().instance().get(&DataKey::Seller).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        buyer.require_auth();
        token::Client::new(&env, &token_addr)
            .transfer(&env.current_contract_address(), &seller, &amount);
        env.storage().instance().set(&DataKey::State, &EscrowState::Completed);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "released"), seller), amount);` : ''}
        ${cfg.errors ? 'Ok(())' : ''}
    }

    pub fn get_state(env: Env) -> EscrowState {
        env.storage().instance().get(&DataKey::State).unwrap_or(EscrowState::Created)
    }
}
${cfg.tests ? `
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_escrow_flow() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ${toPascal(cfg.name)});
        let client = ${toPascal(cfg.name)}Client::new(&env, &contract_id);

        let buyer  = Address::generate(&env);
        let seller = Address::generate(&env);
        // TODO: deploy a token contract and pass its ID
        // client.initialize(&buyer, &seller, &token_id, &1_000_000, &9999999);
        // client.fund();
        // client.release();
    }
}` : ''}`,

      'Cargo.toml': cargoToml(cfg),
      ...(cfg.deploy ? { 'scripts/deploy.sh': deployScript(cfg) } : {}),
    }),

    nft: (cfg) => ({
      'lib.rs': `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Map};

#[contract]
pub struct ${toPascal(cfg.name)};

#[contracttype]
pub enum DataKey {
    Admin,
    Owner(u64),
    Metadata(u64),
    NextId,
}
${cfg.errors ? `
#[contracttype]
pub enum NftError {
    NotAuthorized  = 1,
    TokenNotFound  = 2,
    AlreadyMinted  = 3,
}
` : ''}
#[contractimpl]
impl ${toPascal(cfg.name)} {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    pub fn mint(env: Env, to: Address, uri: String) -> u64 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Owner(id), &to);
        env.storage().persistent().set(&DataKey::Metadata(id), &uri);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "mint"), to), id);` : ''}
        id
    }

    pub fn owner_of(env: Env, token_id: u64) -> Address {
        env.storage().persistent().get(&DataKey::Owner(token_id)).unwrap()
    }

    pub fn token_uri(env: Env, token_id: u64) -> String {
        env.storage().persistent().get(&DataKey::Metadata(token_id)).unwrap()
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        from.require_auth();
        let owner: Address = env.storage().persistent()
            .get(&DataKey::Owner(token_id)).unwrap();
        assert!(owner == from, "Not token owner");
        env.storage().persistent().set(&DataKey::Owner(token_id), &to);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "transfer"), from, to), token_id);` : ''}
    }
}`,
      'Cargo.toml': cargoToml(cfg),
      ...(cfg.deploy ? { 'scripts/deploy.sh': deployScript(cfg) } : {}),
    }),

    dao: (cfg) => ({
      'lib.rs': `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contract]
pub struct ${toPascal(cfg.name)};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum ProposalState { Active = 0, Passed = 1, Rejected = 2, Executed = 3 }

#[contracttype]
pub struct Proposal {
    pub proposer:    Address,
    pub votes_for:   u64,
    pub votes_against: u64,
    pub state:       ProposalState,
    pub deadline:    u32,
}

#[contracttype]
pub enum DataKey { Admin, Proposal(u64), NextId, Member(Address) }

#[contractimpl]
impl ${toPascal(cfg.name)} {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    pub fn add_member(env: Env, member: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Member(member.clone()), &true);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "member_added"),), member);` : ''}
    }

    pub fn propose(env: Env, proposer: Address, deadline: u32) -> u64 {
        proposer.require_auth();
        assert!(env.storage().persistent().get::<_, bool>(&DataKey::Member(proposer.clone())).unwrap_or(false), "Not a member");
        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let proposal = Proposal { proposer, votes_for: 0, votes_against: 0, state: ProposalState::Active, deadline };
        env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) {
        voter.require_auth();
        assert!(env.storage().persistent().get::<_, bool>(&DataKey::Member(voter.clone())).unwrap_or(false), "Not a member");
        let mut p: Proposal = env.storage().persistent().get(&DataKey::Proposal(proposal_id)).unwrap();
        assert!(p.state == ProposalState::Active, "Proposal not active");
        if support { p.votes_for += 1; } else { p.votes_against += 1; }
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &p);
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "vote"), voter), (proposal_id, support));` : ''}
    }

    pub fn finalize(env: Env, proposal_id: u64) {
        let mut p: Proposal = env.storage().persistent().get(&DataKey::Proposal(proposal_id)).unwrap();
        assert!(env.ledger().sequence() > p.deadline, "Voting still open");
        p.state = if p.votes_for > p.votes_against { ProposalState::Passed } else { ProposalState::Rejected };
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &p);
    }
}`,
      'Cargo.toml': cargoToml(cfg),
      ...(cfg.deploy ? { 'scripts/deploy.sh': deployScript(cfg) } : {}),
    }),

    multisig: (cfg) => ({
      'lib.rs': `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contract]
pub struct ${toPascal(cfg.name)};

#[contracttype]
pub enum DataKey { Owners, Threshold, TxCount, Tx(u64), Approvals(u64) }

#[contracttype]
pub struct Transaction { pub to: Address, pub amount: i128, pub executed: bool }

#[contractimpl]
impl ${toPascal(cfg.name)} {
    pub fn initialize(env: Env, owners: Vec<Address>, threshold: u32) {
        assert!(threshold as usize <= owners.len(), "Threshold exceeds owner count");
        env.storage().instance().set(&DataKey::Owners, &owners);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::TxCount, &0u64);
    }

    pub fn submit(env: Env, proposer: Address, to: Address, amount: i128) -> u64 {
        proposer.require_auth();
        Self::require_owner(&env, &proposer);
        let id: u64 = env.storage().instance().get(&DataKey::TxCount).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Tx(id), &Transaction { to, amount, executed: false });
        env.storage().persistent().set(&DataKey::Approvals(id), &1u32);
        env.storage().instance().set(&DataKey::TxCount, &(id + 1));
        ${cfg.events ? `env.events().publish((Symbol::new(&env, "submitted"), proposer), id);` : ''}
        id
    }

    pub fn approve(env: Env, owner: Address, tx_id: u64) {
        owner.require_auth();
        Self::require_owner(&env, &owner);
        let approvals: u32 = env.storage().persistent().get(&DataKey::Approvals(tx_id)).unwrap_or(0);
        let threshold: u32 = env.storage().instance().get(&DataKey::Threshold).unwrap();
        let new_approvals = approvals + 1;
        env.storage().persistent().set(&DataKey::Approvals(tx_id), &new_approvals);
        if new_approvals >= threshold {
            // Auto-execute when threshold reached
            // TODO: integrate token transfer here
            let mut tx: Transaction = env.storage().persistent().get(&DataKey::Tx(tx_id)).unwrap();
            tx.executed = true;
            env.storage().persistent().set(&DataKey::Tx(tx_id), &tx);
            ${cfg.events ? `env.events().publish((Symbol::new(&env, "executed"),), tx_id);` : ''}
        }
    }

    fn require_owner(env: &Env, addr: &Address) {
        let owners: Vec<Address> = env.storage().instance().get(&DataKey::Owners).unwrap();
        assert!(owners.contains(addr), "Not an owner");
    }
}`,
      'Cargo.toml': cargoToml(cfg),
      ...(cfg.deploy ? { 'scripts/deploy.sh': deployScript(cfg) } : {}),
    }),

    blank: (cfg) => ({
      'lib.rs': `#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

/// ${toPascal(cfg.name)} — Soroban smart contract
#[contract]
pub struct ${toPascal(cfg.name)};

#[contractimpl]
impl ${toPascal(cfg.name)} {
    /// Example function — replace with your logic
    pub fn hello(env: Env) -> soroban_sdk::String {
        soroban_sdk::String::from_str(&env, "Hello, Soroban!")
    }
}
${cfg.tests ? `
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_hello() {
        let env = Env::default();
        let id = env.register_contract(None, ${toPascal(cfg.name)});
        let client = ${toPascal(cfg.name)}Client::new(&env, &id);
        assert_eq!(client.hello(), soroban_sdk::String::from_str(&env, "Hello, Soroban!"));
    }
}` : ''}`,
      'Cargo.toml': cargoToml(cfg),
      ...(cfg.deploy ? { 'scripts/deploy.sh': deployScript(cfg) } : {}),
    }),
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toPascal(str) {
    return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
  }

  function cargoToml(cfg) {
    return `[package]
name = "${cfg.name.replace(/_/g, '-')}"
version = "0.1.0"
edition = "2021"
${cfg.author ? `authors = ["${cfg.author}"]` : ''}

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "${cfg.sdkVersion}", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "${cfg.sdkVersion}", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true`;
  }

  function deployScript(cfg) {
    return `#!/bin/bash
# Deploy ${cfg.name} to Soroban testnet
set -e

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

echo "Building ${cfg.name}..."
cargo build --target wasm32-unknown-unknown --release

WASM="target/wasm32-unknown-unknown/release/${cfg.name.replace(/-/g, '_')}.wasm"

echo "Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \\
  --wasm "$WASM" \\
  --source "$STELLAR_SECRET_KEY" \\
  --rpc-url "$RPC_URL" \\
  --network-passphrase "$NETWORK_PASSPHRASE")

echo "Deployed contract ID: $CONTRACT_ID"
echo "CONTRACT_ID=$CONTRACT_ID" >> .env`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function generate(type, cfg) {
    const builder = TEMPLATES[type];
    if (!builder) return {};
    return builder(cfg);
  }

  return { generate };
})();
