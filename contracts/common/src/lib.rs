#![no_std]

use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum AdminKey {
    Admin,
}

/// Reads `AdminKey::Admin` from instance storage, panicking if unset.
pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&AdminKey::Admin)
        .expect("admin not set")
}

/// Reads `AdminKey::Admin` from instance storage, returning `None` if unset.
pub fn try_get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&AdminKey::Admin)
}

/// Reads a value from instance storage by key, panicking if missing.
pub fn get_instance<K, V>(env: &Env, key: &K) -> V
where
    K: soroban_sdk::TryIntoVal<Env, soroban_sdk::Val>
        + soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
    V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
{
    env.storage().instance().get(key).expect("key not found")
}

/// Extends the TTL of instance storage by `extend_to` ledgers if the current
/// TTL is below `threshold`.
pub fn extend_ttl_instance(env: &Env, threshold: u32, extend_to: u32) {
    env.storage()
        .instance()
        .extend_ttl(threshold, extend_to);
}

/// Extends the TTL of a persistent storage entry if the current TTL is below
/// `threshold`.
pub fn extend_ttl_persistent<K>(env: &Env, key: &K, threshold: u32, extend_to: u32)
where
    K: soroban_sdk::TryIntoVal<Env, soroban_sdk::Val>
        + soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, threshold, extend_to);
}
