import type { CatalogPolicySource } from "@uapt/shared";
import { getCatalogUniversities } from "@/lib/catalog";
import { getChangeRecords, getReleaseChangeRecords } from "@/lib/change-records";
import { getKnownReleaseSummaries } from "@/lib/release-diffs";
import {
  rankingLandingSpecs,
  regionLandingSpecs,
  themeLandingSpecs
} from "@/lib/reference-pages";
import { getPublishableAnalysisThemeSpecs } from "@/lib/policy-analysis-pages";
import { getMonthlyReport, getMonthlyReportCoverageSlug } from "@/lib/reports";
import { monthlyReportSlugs } from "@/lib/monthly-report-registry";
import {
  DEFAULT_LOCALE,
  VISIBLE_LOCALES,
  isMultilingualPhaseTwoEnabled,
  withLocalePrefix,
  type SupportedLocale
} from "@/lib/i18n";
import { getSiteBaseUrl } from "@/lib/site-url";

export interface SitemapEntry {
  url: string;
  lastModified: Date;
}

// The sitemap protocol caps each file at 50,000 URLs, so the sitemap is served
// as an index of per-section child sitemaps. Only visible locales get a child;
// hidden auto-redirect locales (es/nl/ms) and localized change-diff mirrors are
// intentionally excluded to keep crawl budget on canonical English content.
const VISIBLE_NON_DEFAULT_LOCALES = VISIBLE_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE
);

// Release-scoped diff pages are only listed for the most recent releases; older
// diffs stay reachable through /changes and the feeds without competing for
// crawl budget in the sitemap.
const RECENT_RELEASE_SITEMAP_COUNT = 2;

export const SITEMAP_SECTION_IDS = [
  "core",
  "universities",
  "changes",
  ...VISIBLE_NON_DEFAULT_LOCALES
] as const;

export type SitemapSectionId = (typeof SITEMAP_SECTION_IDS)[number];

export function isSitemapSectionId(value: string): value is SitemapSectionId {
  return (SITEMAP_SECTION_IDS as readonly string[]).includes(value);
}

const monthlyReportRoutes = monthlyReportSlugs.map(
  (slug) => `/reports/monthly/${slug}`
);

const staticRoutes = [
  "",
  "/university-ai-policy-database",
  "/universities",
  "/tools",
  "/sources",
  "/reports",
  ...monthlyReportRoutes,
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
  ...monthlyReportRoutes,
  "/reports/outreach"
] as const;

export async function getSitemapLastPublishedAt(): Promise<Date> {
  const releases = await getKnownReleaseSummaries();
  const latest = releases[releases.length - 1];
  const parsed = latest ? new Date(latest.publishedAt) : undefined;

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

export async function buildSitemapSection(
  section: SitemapSectionId
): Promise<SitemapEntry[]> {
  switch (section) {
    case "core":
      return buildCoreSection();
    case "universities":
      return buildUniversitiesSection();
    case "changes":
      return buildChangesSection();
    default:
      return buildLocaleSection(section);
  }
}

async function buildCoreSection(): Promise<SitemapEntry[]> {
  const baseUrl = getSiteBaseUrl();
  const publishedAt = await getSitemapLastPublishedAt();
  const analysisThemeRoutes = await getAnalysisThemeRoutes();
  const reportCoverageRoutes = await getReportCoverageRoutes();

  return [
    ...staticRoutes,
    ...referenceRoutes,
    ...analysisThemeRoutes,
    ...reportCoverageRoutes
  ].map((route) => ({
    url: new URL(route || "/", baseUrl).toString(),
    lastModified: publishedAt
  }));
}

async function buildUniversitiesSection(): Promise<SitemapEntry[]> {
  const baseUrl = getSiteBaseUrl();
  const publishedAt = await getSitemapLastPublishedAt();
  const universities = await getCatalogUniversities();

  return universities.map((university) => {
    const latestSourceDate = getLatestSourceDate(university.sources);

    return {
      url: new URL(`/universities/${university.slug}`, baseUrl).toString(),
      lastModified: latestSourceDate ? new Date(latestSourceDate) : publishedAt
    };
  });
}

async function buildChangesSection(): Promise<SitemapEntry[]> {
  const baseUrl = getSiteBaseUrl();
  const publishedAt = await getSitemapLastPublishedAt();
  const changeRecords = await getChangeRecords();
  const releases = await getKnownReleaseSummaries();
  const recentReleases = releases.slice(-RECENT_RELEASE_SITEMAP_COUNT);
  const releaseEntries = await Promise.all(
    recentReleases.map(async ({ releaseId, publishedAt: releasePublishedAt }) => {
      const records = (await getReleaseChangeRecords(releaseId)) ?? [];
      const releaseDate = toValidDate(releasePublishedAt) ?? publishedAt;

      return [`/changes/${releaseId}`, ...records.map((record) => `/changes/${releaseId}/${record.slug}`)].map(
        (route) => ({
          url: new URL(route, baseUrl).toString(),
          lastModified: releaseDate
        })
      );
    })
  );

  return [
    ...changeRecords.map((record) => ({
      url: new URL(record.changeUrl, baseUrl).toString(),
      lastModified:
        toValidDate(record.lastChangedAt ?? record.lastCheckedAt) ?? publishedAt
    })),
    ...releaseEntries.flat()
  ];
}

async function buildLocaleSection(
  locale: SupportedLocale
): Promise<SitemapEntry[]> {
  const baseUrl = getSiteBaseUrl();
  const publishedAt = await getSitemapLastPublishedAt();
  const phaseTwoEnabled = isMultilingualPhaseTwoEnabled();
  const analysisThemeRoutes = await getAnalysisThemeRoutes();
  const universities = await getCatalogUniversities();
  const staticEntries = [
    ...phaseOneLocalizedStaticRoutes,
    ...(phaseTwoEnabled ? phaseTwoLocalizedStaticRoutes : []),
    ...(phaseTwoEnabled ? referenceRoutes : []),
    ...(phaseTwoEnabled ? await getReportCoverageRoutes() : []),
    ...analysisThemeRoutes
  ].map((route) => ({
    url: new URL(withLocalePrefix(route || "/", locale), baseUrl).toString(),
    lastModified: publishedAt
  }));
  const universityEntries = universities.map((university) => {
    const latestSourceDate = getLatestSourceDate(university.sources);

    return {
      url: new URL(
        withLocalePrefix(`/universities/${university.slug}`, locale),
        baseUrl
      ).toString(),
      lastModified: latestSourceDate ? new Date(latestSourceDate) : publishedAt
    };
  });

  return [...staticEntries, ...universityEntries];
}

async function getAnalysisThemeRoutes(): Promise<string[]> {
  return (await getPublishableAnalysisThemeSpecs()).map(
    (spec) => `/analysis/${spec.slug}`
  );
}

async function getReportCoverageRoutes(): Promise<string[]> {
  const monthlyReports = await Promise.all(
    monthlyReportSlugs.map((slug) => getMonthlyReport(slug))
  );

  return monthlyReports.flatMap((report) =>
    report
      ? report.coverageGroups.map(
          (group) =>
            `/reports/monthly/${report.slug}/coverage/${getMonthlyReportCoverageSlug(group)}`
        )
      : []
  );
}

function getLatestSourceDate(
  sources: CatalogPolicySource[]
): string | undefined {
  return sources
    .flatMap((source) => [source.lastCheckedAt, source.lastChangedAt])
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}

function toValidDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
