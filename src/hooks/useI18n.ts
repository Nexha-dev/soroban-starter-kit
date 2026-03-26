import { useLocalization } from "../context/LocalizationContext";

export function useI18n() {
  const localization = useLocalization();

  return {
    ...localization,
    intl: {
      number: localization.formatNumber,
      currency: localization.formatCurrency,
      date: localization.formatDate,
      relativeTime: localization.formatRelativeTime,
      list: localization.formatList,
    },
  };
}
