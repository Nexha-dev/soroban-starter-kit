/**
 * Accessibility Feedback Collector
 * Collects user feedback on accessibility issues and improvement suggestions
 */

export interface A11yFeedback {
  id: string;
  timestamp: number;
  category: 'navigation' | 'contrast' | 'screen-reader' | 'keyboard' | 'other';
  severity: 'blocker' | 'major' | 'minor';
  description: string;
  url: string;
  userAgent: string;
  resolved: boolean;
}

export interface RemediationGuide {
  issueCode: string;
  title: string;
  wcagCriteria: string;
  steps: string[];
  codeExample?: string;
}

const REMEDIATION_GUIDES: Record<string, RemediationGuide> = {
  IMG_ALT: {
    issueCode: 'IMG_ALT',
    title: 'Add alt text to images',
    wcagCriteria: 'WCAG 1.1.1 Non-text Content (Level A)',
    steps: [
      'Add a descriptive alt attribute to every <img> element',
      'Use alt="" for decorative images',
      'Describe the image content or function, not its appearance',
    ],
    codeExample: '<img src="chart.png" alt="Monthly revenue chart showing 20% growth" />',
  },
  BUTTON_LABEL: {
    issueCode: 'BUTTON_LABEL',
    title: 'Add accessible label to buttons',
    wcagCriteria: 'WCAG 4.1.2 Name, Role, Value (Level A)',
    steps: [
      'Add visible text content inside the button',
      'Or add aria-label="descriptive label" to icon-only buttons',
    ],
    codeExample: '<button aria-label="Close dialog">✕</button>',
  },
  FORM_LABEL: {
    issueCode: 'FORM_LABEL',
    title: 'Associate labels with form inputs',
    wcagCriteria: 'WCAG 1.3.1 Info and Relationships (Level A)',
    steps: [
      'Use <label for="inputId"> paired with input id',
      'Or wrap the input inside a <label> element',
      'Or add aria-label / aria-labelledby to the input',
    ],
    codeExample: '<label for="email">Email</label>\n<input id="email" type="email" />',
  },
  HEADING_SKIP: {
    issueCode: 'HEADING_SKIP',
    title: 'Fix heading hierarchy',
    wcagCriteria: 'WCAG 1.3.1 Info and Relationships (Level A)',
    steps: [
      'Do not skip heading levels (e.g. h1 → h3)',
      'Use headings to reflect document structure, not visual styling',
    ],
  },
  CONTRAST: {
    issueCode: 'CONTRAST',
    title: 'Improve color contrast',
    wcagCriteria: 'WCAG 1.4.3 Contrast (Minimum) (Level AA)',
    steps: [
      'Ensure text has a contrast ratio of at least 4.5:1 against its background',
      'Large text (18pt / 14pt bold) requires at least 3:1',
      'Use a contrast checker tool to verify colors',
    ],
  },
  KEYBOARD_ACCESS: {
    issueCode: 'KEYBOARD_ACCESS',
    title: 'Ensure keyboard accessibility',
    wcagCriteria: 'WCAG 2.1.1 Keyboard (Level A)',
    steps: [
      'Remove tabIndex="-1" from interactive elements unless intentionally excluded',
      'Ensure all functionality is operable via keyboard alone',
      'Provide visible focus indicators',
    ],
  },
  ARIA_LABEL: {
    issueCode: 'ARIA_LABEL',
    title: 'Add accessible name to ARIA roles',
    wcagCriteria: 'WCAG 4.1.2 Name, Role, Value (Level A)',
    steps: [
      'Add aria-label or aria-labelledby to elements with explicit ARIA roles',
      'Ensure landmark regions (main, nav, aside) have unique labels when multiple exist',
    ],
  },
};

class A11yFeedbackCollector {
  private feedback: A11yFeedback[] = [];
  private maxFeedback = 500;

  /**
   * Submit accessibility feedback
   */
  submit(entry: Omit<A11yFeedback, 'id' | 'timestamp' | 'url' | 'userAgent' | 'resolved'>): A11yFeedback {
    const feedback: A11yFeedback = {
      ...entry,
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      resolved: false,
    };

    this.feedback.push(feedback);
    if (this.feedback.length > this.maxFeedback) this.feedback.shift();

    return feedback;
  }

  /**
   * Mark feedback as resolved
   */
  resolve(id: string): void {
    const entry = this.feedback.find(f => f.id === id);
    if (entry) entry.resolved = true;
  }

  /**
   * Get all feedback
   */
  getAll(includeResolved = false): A11yFeedback[] {
    return this.feedback.filter(f => includeResolved || !f.resolved);
  }

  /**
   * Get remediation guide for an issue code
   */
  getRemediation(issueCode: string): RemediationGuide | null {
    return REMEDIATION_GUIDES[issueCode] ?? null;
  }

  /**
   * Get all remediation guides
   */
  getAllRemediations(): RemediationGuide[] {
    return Object.values(REMEDIATION_GUIDES);
  }

  /**
   * Get feedback summary by category
   */
  getSummary(): Record<A11yFeedback['category'], number> {
    const summary: Record<A11yFeedback['category'], number> = {
      navigation: 0, contrast: 0, 'screen-reader': 0, keyboard: 0, other: 0,
    };
    for (const f of this.feedback.filter(f => !f.resolved)) {
      summary[f.category]++;
    }
    return summary;
  }

  clear(): void {
    this.feedback = [];
  }
}

export const a11yFeedbackCollector = new A11yFeedbackCollector();
export default a11yFeedbackCollector;
