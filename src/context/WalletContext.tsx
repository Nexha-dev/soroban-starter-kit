import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { walletService } from '../services/wallet';
import type { WalletState, WalletId, WalletPreferences } from '../services/wallet';

interface WalletContextType extends WalletState {
  connect: (walletId: WalletId) => Promise<void>;
  disconnect: () => void;
  switchWallet: (walletId: WalletId) => Promise<void>;
  autoReconnect: () => Promise<boolean>;
  detectWallets: () => WalletId[];
  touchConnection: () => void;
  updatePreferences: (patch: Partial<WalletPreferences>) => void;
  clearError: () => void;
  getAnalytics: () => ReturnType<typeof walletService.getAnalytics>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<WalletState>(walletService.getState());

  useEffect(() => {
    const unsub = walletService.subscribe(setState);
    // Detect wallets and attempt auto-reconnect on mount
    walletService.detectWallets();
    walletService.autoReconnect();
    return unsub;
  }, []);

  const value: WalletContextType = {
    ...state,
    connect: (id) => walletService.connect(id),
    disconnect: () => walletService.disconnect(),
    switchWallet: (id) => walletService.switchWallet(id),
    autoReconnect: () => walletService.autoReconnect(),
    detectWallets: () => walletService.detectWallets(),
    touchConnection: () => walletService.touchConnection(),
    updatePreferences: (patch) => walletService.updatePreferences(patch),
    clearError: () => walletService.clearError(),
    getAnalytics: () => walletService.getAnalytics(),
import React, { createContext, useContext, useEffect, useState } from 'react';
import { walletService } from '../services/wallet';
import type { WalletState, WalletProvider, SignTransactionOptions } from '../services/wallet';

interface WalletContextValue extends WalletState {
  connect: (provider: WalletProvider) => Promise<void>;
  disconnect: () => void;
  switchAccount: (publicKey: string) => void;
  signTransaction: (xdr: string, opts?: SignTransactionOptions) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setState] = useState<WalletState>(() => {
    walletService.init();
    return walletService.getState();
  });

  useEffect(() => walletService.subscribe(setState), []);

  const value: WalletContextValue = {
    ...state,
    connect: (p) => walletService.connect(p),
    disconnect: () => walletService.disconnect(),
    switchAccount: (pk) => walletService.switchAccount(pk),
    signTransaction: (xdr, opts) => walletService.signTransaction(xdr, opts),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}

export default WalletContext;
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
