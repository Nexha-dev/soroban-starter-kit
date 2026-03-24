import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@soroban_cache_';

export async function cacheSet(key: string, value: unknown, ttlMs = 60_000) {
  await AsyncStorage.setItem(
    CACHE_PREFIX + key,
    JSON.stringify({ value, expiresAt: Date.now() + ttlMs })
  );
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
  if (!raw) return null;
  const { value, expiresAt } = JSON.parse(raw);
  if (Date.now() > expiresAt) {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
    return null;
  }
  return value as T;
}

export async function cacheClear(key: string) {
  await AsyncStorage.removeItem(CACHE_PREFIX + key);
}
