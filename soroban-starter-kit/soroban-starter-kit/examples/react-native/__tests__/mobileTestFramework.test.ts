import {
  DEVICE_PROFILES,
  simulateGesture,
  isValidGesture,
  getOrientation,
  rotateDevice,
  validatePerformance,
  validateAccessibility,
  checkCompatibility,
  MobileAnalytics,
  runOnDevices,
  runTest,
} from '../src/testing/mobileTestFramework';
import type { DeviceProfile } from '../src/testing/types';

// --- Device farm ---

describe('DEVICE_PROFILES', () => {
  it('includes both iOS and Android devices', () => {
    const platforms = new Set(DEVICE_PROFILES.map(d => d.platform));
    expect(platforms).toContain('ios');
    expect(platforms).toContain('android');
  });

  it('all devices have required fields', () => {
    for (const d of DEVICE_PROFILES) {
      expect(d.name).toBeTruthy();
      expect(d.width).toBeGreaterThan(0);
      expect(d.height).toBeGreaterThan(0);
      expect(d.pixelRatio).toBeGreaterThan(0);
    }
  });
});

// --- Gesture testing ---

describe('simulateGesture', () => {
  it('normalises tap with default coords', () => {
    const g = simulateGesture({ type: 'tap' });
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
  });

  it('preserves provided coordinates', () => {
    const g = simulateGesture({ type: 'tap', x: 100, y: 200 });
    expect(g.x).toBe(100);
    expect(g.y).toBe(200);
  });

  it('preserves swipe deltas', () => {
    const g = simulateGesture({ type: 'swipe', dx: -50, dy: 0 });
    expect(g.dx).toBe(-50);
  });
});

describe('isValidGesture', () => {
  it('validates tap as always valid', () => {
    expect(isValidGesture({ type: 'tap' })).toBe(true);
  });

  it('requires dx or dy for swipe', () => {
    expect(isValidGesture({ type: 'swipe' })).toBe(false);
    expect(isValidGesture({ type: 'swipe', dx: 10 })).toBe(true);
  });

  it('requires positive scale for pinch', () => {
    expect(isValidGesture({ type: 'pinch' })).toBe(false);
    expect(isValidGesture({ type: 'pinch', scale: 1.5 })).toBe(true);
  });
});

// --- Orientation testing ---

describe('getOrientation', () => {
  it('returns portrait when height > width', () => {
    const d: DeviceProfile = { name: 'X', platform: 'ios', width: 375, height: 812, pixelRatio: 3, osVersion: '16' };
    expect(getOrientation(d)).toBe('portrait');
  });

  it('returns landscape when width > height', () => {
    const d: DeviceProfile = { name: 'X', platform: 'ios', width: 812, height: 375, pixelRatio: 3, osVersion: '16' };
    expect(getOrientation(d)).toBe('landscape');
  });
});

describe('rotateDevice', () => {
  it('swaps width and height', () => {
    const d: DeviceProfile = { name: 'X', platform: 'android', width: 360, height: 780, pixelRatio: 3, osVersion: '13' };
    const rotated = rotateDevice(d);
    expect(rotated.width).toBe(780);
    expect(rotated.height).toBe(360);
  });

  it('does not mutate the original', () => {
    const d: DeviceProfile = { name: 'X', platform: 'android', width: 360, height: 780, pixelRatio: 3, osVersion: '13' };
    rotateDevice(d);
    expect(d.width).toBe(360);
  });
});

// --- Performance validation ---

describe('validatePerformance', () => {
  it('passes within budget', () => {
    const r = validatePerformance(80, 100, 60);
    expect(r.passed).toBe(true);
  });

  it('fails on slow render', () => {
    const r = validatePerformance(200, 100, 60);
    expect(r.passed).toBe(false);
  });

  it('fails on high memory', () => {
    const r = validatePerformance(80, 200, 60);
    expect(r.passed).toBe(false);
  });

  it('fails on low fps', () => {
    const r = validatePerformance(80, 100, 30);
    expect(r.passed).toBe(false);
  });
});

// --- Accessibility validation ---

describe('validateAccessibility', () => {
  it('passes a fully accessible node', () => {
    const r = validateAccessibility({
      accessibilityLabel: 'Send button',
      accessibilityRole: 'button',
      width: 44,
      height: 44,
    });
    expect(r.passed).toBe(true);
  });

  it('fails when label is missing', () => {
    const r = validateAccessibility({ accessibilityRole: 'button', width: 44, height: 44 });
    expect(r.hasLabel).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('fails when touch target is too small', () => {
    const r = validateAccessibility({
      accessibilityLabel: 'X',
      accessibilityRole: 'button',
      width: 20,
      height: 20,
    });
    expect(r.touchTargetOk).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('fails when foreground equals background color', () => {
    const r = validateAccessibility({
      accessibilityLabel: 'X',
      accessibilityRole: 'button',
      width: 44,
      height: 44,
      foregroundColor: '#fff',
      backgroundColor: '#fff',
    });
    expect(r.contrastOk).toBe(false);
    expect(r.passed).toBe(false);
  });
});

// --- Device compatibility ---

describe('checkCompatibility', () => {
  it('supports modern iOS', () => {
    const d: DeviceProfile = { name: 'X', platform: 'ios', width: 375, height: 812, pixelRatio: 3, osVersion: '16' };
    expect(checkCompatibility(d).supported).toBe(true);
  });

  it('rejects old iOS', () => {
    const d: DeviceProfile = { name: 'X', platform: 'ios', width: 375, height: 812, pixelRatio: 2, osVersion: '13' };
    const r = checkCompatibility(d);
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/iOS/);
  });

  it('rejects old Android', () => {
    const d: DeviceProfile = { name: 'X', platform: 'android', width: 360, height: 780, pixelRatio: 3, osVersion: '9' };
    expect(checkCompatibility(d).supported).toBe(false);
  });

  it('rejects narrow screens', () => {
    const d: DeviceProfile = { name: 'X', platform: 'android', width: 280, height: 600, pixelRatio: 2, osVersion: '13' };
    expect(checkCompatibility(d).supported).toBe(false);
  });
});

// --- Analytics ---

describe('MobileAnalytics', () => {
  let analytics: MobileAnalytics;

  beforeEach(() => { analytics = new MobileAnalytics(); });

  it('tracks events', () => {
    analytics.track('TokenScreen', 'transfer');
    expect(analytics.getEvents()).toHaveLength(1);
  });

  it('filters by screen', () => {
    analytics.track('TokenScreen', 'transfer');
    analytics.track('EscrowScreen', 'deposit');
    expect(analytics.getEventsByScreen('TokenScreen')).toHaveLength(1);
  });

  it('summarises event counts', () => {
    analytics.track('TokenScreen', 'transfer');
    analytics.track('TokenScreen', 'transfer');
    const summary = analytics.getSummary();
    expect(summary['TokenScreen:transfer']).toBe(2);
  });

  it('clears events', () => {
    analytics.track('TokenScreen', 'transfer');
    analytics.clear();
    expect(analytics.getEvents()).toHaveLength(0);
  });

  it('stores metadata', () => {
    analytics.track('TokenScreen', 'transfer', { amount: 100 });
    expect(analytics.getEvents()[0].metadata?.amount).toBe(100);
  });
});

// --- Device farm runner ---

describe('runOnDevices', () => {
  it('runs suite on all devices and aggregates results', async () => {
    const devices = DEVICE_PROFILES.slice(0, 2);
    const reports = await runOnDevices(devices, async device => [
      await runTest(`orientation-${device.name}`, () => {
        const o = getOrientation(device);
        if (o !== 'portrait' && o !== 'landscape') throw new Error('bad orientation');
      }),
    ]);
    expect(reports).toHaveLength(2);
    expect(reports.every(r => r.passCount === 1 && r.failCount === 0)).toBe(true);
  });
});

// --- runTest helper ---

describe('runTest', () => {
  it('marks passing test', async () => {
    const r = await runTest('ok', () => {});
    expect(r.passed).toBe(true);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures error from failing test', async () => {
    const r = await runTest('fail', () => { throw new Error('boom'); });
    expect(r.passed).toBe(false);
    expect(r.error).toContain('boom');
  });
});
