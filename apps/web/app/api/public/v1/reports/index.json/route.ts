import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation
} from "@uapt/shared";
import { NextResponse } from "next/server";
import { getReportsIndex } from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export async function GET() {
  const reports = await getReportsIndex();
  const canonicalUrl = getAbsoluteSiteUrl("/reports");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/reports/index.json`
  );
  const generatedAt =
    reports[0]?.publishedAt ?? new Date("2026-05-01T00:00:00.000Z").toISOString();

  return NextResponse.json({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    publicJsonUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker reports index",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker reports index. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      reports: reports.map((report) => ({
        slug: report.slug,
        title: report.title,
        description: report.description,
        canonicalUrl: report.canonicalUrl,
        publicPagePath: report.canonicalPath,
        releaseId: report.releaseId,
        releasePeriod: report.releasePeriod,
        publishedAt: report.publishedAt,
        chartDataUrl: report.chartDataUrl,
        chartDataPath: report.chartDataPath,
        feedUrl: report.feedUrl,
        ogImageUrl: report.ogImageUrl,
        metrics: report.metrics,
        dataLinks: report.dataLinks,
        methodologyLinks: report.methodologyLinks,
        summaryBullets: report.summaryBullets,
        limitations: report.limitations
      })),
      feeds: [
        {
          label: "Reports RSS",
          url: getAbsoluteSiteUrl("/feeds/reports.xml"),
          mediaType: "application/rss+xml"
        },
        {
          label: "Recent changes RSS",
          url: getAbsoluteSiteUrl("/feeds/recent-changes.xml"),
          mediaType: "application/rss+xml"
        },
        {
          label: "Combined Atom",
          url: getAbsoluteSiteUrl("/feeds/atom.xml"),
          mediaType: "application/atom+xml"
        }
      ],
      outreach: {
        canonicalUrl: getAbsoluteSiteUrl("/reports/outreach"),
        publicJsonUrl: getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`
        )
      }
    }
  });
}
