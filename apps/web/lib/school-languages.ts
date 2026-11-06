import { DEFAULT_LOCALE } from "./i18n";
import type { ReadingLocale } from "./language-catalog";

/**
 * Language policy (user decision, 2026-11-04): every school page is in English,
 * Simplified Chinese comes second, and each school may add the language of its
 * country or region. A language in this target set is offered, declared in
 * hreflang and listed in the sitemap only once accepted content exists for it.
 * Multilingual (full V6) schools keep their existing reading locales instead.
 */
export const SECOND_SCHOOL_LOCALE = "zh" satisfies ReadingLocale;

// Countries with one dominant language among the 33 reading locales. Countries
// whose language is not a reading locale, or that are officially multilingual
// without a regional split here, add nothing.
const countryLocale: Readonly<Record<string, ReadingLocale>> = {
  "China (Mainland)": "zh",
  Taiwan: "zh-Hant",
  "Hong Kong SAR": "zh-Hant",
  "Macau SAR": "zh-Hant",
  Japan: "ja",
  "South Korea": "ko",
  France: "fr",
  Germany: "de",
  Austria: "de",
  Italy: "it",
  Spain: "es",
  Mexico: "es",
  Argentina: "es",
  Chile: "es",
  Colombia: "es",
  Peru: "es",
  Venezuela: "es",
  "Costa Rica": "es",
  Cuba: "es",
  Uruguay: "es",
  Ecuador: "es",
  Brazil: "pt",
  Portugal: "pt",
  Netherlands: "nl",
  Poland: "pl",
  Czechia: "cs",
  Russia: "ru",
  Belarus: "ru",
  Ukraine: "uk",
  "Türkiye": "tr",
  "Saudi Arabia": "ar",
  "United Arab Emirates": "ar",
  Egypt: "ar",
  Jordan: "ar",
  Lebanon: "ar",
  Qatar: "ar",
  Bahrain: "ar",
  Oman: "ar",
  Kuwait: "ar",
  Iraq: "ar",
  Tunisia: "ar",
  Iran: "fa",
  Israel: "he",
  Pakistan: "ur",
  India: "hi",
  Bangladesh: "bn",
  Thailand: "th",
  Vietnam: "vi",
  Indonesia: "id",
  Malaysia: "ms",
  Brunei: "ms",
  Finland: "fi",
  Sweden: "sv",
  Denmark: "da",
  Norway: "nb",
  Hungary: "hu",
  Lithuania: "lt",
  Greece: "el",
  Cyprus: "el"
};

// Multilingual countries resolved by the institution's region.
const regionLocale: Readonly<Record<string, Readonly<Record<string, ReadingLocale>>>> = {
  Canada: { Montreal: "fr", "Québec": "fr" },
  Switzerland: {
    Lausanne: "fr", Geneva: "fr", Fribourg: "fr",
    "Zürich": "de", Basel: "de", Bern: "de", Winterthur: "de",
    Lugano: "it"
  },
  Belgium: {
    Ghent: "nl", Leuven: "nl", Antwerp: "nl", Diepenbeek: "nl",
    "Louvain-la-Neuve": "fr", "Liège": "fr", Mons: "fr", Namur: "fr"
  }
};

// Institutions whose region is itself bilingual.
const institutionLocale: Readonly<Record<string, ReadingLocale>> = {
  "universite-libre-de-bruxelles": "fr",
  "vrije-universiteit-brussel-vub": "nl"
};

export interface SchoolLanguageIdentity {
  slug: string;
  country: string;
  region?: string;
}

/** The school's country or region language, if it is a reading locale. */
export function schoolRegionalLocale(school: SchoolLanguageIdentity): ReadingLocale | undefined {
  return institutionLocale[school.slug]
    ?? (school.region ? regionLocale[school.country]?.[school.region] : undefined)
    ?? countryLocale[school.country];
}

/** English, Simplified Chinese, then the country or region language. */
export function schoolTargetLocales(school: SchoolLanguageIdentity): ReadingLocale[] {
  const regional = schoolRegionalLocale(school);
  return [...new Set<ReadingLocale>([DEFAULT_LOCALE, SECOND_SCHOOL_LOCALE, ...(regional ? [regional] : [])])];
}

/**
 * Languages a non-multilingual school offers in its language switcher: English,
 * the always-available second language, and any target language with accepted
 * content (`contentLocales`, from the translation gate). Order follows the
 * target set so the switcher is stable.
 */
export function schoolSwitcherLocales(school: SchoolLanguageIdentity, contentLocales: readonly ReadingLocale[]): ReadingLocale[] {
  return schoolTargetLocales(school).filter(locale =>
    locale === DEFAULT_LOCALE || locale === SECOND_SCHOOL_LOCALE || contentLocales.includes(locale)
  );
}
