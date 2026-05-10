import { NextResponse } from "next/server";
import { getDatasetRelease } from "@/lib/dataset-release";

export const dynamic = "force-static";

export async function GET() {
  const release = await getDatasetRelease();

  return NextResponse.json(release.manifest);
}
