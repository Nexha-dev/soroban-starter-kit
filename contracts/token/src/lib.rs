#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;

pub use errors::TokenError;
pub use storage::{AllowanceDataKey, DataKey, MetadataKey};
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, panic_with_error, token, Address, Env, String, Symbol,
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Symbol,
};
use soroban_sdk::token::TokenInterface;

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
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(AllowanceDataKey),
    Metadata(MetadataKey),
    TotalSupply,
}

use soroban_sdk::{contract, contractimpl, Address, Env, String};

use admin::require_admin;
use storage::DataKey::{Admin, Allowance, Balance, Metadata, TotalSupply};
use storage::MetadataKey::{Decimals, Name, Symbol};

#[contract]
pub struct TokenContract;
/// Custom errors for the token contract
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum TokenError {
    InsufficientBalance = 1,
    InsufficientAllowance = 2,
    Unauthorized = 3,
    AlreadyInitialized = 4,
    NotInitialized = 5,
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
        env.storage().instance().set(&Metadata(Symbol), &symbol);
        env.storage().instance().set(&Metadata(Decimals), &decimals);
        env.storage().instance().set(&TotalSupply, &0i128);
        events::initialized(&env, &admin, name, symbol, decimals);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Metadata(MetadataKey::Name), &name);
        env.storage().instance().set(&DataKey::Metadata(MetadataKey::Symbol), &symbol);
        env.storage().instance().set(&DataKey::Metadata(MetadataKey::Decimals), &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        bump_instance(&env);

        env.events().publish((Symbol::new(&env, "initialize"), admin.clone()), (name, symbol, decimals));

        Ok(())
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        if amount < 0 { panic!("Amount must be non-negative"); }
        let balance = Self::balance_of(env.clone(), to.clone());
        env.storage().persistent().set(&Balance(to.clone()), &(balance + amount));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply + amount));
        events::minted(&env, &to, amount);
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;

        admin.require_auth();

        let balance = Self::balance_of(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(balance + amount));
        let new_balance = balance + amount;
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &new_balance);
        bump_persistent(&env, &DataKey::Balance(to.clone()));

        let total_supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply + amount));
        bump_instance(&env);

        env.events().publish((Symbol::new(&env, "mint"), to), amount);

        Ok(())
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        if amount < 0 { panic!("Amount must be non-negative"); }
        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount { return Err(TokenError::InsufficientBalance); }
        env.storage().persistent().set(&Balance(from.clone()), &(balance - amount));
        let supply: i128 = env.storage().instance().get(&TotalSupply).unwrap_or(0);
        env.storage().instance().set(&TotalSupply, &(supply - amount));
        events::burned(&env, &from, amount);
        if balance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        // Update balance
        let new_balance = balance - amount;
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &new_balance);
        bump_persistent(&env, &DataKey::Balance(from.clone()));

        // Update total supply
        let total_supply: i128 = env.storage().instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply - amount));
        bump_instance(&env);

        // Emit event
        env.events().publish((Symbol::new(&env, "burn"), from), amount);

        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), TokenError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&Admin, &new_admin);
        events::admin_set(&env, &new_admin);
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        bump_instance(&env);
        
        // Emit event
        env.events().publish((Symbol::new(&env, "set_admin"),), new_admin);

        Ok(())
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&Admin).unwrap()
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&Metadata(Name)).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&Metadata(Symbol)).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&Metadata(Decimals)).unwrap()
        env.storage().instance().get(&DataKey::Admin).unwrap()
    pub fn admin(env: Env) -> Result<Address, TokenError> {
        env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)
    }

    /// Get token name
    pub fn name(env: Env) -> Result<String, TokenError> {
        env.storage().instance()
            .get(&DataKey::Metadata(MetadataKey::Name))
            .ok_or(TokenError::NotInitialized)
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> Result<String, TokenError> {
        env.storage().instance()
            .get(&DataKey::Metadata(MetadataKey::Symbol))
            .ok_or(TokenError::NotInitialized)
    }

    /// Get token decimals
    pub fn decimals(env: Env) -> Result<u32, TokenError> {
        env.storage().instance()
            .get(&DataKey::Metadata(MetadataKey::Decimals))
            .ok_or(TokenError::NotInitialized)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&TotalSupply).unwrap_or(0)
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = Allowance(AllowanceDataKey { from, spender });
        env.storage().temporary().get(&key).unwrap_or(0)
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        let key = Allowance(AllowanceDataKey { from: from.clone(), spender: spender.clone() });
        env.storage().temporary().set(&key, &amount);
        if expiration_ledger > env.ledger().sequence() {
            env.storage().temporary().extend_ttl(&key, expiration_ledger, expiration_ledger);
        }
        events::approved(&env, &from, &spender, amount);

        env.events().publish((Symbol::new(&env, "approve"), from, spender), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        Self::balance_of(env, id)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(balance - amount));

        let total_supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply - amount));

        env.events().publish((Symbol::new(&env, "burn"), from), amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();

        let key = DataKey::Allowance(AllowanceDataKey { from: from.clone(), spender });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        if allowance < amount {
            panic!("Insufficient allowance");
        }

        let balance = Self::balance_of(env.clone(), from.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        env.storage().temporary().set(&key, &(allowance - amount));
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(balance - amount));

        let total_supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply - amount));

        env.events().publish((Symbol::new(&env, "burn_from"), from), amount);
    }

    fn decimals(env: Env) -> u32 {
        env.storage().instance()
            .get(&DataKey::Metadata(MetadataKey::Decimals))
            .unwrap()
    }

    fn name(env: Env) -> String {
        env.storage().instance()
            .get(&DataKey::Metadata(MetadataKey::Name))
            .unwrap()
    }

    fn symbol(env: Env) -> String {
        env.storage().instance()
            .get(&DataKey::Metadata(MetadataKey::Symbol))
            .unwrap()
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let key = Allowance(AllowanceDataKey { from: from.clone(), spender: spender.clone() });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        if allowance < amount { panic!("Insufficient allowance"); }
        env.storage().temporary().set(&key, &(allowance - amount));

        let key = DataKey::Allowance(AllowanceDataKey { from: from.clone(), spender: spender.clone() });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        if allowance < amount {
            panic!("Insufficient allowance");
        }

        env.storage().temporary().set(&key, &(allowance - amount));

        // Perform transfer
        if let Err(e) = Self::transfer_impl(env.clone(), from, to, amount) {
            panic_with_error!(&env, e);
        }
        Self::transfer_impl(env, from, to, amount).unwrap();
    }
}

impl TokenContract {
    fn balance_of(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&Balance(id)).unwrap_or(0)
    }

    fn transfer_impl(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount < 0 { panic!("Amount must be non-negative"); }
        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount { return Err(TokenError::InsufficientBalance); }
        let to_balance: i128 = env.storage().persistent().get(&Balance(to.clone())).unwrap_or(0);
        env.storage().persistent().set(&Balance(from.clone()), &(from_balance - amount));
        env.storage().persistent().set(&Balance(to.clone()), &(to_balance + amount));
        events::transferred(&env, &from, &to, amount);
        Ok(())
    }
}
        env.storage().persistent().get(&DataKey::Balance(id)).unwrap_or(0)
    }

    fn transfer_impl(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        let from_balance = Self::balance_of(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_balance - amount));

        bump_persistent(&env, &DataKey::Balance(from.clone()));
        
        let to_balance = Self::balance_of(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_balance + amount));
        bump_persistent(&env, &DataKey::Balance(to.clone()));

        env.events().publish((Symbol::new(&env, "transfer"), from, to), amount);

        Ok(())
    }
}

mod test;
