export const SUPPORTED_LOCALES = ["en", "fr", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedValue = Partial<Record<SupportedLocale, string>>;

export const DEFAULT_LOCALE: SupportedLocale = "en";

const localeLabels: Record<SupportedLocale, string> = {
  en: "English",
  fr: "Francais",
  zh: "Chinese"
};

const uiStrings = {
  originalEvidence: {
    en: "Original evidence",
    fr: "Evidence originale",
    zh: "Original evidence"
  },
  localizedDisplay: {
    en: "Localized display",
    fr: "Affichage localise",
    zh: "Localized display"
  },
  sourceLanguage: {
    en: "Source language",
    fr: "Langue de la source",
    zh: "Source language"
  },
  snapshotHash: {
    en: "Snapshot hash",
    fr: "Empreinte de l'instantane",
    zh: "Snapshot hash"
  }
} satisfies Record<string, LocalizedValue>;

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function normalizeLocale(value: string | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;

  const normalized = value.toLowerCase().split("-")[0];
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): {
  locale: SupportedLocale;
  pathname: string;
  hadLocalePrefix: boolean;
} {
  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];

  if (maybeLocale && isSupportedLocale(maybeLocale)) {
    return {
      locale: maybeLocale,
      pathname: `/${segments.slice(1).join("/")}`,
      hadLocalePrefix: true
    };
  }

  return {
    locale: DEFAULT_LOCALE,
    pathname,
    hadLocalePrefix: false
  };
}

export function withLocalePrefix(
  pathname: string,
  locale: SupportedLocale
): string {
  if (locale === DEFAULT_LOCALE) return pathname;

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/${locale}${normalizedPath}`;
}

export function getLocalizedString(
  value: LocalizedValue,
  locale: SupportedLocale,
  fallback = ""
): string {
  return value[locale] ?? value[DEFAULT_LOCALE] ?? fallback;
}

export function getUiString(
  key: keyof typeof uiStrings,
  locale: SupportedLocale
): string {
  return getLocalizedString(uiStrings[key], locale, key);
}

export function getLocaleLabel(locale: string | undefined): string {
  const normalized = normalizeLocale(locale);
  return localeLabels[normalized];
}

// Canonical facts are language-neutral and evidence-bound. Locale helpers only
// choose presentation strings and route prefixes; they must not mutate source
// URLs, hashes, review state, confidence, or original evidence.
