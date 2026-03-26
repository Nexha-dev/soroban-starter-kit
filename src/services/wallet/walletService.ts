import type {
  WalletId,
  WalletInfo,
  WalletAccount,
  WalletConnection,
  WalletState,
  WalletPreferences,
  ConnectionEvent,
  NetworkPassphrase,
} from './types';

export const WALLET_REGISTRY: Record<WalletId, WalletInfo> = {
  freighter: {
    id: 'freighter',
    name: 'Freighter',
    icon: '🔐',
    downloadUrl: 'https://freighter.app/',
  },
  albedo: {
    id: 'albedo',
    name: 'Albedo',
    icon: '🌐',
    downloadUrl: 'https://albedo.link/',
  },
  xbull: {
    id: 'xbull',
    name: 'xBull',
    icon: '🐂',
    downloadUrl: 'https://xbull.app/',
  },
  rabet: {
    id: 'rabet',
    name: 'Rabet',
    icon: '🐇',
    downloadUrl: 'https://rabet.io/',
  },
};

const STORAGE_KEY = 'soroban_wallet_state';
const MAX_HISTORY = 50;

const DEFAULT_PREFERENCES: WalletPreferences = {
  preferredWallet: null,
  autoReconnect: true,
  network: 'testnet',
};

const DEFAULT_STATE: WalletState = {
  activeConnection: null,
  status: 'disconnected',
  error: null,
  detectedWallets: [],
  connectionHistory: [],
  preferences: DEFAULT_PREFERENCES,
};

type Listener = (state: WalletState) => void;

/** Detect if a wallet extension is available in the browser */
function detectWallet(id: WalletId): boolean {
  switch (id) {
    case 'freighter':
      return typeof (window as any).freighter !== 'undefined';
    case 'albedo':
      return typeof (window as any).albedo !== 'undefined';
    case 'xbull':
      return typeof (window as any).xBullSDK !== 'undefined';
    case 'rabet':
      return typeof (window as any).rabet !== 'undefined';
    default:
      return false;
  }
}

/** Request public key from a specific wallet */
async function requestPublicKey(id: WalletId, network: NetworkPassphrase): Promise<string> {
  const w = window as any;
  switch (id) {
    case 'freighter': {
      if (!w.freighter) throw new Error('Freighter not installed');
      const allowed = await w.freighter.isAllowed();
      if (!allowed) await w.freighter.setAllowed();
      return w.freighter.getPublicKey();
    }
    case 'albedo': {
      if (!w.albedo) throw new Error('Albedo not installed');
      const result = await w.albedo.publicKey({ require_existing: false });
      return result.pubkey;
    }
    case 'xbull': {
      if (!w.xBullSDK) throw new Error('xBull not installed');
      const sdk = new w.xBullSDK();
      return sdk.getPublicKey();
    }
    case 'rabet': {
      if (!w.rabet) throw new Error('Rabet not installed');
      const result = await w.rabet.connect();
      return result.publicKey;
    }
    default:
      throw new Error(`Unknown wallet: ${id}`);
  }
}

/** Validate a Stellar public key (G... 56 chars) */
function isValidPublicKey(key: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(key);
}

class WalletService {
  private state: WalletState = DEFAULT_STATE;
  private listeners = new Set<Listener>();

  constructor() {
    this.loadPersistedState();
  }

  private loadPersistedState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<WalletState>;
        this.state = {
          ...DEFAULT_STATE,
          preferences: { ...DEFAULT_PREFERENCES, ...saved.preferences },
          connectionHistory: saved.connectionHistory ?? [],
          // Don't restore active connection — require explicit reconnect
          activeConnection: null,
          status: 'disconnected',
          detectedWallets: [],
          error: null,
        };
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          preferences: this.state.preferences,
          connectionHistory: this.state.connectionHistory.slice(-MAX_HISTORY),
        }),
      );
    } catch {
      // ignore storage errors
    }
  }

  private setState(patch: Partial<WalletState>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    this.listeners.forEach((l) => l(this.state));
  }

  private addEvent(event: Omit<ConnectionEvent, 'timestamp'>): void {
    const entry: ConnectionEvent = { ...event, timestamp: Date.now() };
    this.setState({
      connectionHistory: [...this.state.connectionHistory.slice(-(MAX_HISTORY - 1)), entry],
    });
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

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Scan for installed wallet extensions */
  detectWallets(): WalletId[] {
    const detected = (Object.keys(WALLET_REGISTRY) as WalletId[]).filter(detectWallet);
    this.setState({ detectedWallets: detected });
    return detected;
  }

  /** Connect to a specific wallet */
  async connect(walletId: WalletId): Promise<void> {
    this.setState({ status: 'connecting', error: null });
    try {
      const network = this.state.preferences.network;
      const publicKey = await requestPublicKey(walletId, network);

      if (!isValidPublicKey(publicKey)) {
        throw new Error('Wallet returned an invalid public key');
      }

      const connection: WalletConnection = {
        walletId,
        account: { publicKey, network },
        connectedAt: Date.now(),
        lastActiveAt: Date.now(),
      };

      this.setState({
        activeConnection: connection,
        status: 'connected',
        error: null,
        preferences: { ...this.state.preferences, preferredWallet: walletId },
      });

      this.addEvent({ type: 'connected', walletId, publicKey });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Connection failed';
      this.setState({ status: 'error', error });
      this.addEvent({ type: 'error', walletId, error });
      throw err;
    }
  }

  /** Disconnect the active wallet */
  disconnect(): void {
    const prev = this.state.activeConnection;
    this.setState({ activeConnection: null, status: 'disconnected', error: null });
    if (prev) {
      this.addEvent({ type: 'disconnected', walletId: prev.walletId, publicKey: prev.account.publicKey });
    }
  }

  /** Switch to a different wallet */
  async switchWallet(walletId: WalletId): Promise<void> {
    const prev = this.state.activeConnection?.walletId;
    await this.connect(walletId);
    if (prev && prev !== walletId) {
      this.addEvent({ type: 'switched', walletId });
    }
  }

  /** Attempt to reconnect using the preferred wallet */
  async autoReconnect(): Promise<boolean> {
    const { autoReconnect, preferredWallet } = this.state.preferences;
    if (!autoReconnect || !preferredWallet) return false;
    try {
      await this.connect(preferredWallet);
      return true;
    } catch {
      return false;
    }
  }

  /** Touch the active connection's lastActiveAt timestamp */
  touchConnection(): void {
    if (!this.state.activeConnection) return;
    this.setState({
      activeConnection: { ...this.state.activeConnection, lastActiveAt: Date.now() },
    });
  }

  updatePreferences(patch: Partial<WalletPreferences>): void {
    this.setState({ preferences: { ...this.state.preferences, ...patch } });
  }

  clearError(): void {
    this.setState({ error: null, status: this.state.activeConnection ? 'connected' : 'disconnected' });
  }

  getAnalytics() {
    const history = this.state.connectionHistory;
    const counts = history.reduce<Record<string, number>>((acc, e) => {
      if (e.walletId) acc[e.walletId] = (acc[e.walletId] ?? 0) + 1;
      return acc;
    }, {});
    const errors = history.filter((e) => e.type === 'error');
    return {
      totalConnections: history.filter((e) => e.type === 'connected').length,
      walletUsage: counts,
      errorCount: errors.length,
      lastError: errors.at(-1) ?? null,
    };
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
