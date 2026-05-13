import { NextResponse } from "next/server";
import {
  buildSourceHealthApiResponse,
  getSourceHealthDashboardData
} from "@/lib/review-dashboards";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    buildSourceHealthApiResponse(await getSourceHealthDashboardData())
  );
}
