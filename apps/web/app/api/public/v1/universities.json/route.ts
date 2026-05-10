import { NextResponse } from "next/server";
import { getStagedPublicUniversityListResponse } from "@/lib/staged-public-data";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getStagedPublicUniversityListResponse());
}
