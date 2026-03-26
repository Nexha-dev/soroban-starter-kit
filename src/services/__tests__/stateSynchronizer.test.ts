/**
 * State Synchronizer Tests
 */

import { stateSynchronizer, SyncEvent } from '../stateSynchronizer';

describe('StateSynchronizer', () => {
  beforeEach(() => {
    stateSynchronizer.clearHistory();
  });

  describe('Event Emission', () => {
    it('should emit sync events', () => {
      return new Promise<void>((resolve) => {
        const listener = (event: SyncEvent) => {
          expect(event.type).toBe('update');
          expect(event.timestamp).toBeGreaterThan(0);
          resolve();
        };

        stateSynchronizer.subscribe(listener);
        stateSynchronizer.emit({
          type: 'update',
          timestamp: Date.now(),
          source: 'test',
        });
      });
    });

    it('should maintain event history', () => {
      stateSynchronizer.emit({
        type: 'update',
        timestamp: Date.now(),
        source: 'test1',
      });

      stateSynchronizer.emit({
        type: 'delete',
        timestamp: Date.now(),
        source: 'test2',
      });

      const history = stateSynchronizer.getEventHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe('update');
      expect(history[1].type).toBe('delete');
    });

    it('should limit history size', () => {
      for (let i = 0; i < 150; i++) {
        stateSynchronizer.emit({
          type: 'update',
          timestamp: Date.now(),
          source: 'test',
        });
      }

      const history = stateSynchronizer.getEventHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Subscriptions', () => {
    it('should notify multiple listeners', () => {
      let count1 = 0;
      let count2 = 0;

      stateSynchronizer.subscribe(() => count1++);
      stateSynchronizer.subscribe(() => count2++);

      stateSynchronizer.emit({
        type: 'update',
        timestamp: Date.now(),
        source: 'test',
      });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('should unsubscribe listeners', () => {
      let count = 0;
      const listener = () => count++;

      const unsubscribe = stateSynchronizer.subscribe(listener);
      stateSynchronizer.emit({
        type: 'update',
        timestamp: Date.now(),
        source: 'test',
      });

      expect(count).toBe(1);

      unsubscribe();
      stateSynchronizer.emit({
        type: 'update',
        timestamp: Date.now(),
        source: 'test',
      });

      expect(count).toBe(1);
    });
  });

  describe('Event Types', () => {
    it('should handle different event types', () => {
      return new Promise<void>((resolve) => {
        const events: SyncEvent[] = [];

        stateSynchronizer.subscribe((event) => {
          events.push(event);
          if (events.length === 4) {
            expect(events.map(e => e.type)).toEqual(['update', 'delete', 'clear', 'conflict']);
            resolve();
          }
        });

        stateSynchronizer.emit({ type: 'update', timestamp: Date.now(), source: 'test' });
        stateSynchronizer.emit({ type: 'delete', timestamp: Date.now(), source: 'test' });
        stateSynchronizer.emit({ type: 'clear', timestamp: Date.now(), source: 'test' });
        stateSynchronizer.emit({ type: 'conflict', timestamp: Date.now(), source: 'test' });
      });
    });
  });
});
