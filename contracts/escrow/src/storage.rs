use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Buyer,
    Seller,
    Arbiter,
    TokenContract,
    Amount,
    Deadline,
    State,
    BuyerApproved,
    SellerDelivered,
    Paused,
    Version,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum EscrowState {
    Created = 0,
    Funded = 1,
    Delivered = 2,
    Disputed = 3,
    Completed = 4,
    Refunded = 5,
    Cancelled = 6,
    Completed = 3,
    Refunded = 4,
    Disputed = 5,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowInfo {
    pub buyer: Address,
    pub seller: Address,
    pub arbiter: Address,
    pub token_contract: Address,
    pub amount: i128,
    pub deadline: u32,
    pub state: EscrowState,
}
