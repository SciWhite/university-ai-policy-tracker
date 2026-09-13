import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocalizablePath,
  type SupportedLocale,
  withLocalePrefix
} from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export interface LocalizedAlternatesOptions {
  /**
   * Restrict declared language alternates to this subset. Used when a path's
   * substantive body has not passed translation review in the other locales,
   * so those routes must not be declared as localized alternates. The
   * canonical URL and x-default behavior are unchanged.
   */
  restrictLocales?: readonly SupportedLocale[];
}

export function getLocalizedAlternates(
  pathname: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
  options?: LocalizedAlternatesOptions
): NonNullable<Metadata["alternates"]> {
  if (!isLocalizablePath(pathname)) {
    return { canonical: getAbsoluteSiteUrl(pathname) };
  }

  const canonicalPath = withLocalePrefix(pathname, locale);
  const alternateLocales =
    options?.restrictLocales && options.restrictLocales.length
      ? options.restrictLocales
      : SUPPORTED_LOCALES;
  const languages = Object.fromEntries(
    alternateLocales.map((supportedLocale) => [
      supportedLocale,
      getAbsoluteSiteUrl(withLocalePrefix(pathname, supportedLocale))
    ])
  );

  return {
    canonical: getAbsoluteSiteUrl(canonicalPath),
    languages: {
      ...languages,
      "x-default": getAbsoluteSiteUrl(withLocalePrefix(pathname, DEFAULT_LOCALE))
    }
  };
}
