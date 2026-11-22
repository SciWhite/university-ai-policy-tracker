import type { MetadataRoute } from "next";
import { READING_LOCALES } from "../lib/language-catalog";
import { SUPPORTED_LOCALES } from "../lib/i18n";
import { getSiteBaseUrl } from "../lib/site-url";

/**
 * Change-history pages in the reading-only locales (every routed locale outside
 * SUPPORTED_LOCALES) are all `noindex`. Crawlers still walked them: release × school ×
 * 26 locales, each a historical computation, which filled the release-diff queue and
 * slowed the whole origin (2026-11-06: 6,160 of 15,953 requests in one hour).
 * Blocking the crawl loses nothing indexable.
 */
export function readingOnlyChangePaths(): string[] {
  const indexed = new Set<string>(SUPPORTED_LOCALES);
  return READING_LOCALES.filter((locale) => !indexed.has(locale)).map((locale) => `/${locale}/changes/`);
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteBaseUrl();
  // A crawler obeys only the most specific group that names it, so every group repeats the
  // disallows; otherwise Googlebot or GPTBot would ignore the `*` rules.
  // The reading-only change paths are no longer disallowed: since 2026-11-22 every
  // /<uiLocale>/... URL is a cached 301 to the English page (lib/content-locales.ts), and a
  // crawler must be allowed to fetch it to consolidate the old URLs.
  const disallow = ["/internal/analytics"];
  const agents = ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "Googlebot", "Bingbot", "*"];

  return {
    rules: agents.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    sitemap: new URL("/sitemap.xml", baseUrl).toString()
  };
}
