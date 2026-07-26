import { getMonthlyReportChartDataResponse } from "@/lib/monthly-report-chart-data";

export const dynamic = "force-static";

export function GET() {
  return getMonthlyReportChartDataResponse("2026-06");
}
