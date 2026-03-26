import { Locale, TranslationMessages } from "./types";

const enUS: TranslationMessages = {
  "app.title": "Fidelis",
  "app.subtitle": "Soroban DApp",
  "i18n.language": "Language",
  "i18n.currency": "Currency",
  "i18n.direction": "Text Direction",
  "i18n.direction.ltr": "Left to right",
  "i18n.direction.rtl": "Right to left",
  "i18n.export": "Export locale settings",
  "i18n.import": "Import locale settings",
  "i18n.analytics": "Localization analytics",
  "i18n.community": "Community translations",
  "i18n.missing": "Missing translations",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading...",
  "common.detected": "Detected locale: {locale}",
  "count.transactions": (count: number) =>
    `${count} transaction${count === 1 ? "" : "s"}`,
  "count.notifications": (count: number) =>
    `${count} notification${count === 1 ? "" : "s"}`,
  "culture.greeting": "Hello",
};

const frFR: TranslationMessages = {
  "app.title": "Fidelis",
  "app.subtitle": "DApp Soroban",
  "i18n.language": "Langue",
  "i18n.currency": "Devise",
  "i18n.direction": "Direction du texte",
  "i18n.direction.ltr": "De gauche à droite",
  "i18n.direction.rtl": "De droite à gauche",
  "i18n.export": "Exporter les paramètres régionaux",
  "i18n.import": "Importer les paramètres régionaux",
  "i18n.analytics": "Analytique de localisation",
  "i18n.community": "Traductions communautaires",
  "i18n.missing": "Traductions manquantes",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.loading": "Chargement...",
  "common.detected": "Langue détectée : {locale}",
  "count.transactions": (count: number) =>
    `${count} transaction${count > 1 ? "s" : ""}`,
  "count.notifications": (count: number) =>
    `${count} notification${count > 1 ? "s" : ""}`,
  "culture.greeting": "Bonjour",
};

const esES: TranslationMessages = {
  "app.title": "Fidelis",
  "app.subtitle": "DApp de Soroban",
  "i18n.language": "Idioma",
  "i18n.currency": "Moneda",
  "i18n.direction": "Dirección del texto",
  "i18n.direction.ltr": "De izquierda a derecha",
  "i18n.direction.rtl": "De derecha a izquierda",
  "i18n.export": "Exportar configuración regional",
  "i18n.import": "Importar configuración regional",
  "i18n.analytics": "Analítica de localización",
  "i18n.community": "Traducciones de la comunidad",
  "i18n.missing": "Traducciones faltantes",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.loading": "Cargando...",
  "common.detected": "Idioma detectado: {locale}",
  "count.transactions": (count: number) =>
    `${count} transacción${count === 1 ? "" : "es"}`,
  "count.notifications": (count: number) =>
    `${count} notificación${count === 1 ? "" : "es"}`,
  "culture.greeting": "Hola",
};

const arSA: TranslationMessages = {
  "app.title": "فيدليس",
  "app.subtitle": "تطبيق سوروبان",
  "i18n.language": "اللغة",
  "i18n.currency": "العملة",
  "i18n.direction": "اتجاه النص",
  "i18n.direction.ltr": "من اليسار إلى اليمين",
  "i18n.direction.rtl": "من اليمين إلى اليسار",
  "i18n.export": "تصدير إعدادات اللغة",
  "i18n.import": "استيراد إعدادات اللغة",
  "i18n.analytics": "تحليلات الترجمة",
  "i18n.community": "ترجمات المجتمع",
  "i18n.missing": "ترجمات مفقودة",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.loading": "جاري التحميل...",
  "common.detected": "اللغة المكتشفة: {locale}",
  "count.transactions": (count: number) =>
    `${count} ${count === 1 ? "معاملة" : "معاملات"}`,
  "count.notifications": (count: number) =>
    `${count} ${count === 1 ? "إشعار" : "إشعارات"}`,
  "culture.greeting": "مرحبا",
};

export const MESSAGES: Record<Locale, TranslationMessages> = {
  "en-US": enUS,
  "fr-FR": frFR,
  "es-ES": esES,
  "ar-SA": arSA,
};
