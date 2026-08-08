import { NextResponse } from "next/server";
import { buildPolicySnapshotResponse, getLoadedPolicySnapshotBySlug, getLoadedPolicySnapshotIndex } from "@/lib/policy-snapshots";
import { getSiteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PolicySnapshotRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const index = await getLoadedPolicySnapshotIndex();

  return index.entries.map((entry) => ({
    slug: `${entry.universitySlug}.json`
  }));
}

export async function GET(
  _request: Request,
  { params }: PolicySnapshotRouteProps
) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const loaded = await getLoadedPolicySnapshotBySlug(universitySlug);

  if (!loaded) {
    return NextResponse.json(
      { error: `Policy snapshot not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  return NextResponse.json(buildPolicySnapshotResponse(loaded, getSiteBaseUrl()));
}
