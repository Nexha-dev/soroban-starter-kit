# Implementation Plan: i18n-localization

## Overview

Implement the i18n/l10n subsystem as four core TypeScript services (`TranslationManager`, `LocaleFormatter`, `RTLAdapter`, `TranslationValidator`) wired through a React context (`I18nProvider`) and exposed via a `useI18n` hook. Translation catalogs are JSON files loaded lazily at runtime; locale preference is persisted to `localStorage`.

## Tasks

- [x] 1. Set up project structure, types, and error classes
  - Create `src/services/i18n/` directory with `index.ts` barrel export
  - Define `TranslationCatalog`, `TranslationValue`, `PluralVariants` types
  - Define `ValidationViolation` and `ValidationReport` types
  - Define `I18nContextValue` interface
  - Implement typed error classes: `CatalogParseError`, `CatalogValidationError`, `LocaleNotFoundError`
  - Install `fast-check` dev dependency: `npm install --save-dev fast-check`
  - Create `public/locales/` directory with seed catalogs: `en-US.json`, `fr-FR.json`, `ar-SA.json`, `he-IL.json`, `de-DE.json`, `ja-JP.json`, `zh-CN.json`, `es-ES.json`, `pt-BR.json`, `fa-IR.json`
  - _Requirements: 1.1, 2.1, 3.5, 4.6_

- [ ] 2. Implement TranslationManager
  - [x] 2.1 Implement `TranslationManager` class
    - Implement `loadCatalog(locale)` — fetch `/locales/{locale}.json`, cache in memory
    - Implement `parseCatalog(json)` — parse JSON, validate structure, throw `CatalogParseError` / `CatalogValidationError` on failure
    - Implement `serializeCatalog(catalog)` — serialize to JSON string
    - Implement `t(key, values?)` — active locale lookup → fallback locale lookup → raw key; apply `{{placeholder}}` interpolation
    - Implement `plural(key, count, values?)` — use `Intl.PluralRules` to select CLDR variant, then interpolate
    - Implement `onMissingKey(handler)` — register handler; emit on every cache miss
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4, 2.5, 6.3_

  - [ ]* 2.2 Write property test: key lookup returns catalog value (Property 1)
    - **Property 1: Key lookup returns catalog value**
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test: missing key falls back to fallback locale (Property 2)
    - **Property 2: Missing key falls back to fallback locale**
    - **Validates: Requirements 1.3**

  - [ ]* 2.4 Write property test: double-missing key returns the key itself (Property 3)
    - **Property 3: Double-missing key returns the key itself**
    - **Validates: Requirements 1.4**

  - [ ]* 2.5 Write property test: interpolation substitutes all placeholders (Property 4)
    - **Property 4: Interpolation substitutes all placeholders**
    - **Validates: Requirements 1.5**

  - [ ]* 2.6 Write property test: plural selection matches CLDR category (Property 5)
    - **Property 5: Plural selection matches CLDR category**
    - **Validates: Requirements 1.6**

  - [ ]* 2.7 Write property test: catalog serialization round-trip (Property 6)
    - **Property 6: Catalog serialization round-trip**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 2.8 Write property test: missing key lookup emits warning event (Property 14)
    - **Property 14: Missing key lookup emits warning event**
    - **Validates: Requirements 6.3**

  - [ ]* 2.9 Write unit tests for TranslationManager
    - Test `loadCatalog` success and network failure
    - Test `parseCatalog` with malformed JSON and non-string values
    - Test `t()` with known key, fallback chain, and interpolation
    - Test `plural()` for `one` and `other` variants
    - _Requirements: 1.1–1.6, 2.4, 2.5_

- [x] 3. Checkpoint — Ensure all TranslationManager tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement LocaleFormatter
  - [x] 4.1 Implement `LocaleFormatter` class
    - Implement `formatDate(value, locale, options?)` using `Intl.DateTimeFormat`
    - Implement `formatTime(value, locale, options?)` using `Intl.DateTimeFormat`
    - Implement `formatNumber(value, locale, options?)` using `Intl.NumberFormat`
    - Implement `formatCurrency(value, locale, currency)` using `Intl.NumberFormat` with `style: 'currency'`
    - Implement `formatMeasurement(value, unit, locale)` using `Intl.NumberFormat` with `style: 'unit'`; fall back to `String(value)` if `Intl` unavailable
    - Implement `sort(strings, locale)` using `Intl.Collator`
    - Implement `getFirstDayOfWeek(locale)` — locale-to-first-day mapping
    - Implement `getCalendarSystem(locale)` — locale-to-calendar mapping
    - Implement `getNameOrder(locale)` — locale-to-name-order mapping
    - Fall back to `en-US` and log `console.warn` for unsupported locales
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 4.2 Write property test: formatter output is always a non-empty string (Property 7)
    - **Property 7: Formatter output is always a non-empty string**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 4.3 Write property test: currency output contains the currency symbol (Property 8)
    - **Property 8: Currency output contains the currency symbol**
    - **Validates: Requirements 3.4**

  - [ ]* 4.4 Write property test: collation produces locale-ordered list (Property 17)
    - **Property 17: Collation produces locale-ordered list**
    - **Validates: Requirements 7.4**

  - [ ]* 4.5 Write property test: measurement formatting returns non-empty string (Property 18)
    - **Property 18: Measurement formatting returns non-empty string**
    - **Validates: Requirements 7.5**

  - [ ]* 4.6 Write unit tests for LocaleFormatter
    - Test date/time/number/currency formatting for 10+ locales
    - Test `getFirstDayOfWeek`, `getCalendarSystem`, `getNameOrder`
    - Test unsupported locale fallback with `console.warn`
    - _Requirements: 3.1–3.6, 7.1–7.5_

- [ ] 5. Implement RTLAdapter
  - [x] 5.1 Implement `RTLAdapter` class
    - Define `RTL_LOCALES = new Set(['ar', 'he', 'fa'])` (language-tag prefix matching)
    - Implement `isRTL(locale)` — check language prefix against `RTL_LOCALES`
    - Implement `apply(locale)` — set `document.documentElement.dir` to `'rtl'` or `'ltr'`
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [ ]* 5.2 Write property test: RTL adapter sets correct dir attribute (Property 9)
    - **Property 9: RTL adapter sets correct dir attribute**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 5.3 Write unit tests for RTLAdapter
    - Test `isRTL` returns true for `ar`, `he`, `fa`, `ar-SA`; false for `en`, `fr`, `de`
    - Test `apply()` sets `document.documentElement.dir` correctly
    - _Requirements: 4.1, 4.2, 4.6_

- [ ] 6. Implement TranslationValidator
  - [x] 6.1 Implement `TranslationValidator` class
    - Implement `validate(catalogs, fallbackLocale)`:
      - Detect keys in fallback but absent in other locales → `missing_in_locale`
      - Detect keys in non-fallback locales absent from fallback → `extra_in_locale`
      - Detect `{{placeholder}}` drift between fallback and other locales → `placeholder_mismatch`
      - Return `ValidationReport` with grouped violations, `violationCount`, and `isClean`
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [ ]* 6.2 Write property test: validator detects key asymmetry (Property 13)
    - **Property 13: Validator detects key asymmetry**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 6.3 Write property test: validator detects placeholder drift (Property 15)
    - **Property 15: Validator detects placeholder drift**
    - **Validates: Requirements 6.4**

  - [ ]* 6.4 Write property test: clean catalogs produce zero-violation report (Property 16)
    - **Property 16: Clean catalogs produce zero-violation report**
    - **Validates: Requirements 6.6**

  - [ ]* 6.5 Write unit tests for TranslationValidator
    - Test missing key detection, extra key detection, placeholder drift
    - Test clean catalog produces `isClean: true` and `violationCount: 0`
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

- [x] 7. Checkpoint — Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement I18nProvider and useI18n hook
  - [x] 8.1 Implement `I18nProvider` React context and `useI18n` hook
    - Create `src/context/I18nContext.tsx`
    - On mount: read `localStorage.getItem('fidelis-locale')` → match `navigator.languages` against loaded catalogs → fall back to `en-US`
    - Implement `setLocale(locale)` — load catalog if not cached, update state, persist to `localStorage`, call `RTLAdapter.apply()`; reject with `LocaleNotFoundError` for unknown locales
    - Expose `locale`, `availableLocales`, `setLocale`, `t`, `plural`, `formatter`, `isRTL` via context
    - Handle `localStorage` unavailability silently (private browsing)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 4.3, 4.4_

  - [ ]* 8.2 Write property test: language switcher renders all loaded locales (Property 10)
    - **Property 10: Language switcher renders all loaded locales**
    - **Validates: Requirements 5.1**

  - [ ]* 8.3 Write property test: locale persistence round-trip (Property 11)
    - **Property 11: Locale persistence round-trip**
    - **Validates: Requirements 5.3**

  - [ ]* 8.4 Write property test: locale restore on initialization (Property 12)
    - **Property 12: Locale restore on initialization**
    - **Validates: Requirements 5.4**

  - [ ]* 8.5 Write unit tests for I18nProvider
    - Test locale persistence to `localStorage`
    - Test restore from `localStorage` on init
    - Test browser language detection and fallback to `en-US`
    - Test `setLocale` with unknown locale rejects
    - _Requirements: 5.2–5.6_

- [ ] 9. Implement LanguageSwitcher component
  - [x] 9.1 Implement `LanguageSwitcher` component
    - Create `src/components/LanguageSwitcher.tsx`
    - Render a `<select>` with one `<option>` per `availableLocales` from `useI18n()`
    - Call `setLocale` on change; include `aria-label` for accessibility
    - _Requirements: 5.1, 5.2_

  - [ ]* 9.2 Write unit tests for LanguageSwitcher
    - Test renders correct number of options for loaded locales
    - Test calls `setLocale` with correct value on change
    - _Requirements: 5.1, 5.2_

- [x] 10. Wire I18nProvider into the application
  - Wrap the root `App` component with `I18nProvider` in `src/App.tsx`
  - Add `LanguageSwitcher` to the application header/nav
  - Update any existing hardcoded UI strings to use `useI18n().t(key)` for at least the nav and common labels
  - Ensure `RTLAdapter.apply()` is called on initial locale resolution so the `dir` attribute is set at startup
  - _Requirements: 4.3, 4.4, 5.1, 5.2_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with `{ numRuns: 100 }` and must include the comment tag `// Feature: i18n-localization, Property N: <property_text>`
- Catalogs live at `public/locales/{locale}.json` and are fetched lazily at runtime
- `localStorage` key for persisted locale is `"fidelis-locale"`
