import { READING_LOCALES, isReadingLocale, type ReadingLocale } from "./language-catalog";

/**
 * Content-language URLs (owner decision 2026-11-22, "按新结构改"; docs/render-once.md §10).
 *
 * Only languages with authored content get separately rendered, indexable URLs:
 * English at the root and Simplified Chinese under /zh/. Every other reading
 * locale is a UI-language preference applied in the browser on the English page
 * (components/ui-locale-overlay.tsx). Old /<uiLocale>/... URLs answer 301 to the
 * English page and carry the preference in the fragment (#ui=<locale>): a
 * fragment never reaches nginx or Cloudflare, so it adds no cache-key variant.
 *
 * The one exception is data-driven: /<locale>/universities/<slug> stays a page
 * when that school has complete accepted display prose in its own language
 * (universityReadingIndexLocales in lib/university-reading-metadata.ts). A new
 * native-language page appears when such content is published; nothing here
 * lists schools.
 */
export const CONTENT_LOCALES = ["en", "zh"] as const satisfies readonly ReadingLocale[];
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export const UI_ONLY_LOCALES: readonly ReadingLocale[] = READING_LOCALES.filter(
  (locale) => !(CONTENT_LOCALES as readonly string[]).includes(locale)
);
/** Fragment key that carries a UI preference across a redirect or a switcher link. */
export const UI_LOCALE_FRAGMENT = "ui";
export const UI_LOCALE_STORAGE_KEY = "uapt-ui-locale";

export function isContentLocale(value: string): value is ContentLocale {
  return (CONTENT_LOCALES as readonly string[]).includes(value);
}

export function isUiOnlyLocale(value: string): value is ReadingLocale {
  return isReadingLocale(value) && !isContentLocale(value);
}

/** School pages are the only localized route that can be a native-language content page. */
export function isNativeCandidatePath(pathWithoutLocale: string): boolean {
  return /^\/universities\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathWithoutLocale);
}

/** `#ui=<locale>` (or `#ui=en` to clear the preference). */
export function uiLocaleFragment(locale: ReadingLocale): string {
  return `#${UI_LOCALE_FRAGMENT}=${locale}`;
}

/** Read a `#ui=<locale>` fragment; undefined when the fragment is anything else. */
export function uiLocaleFromFragment(hash: string): ReadingLocale | undefined {
  const match = new RegExp(`^#?${UI_LOCALE_FRAGMENT}=([A-Za-z-]{2,8})$`).exec(hash);
  return match && isReadingLocale(match[1]) ? match[1] : undefined;
}

/**
 * Where an old /<uiLocale>/... URL goes: the same path without the prefix, the
 * query kept, the preference in the fragment. `undefined` for content locales
 * and for school pages (the page decides: native page or redirect).
 */
export function uiLocaleRedirectTarget(pathname: string, search = ""): string | undefined {
  const match = /^\/([A-Za-z-]{2,8})(?=\/|$)(.*)$/.exec(pathname);
  if (!match || !isUiOnlyLocale(match[1])) return undefined;
  const rest = match[2] || "/";
  // Never a protocol-relative target (//host would leave the site).
  if (rest.startsWith("//") || isNativeCandidatePath(rest)) return undefined;
  return `${rest}${search}${uiLocaleFragment(match[1])}`;
}
