use soroban_sdk::{token, Address, Env};
use crate::storage::DataKey;

pub fn transfer_token(env: &Env, from: &Address, to: &Address, amount: i128) {
    let token_contract: Address = soroban_common::get_instance(env, &DataKey::TokenContract);
    token::Client::new(env, &token_contract).transfer(from, to, &amount);
}
