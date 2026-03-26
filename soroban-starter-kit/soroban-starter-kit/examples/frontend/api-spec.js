/**
 * api-spec.js
 * Contract method definitions — parameters, types, auth requirements, descriptions.
 */

const NETWORKS = {
  testnet:   { rpc: 'https://soroban-testnet.stellar.org', passphrase: 'Test SDF Network ; September 2015' },
  mainnet:   { rpc: 'https://mainnet.stellar.validationcloud.io/v1/XCSmR1M4e9QoQ5qJJLfMCQ==', passphrase: 'Public Global Stellar Network ; September 2015' },
  futurenet: { rpc: 'https://rpc-futurenet.stellar.org', passphrase: 'Test SDF Future Network ; October 2022' },
};

const PARAM_TYPES = {
  ADDRESS: 'address',
  I128:    'i128',
  U32:     'u32',
  BOOL:    'bool',
  STRING:  'string',
};

/** @type {Record<string, ContractSpec>} */
const CONTRACT_SPECS = {
  token: {
    label: 'Token Contract',
    description: 'Fungible token implementing the Soroban Token Interface with admin controls.',
    methods: {
      // ── Read methods ──────────────────────────────────────────────────────
      balance: {
        label: 'balance',
        type: 'read',
        description: 'Returns the token balance of an account.',
        auth: [],
        params: [
          { name: 'id', type: PARAM_TYPES.ADDRESS, description: 'Account address to query', required: true, example: 'GABC...XYZ' },
        ],
        returns: { type: 'i128', description: 'Token balance (raw, divide by 10^decimals for display)' },
        errors: [],
      },
      allowance: {
        label: 'allowance',
        type: 'read',
        description: 'Returns the amount a spender is approved to transfer on behalf of an owner.',
        auth: [],
        params: [
          { name: 'from',    type: PARAM_TYPES.ADDRESS, description: 'Token owner address', required: true, example: 'GABC...XYZ' },
          { name: 'spender', type: PARAM_TYPES.ADDRESS, description: 'Approved spender address', required: true, example: 'GDEF...ABC' },
        ],
        returns: { type: 'i128', description: 'Approved allowance amount' },
        errors: [],
      },
      name: {
        label: 'name',
        type: 'read',
        description: 'Returns the token name.',
        auth: [],
        params: [],
        returns: { type: 'String', description: 'Token name (e.g. "My Token")' },
        errors: [],
      },
      symbol: {
        label: 'symbol',
        type: 'read',
        description: 'Returns the token ticker symbol.',
        auth: [],
        params: [],
        returns: { type: 'String', description: 'Token symbol (e.g. "MTK")' },
        errors: [],
      },
      decimals: {
        label: 'decimals',
        type: 'read',
        description: 'Returns the number of decimal places used by the token.',
        auth: [],
        params: [],
        returns: { type: 'u32', description: 'Decimal precision (commonly 7)' },
        errors: [],
      },
      total_supply: {
        label: 'total_supply',
        type: 'read',
        description: 'Returns the total minted supply of the token.',
        auth: [],
        params: [],
        returns: { type: 'i128', description: 'Total supply (raw)' },
        errors: [],
      },
      admin: {
        label: 'admin',
        type: 'read',
        description: 'Returns the current admin address.',
        auth: [],
        params: [],
        returns: { type: 'Address', description: 'Admin account address' },
        errors: [],
      },

      // ── Write methods ─────────────────────────────────────────────────────
      initialize: {
        label: 'initialize',
        type: 'write',
        description: 'Initializes the token contract. Can only be called once. Requires admin signature.',
        auth: ['admin'],
        params: [
          { name: 'admin',    type: PARAM_TYPES.ADDRESS, description: 'Admin address', required: true, example: 'GABC...XYZ' },
          { name: 'name',     type: PARAM_TYPES.STRING,  description: 'Token name', required: true, example: 'My Token' },
          { name: 'symbol',   type: PARAM_TYPES.STRING,  description: 'Token symbol', required: true, example: 'MTK' },
          { name: 'decimals', type: PARAM_TYPES.U32,     description: 'Decimal places (0–18)', required: true, example: '7' },
        ],
        returns: { type: 'Result<(), TokenError>', description: 'Ok on success' },
        errors: ['AlreadyInitialized (4)'],
      },
      mint: {
        label: 'mint',
        type: 'write',
        description: 'Mints new tokens to a recipient. Admin only.',
        auth: ['admin'],
        params: [
          { name: 'to',     type: PARAM_TYPES.ADDRESS, description: 'Recipient address', required: true, example: 'GABC...XYZ' },
          { name: 'amount', type: PARAM_TYPES.I128,    description: 'Amount to mint (raw)', required: true, example: '1000000000' },
        ],
        returns: { type: 'Result<(), TokenError>', description: 'Ok on success' },
        errors: ['NotInitialized (5)', 'Unauthorized (3)'],
      },
      burn: {
        label: 'burn',
        type: 'write',
        description: 'Burns tokens from an account. Admin only.',
        auth: ['admin'],
        params: [
          { name: 'from',   type: PARAM_TYPES.ADDRESS, description: 'Account to burn from', required: true, example: 'GABC...XYZ' },
          { name: 'amount', type: PARAM_TYPES.I128,    description: 'Amount to burn (raw)', required: true, example: '1000000000' },
        ],
        returns: { type: 'Result<(), TokenError>', description: 'Ok on success' },
        errors: ['InsufficientBalance (1)', 'NotInitialized (5)'],
      },
      transfer: {
        label: 'transfer',
        type: 'write',
        description: 'Transfers tokens from one account to another. Requires sender signature.',
        auth: ['from'],
        params: [
          { name: 'from',   type: PARAM_TYPES.ADDRESS, description: 'Sender address', required: true, example: 'GABC...XYZ' },
          { name: 'to',     type: PARAM_TYPES.ADDRESS, description: 'Recipient address', required: true, example: 'GDEF...ABC' },
          { name: 'amount', type: PARAM_TYPES.I128,    description: 'Amount to transfer (raw)', required: true, example: '500000000' },
        ],
        returns: { type: 'void', description: 'Panics on failure' },
        errors: ['InsufficientBalance (1)'],
      },
      transfer_from: {
        label: 'transfer_from',
        type: 'write',
        description: 'Transfers tokens using an approved allowance. Requires spender signature.',
        auth: ['spender'],
        params: [
          { name: 'spender', type: PARAM_TYPES.ADDRESS, description: 'Approved spender address', required: true, example: 'GDEF...ABC' },
          { name: 'from',    type: PARAM_TYPES.ADDRESS, description: 'Token owner address', required: true, example: 'GABC...XYZ' },
          { name: 'to',      type: PARAM_TYPES.ADDRESS, description: 'Recipient address', required: true, example: 'GHIJ...DEF' },
          { name: 'amount',  type: PARAM_TYPES.I128,    description: 'Amount to transfer (raw)', required: true, example: '100000000' },
        ],
        returns: { type: 'void', description: 'Panics on failure' },
        errors: ['InsufficientAllowance (2)', 'InsufficientBalance (1)'],
      },
      approve: {
        label: 'approve',
        type: 'write',
        description: 'Approves a spender to transfer tokens on behalf of the owner.',
        auth: ['from'],
        params: [
          { name: 'from',              type: PARAM_TYPES.ADDRESS, description: 'Token owner address', required: true, example: 'GABC...XYZ' },
          { name: 'spender',           type: PARAM_TYPES.ADDRESS, description: 'Spender address', required: true, example: 'GDEF...ABC' },
          { name: 'amount',            type: PARAM_TYPES.I128,    description: 'Approved amount (raw)', required: true, example: '1000000000' },
          { name: 'expiration_ledger', type: PARAM_TYPES.U32,     description: 'Ledger sequence at which approval expires', required: true, example: '9999999' },
        ],
        returns: { type: 'void', description: 'Emits approve event' },
        errors: [],
      },
      set_admin: {
        label: 'set_admin',
        type: 'write',
        description: 'Transfers admin role to a new address. Current admin only.',
        auth: ['admin'],
        params: [
          { name: 'new_admin', type: PARAM_TYPES.ADDRESS, description: 'New admin address', required: true, example: 'GABC...XYZ' },
        ],
        returns: { type: 'Result<(), TokenError>', description: 'Ok on success' },
        errors: ['NotInitialized (5)', 'Unauthorized (3)'],
      },
    },
  },

  escrow: {
    label: 'Escrow Contract',
    description: 'Secure two-party escrow with buyer, seller, arbiter roles and deadline-based refunds.',
    methods: {
      // ── Read methods ──────────────────────────────────────────────────────
      get_escrow_info: {
        label: 'get_escrow_info',
        type: 'read',
        description: 'Returns all escrow details: parties, token, amount, deadline, and current state.',
        auth: [],
        params: [],
        returns: { type: '(Address, Address, Address, Address, i128, u32, EscrowState)', description: '(buyer, seller, arbiter, token_contract, amount, deadline_ledger, state)' },
        errors: [],
      },
      get_state: {
        label: 'get_state',
        type: 'read',
        description: 'Returns the current escrow state.',
        auth: [],
        params: [],
        returns: { type: 'EscrowState', description: 'Created | Funded | Delivered | Completed | Refunded | Disputed' },
        errors: [],
      },
      is_deadline_passed: {
        label: 'is_deadline_passed',
        type: 'read',
        description: 'Returns true if the current ledger sequence has passed the deadline.',
        auth: [],
        params: [],
        returns: { type: 'bool', description: 'true if deadline has passed' },
        errors: [],
      },

      // ── Write methods ─────────────────────────────────────────────────────
      initialize: {
        label: 'initialize',
        type: 'write',
        description: 'Sets up the escrow with all parties and terms. Can only be called once.',
        auth: [],
        params: [
          { name: 'buyer',           type: PARAM_TYPES.ADDRESS, description: 'Buyer address', required: true, example: 'GABC...XYZ' },
          { name: 'seller',          type: PARAM_TYPES.ADDRESS, description: 'Seller address', required: true, example: 'GDEF...ABC' },
          { name: 'arbiter',         type: PARAM_TYPES.ADDRESS, description: 'Arbiter address (dispute resolver)', required: true, example: 'GHIJ...DEF' },
          { name: 'token_contract',  type: PARAM_TYPES.ADDRESS, description: 'Token contract address', required: true, example: 'CXYZ...123' },
          { name: 'amount',          type: PARAM_TYPES.I128,    description: 'Escrow amount (raw token units)', required: true, example: '10000000000' },
          { name: 'deadline_ledger', type: PARAM_TYPES.U32,     description: 'Ledger sequence number for deadline', required: true, example: '9999999' },
        ],
        returns: { type: 'Result<(), EscrowError>', description: 'Ok on success' },
        errors: ['AlreadyInitialized (5)', 'Deadline must be in the future'],
      },
      fund: {
        label: 'fund',
        type: 'write',
        description: 'Buyer transfers the escrow amount into the contract. Requires buyer signature.',
        auth: ['buyer'],
        params: [],
        returns: { type: 'Result<(), EscrowError>', description: 'Ok on success' },
        errors: ['NotInitialized (6)', 'InvalidState (2)'],
      },
      mark_delivered: {
        label: 'mark_delivered',
        type: 'write',
        description: 'Seller marks the delivery as complete. Requires seller signature.',
        auth: ['seller'],
        params: [],
        returns: { type: 'Result<(), EscrowError>', description: 'Ok on success' },
        errors: ['NotInitialized (6)', 'InvalidState (2)'],
      },
      approve_delivery: {
        label: 'approve_delivery',
        type: 'write',
        description: 'Buyer approves delivery and releases funds to the seller. Requires buyer signature.',
        auth: ['buyer'],
        params: [],
        returns: { type: 'Result<(), EscrowError>', description: 'Ok on success' },
        errors: ['NotInitialized (6)', 'InvalidState (2)'],
      },
      request_refund: {
        label: 'request_refund',
        type: 'write',
        description: 'Buyer requests a refund after the deadline has passed. Requires buyer signature.',
        auth: ['buyer'],
        params: [],
        returns: { type: 'Result<(), EscrowError>', description: 'Ok on success' },
        errors: ['NotInitialized (6)', 'DeadlineNotReached (4)'],
      },
      resolve_dispute: {
        label: 'resolve_dispute',
        type: 'write',
        description: 'Arbiter resolves a dispute by releasing funds to either party. Requires arbiter signature.',
        auth: ['arbiter'],
        params: [
          { name: 'release_to_seller', type: PARAM_TYPES.BOOL, description: 'true = release to seller, false = refund buyer', required: true, example: 'true' },
        ],
        returns: { type: 'Result<(), EscrowError>', description: 'Ok on success' },
        errors: ['NotInitialized (6)', 'InvalidState (2)', 'NotAuthorized (1)'],
      },
    },
  },
};
