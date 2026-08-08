import { buildPublicEntitySummaryResponse } from "@uapt/shared";
import { NextResponse } from "next/server";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { getAliasSlugs, getCanonicalSlugForAlias } from "@/lib/entity-aliases";
import { getPublicUniversityPolicySnapshotLink } from "@/lib/policy-snapshots";
import { getSiteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PublicUniversityRouteProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();
  const aliasSlugs = await getAliasSlugs();

  return [...universities.map((university) => university.slug), ...aliasSlugs].flatMap(
    (slug) => [{ slug: [slug] }, { slug: [`${slug}.json`] }]
  );
}

export async function GET(_request: Request, { params }: PublicUniversityRouteProps) {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const hasJsonSuffix = slugPath.endsWith(".json");
  const universitySlug = hasJsonSuffix
    ? slugPath.slice(0, -".json".length)
    : slugPath;
  const canonicalSlug = await getCanonicalSlugForAlias(universitySlug);

  if (canonicalSlug) {
    return NextResponse.redirect(
      new URL(
        `/api/public/v1/universities/${canonicalSlug}${hasJsonSuffix ? ".json" : ""}`,
        getSiteBaseUrl()
      ),
      308
    );
  }
  const summary = await getPublicUniversitySummaryBySlug(universitySlug);

  if (!summary) {
    return NextResponse.json(
      { error: `University not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  const policySnapshot = await getPublicUniversityPolicySnapshotLink(
    summary.entity.slug,
    getSiteBaseUrl()
  );
  const summaryWithOptionalSnapshot = policySnapshot
    ? { ...summary, policySnapshot }
    : summary;

  return NextResponse.json(
    buildPublicEntitySummaryResponse(summaryWithOptionalSnapshot, getSiteBaseUrl())
  );
}
