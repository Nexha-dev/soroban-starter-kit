// Types for the contract interaction interface

export type ParamKind =
  | 'address'
  | 'amount'
  | 'string'
  | 'u32'
  | 'i128'
  | 'bool'
  | 'bytes'
  | 'vec'      // array of items
  | 'map'      // key-value pairs
  | 'option';  // optional wrapper

export interface ParamDef {
  name: string;
  kind: ParamKind;
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** For vec/map: the element type */
  itemKind?: ParamKind;
  /** For option: the inner type */
  innerKind?: ParamKind;
}

export interface FunctionDef {
  name: string;       // e.g. "transfer"
  label: string;
  icon: string;
  description: string;
  docs?: string;
  estimatedFee: string; // XLM
  params: ParamDef[];
  readOnly?: boolean;   // view functions — no tx needed
  /** Category tag for grouping */
  category?: 'token' | 'escrow' | 'admin' | 'query' | 'other';
}

export interface SimulationResult {
  success: boolean;
  returnValue?: string;
  returnType?: string;
  gasUsed?: number;
  feeXLM?: string;
  feeStroops?: number;
  ledgerChanges?: LedgerChange[];
  events?: ContractEvent[];
  error?: string;
  errorCode?: string;
}

export interface LedgerChange {
  type: 'created' | 'updated' | 'deleted';
  key: string;
  before?: string;
  after?: string;
}

export interface ContractEvent {
  type: string;
  topics: string[];
  data: string;
}

export interface BatchItem {
  id: string;
  fn: FunctionDef;
  params: Record<string, string>;
  status: 'queued' | 'submitted' | 'done' | 'error';
  error?: string;
  txHash?: string;
  completedAt?: number;
}

export interface ContractABI {
  contractId: string;
  name: string;
  description?: string;
  version?: string;
  functions: FunctionDef[];
}

export interface TxStatusUpdate {
  txHash: string;
  status: 'pending' | 'success' | 'failed' | 'not_found';
  ledger?: number;
  timestamp?: number;
  errorMessage?: string;
}

export interface GasEstimate {
  instructions: number;
  readBytes: number;
  writeBytes: number;
  feeXLM: string;
  feeStroops: number;
  isEstimate: boolean;
}
