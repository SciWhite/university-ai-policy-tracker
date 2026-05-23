import { NextResponse } from "next/server";
import { getLatestEntityReleaseDiff, getLatestReleaseDiff } from "@/lib/release-diffs";

interface LatestEntityDiffRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = true;

export async function generateStaticParams() {
  const diff = await getLatestReleaseDiff();

  return diff.entities
    .filter((entity) => entity.rows.length)
    .map((entity) => ({ slug: `${entity.entitySlug}.json` }));
}

export async function GET(
  _request: Request,
  { params }: LatestEntityDiffRouteProps
) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.replace(/\.json$/, "");
  const entityDiff = await getLatestEntityReleaseDiff(slug);

  if (!entityDiff) {
    return NextResponse.json({ error: "Change diff not found" }, { status: 404 });
  }

  return NextResponse.json(entityDiff);
}
