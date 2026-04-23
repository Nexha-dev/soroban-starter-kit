use soroban_sdk::{Address, Env};
use crate::errors::TokenError;

pub fn require_admin(env: &Env) -> Result<Address, TokenError> {
    soroban_common::try_get_admin(env).ok_or(TokenError::NotInitialized)
}
