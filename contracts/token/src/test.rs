#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn create_token_contract(env: &Env) -> (TokenContractClient<'_>, Address) {
    let contract_address = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(env, &contract_address);
    (client, contract_address)
}

fn init_token<'a>(env: &'a Env, admin: &Address) -> TokenContractClient<'a> {
    let (client, _) = create_token_contract(env);
    client.initialize(
        admin,
        &String::from_str(env, "Test Token"),
        &String::from_str(env, "TEST"),
        &18u32,
        &None,
    );
    client
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (client, _) = create_token_contract(&env);

    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    client.initialize(&admin, &name, &symbol, &decimals, &None);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.name(), name);
    assert_eq!(client.symbol(), symbol);
    assert_eq!(client.decimals(), decimals);
    assert_eq!(client.total_supply(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (client, _) = create_token_contract(&env);

    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    client.initialize(&admin, &name, &symbol, &decimals, &None);
    client.initialize(&admin, &name, &symbol, &decimals, &None);
}

#[test]
fn test_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let client = init_token(&env, &admin);

    let amount = 1000i128;
    client.mint(&user, &amount);

    assert_eq!(client.balance(&user), amount);
    assert_eq!(client.total_supply(), amount);
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let client = init_token(&env, &admin);

    let mint_amount = 1000i128;
    client.mint(&user, &mint_amount);

    let burn_amount = 300i128;
    client.burn_admin(&user, &burn_amount);

    assert_eq!(client.balance(&user), mint_amount - burn_amount);
    assert_eq!(client.total_supply(), mint_amount - burn_amount);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let client = init_token(&env, &admin);

    let mint_amount = 1000i128;
    client.mint(&user1, &mint_amount);

    let transfer_amount = 300i128;
    client.transfer(&user1, &user2, &transfer_amount);

    assert_eq!(client.balance(&user1), mint_amount - transfer_amount);
    assert_eq!(client.balance(&user2), transfer_amount);
    assert_eq!(client.total_supply(), mint_amount);
}

#[test]
fn test_approve_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let spender = Address::generate(&env);
    let client = init_token(&env, &admin);

    let mint_amount = 1000i128;
    client.mint(&user1, &mint_amount);

    let approve_amount = 500i128;
    let expiration = env.ledger().sequence() + 100;
    client.approve(&user1, &spender, &approve_amount, &expiration);

    assert_eq!(client.allowance(&user1, &spender), approve_amount);

    let transfer_amount = 200i128;
    client.transfer_from(&spender, &user1, &user2, &transfer_amount);

    assert_eq!(client.balance(&user1), mint_amount - transfer_amount);
    assert_eq!(client.balance(&user2), transfer_amount);
    assert_eq!(client.allowance(&user1, &spender), approve_amount - transfer_amount);
}

#[test]
fn test_burn_from() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let spender = Address::generate(&env);
    let client = init_token(&env, &admin);

    let mint_amount = 1000i128;
    client.mint(&user, &mint_amount);

    let approve_amount = 500i128;
    let expiration = env.ledger().sequence() + 100;
    client.approve(&user, &spender, &approve_amount, &expiration);

    let burn_amount = 200i128;
    client.burn_from(&spender, &user, &burn_amount);

    assert_eq!(client.balance(&user), mint_amount - burn_amount);
    assert_eq!(client.total_supply(), mint_amount - burn_amount);
    assert_eq!(client.allowance(&user, &spender), approve_amount - burn_amount);
}

#[test]
fn test_set_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let client = init_token(&env, &admin);

    client.set_admin(&new_admin);

    assert_eq!(client.admin(), new_admin);
}
