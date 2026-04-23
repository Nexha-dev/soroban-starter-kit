use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy)]
pub enum EscrowError {
    NotAuthorized = 1,
    InvalidState = 2,
    DeadlinePassed = 3,
    DeadlineNotReached = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    InsufficientFunds = 7,
}
