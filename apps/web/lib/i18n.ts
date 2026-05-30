export const SUPPORTED_LOCALES = [
  "en",
  "zh",
  "fr",
  "pl",
  "es",
  "nl",
  "ms"
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedValue = Partial<Record<SupportedLocale, string>>;

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE
);

const localeLabels: Record<SupportedLocale, string> = {
  en: "English",
  zh: "Chinese",
  fr: "Francais",
  pl: "Polski",
  es: "Espanol",
  nl: "Nederlands",
  ms: "Bahasa Melayu"
};

const uiStrings = {
  originalEvidence: {
    en: "Original evidence",
    zh: "原始证据",
    fr: "Evidence originale",
    pl: "Oryginalny dowod",
    es: "Evidencia original",
    nl: "Oorspronkelijk bewijs",
    ms: "Bukti asal"
  },
  localizedDisplay: {
    en: "Localized display",
    zh: "本地化显示",
    fr: "Affichage localise",
    pl: "Widok lokalny",
    es: "Vista localizada",
    nl: "Gelokaliseerde weergave",
    ms: "Paparan setempat"
  },
  sourceLanguage: {
    en: "Source language",
    zh: "来源语言",
    fr: "Langue de la source",
    pl: "Jezyk zrodla",
    es: "Idioma de la fuente",
    nl: "Brontaal",
    ms: "Bahasa sumber"
  },
  snapshotHash: {
    en: "Snapshot hash",
    zh: "快照哈希",
    fr: "Empreinte de l'instantane",
    pl: "Hash migawki",
    es: "Hash de instantanea",
    nl: "Snapshot-hash",
    ms: "Hash petikan"
  }
} satisfies Record<string, LocalizedValue>;

const LOCALIZABLE_PATHS = [
  "/",
  "/search",
  "/universities",
  "/methodology",
  "/datasets",
  "/citation"
] as const;

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

  const { path, suffix } = splitPathSuffix(pathname);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}${suffix}`;
}

export function getLocaleFromPathname(pathname: string): SupportedLocale {
  return stripLocalePrefix(pathname).locale;
}

export function getPathnameWithoutLocale(pathname: string): string {
  return stripLocalePrefix(pathname).pathname || "/";
}

export function isLocalizablePath(pathname: string): boolean {
  const { path } = splitPathSuffix(getPathnameWithoutLocale(pathname));

  return LOCALIZABLE_PATHS.some((prefix) => {
    if (prefix === "/") return path === "/";
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

export function localizeHref(
  href: string,
  locale: SupportedLocale
): string {
  if (!href.startsWith("/") || isDocumentHref(href)) return href;
  if (!isLocalizablePath(href)) return href;

  return withLocalePrefix(getPathnameWithoutLocale(href), locale);
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

function splitPathSuffix(pathname: string): { path: string; suffix: string } {
  const suffixIndex = pathname.search(/[?#]/);

  if (suffixIndex === -1) {
    return { path: pathname, suffix: "" };
  }

  return {
    path: pathname.slice(0, suffixIndex),
    suffix: pathname.slice(suffixIndex)
  };
}

function isDocumentHref(href: string): boolean {
  return (
    href.startsWith("/api/") ||
    href.startsWith("/feeds/") ||
    href.endsWith(".txt") ||
    href.endsWith(".json") ||
    href.endsWith(".xml") ||
    href.includes(".")
  );
}

// Canonical facts are language-neutral and evidence-bound. Locale helpers only
// choose presentation strings and route prefixes; they must not mutate source
// URLs, hashes, review state, confidence, or original evidence.
