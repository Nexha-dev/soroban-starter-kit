#![no_std]

use soroban_sdk::{contracttype, Address, Env};

/// Storage key for the contract administrator address.
///
/// Used in instance storage to persist the admin [`Address`] across invocations.
///
/// # Examples
///
/// ```ignore
/// env.storage().instance().set(&AdminKey::Admin, &admin_address);
/// ```
#[contracttype]
#[derive(Clone)]
pub enum AdminKey {
    Admin,
}

/// Reads `AdminKey::Admin` from instance storage, panicking if unset.
///
/// # Panics
///
/// Panics with `"admin not set"` if the admin has not been stored yet.
///
/// # Examples
///
/// ```ignore
/// let admin: Address = soroban_common::get_admin(&env);
/// ```
pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&AdminKey::Admin)
        .expect("admin not set")
}

/// Reads `AdminKey::Admin` from instance storage, returning `None` if unset.
///
/// # Examples
///
/// ```ignore
/// if let Some(admin) = soroban_common::try_get_admin(&env) {
///     // admin is set
/// }
/// ```
pub fn try_get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&AdminKey::Admin)
}

/// Reads a value from instance storage by key, panicking if missing.
///
/// # Panics
///
/// Panics with `"key not found"` if the key does not exist in instance storage.
///
/// # Examples
///
/// ```ignore
/// let amount: i128 = soroban_common::get_instance(&env, &DataKey::Amount);
/// ```
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
///
/// # Examples
///
/// ```ignore
/// // Keep instance storage alive for ~30 days if TTL drops below ~7 days.
/// soroban_common::extend_ttl_instance(&env, 120_960, 518_400);
/// ```
pub fn extend_ttl_instance(env: &Env, threshold: u32, extend_to: u32) {
    env.storage()
        .instance()
        .extend_ttl(threshold, extend_to);
}

/// Extends the TTL of a persistent storage entry if the current TTL is below
/// `threshold`.
///
/// # Examples
///
/// ```ignore
/// soroban_common::extend_ttl_persistent(&env, &DataKey::Balance(addr), 120_960, 518_400);
/// ```
pub fn extend_ttl_persistent<K>(env: &Env, key: &K, threshold: u32, extend_to: u32)
where
    K: soroban_sdk::TryIntoVal<Env, soroban_sdk::Val>
        + soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, threshold, extend_to);
}
