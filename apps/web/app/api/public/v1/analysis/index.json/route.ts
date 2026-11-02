import { NextResponse } from "next/server";
import { buildPolicyAnalysisIndexResponse } from "@/lib/policy-analysis";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildPolicyAnalysisIndexResponse());
}
