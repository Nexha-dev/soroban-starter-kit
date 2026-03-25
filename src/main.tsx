import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { StorageProvider } from './context/StorageContext';
import { TransactionQueueProvider } from './context/TransactionQueueContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ConnectivityProvider>
        <StorageProvider>
          <TransactionQueueProvider>
            <App />
          </TransactionQueueProvider>
        </StorageProvider>
      </ConnectivityProvider>
    </ThemeProvider>
  </React.StrictMode>
);
