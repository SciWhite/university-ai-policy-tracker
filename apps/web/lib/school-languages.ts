import { DEFAULT_LOCALE } from "./i18n";
import type { ReadingLocale } from "./language-catalog";

/**
 * Language policy (user decision, 2026-11-04): every school page is in English,
 * Simplified Chinese comes second, and each school may add the language of its
 * country or region. A language in this target set is offered, declared in
 * hreflang and listed in the sitemap only once accepted content exists for it.
 * Since 2026-11-23 this holds for base and full V6 schools alike; a full school also keeps the
 * languages its reviewed registry names (lib/university-reading-metadata.ts).
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

// The institution's own language wins over its place (owner, 2026-11-23): a French-language
// university in an English-speaking country is indexed in French, and the other way round.
// `null` = the institution works in English, so its place adds no language.
const institutionLocale: Readonly<Record<string, ReadingLocale | null>> = {
  "universite-libre-de-bruxelles": "fr",
  "vrije-universiteit-brussel-vub": "nl",
  "mcgill-university": null, // English-language universities in Montréal
  "concordia-university": null,
  "university-of-ottawa": "fr", // bilingual (English/French) by statute
  "abo-akademi-university": "sv", // Swedish-language university in Finland
  "saint-joseph-university-of-beirut-usj": "fr" // French-language university in Lebanon
};

export interface SchoolLanguageIdentity {
  slug: string;
  country: string;
  region?: string;
}

/** The school's country or region language, if it is a reading locale. */
export function schoolRegionalLocale(school: SchoolLanguageIdentity): ReadingLocale | undefined {
  if (Object.hasOwn(institutionLocale, school.slug)) return institutionLocale[school.slug] ?? undefined;
  return (school.region ? regionLocale[school.country]?.[school.region] : undefined)
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
