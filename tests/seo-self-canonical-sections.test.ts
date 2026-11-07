process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO = "1";

import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateReportsMetadata } from "../apps/web/app/(default)/reports/page";
import { generateMetadata as generateAnalysisMetadata } from "../apps/web/app/(default)/analysis/[slug]/page";
import { generateMetadata as generateThemesMetadata } from "../apps/web/app/(default)/themes/[slug]/page";
import { generateMetadata as generateRegionsMetadata } from "../apps/web/app/(default)/regions/[slug]/page";
import { generateMetadata as generateCoverageMetadata } from "../apps/web/app/(default)/reports/monthly/[month]/coverage/[region]/page";
import { generateMetadata as generateMonthlyReportMetadata } from "../apps/web/app/(default)/reports/monthly/[month]/page";
import { SUPPORTED_LOCALES, withLocalePrefix } from "../apps/web/lib/i18n";
import { getAbsoluteSiteUrl } from "../apps/web/lib/site-url";

test("reports, analysis, themes, regions, and coverage pages have self-canonical and reciprocal hreflang for SUPPORTED_LOCALES", async () => {
  const sectionEndpoints = [
    {
      name: "/reports",
      run: (locale: string) => generateReportsMetadata({ params: Promise.resolve({ locale }) }),
      basePath: "/reports",
    },
    {
      name: "/analysis/transparency-commitments",
      run: (locale: string) =>
        generateAnalysisMetadata({
          params: Promise.resolve({ locale, slug: "transparency-commitments" }),
        }),
      basePath: "/analysis/transparency-commitments",
    },
    {
      name: "/themes/teaching-and-learning",
      run: (locale: string) =>
        generateThemesMetadata({
          params: Promise.resolve({ locale, slug: "teaching-and-learning" }),
        }),
      basePath: "/themes/teaching-and-learning",
    },
    {
      name: "/regions/asia",
      run: (locale: string) =>
        generateRegionsMetadata({
          params: Promise.resolve({ locale, slug: "asia" }),
        }),
      basePath: "/regions/asia",
    },
    {
      name: "/reports/monthly/2026-09/coverage/asia",
      run: (locale: string) =>
        generateCoverageMetadata({
          params: Promise.resolve({ locale, month: "2026-09", region: "asia" }),
        }),
      basePath: "/reports/monthly/2026-09/coverage/asia",
    },
  ];

  for (const endpoint of sectionEndpoints) {
    for (const locale of SUPPORTED_LOCALES) {
      const meta = await endpoint.run(locale);
      const expectedCanonical = getAbsoluteSiteUrl(withLocalePrefix(endpoint.basePath, locale));
      const alternates = meta.alternates as { canonical?: string; languages?: Record<string, string> };

      assert.ok(alternates, `Expected alternates for ${endpoint.name} in ${locale}`);
      assert.equal(
        alternates.canonical,
        expectedCanonical,
        `Expected self-canonical ${expectedCanonical} for ${endpoint.name} in ${locale}, got ${alternates.canonical}`
      );

      // Verify reciprocal hreflang for all SUPPORTED_LOCALES + x-default
      assert.ok(alternates.languages, `Expected languages for ${endpoint.name} in ${locale}`);
      for (const targetLocale of SUPPORTED_LOCALES) {
        const expectedTargetUrl = getAbsoluteSiteUrl(withLocalePrefix(endpoint.basePath, targetLocale));
        assert.equal(
          alternates.languages[targetLocale],
          expectedTargetUrl,
          `Expected hreflang[${targetLocale}] on ${endpoint.name} in ${locale} to be ${expectedTargetUrl}`
        );
      }
      assert.equal(
        alternates.languages["x-default"],
        getAbsoluteSiteUrl(endpoint.basePath),
        `Expected x-default on ${endpoint.name} in ${locale} to point to English URL`
      );
    }
  }
});

test("monthly report prose fallback pages keep English canonical", async () => {
  for (const locale of SUPPORTED_LOCALES) {
    const meta = await generateMonthlyReportMetadata({
      params: Promise.resolve({ locale, month: "2026-09" }),
    });
    const alternates = meta.alternates as { canonical?: string; languages?: Record<string, string> };
    const englishCanonical = getAbsoluteSiteUrl("/reports/monthly/2026-09");

    assert.ok(alternates, `Expected alternates for /reports/monthly/2026-09 in ${locale}`);
    assert.equal(
      alternates.canonical,
      englishCanonical,
      `Expected English canonical for /reports/monthly/2026-09 in ${locale}`
    );
  }
});
