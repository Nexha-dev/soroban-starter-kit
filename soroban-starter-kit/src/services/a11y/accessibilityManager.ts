/**
 * Accessibility Manager
 * Manages WCAG compliance, screen reader support, and accessibility settings
 */

export interface A11ySettings {
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  reduceMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  focusIndicator: 'default' | 'enhanced' | 'high-contrast';
}

export interface A11yMetrics {
  wcagLevel: 'A' | 'AA' | 'AAA';
  issuesFound: number;
  lastAuditTime: number;
  complianceScore: number;
}

class AccessibilityManager {
  private settings: A11ySettings = {
    highContrast: false,
    fontSize: 'normal',
    reduceMotion: false,
    screenReaderMode: false,
    keyboardNavigation: true,
    focusIndicator: 'default',
  };

  private listeners: Set<(settings: A11ySettings) => void> = new Set();
  private metrics: A11yMetrics = {
    wcagLevel: 'AA',
    issuesFound: 0,
    lastAuditTime: 0,
    complianceScore: 100,
  };

  constructor() {
    this.detectSystemPreferences();
    this.applySettings();
  }

  /**
   * Detect system accessibility preferences
   */
  private detectSystemPreferences(): void {
    if (window.matchMedia('(prefers-contrast: more)').matches) {
      this.settings.highContrast = true;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.reduceMotion = true;
    }
  }

  /**
   * Update accessibility settings
   */
  updateSettings(updates: Partial<A11ySettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.applySettings();
    this.notifyListeners();
  }

  /**
   * Get current settings
   */
  getSettings(): A11ySettings {
    return { ...this.settings };
  }

  /**
   * Apply settings to DOM
   */
  private applySettings(): void {
    const root = document.documentElement;

    root.setAttribute('data-high-contrast', String(this.settings.highContrast));
    root.setAttribute('data-font-size', this.settings.fontSize);
    root.setAttribute('data-reduce-motion', String(this.settings.reduceMotion));
    root.setAttribute('data-screen-reader', String(this.settings.screenReaderMode));
    root.setAttribute('data-focus-indicator', this.settings.focusIndicator);

    if (this.settings.highContrast) {
      document.body.classList.add('a11y-high-contrast');
    } else {
      document.body.classList.remove('a11y-high-contrast');
    }

    if (this.settings.reduceMotion) {
      document.body.classList.add('a11y-reduce-motion');
    } else {
      document.body.classList.remove('a11y-reduce-motion');
    }
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: (settings: A11ySettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getSettings()));
  }

  /**
   * Get accessibility metrics
   */
  getMetrics(): A11yMetrics {
    return { ...this.metrics };
  }

  /**
   * Update metrics after audit
   */
  updateMetrics(metrics: Partial<A11yMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics, lastAuditTime: Date.now() };
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => announcement.remove(), 1000);
  }

  /**
   * Set page title for screen readers
   */
  setPageTitle(title: string): void {
    document.title = title;
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = title;
  }

  /**
   * Get ARIA label for element
   */
  getAriaLabel(element: HTMLElement): string | null {
    return element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
  }
}

export const accessibilityManager = new AccessibilityManager();
export default accessibilityManager;
