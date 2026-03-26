import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@soroban_tx_history';

export type TxRecord = {
  id: string;
  type: 'transfer' | 'fund' | 'mark_delivered' | 'approve_delivery' | 'request_refund' | 'mint' | 'burn';
  contract: 'token' | 'escrow';
  amount?: string;
  from?: string;
  to?: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: number;
};

export async function appendTx(tx: Omit<TxRecord, 'id' | 'timestamp'>) {
  const history = await loadHistory();
  const record: TxRecord = { ...tx, id: Date.now().toString(), timestamp: Date.now() };
  const next = [record, ...history].slice(0, 500); // cap at 500
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return record;
}

export async function loadHistory(): Promise<TxRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearHistory() {
  await AsyncStorage.removeItem(KEY);
}
