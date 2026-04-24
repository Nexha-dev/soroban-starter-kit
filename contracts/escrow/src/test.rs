#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env,
};

fn create_escrow_contract<'a>(env: &'a Env) -> (EscrowContractClient<'a>, Address) {
    let contract_address = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_address);
    (client, contract_address)
}

fn setup_token(env: &Env, buyer: &Address, amount: i128) -> Address {
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    let token_admin = StellarAssetClient::new(env, &token_address);
    token_admin.mint(buyer, &amount);
    token_address
}

fn setup_funded_escrow<'a>(
    env: &'a Env,
) -> (
    EscrowContractClient<'a>,
    Address,
    Address,
    Address,
    Address,
    i128,
    u32,
) {
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let arbiter = Address::generate(env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;
    let token_contract = setup_token(env, &buyer, amount);

    let (client, _) = create_escrow_contract(env);

    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
    client.fund();

    (client, buyer, seller, arbiter, token_contract, amount, deadline)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;
    let token_contract = setup_token(&env, &buyer, amount);

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);

    let info = client.get_escrow_info();
    assert_eq!(info.buyer, buyer);
    assert_eq!(info.seller, seller);
    assert_eq!(info.arbiter, arbiter);
    assert_eq!(info.amount, amount);
    assert_eq!(info.state, EscrowState::Created);
}

#[test]
fn test_fund() {
    let env = Env::default();
    env.mock_all_auths();

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() + 100;
    let token_contract = setup_token(&env, &buyer, amount);

    let (client, _) = create_escrow_contract(&env);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
    client.initialize(&buyer, &seller, &arbiter, &token_contract, &amount, &deadline);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_initialize_past_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.sequence_number = 10);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_contract = setup_token(&env, &buyer, 1000);
    let amount = 1000i128;
    let deadline = env.ledger().sequence() - 1;
    client.fund();

    assert_eq!(client.get_state(), EscrowState::Funded);
}

#[test]
fn test_mark_delivered() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, seller, _, _, _, _) = setup_funded_escrow(&env);
    client.mark_delivered();

    assert_eq!(client.get_state(), EscrowState::Delivered);
}

#[test]
fn test_approve_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.mark_delivered();
    client.approve_delivery();

    assert_eq!(client.get_state(), EscrowState::Completed);
}

#[test]
fn test_raise_dispute() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.raise_dispute(&buyer);

    assert_eq!(client.get_state(), EscrowState::Disputed);
}

#[test]
fn test_resolve_dispute_to_seller() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    client.raise_dispute();
    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.raise_dispute(&buyer);
    client.resolve_dispute(&true);

    assert_eq!(client.get_state(), EscrowState::Completed);
}

#[test]
fn test_resolve_dispute_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, ..) = setup_funded_escrow(&env);
    client.raise_dispute();
    let (client, buyer, _, _, _, _, _) = setup_funded_escrow(&env);
    client.raise_dispute(&buyer);
    client.resolve_dispute(&false);

    assert_eq!(client.get_state(), EscrowState::Refunded);
}
