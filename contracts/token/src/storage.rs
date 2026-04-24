use soroban_sdk::{contracttype, Address};

/// Top-level storage keys used by [`TokenContract`](crate::TokenContract).
///
/// Variants are stored in either instance or persistent storage depending on
/// their access pattern (see individual variant docs).
///
/// # Examples
///
/// ```ignore
/// env.storage().instance().set(&DataKey::Admin, &admin);
/// env.storage().persistent().set(&DataKey::Balance(addr), &balance);
/// ```
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Instance storage – the contract administrator [`Address`].
    Admin,
    /// Persistent storage – token balance for a given [`Address`].
    PendingAdmin,
    Balance(Address),
    /// Temporary storage – allowance record keyed by owner/spender pair.
    Allowance(AllowanceDataKey),
    /// Instance storage – token metadata (name, symbol, decimals).
    Metadata(MetadataKey),
    /// Instance storage – total token supply as `i128`.
    TotalSupply,
    Paused,
    Version,
    MaxSupply,
}

/// Composite key identifying a unique owner/spender allowance entry.
///
/// Stored under [`DataKey::Allowance`] in temporary storage.
///
/// # Examples
///
/// ```ignore
/// let key = DataKey::Allowance(AllowanceDataKey { from: owner, spender });
/// ```
#[contracttype]
#[derive(Clone)]
pub struct AllowanceDataKey {
    /// The token owner who granted the allowance.
    pub from: Address,
    /// The address permitted to spend on behalf of `from`.
    pub spender: Address,
}

/// Value stored alongside an [`AllowanceDataKey`].
///
/// # Examples
///
/// ```ignore
/// let val = AllowanceValue { amount: 1000, expiration_ledger: 1_000_000 };
/// env.storage().temporary().set(&key, &val);
/// ```
#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    /// Approved spend amount in the token's smallest unit.
    pub amount: i128,
    /// Ledger sequence number after which this allowance is considered expired.
    pub expiration_ledger: u32,
}

/// Sub-keys for token metadata stored under [`DataKey::Metadata`].
///
/// # Examples
///
/// ```ignore
/// env.storage().instance().set(&DataKey::Metadata(MetadataKey::Name), &name);
/// ```
#[contracttype]
#[derive(Clone)]
pub enum MetadataKey {
    /// Human-readable token name (e.g. `"My Token"`).
    Name,
    /// Short ticker symbol (e.g. `"MTK"`).
    Symbol,
    /// Number of decimal places (e.g. `7` for Stellar-compatible tokens).
    Decimals,
}
