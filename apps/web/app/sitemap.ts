import type { MetadataRoute } from "next";
import { seedUniversities } from "@uapt/shared";

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
    ...seedUniversities.map((university) => ({
      url: new URL(`/universities/${university.slug}`, baseUrl).toString(),
      lastModified: university.sources[0]?.lastCheckedAt
        ? new Date(university.sources[0].lastCheckedAt)
        : now
    }))
  ];
}

function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
