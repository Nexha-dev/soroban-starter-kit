/**
 * Color Contrast Checker
 * WCAG 2.1 contrast ratio calculation and validation
 */

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;      // 4.5:1 normal, 3:1 large text
  passesAAA: boolean;     // 7:1 normal, 4.5:1 large text
  passesAALarge: boolean;
  passesAAALarge: boolean;
  level: 'AAA' | 'AA' | 'AA-large' | 'fail';
}

export interface ContrastSuggestion {
  foreground: string;
  background: string;
  ratio: number;
  level: ContrastResult['level'];
}

function parseRGB(color: string): [number, number, number] | null {
  const match = color.match(/\d+/g);
  if (match && match.length >= 3) {
    return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
  }
  // hex
  const hex = color.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return null;
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

class ContrastChecker {
  /**
   * Calculate contrast ratio between two colors
   */
  check(foreground: string, background: string): ContrastResult | null {
    const fg = parseRGB(foreground);
    const bg = parseRGB(background);
    if (!fg || !bg) return null;

    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (lighter + 0.05) / (darker + 0.05);

    const passesAA = ratio >= 4.5;
    const passesAAA = ratio >= 7;
    const passesAALarge = ratio >= 3;
    const passesAAALarge = ratio >= 4.5;

    let level: ContrastResult['level'] = 'fail';
    if (passesAAA) level = 'AAA';
    else if (passesAA) level = 'AA';
    else if (passesAALarge) level = 'AA-large';

    return { ratio: Math.round(ratio * 100) / 100, passesAA, passesAAA, passesAALarge, passesAAALarge, level };
  }

  /**
   * Audit all text elements on the page for contrast issues
   */
  auditPage(): ContrastSuggestion[] {
    const issues: ContrastSuggestion[] = [];
    const elements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label, li');

    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const result = this.check(style.color, style.backgroundColor);
      if (result && !result.passesAA) {
        issues.push({
          foreground: style.color,
          background: style.backgroundColor,
          ratio: result.ratio,
          level: result.level,
        });
      }
    });

    return issues;
  }
}

export const contrastChecker = new ContrastChecker();
export default contrastChecker;
