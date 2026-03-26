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

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
