import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../utils/renderWithProviders';
import { ConnectivityStatus, OfflineBanner } from '../../components/ConnectivityStatus';
import * as ConnectivityContext from '../../context/ConnectivityContext';

const mockUseConnectivity = vi.spyOn(ConnectivityContext, 'useConnectivity');

function mockConnectivity(overrides = {}) {
  mockUseConnectivity.mockReturnValue({
    status: 'online',
    isOnline: true,
    wasOffline: false,
    retryConnection: vi.fn(),
    ...overrides,
  });
}

describe('ConnectivityStatus', () => {
  it('shows Online when connected', () => {
    mockConnectivity();
    renderWithProviders(<ConnectivityStatus />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows Offline with retry button when disconnected', () => {
    const retryConnection = vi.fn();
    mockConnectivity({ status: 'offline', isOnline: false, retryConnection });
    renderWithProviders(<ConnectivityStatus />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
    expect(retryConnection).toHaveBeenCalledOnce();
  });

  it('shows Syncing... during reconnection', () => {
    mockConnectivity({ status: 'syncing' });
    renderWithProviders(<ConnectivityStatus />);
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
  });
});

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    mockConnectivity();
    const { container } = renderWithProviders(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders offline message when offline', () => {
    mockConnectivity({ status: 'offline', isOnline: false });
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });
});
