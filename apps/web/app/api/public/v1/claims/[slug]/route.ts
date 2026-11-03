import { NextResponse } from "next/server";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiCitation
} from "@uapt/shared";
import {
  getStagedPublicSummaries,
  getStagedPublicSummaryBySlug
} from "@/lib/staged-public-data";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getAliasSlugs } from "@/lib/entity-aliases";
import { aliasSlugJsonRedirect } from "@/lib/entity-alias-redirect";

export const dynamic = "force-dynamic";
// V6-published records can extend beyond the base summary list at build time.
export const dynamicParams = true;

interface ClaimsRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: ClaimsRouteProps) {
  const { slug } = await params;
  const hasJsonSuffix = slug.endsWith(".json");
  const universitySlug = hasJsonSuffix ? slug.slice(0, -".json".length) : slug;
  const aliasRedirect = await aliasSlugJsonRedirect(
    universitySlug,
    (canonicalSlug) =>
      `/api/public/${PUBLIC_API_VERSION}/claims/${canonicalSlug}${hasJsonSuffix ? ".json" : ""}`
  );
  if (aliasRedirect) return aliasRedirect;
  const summary = await getStagedPublicSummaryBySlug(universitySlug);

  if (!summary) {
    return NextResponse.json(
      { error: `University claims not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  const canonicalUrl = summary.canonicalUrl;
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/claims/${summary.entity.slug}.json`
  );

  return NextResponse.json({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: summary.lastCheckedAt ?? new Date().toISOString(),
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: summary.limitations.length
      ? summary.limitations
      : [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: `${summary.entity.name} AI policy claims`,
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        `University AI Policy Tracker. "${summary.entity.name} AI policy claims." ` +
        `Version ${PUBLIC_API_VERSION}. ${canonicalUrl}`
    }),
    data: {
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
      publicJsonUrl:
        summary.apiUrl ??
        getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`
        ),
      claimCount: summary.claims.length,
      reviewState: summary.reviewState,
      confidence: summary.confidence,
      claims: summary.claims
    }
  });
}
