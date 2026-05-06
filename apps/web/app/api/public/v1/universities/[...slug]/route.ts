import { buildPublicEntitySummaryResponse } from "@uapt/shared";
import { NextResponse } from "next/server";
import { getPublicUniversitySummaryBySlug } from "@/lib/catalog";
import { getSiteBaseUrl } from "@/lib/site-url";

interface PublicUniversityRouteProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function GET(_request: Request, { params }: PublicUniversityRouteProps) {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const universitySlug = slugPath.endsWith(".json")
    ? slugPath.slice(0, -".json".length)
    : slugPath;
  const summary = await getPublicUniversitySummaryBySlug(universitySlug);

  if (!summary) {
    return NextResponse.json(
      { error: `University not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  return NextResponse.json(
    buildPublicEntitySummaryResponse(summary, getSiteBaseUrl())
  );
}
