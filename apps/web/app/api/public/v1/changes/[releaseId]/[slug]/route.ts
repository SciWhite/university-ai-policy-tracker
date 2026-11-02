import { NextResponse } from "next/server";
import {
  getEntityReleaseDiff,
  getLatestReleaseDiff,
  getReleaseDiff,
  getScopedRecordReleaseDiff,
  getV5RecordReleaseDiff
} from "@/lib/release-diffs";
import { aliasSlugJsonRedirect } from "@/lib/entity-alias-redirect";
import { readV6RecordCorrectionRevision } from "@/lib/v6-effective-records";

interface ReleaseEntityDiffRouteProps {
  params: Promise<{
    releaseId: string;
    slug: string;
  }>;
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  const diff = await getLatestReleaseDiff().catch(() => undefined);
  if (!diff) return [];

  return diff.entities
    .filter((entity) => entity.rows.length)
    .map((entity) => ({
      releaseId: entity.currentReleaseId,
      slug: `${entity.entitySlug}.json`
    }));
}

export async function GET(
  _request: Request,
  { params }: ReleaseEntityDiffRouteProps
) {
  const { releaseId, slug: rawSlug } = await params;
  const slug = rawSlug.replace(/\.json$/, "");
  const aliasRedirect = await aliasSlugJsonRedirect(
    slug,
    (canonicalSlug) => `/api/public/v1/changes/${releaseId}/${canonicalSlug}.json`
  );
  if (aliasRedirect) return aliasRedirect;
  const correction = readV6RecordCorrectionRevision(releaseId);
  const isV5RecordRelease = releaseId.startsWith("pku-v5-");
  const isScopedRecordRelease = Object.values(correction?.recordRevisions ?? {}).some(
    (revision) => revision.universityRevisionId === releaseId && revision.baselineRevisionId
  );
  const diff = isV5RecordRelease
    ? await getV5RecordReleaseDiff(releaseId)
    : isScopedRecordRelease
      ? await getScopedRecordReleaseDiff(releaseId, correction)
      : undefined;
  const entityDiff = diff?.entities.find((entity) => entity.entitySlug === slug) ??
    (!isV5RecordRelease && !isScopedRecordRelease
      ? await getEntityReleaseDiff(releaseId, slug)
      : undefined);

  if (!entityDiff) {
    return NextResponse.json({ error: "Change diff not found" }, { status: 404 });
  }

  return NextResponse.json(entityDiff, {
    ...(isV5RecordRelease || isScopedRecordRelease
      ? { headers: { "Cache-Control": "private, no-store, no-transform" } }
      : {})
  });
}
