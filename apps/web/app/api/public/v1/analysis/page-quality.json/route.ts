import { NextResponse } from "next/server";
import { buildPolicyAnalysisPageQualityResponse } from "@/lib/policy-analysis-pages";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await buildPolicyAnalysisPageQualityResponse());
}
