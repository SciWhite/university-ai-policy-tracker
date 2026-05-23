import { NextResponse } from "next/server";
import { getLatestReleaseDiff } from "@/lib/release-diffs";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await getLatestReleaseDiff());
}
