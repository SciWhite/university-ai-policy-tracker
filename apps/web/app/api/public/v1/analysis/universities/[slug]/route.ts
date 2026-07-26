import { NextResponse } from "next/server";
import { getAliasSlugs, getCanonicalSlugForAlias } from "@/lib/entity-aliases";
import {
  buildPolicyAnalysisProfileResponse,
  getPolicyAnalysisProfileBySlug,
  getPolicyAnalysisProfiles
} from "@/lib/policy-analysis";
import { getSiteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PolicyAnalysisRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const profiles = await getPolicyAnalysisProfiles();
  const aliasSlugs = await getAliasSlugs();

  return [
    ...profiles.map((profile) => profile.entitySlug),
    ...aliasSlugs
  ].map((slug) => ({ slug: `${slug}.json` }));
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
