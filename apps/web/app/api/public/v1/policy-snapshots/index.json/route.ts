import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  POLICY_SNAPSHOT_INDEX_SCHEMA_VERSION,
  POLICY_SNAPSHOT_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation,
  policySnapshotIndexResponseSchema,
  policySnapshotIndexSchema
} from "@uapt/shared";
import { NextResponse } from "next/server";
import { getLoadedPolicySnapshotIndex } from "@/lib/policy-snapshots";
import { getAbsoluteSiteUrl, getSiteBaseUrl } from "@/lib/site-url";
import { readV6RecordCorrections } from "@/lib/v6-effective-records";
import { withIndexProvenance } from "@/lib/index-provenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const loadedIndex = await getLoadedPolicySnapshotIndex();
  const data = policySnapshotIndexSchema.parse({
    schemaVersion: POLICY_SNAPSHOT_INDEX_SCHEMA_VERSION,
    apiVersion: PUBLIC_API_VERSION,
    snapshotSchemaVersion: POLICY_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: loadedIndex.generatedAt,
    releaseId: loadedIndex.releaseId,
    entries: loadedIndex.entries.map(({ loaded: _loaded, ...entry }) => entry),
    limitations: loadedIndex.limitations.length
      ? loadedIndex.limitations
      : [NO_ADVICE_BOUNDARY]
  });
  const publicJsonUrl = getAbsoluteSiteUrl(
    "/api/public/v1/policy-snapshots/index.json"
  );

  const response = policySnapshotIndexResponseSchema.parse({
      apiVersion: PUBLIC_API_VERSION,
      generatedAt: loadedIndex.generatedAt,
      canonicalUrl: new URL("/policy-snapshots", getSiteBaseUrl()).toString(),
      license: TRACKER_METADATA_LICENSE,
      trackerMetadataLicense: TRACKER_METADATA_LICENSE,
      sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
      limitations: data.limitations,
      citation: buildPublicApiCitation({
        citationTitle: "University AI Policy Tracker student policy snapshots",
        canonicalUrl: new URL("/policy-snapshots", getSiteBaseUrl()).toString(),
        publicJsonUrl,
        suggestedCitation:
          "University AI Policy Tracker student policy snapshots. " +
          "University AI Policy Tracker. Version uapt-policy-snapshot-v1."
      }),
      data
    });
  return NextResponse.json(withIndexProvenance(response, readV6RecordCorrections()), {
    headers: { "Cache-Control": "private, no-store, no-transform" }
  });
}
