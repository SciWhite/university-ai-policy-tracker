import { NextResponse, type NextRequest } from "next/server";
import {
  getAnalyticsDashboard,
  parseAnalyticsDashboardQuery
} from "@/lib/private-analytics-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = parseAnalyticsDashboardQuery(request.nextUrl.searchParams);
    const dashboard = await getAnalyticsDashboard(query);
    return NextResponse.json(dashboard, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "analytics_dashboard_unavailable",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        status: 503
      }
    );
  }
}
