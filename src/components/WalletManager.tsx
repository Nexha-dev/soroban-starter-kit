import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WALLET_REGISTRY } from '../services/wallet';
import type { WalletId } from '../services/wallet';

export function WalletManager(): JSX.Element {
  const {
    activeConnection,
    status,
    error,
    detectedWallets,
    preferences,
    connect,
    disconnect,
    switchWallet,
    updatePreferences,
    clearError,
    getAnalytics,
  } = useWallet();

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const analytics = getAnalytics();
  const allWallets = Object.values(WALLET_REGISTRY);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  async function handleConnect(id: WalletId) {
    try {
      await connect(id);
    } catch {
      // error is stored in context
    }
  }

  async function handleSwitch(id: WalletId) {
    try {
      await switchWallet(id);
    } catch {
      // error is stored in context
    }
  }

  return (
    <div className="wallet-manager" role="region" aria-label="Wallet Connection Manager">
      {/* Connection Status */}
      <div className={`wallet-status wallet-status--${status}`} aria-live="polite">
        <span className="wallet-status__indicator" aria-hidden="true" />
        <span className="wallet-status__label">
          {isConnected
            ? `Connected: ${activeConnection!.account.publicKey.slice(0, 6)}…${activeConnection!.account.publicKey.slice(-4)}`
            : isConnecting
              ? 'Connecting…'
              : 'Not connected'}
        </span>
        {isConnected && (
          <span className="wallet-status__network">
            {activeConnection!.account.network}
          </span>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="wallet-error" role="alert">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* Wallet List */}
      <div className="wallet-list" role="list" aria-label="Available wallets">
        {allWallets.map((wallet) => {
          const isDetected = detectedWallets.includes(wallet.id);
          const isActive = activeConnection?.walletId === wallet.id;
          return (
            <div key={wallet.id} className={`wallet-item ${isActive ? 'wallet-item--active' : ''}`} role="listitem">
              <span className="wallet-item__icon" aria-hidden="true">{wallet.icon}</span>
              <span className="wallet-item__name">{wallet.name}</span>
              <span className={`wallet-item__badge ${isDetected ? 'wallet-item__badge--detected' : ''}`}>
                {isDetected ? 'Installed' : 'Not installed'}
              </span>
              {isActive ? (
                <button
                  className="btn btn--danger btn--sm"
                  onClick={disconnect}
                  aria-label={`Disconnect ${wallet.name}`}
                >
                  Disconnect
                </button>
              ) : isDetected ? (
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => isConnected ? handleSwitch(wallet.id) : handleConnect(wallet.id)}
                  disabled={isConnecting}
                  aria-label={isConnected ? `Switch to ${wallet.name}` : `Connect ${wallet.name}`}
                >
                  {isConnected ? 'Switch' : 'Connect'}
                </button>
              ) : (
                <a
                  href={wallet.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--secondary btn--sm"
                  aria-label={`Install ${wallet.name}`}
                >
                  Install
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Preferences */}
      {isConnected && (
        <div className="wallet-preferences">
          <label className="wallet-preferences__item">
            <input
              type="checkbox"
              checked={preferences.autoReconnect}
              onChange={(e) => updatePreferences({ autoReconnect: e.target.checked })}
              aria-label="Auto-reconnect on next visit"
            />
            Auto-reconnect
          </label>
          <label className="wallet-preferences__item">
            Network:
            <select
              value={preferences.network}
              onChange={(e) => updatePreferences({ network: e.target.value as 'testnet' | 'mainnet' })}
              aria-label="Select network"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </label>
        </div>
      )}

      {/* Analytics Toggle */}
      <div className="wallet-footer">
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setShowAnalytics((v) => !v)}
          aria-expanded={showAnalytics}
        >
          {showAnalytics ? 'Hide' : 'Show'} Analytics
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setShowGuide((v) => !v)}
          aria-expanded={showGuide}
        >
          Setup Guide
        </button>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && (
        <div className="wallet-analytics" aria-label="Connection analytics">
          <p>Total connections: <strong>{analytics.totalConnections}</strong></p>
          <p>Errors: <strong>{analytics.errorCount}</strong></p>
          {Object.entries(analytics.walletUsage).map(([id, count]) => (
            <p key={id}>{WALLET_REGISTRY[id as WalletId]?.name ?? id}: <strong>{count}</strong> events</p>
          ))}
          {analytics.lastError && (
            <p className="wallet-analytics__last-error">
              Last error: {analytics.lastError.error} ({new Date(analytics.lastError.timestamp).toLocaleString()})
            </p>
          )}
        </div>
      )}

      {/* Setup Guide */}
      {showGuide && (
        <div className="wallet-guide" role="complementary" aria-label="Wallet setup guide">
          <h3>Getting Started</h3>
          <ol>
            <li>Install a Stellar wallet extension (Freighter is recommended).</li>
            <li>Create or import a Stellar account in the wallet.</li>
            <li>Select <strong>Testnet</strong> in the wallet settings for development.</li>
            <li>Click <strong>Connect</strong> next to your installed wallet above.</li>
            <li>Approve the connection request in the wallet popup.</li>
          </ol>
          <p>
            Need help?{' '}
            <a href="https://soroban.stellar.org/docs/getting-started/setup" target="_blank" rel="noopener noreferrer">
              Soroban setup docs ↗
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
