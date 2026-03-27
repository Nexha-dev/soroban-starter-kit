import type { ContractABI, FunctionDef, SimulationResult, ParamDef, GasEstimate, TxStatusUpdate } from './types';

// ── Built-in ABIs ─────────────────────────────────────────────────────────────

const TOKEN_ABI: FunctionDef[] = [
  {
    name: 'transfer', label: 'Transfer', icon: '💸', category: 'token',
    description: 'Send tokens to another address.',
    docs: 'Transfers `amount` stroops from the caller to `to`. Emits a Transfer event.',
    estimatedFee: '0.00001',
    params: [
      { name: 'to',     kind: 'address', label: 'Recipient',      placeholder: 'G...', hint: 'Stellar public key', required: true },
      { name: 'amount', kind: 'amount',  label: 'Amount (stroops)', placeholder: '10000000', hint: '1 token = 10,000,000 stroops', required: true },
    ],
  },
  {
    name: 'mint', label: 'Mint', icon: '🪙', category: 'admin',
    description: 'Create new tokens (admin only).',
    docs: 'Mints `amount` stroops to `to`. Caller must be the contract admin.',
    estimatedFee: '0.00001',
    params: [
      { name: 'to',     kind: 'address', label: 'Recipient',      placeholder: 'G...', required: true },
      { name: 'amount', kind: 'amount',  label: 'Amount (stroops)', placeholder: '10000000', required: true },
    ],
  },
  {
    name: 'burn', label: 'Burn', icon: '🔥', category: 'token',
    description: 'Destroy tokens from your balance.',
    docs: 'Burns `amount` stroops from the caller\'s balance.',
    estimatedFee: '0.00001',
    params: [
      { name: 'amount', kind: 'amount', label: 'Amount (stroops)', placeholder: '10000000', required: true },
    ],
  },
  {
    name: 'approve', label: 'Approve', icon: '✅', category: 'token',
    description: 'Allow a spender to use tokens on your behalf.',
    docs: 'Sets the allowance for `spender` to `amount` stroops, expiring at `expiration_ledger`.',
    estimatedFee: '0.00001',
    params: [
      { name: 'spender',           kind: 'address', label: 'Spender Address',    placeholder: 'G...', required: true },
      { name: 'amount',            kind: 'amount',  label: 'Allowance (stroops)', placeholder: '10000000', required: true },
      { name: 'expiration_ledger', kind: 'u32',     label: 'Expiration Ledger',   placeholder: '1000000', hint: 'Ledger number when approval expires', required: true },
    ],
  },
  {
    name: 'balance', label: 'Balance', icon: '📊', category: 'query',
    description: 'Query token balance of an address.',
    docs: 'Returns the balance in stroops for `id`. Read-only — no transaction required.',
    estimatedFee: '0',
    readOnly: true,
    params: [
      { name: 'id', kind: 'address', label: 'Address', placeholder: 'G...', required: true },
    ],
  },
  {
    name: 'allowance', label: 'Allowance', icon: '🔑', category: 'query',
    description: 'Query the spending allowance for a spender.',
    docs: 'Returns the allowance in stroops that `spender` can use from `from`.',
    estimatedFee: '0',
    readOnly: true,
    params: [
      { name: 'from',    kind: 'address', label: 'Owner Address',   placeholder: 'G...', required: true },
      { name: 'spender', kind: 'address', label: 'Spender Address', placeholder: 'G...', required: true },
    ],
  },
];

const ESCROW_ABI: FunctionDef[] = [
  {
    name: 'fund', label: 'Fund Escrow', icon: '🔒', category: 'escrow',
    description: 'Deposit tokens into an escrow contract.',
    docs: 'Transfers `amount` stroops into the escrow. Caller must be the buyer.',
    estimatedFee: '0.00002',
    params: [
      { name: 'escrowId', kind: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
      { name: 'amount',   kind: 'amount', label: 'Amount (stroops)',    placeholder: '10000000', required: true },
    ],
  },
  {
    name: 'release', label: 'Release Escrow', icon: '🔓', category: 'escrow',
    description: 'Release escrowed funds to the seller.',
    docs: 'Marks delivery complete and releases funds to the seller. Caller must be buyer or arbiter.',
    estimatedFee: '0.00001',
    params: [
      { name: 'escrowId', kind: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
    ],
  },
  {
    name: 'refund', label: 'Refund Escrow', icon: '↩️', category: 'escrow',
    description: 'Refund escrowed funds back to the buyer.',
    docs: 'Returns funds to the buyer. Only callable after deadline or by arbiter.',
    estimatedFee: '0.00001',
    params: [
      { name: 'escrowId', kind: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
    ],
  },
  {
    name: 'status', label: 'Escrow Status', icon: '📋', category: 'query',
    description: 'Query the current status of an escrow.',
    docs: 'Returns the escrow state: funded, released, refunded, or pending.',
    estimatedFee: '0',
    readOnly: true,
    params: [
      { name: 'escrowId', kind: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
    ],
  },
];

const BUILT_IN_ABIS: ContractABI[] = [
  { contractId: 'token',  name: 'Token Contract',  functions: TOKEN_ABI  },
  { contractId: 'escrow', name: 'Escrow Contract', functions: ESCROW_ABI },
];

// ── Validation ────────────────────────────────────────────────────────────────

export function validateParam(value: string, def: ParamDef): string | null {
  if (def.required && !value.trim()) return `${def.label} is required.`;
  if (!value.trim()) return null;
  switch (def.kind) {
    case 'address':
      if (!/^[GC][A-Z2-7]{55}$/.test(value.trim())) return 'Must be a valid Stellar/contract address.';
      break;
    case 'amount':
    case 'u32': {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) return 'Must be a positive integer.';
      break;
    }
    case 'i128': {
      if (!/^-?\d+$/.test(value.trim())) return 'Must be an integer.';
      break;
    }
    case 'bool':
      if (!['true', 'false'].includes(value.trim().toLowerCase())) return 'Must be true or false.';
      break;
  }
  return null;
}

// ── Simulation (mock — replace with real Soroban RPC call) ───────────────────

export async function simulateTransaction(
  contractId: string,
  fnName: string,
  params: Record<string, string>,
): Promise<SimulationResult> {
  await new Promise((r) => setTimeout(r, 700));

  if (contractId && !/^[A-Za-z0-9_-]+$/.test(contractId)) {
    return { success: false, error: 'Invalid contract ID format.', errorCode: 'INVALID_CONTRACT' };
  }

  const gasUsed = 500_000 + Math.floor(Math.random() * 200_000);
  const feeStroops = Math.ceil(gasUsed * 0.1);
  const feeXLM = (feeStroops / 1e7).toFixed(7);

  const mockEvents = fnName !== 'balance' && fnName !== 'allowance' && fnName !== 'status'
    ? [{ type: 'contract', topics: [`fn:${fnName}`, `contract:${contractId}`], data: JSON.stringify(params) }]
    : [];

  const mockLedgerChanges = fnName === 'transfer' || fnName === 'mint' || fnName === 'burn'
    ? [{ type: 'updated' as const, key: `balance:${params.to ?? 'caller'}`, before: '0', after: params.amount ?? '0' }]
    : [];

  return {
    success: true,
    returnValue: (fnName === 'balance' || fnName === 'allowance')
      ? String(Math.floor(Math.random() * 1e9))
      : fnName === 'status' ? 'funded'
      : undefined,
    returnType: (fnName === 'balance' || fnName === 'allowance') ? 'i128' : fnName === 'status' ? 'string' : 'void',
    gasUsed,
    feeXLM,
    feeStroops,
    events: mockEvents,
    ledgerChanges: mockLedgerChanges,
  };
}

// ── Gas estimation ────────────────────────────────────────────────────────────

export async function estimateGas(
  _contractId: string,
  _fnName: string,
  _params: Record<string, string>,
): Promise<GasEstimate> {
  await new Promise((r) => setTimeout(r, 300));
  const instructions = 400_000 + Math.floor(Math.random() * 150_000);
  const readBytes = 200 + Math.floor(Math.random() * 300);
  const writeBytes = 100 + Math.floor(Math.random() * 200);
  const feeStroops = Math.ceil(instructions * 0.1 + readBytes * 10 + writeBytes * 20);
  return {
    instructions,
    readBytes,
    writeBytes,
    feeStroops,
    feeXLM: (feeStroops / 1e7).toFixed(7),
    isEstimate: true,
  };
}

// ── Transaction status polling (mock) ─────────────────────────────────────────

export async function pollTransactionStatus(txHash: string): Promise<TxStatusUpdate> {
  await new Promise((r) => setTimeout(r, 1000));
  const roll = Math.random();
  if (roll > 0.3) {
    return { txHash, status: 'success', ledger: 1_000_000 + Math.floor(Math.random() * 10000), timestamp: Date.now() };
  }
  return { txHash, status: 'pending' };
}

// ── ABI discovery ─────────────────────────────────────────────────────────────

export function getBuiltInABIs(): ContractABI[] {
  return BUILT_IN_ABIS;
}

/** Parse a minimal JSON ABI (array of FunctionDef) pasted by the user */
export function parseCustomABI(json: string): ContractABI | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const functions: FunctionDef[] = parsed.map((f: Record<string, unknown>) => ({
      name:         String(f.name ?? ''),
      label:        String(f.label ?? f.name ?? ''),
      icon:         String(f.icon ?? '⚙️'),
      description:  String(f.description ?? ''),
      docs:         f.docs ? String(f.docs) : undefined,
      estimatedFee: String(f.estimatedFee ?? '0.00001'),
      readOnly:     Boolean(f.readOnly),
      params:       Array.isArray(f.params) ? f.params.map((p: Record<string, unknown>) => ({
        name:        String(p.name ?? ''),
        kind:        String(p.kind ?? 'string') as ParamDef['kind'],
        label:       String(p.label ?? p.name ?? ''),
        placeholder: p.placeholder ? String(p.placeholder) : undefined,
        hint:        p.hint ? String(p.hint) : undefined,
        required:    Boolean(p.required),
      })) : [],
    }));
    return { contractId: 'custom', name: 'Custom Contract', functions };
  } catch {
    return null;
  }
}
