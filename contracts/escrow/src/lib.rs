#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token, Address, Env, Symbol,
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Symbol,
};

/// Minimum TTL before a bump is needed (~7 days at 5s/ledger).
const BUMP_THRESHOLD: u32 = 120_960;
/// TTL extended to on every write (~30 days at 5s/ledger).
const BUMP_AMOUNT: u32 = 518_400;
/// Minimum ledgers from now a deadline must be set to (~8 minutes at 5s/ledger).
const MIN_DEADLINE_BUFFER: u32 = 100;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}
 /// script
/// Escrow contract for secure two-party transactions
/// 
/// This contract holds funds in escrow until conditions are met:
/// - Buyer deposits funds
/// - Seller can claim after buyer approval or timeout
/// - Buyer can get refund if seller doesn't deliver
/// - Arbiter can resolve disputes
#[contract]
pub struct EscrowContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Buyer,
    Seller,
    Arbiter,
    TokenContract,
    Amount,
    Deadline,
    State,
}
pub use errors::EscrowError;
pub use storage::{DataKey, EscrowInfo, EscrowState};

use soroban_sdk::{contract, contractimpl, Address, Env};

use admin::transfer_token;
use storage::DataKey::{Amount, Arbiter, Buyer, BuyerApproved, Deadline, Seller, SellerDelivered, State, TokenContract};

#[contract]
pub struct EscrowContract;
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EscrowState {
    Created = 0,
    Funded = 1,
    Delivered = 2,
    Completed = 3,
    Refunded = 4,
    Cancelled = 5,
}

/// Custom errors for the escrow contract
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum EscrowError {
    NotAuthorized = 1,
    InvalidState = 2,
    DeadlinePassed = 3,
    DeadlineNotReached = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    InsufficientFunds = 7,
    InvalidAmount = 8,
    InvalidParties = 8,
}

#[contractimpl]
impl EscrowContract {
    pub fn initialize(
        env: Env,
        buyer: Address,
        seller: Address,
        arbiter: Address,
        token_contract: Address,
        amount: i128,
        deadline_ledger: u32,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&State) {
            return Err(EscrowError::AlreadyInitialized);
        }

        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        if buyer == seller || buyer == arbiter || seller == arbiter {
            return Err(EscrowError::InvalidParties);
        }

        // Verify deadline is in the future
        if deadline_ledger <= env.ledger().sequence() {
            panic!("Deadline must be in the future");
        }
        env.storage().instance().set(&Buyer, &buyer);
        env.storage().instance().set(&Seller, &seller);
        env.storage().instance().set(&Arbiter, &arbiter);
        env.storage().instance().set(&TokenContract, &token_contract);
        env.storage().instance().set(&Amount, &amount);
        env.storage().instance().set(&Deadline, &deadline_ledger);
        env.storage().instance().set(&State, &EscrowState::Created);
        env.storage().instance().set(&BuyerApproved, &false);
        env.storage().instance().set(&SellerDelivered, &false);
        events::escrow_created(&env, &buyer, &seller, amount);

        // Verify deadline is sufficiently in the future
        if deadline_ledger < env.ledger().sequence() + MIN_DEADLINE_BUFFER {
            panic!("Deadline must be at least MIN_DEADLINE_BUFFER ledgers in the future");
        }

        // Store escrow details
        env.storage().instance().set(&DataKey::Buyer, &buyer);
        env.storage().instance().set(&DataKey::Seller, &seller);
        env.storage().instance().set(&DataKey::Arbiter, &arbiter);
        env.storage().instance().set(&DataKey::TokenContract, &token_contract);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::Deadline, &deadline_ledger);
        env.storage().instance().set(&DataKey::State, &EscrowState::Created);
        env.storage().instance().set(&DataKey::BuyerApproved, &false);
        env.storage().instance().set(&DataKey::SellerDelivered, &false);
        bump_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "escrow_created"), buyer.clone(), seller.clone()),
            amount,
        );

        Ok(())
    }

    pub fn fund(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Created { return Err(EscrowError::InvalidState); }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let amount: i128 = env.storage().instance().get(&Amount).unwrap();
        buyer.require_auth();
        transfer_token(&env, &buyer, &env.current_contract_address(), amount);
        env.storage().instance().set(&State, &EscrowState::Funded);
        events::escrow_funded(&env, &buyer, amount);

        // Transfer tokens from buyer to contract
        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        // Update state
        env.storage().instance().set(&DataKey::State, &EscrowState::Funded);
        bump_instance(&env);

        // Emit event
        env.events().publish((Symbol::new(&env, "escrow_funded"), buyer), amount);

        Ok(())
    }

    pub fn mark_delivered(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Funded { return Err(EscrowError::InvalidState); }
        let seller: Address = env.storage().instance().get(&Seller).unwrap();
        seller.require_auth();
        env.storage().instance().set(&SellerDelivered, &true);
        env.storage().instance().set(&State, &EscrowState::Delivered);
        events::delivery_marked(&env, &seller);

        // Mark as delivered
        env.storage().instance().set(&DataKey::State, &EscrowState::Delivered);
        bump_instance(&env);

        // Emit event
        env.events().publish((Symbol::new(&env, "delivery_marked"), seller), ());

        Ok(())
    }

    pub fn approve_delivery(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Delivered { return Err(EscrowError::InvalidState); }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        buyer.require_auth();
        Self::release_to_seller(env)
    }

    pub fn request_refund(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let deadline: u32 = env.storage().instance().get(&Deadline).unwrap();
        buyer.require_auth();
        let can_refund = matches!(state, EscrowState::Funded | EscrowState::Delivered)
            && env.ledger().sequence() > deadline;
        if !can_refund { return Err(EscrowError::DeadlineNotReached); }
        Self::refund_to_buyer(env)
    }

    pub fn resolve_dispute(env: Env, release_to_seller: bool) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }
        let arbiter: Address = env.storage().instance().get(&Arbiter).unwrap();
        arbiter.require_auth();
        if release_to_seller { Self::release_to_seller(env) } else { Self::refund_to_buyer(env) }
    }

    pub fn get_escrow_info(env: Env) -> EscrowInfo {
        EscrowInfo {
            buyer: env.storage().instance().get(&Buyer).unwrap(),
            seller: env.storage().instance().get(&Seller).unwrap(),
            arbiter: env.storage().instance().get(&Arbiter).unwrap(),
            token_contract: env.storage().instance().get(&TokenContract).unwrap(),
            amount: env.storage().instance().get(&Amount).unwrap(),
            deadline: env.storage().instance().get(&Deadline).unwrap(),
            state: env.storage().instance().get(&State).unwrap(),
        }
    }

    pub fn get_state(env: Env) -> EscrowState {
        env.storage().instance().get(&State).unwrap_or(EscrowState::Created)
    /// Buyer partially releases funds to seller, reducing the stored amount
    pub fn release_partial(env: Env, amount: i128) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance()
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;

        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }

        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        buyer.require_auth();

        let stored_amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        if amount > stored_amount {
            return Err(EscrowError::InsufficientFunds);
        }

        let seller: Address = env.storage().instance().get(&DataKey::Seller).unwrap();
        let token_contract: Address = env.storage().instance().get(&DataKey::TokenContract).unwrap();

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &seller, &amount);

        env.storage().instance().set(&DataKey::Amount, &(stored_amount - amount));

        env.events().publish((Symbol::new(&env, "partial_release"), seller), amount);

        Ok(())
    }

    /// Buyer cancels an unfunded escrow in Created state
    pub fn cancel(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance()
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;

        if state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }

        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        buyer.require_auth();

        env.storage().instance().set(&DataKey::State, &EscrowState::Cancelled);

        env.events().publish((Symbol::new(&env, "escrow_cancelled"), buyer), ());

        Ok(())
    }

    /// Get escrow details
    pub fn get_escrow_info(env: Env) -> Result<(Address, Address, Address, Address, i128, u32, EscrowState), EscrowError> {
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).ok_or(EscrowError::NotInitialized)?;
        let seller: Address = env.storage().instance().get(&DataKey::Seller).ok_or(EscrowError::NotInitialized)?;
        let arbiter: Address = env.storage().instance().get(&DataKey::Arbiter).ok_or(EscrowError::NotInitialized)?;
        let token_contract: Address = env.storage().instance().get(&DataKey::TokenContract).ok_or(EscrowError::NotInitialized)?;
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).ok_or(EscrowError::NotInitialized)?;
        let deadline: u32 = env.storage().instance().get(&DataKey::Deadline).ok_or(EscrowError::NotInitialized)?;
        let state: EscrowState = env.storage().instance().get(&DataKey::State).ok_or(EscrowError::NotInitialized)?;

        Ok((buyer, seller, arbiter, token_contract, amount, deadline, state))
    }

    /// Get current state
    pub fn get_state(env: Env) -> Option<EscrowState> {
        env.storage().instance().get(&DataKey::State)
    }

    pub fn is_deadline_passed(env: Env) -> bool {
        let deadline: u32 = env.storage().instance().get(&Deadline).unwrap_or(0);
        env.ledger().sequence() > deadline
    }
}

impl EscrowContract {
    fn release_to_seller(env: Env) -> Result<(), EscrowError> {
        let seller: Address = env.storage().instance().get(&Seller).unwrap();
        let amount: i128 = env.storage().instance().get(&Amount).unwrap();
        transfer_token(&env, &env.current_contract_address(), &seller, amount);
        env.storage().instance().set(&State, &EscrowState::Completed);
        events::funds_released(&env, &seller, amount);
    /// Extend storage TTL for an active escrow. Anyone can call this.
    pub fn bump(env: Env) {
        if !env.storage().instance().has(&DataKey::State) {
            panic!("Not initialized");
        }
        bump_instance(&env);
    }

    // Internal helper functions
    fn release_to_seller(env: Env) -> Result<(), EscrowError> {
        let seller: Address = env.storage().instance().get(&DataKey::Seller).unwrap();
        let token_contract: Address = env.storage().instance().get(&DataKey::TokenContract).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();

        // Update state before transfer (checks-effects-interactions)
        env.storage().instance().set(&DataKey::State, &EscrowState::Completed);

        // Transfer tokens to seller
        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &seller, &amount);

        // Update state
        env.storage().instance().set(&DataKey::State, &EscrowState::Completed);
        bump_instance(&env);

        // Emit event
        env.events().publish((Symbol::new(&env, "funds_released"), seller), amount);

        Ok(())
    }

    fn refund_to_buyer(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let amount: i128 = env.storage().instance().get(&Amount).unwrap();
        transfer_token(&env, &env.current_contract_address(), &buyer, amount);
        env.storage().instance().set(&State, &EscrowState::Refunded);
        events::funds_refunded(&env, &buyer, amount);
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        let token_contract: Address = env.storage().instance().get(&DataKey::TokenContract).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();

        // Update state before transfer (checks-effects-interactions)
        env.storage().instance().set(&DataKey::State, &EscrowState::Refunded);

        // Transfer tokens back to buyer
        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &buyer, &amount);

        // Update state
        env.storage().instance().set(&DataKey::State, &EscrowState::Refunded);
        bump_instance(&env);

        // Emit event
        env.events().publish((Symbol::new(&env, "funds_refunded"), buyer), amount);

        Ok(())
    }
}
