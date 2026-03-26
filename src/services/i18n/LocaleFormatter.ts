/**
 * Locale-specific formatting utilities backed by the native Intl API.
 */
export interface LocaleFormatter {
  formatDate(value: Date, locale: string, options?: Intl.DateTimeFormatOptions): string;
  formatTime(value: Date, locale: string, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string;
  formatCurrency(value: number, locale: string, currency: string): string;
  formatMeasurement(value: number, unit: string, locale: string): string;
  sort(strings: string[], locale: string): string[];
  getFirstDayOfWeek(locale: string): 0 | 1 | 6;
  getCalendarSystem(locale: string): string;
  getNameOrder(locale: string): 'given-first' | 'family-first';
}
