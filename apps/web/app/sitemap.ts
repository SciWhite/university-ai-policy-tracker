import type { MetadataRoute } from "next";
import type { CatalogPolicySource } from "@uapt/shared";
import { getCatalogUniversities } from "@/lib/catalog";
import { getChangeRecords } from "@/lib/change-records";
import {
  rankingLandingSpecs,
  regionLandingSpecs,
  themeLandingSpecs
} from "@/lib/reference-pages";
import { getSiteBaseUrl } from "../lib/site-url";

const staticRoutes = [
  "",
  "/universities",
  "/tools",
  "/sources",
  "/reports",
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteBaseUrl();
  const now = new Date();
  const universities = await getCatalogUniversities();
  const changeRecords = await getChangeRecords();

  return [
    ...staticRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...referenceRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...universities.map((university) => {
      const latestSourceDate = getLatestSourceDate(university.sources);

      return {
        url: new URL(`/universities/${university.slug}`, baseUrl).toString(),
        lastModified: latestSourceDate ? new Date(latestSourceDate) : now
      };
    }),
    ...changeRecords.map((record) => ({
      url: new URL(record.changeUrl, baseUrl).toString(),
      lastModified: getRecordLastModified(record, now)
    }))
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
