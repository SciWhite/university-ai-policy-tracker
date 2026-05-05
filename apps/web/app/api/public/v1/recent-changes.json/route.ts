import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  TRACKER_METADATA_LICENSE,
  buildSeedPublicEntitySummaries,
  publicRecentChangesResponseSchema
} from "@uapt/shared";
import { NextResponse } from "next/server";
import { getSiteBaseUrl } from "../../../../../lib/site-url";

export function GET() {
  const summaries = buildSeedPublicEntitySummaries(getSiteBaseUrl());
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
