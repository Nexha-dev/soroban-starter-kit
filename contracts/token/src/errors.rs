use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, Debug)]
pub enum TokenError {
    InsufficientBalance = 1,
    InsufficientAllowance = 2,
    Unauthorized = 3,
    AlreadyInitialized = 4,
    NotInitialized = 5,
}
