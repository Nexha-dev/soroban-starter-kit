export type WalletProvider = 'freighter' | 'albedo' | 'walletconnect';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletAccount {
  publicKey: string;
  name?: string;
}

export interface WalletState {
  provider: WalletProvider | null;
  status: WalletStatus;
  account: WalletAccount | null;
  accounts: WalletAccount[];
  error: string | null;
  /** Which providers are detected/available in the current environment */
  available: WalletProvider[];
}

export interface SignTransactionOptions {
  network?: 'testnet' | 'mainnet';
  networkPassphrase?: string;
}
