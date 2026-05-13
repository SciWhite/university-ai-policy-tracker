import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation
} from "@uapt/shared";
import { NextResponse } from "next/server";
import { getMonthlyReport, getOutreachPackage } from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export async function GET() {
  const [outreach, report] = await Promise.all([
    getOutreachPackage(),
    getMonthlyReport()
  ]);
  const canonicalUrl = outreach.canonicalUrl;
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`
  );
  const generatedAt =
    report?.publishedAt ?? new Date("2026-05-01T00:00:00.000Z").toISOString();

  return NextResponse.json({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    publicJsonUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker outreach package",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker outreach package. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      title: outreach.title,
      description: outreach.description,
      canonicalPath: outreach.canonicalPath,
      canonicalUrl: outreach.canonicalUrl,
      assets: outreach.assets,
      report: report
        ? {
            slug: report.slug,
            title: report.title,
            canonicalUrl: report.canonicalUrl,
            chartDataUrl: report.chartDataUrl,
            ogImageUrl: report.ogImageUrl,
            releaseId: report.releaseId,
            releasePeriod: report.releasePeriod,
            publishedAt: report.publishedAt
          }
        : undefined,
      useBoundaries: [
        "Do not describe candidate or needs-review claims as final policy conclusions.",
        "Preserve official source URLs and original-language evidence when discussing a specific institution.",
        "Do not frame tracker metadata as legal advice, compliance advice, academic integrity advice, or course permission advice.",
        "Use tracker metrics as public dataset coverage, not as a ranking of university policy quality."
      ]
    }
  });
}
