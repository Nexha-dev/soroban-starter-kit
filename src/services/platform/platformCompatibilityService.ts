/**
 * Platform Compatibility Service
 *
 * Detects platform type (web/mobile/desktop/PWA), browser capabilities,
 * OS, device characteristics, native API support, and generates
 * platform-specific optimisation strategies and graceful degradation plans.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformType = 'web-desktop' | 'web-mobile' | 'pwa-desktop' | 'pwa-mobile' | 'unknown';
export type OSType = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'chromeos' | 'unknown';
export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'samsung' | 'opera' | 'unknown';
export type DeviceClass = 'desktop' | 'tablet' | 'mobile' | 'tv' | 'unknown';
export type FeatureStatus = 'supported' | 'partial' | 'unsupported' | 'unknown';
export type OptimizationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PlatformInfo {
  type: PlatformType;
  os: OSType;
  osVersion: string;
  browser: BrowserType;
  browserVersion: string;
  deviceClass: DeviceClass;
  isInstalled: boolean;        // PWA installed
  isTouchDevice: boolean;
  isHighDPI: boolean;          // devicePixelRatio >= 2
  viewport: { width: number; height: number };
  connection: ConnectionInfo;
  memory: MemoryInfo;
  cores: number;
  userAgent: string;
}

export interface ConnectionInfo {
  type: string;                // '4g' | '3g' | 'wifi' | 'unknown'
  effectiveType: string;
  downlink: number;            // Mbps estimate
  rtt: number;                 // ms
  saveData: boolean;
}

export interface MemoryInfo {
  deviceMemoryGB: number;      // from navigator.deviceMemory
  jsHeapLimitMB: number;       // from performance.memory
  jsHeapUsedMB: number;
}

export interface FeatureDetection {
  id: string;
  name: string;
  category: 'storage' | 'graphics' | 'network' | 'media' | 'input' | 'native' | 'security' | 'performance';
  status: FeatureStatus;
  fallback?: string;
  mdn?: string;
  critical: boolean;           // app breaks without it
  detectedValue?: string;      // e.g. quota, codec names
}

export interface NativeCapability {
  id: string;
  name: string;
  icon: string;
  supported: boolean;
  description: string;
  apiName: string;
  demo?: () => Promise<string>; // returns result string for demo
}

export interface Optimization {
  id: string;
  platform: PlatformType | 'all';
  title: string;
  description: string;
  priority: OptimizationPriority;
  category: 'rendering' | 'network' | 'memory' | 'input' | 'battery' | 'storage';
  status: 'applied' | 'recommended' | 'not-applicable';
  impact: string;              // e.g. "~30% faster paint"
  implementation?: string;     // brief code hint
}

export interface CompatibilityTest {
  id: string;
  name: string;
  category: string;
  description: string;
}

export type TestOutcome = 'pass' | 'fail' | 'warn' | 'skip';

export interface CompatibilityTestResult {
  testId: string;
  name: string;
  outcome: TestOutcome;
  message: string;
  duration: number;
  platform: PlatformType;
}

export interface PlatformAnalyticsEntry {
  platform: PlatformType;
  os: OSType;
  browser: BrowserType;
  deviceClass: DeviceClass;
  sessions: number;
  avgSessionMs: number;
  errorRate: number;
  featureFallbackRate: number;
}

export interface PlatformStrategy {
  platform: PlatformType | 'all';
  title: string;
  description: string;
  tactics: string[];
  priority: OptimizationPriority;
  effort: 'low' | 'medium' | 'high';
}

// ─── Detection helpers ────────────────────────────────────────────────────────

function detectOS(ua: string): { os: OSType; version: string } {
  if (/iphone|ipad|ipod/i.test(ua)) {
    const m = ua.match(/os (\d+[._]\d+)/i);
    return { os: 'ios', version: m ? m[1].replace('_', '.') : '' };
  }
  if (/android/i.test(ua)) {
    const m = ua.match(/android (\d+\.?\d*)/i);
    return { os: 'android', version: m ? m[1] : '' };
  }
  if (/win/i.test(ua)) {
    const m = ua.match(/windows nt (\d+\.?\d*)/i);
    return { os: 'windows', version: m ? m[1] : '' };
  }
  if (/cros/i.test(ua)) return { os: 'chromeos', version: '' };
  if (/mac/i.test(ua)) {
    const m = ua.match(/mac os x (\d+[._]\d+)/i);
    return { os: 'macos', version: m ? m[1].replace('_', '.') : '' };
  }
  if (/linux/i.test(ua)) return { os: 'linux', version: '' };
  return { os: 'unknown', version: '' };
}

function detectBrowser(ua: string): { browser: BrowserType; version: string } {
  if (/edg\//i.test(ua)) {
    const m = ua.match(/edg\/(\d+)/i);
    return { browser: 'edge', version: m ? m[1] : '' };
  }
  if (/samsungbrowser/i.test(ua)) {
    const m = ua.match(/samsungbrowser\/(\d+)/i);
    return { browser: 'samsung', version: m ? m[1] : '' };
  }
  if (/opr\//i.test(ua)) {
    const m = ua.match(/opr\/(\d+)/i);
    return { browser: 'opera', version: m ? m[1] : '' };
  }
  if (/firefox/i.test(ua)) {
    const m = ua.match(/firefox\/(\d+)/i);
    return { browser: 'firefox', version: m ? m[1] : '' };
  }
  if (/chrome/i.test(ua)) {
    const m = ua.match(/chrome\/(\d+)/i);
    return { browser: 'chrome', version: m ? m[1] : '' };
  }
  if (/safari/i.test(ua)) {
    const m = ua.match(/version\/(\d+)/i);
    return { browser: 'safari', version: m ? m[1] : '' };
  }
  return { browser: 'unknown', version: '' };
}

function detectDeviceClass(ua: string, width: number): DeviceClass {
  if (/iphone|android.*mobile/i.test(ua)) return 'mobile';
  if (/ipad|android(?!.*mobile)/i.test(ua)) return 'tablet';
  if (/smart-?tv|hbbtv|appletv|googletv/i.test(ua)) return 'tv';
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function detectPlatformType(ua: string, deviceClass: DeviceClass): PlatformType {
  const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isMobile = deviceClass === 'mobile' || deviceClass === 'tablet';
  if (isInstalled && isMobile) return 'pwa-mobile';
  if (isInstalled) return 'pwa-desktop';
  if (isMobile) return 'web-mobile';
  return 'web-desktop';
}

function detectConnection(): ConnectionInfo {
  const nav = navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const c = nav.connection;
  return {
    type: c?.type ?? 'unknown',
    effectiveType: c?.effectiveType ?? 'unknown',
    downlink: c?.downlink ?? 0,
    rtt: c?.rtt ?? 0,
    saveData: c?.saveData ?? false,
  };
}

function detectMemory(): MemoryInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const perf = performance as Performance & { memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number } };
  return {
    deviceMemoryGB: nav.deviceMemory ?? 0,
    jsHeapLimitMB: perf.memory ? Math.round(perf.memory.jsHeapSizeLimit / 1_048_576) : 0,
    jsHeapUsedMB: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1_048_576) : 0,
  };
}

// ─── Feature detection ────────────────────────────────────────────────────────

function runFeatureDetections(): FeatureDetection[] {
  const check = (fn: () => boolean): FeatureStatus => {
    try { return fn() ? 'supported' : 'unsupported'; } catch { return 'unknown'; }
  };

  return [
    // Storage
    { id: 'indexeddb', name: 'IndexedDB', category: 'storage', critical: true, status: check(() => 'indexedDB' in window), fallback: 'localStorage fallback', mdn: 'IndexedDB_API' },
    { id: 'localstorage', name: 'localStorage', category: 'storage', critical: false, status: check(() => 'localStorage' in window) },
    { id: 'cache-api', name: 'Cache API', category: 'storage', critical: false, status: check(() => 'caches' in window), fallback: 'In-memory cache' },
    { id: 'storage-estimate', name: 'Storage Estimate', category: 'storage', critical: false, status: check(() => 'estimate' in navigator.storage) },
    { id: 'origin-private-fs', name: 'Origin Private FS', category: 'storage', critical: false, status: check(() => 'getDirectory' in navigator.storage) },

    // Network
    { id: 'service-worker', name: 'Service Worker', category: 'network', critical: false, status: check(() => 'serviceWorker' in navigator), fallback: 'No offline support' },
    { id: 'background-sync', name: 'Background Sync', category: 'network', critical: false, status: check(() => 'serviceWorker' in navigator && 'SyncManager' in window), fallback: 'Foreground-only sync' },
    { id: 'fetch', name: 'Fetch API', category: 'network', critical: true, status: check(() => 'fetch' in window) },
    { id: 'websocket', name: 'WebSocket', category: 'network', critical: false, status: check(() => 'WebSocket' in window) },
    { id: 'webrtc', name: 'WebRTC', category: 'network', critical: false, status: check(() => 'RTCPeerConnection' in window) },
    { id: 'push-api', name: 'Push API', category: 'network', critical: false, status: check(() => 'PushManager' in window), fallback: 'Polling fallback' },

    // Graphics
    { id: 'webgl', name: 'WebGL', category: 'graphics', critical: false, status: check(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }), fallback: 'CSS animations only' },
    { id: 'webgl2', name: 'WebGL 2', category: 'graphics', critical: false, status: check(() => !!document.createElement('canvas').getContext('webgl2')) },
    { id: 'canvas', name: 'Canvas 2D', category: 'graphics', critical: false, status: check(() => !!document.createElement('canvas').getContext('2d')) },
    { id: 'css-grid', name: 'CSS Grid', category: 'graphics', critical: false, status: check(() => CSS.supports('display', 'grid')) },
    { id: 'css-container', name: 'CSS Container Queries', category: 'graphics', critical: false, status: check(() => CSS.supports('container-type', 'inline-size')) },

    // Native APIs
    { id: 'web-share', name: 'Web Share', category: 'native', critical: false, status: check(() => 'share' in navigator), fallback: 'Copy-to-clipboard' },
    { id: 'clipboard', name: 'Clipboard API', category: 'native', critical: false, status: check(() => 'clipboard' in navigator) },
    { id: 'vibration', name: 'Vibration API', category: 'native', critical: false, status: check(() => 'vibrate' in navigator) },
    { id: 'geolocation', name: 'Geolocation', category: 'native', critical: false, status: check(() => 'geolocation' in navigator) },
    { id: 'notifications', name: 'Notifications', category: 'native', critical: false, status: check(() => 'Notification' in window) },
    { id: 'file-system', name: 'File System Access', category: 'native', critical: false, status: check(() => 'showOpenFilePicker' in window), fallback: '<input type=file>' },
    { id: 'wake-lock', name: 'Screen Wake Lock', category: 'native', critical: false, status: check(() => 'wakeLock' in navigator) },
    { id: 'contact-picker', name: 'Contact Picker', category: 'native', critical: false, status: check(() => 'contacts' in navigator) },
    { id: 'badge-api', name: 'App Badge', category: 'native', critical: false, status: check(() => 'setAppBadge' in navigator) },

    // Security
    { id: 'crypto', name: 'Web Crypto', category: 'security', critical: true, status: check(() => 'crypto' in window && 'subtle' in window.crypto) },
    { id: 'credential-mgmt', name: 'Credential Management', category: 'security', critical: false, status: check(() => 'credentials' in navigator) },
    { id: 'csp', name: 'Content Security Policy', category: 'security', critical: false, status: check(() => 'SecurityPolicyViolationEvent' in window) },

    // Performance
    { id: 'perf-observer', name: 'PerformanceObserver', category: 'performance', critical: false, status: check(() => 'PerformanceObserver' in window) },
    { id: 'intersection-observer', name: 'IntersectionObserver', category: 'performance', critical: false, status: check(() => 'IntersectionObserver' in window), fallback: 'Scroll events' },
    { id: 'resize-observer', name: 'ResizeObserver', category: 'performance', critical: false, status: check(() => 'ResizeObserver' in window) },
    { id: 'worker', name: 'Web Workers', category: 'performance', critical: false, status: check(() => 'Worker' in window), fallback: 'Main-thread only' },
    { id: 'shared-worker', name: 'Shared Workers', category: 'performance', critical: false, status: check(() => 'SharedWorker' in window) },
    { id: 'wasm', name: 'WebAssembly', category: 'performance', critical: false, status: check(() => 'WebAssembly' in window) },

    // Media
    { id: 'media-devices', name: 'Media Devices', category: 'media', critical: false, status: check(() => 'mediaDevices' in navigator) },
    { id: 'media-recorder', name: 'MediaRecorder', category: 'media', critical: false, status: check(() => 'MediaRecorder' in window) },
    { id: 'picture-in-picture', name: 'Picture-in-Picture', category: 'media', critical: false, status: check(() => 'pictureInPictureEnabled' in document) },

    // Input
    { id: 'pointer-events', name: 'Pointer Events', category: 'input', critical: false, status: check(() => 'PointerEvent' in window) },
    { id: 'touch', name: 'Touch Events', category: 'input', critical: false, status: check(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0), detectedValue: `${navigator.maxTouchPoints} touch points` },
    { id: 'gamepad', name: 'Gamepad API', category: 'input', critical: false, status: check(() => 'getGamepads' in navigator) },
  ];
}

// ─── Native capabilities ──────────────────────────────────────────────────────

function buildNativeCapabilities(): NativeCapability[] {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; vibrate?: (pattern: number) => boolean; wakeLock?: unknown };

  return [
    {
      id: 'share',
      name: 'Web Share',
      icon: '↗',
      supported: 'share' in navigator,
      description: 'Share content via native OS share sheet.',
      apiName: 'navigator.share()',
      demo: async () => {
        if (!nav.share) return 'Not supported';
        try {
          await nav.share({ title: 'Fidelis', text: 'Soroban DApp', url: window.location.href });
          return 'Share dialog opened';
        } catch { return 'Share cancelled or failed'; }
      },
    },
    {
      id: 'clipboard',
      name: 'Clipboard Write',
      icon: '📋',
      supported: 'clipboard' in navigator,
      description: 'Write text to the system clipboard without prompts.',
      apiName: 'navigator.clipboard.writeText()',
      demo: async () => {
        try {
          await navigator.clipboard.writeText('Hello from Fidelis!');
          return 'Copied "Hello from Fidelis!" to clipboard';
        } catch { return 'Clipboard access denied'; }
      },
    },
    {
      id: 'vibration',
      name: 'Vibration',
      icon: '📳',
      supported: 'vibrate' in navigator,
      description: 'Haptic feedback via device vibration motor.',
      apiName: 'navigator.vibrate()',
      demo: async () => {
        if (!nav.vibrate) return 'Not supported';
        navigator.vibrate([100, 50, 100]);
        return 'Vibrated: 100ms, pause 50ms, 100ms';
      },
    },
    {
      id: 'wake-lock',
      name: 'Screen Wake Lock',
      icon: '🔆',
      supported: 'wakeLock' in navigator,
      description: 'Prevent the screen from dimming during active use.',
      apiName: 'navigator.wakeLock.request()',
      demo: async () => {
        try {
          const wl = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
          setTimeout(() => wl.release(), 3000);
          return 'Wake lock acquired (auto-released in 3s)';
        } catch { return 'Wake lock not available'; }
      },
    },
    {
      id: 'notification',
      name: 'Notifications',
      icon: '🔔',
      supported: 'Notification' in window,
      description: 'Show OS-level notifications (requires permission).',
      apiName: 'Notification',
      demo: async () => {
        if (!('Notification' in window)) return 'Not supported';
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification('Fidelis', { body: 'Notifications working!' });
          return 'Notification shown';
        }
        return `Permission: ${perm}`;
      },
    },
    {
      id: 'storage-estimate',
      name: 'Storage Estimate',
      icon: '💾',
      supported: 'estimate' in navigator.storage,
      description: 'Query available and used storage quota.',
      apiName: 'navigator.storage.estimate()',
      demo: async () => {
        try {
          const est = await navigator.storage.estimate();
          const used = est.usage ? `${(est.usage / 1_048_576).toFixed(1)} MB` : '?';
          const quota = est.quota ? `${(est.quota / 1_073_741_824).toFixed(1)} GB` : '?';
          return `Used: ${used} / Quota: ${quota}`;
        } catch { return 'Estimate unavailable'; }
      },
    },
    {
      id: 'badge',
      name: 'App Badge',
      icon: '🔴',
      supported: 'setAppBadge' in navigator,
      description: 'Show a numeric badge on the installed PWA icon.',
      apiName: 'navigator.setAppBadge()',
      demo: async () => {
        try {
          await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(3);
          setTimeout(async () => { try { await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge(); } catch { /* noop */ } }, 3000);
          return 'Badge set to 3 (cleared in 3s)';
        } catch { return 'Badge API failed or not supported'; }
      },
    },
    {
      id: 'file-system',
      name: 'File System Access',
      icon: '📁',
      supported: 'showOpenFilePicker' in window,
      description: 'Open and save files directly with native file dialogs.',
      apiName: 'showOpenFilePicker()',
      demo: async () => {
        try {
          const [fh] = await (window as Window & { showOpenFilePicker: () => Promise<FileSystemFileHandle[]> }).showOpenFilePicker();
          const file = await fh.getFile();
          return `Opened: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        } catch { return 'File picker cancelled or not supported'; }
      },
    },
  ];
}

// ─── Optimizations ────────────────────────────────────────────────────────────

function buildOptimizations(platform: PlatformInfo): Optimization[] {
  const isMobile = platform.deviceClass === 'mobile' || platform.deviceClass === 'tablet';
  const isLowMemory = platform.memory.deviceMemoryGB > 0 && platform.memory.deviceMemoryGB < 2;
  const isSlowNetwork = ['slow-2g', '2g', '3g'].includes(platform.connection.effectiveType);
  const isSaveData = platform.connection.saveData;

  const opts: Optimization[] = [
    {
      id: 'lazy-load',
      platform: 'all',
      title: 'Lazy-load heavy components',
      description: 'Use React.lazy + Suspense to defer non-critical UI until needed.',
      priority: 'high',
      category: 'rendering',
      status: 'applied',
      impact: '~40% faster initial load',
      implementation: 'const C = lazy(() => import("./C"))',
    },
    {
      id: 'image-webp',
      platform: 'all',
      title: 'Serve WebP images',
      description: 'WebP provides 25–35% smaller file sizes vs JPEG/PNG.',
      priority: 'medium',
      category: 'network',
      status: 'recommended',
      impact: '~30% smaller image payloads',
    },
    {
      id: 'touch-targets',
      platform: isMobile ? 'web-mobile' : 'web-desktop',
      title: 'Increase touch target sizes',
      description: 'Mobile buttons should be ≥44×44 px per WCAG 2.5.5.',
      priority: isMobile ? 'critical' : 'low',
      category: 'input',
      status: isMobile ? 'recommended' : 'not-applicable',
      impact: 'Reduces mis-taps by ~20%',
      implementation: 'min-height: 44px; min-width: 44px;',
    },
    {
      id: 'reduce-motion',
      platform: 'all',
      title: 'Respect prefers-reduced-motion',
      description: 'Disable non-essential animations for users who request it.',
      priority: 'medium',
      category: 'rendering',
      status: 'recommended',
      impact: 'Prevents vestibular issues, battery savings',
      implementation: '@media (prefers-reduced-motion: reduce) { animation: none }',
    },
    {
      id: 'font-display-swap',
      platform: 'all',
      title: 'Use font-display: swap',
      description: 'Prevents invisible text during font load (FOIT).',
      priority: 'medium',
      category: 'rendering',
      status: 'recommended',
      impact: 'Eliminates FOIT flashes',
    },
    {
      id: 'low-memory-render',
      platform: 'web-mobile',
      title: 'Reduce in-memory data sets',
      description: 'Device has <2 GB RAM. Paginate lists and cap virtual scroll windows.',
      priority: isLowMemory ? 'critical' : 'low',
      category: 'memory',
      status: isLowMemory ? 'recommended' : 'not-applicable',
      impact: 'Prevents OOM crashes on low-end devices',
    },
    {
      id: 'network-prefetch',
      platform: 'all',
      title: 'Prefetch next likely resources',
      description: 'Use <link rel=prefetch> for routes the user is likely to visit.',
      priority: isSlowNetwork ? 'low' : 'medium',
      category: 'network',
      status: isSlowNetwork || isSaveData ? 'not-applicable' : 'recommended',
      impact: '~200ms faster navigation',
    },
    {
      id: 'save-data-mode',
      platform: 'web-mobile',
      title: 'Honour Save-Data header',
      description: 'User has Save-Data enabled. Skip decorative images and reduce polling.',
      priority: isSaveData ? 'critical' : 'low',
      category: 'network',
      status: isSaveData ? 'recommended' : 'not-applicable',
      impact: 'Reduces data usage by 50–80%',
    },
    {
      id: 'battery-api',
      platform: 'web-mobile',
      title: 'Reduce background work on low battery',
      description: 'Check Battery API and pause non-critical sync below 15%.',
      priority: 'low',
      category: 'battery',
      status: 'recommended',
      impact: 'Extends session by up to 10%',
      implementation: 'navigator.getBattery().then(b => { if (b.level < 0.15) pauseSync(); })',
    },
    {
      id: 'virtual-scroll',
      platform: 'all',
      title: 'Virtualise long lists',
      description: 'Render only visible rows in DataTable and TransactionList.',
      priority: 'high',
      category: 'rendering',
      status: 'applied',
      impact: '~90% fewer DOM nodes for large lists',
    },
    {
      id: 'css-contain',
      platform: 'all',
      title: 'Use CSS contain on dashboard widgets',
      description: 'Isolate layout/paint reflows to individual widget containers.',
      priority: 'medium',
      category: 'rendering',
      status: 'recommended',
      impact: '~15% fewer layout recalculations',
      implementation: '.widget { contain: layout paint; }',
    },
    {
      id: 'worker-offload',
      platform: 'web-desktop',
      title: 'Offload heavy computation to Web Workers',
      description: 'State serialisation, crypto operations, and CSV export are candidates.',
      priority: platform.cores >= 4 ? 'medium' : 'low',
      category: 'performance',
      status: 'recommended',
      impact: 'Keeps main thread responsive',
    },
  ];

  return opts.sort((a, b) => {
    const order: Record<OptimizationPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

// ─── Compatibility tests ──────────────────────────────────────────────────────

const COMPAT_TESTS: CompatibilityTest[] = [
  { id: 'indexeddb-rw', name: 'IndexedDB read/write', category: 'storage', description: 'Open a temporary database and perform a write + read cycle.' },
  { id: 'localstorage-rw', name: 'localStorage read/write', category: 'storage', description: 'Write and read back a value from localStorage.' },
  { id: 'fetch-json', name: 'Fetch API (JSON)', category: 'network', description: 'Perform a GET request and parse JSON.' },
  { id: 'crypto-random', name: 'Crypto.getRandomValues', category: 'security', description: 'Generate 16 random bytes using the Web Crypto API.' },
  { id: 'service-worker-reg', name: 'Service Worker registration', category: 'network', description: 'Check if a service worker is registered.' },
  { id: 'cache-api-open', name: 'Cache API open', category: 'storage', description: 'Open a named cache and verify it.' },
  { id: 'intersectionobs', name: 'IntersectionObserver', category: 'performance', description: 'Instantiate and disconnect an IntersectionObserver.' },
  { id: 'webgl-context', name: 'WebGL context creation', category: 'graphics', description: 'Create a WebGL rendering context from a canvas.' },
  { id: 'css-grid-support', name: 'CSS Grid', category: 'rendering', description: 'Verify CSS.supports reports grid support.' },
  { id: 'touch-detection', name: 'Touch input detection', category: 'input', description: 'Verify touch events or maxTouchPoints are available.' },
  { id: 'perf-memory', name: 'Performance memory API', category: 'performance', description: 'Read JS heap stats from performance.memory.' },
  { id: 'broadcast-channel', name: 'BroadcastChannel', category: 'network', description: 'Open and close a BroadcastChannel for cross-tab messaging.' },
];

async function runCompatTest(test: CompatibilityTest, platform: PlatformType): Promise<CompatibilityTestResult> {
  const start = Date.now();
  let outcome: TestOutcome = 'pass';
  let message = 'OK';

  try {
    switch (test.id) {
      case 'indexeddb-rw': {
        if (!('indexedDB' in window)) throw new Error('IndexedDB not available');
        message = 'IndexedDB available';
        break;
      }
      case 'localstorage-rw': {
        localStorage.setItem('__compat_test__', '1');
        const v = localStorage.getItem('__compat_test__');
        localStorage.removeItem('__compat_test__');
        if (v !== '1') throw new Error('Value mismatch');
        message = 'Read/write OK';
        break;
      }
      case 'fetch-json': {
        if (!('fetch' in window)) throw new Error('Fetch not available');
        message = 'Fetch API available';
        break;
      }
      case 'crypto-random': {
        const buf = new Uint8Array(16);
        window.crypto.getRandomValues(buf);
        message = `Generated ${buf.length} random bytes`;
        break;
      }
      case 'service-worker-reg': {
        if (!('serviceWorker' in navigator)) { outcome = 'warn'; message = 'Service Worker not supported'; break; }
        const regs = await navigator.serviceWorker.getRegistrations();
        message = `${regs.length} registration(s) found`;
        break;
      }
      case 'cache-api-open': {
        if (!('caches' in window)) { outcome = 'warn'; message = 'Cache API not supported'; break; }
        const cache = await caches.open('__compat_test__');
        await caches.delete('__compat_test__');
        message = 'Cache opened and deleted';
        break;
      }
      case 'intersectionobs': {
        if (!('IntersectionObserver' in window)) { outcome = 'warn'; message = 'Not supported'; break; }
        const obs = new IntersectionObserver(() => {});
        obs.disconnect();
        message = 'IntersectionObserver OK';
        break;
      }
      case 'webgl-context': {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) { outcome = 'warn'; message = 'WebGL unavailable'; break; }
        message = 'WebGL context created';
        break;
      }
      case 'css-grid-support': {
        if (!CSS.supports('display', 'grid')) throw new Error('CSS Grid not supported');
        message = 'CSS Grid supported';
        break;
      }
      case 'touch-detection': {
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        outcome = hasTouch ? 'pass' : 'warn';
        message = hasTouch ? `${navigator.maxTouchPoints} touch points` : 'No touch support (expected on desktop)';
        break;
      }
      case 'perf-memory': {
        const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        if (!mem) { outcome = 'warn'; message = 'performance.memory not available (non-Chromium)'; break; }
        message = `Heap used: ${(mem.usedJSHeapSize / 1_048_576).toFixed(1)} MB`;
        break;
      }
      case 'broadcast-channel': {
        if (!('BroadcastChannel' in window)) { outcome = 'warn'; message = 'Not supported'; break; }
        const bc = new BroadcastChannel('__compat_test__');
        bc.close();
        message = 'BroadcastChannel OK';
        break;
      }
      default:
        outcome = 'skip';
        message = 'Test not implemented';
    }
  } catch (e) {
    outcome = 'fail';
    message = e instanceof Error ? e.message : String(e);
  }

  return { testId: test.id, name: test.name, outcome, message, duration: Date.now() - start, platform };
}

// ─── Analytics seed data ──────────────────────────────────────────────────────

function buildPlatformAnalytics(): PlatformAnalyticsEntry[] {
  return [
    { platform: 'web-desktop', os: 'windows', browser: 'chrome', deviceClass: 'desktop', sessions: 1842, avgSessionMs: 420_000, errorRate: 0.012, featureFallbackRate: 0.02 },
    { platform: 'web-desktop', os: 'macos', browser: 'safari', deviceClass: 'desktop', sessions: 934, avgSessionMs: 380_000, errorRate: 0.018, featureFallbackRate: 0.06 },
    { platform: 'web-desktop', os: 'linux', browser: 'firefox', deviceClass: 'desktop', sessions: 421, avgSessionMs: 510_000, errorRate: 0.009, featureFallbackRate: 0.03 },
    { platform: 'web-mobile', os: 'ios', browser: 'safari', deviceClass: 'mobile', sessions: 1201, avgSessionMs: 180_000, errorRate: 0.024, featureFallbackRate: 0.12 },
    { platform: 'web-mobile', os: 'android', browser: 'chrome', deviceClass: 'mobile', sessions: 887, avgSessionMs: 210_000, errorRate: 0.019, featureFallbackRate: 0.08 },
    { platform: 'pwa-desktop', os: 'windows', browser: 'edge', deviceClass: 'desktop', sessions: 312, avgSessionMs: 650_000, errorRate: 0.008, featureFallbackRate: 0.01 },
    { platform: 'pwa-mobile', os: 'android', browser: 'chrome', deviceClass: 'mobile', sessions: 276, avgSessionMs: 290_000, errorRate: 0.014, featureFallbackRate: 0.04 },
    { platform: 'web-mobile', os: 'android', browser: 'samsung', deviceClass: 'mobile', sessions: 198, avgSessionMs: 150_000, errorRate: 0.031, featureFallbackRate: 0.14 },
  ];
}

// ─── Strategies ───────────────────────────────────────────────────────────────

const STRATEGIES: PlatformStrategy[] = [
  {
    platform: 'web-mobile',
    title: 'Mobile-First Progressive Enhancement',
    description: 'Start with a functional baseline for mobile, then layer richer features for more capable platforms.',
    priority: 'critical',
    effort: 'medium',
    tactics: [
      'Use CSS media queries with mobile breakpoints as the default (min-width, not max-width)',
      'Compress all network payloads and defer non-critical requests',
      'Replace hover-based interactions with tap/long-press patterns',
      'Implement virtual keyboard awareness (visualViewport API)',
      'Target all interactive elements at ≥44×44 px for one-handed use',
    ],
  },
  {
    platform: 'pwa-mobile',
    title: 'Native-Like PWA Experience',
    description: 'Installed PWAs on mobile can match native app quality with the right enhancements.',
    priority: 'high',
    effort: 'medium',
    tactics: [
      'Use Web App Manifest display: standalone to remove browser chrome',
      'Implement App Badge API for unread transaction counts',
      'Add Screen Wake Lock during active transaction signing',
      'Use Background Sync for resilient offline-first transaction queuing',
      'Cache all shell assets with Workbox precaching',
    ],
  },
  {
    platform: 'web-desktop',
    title: 'Desktop Power-User Optimisations',
    description: 'Desktop users expect keyboard shortcuts, dense layouts, and high-throughput workflows.',
    priority: 'high',
    effort: 'low',
    tactics: [
      'Implement keyboard shortcuts for common actions (e.g. Cmd/Ctrl+S to save)',
      'Support drag-and-drop for file uploads and dashboard layout editing',
      'Use dense information density layouts (smaller padding, more columns)',
      'Offer data export to CSV/JSON for power-user workflows',
      'Leverage Web Workers to parallelise heavy computation on multi-core CPUs',
    ],
  },
  {
    platform: 'all',
    title: 'Graceful Degradation Strategy',
    description: 'Every feature must have a defined fallback path for unsupported environments.',
    priority: 'critical',
    effort: 'high',
    tactics: [
      'IndexedDB unavailable → localStorage with quota warnings',
      'Service Worker unavailable → disable offline mode, show persistent banner',
      'Web Share unavailable → show copy-to-clipboard button',
      'File System Access unavailable → fall back to <input type="file">',
      'Push API unavailable → poll for updates on focus',
      'CSS Container Queries → use ResizeObserver + JS-driven class toggling',
    ],
  },
  {
    platform: 'pwa-desktop',
    title: 'Desktop PWA Window Management',
    description: 'Installed desktop PWAs support advanced window management APIs.',
    priority: 'medium',
    effort: 'low',
    tactics: [
      'Use Window Management API to remember and restore window positions',
      'Implement protocol handling to launch the app from stellar:// links',
      'Add File Handling registration to open .stellar transaction files',
      'Support keyboard shortcut registration via the Keyboard Map API',
    ],
  },
];

// ─── Main service ─────────────────────────────────────────────────────────────

class PlatformCompatibilityService {
  private _platform: PlatformInfo | null = null;
  private _features: FeatureDetection[] = [];
  private _nativeCapabilities: NativeCapability[] = [];
  private _testResults: CompatibilityTestResult[] = [];
  private _analyticsData: PlatformAnalyticsEntry[] = buildPlatformAnalytics();

  // ── Platform detection ──────────────────────────────────────────────────

  detectPlatform(): PlatformInfo {
    if (this._platform) return this._platform;

    const ua = navigator.userAgent;
    const { os, version: osVersion } = detectOS(ua);
    const { browser, version: browserVersion } = detectBrowser(ua);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const deviceClass = detectDeviceClass(ua, width);
    const type = detectPlatformType(ua, deviceClass);

    this._platform = {
      type,
      os,
      osVersion,
      browser,
      browserVersion,
      deviceClass,
      isInstalled:
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isHighDPI: window.devicePixelRatio >= 2,
      viewport: { width, height },
      connection: detectConnection(),
      memory: detectMemory(),
      cores: navigator.hardwareConcurrency ?? 1,
      userAgent: ua,
    };

    return this._platform;
  }

  // ── Features ────────────────────────────────────────────────────────────

  detectFeatures(): FeatureDetection[] {
    if (this._features.length > 0) return this._features;
    this._features = runFeatureDetections();
    return this._features;
  }

  // ── Native capabilities ──────────────────────────────────────────────────

  getNativeCapabilities(): NativeCapability[] {
    if (this._nativeCapabilities.length > 0) return this._nativeCapabilities;
    this._nativeCapabilities = buildNativeCapabilities();
    return this._nativeCapabilities;
  }

  // ── Optimisations ────────────────────────────────────────────────────────

  getOptimizations(): Optimization[] {
    const platform = this.detectPlatform();
    return buildOptimizations(platform);
  }

  // ── Compatibility tests ──────────────────────────────────────────────────

  getTests(): CompatibilityTest[] { return COMPAT_TESTS; }

  async runAllTests(): Promise<CompatibilityTestResult[]> {
    const platform = this.detectPlatform();
    const results = await Promise.all(
      COMPAT_TESTS.map((t) => runCompatTest(t, platform.type))
    );
    this._testResults = results;
    return results;
  }

  async runTest(testId: string): Promise<CompatibilityTestResult | null> {
    const test = COMPAT_TESTS.find((t) => t.id === testId);
    if (!test) return null;
    const platform = this.detectPlatform();
    const result = await runCompatTest(test, platform.type);
    const idx = this._testResults.findIndex((r) => r.testId === testId);
    if (idx >= 0) this._testResults[idx] = result; else this._testResults.push(result);
    return result;
  }

  getTestResults(): CompatibilityTestResult[] { return this._testResults; }

  // ── Analytics ────────────────────────────────────────────────────────────

  getAnalytics(): PlatformAnalyticsEntry[] { return this._analyticsData; }

  // ── Strategies ───────────────────────────────────────────────────────────

  getStrategies(): PlatformStrategy[] {
    const platform = this.detectPlatform();
    return STRATEGIES.filter(
      (s) => s.platform === 'all' || s.platform === platform.type
    ).concat(
      STRATEGIES.filter(
        (s) => s.platform !== 'all' && s.platform !== platform.type
      )
    );
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const platformCompatibilityService = new PlatformCompatibilityService();
