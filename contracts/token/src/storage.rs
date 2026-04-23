use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(AllowanceDataKey),
    Metadata(MetadataKey),
    TotalSupply,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceDataKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum MetadataKey {
    Name,
    Symbol,
    Decimals,
}
