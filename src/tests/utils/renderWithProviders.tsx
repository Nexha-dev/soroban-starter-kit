import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../context/ThemeContext';
import { ConnectivityProvider } from '../../context/ConnectivityContext';
import { StorageProvider } from '../../context/StorageContext';
import { TransactionQueueProvider } from '../../context/TransactionQueueContext';
import { PWAProvider } from '../../context/PWAContext';
import { TutorialProvider } from '../../context/TutorialContext';

function AllProviders({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ThemeProvider>
      <TutorialProvider>
        <PWAProvider>
          <ConnectivityProvider>
            <StorageProvider>
              <TransactionQueueProvider>
                {children}
              </TransactionQueueProvider>
            </StorageProvider>
          </ConnectivityProvider>
        </PWAProvider>
      </TutorialProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  return { ...render(ui, { wrapper: AllProviders, ...options }), user };
}

export { screen, waitFor, within, fireEvent } from '@testing-library/react';
export { userEvent };
