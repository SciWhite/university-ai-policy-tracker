import { NextResponse } from "next/server";
import { getStagedRecentChangesEnvelope } from "@/lib/staged-public-data";

export async function GET() {
  return NextResponse.json(await getStagedRecentChangesEnvelope());
}
