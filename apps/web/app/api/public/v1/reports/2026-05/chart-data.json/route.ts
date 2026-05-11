import { NextResponse } from "next/server";
import {
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
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
    report: {
      slug: report.slug,
      title: report.title,
      releaseId: report.releaseId,
      releasePeriod: report.releasePeriod
    },
    license: TRACKER_METADATA_LICENSE,
    limitations: report.limitations,
    data: {
      metrics: report.metrics,
      sourceLanguages: report.sourceLanguageChart,
      reviewStates: report.reviewStateChart
    }
  });
}
