import type { MetadataRoute } from "next";
import { seedUniversities } from "@uapt/shared";
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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteBaseUrl();
  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: new URL(route, baseUrl).toString(),
      lastModified: now
    })),
    ...seedUniversities.map((university) => {
      const latestSourceDate = getLatestSourceDate(university.sources);

      return {
        url: new URL(`/universities/${university.slug}`, baseUrl).toString(),
        lastModified: latestSourceDate ? new Date(latestSourceDate) : now
      };
    })
  ];
}

function getLatestSourceDate(
  sources: (typeof seedUniversities)[number]["sources"]
): string | undefined {
  return sources
    .flatMap((source) => [source.lastCheckedAt, source.lastChangedAt])
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}
