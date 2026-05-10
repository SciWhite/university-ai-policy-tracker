import { NextResponse } from "next/server";
import { getStagedPublicUniversityListResponse } from "@/lib/staged-public-data";

export async function GET() {
  return NextResponse.json(await getStagedPublicUniversityListResponse());
}
