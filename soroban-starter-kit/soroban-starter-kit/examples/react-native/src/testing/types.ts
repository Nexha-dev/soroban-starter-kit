// Device profiles for compatibility testing
export interface DeviceProfile {
  name: string;
  platform: 'ios' | 'android';
  width: number;
  height: number;
  pixelRatio: number;
  osVersion: string;
}

export interface GestureEvent {
  type: 'tap' | 'longPress' | 'swipe' | 'pinch' | 'doubleTap';
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  scale?: number;
}

export interface PerformanceResult {
  renderTimeMs: number;
  memoryMb: number;
  fps: number;
  passed: boolean;
}

export interface AccessibilityResult {
  hasLabel: boolean;
  hasRole: boolean;
  touchTargetOk: boolean;
  contrastOk: boolean;
  passed: boolean;
}

export interface AnalyticsEvent {
  screen: string;
  action: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface DeviceTestReport {
  device: DeviceProfile;
  results: TestResult[];
  passCount: number;
  failCount: number;
}
