import {
  DEFAULT_LOCALE,
  getPathnameWithoutLocale,
  getReadingLocaleFromPathname,
  isLocalizablePath,
  withLocalePrefix
} from "./i18n";
import { READING_LOCALES, preferredReadingLocale, type ReadingLocale } from "./language-catalog";
import { isPublishedV6Slug } from "./policy-v6-published-gate";

const englishOnly: readonly ReadingLocale[] = [DEFAULT_LOCALE];
// Schools outside the multilingual (full V6) cohort offer English and Simplified
// Chinese, plus their country or region language once accepted content exists;
// the page declares that list (see page-reading-locales.ts). Other routes remain
// reachable but are not offered.
const untranslatedSchoolLocales: readonly ReadingLocale[] = [DEFAULT_LOCALE, "zh"];

/** Reading availability is separate from the narrower search-index policy. */
export function pageReadingLocales(pathname: string, declared?: readonly ReadingLocale[]): readonly ReadingLocale[] {
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  if (!isLocalizablePath(path)) return englishOnly;
  const university = /^\/universities\/([^/]+)\/?$/.exec(path);
  if (university && !isPublishedV6Slug(university[1])) return declared?.length ? declared : untranslatedSchoolLocales;
  return READING_LOCALES;
}

/** Keep the same resource, filters and evidence anchor when changing language. */
export function readingLanguageHref(
  pathname: string,
  target: ReadingLocale,
  search = "",
  hash = "",
  declared?: readonly ReadingLocale[]
): string | undefined {
  if (!pageReadingLocales(pathname, declared).includes(target)) return undefined;
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const anchor = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  // The target is already checked against this page's languages, including a
  // base school's declared country language, so prefix it directly.
  return `${withLocalePrefix(path, target)}${query}${anchor}`;
}

export function suggestedReadingLocale(
  pathname: string,
  languages: readonly string[],
  hasSavedChoice: boolean,
  dismissed: boolean,
  declared?: readonly ReadingLocale[]
): ReadingLocale | undefined {
  if (getReadingLocaleFromPathname(pathname) !== DEFAULT_LOCALE || hasSavedChoice || dismissed) return undefined;
  const preferred = preferredReadingLocale(languages);
  return preferred && preferred !== DEFAULT_LOCALE && pageReadingLocales(pathname, declared).includes(preferred)
    ? preferred
    : undefined;
}
