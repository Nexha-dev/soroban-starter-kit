#![cfg(test)]

use super::*;
use soroban_sdk::token::TokenInterface;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    Address, Env, IntoVal, String, Symbol,
};

// ---------------------------------------------------------------------------
// MockToken — a no-op token contract so cross-contract calls don't panic
// ---------------------------------------------------------------------------

#[contract]
pub struct MockToken;

#[contractimpl]
impl token::TokenInterface for MockToken {
    fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 {
        0
    }

    fn approve(
        _env: Env,
        _from: Address,
        _spender: Address,
        _amount: i128,
        _expiration_ledger: u32,
    ) {
    }

    fn balance(_env: Env, _id: Address) -> i128 {
        i128::MAX
    }

    fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}

    fn transfer_from(_env: Env, _spender: Address, _from: Address, _to: Address, _amount: i128) {}

    fn burn(_env: Env, _from: Address, _amount: i128) {}

    fn burn_from(_env: Env, _spender: Address, _from: Address, _amount: i128) {}

    fn decimals(_env: Env) -> u32 {
        18
    }

    fn name(env: Env) -> String {
        String::from_str(&env, "Mock")
    }

    fn symbol(env: Env) -> String {
        String::from_str(&env, "MCK")
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn create_escrow_contract<'a>(env: &Env) -> (EscrowContractClient<'a>, Address) {
    let contract_address = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_address);
    (client, contract_address)
}

fn create_mock_token(env: &Env) -> Address {
    env.register_contract(None, MockToken)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, contract_address) = create_escrow_contract(&env);

    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Verify stored values
    let (
        stored_buyer,
        stored_seller,
        stored_arbiter,
        stored_token,
        stored_amount,
        stored_deadline,
        state,
    ) = client.get_escrow_info();

    assert_eq!(stored_buyer, buyer);
    assert_eq!(stored_seller, seller);
    assert_eq!(stored_arbiter, arbiter);
    assert_eq!(stored_token, token_contract);
    assert_eq!(stored_amount, amount);
    assert_eq!(stored_deadline, deadline);
    assert_eq!(state, EscrowState::Created);

    // Event assertions after initialize
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);

    // Initialize once
    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Try to initialize again — should panic
    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );
}

#[test]
#[should_panic]
fn test_initialize_past_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    // Advance the ledger so we can express a deadline that is clearly in the past
    env.ledger().with_mut(|li| li.sequence_number = 10);
    let deadline = 5u32; // 5 < 10, so this is already in the past

    let (client, _) = create_escrow_contract(&env);

    // Should panic due to past deadline
    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );
}

#[test]
fn test_mark_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, contract_address) = create_escrow_contract(&env);

    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Cumulative events after initialize
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    client.fund();

    // Cumulative events after fund
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    client.mark_delivered();

    assert_eq!(client.get_state(), EscrowState::Delivered);

    // Cumulative events after mark_delivered
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "delivery_marked"), seller.clone(),).into_val(&env),
                ().into_val(&env),
            ),
        ]
    );
}

#[test]
fn test_approve_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, contract_address) = create_escrow_contract(&env);

    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Cumulative events after initialize
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    client.fund();

    // Cumulative events after fund
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    client.mark_delivered();

    // Cumulative events after mark_delivered
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "delivery_marked"), seller.clone(),).into_val(&env),
                ().into_val(&env),
            ),
        ]
    );

    client.approve_delivery();

    assert_eq!(client.get_state(), EscrowState::Completed);

    // Cumulative events after approve_delivery (release_to_seller fires funds_released)
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "delivery_marked"), seller.clone(),).into_val(&env),
                ().into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "funds_released"), seller.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );
}

#[test]
fn test_deadline_passed() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 5;

    let (client, contract_address) = create_escrow_contract(&env);

    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Cumulative events after initialize
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    // is_deadline_passed is read-only — no new events
    assert_eq!(client.is_deadline_passed(), false);

    // Jump past the deadline
    env.ledger()
        .with_mut(|li| li.sequence_number = deadline + 1);

    // Now the deadline should be reported as passed
    assert_eq!(client.is_deadline_passed(), true);
}

#[test]
fn test_arbiter_resolve_to_seller() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, contract_address) = create_escrow_contract(&env);

    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Cumulative events after initialize
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    client.fund();

    // Cumulative events after fund
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    // Arbiter resolves in favor of the seller
    client.resolve_dispute(&true);

    assert_eq!(client.get_state(), EscrowState::Completed);

    // Cumulative events after resolve_dispute(true) — release_to_seller fires funds_released
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "funds_released"), seller.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );
}

#[test]
fn test_arbiter_resolve_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = create_mock_token(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, contract_address) = create_escrow_contract(&env);

    client.initialize(
        &buyer,
        &seller,
        &arbiter,
        &token_contract,
        &amount,
        &deadline,
    );

    // Cumulative events after initialize
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    client.fund();

    // Cumulative events after fund
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );

    // Arbiter resolves in favor of the buyer (refund)
    client.resolve_dispute(&false);

    assert_eq!(client.get_state(), EscrowState::Refunded);

    // Cumulative events after resolve_dispute(false) — refund_to_buyer fires funds_refunded
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                contract_address.clone(),
                (
                    Symbol::new(&env, "escrow_created"),
                    buyer.clone(),
                    seller.clone(),
                )
                    .into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "escrow_funded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
            (
                contract_address.clone(),
                (Symbol::new(&env, "funds_refunded"), buyer.clone(),).into_val(&env),
                amount.into_val(&env),
            ),
        ]
    );
}
