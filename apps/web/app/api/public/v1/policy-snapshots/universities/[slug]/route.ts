import { NextResponse } from "next/server";
import { buildPolicySnapshotResponse, getLoadedPolicySnapshotBySlug, getLoadedPolicySnapshotIndex } from "@/lib/policy-snapshots";
import { getSiteBaseUrl } from "@/lib/site-url";
import { v6RecordRevision } from "@/lib/v6-effective-records";

export const dynamic = "force-dynamic";
// Published V6 snapshots can be addressed even when they are not in the base manifest.
export const dynamicParams = true;

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
  const recordRevision = v6RecordRevision(universitySlug);

  if (!loaded) {
    if (recordRevision) {
      return NextResponse.json(
        { error: "Student snapshot not published", reasonCode: "not_published", recordRevision },
        { status: 404, headers: { "Cache-Control": "private, no-store, no-transform" } }
      );
    }
    return NextResponse.json(
      { error: `Policy snapshot not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  return NextResponse.json(buildPolicySnapshotResponse(loaded, getSiteBaseUrl()), {
    ...(recordRevision ? { headers: { "Cache-Control": "private, no-store, no-transform" } } : {})
  });
}
