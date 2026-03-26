import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accessibilityManager } from '../accessibilityManager';

describe('AccessibilityManager', () => {
  beforeEach(() => {
    accessibilityManager.updateSettings({
      highContrast: false,
      fontSize: 'normal',
      reduceMotion: false,
      screenReaderMode: false,
      keyboardNavigation: true,
      focusIndicator: 'default',
    });
    // Reset metrics to known state
    accessibilityManager.updateMetrics({ issuesFound: 0, complianceScore: 100, wcagLevel: 'AA' });
  });

  describe('Settings Management', () => {
    it('should update settings', () => {
      accessibilityManager.updateSettings({ highContrast: true });
      expect(accessibilityManager.getSettings().highContrast).toBe(true);
    });

    it('should notify listeners on settings change', () => new Promise<void>(resolve => {
      const unsub = accessibilityManager.subscribe((settings) => {
        expect(settings.highContrast).toBe(true);
        unsub();
        resolve();
      });
      accessibilityManager.updateSettings({ highContrast: true });
    }));

    it('should support multiple listeners', () => {
      let count1 = 0;
      let count2 = 0;
      const u1 = accessibilityManager.subscribe(() => count1++);
      const u2 = accessibilityManager.subscribe(() => count2++);
      accessibilityManager.updateSettings({ fontSize: 'large' });
      u1(); u2();
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe('Metrics', () => {
    it('should get metrics', () => {
      const metrics = accessibilityManager.getMetrics();
      expect(metrics.wcagLevel).toBe('AA');
      expect(metrics.complianceScore).toBe(100);
    });

    it('should update metrics', () => {
      accessibilityManager.updateMetrics({ issuesFound: 5, complianceScore: 90 });
      const metrics = accessibilityManager.getMetrics();
      expect(metrics.issuesFound).toBe(5);
      expect(metrics.complianceScore).toBe(90);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce messages', () => {
      const spy = vi.spyOn(document.body, 'appendChild');
      accessibilityManager.announce('Test message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should set page title', () => {
      accessibilityManager.setPageTitle('Test Page');
      expect(document.title).toBe('Test Page');
    });
  });
});
