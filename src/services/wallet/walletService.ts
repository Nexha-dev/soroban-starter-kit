import type { WalletProvider, WalletState, WalletAccount, SignTransactionOptions } from './types';

// ── Freighter browser extension shim ─────────────────────────────────────────
// https://docs.freighter.app/docs/guide/usingFreighterBrowser

declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network?: string; networkPassphrase?: string }) => Promise<string>;
      getNetwork: () => Promise<string>;
    };
    albedo?: {
      publicKey: (opts?: object) => Promise<{ pubkey: string }>;
      tx: (opts: { xdr: string; network?: string; submit?: boolean }) => Promise<{ signed_envelope_xdr: string }>;
    };
  }
}

type Listener = (state: WalletState) => void;

const STORAGE_KEY = 'fidelis-wallet';

const DEFAULT_STATE: WalletState = {
  provider: null,
  status: 'disconnected',
  account: null,
  accounts: [],
  error: null,
  available: [],
};

class WalletService {
  private state: WalletState = { ...DEFAULT_STATE };
  private listeners = new Set<Listener>();

  // ── Subscription ────────────────────────────────────────────────────────────

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): WalletState {
    return this.state;
  }

  private emit(patch: Partial<WalletState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(fn => fn(this.state));
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  init(): void {
    const available: WalletProvider[] = [];
    if (typeof window !== 'undefined') {
      if (window.freighter) available.push('freighter');
      if (window.albedo) available.push('albedo');
      // WalletConnect is always "available" (QR-code based, no extension needed)
      available.push('walletconnect');
    }

    // Restore last session
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { provider: WalletProvider; account: WalletAccount };
        this.emit({ available, provider: saved.provider, account: saved.account, accounts: [saved.account], status: 'connected' });
        return;
      }
    } catch { /* ignore */ }

    this.emit({ available });
  }

  // ── Connect ─────────────────────────────────────────────────────────────────

  async connect(provider: WalletProvider): Promise<void> {
    this.emit({ status: 'connecting', error: null, provider });
    try {
      const account = await this.getAccount(provider);
      this.emit({ status: 'connected', account, accounts: [account] });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, account }));
    } catch (err) {
      this.emit({ status: 'error', error: (err as Error).message, provider: null });
    }
  }

  // ── Disconnect ──────────────────────────────────────────────────────────────

  disconnect(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.emit({ ...DEFAULT_STATE, available: this.state.available });
  }

  // ── Switch account ──────────────────────────────────────────────────────────

  switchAccount(publicKey: string): void {
    const account = this.state.accounts.find(a => a.publicKey === publicKey);
    if (!account) return;
    this.emit({ account });
    if (this.state.provider) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: this.state.provider, account }));
    }
  }

  // ── Sign transaction ────────────────────────────────────────────────────────

  async signTransaction(xdr: string, opts: SignTransactionOptions = {}): Promise<string> {
    if (this.state.status !== 'connected' || !this.state.provider) {
      throw new Error('No wallet connected');
    }
    const network = opts.network ?? 'testnet';
    const passphrase = opts.networkPassphrase ?? (network === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015');

    switch (this.state.provider) {
      case 'freighter': {
        if (!window.freighter) throw new Error('Freighter extension not found');
        return window.freighter.signTransaction(xdr, { network, networkPassphrase: passphrase });
      }
      case 'albedo': {
        if (!window.albedo) throw new Error('Albedo not found');
        const result = await window.albedo.tx({ xdr, network });
        return result.signed_envelope_xdr;
      }
      case 'walletconnect': {
        // WalletConnect signing is handled externally via QR session;
        // in a real integration this would call the WalletConnect client.
        throw new Error('WalletConnect signing not yet implemented — pair a wallet first');
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async getAccount(provider: WalletProvider): Promise<WalletAccount> {
    switch (provider) {
      case 'freighter': {
        if (!window.freighter) throw new Error('Freighter extension not installed');
        const connected = await window.freighter.isConnected();
        if (!connected) throw new Error('Freighter is locked — please unlock it first');
        const publicKey = await window.freighter.getPublicKey();
        return { publicKey };
      }
      case 'albedo': {
        if (!window.albedo) throw new Error('Albedo not available');
        const { pubkey } = await window.albedo.publicKey();
        return { publicKey: pubkey };
      }
      case 'walletconnect': {
        // Stub: real impl would open a QR modal and await pairing
        throw new Error('WalletConnect pairing not yet implemented');
      }
    }
  }
}

export const walletService = new WalletService();
