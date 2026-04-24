use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Balance(Address),
    Allowance(AllowanceDataKey),
    Metadata(MetadataKey),
    TotalSupply,
    MaxSupply,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceDataKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum MetadataKey {
    Name,
    Symbol,
    Decimals,
}
