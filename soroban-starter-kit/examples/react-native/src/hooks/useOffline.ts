import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@soroban_offline_queue';

export type QueuedTx = {
  id: string;
  type: 'transfer' | 'fund' | 'approve_delivery' | 'request_refund';
  params: Record<string, string>;
  timestamp: number;
};

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedTx[]>([]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    loadQueue();
    return unsub;
  }, []);

  const loadQueue = async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) setQueue(JSON.parse(raw));
  };

  const enqueue = useCallback(async (tx: Omit<QueuedTx, 'id' | 'timestamp'>) => {
    const entry: QueuedTx = { ...tx, id: Date.now().toString(), timestamp: Date.now() };
    const next = [...queue, entry];
    setQueue(next);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    return entry.id;
  }, [queue]);

  const dequeue = useCallback(async (id: string) => {
    const next = queue.filter(q => q.id !== id);
    setQueue(next);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  }, [queue]);

  return { isOnline, queue, enqueue, dequeue };
}
