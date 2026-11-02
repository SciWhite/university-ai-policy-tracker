import { NextResponse } from "next/server";
import {
  getKnownReleaseIds,
  getReleaseDiff,
  getScopedRecordReleaseDiff,
  getV5RecordReleaseDiff
} from "@/lib/release-diffs";
import { readV6RecordCorrectionRevision } from "@/lib/v6-effective-records";

interface ReleaseDiffRouteProps {
  params: Promise<{
    releaseId: string;
  }>;
}

export const dynamic = "force-dynamic";
// Historical release IDs remain addressable after the active release changes.
export const dynamicParams = true;

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
  const correction = readV6RecordCorrectionRevision(releaseId);
  const isV5RecordRelease = releaseId.startsWith("pku-v5-");
  const isScopedRecordRelease = Object.values(correction?.recordRevisions ?? {}).some(
    (revision) => revision.universityRevisionId === releaseId && revision.baselineRevisionId
  );
  const diff = isV5RecordRelease
    ? await getV5RecordReleaseDiff(releaseId)
    : isScopedRecordRelease
      ? await getScopedRecordReleaseDiff(releaseId, correction)
      : await getReleaseDiff(releaseId);

  if (!diff) {
    return NextResponse.json({ error: "Release diff not found" }, { status: 404 });
  }

  return NextResponse.json(diff, {
    ...(isV5RecordRelease || isScopedRecordRelease
      ? { headers: { "Cache-Control": "private, no-store, no-transform" } }
      : {})
  });
}
