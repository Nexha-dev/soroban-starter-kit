use soroban_sdk::contracterror;

/// Error codes returned by [`TokenContract`](crate::TokenContract) methods.
///
/// Each variant maps to a unique `u32` discriminant that is embedded in the
/// Soroban contract ABI and surfaced to callers as a structured error.
///
/// # Examples
///
/// ```ignore
/// match token_client.try_mint(&to, &amount) {
///     Err(Ok(TokenError::InsufficientBalance)) => { /* handle */ }
///     _ => {}
/// }
/// ```
#[contracterror]
#[derive(Clone, Copy, Debug)]
pub enum TokenError {
    /// The account does not hold enough tokens to complete the operation.
    InsufficientBalance = 1,
    /// The spender's allowance is too small or has expired.
    InsufficientAllowance = 2,
    /// The caller is not the contract administrator.
    Unauthorized = 3,
    /// [`TokenContract::initialize`](crate::TokenContract::initialize) was
    /// called on an already-initialized contract.
    AlreadyInitialized = 4,
    /// An operation was attempted before the contract was initialized.
    NotInitialized = 5,
}
