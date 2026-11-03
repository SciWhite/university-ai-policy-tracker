import { NextResponse } from "next/server";
import { getAliasSlugs, getCanonicalSlugForAlias } from "@/lib/entity-aliases";
import {
  buildPolicyAnalysisProfileResponse,
  getPolicyAnalysisProfileBySlug,
  getPolicyAnalysisProfiles
} from "@/lib/policy-analysis";
import { getSiteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
// Shared V6 records include published slugs outside the base dataset manifest.
export const dynamicParams = true;

interface PolicyAnalysisRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: PolicyAnalysisRouteProps) {
  const { slug } = await params;
  const hasJsonSuffix = slug.endsWith(".json");
  const universitySlug = hasJsonSuffix
    ? slug.slice(0, -".json".length)
    : slug;
  const canonicalSlug = await getCanonicalSlugForAlias(universitySlug);

  if (canonicalSlug) {
    return NextResponse.redirect(
      new URL(
        `/api/public/v1/analysis/universities/${canonicalSlug}${hasJsonSuffix ? ".json" : ""}`,
        getSiteBaseUrl()
      ),
      308
    );
  }
  const profile = await getPolicyAnalysisProfileBySlug(universitySlug);

  if (!profile) {
    return NextResponse.json(
      { error: `Policy analysis profile not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  return NextResponse.json(buildPolicyAnalysisProfileResponse(profile));
}
