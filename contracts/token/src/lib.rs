#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;

pub use errors::TokenError;
pub use storage::{AllowanceDataKey, AllowanceValue, DataKey, MetadataKey};

use admin::require_admin;
use soroban_sdk::{
    contract, contractimpl, panic_with_error, token, Address, Env, String, Symbol,
};
use storage::DataKey::{Admin, Allowance, Balance, Metadata, TotalSupply};
use storage::MetadataKey::{Decimals, Name, Symbol as SymbolKey};

const BUMP_THRESHOLD: u32 = 120_960;
const BUMP_AMOUNT: u32 = 518_400;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, BUMP_THRESHOLD, BUMP_AMOUNT);
}

/// Token contract implementing the Soroban Token Interface.
#[contract]
pub struct TokenContract;

// Single #[contractimpl] block — includes both custom methods and the
// TokenInterface methods so the macro only runs once.
#[contractimpl]
impl TokenContract {
    // ── Custom admin methods ──────────────────────────────────────────────

    /// Initialize the token with metadata and an admin.
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&Admin, &admin);
        env.storage().instance().set(&Metadata(Name), &name);
        env.storage().instance().set(&Metadata(SymbolKey), &symbol);
        env.storage().instance().set(&Metadata(Decimals), &decimals);
        env.storage().instance().set(&TotalSupply, &0i128);
        bump_instance(&env);
        events::initialized(&env, &admin, name, symbol, decimals);
        Ok(())
    }

    /// Mint `amount` tokens to `to`. Admin only.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        if amount < 0 {
            return Err(TokenError::InsufficientBalance);
        }
        let balance = Self::balance_of(env.clone(), to.clone());
        let new_balance = balance.checked_add(amount).ok_or(TokenError::InsufficientBalance)?;
        env.storage().persistent().set(&Balance(to.clone()), &new_balance);
        bump_persistent(&env, &Balance(to.clone()));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply + amount));
        bump_instance(&env);
        events::minted(&env, &to, amount);
        Ok(())
    }

    /// Burn `amount` tokens from `from`. Admin only.
    pub fn burn_admin(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        if amount < 0 {
            return Err(TokenError::InsufficientBalance);
        }
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        let new_balance = balance.checked_sub(amount).ok_or(TokenError::InsufficientBalance)?;
        env.storage().persistent().set(&Balance(from.clone()), &new_balance);
        bump_persistent(&env, &Balance(from.clone()));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply - amount));
        bump_instance(&env);
        events::burned(&env, &from, amount);
        Ok(())
    }

    /// Transfer admin role to `new_admin`. Current admin only.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&Admin, &new_admin);
        bump_instance(&env);
        events::admin_set(&env, &new_admin);
        Ok(())
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&Admin).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&TotalSupply).unwrap_or(0)
    }

    // ── Soroban TokenInterface methods ────────────────────────────────────

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let val: Option<AllowanceValue> = env.storage().temporary().get(&key);
        match val {
            Some(v) if env.ledger().sequence() <= v.expiration_ledger => v.amount,
            _ => 0,
        }
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        env.storage()
            .temporary()
            .set(&key, &AllowanceValue { amount, expiration_ledger });
        if expiration_ledger > env.ledger().sequence() {
            let ttl = expiration_ledger.saturating_sub(env.ledger().sequence());
            env.storage().temporary().extend_ttl(&key, ttl, ttl);
        }
        events::approved(&env, &from, &spender, amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        Self::balance_of(env, id)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        spender.require_auth();
        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let val: AllowanceValue = env
            .storage()
            .temporary()
            .get(&key)
            .unwrap_or(AllowanceValue { amount: 0, expiration_ledger: 0 });
        if env.ledger().sequence() > val.expiration_ledger || val.amount < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }
        env.storage().temporary().set(
            &key,
            &AllowanceValue {
                amount: val.amount - amount,
                expiration_ledger: val.expiration_ledger,
            },
        );
        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        env.storage()
            .persistent()
            .set(&Balance(from.clone()), &(balance - amount));
        bump_persistent(&env, &Balance(from.clone()));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply - amount));
        bump_instance(&env);
        env.events()
            .publish((Symbol::new(&env, "burn"), from), amount);
    }

    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let val: AllowanceValue = env
            .storage()
            .temporary()
            .get(&key)
            .unwrap_or(AllowanceValue { amount: 0, expiration_ledger: 0 });
        if env.ledger().sequence() > val.expiration_ledger || val.amount < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        env.storage().temporary().set(
            &key,
            &AllowanceValue {
                amount: val.amount - amount,
                expiration_ledger: val.expiration_ledger,
            },
        );
        env.storage()
            .persistent()
            .set(&Balance(from.clone()), &(balance - amount));
        bump_persistent(&env, &Balance(from.clone()));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply - amount));
        bump_instance(&env);
        env.events()
            .publish((Symbol::new(&env, "burn_from"), from), amount);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&Metadata(Decimals)).unwrap()
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&Metadata(Name)).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&Metadata(SymbolKey)).unwrap()
    }
}

// Implement the Soroban TokenInterface trait so the escrow can use
// token::Client::new().  This impl delegates to the methods above and does NOT
// use #[contractimpl] to avoid duplicate symbol generation.
impl token::TokenInterface for TokenContract {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        TokenContract::allowance(env, from, spender)
    }

    fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        TokenContract::approve(env, from, spender, amount, expiration_ledger);
    }

    fn balance(env: Env, id: Address) -> i128 {
        TokenContract::balance(env, id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        TokenContract::transfer(env, from, to, amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        TokenContract::transfer_from(env, spender, from, to, amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        TokenContract::burn(env, from, amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        TokenContract::burn_from(env, spender, from, amount);
    }

    fn decimals(env: Env) -> u32 {
        TokenContract::decimals(env)
    }

    fn name(env: Env) -> String {
        TokenContract::name(env)
    }

    fn symbol(env: Env) -> String {
        TokenContract::symbol(env)
    }
}

impl TokenContract {
    fn balance_of(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&Balance(id)).unwrap_or(0)
    }

    fn transfer_impl(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        if amount < 0 {
            return Err(TokenError::InsufficientBalance);
        }
        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        env.storage()
            .persistent()
            .set(&Balance(from.clone()), &(from_balance - amount));
        bump_persistent(&env, &Balance(from.clone()));
        let to_balance = Self::balance_of(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&Balance(to.clone()), &(to_balance + amount));
        bump_persistent(&env, &Balance(to.clone()));
        events::transferred(&env, &from, &to, amount);
        Ok(())
    }
}
