import React, { useState } from 'react';
import { useI18n } from '../context/I18nContext';

const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  'en-US': 'English (US)',
  'fr-FR': 'Français',
  'ar-SA': 'العربية',
  'he-IL': 'עברית',
  'de-DE': 'Deutsch',
  'ja-JP': '日本語',
  'zh-CN': '中文 (简体)',
  'es-ES': 'Español',
  'pt-BR': 'Português (BR)',
  'fa-IR': 'فارسی',
};

export function LanguageSwitcher(): JSX.Element {
  const { locale, availableLocales, setLocale } = useI18n();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value;
    if (newLocale === locale) return;
    setLoading(true);
    try {
      await setLocale(newLocale);
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      aria-label="Select language"
      value={locale}
      onChange={handleChange}
      disabled={loading}
      style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
    >
      {availableLocales.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_DISPLAY_NAMES[loc] ?? loc}
        </option>
      ))}
    </select>
  );
}

export default LanguageSwitcher;
