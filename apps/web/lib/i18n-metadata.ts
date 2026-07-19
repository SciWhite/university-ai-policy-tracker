import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocalizablePath,
  type SupportedLocale,
  withLocalePrefix
} from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export function getLocalizedAlternates(
  pathname: string,
  locale: SupportedLocale = DEFAULT_LOCALE
): NonNullable<Metadata["alternates"]> {
  if (!isLocalizablePath(pathname)) {
    return { canonical: getAbsoluteSiteUrl(pathname) };
  }

  const canonicalPath = withLocalePrefix(pathname, locale);
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((supportedLocale) => [
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
