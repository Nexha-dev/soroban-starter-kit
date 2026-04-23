#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;

pub use errors::TokenError;
pub use storage::{AllowanceDataKey, DataKey, MetadataKey};

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token, token::TokenInterface, Address, Env, String, Symbol,
    panic_with_error,
};

use admin::require_admin;
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

/// Token contract implementing the Soroban Token Interface
///
/// This contract provides a complete implementation of a fungible token with:
/// - Standard token operations (transfer, balance, approve)
/// - Administrative controls (mint, set_admin)
/// - Metadata support (name, symbol, decimals)
#[contract]
pub struct TokenContract;

#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contracttype]
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum TokenError {
    InsufficientBalance = 1,
    InsufficientAllowance = 2,
    Unauthorized = 3,
    AlreadyInitialized = 4,
    NotInitialized = 5,
    InvalidAmount = 6,
    Overflow = 7,
}

#[contractimpl]
impl TokenContract {
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

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();

        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }

        let balance = Self::balance_of(env.clone(), to.clone());
        let new_balance = balance.checked_add(amount).ok_or(TokenError::Overflow)?;
        env.storage().persistent().set(&Balance(to.clone()), &new_balance);
        bump_persistent(&env, &Balance(to.clone()));

        let total_supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        let new_supply = total_supply.checked_add(amount).ok_or(TokenError::Overflow)?;
        env.storage().instance().set(&TotalSupply, &new_supply);
        bump_instance(&env);

        events::minted(&env, &to, amount);

        Ok(())
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();

        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }

        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        let new_balance = balance.checked_sub(amount).ok_or(TokenError::Overflow)?;
        env.storage().persistent().set(&Balance(from.clone()), &new_balance);
        bump_persistent(&env, &Balance(from.clone()));

        let total_supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        let new_supply = total_supply.checked_sub(amount).ok_or(TokenError::Overflow)?;
        env.storage().instance().set(&TotalSupply, &new_supply);
        bump_instance(&env);

        events::burned(&env, &from, amount);

        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&Admin, &new_admin);
        bump_instance(&env);

        events::admin_set(&env, &new_admin);

        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, TokenError> {
        env.storage().instance()
            .get(&Admin)
            .ok_or(TokenError::NotInitialized)
    }

    pub fn name(env: Env) -> Result<String, TokenError> {
        env.storage().instance()
            .get(&Metadata(Name))
            .ok_or(TokenError::NotInitialized)
    }

    pub fn symbol(env: Env) -> Result<String, TokenError> {
        env.storage().instance()
            .get(&Metadata(SymbolKey))
            .ok_or(TokenError::NotInitialized)
    }

    pub fn decimals(env: Env) -> Result<u32, TokenError> {
        env.storage().instance()
            .get(&Metadata(Decimals))
            .ok_or(TokenError::NotInitialized)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&TotalSupply).unwrap_or(0)
    }
}

#[contractimpl]
impl token::TokenInterface for TokenContract {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = Allowance(AllowanceDataKey { from, spender });
        let val: AllowanceValue = match env.storage().temporary().get(&key) {
            Some(v) => v,
            None => return 0,
        };
        if env.ledger().sequence() > val.expiration_ledger {
            return 0;
        }
        val.amount
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();

        if expiration_ledger <= env.ledger().sequence() {
            panic!("expiration_ledger must be in the future");
        }

        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });

        env.storage().temporary().set(&key, &AllowanceValue { amount, expiration_ledger });

        // Issue #195: Compute duration correctly instead of passing absolute ledger number
        let ttl = expiration_ledger.saturating_sub(env.ledger().sequence());
        env.storage().temporary().extend_ttl(&key, ttl, ttl);

        events::approved(&env, &from, &spender, amount);
    }

    fn balance(env: Env, id: Address) -> i128 {
        Self::balance_of(env, id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        let key = Allowance(AllowanceDataKey {
            from: from.clone(),
            spender: spender.clone(),
        });

        let val: AllowanceValue = env.storage().temporary()
            .get(&key)
            .unwrap_or(AllowanceValue { amount: 0, expiration_ledger: 0 });

        if env.ledger().sequence() > val.expiration_ledger {
            panic!("Allowance expired");
        }
        if val.amount < amount {
            panic!("Insufficient allowance");
        }

        env.storage().temporary().set(&key, &AllowanceValue {
            amount: val.amount - amount,
            expiration_ledger: val.expiration_ledger,
        });

        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("InsufficientBalance");
        }
        env.storage().persistent().set(&Balance(from.clone()), &(balance - amount));
        let total_supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(total_supply - amount));
        events::burned(&env, &from, amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let allowance = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowance < amount {
            panic!("InsufficientAllowance");
        }
        let key = Allowance(AllowanceDataKey { from: from.clone(), spender });
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        env.storage().temporary().set(&key, &(allowance - amount));
        env.storage().persistent().set(&Balance(from.clone()), &(balance - amount));

        let total_supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(total_supply - amount));

        events::burned(&env, &from, amount);
    }

    fn decimals(env: Env) -> u32 {
        env.storage().instance()
            .get(&Metadata(Decimals))
            .unwrap()
    }

    fn name(env: Env) -> String {
        env.storage().instance()
            .get(&Metadata(Name))
            .unwrap()
    }

    fn symbol(env: Env) -> String {
        env.storage().instance()
            .get(&Metadata(SymbolKey))
            .unwrap()
    }
}

impl TokenContract {
    fn balance_of(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&Balance(id)).unwrap_or(0)
    }

    fn transfer_impl(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }

        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        let to_balance = Self::balance_of(env.clone(), to.clone());
        let new_from_balance = from_balance.checked_sub(amount).ok_or(TokenError::Overflow)?;
        let new_to_balance = to_balance.checked_add(amount).ok_or(TokenError::Overflow)?;

        env.storage().persistent().set(&Balance(from.clone()), &new_from_balance);
        bump_persistent(&env, &Balance(from.clone()));

        env.storage().persistent().set(&Balance(to.clone()), &new_to_balance);
        bump_persistent(&env, &Balance(to.clone()));

        events::transferred(&env, &from, &to, amount);

        Ok(())
    }
}

mod test;
