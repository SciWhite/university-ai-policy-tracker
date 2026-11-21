import {
  DEFAULT_LOCALE,
  getPathnameWithoutLocale,
  getReadingLocaleFromPathname,
  isLocalizablePath,
  withLocalePrefix
} from "./i18n";
import { READING_LOCALES, preferredReadingLocale, type ReadingLocale } from "./language-catalog";
import { isContentLocale, isNativeCandidatePath, uiLocaleFragment, uiLocaleFromFragment } from "./content-locales";

const englishOnly: readonly ReadingLocale[] = [DEFAULT_LOCALE];

/**
 * Languages the switcher offers. Content languages (en, zh, and a school's declared native
 * language) are URLs; every other reading locale is a UI preference on the English page
 * (lib/content-locales.ts), so all of them are offered on localizable pages.
 */
export function pageReadingLocales(pathname: string, declared?: readonly ReadingLocale[]): readonly ReadingLocale[] {
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  if (!isLocalizablePath(path)) return englishOnly;
  return READING_LOCALES;
}

/** A content URL exists for this language: en/zh everywhere, a native language where the school page declares it. */
export function hasContentUrl(pathname: string, target: ReadingLocale, declared?: readonly ReadingLocale[]): boolean {
  if (isContentLocale(target)) return true;
  const path = getPathnameWithoutLocale(pathname).split(/[?#]/, 1)[0];
  return isNativeCandidatePath(path) && Boolean(declared?.includes(target));
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
  // A UI-only language is a preference on the English page: `#ui=<locale>`.
  if (!hasContentUrl(pathname, target, declared)) return `${path}${query}${uiLocaleFragment(target)}`;
  const anchor = hash && !uiLocaleFromFragment(hash) ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
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
