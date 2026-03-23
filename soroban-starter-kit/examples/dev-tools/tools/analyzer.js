/**
 * analyzer.js
 * Static best-practice analysis for Soroban Rust contract code.
 * Pattern-based checks — not a full compiler, but catches common issues.
 */

const Analyzer = (() => {

  // ── Rule definitions ───────────────────────────────────────────────────────

  const RULES = [
    // ── Critical / errors ────────────────────────────────────────────────────
    {
      id: 'no-std',
      level: 'error',
      title: 'Missing #![no_std]',
      desc: 'Soroban contracts must declare #![no_std] at the top of lib.rs.',
      fix: 'Add #![no_std] as the first line of your file.',
      check: code => !code.includes('#![no_std]'),
    },
    {
      id: 'contract-macro',
      level: 'error',
      title: 'Missing #[contract] macro',
      desc: 'Your contract struct must be annotated with #[contract].',
      fix: 'Add #[contract] above your struct definition.',
      check: code => !code.includes('#[contract]'),
    },
    {
      id: 'contractimpl-macro',
      level: 'error',
      title: 'Missing #[contractimpl] macro',
      desc: 'Your impl block must be annotated with #[contractimpl].',
      fix: 'Add #[contractimpl] above your impl block.',
      check: code => !code.includes('#[contractimpl]'),
    },
    {
      id: 'std-collections',
      level: 'error',
      title: 'Using std collections (Vec/HashMap)',
      desc: 'std::collections::Vec and HashMap are not available in no_std. Use soroban_sdk::Vec and soroban_sdk::Map.',
      fix: 'Replace std::vec::Vec with soroban_sdk::Vec and std::collections::HashMap with soroban_sdk::Map.',
      check: code => /use std::collections|std::vec::Vec/.test(code),
    },
    {
      id: 'string-literal',
      level: 'error',
      title: 'Using Rust String literals directly',
      desc: 'Rust String type is not available in no_std. Use soroban_sdk::String.',
      fix: 'Use soroban_sdk::String::from_str(&env, "your string") instead of "string".to_string().',
      check: code => /\.to_string\(\)|String::from\(/.test(code),
    },

    // ── Warnings ─────────────────────────────────────────────────────────────
    {
      id: 'require-auth',
      level: 'warning',
      title: 'Write function may be missing require_auth()',
      desc: 'Functions that modify state should call require_auth() on the relevant address.',
      fix: 'Add addr.require_auth() at the start of any function that modifies contract state.',
      check: code => {
        // Heuristic: has pub fn that sets storage but no require_auth
        const hasSetter = /env\.storage\(\)\.(instance|persistent|temporary)\(\)\.set/.test(code);
        const hasAuth   = /require_auth\(\)/.test(code);
        return hasSetter && !hasAuth;
      },
    },
    {
      id: 'unwrap-usage',
      level: 'warning',
      title: 'Using .unwrap() — consider error handling',
      desc: '.unwrap() will panic on None/Err. In production contracts, prefer explicit error handling.',
      fix: 'Use .ok_or(YourError::NotInitialized)? or match statements instead of .unwrap().',
      check: code => /\.unwrap\(\)/.test(code),
    },
    {
      id: 'panic-usage',
      level: 'warning',
      title: 'Using panic!()',
      desc: 'panic!() terminates the contract with an opaque error. Custom error types give better UX.',
      fix: 'Define a #[contracttype] error enum and return Result<T, YourError> instead.',
      check: code => /\bpanic!\(/.test(code),
    },
    {
      id: 'no-events',
      level: 'warning',
      title: 'No events emitted',
      desc: 'Contracts should emit events for state changes to enable off-chain indexing.',
      fix: 'Add env.events().publish((Symbol::new(&env, "event_name"), ...), payload) in state-changing functions.',
      check: code => !code.includes('env.events().publish'),
    },
    {
      id: 'no-error-type',
      level: 'warning',
      title: 'No custom error type defined',
      desc: 'Custom error enums improve debuggability and client-side error handling.',
      fix: 'Define a #[contracttype] pub enum YourError { ... } and return Result<T, YourError>.',
      check: code => !/#\[contracttype\][\s\S]{0,50}pub enum \w+Error/.test(code),
    },
    {
      id: 'large-storage-key',
      level: 'warning',
      title: 'Potential large storage key',
      desc: 'Storage keys should be compact. Avoid storing large structs as keys.',
      fix: 'Use enums with minimal variants as DataKey. Avoid embedding large data in keys.',
      check: code => /DataKey::\w+\([^)]{40,}\)/.test(code),
    },

    // ── Info / best practices ─────────────────────────────────────────────────
    {
      id: 'has-tests',
      level: 'pass',
      title: 'Test module present',
      desc: 'Good — a #[cfg(test)] module was found.',
      fix: '',
      check: code => !/#\[cfg\(test\)\]/.test(code),
      invert: true,
    },
    {
      id: 'contracttype-datakey',
      level: 'info',
      title: 'Consider using #[contracttype] for DataKey',
      desc: 'Using a #[contracttype] enum as storage keys ensures type-safe, compact storage.',
      fix: 'Define: #[contracttype] pub enum DataKey { ... }',
      check: code => !/#\[contracttype\][\s\S]{0,50}pub enum DataKey/.test(code),
    },
    {
      id: 'instance-vs-persistent',
      level: 'info',
      title: 'Storage type usage',
      desc: 'Use instance storage for contract-wide config, persistent for per-account data, temporary for short-lived data.',
      fix: 'Admin/metadata → instance. Balances/allowances → persistent. Nonces/temp approvals → temporary.',
      check: code => !code.includes('storage().persistent()') && !code.includes('storage().temporary()'),
    },
    {
      id: 'extend-ttl',
      level: 'info',
      title: 'Consider extending TTL for persistent entries',
      desc: 'Persistent storage entries expire. Call env.storage().persistent().extend_ttl() to keep them alive.',
      fix: 'Add extend_ttl calls after writing persistent entries, or in a separate bump function.',
      check: code => code.includes('storage().persistent().set') && !code.includes('extend_ttl'),
    },
  ];

  // ── Sample code ────────────────────────────────────────────────────────────

  const SAMPLES = {
    token: `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contract]
pub struct TokenContract;

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    TotalSupply,
}

#[contracttype]
pub enum TokenError {
    Unauthorized = 1,
    InsufficientBalance = 2,
    NotInitialized = 3,
}

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), TokenError> {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        env.events().publish((Symbol::new(&env, "initialize"), admin), ());
        Ok(())
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin).ok_or(TokenError::NotInitialized)?;
        admin.require_auth();
        let balance: i128 = env.storage().persistent()
            .get(&DataKey::Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(balance + amount));
        env.events().publish((Symbol::new(&env, "mint"), to), amount);
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    #[test]
    fn test_mint() {
        let env = soroban_sdk::Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, TokenContract);
        let client = TokenContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.mint(&admin, &1000);
    }
}`,

    escrow: `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[contract]
pub struct EscrowContract;

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum EscrowState { Created = 0, Funded = 1, Completed = 2 }

#[contracttype]
pub enum DataKey { Buyer, Seller, Token, Amount, State }

#[contracttype]
pub enum EscrowError {
    NotInitialized = 1,
    InvalidState   = 2,
    NotAuthorized  = 3,
}

#[contractimpl]
impl EscrowContract {
    pub fn initialize(env: Env, buyer: Address, seller: Address, token: Address, amount: i128) -> Result<(), EscrowError> {
        env.storage().instance().set(&DataKey::Buyer,  &buyer);
        env.storage().instance().set(&DataKey::Seller, &seller);
        env.storage().instance().set(&DataKey::Token,  &token);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::State,  &EscrowState::Created);
        env.events().publish((Symbol::new(&env, "created"), buyer, seller), amount);
        Ok(())
    }

    pub fn fund(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).ok_or(EscrowError::NotInitialized)?;
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        buyer.require_auth();
        token::Client::new(&env, &token_addr).transfer(&buyer, &env.current_contract_address(), &amount);
        env.storage().instance().set(&DataKey::State, &EscrowState::Funded);
        env.events().publish((Symbol::new(&env, "funded"), buyer), amount);
        Ok(())
    }
}`,
  };

  // ── Analyze ────────────────────────────────────────────────────────────────

  function analyze(code) {
    const findings = [];

    for (const rule of RULES) {
      const triggered = rule.check(code);
      const isFinding = rule.invert ? !triggered : triggered;

      if (isFinding) {
        findings.push({
          id:    rule.id,
          level: rule.level,
          title: rule.title,
          desc:  rule.desc,
          fix:   rule.fix,
        });
      }
    }

    const counts = { error: 0, warning: 0, info: 0, pass: 0 };
    findings.forEach(f => counts[f.level]++);

    // Add a pass finding if no errors/warnings
    if (counts.error === 0 && counts.warning === 0) {
      findings.push({
        id: 'all-clear', level: 'pass',
        title: 'No critical issues found',
        desc: 'The code passes all automated checks.',
        fix: '',
      });
      counts.pass++;
    }

    return { findings, counts };
  }

  return { analyze, SAMPLES };
})();
