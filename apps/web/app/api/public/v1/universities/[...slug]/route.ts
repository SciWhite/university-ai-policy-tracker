import { buildPublicEntitySummaryResponse } from "@uapt/shared";
import { NextResponse } from "next/server";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
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

  return universities.flatMap((university) => [
    { slug: [university.slug] },
    { slug: [`${university.slug}.json`] }
  ]);
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
