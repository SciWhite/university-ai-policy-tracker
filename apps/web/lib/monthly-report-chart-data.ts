import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation
} from "@uapt/shared";
import { getMonthlyReport } from "@/lib/reports";

// Shared response builder for the monthly chart-data routes: the canonical
// /reports/monthly/[month]/chart-data.json route and the legacy fixed-path
// aliases serve identical payloads.
export async function getMonthlyReportChartDataResponse(
  month: string
): Promise<NextResponse> {
  const report = await getMonthlyReport(month);

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
