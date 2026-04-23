#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};
use soroban_sdk::{testutils::{Address as _, Ledger}, token::StellarAssetClient, Address, Env};

fn create_escrow_contract<'a>(env: &'a Env) -> (EscrowContractClient<'a>, Address) {
    let contract_address = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_address);
    (client, contract_address)
}

fn create_token<'a>(env: &'a Env, admin: &Address) -> (TokenClient<'a>, Address) {
    let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token = TokenClient::new(env, &token_address);
    (token, token_address)
}

fn setup_funded_escrow<'a>(
    env: &'a Env,
) -> (
    EscrowContractClient<'a>,
    Address,
    Address,
    Address,
    Address,
    TokenClient<'a>,
    i128,
    u32,
) {
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let arbiter = Address::generate(env);
    let token_admin = Address::generate(env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (token, token_address) = create_token(env, &token_admin);
    StellarAssetClient::new(env, &token_address).mint(&buyer, &amount);

    let (client, _) = create_escrow_contract(env);
    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);
    client.fund();

    (client, buyer, seller, arbiter, token_address, token, amount, deadline)
/// Sets up a funded escrow with a real token contract.
/// Returns (client, escrow_address, buyer, seller, arbiter, token_address, amount)
fn setup_funded_escrow<'a>(
    env: &'a Env,
) -> (EscrowContractClient<'a>, Address, Address, Address, Address, Address, i128) {
    let admin = Address::generate(env);
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let arbiter = Address::generate(env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    let token_admin = StellarAssetClient::new(env, &token_address);
    token_admin.mint(&buyer, &amount);

    let (client, escrow_address) = create_escrow_contract(env);
    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);
    client.fund();

    (client, escrow_address, buyer, seller, arbiter, token_address, amount)
}

#[test]
fn test_initialize_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (_, token_address) = create_token(&env, &token_admin);
    let (client, _) = create_escrow_contract(&env);

    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);

    let info = client.get_escrow_info();
    assert_eq!(info.buyer, buyer);
    assert_eq!(info.seller, seller);
    assert_eq!(info.arbiter, arbiter);
    assert_eq!(info.token_contract, token_address);
    assert_eq!(info.amount, amount);
    assert_eq!(info.deadline, deadline);
    assert_eq!(info.state, EscrowState::Created);
}

#[test]
#[should_panic]
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    let (stored_buyer, stored_seller, stored_arbiter, stored_token, stored_amount, stored_deadline, state) =
        client.get_escrow_info();

    assert_eq!(stored_buyer, buyer);
    assert_eq!(stored_seller, seller);
    assert_eq!(stored_arbiter, arbiter);
    assert_eq!(stored_token, token_contract);
    assert_eq!(stored_amount, amount);
    assert_eq!(stored_deadline, deadline);
    assert_eq!(state, EscrowState::Created);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (_, token_address) = create_token(&env, &token_admin);
    let (client, _) = create_escrow_contract(&env);

    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);
    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);
}

#[test]
#[should_panic]
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
}

#[test]
#[should_panic(expected = "Deadline must be at least MIN_DEADLINE_BUFFER ledgers in the future")]
fn test_initialize_past_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let amount = 1000i128;

    // Advance ledger so we can subtract safely
    env.ledger().with_mut(|li| li.sequence_number = 10);
    let deadline = env.ledger().sequence() - 1;

    // Set sequence to 10 so we can subtract safely
    env.ledger().with_mut(|li| li.sequence_number = 10);
    let deadline = env.ledger().sequence() - 1;

    let (_, token_address) = create_token(&env, &token_admin);
    let (client, _) = create_escrow_contract(&env);

    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
}

#[test]
fn test_mark_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    let (client, _, _, _, _, _, _) = setup_funded_escrow(&env);
    client.mark_delivered();

    assert_eq!(client.get_state(), EscrowState::Delivered);
    // Verify state change
    assert_eq!(client.get_state(), Some(EscrowState::Delivered));
}

#[test]
fn test_approve_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    let (client, _, _, _, _, _, _) = setup_funded_escrow(&env);
    client.mark_delivered();
    client.approve_delivery();

    assert_eq!(client.get_state(), EscrowState::Completed);
    // Verify completion
    assert_eq!(client.get_state(), Some(EscrowState::Completed));
}

#[test]
fn test_deadline_passed() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 5;

    let (_, token_address) = create_token(&env, &token_admin);
    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_address, &amount, &deadline);

    assert!(!client.is_deadline_passed());

    env.ledger().with_mut(|li| li.sequence_number = deadline + 1);

    assert!(client.is_deadline_passed());
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    assert_eq!(client.is_deadline_passed(), false);

    env.ledger().with_mut(|li| li.sequence_number = deadline + 1);

    assert_eq!(client.is_deadline_passed(), true);
}

#[test]
fn test_cancel() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    client.cancel();

    assert_eq!(client.get_state(), EscrowState::Cancelled);
}

#[test]
fn test_release_partial() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, _, _, amount) = setup_funded_escrow(&env);

    let partial = 400i128;
    client.release_partial(&partial);

    let (_, _, _, _, stored_amount, _, state) = client.get_escrow_info();
    assert_eq!(stored_amount, amount - partial);
    assert_eq!(state, EscrowState::Funded);
}

#[test]
fn test_arbiter_resolve_to_seller() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, _, _, _) = setup_funded_escrow(&env);
    client.resolve_dispute(&true);

    assert_eq!(client.get_state(), EscrowState::Completed);
    // Verify completion
    assert_eq!(client.get_state(), Some(EscrowState::Completed));
}

#[test]
fn test_arbiter_resolve_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    let (client, _, _, _, _, _, _) = setup_funded_escrow(&env);
    client.resolve_dispute(&false);

    assert_eq!(client.get_state(), EscrowState::Refunded);
}
    // Verify refund
    assert_eq!(client.get_state(), Some(EscrowState::Refunded));
}
