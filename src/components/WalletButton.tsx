import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import type { WalletProvider } from '../services/wallet';

const PROVIDER_META: Record<WalletProvider, { label: string; icon: string; description: string }> = {
  freighter:     { label: 'Freighter',     icon: '🔑', description: 'Browser extension wallet by SDF' },
  albedo:        { label: 'Albedo',        icon: '🌐', description: 'Web-based Stellar signer' },
  walletconnect: { label: 'WalletConnect', icon: '📱', description: 'Connect via QR code' },
};

function shortKey(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

export function WalletButton(): JSX.Element {
  const { status, provider, account, accounts, available, error, connect, disconnect, switchAccount } = useWallet();
  const [open, setOpen] = useState(false);

  if (status === 'connected' && account) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          title={account.publicKey}
        >
          {PROVIDER_META[provider!].icon} {shortKey(account.publicKey)}
        </button>

        {open && (
          <div
            className="card"
            style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, minWidth: 260, boxShadow: 'var(--shadow-lg)' }}
            role="menu"
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              Connected via {PROVIDER_META[provider!].label}
            </div>

            {/* Account list */}
            {accounts.length > 1 && (
              <div className="flex flex-col gap-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>
                {accounts.map(a => (
                  <button
                    key={a.publicKey}
                    className={`btn ${a.publicKey === account.publicKey ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', textAlign: 'left', justifyContent: 'flex-start' }}
                    onClick={() => { switchAccount(a.publicKey); setOpen(false); }}
                    role="menuitem"
                  >
                    {a.publicKey === account.publicKey ? '✓ ' : ''}{shortKey(a.publicKey)}
                  </button>
                ))}
              </div>
            )}

            <div style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              {account.publicKey}
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', color: 'var(--color-error, #e53e3e)' }}
              onClick={() => { disconnect(); setOpen(false); }}
              role="menuitem"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-primary"
        onClick={() => setOpen(v => !v)}
        disabled={status === 'connecting'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {status === 'connecting' ? (
          <><span className="spinner" style={{ width: 14, height: 14 }} /> Connecting…</>
        ) : (
          '🔗 Connect Wallet'
        )}
      </button>

      {open && status !== 'connecting' && (
        <div
          className="card"
          style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, minWidth: 260, boxShadow: 'var(--shadow-lg)' }}
          role="menu"
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
            Choose a wallet
          </div>

          {error && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-error, #e53e3e)', marginBottom: 'var(--spacing-sm)' }}>
              ⚠️ {error}
            </p>
          )}

          <div className="flex flex-col gap-sm">
            {(['freighter', 'albedo', 'walletconnect'] as WalletProvider[]).map(p => {
              const meta = PROVIDER_META[p];
              const detected = available.includes(p);
              return (
                <button
                  key={p}
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', justifyContent: 'flex-start', opacity: detected ? 1 : 0.6 }}
                  onClick={() => { connect(p); setOpen(false); }}
                  role="menuitem"
                  title={detected ? undefined : 'Not detected in this browser'}
                >
                  <span style={{ marginRight: 8 }}>{meta.icon}</span>
                  <span>
                    <span style={{ fontWeight: 500 }}>{meta.label}</span>
                    {!detected && <span style={{ fontSize: '0.7rem', marginLeft: 6, color: 'var(--color-text-secondary)' }}>not detected</span>}
                    <br />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
