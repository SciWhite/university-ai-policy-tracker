import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  TRACKER_METADATA_LICENSE,
  buildSeedPublicEntitySummaries,
  publicRecentChangesResponseSchema
} from "@uapt/shared";
import { NextResponse } from "next/server";

export function GET() {
  const summaries = buildSeedPublicEntitySummaries(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  );
  const response = publicRecentChangesResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    license: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    changes: summaries.map((summary) => ({
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      canonicalUrl: summary.canonicalUrl,
      citationTitle: summary.citationTitle,
      lastCheckedAt: summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt,
      reviewState: summary.reviewState,
      claimCount: summary.claims.length,
      claims: summary.claims
    }))
  });

  return NextResponse.json(response);
}
