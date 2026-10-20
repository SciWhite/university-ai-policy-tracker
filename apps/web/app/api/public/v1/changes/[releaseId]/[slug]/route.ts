import { NextResponse } from "next/server";
import {
  getEntityReleaseDiff,
  getLatestReleaseDiff,
  getReleaseDiff
} from "@/lib/release-diffs";
import { aliasSlugJsonRedirect } from "@/lib/entity-alias-redirect";

interface ReleaseEntityDiffRouteProps {
  params: Promise<{
    releaseId: string;
    slug: string;
  }>;
}

export const dynamic = "force-static";
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
  const entityDiff = await getEntityReleaseDiff(releaseId, slug);

  if (!entityDiff) {
    return NextResponse.json({ error: "Change diff not found" }, { status: 404 });
  }

  return NextResponse.json(entityDiff);
}
