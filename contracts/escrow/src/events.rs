use soroban_sdk::{Address, Env, Symbol};

pub fn escrow_created(env: &Env, buyer: &Address, seller: &Address, amount: i128) {
    env.events().publish((Symbol::new(env, "escrow_created"), buyer.clone(), seller.clone()), amount);
}

pub fn escrow_funded(env: &Env, buyer: &Address, amount: i128) {
    env.events().publish((Symbol::new(env, "escrow_funded"), buyer.clone()), amount);
}

pub fn delivery_marked(env: &Env, seller: &Address) {
    env.events().publish((Symbol::new(env, "delivery_marked"), seller.clone()), ());
}

pub fn funds_released(env: &Env, seller: &Address, amount: i128) {
    env.events().publish((Symbol::new(env, "funds_released"), seller.clone()), amount);
}

pub fn funds_refunded(env: &Env, buyer: &Address, amount: i128) {
    env.events().publish((Symbol::new(env, "funds_refunded"), buyer.clone()), amount);
}
