#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Symbol,
};
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
    BuyerApproved,
    SellerDelivered,
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EscrowState {
    Created = 0,
    Funded = 1,
    Delivered = 2,
    Completed = 3,
    Refunded = 4,
    Disputed = 5,
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
/// Custom errors for the escrow contract
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum EscrowError {
    NotAuthorized = 1,
    InvalidState = 2,
    DeadlinePassed = 3,
    DeadlineNotReached = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    InsufficientFunds = 7,
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
        }

        if buyer == seller || buyer == arbiter || seller == arbiter {
            return Err(EscrowError::InvalidParties);
        }

        // Verify deadline is sufficiently in the future
        if deadline_ledger < env.ledger().sequence() + MIN_DEADLINE_BUFFER {
            return Err(EscrowError::InvalidAmount);
            return Err(EscrowError::DeadlinePassed);
        }

        // Issue #194: Validate token contract address by calling decimals()
        let token_client = token::Client::new(&env, &token_contract);
        let _ = token_client.decimals();

        // Store escrow details
        env.storage().instance().set(&DataKey::Buyer, &buyer);
        env.storage().instance().set(&DataKey::Seller, &seller);
        env.storage().instance().set(&DataKey::Arbiter, &arbiter);
        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage()
            .instance()
            .set(&DataKey::Deadline, &deadline_ledger);
        env.storage()
            .instance()
            .set(&DataKey::State, &EscrowState::Created);
        env.storage()
            .instance()
            .set(&DataKey::BuyerApproved, &false);
        env.storage()
            .instance()
            .set(&DataKey::SellerDelivered, &false);

        // Emit event
        env.events().publish(
            (
                Symbol::new(&env, "escrow_created"),
                buyer.clone(),
                seller.clone(),
            ),
            amount,
        );

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
    /// Issue #192: Move require_auth() to top before any state reads
    pub fn fund(env: Env) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        buyer.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Created {
            return Err(EscrowError::InvalidState);
        }

        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        let token_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        // Update state
        env.storage()
            .instance()
            .set(&DataKey::State, &EscrowState::Funded);

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "escrow_funded"), buyer), amount);

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
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;
        let seller: Address = env.storage().instance().get(&Seller).ok_or(EscrowError::NotInitialized)?;
        seller.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Funded {
            return Err(EscrowError::InvalidState);
        }

        let seller: Address = env.storage().instance().get(&DataKey::Seller).unwrap();
        seller.require_auth();

        // Mark as delivered
        env.storage()
            .instance()
            .set(&DataKey::SellerDelivered, &true);
        env.storage()
            .instance()
            .set(&DataKey::State, &EscrowState::Delivered);

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "delivery_marked"), seller), ());

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
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        buyer.require_auth();

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
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        let deadline: u32 = env.storage().instance().get(&Deadline).unwrap();
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
        Self::require_not_paused(&env)?;
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Disputed {
            return Err(EscrowError::InvalidState);
        }
        let arbiter: Address = env.storage().instance().get(&Arbiter).unwrap();
        arbiter.require_auth();
        if release_to_seller {
            Self::release_to_seller(env)
        } else {
            Self::refund_to_buyer(env)
    /// Issue #193: Add raise_dispute() function
    pub fn raise_dispute(env: Env, caller: Address) -> Result<(), EscrowError> {
        let buyer: Address = env.storage().instance().get(&Buyer).ok_or(EscrowError::NotInitialized)?;
        let seller: Address = env.storage().instance().get(&Seller).ok_or(EscrowError::NotInitialized)?;

        if caller != buyer && caller != seller {
            return Err(EscrowError::NotAuthorized);
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
    /// Buyer or seller raises a dispute.
    pub fn raise_dispute(env: Env) -> Result<(), EscrowError> {
        Self::require_not_paused(&env)?;
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }
        let buyer: Address = env.storage().instance().get(&Buyer).unwrap();
        
        // Try buyer first, if not buyer then must be seller
        buyer.require_auth();
        
        env.storage().instance().set(&State, &EscrowState::Disputed);
        bump_instance(&env);
        env.events()
            .publish((Symbol::new(&env, "dispute_raised"), buyer), ());
        Ok(())
    }

    /// Arbiter resolves dispute (can release to either party)
    pub fn resolve_dispute(env: Env, release_to_seller: bool) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;
        caller.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if !matches!(state, EscrowState::Funded | EscrowState::Delivered) {
            return Err(EscrowError::InvalidState);
        }

        env.storage().instance().set(&State, &EscrowState::Disputed);
        bump_instance(&env);

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
        Self::require_not_paused(&env)?;
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Created {
    /// Issue #193: Restrict resolve_dispute to Disputed state only
    pub fn resolve_dispute(env: Env, release_to_seller: bool) -> Result<(), EscrowError> {
        let arbiter: Address = env.storage().instance().get(&Arbiter).ok_or(EscrowError::NotInitialized)?;
        arbiter.require_auth();

        let state: EscrowState = env.storage().instance().get(&State).ok_or(EscrowError::NotInitialized)?;
        if state != EscrowState::Disputed {
            return Err(EscrowError::InvalidState);
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
    pub fn bump(env: Env) -> Result<(), EscrowError> {
        if !env.storage().instance().has(&State) {
            return Err(EscrowError::NotInitialized);
        }
        bump_instance(&env);
        Ok(())
        if release_to_seller {
            Self::release_to_seller(env)
        } else {
            Self::refund_to_buyer(env)
        }
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
    pub fn get_state(env: Env) -> EscrowState {
        env.storage().instance().get(&State).unwrap_or(EscrowState::Created)
    }

    /// Pause the contract. Admin only.
    pub fn pause(env: Env) -> Result<(), EscrowError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage().instance().set(&Paused, &true);
        bump_instance(&env);
        Ok(())
    }

    /// Get escrow details
    pub fn get_escrow_info(
        env: Env,
    ) -> (Address, Address, Address, Address, i128, u32, EscrowState) {
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        let seller: Address = env.storage().instance().get(&DataKey::Seller).unwrap();
        let arbiter: Address = env.storage().instance().get(&DataKey::Arbiter).unwrap();
        let token_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        let deadline: u32 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();

        (
            buyer,
            seller,
            arbiter,
            token_contract,
            amount,
            deadline,
            state,
        )
    }

    /// Get current state
    pub fn get_state(env: Env) -> EscrowState {
        env.storage()
            .instance()
            .get(&DataKey::State)
            .unwrap_or(EscrowState::Created)
    }

    /// Check if deadline has passed
    pub fn is_deadline_passed(env: Env) -> bool {
        let deadline: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Deadline)
            .unwrap_or(0);
        env.ledger().sequence() > deadline
    }

    /// Upgrade the contract to a new WASM hash. Admin only.
    pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) -> Result<(), EscrowError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

impl EscrowContract {
    fn require_state(env: &Env, expected: EscrowState) -> Result<(), EscrowError> {
        let state: EscrowState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .ok_or(EscrowError::NotInitialized)?;
        if state != expected {
            return Err(EscrowError::InvalidState);
        }
        Ok(())
    }

    fn release_to_seller(env: Env) -> Result<(), EscrowError> {
        Self::require_state(&env, EscrowState::Delivered)?;
        let seller: Address = env.storage().instance().get(&DataKey::Seller).unwrap();
        let token_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &seller, &amount);

        // Update state
        env.storage()
            .instance()
            .set(&DataKey::State, &EscrowState::Completed);

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "funds_released"), seller), amount);

        Ok(())
    }

    fn refund_to_buyer(env: Env) -> Result<(), EscrowError> {
        Self::require_state(&env, EscrowState::Funded)?;
        let buyer: Address = env.storage().instance().get(&DataKey::Buyer).unwrap();
        let token_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();

        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&env.current_contract_address(), &buyer, &amount);

        // Update state
        env.storage()
            .instance()
            .set(&DataKey::State, &EscrowState::Refunded);

        // Emit event
        env.events()
            .publish((Symbol::new(&env, "funds_refunded"), buyer), amount);

    fn require_not_paused(env: &Env) -> Result<(), EscrowError> {
        if env.storage().instance().get(&Paused).unwrap_or(false) {
            return Err(EscrowError::NotAuthorized);
        }
        Ok(())
    }
}

mod test;

