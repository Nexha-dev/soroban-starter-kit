#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;

pub use errors::EscrowError;
pub use storage::{DataKey, EscrowInfo, EscrowState};

use soroban_sdk::{contract, contractimpl, Address, Env, token};
use storage::DataKey::{Amount, Arbiter, Buyer, Deadline, Seller, State, TokenContract};

/// Minimum TTL before a bump is needed (~7 days at 5s/ledger).
const BUMP_THRESHOLD: u32 = 120_960;
/// TTL extended to on every write (~30 days at 5s/ledger).
const BUMP_AMOUNT: u32 = 518_400;
/// Minimum ledgers from now a deadline must be set to (~8 minutes at 5s/ledger).
const MIN_DEADLINE_BUFFER: u32 = 100;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

/// Escrow contract for secure two-party transactions
/// 
/// This contract holds funds in escrow until conditions are met:
/// - Buyer deposits funds
/// - Seller can claim after buyer approval or timeout
/// - Buyer can get refund if seller doesn't deliver
/// - Arbiter can resolve disputes
#[contract]
pub struct EscrowContract;

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
        }

        if buyer == seller || buyer == arbiter || seller == arbiter {
            return Err(EscrowError::InvalidParties);
        }

        // Verify deadline is sufficiently in the future
        if deadline_ledger < env.ledger().sequence() + MIN_DEADLINE_BUFFER {
            return Err(EscrowError::DeadlinePassed);
        }

        // Issue #194: Validate token contract address by calling decimals()
        let token_client = token::Client::new(&env, &token_contract);
        let _ = token_client.decimals();

        // Store escrow details
        env.storage().instance().set(&Buyer, &buyer);
        env.storage().instance().set(&Seller, &seller);
        env.storage().instance().set(&Arbiter, &arbiter);
        env.storage().instance().set(&TokenContract, &token_contract);
        env.storage().instance().set(&Amount, &amount);
        env.storage().instance().set(&Deadline, &deadline_ledger);
        env.storage().instance().set(&State, &EscrowState::Created);
        bump_instance(&env);

        events::escrow_created(&env, &buyer, &seller, amount);

        Ok(())
    }

    /// Issue #192: Move require_auth() to top before any state reads
    pub fn fund(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        buyer.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }

        let amount: i128 = env.storage().instance().get(&Amount).ok_or(EscrowError::NotInitialized)?;
        let token_contract: Address = env.storage().instance().get(&TokenContract).ok_or(EscrowError::NotInitialized)?;

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        env.storage().instance().set(&State, &EscrowState::Funded);
        bump_instance(&env);

        events::escrow_funded(&env, &buyer, amount);

        Ok(())
    }

    pub fn mark_delivered(env: Env) -> Result<(), EscrowError> {
        let seller: Address = env.storage().instance().get(&Seller).ok_or(EscrowError::NotInitialized)?;
        seller.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Funded {
            return Err(EscrowError::InvalidState);
        }

        env.storage().instance().set(&State, &EscrowState::Delivered);
        bump_instance(&env);

        events::delivery_marked(&env, &seller);

        Ok(())
    }

    pub fn approve_delivery(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        buyer.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Delivered {
            return Err(EscrowError::InvalidState);
        }

        Self::release_to_seller(env)
    }

    pub fn request_refund(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        buyer.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        let deadline: u32 = env.storage().instance().get(&Deadline).ok_or(EscrowError::NotInitialized)?;

        let can_refund = matches!(state, EscrowState::Funded | EscrowState::Delivered)
            && env.ledger().sequence() > deadline;
        if !can_refund {
            return Err(EscrowError::DeadlineNotReached);
        }

        Self::refund_to_buyer(env)
    }

    /// Issue #193: Add raise_dispute() function
    pub fn raise_dispute(env: Env, caller: Address) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        let seller: Address = env.storage().instance().get(&Seller).ok_or(EscrowError::NotInitialized)?;

        if caller != buyer && caller != seller {
            return Err(EscrowError::NotAuthorized);
        }

        caller.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }

        env.storage().instance().set(&State, &EscrowState::Disputed);
        bump_instance(&env);

        Ok(())
    }

    /// Issue #193: Restrict resolve_dispute to Disputed state only
    pub fn resolve_dispute(env: Env, release_to_seller: bool) -> Result<(), EscrowError> {
        let arbiter: Address = env.storage().instance().get(&Arbiter).ok_or(EscrowError::NotInitialized)?;
        arbiter.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Disputed {
            return Err(EscrowError::InvalidState);
        }

        if release_to_seller {
            Self::release_to_seller(env)
        } else {
            Self::refund_to_buyer(env)
        }
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
    }
}

impl EscrowContract {
    fn release_to_seller(env: Env) -> Result<(), EscrowError> {
        let seller: Address = env.storage().instance().get(&Seller).ok_or(EscrowError::NotInitialized)?;
        let token_contract: Address = env.storage().instance().get(&TokenContract).ok_or(EscrowError::NotInitialized)?;
        let amount: i128 = env.storage().instance().get(&Amount).ok_or(EscrowError::NotInitialized)?;

        env.storage().instance().set(&State, &EscrowState::Completed);

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &seller, &amount);

        bump_instance(&env);
        events::funds_released(&env, &seller, amount);

        Ok(())
    }

    fn refund_to_buyer(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        let token_contract: Address = env.storage().instance().get(&TokenContract).ok_or(EscrowError::NotInitialized)?;
        let amount: i128 = env.storage().instance().get(&Amount).ok_or(EscrowError::NotInitialized)?;

        env.storage().instance().set(&State, &EscrowState::Refunded);

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &buyer, &amount);

        bump_instance(&env);
        events::funds_refunded(&env, &buyer, amount);

        Ok(())
    }
}
