import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ConnectivityProvider } from "./context/ConnectivityContext";
import { StorageProvider } from "./context/StorageContext";
import { TransactionQueueProvider } from "./context/TransactionQueueContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TutorialProvider } from "./context/TutorialContext";
import { PWAProvider } from "./context/PWAContext";
import { LocalizationProvider } from "./context/LocalizationContext";
import { SecurityProvider } from "./context/SecurityContext";
import { PreferenceProvider } from "./context/PreferenceContext";
import "./styles/index.css";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useRegisterSW } from 'virtual:pwa-register/react';
import App from './App';
import { installFetchLogger } from './services/logger/middleware';

installFetchLogger();
import { ConnectivityProvider } from './context/ConnectivityContext';
import { StorageProvider } from './context/StorageContext';
import { TransactionQueueProvider } from './context/TransactionQueueContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import { TutorialProvider } from './context/TutorialContext';
import { PWAProvider } from './context/PWAContext';
import { SecurityProvider } from './context/SecurityContext';
import { AdminProvider } from './context/AdminContext';
import { GatewayProvider } from './context/GatewayContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { ComplianceProvider } from './context/ComplianceContext';
import { AnalyticsProvider } from './context/AnalyticsContext';
import { WalletProvider } from './context/WalletContext';
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
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocalizationProvider>
      <ThemeProvider>
        <PreferenceProvider>
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
        </PreferenceProvider>
      </ThemeProvider>
    </LocalizationProvider>
    <ThemeProvider>
      <I18nProvider>
        <TutorialProvider>
        <PWAProvider>
          <SecurityProvider>
            <ConnectivityProvider>
              <StorageProvider>
                <AdminProvider>
                  <GatewayProvider>
                    <DatabaseProvider>
                      <ComplianceProvider>
                        <AnalyticsProvider>
                          <TransactionQueueProvider>
                            <App />
                          </TransactionQueueProvider>
                        </AnalyticsProvider>
                      </ComplianceProvider>
                      <TransactionQueueProvider>
                        <App />
                      </TransactionQueueProvider>
                    </DatabaseProvider>
                  </GatewayProvider>
                  <TransactionQueueProvider>
                    <App />
                  </TransactionQueueProvider>
                </AdminProvider>
              </StorageProvider>
            </ConnectivityProvider>
            <WalletProvider>
              <ConnectivityProvider>
                <StorageProvider>
                  <TransactionQueueProvider>
                    <App />
                  </TransactionQueueProvider>
                </StorageProvider>
              </ConnectivityProvider>
            </WalletProvider>
          </SecurityProvider>
        </PWAProvider>
        </TutorialProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);

