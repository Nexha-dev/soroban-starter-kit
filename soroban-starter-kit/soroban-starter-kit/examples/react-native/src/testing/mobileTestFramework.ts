import type {
  DeviceProfile,
  GestureEvent,
  PerformanceResult,
  AccessibilityResult,
  AnalyticsEvent,
  TestResult,
  DeviceTestReport,
} from './types';

// --- Device farm ---

export const DEVICE_PROFILES: DeviceProfile[] = [
  { name: 'iPhone SE',       platform: 'ios',     width: 375, height: 667,  pixelRatio: 2,   osVersion: '16' },
  { name: 'iPhone 14 Pro',   platform: 'ios',     width: 393, height: 852,  pixelRatio: 3,   osVersion: '17' },
  { name: 'iPad Air',        platform: 'ios',     width: 820, height: 1180, pixelRatio: 2,   osVersion: '17' },
  { name: 'Pixel 6',         platform: 'android', width: 412, height: 915,  pixelRatio: 2.6, osVersion: '13' },
  { name: 'Samsung S23',     platform: 'android', width: 360, height: 780,  pixelRatio: 3,   osVersion: '13' },
  { name: 'Galaxy Tab S8',   platform: 'android', width: 753, height: 1037, pixelRatio: 2,   osVersion: '12' },
];

// --- Gesture simulation ---

export function simulateGesture(event: GestureEvent): GestureEvent {
  // Returns a normalised gesture record (in real Detox/Appium this would drive the device)
  return {
    ...event,
    x: event.x ?? 0,
    y: event.y ?? 0,
  };
}

export function isValidGesture(event: GestureEvent): boolean {
  if (event.type === 'swipe') return event.dx !== undefined || event.dy !== undefined;
  if (event.type === 'pinch') return event.scale !== undefined && event.scale > 0;
  return true;
}

// --- Orientation ---

export function getOrientation(device: DeviceProfile): 'portrait' | 'landscape' {
  return device.width < device.height ? 'portrait' : 'landscape';
}

export function rotateDevice(device: DeviceProfile): DeviceProfile {
  return { ...device, width: device.height, height: device.width };
}

// --- Performance validation ---

const PERF_BUDGETS = { renderTimeMs: 100, memoryMb: 150, fps: 55 };

export function validatePerformance(
  renderTimeMs: number,
  memoryMb: number,
  fps: number
): PerformanceResult {
  const passed =
    renderTimeMs <= PERF_BUDGETS.renderTimeMs &&
    memoryMb <= PERF_BUDGETS.memoryMb &&
    fps >= PERF_BUDGETS.fps;
  return { renderTimeMs, memoryMb, fps, passed };
}

// --- Accessibility validation ---

const MIN_TOUCH_TARGET = 44; // Apple HIG / Material guidelines

export interface A11yNode {
  accessibilityLabel?: string;
  accessibilityRole?: string;
  width: number;
  height: number;
  foregroundColor?: string;
  backgroundColor?: string;
}

export function validateAccessibility(node: A11yNode): AccessibilityResult {
  const hasLabel = Boolean(node.accessibilityLabel?.trim());
  const hasRole = Boolean(node.accessibilityRole?.trim());
  const touchTargetOk = node.width >= MIN_TOUCH_TARGET && node.height >= MIN_TOUCH_TARGET;
  // Simplified contrast check: foreground must differ from background
  const contrastOk = !node.foregroundColor || node.foregroundColor !== node.backgroundColor;
  const passed = hasLabel && hasRole && touchTargetOk && contrastOk;
  return { hasLabel, hasRole, touchTargetOk, contrastOk, passed };
}

// --- Device compatibility ---

export function checkCompatibility(device: DeviceProfile): { supported: boolean; reason?: string } {
  if (device.platform === 'ios' && parseInt(device.osVersion) < 14) {
    return { supported: false, reason: 'iOS 14+ required' };
  }
  if (device.platform === 'android' && parseInt(device.osVersion) < 10) {
    return { supported: false, reason: 'Android 10+ required' };
  }
  if (device.width < 320) {
    return { supported: false, reason: 'Screen too narrow' };
  }
  return { supported: true };
}

// --- Analytics ---

export class MobileAnalytics {
  private events: AnalyticsEvent[] = [];

  track(screen: string, action: string, metadata?: Record<string, unknown>): void {
    this.events.push({ screen, action, metadata, timestamp: Date.now() });
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getEventsByScreen(screen: string): AnalyticsEvent[] {
    return this.events.filter(e => e.screen === screen);
  }

  getSummary(): Record<string, number> {
    return this.events.reduce<Record<string, number>>((acc, e) => {
      const key = `${e.screen}:${e.action}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  clear(): void {
    this.events = [];
  }
}

// --- Device farm runner ---

export async function runOnDevices(
  devices: DeviceProfile[],
  suite: (device: DeviceProfile) => Promise<TestResult[]>
): Promise<DeviceTestReport[]> {
  return Promise.all(
    devices.map(async device => {
      const results = await suite(device);
      return {
        device,
        results,
        passCount: results.filter(r => r.passed).length,
        failCount: results.filter(r => !r.passed).length,
      };
    })
  );
}

// --- Test runner helper ---

export async function runTest(
  name: string,
  fn: () => void | Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, durationMs: Date.now() - start };
  } catch (err) {
    return { name, passed: false, durationMs: Date.now() - start, error: String(err) };
  }
}
