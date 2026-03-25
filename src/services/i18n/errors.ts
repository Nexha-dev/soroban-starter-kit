/**
 * Thrown when a translation catalog JSON file cannot be parsed.
 */
export class CatalogParseError extends Error {
  constructor(
    message: string,
    public readonly file?: string,
    public readonly position?: number
  ) {
    super(message);
    this.name = 'CatalogParseError';
    Object.setPrototypeOf(this, CatalogParseError.prototype);
  }
}

/**
 * Thrown when a translation catalog has structurally invalid content
 * (e.g. a key with a non-string, non-plural value).
 */
export class CatalogValidationError extends Error {
  constructor(
    message: string,
    public readonly offendingKey?: string
  ) {
    super(message);
    this.name = 'CatalogValidationError';
    Object.setPrototypeOf(this, CatalogValidationError.prototype);
  }
}

/**
 * Thrown when a requested locale is not available in the loaded catalogs.
 */
export class LocaleNotFoundError extends Error {
  constructor(public readonly locale: string) {
    super(`Locale not found: "${locale}"`);
    this.name = 'LocaleNotFoundError';
    Object.setPrototypeOf(this, LocaleNotFoundError.prototype);
  }
}
