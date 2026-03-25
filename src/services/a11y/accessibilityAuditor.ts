/**
 * Accessibility Auditor
 * Validates WCAG compliance and generates reports
 */

export interface A11yIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  element?: HTMLElement;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface A11yAuditReport {
  timestamp: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
  issues: A11yIssue[];
  score: number;
}

class AccessibilityAuditor {
  private issues: A11yIssue[] = [];
  private reports: A11yAuditReport[] = [];

  /**
   * Run full accessibility audit
   */
  audit(): A11yAuditReport {
    this.issues = [];

    this.checkImages();
    this.checkHeadings();
    this.checkButtons();
    this.checkForms();
    this.checkContrast();
    this.checkAriaLabels();
    this.checkKeyboardAccess();

    return this.generateReport();
  }

  /**
   * Check image alt text
   */
  private checkImages(): void {
    document.querySelectorAll('img').forEach(img => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        this.issues.push({
          type: 'error',
          code: 'IMG_ALT',
          message: 'Image missing alt text',
          element: img,
          wcagLevel: 'A',
        });
      }
    });
  }

  /**
   * Check heading structure
   */
  private checkHeadings(): void {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;

    headings.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      if (level - lastLevel > 1) {
        this.issues.push({
          type: 'warning',
          code: 'HEADING_SKIP',
          message: `Heading level skipped from H${lastLevel} to H${level}`,
          element: heading as HTMLElement,
          wcagLevel: 'A',
        });
      }
      lastLevel = level;
    });
  }

  /**
   * Check button accessibility
   */
  private checkButtons(): void {
    document.querySelectorAll('button').forEach(button => {
      if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
        this.issues.push({
          type: 'error',
          code: 'BUTTON_LABEL',
          message: 'Button missing accessible label',
          element: button,
          wcagLevel: 'A',
        });
      }
    });
  }

  /**
   * Check form accessibility
   */
  private checkForms(): void {
    document.querySelectorAll('input, textarea, select').forEach(input => {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (!label && !input.getAttribute('aria-label')) {
        this.issues.push({
          type: 'error',
          code: 'FORM_LABEL',
          message: 'Form input missing label',
          element: input as HTMLElement,
          wcagLevel: 'A',
        });
      }
    });
  }

  /**
   * Check color contrast
   */
  private checkContrast(): void {
    document.querySelectorAll('*').forEach(element => {
      const style = window.getComputedStyle(element);
      const bgColor = style.backgroundColor;
      const fgColor = style.color;

      if (bgColor && fgColor && !this.hasGoodContrast(bgColor, fgColor)) {
        this.issues.push({
          type: 'warning',
          code: 'CONTRAST',
          message: 'Insufficient color contrast',
          element: element as HTMLElement,
          wcagLevel: 'AA',
        });
      }
    });
  }

  /**
   * Check ARIA labels
   */
  private checkAriaLabels(): void {
    document.querySelectorAll('[role]').forEach(element => {
      if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
        this.issues.push({
          type: 'info',
          code: 'ARIA_LABEL',
          message: 'ARIA role missing accessible label',
          element: element as HTMLElement,
          wcagLevel: 'AA',
        });
      }
    });
  }

  /**
   * Check keyboard accessibility
   */
  private checkKeyboardAccess(): void {
    document.querySelectorAll('button, a, input').forEach(element => {
      if ((element as HTMLElement).tabIndex === -1) {
        this.issues.push({
          type: 'warning',
          code: 'KEYBOARD_ACCESS',
          message: 'Interactive element not keyboard accessible',
          element: element as HTMLElement,
          wcagLevel: 'A',
        });
      }
    });
  }

  /**
   * Check contrast ratio
   */
  private hasGoodContrast(bgColor: string, fgColor: string): boolean {
    const bg = this.parseColor(bgColor);
    const fg = this.parseColor(fgColor);

    if (!bg || !fg) return true;

    const bgLum = this.getLuminance(bg);
    const fgLum = this.getLuminance(fg);

    const lighter = Math.max(bgLum, fgLum);
    const darker = Math.min(bgLum, fgLum);

    const ratio = (lighter + 0.05) / (darker + 0.05);
    return ratio >= 4.5; // WCAG AA standard
  }

  /**
   * Parse color string
   */
  private parseColor(color: string): [number, number, number] | null {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
    }
    return null;
  }

  /**
   * Calculate luminance
   */
  private getLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map(v => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Generate audit report
   */
  private generateReport(): A11yAuditReport {
    const errors = this.issues.filter(i => i.type === 'error').length;
    const warnings = this.issues.filter(i => i.type === 'warning').length;

    const wcagLevel = errors > 0 ? 'A' : warnings > 0 ? 'AA' : 'AAA';
    const score = Math.max(0, 100 - errors * 10 - warnings * 2);

    const report: A11yAuditReport = {
      timestamp: Date.now(),
      totalIssues: this.issues.length,
      errors,
      warnings,
      wcagLevel,
      issues: this.issues,
      score,
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Get audit history
   */
  getHistory(): A11yAuditReport[] {
    return [...this.reports];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.reports = [];
  }
}

export const accessibilityAuditor = new AccessibilityAuditor();
export default accessibilityAuditor;
