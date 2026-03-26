/**
 * RTL_LOCALES contains the language tag prefixes that use right-to-left text direction.
 * Covers Arabic (ar), Hebrew (he), and Persian/Farsi (fa) per Requirement 4.6.
 */
export const RTL_LOCALES = new Set(['ar', 'he', 'fa']);

export class RTLAdapter {
  /**
   * Returns true if the given locale is an RTL language.
   * Extracts the language prefix (e.g. 'ar' from 'ar-SA') and checks against RTL_LOCALES.
   * Satisfies Requirements 4.1, 4.2, 4.6.
   */
  isRTL(locale: string): boolean {
    const langPrefix = locale.split('-')[0].toLowerCase();
    return RTL_LOCALES.has(langPrefix);
  }

  /**
   * Applies the correct text direction to the document root element.
   * Sets document.documentElement.dir to 'rtl' or 'ltr' based on the locale.
   * Satisfies Requirements 4.1, 4.2, 4.5.
   */
  apply(locale: string): void {
    document.documentElement.dir = this.isRTL(locale) ? 'rtl' : 'ltr';
  }
}
