// Mock AsyncStorage
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));

import { cacheSet, cacheGet, cacheClear } from '../src/utils/cache';

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

describe('cache', () => {
  it('stores and retrieves a value within TTL', async () => {
    await cacheSet('foo', { x: 1 }, 60_000);
    const result = await cacheGet<{ x: number }>('foo');
    expect(result).toEqual({ x: 1 });
  });

  it('returns null for expired entries', async () => {
    await cacheSet('bar', 'hello', -1); // already expired
    const result = await cacheGet('bar');
    expect(result).toBeNull();
  });

  it('returns null after explicit clear', async () => {
    await cacheSet('baz', 42, 60_000);
    await cacheClear('baz');
    expect(await cacheGet('baz')).toBeNull();
  });
});
