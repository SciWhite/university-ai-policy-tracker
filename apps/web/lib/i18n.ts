import { READING_LOCALES, LANGUAGE_NAMES, readingDirection, isReadingLocale, type ReadingLocale } from "./language-catalog";
import { isPublishedV6Slug } from "./policy-v6-published-gate";

export const SUPPORTED_LOCALES = ["en", "zh", "fr", "pl", "es", "nl", "ms"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const ROUTED_LOCALES = READING_LOCALES;
export type LocalizedValue = Partial<Record<SupportedLocale, string>>;

export const DEFAULT_LOCALE = "en" satisfies SupportedLocale;
export const NON_DEFAULT_LOCALES: readonly ReadingLocale[] = ROUTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE
);
export const VISIBLE_LOCALES: readonly SupportedLocale[] = SUPPORTED_LOCALES;
export const HIDDEN_AUTO_LOCALES: readonly string[] = [
  "es",
  "nl",
  "ms"
];

const localeLabels: Record<ReadingLocale, string> = LANGUAGE_NAMES;

const uiStrings = {
  originalEvidence: {
    en: "Original evidence",
    zh: "原始证据",
    fr: "Preuve originale",
    pl: "Oryginalny dowód",
    es: "Evidencia original",
    nl: "Oorspronkelijk bewijs",
    ms: "Bukti asal"
  },
  localizedDisplay: {
    en: "Localized display",
    zh: "本地化显示",
    fr: "Affichage localisé",
    pl: "Widok lokalny",
    es: "Vista localizada",
    nl: "Gelokaliseerde weergave",
    ms: "Paparan setempat"
  },
  sourceLanguage: {
    en: "Source language",
    zh: "来源语言",
    fr: "Langue de la source",
    pl: "Język źródła",
    es: "Idioma de la fuente",
    nl: "Brontaal",
    ms: "Bahasa sumber"
  },
  snapshotHash: {
    en: "Snapshot hash",
    zh: "快照哈希",
    fr: "Empreinte de l’instantané",
    pl: "Skrót migawki",
    es: "Hash de instantánea",
    nl: "Snapshot-hash",
    ms: "Hash petikan"
  }
} satisfies Record<string, LocalizedValue>;

const LOCALIZABLE_PATHS = [
  "/contact", "/support", "/privacy", "/terms", "/mcp",
  "/api-reference", "/widgets", "/review",
  "/",
  "/search",
  "/universities",
  "/university-ai-policy-database",
  "/tools",
  "/sources",
  "/themes",
  "/regions",
  "/rankings",
  "/analysis",
  "/changes",
  "/coverage",
  "/coverage-dashboard",
  "/source-health",
  "/reports",
  "/methodology",
  "/about",
  "/datasets",
  "/citation",
  "/contribute"
] as const;

const PHASE_TWO_LOCALIZABLE_PATHS = [
  "/university-ai-policy-database",
  "/tools",
  "/sources",
  "/themes",
  "/regions",
  "/rankings",
  "/coverage",
  "/coverage-dashboard",
  "/source-health",
  "/reports"
] as const;

export function isMultilingualPhaseTwoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO === "1";
}

export function isPhaseTwoLocalizablePath(pathname: string): boolean {
  const { path } = splitPathSuffix(getPathnameWithoutLocale(pathname));

  return PHASE_TWO_LOCALIZABLE_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function normalizeLocale(value: string | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;

  const normalizedTag = value.trim().replaceAll("_", "-");
  if (/^zh-(?:Hant|TW|HK|MO)(?:-|$)/i.test(normalizedTag)) return DEFAULT_LOCALE;
  const normalized = normalizedTag.toLowerCase().split("-")[0];
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

export function normalizeReadingLocale(value: string | undefined): ReadingLocale {
  if (!value) return DEFAULT_LOCALE;
  const normalized = value.trim().replaceAll("_", "-");
  if (isReadingLocale(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  const exact = ROUTED_LOCALES.find(locale => locale.toLowerCase() === lower);
  if (exact) return exact;
  const [language, ...subtags] = lower.split("-");
  if (language === "zh") return subtags.some(part => ["hant", "tw", "hk", "mo"].includes(part)) ? "zh-Hant" : "zh";
  if (language === "no") return "nb";
  if (language === "iw") return "he";
  if (language === "in") return "id";
  return isReadingLocale(language) ? language : DEFAULT_LOCALE;
}

export function getReadingLocaleFromPathname(pathname: string): ReadingLocale {
  const maybeLocale = pathname.split("/").filter(Boolean)[0];
  return maybeLocale && isReadingLocale(maybeLocale) ? maybeLocale : DEFAULT_LOCALE;
}

export function readingLocaleForLink(pathname: string, override?: ReadingLocale): ReadingLocale {
  const routeLocale = getReadingLocaleFromPathname(pathname);
  return override === undefined || override === legacyLocale(routeLocale) ? routeLocale : override;
}

export function legacyLocale(locale: ReadingLocale): SupportedLocale {
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function localeDirection(locale: ReadingLocale): "ltr" | "rtl" {
  return readingDirection(locale);
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

/** Route/auth parsing for all reading versions; legacy dictionaries stay seven-locale. */
export function stripReadingLocalePrefix(pathname: string): {
  locale: ReadingLocale;
  pathname: string;
  hadLocalePrefix: boolean;
} {
  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  if (maybeLocale && isReadingLocale(maybeLocale)) {
    return { locale: maybeLocale, pathname: `/${segments.slice(1).join("/")}`, hadLocalePrefix: true };
  }
  return { locale: DEFAULT_LOCALE, pathname, hadLocalePrefix: false };
}

export function withLocalePrefix(
  pathname: string,
  locale: ReadingLocale
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
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isReadingLocale(segments[0])) return `/${segments.slice(1).join("/")}` || "/";
  return stripLocalePrefix(pathname).pathname || "/";
}

export function isLocalizablePath(pathname: string): boolean {
  const { path } = splitPathSuffix(getPathnameWithoutLocale(pathname));

  if (
    !isMultilingualPhaseTwoEnabled() &&
    isPhaseTwoLocalizablePath(path)
  ) {
    return false;
  }

  return LOCALIZABLE_PATHS.some((prefix) => {
    if (prefix === "/") return path === "/";
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

export function localizeHref(
  href: string,
  locale: ReadingLocale
): string {
  if (!href.startsWith("/") || isDocumentHref(href)) return href;
  if (!isLocalizablePath(href)) return href;

  const unprefixed = getPathnameWithoutLocale(href);
  const university = /^\/universities\/([^/?#]+)\/?(?:[?#]|$)/.exec(unprefixed);
  // Only the selected university cohort has the additional reading versions.
  // A localized directory must keep other schools' existing records reachable.
  if (university && !isSupportedLocale(locale) && !isPublishedV6Slug(university[1])) return unprefixed;
  return withLocalePrefix(unprefixed, locale);
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
  const normalized = normalizeReadingLocale(locale);
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
  const { path } = splitPathSuffix(href);
  return (
    path.startsWith("/api/") ||
    path.startsWith("/feeds/") ||
    path.endsWith(".txt") ||
    path.endsWith(".json") ||
    path.endsWith(".xml") ||
    path.includes(".")
  );
}

// Canonical facts are language-neutral and evidence-bound. Locale helpers only
// choose presentation strings and route prefixes; they must not mutate source
// URLs, hashes, review state, confidence, or original evidence.
