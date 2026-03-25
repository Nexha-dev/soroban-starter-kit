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
  });

  describe('Settings Management', () => {
    it('should update settings', () => {
      accessibilityManager.updateSettings({ highContrast: true });
      const settings = accessibilityManager.getSettings();
      expect(settings.highContrast).toBe(true);
    });

    it('should notify listeners on settings change', (done) => {
      accessibilityManager.subscribe((settings) => {
        expect(settings.highContrast).toBe(true);
        done();
      });
      accessibilityManager.updateSettings({ highContrast: true });
    });

    it('should support multiple listeners', () => {
      let count1 = 0;
      let count2 = 0;

      accessibilityManager.subscribe(() => count1++);
      accessibilityManager.subscribe(() => count2++);

      accessibilityManager.updateSettings({ fontSize: 'large' });

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
      const spy = jest.spyOn(document.body, 'appendChild');
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
