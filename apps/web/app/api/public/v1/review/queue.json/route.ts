import { NextResponse } from "next/server";
import {
  buildReviewQueueApiResponse,
  getReviewQueueData
} from "@/lib/review-dashboards";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    buildReviewQueueApiResponse(await getReviewQueueData())
  );
}
