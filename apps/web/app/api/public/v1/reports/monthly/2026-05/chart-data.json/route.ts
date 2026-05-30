import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation
} from "@uapt/shared";
import {
  currentMonthlyReportSlug,
  getMonthlyReport
} from "@/lib/reports";

export const dynamic = "force-static";

export async function GET() {
  const report = await getMonthlyReport(currentMonthlyReportSlug);

  if (!report) {
    return NextResponse.json(
      {
        apiVersion: PUBLIC_API_VERSION,
        error: "Report not found"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: report.publishedAt,
    canonicalUrl: report.canonicalUrl,
    publicJsonUrl: report.chartDataUrl,
    report: {
      slug: report.slug,
      type: report.type,
      month: report.month,
      title: report.title,
      releaseId: report.releaseId,
      releasePeriod: report.releasePeriod,
      publishedAt: report.publishedAt
    },
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    limitations: report.limitations,
    citation: buildPublicApiCitation({
      citationTitle: `${report.title} chart data`,
      canonicalUrl: report.canonicalUrl,
      publicJsonUrl: report.chartDataUrl,
      suggestedCitation:
        `University AI Policy Tracker. "${report.title} chart data." ` +
        `Published ${report.publishedAt}. ${report.canonicalUrl}`
    }),
    data: {
      metrics: report.metrics,
      sourceLanguages: report.sourceLanguageChart,
      reviewStates: report.reviewStateChart,
      macroRegions: report.coverageGroups.map((group) => ({
        label: group.macroRegion,
        value: group.universityCount,
        countryOrRegionCount: group.countryCount,
        cityCampusRegionCount: group.cityGroups.length
      })),
      cityCampusRegions: report.coverageGroups.flatMap((group) =>
        group.cityGroups.map((cityGroup) => ({
          macroRegion: group.macroRegion,
          label: cityGroup.cityCampusRegion,
          value: cityGroup.universityCount,
          countryOrRegionCount: cityGroup.countryCount
        }))
      ),
      rankingCoverage: report.rankingCoverage,
      coverageSummary: report.coverageSummary
    }
  });
}
