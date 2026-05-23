import { NextResponse } from "next/server";
import { getKnownReleaseIds, getReleaseDiff } from "@/lib/release-diffs";

interface ReleaseDiffRouteProps {
  params: Promise<{
    releaseId: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getKnownReleaseIds()).map((releaseId) => ({
    releaseId: `${releaseId}.json`
  }));
}

export async function GET(
  _request: Request,
  { params }: ReleaseDiffRouteProps
) {
  const { releaseId: rawReleaseId } = await params;
  const releaseId = rawReleaseId.replace(/\.json$/, "");
  const diff = await getReleaseDiff(releaseId);

  if (!diff) {
    return NextResponse.json({ error: "Release diff not found" }, { status: 404 });
  }

  return NextResponse.json(diff);
}
