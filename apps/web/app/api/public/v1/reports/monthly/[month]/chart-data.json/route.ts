import { isMonthlyReportSlug } from "@/lib/monthly-report-registry";
import { getMonthlyReportChartDataResponse } from "@/lib/monthly-report-chart-data";
import { contentTagFor, tagContent } from "@/lib/content-cache-tags";

export const dynamic = "force-static";
// Months come from the content release: unknown ones 404 at request time.
export const dynamicParams = true;

interface MonthlyReportChartDataRouteProps {
  params: Promise<{
    month: string;
  }>;
}

export function generateStaticParams() {
  return [];
}

export async function GET(
  _request: Request,
  { params }: MonthlyReportChartDataRouteProps
) {
  const { month } = await params;
  if (!isMonthlyReportSlug(month)) return new Response("Not Found", { status: 404 });
  await tagContent("reports", contentTagFor.report(month));

  return getMonthlyReportChartDataResponse(month);
}
