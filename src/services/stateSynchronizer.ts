/**
 * State Synchronizer
 * Handles state synchronization across components and tabs
 */

import { NormalizedState } from './stateManager';

export interface SyncEvent {
  type: 'update' | 'delete' | 'clear' | 'conflict';
  timestamp: number;
  source: string;
  data?: any;
}

type SyncListener = (event: SyncEvent) => void;

class StateSynchronizer {
  private listeners: Set<SyncListener> = new Set();
  private eventQueue: SyncEvent[] = [];
  private maxQueueSize = 100;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.initBroadcastChannel();
  }

  /**
   * Initialize cross-tab communication
   */
  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('soroban-state-sync');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (error) {
        console.warn('BroadcastChannel not available:', error);
      }
    }
  }

  /**
   * Subscribe to sync events
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit sync event
   */
  emit(event: SyncEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }

    this.notifyListeners(event);
    this.broadcast(event);
  }

  /**
   * Broadcast event to other tabs
   */
  private broadcast(event: SyncEvent): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch (error) {
        console.warn('Failed to broadcast sync event:', error);
      }
    }
  }

  /**
   * Handle broadcast message from other tabs
   */
  private handleBroadcastMessage(data: SyncEvent): void {
    this.eventQueue.push(data);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }
    this.notifyListeners(data);
  }

  /**
   * Get event history
   */
  getEventHistory(): SyncEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventQueue = [];
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.listeners.clear();
    this.eventQueue = [];
  }
}

export const stateSynchronizer = new StateSynchronizer();
export default stateSynchronizer;
