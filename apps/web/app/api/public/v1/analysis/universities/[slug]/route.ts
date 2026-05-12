import { NextResponse } from "next/server";
import {
  buildPolicyAnalysisProfileResponse,
  getPolicyAnalysisProfileBySlug,
  getPolicyAnalysisProfiles
} from "@/lib/policy-analysis";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PolicyAnalysisRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const profiles = await getPolicyAnalysisProfiles();

  return profiles.map((profile) => ({
    slug: `${profile.entitySlug}.json`
  }));
}

export async function GET(_request: Request, { params }: PolicyAnalysisRouteProps) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const profile = await getPolicyAnalysisProfileBySlug(universitySlug);

  if (!profile) {
    return NextResponse.json(
      { error: `Policy analysis profile not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  return NextResponse.json(buildPolicyAnalysisProfileResponse(profile));
}
