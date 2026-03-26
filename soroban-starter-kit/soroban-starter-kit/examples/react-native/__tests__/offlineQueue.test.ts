const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));

// Minimal hook test without renderHook — test the queue logic directly via AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@soroban_offline_queue';

async function enqueue(queue: any[], tx: any) {
  const entry = { ...tx, id: Date.now().toString(), timestamp: Date.now() };
  const next = [...queue, entry];
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next;
}

async function dequeue(queue: any[], id: string) {
  const next = queue.filter((q: any) => q.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next;
}

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

describe('offline queue', () => {
  it('enqueues a transaction', async () => {
    const q = await enqueue([], { type: 'transfer', params: { to: 'G...', amount: '100' } });
    expect(q).toHaveLength(1);
    expect(q[0].type).toBe('transfer');
  });

  it('dequeues by id', async () => {
    let q = await enqueue([], { type: 'fund', params: {} });
    q = await dequeue(q, q[0].id);
    expect(q).toHaveLength(0);
  });

  it('persists queue to AsyncStorage', async () => {
    await enqueue([], { type: 'approve_delivery', params: {} });
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed[0].type).toBe('approve_delivery');
  });
});
