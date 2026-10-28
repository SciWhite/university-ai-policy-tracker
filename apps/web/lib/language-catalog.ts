/** Reading languages; policy records and original source-language tags remain unchanged. */
export const READING_LOCALES = [
  "en", "zh", "fr", "pl", "es", "nl", "ms", "ja", "ko", "pt", "ar", "ru", "de", "it",
  "cs", "tr", "fi", "sv", "da", "nb", "hu", "lt", "id", "vi", "th", "fa", "he", "hi",
  "ur", "bn", "uk", "el", "zh-Hant"
] as const;
export type ReadingLocale = (typeof READING_LOCALES)[number];

export const LANGUAGE_NAMES: Record<ReadingLocale, string> = {
  en: "English", zh: "简体中文", "zh-Hant": "繁體中文", fr: "Français", pl: "Polski",
  es: "Español", nl: "Nederlands", ms: "Bahasa Melayu", ja: "日本語", ko: "한국어",
  pt: "Português", ar: "العربية", ru: "Русский", de: "Deutsch", it: "Italiano", cs: "Čeština",
  tr: "Türkçe", fi: "Suomi", sv: "Svenska", da: "Dansk", nb: "Norsk bokmål", hu: "Magyar",
  lt: "Lietuvių", id: "Bahasa Indonesia", vi: "Tiếng Việt", th: "ไทย", fa: "فارسی", he: "עברית",
  hi: "हिन्दी", ur: "اردو", bn: "বাংলা", uk: "Українська", el: "Ελληνικά"
};

const canonical = new Map(READING_LOCALES.map(locale => [locale.toLowerCase(), locale]));

export function isReadingLocale(value: string): value is ReadingLocale {
  return (READING_LOCALES as readonly string[]).includes(value);
}

/** Return no match for unsupported languages rather than ranking them as English. */
export function matchReadingLocale(value: string | undefined): ReadingLocale | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  const exact = canonical.get(normalized);
  if (exact) return exact;
  const [language, ...subtags] = normalized.split("-");
  if (language === "zh") return subtags.some(part => ["hant", "tw", "hk", "mo"].includes(part)) ? "zh-Hant" : "zh";
  if (language === "no") return "nb";
  if (language === "iw") return "he";
  if (language === "in") return "id";
  return canonical.get(language);
}

export function preferredReadingLocale(languages: readonly string[]): ReadingLocale | undefined {
  for (const language of languages) {
    const match = matchReadingLocale(language);
    if (match) return match;
  }
  return undefined;
}

export function readingDirection(locale: ReadingLocale): "rtl" | "ltr" {
  return ["ar", "fa", "he", "ur"].includes(locale) ? "rtl" : "ltr";
}
