import { NextResponse } from "next/server";
import {
  buildCoverageApiResponse,
  getCoverageDashboardData
} from "@/lib/review-dashboards";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    buildCoverageApiResponse(await getCoverageDashboardData())
  );
}
