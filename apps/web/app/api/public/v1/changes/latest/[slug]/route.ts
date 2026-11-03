import { NextResponse } from "next/server";
import { aliasSlugJsonRedirect } from "@/lib/entity-alias-redirect";
import {
  getLatestEntityReleaseDiff,
  getLatestReleaseDiff,
  getScopedRecordReleaseDiff
} from "@/lib/release-diffs";
import { readV6RecordCorrections, readV6RecordCorrectionRevision } from "@/lib/v6-effective-records";

interface LatestEntityDiffRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function GET(
  _request: Request,
  { params }: LatestEntityDiffRouteProps
) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.replace(/\.json$/, "");
  const aliasRedirect = await aliasSlugJsonRedirect(
    slug,
    (canonicalSlug) => `/api/public/v1/changes/latest/${canonicalSlug}.json`
  );
  if (aliasRedirect) return aliasRedirect;
  const correction = readV6RecordCorrections();
  const recordRevision = correction?.recordRevisions[slug];
  const scopedDiff = recordRevision?.baselineRevisionId
    ? await getScopedRecordReleaseDiff(recordRevision.universityRevisionId, correction)
    : undefined;
  const entityDiff =
    scopedDiff?.entities.find((entity) => entity.entitySlug === slug) ??
    await getLatestEntityReleaseDiff(slug);

  if (!entityDiff) {
    return NextResponse.json({ error: "Change diff not found" }, { status: 404 });
  }

  const scopedCorrection = correction?.changesBySlug[slug] && recordRevision
    ? {
        revision: recordRevision.universityRevisionId,
        ...readV6RecordCorrectionRevision(recordRevision.universityRevisionId)?.changesBySlug[slug]
      }
    : undefined;
  return NextResponse.json({
    ...entityDiff,
    ...(scopedCorrection ? { scopedRecordCorrection: scopedCorrection } : {})
  });
}
