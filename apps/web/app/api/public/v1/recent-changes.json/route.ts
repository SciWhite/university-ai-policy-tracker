import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  TRACKER_METADATA_LICENSE,
  buildPublicRecentChangesData,
  buildPublicRecentChangesEnvelope,
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
    changes: buildPublicRecentChangesData(summaries).changes
  });

  return NextResponse.json(
    buildPublicRecentChangesEnvelope(response, getSiteBaseUrl())
  );
}
