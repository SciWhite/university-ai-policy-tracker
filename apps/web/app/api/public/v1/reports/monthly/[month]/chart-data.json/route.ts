import { monthlyReportSlugs } from "@/lib/monthly-report-registry";
import { getMonthlyReportChartDataResponse } from "@/lib/monthly-report-chart-data";

export const dynamic = "force-static";
export const dynamicParams = false;

interface MonthlyReportChartDataRouteProps {
  params: Promise<{
    month: string;
  }>;
}

export function generateStaticParams() {
  return monthlyReportSlugs.map((month) => ({ month }));
}

export async function GET(
  _request: Request,
  { params }: MonthlyReportChartDataRouteProps
) {
  const { month } = await params;

  return getMonthlyReportChartDataResponse(month);
}
