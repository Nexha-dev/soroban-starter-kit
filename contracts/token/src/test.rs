#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String};
use soroban_sdk::testutils::storage::Persistent as _;

fn create_token_contract<'a>(env: &Env) -> (TokenContractClient<'a>, Address) {
    let contract_address = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(env, &contract_address);
    (client, contract_address)
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

    // Initialize the token
    client.initialize(&admin, &name, &symbol, &decimals);

    // Verify initialization
    assert_eq!(client.admin(), admin);
    assert_eq!(client.name(), name);
    assert_eq!(client.symbol(), symbol);
    assert_eq!(client.decimals(), decimals);
    assert_eq!(client.total_supply(), 0);
}

#[test]
#[should_panic]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (client, _) = create_token_contract(&env);

    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TEST");
    let decimals = 18u32;

    // Initialize once
    client.initialize(&admin, &name, &symbol, &decimals);
    
    // Try to initialize again - should panic
    client.initialize(&admin, &name, &symbol, &decimals);
}

#[test]
fn test_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (client, _) = create_token_contract(&env);

    // Initialize
    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );

    // Mint tokens
    let amount = 1000i128;
    client.mint(&user, &amount);

    // Verify mint
    assert_eq!(client.balance(&user), amount);
    assert_eq!(client.total_supply(), amount);
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (client, _) = create_token_contract(&env);

    // Initialize and mint
    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );
    
    let mint_amount = 1000i128;
    client.mint(&user, &mint_amount);

    // Burn tokens
    let burn_amount = 300i128;
    client.burn(&user, &burn_amount);

    // Verify burn
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
    let (client, _) = create_token_contract(&env);

    // Initialize and mint
    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );
    
    let mint_amount = 1000i128;
    client.mint(&user1, &mint_amount);

    // Transfer tokens
    let transfer_amount = 300i128;
    client.transfer(&user1, &user2, &transfer_amount);

    // Verify transfer
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
    let (client, _) = create_token_contract(&env);

    // Initialize and mint
    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );
    
    let mint_amount = 1000i128;
    client.mint(&user1, &mint_amount);

    // Approve spender
    let approve_amount = 500i128;
    let expiration = env.ledger().sequence() + 100;
    client.approve(&user1, &spender, &approve_amount, &expiration);

    // Verify allowance
    assert_eq!(client.allowance(&user1, &spender), approve_amount);

    // Transfer from user1 to user2 via spender
    let transfer_amount = 200i128;
    client.transfer_from(&spender, &user1, &user2, &transfer_amount);

    // Verify transfer and updated allowance
    assert_eq!(client.balance(&user1), mint_amount - transfer_amount);
    assert_eq!(client.balance(&user2), transfer_amount);
    assert_eq!(client.allowance(&user1, &spender), approve_amount - transfer_amount);
}

#[test]
fn test_allowance_ttl_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    // Set small TTLs so we can advance past them easily
    env.ledger().with_mut(|l| {
        l.sequence_number = 100;
        l.min_temp_entry_ttl = 10;
        l.min_persistent_entry_ttl = 500;
        l.max_entry_ttl = 1000;
    });
fn test_burn_from() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let spender = Address::generate(&env);
    let (client, _) = create_token_contract(&env);

    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );
    client.mint(&user, &1000i128);

    // Approve with expiration_ledger = current sequence so extend_ttl is skipped;
    // the entry gets only the default min_temp_entry_ttl (10 ledgers).
    let expiration = env.ledger().sequence();
    client.approve(&user, &spender, &500i128, &expiration);
    assert_eq!(client.allowance(&user, &spender), 500i128);

    // Advance ledger past the temporary entry TTL (min_temp_entry_ttl = 10)
    env.ledger().with_mut(|l| l.sequence_number = 100 + 11);

    // Temporary storage entry has expired; allowance returns 0
    assert_eq!(client.allowance(&user, &spender), 0i128);
}

#[test]
fn test_balance_persistent_ttl_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    // Set small persistent TTL so we can advance past it easily
    env.ledger().with_mut(|l| {
        l.sequence_number = 100;
        l.min_temp_entry_ttl = 10;
        l.min_persistent_entry_ttl = 50;
        l.max_entry_ttl = 500;
    });

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (client, contract_address) = create_token_contract(&env);

    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );
    client.mint(&user, &1000i128);

    // Extend contract instance and code TTL so they stay alive past the balance entry TTL
    // threshold=50 means "extend if current TTL <= 50" (current TTL is 49, so this triggers)
    env.deployer().extend_ttl(contract_address.clone(), 50, 500);

    // Verify balance entry has TTL = min_persistent_entry_ttl - 1 = 49
    env.as_contract(&contract_address, || {
        assert_eq!(env.storage().persistent().get_ttl(&DataKey::Balance(user.clone())), 49);
    });

    // Advance ledger to sequence 149 where balance entry TTL = 0 (last valid ledger)
    // Entry was created at seq 100 with TTL=49, so it's valid until seq 149 (TTL=0)
    env.ledger().with_mut(|l| l.sequence_number = 100 + 49);

    // Balance entry TTL has reached 0; entry is at its last valid ledger
    env.as_contract(&contract_address, || {
        assert_eq!(env.storage().persistent().get_ttl(&DataKey::Balance(user.clone())), 0);
    });

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
    let (client, _) = create_token_contract(&env);

    // Initialize
    client.initialize(
        &admin,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
        &18u32,
    );

    // Set new admin
    client.set_admin(&new_admin);

    // Verify new admin
    assert_eq!(client.admin(), new_admin);
}