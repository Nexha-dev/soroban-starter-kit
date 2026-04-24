#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, String,
};

fn create_token_contract<'a>(env: &'a Env) -> (TokenContractClient<'a>, Address) {
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
    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    let (client, _) = create_token_contract(&env);
    client.initialize(&admin, &name, &symbol, &decimals);
    client.initialize(&admin, &name, &symbol, &decimals, &None);

    assert_eq!(client.name(), name);
    assert_eq!(client.symbol(), symbol);
    assert_eq!(client.decimals(), decimals);
}

#[test]
fn test_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    let (client, _) = create_token_contract(&env);
    client.initialize(&admin, &name, &symbol, &decimals);
    client.mint(&user, &1000i128);
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

    assert_eq!(client.balance(&user), 1000i128);
    assert_eq!(client.total_supply(), 1000i128);
}

#[test]
fn test_approve() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    let (client, _) = create_token_contract(&env);
    client.initialize(&admin, &name, &symbol, &decimals);
    
    let expiration = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &500i128, &expiration);

    assert_eq!(client.allowance(&from, &spender), 500i128);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    let (client, _) = create_token_contract(&env);
    client.initialize(&admin, &name, &symbol, &decimals);
    client.mint(&from, &1000i128);
    client.transfer(&from, &to, &500i128);

    assert_eq!(client.balance(&from), 500i128);
    assert_eq!(client.balance(&to), 500i128);
}
