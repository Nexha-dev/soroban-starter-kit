/**
 * Keyboard Navigation Manager
 * Handles keyboard navigation and focus management
 */

export interface KeyboardConfig {
  enableTabNavigation: boolean;
  enableArrowKeys: boolean;
  enableEscapeKey: boolean;
  focusTrapEnabled: boolean;
  skipLinksEnabled: boolean;
}

type KeyHandler = (event: KeyboardEvent) => void;

class KeyboardNavigationManager {
  private config: KeyboardConfig = {
    enableTabNavigation: true,
    enableArrowKeys: true,
    enableEscapeKey: true,
    focusTrapEnabled: false,
    skipLinksEnabled: true,
  };

  private keyHandlers: Map<string, Set<KeyHandler>> = new Map();
  private focusStack: HTMLElement[] = [];

  constructor() {
    this.setupKeyboardListeners();
    this.createSkipLinks();
  }

  /**
   * Setup global keyboard listeners
   */
  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const handlers = this.keyHandlers.get(key);

    if (handlers) {
      handlers.forEach(handler => handler(event));
    }

    if (key === 'escape' && this.config.enableEscapeKey) {
      this.handleEscapeKey();
    }

    if (key === 'tab' && this.config.focusTrapEnabled) {
      this.handleTabTrap(event);
    }
  }

  /**
   * Register keyboard handler
   */
  registerKeyHandler(key: string, handler: KeyHandler): () => void {
    if (!this.keyHandlers.has(key)) {
      this.keyHandlers.set(key, new Set());
    }
    this.keyHandlers.get(key)!.add(handler);

    return () => {
      this.keyHandlers.get(key)?.delete(handler);
    };
  }

  /**
   * Handle escape key
   */
  private handleEscapeKey(): void {
    const element = this.focusStack.pop();
    if (element) {
      element.focus();
    }
  }

  /**
   * Handle tab trap for modals
   */
  private handleTabTrap(event: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Get all focusable elements
   */
  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Enable focus trap for modal
   */
  enableFocusTrap(element: HTMLElement): () => void {
    this.focusStack.push(document.activeElement as HTMLElement);
    this.config.focusTrapEnabled = true;
    element.focus();

    return () => {
      this.config.focusTrapEnabled = false;
      const previous = this.focusStack.pop();
      if (previous) previous.focus();
    };
  }

  /**
   * Create skip links
   */
  private createSkipLinks(): void {
    if (!this.config.skipLinksEnabled) return;

    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.setAttribute('aria-label', 'Skip to main content');

    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  /**
   * Set focus to element
   */
  setFocus(element: HTMLElement): void {
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Get current focus
   */
  getCurrentFocus(): HTMLElement | null {
    return document.activeElement as HTMLElement;
  }
}

export const keyboardNavigationManager = new KeyboardNavigationManager();
export default keyboardNavigationManager;
