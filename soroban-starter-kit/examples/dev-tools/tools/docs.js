/**
 * docs.js
 * Inline developer documentation, tutorials, and best practices.
 */

const DocsContent = (() => {

  const SECTIONS = [
    { id: 'getting-started', label: 'Getting Started', group: 'Basics' },
    { id: 'project-structure', label: 'Project Structure', group: 'Basics' },
    { id: 'contract-anatomy', label: 'Contract Anatomy', group: 'Basics' },
    { id: 'storage', label: 'Storage Types', group: 'Core Concepts' },
    { id: 'auth', label: 'Authentication', group: 'Core Concepts' },
    { id: 'events', label: 'Events', group: 'Core Concepts' },
    { id: 'errors', label: 'Error Handling', group: 'Core Concepts' },
    { id: 'testing', label: 'Testing', group: 'Development' },
    { id: 'fees', label: 'Fees & Metering', group: 'Development' },
    { id: 'deploy', label: 'Deployment', group: 'Development' },
    { id: 'best-practices', label: 'Best Practices', group: 'Guides' },
    { id: 'token-guide', label: 'Token Contract Guide', group: 'Guides' },
    { id: 'escrow-guide', label: 'Escrow Contract Guide', group: 'Guides' },
  ];

  const PAGES = {
    'getting-started': `
<h1>Getting Started with Soroban</h1>
<p>Soroban is Stellar's smart contract platform. Contracts are written in Rust and compiled to WebAssembly (WASM).</p>

<h2>Prerequisites</h2>
<ul>
  <li>Rust toolchain: <code>curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh</code></li>
  <li>WASM target: <code>rustup target add wasm32-unknown-unknown</code></li>
  <li>Stellar CLI: <code>cargo install --locked stellar-cli --features opt</code></li>
</ul>

<h2>Create a New Contract</h2>
<pre><code>stellar contract init my_contract
cd my_contract
cargo build --target wasm32-unknown-unknown --release</code></pre>

<div class="callout callout-tip">
  <strong>Tip:</strong> Use the Scaffolder tab to generate boilerplate for Token, Escrow, NFT, DAO, or Multisig contracts instantly.
</div>

<h2>Run Tests</h2>
<pre><code>cargo test</code></pre>

<h2>Deploy to Testnet</h2>
<pre><code>stellar contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \\
  --source YOUR_SECRET_KEY \\
  --rpc-url https://soroban-testnet.stellar.org \\
  --network-passphrase "Test SDF Network ; September 2015"</code></pre>
`,

    'project-structure': `
<h1>Project Structure</h1>
<p>A typical Soroban workspace looks like this:</p>
<pre><code>my-project/
├── Cargo.toml          # Workspace manifest
└── contracts/
    └── my_contract/
        ├── Cargo.toml  # Contract manifest
        └── src/
            ├── lib.rs  # Contract logic
            └── test.rs # Tests</code></pre>

<h2>Workspace Cargo.toml</h2>
<pre><code>[workspace]
members = ["contracts/*"]
resolver = "2"

[workspace.dependencies]
soroban-sdk = "21"</code></pre>

<h2>Contract Cargo.toml</h2>
<pre><code>[package]
name = "my-contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
panic = "abort"
codegen-units = 1
lto = true</code></pre>

<div class="callout callout-info">
  The <code>cdylib</code> crate type is required to produce a <code>.wasm</code> file.
  The release profile settings minimize WASM binary size.
</div>
`,

    'contract-anatomy': `
<h1>Contract Anatomy</h1>
<p>Every Soroban contract follows the same basic structure:</p>

<pre><code>#![no_std]  // Required — no standard library in WASM

use soroban_sdk::{contract, contractimpl, contracttype, Env, Address};

// 1. Storage key enum
#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),  // Per-address key
}

// 2. Contract struct (empty — state lives in storage)
#[contract]
pub struct MyContract;

// 3. Implementation
#[contractimpl]
impl MyContract {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}</code></pre>

<h2>Key Macros</h2>
<ul>
  <li><code>#[contract]</code> — marks the struct as a contract</li>
  <li><code>#[contractimpl]</code> — marks the impl block for export</li>
  <li><code>#[contracttype]</code> — makes a type serializable for storage/events</li>
</ul>

<div class="callout callout-warn">
  <strong>Important:</strong> The contract struct itself holds no state. All state is stored in <code>env.storage()</code>.
</div>
`,

    'storage': `
<h1>Storage Types</h1>
<p>Soroban has three storage tiers, each with different lifetime and cost characteristics.</p>

<h2>Instance Storage</h2>
<p>Tied to the contract instance. Lives as long as the contract exists. Best for global config.</p>
<pre><code>// Write
env.storage().instance().set(&DataKey::Admin, &admin);

// Read
let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

// Extend TTL
env.storage().instance().extend_ttl(100, 100);</code></pre>

<h2>Persistent Storage</h2>
<p>Survives across transactions but has a TTL that must be extended. Best for per-user data.</p>
<pre><code>// Write
env.storage().persistent().set(&DataKey::Balance(addr.clone()), &amount);

// Read
let balance: i128 = env.storage().persistent()
    .get(&DataKey::Balance(addr)).unwrap_or(0);

// Extend TTL (important — entries expire!)
env.storage().persistent().extend_ttl(&DataKey::Balance(addr), 100, 100);</code></pre>

<h2>Temporary Storage</h2>
<p>Auto-expires after ~17,280 ledgers (~1 day). Cheapest. Best for nonces, short-lived approvals.</p>
<pre><code>env.storage().temporary().set(&DataKey::Nonce(addr), &nonce);
let nonce: u64 = env.storage().temporary().get(&DataKey::Nonce(addr)).unwrap_or(0);</code></pre>

<div class="callout callout-tip">
  <strong>Rule of thumb:</strong> Admin/metadata → instance. Balances → persistent. Allowances/nonces → temporary.
</div>

<h2>TTL Extension</h2>
<p>Persistent entries expire. Always extend TTL when reading or writing critical data:</p>
<pre><code>// min_ledgers_to_live = 100, extend_to = 100
env.storage().persistent().extend_ttl(&key, 100, 100);</code></pre>
`,

    'auth': `
<h1>Authentication</h1>
<p>Soroban uses <code>require_auth()</code> to enforce that an address has signed the transaction.</p>

<h2>Basic Auth</h2>
<pre><code>pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();  // Transaction must be signed by 'from'
    // ... transfer logic
}</code></pre>

<h2>Auth with Arguments</h2>
<p>For more granular control, use <code>require_auth_for_args()</code>:</p>
<pre><code>use soroban_sdk::IntoVal;

from.require_auth_for_args(
    (to.clone(), amount).into_val(&env)
);</code></pre>

<h2>Admin Pattern</h2>
<pre><code>fn require_admin(env: &Env) -> Address {
    let admin: Address = env.storage().instance()
        .get(&DataKey::Admin)
        .expect("Not initialized");
    admin.require_auth();
    admin
}</code></pre>

<div class="callout callout-warn">
  <strong>Never skip auth checks.</strong> Any function that modifies state or transfers value must call <code>require_auth()</code>.
</div>

<h2>Testing Auth</h2>
<pre><code>// In tests, mock all auths:
env.mock_all_auths();

// Or mock specific auths:
env.mock_auths(&[MockAuth {
    address: &admin,
    invoke: &MockAuthInvoke {
        contract: &contract_id,
        fn_name: "mint",
        args: (&to, &amount).into_val(&env),
        sub_invokes: &[],
    },
}]);</code></pre>
`,

    'events': `
<h1>Events</h1>
<p>Events allow off-chain systems to track contract activity. They're emitted via <code>env.events().publish()</code>.</p>

<h2>Publishing Events</h2>
<pre><code>// Topic is a tuple of ScVals (usually Symbol + addresses)
// Data is the event payload
env.events().publish(
    (Symbol::new(&env, "transfer"), from.clone(), to.clone()),
    amount,
);</code></pre>

<h2>Event Structure</h2>
<ul>
  <li><strong>Topics</strong> — up to 4 ScVal items. First is typically a Symbol (event name).</li>
  <li><strong>Data</strong> — any ScVal. The event payload.</li>
</ul>

<h2>Common Event Patterns</h2>
<pre><code>// Initialization
env.events().publish((Symbol::new(&env, "initialize"), admin), ());

// Token transfer
env.events().publish((Symbol::new(&env, "transfer"), from, to), amount);

// State change
env.events().publish((Symbol::new(&env, "state_changed"),), new_state);</code></pre>

<h2>Querying Events</h2>
<pre><code>// Via Soroban RPC
const result = await server.getEvents({
  startLedger: 1000,
  filters: [{
    type: "contract",
    contractIds: [CONTRACT_ID],
    topics: [["*", "*"]],
  }],
});</code></pre>

<div class="callout callout-info">
  Events are not stored on-chain permanently. Use an indexer (like Mercury or Subquery) for historical event queries.
</div>
`,

    'errors': `
<h1>Error Handling</h1>
<p>Custom error types make contracts easier to debug and integrate with.</p>

<h2>Defining Errors</h2>
<pre><code>#[contracttype]
pub enum MyError {
    Unauthorized      = 1,
    InvalidState      = 2,
    InsufficientFunds = 3,
    NotInitialized    = 4,
    AlreadyExists     = 5,
}</code></pre>

<h2>Returning Errors</h2>
<pre><code>pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), MyError> {
    let admin: Address = env.storage().instance()
        .get(&DataKey::Admin)
        .ok_or(MyError::NotInitialized)?;  // ? propagates the error

    admin.require_auth();

    if amount <= 0 {
        return Err(MyError::InvalidState);
    }

    // ... mint logic
    Ok(())
}</code></pre>

<h2>Error Codes</h2>
<p>Assign explicit integer values to errors so clients can identify them:</p>
<pre><code>// Client-side (TypeScript)
try {
  await client.mint({ to, amount });
} catch (e) {
  if (e.message.includes("Error(Contract, #3)")) {
    console.error("Insufficient funds");
  }
}</code></pre>

<div class="callout callout-tip">
  Always start error codes at 1. Code 0 is reserved. Keep codes stable across contract upgrades.
</div>
`,

    'testing': `
<h1>Testing</h1>
<p>Soroban provides a full in-process test environment — no network needed.</p>

<h2>Basic Test Setup</h2>
<pre><code>#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MyContract);
        let client = MyContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        assert_eq!(client.get_admin(), admin);
    }
}</code></pre>

<h2>Testing Token Interactions</h2>
<pre><code>use soroban_sdk::testutils::MockAuth;

// Register a mock token contract
let token_id = env.register_contract_wasm(None, token_wasm::WASM);
let token = TokenClient::new(&env, &token_id);
token.initialize(&admin, &7, &"Test".into_val(&env), &"TST".into_val(&env));
token.mint(&user, &1_000_000_000);</code></pre>

<h2>Ledger Manipulation</h2>
<pre><code>// Advance ledger sequence (for deadline testing)
env.ledger().with_mut(|l| {
    l.sequence_number = 9_999_999;
    l.timestamp = 1_700_000_000;
});</code></pre>

<h2>Run Tests</h2>
<pre><code>cargo test
cargo test -- --nocapture  # Show println! output</code></pre>

<div class="callout callout-tip">
  Use <code>env.mock_all_auths()</code> in most tests. Use <code>env.mock_auths()</code> when testing auth failure cases.
</div>
`,

    'fees': `
<h1>Fees & Metering</h1>
<p>Soroban charges fees based on resource consumption: CPU instructions, memory, storage reads/writes, and events.</p>

<h2>Fee Components</h2>
<ul>
  <li><strong>Inclusion fee</strong> — base fee to include the transaction in a ledger</li>
  <li><strong>CPU fee</strong> — based on compute units (instructions executed)</li>
  <li><strong>Memory fee</strong> — based on memory bytes allocated</li>
  <li><strong>Ledger read fee</strong> — per entry read + per KB read</li>
  <li><strong>Ledger write fee</strong> — per entry written + per KB written</li>
  <li><strong>Events fee</strong> — per KB of event data emitted</li>
  <li><strong>Rent fee</strong> — for persistent storage TTL extension</li>
</ul>

<h2>Estimating Fees</h2>
<p>Use the <strong>Profiler tab</strong> to estimate costs per operation, or simulate via RPC:</p>
<pre><code>const sim = await server.simulateTransaction(tx);
console.log(sim.cost);
// { cpuInsns: "1234567", memBytes: "45678" }</code></pre>

<h2>Reducing Costs</h2>
<ul>
  <li>Minimize storage reads — cache values in local variables</li>
  <li>Use temporary storage for short-lived data (cheapest)</li>
  <li>Avoid large event payloads</li>
  <li>Batch operations where possible</li>
  <li>Use <code>opt-level = "z"</code> in release profile</li>
</ul>

<div class="callout callout-info">
  Use <code>simulateTransaction</code> before every write to get accurate fee estimates and avoid transaction failures.
</div>
`,

    'deploy': `
<h1>Deployment</h1>

<h2>Build</h2>
<pre><code>cargo build --target wasm32-unknown-unknown --release

# Optimize (optional, reduces size further)
stellar contract optimize \\
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm</code></pre>

<h2>Deploy to Testnet</h2>
<pre><code>stellar contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \\
  --source MY_SECRET_KEY \\
  --rpc-url https://soroban-testnet.stellar.org \\
  --network-passphrase "Test SDF Network ; September 2015"

# Returns: CONTRACT_ID (starts with C...)</code></pre>

<h2>Initialize the Contract</h2>
<pre><code>stellar contract invoke \\
  --id CONTRACT_ID \\
  --source MY_SECRET_KEY \\
  --rpc-url https://soroban-testnet.stellar.org \\
  --network-passphrase "Test SDF Network ; September 2015" \\
  -- initialize \\
  --admin ADMIN_ADDRESS</code></pre>

<h2>Deploy to Mainnet</h2>
<pre><code>stellar contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \\
  --source MY_SECRET_KEY \\
  --rpc-url https://mainnet.stellar.validationcloud.io/v1/... \\
  --network-passphrase "Public Global Stellar Network ; September 2015"</code></pre>

<div class="callout callout-warn">
  <strong>Mainnet is permanent.</strong> Thoroughly test on testnet before deploying to mainnet. Contract upgrades require explicit upgrade mechanisms.
</div>
`,

    'best-practices': `
<h1>Best Practices</h1>

<h2>Security</h2>
<ul>
  <li>Always call <code>require_auth()</code> on addresses that should authorize actions</li>
  <li>Validate all inputs — check amounts are positive, addresses are valid</li>
  <li>Use custom error types instead of <code>panic!()</code></li>
  <li>Check state before state transitions (e.g., escrow must be Funded before release)</li>
  <li>Avoid storing sensitive data on-chain — it's public</li>
</ul>

<h2>Storage</h2>
<ul>
  <li>Use <code>#[contracttype]</code> enums as storage keys — never raw strings</li>
  <li>Extend TTL for persistent entries you want to keep alive</li>
  <li>Use temporary storage for nonces and short-lived approvals</li>
  <li>Keep storage keys compact — avoid large structs as keys</li>
</ul>

<h2>Performance</h2>
<ul>
  <li>Cache storage reads in local variables within a function</li>
  <li>Minimize the number of storage operations per transaction</li>
  <li>Use <code>opt-level = "z"</code> and <code>lto = true</code> in release profile</li>
  <li>Avoid recursive calls — Soroban has a call stack limit</li>
</ul>

<h2>Upgradability</h2>
<ul>
  <li>Plan for upgrades from day one — use <code>env.deployer().update_current_contract_wasm()</code></li>
  <li>Keep storage key enums backward-compatible</li>
  <li>Version your contract state if needed</li>
</ul>

<h2>Testing</h2>
<ul>
  <li>Test happy paths AND error paths</li>
  <li>Test auth failures explicitly</li>
  <li>Test deadline/TTL edge cases using <code>env.ledger().with_mut()</code></li>
  <li>Test with multiple accounts to catch auth bugs</li>
</ul>

<div class="callout callout-tip">
  Use the <strong>Analyzer tab</strong> to automatically check your contract code against these best practices.
</div>
`,

    'token-guide': `
<h1>Token Contract Guide</h1>
<p>A complete walkthrough of building and using the Token contract.</p>

<h2>Architecture</h2>
<ul>
  <li><strong>Admin</strong> — can mint, burn, and transfer admin role</li>
  <li><strong>Balances</strong> — stored in persistent storage per address</li>
  <li><strong>Allowances</strong> — stored in temporary storage (spender → owner → amount)</li>
  <li><strong>Metadata</strong> — name, symbol, decimals in instance storage</li>
</ul>

<h2>Deployment Flow</h2>
<pre><code>// 1. Deploy contract
// 2. Initialize
client.initialize({
  admin: adminAddress,
  name: "My Token",
  symbol: "MTK",
  decimals: 7,
});

// 3. Mint initial supply
client.mint({ to: recipientAddress, amount: 1_000_000_000n }); // 100 MTK (7 decimals)</code></pre>

<h2>Transfer Flow</h2>
<pre><code>// Direct transfer (requires sender signature)
client.transfer({ from: sender, to: recipient, amount: 100_000_000n });

// Delegated transfer (requires approve first)
client.approve({ from: owner, spender: dex, amount: 500_000_000n, expiration_ledger: 9999999 });
client.transfer_from({ spender: dex, from: owner, to: recipient, amount: 100_000_000n });</code></pre>

<h2>Decimal Handling</h2>
<pre><code>// With 7 decimals:
// 1 MTK = 10_000_000 raw units
// 0.5 MTK = 5_000_000 raw units

const decimals = await client.decimals();
const displayAmount = rawAmount / Math.pow(10, decimals);</code></pre>
`,

    'escrow-guide': `
<h1>Escrow Contract Guide</h1>
<p>A complete walkthrough of the Escrow contract lifecycle.</p>

<h2>Parties</h2>
<ul>
  <li><strong>Buyer</strong> — deposits funds, approves delivery</li>
  <li><strong>Seller</strong> — marks delivery complete, receives funds</li>
  <li><strong>Arbiter</strong> — resolves disputes between buyer and seller</li>
</ul>

<h2>State Machine</h2>
<pre><code>Created → Funded → Delivered → Completed
                ↓              ↓
             Refunded       Refunded (via arbiter)
                ↓
            Disputed → Completed | Refunded</code></pre>

<h2>Happy Path</h2>
<pre><code>// 1. Initialize escrow
escrow.initialize({
  buyer, seller, arbiter,
  token_contract: tokenId,
  amount: 10_000_000_000n,
  deadline_ledger: currentLedger + 17280,
});

// 2. Buyer funds (requires buyer signature + token approval)
token.approve({ from: buyer, spender: escrowId, amount: 10_000_000_000n, expiration_ledger: 9999999 });
escrow.fund();  // signed by buyer

// 3. Seller delivers
escrow.mark_delivered();  // signed by seller

// 4. Buyer approves → funds released to seller
escrow.approve_delivery();  // signed by buyer</code></pre>

<h2>Refund Path</h2>
<pre><code>// After deadline passes without delivery:
escrow.request_refund();  // signed by buyer — funds return to buyer</code></pre>

<h2>Dispute Resolution</h2>
<pre><code>// Arbiter decides:
escrow.resolve_dispute({ release_to_seller: true });  // → seller gets funds
escrow.resolve_dispute({ release_to_seller: false }); // → buyer gets refund</code></pre>

<div class="callout callout-warn">
  The buyer must <code>approve()</code> the escrow contract to spend tokens before calling <code>fund()</code>.
</div>
`,
  };

  return { SECTIONS, PAGES };
})();
