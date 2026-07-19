import type { MetadataRoute } from "next";
import type { CatalogPolicySource } from "@uapt/shared";
import { getCatalogUniversities } from "@/lib/catalog";
import { getChangeRecords, getReleaseChangeRecords } from "@/lib/change-records";
import { getKnownReleaseIds } from "@/lib/release-diffs";
import {
  rankingLandingSpecs,
  regionLandingSpecs,
  themeLandingSpecs
} from "@/lib/reference-pages";
import { getPublishableAnalysisThemeSpecs } from "@/lib/policy-analysis-pages";
import { getMonthlyReport, getMonthlyReportCoverageSlug } from "@/lib/reports";
import {
  NON_DEFAULT_LOCALES,
  isMultilingualPhaseTwoEnabled,
  withLocalePrefix
} from "@/lib/i18n";
import { getSiteBaseUrl } from "../lib/site-url";

const staticRoutes = [
  "",
  "/university-ai-policy-database",
  "/universities",
  "/tools",
  "/sources",
  "/reports",
  "/reports/monthly/2026-05",
  "/reports/monthly/2026-06",
  "/reports/outreach",
  "/widgets",
  "/search",
  "/contribute",
  "/review",
  "/api-reference",
  "/mcp",
  "/analysis",
  "/analysis/policy-coverage",
  "/coverage",
  "/coverage/qs-2026",
  "/source-health",
  "/review/queue",
  "/methodology",
  "/citation",
  "/datasets",
  "/changes"
] as const;

const referenceRoutes = [
  ...rankingLandingSpecs.map((spec) => `/rankings/${spec.slug}`),
  ...regionLandingSpecs.map((spec) => `/regions/${spec.slug}`),
  ...themeLandingSpecs.map((spec) => `/themes/${spec.slug}`)
] as const;

const phaseOneLocalizedStaticRoutes = [
  "",
  "/search",
  "/universities",
  "/analysis",
  "/changes",
  "/methodology",
  "/citation",
  "/datasets",
  "/contribute"
] as const;

const phaseTwoLocalizedStaticRoutes = [
  "/university-ai-policy-database",
  "/tools",
  "/sources",
  "/coverage",
  "/coverage/qs-2026",
  "/source-health",
  "/reports",
  "/reports/monthly/2026-05",
  "/reports/monthly/2026-06",
  "/reports/outreach"
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteBaseUrl();
  const now = new Date();
  const universities = await getCatalogUniversities();
  const changeRecords = await getChangeRecords();
  const releaseIds = await getKnownReleaseIds();
  const releaseRecords = await Promise.all(
    releaseIds.map(async (releaseId) => ({
      releaseId,
      records: (await getReleaseChangeRecords(releaseId)) ?? []
    }))
  );
  const releaseChangeRoutes = releaseRecords.flatMap(({ releaseId, records }) => [
    `/changes/${releaseId}`,
    ...records.map((record) => `/changes/${releaseId}/${record.slug}`)
  ]);
  const analysisThemeRoutes = (await getPublishableAnalysisThemeSpecs()).map(
    (spec) => `/analysis/${spec.slug}`
  );
  const monthlyReports = await Promise.all([
    getMonthlyReport("2026-05"),
    getMonthlyReport("2026-06")
  ]);
  const reportCoverageRoutes = monthlyReports.flatMap((report) =>
    report
      ? report.coverageGroups.map(
          (group) =>
            `/reports/monthly/${report.slug}/coverage/${getMonthlyReportCoverageSlug(group)}`
        )
      : []
  );
  const phaseTwoEnabled = isMultilingualPhaseTwoEnabled();
  const localizedStaticRoutes = [
    ...phaseOneLocalizedStaticRoutes,
    ...(phaseTwoEnabled ? phaseTwoLocalizedStaticRoutes : [])
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      localizedStaticRoutes.map((route) => ({
        url: new URL(withLocalePrefix(route || "/", locale), baseUrl).toString(),
        lastModified: now
      }))
    ),
    ...referenceRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      (phaseTwoEnabled ? referenceRoutes : []).map((route) => ({
        url: new URL(withLocalePrefix(route, locale), baseUrl).toString(),
        lastModified: now
      }))
    ),
    ...analysisThemeRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      analysisThemeRoutes.map((route) => ({
        url: new URL(withLocalePrefix(route, locale), baseUrl).toString(),
        lastModified: now
      }))
    ),
    ...reportCoverageRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      (phaseTwoEnabled ? reportCoverageRoutes : []).map((route) => ({
        url: new URL(withLocalePrefix(route, locale), baseUrl).toString(),
        lastModified: now
      }))
    ),
    ...universities.map((university) => {
      const latestSourceDate = getLatestSourceDate(university.sources);

      return {
        url: new URL(`/universities/${university.slug}`, baseUrl).toString(),
        lastModified: latestSourceDate ? new Date(latestSourceDate) : now
      };
    }),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      universities.map((university) => {
        const latestSourceDate = getLatestSourceDate(university.sources);

        return {
          url: new URL(
            withLocalePrefix(`/universities/${university.slug}`, locale),
            baseUrl
          ).toString(),
          lastModified: latestSourceDate ? new Date(latestSourceDate) : now
        };
      })
    ),
    ...changeRecords.map((record) => ({
      url: new URL(record.changeUrl, baseUrl).toString(),
      lastModified: getRecordLastModified(record, now)
    })),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      changeRecords.map((record) => ({
        url: new URL(withLocalePrefix(record.changeUrl, locale), baseUrl).toString(),
        lastModified: getRecordLastModified(record, now)
      }))
    ),
    ...releaseChangeRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...NON_DEFAULT_LOCALES.flatMap((locale) =>
      releaseChangeRoutes.map((route) => ({
        url: new URL(withLocalePrefix(route, locale), baseUrl).toString(),
        lastModified: now
      }))
    )
  ];
}

function getLatestSourceDate(
  sources: CatalogPolicySource[]
): string | undefined {
  return sources
    .flatMap((source) => [source.lastCheckedAt, source.lastChangedAt])
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}

function getRecordLastModified(
  record: { lastChangedAt?: string; lastCheckedAt?: string },
  fallback: Date
): Date {
  const latestDate = record.lastChangedAt ?? record.lastCheckedAt;

  return latestDate ? new Date(latestDate) : fallback;
}
