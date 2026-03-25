import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// --- Browser API stubs ---
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(navigator, 'onLine', { writable: true, value: true });

// IndexedDB stub (idb uses this)
import 'fake-indexeddb/auto';

// Service Worker stub
Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    ready: Promise.resolve({ showNotification: vi.fn(), pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }),
    register: vi.fn(),
    addEventListener: vi.fn(),
  },
});

// Notification stub
Object.defineProperty(window, 'Notification', {
  writable: true,
  value: class {
    static permission: NotificationPermission = 'default';
    static requestPermission = vi.fn().mockResolvedValue('granted');
  },
});
