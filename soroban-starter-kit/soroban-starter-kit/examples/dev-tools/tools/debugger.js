/**
 * debugger.js
 * XDR decoder, event parser, and error code lookup for Soroban contracts.
 */

const SorobanDebugger = (() => {

  // ── Error registries ───────────────────────────────────────────────────────

  const ERROR_REGISTRY = {
    token: {
      1: { name: 'InsufficientBalance',   desc: 'The account does not have enough tokens for this operation.', fix: 'Check the account balance with balance() before transferring.' },
      2: { name: 'InsufficientAllowance', desc: 'The spender allowance is less than the requested amount.',   fix: 'Call approve() with a sufficient amount before transfer_from().' },
      3: { name: 'Unauthorized',          desc: 'The caller is not the contract admin.',                       fix: 'Ensure the transaction is signed by the admin address.' },
      4: { name: 'AlreadyInitialized',    desc: 'initialize() has already been called on this contract.',     fix: 'This contract is already set up. No action needed.' },
      5: { name: 'NotInitialized',        desc: 'The contract has not been initialized yet.',                  fix: 'Call initialize() with an admin address first.' },
    },
    escrow: {
      1: { name: 'NotAuthorized',      desc: 'The caller is not authorized for this action.',                    fix: 'Ensure the correct party (buyer/seller/arbiter) is signing.' },
      2: { name: 'InvalidState',       desc: 'The escrow is not in the required state for this operation.',      fix: 'Check get_state() and follow the correct escrow flow.' },
      3: { name: 'DeadlinePassed',     desc: 'The escrow deadline has already passed.',                          fix: 'The deadline has expired. Use request_refund() if applicable.' },
      4: { name: 'DeadlineNotReached', desc: 'The deadline has not passed yet — refund not available.',          fix: 'Wait until the deadline ledger sequence is reached.' },
      5: { name: 'AlreadyInitialized', desc: 'initialize() has already been called on this escrow.',            fix: 'This escrow is already set up.' },
      6: { name: 'NotInitialized',     desc: 'The escrow contract has not been initialized.',                    fix: 'Call initialize() with all required parties and terms.' },
      7: { name: 'InsufficientFunds',  desc: 'The buyer does not have enough tokens to fund the escrow.',       fix: 'Ensure the buyer has sufficient token balance before calling fund().' },
    },
  };

  // ── XDR type hints ─────────────────────────────────────────────────────────

  const XDR_PREFIXES = {
    'AAAAA': 'TransactionEnvelope (likely)',
    'AAAAB': 'TransactionResult (likely)',
    'AAAAC': 'OperationResult (likely)',
  };

  // ── Decode ─────────────────────────────────────────────────────────────────

  function decodeXdr(input, typeHint) {
    input = input.trim();

    // Hash — just describe it
    if (/^[a-f0-9]{64}$/i.test(input)) {
      return {
        type: 'Transaction Hash',
        value: input,
        note: 'This is a 32-byte hex transaction hash. Use the Stellar Horizon API to fetch full details.',
        horizon: `https://horizon-testnet.stellar.org/transactions/${input}`,
      };
    }

    // Base64 XDR
    if (/^[A-Za-z0-9+/=]+$/.test(input)) {
      try {
        const bytes = atob(input);
        const hex = Array.from(bytes).map(b => b.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        const prefix = input.slice(0, 5);
        const guessedType = typeHint !== 'auto' ? typeHint : (XDR_PREFIXES[prefix] || 'Unknown XDR type');

        return {
          type: guessedType,
          base64: input,
          byteLength: bytes.length,
          hexPreview: hex.slice(0, 120) + (hex.length > 120 ? '...' : ''),
          note: 'Full XDR decoding requires @stellar/stellar-sdk. Install it and use TransactionBuilder.fromXDR() or xdr.TransactionEnvelope.fromXDR().',
          sdkSnippet: `import { xdr } from "@stellar/stellar-sdk";
const decoded = xdr.${typeHint !== 'auto' ? typeHint : 'TransactionEnvelope'}.fromXDR("${input.slice(0, 40)}...", "base64");
console.log(JSON.stringify(decoded, null, 2));`,
        };
      } catch {
        return { error: 'Invalid base64 — could not decode.' };
      }
    }

    // JSON passthrough
    try {
      const parsed = JSON.parse(input);
      return { type: 'JSON', parsed };
    } catch {
      // ignore
    }

    return { error: 'Unrecognized input. Paste a base64 XDR string, a 64-char transaction hash, or JSON.' };
  }

  // ── Error lookup ───────────────────────────────────────────────────────────

  function lookupError(contract, code) {
    const registry = ERROR_REGISTRY[contract];
    if (!registry) return null;
    return registry[parseInt(code)] || null;
  }

  // ── Event parser ───────────────────────────────────────────────────────────

  function parseEvent(raw) {
    let event;
    try {
      event = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { error: 'Invalid JSON. Paste the event object from the Soroban RPC response.' };
    }

    const result = {
      type:       event.type       || 'unknown',
      ledger:     event.ledger     || 'unknown',
      contractId: event.contractId || 'unknown',
      txHash:     event.txHash     || 'unknown',
    };

    // Decode topic array
    if (Array.isArray(event.topic)) {
      result.topics = event.topic.map((t, i) => ({
        index: i,
        xdr: typeof t === 'string' ? t : JSON.stringify(t),
        note: 'Decode with xdr.ScVal.fromXDR(topic, "base64")',
      }));
    }

    // Decode value
    if (event.value) {
      result.value = {
        xdr: typeof event.value === 'string' ? event.value : JSON.stringify(event.value),
        note: 'Decode with xdr.ScVal.fromXDR(value.xdr, "base64")',
      };
    }

    // Try to match known event names from topic[0]
    const knownEvents = [
      'initialize', 'mint', 'burn', 'transfer', 'approve', 'set_admin',
      'escrow_created', 'escrow_funded', 'delivery_marked', 'funds_released', 'funds_refunded',
    ];
    result.possibleEventName = knownEvents.find(e =>
      JSON.stringify(event.topic || []).toLowerCase().includes(e)
    ) || 'unknown';

    return result;
  }

  return { decodeXdr, lookupError, parseEvent };
})();
