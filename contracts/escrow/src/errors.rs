use soroban_sdk::contracterror;

/// Error codes returned by [`EscrowContract`](crate::EscrowContract) methods.
///
/// Each variant maps to a unique `u32` discriminant embedded in the contract ABI.
///
/// # Examples
///
/// ```ignore
/// match escrow_client.try_fund() {
///     Err(Ok(EscrowError::InvalidState)) => { /* wrong lifecycle state */ }
///     _ => {}
/// }
/// ```
#[contracterror]
#[derive(Clone, Copy)]
pub enum EscrowError {
    /// The caller is not permitted to perform this action.
    NotAuthorized = 1,
    /// The escrow is not in the required lifecycle state for this operation.
    InvalidState = 2,
    /// The operation cannot proceed because the deadline has already passed.
    DeadlinePassed = 3,
    /// A refund was requested but the deadline has not yet been reached.
    DeadlineNotReached = 4,
    /// [`EscrowContract::initialize`](crate::EscrowContract::initialize) was
    /// called on an already-initialized contract.
    AlreadyInitialized = 5,
    /// An operation was attempted before the contract was initialized.
    NotInitialized = 6,
    /// The requested partial-release amount exceeds the escrowed balance.
    InsufficientFunds = 7,
    /// The escrow amount must be greater than zero.
    InvalidAmount = 8,
}
