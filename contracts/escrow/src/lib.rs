#![no_std]

mod admin;
mod errors;
mod events;
mod storage;
mod test;

pub use errors::EscrowError;
pub use storage::{DataKey, EscrowInfo, EscrowState};

use storage::DataKey::{Amount, Arbiter, Buyer, BuyerApproved, Deadline, Seller, SellerDelivered, State, TokenContract};

use soroban_sdk::{contract, contractimpl, token, Address, Env, Symbol};

/// Minimum TTL before a bump is needed (~7 days at 5s/ledger).
const BUMP_THRESHOLD: u32 = 120_960;
/// TTL extended to on every write (~30 days at 5s/ledger).
const BUMP_AMOUNT: u32 = 518_400;
/// Minimum ledgers from now a deadline must be set to (~8 minutes at 5s/ledger).
const MIN_DEADLINE_BUFFER: u32 = 100;

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

/// Escrow contract for secure two-party transactions.
///
/// Lifecycle: `Created → Funded → Delivered → Completed`
/// with side exits to `Refunded` (deadline-based) or `Cancelled` (pre-fund).
#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a new escrow.
    ///
    /// Sets up all parties, the token contract, the escrowed amount, and the
    /// deadline. Must be called exactly once.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::AlreadyInitialized`] – contract has already been initialized.
    /// - [`EscrowError::InvalidAmount`] – `amount` is zero or negative.
    ///
    /// # Panics
    ///
    /// Panics if `deadline_ledger` is less than
    /// `env.ledger().sequence() + MIN_DEADLINE_BUFFER`.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.initialize(
    ///     &buyer, &seller, &arbiter, &token_id,
    ///     &1_000_0000000i128,
    ///     &(env.ledger().sequence() + 10_000),
    /// );
    /// ```
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
        if deadline_ledger < env.ledger().sequence() + MIN_DEADLINE_BUFFER {
            panic!("Deadline must be at least MIN_DEADLINE_BUFFER ledgers in the future");
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
        bump_instance(&env);
        events::escrow_created(&env, &buyer, &seller, amount);
        Ok(())
    }

    /// Buyer funds the escrow by transferring tokens to the contract.
    ///
    /// Requires authorization from the buyer. The escrow must be in the
    /// `Created` state.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::InvalidState`] – escrow is not in `Created` state.
    ///
    /// # Panics
    ///
    /// Panics if `buyer.require_auth()` fails or if the token transfer fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.fund(); // called by buyer
    /// ```
    pub fn fund(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let token_contract: Address = env.storage().instance().get(&TokenContract).unwrap();
        let amount: i128 = env.storage().instance().get(&Amount).unwrap();
        buyer.require_auth();
        token::Client::new(&env, &token_contract).transfer(
            &buyer,
            &env.current_contract_address(),
            &amount,
        );
        env.storage().instance().set(&State, &EscrowState::Funded);
        bump_instance(&env);
        events::escrow_funded(&env, &buyer, amount);
        Ok(())
    }

    /// Seller marks goods/services as delivered.
    ///
    /// Requires authorization from the seller. The escrow must be in the
    /// `Funded` state.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::InvalidState`] – escrow is not in `Funded` state.
    ///
    /// # Panics
    ///
    /// Panics if `seller.require_auth()` fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.mark_delivered(); // called by seller
    /// ```
    pub fn mark_delivered(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Funded {
            return Err(EscrowError::InvalidState);
        }
        let seller: Address = env.storage().instance().get(&Seller).unwrap();
        seller.require_auth();
        env.storage().instance().set(&SellerDelivered, &true);
        env.storage().instance().set(&State, &EscrowState::Delivered);
        bump_instance(&env);
        events::delivery_marked(&env, &seller);
        Ok(())
    }

    /// Buyer approves delivery, releasing funds to the seller.
    ///
    /// Requires authorization from the buyer. The escrow must be in the
    /// `Delivered` state.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::InvalidState`] – escrow is not in `Delivered` state.
    ///
    /// # Panics
    ///
    /// Panics if `buyer.require_auth()` fails or if the token transfer fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.approve_delivery(); // called by buyer after delivery
    /// ```
    pub fn approve_delivery(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Delivered {
            return Err(EscrowError::InvalidState);
        }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        buyer.require_auth();
        env.storage().instance().set(&BuyerApproved, &true);
        Self::release_to_seller(env)
    }

    /// Buyer requests a refund after the deadline has passed.
    ///
    /// Requires authorization from the buyer. The escrow must be in `Funded`
    /// or `Delivered` state and the current ledger must be past `deadline`.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::DeadlineNotReached`] – deadline has not yet passed or
    ///   the escrow is in an ineligible state.
    ///
    /// # Panics
    ///
    /// Panics if `buyer.require_auth()` fails or if the token transfer fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// // Advance ledger past deadline, then:
    /// escrow_client.request_refund(); // called by buyer
    /// ```
    pub fn request_refund(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let deadline: u32 = env.storage().instance().get(&Deadline).unwrap();
        buyer.require_auth();
        let can_refund = matches!(state, EscrowState::Funded | EscrowState::Delivered)
            && env.ledger().sequence() > deadline;
        if !can_refund {
            return Err(EscrowError::DeadlineNotReached);
        }
        Self::refund_to_buyer(env)
    }

    /// Arbiter resolves a dispute.
    ///
    /// Requires authorization from the arbiter. The escrow must be in `Funded`
    /// or `Delivered` state.
    ///
    /// If `release_to_seller` is `true`, funds go to the seller; otherwise
    /// they are refunded to the buyer.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::InvalidState`] – escrow is not in a disputable state.
    ///
    /// # Panics
    ///
    /// Panics if `arbiter.require_auth()` fails or if the token transfer fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.resolve_dispute(&true);  // release to seller
    /// escrow_client.resolve_dispute(&false); // refund to buyer
    /// ```
    pub fn resolve_dispute(env: Env, release_to_seller: bool) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }
        let arbiter: Address = env.storage().instance().get(&Arbiter).unwrap();
        arbiter.require_auth();
        if release_to_seller {
            Self::release_to_seller(env)
        } else {
            Self::refund_to_buyer(env)
        }
    }

    /// Buyer partially releases `amount` tokens to the seller.
    ///
    /// Requires authorization from the buyer. The escrow must be in `Funded`
    /// or `Delivered` state.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::InvalidState`] – escrow is not in an eligible state.
    /// - [`EscrowError::InsufficientFunds`] – `amount` exceeds the escrowed balance.
    ///
    /// # Panics
    ///
    /// Panics if `buyer.require_auth()` fails or if the token transfer fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.release_partial(&250_0000000i128);
    /// ```
    pub fn release_partial(env: Env, amount: i128) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        buyer.require_auth();
        let stored_amount: i128 = env.storage().instance().get(&Amount).unwrap();
        if amount > stored_amount {
            return Err(EscrowError::InsufficientFunds);
        }
        let seller: Address = env.storage().instance().get(&Seller).unwrap();
        let token_contract: Address = env.storage().instance().get(&TokenContract).unwrap();
        token::Client::new(&env, &token_contract).transfer(
            &env.current_contract_address(),
            &seller,
            &amount,
        );
        env.storage().instance().set(&Amount, &(stored_amount - amount));
        bump_instance(&env);
        env.events()
            .publish((Symbol::new(&env, "partial_release"), seller), amount);
        Ok(())
    }

    /// Buyer cancels an unfunded escrow (`Created` state only).
    ///
    /// Requires authorization from the buyer.
    ///
    /// # Errors
    ///
    /// - [`EscrowError::NotInitialized`] – contract has not been initialized.
    /// - [`EscrowError::InvalidState`] – escrow is not in `Created` state.
    ///
    /// # Panics
    ///
    /// Panics if `buyer.require_auth()` fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.cancel(); // called by buyer before funding
    /// ```
    pub fn cancel(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        buyer.require_auth();
        env.storage().instance().set(&State, &EscrowState::Cancelled);
        bump_instance(&env);
        env.events()
            .publish((Symbol::new(&env, "escrow_cancelled"), buyer), ());
        Ok(())
    }

    /// Extend storage TTL. Anyone can call this to keep an active escrow alive.
    ///
    /// # Panics
    ///
    /// Panics with `"Not initialized"` if the contract has not been initialized.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// escrow_client.bump(); // extend TTL before it expires
    /// ```
    pub fn bump(env: Env) {
        if !env.storage().instance().has(&State) {
            panic!("Not initialized");
        }
        bump_instance(&env);
    }

    /// Return full escrow details as an [`EscrowInfo`] struct.
    ///
    /// # Panics
    ///
    /// Panics if any required storage key is absent (contract not initialized).
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let info: EscrowInfo = escrow_client.get_escrow_info();
    /// assert_eq!(info.state, EscrowState::Funded);
    /// ```
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

    /// Return the current [`EscrowState`], or `None` if not initialized.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let state: Option<EscrowState> = escrow_client.get_state();
    /// ```
    pub fn get_state(env: Env) -> Option<EscrowState> {
        env.storage().instance().get(&State)
    }

    /// Return `true` if the deadline ledger has been passed.
    ///
    /// Returns `false` if the contract has not been initialized (deadline
    /// defaults to `0`).
    ///
    /// # Examples
    ///
    /// ```ignore
    /// if escrow_client.is_deadline_passed() {
    ///     escrow_client.request_refund();
    /// }
    /// ```
    pub fn is_deadline_passed(env: Env) -> bool {
        let deadline: u32 = env.storage().instance().get(&Deadline).unwrap_or(0);
        env.ledger().sequence() > deadline
    }
}

impl EscrowContract {
    /// Release funds to seller (CEI: state updated before transfer).
    fn release_to_seller(env: Env) -> Result<(), EscrowError> {
        let seller: Address = env.storage().instance().get(&Seller).unwrap();
        let token_contract: Address = env.storage().instance().get(&TokenContract).unwrap();
        let amount: i128 = env.storage().instance().get(&Amount).unwrap();
        // Effects before interactions
        env.storage().instance().set(&State, &EscrowState::Completed);
        bump_instance(&env);
        token::Client::new(&env, &token_contract).transfer(
            &env.current_contract_address(),
            &seller,
            &amount,
        );
        events::funds_released(&env, &seller, amount);
        Ok(())
    }

    /// Refund funds to buyer (CEI: state updated before transfer).
    fn refund_to_buyer(env: Env) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let token_contract: Address = env.storage().instance().get(&TokenContract).unwrap();
        let amount: i128 = env.storage().instance().get(&Amount).unwrap();
        // Effects before interactions
        env.storage().instance().set(&State, &EscrowState::Refunded);
        bump_instance(&env);
        token::Client::new(&env, &token_contract).transfer(
            &env.current_contract_address(),
            &buyer,
            &amount,
        );
        events::funds_refunded(&env, &buyer, amount);
        Ok(())
    }
}
