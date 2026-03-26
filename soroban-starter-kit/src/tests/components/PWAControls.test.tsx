import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../utils/renderWithProviders';
import { InstallBanner, PushToggle } from '../../components/PWAControls';
import * as PWAContext from '../../context/PWAContext';

const mockUsePWA = vi.spyOn(PWAContext, 'usePWA');

function mockPWA(overrides = {}) {
  mockUsePWA.mockReturnValue({
    canInstall: false,
    isAppInstalled: false,
    pushPermission: 'default',
    pushSubscription: null,
    install: vi.fn().mockResolvedValue('accepted'),
    enablePush: vi.fn(),
    disablePush: vi.fn(),
    ...overrides,
  });
}

describe('InstallBanner', () => {
  it('renders nothing when install is not available', () => {
    mockPWA();
    const { container } = renderWithProviders(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when already installed', () => {
    mockPWA({ canInstall: true, isAppInstalled: true });
    const { container } = renderWithProviders(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows install button when installable', () => {
    mockPWA({ canInstall: true });
    renderWithProviders(<InstallBanner />);
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
  });

  it('calls install on button click', async () => {
    const install = vi.fn().mockResolvedValue('accepted');
    mockPWA({ canInstall: true, install });
    renderWithProviders(<InstallBanner />);
    fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    expect(install).toHaveBeenCalledOnce();
  });
});

describe('PushToggle', () => {
  it('renders nothing when permission is denied', () => {
    mockPWA({ pushPermission: 'denied' });
    const { container } = renderWithProviders(<PushToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows enable button when not subscribed', () => {
    mockPWA();
    renderWithProviders(<PushToggle />);
    expect(screen.getByTitle(/enable notifications/i)).toBeInTheDocument();
  });

  it('calls enablePush when clicked', () => {
    const enablePush = vi.fn();
    mockPWA({ enablePush });
    renderWithProviders(<PushToggle />);
    fireEvent.click(screen.getByTitle(/enable notifications/i));
    expect(enablePush).toHaveBeenCalledOnce();
  });

  it('calls disablePush when already subscribed', () => {
    const disablePush = vi.fn();
    mockPWA({ pushSubscription: {} as PushSubscription, disablePush });
    renderWithProviders(<PushToggle />);
    fireEvent.click(screen.getByTitle(/disable notifications/i));
    expect(disablePush).toHaveBeenCalledOnce();
  });
});
