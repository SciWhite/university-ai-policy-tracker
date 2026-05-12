import { NextResponse } from "next/server";
import { buildPolicyAnalysisCoverageScoresResponse } from "@/lib/policy-analysis";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await buildPolicyAnalysisCoverageScoresResponse());
}
