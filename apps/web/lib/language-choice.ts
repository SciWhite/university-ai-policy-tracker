import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getPathnameWithoutLocale,
  getReadingLocaleFromPathname,
  isLocalizablePath,
  localizeHref
} from "./i18n";
import { READING_LOCALES, preferredReadingLocale, type ReadingLocale } from "./language-catalog";
import { isPublishedV6Slug } from "./policy-v6-published-gate";

const englishOnly: readonly ReadingLocale[] = [DEFAULT_LOCALE];

/** Reading availability is separate from the narrower search-index policy. */
export function pageReadingLocales(pathname: string): readonly ReadingLocale[] {
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  if (!isLocalizablePath(path)) return englishOnly;
  const university = /^\/universities\/([^/]+)\/?$/.exec(path);
  if (university && !isPublishedV6Slug(university[1])) return SUPPORTED_LOCALES;
  return READING_LOCALES;
}

/** Keep the same resource, filters and evidence anchor when changing language. */
export function readingLanguageHref(
  pathname: string,
  target: ReadingLocale,
  search = "",
  hash = ""
): string | undefined {
  if (!pageReadingLocales(pathname).includes(target)) return undefined;
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const anchor = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return `${localizeHref(path, target)}${query}${anchor}`;
}

export function suggestedReadingLocale(
  pathname: string,
  languages: readonly string[],
  hasSavedChoice: boolean,
  dismissed: boolean
): ReadingLocale | undefined {
  if (getReadingLocaleFromPathname(pathname) !== DEFAULT_LOCALE || hasSavedChoice || dismissed) return undefined;
  const preferred = preferredReadingLocale(languages);
  return preferred && preferred !== DEFAULT_LOCALE && pageReadingLocales(pathname).includes(preferred)
    ? preferred
    : undefined;
}
