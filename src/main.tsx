import React from 'react';
import ReactDOM from 'react-dom/client';
import { useRegisterSW } from 'virtual:pwa-register/react';
import App from './App';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { StorageProvider } from './context/StorageContext';
import { TransactionQueueProvider } from './context/TransactionQueueContext';
import { ThemeProvider } from './context/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { PWAProvider } from './context/PWAContext';
import { SecurityProvider } from './context/SecurityContext';
import './styles/index.css';

function Root(): JSX.Element {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  return (
    <>
      {needRefresh && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-highlight)', color: '#fff', padding: '10px 20px',
          borderRadius: 'var(--radius-md)', zIndex: 9999, display: 'flex', gap: 12, alignItems: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <span>🔄 New version available</span>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{ background: '#fff', color: 'var(--color-highlight)', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}
          >
            Update
          </button>
        </div>
      )}
      <ThemeProvider>
        <TutorialProvider>
          <PWAProvider>
            <SecurityProvider>
              <ConnectivityProvider>
                <StorageProvider>
                  <TransactionQueueProvider>
                    <App />
                  </TransactionQueueProvider>
                </StorageProvider>
              </ConnectivityProvider>
            </SecurityProvider>
          </PWAProvider>
        </TutorialProvider>
      </ThemeProvider>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
