import { NextResponse } from "next/server";
import { buildContributionPolicyResponse } from "@/lib/contribution-surfaces";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildContributionPolicyResponse());
}
